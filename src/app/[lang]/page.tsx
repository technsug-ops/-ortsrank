import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getDictionary, getLocale } from "@/i18n/dictionaries";

export default async function Home() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader dict={dict} locale={locale} />

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

      <SiteFooter dict={dict} locale={locale} />
    </div>
  );
}
