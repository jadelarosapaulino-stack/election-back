// import {
//   BadRequestException,
//   Injectable,
//   InternalServerErrorException,
//   UnauthorizedException,
// } from '@nestjs/common';
// import { CreateUserDto } from './dto/create-user.dto';
// import { InjectRepository } from '@nestjs/typeorm';
// import { User } from './entities/user.entity';
// import { Repository } from 'typeorm';
// import * as bcrypt from 'bcrypt';
// import { LoginUserDto } from './dto';
// import { JwtService } from '@nestjs/jwt';
// import { JwtPayload } from './interfaces/jwt-payload';

// @Injectable()
// export class AuthService {
//   constructor(
//     @InjectRepository(User)
//     private readonly userRepository: Repository<User>,
//     private readonly jwtService: JwtService,
//   ) {}

//   async create(createUserhDto: CreateUserDto) {
//     try {
//       const { password, ...userData } = createUserhDto;
//       const user = this.userRepository.create({
//         ...userData,
//         password: bcrypt.hashSync(password, 10),
//       });
//       await this.userRepository.save(user);

//       delete user.password;
//       return {
//         ...user,
//         token: this.getJwtToken({ id: user.id }),
//       };
//     } catch (error) {
//       this.handleDBError(error);
//     }
//   }

//   async login(loginUserDto: LoginUserDto) {
//     const { password, email } = loginUserDto;

//     const user = await this.userRepository.findOne({
//       where: { email },
//       select: {
//         email: true,
//         password: true,
//         id: true,
//         fullName: true,
//         roles: true,
//       },
//     });

//     if (!user)
//       throw new UnauthorizedException('Credentials are not valid (email)');

//     if (!bcrypt.compareSync(password, user.password))
//       throw new UnauthorizedException('Credentials are not valid (password)');

//     return {
//       ...user,
//       token: this.getJwtToken({ id: user.id }),
//     };
//   }

//   async checkAuthStatus(user: User) {
//     return {
//       ...user,
//       token: this.getJwtToken({ id: user.id }),
//     };
//   }

//   private getJwtToken(payload: JwtPayload) {
//     const token = this.jwtService.sign(payload);

//     return token;
//   }

//   private handleDBError(error: any): never {
//     if (error.code == 23505) throw new BadRequestException(error.detail);

//     throw new InternalServerErrorException('Please check server logs');
//   }
// }


import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { LoginUserDto } from './dto';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from './interfaces/jwt-payload';
import { EmailService } from 'src/common/email/email.service';
import { UserConsent } from './entities/user-consent.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PlanPurchase } from 'src/billing/entities/plan-purchase.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserConsent)
    private readonly consentRepository: Repository<UserConsent>,
    @InjectRepository(PlanPurchase)
    private readonly purchaseRepository: Repository<PlanPurchase>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async create(createUserhDto: CreateUserDto) {
    if (!createUserhDto.acceptedPrivacyPolicy) {
      throw new BadRequestException(
        'Debe aceptar la política de privacidad para registrarse.',
      );
    }

    try {
      const { password, acceptedPrivacyPolicy, privacyPolicyVersion, ...userData } = createUserhDto;
      const verificationCode = this.generateVerificationCode();
      const verificationExpiresAt = this.buildExpiry();

      const user = this.userRepository.create({
        ...userData,
        password: bcrypt.hashSync(password, 10),
        isVerified: false,
        isActive: false,
        verificationCode: await this.hashValue(verificationCode),
        verificationExpiresAt,
      });
      await this.userRepository.save(user);

      // Registrar consentimiento de privacidad (H-06)
      const consent = this.consentRepository.create({
        user,
        consentType: 'privacy_policy',
        policyVersion: privacyPolicyVersion ?? '1.0',
        acceptedAt: new Date(),
        revoked: false,
      });
      await this.consentRepository.save(consent);

      delete user.password;

      await this.sendVerificationEmail(user.email, verificationCode);

      return {
        message: 'Usuario creado. Revisa tu correo para validar la cuenta.',
        email: user.email,
      };
    } catch (error) {
      this.handleDBError(error);
    }
  }

  async login(loginUserDto: LoginUserDto) {
    const { password, email } = loginUserDto;

    const user = await this.userRepository.findOne({
      where: { email },
      select: {
        email: true,
        password: true,
        id: true,
        fullName: true,
        organization: true,
        roles: true,
        isVerified: true,
        isActive: true,
      },
    });

    if (!user)
      throw new UnauthorizedException('Credentials are not valid (email)');

    if (!bcrypt.compareSync(password, user.password))
      throw new UnauthorizedException('Credentials are not valid (password)');

    if (!user.isVerified || !user.isActive) {
      throw new UnauthorizedException('La cuenta no esta verificada o esta inactiva');
    }

    const tokens = this.getTokens({ id: user.id });
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    // no exponer password en la respuesta
    const { password: _removed, ...safeUser } = user;

    return {
      ...safeUser,
      ...tokens,
    };
  }

  async checkAuthStatus(user: User) {
    const tokens = this.getTokens({ id: user.id });
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    // no exponer password en la respuesta
    const { password: _removed, ...safeUser } = user;

    return {
      ...safeUser,
      ...tokens,
    };
  }

  async refreshToken(userId: string, refreshToken: string) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user || !user.refreshToken)
      throw new UnauthorizedException('Invalid refresh token');

    if (!user.isVerified || !user.isActive) {
      throw new UnauthorizedException('La cuenta no esta verificada o esta inactiva');
    }

    const isValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isValid) throw new UnauthorizedException('Invalid refresh token');

    const tokens = this.getTokens({ id: user.id });
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

   async verifyRefreshToken(token: string): Promise<any> {
    try {
      return this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private getTokens(payload: JwtPayload) {
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m', // recomendado: corto
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d', // recomendado: largo
    });

    return { token: accessToken, refreshToken };
  }

  async verifyEmailCode(email: string, code: string) {
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
      select: [
        'id',
        'email',
        'fullName',
        'organization',
        'roles',
        'password',
        'verificationCode',
        'verificationExpiresAt',
        'isVerified',
        'isActive',
      ],
    });

    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    if (user.isVerified) {
      return {
        ...this.stripPassword(user),
        ...this.getTokens({ id: user.id }),
      };
    }

    if (!user.verificationCode || !user.verificationExpiresAt) {
      throw new UnauthorizedException('No hay codigo pendiente');
    }

    if (user.verificationExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Codigo expirado');
    }

    const isMatch = await bcrypt.compare(code, user.verificationCode);
    if (!isMatch) throw new UnauthorizedException('Codigo invalido');

    user.isVerified = true;
    user.isActive = true;
    user.verifiedAt = new Date();
    user.verificationCode = null;
    user.verificationExpiresAt = null;

    await this.userRepository.save(user);

    const tokens = this.getTokens({ id: user.id });
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      ...this.stripPassword(user),
      ...tokens,
    };
  }

  async resendVerificationCode(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
      select: [
        'id',
        'email',
        'isVerified',
        'isActive',
        'verificationCode',
        'verificationExpiresAt',
      ],
    });

    if (!user) {
      return {
        message: 'Si la cuenta existe, se enviara un nuevo codigo de verificacion.',
      };
    }

    if (user.isVerified && user.isActive) {
      return {
        message: 'La cuenta ya esta verificada. Puedes iniciar sesion.',
      };
    }

    const verificationCode = this.generateVerificationCode();
    user.verificationCode = await this.hashValue(verificationCode);
    user.verificationExpiresAt = this.buildExpiry();
    await this.userRepository.save(user);
    await this.sendVerificationEmail(user.email, verificationCode);

    return {
      message: 'Codigo de verificacion reenviado.',
      email: user.email,
    };
  }

  async requestPasswordReset(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
      select: ['id', 'email', 'isVerified', 'isActive', 'passwordResetCode', 'passwordResetExpiresAt'],
    });

    const response = {
      message: 'Si la cuenta existe, enviaremos un codigo de recuperacion.',
      email: normalizedEmail,
    };

    if (!user || !user.isVerified || !user.isActive) {
      return response;
    }

    const resetCode = this.generateVerificationCode();
    user.passwordResetCode = await this.hashValue(resetCode);
    user.passwordResetExpiresAt = this.buildExpiry();
    await this.userRepository.save(user);
    await this.emailService.sendPasswordResetCode(user.email, resetCode);

    return response;
  }

  async resetPassword(email: string, code: string, password: string) {
    const user = await this.userRepository.findOne({
      where: { email: this.normalizeEmail(email) },
      select: [
        'id',
        'email',
        'password',
        'isVerified',
        'isActive',
        'passwordResetCode',
        'passwordResetExpiresAt',
      ],
    });

    if (!user || !user.isVerified || !user.isActive) {
      throw new UnauthorizedException('Codigo invalido o expirado');
    }

    if (!user.passwordResetCode || !user.passwordResetExpiresAt) {
      throw new UnauthorizedException('No hay solicitud de recuperacion activa');
    }

    if (user.passwordResetExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Codigo expirado');
    }

    const isMatch = await bcrypt.compare(code, user.passwordResetCode);
    if (!isMatch) throw new UnauthorizedException('Codigo invalido');

    user.password = await this.hashValue(password);
    user.passwordResetCode = null;
    user.passwordResetExpiresAt = null;
    user.refreshToken = null;

    await this.userRepository.save(user);

    return {
      message: 'Contrasena actualizada. Inicia sesion con tus nuevas credenciales.',
    };
  }

  // ── GDPR H-07: Right to be forgotten ──────────────────────────────────

  async requestAccountDeletion(user: User) {
    const anonymizedEmail = `deleted-${user.id}@anonymized.local`;

    this.logger.log(
      `Account deletion requested for user ${user.id} (no PII logged)`,
    );

    // Soft-delete: desactivar y anonimizar PII
    user.isActive = false;
    user.fullName = 'Deleted User';
    user.email = anonymizedEmail;
    user.refreshToken = null;
    user.verificationCode = null;
    user.verificationExpiresAt = null;
    user.passwordResetCode = null;
    user.passwordResetExpiresAt = null;

    await this.userRepository.save(user);

    // Eliminar todos los registros de consentimiento del usuario
    await this.consentRepository.delete({ user: { id: user.id } });

    // Anonimizar customerEmail en compras asociadas (H-19)
    await this.purchaseRepository
      .createQueryBuilder()
      .update(PlanPurchase)
      .set({ customerEmail: `anonymized-${user.id}@retention.local` })
      .where('userId = :userId', { userId: user.id })
      .execute();

    this.logger.log(`Account anonymized and consents removed for user ${user.id}`);

    return {
      message:
        'Cuenta eliminada satisfactoriamente. Todos los datos personales han sido anonimizados.',
    };
  }

  // ── GDPR H-08: Data portability ───────────────────────────────────────

  async exportUserData(user: User) {
    const consents = await this.consentRepository.find({
      where: { user: { id: user.id } },
      order: { acceptedAt: 'DESC' },
    });

    return {
      profile: {
        fullName: user.fullName,
        email: user.email,
        organization: user.organization,
        createdAt: user.id, // UUID v1 contains timestamp; avoid extra column
      },
      consents: consents.map((c) => ({
        type: c.consentType,
        version: c.policyVersion,
        acceptedAt: c.acceptedAt,
        revoked: c.revoked,
      })),
      metadata: {
        exportDate: new Date().toISOString(),
        format: 'VotingSuite-Export-v1',
      },
    };
  }

  // ── GDPR H-09: Profile rectification ──────────────────────────────────

  async updateProfile(user: User, dto: UpdateProfileDto) {
    // Validar unicidad de email si se está cambiando
    if (dto.email && dto.email.toLowerCase().trim() !== user.email) {
      const normalizedEmail = dto.email.toLowerCase().trim();
      const existing = await this.userRepository.findOneBy({
        email: normalizedEmail,
      });
      if (existing) {
        throw new ConflictException(
          'El correo electrónico ya está en uso por otra cuenta.',
        );
      }
      user.email = normalizedEmail;
    }

    if (dto.fullName !== undefined) {
      user.fullName = dto.fullName;
    }

    if (dto.organization !== undefined) {
      user.organization = dto.organization;
    }

    await this.userRepository.save(user);

    return {
      message: 'Perfil actualizado correctamente.',
      user: this.stripPassword(user),
    };
  }

  private stripPassword(user: User) {
    const {
      password,
      refreshToken,
      verificationCode,
      verificationExpiresAt,
      passwordResetCode,
      passwordResetExpiresAt,
      ...rest
    } = user;
    return rest;
  }

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private buildExpiry(): Date {
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 15);
    return expires;
  }

  private async hashValue(value: string) {
    return bcrypt.hash(value, 10);
  }

  private async sendVerificationEmail(email: string, code: string) {
    await this.emailService.sendVerificationCode(email, code);
  }

  private async saveRefreshToken(userId: string, refreshToken: string) {
    const hashedRt = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(userId, { refreshToken: hashedRt });
  }

  private handleDBError(error: any): never {
    console.error('Registration error:', error);
    if (error.code == 23505) {
      throw new BadRequestException('No se pudo crear la cuenta. Verificá los datos e intentá de nuevo.');
    }
    throw new InternalServerErrorException('No se pudo crear la cuenta. Verificá los datos e intentá de nuevo.');
  }
}
