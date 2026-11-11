import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, get, upload } from '@/api/http';
import { EP } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, ReadField, Textarea } from '@/components/ui/Input';
import { errorMessage, toast } from '@/components/ui/Toast';
import { codeName, Section } from '@/features/common/shared';
import { ResultStatusBadge } from '@/features/evaluation/components/common';
import { periodLabel } from '@/features/evaluation/components/labels';
import type { ResultDetail } from '@/features/evaluation/components/types';
import { fmtNum, parseNum } from '@/lib/format';

const ACCEPT = '.xlsx,.xls,.docx,.pdf,.png,.jpg,.jpeg';
const MAX = 10 * 1024 * 1024;

/** 21.1 Dialog “Đề nghị điều chỉnh kết quả KPI” */
export function ProposeDialog({ resultId, onClose, onSaved }: { resultId: number; onClose: () => void; onSaved: () => void }) {
  const q = useQuery({ queryKey: ['eval-result-detail', EP.myKpi.reviewDetail(resultId)], queryFn: () => get<ResultDetail>(EP.myKpi.reviewDetail(resultId)), gcTime: 0 });
  const r = q.data?.result;
  const [vals, setVals] = useState<Record<number, string>>({});
  const [adjs, setAdjs] = useState<Record<number, string>>({});
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const pick = (list: FileList | null) => {
    const arr = Array.from(list ?? []);
    const bad = arr.find((f) => !ACCEPT.split(',').some((ext) => f.name.toLowerCase().endsWith(ext)));
    const big = arr.find((f) => f.size > MAX);
    if (bad || big) {
      setErrors((e) => ({ ...e, files: bad ? `File “${bad.name}” không đúng định dạng cho phép` : `File “${big!.name}” vượt quá 10MB` }));
      setFiles([]);
      return;
    }
    setErrors((e) => ({ ...e, files: '' }));
    setFiles(arr);
  };

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!note.trim()) errs.note = 'Vui lòng nhập Ý kiến đề xuất';
    setErrors(errs);
    if (Object.keys(errs).length || !r) return;
    setBusy(true);
    try {
      const fd = new FormData();
      const components = (r.components ?? [])
        .map((c) => ({ componentId: c.componentId, proposedValue: parseNum(vals[c.componentId]), proposedAdjustment: parseNum(adjs[c.componentId]) }))
        .filter((c) => c.proposedValue !== null || c.proposedAdjustment !== null);
      fd.append('data', JSON.stringify({ components, note: note.trim() }));
      files.forEach((f) => fd.append('files', f));
      const res = await upload(EP.myKpi.adjustRequest(resultId), fd);
      toast.success(res.message || 'Gửi đề nghị điều chỉnh thành công');
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors.length) setErrors(Object.fromEntries(e.fieldErrors.map((f) => [f.field, f.message])));
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Đề nghị điều chỉnh kết quả KPI"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} loading={busy} disabled={!r}>
            Gửi
          </Button>
        </>
      }
    >
      {q.isError && <div className="text-sm text-danger">{errorMessage(q.error)}</div>}
      {r && (
        <>
          <Section title="Thông tin KPI">
            <div className="grid grid-cols-3 gap-3">
              <ReadField label="Mã – Tên tiêu chí KPI" value={codeName(r.kpiCode, r.kpiName)} className="col-span-2" />
              <ReadField label="Kỳ đánh giá" value={`${periodLabel(r.periodCode)} ${r.year}`} />
              <ReadField label="Đơn vị" value={codeName(r.orgUnitCode, r.orgUnitName)} />
              <ReadField label="Kế hoạch giao" value={fmtNum(r.planValue, 2)} />
              <ReadField label="Kết quả" value={fmtNum(r.finalResult, 2)} />
              <ReadField label="Điểm" value={fmtNum(r.score, 2)} />
              <ReadField label="Trạng thái đánh giá" value={<ResultStatusBadge status={r.status} />} />
            </div>
          </Section>
          <Section title="Thành phần KPI">
            <table className="w-full text-[13px]" aria-label="Thành phần KPI">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-2 py-1 text-left">Mã thành phần</th>
                  <th className="px-2 py-1 text-left">Tên thành phần</th>
                  <th className="px-2 py-1 text-right">Kết quả hiện tại</th>
                  <th className="px-2 py-1 text-right">Kết quả KPI đề xuất</th>
                  <th className="px-2 py-1 text-right">Điều chỉnh đề xuất</th>
                </tr>
              </thead>
              <tbody>
                {(r.components ?? []).map((c) => (
                  <tr key={c.componentId} className="border-t border-border">
                    <td className="px-2 py-1">{c.code}</td>
                    <td className="px-2 py-1">{c.name}</td>
                    <td className="px-2 py-1 text-right">{fmtNum(c.finalValue ?? c.value, 2)}</td>
                    <td className="px-2 py-1 text-right">
                      <Input
                        aria-label={`Kết quả KPI đề xuất ${c.code}`}
                        className="ml-auto h-8 w-28 text-right"
                        inputMode="decimal"
                        value={vals[c.componentId] ?? ''}
                        onChange={(e) => setVals((s) => ({ ...s, [c.componentId]: e.target.value }))}
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <Input
                        aria-label={`Điều chỉnh đề xuất ${c.code}`}
                        className="ml-auto h-8 w-28 text-right"
                        inputMode="decimal"
                        value={adjs[c.componentId] ?? ''}
                        onChange={(e) => setAdjs((s) => ({ ...s, [c.componentId]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Field label="Ý kiến đề xuất" required htmlFor="propose-note" error={errors.note} className="mb-3">
            <Textarea id="propose-note" value={note} aria-invalid={!!errors.note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Field label="File minh chứng" htmlFor="evidence-files" error={errors.files}>
            <input id="evidence-files" type="file" multiple accept={ACCEPT} data-testid="evidence-files" className="block w-full text-sm" onChange={(e) => pick(e.target.files)} />
            {files.length > 0 && <div className="mt-1 text-xs text-muted">{files.map((f) => f.name).join(', ')}</div>}
          </Field>
        </>
      )}
    </Dialog>
  );
}
