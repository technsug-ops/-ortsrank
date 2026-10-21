import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { operator, operatorPhoneHref } from "@/config/operator";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: `${dict.imprint.title} – Ortsrank` };
}

export default async function Impressum() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  const t = dict.imprint;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader dict={dict} locale={locale} path="/impressum" />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight">{t.title}</h1>

        <div className="mt-8 max-w-2xl space-y-8 leading-relaxed">
          <section>
            <h2 className="text-sm font-medium text-muted">{t.legalBasis}</h2>
            <address className="mt-2 not-italic">
              {operator.company}
              <br />
              {operator.street}
              <br />
              {operator.postalCity}
              <br />
              {operator.country}
            </address>
          </section>

          <section>
            <h2 className="text-sm font-medium text-muted">{t.representedBy}</h2>
            <p className="mt-2">{operator.managingDirector}</p>
          </section>

          <section>
            <h2 className="text-sm font-medium text-muted">{t.register}</h2>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted">{t.registerCourt}</dt>
              <dd>{operator.registerCourt}</dd>
              <dt className="text-muted">{t.registerNumber}</dt>
              <dd>{operator.registerNumber}</dd>
            </dl>
          </section>

          <section>
            <h2 className="text-sm font-medium text-muted">{t.vat}</h2>
            <p className="mt-2">{operator.vatId}</p>
          </section>

          <section>
            <h2 className="text-sm font-medium text-muted">{t.contact}</h2>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted">{t.phone}</dt>
              <dd>
                <a href={operatorPhoneHref} className="underline underline-offset-2 hover:text-accent">
                  {operator.phone}
                </a>
              </dd>
              <dt className="text-muted">{t.email}</dt>
              <dd>
                <a href={`mailto:${operator.email}`} className="underline underline-offset-2 hover:text-accent">
                  {operator.email}
                </a>
              </dd>
            </dl>
          </section>

          <p>
            <Link href={`/${locale}`} className="text-sm text-muted underline underline-offset-2 hover:text-foreground">
              {t.back}
            </Link>
          </p>
        </div>
      </main>

      <SiteFooter dict={dict} locale={locale} />
    </div>
  );
}
