import * as T from '@radix-ui/react-toast';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { create } from 'zustand';
import { cn } from '@/lib/utils';

type Kind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: Kind;
  message: string;
}
interface ToastState {
  items: ToastItem[];
  push: (kind: Kind, message: string) => void;
  remove: (id: number) => void;
}

let seq = 1;
const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (kind, message) => set((s) => ({ items: [...s.items.slice(-4), { id: seq++, kind, message }] })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

/** toast.success('Thêm mới thành công') — thông báo tiếng Việt (CLAUDE.md §4.7) */
export const toast = {
  success: (m: string) => useToastStore.getState().push('success', m),
  error: (m: string) => useToastStore.getState().push('error', m),
  info: (m: string) => useToastStore.getState().push('info', m),
};

export function errorMessage(e: unknown, fallback = 'Thao tác không thành công'): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message || fallback;
  }
  return fallback;
}

export function Toaster() {
  const items = useToastStore((s) => s.items);
  const remove = useToastStore((s) => s.remove);
  return (
    <T.Provider swipeDirection="right" duration={4000}>
      {items.map((t) => (
        <T.Root
          key={t.id}
          onOpenChange={(o) => !o && remove(t.id)}
          duration={t.kind === 'error' ? 7000 : 4000}
          data-testid={`toast-${t.kind}`}
          className={cn(
            'flex items-start gap-2 rounded-md border bg-white px-4 py-3 shadow-lg',
            t.kind === 'success' && 'border-green-300',
            t.kind === 'error' && 'border-red-300',
            t.kind === 'info' && 'border-blue-300',
          )}
        >
          {t.kind === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
          {t.kind === 'error' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
          {t.kind === 'info' && <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
          <T.Description className="flex-1 text-sm text-slate-800">{t.message}</T.Description>
          <T.Close aria-label="Đóng" className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </T.Close>
        </T.Root>
      ))}
      <T.Viewport className="fixed right-4 top-16 z-[100] flex w-[380px] max-w-[90vw] flex-col gap-2 outline-none" />
    </T.Provider>
  );
}
