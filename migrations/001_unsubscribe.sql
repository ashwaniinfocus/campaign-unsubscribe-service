-- Adds unsubscribe tracking to the existing subscribers table and creates the token table.
-- Safe to run multiple times.

ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS unsubscribed    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
  token_hash    CHAR(64) PRIMARY KEY,                       -- sha256 of the token (raw token is never stored)
  subscriber_id VARCHAR NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  campaign_id   VARCHAR(64),
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unsub_tokens_subscriber ON unsubscribe_tokens(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_unsub_tokens_expires    ON unsubscribe_tokens(expires_at);
