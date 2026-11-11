import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { ArrowLeft, ListPlus, Save, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, get, post, put } from '@/api/http';
import { EP } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Input';
import { Card, PageHeader } from '@/components/ui/Misc';
import { errorMessage, toast } from '@/components/ui/Toast';
import { TreeSelect } from '@/components/ui/TreeSelect';
import { useOrgTree } from '@/features/common/shared';
import { fmtNum, parseNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useHasPerm } from '@/stores/sessionStore';
import {
  AssignImportDialog,
  cellError,
  CUR_YEAR,
  detailPayload,
  EditTable,
  mergeParsed,
  NumCell,
  ReadNum,
  rowFromDetail,
  rowsHaveErrors,
  StatusBadge,
  useSum,
  VAL_KEYS,
  VAL_LABEL,
  yearOptions,
  type AssignHeader,
  type EditRow,
  type ValKey,
} from '../components/common';
import { KpiPickerDialog } from '../components/KpiPickerDialog';

/** Sắp xếp: KPI con ngay sau KPI cha */
function orderByParent(rows: EditRow[]): EditRow[] {
  const ids = new Set(rows.map((r) => r.kpiId));
  const out: EditRow[] = [];
  for (const r of rows) {
    if (r.parentKpiId != null && ids.has(r.parentKpiId)) continue;
    out.push(r);
    rows.filter((c) => c.parentKpiId === r.kpiId).forEach((c) => out.push(c));
  }
  return out;
}

/** 30.1 Thêm mới / 30.2 Ghi lại / 29.3 Xem chi tiết – Giao KPI theo đơn vị */
export function AssignByUnitEditPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const search = useSearch({ strict: false }) as { mode?: string };
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = id === 'new';
  const canImport = useHasPerm('ASSIGN:IMPORT');
  const canSave = useHasPerm(isNew ? 'ASSIGN:CREATE' : 'ASSIGN:UPDATE');
  const orgs = useOrgTree({ mine: true, assignableOnly: true });
  const header = useQuery({ queryKey: ['assign-unit', id], queryFn: () => get<AssignHeader>(EP.assignByUnit.one(id)), enabled: !isNew });
  const h = header.data;
  const view = !isNew && (search.mode === 'view' || (!!h && h.status !== 'DANG_SOAN'));

  const [orgUnitId, setOrgUnitId] = useState<number | null>(null);
  const [year, setYear] = useState(String(CUR_YEAR));
  const [rows, setRows] = useState<EditRow[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState(false);
  const [imp, setImp] = useState(false);
  const [imported, setImported] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!h) return;
    setOrgUnitId(h.orgUnitId);
    setYear(String(h.year));
    setRows(h.details.map((d) => rowFromDetail(d, String(d.kpiId))));
  }, [h]);

  const ordered = useMemo(() => orderByParent(rows), [rows]);
  const total = useSum(rows);
  const existing = useMemo(() => new Set(rows.map((r) => r.kpiId)), [rows]);
  const back = () => navigate({ to: '/kpi-admin/assignments', search: { tab: 'unit' } });

  const setVal = (key: string, k: ValKey, v: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, vals: { ...r.vals, [k]: v } } : r)));
  const setNote = (key: string, v: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, note: v } : r)));
  const removeRow = (r: EditRow) => setRows((rs) => rs.filter((x) => x.key !== r.key && x.parentKpiId !== r.kpiId));

  const save = async () => {
    const e: Record<string, string> = {};
    if (!orgUnitId) e.orgUnitId = 'Vui lòng chọn Đơn vị được giao';
    if (!year) e.year = 'Vui lòng chọn Năm giao';
    setErrs(e);
    if (Object.keys(e).length || rowsHaveErrors(rows)) {
      toast.error('Dữ liệu không hợp lệ');
      return;
    }
    const body = { orgUnitId, year: Number(year), details: ordered.map(detailPayload), source: imported ? 'IMPORT' : undefined };
    setBusy(true);
    try {
      const r = isNew ? await post<{ header: AssignHeader; warnings: string[] }>(EP.assignByUnit.list, body) : await put<{ header: AssignHeader; warnings: string[] }>(EP.assignByUnit.one(id), body);
      toast.success(isNew ? 'Thêm mới thành công' : 'Cập nhật thành công');
      (r.data?.warnings ?? []).forEach((w) => toast.info(w));
      qc.invalidateQueries({ queryKey: ['assign-by-unit'] });
      qc.invalidateQueries({ queryKey: ['assign-unit', id] });
      back();
    } catch (er) {
      if (er instanceof ApiError && er.fieldErrors.length) {
        const fe: Record<string, string> = {};
        er.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrs(fe);
      }
      toast.error(errorMessage(er));
    } finally {
      setBusy(false);
    }
  };

  const title = view ? 'Xem chi tiết giao KPI theo đơn vị' : 'Giao KPI theo đơn vị';
  const headers = [
    { text: 'STT', align: 'center' as const, width: 40 },
    { text: 'Mã – Tên tiêu chí KPI', width: 260 },
    { text: 'Viễn cảnh', width: 110 },
    { text: 'Đơn vị đo', width: 80 },
    ...VAL_KEYS.map((k) => ({ text: VAL_LABEL[k], align: 'right' as const, width: 80 })),
    { text: 'Ghi chú', width: 140 },
    ...(view ? [] : [{ text: '', width: 40 }]),
  ];
  let stt = 0;

  return (
    <div>
      <PageHeader
        title={title}
        actions={
          <>
            {!view && canImport && (
              <Button variant="outline" onClick={() => setImp(true)}>
                <Upload className="h-4 w-4" />
                Nhập dữ liệu
              </Button>
            )}
            {!view && canSave && (
              <Button onClick={save} loading={busy}>
                <Save className="h-4 w-4" />
                Lưu
              </Button>
            )}
            <Button variant="outline" onClick={back}>
              <ArrowLeft className="h-4 w-4" />
              Quay lại
            </Button>
          </>
        }
      />
      <Card className="mb-3">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Đơn vị được giao" required error={errs.orgUnitId}>
            <TreeSelect aria-label="Đơn vị được giao" nodes={orgs.data ?? []} value={orgUnitId} onChange={setOrgUnitId} disabled={!isNew} placeholder={h?.orgUnitName ?? 'Chọn…'} />
          </Field>
          <Field label="Năm giao" required error={errs.year} htmlFor="au-year">
            <Select id="au-year" options={yearOptions(CUR_YEAR, 3)} value={year} onChange={(e) => setYear(e.target.value)} disabled={!isNew} />
          </Field>
          {h && (
            <div>
              <span className="mb-1 block text-[13px] font-medium text-slate-700">Trạng thái</span>
              <StatusBadge status={h.status} />
            </div>
          )}
        </div>
      </Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Danh sách tiêu chí KPI giao</h3>
        {!view && (
          <Button variant="outline" size="sm" onClick={() => setPicker(true)}>
            <ListPlus className="h-4 w-4" />
            Chọn tiêu chí KPI
          </Button>
        )}
      </div>
      <EditTable
        label="Danh sách tiêu chí KPI giao"
        headers={headers}
        footer={
          <tr className="border-t border-border bg-slate-50 font-semibold">
            <td className="px-2 py-2" colSpan={4}>
              Tổng trọng số
            </td>
            <td className={cn('px-2 py-2 text-right', Math.abs(total - 100) > 1e-9 && 'text-danger')} data-testid="total-weight">
              {fmtNum(total, 2)}
            </td>
            <td colSpan={view ? 7 : 8} />
          </tr>
        }
      >
        {ordered.map((r) => {
          const child = r.parentKpiId != null;
          const locked = view || (!!r.status && r.status !== 'DANG_SOAN');
          const label = child ? '' : String(++stt);
          return (
            <tr key={r.key} className={cn('border-b border-border', child && 'bg-slate-50/60')} data-row-key={r.kpiCode}>
              <td className="px-2 py-1.5 text-center text-slate-500">{label}</td>
              <td className="px-2 py-1.5" style={{ paddingLeft: child ? 24 : undefined }}>
                {child && <span className="mr-1 text-slate-400">↳</span>}
                <b>{r.kpiCode}</b> – {r.kpiName}
              </td>
              <td className="px-2 py-1.5">
                <span className="inline-flex items-center gap-1">
                  {r.perspectiveColor && <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.perspectiveColor }} />}
                  {r.perspectiveName}
                </span>
              </td>
              <td className="px-2 py-1.5">{r.unitOfMeasureName}</td>
              {VAL_KEYS.map((k) => (
                <td key={k} className="px-1 py-1.5 text-right align-top">
                  {locked ? <ReadNum v={parseNum(r.vals[k])} /> : <NumCell label={`${VAL_LABEL[k]} ${r.kpiCode}`} value={r.vals[k]} onChange={(v) => setVal(r.key, k, v)} error={cellError(k, r.vals[k])} />}
                </td>
              ))}
              <td className="px-1 py-1.5 align-top">
                {locked ? r.note : <Input aria-label={`Ghi chú ${r.kpiCode}`} className="h-8 text-[13px]" value={r.note} onChange={(e) => setNote(r.key, e.target.value)} />}
              </td>
              {!view && (
                <td className="px-1 py-1.5 text-center align-top">
                  {!locked && (
                    <Button variant="ghost" size="icon" aria-label="Xóa dòng" onClick={() => removeRow(r)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  )}
                </td>
              )}
            </tr>
          );
        })}
        {!ordered.length && (
          <tr>
            <td colSpan={headers.length} className="py-8 text-center text-muted">
              {header.isFetching ? 'Đang tải…' : 'Chưa có tiêu chí KPI. Nhấn “Chọn tiêu chí KPI” để thêm.'}
            </td>
          </tr>
        )}
      </EditTable>
      <KpiPickerDialog
        open={picker}
        onOpenChange={setPicker}
        existing={existing}
        onPick={(ks) =>
          setRows((rs) => {
            const have = new Set(rs.map((r) => r.kpiId));
            const add = ks
              .filter((k) => !have.has(k.id))
              .map<EditRow>((k) => ({
                key: String(k.id),
                kpiId: k.id,
                kpiCode: k.code,
                kpiName: k.name,
                parentKpiId: k.parentId,
                perspectiveName: k.perspectiveName,
                unitOfMeasureName: k.unitOfMeasureName,
                orgUnitId: orgUnitId ?? 0,
                orgUnitCode: '',
                orgUnitName: '',
                vals: { weight: '', targetQ1: '', targetQ2: '', targetH1: '', targetQ3: '', targetQ4: '', targetYear: '' },
                note: '',
              }));
            return [...rs, ...add];
          })
        }
      />
      <AssignImportDialog
        open={imp}
        onOpenChange={setImp}
        mode="unit"
        onRows={(parsed) => {
          setImported(true);
          setRows((rs) =>
            mergeParsed(
              rs,
              parsed,
              (p) => (p.kpiId ? String(p.kpiId) : null),
              (p) => ({
                key: String(p.kpiId),
                kpiId: p.kpiId!,
                kpiCode: p.kpiCode ?? '',
                kpiName: p.kpiName ?? '',
                parentKpiId: p.parentKpiId,
                perspectiveName: p.perspectiveName ?? undefined,
                unitOfMeasureName: p.unitOfMeasureName ?? undefined,
                orgUnitId: orgUnitId ?? 0,
                orgUnitCode: '',
                orgUnitName: '',
                vals: { weight: '', targetQ1: '', targetQ2: '', targetH1: '', targetQ3: '', targetQ4: '', targetYear: '' },
                note: '',
              }),
            ),
          );
        }}
      />
    </div>
  );
}
