import type { NextAuthOptions } from "next-auth";
import type { PermissionLevel } from "@prisma/client";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

if (process.env.NODE_ENV === "production") {
  if (!NEXTAUTH_SECRET || NEXTAUTH_SECRET.length < 32) {
    throw new Error(
      "NEXTAUTH_SECRET must be set and at least 32 characters in production. " +
        "Generate one with: openssl rand -base64 32"
    );
  }
}

export const authOptions: NextAuthOptions = {
  secret: NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user) return null;
        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          permissions: user.permissions,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.permissions = (user as { permissions?: PermissionLevel }).permissions;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        // Support old JWTs that still have role; new logins have permissions
        (session.user as { permissions?: string }).permissions =
          (token.permissions as string) ?? (token as { role?: string }).role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days; permission changes take effect on next login
  },
};
