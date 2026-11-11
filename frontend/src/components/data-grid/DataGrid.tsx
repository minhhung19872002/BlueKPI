import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/Misc';

export interface Column<T> {
  key: string;
  header: ReactNode;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  render?: (row: T, index: number) => ReactNode;
  className?: string;
}

export interface DataGridProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (r: T) => string | number;
  total?: number;
  page?: number;
  size?: number;
  onPageChange?: (p: number) => void;
  onSizeChange?: (s: number) => void;
  sort?: string;
  onSortChange?: (s: string | undefined) => void;
  loading?: boolean;
  showStt?: boolean;
  selectable?: boolean;
  selected?: (string | number)[];
  onSelectedChange?: (keys: (string | number)[]) => void;
  isRowSelectable?: (r: T) => boolean;
  /** Dữ liệu dạng cây: hàm lấy con */
  getChildren?: (r: T) => T[] | undefined;
  defaultExpandAll?: boolean;
  emptyText?: string;
  footerRow?: ReactNode;
  title?: string;
  pagination?: boolean;
  maxHeight?: string;
  rowClassName?: (r: T) => string | undefined;
  onRowClick?: (r: T) => void;
}

const PAGE_SIZES = [10, 20, 50, 100];

/** Lưới dữ liệu dùng chung (PHẦN C §0.2): paging server, sort, STT liên tục theo trang, checkbox, tree */
export function DataGrid<T>({
  columns,
  rows,
  rowKey,
  total,
  page = 1,
  size = 20,
  onPageChange,
  onSizeChange,
  sort,
  onSortChange,
  loading,
  showStt = true,
  selectable,
  selected = [],
  onSelectedChange,
  isRowSelectable,
  getChildren,
  defaultExpandAll,
  emptyText = 'Không có dữ liệu',
  footerRow,
  title,
  pagination = true,
  maxHeight,
  rowClassName,
  onRowClick,
}: DataGridProps<T>) {
  const [expanded, setExpanded] = useState<Set<string | number>>(new Set());
  const [collapsedAll, setCollapsedAll] = useState<Set<string | number>>(new Set());
  const isOpen = (k: string | number) => (defaultExpandAll ? !collapsedAll.has(k) : expanded.has(k));
  const toggle = (k: string | number) => {
    if (defaultExpandAll) {
      const n = new Set(collapsedAll);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      setCollapsedAll(n);
    } else {
      const n = new Set(expanded);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      setExpanded(n);
    }
  };

  const selSet = useMemo(() => new Set(selected), [selected]);
  const selectableRows = rows.filter((r) => !isRowSelectable || isRowSelectable(r));
  const allChecked = selectableRows.length > 0 && selectableRows.every((r) => selSet.has(rowKey(r)));
  const someChecked = selectableRows.some((r) => selSet.has(rowKey(r)));
  const [sortField, sortDir] = (sort ?? '').split(',');
  const totalPages = Math.max(1, Math.ceil((total ?? rows.length) / size));
  const colCount = columns.length + (showStt ? 1 : 0) + (selectable ? 1 : 0);

  const clickSort = (c: Column<T>) => {
    if (!c.sortable || !onSortChange) return;
    if (sortField !== c.key) onSortChange(`${c.key},asc`);
    else if (sortDir === 'asc') onSortChange(`${c.key},desc`);
    else onSortChange(undefined);
  };

  const renderRow = (r: T, idx: number, depth: number, stt: string): ReactNode => {
    const k = rowKey(r);
    const kids = getChildren?.(r);
    const hasKids = !!kids && kids.length > 0;
    const open = isOpen(k);
    const canSel = !isRowSelectable || isRowSelectable(r);
    return (
      <Fragment key={String(k)}>
        <tr
          className={cn('border-b border-border hover:bg-slate-50', depth > 0 && 'bg-slate-50/60', rowClassName?.(r), onRowClick && 'cursor-pointer')}
          data-row-key={String(k)}
          onClick={onRowClick ? () => onRowClick(r) : undefined}
        >
          {selectable && (
            <td className="w-10 px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={canSel && selSet.has(k)}
                disabled={!canSel}
                aria-label="Chọn dòng"
                onCheckedChange={(v) => onSelectedChange?.(v ? [...selected, k] : selected.filter((x) => x !== k))}
              />
            </td>
          )}
          {showStt && <td className="w-14 px-2 py-2 text-center text-slate-500">{stt}</td>}
          {columns.map((c, ci) => (
            <td key={c.key} className={cn('px-2 py-2 align-middle', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.className)}>
              {ci === 0 && getChildren ? (
                <div className="flex items-start gap-1" style={{ paddingLeft: depth * 18 }}>
                  <button
                    type="button"
                    aria-label={open ? 'Thu gọn' : 'Mở rộng'}
                    data-testid="tree-toggle"
                    className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-200', !hasKids && 'invisible')}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(k);
                    }}
                  >
                    {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                  <div className="min-w-0 flex-1">{c.render ? c.render(r, idx) : String((r as Record<string, unknown>)[c.key] ?? '')}</div>
                </div>
              ) : c.render ? (
                c.render(r, idx)
              ) : (
                String((r as Record<string, unknown>)[c.key] ?? '')
              )}
            </td>
          ))}
        </tr>
        {hasKids && open && kids!.map((kid, i) => renderRow(kid, i, depth + 1, `${stt}.${i + 1}`))}
      </Fragment>
    );
  };

  return (
    <div className="card overflow-hidden">
      <div className={cn('relative overflow-auto', maxHeight)} style={maxHeight ? undefined : undefined}>
        <table className="w-full border-collapse text-[13px]" aria-label={title} role="table">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
            <tr>
              {selectable && (
                <th className="w-10 px-2 py-2 text-center">
                  <Checkbox
                    checked={allChecked}
                    indeterminate={!allChecked && someChecked}
                    aria-label="Chọn tất cả"
                    onCheckedChange={(v) => {
                      const keys = selectableRows.map(rowKey);
                      onSelectedChange?.(v ? [...new Set([...selected, ...keys])] : selected.filter((x) => !keys.includes(x)));
                    }}
                  />
                </th>
              )}
              {showStt && <th className="w-14 px-2 py-2 text-center font-semibold">STT</th>}
              {columns.map((c) => (
                <th
                  key={c.key}
                  style={{ width: c.width, minWidth: typeof c.width === 'number' ? c.width : undefined }}
                  className={cn('px-2 py-2 text-left font-semibold', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.sortable && 'cursor-pointer select-none hover:text-primary')}
                  onClick={() => clickSort(c)}
                  aria-sort={sortField === c.key ? (sortDir === 'desc' ? 'descending' : 'ascending') : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.header}
                    {c.sortable &&
                      (sortField === c.key ? sortDir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => renderRow(r, i, 0, String((page - 1) * (pagination ? size : 0) + i + 1)))}
            {!rows.length && !loading && (
              <tr>
                <td colSpan={colCount} className="py-10 text-center text-muted">
                  {emptyText}
                </td>
              </tr>
            )}
            {footerRow}
          </tbody>
        </table>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>
      {pagination && onPageChange && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-[13px] text-slate-600">
          <div>
            Tổng số: <b data-testid="grid-total">{total ?? rows.length}</b> bản ghi
          </div>
          <div className="flex items-center gap-2">
            <span>Số dòng/trang</span>
            <select aria-label="Số dòng mỗi trang" className="h-8 rounded border border-border px-1" value={size} onChange={(e) => onSizeChange?.(Number(e.target.value))}>
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="button" aria-label="Trang trước" className="rounded p-1 hover:bg-slate-100 disabled:opacity-40" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span>
              Trang {page}/{totalPages}
            </span>
            <button type="button" aria-label="Trang sau" className="rounded p-1 hover:bg-slate-100 disabled:opacity-40" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
