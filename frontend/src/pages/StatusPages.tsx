import { Link, useSearch } from '@tanstack/react-router';
import { ShieldAlert, SearchX, UserX } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/** Route không có quyền → 403 */
export function ForbiddenPage() {
  return (
    <div className="mx-auto mt-16 max-w-lg text-center" data-testid="forbidden-page">
      <ShieldAlert className="mx-auto mb-3 h-14 w-14 text-danger" />
      <h1 className="mb-2 text-2xl font-bold">403</h1>
      <p className="mb-6 text-slate-600">Bạn không có quyền truy cập chức năng này</p>
      <Button asChild>
        <Link to="/">Về trang chủ</Link>
      </Button>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="mx-auto mt-16 max-w-lg text-center">
      <SearchX className="mx-auto mb-3 h-14 w-14 text-muted" />
      <h1 className="mb-2 text-2xl font-bold">404</h1>
      <p className="mb-6 text-slate-600">Không tìm thấy trang yêu cầu</p>
      <Button asChild>
        <Link to="/">Về trang chủ</Link>
      </Button>
    </div>
  );
}

/** Lỗi SSO: “Tài khoản chưa được cấp quyền truy cập hệ thống” */
export function SsoErrorPage() {
  const s = useSearch({ strict: false }) as { message?: string };
  return (
    <div className="flex min-h-full items-center justify-center bg-canvas p-4">
      <div className="max-w-lg rounded-lg bg-white p-8 text-center shadow">
        <UserX className="mx-auto mb-3 h-14 w-14 text-danger" />
        <h1 className="mb-2 text-lg font-semibold">Đăng nhập VNPT SSO không thành công</h1>
        <p className="mb-6 text-slate-600" data-testid="sso-error">{s.message || 'Tài khoản chưa được cấp quyền truy cập hệ thống'}</p>
        <Button asChild>
          <Link to="/login">Quay lại đăng nhập</Link>
        </Button>
      </div>
    </div>
  );
}
