import axios from "axios";
import { getSession } from "next-auth/react";
import { refreshAuthSession } from "@/lib/session-refresh";

const normalizeApiBaseUrl = (value: string) => value.replace(/\/+$/, "");
const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api");

if (process.env.NODE_ENV !== "production" && !process.env.NEXT_PUBLIC_API_URL) {
  console.warn("[api] NEXT_PUBLIC_API_URL is not set, falling back to http://localhost:8000/api");
}

export const BACKEND_AUTH_ERROR_CODE = "BACKEND_AUTH_REQUIRED";

export class BackendAuthError extends Error {
  code: string;
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "BackendAuthError";
    this.code = BACKEND_AUTH_ERROR_CODE;
    this.status = status;
  }
}

export const isBackendAuthError = (error: unknown): error is BackendAuthError =>
  error instanceof BackendAuthError ||
  (typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === BACKEND_AUTH_ERROR_CODE);

// ── Human-readable error messages ──────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  age: "Age",
  gender: "Gender",
  education_level: "Education level",
  smoking_status: "Smoking status",
  sleep_hours_per_day: "Sleep hours",
  physical_activity: "Physical activity",
  mmse_score: "MMSE",
  moca_score: "MoCA",
};

function extractApiMessage(data: unknown): string | null {
  if (data === null || data === undefined) return null;
  if (typeof data === "string") return data.trim() || null;
  if (typeof data !== "object") return null;

  const d = data as Record<string, unknown>;
  if (typeof d.detail === "string") return d.detail;
  if (typeof d.error === "string") return d.error;
  if (Array.isArray(d.non_field_errors) && d.non_field_errors[0]) {
    return String(d.non_field_errors[0]);
  }

  // DRF field validation errors, e.g. { age: ["This field is required."] }
  for (const [key, val] of Object.entries(d)) {
    const label = FIELD_LABELS[key] ?? key;
    if (Array.isArray(val) && val.length && val[0] != null) {
      return key === "non_field_errors" ? String(val[0]) : `${label}: ${val[0]}`;
    }
    if (typeof val === "string" && val.trim()) {
      return key === "non_field_errors" || key === "detail" ? val : `${label}: ${val}`;
    }
  }
  return null;
}

/** Maps any thrown error (Axios / BackendAuthError) to a user-facing Uzbek message. */
export function formatApiError(error: unknown): string {
  if (isBackendAuthError(error)) {
    return "Your session is no longer valid. You'll be redirected to sign in again.";
  }

  const err = error as { response?: { status?: number; data?: unknown }; message?: string };
  const status = err?.response?.status;

  if (status === 401) {
    return "Your session expired or could not be verified. Please sign out and sign in again with Google.";
  }

  const fromData = extractApiMessage(err?.response?.data);
  if (fromData) return fromData;

  if (status === 404) return "Not found. Please complete the questionnaire first.";
  if (status && status >= 500) return "A server error occurred. Please try again shortly.";
  if (err?.message === "Network Error") return "No internet connection. Please check your connection.";

  return "Something went wrong. Please try again.";
}

const createBackendAuthError = (status?: number) =>
  new BackendAuthError("Backend session expired. Please sign in again.", status);

// Token errors that a refresh can't fix — the session genuinely needs a fresh
// Google sign-in. When the session reports one of these, there is no point
// firing the request (it would only 401 and bounce through the retry path), so
// we fail fast with a clean auth error instead.
const TERMINAL_TOKEN_ERRORS = new Set([
  "refresh_failed",
  "missing_refresh_token",
  "token_exchange_failed",
  "token_exchange_empty",
]);

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

/** Terminal analysis states — polling stops once the report reaches one. */
const TERMINAL_ANALYSIS_STATES = new Set(["done", "partial", "failed"]);

/** Fetch the (possibly still-processing) multimodal report for an assessment. */
export async function fetchReport(patientId: number | string) {
  const res = await api.get(`/patients/${patientId}/report/`);
  return res.data;
}

/**
 * Poll the report until analysis finishes (or `maxAttempts` is hit).
 * Calls `onUpdate` after every fetch so the UI can show progressive progress.
 */
export async function pollReport(
  patientId: number | string,
  onUpdate?: (report: any) => void,
  { intervalMs = 2000, maxAttempts = 90 }: { intervalMs?: number; maxAttempts?: number } = {}
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const report = await fetchReport(patientId);
    onUpdate?.(report);
    if (TERMINAL_ANALYSIS_STATES.has(report?.analysis_status)) return report;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return fetchReport(patientId);
}

type RetryableRequest = {
  _retry?: boolean;
  headers?: Record<string, string>;
};

api.interceptors.request.use(async (config) => {
  const session = await getSession();
  if (session) {
    const backendToken = (session as any).backend_access_token;
    const tokenError = (session as any).backend_token_error as string | undefined;

    // Don't clobber a header set explicitly (e.g. by the 401 retry path).
    if (!config.headers.Authorization) {
      if (backendToken && !(tokenError && TERMINAL_TOKEN_ERRORS.has(tokenError))) {
        config.headers.Authorization = `Bearer ${backendToken}`;
      } else {
        // We have a NextAuth session but the backend access token is missing or
        // unrecoverable. Firing the request would just 401 and trigger a
        // refresh→retry storm (the infinite "GET /patients/ 401" loop). Fail
        // fast with a clean auth error so the UI can ask the user to sign in.
        throw createBackendAuthError();
      }
    }
  }

  // Let the runtime set multipart boundary for file uploads
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    delete (config.headers as Record<string, unknown>)["Content-Type"];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalConfig = (error?.config || {}) as RetryableRequest;
    const status = error?.response?.status;

    // A failure thrown by the request interceptor (fail-fast auth) is already a
    // BackendAuthError — surface it as-is, never retry it.
    if (isBackendAuthError(error)) return Promise.reject(error);

    if (status === 401 && !originalConfig._retry) {
      originalConfig._retry = true;
      // Prefer the session returned by the forced refresh; fall back to a read.
      const refreshed = (await refreshAuthSession()) as
        | { backend_access_token?: string; backend_token_error?: string }
        | undefined;
      const session = refreshed ?? (await getSession());
      const newToken = (session as any)?.backend_access_token;
      const tokenError = (session as any)?.backend_token_error;

      if (newToken && !tokenError) {
        originalConfig.headers = originalConfig.headers || {};
        originalConfig.headers.Authorization = `Bearer ${newToken}`;
        return api.request(originalConfig);
      }
      // Refresh did not yield a usable token → stop here, don't retry-storm.
      return Promise.reject(createBackendAuthError(status));
    }

    if (status === 401) return Promise.reject(createBackendAuthError(status));

    return Promise.reject(error);
  }
);
