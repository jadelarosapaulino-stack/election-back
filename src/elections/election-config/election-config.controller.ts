import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ElectionConfigService } from './election-config.service';
import { ElectionConfigLockGuard } from '../guards/election-config-lock.guard';
import { ElectionConfig } from './entities/election-config.entity';
import { User } from 'src/auth/entities/user.entity';
import { Auth, GetUser } from 'src/auth/decorators';

@Controller('election-config')
@Auth()
export class ElectionConfigController {
  constructor(private readonly configService: ElectionConfigService) {}

  @Get(':electionId')
  async getConfig(
    @Param('electionId') electionId: string,
    @GetUser() user: User
  ): Promise<ElectionConfig> {
    return this.configService.findOne(electionId, user);
  }

  @Post()
  async createConfig(@Body() body: Partial<ElectionConfig>) {
    return this.configService.createConfig(body);
  }

  @Patch(':electionId')
  @UseGuards(ElectionConfigLockGuard)
  async updateConfig(
    @Param('electionId') electionId: string,
    @GetUser() user: User,
    @Body() body: Partial<ElectionConfig>,
  ) {
    return this.configService.updateConfig(electionId, user, body);
  }
}
