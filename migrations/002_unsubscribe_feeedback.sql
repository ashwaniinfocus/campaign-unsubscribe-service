ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS unsubscribe_reason  VARCHAR(64);
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS unsubscribe_remarks TEXT;