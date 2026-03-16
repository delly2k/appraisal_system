import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Protect app routes: redirect to sign-in when there is no session.
 * After sign-in, user is sent back via callbackUrl so the server will have the session cookie.
 */
export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const isAuthRoute = pathname.startsWith("/api/auth") || pathname === "/login";
  const isPublic =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".");
  const isReportingTest = pathname === "/reporting-test";

  if (isAuthRoute || isPublic || isReportingTest) {
    return NextResponse.next();
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret,
  });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - api/auth (NextAuth)
     * - login
     * - _next (Next.js)
     * - static files
     */
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|.*\\.).*)",
  ],
};
