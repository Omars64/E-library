import { currentUser, invalid, jsonBody, unauthorized } from "@/lib/api";
import { requireDatabase } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Context) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  const result = await requireDatabase().query(
    `SELECT COALESCE(p.location,'') AS location,COALESCE(p.reflection,'') AS reflection,p.updated_at AS "updatedAt"
     FROM books b LEFT JOIN reading_progress p ON p.book_id=b.id AND p.owner_id=b.owner_id
     WHERE b.id=$1 AND b.owner_id=$2 AND b.status='ready'`, [id,user.id]);
  if (!result.rowCount) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  return NextResponse.json({ progress: result.rows[0] });
}

export async function PUT(request: NextRequest, context: Context) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const { id } = await context.params;
  let body: Record<string, unknown>;
  try { body = await jsonBody(request); } catch { return invalid("Invalid reading progress"); }
  if (Object.keys(body).some((key) => !["location", "reflection"].includes(key))) return invalid("Unsupported progress field");
  if (body.location !== undefined && (typeof body.location !== "string" || body.location.length > 500)) return invalid("Invalid reading location");
  if (body.reflection !== undefined && (typeof body.reflection !== "string" || body.reflection.length > 20_000)) return invalid("Reflection is too long");
  const location = body.location ?? "";
  const reflection = body.reflection ?? "";
  const result = await requireDatabase().query(
    `INSERT INTO reading_progress(owner_id,book_id,location,reflection)
     SELECT $2,b.id,$3,$4 FROM books b WHERE b.id=$1 AND b.owner_id=$2 AND b.status='ready'
     ON CONFLICT(owner_id,book_id) DO UPDATE SET
       location=CASE WHEN $5 THEN EXCLUDED.location ELSE reading_progress.location END,
       reflection=CASE WHEN $6 THEN EXCLUDED.reflection ELSE reading_progress.reflection END,
       updated_at=now()
     RETURNING location,reflection,updated_at AS "updatedAt"`,
    [id,user.id,location,reflection,Object.hasOwn(body,"location"),Object.hasOwn(body,"reflection")]);
  if (!result.rowCount) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  return NextResponse.json({ progress: result.rows[0] });
}
