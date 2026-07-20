import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Auth } from '../auth/decorators';
import { ValidRoles } from '../auth/interfaces';
import { SystemConfigService } from './system-config.service';
import { SetConfigDto } from './dto/set-config.dto';
import { UpdateSmtpConfigDto } from './dto/update-smtp-config.dto';
import { UpdateRedisConfigDto } from './dto/update-redis-config.dto';
import { SaveTemplateDto } from './dto/save-template.dto';
import { TestSmtpDto } from './dto/test-smtp.dto';
import { CreateSmtpProviderDto } from './dto/create-smtp-provider.dto';
import { UpdateSmtpProviderDto } from './dto/update-smtp-provider.dto';

@Controller('system-config')
@Auth(ValidRoles.admin)
export class SystemConfigController {
  constructor(private readonly configService: SystemConfigService) {}

  // ─── Generic config endpoints ───────────────────────────────

  @Get('configs/:group')
  async getConfigsByGroup(@Param('group') group: string) {
    const configs = await this.configService.getConfigsByGroup(group);
    if (group !== 'email_smtp') return configs;

    return configs.map((config) =>
      config.key === 'pass'
        ? { ...config, value: '', configured: Boolean(config.value) }
        : config,
    );
  }

  @Get('configs/:group/:key')
  async getConfig(@Param('group') group: string, @Param('key') key: string) {
    const value = await this.configService.getConfig(group, key);
    if (group === 'email_smtp' && key === 'pass') {
      return { group, key, value: '', configured: Boolean(value) };
    }
    return { group, key, value };
  }

  @Post('configs')
  setConfig(@Body() dto: SetConfigDto) {
    return this.configService.setConfig(
      dto.group,
      dto.key,
      dto.value,
      dto.description,
    );
  }

  @Delete('configs/:group/:key')
  async deleteConfig(@Param('group') group: string, @Param('key') key: string) {
    await this.configService.deleteConfig(group, key);
    return { deleted: true };
  }

  // ─── Email SMTP config ─────────────────────────────────────

  @Get('email/smtp')
  getEmailSmtpConfig() {
    return this.configService.getEmailSmtpPublicConfig();
  }

  @Put('email/smtp')
  async updateEmailSmtpConfig(@Body() dto: UpdateSmtpConfigDto) {
    return this.configService.updateDefaultSmtpProvider(dto);
  }

  @Post('email/smtp/test')
  testEmailSmtpConfig(@Body() dto: TestSmtpDto) {
    return this.configService.testEmailSmtpConfig(dto.recipient);
  }

  @Get('email/smtp/providers')
  getSmtpProviders() {
    return this.configService.getSmtpProviders();
  }

  @Post('email/smtp/providers')
  createSmtpProvider(@Body() dto: CreateSmtpProviderDto) {
    return this.configService.createSmtpProvider(dto);
  }

  @Put('email/smtp/providers/:id')
  updateSmtpProvider(
    @Param('id') id: string,
    @Body() dto: UpdateSmtpProviderDto,
  ) {
    return this.configService.updateSmtpProvider(id, dto);
  }

  @Post('email/smtp/providers/:id/activate')
  activateSmtpProvider(@Param('id') id: string) {
    return this.configService.activateSmtpProvider(id);
  }

  @Post('email/smtp/providers/:id/test')
  testSmtpProvider(@Param('id') id: string, @Body() dto: TestSmtpDto) {
    return this.configService.testEmailSmtpConfig(dto.recipient, id);
  }

  @Delete('email/smtp/providers/:id')
  async deleteSmtpProvider(@Param('id') id: string) {
    await this.configService.deleteSmtpProvider(id);
    return { deleted: true };
  }

  // ─── Email Redis config ────────────────────────────────────

  @Get('email/redis')
  getEmailRedisConfig() {
    return this.configService.getEmailRedisConfig();
  }

  @Put('email/redis')
  async updateEmailRedisConfig(@Body() dto: UpdateRedisConfigDto) {
    const entries = Object.entries(dto).filter(
      ([, v]) => v !== undefined,
    ) as Array<[string, string | number | boolean]>;

    for (const [key, value] of entries) {
      await this.configService.setConfig('email_redis', key, String(value));
    }
    return this.configService.getEmailRedisConfig();
  }

  // ─── Template endpoints ────────────────────────────────────

  @Get('email/templates')
  getTemplates() {
    return this.configService.getTemplates();
  }

  @Get('email/templates/:name')
  getTemplate(@Param('name') name: string) {
    return this.configService.getTemplate(name);
  }

  @Post('email/templates')
  saveTemplate(@Body() dto: SaveTemplateDto) {
    return this.configService.saveTemplate(dto.name, dto.subject, dto.htmlBody);
  }

  @Delete('email/templates/:name')
  async deleteTemplate(@Param('name') name: string) {
    await this.configService.deleteTemplate(name);
    return { deleted: true };
  }

  // ─── Cache ─────────────────────────────────────────────────

  @Post('refresh-cache')
  async refreshCache() {
    await this.configService.refreshCache();
    return { refreshed: true };
  }
}
