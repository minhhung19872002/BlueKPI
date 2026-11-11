import * as P from '@radix-ui/react-popover';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Bell } from 'lucide-react';
import { useState } from 'react';
import { get, post } from '@/api/http';
import { EP } from '@/api/endpoints';
import type { PageResult } from '@/api/types';
import { fmtRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface NotificationItem {
  id: number;
  title: string;
  content?: string;
  linkRoute?: string;
  linkParams?: string;
  isRead: boolean;
  createdAt: string;
}

/** 54.1 — badge số chưa đọc (poll 60s), dropdown mới nhất trước, nhấn → điều hướng + đánh dấu đã đọc */
export function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = useQuery({ queryKey: ['notif', 'unread'], queryFn: () => get<{ count: number }>(EP.notifications.unread), refetchInterval: 60_000 });
  const list = useQuery({
    queryKey: ['notif', 'list'],
    queryFn: () => get<PageResult<NotificationItem>>(EP.notifications.list, { page: 1, size: 10 }),
    enabled: open,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['notif'] });
  const readAll = useMutation({ mutationFn: () => post(EP.notifications.readAll), onSuccess: refresh });

  const openItem = async (n: NotificationItem) => {
    if (!n.isRead) await post(EP.notifications.read(n.id));
    refresh();
    setOpen(false);
    if (n.linkRoute) {
      let search: Record<string, unknown> = {};
      try {
        search = n.linkParams ? JSON.parse(n.linkParams) : {};
      } catch {
        search = {};
      }
      navigate({ to: n.linkRoute, search: search as never });
    }
  };

  const count = unread.data?.count ?? 0;
  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Trigger asChild>
        <button type="button" className="relative rounded-full p-2 text-white/90 hover:bg-white/10" aria-label="Thông báo" data-testid="notification-bell">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span data-testid="notification-badge" className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[11px] font-semibold leading-[18px] text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </button>
      </P.Trigger>
      <P.Portal>
        <P.Content align="end" sideOffset={6} className="z-[70] w-[380px] rounded-md border border-border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <b className="text-sm">Thông báo</b>
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => readAll.mutate()}>
              Đánh dấu tất cả đã đọc
            </button>
          </div>
          <div className="max-h-96 overflow-auto">
            {(list.data?.items ?? []).map((n) => (
              <button key={n.id} type="button" onClick={() => openItem(n)} className={cn('flex w-full gap-2 border-b border-border px-3 py-2 text-left hover:bg-slate-50', !n.isRead && 'bg-blue-50/40')} data-testid="notification-item">
                <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.isRead ? 'bg-transparent' : 'bg-primary')} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{n.title}</span>
                  {n.content && <span className="line-clamp-2 block text-xs text-slate-600">{n.content}</span>}
                  <span className="block text-[11px] text-muted">{fmtRelative(n.createdAt)}</span>
                </span>
              </button>
            ))}
            {list.data && !list.data.items.length && <div className="py-6 text-center text-sm text-muted">Không có thông báo</div>}
          </div>
          <div className="px-3 py-2 text-center">
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => {
                setOpen(false);
                navigate({ to: '/notifications' });
              }}
            >
              Xem tất cả
            </button>
          </div>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
