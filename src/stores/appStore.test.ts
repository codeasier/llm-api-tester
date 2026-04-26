import { beforeEach, describe, expect, it } from "vitest";
import { readLocale, readThemeMode, STORAGE_KEYS } from "./preferences";

const createStorage = () => {
  let values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    clear: () => {
      values = new Map<string, string>();
    },
  };
};

describe("appStore persisted preferences", () => {
  const localStorage = createStorage();

  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: localStorage,
      configurable: true,
      writable: true,
    });
    localStorage.clear();
  });

  it("returns default locale when nothing is stored", () => {
    expect(readLocale()).toBe("en");
  });

  it("returns stored locale when value is supported", () => {
    window.localStorage.setItem(STORAGE_KEYS.locale, "zh-CN");

    expect(readLocale()).toBe("zh-CN");
  });

  it("falls back to default locale for unsupported values", () => {
    window.localStorage.setItem(STORAGE_KEYS.locale, "fr");

    expect(readLocale()).toBe("en");
  });

  it("returns default theme mode when nothing is stored", () => {
    expect(readThemeMode()).toBe("system");
  });

  it("returns stored theme mode when value is supported", () => {
    window.localStorage.setItem(STORAGE_KEYS.themeMode, "dark");

    expect(readThemeMode()).toBe("dark");
  });

  it("falls back to system theme for unsupported values", () => {
    window.localStorage.setItem(STORAGE_KEYS.themeMode, "sepia");

    expect(readThemeMode()).toBe("system");
  });
});
