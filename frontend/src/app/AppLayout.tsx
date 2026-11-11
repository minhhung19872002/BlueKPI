import { Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { Breadcrumb } from './Breadcrumb';
import { ErrorBoundary } from './ErrorBoundary';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const setBreadcrumb = useUiStore((s) => s.setBreadcrumb);
  useEffect(() => setBreadcrumb([]), [path, setBreadcrumb]);
  return (
    <div className="flex h-full flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-auto p-4">
          <Breadcrumb />
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
