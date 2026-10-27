import { currentUser, invalid, jsonBody, unauthorized } from "@/lib/api";
import { requireDatabase } from "@/lib/db";
import { cleanNoteHtml } from "@/lib/note-html";
import { NextRequest, NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try { body = await jsonBody(request); } catch { return invalid("Invalid note"); }
  const allowed = new Set(["title","body","folderId","template","strokes","favorite","trash"]);
  if (Object.keys(body).some(k => !allowed.has(k))) return invalid("Unsupported note field");
  if (body.title != null && (typeof body.title !== "string" || body.title.length > 200)) return invalid("Invalid title");
  if (body.body != null && (typeof body.body !== "string" || body.body.length > 100_000)) return invalid("Invalid note body");
  if (body.template != null && !["plain","lined","dotted"].includes(String(body.template))) return invalid("Invalid template");
  if (body.favorite != null && typeof body.favorite !== "boolean") return invalid("Invalid favourite setting");
  if (body.trash != null && typeof body.trash !== "boolean") return invalid("Invalid trash setting");
  if (body.strokes != null && (!Array.isArray(body.strokes) || JSON.stringify(body.strokes).length > 200_000)) return invalid("Invalid drawing");
  if (body.folderId) {
    const folder = await requireDatabase().query("SELECT 1 FROM folders WHERE id=$1 AND owner_id=$2", [body.folderId, user.id]);
    if (!folder.rowCount) return invalid("Folder does not exist");
  }
  const result = await requireDatabase().query(
    `UPDATE notes SET title=COALESCE($3,title), body=COALESCE($4,body), folder_id=CASE WHEN $5 THEN $6 ELSE folder_id END,
       template=COALESCE($7,template), strokes=COALESCE($8::jsonb,strokes), favorite=COALESCE($9,favorite),
       trashed_at=CASE WHEN $10::boolean IS NULL THEN trashed_at WHEN $10 THEN now() ELSE NULL END, updated_at=now()
     WHERE id=$1 AND owner_id=$2 RETURNING id, folder_id AS "folderId", title, body, template, strokes, favorite,
       (trashed_at IS NOT NULL) AS trash, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [id,user.id,body.title ?? null,typeof body.body === "string" ? cleanNoteHtml(body.body) : null,Object.hasOwn(body,"folderId"),body.folderId ?? null,body.template ?? null,
      body.strokes ? JSON.stringify(body.strokes) : null,body.favorite ?? null,body.trash ?? null]);
  if (!result.rowCount) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  return NextResponse.json({ note: result.rows[0] });
}

export async function DELETE(request: NextRequest, context: Context) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  const result = await requireDatabase().query("DELETE FROM notes WHERE id=$1 AND owner_id=$2 RETURNING id", [id,user.id]);
  if (!result.rowCount) return NextResponse.json({ error: "Note not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
