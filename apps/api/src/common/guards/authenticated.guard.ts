import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SessionUser } from '../types/session';

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ session?: { user?: SessionUser } }>();
    if (!request.session?.user) {
      throw new UnauthorizedException('Login required');
    }
    return true;
  }
}
