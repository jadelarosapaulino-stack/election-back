import { Controller, Get } from '@nestjs/common';
import { Aes256GcmService } from 'src/common/security/aes-256-gcm.service';

@Controller('security')
export class SecurityController {
  constructor(private readonly aes: Aes256GcmService) {}

  @Get('encryption-status')
  encryptionStatus() {
    const active = this.aes.selfTest();
    return {
      algorithm: this.aes.algorithm,
      active,
      checkedAt: new Date().toISOString(),
    };
  }
}
