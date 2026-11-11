import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, get, post, put, upload } from '@/api/http';
import { EP } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, ReadField, Textarea } from '@/components/ui/Input';
import { errorMessage, toast } from '@/components/ui/Toast';
import { codeName, Section } from '@/features/common/shared';
import { fmtDateTime, fmtNum, parseNum } from '@/lib/format';
import { FileLinks, latestRequest, numStr, ResultStatusBadge } from './common';
import { periodLabel } from './labels';
import type { ResultDetail } from './types';

interface PreviewOut {
  resultId: number;
  finalResult?: number | null;
  error?: string | null;
  components?: { code: string; finalValue?: number | null }[];
}

const MAX_FILE = 10 * 1024 * 1024;

/** 41.1 (mode adjust) / 42.1 (mode manual) Dialog “Cập nhật, điều chỉnh kết quả KPI cho đơn vị” */
export function AdjustDialog({ resultId, mode, onClose, onSaved }: { resultId: number; mode: 'adjust' | 'manual'; onClose: () => void; onSaved: () => void }) {
  const q = useQuery({ queryKey: ['eval-result-detail', EP.evaluations.result(resultId)], queryFn: () => get<ResultDetail>(EP.evaluations.result(resultId)), gcTime: 0 });
  const d = q.data;
  const r = d?.result;
  const [values, setValues] = useState<Record<number, string>>({});
  const [adjs, setAdjs] = useState<Record<number, string>>({});
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PreviewOut | null>(null);
  const [saving, setSaving] = useState(false);
  const [inited, setInited] = useState(false);

  if (r && !inited) {
    const v: Record<number, string> = {};
    const a: Record<number, string> = {};
    (r.components ?? []).forEach((c) => {
      v[c.componentId] = numStr(c.value);
      a[c.componentId] = numStr(c.adjustment ?? (mode === 'adjust' ? c.unitProposedAdjustment : null));
    });
    setValues(v);
    setAdjs(a);
    setInited(true);
  }

  const comps = useMemo(
    () =>
      (r?.components ?? []).map((c) => ({
        componentId: c.componentId,
        ...(mode === 'manual' && c.source === 'NHAP_TAY' ? { value: parseNum(values[c.componentId]) } : {}),
        adjustment: parseNum(adjs[c.componentId]),
      })),
    [r, values, adjs, mode],
  );

  // Tính lại “Kết quả sau điều chỉnh” (debounce 300ms)
  useEffect(() => {
    if (!r || !inited) return;
    const t = setTimeout(() => {
      post<PreviewOut[]>(EP.evaluations.preview(r.evaluationKpiId), { rows: [{ resultId: r.id, components: comps, adjustment: r.adjustment, description: r.description }] })
        .then((res) => setPreview(res.data?.[0] ?? null))
        .catch(() => setPreview(null));
    }, 300);
    return () => clearTimeout(t);
  }, [r, comps, inited]);

  const save = async () => {
    const errs: Record<string, string> = {};
    if (mode === 'adjust' && !reason.trim()) errs.reason = 'Vui lòng nhập Lý do điều chỉnh';
    if (file && file.size > MAX_FILE) errs.decisionFile = 'Dung lượng file tối đa 10MB';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      let res;
      if (mode === 'adjust') {
        const fd = new FormData();
        fd.append('data', JSON.stringify({ components: comps.map((c) => ({ componentId: c.componentId, adjustment: c.adjustment })), reason: reason.trim() }));
        if (file) fd.append('decisionFile', file);
        res = await upload(EP.evaluations.adjust(resultId), fd, 'put');
        toast.success(res.message || 'Điều chỉnh kết quả thành công');
      } else {
        const manualComps = (r?.components ?? []).filter((c) => c.source === 'NHAP_TAY').map((c) => ({ componentId: c.componentId, value: parseNum(values[c.componentId]) }));
        res = await put(EP.evaluations.manual(resultId), { components: manualComps });
        toast.success(res.message || 'Cập nhật kết quả thành công');
      }
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors.length) setErrors(Object.fromEntries(e.fieldErrors.map((f) => [f.field, f.message])));
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const req = latestRequest(d);
  const finalOf = (code: string, fallback?: number | null) => {
    const p = preview?.components?.find((x) => x.code === code);
    return p ? p.finalValue : fallback;
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Cập nhật, điều chỉnh kết quả KPI cho đơn vị"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={save} loading={saving} disabled={!r}>
            Lưu
          </Button>
        </>
      }
    >
      {q.isError && <div className="text-sm text-danger">{errorMessage(q.error)}</div>}
      {r && d && (
        <>
          <Section title="Thông tin chung">
            <div className="grid grid-cols-4 gap-3">
              <ReadField label="Mã KPI" value={r.kpiCode} />
              <ReadField label="Tên tiêu chí" value={r.kpiName} className="col-span-3" />
              <ReadField label="Đơn vị" value={codeName(r.orgUnitCode, r.orgUnitName)} />
              <ReadField label="Kỳ đánh giá" value={`${periodLabel(r.periodCode)} ${r.year}`} />
              <ReadField label="Đơn vị đo" value={r.unitOfMeasureName} />
              <ReadField label="Tình trạng" value={<ResultStatusBadge status={r.status} />} />
              <ReadField label="Kế hoạch giao" value={fmtNum(r.planValue, 2)} />
              <ReadField label="Kết quả cũ" value={fmtNum(r.finalResult, 2)} />
              <div>
                <div className="text-xs text-muted">Kết quả sau điều chỉnh</div>
                <div className="mt-0.5 min-h-5 text-sm font-semibold text-primary" data-testid="result-after-adjust">
                  {fmtNum(preview ? preview.finalResult : r.finalResult, 2) || '—'}
                </div>
                {preview?.error && <div className="text-xs text-danger">{preview.error}</div>}
              </div>
              <ReadField label="Ngày cập nhật" value={fmtDateTime(r.updatedAt)} />
            </div>
          </Section>
          <Section title="Ý kiến đề xuất của đơn vị">
            {req ? (
              <div className="text-sm">
                <div className="whitespace-pre-wrap">{req.proposalNote}</div>
                <FileLinks files={req.files} />
              </div>
            ) : (
              <div className="text-sm text-muted">Không có đề xuất</div>
            )}
          </Section>
          <Section title="Thành phần KPI">
            <div className="overflow-auto">
              <table className="w-full text-[13px]" aria-label="Thành phần KPI">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-2 py-1 text-left">Mã thành phần</th>
                    <th className="px-2 py-1 text-left">Tên thành phần</th>
                    <th className="px-2 py-1 text-right">Kết quả KPI</th>
                    <th className="px-2 py-1 text-right">Kết quả KPI ĐV đề xuất</th>
                    <th className="px-2 py-1 text-right">ĐC kỳ trước</th>
                    <th className="px-2 py-1 text-right">Điều chỉnh ĐV đề xuất</th>
                    <th className="px-2 py-1 text-right">Điều chỉnh</th>
                    <th className="px-2 py-1 text-right">Kết quả cuối</th>
                  </tr>
                </thead>
                <tbody>
                  {(r.components ?? []).map((c) => (
                    <tr key={c.componentId} className="border-t border-border">
                      <td className="px-2 py-1">{c.code}</td>
                      <td className="px-2 py-1">{c.name}</td>
                      <td className="px-2 py-1 text-right">
                        {mode === 'manual' && c.source === 'NHAP_TAY' ? (
                          <Input
                            aria-label={`Kết quả KPI ${c.code}`}
                            className="h-8 w-28 text-right"
                            inputMode="decimal"
                            value={values[c.componentId] ?? ''}
                            onChange={(e) => setValues((s) => ({ ...s, [c.componentId]: e.target.value }))}
                          />
                        ) : (
                          fmtNum(c.value, 2)
                        )}
                      </td>
                      <td className="px-2 py-1 text-right">{fmtNum(c.unitProposedValue, 2)}</td>
                      <td className="px-2 py-1 text-right">{fmtNum(c.prevAdjustment, 2)}</td>
                      <td className="px-2 py-1 text-right">{fmtNum(c.unitProposedAdjustment, 2)}</td>
                      <td className="px-2 py-1 text-right">
                        {mode === 'adjust' ? (
                          <Input
                            aria-label={`Điều chỉnh ${c.code}`}
                            className="h-8 w-28 text-right"
                            inputMode="decimal"
                            value={adjs[c.componentId] ?? ''}
                            onChange={(e) => setAdjs((s) => ({ ...s, [c.componentId]: e.target.value }))}
                          />
                        ) : (
                          fmtNum(c.adjustment, 2)
                        )}
                      </td>
                      <td className="px-2 py-1 text-right">{fmtNum(finalOf(c.code, c.finalValue), 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          {mode === 'adjust' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quyết định điều chỉnh" htmlFor="decision-file" error={errors.decisionFile}>
                <input
                  id="decision-file"
                  type="file"
                  data-testid="decision-file"
                  accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg,.jpeg"
                  className="block w-full text-sm"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Field>
              <Field label="Lý do điều chỉnh" required htmlFor="adjust-reason" error={errors.reason} className="col-span-2">
                <Textarea id="adjust-reason" value={reason} aria-invalid={!!errors.reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}
