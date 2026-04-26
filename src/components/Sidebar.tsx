import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Ellipsis,
  Grid3X3,
  Plus,
  Settings,
  SquarePen,
  Trash2,
  Zap,
} from "lucide-react";
import { useI18n } from "../i18n";
import { useAppStore, type ProviderConfig } from "../stores/appStore";

interface Props {
  onCreateProvider?: () => void;
  onEditProvider?: (provider: ProviderConfig) => void;
  onDuplicateProvider?: (provider: ProviderConfig) => void;
  onDeleteProvider?: (provider: ProviderConfig) => Promise<void> | void;
}

export default function Sidebar({ onCreateProvider, onEditProvider, onDuplicateProvider, onDeleteProvider }: Props) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    providers,
    testCases,
    selectedProviderId,
    selectedModelId,
    fetchProviders,
    fetchTestCases,
    setSelectedProvider,
    setSelectedModel,
  } = useAppStore();
  const [providersOpen, setProvidersOpen] = useState(true);
  const [testsOpen, setTestsOpen] = useState(true);
  const [menuProviderId, setMenuProviderId] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);

  const navItems = [
    { path: "/", label: t("common.workspace"), icon: Zap },
    { path: "/matrix", label: t("common.matrix"), icon: Grid3X3 },
    { path: "/history", label: t("common.history"), icon: Clock },
    { path: "/settings", label: t("common.settings"), icon: Settings },
  ];

  useEffect(() => {
    fetchProviders();
    fetchTestCases();
  }, [fetchProviders, fetchTestCases]);

  useEffect(() => {
    setMenuProviderId(null);
  }, [location.pathname, selectedProviderId, selectedModelId]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!sidebarRef.current?.contains(event.target as Node)) {
        setMenuProviderId(null);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const handleCreateProvider = () => {
    if (onCreateProvider) {
      onCreateProvider();
      if (location.pathname !== "/") navigate("/");
      return;
    }
    navigate("/?newProvider=1");
  };

  return (
    <aside ref={sidebarRef} className="flex h-full w-64 shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--bg-surface)]">
      <div className="border-b border-[var(--border-default)] px-5 py-4">
        <h1 className="text-sm font-semibold tracking-wide text-[var(--accent)]">{t("sidebar.title")}</h1>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{t("sidebar.subtitle")}</p>
      </div>

      <nav className="space-y-1 p-3">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-2 text-xs">
        <div>
          <button
            onClick={() => setProvidersOpen(!providersOpen)}
            className="flex w-full items-center gap-1 px-1 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
          >
            {providersOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {t("sidebar.providers")}
            <button
              type="button"
              className="ml-auto rounded-md p-1 text-[var(--text-soft)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--accent)]"
              onClick={(event) => {
                event.stopPropagation();
                handleCreateProvider();
              }}
            >
              <Plus size={12} />
            </button>
          </button>
          {providersOpen && (
            <div className="mt-2 space-y-1">
              {providers.map((provider) => {
                const selected = selectedProviderId === provider.id;
                return (
                  <div key={provider.id} className="rounded-xl border border-transparent hover:border-[var(--border-default)]">
                    <div className="group flex items-center gap-1">
                      <button
                        onClick={() => {
                          setSelectedProvider(provider.id);
                          setMenuProviderId(null);
                        }}
                        className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-sm transition ${
                          selected
                            ? "bg-[var(--bg-muted)] font-medium text-[var(--text-primary)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        <div className="truncate">{provider.name}</div>
                        <div className="truncate text-[11px] text-[var(--text-soft)]">{provider.base_url}</div>
                      </button>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuProviderId((current) => (current === provider.id ? null : provider.id));
                          }}
                          className="rounded-md p-1.5 text-[var(--text-soft)] opacity-0 transition hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)] group-hover:opacity-100"
                        >
                          <Ellipsis size={14} />
                        </button>
                        {menuProviderId === provider.id && (
                          <div className="absolute right-0 top-9 z-20 w-36 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 shadow-lg shadow-[rgb(var(--shadow-strong)/0.1)]">
                            <button
                              type="button"
                              onClick={() => {
                                setMenuProviderId(null);
                                onEditProvider?.(provider);
                                if (location.pathname !== "/") navigate("/");
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--text-secondary)] transition hover:bg-[var(--bg-muted)]"
                            >
                              <SquarePen size={14} />
                              {t("common.edit")}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMenuProviderId(null);
                                onDuplicateProvider?.(provider);
                                if (location.pathname !== "/") navigate("/");
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--text-secondary)] transition hover:bg-[var(--bg-muted)]"
                            >
                              <Copy size={14} />
                              {t("common.duplicate")}
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                setMenuProviderId(null);
                                await onDeleteProvider?.(provider);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                            >
                              <Trash2 size={14} />
                              {t("common.delete")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {selected && (
                      <div className="ml-3 mt-1 space-y-1 border-l border-[var(--border-default)] pl-3">
                        {provider.models.map((model) => (
                          <button
                            key={model}
                            onClick={() => {
                              setSelectedModel(model);
                              setMenuProviderId(null);
                            }}
                            className={`block w-full truncate rounded-lg px-2 py-1 text-left text-xs transition ${
                              selectedModelId === model
                                ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                                : "text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                            }`}
                          >
                            {model}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {providers.length === 0 && (
                <p className="rounded-lg border border-dashed border-[var(--border-default)] px-3 py-3 text-sm text-[var(--text-muted)]">
                  {t("sidebar.noProviders")}
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => setTestsOpen(!testsOpen)}
            className="flex w-full items-center gap-1 px-1 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
          >
            {testsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            {t("sidebar.testCases")}
          </button>
          {testsOpen && (
            <div className="mt-2 space-y-1">
              {testCases.map((testCase) => (
                <button
                  key={testCase.id}
                  className="w-full truncate rounded-lg px-3 py-2 text-left text-sm text-[var(--text-secondary)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                >
                  {testCase.name}
                </button>
              ))}
              {testCases.length === 0 && (
                <p className="rounded-lg border border-dashed border-[var(--border-default)] px-3 py-3 text-sm text-[var(--text-muted)]">
                  {t("sidebar.noTestCases")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
