import { create } from 'zustand';
import type { Me } from '@/api/types';

/** Session hiển thị (nguồn quyết định quyền vẫn là backend) */
interface SessionState {
  me: Me | null;
  setMe: (me: Me | null) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  me: null,
  setMe: (me) => set({ me }),
  clear: () => set({ me: null }),
}));

export function hasPerm(me: Me | null | undefined, ...perms: string[]): boolean {
  if (!me) return false;
  return perms.some((p) => me.permissions.includes(p));
}

export function useHasPerm(...perms: string[]): boolean {
  const me = useSessionStore((s) => s.me);
  return hasPerm(me, ...perms);
}
