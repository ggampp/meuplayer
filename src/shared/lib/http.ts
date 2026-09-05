export async function fetchJson<T = Record<string, unknown>>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.error || 'Não foi possível carregar os dados. Tente novamente.');
  return data as T;
}
