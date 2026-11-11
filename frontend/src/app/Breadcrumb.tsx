import { Link, useRouterState } from '@tanstack/react-router';
import { ChevronRight, Home } from 'lucide-react';
import { Fragment, useMemo } from 'react';
import type { MenuNode } from '@/api/types';
import { useSessionStore } from '@/stores/sessionStore';
import { useUiStore } from '@/stores/uiStore';

/** Breadcrumb tự suy từ menu + phần bổ sung do trang đặt (uiStore) */
export function Breadcrumb() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const menu = useSessionStore((s) => s.me?.menu ?? []);
  const extra = useUiStore((s) => s.breadcrumb);
  const trail = useMemo(() => {
    const find = (ns: MenuNode[], acc: MenuNode[]): MenuNode[] | null => {
      for (const n of ns) {
        const next = [...acc, n];
        if (n.route && (path === n.route || path.startsWith(n.route + '/'))) return next;
        const c = find(n.children, next);
        if (c) return c;
      }
      return null;
    };
    return find(menu, []) ?? [];
  }, [menu, path]);

  return (
    <nav aria-label="breadcrumb" className="mb-3 flex items-center gap-1 text-[13px] text-muted">
      <Home className="h-3.5 w-3.5" />
      {trail.map((n, i) => (
        <Fragment key={n.code}>
          <ChevronRight className="h-3.5 w-3.5" />
          {n.route && (i < trail.length - 1 || extra.length) ? (
            <Link to={n.route} className="hover:text-primary">
              {n.name}
            </Link>
          ) : (
            <span className={i === trail.length - 1 && !extra.length ? 'font-medium text-slate-700' : ''}>{n.name}</span>
          )}
        </Fragment>
      ))}
      {extra.map((c, i) => (
        <Fragment key={i}>
          <ChevronRight className="h-3.5 w-3.5" />
          {c.to ? (
            <Link to={c.to} className="hover:text-primary">
              {c.label}
            </Link>
          ) : (
            <span className="font-medium text-slate-700">{c.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
