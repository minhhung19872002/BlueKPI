import { useNavigate, useSearch } from '@tanstack/react-router';
import { ArrowLeft, Clock, Map as MapIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EP } from '@/api/endpoints';
import { ExportButton } from '@/components/import-export/ExportButton';
import { Button } from '@/components/ui/Button';
import { Label, Select } from '@/components/ui/Input';
import { Empty, PageHeader } from '@/components/ui/Misc';
import { TreeSelect } from '@/components/ui/TreeSelect';
import { errorMessage } from '@/components/ui/Toast';
import { useOrgTree } from '@/features/common/shared';
import { YEAR_OPTIONS } from '@/features/evaluation/components/labels';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useHasPerm } from '@/stores/sessionStore';
import { useDashFilters, useOverview } from '../api';
import { BscCard, CorporationsBlock, FocusArea, ProvinceStageBlock, ProvincesBlock, RankingBlock, StageChartBlock, StatCards } from '../components/Blocks';
import { CorporationTableDialog, DashStrategyMapDialog, FocusDetailDialog, KpiListDialog } from '../components/Dialogs';
import { DASH_PERIODS, GROUP, GROUP_LABEL, isStagePeriod, PROVINCES, PROVINCES_LABEL, stageIdOf, type DashParams, type Stage } from '../types';

interface DashSearch {
  unit?: string;
  year?: number;
  period?: string;
  map?: boolean;
}

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

/** 6.1 → 17.8 “Dashboard TGĐ BSC” — bộ lọc trong URL (unit/year/period), mặc định từ /dashboard/filters (17.1) */
export function DashboardPage() {
  const search = useSearch({ strict: false }) as DashSearch;
  const navigate = useNavigate();
  const filters = useDashFilters();
  const fd = filters.data;
  const tree = useOrgTree({ mine: fd ? !fd.canGroup : false });
  const canExport = useHasPerm('DASHBOARD:EXPORT');

  /** Bộ lọc hiệu lực = URL ?? mặc định; người dùng cấp đơn vị không được chọn Tập đoàn/khối tỉnh */
  const params = useMemo<DashParams | null>(() => {
    if (!fd) return null;
    let unit = search.unit ?? fd.defaults.unit;
    if ((unit === GROUP && !fd.canGroup) || (unit === PROVINCES && !fd.canProvinces)) unit = fd.defaults.unit;
    return { unit, year: search.year ?? fd.defaults.year, period: search.period ?? fd.defaults.period };
  }, [fd, search.unit, search.year, search.period]);

  const overview = useOverview(params);
  const o = overview.data;

  const [kpiDialog, setKpiDialog] = useState<{ card: string; label?: string; filters?: boolean } | null>(null);
  const [focusKpi, setFocusKpi] = useState<number | null>(null);
  const [corp, setCorp] = useState<number | null>(null);

  if (filters.isError) return <Empty text={errorMessage(filters.error, 'Không tải được bộ lọc dashboard')} />;
  if (!fd || !params) return <Empty text="Đang tải…" />;

  const stages = fd.stages;
  const stageOf = (p: string): Stage | undefined => stages.find((s) => s.id === stageIdOf(p));
  const stageForYear = (y: number) => stages.find((s) => y >= s.fromYear && y <= s.toYear);

  const go = (patch: Partial<DashSearch>) => navigate({ to: '/dashboard', search: { unit: params.unit, year: params.year, period: params.period, ...patch } });

  const changeYear = (y: number) => {
    const st = stageOf(params.period);
    if (st && (y < st.fromYear || y > st.toYear)) {
      const other = stageForYear(y);
      go({ year: y, period: other ? `GD:${other.id}` : 'Y' });
    } else go({ year: y });
  };
  const changePeriod = (p: string) => {
    const st = stageOf(p);
    if (st) go({ period: p, year: params.year >= st.fromYear && params.year <= st.toYear ? params.year : st.fromYear });
    else go({ period: p });
  };
  /** SiteMap: nút Quý → Quý I năm X (năm hiện tại → quý hiện tại = quý gần nhất đã có kết quả) */
  const toQuarter = () => {
    const cur = new Date().getFullYear();
    if (params.year === cur) {
      const d = fd.defaults.year === cur && QUARTERS.includes(fd.defaults.period) ? fd.defaults.period : `Q${Math.floor(new Date().getMonth() / 3) + 1}`;
      go({ period: d });
    } else go({ period: 'Q1' });
  };
  /** SiteMap: nút Giai đoạn → giai đoạn chứa năm hiện tại, năm hiện tại */
  const toStage = () => {
    const cur = new Date().getFullYear();
    const st = stageForYear(cur) ?? stageForYear(params.year) ?? stages[0];
    if (st) go({ period: `GD:${st.id}`, year: cur >= st.fromYear && cur <= st.toYear ? cur : st.fromYear });
  };

  const periodOptions = [...DASH_PERIODS, ...stages.map((s) => ({ value: `GD:${s.id}`, label: s.name }))];
  const extra = [...(fd.canGroup ? [{ id: GROUP, label: GROUP_LABEL }] : []), ...(fd.canProvinces ? [{ id: PROVINCES, label: PROVINCES_LABEL }] : [])];
  const stageMode = isStagePeriod(params.period);
  const viewKind = stageMode ? 'GD' : QUARTERS.includes(params.period) || params.period === 'H1' ? 'Q' : 'Y';

  const title =
    o?.mode === 'GROUP'
      ? `Biểu tổng hợp Tập đoàn – ${o.periodName}`
      : o?.mode === 'PROVINCES'
        ? `Biểu tổng hợp khối VNPT tỉnh/thành phố – ${o.periodName}`
        : o
          ? `Biểu tổng hợp đơn vị – ${o.periodName}`
          : '';
  const isProvinceUnit = o?.mode === 'UNIT' && o.unit?.unitType === 'VNPT_TINH';

  return (
    <div className="min-w-0">
      <PageHeader
        title="Dashboard TGĐ BSC"
        actions={
          <>
            {canExport && <ExportButton url={EP.dashboard.exportResults} params={{ ...params }} label="Xuất kết quả đánh giá KPI" />}
            <Button variant="outline" onClick={() => go({ map: true })}>
              <MapIcon className="h-4 w-4" />
              Xem bản đồ chiến lược
            </Button>
          </>
        }
      />

      {/* Bộ lọc (17.2) */}
      <div className="card mb-3 flex flex-wrap items-end gap-3 p-3" data-testid="dashboard-filters">
        <div className="w-72">
          <Label htmlFor="dash-unit">Đơn vị</Label>
          <TreeSelect
            id="dash-unit"
            aria-label="Đơn vị"
            nodes={tree.data ?? []}
            extraOptions={extra}
            value={params.unit}
            onChange={(v) => v !== null && v !== undefined && v !== '' && go({ unit: String(v) })}
          />
        </div>
        <div className="w-28">
          <Label htmlFor="dash-year">Năm</Label>
          <Select id="dash-year" aria-label="Năm" options={YEAR_OPTIONS} value={params.year} onChange={(e) => changeYear(Number(e.target.value))} />
        </div>
        <div className="w-52">
          <Label htmlFor="dash-period">Kỳ đánh giá</Label>
          <Select id="dash-period" aria-label="Kỳ đánh giá" options={periodOptions} value={params.period} onChange={(e) => changePeriod(e.target.value)} />
        </div>
        <div className="flex overflow-hidden rounded-md border border-border" role="group" aria-label="Xem theo">
          {(
            [
              ['Y', 'Năm', () => go({ period: 'Y' })],
              ['Q', 'Quý', toQuarter],
              ['GD', 'Giai đoạn', toStage],
            ] as const
          ).map(([k, label, fn]) => (
            <button
              key={k}
              type="button"
              aria-pressed={viewKind === k}
              onClick={fn}
              className={cn('h-9 border-r border-border px-3 text-sm last:border-r-0', viewKind === k ? 'bg-primary text-white' : 'bg-white text-slate-700 hover:bg-slate-50')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {overview.isError ? (
        <Empty text={errorMessage(overview.error, 'Không tải được số liệu dashboard')} />
      ) : !o ? (
        <Empty text="Đang tải…" />
      ) : (
        <div data-testid="dashboard-content" data-mode={o.mode} className={cn(overview.isFetching && 'opacity-70 transition-opacity')}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-800" data-testid="dashboard-title">
                {title}
              </h2>
              {o.mode === 'UNIT' && (
                <div className="mt-0.5 text-[13px] text-slate-700" data-testid="viewing">
                  Đang xem: <b>{o.unit?.name}</b> – <b>{o.periodName}</b>
                  {o.rankInGroup ? <span className="ml-2 text-muted">· Hạng trong khối: {o.rankInGroup}</span> : null}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 text-[12px] text-slate-600" data-testid="last-updated">
                <Clock className="h-3.5 w-3.5" />
                Thời điểm cập nhật mới nhất: <b>{fmtDateTime(o.lastUpdated) || '—'}</b>
              </span>
              {o.mode === 'UNIT' && fd.canGroup && (
                <Button size="sm" variant="outline" onClick={() => go({ unit: GROUP })}>
                  <ArrowLeft className="h-4 w-4" />
                  Quay lại Dashboard Tập đoàn
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_230px] gap-3">
            <StatCards o={o} onOpen={(card, label) => setKpiDialog({ card, label })} />
            <BscCard o={o} />
          </div>

          {o.stage && o.mode !== 'PROVINCES' && <StageChartBlock o={o} onPickYear={(y) => go({ year: y, period: 'Y' })} />}
          {o.stage && isProvinceUnit && o.unit && <ProvinceStageBlock unitId={o.unit.id} stageId={o.stage.id} stageName={o.stage.name} />}

          {o.mode === 'PROVINCES' && <ProvincesBlock year={params.year} period={params.period} periodName={o.periodName} onView={(r) => go({ unit: String(r.unitId) })} />}

          <FocusArea items={o.focus} onDetail={(k) => setFocusKpi(k.kpiId)} onList={() => setKpiDialog({ card: 'ALL', filters: true })} />

          {o.mode === 'GROUP' && (
            <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
              <RankingBlock year={params.year} period={params.period} onView={(r) => go({ unit: String(r.unitId) })} />
              <CorporationsBlock year={params.year} period={params.period} onPick={(r) => setCorp(r.unitId)} />
            </div>
          )}
        </div>
      )}

      {kpiDialog && <KpiListDialog params={params} card={kpiDialog.card} cardLabel={kpiDialog.label} withFilters={kpiDialog.filters} onClose={() => setKpiDialog(null)} />}
      {focusKpi !== null && <FocusDetailDialog kpiId={focusKpi} params={params} onClose={() => setFocusKpi(null)} />}
      {corp !== null && <CorporationTableDialog unitId={corp} year={params.year} period={params.period} onClose={() => setCorp(null)} />}
      {search.map && <DashStrategyMapDialog params={params} unitName={o?.unit?.name} onClose={() => go({ map: undefined })} />}
    </div>
  );
}
