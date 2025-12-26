// src/elections/dto/create-election-config.dto.ts
import { IsOptional, IsString, IsEnum, IsBoolean, IsInt, IsISO8601 } from 'class-validator';
import { VotingMode, ResultVisibility, TieBreaker } from '../entities/election-config.entity';

export class CreateElectionConfigDto {
  @IsString()
  electionId?: string;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEnum(VotingMode)
  votingMode?: VotingMode;

  @IsOptional()
  @IsInt()
  maxVotesPerVoter?: number;

  @IsOptional()
  @IsBoolean()
  allowMultipleSelections?: boolean;

  @IsOptional()
  @IsBoolean()
  requireAuthentication?: boolean;

  @IsOptional()
  @IsBoolean()
  anonymousVoting?: boolean;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsEnum(ResultVisibility)
  resultVisibility?: ResultVisibility;

  @IsOptional()
  @IsEnum(TieBreaker)
  tieBreaker?: TieBreaker;

  @IsOptional()
  extra?: Record<string, any>;
}
