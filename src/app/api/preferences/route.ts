import { NextRequest, NextResponse } from "next/server";
import { currentUser, unauthorized } from "@/lib/api";
import { requireDatabase } from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const result = await requireDatabase().query("SELECT sections FROM user_preferences WHERE owner_id=$1", [user.id]);
  return NextResponse.json({ sections: result.rows[0]?.sections ?? [] });
}
export async function PUT(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.sections) || body.sections.length > 20 || body.sections.some((s: unknown) => typeof s !== "string" || !s.trim() || s.length > 40) || new Set(body.sections.map((s: string) => s.trim().toLowerCase())).size !== body.sections.length) return NextResponse.json({ error: "Use up to 20 unique section names, each under 40 characters." }, { status: 400 });
  const sections = body.sections.map((s: string) => s.trim());
  await requireDatabase().query("INSERT INTO user_preferences(owner_id,sections) VALUES($1,$2) ON CONFLICT(owner_id) DO UPDATE SET sections=$2", [user.id, JSON.stringify(sections)]);
  return NextResponse.json({ sections });
}
