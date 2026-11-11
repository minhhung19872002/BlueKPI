import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { get } from '@/api/http';
import type { PageResult } from '@/api/types';

/**
 * Trạng thái danh sách server-side: filter nháp (form) và filter đã áp dụng (khi nhấn “Tìm kiếm”/Enter).
 * Khi vào tab, query CSDL và hiển thị ngay.
 */
export function useListState<F extends Record<string, unknown>, T>(queryKey: string, url: string, initial: F, defaultSort?: string) {
  const [draft, setDraft] = useState<F>(initial);
  const [applied, setApplied] = useState<F>(initial);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [sort, setSort] = useState<string | undefined>(defaultSort);

  const params = { ...clean(applied), page, size, sort };
  const query = useQuery({
    queryKey: [queryKey, params],
    queryFn: () => get<PageResult<T>>(url, params),
    placeholderData: keepPreviousData,
  });

  return {
    draft,
    setDraft,
    set: <K extends keyof F>(k: K, v: F[K]) => setDraft((d) => ({ ...d, [k]: v })),
    applied,
    search: () => {
      setApplied(draft);
      setPage(1);
    },
    reset: () => {
      setDraft(initial);
      setApplied(initial);
      setPage(1);
      setSort(defaultSort);
    },
    exportParams: { ...clean(applied), sort },
    query,
    gridProps: {
      rows: query.data?.items ?? [],
      total: query.data?.total ?? 0,
      page,
      size,
      sort,
      loading: query.isFetching,
      onPageChange: setPage,
      onSizeChange: (s: number) => {
        setSize(s);
        setPage(1);
      },
      onSortChange: setSort,
    },
  };
}

export function clean<F extends Record<string, unknown>>(f: F): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v === '' || v === null || v === undefined || (Array.isArray(v) && !v.length)) continue;
    o[k] = Array.isArray(v) ? v.join(',') : v;
  }
  return o;
}
