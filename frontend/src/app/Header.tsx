import * as DM from '@radix-ui/react-dropdown-menu';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronDown, LogOut, Menu, UserCircle2 } from 'lucide-react';
import { post } from '@/api/http';
import { EP } from '@/api/endpoints';
import { useSessionStore } from '@/stores/sessionStore';
import { useUiStore } from '@/stores/uiStore';
import { NotificationBell } from './NotificationBell';

export function Header() {
  const me = useSessionStore((s) => s.me);
  const clear = useSessionStore((s) => s.clear);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const qc = useQueryClient();
  const navigate = useNavigate();

  /** 2.1 Đăng xuất: revoke refresh token, xóa cookie, clear Zustand + Query cache, SLO CAS nếu bật */
  const logout = async () => {
    let casUrl: string | undefined;
    try {
      const r = await post<{ casLogoutUrl?: string }>(EP.auth.logout);
      casUrl = r.data?.casLogoutUrl;
    } catch {
      /* vẫn đăng xuất phía client */
    }
    clear();
    qc.clear();
    if (casUrl) window.location.assign(casUrl);
    else navigate({ to: '/login' });
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-primary px-3 text-white shadow">
      <div className="flex items-center gap-2">
        <button type="button" onClick={toggle} className="rounded p-2 hover:bg-white/10" aria-label="Thu gọn menu">
          <Menu className="h-5 w-5" />
        </button>
        <img src="/favicon.svg" alt="VNPT" className="h-8 w-8 rounded bg-white/10" />
        <span className="text-base font-semibold tracking-wide">Hệ thống quản trị KPI theo BSC</span>
      </div>
      <div className="flex items-center gap-1">
        <NotificationBell />
        <DM.Root>
          <DM.Trigger asChild>
            <button type="button" className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-white/10" data-testid="user-menu">
              <UserCircle2 className="h-6 w-6" />
              <span className="max-w-48 truncate text-sm font-medium">{me?.user.fullName}</span>
              <ChevronDown className="h-4 w-4" />
            </button>
          </DM.Trigger>
          <DM.Portal>
            <DM.Content align="end" sideOffset={6} className="z-[70] min-w-52 rounded-md border border-border bg-white p-1 text-slate-800 shadow-lg">
              <div className="px-2 py-1.5 text-xs text-muted">
                {me?.user.username} — {me?.user.orgUnitName}
              </div>
              <DM.Separator className="my-1 h-px bg-border" />
              <DM.Item onSelect={() => navigate({ to: '/profile' })} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none hover:bg-slate-100">
                <UserCircle2 className="h-4 w-4" />
                Thông tin tài khoản
              </DM.Item>
              <DM.Item onSelect={logout} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-danger outline-none hover:bg-red-50">
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </DM.Item>
            </DM.Content>
          </DM.Portal>
        </DM.Root>
      </div>
    </header>
  );
}
