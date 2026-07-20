import { MigrationInterface, QueryRunner } from 'typeorm';

export class GdprInitial1721366400000 implements MigrationInterface {
  name = 'GdprInitial1721366400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // gdpr_breach_events
    await queryRunner.query(`
      CREATE TABLE "gdpr_breach_events" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "affectedUsers" INTEGER NOT NULL DEFAULT 0,
        "severity" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'detected',
        "detectedBy" TEXT,
        "dataCategories" TEXT[] NOT NULL DEFAULT '{}',
        "affectedUserEmails" TEXT[],
        "requiresAuthorityNotification" BOOLEAN NOT NULL DEFAULT false,
        "requiresSubjectNotification" BOOLEAN NOT NULL DEFAULT false,
        "authorityNotifiedAt" TIMESTAMPTZ,
        "subjectsNotifiedAt" TIMESTAMPTZ,
        "authorityReference" TEXT,
        "resolutionNotes" TEXT,
        "detectedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "resolvedAt" TIMESTAMPTZ
      )
    `);

    // gdpr_processing_records
    await queryRunner.query(`
      CREATE TABLE "gdpr_processing_records" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "controllerName" TEXT NOT NULL,
        "processingPurpose" TEXT NOT NULL,
        "dataCategories" TEXT[] NOT NULL,
        "dataSubjects" TEXT[] NOT NULL,
        "legalBasis" TEXT NOT NULL,
        "recipients" TEXT[] NOT NULL DEFAULT '{}',
        "retentionPeriod" TEXT NOT NULL,
        "transferOutsideEU" BOOLEAN NOT NULL DEFAULT false,
        "transferSafeguards" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "notes" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // gdpr_dpia_records
    await queryRunner.query(`
      CREATE TABLE "gdpr_dpia_records" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "processName" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "legalBasis" TEXT NOT NULL,
        "dataCategories" TEXT[] NOT NULL,
        "necessityAndProportionality" TEXT NOT NULL,
        "risksToDataSubjects" TEXT NOT NULL,
        "measuresToAddressRisks" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'draft',
        "reviewedBy" TEXT,
        "reviewedAt" TIMESTAMPTZ,
        "approvalNotes" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // gdpr_dpa_records
    await queryRunner.query(`
      CREATE TABLE "gdpr_dpa_records" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "subprocessorName" TEXT NOT NULL,
        "subprocessorEmail" TEXT NOT NULL,
        "servicesProvided" TEXT NOT NULL,
        "country" TEXT NOT NULL,
        "outsideEU" BOOLEAN NOT NULL DEFAULT false,
        "transferSafeguards" TEXT,
        "validFrom" TIMESTAMPTZ NOT NULL,
        "validUntil" TIMESTAMPTZ,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "dpaDocumentPath" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // user_consents (verify exists, create if not)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_consents" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        "consentType" TEXT NOT NULL,
        "policyVersion" TEXT NOT NULL,
        "acceptedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "ipAddress" TEXT,
        "revoked" BOOLEAN NOT NULL DEFAULT true,
        "revokedAt" TIMESTAMPTZ,
        CONSTRAINT "FK_user_consents_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Indexes
    await queryRunner.query(`CREATE INDEX "IDX_breach_severity" ON "gdpr_breach_events" ("severity")`);
    await queryRunner.query(`CREATE INDEX "IDX_breach_status" ON "gdpr_breach_events" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_breach_detected" ON "gdpr_breach_events" ("detectedAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_processing_active" ON "gdpr_processing_records" ("isActive")`);
    await queryRunner.query(`CREATE INDEX "IDX_dpia_status" ON "gdpr_dpia_records" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_dpa_active" ON "gdpr_dpa_records" ("isActive")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_dpa_active"`);
    await queryRunner.query(`DROP INDEX "IDX_dpia_status"`);
    await queryRunner.query(`DROP INDEX "IDX_processing_active"`);
    await queryRunner.query(`DROP INDEX "IDX_breach_detected"`);
    await queryRunner.query(`DROP INDEX "IDX_breach_status"`);
    await queryRunner.query(`DROP INDEX "IDX_breach_severity"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_consents"`);
    await queryRunner.query(`DROP TABLE "gdpr_dpa_records"`);
    await queryRunner.query(`DROP TABLE "gdpr_dpia_records"`);
    await queryRunner.query(`DROP TABLE "gdpr_processing_records"`);
    await queryRunner.query(`DROP TABLE "gdpr_breach_events"`);
  }
}
