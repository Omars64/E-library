import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function currentUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}

export function unauthorized() { return NextResponse.json({ error: "Authentication required" }, { status: 401 }); }
export function forbidden() { return NextResponse.json({ error: "Not permitted" }, { status: 403 }); }
export function invalid(message: string) { return NextResponse.json({ error: message }, { status: 400 }); }
export function failed() { return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 }); }

export async function jsonBody(request: NextRequest) {
  if (Number(request.headers.get("content-length") ?? 0) > 1_000_000) throw new Error("Request too large");
  return request.json();
}
