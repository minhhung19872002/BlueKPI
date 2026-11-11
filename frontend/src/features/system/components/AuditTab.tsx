import { useState } from 'react';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { FilterItem, SearchBar } from '@/components/data-grid/SearchBar';
import { useListState } from '@/components/data-grid/useListState';
import { Drawer } from '@/components/ui/Dialog';
import { Input, ReadField } from '@/components/ui/Input';
import { RowActions } from '@/features/common/shared';
import { fmtDateTime } from '@/lib/format';

interface AuditRow {
  id: number;
  username?: string;
  action: string;
  entity?: string;
  entityId?: string;
  beforeJson?: string;
  afterJson?: string;
  ip?: string;
  traceId?: string;
  at: string;
}

function pretty(s?: string) {
  if (!s) return '—';
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

/** “Nhật ký hệ thống” (chỉ Admin hệ thống) — tra cứu theo người dùng, thời gian, hành động */
export function AuditTab() {
  const list = useListState<{ username: string; action: string; entity: string; fromDate: string; toDate: string }, AuditRow>('audit', EP.auditLogs, {
    username: '',
    action: '',
    entity: '',
    fromDate: '',
    toDate: '',
  });
  const [view, setView] = useState<AuditRow | null>(null);
  return (
    <div>
      <SearchBar onSearch={list.search} onReset={list.reset}>
        <FilterItem label="Người dùng" width="w-40">
          <Input aria-label="Người dùng" value={list.draft.username} onChange={(e) => list.set('username', e.target.value)} />
        </FilterItem>
        <FilterItem label="Hành động" width="w-36">
          <Input aria-label="Hành động" value={list.draft.action} onChange={(e) => list.set('action', e.target.value)} placeholder="VD: DANG_NHAP" />
        </FilterItem>
        <FilterItem label="Đối tượng" width="w-36">
          <Input aria-label="Đối tượng" value={list.draft.entity} onChange={(e) => list.set('entity', e.target.value)} placeholder="VD: app_user" />
        </FilterItem>
        <FilterItem label="Từ ngày" width="w-40">
          <Input aria-label="Từ ngày" type="date" value={list.draft.fromDate} onChange={(e) => list.set('fromDate', e.target.value)} />
        </FilterItem>
        <FilterItem label="Đến ngày" width="w-40">
          <Input aria-label="Đến ngày" type="date" value={list.draft.toDate} onChange={(e) => list.set('toDate', e.target.value)} />
        </FilterItem>
      </SearchBar>
      <DataGrid<AuditRow>
        title="Nhật ký hệ thống"
        {...list.gridProps}
        rowKey={(r) => r.id}
        columns={[
          { key: 'at', header: 'Thời điểm', sortable: true, width: 140, render: (r) => fmtDateTime(r.at) },
          { key: 'username', header: 'Người dùng', sortable: true, width: 120 },
          { key: 'action', header: 'Hành động', sortable: true, width: 130 },
          { key: 'entity', header: 'Đối tượng', width: 150 },
          { key: 'entityId', header: 'Mã bản ghi', width: 90 },
          { key: 'ip', header: 'IP', width: 110 },
          { key: 'actions', header: 'Thao tác', width: 70, render: (r) => <RowActions actions={[{ label: 'Xem', onClick: () => setView(r) }]} /> },
        ]}
      />
      {view && (
        <Drawer open onOpenChange={(o) => !o && setView(null)} title="Chi tiết nhật ký" width="w-[760px]">
          <div className="mb-3 grid grid-cols-3 gap-3">
            <ReadField label="Thời điểm" value={fmtDateTime(view.at)} />
            <ReadField label="Người dùng" value={view.username} />
            <ReadField label="Hành động" value={view.action} />
            <ReadField label="Đối tượng" value={`${view.entity ?? ''} #${view.entityId ?? ''}`} />
            <ReadField label="IP" value={view.ip} />
            <ReadField label="Trace ID" value={view.traceId} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 text-xs text-muted">Trước</div>
              <pre className="max-h-[60vh] overflow-auto rounded bg-slate-50 p-2 text-[11px]">{pretty(view.beforeJson)}</pre>
            </div>
            <div>
              <div className="mb-1 text-xs text-muted">Sau</div>
              <pre className="max-h-[60vh] overflow-auto rounded bg-slate-50 p-2 text-[11px]">{pretty(view.afterJson)}</pre>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}
