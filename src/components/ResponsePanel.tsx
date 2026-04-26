import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, Loader2, XCircle } from "lucide-react";
import { useI18n } from "../i18n";
import type { CheckResult } from "../stores/appStore";

interface Props {
  running: boolean;
  streamOutput: string;
  rawResponse: string;
  statusCode: number | null;
  duration: number | null;
  compatResults: CheckResult[];
  error: string | null;
}

type Tab = "stream" | "raw" | "compat";

const statusIcon = (status: string) => {
  if (status === "pass") return <CheckCircle size={14} className="text-emerald-500" />;
  if (status === "fail") return <XCircle size={14} className="text-red-500" />;
  return <AlertTriangle size={14} className="text-amber-500" />;
};

export default function ResponsePanel({
  running,
  streamOutput,
  rawResponse,
  statusCode,
  duration,
  compatResults,
  error,
}: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("stream");
  const scrollRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [streamOutput]);

  const passCount = compatResults.filter((result) => result.status === "pass").length;
  const failCount = compatResults.filter((result) => result.status === "fail").length;
  const warnCount = compatResults.filter((result) => result.status === "warn").length;

  return (
    <div className="flex h-full flex-col bg-[var(--bg-surface)]">
      <div className="flex items-center gap-3 border-b border-[var(--border-default)] px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{t("responsePanel.title")}</span>
        {running && (
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
            <Loader2 size={12} className="animate-spin" />
            {t("responsePanel.waiting")}
          </span>
        )}
        {statusCode != null && (
          <span
            className={`rounded-md px-2 py-1 text-xs font-mono ${
              statusCode < 400 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
            }`}
          >
            {statusCode}
          </span>
        )}
        {!running && duration != null && <span className="text-xs text-[var(--text-muted)]">{duration}ms</span>}
        {compatResults.length > 0 && (
          <div className="ml-auto flex items-center gap-2 text-xs font-medium">
            <span className="text-emerald-600">{passCount}P</span>
            <span className="text-red-600">{failCount}F</span>
            <span className="text-amber-600">{warnCount}W</span>
          </div>
        )}
      </div>

      <div className="flex border-b border-[var(--border-default)] bg-[var(--bg-muted)] px-2">
        {(["stream", "raw", "compat"] as Tab[]).map((nextTab) => (
          <button
            key={nextTab}
            onClick={() => setTab(nextTab)}
            className={`border-b-2 px-3 py-2 text-xs font-semibold transition ${
              tab === nextTab
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {nextTab === "stream" ? t("responsePanel.output") : nextTab === "raw" ? t("responsePanel.raw") : t("responsePanel.compatibility")}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4 text-sm">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        {tab === "stream" && (
          <pre ref={scrollRef} className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[var(--text-secondary)]">
            {streamOutput || (running ? t("responsePanel.waiting") : t("responsePanel.sendPrompt"))}
          </pre>
        )}

        {tab === "raw" && (
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-[var(--text-muted)]">
            {rawResponse || t("responsePanel.noRaw")}
          </pre>
        )}

        {tab === "compat" && (
          <div className="space-y-2">
            {compatResults.length === 0 && <p className="text-xs text-[var(--text-muted)]">{t("responsePanel.noCompatibility")}</p>}
            {compatResults.map((result, index) => (
              <div
                key={index}
                className="flex items-start gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-muted)] px-3 py-2"
              >
                {statusIcon(result.status)}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[var(--text-primary)]">{result.check_id}</span>
                    <span className="text-xs text-[var(--text-muted)]">{result.category}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{result.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
