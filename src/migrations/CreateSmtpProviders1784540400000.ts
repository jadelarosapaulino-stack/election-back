import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSmtpProviders1784540400000 implements MigrationInterface {
  name = 'CreateSmtpProviders1784540400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "smtp_providers" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(100) NOT NULL,
        "providerType" VARCHAR(50) NOT NULL DEFAULT 'custom',
        "enabled" BOOLEAN NOT NULL DEFAULT true,
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        "host" VARCHAR(255) NOT NULL DEFAULT '',
        "port" INTEGER NOT NULL DEFAULT 587,
        "user" VARCHAR(255) NOT NULL DEFAULT '',
        "pass" TEXT NOT NULL DEFAULT '',
        "secure" BOOLEAN NOT NULL DEFAULT false,
        "requireTls" BOOLEAN NOT NULL DEFAULT true,
        "fromName" VARCHAR(150) NOT NULL DEFAULT 'Voting Suite',
        "fromEmail" VARCHAR(255) NOT NULL DEFAULT '',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_smtp_provider_default"
      ON "smtp_providers" ("isDefault") WHERE "isDefault" = true
    `);

    await queryRunner.query(`
      INSERT INTO "smtp_providers" (
        "name", "providerType", "enabled", "isDefault", "host", "port",
        "user", "pass", "secure", "requireTls", "fromName", "fromEmail"
      )
      SELECT
        'Proveedor principal',
        'custom',
        COALESCE((SELECT "value"::boolean FROM "system_configs" WHERE "group" = 'email_smtp' AND "key" = 'enabled' AND "active" = true), false),
        true,
        COALESCE((SELECT "value" FROM "system_configs" WHERE "group" = 'email_smtp' AND "key" = 'host' AND "active" = true), ''),
        COALESCE((SELECT "value"::integer FROM "system_configs" WHERE "group" = 'email_smtp' AND "key" = 'port' AND "active" = true), 587),
        COALESCE((SELECT "value" FROM "system_configs" WHERE "group" = 'email_smtp' AND "key" = 'user' AND "active" = true), ''),
        COALESCE((SELECT "value" FROM "system_configs" WHERE "group" = 'email_smtp' AND "key" = 'pass' AND "active" = true), ''),
        COALESCE((SELECT "value"::boolean FROM "system_configs" WHERE "group" = 'email_smtp' AND "key" = 'secure' AND "active" = true), false),
        COALESCE((SELECT "value"::boolean FROM "system_configs" WHERE "group" = 'email_smtp' AND "key" = 'requireTls' AND "active" = true), true),
        COALESCE((SELECT "value" FROM "system_configs" WHERE "group" = 'email_smtp' AND "key" = 'fromName' AND "active" = true), 'Voting Suite'),
        COALESCE((SELECT "value" FROM "system_configs" WHERE "group" = 'email_smtp' AND "key" = 'fromEmail' AND "active" = true), '')
      WHERE NOT EXISTS (SELECT 1 FROM "smtp_providers")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_smtp_provider_default"');
    await queryRunner.query('DROP TABLE IF EXISTS "smtp_providers"');
  }
}
