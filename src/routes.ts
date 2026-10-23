import { Router, urlencoded } from "express";
import rateLimit from "express-rate-limit";
import { confirmUnsubscribe, findSubscriber, issueConfirmToken } from "./store";
import {
  confirmPage,
  donePage,
  errorPage,
  expiredPage,
  invalidPage,
} from "./views";
import { getPool } from "./db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CAMPAIGN_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

const limiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).type("html").send(errorPage()),
});

export const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.get("/ready", async (_req, res) => {
  try {
    await getPool().query("SELECT 1");
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "db-unavailable" });
  }
});

// Link in the email: /unsubscribe?r=<subscribers.id>&c=<campaign id (optional)>
router.get("/unsubscribe", limiter, async (req, res) => {
  try {
    const r = typeof req.query.r === "string" ? req.query.r : "";
    const c =
      typeof req.query.c === "string" && CAMPAIGN_RE.test(req.query.c)
        ? req.query.c
        : null;

    if (!UUID_RE.test(r))
      return void res.status(400).type("html").send(invalidPage());

    const sub = await findSubscriber(r);
    console.log(sub);
    if (!sub) return void res.status(404).type("html").send(invalidPage());
    if (sub.unsubscribed) return void res.type("html").send(donePage(true));

    const token = await issueConfirmToken(sub.id, c);
    res.type("html").send(confirmPage(sub.email, token));
  } catch (err) {
    console.error("[GET /unsubscribe]", err);
    res.status(500).type("html").send(errorPage());
  }
});

router.post(
  "/unsubscribe",
  limiter,
  urlencoded({ extended: false, limit: "2kb" }),
  async (req, res) => {
    try {
      const token = typeof req.body?.token === "string" ? req.body.token : "";
      if (!TOKEN_RE.test(token))
        return void res.status(400).type("html").send(invalidPage());

      const result = await confirmUnsubscribe(token);
      if (result === "done") return void res.type("html").send(donePage());
      if (result === "expired")
        return void res.status(410).type("html").send(expiredPage());
      res.status(400).type("html").send(invalidPage());
    } catch (err) {
      console.error("[POST /unsubscribe]", err);
      res.status(500).type("html").send(errorPage());
    }
  },
);
