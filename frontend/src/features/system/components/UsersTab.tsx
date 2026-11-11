import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Plus, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { del, get, post, put } from '@/api/http';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { FilterItem, SearchBar } from '@/components/data-grid/SearchBar';
import { useListState } from '@/components/data-grid/useListState';
import { ExportButton } from '@/components/import-export/ExportButton';
import { ImportDialog } from '@/components/import-export/ImportDialog';
import { Button } from '@/components/ui/Button';
import { confirmDelete } from '@/components/ui/ConfirmDialog';
import { Dialog, Drawer } from '@/components/ui/Dialog';
import { Field, Input, ReadField, Select } from '@/components/ui/Input';
import { Badge, Checkbox } from '@/components/ui/Misc';
import { errorMessage, toast } from '@/components/ui/Toast';
import { TreeSelect } from '@/components/ui/TreeSelect';
import { auditColumns, handleSubmitError, RowActions, Section, useOrgTree } from '@/features/common/shared';
import { fmtDateTime } from '@/lib/format';
import { useHasPerm } from '@/stores/sessionStore';

export interface UserRow {
  id: number;
  username: string;
  fullName: string;
  email: string;
  phone?: string;
  orgUnitId: number;
  orgUnitName: string;
  status: string;
  authSource: string;
  roleCodes?: string;
  version: number;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  roles?: { roleId: number; roleCode: string; roleName: string; orgUnitId: number | null; orgUnitName?: string }[];
}

const STATUS = [
  { value: 'HOAT_DONG', label: 'Hoạt động' },
  { value: 'KHOA', label: 'Khóa' },
  { value: 'NGUNG', label: 'Ngưng' },
];
const AUTH = [
  { value: 'LOCAL', label: 'Nội bộ' },
  { value: 'CAS', label: 'SSO' },
  { value: 'BOTH', label: 'Cả hai' },
];
const statusBadge = (s: string) => <Badge color={s === 'HOAT_DONG' ? 'green' : s === 'KHOA' ? 'red' : 'slate'}>{STATUS.find((x) => x.value === s)?.label ?? s}</Badge>;

/** 3.1–3.10 Quản lý người dùng */
export function UsersTab() {
  const canCreate = useHasPerm('USER:CREATE');
  const canUpdate = useHasPerm('USER:UPDATE');
  const canDelete = useHasPerm('USER:DELETE');
  const canImport = useHasPerm('USER:IMPORT');
  const canExport = useHasPerm('USER:EXPORT');
  const canAssign = useHasPerm('USER:ASSIGN_ROLE');
  const org = useOrgTree({ mine: true });
  const list = useListState<{ keyword: string; status: string; orgUnitId: number | null }, UserRow>('users', EP.users.list, { keyword: '', status: '', orgUnitId: null });
  const [form, setForm] = useState<{ open: boolean; row?: UserRow }>({ open: false });
  const [view, setView] = useState<number | null>(null);
  const [roles, setRoles] = useState<UserRow | null>(null);
  const [imp, setImp] = useState(false);

  const remove = async (r: UserRow) => {
    if (!(await confirmDelete(r.fullName))) return;
    try {
      await del(EP.users.one(r.id), { version: r.version });
      toast.success('Xóa thành công');
      list.query.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <SearchBar
        keyword={list.draft.keyword}
        onKeywordChange={(v) => list.set('keyword', v)}
        placeholder="Họ tên hoặc email"
        onSearch={list.search}
        onReset={list.reset}
        actions={
          <>
            {canCreate && (
              <Button onClick={() => setForm({ open: true })}>
                <Plus className="h-4 w-4" />
                Thêm người dùng
              </Button>
            )}
            {canImport && (
              <Button variant="outline" onClick={() => setImp(true)}>
                <Upload className="h-4 w-4" />
                Nhập dữ liệu
              </Button>
            )}
            {canExport && <ExportButton url={EP.users.export} params={list.exportParams} />}
          </>
        }
      >
        <FilterItem label="Trạng thái" width="w-40">
          <Select aria-label="Trạng thái" options={STATUS} placeholder="Tất cả" value={list.draft.status} onChange={(e) => list.set('status', e.target.value)} />
        </FilterItem>
        <FilterItem label="Đơn vị" width="w-72">
          <TreeSelect aria-label="Đơn vị" nodes={org.data ?? []} value={list.draft.orgUnitId} onChange={(v) => list.set('orgUnitId', v)} placeholder="Tất cả đơn vị" />
        </FilterItem>
      </SearchBar>
      <h3 className="mb-2 text-sm font-semibold">Danh sách người dùng</h3>
      <DataGrid<UserRow>
        title="Danh sách người dùng"
        {...list.gridProps}
        rowKey={(r) => r.id}
        columns={[
          { key: 'fullName', header: 'Họ tên', sortable: true, width: 160 },
          { key: 'email', header: 'Email', sortable: true, width: 170 },
          { key: 'orgUnitName', header: 'Đơn vị', sortable: true, width: 170 },
          { key: 'status', header: 'Trạng thái', width: 100, render: (r) => statusBadge(r.status) },
          ...auditColumns<UserRow>(),
          {
            key: 'actions',
            header: 'Thao tác',
            width: 200,
            render: (r) => (
              <RowActions
                actions={[
                  { label: 'Xem', onClick: () => setView(r.id) },
                  { label: 'Sửa', onClick: () => setForm({ open: true, row: r }), show: canUpdate },
                  { label: 'Quản lý vai trò người dùng', onClick: () => setRoles(r), show: canAssign },
                  { label: 'Xóa', onClick: () => remove(r), show: canDelete, danger: true },
                ]}
              />
            ),
          },
        ]}
      />
      {form.open && <UserForm row={form.row} orgNodes={org.data ?? []} onClose={() => setForm({ open: false })} onSaved={() => list.query.refetch()} />}
      {view !== null && <UserView id={view} onClose={() => setView(null)} />}
      {roles && <UserRolesDialog user={roles} orgNodes={org.data ?? []} onClose={() => setRoles(null)} onSaved={() => list.query.refetch()} />}
      <ImportDialog open={imp} onOpenChange={setImp} templateUrl={EP.users.importTemplate} validateUrl={EP.users.importValidate} commitUrl={EP.users.importCommit} onDone={() => list.query.refetch()} />
    </div>
  );
}

const PW_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,128}$/;

function UserForm({ row, orgNodes, onClose, onSaved }: { row?: UserRow; orgNodes: import('@/components/ui/TreeSelect').TreeNode[]; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!row;
  const schema = z
    .object({
      fullName: z.string().trim().min(1, 'Vui lòng nhập Họ tên').max(255),
      email: z.string().trim().min(1, 'Vui lòng nhập Email').email('Email không hợp lệ'),
      orgUnitId: z.custom<number | null>((v) => typeof v === 'number', { message: 'Vui lòng chọn Đơn vị' }),
      status: z.string().min(1, 'Vui lòng chọn Trạng thái'),
      username: z.string().trim().min(1, 'Vui lòng nhập Tên đăng nhập').regex(/^[A-Za-z0-9._@-]+$/, 'Tên đăng nhập chỉ gồm chữ, số và . _ @ -'),
      phone: z.string().regex(/^[0-9+ ().-]*$/, 'Số điện thoại không hợp lệ').optional(),
      authSource: z.string(),
      initialPassword: z.string().optional(),
    })
    .superRefine((v, ctx) => {
      const needPw = v.authSource !== 'CAS' && !isEdit;
      if (needPw && !v.initialPassword) ctx.addIssue({ code: 'custom', path: ['initialPassword'], message: 'Vui lòng nhập Mật khẩu khởi tạo' });
      if (v.initialPassword && !PW_RE.test(v.initialPassword))
        ctx.addIssue({ code: 'custom', path: ['initialPassword'], message: 'Mật khẩu tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt' });
    });
  type F = z.infer<typeof schema>;
  const { register, handleSubmit, control, formState, setError, watch, setValue, getValues } = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: row?.fullName ?? '',
      email: row?.email ?? '',
      orgUnitId: row?.orgUnitId ?? null,
      status: row?.status ?? 'HOAT_DONG',
      username: row?.username ?? '',
      phone: row?.phone ?? '',
      authSource: row?.authSource ?? 'BOTH',
      initialPassword: '',
    },
  });
  const email = watch('email');
  useEffect(() => {
    // gợi ý tên đăng nhập từ email
    if (!isEdit && email && !formState.dirtyFields.username) {
      const suggest = email.split('@')[0].replace(/[^A-Za-z0-9._-]/g, '');
      if (suggest && getValues('username') !== suggest) setValue('username', suggest);
    }
  }, [email, isEdit, formState.dirtyFields.username, getValues, setValue]);

  const onSubmit = async (v: F) => {
    try {
      const body = { ...v, phone: v.phone || null, initialPassword: v.initialPassword || null, version: row?.version };
      if (isEdit) {
        await put(EP.users.one(row!.id), body);
        toast.success('Cập nhật thành công');
      } else {
        await post(EP.users.list, body);
        toast.success('Thêm mới thành công');
      }
      onSaved();
      onClose();
    } catch (e) {
      handleSubmitError(e, setError);
    }
  };
  const authSource = watch('authSource');
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={isEdit ? 'Sửa người dùng' : 'Thêm người dùng'}
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
      <form className="grid grid-cols-2 gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Họ tên" required error={formState.errors.fullName?.message} htmlFor="u-fullName">
          <Input id="u-fullName" {...register('fullName')} aria-invalid={!!formState.errors.fullName} />
        </Field>
        <Field label="Email" required error={formState.errors.email?.message} htmlFor="u-email">
          <Input id="u-email" {...register('email')} aria-invalid={!!formState.errors.email} />
        </Field>
        <Field label="Đơn vị" required error={formState.errors.orgUnitId?.message}>
          <Controller control={control} name="orgUnitId" render={({ field }) => <TreeSelect aria-label="Đơn vị *" nodes={orgNodes} value={field.value} onChange={field.onChange} />} />
        </Field>
        <Field label="Trạng thái" required error={formState.errors.status?.message} htmlFor="u-status">
          <Select id="u-status" options={STATUS} {...register('status')} />
        </Field>
        <Field label="Tên đăng nhập" required error={formState.errors.username?.message} htmlFor="u-username">
          <Input id="u-username" disabled={isEdit} {...register('username')} aria-invalid={!!formState.errors.username} />
        </Field>
        <Field label="Số điện thoại" error={formState.errors.phone?.message} htmlFor="u-phone">
          <Input id="u-phone" {...register('phone')} />
        </Field>
        <Field label="Nguồn xác thực" htmlFor="u-auth">
          <Select id="u-auth" options={AUTH} {...register('authSource')} />
        </Field>
        <Field label="Mật khẩu khởi tạo" required={authSource !== 'CAS' && !isEdit} error={formState.errors.initialPassword?.message} htmlFor="u-pw">
          <Input id="u-pw" type="password" autoComplete="new-password" placeholder={isEdit ? 'Để trống nếu không đổi' : ''} {...register('initialPassword')} />
        </Field>
      </form>
    </Dialog>
  );
}

function UserView({ id, onClose }: { id: number; onClose: () => void }) {
  const q = useQuery({ queryKey: ['user', id], queryFn: () => get<UserRow>(EP.users.one(id)) });
  const u = q.data;
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title="Thông tin người dùng">
      {u && (
        <>
          <Section title="Thông tin chung">
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Họ tên" value={u.fullName} />
              <ReadField label="Tên đăng nhập" value={u.username} />
              <ReadField label="Email" value={u.email} />
              <ReadField label="Số điện thoại" value={u.phone} />
              <ReadField label="Đơn vị" value={u.orgUnitName} />
              <ReadField label="Trạng thái" value={statusBadge(u.status)} />
              <ReadField label="Nguồn xác thực" value={AUTH.find((a) => a.value === u.authSource)?.label} />
              <ReadField label="Người tạo" value={u.createdBy} />
              <ReadField label="Ngày tạo" value={fmtDateTime(u.createdAt)} />
              <ReadField label="Người cập nhật" value={u.updatedBy} />
              <ReadField label="Ngày cập nhật" value={fmtDateTime(u.updatedAt)} />
            </div>
          </Section>
          <Section title="Danh sách vai trò đã gán">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-2 py-1 text-left">Mã – Tên vai trò</th>
                  <th className="px-2 py-1 text-left">Đơn vị áp dụng</th>
                </tr>
              </thead>
              <tbody>
                {(u.roles ?? []).map((r) => (
                  <tr key={r.roleId + '-' + (r.orgUnitId ?? '')} className="border-t border-border">
                    <td className="px-2 py-1">
                      {r.roleCode} – {r.roleName}
                    </td>
                    <td className="px-2 py-1">{r.orgUnitName ?? 'Tất cả (theo phạm vi vai trò)'}</td>
                  </tr>
                ))}
                {!u.roles?.length && (
                  <tr>
                    <td colSpan={2} className="py-4 text-center text-muted">
                      Chưa gán vai trò
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>
        </>
      )}
    </Drawer>
  );
}

interface RoleOpt {
  id: number;
  code: string;
  name: string;
  status: string;
}

/** 3.9 Gán / 3.10 Bỏ gán vai trò — dialog hai cột “Vai trò có sẵn” / “Vai trò đã gán” */
function UserRolesDialog({ user, orgNodes, onClose, onSaved }: { user: UserRow; orgNodes: import('@/components/ui/TreeSelect').TreeNode[]; onClose: () => void; onSaved: () => void }) {
  const roles = useQuery({ queryKey: ['roles-active'], queryFn: () => get<RoleOpt[]>('/roles/active') });
  const current = useQuery({ queryKey: ['user-roles', user.id], queryFn: () => get<{ roleId: number; orgUnitId: number | null }[]>(EP.users.roles(user.id)), staleTime: 0, gcTime: 0 });
  const [assigned, setAssigned] = useState<{ roleId: number; orgUnitId: number | null }[] | null>(null);
  const [availSel, setAvailSel] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const list = assigned ?? (current.isFetching ? [] : (current.data ?? []));
  const available = (roles.data ?? []).filter((r) => r.status === 'HIEU_LUC' && !list.some((a) => a.roleId === r.id));
  const roleName = (id: number) => {
    const r = roles.data?.find((x) => x.id === id);
    return r ? `${r.code} – ${r.name}` : String(id);
  };
  const save = async () => {
    setBusy(true);
    try {
      await put(EP.users.roles(user.id), list);
      toast.success('Cập nhật vai trò thành công');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Quản lý vai trò người dùng"
      description={`${user.fullName} (${user.username})`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={save} loading={busy}>
            Lưu
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3">
        <div className="rounded border border-border">
          <div className="border-b border-border bg-slate-50 px-3 py-2 text-sm font-semibold">Vai trò có sẵn</div>
          <div className="max-h-80 overflow-auto p-2" data-testid="roles-available">
            {available.map((r) => (
              <div key={r.id} className="py-1">
                <Checkbox
                  checked={availSel.includes(r.id)}
                  onCheckedChange={(v) => setAvailSel(v ? [...availSel, r.id] : availSel.filter((x) => x !== r.id))}
                  label={`${r.code} – ${r.name}`}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setAssigned([...list, ...availSel.map((id) => ({ roleId: id, orgUnitId: null }))]);
              setAvailSel([]);
            }}
            disabled={!availSel.length}
          >
            Thêm →
          </Button>
        </div>
        <div className="rounded border border-border">
          <div className="border-b border-border bg-slate-50 px-3 py-2 text-sm font-semibold">Vai trò đã gán</div>
          <div className="max-h-80 space-y-2 overflow-auto p-2" data-testid="roles-assigned">
            {list.map((a, i) => (
              <div key={a.roleId + '-' + i} className="rounded border border-border p-2">
                <Checkbox checked onCheckedChange={(v) => !v && setAssigned(list.filter((_, j) => j !== i))} label={roleName(a.roleId)} />
                <div className="mt-1 pl-6">
                  <span className="text-xs text-muted">Đơn vị áp dụng</span>
                  <TreeSelect
                    aria-label={`Đơn vị áp dụng ${roleName(a.roleId)}`}
                    nodes={orgNodes}
                    value={a.orgUnitId}
                    placeholder="Không giới hạn (tùy chọn)"
                    onChange={(v) => setAssigned(list.map((x, j) => (j === i ? { ...x, orgUnitId: v } : x)))}
                  />
                </div>
              </div>
            ))}
            {!list.length && <div className="py-4 text-center text-sm text-muted">Chưa gán vai trò</div>}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
