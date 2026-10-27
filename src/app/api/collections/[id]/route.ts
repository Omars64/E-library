import { currentUser, invalid, jsonBody, unauthorized } from "@/lib/api";
import { requireDatabase } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try { body = await jsonBody(request); } catch { return invalid("Invalid collection"); }
  if (Object.keys(body).some((key) => !["name", "description"].includes(key))) return invalid("Unsupported collection field");
  const name = body.name === undefined ? null : String(body.name).trim();
  const description = body.description === undefined ? null : String(body.description).trim();
  if ((name !== null && (!name || name.length > 80)) || (description !== null && description.length > 300))
    return invalid("Check the collection name and description lengths");
  try {
    const result = await requireDatabase().query(
      `UPDATE collections SET name=COALESCE($3,name),description=CASE WHEN $4::boolean THEN $5 ELSE description END
       WHERE id=$1 AND owner_id=$2 RETURNING id,name,description`,
      [id,user.id,name,description !== null,description]);
    if (!result.rowCount) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    return NextResponse.json({ collection: result.rows[0] });
  } catch { return invalid("A collection with that name may already exist"); }
}

export async function DELETE(request: NextRequest, context: Context) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  const result = await requireDatabase().query("DELETE FROM collections WHERE id=$1 AND owner_id=$2 RETURNING id", [id,user.id]);
  if (!result.rowCount) return NextResponse.json({ error: "Collection not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
