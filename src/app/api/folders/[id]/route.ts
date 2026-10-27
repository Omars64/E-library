import { currentUser, invalid, jsonBody, unauthorized } from "@/lib/api";
import { requireDatabase } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try { body = await jsonBody(request); } catch { return invalid("Invalid folder"); }
  if (Object.keys(body).some(k => !["name","parentId","color"].includes(k))) return invalid("Unsupported folder field");
  const name = body.name === undefined ? null : String(body.name).trim();
  const color = body.color === undefined ? null : String(body.color);
  const parentId = body.parentId === undefined ? undefined : body.parentId ? String(body.parentId) : null;
  if ((name !== null && (!name || name.length > 80)) || (color !== null && !/^#[0-9a-f]{6}$/i.test(color))) return invalid("Invalid folder details");
  if (parentId) {
    if (parentId === id) return invalid("A folder cannot contain itself");
    const chain = await requireDatabase().query(
      `WITH RECURSIVE descendants AS (SELECT id FROM folders WHERE parent_id=$1 AND owner_id=$2
        UNION ALL SELECT f.id FROM folders f JOIN descendants d ON f.parent_id=d.id WHERE f.owner_id=$2)
       SELECT id FROM descendants WHERE id=$3`, [id,user.id,parentId]);
    if (chain.rowCount) return invalid("A folder cannot move into its subfolder");
    const parent = await requireDatabase().query("SELECT 1 FROM folders WHERE id=$1 AND owner_id=$2", [parentId,user.id]);
    if (!parent.rowCount) return invalid("Parent folder does not exist");
  }
  const result = await requireDatabase().query(
    `UPDATE folders SET name=COALESCE($3,name),color=COALESCE($4,color),parent_id=CASE WHEN $5 THEN $6 ELSE parent_id END
     WHERE id=$1 AND owner_id=$2 RETURNING id,name,parent_id AS "parentId",color,created_at AS "createdAt"`,
    [id,user.id,name,color,parentId !== undefined,parentId ?? null]);
  if (!result.rowCount) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  return NextResponse.json({ folder: result.rows[0] });
}

export async function DELETE(request: NextRequest, context: Context) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  const result = await requireDatabase().query("DELETE FROM folders WHERE id=$1 AND owner_id=$2 RETURNING id", [id,user.id]);
  if (!result.rowCount) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
