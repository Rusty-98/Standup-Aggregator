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

export async function fetchApi<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('X-Requested-With', 'XMLHttpRequest');

  const res = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include'
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
}
