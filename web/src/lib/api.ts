import { API_URL } from "./config";
import { getIdToken, clearTokens } from "./tokens";

async function authHeaders(): Promise<HeadersInit> {
  const t = getIdToken();
  if (!t) return {};
  return { Authorization: `Bearer ${t}` };
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `${API_URL}${path}`;
  const headers = new Headers(init.headers);
  const ah = await authHeaders();
  if (typeof ah === "object" && ah !== null && !Array.isArray(ah)) {
    Object.entries(ah).forEach(([k, v]) => headers.set(k, v));
  }
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) clearTokens();
  return res;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}
