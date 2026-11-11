import { useNavigate, useSearch } from '@tanstack/react-router';
import { PageHeader, Tabs } from '@/components/ui/Misc';
import { ByKpiTab } from '../components/ByKpiTab';
import { ReviewTab } from '../components/ReviewTab';

/** “Đánh giá KPI”: tab “Tổng hợp BSC theo chỉ tiêu KPI” và “Theo dõi kết quả thẩm định và phản hồi” */
export function EvaluationPage() {
  const search = useSearch({ strict: false }) as { tab?: string; resultId?: number };
  const navigate = useNavigate();
  const active = search.tab === 'review' || search.resultId ? 'review' : 'kpi';
  return (
    <div>
      <PageHeader title="Đánh giá KPI" />
      <Tabs
        value={active}
        onChange={(v) => navigate({ to: '/kpi-admin/evaluations', search: { tab: v } })}
        tabs={[
          { value: 'kpi', label: 'Tổng hợp BSC theo chỉ tiêu KPI', content: <ByKpiTab /> },
          { value: 'review', label: 'Theo dõi kết quả thẩm định và phản hồi', content: <ReviewTab key={search.resultId ?? 0} initialResultId={search.resultId} /> },
        ]}
      />
    </div>
  );
}
