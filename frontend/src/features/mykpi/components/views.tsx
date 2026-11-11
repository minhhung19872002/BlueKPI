import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { useState } from 'react';
import { get } from '@/api/http';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { FilterItem } from '@/components/data-grid/SearchBar';
import { ExportButton } from '@/components/import-export/ExportButton';
import { Select } from '@/components/ui/Input';
import { Empty } from '@/components/ui/Misc';
import { codeName, RowActions } from '@/features/common/shared';
import { ResultDetailDrawer, ResultStatusBadge } from '@/features/evaluation/components/common';
import { PERIOD_OPTIONS, YEAR_OPTIONS } from '@/features/evaluation/components/labels';
import type { Result } from '@/features/evaluation/components/types';
import { fmtNum, fmtPct } from '@/lib/format';
import { useHasPerm } from '@/stores/sessionStore';
import { ProposeDialog } from './ProposeDialog';

export interface Filters {
  unitId?: number;
  year: number;
  period: string;
}

function YearPeriod({ f, onChange, period = true, children }: { f: Filters; onChange: (p: Partial<Filters>) => void; period?: boolean; children?: React.ReactNode }) {
  return (
    <div className="card mb-3 flex flex-wrap items-end gap-2 p-3">
      <FilterItem label="Năm" width="w-24">
        <Select aria-label="Năm" options={YEAR_OPTIONS} value={f.year} onChange={(e) => onChange({ year: Number(e.target.value) })} />
      </FilterItem>
      {period && (
        <FilterItem label="Kỳ đánh giá" width="w-44">
          <Select aria-label="Kỳ đánh giá" options={PERIOD_OPTIONS} value={f.period} onChange={(e) => onChange({ period: e.target.value })} />
        </FilterItem>
      )}
      {children}
    </div>
  );
}

/** 18.1 Xem theo kỳ đánh giá, 22.1 Xuất dữ liệu */
export function ByPeriodView({ f, onChange }: { f: Filters; onChange: (p: Partial<Filters>) => void }) {
  const canExport = useHasPerm('MYKPI:EXPORT');
  const params = { unitId: f.unitId, year: f.year, period: f.period };
  const q = useQuery({
    queryKey: ['mykpi-period', params],
    queryFn: () => get<{ rows: Result[]; bscScore: number | null; totalWeight: number | null }>(EP.myKpi.byPeriod, params),
  });
  return (
    <div>
      <YearPeriod f={f} onChange={onChange}>
        {canExport && (
          <div className="ml-auto">
            <ExportButton url={EP.myKpi.export} params={params} />
          </div>
        )}
      </YearPeriod>
      <h3 className="mb-2 text-sm font-semibold">Kết quả đánh giá KPI theo kỳ</h3>
      <DataGrid<Result>
        title="Kết quả đánh giá KPI theo kỳ"
        rows={q.data?.rows ?? []}
        loading={q.isFetching}
        pagination={false}
        showStt={false}
        rowKey={(r) => r.id}
        getChildren={(r) => r.children}
        defaultExpandAll
        columns={[
          { key: 'kpiCode', header: 'Mã – Tên tiêu chí KPI', width: 260, render: (r) => codeName(r.kpiCode, r.kpiName) },
          {
            key: 'perspectiveName',
            header: 'Viễn cảnh',
            width: 110,
            render: (r) => (
              <span className="inline-flex items-center gap-1">
                {r.perspectiveColor && <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.perspectiveColor }} />}
                {r.perspectiveName}
              </span>
            ),
          },
          { key: 'unitOfMeasureName', header: 'Đơn vị đo', width: 80 },
          { key: 'weight', header: 'Trọng số', align: 'right', width: 70, render: (r) => fmtNum(r.weight, 2) },
          { key: 'planValue', header: 'KH giao', align: 'right', width: 80, render: (r) => fmtNum(r.planValue, 2) },
          { key: 'finalResult', header: 'Kết quả thực hiện', align: 'right', width: 90, render: (r) => fmtNum(r.finalResult, 2) },
          { key: 'completionRate', header: '% TH/KH', align: 'right', width: 80, render: (r) => fmtPct(r.completionRate) },
          { key: 'score', header: 'Điểm', align: 'right', width: 60, render: (r) => fmtNum(r.score, 2) },
          { key: 'status', header: 'Trạng thái đánh giá', width: 130, render: (r) => <ResultStatusBadge status={r.status} /> },
        ]}
        footerRow={
          q.data ? (
            <tr className="border-t-2 border-border bg-slate-50 font-semibold" data-testid="bsc-footer">
              <td colSpan={7} className="px-2 py-2 text-right">
                Điểm BSC đơn vị
              </td>
              <td className="px-2 py-2 text-right" data-testid="bsc-score">
                {fmtNum(q.data.bscScore, 2)}
              </td>
              <td />
            </tr>
          ) : undefined
        }
      />
    </div>
  );
}

interface ByKpiData {
  kpi: { code: string; name: string; unitOfMeasureName?: string } | null;
  periods: { period: string; periodName: string; plan: number | null; result: number | null; rate: number | null; score: number | null; status: string | null }[];
}

/** 19.1 Xem theo chỉ tiêu KPI */
export function ByKpiView({ f, onChange }: { f: Filters; onChange: (p: Partial<Filters>) => void }) {
  const opts = useQuery({
    queryKey: ['mykpi-kpi-options', f.unitId, f.year],
    queryFn: () => get<{ id: number; code: string; name: string }[]>(EP.myKpi.kpiOptions, { unitId: f.unitId, year: f.year }),
  });
  const [picked, setPicked] = useState<string>('');
  const kpiId = picked && opts.data?.some((o) => String(o.id) === picked) ? picked : opts.data?.[0] ? String(opts.data[0].id) : '';
  const q = useQuery({
    queryKey: ['mykpi-by-kpi', f.unitId, f.year, kpiId],
    queryFn: () => get<ByKpiData>(EP.myKpi.byKpi, { unitId: f.unitId, year: f.year, kpiId }),
    enabled: !!kpiId,
  });
  const periods = PERIOD_OPTIONS.map((p) => q.data?.periods.find((x) => x.period === p.value) ?? { period: p.value, periodName: p.label, plan: null, result: null, rate: null, score: null, status: null });
  const rowsDef: { label: string; get: (p: (typeof periods)[number]) => string }[] = [
    { label: 'KH giao', get: (p) => fmtNum(p.plan, 2) },
    { label: 'Kết quả thực hiện', get: (p) => fmtNum(p.result, 2) },
    { label: '% TH/KH', get: (p) => fmtPct(p.rate) },
    { label: 'Điểm', get: (p) => fmtNum(p.score, 2) },
  ];
  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['KH giao', 'Kết quả thực hiện', '% TH/KH'] },
    grid: { left: 50, right: 50, bottom: 30, top: 40 },
    xAxis: { type: 'category', data: PERIOD_OPTIONS.map((p) => p.label) },
    yAxis: [{ type: 'value', name: q.data?.kpi?.unitOfMeasureName ?? '' }, { type: 'value', name: '%' }],
    series: [
      { name: 'KH giao', type: 'bar', data: periods.map((p) => p.plan), itemStyle: { color: '#94a3b8' } },
      { name: 'Kết quả thực hiện', type: 'bar', data: periods.map((p) => p.result), itemStyle: { color: '#2563eb' } },
      { name: '% TH/KH', type: 'line', yAxisIndex: 1, data: periods.map((p) => p.rate), itemStyle: { color: '#f59e0b' } },
    ],
  };
  return (
    <div>
      <YearPeriod f={f} onChange={onChange} period={false}>
        <FilterItem label="Tiêu chí KPI" width="w-96">
          <Select aria-label="Tiêu chí KPI" options={(opts.data ?? []).map((o) => ({ value: o.id, label: `${o.code} – ${o.name}` }))} value={kpiId} onChange={(e) => setPicked(e.target.value)} />
        </FilterItem>
      </YearPeriod>
      {!kpiId && !opts.isFetching ? (
        <Empty />
      ) : (
        <>
          <h3 className="mb-2 text-sm font-semibold">{q.data?.kpi ? codeName(q.data.kpi.code, q.data.kpi.name) : ''}</h3>
          <div className="card mb-3 overflow-auto">
            <table className="w-full text-[13px]" aria-label="Kết quả theo chỉ tiêu KPI">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-2 py-2 text-left">Chỉ tiêu</th>
                  {PERIOD_OPTIONS.map((p) => (
                    <th key={p.value} className="px-2 py-2 text-right">
                      {p.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowsDef.map((rd) => (
                  <tr key={rd.label} className="border-t border-border">
                    <td className="px-2 py-2 font-medium">{rd.label}</td>
                    {periods.map((p) => (
                      <td key={p.period} className="px-2 py-2 text-right">
                        {rd.get(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card p-2" data-testid="kpi-chart">
            <ReactECharts option={option} style={{ height: 300 }} notMerge />
          </div>
        </>
      )}
    </div>
  );
}

interface ReviewItem {
  result: Result;
  statusName?: string;
  canPropose: boolean;
}

/** 20.1 Theo dõi kết quả thẩm định và phản hồi; 21.1 Đề nghị điều chỉnh */
export function ReviewView({ f, onChange }: { f: Filters; onChange: (p: Partial<Filters>) => void }) {
  const canPropose = useHasPerm('MYKPI:PROPOSE_ADJUST');
  const params = { unitId: f.unitId, year: f.year, period: f.period };
  const q = useQuery({ queryKey: ['mykpi-review', params], queryFn: () => get<ReviewItem[]>(EP.myKpi.review, params) });
  const [view, setView] = useState<number | null>(null);
  const [propose, setPropose] = useState<number | null>(null);
  return (
    <div>
      <YearPeriod f={f} onChange={onChange} />
      <h3 className="mb-2 text-sm font-semibold">Theo dõi kết quả thẩm định và phản hồi</h3>
      <DataGrid<ReviewItem>
        title="Danh sách kết quả thẩm định"
        rows={q.data ?? []}
        loading={q.isFetching}
        pagination={false}
        rowKey={(r) => r.result.id}
        columns={[
          { key: 'kpi', header: 'Mã – Tên tiêu chí KPI', width: 260, render: (r) => codeName(r.result.kpiCode, r.result.kpiName) },
          { key: 'finalResult', header: 'Kết quả', align: 'right', width: 90, render: (r) => fmtNum(r.result.finalResult, 2) },
          { key: 'score', header: 'Điểm', align: 'right', width: 60, render: (r) => fmtNum(r.result.score, 2) },
          { key: 'status', header: 'Trạng thái đánh giá', width: 140, render: (r) => <ResultStatusBadge status={r.result.status} /> },
          { key: 'feedback', header: 'Ý kiến phản hồi', width: 200, render: (r) => <span className="line-clamp-2">{r.result.feedback}</span> },
          {
            key: 'actions',
            header: 'Thao tác',
            width: 150,
            render: (r) => (
              <RowActions
                actions={[
                  { label: 'Xem', onClick: () => setView(r.result.id) },
                  { label: 'Đề nghị điều chỉnh', onClick: () => setPropose(r.result.id), show: canPropose && r.canPropose },
                ]}
              />
            ),
          },
        ]}
      />
      {view !== null && <ResultDetailDrawer id={view} url={EP.myKpi.reviewDetail} onClose={() => setView(null)} />}
      {propose !== null && <ProposeDialog resultId={propose} onClose={() => setPropose(null)} onSaved={() => q.refetch()} />}
    </div>
  );
}
