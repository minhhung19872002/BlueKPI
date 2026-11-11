import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { Loader2, RefreshCw, Save, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { get, post, put } from '@/api/http';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { FilterItem, SearchBar } from '@/components/data-grid/SearchBar';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, ReadField, Select } from '@/components/ui/Input';
import { Badge, Card, PageHeader } from '@/components/ui/Misc';
import { errorMessage, toast } from '@/components/ui/Toast';
import { fmtNum, parseNum } from '@/lib/format';
import { useHasPerm } from '@/stores/sessionStore';
import { numStr, RatingBadge, ResultStatusBadge } from '../components/common';
import {
  COMPLETION_OPTIONS,
  EDITABLE_RESULT_STATUS,
  EVAL_KPI_STATUS,
  evalKpiStatusColor,
  lbl,
  periodLabel,
  RATING_OPTIONS,
  RESULT_TYPE_OPTIONS,
  TARGET_DATA_TYPE_OPTIONS,
} from '../components/labels';
import { ManualImportDialog } from '../components/ManualImportDialog';
import type { EvalHeader, PreviewRow, Result } from '../components/types';

interface RowEdit {
  kpiResult?: string;
  comps?: Record<number, string>;
  adjustment: string;
  description: string;
}

interface SyncOutcome {
  batchId: number;
  total: number;
  success: number;
  failed: number;
  running: boolean;
  message: string;
}

interface SyncBatch {
  batch: { status: string; success: number; failed: number; total: number; message?: string };
  running: boolean;
  errors: { unitCode?: string; unitName?: string; formulaCode?: string; request?: string; error?: string }[];
}

/** 39.3 / 43.1 / 44.1 / 44.2 “Cập nhật kết quả KPI cho tất cả đơn vị” */
export function EvaluationEditPage() {
  const { evalKpiId } = useParams({ strict: false }) as { evalKpiId: string };
  const id = Number(evalKpiId);
  const search = useSearch({ strict: false }) as { mode?: string };
  const navigate = useNavigate();
  const canInput = useHasPerm('EVAL:INPUT');
  const canSync = useHasPerm('EVAL:SYNC');
  const canImport = useHasPerm('EVAL:IMPORT');

  const header = useQuery({ queryKey: ['eval-header', id], queryFn: () => get<EvalHeader>(EP.evaluations.byKpiOne(id)) });
  const [draft, setDraft] = useState({ keyword: '', rating: '' });
  const [applied, setApplied] = useState({ keyword: '', rating: '' });
  const results = useQuery({
    queryKey: ['eval-results', id, applied],
    queryFn: () => get<Result[]>(EP.evaluations.results(id), { keyword: applied.keyword || undefined, rating: applied.rating || undefined }),
  });

  const ek = header.data?.evalKpi;
  const comps = useMemo(() => header.data?.components ?? [], [header.data]);
  const single = comps.length === 1 && comps[0].source === 'NHAP_TAY';
  const readOnly = search.mode === 'view' || !!header.data?.locked || ek?.status === 'CHOT_KQ_R2';
  const editable = (r: Result) => !readOnly && canInput && EDITABLE_RESULT_STATUS.includes(r.status);

  const [edits, setEdits] = useState<Record<number, RowEdit>>({});
  const [preview, setPreview] = useState<Record<number, PreviewRow>>({});
  const [pending, setPending] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [compDlg, setCompDlg] = useState<Result | null>(null);
  const [imp, setImp] = useState(false);
  const [sync, setSync] = useState<{ running: boolean; text?: string; batchId?: number; failed?: number } | null>(null);
  const [errDlg, setErrDlg] = useState<number | null>(null);

  const baseEdit = (r: Result): RowEdit => ({
    kpiResult: numStr(r.kpiResult),
    comps: Object.fromEntries((r.components ?? []).filter((c) => c.source === 'NHAP_TAY').map((c) => [c.componentId, numStr(c.value)])),
    adjustment: numStr(r.adjustment),
    description: r.description ?? '',
  });

  const change = (r: Result, patch: Partial<RowEdit>) => {
    setEdits((s) => ({ ...s, [r.id]: { ...(s[r.id] ?? baseEdit(r)), ...patch } }));
    setPending((p) => new Set(p).add(r.id));
  };

  const toInput = (resultId: number, e: RowEdit) => {
    return {
      resultId,
      ...(single ? { kpiResult: parseNum(e.kpiResult) } : {}),
      ...(!single && e.comps
        ? {
            components: Object.entries(e.comps).map(([cid, v]) => ({ componentId: Number(cid), value: parseNum(v) })),
          }
        : {}),
      adjustment: parseNum(e.adjustment),
      description: e.description || null,
    };
  };

  // 44.1 Tính thử Kết quả cuối / Điểm / Đánh giá sau 300ms
  useEffect(() => {
    if (!pending.size) return;
    const t = setTimeout(() => {
      const ids = [...pending];
      setPending(new Set());
      const rows = ids.filter((i) => edits[i]).map((i) => toInput(i, edits[i]));
      if (!rows.length) return;
      post<PreviewRow[]>(EP.evaluations.preview(id), { rows })
        .then((res) => setPreview((p) => ({ ...p, ...Object.fromEntries((res.data ?? []).map((x) => [x.resultId, x])) })))
        .catch((e) => toast.error(errorMessage(e)));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, edits, id]);

  const reload = () => {
    header.refetch();
    results.refetch();
  };

  const save = async () => {
    const rows = Object.entries(edits).map(([rid, e]) => toInput(Number(rid), e));
    if (!rows.length) {
      toast.info('Không có thay đổi để lưu');
      return;
    }
    setSaving(true);
    try {
      const res = await put<Result[]>(EP.evaluations.results(id), { rows });
      toast.success(res.message || 'Lưu kết quả thành công');
      setEdits({});
      setPreview({});
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const doSync = async () => {
    setSync({ running: true, text: 'Đang đồng bộ...' });
    try {
      const res = await post<SyncOutcome>(EP.evaluations.sync(id));
      let out = res.data!;
      let message = res.message || out.message;
      while (out.running) {
        await new Promise((ok) => setTimeout(ok, 1000));
        const b = await get<SyncBatch>(EP.evaluations.syncStatus(out.batchId));
        out = { ...out, running: b.running, success: b.batch.success, failed: b.batch.failed, total: b.batch.total };
        message = b.batch.message || `Đồng bộ thành công ${out.success}/${out.total} đơn vị; lỗi ${out.failed}`;
        setSync({ running: b.running, text: `Đang đồng bộ ${out.success + out.failed}/${out.total} đơn vị...`, batchId: out.batchId });
      }
      toast.success(message);
      setSync({ running: false, text: message, batchId: out.batchId, failed: out.failed });
      setEdits({});
      setPreview({});
      reload();
    } catch (e) {
      toast.error(errorMessage(e));
      setSync(null);
    }
  };

  const valOf = (r: Result) => edits[r.id] ?? baseEdit(r);
  const pv = (r: Result) => preview[r.id];

  return (
    <div>
      <PageHeader
        title="Cập nhật kết quả KPI cho tất cả đơn vị"
        actions={
          <>
            {!readOnly && canSync && (
              <Button variant="outline" onClick={doSync} loading={sync?.running}>
                {!sync?.running && <RefreshCw className="h-4 w-4" />}
                Đồng bộ lại
              </Button>
            )}
            {!readOnly && canImport && (
              <Button variant="outline" onClick={() => setImp(true)}>
                <Upload className="h-4 w-4" />
                Nhập dữ liệu
              </Button>
            )}
            {!readOnly && canInput && (
              <Button onClick={save} loading={saving}>
                {!saving && <Save className="h-4 w-4" />}
                Lưu
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate({ to: '/kpi-admin/evaluations', search: { tab: 'kpi' } })}>
              <X className="h-4 w-4" />
              Đóng
            </Button>
          </>
        }
      />
      {sync && (
        <div className="mb-3 flex items-center gap-2 rounded border border-border bg-slate-50 px-3 py-2 text-sm" data-testid="sync-status">
          {sync.running && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          <span>{sync.text}</span>
          {!sync.running && !!sync.failed && sync.batchId && (
            <button type="button" className="text-primary underline" onClick={() => setErrDlg(sync.batchId!)}>
              Xem lỗi
            </button>
          )}
        </div>
      )}
      <Card title="Thông tin chung" className="mb-3">
        {ek ? (
          <div className="grid grid-cols-4 gap-3">
            <ReadField label="Mã KPI" value={ek.kpiCode} />
            <ReadField label="Tên tiêu chí" value={ek.kpiName} className="col-span-3" />
            <ReadField label="Kỳ đánh giá" value={`${periodLabel(ek.periodCode)} ${ek.year}`} />
            <ReadField label="Đơn vị đo" value={ek.unitOfMeasureName} />
            <ReadField label="Nguồn số liệu" value={lbl(RESULT_TYPE_OPTIONS, ek.dataSource ?? ek.resultType)} />
            <ReadField label="Mã KPI cha" value={ek.parentKpiCode} />
            <ReadField label="Tình trạng" value={<Badge color={evalKpiStatusColor(ek.status)}>{lbl(EVAL_KPI_STATUS, ek.status)}</Badge>} />
            <ReadField label="Loại số liệu" value={lbl(TARGET_DATA_TYPE_OPTIONS, ek.targetDataType)} />
            <ReadField label="Phương pháp tính điểm" value={ek.scoringMethodName} />
            <ReadField label="Công thức tính tỷ lệ hoàn thành" value={lbl(COMPLETION_OPTIONS, ek.completionFormula)} />
          </div>
        ) : header.isError ? (
          <div className="text-sm text-danger">{errorMessage(header.error)}</div>
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        )}
      </Card>
      <SearchBar
        keyword={draft.keyword}
        onKeywordChange={(v) => setDraft((d) => ({ ...d, keyword: v }))}
        placeholder="Tìm theo mã hoặc tên đơn vị"
        onSearch={() => setApplied(draft)}
        onReset={() => {
          setDraft({ keyword: '', rating: '' });
          setApplied({ keyword: '', rating: '' });
        }}
      >
        <FilterItem label="Đánh giá" width="w-40">
          <Select aria-label="Đánh giá" placeholder="Tất cả" options={RATING_OPTIONS} value={draft.rating} onChange={(e) => setDraft((d) => ({ ...d, rating: e.target.value }))} />
        </FilterItem>
      </SearchBar>
      <h3 className="mb-2 text-sm font-semibold">Danh sách đơn vị được giao</h3>
      <DataGrid<Result>
        title="Danh sách đơn vị được giao"
        rows={results.data ?? []}
        loading={results.isFetching}
        pagination={false}
        rowKey={(r) => r.id}
        columns={[
          { key: 'orgUnitCode', header: 'Mã đơn vị', width: 90 },
          { key: 'orgUnitName', header: 'Đơn vị được giao', width: 170 },
          { key: 'planValue', header: 'KH giao', align: 'right', width: 80, render: (r) => fmtNum(r.planValue, 2) },
          {
            key: 'kpiResult',
            header: 'Kết quả KPI',
            align: 'right',
            width: 120,
            render: (r) =>
              single && editable(r) ? (
                <Input
                  aria-label={`Kết quả KPI ${r.orgUnitCode}`}
                  className="h-8 w-24 text-right"
                  inputMode="decimal"
                  value={valOf(r).kpiResult ?? ''}
                  onChange={(e) => change(r, { kpiResult: e.target.value })}
                />
              ) : (
                <div className="flex flex-col items-end gap-0.5">
                  <span>{fmtNum(pv(r)?.kpiResult ?? r.kpiResult, 2)}</span>
                  {!single && editable(r) && comps.some((c) => c.source === 'NHAP_TAY') && (
                    <Button variant="link" size="sm" className="h-auto text-xs" onClick={() => setCompDlg(r)}>
                      Nhập thành phần
                    </Button>
                  )}
                </div>
              ),
          },
          { key: 'prevAdjustment', header: 'ĐC kỳ trước', align: 'right', width: 80, render: (r) => fmtNum(r.prevAdjustment, 2) },
          {
            key: 'adjustment',
            header: 'Điều chỉnh',
            align: 'right',
            width: 100,
            render: (r) =>
              editable(r) ? (
                <Input
                  aria-label={`Điều chỉnh ${r.orgUnitCode}`}
                  className="h-8 w-20 text-right"
                  inputMode="decimal"
                  value={valOf(r).adjustment}
                  onChange={(e) => change(r, { adjustment: e.target.value })}
                />
              ) : (
                fmtNum(r.adjustment, 2)
              ),
          },
          {
            key: 'finalResult',
            header: 'Kết quả cuối',
            align: 'right',
            width: 90,
            render: (r) => (
              <span data-testid={`final-${r.orgUnitCode}`}>
                {fmtNum(pv(r) ? pv(r).finalResult : r.finalResult, 2)}
                {pv(r)?.error && <span className="block text-xs text-danger">{pv(r).error}</span>}
              </span>
            ),
          },
          { key: 'score', header: 'Điểm', align: 'right', width: 60, render: (r) => <span data-testid={`score-${r.orgUnitCode}`}>{fmtNum(pv(r) ? pv(r).score : r.score, 2)}</span> },
          { key: 'rating', header: 'Đánh giá', width: 100, render: (r) => <RatingBadge rating={pv(r) ? pv(r).rating : r.rating} /> },
          { key: 'status', header: 'Tình trạng', width: 120, render: (r) => <ResultStatusBadge status={r.status} /> },
          {
            key: 'description',
            header: 'Mô tả',
            width: 150,
            render: (r) =>
              editable(r) ? (
                <Input aria-label={`Mô tả ${r.orgUnitCode}`} className="h-8" value={valOf(r).description} onChange={(e) => change(r, { description: e.target.value })} />
              ) : (
                r.description
              ),
          },
        ]}
      />
      {compDlg && (
        <ComponentsDialog
          row={compDlg}
          initial={valOf(compDlg).comps ?? {}}
          onClose={() => setCompDlg(null)}
          onOk={(v) => {
            change(compDlg, { comps: v });
            setCompDlg(null);
          }}
        />
      )}
      {imp && <ManualImportDialog evalKpiId={id} components={comps} onClose={() => setImp(false)} onDone={reload} />}
      {errDlg !== null && <SyncErrorsDialog batchId={errDlg} onClose={() => setErrDlg(null)} />}
    </div>
  );
}

/** “Nhập thành phần” cho một đơn vị (thành phần API chỉ đọc) */
function ComponentsDialog({ row, initial, onClose, onOk }: { row: Result; initial: Record<number, string>; onClose: () => void; onOk: (v: Record<number, string>) => void }) {
  const [vals, setVals] = useState<Record<number, string>>(initial);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Nhập thành phần – ${row.orgUnitCode} – ${row.orgUnitName}`}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={() => onOk(vals)}>Xác nhận</Button>
        </>
      }
    >
      <table className="w-full text-[13px]" aria-label="Thành phần KPI">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-2 py-1 text-left">Mã thành phần</th>
            <th className="px-2 py-1 text-left">Tên thành phần</th>
            <th className="px-2 py-1 text-left">Nguồn</th>
            <th className="px-2 py-1 text-right">Giá trị</th>
          </tr>
        </thead>
        <tbody>
          {(row.components ?? []).map((c) => (
            <tr key={c.componentId} className="border-t border-border">
              <td className="px-2 py-1">{c.code}</td>
              <td className="px-2 py-1">{c.name}</td>
              <td className="px-2 py-1">{c.source === 'API' ? 'API' : 'Nhập tay'}</td>
              <td className="px-2 py-1 text-right">
                {c.source === 'NHAP_TAY' ? (
                  <Input
                    aria-label={`Giá trị ${c.code}`}
                    className="h-8 w-28 text-right"
                    inputMode="decimal"
                    value={vals[c.componentId] ?? ''}
                    onChange={(e) => setVals((s) => ({ ...s, [c.componentId]: e.target.value }))}
                  />
                ) : (
                  fmtNum(c.value, 2)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}

/** “Xem lỗi” đồng bộ */
function SyncErrorsDialog({ batchId, onClose }: { batchId: number; onClose: () => void }) {
  const q = useQuery({ queryKey: ['sync-batch', batchId], queryFn: () => get<SyncBatch>(EP.evaluations.syncStatus(batchId)) });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Danh sách lỗi đồng bộ" size="lg">
      <table className="w-full text-[13px]" aria-label="Danh sách lỗi đồng bộ">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-2 py-1 text-left">Mã đơn vị</th>
            <th className="px-2 py-1 text-left">Tên đơn vị</th>
            <th className="px-2 py-1 text-left">Định nghĩa KPI công thức</th>
            <th className="px-2 py-1 text-left">Lỗi</th>
          </tr>
        </thead>
        <tbody>
          {(q.data?.errors ?? []).map((e, i) => (
            <tr key={i} className="border-t border-border">
              <td className="px-2 py-1">{e.unitCode}</td>
              <td className="px-2 py-1">{e.unitName}</td>
              <td className="px-2 py-1">{e.formulaCode}</td>
              <td className="px-2 py-1 text-danger">{e.error}</td>
            </tr>
          ))}
          {q.data && !q.data.errors?.length && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-muted">
                Không có lỗi
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Dialog>
  );
}
