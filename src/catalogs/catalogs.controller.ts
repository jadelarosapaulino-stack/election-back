import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Auth } from 'src/auth/decorators';
import { ValidRoles } from 'src/auth/interfaces';
import { CatalogsService } from './catalogs.service';
import { CreateCatalogItemDto, UpdateCatalogItemDto } from './dto/dto';

@Controller('catalogs')
@Auth(ValidRoles.admin)
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get('groups')
  findGroups() {
    return this.catalogsService.findGroups();
  }

  @Get()
  findAll(@Query('groupKey') groupKey?: string, @Query('active') active?: string) {
    const activeFlag =
      active === undefined ? undefined : active === 'true' || active === '1';
    return this.catalogsService.findAll(groupKey, activeFlag);
  }

  @Get('paginated')
  findAllPaginated(
    @Query('groupKey') groupKey?: string,
    @Query('active') active?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const activeFlag =
      active === undefined ? undefined : active === 'true' || active === '1';
    const parsedPage = Number(page);
    const parsedPageSize = Number(pageSize);

    return this.catalogsService.findAllPaginated(
      groupKey,
      activeFlag,
      Number.isFinite(parsedPage) ? parsedPage : 1,
      Number.isFinite(parsedPageSize) ? parsedPageSize : 10
    );
  }

  @Get('tie-breakers')
  findTieBreakers(@Query('active') active?: string) {
    const activeFlag =
      active === undefined ? undefined : active === 'true' || active === '1';
    return this.catalogsService.findTieBreakers(activeFlag);
  }

  @Get('voting-modes')
  findVotingModes(@Query('active') active?: string) {
    const activeFlag =
      active === undefined ? undefined : active === 'true' || active === '1';
    return this.catalogsService.findVotingModes(activeFlag);
  }

  @Post('voting-modes/register-defaults')
  registerVotingModeDefaults() {
    return this.catalogsService.registerVotingModeDefaults();
  }

  @Post('voting-modes')
  createVotingMode(@Body() dto: Omit<CreateCatalogItemDto, 'groupKey'>) {
    return this.catalogsService.createVotingMode(dto);
  }

  @Patch('voting-modes/:id')
  updateVotingMode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Omit<UpdateCatalogItemDto, 'groupKey'>
  ) {
    return this.catalogsService.updateVotingMode(id, dto);
  }

  @Post('tie-breakers/register-defaults')
  registerTieBreakerDefaults() {
    return this.catalogsService.registerTieBreakerDefaults();
  }

  @Post('tie-breakers')
  createTieBreaker(@Body() dto: Omit<CreateCatalogItemDto, 'groupKey'>) {
    return this.catalogsService.createTieBreaker(dto);
  }

  @Patch('tie-breakers/:id')
  updateTieBreaker(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Omit<UpdateCatalogItemDto, 'groupKey'>
  ) {
    return this.catalogsService.updateTieBreaker(id, dto);
  }

  @Delete('tie-breakers/:id')
  removeTieBreaker(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogsService.remove(id);
  }

  @Post()
  create(@Body() dto: CreateCatalogItemDto) {
    return this.catalogsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCatalogItemDto) {
    return this.catalogsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalogsService.remove(id);
  }
}
