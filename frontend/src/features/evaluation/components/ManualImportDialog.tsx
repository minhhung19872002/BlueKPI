import { Download, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { download, upload } from '@/api/http';
import { EP } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Select } from '@/components/ui/Input';
import { errorMessage, toast } from '@/components/ui/Toast';
import { Section } from '@/features/common/shared';
import type { EvalHeader } from './types';

interface ImportOut {
  imported: number;
  total: number;
  errors: { row: number; message: string }[];
  message: string;
}

const MAX = 10 * 1024 * 1024;

/** 44.2 Dialog “Nhập dữ liệu nhập tay” */
export function ManualImportDialog({ evalKpiId, components, onClose, onDone }: { evalKpiId: number; components: EvalHeader['components']; onClose: () => void; onDone: () => void }) {
  const manual = components.filter((c) => c.source === 'NHAP_TAY');
  const [componentId, setComponentId] = useState<string>(manual.length === 1 ? String(manual[0].componentId) : '');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<ImportOut | null>(null);

  const pickFile = (f: File | null | undefined) => {
    setOut(null);
    if (!f) return setFile(null);
    if (!/\.xlsx$/i.test(f.name)) {
      setErrors((e) => ({ ...e, file: 'Chỉ chấp nhận file .xlsx' }));
      return setFile(null);
    }
    if (f.size > MAX) {
      setErrors((e) => ({ ...e, file: 'Dung lượng file tối đa 10MB' }));
      return setFile(null);
    }
    setErrors((e) => ({ ...e, file: '' }));
    setFile(f);
  };

  const downloadTemplate = async () => {
    if (!componentId) {
      setErrors((e) => ({ ...e, componentId: 'Vui lòng chọn Thành phần nhập tay' }));
      return;
    }
    try {
      await download(EP.evaluations.manualTemplate(evalKpiId), { componentId });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!componentId) errs.componentId = 'Vui lòng chọn Thành phần nhập tay';
    if (!file) errs.file = 'Vui lòng chọn file dữ liệu';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file!);
      const res = await upload<ImportOut>(`${EP.evaluations.manualImport(evalKpiId)}?componentId=${componentId}`, fd);
      const msg = res.message || res.data?.message || 'Nhập dữ liệu thành công';
      toast.success(msg);
      setOut(res.data ?? null);
      onDone();
      if (!res.data?.errors?.length) onClose();
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
      title="Nhập dữ liệu nhập tay"
      size="md"
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
      <Field label="Thành phần nhập tay" required htmlFor="manual-comp" error={errors.componentId} className="mb-4">
        <Select
          id="manual-comp"
          placeholder="-- Chọn thành phần --"
          options={manual.map((c) => ({ value: c.componentId, label: `${c.code} – ${c.name}` }))}
          value={componentId}
          aria-invalid={!!errors.componentId}
          onChange={(e) => {
            setComponentId(e.target.value);
            setErrors((x) => ({ ...x, componentId: '' }));
          }}
        />
      </Field>
      <Section title="Tải file mẫu">
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4" />
          Tải file mẫu
        </Button>
      </Section>
      <Section title="Tải file lên">
        <label
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border p-5 text-sm text-slate-600 hover:border-primary"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pickFile(e.dataTransfer.files?.[0]);
          }}
        >
          <UploadCloud className="h-6 w-6 text-primary" />
          <span>{file ? file.name : 'Kéo thả hoặc bấm để chọn file .xlsx (tối đa 10MB)'}</span>
          <input type="file" accept=".xlsx" className="sr-only" data-testid="manual-import-file" onChange={(e) => pickFile(e.target.files?.[0])} />
        </label>
        {errors.file && (
          <p className="field-error" role="alert">
            {errors.file}
          </p>
        )}
      </Section>
      {out && (
        <div className="rounded border border-border p-3 text-sm" data-testid="manual-import-result">
          <div className="font-medium">{out.message}</div>
          {out.errors?.length > 0 && (
            <table className="mt-2 w-full text-[13px]" aria-label="Danh sách dòng lỗi">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-2 py-1 text-left">Dòng</th>
                  <th className="px-2 py-1 text-left">Lỗi</th>
                </tr>
              </thead>
              <tbody>
                {out.errors.map((e) => (
                  <tr key={e.row} className="border-t border-border">
                    <td className="px-2 py-1">{e.row}</td>
                    <td className="px-2 py-1 text-danger">{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Dialog>
  );
}
