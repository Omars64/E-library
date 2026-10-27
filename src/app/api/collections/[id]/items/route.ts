import { currentUser, invalid, jsonBody, unauthorized } from "@/lib/api";
import { requireDatabase } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };
const kinds = new Set(["duas","hadiths","quotes","books"]);

async function validItem(ownerId: string, kind: string, itemId: string) {
  const query = kind === "books"
    ? "SELECT 1 FROM books WHERE id=$1 AND owner_id=$2 AND status='ready'"
    : "SELECT 1 FROM catalog_entries WHERE id=$1 AND kind=$2";
  const result = await requireDatabase().query(query, [itemId,kind === "books" ? ownerId : kind]);
  return Boolean(result.rowCount);
}

export async function POST(request: NextRequest, context: Context) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try { body = await jsonBody(request); } catch { return invalid("Invalid item"); }
  const kind = String(body.kind ?? ""), itemId = String(body.itemId ?? "");
  if (!kinds.has(kind) || !itemId || itemId.length > 100) return invalid("Invalid item");
  const collection = await requireDatabase().query("SELECT 1 FROM collections WHERE id=$1 AND owner_id=$2", [id,user.id]);
  if (!collection.rowCount) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  if (!await validItem(user.id,kind,itemId)) return invalid("Item does not exist");
  await requireDatabase().query(
    "INSERT INTO collection_items(collection_id,item_kind,item_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [id,kind,itemId]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, context: Context) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try { body = await jsonBody(request); } catch { return invalid("Invalid item"); }
  const kind = String(body.kind ?? ""), itemId = String(body.itemId ?? "");
  const collection = await requireDatabase().query("SELECT 1 FROM collections WHERE id=$1 AND owner_id=$2", [id,user.id]);
  if (!collection.rowCount) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  await requireDatabase().query(
    "DELETE FROM collection_items WHERE collection_id=$1 AND item_kind=$2 AND item_id=$3", [id,kind,itemId]);
  return NextResponse.json({ ok: true });
}
