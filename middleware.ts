import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    if (path.startsWith("/admin")) {
      if (token?.role !== "Admin") {
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
