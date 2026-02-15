import 'express-session';

export interface SessionUser {
  id: number;
  loginId: string;
  level: number;
  name: string;
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
    [key: string]: unknown;
  }
}
