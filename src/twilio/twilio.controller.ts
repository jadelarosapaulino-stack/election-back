import { Body, Controller, Get, Put } from '@nestjs/common';
import { TwilioService } from './twilio.service';
import { UpdateTwilioConfigDto } from './dto/update-twilio-config.dto';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';

@Controller('twilio')
@Auth(ValidRoles.admin)
export class TwilioController {
  constructor(private readonly twilioService: TwilioService) {}

  @Get('config')
  getConfig() {
    return this.twilioService.getConfig();
  }

  @Put('config')
  updateConfig(@Body() dto: UpdateTwilioConfigDto) {
    return this.twilioService.updateConfig(dto);
  }

  @Get('test')
  testConnection() {
    return this.twilioService.testConnection();
  }
}
