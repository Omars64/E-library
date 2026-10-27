import { Pool } from "pg";

const globalForDb = globalThis as unknown as { libraryPool?: Pool };

export const pool = globalForDb.libraryPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
});

if (process.env.NODE_ENV !== "production") globalForDb.libraryPool = pool;

export function requireDatabase() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return pool;
}
