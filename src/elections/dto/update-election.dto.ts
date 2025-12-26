import { PartialType } from '@nestjs/mapped-types';
import { CreateElectionDto } from './create-election.dto';

export class UpdateElectionDto extends PartialType(CreateElectionDto) {}
