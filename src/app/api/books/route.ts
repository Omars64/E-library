import { currentUser, invalid, jsonBody, unauthorized } from "@/lib/api";
import { requireDatabase } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const palettes = new Set(["burgundy", "plum", "forest", "navy", "brown", "sand"]);
const formats = new Map([
  ["pdf", ["application/pdf"]],
  ["docx", ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]],
]);

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const result = await requireDatabase().query(
    `SELECT id, title, author, description, palette, format, original_filename AS "filename",
       byte_size AS "byteSize", status, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM books WHERE owner_id=$1 AND status='ready' ORDER BY created_at DESC LIMIT 1000`, [user.id]);
  return NextResponse.json({ books: result.rows });
}

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  let body: Record<string, unknown>;
  try { body = await jsonBody(request); } catch { return invalid("Invalid book details"); }
  const title = String(body.title ?? "").trim();
  const author = String(body.author ?? "").trim();
  const description = String(body.description ?? "").trim();
  const palette = String(body.palette ?? "");
  const filename = String(body.filename ?? "").trim();
  const mimeType = String(body.mimeType ?? "");
  const byteSize = Number(body.byteSize);
  const format = filename.toLowerCase().endsWith(".pdf") ? "pdf" : filename.toLowerCase().endsWith(".docx") ? "docx" : "";
  if (!title || title.length > 200 || author.length > 120 || description.length > 2000) return invalid("Check the title, author and description lengths");
  if (!palettes.has(palette)) return invalid("Choose a cover palette");
  if (!format || !formats.get(format)?.includes(mimeType)) return invalid("Upload a PDF or DOCX file");
  if (!Number.isInteger(byteSize) || byteSize < 100 || byteSize > 50 * 1024 * 1024) return invalid("File must be between 100 bytes and 50 MB");
  if (filename.length > 255 || /[\\/\u0000-\u001f]/.test(filename)) return invalid("Invalid filename");
  const id = randomUUID();
  const uploadPath = `books/${user.id}/${id}.${format}`;
  const result = await requireDatabase().query(
    `INSERT INTO books(id,owner_id,title,author,description,palette,format,original_filename,mime_type,byte_size,blob_path)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id,title,author,description,palette,format,original_filename AS "filename",
       byte_size AS "byteSize",status,created_at AS "createdAt"`,
    [id,user.id,title,author || null,description || null,palette,format,filename,mimeType,byteSize,uploadPath]);
  return NextResponse.json({ book: result.rows[0], uploadPath }, { status: 201 });
}
