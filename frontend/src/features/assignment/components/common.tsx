import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { download, get, post, upload } from '@/api/http';
import { EP } from '@/api/endpoints';
import type { OrgTreeNode } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { confirm } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Misc';
import { errorMessage, toast } from '@/components/ui/Toast';
import { fmtNum, parseNum } from '@/lib/format';
import { cn } from '@/lib/utils';

// ------------------------------- Kiểu dữ liệu -------------------------------
export interface AssignDetail {
  id: number;
  assignmentId: number;
  kpiId: number;
  kpiCode: string;
  kpiName: string;
  parentKpiId: number | null;
  parentKpiCode?: string;
  perspectiveName?: string;
  perspectiveColor?: string;
  unitOfMeasureName?: string;
  orgUnitId: number;
  orgUnitCode: string;
  orgUnitName: string;
  unitType?: string;
  year: number;
  weight: number | null;
  targetQ1: number | null;
  targetQ2: number | null;
  targetH1: number | null;
  targetQ3: number | null;
  targetQ4: number | null;
  targetYear: number | null;
  adjQ1?: number | null;
  adjQ2?: number | null;
  adjH1?: number | null;
  adjQ3?: number | null;
  adjQ4?: number | null;
  status: string;
  note?: string | null;
  updatedAt?: string;
}

export interface AssignHeader {
  id: number;
  orgUnitId: number;
  orgUnitCode: string;
  orgUnitName: string;
  unitType?: string;
  year: number;
  status: string;
  kpiCount?: number;
  totalWeight?: number | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  details: AssignDetail[];
}

export interface CloseResult {
  closed: number;
  closedNames: string[];
  errors: { id: number; name: string; reasons: string[] }[];
  message: string;
}

export interface CopyResult {
  copied: string[];
  skipped: { unit: string; reason: string }[];
  message: string;
}

// ------------------------------- Hằng số -------------------------------
export const ASSIGN_STATUS = [
  { value: 'DANG_SOAN', label: 'Đang soạn' },
  { value: 'DA_GIAO', label: 'Đã giao' },
  { value: 'DA_DIEU_CHINH', label: 'Đã điều chỉnh' },
];

export const PERIODS = [
  { code: 'Q1', label: 'Quý I', field: 'targetQ1', adj: 'adjQ1' },
  { code: 'Q2', label: 'Quý II', field: 'targetQ2', adj: 'adjQ2' },
  { code: 'H1', label: '6T ĐN', field: 'targetH1', adj: 'adjH1' },
  { code: 'Q3', label: 'Quý III', field: 'targetQ3', adj: 'adjQ3' },
  { code: 'Q4', label: 'Quý IV', field: 'targetQ4', adj: 'adjQ4' },
] as const;
export type PeriodCode = (typeof PERIODS)[number]['code'];

export const periodLabel = (c?: string | null) => PERIODS.find((p) => p.code === c)?.label ?? (c === 'Y' ? 'Cả năm' : (c ?? ''));

export function StatusBadge({ status }: { status?: string | null }) {
  if (status === 'DANG_SOAN') return <Badge color="amber">Đang soạn</Badge>;
  if (status === 'DA_GIAO') return <Badge color="green">Đã giao</Badge>;
  if (status === 'DA_DIEU_CHINH') return <Badge color="blue">Đã điều chỉnh</Badge>;
  return <Badge color="slate">{status ?? ''}</Badge>;
}

export const CUR_YEAR = new Date().getFullYear();
export function yearOptions(center = CUR_YEAR, span = 3) {
  const out: { value: number; label: string }[] = [];
  for (let y = center - span; y <= center + span; y++) out.push({ value: y, label: String(y) });
  return out;
}

// ------------------------------- Đơn vị được giao -------------------------------
/** Cây đơn vị “Giao KPI” trong phạm vi (dạng gốc, giữ mã/loại đơn vị) */
export function useAssignableOrgs() {
  return useQuery({
    queryKey: ['org-tree-raw', 'mine', 'assignable'],
    queryFn: () => get<OrgTreeNode[]>(EP.orgUnits.tree, { scope: 'mine', assignableOnly: true }),
    staleTime: 60_000,
  });
}

export function flattenOrgs(nodes: OrgTreeNode[] | undefined, out: OrgTreeNode[] = []): OrgTreeNode[] {
  for (const n of nodes ?? []) {
    out.push(n);
    if (n.children?.length) flattenOrgs(n.children, out);
  }
  return out;
}

// ------------------------------- Lưới nhập số -------------------------------
export const VAL_KEYS = ['weight', 'targetQ1', 'targetQ2', 'targetH1', 'targetQ3', 'targetQ4', 'targetYear'] as const;
export type ValKey = (typeof VAL_KEYS)[number];
export const VAL_LABEL: Record<ValKey, string> = {
  weight: 'Trọng số',
  targetQ1: 'Quý I',
  targetQ2: 'Quý II',
  targetH1: '6T ĐN',
  targetQ3: 'Quý III',
  targetQ4: 'Quý IV',
  targetYear: 'Cả năm',
};

/** Dòng nhập giao (giá trị giữ dạng chuỗi theo người dùng nhập) */
export interface EditRow {
  key: string;
  kpiId: number;
  kpiCode: string;
  kpiName: string;
  parentKpiId: number | null;
  perspectiveName?: string;
  perspectiveColor?: string;
  unitOfMeasureName?: string;
  orgUnitId: number;
  orgUnitCode: string;
  orgUnitName: string;
  status?: string;
  vals: Record<ValKey, string>;
  note: string;
}

/** Số → chuỗi nhập (không nhóm hàng nghìn để parse lại không nhầm) */
export const numToInput = (v: number | string | null | undefined) => (v === null || v === undefined || v === '' ? '' : String(Number(v)).replace('.', ','));

export function valsFrom(d: Partial<Record<ValKey, number | null>>): Record<ValKey, string> {
  const o = {} as Record<ValKey, string>;
  VAL_KEYS.forEach((k) => (o[k] = numToInput(d[k])));
  return o;
}

export function rowFromDetail(d: AssignDetail, key: string): EditRow {
  return {
    key,
    kpiId: d.kpiId,
    kpiCode: d.kpiCode,
    kpiName: d.kpiName,
    parentKpiId: d.parentKpiId,
    perspectiveName: d.perspectiveName,
    perspectiveColor: d.perspectiveColor,
    unitOfMeasureName: d.unitOfMeasureName,
    orgUnitId: d.orgUnitId,
    orgUnitCode: d.orgUnitCode,
    orgUnitName: d.orgUnitName,
    status: d.status,
    vals: valsFrom(d),
    note: d.note ?? '',
  };
}

/** Lỗi ô: số ≥ 0; trọng số 1–100 */
export function cellError(k: ValKey, s: string): string | null {
  if (!s.trim()) return null;
  const n = parseNum(s);
  if (n === null) return 'Giá trị không hợp lệ';
  if (k === 'weight') return n < 1 || n > 100 ? 'Trọng số phải từ 1 đến 100' : null;
  return n < 0 ? 'Giá trị phải lớn hơn hoặc bằng 0' : null;
}

export function rowsHaveErrors(rows: EditRow[]) {
  return rows.some((r) => VAL_KEYS.some((k) => cellError(k, r.vals[k])));
}

export function detailPayload(r: EditRow) {
  const o: Record<string, unknown> = { kpiId: r.kpiId, orgUnitId: r.orgUnitId, note: r.note.trim() || null };
  VAL_KEYS.forEach((k) => (o[k] = parseNum(r.vals[k])));
  return o;
}

export function NumCell({ value, onChange, label, disabled, error }: { value: string; onChange: (v: string) => void; label: string; disabled?: boolean; error?: string | null }) {
  return (
    <div className="min-w-[72px]">
      <input
        aria-label={label}
        aria-invalid={!!error}
        disabled={disabled}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full rounded border border-border bg-white px-1.5 text-right text-[13px] focus:border-primary focus:outline-none disabled:bg-slate-50 aria-[invalid=true]:border-danger"
      />
      {error && (
        <p className="mt-0.5 text-[11px] leading-tight text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const ReadNum = ({ v }: { v: number | string | null | undefined }) => <span className="tabular-nums">{fmtNum(v, 2)}</span>;

/** Bảng thô gọn nhẹ dùng cho lưới nhập */
export function EditTable({ label, headers, children, footer }: { label: string; headers: { text: string; align?: 'right' | 'left' | 'center'; width?: number }[]; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="card overflow-auto">
      <table className="w-full border-collapse text-[13px]" aria-label={label}>
        <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className={cn('px-2 py-2 font-semibold', h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : 'text-left')} style={{ minWidth: h.width }}>
                {h.text}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}

// ------------------------------- Chốt số liệu -------------------------------
/** 31.1/31.2: xác nhận → chốt → toast + dialog kết quả lỗi */
export async function runClose(url: string, body: unknown, count: number, onResult: (r: CloseResult | null) => void) {
  const ok = await confirm({ title: 'Chốt số liệu giao KPI', message: `Xác nhận chốt số liệu giao KPI cho ${count} bản ghi đã chọn?`, confirmText: 'Xác nhận' });
  if (!ok) return false;
  try {
    const r = await post<CloseResult>(url, body);
    const d = r.data!;
    if (d.closed > 0) toast.success(r.message || d.message);
    else if (!d.errors.length) toast.info(r.message || d.message);
    onResult(d.errors.length ? d : null);
  } catch (e) {
    toast.error(errorMessage(e));
  }
  return true;
}

export function CloseResultDialog({ result, onClose }: { result: CloseResult | null; onClose: () => void }) {
  return (
    <Dialog
      open={!!result}
      onOpenChange={(o) => !o && onClose()}
      title="Kết quả chốt số liệu giao KPI"
      footer={
        <Button variant="outline" onClick={onClose}>
          Đóng
        </Button>
      }
    >
      {result && (
        <div className="space-y-3 text-sm">
          <p>{result.message}</p>
          {result.closedNames.length > 0 && (
            <div>
              <b>Đã chốt:</b>
              <ul className="ml-5 list-disc">
                {result.closedNames.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <b className="text-danger">Không chốt được:</b>
            <ul className="ml-5 list-disc" data-testid="close-errors">
              {result.errors.map((e) => (
                <li key={`${e.id}-${e.name}`}>
                  <b>{e.name}</b>
                  <ul className="ml-4 list-[circle] text-danger">
                    {e.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Dialog>
  );
}

export function CopyResultBox({ result }: { result: CopyResult | null }) {
  if (!result) return null;
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm" data-testid="copy-result">
      <p className="font-medium">{result.message}</p>
      {result.skipped.length > 0 && (
        <ul className="ml-5 mt-1 list-disc text-slate-700">
          {result.skipped.map((s) => (
            <li key={s.unit}>
              {s.unit}: {s.reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ------------------------------- 35.1 Nhập dữ liệu -------------------------------
export interface ParsedRow {
  kpiId: number | null;
  kpiCode: string | null;
  kpiName: string | null;
  parentKpiId: number | null;
  perspectiveName: string | null;
  unitOfMeasureName: string | null;
  orgUnitId: number | null;
  orgUnitCode: string | null;
  orgUnitName: string | null;
  weight: number | null;
  targetQ1: number | null;
  targetQ2: number | null;
  targetH1: number | null;
  targetQ3: number | null;
  targetQ4: number | null;
  targetYear: number | null;
  note: string | null;
}

/** Dialog “Nhập dữ liệu giao KPI”: tải mẫu, chọn file, “Kiểm tra và cập nhật” → đổ dữ liệu lên màn hình (chưa lưu DB) */
export function AssignImportDialog({ open, onOpenChange, mode, onRows }: { open: boolean; onOpenChange: (o: boolean) => void; mode: 'unit' | 'kpi'; onRows: (rows: ParsedRow[]) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const pick = (f?: File | null) => {
    setError(null);
    setErrors([]);
    setMsg(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.xlsx')) return setError('Chỉ chấp nhận file .xlsx');
    if (f.size > 10 * 1024 * 1024) return setError('File vượt quá 10 MB');
    setFile(f);
  };
  const run = async () => {
    if (!file) return setError('Vui lòng chọn file');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await upload<{ rows: ParsedRow[]; errors: { row: number; message: string }[]; message: string }>(`${EP.assignImport.parse}?mode=${mode}`, fd);
      const d = r.data!;
      onRows(d.rows ?? []);
      setErrors(d.errors ?? []);
      setMsg(r.message || d.message);
      toast.success(r.message || d.message);
      if (!d.errors?.length) {
        setFile(null);
        onOpenChange(false);
      }
    } catch (e) {
      setError(errorMessage(e));
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setFile(null);
          setErrors([]);
          setError(null);
          setMsg(null);
        }
        onOpenChange(o);
      }}
      title="Nhập dữ liệu giao KPI"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button onClick={run} loading={busy} disabled={!file}>
            Kiểm tra và cập nhật
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          onClick={() => download(EP.assignImport.template, { mode }).catch((e) => toast.error(errorMessage(e)))}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Tải file mẫu
        </button>
        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm"
          onClick={() => ref.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files?.[0]);
          }}
        >
          <Upload className="mb-1 h-6 w-6 text-slate-400" />
          <div>{file ? <b>{file.name}</b> : 'Chọn hoặc kéo thả file vào đây (.xlsx, tối đa 10 MB)'}</div>
          <input ref={ref} type="file" accept=".xlsx" className="hidden" data-testid="assign-import-file" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
        {error && <p className="field-error">{error}</p>}
        {msg && <p className="text-sm text-slate-700">{msg}</p>}
        {errors.length > 0 && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm" data-testid="assign-import-errors">
            <b className="text-danger">Các dòng lỗi (không cập nhật):</b>
            <ul className="ml-5 list-disc">
              {errors.map((e) => (
                <li key={e.row}>
                  Dòng {e.row}: {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** Gộp dữ liệu nhập vào lưới: cập nhật dòng trùng khóa, thêm dòng mới */
export function mergeParsed(rows: EditRow[], parsed: ParsedRow[], keyOf: (p: ParsedRow) => string | null, build: (p: ParsedRow) => EditRow | null): EditRow[] {
  const next = [...rows];
  for (const p of parsed) {
    const k = keyOf(p);
    if (!k) continue;
    const vals = valsFrom(p);
    const i = next.findIndex((r) => r.key === k);
    if (i >= 0) {
      if (next[i].status && next[i].status !== 'DANG_SOAN') continue;
      next[i] = { ...next[i], vals, note: p.note ?? '' };
    } else {
      const r = build(p);
      if (r) next.push({ ...r, vals, note: p.note ?? '' });
    }
  }
  return next;
}

export function useSum(rows: EditRow[]) {
  return useMemo(() => rows.filter((r) => r.parentKpiId == null).reduce((s, r) => s + (parseNum(r.vals.weight) ?? 0), 0), [rows]);
}
