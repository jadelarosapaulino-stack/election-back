import { PartialType } from '@nestjs/mapped-types';
import { CreateSmtpProviderDto } from './create-smtp-provider.dto';

export class UpdateSmtpProviderDto extends PartialType(CreateSmtpProviderDto) {}
