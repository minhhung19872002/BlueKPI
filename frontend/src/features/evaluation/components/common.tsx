import { useQuery } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import { get } from '@/api/http';
import { EP } from '@/api/endpoints';
import { Drawer } from '@/components/ui/Dialog';
import { ReadField } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Misc';
import { errorMessage, toast } from '@/components/ui/Toast';
import { codeName, Section } from '@/features/common/shared';
import { fmtDateTime, fmtNum, fmtPct } from '@/lib/format';
import { lbl, periodLabel, RATING_OPTIONS, ratingColor, RESULT_STATUS, resultStatusColor } from './labels';
import type { FileRef, ResultDetail } from './types';

export function ResultStatusBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  return <Badge color={resultStatusColor(status)}>{lbl(RESULT_STATUS, status)}</Badge>;
}

export function RatingBadge({ rating }: { rating?: string | null }) {
  if (!rating) return null;
  return <Badge color={ratingColor(rating)}>{lbl(RATING_OPTIONS, rating)}</Badge>;
}

/** Tải file đính kèm: lấy URL ký trước rồi mở */
export async function openFile(id: number) {
  try {
    const r = await get<{ url: string }>(EP.files.url(id));
    window.open(r.url, '_blank', 'noopener');
  } catch (e) {
    toast.error(errorMessage(e));
  }
}

export function FileLinks({ files }: { files?: FileRef[] }) {
  if (!files?.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {files.map((f) => (
        <button key={f.id} type="button" className="inline-flex items-center gap-1 text-[13px] text-primary hover:underline" onClick={() => openFile(f.id)}>
          <Paperclip className="h-3.5 w-3.5" />
          {f.originalName}
        </button>
      ))}
    </div>
  );
}

/** Thông tin đề xuất mới nhất của đơn vị */
export const latestRequest = (d?: ResultDetail) => (d?.requests?.length ? d.requests[0] : undefined);

/** 40.3 / 20.1 Drawer “Thông tin kết quả thẩm định KPI” */
export function ResultDetailDrawer({ id, url, onClose }: { id: number; url: (id: number) => string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['eval-result-detail', url(id)], queryFn: () => get<ResultDetail>(url(id)), gcTime: 0 });
  const d = q.data;
  const r = d?.result;
  const req = latestRequest(d);
  const handled = d?.requests?.find((x) => x.status === 'DA_XU_LY');
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title="Thông tin kết quả thẩm định KPI" width="w-[900px]">
      {q.isError && <div className="text-sm text-danger">{errorMessage(q.error)}</div>}
      {r && d && (
        <>
          <Section title="Thông tin chung">
            <div className="grid grid-cols-3 gap-3">
              <ReadField label="Mã – Tên đơn vị" value={codeName(r.orgUnitCode, r.orgUnitName)} />
              <ReadField label="Mã – Tên chỉ tiêu KPI" value={codeName(r.kpiCode, r.kpiName)} className="col-span-2" />
              <ReadField label="Kỳ đánh giá" value={`${periodLabel(r.periodCode)} ${r.year}`} />
              <ReadField label="Đơn vị đo" value={r.unitOfMeasureName} />
              <ReadField label="Trạng thái đánh giá" value={<ResultStatusBadge status={r.status} />} />
              <ReadField label="Trọng số" value={fmtNum(r.weight, 2)} />
              <ReadField label="Mục tiêu giao" value={fmtNum(r.planValue, 2)} />
              <ReadField label="Kết quả" value={fmtNum(r.finalResult, 2)} />
              <ReadField label="% TH/KH" value={fmtPct(r.completionRate)} />
              <ReadField label="Điểm" value={fmtNum(r.score, 2)} />
              <ReadField label="Đánh giá" value={<RatingBadge rating={r.rating} />} />
              <ReadField label="Ngày cập nhật" value={fmtDateTime(r.updatedAt)} />
            </div>
          </Section>
          <Section title="Thành phần KPI">
            <table className="w-full text-[13px]" aria-label="Danh sách thành phần">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-2 py-1 text-left">Mã thành phần</th>
                  <th className="px-2 py-1 text-left">Tên thành phần</th>
                  <th className="px-2 py-1 text-right">Kết quả KPI</th>
                  <th className="px-2 py-1 text-right">ĐC kỳ trước</th>
                  <th className="px-2 py-1 text-right">Điều chỉnh</th>
                  <th className="px-2 py-1 text-right">Kết quả cuối</th>
                </tr>
              </thead>
              <tbody>
                {(r.components ?? []).map((c) => (
                  <tr key={c.componentId} className="border-t border-border">
                    <td className="px-2 py-1">{c.code}</td>
                    <td className="px-2 py-1">{c.name}</td>
                    <td className="px-2 py-1 text-right">{fmtNum(c.value, 2)}</td>
                    <td className="px-2 py-1 text-right">{fmtNum(c.prevAdjustment, 2)}</td>
                    <td className="px-2 py-1 text-right">{fmtNum(c.adjustment, 2)}</td>
                    <td className="px-2 py-1 text-right">{fmtNum(c.finalValue, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          <Section title="Ý kiến đề xuất của đơn vị">
            {req ? (
              <div className="text-sm" data-testid="unit-proposal">
                <div className="whitespace-pre-wrap">{req.proposalNote}</div>
                <div className="mt-1 text-xs text-muted">
                  {req.requestedByName} – {fmtDateTime(req.createdAt)}
                </div>
                <FileLinks files={req.files} />
              </div>
            ) : (
              <div className="text-sm text-muted">Không có đề xuất</div>
            )}
          </Section>
          <Section title="Thông tin điều chỉnh">
            {handled ? (
              <div className="grid grid-cols-3 gap-3">
                <ReadField label="Người điều chỉnh" value={handled.handledBy} />
                <ReadField label="Thời gian điều chỉnh" value={fmtDateTime(handled.handledAt)} />
                <ReadField
                  label="Quyết định điều chỉnh"
                  value={handled.decisionFileId ? <FileLinks files={[{ id: handled.decisionFileId, originalName: handled.decisionFileName ?? 'Quyết định' }]} /> : ''}
                />
                <ReadField label="Lý do điều chỉnh" value={handled.handlingReason} className="col-span-3" />
              </div>
            ) : (
              <div className="text-sm text-muted">Chưa có điều chỉnh</div>
            )}
          </Section>
          <Section title="Lịch sử trao đổi">
            {d.feedback?.length ? (
              <ul className="space-y-2" aria-label="Lịch sử trao đổi">
                {d.feedback.map((f, i) => (
                  <li key={i} className="rounded border border-border p-2 text-sm">
                    <div className="text-xs text-muted">
                      <b className="text-slate-700">{f.authorName}</b> – {fmtDateTime(f.at)}
                    </div>
                    <div className="whitespace-pre-wrap">{f.content}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted">Chưa có trao đổi</div>
            )}
          </Section>
          <Section title="Dòng thời gian trạng thái">
            {d.timeline?.length ? (
              <ol className="space-y-2 border-l-2 border-primary/30 pl-3" aria-label="Dòng thời gian trạng thái">
                {d.timeline.map((t, i) => (
                  <li key={i} className="text-sm">
                    <div className="text-xs text-muted">
                      {fmtDateTime(t.at)} – {t.by}
                    </div>
                    <div>
                      {t.fromStatus ? `${lbl(RESULT_STATUS, t.fromStatus)} → ` : ''}
                      <b>{lbl(RESULT_STATUS, t.toStatus)}</b>
                      {t.note ? ` (${t.note})` : ''}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="text-sm text-muted">Chưa có dữ liệu</div>
            )}
          </Section>
        </>
      )}
    </Drawer>
  );
}

/** Ô nhập số (chấp nhận định dạng 1.234,5) */
export function numStr(v?: number | null): string {
  return v === null || v === undefined ? '' : String(v);
}
