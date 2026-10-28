import { currentUser, unauthorized, invalid, jsonBody } from "@/lib/api";
import { randomUUID } from "node:crypto";
import { requireDatabase } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const kinds = new Set(["duas", "hadiths", "quotes"]);

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const kind = request.nextUrl.searchParams.get("kind");
  if (kind && !kinds.has(kind)) return NextResponse.json({ error: "Unknown catalog kind" }, { status: 400 });
  const result = await requireDatabase().query(
    `SELECT c.id,c.kind,c.title,c.text,c.arabic,c.source,c.author,c.category,
       (f.item_id IS NOT NULL) AS "isFavorite"
     FROM catalog_entries c LEFT JOIN favorites f ON f.owner_id=$2 AND f.item_kind=c.kind AND f.item_id=c.id
     WHERE ($1::text IS NULL OR c.kind = $1) AND (c.owner_id IS NULL OR c.owner_id=$2) ORDER BY c.kind,c.title LIMIT 500`, [kind,user.id]);
  return NextResponse.json({ items: result.rows });
}

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  let body: Record<string, unknown>;
  try { body = await jsonBody(request); } catch { return invalid("Invalid entry"); }
  const kind = String(body.kind ?? "");
  const title = String(body.title ?? "").trim();
  const text = String(body.text ?? "").trim();
  const source = String(body.source ?? "").trim();
  const arabic = String(body.arabic ?? "").trim();
  const category = String(body.category ?? "General").trim() || "General";
  if (!kinds.has(kind) || !title || title.length > 200 || !text || text.length > 20000 || source.length > 1000 || arabic.length > 20000 || category.length > 80) return invalid("Check the entry fields and their lengths.");
  if (kind !== "quotes" && !source) return invalid("Add a source or reference for this entry.");
  const result = await requireDatabase().query("INSERT INTO catalog_entries(id,owner_id,kind,title,text,source,arabic,category) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,kind,title,text,source,arabic,category", [randomUUID(),user.id,kind,title,text,source || null,arabic || null,category]);
  return NextResponse.json({ item: result.rows[0] }, { status: 201 });
}
