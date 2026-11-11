import { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, createRoute, createRouter, lazyRouteComponent, Outlet, redirect } from '@tanstack/react-router';
import { AppLayout } from '@/app/AppLayout';
import { ConfirmHost } from '@/components/ui/ConfirmDialog';
import { Toaster } from '@/components/ui/Toast';
import { LoginPage } from '@/pages/LoginPage';
import { ForbiddenPage, NotFoundPage, SsoErrorPage } from '@/pages/StatusPages';
import { z } from 'zod';
import { firstRoute, requireAuth, requirePerm } from './authGuards';

/** Routing code-based (TanStack Router); trang lazy (code-splitting) */
/** Mọi search param đều tùy chọn */
function optionalSearch<T extends Record<string, unknown>>(fn: (s: Record<string, unknown>) => T) {
  return (s: Record<string, unknown>): Partial<T> => fn(s);
}

/** Dashboard: unit = GROUP | PROVINCES | id đơn vị; year 2000–2100; period = Y|Q1..Q4|H1|GD:<id giai đoạn> */
const opt = <T extends z.ZodTypeAny>(t: T) => t.optional().catch(undefined);
const dashboardSearch = z.object({
  unit: opt(z.union([z.literal('GROUP'), z.literal('PROVINCES'), z.coerce.string().regex(/^\d+$/)])),
  year: opt(z.coerce.number().int().min(2000).max(2100)),
  period: opt(z.string().regex(/^(Y|Q[1-4]|H1|GD:\d+)$/)),
  map: opt(z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])),
});

export interface RouterCtx {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterCtx>()({
  component: () => (
    <>
      <Outlet />
      <Toaster />
      <ConfirmHost />
    </>
  ),
  notFoundComponent: NotFoundPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: optionalSearch((s) => ({ redirect: typeof s.redirect === 'string' ? s.redirect : undefined, error: typeof s.error === 'string' ? s.error : undefined })),
  component: LoginPage,
});

const ssoErrorRoute = createRoute({ getParentRoute: () => rootRoute, path: '/sso-error', component: SsoErrorPage });

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  beforeLoad: ({ context, location }) => requireAuth(context.queryClient, location.href),
  component: AppLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  beforeLoad: async ({ context }) => {
    const me = await requireAuth(context.queryClient, '/');
    throw redirect({ to: firstRoute(me) });
  },
});

const forbiddenRoute = createRoute({ getParentRoute: () => appRoute, path: '/forbidden', component: ForbiddenPage });
const profileRoute = createRoute({ getParentRoute: () => appRoute, path: '/profile', component: lazyRouteComponent(() => import('@/pages/ProfilePage'), 'ProfilePage') });
const notificationsRoute = createRoute({ getParentRoute: () => appRoute, path: '/notifications', component: lazyRouteComponent(() => import('@/pages/NotificationsPage'), 'NotificationsPage') });

// ---------- Dashboard ----------
const dashboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/dashboard',
  beforeLoad: requirePerm('DASHBOARD:VIEW_GROUP', 'DASHBOARD:VIEW_UNIT', 'DASHBOARD:VIEW_PROVINCE'),
  // Tham số URL unit/year/period (PHẦN C §II) — validate bằng zod; giá trị sai bị bỏ qua (dùng mặc định 17.1)
  validateSearch: (s: Record<string, unknown>) => {
    const r = dashboardSearch.safeParse(s);
    return r.success ? r.data : {};
  },
  component: lazyRouteComponent(() => import('@/features/dashboard/pages/DashboardPage'), 'DashboardPage'),
});

// ---------- KPI đơn vị của tôi ----------
const myKpiRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/my-kpi',
  beforeLoad: requirePerm('MYKPI:VIEW'),
  validateSearch: optionalSearch((s) => ({
    view: typeof s.view === 'string' ? s.view : undefined,
    year: s.year ? Number(s.year) : undefined,
    period: typeof s.period === 'string' ? s.period : undefined,
    unit: s.unit ? Number(s.unit) : undefined,
  })),
  component: lazyRouteComponent(() => import('@/features/mykpi/pages/MyKpiPage'), 'MyKpiPage'),
});

// ---------- Quản trị KPI ----------
const catalogRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/kpi-admin/catalog',
  beforeLoad: requirePerm('KPI:VIEW', 'UOM:VIEW', 'PERSPECTIVE:VIEW', 'FORMULA:VIEW'),
  validateSearch: optionalSearch((s) => ({ tab: typeof s.tab === 'string' ? s.tab : undefined })),
  component: lazyRouteComponent(() => import('@/features/catalog/pages/CatalogPage'), 'CatalogPage'),
});
const objectivesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/kpi-admin/objectives',
  beforeLoad: requirePerm('OBJECTIVE:VIEW'),
  component: lazyRouteComponent(() => import('@/features/catalog/pages/ObjectivePage'), 'ObjectivePage'),
});
const assignmentsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/kpi-admin/assignments',
  beforeLoad: requirePerm('ASSIGN:VIEW'),
  validateSearch: optionalSearch((s) => ({ tab: typeof s.tab === 'string' ? s.tab : undefined })),
  component: lazyRouteComponent(() => import('@/features/assignment/pages/AssignmentPage'), 'AssignmentPage'),
});
const assignUnitEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/kpi-admin/assignments/unit/$id',
  beforeLoad: requirePerm('ASSIGN:CREATE', 'ASSIGN:UPDATE', 'ASSIGN:VIEW'),
  validateSearch: optionalSearch((s) => ({ mode: typeof s.mode === 'string' ? s.mode : undefined })),
  component: lazyRouteComponent(() => import('@/features/assignment/pages/AssignByUnitEditPage'), 'AssignByUnitEditPage'),
});
const assignKpiEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/kpi-admin/assignments/kpi/$kpiId/$year',
  beforeLoad: requirePerm('ASSIGN:CREATE', 'ASSIGN:UPDATE', 'ASSIGN:VIEW'),
  validateSearch: optionalSearch((s) => ({ mode: typeof s.mode === 'string' ? s.mode : undefined })),
  component: lazyRouteComponent(() => import('@/features/assignment/pages/AssignByKpiEditPage'), 'AssignByKpiEditPage'),
});
const assignAdjustRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/kpi-admin/assignments/kpi/$kpiId/$year/adjust',
  beforeLoad: requirePerm('ASSIGN:ADJUST'),
  component: lazyRouteComponent(() => import('@/features/assignment/pages/AdjustmentPage'), 'AdjustmentPage'),
});
const strategiesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/kpi-admin/strategies',
  beforeLoad: requirePerm('STRATEGY:VIEW'),
  component: lazyRouteComponent(() => import('@/features/strategy/pages/StrategyListPage'), 'StrategyListPage'),
});
const strategyEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/kpi-admin/strategies/$id',
  beforeLoad: requirePerm('STRATEGY:VIEW'),
  validateSearch: optionalSearch((s) => ({ mode: typeof s.mode === 'string' ? s.mode : undefined, year: s.year ? Number(s.year) : undefined })),
  component: lazyRouteComponent(() => import('@/features/strategy/pages/StrategyEditPage'), 'StrategyEditPage'),
});
const evaluationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/kpi-admin/evaluations',
  beforeLoad: requirePerm('EVAL:VIEW'),
  validateSearch: optionalSearch((s) => ({ tab: typeof s.tab === 'string' ? s.tab : undefined, resultId: s.resultId ? Number(s.resultId) : undefined })),
  component: lazyRouteComponent(() => import('@/features/evaluation/pages/EvaluationPage'), 'EvaluationPage'),
});
const evaluationEditRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/kpi-admin/evaluations/$evalKpiId',
  beforeLoad: requirePerm('EVAL:VIEW'),
  validateSearch: optionalSearch((s) => ({ mode: typeof s.mode === 'string' ? s.mode : undefined })),
  component: lazyRouteComponent(() => import('@/features/evaluation/pages/EvaluationEditPage'), 'EvaluationEditPage'),
});
const bscRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/kpi-admin/bsc',
  beforeLoad: requirePerm('BSC:VIEW'),
  validateSearch: optionalSearch((s) => ({ tab: typeof s.tab === 'string' ? s.tab : undefined, year: s.year ? Number(s.year) : undefined, period: typeof s.period === 'string' ? s.period : undefined })),
  component: lazyRouteComponent(() => import('@/features/bsc/pages/BscPage'), 'BscPage'),
});

// ---------- Quản trị hệ thống ----------
const systemRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/system',
  beforeLoad: requirePerm('USER:VIEW', 'ROLE:VIEW', 'PERMISSION:VIEW', 'ORG:VIEW', 'SCHEDULE:VIEW', 'SYSCONFIG:VIEW', 'AUDIT:VIEW'),
  validateSearch: optionalSearch((s) => ({ tab: typeof s.tab === 'string' ? s.tab : undefined })),
  component: lazyRouteComponent(() => import('@/features/system/pages/SystemPage'), 'SystemPage'),
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  ssoErrorRoute,
  appRoute.addChildren([
    indexRoute,
    forbiddenRoute,
    profileRoute,
    notificationsRoute,
    dashboardRoute,
    myKpiRoute,
    catalogRoute,
    objectivesRoute,
    assignmentsRoute,
    assignUnitEditRoute,
    assignKpiEditRoute,
    assignAdjustRoute,
    strategiesRoute,
    strategyEditRoute,
    evaluationsRoute,
    evaluationEditRoute,
    bscRoute,
    systemRoute,
  ]),
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({ routeTree, context: { queryClient }, defaultPreload: 'intent', defaultPendingMs: 300 });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
