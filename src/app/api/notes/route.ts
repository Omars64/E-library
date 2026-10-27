import { currentUser, invalid, jsonBody, unauthorized } from "@/lib/api";
import { requireDatabase } from "@/lib/db";
import { cleanNoteHtml } from "@/lib/note-html";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const result = await requireDatabase().query(
    `SELECT id, folder_id AS "folderId", title, body, template, strokes, favorite,
      (trashed_at IS NOT NULL) AS trash, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM notes WHERE owner_id=$1 ORDER BY updated_at DESC LIMIT 1000`, [user.id]);
  return NextResponse.json({ notes: result.rows });
}

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  let body: Record<string, unknown>;
  try { body = await jsonBody(request); } catch { return invalid("Invalid note"); }
  const title = String(body.title ?? "Untitled note").trim().slice(0, 200) || "Untitled note";
  const text = String(body.body ?? "");
  if (text.length > 100_000) return invalid("Note is too long");
  const folderId = body.folderId ? String(body.folderId) : null;
  if (folderId) {
    const folder = await requireDatabase().query("SELECT 1 FROM folders WHERE id=$1 AND owner_id=$2", [folderId, user.id]);
    if (!folder.rowCount) return invalid("Folder does not exist");
  }
  const result = await requireDatabase().query(
    `INSERT INTO notes(owner_id, folder_id, title, body) VALUES($1,$2,$3,$4)
     RETURNING id, folder_id AS "folderId", title, body, template, strokes, favorite,
       (trashed_at IS NOT NULL) AS trash, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [user.id, folderId, title, cleanNoteHtml(text)]);
  return NextResponse.json({ note: result.rows[0] }, { status: 201 });
}
