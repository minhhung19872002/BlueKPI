import * as P from '@radix-ui/react-popover';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Checkbox } from './Misc';

export interface TreeNode {
  id: number | string;
  label: string;
  children?: TreeNode[];
  disabled?: boolean;
  /** dữ liệu phụ (vd mã đơn vị) để tìm kiếm */
  search?: string;
}

interface Props {
  nodes: TreeNode[];
  value: (number | string) | (number | string)[] | null;
  onChange: (v: any) => void;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Các lựa chọn đặc biệt ở đầu danh sách (vd “Khối VNPT tỉnh/thành phố”) */
  extraOptions?: { id: number | string; label: string }[];
  'aria-label'?: string;
  id?: string;
}

function flatten(nodes: TreeNode[], out = new Map<string, TreeNode>()) {
  for (const n of nodes) {
    out.set(String(n.id), n);
    if (n.children) flatten(n.children, out);
  }
  return out;
}

function filterTree(nodes: TreeNode[], kw: string): TreeNode[] {
  if (!kw) return nodes;
  const k = kw.toLowerCase();
  const res: TreeNode[] = [];
  for (const n of nodes) {
    const kids = n.children ? filterTree(n.children, kw) : [];
    if (n.label.toLowerCase().includes(k) || (n.search ?? '').toLowerCase().includes(k) || kids.length) res.push({ ...n, children: kids.length ? kids : n.children?.filter(() => false) });
  }
  return res;
}

/** TreeSelect chọn đơn vị (đơn/đa chọn, có tìm kiếm) */
export function TreeSelect({ nodes, value, onChange, multiple, placeholder = 'Chọn…', disabled, className, extraOptions, id, ...rest }: Props) {
  const [open, setOpen] = useState(false);
  const [kw, setKw] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const map = useMemo(() => flatten(nodes), [nodes]);
  const filtered = useMemo(() => filterTree(nodes, kw), [nodes, kw]);
  const selected = useMemo(() => new Set((Array.isArray(value) ? value : value === null || value === undefined || value === '' ? [] : [value]).map(String)), [value]);

  const label = (() => {
    if (!selected.size) return '';
    const ids = [...selected];
    const extra = extraOptions?.find((e) => String(e.id) === ids[0]);
    if (!multiple && extra) return extra.label;
    const names = ids.map((i) => map.get(i)?.label ?? extraOptions?.find((e) => String(e.id) === i)?.label).filter(Boolean);
    return multiple && names.length > 2 ? `${names.slice(0, 2).join(', ')} (+${names.length - 2})` : names.join(', ');
  })();

  const toggle = (nid: string) => {
    if (multiple) {
      const next = new Set(selected);
      if (next.has(nid)) next.delete(nid);
      else next.add(nid);
      onChange([...next].map((x) => (Number.isNaN(Number(x)) ? x : Number(x))));
    } else {
      onChange(Number.isNaN(Number(nid)) ? nid : Number(nid));
      setOpen(false);
    }
  };

  const renderNodes = (ns: TreeNode[], depth: number) =>
    ns.map((n) => {
      const sid = String(n.id);
      const hasKids = !!n.children?.length;
      const isCollapsed = !kw && collapsed.has(sid);
      return (
        <div key={sid}>
          <div
            className={cn('flex cursor-pointer items-center gap-1 rounded px-1 py-1 text-sm hover:bg-slate-100', selected.has(sid) && !multiple && 'bg-primary-soft text-primary', n.disabled && 'cursor-not-allowed opacity-50')}
            style={{ paddingLeft: depth * 16 + 4 }}
            role="treeitem"
            aria-selected={selected.has(sid)}
            onClick={() => !n.disabled && toggle(sid)}
          >
            <button
              type="button"
              className={cn('flex h-4 w-4 items-center justify-center text-slate-500', !hasKids && 'invisible')}
              aria-label={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
              onClick={(e) => {
                e.stopPropagation();
                const nx = new Set(collapsed);
                if (nx.has(sid)) nx.delete(sid);
                else nx.add(sid);
                setCollapsed(nx);
              }}
            >
              {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {multiple && <Checkbox checked={selected.has(sid)} onCheckedChange={() => toggle(sid)} disabled={n.disabled} aria-label={n.label} />}
            <span className="truncate">{n.label}</span>
          </div>
          {hasKids && !isCollapsed && renderNodes(n.children!, depth + 1)}
        </div>
      );
    });

  return (
    <P.Root open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <P.Trigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-label={rest['aria-label']}
          className={cn('flex h-9 w-full items-center justify-between rounded-md border border-border bg-white px-2.5 text-left text-sm disabled:bg-slate-50', className)}
        >
          <span className={cn('truncate', !label && 'text-slate-400')}>{label || placeholder}</span>
          <span className="flex items-center gap-1">
            {label && !disabled && (
              <X
                className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600"
                aria-label="Xóa lựa chọn"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(multiple ? [] : null);
                }}
              />
            )}
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </span>
        </button>
      </P.Trigger>
      <P.Portal>
        <P.Content align="start" sideOffset={4} className="z-[60] w-[var(--radix-popover-trigger-width)] min-w-[320px] rounded-md border border-border bg-white p-2 shadow-lg">
          <div className="relative mb-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <input autoFocus value={kw} onChange={(e) => setKw(e.target.value)} placeholder="Tìm theo mã hoặc tên" className="h-9 w-full rounded border border-border pl-8 pr-2 text-sm focus:outline-none" />
          </div>
          <div className="max-h-72 overflow-auto" role="tree">
            {extraOptions?.map((e) => (
              <div
                key={String(e.id)}
                role="treeitem"
                aria-selected={selected.has(String(e.id))}
                className={cn('cursor-pointer rounded px-2 py-1 text-sm font-medium hover:bg-slate-100', selected.has(String(e.id)) && 'bg-primary-soft text-primary')}
                onClick={() => toggle(String(e.id))}
              >
                {e.label}
              </div>
            ))}
            {renderNodes(filtered, 0)}
            {!filtered.length && !extraOptions?.length && <div className="py-4 text-center text-sm text-muted">Không có dữ liệu</div>}
          </div>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
