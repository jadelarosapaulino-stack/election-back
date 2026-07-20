ALTER TABLE elections
  ADD COLUMN IF NOT EXISTS "deletedAt" timestamp NULL;

CREATE INDEX IF NOT EXISTS "IDX_elections_deletedAt"
  ON elections ("deletedAt");

ALTER TABLE questions ADD COLUMN IF NOT EXISTS "deletedAt" timestamp NULL;
ALTER TABLE options ADD COLUMN IF NOT EXISTS "deletedAt" timestamp NULL;
ALTER TABLE voters ADD COLUMN IF NOT EXISTS "deletedAt" timestamp NULL;
ALTER TABLE votes ADD COLUMN IF NOT EXISTS "deletedAt" timestamp NULL;
ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS "deletedAt" timestamp NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS "deletedAt" timestamp NULL;
ALTER TABLE "product-imgs" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp NULL;
ALTER TABLE "users-settings" ADD COLUMN IF NOT EXISTS "deletedAt" timestamp NULL;
