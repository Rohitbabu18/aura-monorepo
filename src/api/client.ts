import { makeUrl } from './urls';

export type ApiResponse<T> = {
  data: T | null;
  status: number;
};

export type ApiError = Error & {
  status?: number;
  data?: unknown;
};

export type ApiRequestOptions = {
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

const defaultHeaders: HeadersInit = {
  'Content-Type': 'application/json',
};

const parseResponseBody = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export const apiRequest = async <T = unknown>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> => {
  const { method = 'GET', body, headers, signal } = options;
  const response = await fetch(makeUrl(path), {
    method,
    headers: { ...defaultHeaders, ...headers },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const data = (await parseResponseBody(response)) as T | null;

  if (!response.ok) {
    const message =
      (data as { message?: string } | null)?.message ||
      response.statusText ||
      'Request failed';
    const error = new Error(message) as ApiError;
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return { data, status: response.status };
};

export const apiClient = {
  get: <T = unknown>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  patch: <T = unknown>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions
  ) => apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T = unknown>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
