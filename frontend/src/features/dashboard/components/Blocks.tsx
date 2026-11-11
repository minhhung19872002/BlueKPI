import { ClipboardList, Eye, ListChecks, TrendingDown, TrendingUp, XCircle, CheckCircle2, Hourglass } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { Button } from '@/components/ui/Button';
import { Card, Empty } from '@/components/ui/Misc';
import { fmtNum, fmtPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useCorporations, useProvinceStage, useRanking } from '../api';
import { ratingColor, RATING_LABEL, toNum, type Cards, type KpiRow, type Num, type Overview, type RankRow } from '../types';
import { BscGauge, BscLineChart, HBarChart, VBarChart } from './Charts';

// ============================== 4 thẻ thống kê KPI ==============================
export const CARD_DEFS: { key: keyof Cards; card: string; label: string; icon: ReactNode; tone: string }[] = [
  { key: 'total', card: 'ALL', label: 'Tổng số KPI giao', icon: <ClipboardList className="h-5 w-5" />, tone: 'text-primary bg-primary-soft' },
  { key: 'achieved', card: 'ACHIEVED', label: 'KPI đạt/vượt', icon: <CheckCircle2 className="h-5 w-5" />, tone: 'text-green-700 bg-green-50' },
  { key: 'notAchieved', card: 'NOT_ACHIEVED', label: 'KPI chưa đạt', icon: <XCircle className="h-5 w-5" />, tone: 'text-red-700 bg-red-50' },
  { key: 'tracking', card: 'TRACKING', label: 'KPI đang theo dõi', icon: <Hourglass className="h-5 w-5" />, tone: 'text-slate-600 bg-slate-100' },
];

/** ▲/▼ % so với kỳ trước */
export function Change({ value }: { value: Num }) {
  const n = toNum(value);
  if (n === null) return <span className="text-muted">— tỷ lệ so với kỳ trước</span>;
  const up = n > 0;
  const flat = n === 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5', flat ? 'text-slate-500' : up ? 'text-green-700' : 'text-red-700')} data-testid="card-change">
      {flat ? '■' : up ? '▲' : '▼'} {fmtNum(Math.abs(n), 2)}% <span className="text-muted">tỷ lệ so với kỳ trước</span>
    </span>
  );
}

export function StatCards({ o, onOpen }: { o: Overview; onOpen: (card: string, label: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {CARD_DEFS.map((c) => (
        <div
          key={c.key}
          role="button"
          tabIndex={0}
          aria-label={c.label}
          data-testid={`card-${c.key}`}
          onClick={() => onOpen(c.card, c.label)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpen(c.card, c.label)}
          className="card flex cursor-pointer flex-col gap-1 p-3 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary"
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-slate-600">{c.label}</span>
            <span className={cn('rounded-md p-1.5', c.tone)}>{c.icon}</span>
          </div>
          <div className="text-2xl font-semibold text-slate-800" data-testid="card-value">
            {fmtNum(o.cards[c.key])}
          </div>
          <div className="flex items-center justify-between gap-2 text-[12px]">
            <Change value={o.changes[c.key]} />
            <span className="whitespace-nowrap font-medium text-primary underline-offset-2 hover:underline">Click xem</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Thẻ “Điểm BSC tổng hợp” */
export function BscCard({ o }: { o: Overview }) {
  const s = toNum(o.bsc.score);
  const p = toNum(o.bsc.prevScore);
  return (
    <section className="card flex flex-col p-3" data-testid="bsc-gauge">
      <h3 className="text-[13px] font-semibold text-slate-700">Điểm BSC tổng hợp</h3>
      <div className="text-[12px] text-muted">{o.bsc.periodName}</div>
      <BscGauge score={o.bsc.score} />
      <div className="-mt-6 text-center">
        <span className="sr-only">Điểm BSC tổng hợp: </span>
        <span className="text-[12px] text-slate-500" data-testid="bsc-score">
          {s === null ? 'Chưa có điểm' : `${fmtNum(s, 2)} / 5`}
        </span>
      </div>
      <div className="mt-2 border-t border-border pt-2 text-center text-[12px] text-slate-600" data-testid="bsc-prev">
        Kỳ trước{o.bsc.prevPeriodName ? ` (${o.bsc.prevPeriodName})` : ''}: <b>{p === null ? '—' : fmtNum(p, 2)}</b>
        {s !== null && p !== null && s !== p && <span className={cn('ml-1', s > p ? 'text-green-700' : 'text-red-700')}>{s > p ? '▲' : '▼'}</span>}
      </div>
    </section>
  );
}

// ============================== Chỉ đạo trọng tâm ==============================
function Progress({ label, value, rating }: { label: string; value: Num; rating: string }) {
  const n = toNum(value);
  return (
    <div>
      <div className="flex justify-between text-[12px]">
        <span className="text-slate-600">{label}</span>
        <b className="text-slate-800">{n === null ? '—' : fmtPct(n)}</b>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={label} aria-valuenow={n ?? 0} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, n ?? 0))}%`, background: ratingColor(rating) }} />
      </div>
    </div>
  );
}

export function FocusArea({ items, onDetail, onList }: { items: KpiRow[]; onDetail: (k: KpiRow) => void; onList: () => void }) {
  return (
    <Card
      title="Chỉ đạo trọng tâm"
      className="mt-3"
      actions={
        <Button size="sm" variant="outline" onClick={onList}>
          <ListChecks className="h-4 w-4" />
          Xem Danh Sách Chi Tiết Các KPI
        </Button>
      }
    >
      <div data-testid="focus-area">
        <p className="-mt-1 mb-3 text-[12px] text-muted">Tổng quan các chỉ tiêu cần theo dõi</p>
        {!items.length ? (
          <Empty text="Không có KPI trọng tâm trong kỳ đã chọn" />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {items.map((k) => (
              <div key={k.kpiId} className="flex flex-col rounded-md border border-border border-l-4 p-3" style={{ borderLeftColor: ratingColor(k.rating) }} data-testid="focus-card" data-kpi={k.kpiCode}>
                <div className="text-[11px] text-muted">
                  {k.kpiCode} · {k.perspectiveName}
                </div>
                <div className="line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold text-slate-800" title={k.kpiName}>
                  {k.kpiName}
                </div>
                <div className="mt-1 flex items-baseline justify-between text-[12px]">
                  <span className="text-slate-600">TH kỳ đánh giá</span>
                  <b>
                    {fmtNum(k.finalResult, 2) || '—'} <span className="font-normal text-muted">{k.unitOfMeasureName}</span>
                  </b>
                </div>
                <div className="mt-1 space-y-1.5">
                  <Progress label="% TH/KH kỳ" value={k.completionRate} rating={k.rating} />
                  <Progress label="% TH/KH năm" value={k.yearCompletionRate} rating={k.rating} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium" style={{ color: ratingColor(k.rating) }}>
                    {k.ratingName ?? RATING_LABEL[k.rating]}
                  </span>
                  <Button size="sm" variant="link" onClick={() => onDetail(k)} aria-label={`Xem chi tiết ${k.kpiCode}`}>
                    Xem chi tiết
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================== Khối cấp Tập đoàn ==============================
export function Movement({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) return <span className="text-muted">—</span>;
  if (v === 0) return <span className="text-slate-500">■ 0</span>;
  return v > 0 ? (
    <span className="inline-flex items-center gap-0.5 text-green-700" title="Tăng hạng">
      <TrendingUp className="h-3.5 w-3.5" />▲ {v}
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-red-700" title="Giảm hạng">
      <TrendingDown className="h-3.5 w-3.5" />▼ {Math.abs(v)}
    </span>
  );
}

const viewBtn = (onView: (r: RankRow) => void) => (r: RankRow) => (
  <Button size="sm" variant="outline" onClick={() => onView(r)} aria-label={`Xem ${r.unitName}`}>
    <Eye className="h-3.5 w-3.5" />
    Xem
  </Button>
);

/** “Bảng xếp hạng điểm BSC khối VNPT tỉnh/thành phố” — top 10 + “Xem tất cả” */
export function RankingBlock({ year, period, onView }: { year: number; period: string; onView: (r: RankRow) => void }) {
  const [all, setAll] = useState(false);
  const q = useRanking(year, period, all, true);
  const total = q.data?.total ?? 0;
  return (
    <Card
      title="Bảng xếp hạng điểm BSC khối VNPT tỉnh/thành phố"
      actions={
        total > 10 && (
          <Button size="sm" variant="link" onClick={() => setAll(!all)}>
            {all ? 'Thu gọn (top 10)' : 'Xem tất cả'}
          </Button>
        )
      }
    >
      <div data-testid="ranking-block">
        <DataGrid<RankRow>
          title="Bảng xếp hạng điểm BSC khối VNPT tỉnh/thành phố"
          rows={q.data?.rows ?? []}
          loading={q.isFetching}
          rowKey={(r) => r.unitId}
          showStt={false}
          pagination={false}
          maxHeight={all ? 'max-h-[480px]' : undefined}
          columns={[
            { key: 'rank', header: 'Hạng', align: 'center', width: 56, render: (r) => r.rank ?? '' },
            { key: 'unitName', header: 'Đơn vị/Tỉnh thành', width: 180 },
            { key: 'bscScore', header: 'Điểm BSC', align: 'right', width: 80, render: (r) => fmtNum(r.bscScore, 2) },
            { key: 'movement', header: 'Biến động', align: 'center', width: 84, render: (r) => <Movement v={r.movement} /> },
            { key: 'actions', header: 'Thao tác', align: 'center', width: 80, render: viewBtn(onView) },
          ]}
        />
      </div>
    </Card>
  );
}

/** “Điểm BSC các Tổng công ty/Công ty” — bar ngang + danh sách; bấm → 17.7 */
export function CorporationsBlock({ year, period, onPick }: { year: number; period: string; onPick: (r: RankRow) => void }) {
  const q = useCorporations(year, period, true);
  const rows = q.data ?? [];
  const pick = (key: string | number) => {
    const r = rows.find((x) => x.unitId === key);
    if (r) onPick(r);
  };
  return (
    <Card title="Điểm BSC các Tổng công ty/Công ty">
      <div data-testid="corporations-block">
        {!rows.length ? (
          <Empty text={q.isFetching ? 'Đang tải…' : 'Không có dữ liệu'} />
        ) : (
          <>
            <HBarChart
              ariaLabel="Biểu đồ điểm BSC các Tổng công ty/Công ty"
              items={rows.map((r) => ({ key: r.unitId, label: r.unitName, value: r.bscScore, extra: `% đạt KH kỳ: ${fmtPct(r.completionRate) || '—'}` }))}
              onPick={pick}
            />
            <table className="mt-2 w-full text-[13px]" aria-label="Danh sách điểm BSC các Tổng công ty/Công ty">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold">Tên đơn vị</th>
                  <th className="w-24 px-2 py-1.5 text-right font-semibold">% đạt KH kỳ</th>
                  <th className="w-20 px-2 py-1.5 text-right font-semibold">Điểm BSC</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.unitId} className="border-b border-border hover:bg-slate-50">
                    <td className="px-2 py-1.5">
                      <button type="button" className="text-left text-primary hover:underline" onClick={() => onPick(r)}>
                        {r.unitName}
                      </button>
                    </td>
                    <td className="px-2 py-1.5 text-right">{fmtPct(r.completionRate)}</td>
                    <td className="px-2 py-1.5 text-right font-medium">{fmtNum(r.bscScore, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </Card>
  );
}

// ============================== 12.1 / 13.1 Khối VNPT tỉnh/thành phố ==============================
export function ProvincesBlock({ year, period, periodName, onView }: { year: number; period: string; periodName: string; onView: (r: RankRow) => void }) {
  const q = useRanking(year, period, true, true);
  const rows = q.data?.rows ?? [];
  return (
    <div className="mt-3 space-y-3" data-testid="provinces-block">
      <Card title={`Bảng tổng hợp kết quả KPI và điểm BSC các VNPT tỉnh/thành phố – ${periodName}`}>
        <DataGrid<RankRow>
          title="Bảng tổng hợp kết quả KPI và điểm BSC các VNPT tỉnh/thành phố"
          rows={rows}
          loading={q.isFetching}
          rowKey={(r) => r.unitId}
          showStt={false}
          pagination={false}
          maxHeight="max-h-[520px]"
          columns={[
            { key: 'rank', header: 'Hạng', align: 'center', width: 48, render: (r) => r.rank ?? '' },
            { key: 'unitCode', header: 'Mã đơn vị', width: 86 },
            { key: 'unitName', header: 'VNPT tỉnh/thành phố', width: 140 },
            { key: 'totalKpi', header: 'Tổng số KPI giao', align: 'right', width: 70, render: (r) => fmtNum(r.totalKpi) },
            { key: 'achieved', header: 'KPI đạt/vượt', align: 'right', width: 66, render: (r) => fmtNum(r.achieved) },
            { key: 'notAchieved', header: 'KPI chưa đạt', align: 'right', width: 66, render: (r) => fmtNum(r.notAchieved) },
            { key: 'tracking', header: 'KPI đang theo dõi', align: 'right', width: 70, render: (r) => fmtNum(r.tracking) },
            { key: 'completionRate', header: '% TH/KH kỳ', align: 'right', width: 76, render: (r) => fmtPct(r.completionRate) },
            { key: 'bscScore', header: 'Điểm BSC', align: 'right', width: 60, render: (r) => fmtNum(r.bscScore, 2) },
            { key: 'movement', header: 'Biến động', align: 'center', width: 72, render: (r) => <Movement v={r.movement} /> },
            { key: 'actions', header: 'Thao tác', align: 'center', width: 70, render: viewBtn(onView) },
          ]}
        />
      </Card>
      <Card title="Biểu đồ điểm BSC theo VNPT tỉnh/thành phố">
        <VBarChart
          ariaLabel="Biểu đồ điểm BSC theo VNPT tỉnh/thành phố"
          testId="provinces-chart"
          rotate={60}
          height={320}
          items={rows.map((r) => ({ key: r.unitId, label: r.unitName.replace(/^VNPT\s+/, ''), value: r.bscScore, extra: `Hạng: ${r.rank ?? '—'}` }))}
        />
      </Card>
    </div>
  );
}

// ============================== Biểu đồ giai đoạn (8.1 / 11.1) ==============================
export function StageChartBlock({ o, onPickYear }: { o: Overview; onPickYear: (y: number) => void }) {
  const ys = o.stageYears ?? [];
  return (
    <Card title={`Điểm BSC theo năm – ${o.stage?.name ?? ''}`} className="mt-3">
      <p className="-mt-1 mb-1 text-[12px] text-muted">Nhấn vào cột của một năm để xem kết quả cả năm đó</p>
      <VBarChart
        ariaLabel="Biểu đồ điểm BSC các năm trong giai đoạn"
        testId="stage-chart"
        items={ys.map((y) => ({ key: y.year, label: String(y.year), value: y.bscScore, extra: `% TH/KH: ${fmtPct(y.completionRate) || '—'}` }))}
        onPick={(k) => onPickYear(Number(k))}
      />
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[12px]">
        <span className="text-muted">Xem năm:</span>
        {ys.map((y) => (
          <Button key={y.year} size="sm" variant="ghost" className="h-6 px-2" onClick={() => onPickYear(y.year)} aria-label={`Xem năm ${y.year}`}>
            {y.year}
          </Button>
        ))}
      </div>
    </Card>
  );
}

// ============================== 14.1 Một tỉnh qua các kỳ trong giai đoạn ==============================
export function ProvinceStageBlock({ unitId, stageId, stageName }: { unitId: number; stageId: number; stageName: string }) {
  const q = useProvinceStage(unitId, stageId);
  const rows = q.data ?? [];
  return (
    <Card title={`Kết quả thực hiện KPI và điểm BSC qua các kỳ đánh giá – ${stageName}`} className="mt-3">
      <div data-testid="province-stage-block">
        {rows.length > 0 && <BscLineChart ariaLabel="Biểu đồ điểm BSC theo kỳ đánh giá" items={rows.map((r) => ({ label: r.periodName, value: r.bscScore, rate: r.completionRate }))} />}
        <DataGrid
          title="Kết quả qua các kỳ đánh giá trong giai đoạn"
          rows={rows}
          loading={q.isFetching}
          rowKey={(r) => `${r.year}-${r.period}`}
          showStt={false}
          pagination={false}
          maxHeight="max-h-[400px]"
          columns={[
            { key: 'periodName', header: 'Kỳ đánh giá', width: 150 },
            { key: 'totalKpi', header: 'Tổng số KPI giao', align: 'right', width: 90, render: (r) => fmtNum(r.totalKpi) },
            { key: 'achieved', header: 'KPI đạt/vượt', align: 'right', width: 80, render: (r) => fmtNum(r.achieved) },
            { key: 'notAchieved', header: 'KPI chưa đạt', align: 'right', width: 80, render: (r) => fmtNum(r.notAchieved) },
            { key: 'completionRate', header: '% TH/KH', align: 'right', width: 80, render: (r) => fmtPct(r.completionRate) },
            { key: 'bscScore', header: 'Điểm BSC', align: 'right', width: 70, render: (r) => fmtNum(r.bscScore, 2) },
            { key: 'rankInGroup', header: 'Hạng trong khối', align: 'center', width: 80, render: (r) => r.rankInGroup ?? '' },
          ]}
        />
      </div>
    </Card>
  );
}
