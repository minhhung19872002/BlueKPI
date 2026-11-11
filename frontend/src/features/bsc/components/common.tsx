import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calculator, FileSpreadsheet, Lock, PenLine } from 'lucide-react';
import { useState } from 'react';
import { ApiError, download, get, post } from '@/api/http';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { Button } from '@/components/ui/Button';
import { Dialog, Drawer } from '@/components/ui/Dialog';
import { Field, ReadField, Select } from '@/components/ui/Input';
import { errorMessage, toast } from '@/components/ui/Toast';
import { codeName } from '@/features/common/shared';
import { ResultStatusBadge } from '@/features/evaluation/components/common';
import { CURRENT_YEAR, PERIOD_OPTIONS, periodLabel, YEAR_OPTIONS } from '@/features/evaluation/components/labels';
import type { Result } from '@/features/evaluation/components/types';
import { fmtNum, fmtPct } from '@/lib/format';
import { useHasPerm } from '@/stores/sessionStore';

export interface PendingUnit {
  unitCode: string;
  unitName: string;
  pending?: number;
}

interface RankRow {
  unitName: string;
  unitCode?: string;
  rankInGroup?: number;
  bscScore?: number;
}

interface ApproveCheck {
  eligible: boolean;
  approved: boolean;
  units: PendingUnit[];
  message?: string | null;
  summary?: { year: number; period: string; periodName: string; unitCount: number; groupBscScore?: number | null; top5: RankRow[]; bottom5: RankRow[] };
}

export const REPORTS = [
  { value: 'TTR94_TONG_HOP', label: 'Báo cáo TTr94 tổng hợp BSC' },
  { value: 'TTR94_CHI_TIET', label: 'Báo cáo TTr94 chi tiết KPI' },
  { value: 'KPI_TUNG_TINH', label: 'Báo cáo KPI từng tỉnh' },
];

export const SCOPE_OPTIONS = [
  { value: 'ALL', label: 'Toàn Tập đoàn' },
  { value: 'PROVINCES', label: 'Khối VNPT tỉnh/thành phố' },
  { value: 'CORPS', label: 'Khối Tổng công ty/Công ty' },
];

/** Chọn “Năm”, “Kỳ đánh giá” dùng chung cho các dialog */
function YearPeriodFields({ prefix, year, period, setYear, setPeriod, err }: { prefix: string; year: string; period: string; setYear: (v: string) => void; setPeriod: (v: string) => void; err?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Năm" required htmlFor={`${prefix}-year`} error={err && !year ? 'Vui lòng chọn Năm' : undefined}>
        <Select id={`${prefix}-year`} options={YEAR_OPTIONS} value={year} onChange={(e) => setYear(e.target.value)} />
      </Field>
      <Field label="Kỳ đánh giá" required htmlFor={`${prefix}-period`} error={err && !period ? 'Vui lòng chọn Kỳ đánh giá' : undefined}>
        <Select id={`${prefix}-period`} placeholder="-- Chọn --" options={PERIOD_OPTIONS} value={period} onChange={(e) => setPeriod(e.target.value)} />
      </Field>
    </div>
  );
}

function UnitTable({ units, label }: { units: PendingUnit[]; label: string }) {
  return (
    <DataGrid<PendingUnit>
      title={label}
      rows={units}
      rowKey={(r) => r.unitCode}
      pagination={false}
      maxHeight="max-h-64"
      columns={[
        { key: 'unitCode', header: 'Mã đơn vị', width: 160 },
        { key: 'unitName', header: 'Tên đơn vị', width: 320 },
      ]}
    />
  );
}

/** Thanh công cụ dùng chung hai tab: 46.5 (tab 1), 48.x, 50.x, 51–53 */
export function BscToolbar({ tab, onChanged }: { tab: 'summary' | 'review'; onChanged: () => void }) {
  const canRecalc = useHasPerm('BSC:RECALC');
  const canClose = useHasPerm('BSC:CLOSE');
  const canApprove = useHasPerm('BSC:APPROVE');
  const canReport = useHasPerm('BSC:REPORT');
  const [open, setOpen] = useState<'recalc' | 'close' | 'approve' | null>(null);
  const [report, setReport] = useState('');
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tab === 'summary' && canRecalc && (
        <Button variant="secondary" onClick={() => setOpen('recalc')}>
          <Calculator className="h-4 w-4" />
          Tính lại điểm đánh giá
        </Button>
      )}
      {canClose && (
        <Button variant="secondary" onClick={() => setOpen('close')}>
          <Lock className="h-4 w-4" />
          Chốt đánh giá KPI
        </Button>
      )}
      {canApprove && (
        <Button onClick={() => setOpen('approve')}>
          <PenLine className="h-4 w-4" />
          Tổng giám đốc duyệt
        </Button>
      )}
      {canReport && (
        <div className="flex items-center gap-1">
          <FileSpreadsheet className="h-4 w-4 text-slate-500" />
          <Select aria-label="Chọn loại báo cáo" className="w-60" placeholder="Chọn loại báo cáo" options={REPORTS} value={report} onChange={(e) => setReport(e.target.value)} />
        </div>
      )}
      {open === 'recalc' && <RecalcDialog onClose={() => setOpen(null)} onDone={onChanged} />}
      {open === 'close' && <CloseDialog onClose={() => setOpen(null)} onDone={onChanged} />}
      {open === 'approve' && <ApproveDialog onClose={() => setOpen(null)} onDone={onChanged} />}
      {report && <ReportDialog code={report} onClose={() => setReport('')} />}
    </div>
  );
}

/** 46.5 Dialog “Tính lại điểm KPI” */
function RecalcDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [period, setPeriod] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const submit = async () => {
    if (!year || !period) return setErr(true);
    setBusy(true);
    try {
      const r = await post<{ message: string }>(EP.bsc.recalc, { year: Number(year), period });
      toast.success(r.message || 'Tính lại điểm KPI thành công');
      onDone();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Tính lại điểm KPI"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} loading={busy}>
            Xác nhận
          </Button>
        </>
      }
    >
      <YearPeriodFields prefix="rc" year={year} period={period} setYear={setYear} setPeriod={setPeriod} err={err} />
      <p className="mt-3 text-[13px] text-slate-600">Hệ thống sẽ tính lại điểm KPI cho tất cả đơn vị trong kỳ đã chọn.</p>
    </Dialog>
  );
}

/** 48.1–48.4 Dialog “Chốt đánh giá KPI” */
function CloseDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [period, setPeriod] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [blocked, setBlocked] = useState<{ message: string; units: PendingUnit[] } | null>(null);
  const submit = async () => {
    if (!year || !period) return setErr(true);
    setBusy(true);
    setBlocked(null);
    try {
      const r = await post<{ message: string }>(EP.bsc.close, { year: Number(year), period });
      toast.success(r.message || 'Chốt đánh giá KPI thành công');
      onDone();
      onClose();
    } catch (e) {
      const data = e instanceof ApiError ? (e.data as { units?: PendingUnit[] } | undefined) : undefined;
      if (e instanceof ApiError && e.code === 'ERR_NOT_ELIGIBLE') setBlocked({ message: e.message, units: data?.units ?? [] });
      else toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Chốt đánh giá KPI"
      size={blocked ? 'lg' : 'md'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {blocked ? 'Đóng' : 'Hủy'}
          </Button>
          {!blocked && (
            <Button onClick={submit} loading={busy}>
              Xác nhận
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        <YearPeriodFields prefix="cl" year={year} period={period} setYear={(v) => (setYear(v), setBlocked(null))} setPeriod={(v) => (setPeriod(v), setBlocked(null))} err={err} />
        {!blocked && <p className="text-[13px]">Bạn có chắc chắn muốn chốt kết quả đánh giá KPI của kỳ đã chọn?</p>}
        {blocked && (
          <>
            <p role="alert" className="rounded border border-amber-300 bg-amber-50 p-2 text-[13px] font-medium text-amber-800">
              {blocked.message}
            </p>
            <UnitTable units={blocked.units} label="Danh sách đơn vị chưa đủ điều kiện" />
          </>
        )}
      </div>
    </Dialog>
  );
}

/** 50.1–50.4 Dialog “Tổng giám đốc duyệt” */
function ApproveDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [period, setPeriod] = useState('');
  const [busy, setBusy] = useState(false);
  const enabled = !!year && !!period;
  const check = useQuery({
    queryKey: ['bsc-approve-check', year, period],
    queryFn: async () => (await post<ApproveCheck>(EP.bsc.approveCheck, { year: Number(year), period })).data!,
    enabled,
    staleTime: 0,
    gcTime: 0,
  });
  const c = check.data;
  const sign = async () => {
    setBusy(true);
    try {
      const r = await post<{ message: string }>(EP.bsc.approve, { year: Number(year), period });
      toast.success(r.message || 'Tổng giám đốc ký duyệt thành công');
      onDone();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const rankTable = (rows: RankRow[], label: string) => (
    <DataGrid<RankRow>
      title={label}
      rows={rows}
      rowKey={(r) => r.unitName}
      pagination={false}
      columns={[
        { key: 'rankInGroup', header: 'Xếp hạng', width: 70, align: 'center' },
        { key: 'unitName', header: 'Tên đơn vị', width: 220 },
        { key: 'bscScore', header: 'Điểm BSC', width: 80, align: 'right', render: (r) => fmtNum(r.bscScore, 2) },
      ]}
    />
  );
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Tổng giám đốc duyệt"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          <Button onClick={sign} loading={busy} disabled={!c?.eligible || c.approved}>
            Ký duyệt
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <YearPeriodFields prefix="ap" year={year} period={period} setYear={setYear} setPeriod={setPeriod} />
        {check.isFetching && <p className="text-[13px] text-slate-500">Đang kiểm tra điều kiện ký duyệt...</p>}
        {check.isError && <p className="field-error">{errorMessage(check.error)}</p>}
        {c && !c.eligible && !c.approved && (
          <>
            <p role="alert" className="rounded border border-amber-300 bg-amber-50 p-2 text-[13px] font-medium text-amber-800">
              {c.message}
            </p>
            <UnitTable units={c.units} label="Danh sách đơn vị chưa đủ điều kiện" />
          </>
        )}
        {c?.approved && <p className="rounded border border-emerald-300 bg-emerald-50 p-2 text-[13px] text-emerald-800">{c.message}</p>}
        {c?.eligible && !c.approved && c.summary && (
          <div className="space-y-3" data-testid="approve-summary">
            <div className="grid grid-cols-4 gap-3">
              <ReadField label="Năm" value={c.summary.year} />
              <ReadField label="Kỳ đánh giá" value={c.summary.periodName} />
              <ReadField label="Số đơn vị" value={c.summary.unitCount} />
              <ReadField label="Điểm BSC Tập đoàn" value={fmtNum(c.summary.groupBscScore, 2)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {rankTable(c.summary.top5, 'Top 5 đơn vị')}
              {rankTable(c.summary.bottom5, 'Bottom 5 đơn vị')}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** 51–53 Dialog “Xuất báo cáo …” */
function ReportDialog({ code, onClose }: { code: string; onClose: () => void }) {
  const name = REPORTS.find((r) => r.value === code)?.label ?? code;
  const [scope, setScope] = useState('ALL');
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [period, setPeriod] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const submit = async () => {
    if (!scope || !year || !period) return setErr(true);
    setBusy(true);
    try {
      await download(EP.reports.byTemplate(code), undefined, 'post', { scope, year: Number(year), period });
      toast.success('Xuất báo cáo thành công');
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Xuất ${name.charAt(0).toLowerCase()}${name.slice(1)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} loading={busy}>
            Xác nhận
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Phạm vi đơn vị" required htmlFor="rp-scope" error={err && !scope ? 'Vui lòng chọn Phạm vi đơn vị' : undefined}>
          <Select id="rp-scope" options={SCOPE_OPTIONS} value={scope} onChange={(e) => setScope(e.target.value)} />
        </Field>
        <YearPeriodFields prefix="rp" year={year} period={period} setYear={setYear} setPeriod={setPeriod} err={err} />
      </div>
    </Dialog>
  );
}

/** 46.4 / 47.4 Xác nhận thu hồi */
export function RevokeDialog({ row, byUnit, onClose, onDone }: { row: Result; byUnit: boolean; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const r = byUnit ? await post<{ message: string }>(EP.bsc.revokeUnit, { resultId: row.id }) : await post<{ message: string }>(EP.bsc.revoke, { evalKpiId: row.evaluationKpiId });
      toast.success(r.message || 'Thu hồi kết quả đánh giá thành công');
      onDone();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const kpi = codeName(row.kpiCode, row.kpiName);
  const period = `${periodLabel(row.periodCode)} ${row.year}`;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={byUnit ? 'Thu hồi theo đơn vị' : 'Thu hồi kết quả đánh giá'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button variant="danger" onClick={submit} loading={busy}>
            Xác nhận
          </Button>
        </>
      }
    >
      <p className="text-[13px]">
        {byUnit ? (
          <>
            Bạn có chắc chắn muốn thu hồi kết quả đánh giá của đơn vị <b>{codeName(row.orgUnitCode, row.orgUnitName)}</b> cho tiêu chí <b>{kpi}</b> trong kỳ <b>{period}</b>?
          </>
        ) : (
          <>
            Bạn có chắc chắn muốn thu hồi kết quả đánh giá của tiêu chí KPI <b>{kpi}</b> trong kỳ <b>{period}</b> (tất cả đơn vị đủ điều kiện)?
          </>
        )}
      </p>
      <p className="mt-2 text-[13px] text-slate-600">Kết quả bị thu hồi sẽ chuyển về “BCL yêu cầu làm lại”.</p>
    </Dialog>
  );
}

/** 46.3 / 45.x — chọn “Xem theo đơn vị” / “Xem theo KPI” */
export function ViewChoiceDialog({ row, onClose }: { row: Result; onClose: () => void }) {
  const [mode, setMode] = useState<'unit' | 'kpi' | null>(null);
  if (mode === 'unit') return <ByUnitDrawer row={row} onClose={onClose} />;
  if (mode === 'kpi') return <ByKpiDrawer row={row} onClose={onClose} />;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Xem chi tiết" size="sm">
      <div className="flex justify-center gap-3 py-2">
        <Button variant="secondary" onClick={() => setMode('unit')}>
          Xem theo đơn vị
        </Button>
        <Button variant="secondary" onClick={() => setMode('kpi')}>
          Xem theo KPI
        </Button>
      </div>
    </Dialog>
  );
}

const resultColumns = (withUnit: boolean) => [
  ...(withUnit ? [{ key: 'orgUnitCode', header: 'Mã – Tên đơn vị', width: 220, render: (r: Result) => codeName(r.orgUnitCode, r.orgUnitName) }] : []),
  ...(!withUnit ? [{ key: 'kpiCode', header: 'Mã – Tên tiêu chí KPI', width: 260, render: (r: Result) => codeName(r.kpiCode, r.kpiName) }, { key: 'perspectiveName', header: 'Viễn cảnh', width: 100 }] : []),
  { key: 'weight', header: 'Trọng số', align: 'right' as const, width: 70, render: (r: Result) => fmtNum(r.weight, 2) },
  { key: 'planValue', header: 'Mục tiêu giao', align: 'right' as const, width: 90, render: (r: Result) => fmtNum(r.planValue, 2) },
  { key: 'finalResult', header: 'Kết quả', align: 'right' as const, width: 90, render: (r: Result) => fmtNum(r.finalResult, 2) },
  { key: 'completionRate', header: '% TH/KH', align: 'right' as const, width: 70, render: (r: Result) => fmtPct(r.completionRate) },
  { key: 'score', header: 'Điểm', align: 'right' as const, width: 60, render: (r: Result) => fmtNum(r.score, 2) },
  { key: 'status', header: 'Tình trạng', width: 130, render: (r: Result) => <ResultStatusBadge status={r.status} /> },
];

function ByUnitDrawer({ row, onClose }: { row: Result; onClose: () => void }) {
  const canReport = useHasPerm('BSC:REPORT');
  const q = useQuery({
    queryKey: ['bsc-by-unit', row.orgUnitId, row.year, row.periodCode],
    queryFn: () => get<{ rows: Result[]; summary?: { bscScore?: number; rankInGroup?: number } | null }>(EP.bsc.byUnit, { unitId: row.orgUnitId, year: row.year, period: row.periodCode }),
  });
  const exp = async (kind: 'assign' | 'result') => {
    try {
      if (kind === 'assign') await download(EP.reports.assignmentSheet, { unitId: row.orgUnitId, year: row.year });
      else await download(EP.reports.resultSheet, { unitId: row.orgUnitId, year: row.year, period: row.periodCode });
      toast.success('Xuất dữ liệu thành công');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title="Kết quả đánh giá KPI theo đơn vị" width="w-[960px]">
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <ReadField label="Đơn vị" value={codeName(row.orgUnitCode, row.orgUnitName)} />
        <ReadField label="Kỳ đánh giá" value={`${periodLabel(row.periodCode)} ${row.year}`} />
        <ReadField label="Điểm BSC" value={fmtNum(q.data?.summary?.bscScore, 2)} />
        <ReadField label="Xếp hạng" value={q.data?.summary?.rankInGroup ?? ''} />
        {canReport && (
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={() => exp('assign')}>
              <FileSpreadsheet className="h-4 w-4" />
              Xuất biểu giao KPI
            </Button>
            <Button variant="secondary" onClick={() => exp('result')}>
              <FileSpreadsheet className="h-4 w-4" />
              Xuất biểu kết quả KPI
            </Button>
          </div>
        )}
      </div>
      <DataGrid<Result> title="Kết quả đánh giá các KPI của đơn vị" rows={q.data?.rows ?? []} loading={q.isFetching} rowKey={(r) => r.id} pagination={false} columns={resultColumns(false)} />
    </Drawer>
  );
}

function ByKpiDrawer({ row, onClose }: { row: Result; onClose: () => void }) {
  const q = useQuery({ queryKey: ['bsc-by-kpi', row.evaluationKpiId], queryFn: () => get<{ rows: Result[] }>(EP.bsc.byKpi, { evalKpiId: row.evaluationKpiId }) });
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title="Kết quả đánh giá KPI theo tiêu chí" width="w-[960px]">
      <div className="mb-3 flex gap-3">
        <ReadField label="Tiêu chí KPI" value={codeName(row.kpiCode, row.kpiName)} />
        <ReadField label="Kỳ đánh giá" value={`${periodLabel(row.periodCode)} ${row.year}`} />
      </div>
      <DataGrid<Result> title="Kết quả đánh giá của các đơn vị" rows={q.data?.rows ?? []} loading={q.isFetching} rowKey={(r) => r.id} pagination={false} columns={resultColumns(true)} />
    </Drawer>
  );
}

export function useBscRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('bsc') });
}
