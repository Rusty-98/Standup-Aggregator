export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string = 'UNKNOWN', status: number = 500) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const { timeoutMs = 6000, signal, ...restOptions } = options;
  const headers = new Headers(restOptions.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('X-Requested-With', 'XMLHttpRequest');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(endpoint, {
      ...restOptions,
      headers,
      credentials: 'include',
      signal: signal || controller.signal
    });

  if (res.status === 204) {
    return {} as T;
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) {
      const err = data.error || { message: 'An unexpected error occurred', code: 'API_ERROR' };
      throw new ApiError(err.message, err.code, res.status);
    }
    return data;
  }

    if (!res.ok) {
      throw new ApiError(`Request failed with status ${res.status}`, 'HTTP_ERROR', res.status);
    }

    return (await res.text()) as unknown as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function downloadExport(from: string, to: string, teamId?: number): Promise<void> {
  const params = new URLSearchParams({ from, to });
  if (teamId) params.set('teamId', String(teamId));
  const res = await fetch(`/api/export.xlsx?${params.toString()}`, { credentials: 'include' });
  if (!res.ok) {
    let message = `Export failed (${res.status})`;
    try {
      const data = await res.json();
      message = data?.error?.message || message;
    } catch {}
    throw new ApiError(message, 'EXPORT_FAILED', res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dailies-standups-${from}-to-${to}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
