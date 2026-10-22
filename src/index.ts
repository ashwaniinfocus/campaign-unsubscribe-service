import path from "node:path";
import express from "express";
import helmet from "helmet";
import { config } from "./config";
import { closePool, getPool } from "./db";
import { runMigrations } from "./migrate";
import { router } from "./routes";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", config.trustProxyHops);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        upgradeInsecureRequests: null, // TLS is terminated at the ALB; keeps plain-http local runs working
      },
    },
    referrerPolicy: { policy: "no-referrer" },
  }),
);

// Tokens are one-time and per-person: never cache these pages.
app.use((req, res, next) => {
  if (!req.path.startsWith("/static")) res.set("Cache-Control", "no-store");
  next();
});

app.use(
  "/static",
  express.static(path.join(__dirname, "..", "public"), { maxAge: "1h" }),
);
app.use(router);
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to the Unsubscribe Service!",
  });
});

async function main() {
  getPool(); // fail fast if DB config is missing
  if (config.autoMigrate) await runMigrations();

  const server = app.listen(config.port, () => {
    console.log(`[unsubscribe-service] listening on :${config.port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`[unsubscribe-service] ${signal} received, shutting down`);
    server.close(async () => {
      await closePool().catch(() => undefined);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("[unsubscribe-service] failed to start", err);
  process.exit(1);
});
