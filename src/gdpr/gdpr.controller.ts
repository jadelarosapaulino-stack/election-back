import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BreachNotificationService } from './breach-notification.service';
import { ProcessingRecordService } from './processing-record.service';
import { DpiaService } from './dpia.service';
import { DpaService } from './dpa.service';
import { CreateBreachEventDto } from './dto/create-breach-event.dto';
import { SetAffectedEmailsDto } from './dto/set-affected-emails.dto';
import { QueryBreachEventsDto } from './dto/query-breach-events.dto';
import { CreateProcessingRecordDto } from './dto/create-processing-record.dto';
import { CreateDpiaRecordDto } from './dto/create-dpia-record.dto';
import { UpdateDpiaRecordDto } from './dto/update-dpia-record.dto';
import { CreateDpaRecordDto } from './dto/create-dpa-record.dto';
import { UpdateDpaRecordDto } from './dto/update-dpa-record.dto';
import { AuditLog } from './decorators/audit-log.decorator';
import { DpoGuard } from './guards/dpo.guard';
import { TimelineAction } from '../timeline/timeline.enum';

@Controller('gdpr')
@UseGuards(DpoGuard)
export class GdprController {
  constructor(
    private readonly breachService: BreachNotificationService,
    private readonly processingRecordService: ProcessingRecordService,
    private readonly dpiaService: DpiaService,
    private readonly dpaService: DpaService,
  ) {}

  // --- Breach Events ---

  @Post('breaches')
  async createBreachEvent(@Body() dto: CreateBreachEventDto) {
    return this.breachService.create(dto);
  }

  @Get('breaches')
  async queryBreachEvents(@Query() query: QueryBreachEventsDto) {
    return this.breachService.findAll(query);
  }

  // IMPORTANT: This static route must be declared BEFORE the :id param route
  // to prevent "pending-notifications" from being matched as a UUID.
  @Get('breaches/pending-notifications')
  async getPendingNotifications() {
    return this.breachService.checkPendingAuthorityNotifications();
  }

  @Get('breaches/:id')
  async findOneBreachEvent(@Param('id', ParseUUIDPipe) id: string) {
    return this.breachService.findOne(id);
  }

  @Post('breaches/:id/notify-authority')
  async notifyAuthority(@Param('id', ParseUUIDPipe) id: string) {
    return this.breachService.notifyAuthority(id);
  }

  @Post('breaches/:id/notify-subjects')
  async notifySubjects(@Param('id', ParseUUIDPipe) id: string) {
    return this.breachService.notifySubjects(id);
  }

  @Post('breaches/:id/set-affected-emails')
  async setAffectedEmails(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAffectedEmailsDto,
  ) {
    return this.breachService.setAffectedEmails(id, dto.emails);
  }

  @Post('breaches/:id/resolve')
  async resolveBreach(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('notes') notes: string,
  ) {
    return this.breachService.resolve(id, notes);
  }

  // --- Processing Records (ROPA) ---

  @Get('processing-records')
  async findAllProcessingRecords() {
    return this.processingRecordService.findAll();
  }

  @Get('processing-records/:id')
  async findOneProcessingRecord(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.processingRecordService.findOne(id);
  }

  @Post('processing-records')
  @AuditLog({
    action: TimelineAction.PROCESSING_RECORD_CREATED,
    entityType: 'ProcessingRecord',
    getMetadata: (response: unknown) => ({
      recordId: (response as { id?: string })?.id,
    }),
  })
  async createProcessingRecord(
    @Body() dto: CreateProcessingRecordDto,
  ) {
    return this.processingRecordService.create(dto);
  }

  @Put('processing-records/:id')
  @AuditLog({
    action: TimelineAction.PROCESSING_RECORD_UPDATED,
    entityType: 'ProcessingRecord',
    getMetadata: (response: unknown) => ({
      recordId: (response as { id?: string })?.id,
    }),
  })
  async updateProcessingRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateProcessingRecordDto,
  ) {
    return this.processingRecordService.update(id, dto);
  }

  // --- DPIA Records ---

  @Get('dpia')
  async findAllDpia() {
    return this.dpiaService.findAll();
  }

  @Get('dpia/:id')
  async findOneDpia(@Param('id', ParseUUIDPipe) id: string) {
    return this.dpiaService.findOne(id);
  }

  @Post('dpia')
  @AuditLog({
    action: TimelineAction.DPIA_CREATED,
    entityType: 'DpiaRecord',
    getMetadata: (response: unknown) => ({
      dpiaId: (response as { id?: string })?.id,
      processName: (response as { processName?: string })?.processName,
    }),
  })
  async createDpia(@Body() dto: CreateDpiaRecordDto) {
    return this.dpiaService.create(dto);
  }

  @Put('dpia/:id')
  @AuditLog({
    action: TimelineAction.DPIA_APPROVED,
    entityType: 'DpiaRecord',
    getMetadata: (response: unknown) => ({
      dpiaId: (response as { id?: string })?.id,
      status: (response as { status?: string })?.status,
    }),
  })
  async updateDpia(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDpiaRecordDto,
  ) {
    return this.dpiaService.update(id, dto);
  }

  // --- DPA Records ---

  @Get('dpa')
  async findAllDpa() {
    return this.dpaService.findAll();
  }

  @Get('dpa/:id')
  async findOneDpa(@Param('id', ParseUUIDPipe) id: string) {
    return this.dpaService.findOne(id);
  }

  @Post('dpa')
  @AuditLog({
    action: TimelineAction.DPA_REGISTERED,
    entityType: 'DpaRecord',
    getMetadata: (response: unknown) => ({
      dpaId: (response as { id?: string })?.id,
      subprocessor: (response as { subprocessorName?: string })
        ?.subprocessorName,
    }),
  })
  async createDpa(@Body() dto: CreateDpaRecordDto) {
    return this.dpaService.create(dto);
  }

  @Put('dpa/:id')
  async updateDpa(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDpaRecordDto,
  ) {
    return this.dpaService.update(id, dto);
  }
}
