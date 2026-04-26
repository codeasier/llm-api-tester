import { useState } from "react";
import Select from "../components/Select";
import { useI18n } from "../i18n";
import { useAppStore } from "../stores/appStore";

interface Props {
  activeTheme: "light" | "dark";
}

export default function SettingsPage({ activeTheme }: Props) {
  const { t } = useI18n();
  const locale = useAppStore((state) => state.locale);
  const setLocale = useAppStore((state) => state.setLocale);
  const themeMode = useAppStore((state) => state.themeMode);
  const setThemeMode = useAppStore((state) => state.setThemeMode);
  const [keyStorage, setKeyStorage] = useState("secure");

  const inputCls =
    "w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]";

  return (
    <div className="min-h-full bg-[var(--bg-app)] p-6">
      <div className="max-w-2xl rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-sm">
        <h2 className="mb-6 text-base font-semibold text-[var(--text-primary)]">{t("settings.title")}</h2>

        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {t("settings.language")}
            </label>
            <Select
              value={locale}
              onChange={(event) => setLocale(event.target.value as "en" | "zh-CN")}
              options={[
                { value: "en", label: t("settings.languageEnglish") },
                { value: "zh-CN", label: t("settings.languageChinese") },
              ]}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {t("settings.theme")}
            </label>
            <Select
              value={themeMode}
              onChange={(event) => setThemeMode(event.target.value as "light" | "dark" | "system")}
              options={[
                { value: "light", label: t("settings.themeLight") },
                { value: "dark", label: t("settings.themeDark") },
                { value: "system", label: t("settings.themeSystem") },
              ]}
            />
            <p className="mt-2 text-xs text-[var(--text-muted)]">{t("settings.activeTheme", { theme: t(`theme.${activeTheme}`) })}</p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {t("settings.keyStorage")}
            </label>
            <Select
              value={keyStorage}
              onChange={(event) => setKeyStorage(event.target.value)}
              options={[
                { value: "secure", label: t("settings.keyStorageSecure") },
                { value: "memory", label: t("settings.keyStorageMemory") },
              ]}
            />
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {keyStorage === "secure" ? t("settings.keyStorageSecureHelp") : t("settings.keyStorageMemoryHelp")}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
              {t("settings.requestTimeout")}
            </label>
            <input type="number" defaultValue={60} className={inputCls} />
          </div>

          <div className="border-t border-[var(--border-default)] pt-4">
            <p className="text-xs text-[var(--text-muted)]">{t("settings.version")}</p>
            <p className="mt-1 text-xs text-[var(--text-soft)]">{t("settings.builtWith")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
