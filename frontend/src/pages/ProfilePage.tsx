import { Card, Badge, PageHeader } from '@/components/ui/Misc';
import { ReadField } from '@/components/ui/Input';
import { useSessionStore } from '@/stores/sessionStore';

/** “Thông tin tài khoản” */
export function ProfilePage() {
  const me = useSessionStore((s) => s.me);
  if (!me) return null;
  return (
    <div className="max-w-4xl">
      <PageHeader title="Thông tin tài khoản" />
      <Card title="Thông tin chung">
        <div className="grid grid-cols-2 gap-4">
          <ReadField label="Họ tên" value={me.user.fullName} />
          <ReadField label="Tên đăng nhập" value={me.user.username} />
          <ReadField label="Email" value={me.user.email} />
          <ReadField label="Đơn vị" value={me.user.orgUnitName} />
          <ReadField label="Phương thức đăng nhập" value={me.user.authMethod === 'CAS' ? 'VNPT SSO' : 'Tài khoản nội bộ'} />
        </div>
      </Card>
      <Card title="Vai trò được gán" className="mt-4">
        <div className="flex flex-wrap gap-2">
          {me.roles.map((r) => (
            <Badge key={r.code + (r.orgUnitId ?? '')} color="blue">
              {r.code} – {r.name}
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}
