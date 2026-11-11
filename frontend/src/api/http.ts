import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from './types';

/**
 * Axios instance (PHẦN B §3.2):
 * - withCredentials + Accept-Language
 * - 401: thử refresh 1 lần rồi điều hướng đăng nhập; 403: /forbidden
 * - CSRF header X-XSRF-TOKEN từ cookie cho request ghi
 * - upload (FormData), download (blob, đọc tên file từ Content-Disposition)
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';

export const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 60_000,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  withXSRFToken: true,
});

export class ApiError extends Error {
  code: string;
  status: number;
  data: unknown;
  fieldErrors: { field: string; message: string }[];
  constructor(message: string, code: string, status: number, data: unknown, fieldErrors: { field: string; message: string }[] = []) {
    super(message);
    this.code = code;
    this.status = status;
    this.data = data;
    this.fieldErrors = fieldErrors;
  }
}

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[-.]/g, '\\$&') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

const WRITE = new Set(['post', 'put', 'delete', 'patch']);

http.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  cfg.headers.set('Accept-Language', localStorage.getItem('lang') || 'vi');
  if (WRITE.has((cfg.method || 'get').toLowerCase())) {
    const t = readCookie('XSRF-TOKEN');
    if (t) cfg.headers.set('X-XSRF-TOKEN', t);
  }
  return cfg;
});

let refreshing: Promise<boolean> | null = null;
const NO_REFRESH = ['/auth/login', '/auth/refresh', '/auth/logout'];

async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = http
      .post('/auth/refresh', null, { headers: { 'X-Skip-Auth-Redirect': '1' } })
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        setTimeout(() => (refreshing = null), 0);
      });
  }
  return refreshing;
}

export const authEvents = {
  onUnauthorized: () => {
    const here = window.location.pathname + window.location.search;
    if (!window.location.pathname.startsWith('/login')) {
      window.location.assign('/login?redirect=' + encodeURIComponent(here));
    }
  },
  onForbidden: () => {
    if (window.location.pathname !== '/forbidden') window.history.pushState({}, '', '/forbidden');
    window.dispatchEvent(new PopStateEvent('popstate'));
  },
};

http.interceptors.response.use(
  (r) => r,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const cfg = error.config as (AxiosRequestConfig & { _retried?: boolean; skipForbiddenRedirect?: boolean }) | undefined;
    const status = error.response?.status ?? 0;
    const url = cfg?.url ?? '';
    if (status === 401 && cfg && !cfg._retried && !NO_REFRESH.some((p) => url.includes(p))) {
      cfg._retried = true;
      if (await tryRefresh()) return http.request(cfg);
      authEvents.onUnauthorized();
    } else if (status === 403 && !cfg?.skipForbiddenRedirect && error.response?.data?.code === 'ERR_FORBIDDEN' && cfg?.method === 'get') {
      authEvents.onForbidden();
    }
    throw toApiError(error);
  },
);

export function toApiError(error: AxiosError<ApiResponse<unknown>>): ApiError {
  const body = error.response?.data as ApiResponse<unknown> | Blob | undefined;
  if (body && !(body instanceof Blob) && typeof body === 'object' && 'code' in body) {
    return new ApiError(body.message || 'Đã xảy ra lỗi', body.code, error.response?.status ?? 0, body.data, body.errors ?? []);
  }
  if (!error.response) return new ApiError('Không kết nối được máy chủ', 'ERR_NETWORK', 0, null);
  return new ApiError('Đã xảy ra lỗi hệ thống', 'ERR_INTERNAL', error.response.status, null);
}

/** Lấy data từ envelope */
export async function get<T>(url: string, params?: unknown): Promise<T> {
  const r = await http.get<ApiResponse<T>>(url, { params });
  return r.data.data as T;
}
export async function post<T>(url: string, body?: unknown, cfg?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const r = await http.post<ApiResponse<T>>(url, body, cfg);
  return r.data;
}
export async function put<T>(url: string, body?: unknown, cfg?: AxiosRequestConfig): Promise<ApiResponse<T>> {
  const r = await http.put<ApiResponse<T>>(url, body, cfg);
  return r.data;
}
export async function del<T>(url: string, params?: unknown): Promise<ApiResponse<T>> {
  const r = await http.delete<ApiResponse<T>>(url, { params });
  return r.data;
}

/** Upload multipart/form-data */
export async function upload<T>(url: string, form: FormData, method: 'post' | 'put' = 'post'): Promise<ApiResponse<T>> {
  const r = await http.request<ApiResponse<T>>({ url, method, data: form, headers: { 'Content-Type': 'multipart/form-data' } });
  return r.data;
}

/** Tải blob; đọc tên file từ Content-Disposition và lưu về máy */
export async function download(url: string, params?: unknown, method: 'get' | 'post' = 'get', body?: unknown): Promise<string> {
  let r;
  try {
    r = await http.request<Blob>({ url, method, params, data: body, responseType: 'blob' });
  } catch (e) {
    const err = e as ApiError;
    const resp = (e as { response?: { data?: Blob } }).response;
    if (resp?.data instanceof Blob) {
      try {
        const j = JSON.parse(await resp.data.text());
        throw new ApiError(j.message, j.code, 0, j.data);
      } catch (inner) {
        if (inner instanceof ApiError) throw inner;
      }
    }
    throw err;
  }
  const name = fileNameFrom(r.headers['content-disposition'] as string | undefined) ?? 'download.xlsx';
  saveBlob(r.data, name);
  return name;
}

export function fileNameFrom(cd?: string): string | null {
  if (!cd) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star) return decodeURIComponent(star[1].replace(/"/g, ''));
  const plain = /filename="?([^";]+)"?/i.exec(cd);
  return plain ? plain[1] : null;
}

export function saveBlob(blob: Blob, name: string) {
  const a = document.createElement('a');
  const href = URL.createObjectURL(blob);
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
