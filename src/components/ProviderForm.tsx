import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import Select from "../components/Select";
import { useI18n } from "../i18n";

interface ProviderInitialValue {
  id?: string;
  name: string;
  base_url: string;
  headers: Record<string, string>;
  models: string[];
  key_storage: string;
}

interface Props {
  onClose: () => void;
  initial?: ProviderInitialValue;
  mode?: "create" | "edit" | "duplicate";
}

export default function ProviderForm({ onClose, initial, mode = "create" }: Props) {
  const { t } = useI18n();
  const isEdit = mode === "edit" && Boolean(initial?.id);
  const isDuplicate = mode === "duplicate";

  const [name, setName] = useState(
    isDuplicate ? `${initial?.name ?? ""} ${t("providerForm.duplicateSuffix")}`.trim() : initial?.name ?? "",
  );
  const [baseUrl, setBaseUrl] = useState(initial?.base_url ?? "https://api.openai.com");
  const [models, setModels] = useState(initial?.models.length ? initial.models : ["gpt-4o"]);
  const [newModel, setNewModel] = useState("");
  const [headersStr, setHeadersStr] = useState(
    initial?.headers ? JSON.stringify(initial.headers, null, 2) : "{}",
  );
  const [keyStorage, setKeyStorage] = useState(initial?.key_storage ?? "secure");
  const [apiKey, setApiKey] = useState("");

  const title = useMemo(() => {
    if (isEdit) return t("providerForm.editTitle");
    if (isDuplicate) return t("providerForm.duplicateTitle");
    return t("providerForm.newTitle");
  }, [isDuplicate, isEdit, t]);

  const addModel = () => {
    const trimmed = newModel.trim();
    if (!trimmed) return;
    if (models.includes(trimmed)) {
      toast.error(t("providerForm.errorDuplicateModel"));
      return;
    }
    setModels((current) => [...current, trimmed]);
    setNewModel("");
  };

  const removeModel = (index: number) => {
    setModels((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error(t("providerForm.errorNameRequired"));
      return;
    }

    if (!baseUrl.trim()) {
      toast.error(t("providerForm.errorBaseUrlRequired"));
      return;
    }

    let headers: Record<string, string>;
    try {
      headers = JSON.parse(headersStr);
    } catch {
      toast.error(t("providerForm.errorHeadersJson"));
      return;
    }

    const normalizedModels = Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)));
    if (normalizedModels.length === 0) {
      toast.error(t("providerForm.errorModelsRequired"));
      return;
    }

    try {
      if (isEdit && initial?.id) {
        await invoke("update_provider", {
          config: {
            id: initial.id,
            name: name.trim(),
            base_url: baseUrl.trim(),
            headers,
            models: normalizedModels,
            key_storage: keyStorage,
            created_at: "",
            updated_at: "",
          },
        });
        if (apiKey) {
          await invoke("store_api_key", { providerId: initial.id, key: apiKey, storage: keyStorage });
        }
        toast.success(t("providerForm.updated"));
      } else {
        const id = await invoke<string>("create_provider", {
          config: {
            id: "",
            name: name.trim(),
            base_url: baseUrl.trim(),
            headers,
            models: normalizedModels,
            key_storage: keyStorage,
            created_at: "",
            updated_at: "",
          },
        });
        if (apiKey) {
          await invoke("store_api_key", { providerId: id, key: apiKey, storage: keyStorage });
        }
        toast.success(isDuplicate ? t("providerForm.duplicated") : t("providerForm.created"));
      }
      onClose();
    } catch (error) {
      toast.error(String(error));
    }
  };

  const inputCls =
    "w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] shadow-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-ring)]";
  const labelCls = "mb-1 block text-xs font-medium text-[var(--text-secondary)]";
  const secondaryButtonCls =
    "inline-flex items-center gap-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-default)] hover:bg-[var(--bg-muted)]";

  return (
    <div className="w-[520px] rounded-2xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-5 shadow-2xl shadow-[rgb(var(--shadow-strong)/0.1)]">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">{title}</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{t("providerForm.subtitle")}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--text-soft)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text-secondary)]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className={labelCls}>{t("providerForm.name")}</label>
          <input
            className={inputCls}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("providerForm.placeholderName")}
          />
        </div>

        <div>
          <label className={labelCls}>{t("providerForm.baseUrl")}</label>
          <input className={inputCls} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
        </div>

        <div>
          <label className={labelCls}>{t("providerForm.models")}</label>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-muted)] p-3">
            <div className="mb-3 flex gap-2">
              <input
                className={inputCls}
                value={newModel}
                onChange={(event) => setNewModel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addModel();
                  }
                }}
                placeholder={t("providerForm.placeholderModel")}
              />
              <button onClick={addModel} type="button" className={secondaryButtonCls}>
                <Plus size={14} />
                {t("providerForm.add")}
              </button>
            </div>
            <div className="space-y-2">
              {models.map((model, index) => (
                <div
                  key={`${model}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2"
                >
                  <span className="font-mono text-sm text-[var(--text-secondary)]">{model}</span>
                  <button
                    type="button"
                    onClick={() => removeModel(index)}
                    className="rounded-md p-1 text-[var(--text-soft)] transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {models.length === 0 && <p className="text-sm text-[var(--text-muted)]">{t("providerForm.noModels")}</p>}
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>{t("providerForm.headers")}</label>
          <textarea
            className={`${inputCls} h-24 font-mono text-xs`}
            value={headersStr}
            onChange={(event) => setHeadersStr(event.target.value)}
          />
        </div>

        <div>
          <label className={labelCls}>{t("providerForm.apiKey")}</label>
          <input
            type="password"
            className={inputCls}
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={isEdit ? t("providerForm.apiKeyKeep") : t("providerForm.apiKeyPlaceholder")}
          />
        </div>

        <div>
          <label className={labelCls}>{t("providerForm.keyStorage")}</label>
          <Select
            value={keyStorage}
            onChange={(event) => setKeyStorage(event.target.value)}
            options={[
              { value: "secure", label: t("providerForm.keyStorageSecure") },
              { value: "memory", label: t("providerForm.keyStorageMemory") },
              { value: "none", label: t("providerForm.keyStorageNone") },
            ]}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t border-[var(--border-default)] pt-4">
        <button
          onClick={onClose}
          type="button"
          className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
        >
          {t("common.cancel")}
        </button>
        <button
          onClick={handleSave}
          type="button"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          {t("common.save")}
        </button>
      </div>
    </div>
  );
}
