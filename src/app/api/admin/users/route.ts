import { auth, validPassword } from "@/lib/auth";
import { currentUser, forbidden, invalid, jsonBody, unauthorized } from "@/lib/api";
import { requireDatabase } from "@/lib/db";
import { isAPIError } from "better-auth/api";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(user: unknown): user is { id: string; role: string } {
  return Boolean(user && typeof user === "object" && "role" in user && String(user.role).split(",").includes("admin"));
}

export async function GET(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return unauthorized();
  if (!isAdmin(user)) return forbidden();
  const result = await requireDatabase().query(
    `SELECT id, email, username, name, role, "createdAt" FROM "user" ORDER BY "createdAt" DESC LIMIT 500`);
  return NextResponse.json({ users: result.rows });
}

export async function POST(request: NextRequest) {
  const actor = await currentUser(request);
  if (!actor) return unauthorized();
  if (!isAdmin(actor)) return forbidden();
  let body: Record<string, unknown>;
  try { body = await jsonBody(request); } catch { return invalid("Invalid user details"); }
  const email = String(body.email ?? "").trim().toLowerCase();
  const username = String(body.username ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return invalid("Enter a valid email");
  if (!/^[a-z0-9_.-]{3,30}$/.test(username)) return invalid("Username must be 3–30 letters, numbers, dots, underscores or hyphens");
  if (!name || name.length > 100) return invalid("Enter a name of up to 100 characters");
  if (!validPassword(password)) return invalid("Password needs at least 8 characters and one special character");
  try {
    const created = await auth.api.createUser({
      body: { email, password, name, role: "user", data: { username, displayUsername: username } },
      headers: request.headers,
    });
    return NextResponse.json({ user: created.user }, { status: 201 });
  } catch (error) {
    if (isAPIError(error)) return NextResponse.json({ error: error.message }, { status: error.statusCode ?? 400 });
    return NextResponse.json({ error: "Could not create user" }, { status: 500 });
  }
}
