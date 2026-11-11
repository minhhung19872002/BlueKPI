import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { get } from '@/api/http';
import { EP } from '@/api/endpoints';
import { FilterItem } from '@/components/data-grid/SearchBar';
import { Select } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/Misc';
import { CURRENT_YEAR } from '@/features/evaluation/components/labels';
import { cn } from '@/lib/utils';
import { ByKpiView, ByPeriodView, type Filters, ReviewView } from '../components/views';

type View = 'period' | 'kpi' | 'review';
const VIEWS: { value: View; label: string }[] = [
  { value: 'period', label: 'Theo kỳ đánh giá' },
  { value: 'kpi', label: 'Theo chỉ tiêu KPI' },
  { value: 'review', label: 'Theo dõi kết quả thẩm định và phản hồi' },
];

interface UnitsResp {
  defaultUnitId: number | null;
  units: { id: number; code: string; name: string }[];
  multiple: boolean;
}

/** Năm hiện tại: quý gần nhất đã kết thúc; năm khác: “Cả năm” */
const defaultPeriod = (year: number) => (year === new Date().getFullYear() ? ['Q1', 'Q1', 'Q2', 'Q3'][Math.floor(new Date().getMonth() / 3)] : 'Y');

/** 18.1–22.1 “KPI đơn vị của tôi” */
export function MyKpiPage() {
  const search = useSearch({ strict: false }) as { view?: string; year?: number; period?: string; unit?: number };
  const navigate = useNavigate();
  const units = useQuery({ queryKey: ['mykpi-units'], queryFn: () => get<UnitsResp>(EP.myKpi.units), staleTime: 60_000 });
  const view: View = VIEWS.some((v) => v.value === search.view) ? (search.view as View) : 'period';
  const year = search.year ?? CURRENT_YEAR;
  const f: Filters = { unitId: search.unit ?? units.data?.defaultUnitId ?? undefined, year, period: search.period ?? defaultPeriod(year) };

  const update = (p: Partial<Filters> & { view?: View }) => {
    const nextYear = p.year ?? year;
    navigate({
      to: '/my-kpi',
      search: {
        view: p.view ?? view,
        year: nextYear,
        period: p.period ?? (p.year && !search.period ? defaultPeriod(nextYear) : f.period),
        unit: p.unitId ?? search.unit,
      },
      replace: true,
    });
  };

  return (
    <div>
      <PageHeader title="KPI đơn vị của tôi" />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        {units.data?.multiple && (
          <FilterItem label="Đơn vị" width="w-72">
            <Select
              aria-label="Đơn vị"
              options={units.data.units.map((u) => ({ value: u.id, label: `${u.code} – ${u.name}` }))}
              value={f.unitId ?? ''}
              onChange={(e) => update({ unitId: Number(e.target.value) })}
            />
          </FilterItem>
        )}
        <div>
          <span className="mb-1 block text-[13px] font-medium text-slate-700">Hình thức xem</span>
          <div role="radiogroup" aria-label="Hình thức xem" className="inline-flex overflow-hidden rounded-md border border-border bg-white">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                role="radio"
                aria-checked={view === v.value}
                className={cn('border-r border-border px-3 py-1.5 text-sm last:border-r-0', view === v.value ? 'bg-primary text-white' : 'text-slate-700 hover:bg-slate-50')}
                onClick={() => update({ view: v.value })}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {units.isSuccess && (
        <>
          {view === 'period' && <ByPeriodView f={f} onChange={update} />}
          {view === 'kpi' && <ByKpiView f={f} onChange={update} />}
          {view === 'review' && <ReviewView f={f} onChange={update} />}
        </>
      )}
    </div>
  );
}
