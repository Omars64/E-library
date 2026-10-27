import { currentUser, unauthorized } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name, username: "username" in user ? user.username : null, role: "role" in user ? user.role : "user" } });
}
