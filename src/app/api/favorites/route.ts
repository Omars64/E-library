import { currentUser, invalid, jsonBody, unauthorized } from "@/lib/api";
import { requireDatabase } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const kinds = new Set(["duas","hadiths","quotes","books"]);

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const result = await requireDatabase().query(
    "SELECT item_kind AS kind,item_id AS id FROM favorites WHERE owner_id=$1 ORDER BY created_at DESC LIMIT 2000", [user.id]);
  return NextResponse.json({ favorites: result.rows });
}

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  let body: Record<string, unknown>;
  try { body = await jsonBody(request); } catch { return invalid("Invalid favourite"); }
  const kind = String(body.kind ?? ""), itemId = String(body.itemId ?? "");
  if (!kinds.has(kind) || !itemId || itemId.length > 100) return invalid("Invalid favourite");
  const item = await requireDatabase().query(kind === "books"
    ? "SELECT 1 FROM books WHERE id=$1 AND owner_id=$2 AND status='ready'"
    : "SELECT 1 FROM catalog_entries WHERE id=$1 AND kind=$2 AND (owner_id IS NULL OR owner_id=$3)",
    kind === "books" ? [itemId,user.id] : [itemId,kind,user.id]);
  if (!item.rowCount) return invalid("Item does not exist");
  await requireDatabase().query(
    "INSERT INTO favorites(owner_id,item_kind,item_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [user.id,kind,itemId]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  let body: Record<string, unknown>;
  try { body = await jsonBody(request); } catch { return invalid("Invalid favourite"); }
  await requireDatabase().query(
    "DELETE FROM favorites WHERE owner_id=$1 AND item_kind=$2 AND item_id=$3",
    [user.id,String(body.kind ?? ""),String(body.itemId ?? "")]);
  return NextResponse.json({ ok: true });
}
