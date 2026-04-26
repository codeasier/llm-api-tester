import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Sidebar from "./components/Sidebar";
import ProviderForm from "./components/ProviderForm";
import WorkspacePage from "./pages/WorkspacePage";
import MatrixPage from "./pages/MatrixPage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";
import { resolveTheme, useI18n } from "./i18n";
import { useAppStore, type ProviderConfig } from "./stores/appStore";

type ProviderDialogState =
  | { mode: "create" }
  | { mode: "edit"; provider: ProviderConfig }
  | { mode: "duplicate"; provider: ProviderConfig }
  | null;

export default function App() {
  const { t } = useI18n();
  const fetchProviders = useAppStore((state) => state.fetchProviders);
  const setSelectedProvider = useAppStore((state) => state.setSelectedProvider);
  const setSelectedModel = useAppStore((state) => state.setSelectedModel);
  const themeMode = useAppStore((state) => state.themeMode);
  const [providerDialog, setProviderDialog] = useState<ProviderDialogState>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProviderConfig | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [prefersDark, setPrefersDark] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false,
  );

  const activeTheme = useMemo(() => resolveTheme(themeMode, prefersDark), [prefersDark, themeMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = activeTheme;
  }, [activeTheme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    setPrefersDark(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const closeProviderDialog = async () => {
    setProviderDialog(null);
    await fetchProviders();
  };

  const requestDeleteProvider = async (provider: ProviderConfig) => {
    setDeleteTarget(provider);
  };

  const confirmDeleteProvider = async () => {
    if (!deleteTarget || deleting) return;

    setDeleting(true);
    try {
      await invoke("delete_provider", { id: deleteTarget.id });

      if (deleteTarget.key_storage !== "none") {
        await invoke("delete_api_key", { providerId: deleteTarget.id, storage: deleteTarget.key_storage }).catch(() => undefined);
      }

      if (useAppStore.getState().selectedProviderId === deleteTarget.id) {
        setSelectedProvider(null);
        setSelectedModel(null);
      }

      await fetchProviders();
      const stillExists = useAppStore.getState().providers.some((item) => item.id === deleteTarget.id);
      if (stillExists) {
        toast.error(t("app.providerDeleteStillExists"));
        return;
      }

      toast.success(t("app.providerDeleted"));
      setDeleteTarget(null);
    } catch (error) {
      toast.error(String(error));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-screen bg-[var(--bg-app)] text-[var(--text-primary)]">
      {providerDialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[var(--bg-overlay)] p-4 py-8 backdrop-blur-sm">
          <ProviderForm
            mode={providerDialog.mode}
            initial={providerDialog.mode === "create" ? undefined : providerDialog.provider}
            onClose={closeProviderDialog}
          />
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-overlay)] p-4 backdrop-blur-sm">
          <div className="w-[420px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-2xl shadow-[rgb(var(--shadow-strong)/0.1)]">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">{t("app.deleteProviderTitle")}</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {t("app.deleteProviderDescription", { name: deleteTarget.name })}
            </p>
            <div className="mt-6 flex justify-end gap-2 border-t border-[var(--border-default)] pt-4">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={confirmDeleteProvider}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? t("common.deleting") : t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      <Sidebar
        onCreateProvider={() => setProviderDialog({ mode: "create" })}
        onEditProvider={(provider) => setProviderDialog({ mode: "edit", provider })}
        onDuplicateProvider={(provider) => setProviderDialog({ mode: "duplicate", provider })}
        onDeleteProvider={requestDeleteProvider}
      />

      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<WorkspacePage onCreateProvider={() => setProviderDialog({ mode: "create" })} />} />
          <Route path="/matrix" element={<MatrixPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage activeTheme={activeTheme} />} />
        </Routes>
      </main>
      <Toaster theme={activeTheme} position="bottom-right" richColors />
    </div>
  );
}
