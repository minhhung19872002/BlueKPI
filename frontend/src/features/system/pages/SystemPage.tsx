import { useNavigate, useSearch } from '@tanstack/react-router';
import { PageHeader, Tabs } from '@/components/ui/Misc';
import { useSessionStore, hasPerm } from '@/stores/sessionStore';
import { AuditTab } from '../components/AuditTab';
import { OrgUnitsTab } from '../components/OrgUnitsTab';
import { PermissionsTab, RolesTab } from '../components/RolesTab';
import { SchedulesTab } from '../components/SchedulesTab';
import { SysConfigTab } from '../components/SysConfigTab';
import { UsersTab } from '../components/UsersTab';

/** Menu “Quản trị hệ thống” — các tab hiển thị theo quyền */
export function SystemPage() {
  const me = useSessionStore((s) => s.me);
  const search = useSearch({ strict: false }) as { tab?: string };
  const navigate = useNavigate();
  const tabs = [
    { value: 'users', label: 'Danh sách người dùng', hidden: !hasPerm(me, 'USER:VIEW'), content: <UsersTab /> },
    { value: 'roles', label: 'Vai trò', hidden: !hasPerm(me, 'ROLE:VIEW'), content: <RolesTab /> },
    { value: 'permissions', label: 'Quyền', hidden: !hasPerm(me, 'PERMISSION:VIEW'), content: <PermissionsTab /> },
    { value: 'org-units', label: 'Danh sách đơn vị', hidden: !hasPerm(me, 'ORG:VIEW'), content: <OrgUnitsTab /> },
    { value: 'schedules', label: 'Lịch đồng bộ', hidden: !hasPerm(me, 'SCHEDULE:VIEW'), content: <SchedulesTab /> },
    { value: 'sys-configs', label: 'Tham số hệ thống', hidden: !hasPerm(me, 'SYSCONFIG:VIEW'), content: <SysConfigTab /> },
    { value: 'audit', label: 'Nhật ký hệ thống', hidden: !hasPerm(me, 'AUDIT:VIEW'), content: <AuditTab /> },
  ];
  const visible = tabs.filter((t) => !t.hidden);
  const active = visible.find((t) => t.value === search.tab)?.value ?? visible[0]?.value ?? 'users';
  return (
    <div>
      <PageHeader title="Quản trị hệ thống" />
      <Tabs value={active} onChange={(v) => navigate({ to: '/system', search: { tab: v } })} tabs={tabs} />
    </div>
  );
}
