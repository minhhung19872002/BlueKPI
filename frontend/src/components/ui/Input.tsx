import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const base =
  'w-full rounded-md border border-border bg-white px-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-50 disabled:text-slate-500 aria-[invalid=true]:border-danger';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} className={cn(base, 'h-9', className)} {...p} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 3, ...p },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(base, 'py-2', className)} {...p} />;
});

export interface Option {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: Option[];
  placeholder?: string;
}

/** Select gốc (accessible, ổn định cho e2e) với kiểu dáng thống nhất */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, options, placeholder, ...p }, ref) {
  return (
    <select ref={ref} className={cn(base, 'h-9 pr-7', className)} {...p}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={String(o.value)} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
});

export function Label({ children, required, htmlFor, className }: { children: React.ReactNode; required?: boolean; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1 block text-[13px] font-medium text-slate-700', required && "after:ml-0.5 after:text-danger after:content-['*']", className)}>
      {children}
    </label>
  );
}

/** Nhãn + control + lỗi tại trường */
export function Field({
  label,
  required,
  error,
  children,
  className,
  htmlFor,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={className}>
      <Label required={required} htmlFor={htmlFor}>
        {label}
      </Label>
      {children}
      {error && <p className="field-error" role="alert">{error}</p>}
    </div>
  );
}

export function ReadField({ label, value, className }: { label: string; value?: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 min-h-5 break-words text-sm text-slate-800">{value === null || value === undefined || value === '' ? '—' : value}</div>
    </div>
  );
}
