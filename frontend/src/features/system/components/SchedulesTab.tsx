import { useQuery } from '@tanstack/react-query';
import { Play } from 'lucide-react';
import { useState } from 'react';
import { get, post, put } from '@/api/http';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { SearchBar } from '@/components/data-grid/SearchBar';
import { useListState } from '@/components/data-grid/useListState';
import { Button } from '@/components/ui/Button';
import { Dialog, Drawer } from '@/components/ui/Dialog';
import { Field, Input, ReadField, Select, Textarea } from '@/components/ui/Input';
import { Badge, Switch } from '@/components/ui/Misc';
import { errorMessage, toast } from '@/components/ui/Toast';
import { RowActions, Section } from '@/features/common/shared';
import { fmtDateTime } from '@/lib/format';
import { useHasPerm } from '@/stores/sessionStore';

interface ScheduleRow {
  id: number;
  code: string;
  name: string;
  jobType: string;
  jobTypeName: string;
  cron: string;
  cronDescription: string;
  enabled: boolean;
  params?: string;
  lastRunAt?: string;
  lastStatus?: string;
  nextRunAt?: string;
  version: number;
}
interface RunRow {
  id: number;
  trigger: string;
  startedAt: string;
  finishedAt?: string;
  status: string;
  total: number;
  success: number;
  failed: number;
  message?: string;
  triggeredBy?: string;
}

const RESULT: Record<string, { label: string; color: 'green' | 'red' | 'amber' | 'blue' }> = {
  THANH_CONG: { label: 'Thành công', color: 'green' },
  LOI: { label: 'Lỗi', color: 'red' },
  MOT_PHAN: { label: 'Một phần', color: 'amber' },
  DANG_CHAY: { label: 'Đang chạy', color: 'blue' },
};
export const resultBadge = (s?: string) => (s ? <Badge color={RESULT[s]?.color ?? 'slate'}>{RESULT[s]?.label ?? s}</Badge> : null);

/** 26.17–26.19 Lịch đồng bộ */
export function SchedulesTab() {
  const canUpdate = useHasPerm('SCHEDULE:UPDATE');
  const canRun = useHasPerm('SCHEDULE:RUN');
  const list = useListState<{ keyword: string }, ScheduleRow>('schedules', EP.schedules.list, { keyword: '' });
  const [edit, setEdit] = useState<ScheduleRow | null>(null);
  const [view, setView] = useState<number | null>(null);

  const run = async (r: ScheduleRow) => {
    try {
      const res = await post(EP.schedules.run(r.id));
      toast.success(res.message ?? 'Đã gửi yêu cầu chạy');
      setTimeout(() => list.query.refetch(), 2500);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <SearchBar keyword={list.draft.keyword} onKeywordChange={(v) => list.set('keyword', v)} placeholder="Mã hoặc tên lịch" onSearch={list.search} onReset={list.reset} />
      <h3 className="mb-2 text-sm font-semibold">Danh sách lịch đồng bộ</h3>
      <DataGrid<ScheduleRow>
        title="Danh sách lịch đồng bộ"
        {...list.gridProps}
        rowKey={(r) => r.id}
        columns={[
          { key: 'code', header: 'Mã lịch', sortable: true, width: 110 },
          { key: 'name', header: 'Tên lịch', sortable: true, width: 180 },
          { key: 'jobTypeName', header: 'Loại công việc', width: 160 },
          {
            key: 'cron',
            header: 'Lịch chạy',
            width: 190,
            render: (r) => (
              <div>
                <div>{r.cronDescription}</div>
                <code className="text-xs text-muted">{r.cron}</code>
              </div>
            ),
          },
          { key: 'enabled', header: 'Trạng thái', width: 80, render: (r) => (r.enabled ? <Badge color="green">Bật</Badge> : <Badge>Tắt</Badge>) },
          { key: 'lastRunAt', header: 'Lần chạy gần nhất', sortable: true, width: 130, render: (r) => fmtDateTime(r.lastRunAt) },
          { key: 'lastStatus', header: 'Kết quả lần chạy', width: 110, render: (r) => resultBadge(r.lastStatus) },
          { key: 'nextRunAt', header: 'Lần chạy tiếp theo', width: 130, render: (r) => fmtDateTime(r.nextRunAt) },
          {
            key: 'actions',
            header: 'Thao tác',
            width: 150,
            render: (r) => (
              <RowActions
                actions={[
                  { label: 'Xem', onClick: () => setView(r.id) },
                  { label: 'Sửa', onClick: () => setEdit(r), show: canUpdate },
                  { label: 'Chạy ngay', onClick: () => run(r), show: canRun },
                ]}
              />
            ),
          },
        ]}
      />
      {edit && <ScheduleForm row={edit} onClose={() => setEdit(null)} onSaved={() => list.query.refetch()} />}
      {view !== null && <ScheduleView id={view} onClose={() => setView(null)} onRun={canRun ? run : undefined} />}
    </div>
  );
}

type Mode = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'FIXED' | 'ADVANCED';
const MODES = [
  { value: 'DAILY', label: 'Hằng ngày' },
  { value: 'WEEKLY', label: 'Hằng tuần' },
  { value: 'MONTHLY', label: 'Hằng tháng' },
  { value: 'FIXED', label: 'Ngày cố định' },
  { value: 'ADVANCED', label: 'Nhập cron nâng cao' },
];
const DOWS = [
  { value: 'MON', label: 'Thứ Hai' },
  { value: 'TUE', label: 'Thứ Ba' },
  { value: 'WED', label: 'Thứ Tư' },
  { value: 'THU', label: 'Thứ Năm' },
  { value: 'FRI', label: 'Thứ Sáu' },
  { value: 'SAT', label: 'Thứ Bảy' },
  { value: 'SUN', label: 'Chủ nhật' },
];

/** Phân tích cron Quartz thành cấu hình bộ chọn */
export function parseCron(cron: string): { mode: Mode; time: string; dow: string; dom: number; fixed: string } {
  const p = cron.trim().split(/\s+/);
  const d = { mode: 'ADVANCED' as Mode, time: '02:00', dow: 'MON', dom: 1, fixed: '01/01' };
  if (p.length !== 6 || !/^\d+$/.test(p[1]) || !/^\d+$/.test(p[2])) return d;
  const time = `${p[2].padStart(2, '0')}:${p[1].padStart(2, '0')}`;
  const any = (s: string) => s === '*' || s === '?';
  if (any(p[3]) && any(p[4]) && any(p[5])) return { ...d, mode: 'DAILY', time };
  if (any(p[3]) && any(p[4]) && /^[A-Z]{3}$/.test(p[5])) return { ...d, mode: 'WEEKLY', time, dow: p[5] };
  if (/^\d+$/.test(p[3]) && any(p[4]) && any(p[5])) return { ...d, mode: 'MONTHLY', time, dom: Number(p[3]) };
  if (/^\d+$/.test(p[3]) && /^\d+$/.test(p[4]) && any(p[5])) return { ...d, mode: 'FIXED', time, fixed: `${p[3].padStart(2, '0')}/${p[4].padStart(2, '0')}` };
  return { ...d, time };
}

export function buildCron(mode: Mode, time: string, dow: string, dom: number, fixed: string, advanced: string): string {
  const [h, m] = time.split(':').map((x) => Number(x) || 0);
  switch (mode) {
    case 'DAILY':
      return `0 ${m} ${h} * * ?`;
    case 'WEEKLY':
      return `0 ${m} ${h} ? * ${dow}`;
    case 'MONTHLY':
      return `0 ${m} ${h} ${dom} * ?`;
    case 'FIXED': {
      const [dd, mm] = fixed.split('/').map((x) => Number(x) || 1);
      return `0 ${m} ${h} ${dd} ${mm} ?`;
    }
    default:
      return advanced.trim();
  }
}

function ScheduleForm({ row, onClose, onSaved }: { row: ScheduleRow; onClose: () => void; onSaved: () => void }) {
  const init = parseCron(row.cron);
  const [name, setName] = useState(row.name);
  const [mode, setMode] = useState<Mode>(init.mode);
  const [time, setTime] = useState(init.time);
  const [dow, setDow] = useState(init.dow);
  const [dom, setDom] = useState(init.dom);
  const [fixed, setFixed] = useState(init.fixed);
  const [advanced, setAdvanced] = useState(row.cron);
  const [enabled, setEnabled] = useState(row.enabled);
  const [params, setParams] = useState(row.params ?? '{}');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const cron = buildCron(mode, time, dow, dom, fixed, advanced);

  const save = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Vui lòng nhập Tên lịch';
    if (!cron) e.cron = 'Vui lòng nhập Lịch chạy';
    try {
      JSON.parse(params || '{}');
    } catch {
      e.params = 'Tham số phải là JSON hợp lệ';
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await put(EP.schedules.one(row.id), { name, cron, enabled, params, version: row.version });
      toast.success('Cập nhật thành công');
      onSaved();
      onClose();
    } catch (err) {
      const fe = (err as { fieldErrors?: { field: string; message: string }[] }).fieldErrors;
      if (fe?.length) setErrors(Object.fromEntries(fe.map((x) => [x.field, x.message])));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Sửa lịch đồng bộ"
      description={`${row.code} — ${row.jobTypeName}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={save} loading={busy}>
            Lưu
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Field label="Tên lịch" required error={errors.name} className="col-span-2" htmlFor="s-name">
          <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Lịch chạy" required htmlFor="s-mode">
          <Select id="s-mode" options={MODES} value={mode} onChange={(e) => setMode(e.target.value as Mode)} />
        </Field>
        {mode !== 'ADVANCED' && (
          <Field label="Giờ chạy" htmlFor="s-time">
            <Input id="s-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        )}
        {mode === 'WEEKLY' && (
          <Field label="Thứ" htmlFor="s-dow">
            <Select id="s-dow" options={DOWS} value={dow} onChange={(e) => setDow(e.target.value)} />
          </Field>
        )}
        {mode === 'MONTHLY' && (
          <Field label="Ngày trong tháng" htmlFor="s-dom">
            <Input id="s-dom" type="number" min={1} max={31} value={dom} onChange={(e) => setDom(Number(e.target.value))} />
          </Field>
        )}
        {mode === 'FIXED' && (
          <Field label="Ngày (dd/mm)" htmlFor="s-fixed">
            <Input id="s-fixed" value={fixed} placeholder="01/01" onChange={(e) => setFixed(e.target.value)} />
          </Field>
        )}
        {mode === 'ADVANCED' && (
          <Field label="Cron nâng cao (Quartz)" error={errors.cron} htmlFor="s-cron">
            <Input id="s-cron" value={advanced} onChange={(e) => setAdvanced(e.target.value)} placeholder="0 0 2 * * ?" />
          </Field>
        )}
        <div className="col-span-2 rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Biểu thức: <code>{cron}</code>
          {errors.cron && mode !== 'ADVANCED' && <span className="ml-2 text-danger">{errors.cron}</span>}
        </div>
        <div className="col-span-2">
          <span className="mb-1 block text-[13px] font-medium">Trạng thái</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} label={enabled ? 'Bật' : 'Tắt'} />
        </div>
        <Field label="Tham số" error={errors.params} className="col-span-2" htmlFor="s-params">
          <Textarea id="s-params" value={params} onChange={(e) => setParams(e.target.value)} className="font-mono text-xs" />
        </Field>
      </div>
    </Dialog>
  );
}

function ScheduleView({ id, onClose, onRun }: { id: number; onClose: () => void; onRun?: (r: ScheduleRow) => void }) {
  const q = useQuery({ queryKey: ['schedule', id], queryFn: () => get<{ schedule: ScheduleRow; runs: RunRow[] }>(EP.schedules.one(id)), refetchInterval: 5000 });
  const d = q.data;
  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      title="Thông tin lịch đồng bộ"
      width="w-[820px]"
      footer={
        d &&
        onRun && (
          <Button onClick={() => onRun(d.schedule)}>
            <Play className="h-4 w-4" />
            Chạy ngay
          </Button>
        )
      }
    >
      {d && (
        <>
          <Section title="Thông tin lịch">
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Mã lịch" value={d.schedule.code} />
              <ReadField label="Tên lịch" value={d.schedule.name} />
              <ReadField label="Loại công việc" value={d.schedule.jobTypeName} />
              <ReadField label="Lịch chạy" value={`${d.schedule.cronDescription} (${d.schedule.cron})`} />
              <ReadField label="Trạng thái" value={d.schedule.enabled ? 'Bật' : 'Tắt'} />
              <ReadField label="Tham số" value={<code className="text-xs">{d.schedule.params}</code>} />
              <ReadField label="Lần chạy gần nhất" value={fmtDateTime(d.schedule.lastRunAt)} />
              <ReadField label="Lần chạy tiếp theo" value={fmtDateTime(d.schedule.nextRunAt)} />
            </div>
          </Section>
          <Section title="20 lần chạy gần nhất">
            <table className="w-full text-[13px]" aria-label="Lịch sử chạy">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-2 py-1 text-left">Bắt đầu</th>
                  <th className="px-2 py-1 text-left">Kết thúc</th>
                  <th className="px-2 py-1 text-left">Kích hoạt</th>
                  <th className="px-2 py-1 text-left">Kết quả</th>
                  <th className="px-2 py-1 text-left">Mô tả</th>
                </tr>
              </thead>
              <tbody>
                {d.runs.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="px-2 py-1">{fmtDateTime(r.startedAt)}</td>
                    <td className="px-2 py-1">{fmtDateTime(r.finishedAt)}</td>
                    <td className="px-2 py-1">{r.trigger === 'USER' ? `Người dùng (${r.triggeredBy ?? ''})` : 'Lịch tự động'}</td>
                    <td className="px-2 py-1">{resultBadge(r.status)}</td>
                    <td className="px-2 py-1">{r.message}</td>
                  </tr>
                ))}
                {!d.runs.length && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-muted">
                      Chưa có lần chạy
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>
        </>
      )}
    </Drawer>
  );
}
