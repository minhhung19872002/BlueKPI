import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { post } from '@/api/http';
import { EP } from '@/api/endpoints';
import type { NotificationItem } from '@/app/NotificationBell';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { useListState } from '@/components/data-grid/useListState';
import { Button } from '@/components/ui/Button';
import { Badge, PageHeader } from '@/components/ui/Misc';
import { Checkbox } from '@/components/ui/Misc';
import { fmtDateTime } from '@/lib/format';

/** Xem tất cả thông báo (54.1) */
export function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useListState<{ unreadOnly: boolean }, NotificationItem>('notif-page', EP.notifications.list, { unreadOnly: false });
  const refresh = () => qc.invalidateQueries({ queryKey: ['notif'] }).then(() => list.query.refetch());
  return (
    <div>
      <PageHeader
        title="Thông báo"
        actions={
          <>
            <Checkbox
              checked={unreadOnly}
              label="Chỉ chưa đọc"
              onCheckedChange={(v) => {
                setUnreadOnly(v);
                list.set('unreadOnly', v);
                setTimeout(list.search, 0);
              }}
            />
            <Button variant="outline" onClick={() => post(EP.notifications.readAll).then(refresh)}>
              Đánh dấu tất cả đã đọc
            </Button>
          </>
        }
      />
      <DataGrid<NotificationItem>
        {...list.gridProps}
        rowKey={(r) => r.id}
        onRowClick={async (n) => {
          if (!n.isRead) await post(EP.notifications.read(n.id));
          refresh();
          if (n.linkRoute) navigate({ to: n.linkRoute, search: (n.linkParams ? JSON.parse(n.linkParams) : {}) as never });
        }}
        columns={[
          { key: 'title', header: 'Tiêu đề', render: (r) => <span className={r.isRead ? '' : 'font-semibold'}>{r.title}</span> },
          { key: 'content', header: 'Nội dung' },
          { key: 'createdAt', header: 'Thời gian', width: 150, render: (r) => fmtDateTime(r.createdAt) },
          { key: 'isRead', header: 'Trạng thái', width: 110, render: (r) => (r.isRead ? <Badge>Đã đọc</Badge> : <Badge color="blue">Chưa đọc</Badge>) },
        ]}
      />
    </div>
  );
}
