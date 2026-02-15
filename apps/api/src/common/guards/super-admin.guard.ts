import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { SessionUser } from '../types/session';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ session?: { user?: SessionUser } }>();
    const user = request.session?.user;
    if (!user || user.level < 10) {
      throw new ForbiddenException('Super admin only.');
    }
    return true;
  }
}
