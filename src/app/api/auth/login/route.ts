import { auth } from "@/lib/auth";
import { invalid, jsonBody } from "@/lib/api";
import { isAPIError } from "better-auth/api";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  let identifier: string, password: string;
  try {
    const body = await jsonBody(request);
    identifier = String(body.identifier ?? "").trim();
    password = String(body.password ?? "");
  } catch { return invalid("Invalid login request"); }
  if (!identifier || !password) return invalid("Enter your email or username and password");
  try {
    const response = identifier.includes("@")
      ? await auth.api.signInEmail({ body: { email: identifier, password }, headers: request.headers, asResponse: true })
      : await auth.api.signInUsername({ body: { username: identifier, password }, headers: request.headers, asResponse: true });
    if (!response.ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    const data = await response.json();
    const result = NextResponse.json({ user: data.user });
    for (const cookie of response.headers.getSetCookie()) result.headers.append("set-cookie", cookie);
    return result;
  } catch (error) {
    if (isAPIError(error)) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    return NextResponse.json({ error: "Login is temporarily unavailable" }, { status: 503 });
  }
}
