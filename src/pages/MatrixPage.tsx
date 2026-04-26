import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { CheckCircle, Download, Play, X, XCircle } from "lucide-react";
import { useI18n } from "../i18n";
import { useAppStore, type RunHistorySummary } from "../stores/appStore";

interface ModelOption {
  modelName: string;
  providerNames: string[];
}

export default function MatrixPage() {
  const { t } = useI18n();
  const { providers, testCases, fetchProviders, fetchTestCases } = useAppStore();
  const [selProviders, setSelProviders] = useState<string[]>([]);
  const [selModels, setSelModels] = useState<string[]>([]);
  const [selProtocols, setSelProtocols] = useState<string[]>(["openai_chat"]);
  const [selTestCases, setSelTestCases] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [matrixId, setMatrixId] = useState<string | null>(null);
  const [results, setResults] = useState<RunHistorySummary[]>([]);

  useEffect(() => {
    fetchProviders();
    fetchTestCases();
  }, [fetchProviders, fetchTestCases]);

  const loadResults = async (id: string) => {
    const history = await invoke<RunHistorySummary[]>("list_run_history", { filters: { matrix_run_id: id } });
    setResults(history);
  };

  useEffect(() => {
    const unlisten = listen<{ matrix_run_id: string; status?: string }>("matrix-done", async (event) => {
      if (event.payload.matrix_run_id === matrixId) {
        setRunning(false);
        toast.success(event.payload.status === "cancelled" ? t("matrix.matrixCancelled") : t("matrix.matrixCompleted"));
        await loadResults(matrixId);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [matrixId, t]);

  const modelOptions = useMemo<ModelOption[]>(() => {
    return providers
      .filter((provider) => selProviders.includes(provider.id))
      .reduce<ModelOption[]>((options, provider) => {
        provider.models.forEach((modelName) => {
          const existing = options.find((option) => option.modelName === modelName);
          if (existing) {
            existing.providerNames.push(provider.name);
          } else {
            options.push({ modelName, providerNames: [provider.name] });
          }
        });
        return options;
      }, []);
  }, [providers, selProviders]);

  useEffect(() => {
    const availableModels = modelOptions.map((option) => option.modelName);
    setSelModels((current) => current.filter((model) => availableModels.includes(model)));
  }, [modelOptions]);

  const toggle = (values: string[], value: string) =>
    values.includes(value) ? values.filter((current) => current !== value) : [...values, value];

  const handleRun = async () => {
    if (!selProviders.length || !selModels.length || !selProtocols.length || !selTestCases.length) {
      toast.error(t("matrix.selectEachCategory"));
      return;
    }
    setRunning(true);
    setResults([]);
    try {
      const id = await invoke<string>("run_matrix", {
        config: { name: null, provider_ids: selProviders, model_ids: selModels, protocols: selProtocols, test_case_ids: selTestCases },
      });
      setMatrixId(id);
    } catch (error) {
      setRunning(false);
      toast.error(String(error));
    }
  };

  const handleCancel = async () => {
    if (!matrixId) return;
    try {
      await invoke("cancel_matrix", { matrixRunId: matrixId });
      toast.message(t("matrix.cancelling"));
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handleExport = async (format: string) => {
    if (!matrixId) return;
    try {
      const content = await invoke<string>("export_report", { matrixRunId: matrixId, format });
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `report.${format === "markdown" ? "md" : format}`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(t("matrix.exportedAs", { format }));
    } catch (error) {
      toast.error(String(error));
    }
  };

  const protocols = [
    { id: "openai_chat", label: t("requestBuilder.protocolChat") },
    { id: "openai_responses", label: t("requestBuilder.protocolResponses") },
    { id: "anthropic_messages", label: "Anthropic" },
  ];

  const chipCls = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-medium transition ${
      active
        ? "border border-indigo-200 bg-indigo-50 text-indigo-700"
        : "border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-muted)]"
    }`;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--bg-app)]">
      <div className="border-b border-[var(--border-default)] bg-[var(--bg-surface)] p-5">
        <h2 className="mb-4 text-base font-semibold text-[var(--text-primary)]">{t("matrix.title")}</h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">{t("matrix.providers")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  className={chipCls(selProviders.includes(provider.id))}
                  onClick={() => setSelProviders(toggle(selProviders, provider.id))}
                >
                  {provider.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">{t("matrix.models")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {modelOptions.map((model) => (
                <button
                  key={model.modelName}
                  type="button"
                  className={chipCls(selModels.includes(model.modelName))}
                  onClick={() => setSelModels(toggle(selModels, model.modelName))}
                  title={model.providerNames.join(", ")}
                >
                  <span>{model.modelName}</span>
                  <span className="ml-1 text-[11px] text-[var(--text-soft)]">{model.providerNames.join(", ")}</span>
                </button>
              ))}
              {modelOptions.length === 0 && <span className="text-xs text-[var(--text-muted)]">{t("matrix.selectProvidersFirst")}</span>}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">{t("matrix.protocols")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {protocols.map((protocol) => (
                <button
                  key={protocol.id}
                  type="button"
                  className={chipCls(selProtocols.includes(protocol.id))}
                  onClick={() => setSelProtocols(toggle(selProtocols, protocol.id))}
                >
                  {protocol.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">{t("matrix.testCases")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {testCases.map((testCase) => (
                <button
                  key={testCase.id}
                  type="button"
                  className={chipCls(selTestCases.includes(testCase.id))}
                  onClick={() => setSelTestCases(toggle(selTestCases, testCase.id))}
                >
                  {testCase.name}
                </button>
              ))}
              {testCases.length === 0 && <span className="text-xs text-[var(--text-muted)]">{t("matrix.noTestCases")}</span>}
            </div>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={handleRun}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play size={14} />
            {t("matrix.runMatrix")}
          </button>
          {running && (
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
            >
              <X size={14} />
              {t("matrix.cancel")}
            </button>
          )}
          {matrixId && !running && (
            <>
              <button
                onClick={() => handleExport("json")}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-muted)]"
              >
                <Download size={12} />
                {t("matrix.exportJson")}
              </button>
              <button
                onClick={() => handleExport("csv")}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-muted)]"
              >
                <Download size={12} />
                {t("matrix.exportCsv")}
              </button>
              <button
                onClick={() => handleExport("markdown")}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-muted)]"
              >
                <Download size={12} />
                {t("matrix.exportMarkdown")}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {results.length === 0 && (
          <p className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 text-sm text-[var(--text-muted)]">
            {t("matrix.noResults")}
          </p>
        )}
        {results.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] shadow-sm">
            <table className="w-full text-xs">
              <thead className="bg-[var(--bg-muted)] text-[var(--text-muted)]">
                <tr className="border-b border-[var(--border-default)]">
                  <th className="px-3 py-3 text-left">{t("common.provider")}</th>
                  <th className="px-3 py-3 text-left">{t("common.model")}</th>
                  <th className="px-3 py-3 text-left">{t("common.protocol")}</th>
                  <th className="px-3 py-3 text-center">{t("common.status")}</th>
                  <th className="px-3 py-3 text-center">{t("common.duration")}</th>
                  <th className="px-3 py-3 text-center">{t("common.pass")}</th>
                  <th className="px-3 py-3 text-center">{t("common.fail")}</th>
                  <th className="px-3 py-3 text-center">{t("common.warn")}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id} className="border-b border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)]">
                    <td className="px-3 py-2">{result.provider_id.slice(0, 8)}</td>
                    <td className="px-3 py-2">{result.model_id}</td>
                    <td className="px-3 py-2 text-[var(--text-muted)]">{result.protocol}</td>
                    <td className="px-3 py-2 text-center">
                      {result.fail_count === 0 ? (
                        <CheckCircle size={14} className="inline text-emerald-500" />
                      ) : (
                        <XCircle size={14} className="inline text-red-500" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-[var(--text-muted)]">{result.duration_ms ?? "-"}ms</td>
                    <td className="px-3 py-2 text-center text-emerald-600">{result.pass_count}</td>
                    <td className="px-3 py-2 text-center text-red-600">{result.fail_count}</td>
                    <td className="px-3 py-2 text-center text-amber-600">{result.warn_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
