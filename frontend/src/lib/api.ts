/**
 * API client.
 *
 * One place owns the base URL, the Authorization header, and the silent
 * access-token refresh. Everything else in the app calls `api.get/post/...`
 * and never touches fetch or localStorage directly.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

const ACCESS_KEY = "pt_access";
const REFRESH_KEY = "pt_refresh";

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[] | string>;

  constructor(
    status: number,
    detail: string,
    errors: Record<string, string[] | string> = {},
  ) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }

  /** First error message for a given field, if the server sent one. */
  fieldError(field: string): string | undefined {
    const value = this.errors?.[field];
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : String(value);
  }
}

export const tokens = {
  get access() {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(ACCESS_KEY);
    } catch {
      return null;
    }
  },
  get refresh() {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  set(access: string, refresh?: string) {
    try {
      window.localStorage.setItem(ACCESS_KEY, access);
      if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      /* private mode — the session simply won't survive a reload */
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(ACCESS_KEY);
      window.localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* ignore */
    }
  },
};

/** Concurrent 401s must trigger exactly one refresh, not one per request. */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokens.refresh;
  if (!refresh) return null;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/token/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh }),
        });
        if (!res.ok) {
          tokens.clear();
          return null;
        }
        const data = await res.json();
        tokens.set(data.access, data.refresh);
        return data.access as string;
      } catch {
        return null;
      } finally {
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }
  return refreshInFlight;
}

type Body = Record<string, unknown> | FormData | undefined;

async function request<T>(
  method: string,
  path: string,
  body?: Body,
  retry = true,
): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!isForm) headers["Content-Type"] = "application/json";

  const access = tokens.access;
  if (access) headers["Authorization"] = `Bearer ${access}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isForm ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && tokens.refresh) {
    const fresh = await refreshAccessToken();
    if (fresh) return request<T>(method, path, body, false);
  }

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { detail: text };
    }
  }

  if (!res.ok) {
    const data = (payload ?? {}) as {
      detail?: string;
      errors?: Record<string, string[] | string>;
    };
    throw new ApiError(
      res.status,
      data.detail || defaultMessage(res.status),
      data.errors || {},
    );
  }

  return payload as T;
}

function defaultMessage(status: number): string {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to do that.";
  if (status === 404) return "That could not be found.";
  if (status >= 500) return "The server had a problem. Please try again.";
  return "Something went wrong.";
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: Body) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: Body) => request<T>("PATCH", path, body),
  put: <T>(path: string, body?: Body) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

/** Build a query string, dropping empty values so URLs stay clean. */
export function qs(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      value.forEach((v) => search.append(key, String(v)));
    } else {
      search.set(key, String(value));
    }
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}
