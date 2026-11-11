import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataGrid } from './DataGrid';

interface R {
  id: number;
  name: string;
  children?: R[];
}

const rows: R[] = [
  { id: 1, name: 'Cha A', children: [{ id: 11, name: 'Con A1' }] },
  { id: 2, name: 'Đơn vị B' },
];

describe('DataGrid', () => {
  it('đánh số STT liên tục theo trang', () => {
    render(<DataGrid<R> columns={[{ key: 'name', header: 'Tên' }]} rows={rows} rowKey={(r) => r.id} page={2} size={20} total={22} onPageChange={() => {}} />);
    const body = screen.getAllByRole('row').slice(1);
    expect(within(body[0]).getByText('21')).toBeInTheDocument();
    expect(within(body[1]).getByText('22')).toBeInTheDocument();
    expect(screen.getByTestId('grid-total')).toHaveTextContent('22');
  });

  it('sort chu kỳ asc → desc → bỏ', () => {
    const onSort = vi.fn();
    const { rerender } = render(<DataGrid<R> columns={[{ key: 'name', header: 'Tên', sortable: true }]} rows={rows} rowKey={(r) => r.id} onSortChange={onSort} />);
    fireEvent.click(screen.getByText('Tên'));
    expect(onSort).toHaveBeenLastCalledWith('name,asc');
    rerender(<DataGrid<R> columns={[{ key: 'name', header: 'Tên', sortable: true }]} rows={rows} rowKey={(r) => r.id} sort="name,asc" onSortChange={onSort} />);
    fireEvent.click(screen.getByText('Tên'));
    expect(onSort).toHaveBeenLastCalledWith('name,desc');
  });

  it('mở rộng cây KPI cha để hiện KPI con', () => {
    render(<DataGrid<R> columns={[{ key: 'name', header: 'Tên' }]} rows={rows} rowKey={(r) => r.id} getChildren={(r) => r.children} />);
    expect(screen.queryByText('Con A1')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId('tree-toggle')[0]);
    expect(screen.getByText('Con A1')).toBeInTheDocument();
  });

  it('chọn tất cả bằng checkbox', () => {
    const onSel = vi.fn();
    render(<DataGrid<R> columns={[{ key: 'name', header: 'Tên' }]} rows={rows} rowKey={(r) => r.id} selectable selected={[]} onSelectedChange={onSel} />);
    fireEvent.click(screen.getByLabelText('Chọn tất cả'));
    expect(onSel).toHaveBeenCalledWith([1, 2]);
  });
});
