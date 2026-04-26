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

interface WorkspaceState {
  requestBody: string;
  stream: boolean;
  running: boolean;
  currentRunId: string | null;
  streamOutput: string;
  rawResponse: string;
  statusCode: number | null;
  duration: number | null;
  compatResults: CheckResult[];
  error: string | null;
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
  workspace: WorkspaceState;

  fetchProviders: () => Promise<void>;
  fetchTestCases: () => Promise<void>;
  setSelectedProvider: (id: string | null) => void;
  setSelectedModel: (id: string | null) => void;
  setSelectedProtocol: (protocol: string) => void;
  setLocale: (locale: Locale) => void;
  setThemeMode: (themeMode: ThemeMode) => void;
  setWorkspaceRequestBody: (requestBody: string) => void;
  setWorkspaceStream: (stream: boolean) => void;
  setWorkspaceRunState: (running: boolean, currentRunId?: string | null) => void;
  setWorkspaceStreamOutput: (streamOutput: string) => void;
  setWorkspaceRawResponse: (rawResponse: string) => void;
  setWorkspaceStatusCode: (statusCode: number | null) => void;
  setWorkspaceDuration: (duration: number | null) => void;
  setWorkspaceCompatResults: (compatResults: CheckResult[]) => void;
  setWorkspaceError: (error: string | null) => void;
  resetWorkspaceResponse: () => void;
}

const defaultWorkspaceState = (): WorkspaceState => ({
  requestBody: "{}",
  stream: true,
  running: false,
  currentRunId: null,
  streamOutput: "",
  rawResponse: "",
  statusCode: null,
  duration: null,
  compatResults: [],
  error: null,
});

export const useAppStore = create<AppState>((set) => ({
  providers: [],
  testCases: [],
  selectedProviderId: null,
  selectedModelId: null,
  selectedProtocol: "openai_chat",
  locale: readLocale(),
  themeMode: readThemeMode(),
  loading: false,
  workspace: defaultWorkspaceState(),

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
  setWorkspaceRequestBody: (requestBody) =>
    set((state) => ({ workspace: { ...state.workspace, requestBody } })),
  setWorkspaceStream: (stream) => set((state) => ({ workspace: { ...state.workspace, stream } })),
  setWorkspaceRunState: (running, currentRunId = undefined) =>
    set((state) => ({
      workspace: {
        ...state.workspace,
        running,
        currentRunId: currentRunId === undefined ? state.workspace.currentRunId : currentRunId,
      },
    })),
  setWorkspaceStreamOutput: (streamOutput) =>
    set((state) => ({ workspace: { ...state.workspace, streamOutput } })),
  setWorkspaceRawResponse: (rawResponse) =>
    set((state) => ({ workspace: { ...state.workspace, rawResponse } })),
  setWorkspaceStatusCode: (statusCode) =>
    set((state) => ({ workspace: { ...state.workspace, statusCode } })),
  setWorkspaceDuration: (duration) =>
    set((state) => ({ workspace: { ...state.workspace, duration } })),
  setWorkspaceCompatResults: (compatResults) =>
    set((state) => ({ workspace: { ...state.workspace, compatResults } })),
  setWorkspaceError: (error) => set((state) => ({ workspace: { ...state.workspace, error } })),
  resetWorkspaceResponse: () =>
    set((state) => ({
      workspace: {
        ...state.workspace,
        running: false,
        currentRunId: null,
        streamOutput: "",
        rawResponse: "",
        statusCode: null,
        duration: null,
        compatResults: [],
        error: null,
      },
    })),
}));
