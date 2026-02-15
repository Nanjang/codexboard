import { Injectable, UnauthorizedException } from '@nestjs/common';
import { compare } from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SessionUser } from '../../common/types/session';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async validateLogin(dto: LoginDto): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({
      where: { loginId: dto.loginId },
      select: {
        id: true,
        loginId: true,
        passwordHash: true,
        level: true,
        name: true,
        status: true
      }
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      id: user.id,
      loginId: user.loginId,
      level: user.level,
      name: user.name
    };
  }

  async me(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        loginId: true,
        name: true,
        nick: true,
        email: true,
        level: true,
        point: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }
}
