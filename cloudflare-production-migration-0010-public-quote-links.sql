CREATE TABLE quote_share_tokens (
  token text PRIMARY KEY NOT NULL,
  quote_id text NOT NULL,
  active integer DEFAULT 1 NOT NULL,
  created text NOT NULL,
  created_by text NOT NULL,
  revoked_at text
);
CREATE UNIQUE INDEX quote_share_tokens_quote_unique ON quote_share_tokens (quote_id);
CREATE INDEX idx_quote_share_tokens_active ON quote_share_tokens (active);
