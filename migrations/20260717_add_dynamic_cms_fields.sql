-- Add dynamic CMS fields to landing_content
ALTER TABLE landing_content ADD COLUMN "parentId" UUID NULL;
ALTER TABLE landing_content ADD COLUMN "sortOrder" INT NOT NULL DEFAULT 0;
ALTER TABLE landing_content ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'published';
ALTER TABLE landing_content ADD COLUMN "template" VARCHAR(50) NULL;
ALTER TABLE landing_content ADD COLUMN "icon" VARCHAR(50) NULL;
ALTER TABLE landing_content ADD COLUMN "isNavVisible" BOOLEAN NOT NULL DEFAULT true;

-- Add foreign key for parentId
ALTER TABLE landing_content ADD CONSTRAINT "FK_landing_content_parent"
  FOREIGN KEY ("parentId") REFERENCES landing_content("id") ON DELETE SET NULL;

-- Add index for navigation queries
CREATE INDEX "IDX_landing_content_status_nav" ON landing_content ("status", "isNavVisible", "sortOrder");

-- Seed sort orders for existing pages (preserves existing data)
UPDATE landing_content SET "sortOrder" = 0 WHERE "pageSlug" = 'sobre-nosotros';
UPDATE landing_content SET "sortOrder" = 1 WHERE "pageSlug" = 'blog';
UPDATE landing_content SET "sortOrder" = 2 WHERE "pageSlug" = 'carreras';
UPDATE landing_content SET "sortOrder" = 3 WHERE "pageSlug" = 'contacto';
UPDATE landing_content SET "sortOrder" = 4 WHERE "pageSlug" = 'privacidad';
UPDATE landing_content SET "sortOrder" = 5 WHERE "pageSlug" = 'terminos';
UPDATE landing_content SET "sortOrder" = 6 WHERE "pageSlug" = 'cookies';
UPDATE landing_content SET "sortOrder" = 7 WHERE "pageSlug" = 'gdpr';

-- Set isNavVisible for legal pages (not in main nav)
UPDATE landing_content SET "isNavVisible" = false WHERE "pageSlug" IN ('privacidad', 'terminos', 'cookies', 'gdpr');

-- Set icons
UPDATE landing_content SET "icon" = 'info' WHERE "pageSlug" = 'sobre-nosotros';
UPDATE landing_content SET "icon" = 'article' WHERE "pageSlug" = 'blog';
UPDATE landing_content SET "icon" = 'work' WHERE "pageSlug" = 'carreras';
UPDATE landing_content SET "icon" = 'mail' WHERE "pageSlug" = 'contacto';
UPDATE landing_content SET "icon" = 'lock' WHERE "pageSlug" = 'privacidad';
UPDATE landing_content SET "icon" = 'description' WHERE "pageSlug" = 'terminos';
UPDATE landing_content SET "icon" = 'cookie' WHERE "pageSlug" = 'cookies';
UPDATE landing_content SET "icon" = 'shield' WHERE "pageSlug" = 'gdpr';

-- Set templates
UPDATE landing_content SET "template" = 'about' WHERE "pageSlug" = 'sobre-nosotros';
UPDATE landing_content SET "template" = 'blog' WHERE "pageSlug" = 'blog';
UPDATE landing_content SET "template" = 'careers' WHERE "pageSlug" = 'carreras';
UPDATE landing_content SET "template" = 'contact' WHERE "pageSlug" = 'contacto';
UPDATE landing_content SET "template" = 'legal' WHERE "pageSlug" IN ('privacidad', 'terminos', 'cookies', 'gdpr');
