import fs from "node:fs";
import path from "node:path";
import { getPool } from "./db";

export async function runMigrations(): Promise<void> {
  const file = path.join(__dirname, "..", "migrations", "001_unsubscribe.sql");
  const sql = fs.readFileSync(file, "utf8");
  await getPool().query(sql);
  console.log("[migrate] unsubscribe schema verified");
}
