import { PartialType } from '@nestjs/mapped-types';
import { CastVoteDto } from './create-vote.dto';

export class UpdateVoteDto extends PartialType(CastVoteDto) {}
