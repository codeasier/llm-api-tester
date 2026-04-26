import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import {
  persistLocale,
  persistThemeMode,
  readLocale,
  readThemeMode,
  type Locale,
  type ThemeMode,
} from "./preferences";

export type { Locale, ThemeMode } from "./preferences";

export interface ProviderConfig {
  id: string;
  name: string;
  base_url: string;
  headers: Record<string, string>;
  models: string[];
  key_storage: "secure" | "memory" | "none";
  created_at: string;
  updated_at: string;
}

export interface TestCase {
  id: string;
  name: string;
  protocol: string;
  request_body: Record<string, unknown>;
  stream: boolean;
  description?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface CheckResult {
  check_id: string;
  category: string;
  status: "pass" | "fail" | "warn";
  reason: string;
}

export interface RunHistorySummary {
  id: string;
  provider_id: string;
  model_id: string;
  protocol: string;
  status_code?: number;
  duration_ms?: number;
  stream: boolean;
  pass_count: number;
  fail_count: number;
  warn_count: number;
  created_at: string;
}

interface AppState {
  providers: ProviderConfig[];
  testCases: TestCase[];
  selectedProviderId: string | null;
  selectedModelId: string | null;
  selectedProtocol: string;
  locale: Locale;
  themeMode: ThemeMode;
  loading: boolean;

  fetchProviders: () => Promise<void>;
  fetchTestCases: () => Promise<void>;
  setSelectedProvider: (id: string | null) => void;
  setSelectedModel: (id: string | null) => void;
  setSelectedProtocol: (protocol: string) => void;
  setLocale: (locale: Locale) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
}

export const useAppStore = create<AppState>((set) => ({
  providers: [],
  testCases: [],
  selectedProviderId: null,
  selectedModelId: null,
  selectedProtocol: "openai_chat",
  locale: readLocale(),
  themeMode: readThemeMode(),
  loading: false,

  fetchProviders: async () => {
    const providers = await invoke<ProviderConfig[]>("list_providers");
    set({ providers });
  },

  fetchTestCases: async () => {
    const testCases = await invoke<TestCase[]>("list_test_cases");
    set({ testCases });
  },

  setSelectedProvider: (id) => set({ selectedProviderId: id, selectedModelId: null }),
  setSelectedModel: (id) => set({ selectedModelId: id }),
  setSelectedProtocol: (protocol) => set({ selectedProtocol: protocol }),
  setLocale: (locale) => {
    persistLocale(locale);
    set({ locale });
  },
  setThemeMode: (themeMode) => {
    persistThemeMode(themeMode);
    set({ themeMode });
  },
}));
