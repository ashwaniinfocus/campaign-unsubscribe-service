import { Router, urlencoded } from "express";
import rateLimit from "express-rate-limit";
import {
  confirmUnsubscribe,
  findSubscriber,
  issueConfirmToken,
  peekConfirmToken,
} from "./store";
import {
  confirmPage,
  donePage,
  errorPage,
  expiredPage,
  invalidPage,
} from "./views";
import { getPool } from "./db";
import { MAX_REMARKS, REASON_IDS } from "./reasons";

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
  urlencoded({ extended: false, limit: "15kb" }),
  async (req, res) => {
    try {
      const token = typeof req.body?.token === "string" ? req.body.token : "";
      if (!TOKEN_RE.test(token))
        return void res.status(400).type("html").send(invalidPage());

      const rawReason =
        typeof req.body?.reason === "string" ? req.body.reason : "";
      const reason = REASON_IDS.has(rawReason) ? rawReason : null; // only known ids are stored
      const rawRemarks =
        typeof req.body?.remarks === "string" ? req.body.remarks : "";
      const remarks =
        rawRemarks
          .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "") // Postgres rejects NUL
          .trim()
          .slice(0, MAX_REMARKS) || null;

      // Reason is mandatory: show the form again (keeping what they typed) instead of unsubscribing.
      if (!reason) {
        const pending = await peekConfirmToken(token);
        if (pending) {
          return void res
            .status(400)
            .type("html")
            .send(
              confirmPage(pending.email, token, {
                error: "Please choose a reason to continue.",
                remarks: remarks ?? "",
              }),
            );
        }
      }

      const result = await confirmUnsubscribe(token, { reason, remarks });
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
