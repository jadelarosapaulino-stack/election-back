import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { User } from '../auth/entities/user.entity';
import { CookieConsentService } from './cookie-consent.service';
import { RegisterCookieConsentDto } from './dto/register-cookie-consent.dto';

@Controller('consent')
export class CookieConsentController {
  constructor(private readonly consentService: CookieConsentService) {}

  @Post('cookies')
  @Auth()
  @HttpCode(HttpStatus.CREATED)
  async registerCookieConsent(
    @GetUser() user: User,
    @Body() dto: RegisterCookieConsentDto,
  ) {
    const consent = await this.consentService.register(user.id, {
      categories: dto.categories,
      version: dto.version,
      ipAddress: dto.ipAddress,
    });

    return {
      id: consent.id,
      consentType: consent.consentType,
      categories: dto.categories,
      acceptedAt: consent.acceptedAt,
    };
  }

  @Get('cookies/latest')
  @Auth()
  async getLatestCookieConsent(@GetUser() user: User) {
    const consent = await this.consentService.getLatest(user.id);
    return { consent };
  }

  @Post('cookies/revoke')
  @Auth()
  @HttpCode(HttpStatus.OK)
  async revokeCookieConsent(@GetUser() user: User) {
    await this.consentService.revoke(user.id);
    return { message: 'Cookie consent revoked' };
  }
}
