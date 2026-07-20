import { IsBoolean, IsOptional, IsString } from 'class-validator';

// vote.dto.ts
export class CastVoteDto {
  @IsString()
  voterId: string; // ID del votante
  @IsString()
  optionId: string; // ID de la opciA3n elegida

  @IsOptional()
  metadata?: Record<string, any>;

  /** When false (default), geolocation is stripped from metadata before logging. */
  @IsOptional()
  @IsBoolean()
  collectLocation?: boolean;
}
