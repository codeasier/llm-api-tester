import Editor from "@monaco-editor/react";
import Select from "../components/Select";
import { useI18n, resolveTheme } from "../i18n";
import { useAppStore, type ProviderConfig } from "../stores/appStore";

const defaultBodies: Record<string, string> = {
  openai_chat: JSON.stringify({ messages: [{ role: "user", content: "Hello" }], temperature: 0.7, max_tokens: 256 }, null, 2),
  openai_responses: JSON.stringify({ input: "Hello" , temperature: 0.7, max_output_tokens: 256 }, null, 2),
  anthropic_messages: JSON.stringify({ messages: [{ role: "user", content: "Hello" }], max_tokens: 256, temperature: 0.7 }, null, 2),
};

interface Props {
  provider: ProviderConfig | null;
  requestBody: string;
  setRequestBody: (body: string) => void;
  stream: boolean;
  setStream: (stream: boolean) => void;
}

export default function RequestBuilder({ provider, requestBody, setRequestBody, stream, setStream }: Props) {
  const { t } = useI18n();
  const { selectedProtocol, setSelectedProtocol, selectedModelId, setSelectedModel, themeMode } = useAppStore();
  const prefersDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const activeTheme = resolveTheme(themeMode, prefersDark);

  const protocols = [
    { id: "openai_chat", label: t("requestBuilder.protocolChat") },
    { id: "openai_responses", label: t("requestBuilder.protocolResponses") },
    { id: "anthropic_messages", label: t("requestBuilder.protocolAnthropic") },
  ];

  const handleProtocolChange = (protocol: string) => {
    setSelectedProtocol(protocol);
    setRequestBody(defaultBodies[protocol] ?? "{}");
  };

  const bodyObject = (() => {
    try {
      const parsed = JSON.parse(requestBody);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  })();

  const updateBody = (patch: Record<string, unknown>) => {
    const next = { ...bodyObject, ...patch };
    setRequestBody(JSON.stringify(next, null, 2));
  };

  const firstUserText = () => {
    if (selectedProtocol === "openai_responses") return String(bodyObject.input ?? "");
    const messages = Array.isArray(bodyObject.messages) ? bodyObject.messages : [];
    const first = messages[0] as Record<string, unknown> | undefined;
    return String(first?.content ?? "");
  };

  const updatePrompt = (content: string) => {
    if (selectedProtocol === "openai_responses") {
      updateBody({ input: content });
      return;
    }
    updateBody({ messages: [{ role: "user", content }] });
  };

  const numberValue = (key: string, fallback: number) => {
    const value = bodyObject[key];
    return typeof value === "number" ? value : fallback;
  };

  const tokenKey = selectedProtocol === "openai_responses" ? "max_output_tokens" : "max_tokens";
  const inputCls =
    "w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]";
  const labelCls = "mb-1 block text-xs font-medium text-[var(--text-secondary)]";

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg-surface)]">
      <div className="flex border-b border-[var(--border-default)] bg-[var(--bg-muted)] px-2">
        {protocols.map((protocol) => (
          <button
            key={protocol.id}
            onClick={() => handleProtocolChange(protocol.id)}
            className={`border-b-2 px-4 py-3 text-xs font-semibold transition ${
              selectedProtocol === protocol.id
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {protocol.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 border-b border-[var(--border-default)] bg-[var(--bg-muted)] p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t("requestBuilder.provider")}</label>
            <div className="truncate rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-secondary)] shadow-sm">
              {provider?.name ?? t("requestBuilder.selectProvider")}
            </div>
          </div>
          <div>
            <label className={labelCls}>{t("requestBuilder.model")}</label>
            <Select
              value={selectedModelId ?? ""}
              onChange={(event) => setSelectedModel(event.target.value || null)}
              options={[
                { value: "", label: t("requestBuilder.selectModel") },
                ...(provider?.models.map((model) => ({ value: model, label: model })) ?? []),
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>
              {selectedProtocol === "openai_responses" ? t("requestBuilder.input") : t("requestBuilder.userMessage")}
            </label>
            <textarea
              className={`${inputCls} h-20 resize-none`}
              value={firstUserText()}
              onChange={(event) => updatePrompt(event.target.value)}
              placeholder={t("requestBuilder.promptPlaceholder")}
            />
          </div>
          {selectedProtocol === "anthropic_messages" && (
            <div className="col-span-2">
              <label className={labelCls}>{t("requestBuilder.systemPrompt")}</label>
              <input
                className={inputCls}
                value={String(bodyObject.system ?? "")}
                onChange={(event) => updateBody({ system: event.target.value })}
                placeholder={t("requestBuilder.systemPromptPlaceholder")}
              />
            </div>
          )}
          {selectedProtocol === "openai_responses" && (
            <div className="col-span-2">
              <label className={labelCls}>{t("requestBuilder.instructions")}</label>
              <input
                className={inputCls}
                value={String(bodyObject.instructions ?? "")}
                onChange={(event) => updateBody({ instructions: event.target.value })}
                placeholder={t("requestBuilder.instructionsPlaceholder")}
              />
            </div>
          )}
          <div>
            <label className={labelCls}>{t("requestBuilder.temperature")}</label>
            <input
              type="number"
              min="0"
              max="2"
              step="0.1"
              className={inputCls}
              value={numberValue("temperature", 0.7)}
              onChange={(event) => updateBody({ temperature: Number(event.target.value) })}
            />
          </div>
          <div>
            <label className={labelCls}>{tokenKey}</label>
            <input
              type="number"
              min="1"
              className={inputCls}
              value={numberValue(tokenKey, 256)}
              onChange={(event) => updateBody({ [tokenKey]: Number(event.target.value) })}
            />
          </div>
        </div>

        <div className="text-[11px] text-[var(--text-muted)]">{t("requestBuilder.advancedHint")}</div>
        <label className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={stream}
            onChange={(event) => setStream(event.target.checked)}
            className="h-4 w-4 rounded border-[var(--border-strong)] text-indigo-600 focus:ring-indigo-500"
          />
          {t("requestBuilder.stream")}
        </label>
      </div>

      <div className="min-h-0 flex-1 bg-[var(--bg-surface)]">
        <Editor
          height="100%"
          defaultLanguage="json"
          value={requestBody}
          onChange={(value) => setRequestBody(value ?? "")}
          theme={activeTheme === "dark" ? "vs-dark" : "vs"}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 2,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
