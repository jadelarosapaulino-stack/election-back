import { Body, Controller, Delete, Get, Param, Post, Put, ParseUUIDPipe } from '@nestjs/common';
import { LandingContentService } from './landing-content.service';
import { CreateLandingContentDto } from './dto/create-landing-content.dto';
import { UpdateLandingContentDto } from './dto/update-landing-content.dto';
import { UpdateNavigationDto } from './dto/update-navigation.dto';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';

@Controller('landing-content')
export class LandingContentController {
  constructor(private readonly landingContentService: LandingContentService) {}

  @Get('public/stats')
  getPublicStats() {
    return this.landingContentService.getPublicStats();
  }

  @Get('public/:slug')
  getPublicPage(@Param('slug') slug: string) {
    return this.landingContentService.getPageBySlug(slug);
  }

  @Get('public/navigation')
  getNavigation() {
    return this.landingContentService.getNavigation();
  }

  @Get('admin/pages')
  @Auth(ValidRoles.admin)
  getAllPages() {
    return this.landingContentService.getAllPages();
  }

  @Get('admin/:slug')
  @Auth(ValidRoles.admin)
  getAdminPage(@Param('slug') slug: string) {
    return this.landingContentService.getPageBySlug(slug);
  }

  @Post('admin')
  @Auth(ValidRoles.admin)
  createPage(@Body() dto: CreateLandingContentDto) {
    return this.landingContentService.createPage(dto);
  }

  @Put('admin/:slug')
  @Auth(ValidRoles.admin)
  updatePage(@Param('slug') slug: string, @Body() dto: UpdateLandingContentDto) {
    return this.landingContentService.updatePage(slug, dto);
  }

  @Put('admin/navigation')
  @Auth(ValidRoles.admin)
  updateNavigation(@Body() dto: UpdateNavigationDto) {
    return this.landingContentService.updateNavigation(dto);
  }

  @Delete('admin/:id')
  @Auth(ValidRoles.admin)
  deletePage(@Param('id', ParseUUIDPipe) id: string) {
    return this.landingContentService.deletePage(id);
  }
}
