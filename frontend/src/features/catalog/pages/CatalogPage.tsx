import { useNavigate, useSearch } from '@tanstack/react-router';
import { PageHeader, Tabs } from '@/components/ui/Misc';
import { hasPerm, useSessionStore } from '@/stores/sessionStore';
import { FormulaTab } from '../components/FormulaTab';
import { KpiTab } from '../components/KpiTab';
import { PerspectiveTab } from '../components/PerspectiveTab';
import { UomTab } from '../components/UomTab';

/** “Quản trị KPI” → “Danh mục chỉ tiêu KPI”: tab “Danh sách KPI”, “Đơn vị đo”, “Viễn cảnh”, “Định nghĩa KPI công thức” */
export function CatalogPage() {
  const me = useSessionStore((s) => s.me);
  const search = useSearch({ strict: false }) as { tab?: string };
  const navigate = useNavigate();
  const tabs = [
    { value: 'kpi', label: 'Danh sách KPI', hidden: !hasPerm(me, 'KPI:VIEW'), content: <KpiTab /> },
    { value: 'uom', label: 'Đơn vị đo', hidden: !hasPerm(me, 'UOM:VIEW'), content: <UomTab /> },
    { value: 'perspective', label: 'Viễn cảnh', hidden: !hasPerm(me, 'PERSPECTIVE:VIEW'), content: <PerspectiveTab /> },
    { value: 'formula', label: 'Định nghĩa KPI công thức', hidden: !hasPerm(me, 'FORMULA:VIEW'), content: <FormulaTab /> },
  ];
  const visible = tabs.filter((t) => !t.hidden);
  const active = visible.find((t) => t.value === search.tab)?.value ?? visible[0]?.value ?? 'kpi';
  return (
    <div>
      <PageHeader title="Danh mục chỉ tiêu KPI" />
      <Tabs value={active} onChange={(v) => navigate({ to: '/kpi-admin/catalog', search: { tab: v } })} tabs={tabs} />
    </div>
  );
}
