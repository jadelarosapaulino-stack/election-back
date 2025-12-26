import { PartialType } from '@nestjs/mapped-types';
import { CreateElectionConfigDto } from './create-election-config.dto';

export class UpdateElectionConfigDto extends PartialType(CreateElectionConfigDto) {}
