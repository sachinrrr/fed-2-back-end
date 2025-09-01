/// <reference types="@clerk/express/env" />

export {};

// Create a type for the roles
export type Role = "admin";

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: Role;
    };
  }

  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        firstName?: string;
        lastName?: string;
        emailAddress?: string;
        sessionId?: string;
        sessionClaims?: any;
      };
    }
  }
}