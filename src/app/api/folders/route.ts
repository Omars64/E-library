import { currentUser, invalid, jsonBody, unauthorized } from "@/lib/api";
import { requireDatabase } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const result = await requireDatabase().query(
    `SELECT id,name,parent_id AS "parentId",color,created_at AS "createdAt"
     FROM folders WHERE owner_id=$1 ORDER BY created_at ASC LIMIT 500`, [user.id]);
  return NextResponse.json({ folders: result.rows });
}

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  let body: Record<string, unknown>;
  try { body = await jsonBody(request); } catch { return invalid("Invalid folder"); }
  const name = String(body.name ?? "").trim();
  const parentId = body.parentId ? String(body.parentId) : null;
  const color = String(body.color ?? "#b99279");
  if (!name || name.length > 80 || !/^#[0-9a-f]{6}$/i.test(color)) return invalid("Invalid folder details");
  if (parentId) {
    const parent = await requireDatabase().query("SELECT 1 FROM folders WHERE id=$1 AND owner_id=$2", [parentId,user.id]);
    if (!parent.rowCount) return invalid("Parent folder does not exist");
  }
  const result = await requireDatabase().query(
    `INSERT INTO folders(owner_id,name,parent_id,color) VALUES($1,$2,$3,$4)
     RETURNING id,name,parent_id AS "parentId",color,created_at AS "createdAt"`,
    [user.id,name,parentId,color]);
  return NextResponse.json({ folder: result.rows[0] }, { status: 201 });
}
