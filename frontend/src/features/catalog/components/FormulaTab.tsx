import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Plug, Plus, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { del, get, post, put } from '@/api/http';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { FilterItem, SearchBar } from '@/components/data-grid/SearchBar';
import { useListState } from '@/components/data-grid/useListState';
import { Button } from '@/components/ui/Button';
import { confirmDelete } from '@/components/ui/ConfirmDialog';
import { Dialog, Drawer } from '@/components/ui/Dialog';
import { Field, Input, ReadField, Select, Textarea } from '@/components/ui/Input';
import { errorMessage, toast } from '@/components/ui/Toast';
import { ACTIVE_OPTIONS, ActiveBadge, codeName, handleSubmitError, labelOf, RowActions, Section } from '@/features/common/shared';
import { fmtDateTime, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useHasPerm } from '@/stores/sessionStore';

interface FormulaRow {
  id: number;
  code: string;
  name: string;
  definitionType: string;
  dataType: string;
  expression?: string | null;
  sourceDefinition?: string | null;
  apiPath?: string | null;
  httpMethod?: string | null;
  responsePath?: string | null;
  businessDescription?: string | null;
  status: string;
  version: number;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}

interface RecentSync {
  id: number;
  at?: string;
  trigger?: string;
  year?: number;
  periodCode?: string;
  unitCode?: string;
  unitName?: string;
  value?: number | string | null;
  error?: string | null;
  request?: string | null;
}

const DEFINITION_TYPES = [
  { value: 'THANH_PHAN_API', label: 'Thành phần lấy từ API' },
  { value: 'THANH_PHAN_NHAP_TAY', label: 'Thành phần nhập tay' },
  { value: 'CONG_THUC_TONG_HOP', label: 'Công thức tổng hợp' },
];
const DATA_TYPES = [
  { value: 'SO', label: 'Số' },
  { value: 'TY_LE', label: 'Tỷ lệ' },
  { value: 'TIEN_TE', label: 'Tiền tệ' },
  { value: 'SO_LUONG', label: 'Số lượng' },
];
const HTTP_METHODS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
];

/** Ô văn bản dài: cắt bớt, hiện đủ khi rê chuột */
function Clip({ text, mono }: { text?: string | null; mono?: boolean }) {
  if (!text) return null;
  return (
    <span className={cn('block max-w-full truncate', mono && 'font-mono text-xs')} title={text}>
      {text}
    </span>
  );
}

/** 27.1–27.6 Định nghĩa KPI công thức */
export function FormulaTab() {
  const canCreate = useHasPerm('FORMULA:CREATE');
  const canUpdate = useHasPerm('FORMULA:UPDATE');
  const canDelete = useHasPerm('FORMULA:DELETE');
  const list = useListState<{ keyword: string; status: string }, FormulaRow>('formula-definitions', EP.formulas.list, { keyword: '', status: '' });
  const [form, setForm] = useState<{ open: boolean; row?: FormulaRow }>({ open: false });
  const [viewId, setViewId] = useState<number | null>(null);
  const refresh = () => list.query.refetch();

  const remove = async (r: FormulaRow) => {
    if (!(await confirmDelete(codeName(r.code, r.name)))) return;
    try {
      await del(EP.formulas.one(r.id), { version: r.version });
      toast.success('Xóa thành công');
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <SearchBar
        keyword={list.draft.keyword}
        onKeywordChange={(v) => list.set('keyword', v)}
        placeholder="Mã hoặc tên định nghĩa"
        onSearch={list.search}
        onReset={list.reset}
        actions={
          canCreate && (
            <Button onClick={() => setForm({ open: true })}>
              <Plus className="h-4 w-4" />
              Thêm định nghĩa KPI công thức
            </Button>
          )
        }
      >
        <FilterItem label="Trạng thái" width="w-40">
          <Select aria-label="Trạng thái" options={ACTIVE_OPTIONS} placeholder="Tất cả" value={list.draft.status} onChange={(e) => list.set('status', e.target.value)} />
        </FilterItem>
      </SearchBar>
      <h3 className="mb-2 text-sm font-semibold">Danh sách định nghĩa KPI công thức</h3>
      <DataGrid<FormulaRow>
        title="Danh sách định nghĩa KPI công thức"
        {...list.gridProps}
        rowKey={(r) => r.id}
        columns={[
          { key: 'code', header: 'Mã – Tên định nghĩa', sortable: true, width: 200, render: (r) => <Clip text={`${r.code} – ${r.name}`} /> },
          { key: 'definitionType', header: 'Loại định nghĩa', sortable: true, width: 130, render: (r) => labelOf(DEFINITION_TYPES, r.definitionType) },
          { key: 'dataType', header: 'Loại số liệu', width: 90, render: (r) => labelOf(DATA_TYPES, r.dataType) },
          { key: 'expression', header: 'Biểu thức công thức', width: 140, render: (r) => <Clip text={r.expression} mono /> },
          { key: 'sourceDefinition', header: 'Định nghĩa nguồn', width: 130, render: (r) => <Clip text={r.sourceDefinition} mono /> },
          { key: 'apiPath', header: 'Đường dẫn API', width: 150, render: (r) => <Clip text={r.apiPath} mono /> },
          { key: 'businessDescription', header: 'Mô tả nghiệp vụ', width: 160, render: (r) => <Clip text={r.businessDescription} /> },
          { key: 'status', header: 'Trạng thái', sortable: true, width: 110, render: (r) => <ActiveBadge status={r.status} /> },
          { key: 'createdBy', header: 'Người tạo', width: 100 },
          {
            key: 'actions',
            header: 'Thao tác',
            width: 110,
            render: (r) => (
              <RowActions
                actions={[
                  { label: 'Xem', onClick: () => setViewId(r.id) },
                  { label: 'Sửa', onClick: () => setForm({ open: true, row: r }), show: canUpdate },
                  { label: 'Xóa', onClick: () => remove(r), show: canDelete, danger: true },
                ]}
              />
            ),
          },
        ]}
      />
      {form.open && <FormulaForm row={form.row} onClose={() => setForm({ open: false })} onSaved={refresh} />}
      {viewId !== null && <FormulaView id={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}

function FormulaView({ id, onClose }: { id: number; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['formula-definition', id],
    queryFn: () => get<{ definition: FormulaRow; recentSyncs: RecentSync[] }>(EP.formulas.one(id)),
  });
  const d = q.data?.definition;
  const syncs = q.data?.recentSyncs ?? [];
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title="Thông tin định nghĩa KPI công thức" width="w-[760px]">
      {q.isLoading && <div className="py-6 text-center text-sm text-muted">Đang tải...</div>}
      {q.isError && <div className="py-6 text-center text-sm text-danger">{errorMessage(q.error)}</div>}
      {d && (
        <>
          <Section title="Thông tin chung">
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Mã định nghĩa" value={d.code} />
              <ReadField label="Tên định nghĩa" value={d.name} />
              <ReadField label="Loại định nghĩa" value={labelOf(DEFINITION_TYPES, d.definitionType)} />
              <ReadField label="Loại số liệu" value={labelOf(DATA_TYPES, d.dataType)} />
              <ReadField label="Biểu thức công thức" value={d.expression ? <code className="text-xs">{d.expression}</code> : null} className="col-span-2" />
              <ReadField
                label="Định nghĩa nguồn"
                value={d.sourceDefinition ? <pre className="whitespace-pre-wrap break-all rounded bg-slate-50 p-2 font-mono text-xs">{d.sourceDefinition}</pre> : null}
                className="col-span-2"
              />
              <ReadField label="Đường dẫn API" value={d.apiPath ? <code className="break-all text-xs">{d.apiPath}</code> : null} className="col-span-2" />
              <ReadField label="Phương thức HTTP" value={d.httpMethod} />
              <ReadField label="Đường dẫn giá trị trong response (JSONPath)" value={d.responsePath} />
              <ReadField label="Mô tả nghiệp vụ" value={d.businessDescription} className="col-span-2" />
              <ReadField label="Trạng thái" value={<ActiveBadge status={d.status} />} />
              <div />
              <ReadField label="Người tạo" value={d.createdBy} />
              <ReadField label="Ngày tạo" value={fmtDateTime(d.createdAt)} />
              <ReadField label="Người cập nhật" value={d.updatedBy} />
              <ReadField label="Ngày cập nhật" value={fmtDateTime(d.updatedAt)} />
            </div>
          </Section>
          <Section title="10 lần đồng bộ gần nhất">
            <table className="w-full border-collapse text-[13px]" aria-label="10 lần đồng bộ gần nhất">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="border-b border-border px-2 py-1.5 font-semibold">Thời điểm</th>
                  <th className="border-b border-border px-2 py-1.5 font-semibold">Đơn vị</th>
                  <th className="border-b border-border px-2 py-1.5 font-semibold">Kỳ</th>
                  <th className="border-b border-border px-2 py-1.5 text-right font-semibold">Giá trị</th>
                  <th className="border-b border-border px-2 py-1.5 font-semibold">Lỗi</th>
                </tr>
              </thead>
              <tbody>
                {syncs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-4 text-center text-muted">
                      Chưa có lần đồng bộ
                    </td>
                  </tr>
                ) : (
                  syncs.map((s) => (
                    <tr key={s.id} className="border-b border-border">
                      <td className="px-2 py-1.5">{fmtDateTime(s.at)}</td>
                      <td className="px-2 py-1.5">{s.unitName ?? s.unitCode}</td>
                      <td className="px-2 py-1.5">{[s.periodCode, s.year].filter(Boolean).join('/')}</td>
                      <td className="px-2 py-1.5 text-right">{fmtNum(s.value)}</td>
                      <td className="px-2 py-1.5 text-danger">
                        <Clip text={s.error} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Section>
        </>
      )}
    </Drawer>
  );
}

const schema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập Mã định nghĩa')
      .max(50, 'Mã định nghĩa tối đa 50 ký tự')
      .regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Mã định nghĩa bắt đầu bằng chữ, chỉ gồm chữ, số và _'),
    name: z.string().trim().min(1, 'Vui lòng nhập Tên định nghĩa').max(500, 'Tên định nghĩa tối đa 500 ký tự'),
    definitionType: z.string().min(1, 'Vui lòng chọn Loại định nghĩa'),
    dataType: z.string().min(1, 'Vui lòng chọn Loại số liệu'),
    expression: z.string().max(2000, 'Biểu thức công thức tối đa 2000 ký tự'),
    sourceDefinition: z.string().max(4000, 'Định nghĩa nguồn tối đa 4000 ký tự'),
    apiPath: z.string().max(1000, 'Đường dẫn API tối đa 1000 ký tự'),
    httpMethod: z.string(),
    responsePath: z.string().max(500, 'Đường dẫn giá trị tối đa 500 ký tự'),
    businessDescription: z.string().max(2000, 'Mô tả nghiệp vụ tối đa 2000 ký tự'),
    status: z.string().min(1, 'Vui lòng chọn Trạng thái'),
  })
  .superRefine((v, ctx) => {
    if (v.definitionType === 'CONG_THUC_TONG_HOP' && !v.expression.trim())
      ctx.addIssue({ code: 'custom', path: ['expression'], message: 'Vui lòng nhập Biểu thức công thức (bắt buộc với Công thức tổng hợp)' });
    if (v.definitionType === 'THANH_PHAN_API' && !v.apiPath.trim())
      ctx.addIssue({ code: 'custom', path: ['apiPath'], message: 'Vui lòng nhập Đường dẫn API (bắt buộc với loại API)' });
    if (v.sourceDefinition.trim()) {
      try {
        JSON.parse(v.sourceDefinition);
      } catch {
        ctx.addIssue({ code: 'custom', path: ['sourceDefinition'], message: 'Định nghĩa nguồn phải là JSON hợp lệ' });
      }
    }
  });
type FormValues = z.output<typeof schema>;

interface TestResult {
  success: boolean;
  value?: number | string | null;
  error?: string | null;
  request?: string | null;
  elapsedMs?: number;
}
interface ExprResult {
  valid: boolean;
  errors?: string[];
  variables?: string[];
  sampleResult?: number | string | null;
}

const nullIfBlank = (s: string) => (s.trim() === '' ? null : s.trim());

function toBody(v: FormValues, version?: number) {
  return {
    code: v.code.trim(),
    name: v.name.trim(),
    definitionType: v.definitionType,
    dataType: v.dataType,
    expression: nullIfBlank(v.expression),
    sourceDefinition: nullIfBlank(v.sourceDefinition),
    apiPath: nullIfBlank(v.apiPath),
    httpMethod: v.httpMethod || null,
    responsePath: nullIfBlank(v.responsePath),
    businessDescription: nullIfBlank(v.businessDescription),
    status: v.status,
    version,
  };
}

function FormulaForm({ row, onClose, onSaved }: { row?: FormulaRow; onClose: () => void; onSaved: () => void }) {
  const canTest = useHasPerm('FORMULA:TEST');
  const { register, handleSubmit, formState, setError, watch, getValues, clearErrors } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      code: row?.code ?? '',
      name: row?.name ?? '',
      definitionType: row?.definitionType ?? '',
      dataType: row?.dataType ?? '',
      expression: row?.expression ?? '',
      sourceDefinition: row?.sourceDefinition ?? '',
      apiPath: row?.apiPath ?? '',
      httpMethod: row?.httpMethod ?? 'GET',
      responsePath: row?.responsePath ?? '',
      businessDescription: row?.businessDescription ?? '',
      status: row?.status ?? 'HIEU_LUC',
    },
  });
  const type = watch('definitionType');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [exprResult, setExprResult] = useState<ExprResult | null>(null);

  const onSubmit = async (v: FormValues) => {
    try {
      const body = toBody(v, row?.version);
      if (row) {
        await put(EP.formulas.one(row.id), body);
        toast.success('Cập nhật thành công');
      } else {
        await post(EP.formulas.list, body);
        toast.success('Thêm mới thành công');
      }
      onSaved();
      onClose();
    } catch (e) {
      handleSubmitError(e, setError);
    }
  };

  const testConnection = async () => {
    const v = getValues();
    setTestResult(null);
    if (!v.apiPath.trim()) {
      setError('apiPath', { message: 'Vui lòng nhập Đường dẫn API' });
      return;
    }
    clearErrors('apiPath');
    setTesting(true);
    try {
      const r = await post<TestResult>(EP.formulas.testDraft, { definition: toBody(v, row?.version), year: new Date().getFullYear(), period: 'Q1', unitCode: 'VNPT_HNI' });
      setTestResult(r.data ?? { success: false, error: 'Không nhận được phản hồi' });
    } catch (e) {
      handleSubmitError(e, setError);
      setTestResult({ success: false, error: errorMessage(e) });
    } finally {
      setTesting(false);
    }
  };

  const checkExpression = async () => {
    const expression = getValues('expression');
    setExprResult(null);
    if (!expression.trim()) {
      setError('expression', { message: 'Vui lòng nhập Biểu thức công thức' });
      return;
    }
    clearErrors('expression');
    setChecking(true);
    try {
      const r = await post<ExprResult>(EP.formulas.validateExpression, { expression });
      setExprResult(r.data ?? { valid: false, errors: ['Không nhận được phản hồi'] });
    } catch (e) {
      setExprResult({ valid: false, errors: [errorMessage(e)] });
    } finally {
      setChecking(false);
    }
  };

  const fmtValue = (v: TestResult['value']) => {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    return Number.isFinite(n) ? fmtNum(n) : String(v);
  };

  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(o) => !o && onClose()}
      title={row ? 'Sửa định nghĩa KPI công thức' : 'Thêm định nghĩa KPI công thức'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={formState.isSubmitting}>
            Lưu
          </Button>
        </>
      }
    >
      <form className="grid grid-cols-2 gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
        <Field label="Mã định nghĩa" required error={formState.errors.code?.message} htmlFor="f-code">
          <Input id="f-code" disabled={!!row} {...register('code')} />
        </Field>
        <Field label="Tên định nghĩa" required error={formState.errors.name?.message} htmlFor="f-name">
          <Input id="f-name" {...register('name')} />
        </Field>
        <Field label="Loại định nghĩa" required error={formState.errors.definitionType?.message} htmlFor="f-type">
          <Select id="f-type" options={DEFINITION_TYPES} placeholder="-- Chọn --" {...register('definitionType')} />
        </Field>
        <Field label="Loại số liệu" required error={formState.errors.dataType?.message} htmlFor="f-data">
          <Select id="f-data" options={DATA_TYPES} placeholder="-- Chọn --" {...register('dataType')} />
        </Field>
        <Field label="Biểu thức công thức" required={type === 'CONG_THUC_TONG_HOP'} error={formState.errors.expression?.message} className="col-span-2" htmlFor="f-expr">
          <div className="flex gap-2">
            <Input id="f-expr" className="font-mono" placeholder="Ví dụ: DT_VT + DT_CNTT" {...register('expression')} />
            {canTest && (
              <Button variant="outline" onClick={checkExpression} loading={checking}>
                <CheckCircle2 className="h-4 w-4" />
                Kiểm tra biểu thức
              </Button>
            )}
          </div>
          {exprResult && (
            <div
              data-testid="expression-result"
              className={cn('mt-2 rounded border px-3 py-2 text-sm', exprResult.valid ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700')}
            >
              {exprResult.valid ? (
                <>
                  Biểu thức hợp lệ
                  {exprResult.variables?.length ? <span className="text-xs"> (biến: {exprResult.variables.join(', ')})</span> : null}
                </>
              ) : (
                (exprResult.errors ?? []).join('; ') || 'Biểu thức không hợp lệ'
              )}
            </div>
          )}
        </Field>
        <Field label="Định nghĩa nguồn" error={formState.errors.sourceDefinition?.message} className="col-span-2" htmlFor="f-source">
          <Textarea id="f-source" rows={4} spellCheck={false} className="font-mono text-xs" placeholder='{"system": "...", "table": "..."}' {...register('sourceDefinition')} />
        </Field>
        <Field label="Đường dẫn API" required={type === 'THANH_PHAN_API'} error={formState.errors.apiPath?.message} className="col-span-2" htmlFor="f-api">
          <Input id="f-api" className="font-mono" placeholder="/kpi/{kpiCode}?year={year}&period={period}&unitCode={unitCode}" {...register('apiPath')} />
        </Field>
        <Field label="Phương thức HTTP" error={formState.errors.httpMethod?.message} htmlFor="f-method">
          <Select id="f-method" options={HTTP_METHODS} {...register('httpMethod')} />
        </Field>
        <Field label="Đường dẫn giá trị trong response (JSONPath)" error={formState.errors.responsePath?.message} htmlFor="f-jsonpath">
          <Input id="f-jsonpath" className="font-mono" placeholder="$.data.value" {...register('responsePath')} />
        </Field>
        {canTest && (
          <div className="col-span-2">
            <Button variant="outline" onClick={testConnection} loading={testing}>
              <Plug className="h-4 w-4" />
              Kiểm tra kết nối
            </Button>
            {testResult && (
              <div
                data-testid="connection-result"
                className={cn('mt-2 flex items-start gap-2 rounded border px-3 py-2 text-sm', testResult.success ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700')}
              >
                {testResult.success ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                <div className="min-w-0">
                  <div>{testResult.success ? `Kết nối thành công. Giá trị nhận được: ${fmtValue(testResult.value)}` : `Kết nối thất bại: ${testResult.error ?? ''}`}</div>
                  {(testResult.request || testResult.elapsedMs !== undefined) && (
                    <div className="mt-0.5 break-all text-xs opacity-80">
                      {testResult.request}
                      {testResult.elapsedMs !== undefined && ` (${testResult.elapsedMs} ms)`}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        <Field label="Mô tả nghiệp vụ" error={formState.errors.businessDescription?.message} className="col-span-2" htmlFor="f-desc">
          <Textarea id="f-desc" {...register('businessDescription')} />
        </Field>
        <Field label="Trạng thái" required error={formState.errors.status?.message} htmlFor="f-status">
          <Select id="f-status" options={ACTIVE_OPTIONS} placeholder="-- Chọn --" {...register('status')} />
        </Field>
      </form>
    </Dialog>
  );
}
