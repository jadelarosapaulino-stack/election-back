import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { SmsPlansService } from './sms-plans.service';
import { CreateSmsPlanDto, UpdateSmsPlanDto } from './dto/dto';
import { Auth } from 'src/auth/decorators';
import { ValidRoles } from 'src/auth/interfaces';
import type { PlivoPingResult } from './plivo.service';
import { PlivoService } from './plivo.service';

@Controller('sms-plans')
@Auth(ValidRoles.admin)
export class SmsPlansController {
  constructor(
    private readonly smsPlansService: SmsPlansService,
    private readonly plivoService: PlivoService,
  ) {}

  @Get()
  findAll(@Query('active') active?: string) {
    const activeFlag =
      active === undefined ? undefined : active === 'true' || active === '1';
    return this.smsPlansService.findAll(activeFlag);
  }

  @Post()
  create(@Body() dto: CreateSmsPlanDto) {
    return this.smsPlansService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSmsPlanDto) {
    return this.smsPlansService.update(id, dto);
  }

  @Delete(':id')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.smsPlansService.deactivate(id);
  }

  @Get('plivo/status')
  status() {
    return {
      configured: this.plivoService.isConfigured(),
      authId: this.plivoService.maskedAuthId(),
    };
  }

  @Get('plivo/ping')
  ping(): Promise<PlivoPingResult> {
    return this.plivoService.ping();
  }
}
