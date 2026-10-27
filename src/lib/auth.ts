import { betterAuth } from "better-auth";
import { admin, username } from "better-auth/plugins";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { pool } from "@/lib/db";

export const auth = betterAuth({
  database: pool,
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  disabledPaths: ["/is-username-available"],
  rateLimit: { enabled: true, storage: "database", window: 60, max: 60,
    customRules: { "/sign-in/email": { window: 60, max: 5 }, "/sign-in/username": { window: 60, max: 5 } } },
  plugins: [admin(), username({ immutableUsername: true })],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (["/admin/create-user", "/admin/set-user-password", "/change-password", "/reset-password"].includes(ctx.path)) {
        const body = ctx.body as Record<string, unknown> | undefined;
        const password = body?.password ?? body?.newPassword;
        if (typeof password === "string" && !validPassword(password)) {
          throw new APIError("BAD_REQUEST", { message: "Password needs at least 8 characters and one special character." });
        }
      }
    }),
  },
});

export function validPassword(value: string) {
  return value.length >= 8 && value.length <= 128 && /[^\p{L}\p{N}\s]/u.test(value);
}
