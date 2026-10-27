import fs from "node:fs";
import path from "node:path";
import { getPool } from "./db";

/** Runs every migrations/*.sql file in name order (all are idempotent). */
export async function runMigrations(): Promise<void> {
  const dir = path.join(__dirname, "..", "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await getPool().query(fs.readFileSync(path.join(dir, file), "utf8"));
    console.log(`[migrate] ${file} applied`);
  }
}
