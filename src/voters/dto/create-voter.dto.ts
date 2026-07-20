import { BadRequestException } from '@nestjs/common';
import { IsEmail, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * H-04: Strict whitelist for voter metadata keys.
 * Only keys that are actively used by the system are allowed.
 */

export class VoterMagicAuthMetadata {
  @IsString()
  token!: string;

  @IsString()
  expiresAt!: string;
}

export class VoterMetadataDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => VoterMagicAuthMetadata)
  magicAuth?: VoterMagicAuthMetadata;
}

/** Allowed top-level keys in voter metadata. */
const ALLOWED_METADATA_KEYS = new Set<keyof VoterMetadataDto>(['magicAuth']);

export class CreateVoterDto {
  @IsString()
  name: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  election: string;

  @IsString()
  identifier?: string;

  @IsString()
  password?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/**
 * Validates that metadata contains only whitelisted keys.
 * Throws BadRequestException if unknown keys are present.
 */
export function validateVoterMetadata(metadata: Record<string, unknown> | null | undefined): void {
  if (!metadata || typeof metadata !== 'object') return;

  const unknownKeys = Object.keys(metadata).filter((key) => !ALLOWED_METADATA_KEYS.has(key as keyof VoterMetadataDto));
  if (unknownKeys.length > 0) {
    throw new BadRequestException(
      `Metadata contiene claves no permitidas: ${unknownKeys.join(', ')}. Claves permitidas: ${[...ALLOWED_METADATA_KEYS].join(', ')}`,
    );
  }
}
