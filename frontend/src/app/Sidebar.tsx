import { Link, useRouterState } from '@tanstack/react-router';
import { BarChart3, ChevronDown, ChevronRight, ClipboardCheck, Crosshair, Gauge, Layers, List, Map as MapIcon, Send, Settings, Target, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { MenuNode } from '@/api/types';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/stores/sessionStore';
import { useUiStore } from '@/stores/uiStore';

const ICONS: Record<string, LucideIcon> = {
  gauge: Gauge,
  target: Target,
  layers: Layers,
  settings: Settings,
  list: List,
  crosshair: Crosshair,
  send: Send,
  map: MapIcon,
  'clipboard-check': ClipboardCheck,
  'bar-chart': BarChart3,
};

/** Menu cấp 1 theo thứ tự & quyền từ /api/auth/me (PHẦN C §0.1) */
export function Sidebar() {
  const menu = useSessionStore((s) => s.me?.menu ?? []);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const active = (r?: string | null) => !!r && (path === r || path.startsWith(r + '/'));

  const item = (n: MenuNode, depth = 0) => {
    const Icon = ICONS[n.icon ?? ''] ?? List;
    if (n.children.length) {
      const isClosed = closed.has(n.code);
      return (
        <li key={n.code}>
          <button
            type="button"
            title={n.name}
            onClick={() => {
              const s = new Set(closed);
              if (s.has(n.code)) s.delete(n.code);
              else s.add(n.code);
              setClosed(s);
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="flex-1 truncate">{n.name}</span>}
            {!collapsed && (isClosed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
          </button>
          {!isClosed && <ul className={cn(!collapsed && 'ml-3 border-l border-border pl-1')}>{n.children.map((c) => item(c, depth + 1))}</ul>}
        </li>
      );
    }
    return (
      <li key={n.code}>
        <Link
          to={n.route ?? '/'}
          title={n.name}
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100',
            active(n.route) && 'bg-primary-soft font-semibold text-primary',
            depth > 0 && 'text-[13px]',
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="truncate">{n.name}</span>}
        </Link>
      </li>
    );
  };

  return (
    <aside className={cn('shrink-0 overflow-y-auto border-r border-border bg-white transition-all', collapsed ? 'w-14' : 'w-64')} aria-label="Menu chính">
      <nav className="p-2">
        <ul className="space-y-0.5">{menu.map((n) => item(n))}</ul>
      </nav>
    </aside>
  );
}
