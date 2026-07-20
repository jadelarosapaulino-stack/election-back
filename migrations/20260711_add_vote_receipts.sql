ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS "receiptCode" varchar(64),
  ADD COLUMN IF NOT EXISTS "receiptHash" text;

CREATE INDEX IF NOT EXISTS "IDX_votes_receiptCode" ON votes ("receiptCode");
