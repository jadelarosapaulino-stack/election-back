import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'gdpr_audit_log';

export interface AuditLogMetadata {
  action: string;
  entityType: string;
  getMetadata?: (
    response: unknown,
    request: unknown,
  ) => Record<string, unknown>;
}

export const AuditLog = (metadata: AuditLogMetadata) =>
  SetMetadata(AUDIT_LOG_KEY, metadata);
