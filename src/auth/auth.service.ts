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
  Injectable,
  InternalServerErrorException,
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

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async create(createUserhDto: CreateUserDto) {
    try {
      const { password, ...userData } = createUserhDto;
      const user = this.userRepository.create({
        ...userData,
        password: bcrypt.hashSync(password, 10),
      });
      await this.userRepository.save(user);

      delete user.password;
      const tokens = this.getTokens({ id: user.id });

      // opcional: guardar refreshToken hasheado en BD
      await this.saveRefreshToken(user.id, tokens.refreshToken);

      return {
        ...user,
        ...tokens,
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
        roles: true,
      },
    });

    if (!user)
      throw new UnauthorizedException('Credentials are not valid (email)');

    if (!bcrypt.compareSync(password, user.password))
      throw new UnauthorizedException('Credentials are not valid (password)');

    const tokens = this.getTokens({ id: user.id });
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      ...user,
      ...tokens,
    };
  }

  async checkAuthStatus(user: User) {
    const tokens = this.getTokens({ id: user.id });
    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      ...user,
      ...tokens,
    };
  }

  async refreshToken(userId: string, refreshToken: string) {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user || !user.refreshToken)
      throw new UnauthorizedException('Invalid refresh token');

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

  private async saveRefreshToken(userId: string, refreshToken: string) {
    const hashedRt = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(userId, { refreshToken: hashedRt });
  }

  private handleDBError(error: any): never {
    if (error.code == 23505) throw new BadRequestException(error.detail);
    throw new InternalServerErrorException('Please check server logs');
  }
}
