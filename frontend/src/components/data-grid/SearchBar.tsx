import { RotateCcw, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/** Ô tìm kiếm + bộ lọc + “Tìm kiếm” / “Làm mới”; Enter cũng tìm (PHẦN C §0.2) */
export function SearchBar({
  keyword,
  onKeywordChange,
  placeholder = 'Nhập từ khóa tìm kiếm',
  onSearch,
  onReset,
  children,
  actions,
}: {
  keyword?: string;
  onKeywordChange?: (v: string) => void;
  placeholder?: string;
  onSearch: () => void;
  onReset: () => void;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="card mb-3 p-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSearch();
        }}
      >
        {onKeywordChange && (
          <div className="w-72">
            <label className="mb-1 block text-[13px] font-medium text-slate-700" htmlFor="kw">
              Từ khóa
            </label>
            <Input id="kw" value={keyword ?? ''} onChange={(e) => onKeywordChange(e.target.value)} placeholder={placeholder} aria-label="Từ khóa tìm kiếm" />
          </div>
        )}
        {children}
        <div className="flex gap-2">
          <Button type="submit">
            <Search className="h-4 w-4" />
            Tìm kiếm
          </Button>
          <Button type="button" variant="outline" onClick={onReset}>
            <RotateCcw className="h-4 w-4" />
            Làm mới
          </Button>
        </div>
        {actions && <div className="ml-auto flex flex-wrap gap-2">{actions}</div>}
      </form>
    </div>
  );
}

export function FilterItem({ label, children, width = 'w-48' }: { label: string; children: ReactNode; width?: string }) {
  return (
    <div className={width}>
      <span className="mb-1 block text-[13px] font-medium text-slate-700">{label}</span>
      {children}
    </div>
  );
}
