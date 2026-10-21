import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { privacySections, privacyUpdatedAt, privacyVersion } from "@/content/legal/privacy";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.privacy.title} – Ortsrank` };
}

export default async function Datenschutz() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.privacy;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader dict={dict} locale={locale} path="/datenschutz" />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>
        {t.languageNote && (
          <p className="mt-4 max-w-2xl rounded-md bg-surface px-4 py-3 text-sm leading-relaxed text-muted">{t.languageNote}</p>
        )}

        <div lang="de" className="mt-8 max-w-2xl space-y-8 leading-relaxed">
          {privacySections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-semibold">{section.heading}</h2>
              {section.paragraphs.map((p) => (
                <p key={p.slice(0, 40)} className="mt-2">
                  {p}
                </p>
              ))}
            </section>
          ))}
          <p className="text-sm text-muted">
            {t.version} {privacyVersion} · {t.updated} {privacyUpdatedAt}
          </p>
          <p>
            <Link href={`/${locale}`} className="text-sm text-muted underline underline-offset-2 hover:text-foreground">
              {dict.imprint.back}
            </Link>
          </p>
        </div>
      </main>

      <SiteFooter dict={dict} locale={locale} />
    </div>
  );
}
