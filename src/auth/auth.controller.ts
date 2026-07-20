import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
  Req,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto, EmailDto, LoginUserDto, ResetPasswordDto, UpdateProfileDto } from './dto/';
import { AuthGuard } from '@nestjs/passport';
import { User } from './entities/user.entity';
import { Auth, GetUser, RawHeaders } from 'src/auth/decorators';
import { UserRoleGuard } from './guards/user-role/user-role.guard';
import { VerifyCodeDto } from './dto/verify-code.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  create(@Body() createUserDto: CreateUserDto) {
    return this.authService.create(createUserDto);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  loginUser(@Body() loginUserDto: LoginUserDto) {
    return this.authService.login(loginUserDto);
  }

  @Post('verify-code')
  verifyCode(@Body() dto: VerifyCodeDto) {
    return this.authService.verifyEmailCode(dto.email, dto.code);
  }

  @Post('resend-verification-code')
  resendVerificationCode(@Body() dto: EmailDto) {
    return this.authService.resendVerificationCode(dto.email);
  }

  @Post('request-password-reset')
  requestPasswordReset(@Body() dto: EmailDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.code, dto.password);
  }

  @Post('refresh')
  async refresh(@Body() body: { refreshToken: string }, @Req() req: any) {
    const { refreshToken } = body;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    // extraer userId del refreshToken
    let payload: any;
    try {
      payload = await this.authService.verifyRefreshToken(refreshToken);
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.authService.refreshToken(payload.id, refreshToken);
  }

  @Get('check-status')
  @Auth()
  checkAuthStatus(
    @GetUser() user: User
  ) {
    return this.authService.checkAuthStatus(user);
  }

  @Get('private')
  @UseGuards(AuthGuard())
  
  testingPrivateRoute( 
    @GetUser() user: User,
    @RawHeaders('authorization') headers: any
   ) {
    return {
      ok: true,
      messagge: 'Hola mundo private',
      user,
      headers
    };
  }

  @Get('private2')
  @SetMetadata('roles', ['admin','super-user'])
  @UseGuards(AuthGuard(), UserRoleGuard)
  privateRoute2(
    @GetUser() user: User
  ) {
    return {
      ok: true,
      user
    };
  }

  @Get('private3')
  @Auth()
  privateRoute3(
    @GetUser() user: User
  ) {
    return {
      ok: true,
      user
    };
  }

  // ── GDPR H-07: Account deletion (Right to be forgotten) ────────────────

  @Delete('account')
  @Auth()
  deleteAccount(@GetUser() user: User) {
    return this.authService.requestAccountDeletion(user);
  }

  // ── GDPR H-08: Data portability ────────────────────────────────────────

  @Get('export-data')
  @Auth()
  exportData(@GetUser() user: User) {
    return this.authService.exportUserData(user);
  }

  // ── GDPR H-09: Profile rectification ───────────────────────────────────

  @Patch('profile')
  @Auth()
  updateProfile(
    @GetUser() user: User,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user, dto);
  }

}
