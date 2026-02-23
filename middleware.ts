import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    if (path.startsWith("/admin")) {
      // Support old JWTs that still have role; new logins have permissions
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
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/", "/login", "/projects/:path*", "/admin/:path*"],
};
