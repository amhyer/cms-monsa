// Client-safe i18n constants.
// NOTE: Jangan mengimpor `next/headers` atau `next-intl/server` di file ini —
// file ini diimpor oleh client components (language-switcher, use-i18n).
// Kode server-only (getRequestConfig + cookies) ada di `./config.ts`.

export const locales = ["id", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "id";

export const localeNames: Record<Locale, string> = {
  id: "Bahasa Indonesia",
  en: "English",
};
