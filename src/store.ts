import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getPool } from "./db";
import { config } from "./config";

export interface SubscriberRow {
  id: string;
  first_name: string;
  email: string;
  unsubscribed: boolean;
}

export type ConfirmResult = "done" | "expired" | "invalid";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function findSubscriber(id: string): Promise<SubscriberRow | null> {
  const r = await getPool().query<SubscriberRow>(
    `SELECT id, first_name, email, unsubscribed FROM subscribers WHERE id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}

/** Called when the unsubscribe link is opened: creates a short-lived one-time confirm token. */
export async function issueConfirmToken(
  subscriberId: string,
  campaignId: string | null,
): Promise<string> {
  const token = randomBytes(32).toString("base64url"); // 43 chars
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // drop this person's unused tokens and anything long expired
    await client.query(
      `DELETE FROM unsubscribe_tokens
        WHERE (subscriber_id = $1 AND used_at IS NULL)
           OR expires_at < NOW() - INTERVAL '1 day'`,
      [subscriberId],
    );
    await client.query(
      `INSERT INTO unsubscribe_tokens (token_hash, subscriber_id, campaign_id, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval)`,
      [sha256(token), subscriberId, campaignId, String(config.tokenTtlMinutes)],
    );
    await client.query("COMMIT");
    return token;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Called when the person presses Confirm: marks the subscriber as unsubscribed. */
export async function confirmUnsubscribe(token: string): Promise<ConfirmResult> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const t = await client.query<{
      subscriber_id: string;
      campaign_id: string | null;
      used_at: Date | null;
      expired: boolean;
    }>(
      `SELECT subscriber_id, campaign_id, used_at, (expires_at < NOW()) AS expired
         FROM unsubscribe_tokens WHERE token_hash = $1 FOR UPDATE`,
      [sha256(token)],
    );
    const row = t.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return "invalid";
    }
    if (row.used_at) {
      await client.query("ROLLBACK");
      return "done"; // double-submit / refresh: already unsubscribed
    }
    if (row.expired) {
      await client.query("ROLLBACK");
      return "expired";
    }

    const s = await client.query<{
      id: string;
      first_name: string;
      last_name: string | null;
      email: string;
      company: string | null;
    }>(
      `UPDATE subscribers
          SET unsubscribed = TRUE, unsubscribed_at = COALESCE(unsubscribed_at, NOW())
        WHERE id = $1 AND unsubscribed = FALSE
    RETURNING id, first_name, last_name, email, company`,
      [row.subscriber_id],
    );

    await client.query(`UPDATE unsubscribe_tokens SET used_at = NOW() WHERE token_hash = $1`, [
      sha256(token),
    ]);

    // Newly unsubscribed: record telemetry. Failures here must not undo the unsubscribe.
    if (s.rowCount === 1) {
      const sub = s.rows[0];
      await client.query("SAVEPOINT audit");
      try {
        let campaignName: string | null = null;
        if (row.campaign_id) {
          const c = await client.query<{ name: string }>(
            `UPDATE campaigns
                SET metrics = jsonb_set(
                      COALESCE(metrics, '{}'::jsonb), '{unsubscribeCount}',
                      to_jsonb(COALESCE((metrics->>'unsubscribeCount')::int, 0) + 1)),
                    updated_at = NOW()
              WHERE id = $1 RETURNING name`,
            [row.campaign_id],
          );
          campaignName = c.rows[0]?.name ?? null;
        }
        await client.query(
          `INSERT INTO tracking_events
             (id, campaign_id, campaign_name, subscriber_id, subscriber_email,
              subscriber_name, company, type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'unsubscribe')`,
          [
            randomUUID(),
            row.campaign_id,
            campaignName,
            sub.id,
            sub.email,
            `${sub.first_name} ${sub.last_name ?? ""}`.trim(),
            sub.company ?? "",
          ],
        );
        await client.query("RELEASE SAVEPOINT audit");
      } catch (err) {
        await client.query("ROLLBACK TO SAVEPOINT audit");
        console.error("[store] telemetry skipped:", (err as Error).message);
      }
    }

    await client.query("COMMIT");
    return "done";
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
