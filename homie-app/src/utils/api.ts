const API_BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) return refreshPromise;

  isRefreshing = true;
  refreshPromise = fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  }).then((res) => {
    isRefreshing = false;
    refreshPromise = null;
    return res.ok;
  }).catch(() => {
    isRefreshing = false;
    refreshPromise = null;
    return false;
  });

  return refreshPromise;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const doFetch = () =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

  let res = await doFetch();

  // 401 → try refresh once, then retry
  if (res.status === 401 && !path.includes('/auth/')) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch();
    } else {
      // Refresh failed → redirect to login
      window.location.reload();
      throw new ApiError(401, 'Session expired');
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(res.status, text || `HTTP ${res.status}`);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return res.json();
}

import type { ZodType } from 'zod';

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),

  getWithSchema: async <T>(path: string, schema: ZodType<T>): Promise<T> => {
    const raw = await request<unknown>(path);
    return schema.parse(raw);
  },
  postWithSchema: async <T>(path: string, schema: ZodType<T>, body?: unknown): Promise<T> => {
    const raw = await request<unknown>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    return schema.parse(raw);
  },
  putWithSchema: async <T>(path: string, schema: ZodType<T>, body: unknown): Promise<T> => {
    const raw = await request<unknown>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return schema.parse(raw);
  },
  patchWithSchema: async <T>(path: string, schema: ZodType<T>, body?: unknown): Promise<T> => {
    const raw = await request<unknown>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
    return schema.parse(raw);
  },
};

export { API_BASE };
