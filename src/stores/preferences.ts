export type Locale = "en" | "zh-CN";
export type ThemeMode = "light" | "dark" | "system";

export const STORAGE_KEYS = {
  locale: "llm-api-tester.locale",
  themeMode: "llm-api-tester.themeMode",
} as const;

export const readLocale = (): Locale => {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEYS.locale);
  return stored === "zh-CN" || stored === "en" ? stored : "en";
};

export const readThemeMode = (): ThemeMode => {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEYS.themeMode);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
};

export const persistLocale = (locale: Locale) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEYS.locale, locale);
  }
};

export const persistThemeMode = (themeMode: ThemeMode) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEYS.themeMode, themeMode);
  }
};
