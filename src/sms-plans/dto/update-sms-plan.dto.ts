import { PartialType } from '@nestjs/mapped-types';
import { CreateSmsPlanDto } from './create-sms-plan.dto';

export class UpdateSmsPlanDto extends PartialType(CreateSmsPlanDto) {}
