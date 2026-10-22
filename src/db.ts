import pg from "pg";
import { Signer } from "@aws-sdk/rds-signer";

let pool: pg.Pool | null = null;

/** Aurora/RDS PostgreSQL with IAM auth (RDS_HOST set), or DATABASE_URL for local development. */
export function getPool(): pg.Pool {
  if (pool) return pool;

  const rdsHost = process.env.RDSHOST || process.env.RDS_HOST;

  if (rdsHost) {
    const region = process.env.AWS_REGION || process.env.RDS_REGION || "ap-south-1";
    const username = process.env.RDS_USER || process.env.DATABASE_USER || "postgres";
    const database = process.env.RDS_DBNAME || process.env.DATABASE_NAME || "postgres";
    const port = Number.parseInt(process.env.RDS_PORT || "5432", 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("Invalid RDS_PORT configuration");
    }

    const signer = new Signer({ hostname: rdsHost, port, username, region });
    console.log(`[db] RDS IAM pool for ${rdsHost}:${port} (${region}) as ${username}`);

    pool = new pg.Pool({
      host: rdsHost,
      port,
      user: username,
      database,
      // fresh IAM token for every new connection
      password: () => signer.getAuthToken(),
      ssl: { rejectUnauthorized: true },
      connectionTimeoutMillis: 15000,
      max: 10,
      idleTimeoutMillis: 30000,
    });
  } else if (process.env.DATABASE_URL) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
      max: 10,
      idleTimeoutMillis: 30000,
    });
  } else {
    throw new Error("No database configured: set RDS_HOST (IAM auth) or DATABASE_URL");
  }

  pool.on("error", (err) => console.error("[db] pool error", err));
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) await pool.end();
  pool = null;
}
