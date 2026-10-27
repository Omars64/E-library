import { randomUUID } from "node:crypto";
import { currentUser, forbidden, invalid, jsonBody, unauthorized } from "@/lib/api";
import { requireDatabase } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const kinds = new Set(["duas", "hadiths", "quotes"]);
const editable = new Set(["title", "text", "arabic", "source", "author", "category"]);
const limits: Record<string, number> = { title: 200, text: 5000, arabic: 5000, source: 300, author: 200, category: 100 };

async function adminUser(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return { response: unauthorized() };
  const role = "role" in user ? String(user.role) : "user";
  if (!role.split(",").includes("admin")) return { response: forbidden() };
  return { user };
}

function parseFields(body: Record<string, unknown>, requireCore: boolean) {
  const fields: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(body)) {
    if (!editable.has(key)) continue;
    if (value !== null && typeof value !== "string") throw new Error(`Invalid ${key}`);
    const cleaned = value === null ? null : value.trim();
    if (cleaned !== null && cleaned.length > limits[key]) throw new Error(`${key} is too long`);
    fields[key] = cleaned;
  }
  if (requireCore && (!fields.title || !fields.text || !fields.category)) throw new Error("Title, text, and category are required");
  if (Object.hasOwn(fields,"title") && !fields.title) throw new Error("Title is required");
  if (Object.hasOwn(fields,"text") && !fields.text) throw new Error("Text is required");
  if (Object.hasOwn(fields,"category") && !fields.category) throw new Error("Category is required");
  return fields;
}

export async function GET(request: NextRequest) {
  const actor = await adminUser(request);
  if (actor.response) return actor.response;
  const result = await requireDatabase().query(
    "SELECT id,kind,title,text,arabic,source,author,category FROM catalog_entries ORDER BY kind,title LIMIT 1000");
  return NextResponse.json({ items: result.rows });
}

export async function POST(request: NextRequest) {
  const actor = await adminUser(request);
  if (actor.response) return actor.response;
  let body: Record<string, unknown>, fields: Record<string,string | null>;
  try { body = await jsonBody(request); fields = parseFields(body,true); } catch (error) { return invalid(error instanceof Error ? error.message : "Invalid entry"); }
  const kind = String(body.kind ?? "");
  if (!kinds.has(kind) || Object.keys(body).some((key) => key !== "kind" && !editable.has(key))) return invalid("Invalid entry kind or field");
  if (kind !== "quotes" && !fields.source) return invalid("A source is required for Duas and Hadiths");
  const id = randomUUID();
  const result = await requireDatabase().query(
    `INSERT INTO catalog_entries(id,kind,title,text,arabic,source,author,category)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,kind,title,text,arabic,source,author,category`,
    [id,kind,fields.title,fields.text,fields.arabic ?? null,fields.source ?? null,fields.author ?? null,fields.category]);
  return NextResponse.json({ item: result.rows[0] }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const actor = await adminUser(request);
  if (actor.response) return actor.response;
  let body: Record<string, unknown>, fields: Record<string,string | null>;
  try { body = await jsonBody(request); fields = parseFields(body,false); } catch (error) { return invalid(error instanceof Error ? error.message : "Invalid entry"); }
  const id = String(body.id ?? "");
  if (!id || Object.keys(body).some((key) => key !== "id" && !editable.has(key)) || !Object.keys(fields).length) return invalid("Invalid entry update");
  const assignments = Object.keys(fields).map((key,index) => `${key}=$${index + 2}`);
  const values = [id,...Object.values(fields)];
  const result = await requireDatabase().query(
    `UPDATE catalog_entries SET ${assignments.join(",")} WHERE id=$1 RETURNING id,kind,title,text,arabic,source,author,category`, values);
  if (!result.rowCount) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  return NextResponse.json({ item: result.rows[0] });
}

export async function DELETE(request: NextRequest) {
  const actor = await adminUser(request);
  if (actor.response) return actor.response;
  let body: Record<string, unknown>;
  try { body = await jsonBody(request); } catch { return invalid("Invalid entry"); }
  const id = String(body.id ?? "");
  if (!id) return invalid("Entry id is required");
  const client = await requireDatabase().connect();
  try {
    await client.query("BEGIN");
    const entry = await client.query("SELECT kind FROM catalog_entries WHERE id=$1 FOR UPDATE", [id]);
    if (!entry.rowCount) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Entry not found" }, { status: 404 }); }
    await client.query("DELETE FROM favorites WHERE item_kind=$1 AND item_id=$2", [entry.rows[0].kind,id]);
    await client.query("DELETE FROM collection_items WHERE item_kind=$1 AND item_id=$2", [entry.rows[0].kind,id]);
    await client.query("DELETE FROM catalog_entries WHERE id=$1", [id]);
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: "Could not delete entry" }, { status: 500 });
  } finally { client.release(); }
}
