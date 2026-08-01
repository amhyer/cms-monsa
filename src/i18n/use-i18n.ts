"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { locales, type Locale } from "./locales";

export function useI18n() {
  const locale = useLocale();
  const router = useRouter();

  const switchLocale = useCallback(
    (newLocale: Locale) => {
      // Set cookie for server-side
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
      // Reload to apply new locale
      router.refresh();
    },
    [router]
  );

  const toggleLocale = useCallback(() => {
    const newLocale = locale === "id" ? "en" : "id";
    switchLocale(newLocale);
  }, [locale, switchLocale]);

  return {
    locale,
    locales,
    switchLocale,
    toggleLocale,
    isIndonesian: locale === "id",
    isEnglish: locale === "en",
  };
}

export { useTranslations };
