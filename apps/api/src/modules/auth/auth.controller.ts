import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedGuard } from '../../common/guards/authenticated.guard';
import { env } from '../../config/env';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const sessionUser = await this.authService.validateLogin(dto);
    req.session.user = sessionUser;
    return { ok: true, user: sessionUser };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    res.clearCookie(env.SESSION_NAME);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AuthenticatedGuard)
  async me(@Req() req: Request) {
    const user = await this.authService.me(req.session.user!.id);
    return { ok: true, user };
  }
}
