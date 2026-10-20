import Link from "next/link";
import { localeLabels, locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export default async function Home() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <span className="text-lg font-semibold tracking-tight">
          Ortsrank
          <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 align-middle text-xs font-medium text-accent">
            {dict.nav.status}
          </span>
        </span>
        <nav aria-label={dict.nav.language} className="flex gap-1 text-sm">
          {locales.map((l) => (
            <Link
              key={l}
              href={`/${l}`}
              hrefLang={l}
              aria-current={l === locale ? "true" : undefined}
              className="rounded-md px-2 py-1 text-muted hover:text-foreground aria-[current]:bg-surface aria-[current]:text-foreground"
            >
              {localeLabels[l]}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 sm:px-6">
        <section className="py-16 sm:py-24">
          <p className="text-sm font-medium text-accent">{dict.hero.eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            {dict.hero.title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted text-pretty">
            {dict.hero.lead}
          </p>
        </section>

        <section className="border-t border-line py-14">
          <h2 className="text-xl font-semibold">{dict.features.title}</h2>
          <ul className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {dict.features.items.map((item) => (
              <li key={item.title}>
                <h3 className="font-medium">{item.title}</h3>
                <p className="mt-1.5 leading-relaxed text-muted">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
          <span>{dict.footer.operator}</span>
          <span className="flex gap-4">
            <a href="https://foundercheck.de/impressum" className="hover:text-foreground">
              {dict.footer.imprint}
            </a>
            <a href="https://foundercheck.de/datenschutz" className="hover:text-foreground">
              {dict.footer.privacy}
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
