// Interface language (UI + report text). Search language is always German
// because we query google.de — see `searchLocale` below.
export const locales = ["de", "en", "tr"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "de";

export const searchLocale = { languageCode: "de", countryCode: "DE" } as const;

export const localeLabels: Record<Locale, string> = {
  de: "Deutsch",
  en: "English",
  tr: "Türkçe",
};

export const hasLocale = (value: string): value is Locale =>
  (locales as readonly string[]).includes(value);
