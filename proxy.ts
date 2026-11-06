import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPaths = ["/dashboard", "/invoices", "/clients", "/estimates", "/recurring", "/ai-create", "/settings"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const hasSessionCookie = request.cookies.getAll().some(({ name }) =>
    name === "__Secure-next-auth.session-token" ||
    name === "next-auth.session-token" ||
    name.startsWith("__Secure-next-auth.session-token.") ||
    name.startsWith("next-auth.session-token."),
  );

  // This redirect is only a navigation convenience. Server Actions and API routes
  // independently verify signed sessions and tenant ownership before accessing data.
  if (isProtected && !hasSessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
