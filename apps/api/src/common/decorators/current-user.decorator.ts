import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SessionUser } from '../types/session';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser | undefined => {
    const req = ctx.switchToHttp().getRequest<{ session?: { user?: SessionUser } }>();
    return req.session?.user;
  }
);
