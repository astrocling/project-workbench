import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuth } from "next-auth/middleware";
import { getClientIp, loginRatelimit } from "@/lib/ratelimit";

const withAuthMiddleware = withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    if (path.startsWith("/admin")) {
      const level = token?.permissions ?? (token as { role?: string })?.role;
      if (level !== "Admin") {
        return Response.redirect(new URL("/projects", req.url));
      }
    }
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        if (path === "/" || path === "/login") return true;
        if (path.startsWith("/api/auth")) return true;
        return !!token;
      },
    },
  }
);

/** Any POST to auth that could be credentials sign-in (NextAuth may use signin or callback path). */
function isLoginPost(path: string, method: string): boolean {
  if (method !== "POST") return false;
  if (!path.startsWith("/api/auth/")) return false;
  return path.includes("signin") || path.includes("callback");
}

export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  const path = req.nextUrl.pathname;
  if (isLoginPost(path, req.method)) {
    const ip = getClientIp(req.headers);
    const { success } = await loginRatelimit.limit(ip);
    if (!success) {
      return new NextResponse(
        JSON.stringify({ error: "Too many login attempts. Try again later." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }
  }
  return withAuthMiddleware(req, event);
}

export const config = {
  matcher: ["/", "/login", "/projects/:path*", "/admin/:path*", "/api/auth/:path*"],
};
