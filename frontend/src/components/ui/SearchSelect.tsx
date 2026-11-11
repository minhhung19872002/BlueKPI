import * as P from '@radix-ui/react-popover';
import { ChevronDown, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export interface SearchOption {
  value: number | string;
  label: string;
  sub?: string;
}

/** Select có ô tìm kiếm (KPI, cán bộ…) */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Chọn…',
  disabled,
  onSearch,
  id,
  'aria-label': ariaLabel,
  clearable = true,
}: {
  options: SearchOption[];
  value: number | string | null | undefined;
  onChange: (v: any) => void;
  placeholder?: string;
  disabled?: boolean;
  onSearch?: (kw: string) => void;
  id?: string;
  'aria-label'?: string;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [kw, setKw] = useState('');
  const list = useMemo(() => {
    if (onSearch || !kw) return options;
    const k = kw.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(k) || (o.sub ?? '').toLowerCase().includes(k));
  }, [options, kw, onSearch]);
  const cur = options.find((o) => String(o.value) === String(value ?? ''));
  return (
    <P.Root open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <P.Trigger asChild>
        <button id={id} type="button" disabled={disabled} aria-label={ariaLabel} className="flex h-9 w-full items-center justify-between rounded-md border border-border bg-white px-2.5 text-left text-sm disabled:bg-slate-50">
          <span className={cn('truncate', !cur && 'text-slate-400')}>{cur ? cur.label : placeholder}</span>
          <span className="flex items-center gap-1">
            {cur && clearable && !disabled && (
              <X
                className="h-3.5 w-3.5 text-slate-400"
                aria-label="Xóa lựa chọn"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              />
            )}
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </span>
        </button>
      </P.Trigger>
      <P.Portal>
        <P.Content align="start" sideOffset={4} className="z-[60] w-[var(--radix-popover-trigger-width)] min-w-[300px] rounded-md border border-border bg-white p-2 shadow-lg">
          <div className="relative mb-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <input
              autoFocus
              value={kw}
              onChange={(e) => {
                setKw(e.target.value);
                onSearch?.(e.target.value);
              }}
              placeholder="Tìm kiếm"
              className="h-9 w-full rounded border border-border pl-8 pr-2 text-sm focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-auto" role="listbox">
            {list.map((o) => (
              <div
                key={String(o.value)}
                role="option"
                aria-selected={String(o.value) === String(value)}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn('cursor-pointer rounded px-2 py-1.5 text-sm hover:bg-slate-100', String(o.value) === String(value) && 'bg-primary-soft text-primary')}
              >
                <div className="truncate">{o.label}</div>
                {o.sub && <div className="truncate text-xs text-muted">{o.sub}</div>}
              </div>
            ))}
            {!list.length && <div className="py-4 text-center text-sm text-muted">Không có dữ liệu</div>}
          </div>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
