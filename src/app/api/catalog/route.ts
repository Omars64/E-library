import { currentUser, unauthorized } from "@/lib/api";
import { requireDatabase } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const kinds = new Set(["duas", "hadiths", "quotes"]);

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const kind = request.nextUrl.searchParams.get("kind");
  if (kind && !kinds.has(kind)) return NextResponse.json({ error: "Unknown catalog kind" }, { status: 400 });
  const result = await requireDatabase().query(
    `SELECT c.id,c.kind,c.title,c.text,c.arabic,c.source,c.author,c.category,
       (f.item_id IS NOT NULL) AS "isFavorite"
     FROM catalog_entries c LEFT JOIN favorites f ON f.owner_id=$2 AND f.item_kind=c.kind AND f.item_id=c.id
     WHERE ($1::text IS NULL OR c.kind = $1) ORDER BY c.kind,c.title LIMIT 500`, [kind,user.id]);
  return NextResponse.json({ items: result.rows });
}
