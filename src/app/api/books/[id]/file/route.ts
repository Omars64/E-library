import { get } from "@vercel/blob";
import { currentUser, unauthorized } from "@/lib/api";
import { requireDatabase } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  const result = await requireDatabase().query(
    "SELECT blob_path,mime_type,original_filename FROM books WHERE id=$1 AND owner_id=$2 AND status='ready'", [id,user.id]);
  const book = result.rows[0];
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  const file = await get(book.blob_path, { access: "private" });
  if (!file?.stream || file.statusCode !== 200) return NextResponse.json({ error: "File not found" }, { status: 404 });
  const safeName = String(book.original_filename).replace(/[^\x20-\x7e]|["\\]/g, "_");
  return new NextResponse(file.stream, {
    headers: {
      "Content-Type": book.mime_type,
      "Content-Disposition": `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(book.original_filename).replace(/['()*]/g, (c) => "%" + c.charCodeAt(0).toString(16))}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
