import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError, del, get, post, put } from '@/api/http';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { FilterItem, SearchBar } from '@/components/data-grid/SearchBar';
import { useListState } from '@/components/data-grid/useListState';
import { Button } from '@/components/ui/Button';
import { confirm, confirmDelete } from '@/components/ui/ConfirmDialog';
import { Dialog, Drawer } from '@/components/ui/Dialog';
import { Field, Input, ReadField, Select, Textarea } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Misc';
import { errorMessage, toast } from '@/components/ui/Toast';
import { ACTIVE_OPTIONS, ActiveBadge, auditColumns, handleSubmitError, RowActions, Section } from '@/features/common/shared';
import { useHasPerm } from '@/stores/sessionStore';

interface RoleRow {
  id: number;
  code: string;
  name: string;
  description?: string;
  status: string;
  dataScope: string;
  isSystem: boolean;
  userCount: number;
  version: number;
  permissionIds?: number[];
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}
interface PermNode {
  module: string;
  name: string;
  permissions: { id: number; code: string; name: string }[];
}

export const SCOPES = [
  { value: 'ALL', label: 'Toàn bộ' },
  { value: 'UNIT', label: 'Đơn vị mình' },
  { value: 'UNIT_AND_CHILDREN', label: 'Đơn vị mình và đơn vị con' },
];

/** 4.1–4.6 Vai trò */
export function RolesTab() {
  const canCreate = useHasPerm('ROLE:CREATE');
  const canUpdate = useHasPerm('ROLE:UPDATE');
  const canDelete = useHasPerm('ROLE:DELETE');
  const list = useListState<{ keyword: string; status: string }, RoleRow>('roles', EP.roles.list, { keyword: '', status: '' });
  const [form, setForm] = useState<{ open: boolean; id?: number }>({ open: false });
  const [view, setView] = useState<number | null>(null);

  const remove = async (r: RoleRow) => {
    if (!(await confirmDelete(`${r.code} – ${r.name}`))) return;
    try {
      await del(EP.roles.one(r.id), { version: r.version });
      toast.success('Xóa thành công');
      list.query.refetch();
    } catch (e) {
      const d = e instanceof ApiError ? (e.data as { confirmRequired?: boolean } | null) : null;
      if (d?.confirmRequired) {
        // 4.6: vai trò đang gán cho user → hỏi lại
        if (await confirm({ title: 'Xác nhận xóa', message: (e as ApiError).message, danger: true, confirmText: 'Xác nhận' })) {
          try {
            await del(EP.roles.one(r.id), { force: true, version: r.version });
            toast.success('Xóa thành công');
            list.query.refetch();
          } catch (e2) {
            toast.error(errorMessage(e2));
          }
        }
      } else toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <SearchBar
        keyword={list.draft.keyword}
        onKeywordChange={(v) => list.set('keyword', v)}
        placeholder="Mã hoặc tên vai trò"
        onSearch={list.search}
        onReset={list.reset}
        actions={
          canCreate && (
            <Button onClick={() => setForm({ open: true })}>
              <Plus className="h-4 w-4" />
              Thêm vai trò
            </Button>
          )
        }
      >
        <FilterItem label="Trạng thái" width="w-40">
          <Select aria-label="Trạng thái" options={ACTIVE_OPTIONS} placeholder="Tất cả" value={list.draft.status} onChange={(e) => list.set('status', e.target.value)} />
        </FilterItem>
      </SearchBar>
      <h3 className="mb-2 text-sm font-semibold">Danh sách vai trò</h3>
      <DataGrid<RoleRow>
        title="Danh sách vai trò"
        {...list.gridProps}
        rowKey={(r) => r.id}
        columns={[
          { key: 'code', header: 'Mã – Tên vai trò', sortable: true, width: 260, render: (r) => `${r.code} – ${r.name}` },
          { key: 'description', header: 'Mô tả', width: 200 },
          { key: 'status', header: 'Trạng thái', width: 110, render: (r) => <ActiveBadge status={r.status} /> },
          ...auditColumns<RoleRow>(),
          {
            key: 'actions',
            header: 'Thao tác',
            width: 120,
            render: (r) => (
              <RowActions
                actions={[
                  { label: 'Xem', onClick: () => setView(r.id) },
                  { label: 'Sửa', onClick: () => setForm({ open: true, id: r.id }), show: canUpdate },
                  { label: 'Xóa', onClick: () => remove(r), show: canDelete && !r.isSystem, danger: true },
                ]}
              />
            ),
          },
        ]}
      />
      {form.open && <RoleForm id={form.id} onClose={() => setForm({ open: false })} onSaved={() => list.query.refetch()} />}
      {view !== null && <RoleView id={view} onClose={() => setView(null)} />}
    </div>
  );
}

function usePermTree() {
  return useQuery({ queryKey: ['perm-tree'], queryFn: () => get<PermNode[]>(EP.permissions.tree), staleTime: 300_000 });
}

/** Cây checkbox menu → quyền */
export function PermissionTree({ value, onChange, readOnly }: { value: number[]; onChange?: (v: number[]) => void; readOnly?: boolean }) {
  const tree = usePermTree();
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const set = new Set(value);
  return (
    <div className="max-h-80 overflow-auto rounded border border-border p-2" data-testid="permission-tree">
      {(tree.data ?? []).map((m) => {
        const ids = m.permissions.map((p) => p.id);
        const all = ids.every((i) => set.has(i));
        const some = ids.some((i) => set.has(i));
        const isClosed = closed.has(m.module);
        if (readOnly && !some) return null;
        return (
          <div key={m.module} className="mb-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="text-slate-500"
                aria-label={isClosed ? 'Mở rộng' : 'Thu gọn'}
                onClick={() => {
                  const n = new Set(closed);
                  if (n.has(m.module)) n.delete(m.module);
                  else n.add(m.module);
                  setClosed(n);
                }}
              >
                {isClosed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <Checkbox
                checked={all}
                indeterminate={!all && some}
                disabled={readOnly}
                onCheckedChange={(v) => onChange?.(v ? [...new Set([...value, ...ids])] : value.filter((x) => !ids.includes(x)))}
                label={<b>{m.name}</b>}
              />
            </div>
            {!isClosed && (
              <div className="ml-10 grid grid-cols-2 gap-x-4 gap-y-1 py-1">
                {m.permissions
                  .filter((p) => !readOnly || set.has(p.id))
                  .map((p) => (
                    <Checkbox
                      key={p.id}
                      checked={set.has(p.id)}
                      disabled={readOnly}
                      onCheckedChange={(v) => onChange?.(v ? [...value, p.id] : value.filter((x) => x !== p.id))}
                      label={<span title={p.code}>{p.name}</span>}
                    />
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RoleForm({ id, onClose, onSaved }: { id?: number; onClose: () => void; onSaved: () => void }) {
  const isEdit = id !== undefined;
  const q = useQuery({ queryKey: ['role', id], queryFn: () => get<RoleRow>(EP.roles.one(id!)), enabled: isEdit });
  if (isEdit && !q.data) return null;
  return <RoleFormInner row={q.data} onClose={onClose} onSaved={onSaved} />;
}

const roleSchema = z.object({
  code: z.string().trim().min(1, 'Vui lòng nhập Mã vai trò').regex(/^[A-Za-z0-9_]+$/, 'Mã vai trò chỉ gồm chữ, số và dấu gạch dưới'),
  name: z.string().trim().min(1, 'Vui lòng nhập Tên vai trò').max(255),
  description: z.string().max(1000).optional(),
  status: z.string().min(1, 'Vui lòng chọn Trạng thái'),
  dataScope: z.string(),
});
type RoleF = z.infer<typeof roleSchema>;

function RoleFormInner({ row, onClose, onSaved }: { row?: RoleRow; onClose: () => void; onSaved: () => void }) {
  const [perms, setPerms] = useState<number[]>(row?.permissionIds ?? []);
  const { register, handleSubmit, formState, setError } = useForm<RoleF>({
    resolver: zodResolver(roleSchema),
    defaultValues: { code: row?.code ?? '', name: row?.name ?? '', description: row?.description ?? '', status: row?.status ?? 'HIEU_LUC', dataScope: row?.dataScope ?? 'UNIT' },
  });
  const onSubmit = async (v: RoleF) => {
    try {
      const body = { ...v, permissionIds: perms, version: row?.version };
      if (row) {
        await put(EP.roles.one(row.id), body);
        toast.success('Cập nhật thành công');
      } else {
        await post(EP.roles.list, body);
        toast.success('Thêm mới thành công');
      }
      onSaved();
      onClose();
    } catch (e) {
      handleSubmitError(e, setError);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={row ? 'Sửa vai trò' : 'Thêm vai trò'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={formState.isSubmitting}>
            Lưu
          </Button>
        </>
      }
    >
      <form className="grid grid-cols-2 gap-4" noValidate onSubmit={handleSubmit(onSubmit)}>
        <Field label="Mã vai trò" required error={formState.errors.code?.message} htmlFor="r-code">
          <Input id="r-code" disabled={!!row} {...register('code')} />
        </Field>
        <Field label="Tên vai trò" required error={formState.errors.name?.message} htmlFor="r-name">
          <Input id="r-name" {...register('name')} />
        </Field>
        <Field label="Trạng thái" required htmlFor="r-status">
          <Select id="r-status" options={ACTIVE_OPTIONS} {...register('status')} />
        </Field>
        <Field label="Phạm vi dữ liệu" htmlFor="r-scope">
          <Select id="r-scope" options={SCOPES} {...register('dataScope')} />
        </Field>
        <Field label="Mô tả" className="col-span-2" htmlFor="r-desc">
          <Textarea id="r-desc" {...register('description')} />
        </Field>
        <div className="col-span-2">
          <span className="mb-1 block text-[13px] font-medium">Phân quyền chức năng</span>
          <PermissionTree value={perms} onChange={setPerms} />
        </div>
      </form>
    </Dialog>
  );
}

function RoleView({ id, onClose }: { id: number; onClose: () => void }) {
  const q = useQuery({ queryKey: ['role', id], queryFn: () => get<RoleRow>(EP.roles.one(id)) });
  const r = q.data;
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title="Thông tin vai trò">
      {r && (
        <>
          <Section title="Thông tin chung">
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Mã vai trò" value={r.code} />
              <ReadField label="Tên vai trò" value={r.name} />
              <ReadField label="Trạng thái" value={<ActiveBadge status={r.status} />} />
              <ReadField label="Phạm vi dữ liệu" value={SCOPES.find((s) => s.value === r.dataScope)?.label} />
              <ReadField label="Số người dùng được gán" value={r.userCount} />
              <ReadField label="Mô tả" value={r.description} />
            </div>
          </Section>
          <Section title="Cây quyền đã gán">
            <PermissionTree value={r.permissionIds ?? []} readOnly />
          </Section>
        </>
      )}
    </Drawer>
  );
}

// ---------------- Quyền ----------------
interface PermRow {
  id: number;
  code: string;
  name: string;
  module: string;
  menuName?: string;
  description?: string;
  sortOrder: number;
  version: number;
}

/** 4.7–4.9 Quyền */
export function PermissionsTab() {
  const canUpdate = useHasPerm('PERMISSION:UPDATE');
  const list = useListState<{ keyword: string }, PermRow>('permissions', EP.permissions.list, { keyword: '' });
  const [edit, setEdit] = useState<PermRow | null>(null);
  const [view, setView] = useState<number | null>(null);
  return (
    <div>
      <SearchBar keyword={list.draft.keyword} onKeywordChange={(v) => list.set('keyword', v)} placeholder="Mã hoặc tên quyền" onSearch={list.search} onReset={list.reset} />
      <h3 className="mb-2 text-sm font-semibold">Danh sách quyền</h3>
      <DataGrid<PermRow>
        title="Danh sách quyền"
        {...list.gridProps}
        rowKey={(r) => r.id}
        columns={[
          { key: 'code', header: 'Mã quyền', sortable: true, width: 190 },
          { key: 'name', header: 'Tên quyền', sortable: true },
          { key: 'module', header: 'Phân hệ/Menu', sortable: true, render: (r) => `${r.module}${r.menuName ? ' / ' + r.menuName : ''}` },
          { key: 'description', header: 'Mô tả' },
          { key: 'sortOrder', header: 'Thứ tự', sortable: true, width: 80, align: 'right' },
          {
            key: 'actions',
            header: 'Thao tác',
            width: 100,
            render: (r) => (
              <RowActions
                actions={[
                  { label: 'Xem', onClick: () => setView(r.id) },
                  { label: 'Sửa', onClick: () => setEdit(r), show: canUpdate },
                ]}
              />
            ),
          },
        ]}
      />
      {edit && <PermissionForm row={edit} onClose={() => setEdit(null)} onSaved={() => list.query.refetch()} />}
      {view !== null && <PermissionView id={view} onClose={() => setView(null)} />}
    </div>
  );
}

const permSchema = z.object({ name: z.string().trim().min(1, 'Vui lòng nhập Tên quyền'), description: z.string().optional(), sortOrder: z.coerce.number().int().min(0) });

function PermissionForm({ row, onClose, onSaved }: { row: PermRow; onClose: () => void; onSaved: () => void }) {
  const { register, handleSubmit, formState, setError } = useForm({
    resolver: zodResolver(permSchema),
    defaultValues: { name: row.name, description: row.description ?? '', sortOrder: row.sortOrder },
  });
  const onSubmit = async (v: z.output<typeof permSchema>) => {
    try {
      await put(EP.permissions.one(row.id), { ...v, version: row.version });
      toast.success('Cập nhật thành công');
      onSaved();
      onClose();
    } catch (e) {
      handleSubmitError(e, setError);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Sửa quyền"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={formState.isSubmitting}>
            Lưu
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <ReadField label="Mã quyền" value={row.code} />
        <Field label="Tên quyền" required error={formState.errors.name?.message} htmlFor="p-name">
          <Input id="p-name" {...register('name')} />
        </Field>
        <Field label="Mô tả" htmlFor="p-desc">
          <Textarea id="p-desc" {...register('description')} />
        </Field>
        <Field label="Thứ tự" htmlFor="p-sort" error={formState.errors.sortOrder?.message}>
          <Input id="p-sort" type="number" {...register('sortOrder')} />
        </Field>
      </div>
    </Dialog>
  );
}

function PermissionView({ id, onClose }: { id: number; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['permission', id],
    queryFn: () => get<{ permission: PermRow; moduleName: string; roles: { id: number; code: string; name: string; status: string }[] }>(EP.permissions.one(id)),
  });
  const d = q.data;
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title="Thông tin quyền">
      {d && (
        <>
          <Section title="Thông tin chung">
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Mã quyền" value={d.permission.code} />
              <ReadField label="Tên quyền" value={d.permission.name} />
              <ReadField label="Phân hệ/Menu" value={d.moduleName} />
              <ReadField label="Thứ tự" value={d.permission.sortOrder} />
              <ReadField label="Mô tả" value={d.permission.description} className="col-span-2" />
            </div>
          </Section>
          <Section title="Vai trò đang có quyền này">
            <ul className="list-disc pl-5 text-sm">
              {d.roles.map((r) => (
                <li key={r.id}>
                  {r.code} – {r.name}
                </li>
              ))}
              {!d.roles.length && <li className="text-muted">Chưa có vai trò nào</li>}
            </ul>
          </Section>
        </>
      )}
    </Drawer>
  );
}
