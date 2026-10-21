import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

export function SiteFooter({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
        <span>{dict.footer.operator}</span>
        <span className="flex gap-4">
          <Link href={`/${locale}/impressum`} className="hover:text-foreground">
            {dict.footer.imprint}
          </Link>
        </span>
      </div>
    </footer>
  );
}
