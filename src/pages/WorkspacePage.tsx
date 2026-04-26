import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import { Plus, Save, Send, X } from "lucide-react";
import { useI18n } from "../i18n";
import RequestBuilder from "../components/RequestBuilder";
import ResponsePanel from "../components/ResponsePanel";
import { useAppStore, type CheckResult } from "../stores/appStore";

interface StreamChunk {
  run_id: string;
  delta_text: string;
  event_type: string;
  raw_data: string;
}

interface RunDetail {
  id: string;
  status_code?: number;
  error_message?: string;
  duration_ms?: number;
  response_raw?: string;
  response_parsed?: {
    content: string;
    raw_body: string;
  };
  compat_results?: CheckResult[];
}

interface RequestErrorPayload {
  run_id: string;
  error: string;
  status_code?: number;
  raw_response?: string;
  parsed_output?: string;
}

interface Props {
  onCreateProvider: () => void;
}

export default function WorkspacePage({ onCreateProvider }: Props) {
  const { t } = useI18n();
  const {
    providers,
    selectedProviderId,
    selectedModelId,
    selectedProtocol,
    workspace,
    setSelectedProvider,
    setSelectedModel,
    setWorkspaceRequestBody,
    setWorkspaceStream,
    setWorkspaceRunState,
    setWorkspaceStreamOutput,
    setWorkspaceRawResponse,
    setWorkspaceStatusCode,
    setWorkspaceDuration,
    setWorkspaceCompatResults,
    setWorkspaceError,
    resetWorkspaceResponse,
  } = useAppStore();
  const [showSaveTestCaseDialog, setShowSaveTestCaseDialog] = useState(false);
  const [testCaseName, setTestCaseName] = useState("");
  const currentRunIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) ?? null;

  const pollRunResult = useCallback(
    async (runId: string, attemptsLeft = 40) => {
      try {
        const detail = await invoke<RunDetail | null>("get_run_detail", { runId });
        if (!detail) {
          if (attemptsLeft > 0 && currentRunIdRef.current === runId) {
            pollTimerRef.current = window.setTimeout(() => {
              void pollRunResult(runId, attemptsLeft - 1);
            }, 300);
          }
          return;
        }

        const hasFinished = Boolean(detail.response_raw || detail.error_message);
        if (!hasFinished) {
          if (attemptsLeft > 0 && currentRunIdRef.current === runId) {
            pollTimerRef.current = window.setTimeout(() => {
              void pollRunResult(runId, attemptsLeft - 1);
            }, 300);
          }
          return;
        }

        if (currentRunIdRef.current !== runId) return;

        setWorkspaceRunState(false);
        setWorkspaceStatusCode(detail.status_code ?? null);
        setWorkspaceDuration(detail.duration_ms ?? null);
        setWorkspaceRawResponse(detail.response_raw ?? detail.response_parsed?.raw_body ?? "");
        setWorkspaceCompatResults(detail.compat_results ?? []);
        setWorkspaceError(detail.error_message ?? null);
        setWorkspaceStreamOutput(detail.response_parsed?.content ?? "");

        if (pollTimerRef.current !== null) {
          window.clearTimeout(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      } catch {
        if (attemptsLeft > 0 && currentRunIdRef.current === runId) {
          pollTimerRef.current = window.setTimeout(() => {
            void pollRunResult(runId, attemptsLeft - 1);
          }, 300);
        }
      }
    },
    [
      setWorkspaceCompatResults,
      setWorkspaceDuration,
      setWorkspaceError,
      setWorkspaceRawResponse,
      setWorkspaceRunState,
      setWorkspaceStatusCode,
      setWorkspaceStreamOutput,
    ],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("newProvider") === "1") {
      onCreateProvider();
      window.history.replaceState({}, "", "/");
    }
  }, [onCreateProvider]);

  useEffect(() => {
    if (!providers.length) {
      if (selectedProviderId !== null) setSelectedProvider(null);
      if (selectedModelId !== null) setSelectedModel(null);
      return;
    }

    const provider = providers.find((item) => item.id === selectedProviderId) ?? providers[0];
    if (provider.id !== selectedProviderId) {
      setSelectedProvider(provider.id);
      return;
    }

    if (!provider.models.includes(selectedModelId ?? "")) {
      setSelectedModel(provider.models.length === 1 ? provider.models[0] : null);
    }
  }, [providers, selectedModelId, selectedProviderId, setSelectedModel, setSelectedProvider]);

  useEffect(() => {
    currentRunIdRef.current = workspace.currentRunId;
  }, [workspace.currentRunId]);

  useEffect(() => {
    if (workspace.running && workspace.currentRunId && pollTimerRef.current === null) {
      void pollRunResult(workspace.currentRunId);
    }
  }, [pollRunResult, workspace.currentRunId, workspace.running]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current !== null) {
        window.clearTimeout(pollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unlistenChunk = listen<StreamChunk>("stream-chunk", (event) => {
      if (event.payload.run_id === currentRunIdRef.current) {
        setWorkspaceStreamOutput(workspace.streamOutput + event.payload.delta_text);
      }
    });
    const unlistenDone = listen<{
      run_id: string;
      normalized_response: { content: string; raw_body: string };
      compat_results: CheckResult[];
    }>("stream-done", (event) => {
      if (event.payload.run_id === currentRunIdRef.current) {
        setWorkspaceRunState(false);
        setWorkspaceRawResponse(event.payload.normalized_response.raw_body);
        setWorkspaceCompatResults(event.payload.compat_results);
        setWorkspaceStreamOutput(event.payload.normalized_response.content);
        if (pollTimerRef.current !== null) {
          window.clearTimeout(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }
    });
    const unlistenError = listen<RequestErrorPayload>("request-error", (event) => {
      if (event.payload.run_id === currentRunIdRef.current) {
        setWorkspaceRunState(false);
        setWorkspaceStatusCode(event.payload.status_code ?? null);
        setWorkspaceRawResponse(event.payload.raw_response ?? "");
        setWorkspaceStreamOutput(event.payload.parsed_output ?? "");
        setWorkspaceError(event.payload.error);
        if (pollTimerRef.current !== null) {
          window.clearTimeout(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }
    });

    return () => {
      unlistenChunk.then((fn) => fn());
      unlistenDone.then((fn) => fn());
      unlistenError.then((fn) => fn());
    };
  }, [
    setWorkspaceCompatResults,
    setWorkspaceError,
    setWorkspaceRawResponse,
    setWorkspaceRunState,
    setWorkspaceStatusCode,
    setWorkspaceStreamOutput,
    workspace.streamOutput,
  ]);

  const handleSend = useCallback(async () => {
    if (!selectedProviderId || !selectedModelId) {
      toast.error(t("workspace.selectProviderModel"));
      return;
    }

    resetWorkspaceResponse();
    setWorkspaceRunState(true, null);

    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    try {
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(workspace.requestBody);
      } catch {
        toast.error(t("workspace.invalidJson"));
        setWorkspaceRunState(false, null);
        return;
      }
      const runId = await invoke<string>("run_single_request", {
        providerId: selectedProviderId,
        modelId: selectedModelId,
        protocol: selectedProtocol,
        body,
        stream: workspace.stream,
        testCaseId: null,
      });
      currentRunIdRef.current = runId;
      setWorkspaceRunState(true, runId);
      void pollRunResult(runId);
    } catch (runError) {
      setWorkspaceRunState(false, null);
      setWorkspaceError(String(runError));
      toast.error(String(runError));
    }
  }, [
    pollRunResult,
    resetWorkspaceResponse,
    selectedModelId,
    selectedProtocol,
    selectedProviderId,
    setWorkspaceError,
    setWorkspaceRunState,
    t,
    workspace.requestBody,
    workspace.stream,
  ]);

  const handleCancel = useCallback(async () => {
    if (workspace.currentRunId) {
      try {
        await invoke("cancel_request", { runId: workspace.currentRunId });
      } catch (cancelError) {
        toast.error(String(cancelError));
      }
    }
  }, [workspace.currentRunId]);

  const handleSaveTestCase = useCallback(async () => {
    try {
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(workspace.requestBody);
      } catch {
        toast.error(t("workspace.invalidJson"));
        return;
      }

      if (!testCaseName.trim()) {
        toast.error(t("workspace.saveTestCaseNameRequired"));
        return;
      }

      await invoke("save_test_case", {
        tc: {
          id: "",
          name: testCaseName.trim(),
          protocol: selectedProtocol,
          request_body: body,
          stream: workspace.stream,
          description: null,
          tags: [],
        },
      });
      setShowSaveTestCaseDialog(false);
      setTestCaseName("");
      toast.success(t("workspace.testCaseSaved"));
      useAppStore.getState().fetchTestCases();
    } catch (saveError) {
      toast.error(String(saveError));
    }
  }, [selectedProtocol, t, testCaseName, workspace.requestBody, workspace.stream]);

  return (
    <div className="flex h-full min-w-0 bg-[var(--bg-app)] text-[var(--text-primary)]">
      {showSaveTestCaseDialog && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--bg-overlay)] p-4 backdrop-blur-sm">
          <div className="w-[420px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-2xl shadow-[rgb(var(--shadow-strong)/0.1)]">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">{t("workspace.saveTestCaseTitle")}</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{t("workspace.saveTestCaseDescription")}</p>
            <div className="mt-4">
              <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {t("workspace.saveTestCaseName")}
              </label>
              <input
                autoFocus
                value={testCaseName}
                onChange={(event) => setTestCaseName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSaveTestCase();
                  }
                }}
                className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]"
                placeholder={t("workspace.saveTestCasePlaceholder")}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-[var(--border-default)] pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowSaveTestCaseDialog(false);
                  setTestCaseName("");
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveTestCase()}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col border-r border-[var(--border-default)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2 border-b border-[var(--border-default)] px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{t("requestBuilder.title")}</span>
            <button
              onClick={onCreateProvider}
              className="ml-auto rounded-lg p-1.5 text-[var(--text-soft)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--accent)]"
            >
              <Plus size={15} />
            </button>
          </div>
          <RequestBuilder
            provider={selectedProvider}
            requestBody={workspace.requestBody}
            setRequestBody={setWorkspaceRequestBody}
            stream={workspace.stream}
            setStream={setWorkspaceStream}
          />
          <div className="flex gap-2 border-t border-[var(--border-default)] bg-[var(--bg-muted)] px-4 py-3">
            <button
              onClick={handleSend}
              disabled={workspace.running}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={14} />
              {t("workspace.send")}
            </button>
            {workspace.running && (
              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
              >
                <X size={14} />
                {t("workspace.cancelRequest")}
              </button>
            )}
            <button
              onClick={() => {
                setTestCaseName("");
                setShowSaveTestCaseDialog(true);
              }}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-muted)]"
            >
              <Save size={14} />
              {t("workspace.saveTestCase")}
            </button>
          </div>
        </div>

        <div className="w-[440px] shrink-0 bg-[var(--bg-surface)]">
          <ResponsePanel
            running={workspace.running}
            streamOutput={workspace.streamOutput}
            rawResponse={workspace.rawResponse}
            statusCode={workspace.statusCode}
            duration={workspace.duration}
            compatResults={workspace.compatResults}
            error={workspace.error}
          />
        </div>
      </div>
    </div>
  );
}
