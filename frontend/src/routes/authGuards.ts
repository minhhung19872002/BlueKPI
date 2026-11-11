import { redirect } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { get } from '@/api/http';
import { EP } from '@/api/endpoints';
import type { Me, MenuNode } from '@/api/types';
import { hasPerm, useSessionStore } from '@/stores/sessionStore';

export const ME_KEY = ['auth', 'me'] as const;

export function fetchMe() {
  return get<Me>(EP.auth.me);
}

/** Guard đăng nhập: nạp /auth/me (quyền, menu); chưa đăng nhập → /login */
export async function requireAuth(qc: QueryClient, href: string) {
  try {
    const me = await qc.ensureQueryData({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: 60_000 });
    useSessionStore.getState().setMe(me);
    return me;
  } catch {
    throw redirect({ to: '/login', search: { redirect: href } });
  }
}

/** Guard quyền: thiếu quyền → trang 403 (chỉ điều hướng; backend vẫn chặn) */
export function requirePerm(...perms: string[]) {
  return () => {
    const me = useSessionStore.getState().me;
    if (!hasPerm(me, ...perms)) throw redirect({ to: '/forbidden' });
  };
}

/** Trang đầu tiên user có quyền: ưu tiên Dashboard */
export function firstRoute(me: Me): string {
  const walk = (ns: MenuNode[]): string | null => {
    for (const n of ns) {
      if (n.route) return n.route;
      const c = walk(n.children);
      if (c) return c;
    }
    return null;
  };
  if (hasPerm(me, 'DASHBOARD:VIEW_GROUP', 'DASHBOARD:VIEW_UNIT', 'DASHBOARD:VIEW_PROVINCE')) return '/dashboard';
  return walk(me.menu) ?? '/profile';
}
