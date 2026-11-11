import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { get, post, put } from '@/api/http';
import { EP } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Input';
import { RadioGroup, Switch } from '@/components/ui/Misc';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { errorMessage, toast } from '@/components/ui/Toast';
import { TreeSelect } from '@/components/ui/TreeSelect';
import { handleSubmitError, useOrgTree } from '@/features/common/shared';
import {
  COMPLETION,
  COMPONENT_SOURCES,
  DATA_SOURCES,
  GROUP_AGG,
  TARGET_DATA_TYPES,
  useFormulas,
  useKpiOptions,
  useObjectives,
  usePerspectives,
  useScoringMethods,
  useUnitUsers,
  useUoms,
} from '../hooks';
import type { KpiDetail } from './KpiTab';

const reqNum = (msg: string) => z.custom<number | null>((v) => typeof v === 'number' && v > 0, { message: msg });

const componentSchema = z.object({
  id: z.number().optional().nullable(),
  code: z.string().trim().min(1, 'Vui lòng nhập Mã biến').regex(/^[A-Za-z][A-Za-z0-9_]{0,29}$/, 'Mã biến bắt đầu bằng chữ, chỉ gồm chữ/số/_'),
  name: z.string().trim().min(1, 'Vui lòng nhập Tên thành phần'),
  formulaDefinitionId: z.number().nullable(),
  source: z.string().min(1, 'Vui lòng chọn Nguồn'),
});

const baseShape = {
  id: z.number().optional().nullable(),
  code: z.string().optional().nullable(),
  version: z.number().optional().nullable(),
  structure: z.string(),
  name: z.string().trim().min(1, 'Vui lòng nhập Tên tiêu chí').max(500, 'Tên tiêu chí tối đa 500 ký tự'),
  groupAggregation: z.string().min(1, 'Vui lòng chọn Cách tính kết quả KPI Tập đoàn'),
  groupExpression: z.string().optional().nullable(),
  perspectiveId: reqNum('Vui lòng chọn Viễn cảnh'),
  groupKpiId: z.number().nullable(),
  targetDataType: z.string().min(1, 'Vui lòng chọn Loại số liệu giao'),
  completionFormula: z.string(),
  completionExpression: z.string().optional().nullable(),
  scoringMethodId: reqNum('Vui lòng chọn Phương pháp tính điểm'),
  scoreByResult: z.boolean(),
  objectiveId: reqNum('Vui lòng chọn Mục tiêu trọng tâm'),
  weight: z.string().refine((v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100), 'Tỷ trọng phải từ 1 đến 100'),
  assigningUnitId: reqNum('Vui lòng chọn Đơn vị giao'),
  assigningOfficerId: reqNum('Vui lòng chọn Cán bộ giao'),
  evaluatingUnitId: reqNum('Vui lòng chọn Đơn vị đánh giá'),
  evaluatingOfficerId: reqNum('Vui lòng chọn Cán bộ đánh giá'),
  dataSource: z.string(),
  unitOfMeasureId: reqNum('Vui lòng chọn Đơn vị đo'),
  isFocus: z.boolean(),
  resultExpression: z.string().optional().nullable(),
  components: z.array(componentSchema),
};

const refineKpi = (v: { groupAggregation: string; groupExpression?: string | null; completionFormula: string; completionExpression?: string | null; components: unknown[]; resultExpression?: string | null }, ctx: z.RefinementCtx) => {
  if (v.groupAggregation === 'CONG_THUC' && !v.groupExpression?.trim()) ctx.addIssue({ code: 'custom', path: ['groupExpression'], message: 'Vui lòng nhập biểu thức' });
  if (v.completionFormula === 'TUY_CHINH' && !v.completionExpression?.trim()) ctx.addIssue({ code: 'custom', path: ['completionExpression'], message: 'Vui lòng nhập biểu thức (biến TH, KH, KH_NAM)' });
  if (v.components.length > 1 && !v.resultExpression?.trim()) ctx.addIssue({ code: 'custom', path: ['resultExpression'], message: 'Vui lòng nhập Biểu thức kết quả khi có nhiều thành phần' });
};

const childSchema = z.object(baseShape).superRefine(refineKpi);
export type KpiFormValues = z.infer<typeof childSchema> & { children: KpiFormValues[] };
const kpiSchema = z.object({ ...baseShape, children: z.array(z.any()) }).superRefine((v, ctx) => {
  refineKpi(v, ctx);
  if (v.structure === 'CHA_CON' && v.children.length === 0) ctx.addIssue({ code: 'custom', path: ['children'], message: 'Vui lòng thêm ít nhất một KPI con' });
});

export function emptyKpi(defaults: Partial<KpiFormValues> = {}): KpiFormValues {
  return {
    structure: 'DON_LE',
    name: '',
    groupAggregation: '',
    groupExpression: '',
    perspectiveId: null,
    groupKpiId: null,
    targetDataType: '',
    completionFormula: 'THUAN',
    completionExpression: '',
    scoringMethodId: null,
    scoreByResult: true,
    objectiveId: null,
    weight: '',
    assigningUnitId: null,
    assigningOfficerId: null,
    evaluatingUnitId: null,
    evaluatingOfficerId: null,
    dataSource: 'NHAP_TAY',
    unitOfMeasureId: null,
    isFocus: false,
    resultExpression: 'A',
    components: [{ code: 'A', name: '', formulaDefinitionId: null, source: 'NHAP_TAY' }],
    children: [],
    ...defaults,
  };
}

export function fromDetail(k: KpiDetail): KpiFormValues {
  return {
    id: k.id,
    code: k.code,
    version: k.version,
    structure: k.parentId ? 'DON_LE' : k.structure,
    name: k.name,
    groupAggregation: k.groupAggregation,
    groupExpression: k.groupExpression ?? '',
    perspectiveId: k.perspectiveId,
    groupKpiId: k.groupKpiId,
    targetDataType: k.targetDataType,
    completionFormula: k.completionFormula,
    completionExpression: k.completionExpression ?? '',
    scoringMethodId: k.scoringMethodId,
    scoreByResult: k.scoreByResult,
    objectiveId: k.objectiveId,
    weight: k.weight ? String(k.weight) : '',
    assigningUnitId: k.assigningUnitId,
    assigningOfficerId: k.assigningOfficerId,
    evaluatingUnitId: k.evaluatingUnitId,
    evaluatingOfficerId: k.evaluatingOfficerId,
    dataSource: k.dataSource,
    unitOfMeasureId: k.unitOfMeasureId,
    isFocus: k.isFocus,
    resultExpression: k.resultExpression ?? '',
    components: k.components.map((c) => ({ id: c.id, code: c.code, name: c.name, formulaDefinitionId: c.formulaDefinitionId, source: c.source })),
    children: (k.children ?? []).map(fromDetail),
  };
}

function toRequest(v: KpiFormValues): Record<string, unknown> {
  return {
    ...v,
    weight: v.weight ? Number(v.weight) : null,
    groupExpression: v.groupAggregation === 'CONG_THUC' ? v.groupExpression : null,
    completionExpression: v.completionFormula === 'TUY_CHINH' ? v.completionExpression : null,
    resultExpression: v.resultExpression || null,
    children: v.structure === 'CHA_CON' ? v.children.map((c) => toRequest({ ...c, structure: 'DON_LE', children: [] })) : null,
  };
}

/** Khối trường của form tiêu chí KPI (dùng cho KPI cha/đơn lẻ và sub-form KPI con) */
function KpiFields({ form, isChild, codePreview, lockPerspective, lockStructure }: { form: UseFormReturn<KpiFormValues>; isChild?: boolean; codePreview?: string; lockPerspective?: boolean; lockStructure?: boolean }) {
  const { control, register, watch, formState, setValue } = form;
  const e = formState.errors;
  const perspectives = usePerspectives();
  const perspectiveId = watch('perspectiveId');
  const objectives = useObjectives(perspectiveId);
  const scoring = useScoringMethods();
  const uoms = useUoms();
  const formulas = useFormulas();
  const org = useOrgTree();
  const assigningUnitId = watch('assigningUnitId');
  const evaluatingUnitId = watch('evaluatingUnitId');
  const assigningUsers = useUnitUsers(assigningUnitId);
  const evaluatingUsers = useUnitUsers(evaluatingUnitId);
  const groupKpis = useKpiOptions({ rootOnly: true });
  const comps = useFieldArray({ control, name: 'components' });
  const [exprCheck, setExprCheck] = useState<string | null>(null);
  const groupAgg = watch('groupAggregation');
  const completion = watch('completionFormula');
  const p = isChild ? 'c-' : 'k-';

  const checkExpression = async () => {
    const vars = form.getValues('components').map((c) => c.code);
    try {
      const r = await post<{ valid: boolean; errors: string[]; sampleResult?: number }>(EP.formulas.validateExpression, { expression: form.getValues('resultExpression') || vars[0], variables: vars });
      setExprCheck(r.data!.valid ? 'Biểu thức hợp lệ' : r.data!.errors.join('; '));
    } catch (err) {
      setExprCheck(errorMessage(err));
    }
  };

  return (
    <div className="grid grid-cols-3 gap-x-4 gap-y-3">
      {!isChild && (
        <Field label="Cấu trúc tiêu chí" required className="col-span-2">
          <Controller
            control={control}
            name="structure"
            render={({ field }) => (
              <RadioGroup
                name="Cấu trúc tiêu chí"
                value={field.value}
                onChange={field.onChange}
                disabled={lockStructure}
                options={[
                  { value: 'DON_LE', label: 'KPI đơn lẻ' },
                  { value: 'CHA_CON', label: 'KPI cha – con' },
                ]}
              />
            )}
          />
        </Field>
      )}
      <Field label="Mã tiêu chí" htmlFor={`${p}code`} className={isChild ? 'col-span-1' : ''}>
        <Input id={`${p}code`} readOnly value={codePreview ?? ''} placeholder="Tự động sinh theo viễn cảnh" className="bg-slate-50" />
      </Field>
      <Field label="Tên tiêu chí" required error={e.name?.message} className={isChild ? 'col-span-2' : 'col-span-3'} htmlFor={`${p}name`}>
        <Input id={`${p}name`} {...register('name')} aria-invalid={!!e.name} />
      </Field>
      <Field label="Cách tính kết quả KPI Tập đoàn" required error={e.groupAggregation?.message} htmlFor={`${p}agg`}>
        <Select id={`${p}agg`} options={GROUP_AGG} placeholder="-- Chọn --" {...register('groupAggregation')} />
      </Field>
      {groupAgg === 'CONG_THUC' ? (
        <Field label="Biểu thức tính kết quả KPI Tập đoàn" required error={e.groupExpression?.message} htmlFor={`${p}gexpr`}>
          <Input id={`${p}gexpr`} {...register('groupExpression')} placeholder="VD: SUM(VNPT_HNI, VNPT_HCM)" />
        </Field>
      ) : (
        <div />
      )}
      <Field label="Viễn cảnh" required error={e.perspectiveId?.message} htmlFor={`${p}per`}>
        <Controller
          control={control}
          name="perspectiveId"
          render={({ field }) => (
            <Select
              id={`${p}per`}
              disabled={lockPerspective}
              placeholder="-- Chọn --"
              options={(perspectives.data ?? []).map((x) => ({ value: x.id, label: `${x.code} – ${x.name}` }))}
              value={field.value ?? ''}
              onChange={(ev) => {
                field.onChange(ev.target.value ? Number(ev.target.value) : null);
                setValue('objectiveId', null);
              }}
            />
          )}
        />
      </Field>
      <Field label="Link với KPI tập đoàn">
        <Controller
          control={control}
          name="groupKpiId"
          render={({ field }) => (
            <SearchSelect
              aria-label="Link với KPI tập đoàn"
              options={(groupKpis.data ?? []).filter((k) => k.id !== form.getValues('id')).map((k) => ({ value: k.id, label: `${k.code} – ${k.name}` }))}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </Field>
      <Field label="Loại số liệu giao" required error={e.targetDataType?.message} htmlFor={`${p}tdt`}>
        <Select id={`${p}tdt`} options={TARGET_DATA_TYPES} placeholder="-- Chọn --" {...register('targetDataType')} />
      </Field>
      <Field label="Công thức tỷ lệ hoàn thành chỉ tiêu" htmlFor={`${p}cf`}>
        <Select id={`${p}cf`} options={COMPLETION} {...register('completionFormula')} />
      </Field>
      {completion === 'TUY_CHINH' ? (
        <Field label="Biểu thức tỷ lệ hoàn thành (biến TH, KH, KH_NAM)" required error={e.completionExpression?.message} htmlFor={`${p}cexpr`}>
          <Input id={`${p}cexpr`} {...register('completionExpression')} placeholder="VD: TH / KH * 100" />
        </Field>
      ) : (
        <div />
      )}
      <Field label="Phương pháp tính điểm" required error={e.scoringMethodId?.message} htmlFor={`${p}sm`}>
        <Controller
          control={control}
          name="scoringMethodId"
          render={({ field }) => (
            <Select
              id={`${p}sm`}
              placeholder="-- Chọn --"
              options={(scoring.data ?? []).map((x) => ({ value: x.id, label: x.name }))}
              value={field.value ?? ''}
              onChange={(ev) => field.onChange(ev.target.value ? Number(ev.target.value) : null)}
            />
          )}
        />
      </Field>
      <div className="flex items-end pb-2">
        <Controller control={control} name="scoreByResult" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} label="Tính điểm theo kết quả thực hiện" />} />
      </div>
      <Field label="Mục tiêu trọng tâm" required error={e.objectiveId?.message} htmlFor={`${p}obj`}>
        <Controller
          control={control}
          name="objectiveId"
          render={({ field }) => (
            <Select
              id={`${p}obj`}
              placeholder={perspectiveId ? '-- Chọn --' : '-- Chọn viễn cảnh trước --'}
              options={(perspectiveId ? objectives.data ?? [] : []).map((x) => ({ value: x.id, label: `${x.code} – ${x.name}` }))}
              value={field.value ?? ''}
              onChange={(ev) => field.onChange(ev.target.value ? Number(ev.target.value) : null)}
            />
          )}
        />
      </Field>
      <Field label={isChild ? 'Tỷ trọng (1–100) nội bộ' : 'Tỷ trọng (1–100)'} error={e.weight?.message} htmlFor={`${p}weight`}>
        <Input id={`${p}weight`} inputMode="numeric" {...register('weight')} />
      </Field>
      <Field label="Đơn vị giao" required error={e.assigningUnitId?.message}>
        <Controller
          control={control}
          name="assigningUnitId"
          render={({ field }) => (
            <TreeSelect
              aria-label={isChild ? 'Đơn vị giao (KPI con)' : 'Đơn vị giao'}
              nodes={org.data ?? []}
              value={field.value}
              onChange={(v) => {
                field.onChange(v);
                setValue('assigningOfficerId', null);
              }}
            />
          )}
        />
      </Field>
      <Field label="Cán bộ giao" required error={e.assigningOfficerId?.message} htmlFor={`${p}ao`}>
        <Controller
          control={control}
          name="assigningOfficerId"
          render={({ field }) => (
            <Select
              id={`${p}ao`}
              placeholder={assigningUnitId ? '-- Chọn --' : '-- Chọn Đơn vị giao trước --'}
              options={(assigningUsers.data ?? []).map((u) => ({ value: u.id, label: `${u.fullName} (${u.username})` }))}
              value={field.value ?? ''}
              onChange={(ev) => field.onChange(ev.target.value ? Number(ev.target.value) : null)}
            />
          )}
        />
      </Field>
      <Field label="Đơn vị đánh giá" required error={e.evaluatingUnitId?.message}>
        <Controller
          control={control}
          name="evaluatingUnitId"
          render={({ field }) => (
            <TreeSelect
              aria-label={isChild ? 'Đơn vị đánh giá (KPI con)' : 'Đơn vị đánh giá'}
              nodes={org.data ?? []}
              value={field.value}
              onChange={(v) => {
                field.onChange(v);
                setValue('evaluatingOfficerId', null);
              }}
            />
          )}
        />
      </Field>
      <Field label="Cán bộ đánh giá" required error={e.evaluatingOfficerId?.message} htmlFor={`${p}eo`}>
        <Controller
          control={control}
          name="evaluatingOfficerId"
          render={({ field }) => (
            <Select
              id={`${p}eo`}
              placeholder={evaluatingUnitId ? '-- Chọn --' : '-- Chọn Đơn vị đánh giá trước --'}
              options={(evaluatingUsers.data ?? []).map((u) => ({ value: u.id, label: `${u.fullName} (${u.username})` }))}
              value={field.value ?? ''}
              onChange={(ev) => field.onChange(ev.target.value ? Number(ev.target.value) : null)}
            />
          )}
        />
      </Field>
      <Field label="Nguồn dữ liệu" htmlFor={`${p}ds`}>
        <Select id={`${p}ds`} options={DATA_SOURCES} {...register('dataSource')} />
      </Field>
      <Field label="Đơn vị đo" required error={e.unitOfMeasureId?.message} htmlFor={`${p}uom`}>
        <Controller
          control={control}
          name="unitOfMeasureId"
          render={({ field }) => (
            <Select
              id={`${p}uom`}
              placeholder="-- Chọn --"
              options={(uoms.data ?? []).map((x) => ({ value: x.id, label: x.name }))}
              value={field.value ?? ''}
              onChange={(ev) => field.onChange(ev.target.value ? Number(ev.target.value) : null)}
            />
          )}
        />
      </Field>
      <div className="flex items-end pb-2">
        <Controller control={control} name="isFocus" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} label="Thuộc vùng chỉ đạo trọng tâm" />} />
      </div>

      <div className="col-span-3 mt-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[13px] font-semibold">Thành phần KPI</span>
          <Button size="sm" variant="outline" onClick={() => comps.append({ code: String.fromCharCode(65 + comps.fields.length), name: '', formulaDefinitionId: null, source: 'NHAP_TAY' })}>
            <Plus className="h-3.5 w-3.5" />
            Thêm thành phần
          </Button>
        </div>
        <table className="w-full text-[13px]" aria-label={isChild ? 'Thành phần KPI con' : 'Thành phần KPI'}>
          <thead className="bg-slate-100">
            <tr>
              <th className="w-24 px-2 py-1 text-left">Mã biến</th>
              <th className="px-2 py-1 text-left">Tên thành phần</th>
              <th className="w-72 px-2 py-1 text-left">Định nghĩa KPI công thức</th>
              <th className="w-32 px-2 py-1 text-left">Nguồn</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {comps.fields.map((f, i) => (
              <tr key={f.id} className="border-t border-border align-top">
                <td className="px-1 py-1">
                  <Input aria-label={`Mã biến ${i + 1}`} {...register(`components.${i}.code`)} />
                  {e.components?.[i]?.code && <p className="field-error">{e.components[i]!.code!.message}</p>}
                </td>
                <td className="px-1 py-1">
                  <Input aria-label={`Tên thành phần ${i + 1}`} {...register(`components.${i}.name`)} />
                  {e.components?.[i]?.name && <p className="field-error">{e.components[i]!.name!.message}</p>}
                </td>
                <td className="px-1 py-1">
                  <Controller
                    control={control}
                    name={`components.${i}.formulaDefinitionId`}
                    render={({ field }) => (
                      <Select
                        aria-label={`Định nghĩa KPI công thức ${i + 1}`}
                        placeholder="-- Không --"
                        options={(formulas.data ?? []).map((x) => ({ value: x.id, label: `${x.code} – ${x.name}` }))}
                        value={field.value ?? ''}
                        onChange={(ev) => field.onChange(ev.target.value ? Number(ev.target.value) : null)}
                      />
                    )}
                  />
                </td>
                <td className="px-1 py-1">
                  <Select aria-label={`Nguồn ${i + 1}`} options={COMPONENT_SOURCES} {...register(`components.${i}.source`)} />
                </td>
                <td className="px-1 py-1 text-center">
                  <button type="button" aria-label="Xóa thành phần" disabled={comps.fields.length <= 1} className="p-1 text-slate-500 hover:text-danger disabled:opacity-30" onClick={() => comps.remove(i)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 flex items-end gap-2">
          <Field label="Biểu thức kết quả" error={e.resultExpression?.message} className="flex-1" htmlFor={`${p}rexpr`}>
            <Input id={`${p}rexpr`} {...register('resultExpression')} placeholder="VD: A + B, A / B * 100" />
          </Field>
          <Button variant="outline" onClick={checkExpression}>
            Kiểm tra biểu thức
          </Button>
        </div>
        {exprCheck && <p className={exprCheck === 'Biểu thức hợp lệ' ? 'mt-1 text-xs text-success' : 'mt-1 text-xs text-danger'}>{exprCheck}</p>}
      </div>
    </div>
  );
}

/** 24.1 / 25.1 “Thêm mới tiêu chí KPI” (và 23.4 Sửa) */
export function KpiFormDialog({ kpiId, onClose, onSaved }: { kpiId?: number; onClose: () => void; onSaved: () => void }) {
  const detail = useQuery({ queryKey: ['kpi', kpiId], queryFn: () => get<KpiDetail>(EP.kpis.one(kpiId!)), enabled: !!kpiId, staleTime: 0, gcTime: 0 });
  if (kpiId && !detail.data) return null;
  return <KpiFormInner detail={detail.data} onClose={onClose} onSaved={onSaved} />;
}

function KpiFormInner({ detail, onClose, onSaved }: { detail?: KpiDetail; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!detail;
  const form = useForm<KpiFormValues>({ resolver: zodResolver(kpiSchema) as never, defaultValues: detail ? fromDetail(detail) : emptyKpi() });
  const { watch, handleSubmit, formState, setError } = form;
  const structure = watch('structure');
  const perspectiveId = watch('perspectiveId');
  const [codePreview, setCodePreview] = useState<string>(detail?.code ?? '');
  const children = useFieldArray({ control: form.control, name: 'children' as never });
  const [childEdit, setChildEdit] = useState<{ index: number | null; values: KpiFormValues } | null>(null);
  const perspectives = usePerspectives();

  useEffect(() => {
    if (isEdit || !perspectiveId) return;
    get<{ code: string }>(EP.kpis.nextCode, { perspectiveId })
      .then((r) => setCodePreview(r.code))
      .catch(() => setCodePreview(''));
  }, [perspectiveId, isEdit]);

  const onSubmit = async (v: KpiFormValues) => {
    try {
      if (isEdit) {
        await put(EP.kpis.one(detail!.id), toRequest(v));
        toast.success('Cập nhật thành công');
      } else {
        await post(EP.kpis.list, toRequest(v));
        toast.success('Thêm mới thành công');
      }
      onSaved();
      onClose();
    } catch (e) {
      handleSubmitError(e, setError);
    }
  };

  const childValues = form.watch('children') as KpiFormValues[];
  const newChild = () => {
    const v = form.getValues();
    setChildEdit({
      index: null,
      values: emptyKpi({
        perspectiveId: v.perspectiveId,
        objectiveId: v.objectiveId,
        groupAggregation: v.groupAggregation,
        targetDataType: v.targetDataType,
        completionFormula: v.completionFormula,
        scoringMethodId: v.scoringMethodId,
        assigningUnitId: v.assigningUnitId,
        assigningOfficerId: v.assigningOfficerId,
        evaluatingUnitId: v.evaluatingUnitId,
        evaluatingOfficerId: v.evaluatingOfficerId,
        unitOfMeasureId: v.unitOfMeasureId,
        dataSource: v.dataSource,
      }),
    });
  };
  const perName = perspectives.data?.find((x) => x.id === perspectiveId)?.name;

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={isEdit ? 'Cập nhật tiêu chí KPI' : 'Thêm mới tiêu chí KPI'}
      size="full"
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
      <form noValidate onSubmit={handleSubmit(onSubmit)}>
        <KpiFields form={form} codePreview={codePreview} lockStructure={isEdit && !!detail?.assigned} lockPerspective={isEdit} />
        {structure === 'CHA_CON' && (
          <div className="mt-4 rounded-md border border-border p-3" data-testid="kpi-children">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Danh sách KPI con</h4>
              <Button size="sm" onClick={newChild} disabled={!perspectiveId}>
                <Plus className="h-3.5 w-3.5" />
                Thêm KPI con
              </Button>
            </div>
            <table className="w-full text-[13px]" aria-label="Danh sách KPI con">
              <thead className="bg-slate-100">
                <tr>
                  <th className="w-12 px-2 py-1">STT</th>
                  <th className="px-2 py-1 text-left">Mã – Tên tiêu chí KPI</th>
                  <th className="px-2 py-1 text-left">Viễn cảnh</th>
                  <th className="w-24 px-2 py-1 text-right">Tỷ trọng</th>
                  <th className="w-32 px-2 py-1 text-left">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {childValues.map((c, i) => (
                  <tr key={children.fields[i]?.id ?? i} className="border-t border-border">
                    <td className="px-2 py-1 text-center">{i + 1}</td>
                    <td className="px-2 py-1">{[c.code ?? '(tự sinh khi lưu)', c.name].join(' – ')}</td>
                    <td className="px-2 py-1">{perName}</td>
                    <td className="px-2 py-1 text-right">{c.weight}</td>
                    <td className="px-2 py-1">
                      <Button variant="link" size="sm" className="h-auto" onClick={() => setChildEdit({ index: i, values: c })}>
                        Sửa
                      </Button>
                      <Button variant="link" size="sm" className="ml-2 h-auto text-danger" onClick={() => children.remove(i)}>
                        Xóa
                      </Button>
                    </td>
                  </tr>
                ))}
                {!childValues.length && (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-muted">
                      Chưa có KPI con
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {formState.errors.children && <p className="field-error">{(formState.errors.children as { message?: string }).message}</p>}
          </div>
        )}
      </form>
      {childEdit && (
        <KpiChildDialog
          initial={childEdit.values}
          onClose={() => setChildEdit(null)}
          onConfirm={(v) => {
            if (childEdit.index === null) children.append(v as never);
            else children.update(childEdit.index, v as never);
            setChildEdit(null);
          }}
        />
      )}
    </Dialog>
  );
}

function KpiChildDialog({ initial, onClose, onConfirm }: { initial: KpiFormValues; onClose: () => void; onConfirm: (v: KpiFormValues) => void }) {
  const form = useForm<KpiFormValues>({ resolver: zodResolver(childSchema) as never, defaultValues: { ...initial, structure: 'DON_LE' } });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="KPI con"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={form.handleSubmit((v) => onConfirm({ ...v, children: [] }))}>Xác nhận</Button>
        </>
      }
    >
      <KpiFields form={form} isChild codePreview={initial.code ?? 'Tự sinh khi lưu: <mã cha>.NN'} lockPerspective />
    </Dialog>
  );
}
