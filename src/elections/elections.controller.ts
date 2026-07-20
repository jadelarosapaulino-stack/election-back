import { Auth, GetUser } from 'src/auth/decorators';
import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query, Header, UseGuards } from '@nestjs/common';
import { ElectionsService } from './elections.service';
import { CreateElectionDto } from './dto/create-election.dto';
import { UpdateElectionDto } from './dto/update-election.dto';
import { User } from 'src/auth/entities/user.entity';
import { ValidRoles } from 'src/auth/interfaces';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { ElectionConfigLockGuard } from './guards/election-config-lock.guard';

@Controller('elections')
@Auth(ValidRoles.admin)
export class ElectionsController {
  constructor(private readonly electionsService: ElectionsService) {}

  @Post()  
  create(@Body() createElectionDto: CreateElectionDto,
  @GetUser() user: User) {    
    return this.electionsService.create(createElectionDto, user);
  }

  @Get()
  @Auth()
  findAll(@Query() paginationDto: PaginationDto, @GetUser() user: User) {
    return this.electionsService.findAll(paginationDto, user);
  }

  @Get('memberships/invitations')
  @Auth()
  getMyMembershipInvitations(@GetUser() user: User) {
    return this.electionsService.getMyMembershipInvitations(user);
  }

  @Post('memberships/invitations/:membershipId/respond')
  @Auth()
  respondToMembershipInvitation(
    @Param('membershipId', ParseUUIDPipe) membershipId: string,
    @Body() body: { accept?: boolean },
    @GetUser() user: User,
  ) {
    return this.electionsService.respondToMembershipInvitation(membershipId, user, body?.accept === true);
  }

  @Get(':id/results')
  @Auth()
  getResults(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('scope') scope: string,
    @GetUser() user: User,
  ) {
    return this.electionsService.getResults(id, user, scope);
  }

  @Get(':id/fraud-signals')
  @Auth()
  getFraudSignals(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @Query('filter') filter: string,
    @GetUser() user: User,
  ) {
    return this.electionsService.getFraudSignals(id, user, {
      page: Number(page),
      pageSize: Number(pageSize),
      filter: filter === 'suspicious' ? 'suspicious' : 'all',
    });
  }

  @Get(':id/context')
  @Auth()
  getElectionContext(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: User,
  ) {
    return this.electionsService.getElectionContext(id, user);
  }

  @Post(':id/start-demo')
  @Auth()
  startDemo(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.electionsService.startDemo(id, user);
  }

  @Post(':id/duplicate')
  @Auth()
  duplicate(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.electionsService.duplicate(id, user);
  }

  @Post(':id/clear-demo')
  @Auth()
  clearDemo(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.electionsService.clearDemo(id, user);
  }

  @Post(':id/complete-demo')
  @Auth()
  completeDemo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { notes?: string },
    @GetUser() user: User,
  ) {
    return this.electionsService.completeDemo(id, user, body?.notes);
  }

  @Post(':id/demo-link')
  @Auth()
  generateDemoLink(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { ttlMinutes?: number },
    @GetUser() user: User,
  ) {
    return this.electionsService.generateDemoLink(id, user, body?.ttlMinutes);
  }

  @Post(':id/start-production')
  @Auth()
  startProduction(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.electionsService.startProduction(id, user);
  }

  @Post(':id/close')
  @Auth()
  closeElection(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.electionsService.closeElection(id, user);
  }

  @Get(':id/scrutiny')
  @Auth()
  getScrutiny(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.electionsService.getScrutiny(id, user);
  }

  @Post(':id/scrutiny/publish')
  @Auth()
  publishScrutiny(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { notes?: string },
    @GetUser() user: User,
  ) {
    return this.electionsService.publishScrutiny(id, user, body?.notes);
  }

  @Get(':id/communication-templates')
  @Auth()
  getCommunicationTemplates(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.electionsService.getCommunicationTemplates(id, user);
  }

  @Patch(':id/communication-templates')
  @Auth()
  @UseGuards(ElectionConfigLockGuard)
  updateCommunicationTemplates(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
    @GetUser() user: User,
  ) {
    return this.electionsService.updateCommunicationTemplates(id, user, body);
  }

  @Get(':id/readiness')
  @Auth()
  getReadiness(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.electionsService.getReadiness(id, user);
  }

  @Get(':id/wizard')
  @Auth()
  getWizard(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.electionsService.getWizard(id, user);
  }

  @Patch(':id/wizard')
  @Auth()
  updateWizard(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { currentStep?: string; completedSteps?: string[] },
    @GetUser() user: User,
  ) {
    return this.electionsService.updateWizard(id, user, body);
  }

  @Get(':id/supervision-members')
  @Auth()
  getSupervisionMembers(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.electionsService.getSupervisionMembers(id, user);
  }

  @Patch(':id/supervision-members')
  @Auth()
  updateSupervisionMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { members?: unknown[] },
    @GetUser() user: User,
  ) {
    return this.electionsService.updateSupervisionMembers(id, user, body);
  }

  @Post(':id/approvals/:section')
  @Auth()
  setApproval(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('section') section: string,
    @Body() body: { status: 'approved' | 'rejected'; comment?: string },
    @GetUser() user: User,
  ) {
    return this.electionsService.setSectionApproval(id, user, section, body?.status, body?.comment);
  }

  @Get(':id/audit-package')
  @Auth()
  getAuditPackage(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.electionsService.getAuditPackage(id, user);
  }

  @Get(':id/audit-package.csv')
  @Auth()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  getAuditPackageCsv(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.electionsService.getAuditPackageCsv(id, user);
  }

  @Get(':id/audit-package.pdf')
  @Auth()
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'attachment; filename="audit-package.pdf"')
  getAuditPackagePdf(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.electionsService.getAuditPackagePdf(id, user);
  }

  @Get('metrics')
  @Auth()
  getMetrics(@Query('scope') scope: string, @GetUser() user: User) {
    const resolvedScope = scope === 'all' ? 'all' : 'mine';
    return this.electionsService.getDashboardMetrics(user, resolvedScope);
  }

  @Get(':term')
  @Auth()
  findOne(@Param('term') term: string, @GetUser() user: User) {
    return this.electionsService.findOne(term, user);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateElectionDto: UpdateElectionDto, @GetUser() user: User) {
    return this.electionsService.update(id, updateElectionDto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.electionsService.remove(id, user);
  }

  @Delete(':id/permanent')
  permanentlyRemove(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: User) {
    return this.electionsService.permanentlyRemove(id, user);
  }
}
