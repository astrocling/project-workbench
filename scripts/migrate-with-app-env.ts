/**
 * Run `prisma migrate deploy` using the same env layering as Next.js:
 * `.env` then `.env.local` (override). Fixes "column does not exist" when migrations
 * were applied only to the DB in `.env` while `next dev` uses `DATABASE_URL` from `.env.local`.
 */
import { config } from "dotenv";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
config({ path: resolve(root, ".env") });
if (existsSync(resolve(root, ".env.local"))) {
  config({ path: resolve(root, ".env.local"), override: true });
}

execSync("npx prisma migrate deploy", {
  stdio: "inherit",
  env: process.env,
  cwd: root,
});
