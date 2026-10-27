import { del } from "@vercel/blob";
import { currentUser, invalid, jsonBody, unauthorized } from "@/lib/api";
import { requireDatabase } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };
const palettes = new Set(["burgundy", "plum", "forest", "navy", "brown", "sand"]);

export async function GET(request: NextRequest, context: Context) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  const result = await requireDatabase().query(
    `SELECT id,title,author,description,palette,format,original_filename AS "filename",status,created_at AS "createdAt"
     FROM books WHERE id=$1 AND owner_id=$2`, [id,user.id]);
  if (!result.rowCount) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  return NextResponse.json({ book: result.rows[0] });
}

export async function PATCH(request: NextRequest, context: Context) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try { body = await jsonBody(request); } catch { return invalid("Invalid book details"); }
  if (Object.keys(body).some(k => !["title","author","description","palette"].includes(k))) return invalid("Unsupported book field");
  const title = body.title === undefined ? null : String(body.title).trim();
  const author = body.author === undefined ? null : String(body.author).trim();
  const description = body.description === undefined ? null : String(body.description).trim();
  const palette = body.palette === undefined ? null : String(body.palette);
  if ((title !== null && (!title || title.length > 200)) || (author !== null && author.length > 120) ||
      (description !== null && description.length > 2000) || (palette !== null && !palettes.has(palette))) return invalid("Invalid book details");
  const result = await requireDatabase().query(
    `UPDATE books SET title=COALESCE($3,title),author=COALESCE($4,author),description=COALESCE($5,description),
      palette=COALESCE($6,palette),updated_at=now() WHERE id=$1 AND owner_id=$2
      RETURNING id,title,author,description,palette,format,original_filename AS "filename",byte_size AS "byteSize",status`,
    [id,user.id,title,author,description,palette]);
  if (!result.rowCount) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  return NextResponse.json({ book: result.rows[0] });
}

export async function DELETE(request: NextRequest, context: Context) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  const result = await requireDatabase().query("SELECT blob_path,status FROM books WHERE id=$1 AND owner_id=$2", [id,user.id]);
  if (!result.rowCount) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  if (result.rows[0].status === "ready") {
    try { await del(result.rows[0].blob_path); }
    catch { return NextResponse.json({ error: "Book file could not be deleted. Please retry." }, { status: 503 }); }
  }
  await requireDatabase().query("DELETE FROM books WHERE id=$1 AND owner_id=$2", [id,user.id]);
  return NextResponse.json({ ok: true });
}
