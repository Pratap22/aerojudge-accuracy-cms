import type { Role } from '@npha/shared';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: Role;
      };
    }
  }
}

export {};
