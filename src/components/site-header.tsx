import Link from "next/link";
import { localeLabels, locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

/** `path` is the page path after the locale, e.g. "" or "/impressum". */
export function SiteHeader({ dict, locale, path = "" }: { dict: Dictionary; locale: Locale; path?: string }) {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
      <Link href={`/${locale}`} className="text-lg font-semibold tracking-tight">
        Ortsrank
        <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 align-middle text-xs font-medium text-accent">
          {dict.nav.status}
        </span>
      </Link>
      <nav aria-label={dict.nav.language} className="flex gap-1 text-sm">
        {locales.map((l) => (
          <Link
            key={l}
            href={`/${l}${path}`}
            hrefLang={l}
            aria-current={l === locale ? "true" : undefined}
            className="rounded-md px-2 py-1 text-muted hover:text-foreground aria-[current]:bg-surface aria-[current]:text-foreground"
          >
            {localeLabels[l]}
          </Link>
        ))}
      </nav>
    </header>
  );
}
