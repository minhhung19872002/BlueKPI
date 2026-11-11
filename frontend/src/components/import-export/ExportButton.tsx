import { Download } from 'lucide-react';
import { useState } from 'react';
import { download } from '@/api/http';
import { Button } from '@/components/ui/Button';
import { errorMessage, toast } from '@/components/ui/Toast';

/** Nút “Xuất dữ liệu” — xuất xlsx theo điều kiện tìm kiếm hiện tại */
export function ExportButton({ url, params, label = 'Xuất dữ liệu', method = 'get', body }: { url: string; params?: Record<string, unknown>; label?: string; method?: 'get' | 'post'; body?: unknown }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await download(url, params, method, body);
        } catch (e) {
          toast.error(errorMessage(e, 'Xuất dữ liệu không thành công'));
        } finally {
          setBusy(false);
        }
      }}
    >
      {!busy && <Download className="h-4 w-4" />}
      {label}
    </Button>
  );
}
