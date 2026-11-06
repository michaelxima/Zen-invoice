import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasSessionCookie, isProtectedPath } from "@/lib/auth/protected-paths";

// Lives in src/ next to src/app: Next.js only loads a proxy file at the same level as the app directory
// (node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md, "Convention").
//
// This redirect is only a navigation convenience. It checks that a session cookie exists, not that it is
// valid, and the matcher skips /api. Server Actions and API routes independently verify signed sessions
// and tenant ownership before accessing data.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isProtectedPath(pathname) && !hasSessionCookie(request.cookies.getAll())) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
