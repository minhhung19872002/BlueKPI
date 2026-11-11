import { useQuery } from '@tanstack/react-query';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { get } from '@/api/http';
import { EP } from '@/api/endpoints';
import type { OrgTreeNode } from '@/api/types';
import type { Column } from '@/components/data-grid/DataGrid';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Misc';
import type { TreeNode } from '@/components/ui/TreeSelect';
import { ApiError } from '@/api/http';
import { errorMessage, toast } from '@/components/ui/Toast';
import { fmtDateTime } from '@/lib/format';
import type { ReactNode } from 'react';

/** Cây đơn vị cho TreeSelect */
export function useOrgTree(opts: { mine?: boolean; assignableOnly?: boolean } = {}) {
  return useQuery({
    queryKey: ['org-tree', opts.mine ? 'mine' : 'all', !!opts.assignableOnly],
    queryFn: () => get<OrgTreeNode[]>(EP.orgUnits.tree, { scope: opts.mine ? 'mine' : 'all', assignableOnly: !!opts.assignableOnly }),
    staleTime: 60_000,
    select: (d) => toTreeNodes(d),
  });
}

export function toTreeNodes(nodes: OrgTreeNode[]): TreeNode[] {
  return nodes.map((n) => ({ id: n.id, label: n.name, search: n.code, children: n.children?.length ? toTreeNodes(n.children) : undefined }));
}

export interface AuditFields {
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}

/** Cột “Người tạo”, “Ngày tạo”, “Người cập nhật”, “Ngày cập nhật” */
export function auditColumns<T extends AuditFields>(opts: { created?: boolean; updated?: boolean } = {}): Column<T>[] {
  const cols: Column<T>[] = [];
  if (opts.created !== false) {
    cols.push({ key: 'createdBy', header: 'Người tạo', width: 110 });
    cols.push({ key: 'createdAt', header: 'Ngày tạo', width: 130, sortable: true, render: (r) => fmtDateTime(r.createdAt) });
  }
  if (opts.updated !== false) {
    cols.push({ key: 'updatedBy', header: 'Người cập nhật', width: 120 });
    cols.push({ key: 'updatedAt', header: 'Ngày cập nhật', width: 130, sortable: true, render: (r) => fmtDateTime(r.updatedAt) });
  }
  return cols;
}

export interface RowAction {
  label: string;
  onClick: () => void;
  show?: boolean;
  danger?: boolean;
}

/** Nút thao tác trên dòng: “Xem”, “Sửa”, “Xóa”… (ẩn nếu thiếu quyền) */
export function RowActions({ actions }: { actions: RowAction[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {actions
        .filter((a) => a.show !== false)
        .map((a) => (
          <Button
            key={a.label}
            variant="link"
            size="sm"
            className={a.danger ? 'h-auto text-danger' : 'h-auto'}
            onClick={(e) => {
              e.stopPropagation();
              a.onClick();
            }}
          >
            {a.label}
          </Button>
        ))}
    </div>
  );
}

/** Đổ lỗi từng trường từ backend vào form; trả về true nếu có lỗi trường */
export function applyServerErrors<T extends FieldValues>(e: unknown, setError: UseFormSetError<T>): boolean {
  if (e instanceof ApiError && e.fieldErrors?.length) {
    e.fieldErrors.forEach((fe) => setError(fe.field as Path<T>, { message: fe.message }));
    return true;
  }
  return false;
}

/** Xử lý lỗi submit chung: lỗi trường → đặt tại trường; còn lại → toast lý do */
export function handleSubmitError<T extends FieldValues>(e: unknown, setError: UseFormSetError<T>) {
  if (!applyServerErrors(e, setError)) toast.error(errorMessage(e));
  else toast.error(errorMessage(e, 'Dữ liệu không hợp lệ'));
}

export const ACTIVE_OPTIONS = [
  { value: 'HIEU_LUC', label: 'Hiệu lực' },
  { value: 'KHONG_HIEU_LUC', label: 'Không hiệu lực' },
];

export function ActiveBadge({ status }: { status?: string }) {
  return status === 'HIEU_LUC' ? <Badge color="green">Hiệu lực</Badge> : <Badge color="slate">Không hiệu lực</Badge>;
}

export function codeName(code?: string | null, name?: string | null): string {
  return [code, name].filter(Boolean).join(' – ');
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <h4 className="mb-2 border-b border-border pb-1 text-sm font-semibold text-slate-700">{title}</h4>
      {children}
    </div>
  );
}

export const UNIT_TYPE_OPTIONS = [
  { value: 'CONG_TY_ME', label: 'Công ty mẹ' },
  { value: 'TONG_CONG_TY', label: 'Tổng công ty' },
  { value: 'CONG_TY', label: 'Công ty' },
  { value: 'VNPT_TINH', label: 'VNPT tỉnh/thành phố' },
  { value: 'TRUNG_TAM', label: 'Trung tâm' },
  { value: 'PHONG_BAN', label: 'Phòng ban' },
];
export const REGION_OPTIONS = [
  { value: 'MB', label: 'Miền Bắc' },
  { value: 'MT', label: 'Miền Trung' },
  { value: 'MN', label: 'Miền Nam' },
];
export const labelOf = (opts: { value: string; label: string }[], v?: string | null) => opts.find((o) => o.value === v)?.label ?? v ?? '';
