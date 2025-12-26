import { IsString } from 'class-validator';

// vote.dto.ts
export class CastVoteDto {
  @IsString()
  voterId: string; // ID del votante
  @IsString()
  optionId: string; // ID de la opción elegida
}
