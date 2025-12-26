import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { UserSettings } from './entities/user-settings.entity';
import { TenantsService } from './users-settings.service';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  create(@Body() body: Partial<UserSettings>) {
    return this.tenantsService.create(body);
  }

  @Get()
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<UserSettings>) {
    return this.tenantsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tenantsService.remove(id);
  }
}