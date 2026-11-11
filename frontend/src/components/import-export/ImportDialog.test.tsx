import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImportDialog } from './ImportDialog';

vi.mock('@/api/http', () => ({
  download: vi.fn(),
  get: vi.fn(),
  upload: vi.fn(async () => ({
    data: {
      importToken: 't1',
      total: 2,
      valid: 1,
      invalid: 1,
      columns: [{ key: 'name', header: 'Tên đơn vị đo' }],
      rows: [
        { row: 2, data: { name: 'Kg' }, status: 'Hợp lệ', errorMessage: '', valid: true },
        { row: 3, data: { name: null }, status: 'Lỗi', errorMessage: 'Thiếu “Tên đơn vị đo”', valid: false },
      ],
    },
  })),
  post: vi.fn(async () => ({ data: { imported: 1, total: 2, failed: 1, errorFileId: 9, message: 'Đã nhập 1/2 bản ghi; 1 bản ghi lỗi' } })),
}));

describe('ImportDialog', () => {
  it('kiểm tra → xem trước → xác nhận nhập', async () => {
    const onDone = vi.fn();
    render(<ImportDialog open onOpenChange={() => {}} templateUrl="/t" validateUrl="/v" commitUrl="/c" onDone={onDone} />);
    expect(screen.getByRole('dialog', { name: 'Nhập dữ liệu từ file' })).toBeInTheDocument();
    expect(screen.getByText('Tải file mẫu')).toBeInTheDocument();
    const file = new File(['x'], 'dvd.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(screen.getByTestId('import-file'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra' }));
    await waitFor(() => expect(screen.getByText('Thiếu “Tên đơn vị đo”')).toBeInTheDocument());
    expect(screen.getAllByText('Hợp lệ').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận nhập' }));
    await waitFor(() => expect(screen.getByTestId('import-result')).toHaveTextContent('Đã nhập 1/2 bản ghi; 1 bản ghi lỗi'));
    expect(onDone).toHaveBeenCalled();
  });

  it('từ chối file không phải .xlsx', () => {
    render(<ImportDialog open onOpenChange={() => {}} templateUrl="/t" validateUrl="/v" commitUrl="/c" />);
    fireEvent.change(screen.getByTestId('import-file'), { target: { files: [new File(['x'], 'a.csv')] } });
    expect(screen.getByText('Chỉ chấp nhận file .xlsx')).toBeInTheDocument();
  });
});
