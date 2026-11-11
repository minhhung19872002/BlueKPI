import { create } from 'zustand';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}
interface ConfirmState {
  open: boolean;
  opts: ConfirmOptions | null;
  resolve: ((v: boolean) => void) | null;
  ask: (o: ConfirmOptions) => Promise<boolean>;
  close: (v: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  opts: null,
  resolve: null,
  ask: (opts) => new Promise<boolean>((resolve) => set({ open: true, opts, resolve })),
  close: (v) => {
    get().resolve?.(v);
    set({ open: false, resolve: null });
  },
}));

/** await confirm({ title: 'Xác nhận xóa', message: ... }) */
export function confirm(o: ConfirmOptions) {
  return useConfirmStore.getState().ask(o);
}

export function confirmDelete(name: string, extra?: ReactNode) {
  return confirm({
    title: 'Xác nhận xóa',
    message: (
      <>
        Bạn có chắc chắn muốn xóa <b>{name}</b>?{extra}
      </>
    ),
    confirmText: 'Xác nhận',
    danger: true,
  });
}

export function ConfirmHost() {
  const { open, opts, close } = useConfirmStore();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && close(false)}
      title={opts?.title ?? 'Xác nhận'}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => close(false)}>
            {opts?.cancelText ?? 'Hủy'}
          </Button>
          <Button variant={opts?.danger ? 'danger' : 'primary'} onClick={() => close(true)} data-testid="confirm-ok">
            {opts?.confirmText ?? 'Xác nhận'}
          </Button>
        </>
      }
    >
      <div className="text-sm text-slate-700">{opts?.message}</div>
    </Dialog>
  );
}
