import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const email = "omarsolanki46@gmail.com";
const username = "omar";
process.stdout.write("Enter initial admin password, then press Enter: ");
async function readPassword() {
  if (!process.stdin.isTTY) {
    let input = "";
    for await (const chunk of process.stdin) input += chunk.toString();
    return input.replace(/\r?\n$/, "");
  }
  return new Promise((resolve, reject) => {
    let input = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const finish = () => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\n"); resolve(input); };
    process.stdin.on("data", function onData(chunk) {
      for (const character of chunk.toString()) {
        if (character === "\r" || character === "\n") {
          process.stdin.off("data", onData);
          finish();
          return;
        }
        if (character === "\u0003") {
          process.stdin.off("data", onData);
          process.stdin.setRawMode(false);
          reject(new Error("Bootstrap cancelled"));
          return;
        }
        if (character === "\u007f" || character === "\b") input = input.slice(0, -1);
        else input += character;
      }
    });
  });
}
let password = await readPassword();
if (password.length < 8 || password.length > 128 || !/[^\p{L}\p{N}\s]/u.test(password)) {
  throw new Error("Password needs 8–128 characters and one special character");
}
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  const existing = await client.query('SELECT id FROM "user" WHERE email=$1 OR username=$2', [email, username]);
  if (existing.rowCount) throw new Error("Admin email or username already exists; no credentials were changed");
  const userId = randomUUID();
  await client.query(
    'INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt",role,username,"displayUsername") VALUES($1,$2,$3,false,now(),now(),$4,$5,$5)',
    [userId, "Omar", email, "admin", username],
  );
  await client.query(
    'INSERT INTO account (id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES($1,$2,$3,$4,$5,now(),now())',
    [randomUUID(), userId, "credential", userId, await hashPassword(password)],
  );
  await client.query("COMMIT");
  process.stdout.write("Initial admin created.\n");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  password = "";
  await client.end();
}
