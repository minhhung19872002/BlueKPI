import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { ArrowLeft, Save, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, get, post, put } from '@/api/http';
import { EP } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import { Field, Input, ReadField, Select } from '@/components/ui/Input';
import { Card, PageHeader } from '@/components/ui/Misc';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { errorMessage, toast } from '@/components/ui/Toast';
import { TreeSelect } from '@/components/ui/TreeSelect';
import { useKpiOptions } from '@/features/catalog/hooks';
import { toTreeNodes } from '@/features/common/shared';
import { parseNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useHasPerm } from '@/stores/sessionStore';
import {
  AssignImportDialog,
  cellError,
  CUR_YEAR,
  detailPayload,
  EditTable,
  flattenOrgs,
  mergeParsed,
  NumCell,
  ReadNum,
  rowFromDetail,
  rowsHaveErrors,
  StatusBadge,
  useAssignableOrgs,
  VAL_KEYS,
  VAL_LABEL,
  yearOptions,
  type AssignDetail,
  type EditRow,
  type ValKey,
} from '../components/common';

interface ByKpiData {
  kpi: { id: number; code: string; name: string; parentId?: number | null; perspectiveName?: string; perspectiveColor?: string; unitOfMeasureName?: string };
  year: number;
  details: AssignDetail[];
  status: string | null;
}

const EMPTY_VALS = { weight: '', targetQ1: '', targetQ2: '', targetH1: '', targetQ3: '', targetQ4: '', targetYear: '' };

/** 33.1 Thêm mới / 33.2 Ghi lại / 32.3 Xem chi tiết – Giao KPI theo chỉ tiêu */
export function AssignByKpiEditPage() {
  const params = useParams({ strict: false }) as { kpiId: string; year: string };
  const search = useSearch({ strict: false }) as { mode?: string };
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = params.kpiId === 'new';
  const canImport = useHasPerm('ASSIGN:IMPORT');
  const canSave = useHasPerm(isNew ? 'ASSIGN:CREATE' : 'ASSIGN:UPDATE');
  const kpis = useKpiOptions({});
  const orgs = useAssignableOrgs();
  const orgNodes = useMemo(() => toTreeNodes(orgs.data ?? []), [orgs.data]);
  const orgById = useMemo(() => new Map(flattenOrgs(orgs.data).map((o) => [o.id, o])), [orgs.data]);
  const data = useQuery({
    queryKey: ['assign-kpi', params.kpiId, params.year],
    queryFn: () => get<ByKpiData>(EP.assignByKpi.one(Number(params.kpiId), Number(params.year))),
    enabled: !isNew,
  });
  const d = data.data;
  const hasDraft = !!d?.details.some((x) => x.status === 'DANG_SOAN');
  const view = !isNew && (search.mode === 'view' || (!!d && !hasDraft));

  const [kpiId, setKpiId] = useState<number | null>(null);
  const [year, setYear] = useState(String(CUR_YEAR));
  const [rows, setRows] = useState<EditRow[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [rowErrs, setRowErrs] = useState<Record<string, string>>({});
  const [imp, setImp] = useState(false);
  const [imported, setImported] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!d) return;
    setKpiId(d.kpi.id);
    setYear(String(d.year));
    setRows(d.details.map((x) => rowFromDetail(x, String(x.orgUnitId))));
  }, [d]);

  const kpi = (kpis.data ?? []).find((k) => k.id === kpiId);
  const back = () => navigate({ to: '/kpi-admin/assignments', search: { tab: 'kpi' } });
  const isLocked = (r: EditRow) => view || (!!r.status && r.status !== 'DANG_SOAN');

  const newRow = (unitId: number): EditRow | null => {
    const o = orgById.get(unitId);
    if (!o) return null;
    return {
      key: String(o.id),
      kpiId: kpiId ?? 0,
      kpiCode: kpi?.code ?? '',
      kpiName: kpi?.name ?? '',
      parentKpiId: kpi?.parentId ?? null,
      orgUnitId: o.id,
      orgUnitCode: o.code,
      orgUnitName: o.name,
      vals: { ...EMPTY_VALS },
      note: '',
    };
  };

  const onUnits = (ids: number[]) => {
    const want = new Set(ids.map(Number));
    setRows((rs) => {
      const kept = rs.filter((r) => isLocked(r) || want.has(r.orgUnitId));
      const have = new Set(kept.map((r) => r.orgUnitId));
      const add = [...want].filter((i) => !have.has(i)).map(newRow).filter((r): r is EditRow => !!r);
      return [...kept, ...add];
    });
  };

  const setVal = (key: string, k: ValKey, v: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, vals: { ...r.vals, [k]: v } } : r)));
  const setNote = (key: string, v: string) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, note: v } : r)));

  const save = async () => {
    const e: Record<string, string> = {};
    if (!kpiId) e.kpiId = 'Vui lòng chọn Tiêu chí KPI';
    if (!year) e.year = 'Vui lòng chọn Năm giao';
    const editable = rows.filter((r) => !isLocked(r));
    if (!editable.length) e.units = 'Vui lòng chọn Đơn vị được giao';
    setErrs(e);
    setRowErrs({});
    if (Object.keys(e).length || rowsHaveErrors(editable)) {
      toast.error(e.kpiId ?? e.units ?? 'Dữ liệu không hợp lệ');
      return;
    }
    const body = { kpiId, year: Number(year), details: editable.map((r) => ({ ...detailPayload(r), kpiId })), source: imported ? 'IMPORT' : undefined };
    setBusy(true);
    try {
      if (isNew) await post(EP.assignByKpi.create, body);
      else await put(EP.assignByKpi.one(Number(params.kpiId), Number(params.year)), body);
      toast.success(isNew ? 'Thêm mới thành công' : 'Cập nhật thành công');
      qc.invalidateQueries({ queryKey: ['assign-by-kpi'] });
      qc.invalidateQueries({ queryKey: ['assign-kpi'] });
      back();
    } catch (er) {
      if (er instanceof ApiError && er.fieldErrors.length) {
        const fe: Record<string, string> = {};
        const re: Record<string, string> = {};
        er.fieldErrors.forEach((f) => {
          const m = /^details\[(\d+)\]/.exec(f.field);
          if (m && editable[Number(m[1])]) re[editable[Number(m[1])].key] = f.message;
          else fe[f.field] = f.message;
        });
        setErrs(fe);
        setRowErrs(re);
      }
      toast.error(errorMessage(er));
    } finally {
      setBusy(false);
    }
  };

  const headers = [
    { text: 'STT', align: 'center' as const, width: 40 },
    { text: 'Đơn vị được giao', width: 240 },
    ...VAL_KEYS.map((k) => ({ text: VAL_LABEL[k], align: 'right' as const, width: 80 })),
    { text: 'Ghi chú', width: 140 },
    { text: 'Trạng thái', width: 90 },
    ...(view ? [] : [{ text: '', width: 40 }]),
  ];

  return (
    <div>
      <PageHeader
        title={view ? 'Xem chi tiết giao KPI theo chỉ tiêu' : 'Giao KPI theo chỉ tiêu'}
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
          <Field label="Tiêu chí KPI" required error={errs.kpiId}>
            <SearchSelect
              aria-label="Tiêu chí KPI"
              disabled={!isNew}
              placeholder={d ? `${d.kpi.code} – ${d.kpi.name}` : 'Chọn…'}
              options={(kpis.data ?? []).map((k) => ({ value: k.id, label: `${k.code} – ${k.name}`, sub: k.perspectiveName }))}
              value={kpiId}
              onChange={(v) => {
                setKpiId(v);
                const k = (kpis.data ?? []).find((x) => x.id === v);
                setRows((rs) => rs.map((r) => ({ ...r, kpiId: v ?? 0, kpiCode: k?.code ?? '', kpiName: k?.name ?? '', parentKpiId: k?.parentId ?? null })));
              }}
            />
          </Field>
          <Field label="Năm giao" required error={errs.year} htmlFor="ak-year">
            <Select id="ak-year" options={yearOptions()} value={year} onChange={(e) => setYear(e.target.value)} disabled={!isNew} />
          </Field>
          {!view ? (
            <Field label="Đơn vị được giao" error={errs.units}>
              <TreeSelect aria-label="Đơn vị được giao" multiple nodes={orgNodes} value={rows.map((r) => r.orgUnitId)} onChange={onUnits} />
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <ReadField label="Đơn vị đo" value={d?.kpi.unitOfMeasureName} />
              <div>
                <div className="text-xs text-muted">Trạng thái</div>
                <StatusBadge status={d?.status} />
              </div>
            </div>
          )}
        </div>
      </Card>
      <h3 className="mb-2 text-sm font-semibold">Danh sách đơn vị được giao</h3>
      <EditTable label="Danh sách đơn vị được giao" headers={headers}>
        {rows.map((r, i) => {
          const locked = isLocked(r);
          const re = rowErrs[r.key];
          return (
            <tr key={r.key} className={cn('border-b border-border', re && 'bg-red-50')} data-row-key={r.orgUnitCode}>
              <td className="px-2 py-1.5 text-center text-slate-500">{i + 1}</td>
              <td className="px-2 py-1.5">
                {r.orgUnitName}
                {re && (
                  <p className="text-[11px] text-danger" role="alert">
                    {re}
                  </p>
                )}
              </td>
              {VAL_KEYS.map((k) => (
                <td key={k} className="px-1 py-1.5 text-right align-top">
                  {locked ? <ReadNum v={parseNum(r.vals[k])} /> : <NumCell label={`${VAL_LABEL[k]} ${r.orgUnitCode}`} value={r.vals[k]} onChange={(v) => setVal(r.key, k, v)} error={cellError(k, r.vals[k])} />}
                </td>
              ))}
              <td className="px-1 py-1.5 align-top">
                {locked ? r.note : <Input aria-label={`Ghi chú ${r.orgUnitCode}`} className="h-8 text-[13px]" value={r.note} onChange={(e) => setNote(r.key, e.target.value)} />}
              </td>
              <td className="px-2 py-1.5">{r.status ? <StatusBadge status={r.status} /> : <StatusBadge status="DANG_SOAN" />}</td>
              {!view && (
                <td className="px-1 py-1.5 text-center align-top">
                  {!locked && (
                    <Button variant="ghost" size="icon" aria-label="Xóa dòng" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  )}
                </td>
              )}
            </tr>
          );
        })}
        {!rows.length && (
          <tr>
            <td colSpan={headers.length} className="py-8 text-center text-muted">
              {data.isFetching ? 'Đang tải…' : 'Chưa có đơn vị được giao. Chọn ở trường “Đơn vị được giao”.'}
            </td>
          </tr>
        )}
      </EditTable>
      <AssignImportDialog
        open={imp}
        onOpenChange={setImp}
        mode="kpi"
        onRows={(parsed) => {
          setImported(true);
          setRows((rs) =>
            mergeParsed(
              rs,
              parsed,
              (p) => (p.orgUnitId ? String(p.orgUnitId) : null),
              (p) =>
                newRow(p.orgUnitId!) ?? {
                  key: String(p.orgUnitId),
                  kpiId: kpiId ?? 0,
                  kpiCode: kpi?.code ?? '',
                  kpiName: kpi?.name ?? '',
                  parentKpiId: kpi?.parentId ?? null,
                  orgUnitId: p.orgUnitId!,
                  orgUnitCode: p.orgUnitCode ?? '',
                  orgUnitName: p.orgUnitName ?? '',
                  vals: { ...EMPTY_VALS },
                  note: '',
                },
            ),
          );
        }}
      />
    </div>
  );
}
