import { FileSpreadsheet, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { download, get, upload, post } from '@/api/http';
import { EP } from '@/api/endpoints';
import type { ImportCommitResult, ImportPreview } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Misc';
import { errorMessage, toast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  templateUrl: string;
  validateUrl: string;
  commitUrl: string;
  onDone?: () => void;
  title?: string;
}

const MAX_MB = 10;

/**
 * Dialog “Nhập dữ liệu từ file” (PHẦN C §0.2): “Tải file mẫu” → chọn/kéo-thả .xlsx → “Kiểm tra”
 * → bảng xem trước (Dòng, cột dữ liệu, Trạng thái, Mô tả lỗi) → “Xác nhận nhập”.
 */
export function ImportDialog({ open, onOpenChange, templateUrl, validateUrl, commitUrl, onDone, title = 'Nhập dữ liệu từ file' }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const pick = (f: File | undefined | null) => {
    setError(null);
    setPreview(null);
    setResult(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.xlsx')) return setError('Chỉ chấp nhận file .xlsx');
    if (f.size > MAX_MB * 1024 * 1024) return setError(`File vượt quá ${MAX_MB} MB`);
    setFile(f);
  };

  const check = async () => {
    if (!file) return setError('Vui lòng chọn file');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await upload<ImportPreview>(validateUrl, fd);
      setPreview(r.data!);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const r = await post<ImportCommitResult>(commitUrl, { importToken: preview.importToken });
      setResult(r.data!);
      toast.success(r.data!.message);
      onDone?.();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const downloadErrors = async () => {
    if (!result?.errorFileId) return;
    const { url } = await get<{ url: string }>(EP.files.url(result.errorFileId));
    window.open(url, '_blank', 'noopener');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
      title={title}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button variant="secondary" onClick={check} loading={busy && !preview} disabled={!file || !!result}>
            Kiểm tra
          </Button>
          <Button onClick={commit} loading={busy && !!preview} disabled={!preview || !preview.valid || !!result}>
            Xác nhận nhập
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <button type="button" className="inline-flex items-center gap-1 text-sm text-primary hover:underline" onClick={() => download(templateUrl).catch((e) => toast.error(errorMessage(e)))}>
          <FileSpreadsheet className="h-4 w-4" />
          Tải file mẫu
        </button>
        <div
          className={cn('flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-sm', drag ? 'border-primary bg-primary-soft' : 'border-slate-300 bg-slate-50')}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          data-testid="import-dropzone"
        >
          <Upload className="mb-1 h-6 w-6 text-slate-400" />
          <div>{file ? <b>{file.name}</b> : 'Chọn hoặc kéo thả file vào đây (.xlsx, tối đa 10 MB)'}</div>
          <input ref={inputRef} type="file" accept=".xlsx" className="hidden" data-testid="import-file" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
        {error && <p className="field-error">{error}</p>}
        {result && (
          <div className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800" data-testid="import-result">
            {result.message}
            {result.errorFileId && (
              <button type="button" className="ml-3 text-primary underline" onClick={downloadErrors}>
                Tải file lỗi
              </button>
            )}
          </div>
        )}
        {preview && (
          <div>
            <div className="mb-2 text-sm">
              Tổng: <b>{preview.total}</b> dòng — Hợp lệ: <b className="text-success">{preview.valid}</b> — Lỗi: <b className="text-danger">{preview.invalid}</b>
            </div>
            <div className="max-h-80 overflow-auto rounded border border-border">
              <table className="w-full text-[13px]" aria-label="Bảng xem trước">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Dòng</th>
                    {preview.columns.map((c) => (
                      <th key={c.key} className="px-2 py-1.5 text-left">
                        {c.header}
                      </th>
                    ))}
                    <th className="px-2 py-1.5 text-left">Trạng thái</th>
                    <th className="px-2 py-1.5 text-left">Mô tả lỗi</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.row} className="border-t border-border">
                      <td className="px-2 py-1">{r.row}</td>
                      {preview.columns.map((c) => (
                        <td key={c.key} className="px-2 py-1">
                          {r.data[c.key] ?? ''}
                        </td>
                      ))}
                      <td className="px-2 py-1">{r.valid ? <Badge color="green">Hợp lệ</Badge> : <Badge color="red">Lỗi</Badge>}</td>
                      <td className="px-2 py-1 text-danger">{r.errorMessage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
