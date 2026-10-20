import { NextResponse, type NextRequest } from "next/server";
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { defaultLocale, locales } from "@/i18n/config";

function preferredLocale(request: NextRequest): string {
  const cookie = request.cookies.get("locale")?.value;
  if (cookie && (locales as readonly string[]).includes(cookie)) return cookie;
  const languages = new Negotiator({
    headers: { "accept-language": request.headers.get("accept-language") ?? "" },
  }).languages();
  try {
    return match(languages, locales, defaultLocale);
  } catch {
    return defaultLocale;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  if (hasLocale) return;

  request.nextUrl.pathname = `/${preferredLocale(request)}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|.*\\..*).*)"],
};
