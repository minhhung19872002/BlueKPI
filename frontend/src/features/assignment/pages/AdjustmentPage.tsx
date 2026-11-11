import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, Lock, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, get, post } from '@/api/http';
import { EP } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import { confirm } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, ReadField, Textarea } from '@/components/ui/Input';
import { Card, PageHeader } from '@/components/ui/Misc';
import { errorMessage, toast } from '@/components/ui/Toast';
import { COMPLETION } from '@/features/catalog/hooks';
import { labelOf } from '@/features/common/shared';
import { fmtDate, fmtDateTime, fmtNum, parseNum, parseViDate } from '@/lib/format';
import { useHasPerm } from '@/stores/sessionStore';
import { EditTable, NumCell, numToInput, PERIODS, periodLabel, type AssignDetail, type PeriodCode } from '../components/common';

interface AdjustmentData {
  kpi: {
    id: number;
    code: string;
    name: string;
    unitOfMeasureName?: string;
    scoringMethodName?: string;
    completionFormula?: string;
  };
  year: number;
  status: string | null;
  statusName: string;
  details: AssignDetail[];
  lockedPeriods: string[];
  draft: null | {
    id: number;
    decisionNo: string;
    decisionDate: string;
    reason: string;
    lines: { detailId: number; periodCode: string; newValue: number | null }[];
  };
}

interface HistoryRow {
  lan: number;
  decisionNo: string;
  decisionDate: string;
  reason: string;
  periodCode: string;
  oldValue: number | null;
  newValue: number | null;
  by: string;
  at: string;
}

const effective = (d: AssignDetail, p: (typeof PERIODS)[number]) => (d[p.adj] ?? d[p.field]) as number | null;

/** 34.1–34.3 “Điều chỉnh mục tiêu giao KPI” */
export function AdjustmentPage() {
  const params = useParams({ strict: false }) as {
    kpiId: string;
    year: string;
  };
  const kpiId = Number(params.kpiId);
  const year = Number(params.year);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canAdjust = useHasPerm('ASSIGN:ADJUST');
  const q = useQuery({
    queryKey: ['assign-adjust', kpiId, year],
    queryFn: () => get<AdjustmentData>(EP.assignByKpi.adjustment(kpiId, year)),
  });
  const data = q.data;

  const [decisionNo, setDecisionNo] = useState('');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [unitKw, setUnitKw] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState<AssignDetail | null>(null);

  useEffect(() => {
    if (!data) return;
    const dr = data.draft;
    setDecisionNo(dr?.decisionNo ?? '');
    setDate(dr?.decisionDate ? fmtDate(dr.decisionDate) : '');
    setReason(dr?.reason ?? '');
    const v: Record<string, string> = {};
    dr?.lines.forEach((l) => {
      if (l.newValue !== null && l.newValue !== undefined) v[`${l.detailId}:${l.periodCode}`] = numToInput(l.newValue);
    });
    setVals(v);
  }, [data]);

  const locked = useMemo(() => new Set(data?.lockedPeriods ?? []), [data]);
  const rows = useMemo(() => {
    const k = unitKw.trim().toLowerCase();
    return (data?.details ?? []).filter((d) => !k || d.orgUnitName.toLowerCase().includes(k) || d.orgUnitCode.toLowerCase().includes(k));
  }, [data, unitKw]);

  const cellErr = (s: string | undefined) => {
    if (!s?.trim()) return null;
    const n = parseNum(s);
    if (n === null) return 'Giá trị không hợp lệ';
    return n < 0 ? 'Giá trị phải lớn hơn hoặc bằng 0' : null;
  };

  const submit = async (kind: 'draft' | 'commit') => {
    const e: Record<string, string> = {};
    if (!decisionNo.trim()) e.decisionNo = 'Vui lòng nhập Quyết định điều chỉnh số';
    const iso = date.trim() ? parseViDate(date.trim()) : null;
    if (!date.trim()) e.decisionDate = 'Vui lòng nhập Ngày';
    else if (!iso) e.decisionDate = 'Ngày không hợp lệ (dd/mm/yyyy)';
    if (!reason.trim()) e.reason = 'Vui lòng nhập Lý do điều chỉnh';
    setErrs(e);
    const bad = Object.values(vals).some((v) => cellErr(v));
    if (Object.keys(e).length || bad) {
      toast.error('Dữ liệu không hợp lệ');
      return;
    }
    const lines = Object.entries(vals)
      .filter(([, v]) => v.trim() !== '')
      .map(([k, v]) => {
        const [detailId, periodCode] = k.split(':');
        return {
          detailId: Number(detailId),
          periodCode,
          newValue: parseNum(v),
        };
      });
    if (kind === 'commit') {
      const ok = await confirm({
        title: 'Lưu chốt điều chỉnh',
        message: 'Xác nhận lưu chốt điều chỉnh mục tiêu giao KPI? Sau khi chốt, mục tiêu mới sẽ được áp dụng.',
        confirmText: 'Xác nhận',
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const body = {
        decisionNo: decisionNo.trim(),
        decisionDate: iso,
        reason: reason.trim(),
        lines,
      };
      const r = await post(kind === 'draft' ? EP.assignByKpi.adjustmentDraft(kpiId, year) : EP.assignByKpi.adjustmentCommit(kpiId, year), body);
      toast.success(kind === 'draft' ? 'Lưu nháp thành công' : r.message || 'Lưu chốt điều chỉnh thành công');
      qc.invalidateQueries({ queryKey: ['assign-by-kpi'] });
      await q.refetch();
    } catch (er) {
      if (er instanceof ApiError && er.fieldErrors.length) setErrs(Object.fromEntries(er.fieldErrors.map((f) => [f.field, f.message])));
      toast.error(errorMessage(er));
    } finally {
      setBusy(false);
    }
  };

  const headers = [
    { text: 'STT', align: 'center' as const, width: 40 },
    { text: 'Đơn vị được giao', width: 200 },
    { text: 'Trọng số', align: 'right' as const, width: 60 },
    ...PERIODS.flatMap((p) => [
      { text: p.label, align: 'right' as const, width: 70 },
      { text: `${p.label} – ĐC`, align: 'right' as const, width: 80 },
    ]),
    { text: 'Thao tác', width: 70 },
  ];

  return (
    <div>
      <PageHeader
        title="Điều chỉnh mục tiêu giao KPI"
        actions={
          <>
            {canAdjust && (
              <>
                <Button variant="outline" onClick={() => submit('draft')} loading={busy}>
                  <Save className="h-4 w-4" />
                  Lưu nháp
                </Button>
                <Button onClick={() => submit('commit')} loading={busy}>
                  <Lock className="h-4 w-4" />
                  Lưu chốt
                </Button>
              </>
            )}
            <Button
              variant="outline"
              onClick={() =>
                navigate({
                  to: '/kpi-admin/assignments',
                  search: { tab: 'kpi' },
                })
              }
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </Button>
          </>
        }
      />
      <Card title="Thông tin chung" className="mb-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <ReadField label="Cập nhật mục tiêu giao cho KPI" value={data ? `${data.kpi.code} – ${data.kpi.name}` : ''} className="col-span-2 md:col-span-3" />
          <ReadField label="Năm" value={data?.year} />
          <ReadField label="Đơn vị đo" value={data?.kpi.unitOfMeasureName} />
          <ReadField label="Phương pháp tính điểm" value={data?.kpi.scoringMethodName} />
          <ReadField label="CT tính tỷ lệ hoàn thành" value={labelOf(COMPLETION, data?.kpi.completionFormula)} />
          <ReadField label="Tình trạng" value={<span data-testid="adjust-status">{data?.statusName}</span>} />
        </div>
      </Card>
      {data && (
        <Card className="mb-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Quyết định điều chỉnh số" required error={errs.decisionNo} htmlFor="adj-no">
              <Input id="adj-no" value={decisionNo} onChange={(e) => setDecisionNo(e.target.value)} aria-invalid={!!errs.decisionNo} />
            </Field>
            <Field label="Ngày" required error={errs.decisionDate} htmlFor="adj-date">
              <Input id="adj-date" placeholder="dd/mm/yyyy" value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errs.decisionDate} />
            </Field>
            <Field label="Đơn vị" htmlFor="adj-unit">
              <Input id="adj-unit" placeholder="Lọc theo mã hoặc tên đơn vị" value={unitKw} onChange={(e) => setUnitKw(e.target.value)} />
            </Field>
            <Field label="Lý do điều chỉnh" required error={errs.reason} htmlFor="adj-reason" className="md:col-span-3">
              <Textarea id="adj-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!errs.reason} />
            </Field>
          </div>
        </Card>
      )}
      {data?.lockedPeriods.length ? <p className="mb-2 text-[13px] text-amber-700">Kỳ đã chốt đánh giá, không được điều chỉnh: {data.lockedPeriods.map(periodLabel).join(', ')}</p> : null}
      <EditTable label="Danh sách đơn vị điều chỉnh" headers={headers}>
        {rows.map((d, i) => (
          <tr key={d.id} className="border-b border-border" data-row-key={d.orgUnitCode}>
            <td className="px-2 py-1.5 text-center text-slate-500">{i + 1}</td>
            <td className="px-2 py-1.5">{d.orgUnitName}</td>
            <td className="px-2 py-1.5 text-right">{fmtNum(d.weight, 2)}</td>
            {PERIODS.map((p) => {
              const k = `${d.id}:${p.code}`;
              return [
                <td key={p.code} className="px-2 py-1.5 text-right tabular-nums">
                  {fmtNum(effective(d, p), 2)}
                </td>,
                <td key={`${p.code}-dc`} className="px-1 py-1.5 align-top">
                  <NumCell
                    label={`${p.label} – ĐC ${d.orgUnitCode}`}
                    value={vals[k] ?? ''}
                    disabled={locked.has(p.code as PeriodCode) || !canAdjust}
                    onChange={(v) => setVals((s) => ({ ...s, [k]: v }))}
                    error={cellErr(vals[k])}
                  />
                </td>,
              ];
            })}
            <td className="px-2 py-1.5">
              <Button variant="link" size="sm" className="h-auto" onClick={() => setHist(d)}>
                Lịch sử
              </Button>
            </td>
          </tr>
        ))}
        {!rows.length && (
          <tr>
            <td colSpan={headers.length} className="py-8 text-center text-muted">
              {q.isFetching ? 'Đang tải…' : 'Không có dữ liệu'}
            </td>
          </tr>
        )}
      </EditTable>
      {hist && <HistoryDialog detail={hist} onClose={() => setHist(null)} />}
    </div>
  );
}

/** 34.3 “Lịch sử điều chỉnh” */
function HistoryDialog({ detail, onClose }: { detail: AssignDetail; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['assign-history', detail.id],
    queryFn: () => get<HistoryRow[]>(EP.assignHistory(detail.id)),
  });
  const rows = q.data ?? [];
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Lịch sử điều chỉnh"
      description={`${detail.orgUnitName} – ${detail.kpiCode} – ${detail.year}`}
      size="xl"
      footer={
        <Button variant="outline" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      <EditTable
        label="Lịch sử điều chỉnh"
        headers={[
          { text: 'Lần', align: 'center' },
          { text: 'Quyết định số' },
          { text: 'Ngày' },
          { text: 'Lý do' },
          { text: 'Kỳ' },
          { text: 'Giá trị trước', align: 'right' },
          { text: 'Giá trị sau', align: 'right' },
          { text: 'Người thực hiện' },
          { text: 'Thời điểm' },
        ]}
      >
        {rows.map((h, i) => (
          <tr key={i} className="border-b border-border">
            <td className="px-2 py-1.5 text-center">{h.lan}</td>
            <td className="px-2 py-1.5">{h.decisionNo}</td>
            <td className="px-2 py-1.5">{fmtDate(h.decisionDate)}</td>
            <td className="px-2 py-1.5">{h.reason}</td>
            <td className="px-2 py-1.5">{periodLabel(h.periodCode)}</td>
            <td className="px-2 py-1.5 text-right">{fmtNum(h.oldValue, 2)}</td>
            <td className="px-2 py-1.5 text-right">{fmtNum(h.newValue, 2)}</td>
            <td className="px-2 py-1.5">{h.by}</td>
            <td className="px-2 py-1.5">{fmtDateTime(h.at)}</td>
          </tr>
        ))}
        {!rows.length && (
          <tr>
            <td colSpan={9} className="py-6 text-center text-muted">
              {q.isFetching ? 'Đang tải…' : 'Chưa có lần điều chỉnh'}
            </td>
          </tr>
        )}
      </EditTable>
    </Dialog>
  );
}
