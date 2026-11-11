import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto mt-20 max-w-lg rounded-lg border border-red-200 bg-white p-6 text-center">
          <h2 className="mb-2 text-lg font-semibold text-danger">Đã xảy ra lỗi khi hiển thị trang</h2>
          <p className="mb-4 text-sm text-muted">Vui lòng tải lại trang. Nếu lỗi tiếp diễn, liên hệ quản trị hệ thống.</p>
          <Button onClick={() => window.location.reload()}>Tải lại trang</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
