import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl', full: 'max-w-[96vw]' };

export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md', className }: DialogProps) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-slate-900/40" />
        <D.Content
          onPointerDownOutside={(e) => e.preventDefault()}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[95vw] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-white shadow-xl',
            sizes[size],
            className,
          )}
        >
          <div className="flex items-start justify-between border-b border-border px-5 py-3">
            <div>
              <D.Title className="text-base font-semibold text-slate-800">{title}</D.Title>
              {description ? <D.Description className="mt-0.5 text-xs text-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
            </div>
            <D.Close className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Đóng cửa sổ">
              <X className="h-4 w-4" />
            </D.Close>
          </div>
          <div className="flex-1 overflow-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Drawer bên phải (xem chi tiết chỉ đọc) */
export function Drawer({ open, onOpenChange, title, children, footer, width = 'w-[640px]' }: Omit<DialogProps, 'size'> & { width?: string }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
        <D.Content className={cn('fixed right-0 top-0 z-50 flex h-full max-w-[95vw] flex-col bg-white shadow-xl', width)}>
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <D.Title className="text-base font-semibold">{title}</D.Title>
            <D.Description className="sr-only">{title}</D.Description>
            <D.Close className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Đóng cửa sổ">
              <X className="h-4 w-4" />
            </D.Close>
          </div>
          <div className="flex-1 overflow-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
