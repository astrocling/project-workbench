import "next-auth";
import type { PermissionLevel } from "@prisma/client";

declare module "next-auth" {
  interface User {
    id?: string;
    permissions?: PermissionLevel;
  }

  interface Session {
    user: {
      id?: string;
      email?: string | null;
      permissions?: PermissionLevel;
      /** @deprecated Use permissions. Kept for backward compatibility with existing JWTs. */
      role?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    permissions?: PermissionLevel;
  }
}
