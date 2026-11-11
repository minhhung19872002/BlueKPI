import { ReactFlowProvider } from '@xyflow/react';
import { Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { ExportButton } from '@/components/import-export/ExportButton';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, ReadField, Select } from '@/components/ui/Input';
import { Empty } from '@/components/ui/Misc';
import { usePerspectives } from '@/features/catalog/hooks';
import { StrategyMap } from '@/features/strategy/components/StrategyMap';
import type { MapKpi, MapNode, ObjectiveKpi } from '@/features/strategy/types';
import { fmtNum, fmtPct } from '@/lib/format';
import { useHasPerm } from '@/stores/sessionStore';
import { useBreakdown, useCorporationTable, useDashStrategyMap, useKpiList } from '../api';
import { ratingColor, RATING_LABEL, type BreakdownRow, type DashParams, type KpiRow, type RankRow } from '../types';

const CloseBtn = ({ onClose }: { onClose: () => void }) => (
  <Button variant="outline" onClick={onClose}>
    Đóng
  </Button>
);

export function RatingDot({ rating }: { rating?: string | null }) {
  if (!rating) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[12px]" data-rating={rating}>
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ratingColor(rating) }} />
      {RATING_LABEL[rating] ?? rating}
    </span>
  );
}

/** Cột chung 17.3 / 17.4 */
const KPI_COLUMNS = [
  { key: 'kpiCode', header: 'Mã KPI', width: 90 },
  { key: 'kpiName', header: 'Tên chỉ tiêu KPI', width: 260 },
  { key: 'perspectiveName', header: 'Viễn cảnh', width: 110 },
  { key: 'finalResult', header: 'TH kỳ đánh giá', width: 100, align: 'right' as const, render: (r: KpiRow) => fmtNum(r.finalResult, 2) },
  { key: 'completionRate', header: '% TH/KH kỳ', width: 90, align: 'right' as const, render: (r: KpiRow) => fmtPct(r.completionRate) },
  { key: 'yearCompletionRate', header: '% TH/KH năm', width: 95, align: 'right' as const, render: (r: KpiRow) => fmtPct(r.yearCompletionRate) },
  { key: 'score', header: 'Điểm đánh giá', width: 90, align: 'right' as const, render: (r: KpiRow) => fmtNum(r.score, 2) },
  {
    key: 'bscScore',
    header: 'Điểm BSC (thang 5)',
    width: 110,
    align: 'right' as const,
    render: (r: KpiRow) => (
      <span className="inline-flex items-center gap-1.5" title={r.ratingName ?? RATING_LABEL[r.rating]}>
        {fmtNum(r.bscScore, 2)}
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: ratingColor(r.rating) }} />
      </span>
    ),
  },
];

/** 17.3 (thẻ thống kê) / 17.4 (đầy đủ, có tìm kiếm + lọc viễn cảnh) — dialog “Danh Sách Chi Tiết Các KPI” */
export function KpiListDialog({ params, card, cardLabel, withFilters, onClose }: { params: DashParams; card: string; cardLabel?: string; withFilters?: boolean; onClose: () => void }) {
  const [kwInput, setKwInput] = useState('');
  const [kw, setKw] = useState('');
  const [perspectiveId, setPerspectiveId] = useState<number | null>(null);
  const persp = usePerspectives();
  const q = useKpiList(params, card, kw, perspectiveId, true);
  const rows = q.data ?? [];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Danh Sách Chi Tiết Các KPI" description={cardLabel} size="xl" footer={<CloseBtn onClose={onClose} />}>
      {withFilters && (
        <form
          className="mb-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setKw(kwInput.trim());
          }}
        >
          <div className="relative w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input aria-label="Từ khóa tìm kiếm" placeholder="Tìm theo mã hoặc tên KPI" className="pl-8" value={kwInput} onChange={(e) => setKwInput(e.target.value)} />
          </div>
          <Select
            aria-label="Viễn cảnh"
            className="w-48"
            placeholder="Tất cả viễn cảnh"
            options={(persp.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            value={perspectiveId ?? ''}
            onChange={(e) => setPerspectiveId(e.target.value ? Number(e.target.value) : null)}
          />
          <Button type="submit">Tìm kiếm</Button>
          <Button
            variant="outline"
            onClick={() => {
              setKwInput('');
              setKw('');
              setPerspectiveId(null);
            }}
          >
            Làm mới
          </Button>
        </form>
      )}
      <DataGrid<KpiRow> title="Danh Sách Chi Tiết Các KPI" rows={rows} loading={q.isFetching} rowKey={(r) => r.kpiId} pagination={false} maxHeight="max-h-[55vh]" columns={KPI_COLUMNS} />
      <div className="mt-2 text-[13px] text-slate-600">
        Tổng số: <b data-testid="kpi-list-total">{q.isFetching ? '…' : rows.length}</b> KPI
      </div>
    </Dialog>
  );
}

/** 17.5 Xem chi tiết KPI trọng tâm */
export function FocusDetailDialog({ kpiId, params, onClose }: { kpiId: number; params: DashParams; onClose: () => void }) {
  const q = useBreakdown(kpiId, params);
  const d = q.data;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Chi tiết KPI trọng tâm" size="xl" footer={<CloseBtn onClose={onClose} />}>
      {!d ? (
        <Empty text={q.isError ? 'Không tải được dữ liệu' : 'Đang tải…'} />
      ) : (
        <div className="space-y-4" data-testid="focus-detail">
          <div className="grid grid-cols-3 gap-3">
            <ReadField label="Mã KPI" value={d.kpi.kpiCode} />
            <ReadField label="Tên KPI" value={d.kpi.kpiName} className="col-span-2" />
            <ReadField label="Viễn cảnh" value={d.kpi.perspectiveName} />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              ['KH năm', fmtNum(d.kpi.yearPlanValue, 2)],
              ['KH giao kỳ', fmtNum(d.kpi.planValue, 2)],
              ['TH kỳ đánh giá', fmtNum(d.kpi.finalResult, 2)],
              ['Điểm BSC chỉ tiêu', fmtNum(d.kpi.bscScore, 2)],
            ].map(([l, v]) => (
              <div key={l} className="rounded-md border border-border bg-slate-50 px-3 py-2">
                <div className="text-xs text-muted">{l}</div>
                <div className="text-base font-semibold text-slate-800">{v || '—'}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold">Chi tiết phân rã kết quả các đơn vị con cùng được giao KPI</h4>
              <span className="text-[13px] text-slate-600" data-testid="child-count">
                Có <b>{d.assignedCount}</b>/<b>{d.childCount}</b> số đơn vị trực thuộc được giao KPI
              </span>
            </div>
            {d.message ? (
              <div className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted" role="status">
                {d.message}
              </div>
            ) : (
              <DataGrid<BreakdownRow>
                title="Chi tiết phân rã kết quả các đơn vị con cùng được giao KPI"
                rows={d.rows}
                rowKey={(r) => r.unitId ?? r.unitName}
                pagination={false}
                maxHeight="max-h-[40vh]"
                columns={[
                  { key: 'unitName', header: 'Tên đơn vị con', width: 220 },
                  { key: 'finalResult', header: 'Giá trị TH', align: 'right', width: 100, render: (r) => fmtNum(r.finalResult, 2) },
                  { key: 'completionRate', header: '% TH/KH kỳ', align: 'right', width: 90, render: (r) => fmtPct(r.completionRate) },
                  { key: 'score', header: 'Điểm đánh giá', align: 'right', width: 90, render: (r) => fmtNum(r.score, 2) },
                  { key: 'bscScore', header: 'Điểm BSC chỉ tiêu (thang 5)', align: 'right', width: 120, render: (r) => fmtNum(r.bscScore, 2) },
                  {
                    key: 'statusName',
                    header: 'Trạng thái',
                    width: 140,
                    render: (r) => (
                      <div className="flex flex-col gap-0.5">
                        <span>{r.statusName}</span>
                        <RatingDot rating={r.rating} />
                      </div>
                    ),
                  },
                ]}
              />
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** 17.7 “Bảng tổng hợp kết quả các KPI giao cho đơn vị” + 17.8 “Xuất Bảng Excel” */
export function CorporationTableDialog({ unitId, year, period, onClose }: { unitId: number; year: number; period: string; onClose: () => void }) {
  const q = useCorporationTable(unitId, year, period);
  const canExport = useHasPerm('DASHBOARD:EXPORT');
  const d = q.data;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Bảng tổng hợp kết quả các KPI giao cho đơn vị"
      description={d ? `${d.unit.name} – ${d.periodName}` : undefined}
      size="xl"
      footer={
        <>
          {canExport && <ExportButton url={EP.dashboard.corporationTableExport(unitId)} params={{ year, period }} label="Xuất Bảng Excel" />}
          <CloseBtn onClose={onClose} />
        </>
      }
    >
      {d?.summary && (
        <div className="mb-3 grid grid-cols-4 gap-3" data-testid="corp-summary">
          <ReadField label="Tổng số KPI giao" value={fmtNum(d.summary.totalKpi)} />
          <ReadField label="KPI đạt" value={fmtNum(d.summary.achieved)} />
          <ReadField label="% TH/KH kỳ" value={fmtPct(d.summary.completionRate)} />
          <ReadField label="Điểm BSC đơn vị (thang 5)" value={fmtNum(d.summary.bscScore, 2)} />
        </div>
      )}
      <DataGrid<RankRow>
        title="Bảng tổng hợp kết quả các KPI giao cho đơn vị"
        rows={d?.rows ?? []}
        loading={q.isFetching}
        rowKey={(r) => r.unitId}
        pagination={false}
        maxHeight="max-h-[50vh]"
        columns={[
          { key: 'unitName', header: 'Đơn vị thành viên', width: 240 },
          { key: 'totalKpi', header: 'Tổng số KPI giao', align: 'right', width: 90, render: (r) => fmtNum(r.totalKpi) },
          { key: 'achieved', header: 'KPI đạt', align: 'right', width: 70, render: (r) => fmtNum(r.achieved) },
          { key: 'warning', header: 'KPI cảnh báo', align: 'right', width: 80, render: (r) => fmtNum(r.warning) },
          { key: 'completionRate', header: '% TH/KH kỳ', align: 'right', width: 90, render: (r) => fmtPct(r.completionRate) },
          { key: 'bscScore', header: 'Điểm BSC đơn vị (thang 5)', align: 'right', width: 110, render: (r) => fmtNum(r.bscScore, 2) },
          { key: 'rank', header: 'Xếp hạng', align: 'center', width: 70, render: (r) => r.rank ?? '' },
        ]}
      />
    </Dialog>
  );
}

/** 15.1 Xem bản đồ chiến lược (chỉ đọc) — dùng lại StrategyMap của §VI */
export function DashStrategyMapDialog({ params, unitName, onClose }: { params: DashParams; unitName?: string; onClose: () => void }) {
  const q = useDashStrategyMap(params, true);
  const d = q.data;
  const [node, setNode] = useState<MapNode | null>(null);
  const resultOf = useCallback((objectiveId: number, k: MapKpi) => d?.kpiResults?.[String(objectiveId)]?.find((x) => x.kpiId === k.kpiId || x.kpiCode === k.kpiCode), [d]);
  const kpiColor = useCallback((objectiveId: number, k: MapKpi) => {
    const r = resultOf(objectiveId, k);
    return r?.rating ? ratingColor(r.rating) : undefined;
  }, [resultOf]);
  const nodeRows = useMemo<ObjectiveKpi[]>(() => {
    if (!node) return [];
    const res = d?.kpiResults?.[String(node.objectiveId)] ?? [];
    const seen = new Set(res.map((r) => r.kpiCode));
    return [...res, ...node.kpis.filter((k) => !seen.has(k.kpiCode)).map((k) => ({ kpiId: k.kpiId, kpiCode: k.kpiCode, kpiName: k.kpiName }))];
  }, [node, d]);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Bản đồ chiến lược"
      description={d?.strategy ? `${d.strategy.name} – ${d.strategy.orgUnitName} – ${d.periodName ?? ''}` : unitName}
      size="full"
      footer={<CloseBtn onClose={onClose} />}
    >
      {q.isFetching && !d ? (
        <Empty text="Đang tải…" />
      ) : !d || d.message || !d.lanes ? (
        <div className="py-10 text-center text-sm text-muted" role="status" data-testid="no-strategy-map">
          {d?.message ?? 'Chưa có bản đồ chiến lược cho đơn vị/kỳ đã chọn'}
        </div>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-4 text-[12px] text-slate-600">
            <span>
              Giai đoạn: <b>{d.strategy?.stageName}</b>
            </span>
            <span className="flex items-center gap-3" aria-label="Chú thích màu theo đánh giá">
              {Object.keys(RATING_LABEL).map((r) => (
                <RatingDot key={r} rating={r} />
              ))}
            </span>
            <span className="text-muted">Bấm biểu tượng ▾ trên mục tiêu để xem các KPI kèm kết quả thực hiện</span>
          </div>
          <ReactFlowProvider>
            <StrategyMap lanes={d.lanes} nodes={d.nodes ?? []} edges={d.edges ?? []} editable={false} onExpand={setNode} kpiColor={kpiColor} height="h-[62vh]" />
          </ReactFlowProvider>
        </>
      )}
      {node && (
        <Dialog open onOpenChange={(o) => !o && setNode(null)} title={`KPI của mục tiêu ${node.code}`} description={`${node.code} – ${node.name}`} size="lg" footer={<CloseBtn onClose={() => setNode(null)} />}>
          <DataGrid<ObjectiveKpi>
            title="Các KPI thuộc mục tiêu"
            rows={nodeRows}
            rowKey={(r) => r.kpiCode}
            pagination={false}
            columns={[
              { key: 'kpiCode', header: 'Mã KPI', width: 90 },
              { key: 'kpiName', header: 'Tên KPI', width: 240 },
              { key: 'planValue', header: 'Mục tiêu', align: 'right', width: 90, render: (r) => fmtNum(r.planValue, 2) },
              { key: 'finalResult', header: 'Kết quả', align: 'right', width: 90, render: (r) => fmtNum(r.finalResult, 2) },
              { key: 'periodName', header: 'Kỳ đánh giá', width: 120, render: (r) => (r.periodName ? `${r.periodName} ${r.year ?? ''}` : '') },
              { key: 'rating', header: 'Đánh giá', width: 110, render: (r) => <RatingDot rating={r.rating} /> },
            ]}
          />
        </Dialog>
      )}
    </Dialog>
  );
}
