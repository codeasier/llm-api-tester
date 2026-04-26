import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import Select from "../components/Select";
import { useI18n } from "../i18n";
import type { RunHistorySummary } from "../stores/appStore";

interface RunDetail {
  id: string;
  provider_id: string;
  model_id: string;
  protocol: string;
  request_snapshot: Record<string, unknown>;
  response_raw?: string;
  status_code?: number;
  error_message?: string;
  duration_ms?: number;
  stream: boolean;
  compat_results?: { check_id: string; category: string; status: string; reason: string }[];
  created_at: string;
}

export default function HistoryPage() {
  const { t } = useI18n();
  const [runs, setRuns] = useState<RunHistorySummary[]>([]);
  const [selected, setSelected] = useState<RunDetail | null>(null);
  const [filterProtocol, setFilterProtocol] = useState("");

  const loadHistory = useCallback(async () => {
    try {
      const history = await invoke<RunHistorySummary[]>("list_run_history", {
        filters: { protocol: filterProtocol || null, limit: 100 },
      });
      setRuns(history);
    } catch (error) {
      toast.error(String(error));
    }
  }, [filterProtocol]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const loadDetail = async (id: string) => {
    try {
      const detail = await invoke<RunDetail | null>("get_run_detail", { runId: id });
      setSelected(detail);
    } catch (error) {
      toast.error(String(error));
    }
  };

  return (
    <div className="flex h-full bg-[var(--bg-app)]">
      <div className="flex min-w-0 flex-1 flex-col border-r border-[var(--border-default)] bg-[var(--bg-surface)]">
        <div className="flex items-center gap-2 border-b border-[var(--border-default)] px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{t("history.title")}</span>
          <div className="ml-auto w-52">
            <Select
              value={filterProtocol}
              onChange={(event) => setFilterProtocol(event.target.value)}
              options={[
                { value: "", label: t("history.allProtocols") },
                { value: "openai_chat", label: t("requestBuilder.protocolChat") },
                { value: "openai_responses", label: t("requestBuilder.protocolResponses") },
                { value: "anthropic_messages", label: "Anthropic" },
              ]}
            />
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {runs.length === 0 && <p className="p-4 text-sm text-[var(--text-muted)]">{t("history.noHistory")}</p>}
          {runs.map((run) => (
            <button
              key={run.id}
              onClick={() => loadDetail(run.id)}
              className={`w-full border-b border-[var(--border-default)] p-4 text-left text-xs transition hover:bg-[var(--bg-muted)] ${
                selected?.id === run.id ? "bg-[var(--bg-muted)]" : "bg-[var(--bg-surface)]"
              }`}
            >
              <div className="flex items-center gap-2">
                {run.fail_count === 0 ? (
                  <CheckCircle size={12} className="shrink-0 text-emerald-500" />
                ) : (
                  <XCircle size={12} className="shrink-0 text-red-500" />
                )}
                <span className="truncate font-mono text-[var(--text-primary)]">{run.model_id}</span>
                <span className="text-[var(--text-muted)]">{run.protocol}</span>
                <span className="ml-auto text-[var(--text-soft)]">{run.duration_ms ?? "-"}ms</span>
              </div>
              <div className="mt-1 text-[var(--text-soft)]">{new Date(run.created_at).toLocaleString()}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex w-[420px] shrink-0 flex-col overflow-hidden bg-[var(--bg-surface)]">
        {!selected && (
          <div className="flex h-full items-center justify-center px-6 text-sm text-[var(--text-muted)]">
            {t("history.selectRun")}
          </div>
        )}
        {selected && (
          <div className="flex-1 space-y-5 overflow-auto p-5 text-xs">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{t("history.info")}</h3>
              <div className="space-y-1 rounded-xl border border-[var(--border-default)] bg-[var(--bg-muted)] p-3 text-[var(--text-secondary)]">
                <p>
                  {t("common.model")}: <span className="font-mono">{selected.model_id}</span>
                </p>
                <p>{t("common.protocol")}: {selected.protocol}</p>
                <p>{t("common.status")}: {selected.status_code ?? t("common.na")}</p>
                <p>{t("common.duration")}: {selected.duration_ms ?? t("common.na")}ms</p>
                <p>{t("history.stream")}: {selected.stream ? t("common.yes") : t("common.no")}</p>
                {selected.error_message && <p className="text-red-600">{t("history.error")}: {selected.error_message}</p>}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{t("history.request")}</h3>
              <pre className="max-h-40 overflow-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-muted)] p-3 font-mono text-[var(--text-secondary)]">{JSON.stringify(selected.request_snapshot, null, 2)}</pre>
            </div>
            {selected.response_raw && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{t("history.response")}</h3>
                <pre className="max-h-60 overflow-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-muted)] p-3 font-mono text-[var(--text-secondary)]">{selected.response_raw.slice(0, 3000)}</pre>
              </div>
            )}
            {selected.compat_results && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{t("history.compatibility")}</h3>
                <div className="space-y-2">
                  {selected.compat_results.map((compat, index) => (
                    <div key={index} className="flex items-start gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-muted)] px-3 py-2">
                      {compat.status === "pass" ? (
                        <CheckCircle size={12} className="text-emerald-500" />
                      ) : compat.status === "fail" ? (
                        <XCircle size={12} className="text-red-500" />
                      ) : (
                        <AlertTriangle size={12} className="text-amber-500" />
                      )}
                      <div>
                        <span className="font-mono text-[var(--text-primary)]">{compat.check_id}</span>
                        <span className="ml-2 text-[var(--text-muted)]">{compat.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
