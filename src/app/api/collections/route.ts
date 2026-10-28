import { currentUser, invalid, jsonBody, unauthorized } from "@/lib/api";
import { requireDatabase } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const result = await requireDatabase().query(
    `SELECT c.id,c.name,c.description,c.created_at AS "createdAt",
      COALESCE(json_agg(json_build_object('kind',i.item_kind,'id',i.item_id,
        'title',COALESCE(ce.title,b.title))) FILTER (WHERE i.item_id IS NOT NULL),'[]') AS items
     FROM collections c LEFT JOIN collection_items i ON i.collection_id=c.id
     LEFT JOIN catalog_entries ce ON i.item_kind<>'books' AND ce.id=i.item_id AND (ce.owner_id IS NULL OR ce.owner_id=c.owner_id)
     LEFT JOIN books b ON i.item_kind='books' AND b.id::text=i.item_id AND b.owner_id=c.owner_id
     WHERE c.owner_id=$1 GROUP BY c.id ORDER BY c.created_at DESC LIMIT 500`, [user.id]);
  return NextResponse.json({ collections: result.rows });
}

export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  let body: Record<string, unknown>;
  try { body = await jsonBody(request); } catch { return invalid("Invalid collection"); }
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  if (!name || name.length > 80) return invalid("Collection name must be 1–80 characters");
  if (description.length > 300) return invalid("Description must be at most 300 characters");
  try {
    const result = await requireDatabase().query(
      `INSERT INTO collections(owner_id,name,description) VALUES($1,$2,$3)
       RETURNING id,name,description,created_at AS "createdAt"`, [user.id,name,description || null]);
    return NextResponse.json({ collection: { ...result.rows[0], items: [] } }, { status: 201 });
  } catch { return invalid("A collection with that name may already exist"); }
}
