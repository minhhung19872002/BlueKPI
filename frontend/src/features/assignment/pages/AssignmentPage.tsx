import { useNavigate, useSearch } from '@tanstack/react-router';
import { PageHeader, Tabs } from '@/components/ui/Misc';
import { ByKpiTab } from '../components/ByKpiTab';
import { ByUnitTab } from '../components/ByUnitTab';

/** “Giao KPI”: tab “Danh sách giao KPI theo đơn vị” (29–31.1) và “Danh sách giao KPI theo chỉ tiêu” (31.2–32) */
export function AssignmentPage() {
  const search = useSearch({ strict: false }) as { tab?: string };
  const navigate = useNavigate();
  const active = search.tab === 'kpi' ? 'kpi' : 'unit';
  return (
    <div>
      <PageHeader title="Giao KPI" />
      <Tabs
        value={active}
        onChange={(v) => navigate({ to: '/kpi-admin/assignments', search: { tab: v } })}
        tabs={[
          { value: 'unit', label: 'Danh sách giao KPI theo đơn vị', content: <ByUnitTab /> },
          { value: 'kpi', label: 'Danh sách giao KPI theo chỉ tiêu', content: <ByKpiTab /> },
        ]}
      />
    </div>
  );
}
