import * as CB from '@radix-ui/react-checkbox';
import * as SW from '@radix-ui/react-switch';
import * as RG from '@radix-ui/react-radio-group';
import * as TB from '@radix-ui/react-tabs';
import { Check, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  indeterminate,
  label,
  'aria-label': ariaLabel,
  id,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  indeterminate?: boolean;
  label?: ReactNode;
  'aria-label'?: string;
  id?: string;
}) {
  const box = (
    <CB.Root
      id={id}
      checked={indeterminate ? 'indeterminate' : checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      disabled={disabled}
      aria-label={ariaLabel}
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-400 bg-white data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary disabled:opacity-50"
    >
      <CB.Indicator className="text-white">{indeterminate ? <Minus className="h-3 w-3" /> : <Check className="h-3 w-3" />}</CB.Indicator>
    </CB.Root>
  );
  if (!label) return box;
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      {box}
      {label}
    </label>
  );
}

export function Switch({ checked, onCheckedChange, disabled, label, id }: { checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean; label?: string; id?: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <SW.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
        className="relative h-5 w-9 rounded-full bg-slate-300 transition-colors data-[state=checked]:bg-primary disabled:opacity-50"
      >
        <SW.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
      </SW.Root>
      {label && <span>{label}</span>}
    </label>
  );
}

export function RadioGroup({ value, onChange, options, disabled, name }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; disabled?: boolean; name?: string }) {
  return (
    <RG.Root value={value} onValueChange={onChange} disabled={disabled} className="flex flex-wrap gap-4" aria-label={name}>
      {options.map((o) => (
        <label key={o.value} className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <RG.Item value={o.value} aria-label={o.label} className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 bg-white data-[state=checked]:border-primary">
            <RG.Indicator className="h-2 w-2 rounded-full bg-primary" />
          </RG.Item>
          {o.label}
        </label>
      ))}
    </RG.Root>
  );
}

export interface TabDef {
  value: string;
  label: string;
  content: ReactNode;
  hidden?: boolean;
}

export function Tabs({ value, onChange, tabs, right }: { value: string; onChange: (v: string) => void; tabs: TabDef[]; right?: ReactNode }) {
  const visible = tabs.filter((t) => !t.hidden);
  return (
    <TB.Root value={value} onValueChange={onChange}>
      <div className="flex items-end justify-between border-b border-border">
        <TB.List className="flex gap-1">
          {visible.map((t) => (
            <TB.Trigger
              key={t.value}
              value={t.value}
              className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 data-[state=active]:border-primary data-[state=active]:text-primary"
            >
              {t.label}
            </TB.Trigger>
          ))}
        </TB.List>
        {right}
      </div>
      {visible.map((t) => (
        <TB.Content key={t.value} value={t.value} className="pt-3 outline-none">
          {t.content}
        </TB.Content>
      ))}
    </TB.Root>
  );
}

const badgeColors: Record<string, string> = {
  green: 'bg-green-50 text-green-700 ring-green-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  slate: 'bg-slate-100 text-slate-700 ring-slate-500/20',
  purple: 'bg-purple-50 text-purple-700 ring-purple-600/20',
};

export function Badge({ color = 'slate', children }: { color?: keyof typeof badgeColors; children: ReactNode }) {
  return <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset', badgeColors[color])}>{children}</span>;
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('card', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h1 className="page-title">{title}</h1>
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export function Empty({ text = 'Không có dữ liệu' }: { text?: string }) {
  return <div className="py-8 text-center text-sm text-muted">{text}</div>;
}
