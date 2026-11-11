import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Upload } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { del, post, put } from '@/api/http';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { FilterItem, SearchBar } from '@/components/data-grid/SearchBar';
import { useListState } from '@/components/data-grid/useListState';
import { ExportButton } from '@/components/import-export/ExportButton';
import { ImportDialog } from '@/components/import-export/ImportDialog';
import { Button } from '@/components/ui/Button';
import { confirmDelete } from '@/components/ui/ConfirmDialog';
import { Dialog, Drawer } from '@/components/ui/Dialog';
import { Field, Input, ReadField, Select, Textarea } from '@/components/ui/Input';
import { errorMessage, toast } from '@/components/ui/Toast';
import { ACTIVE_OPTIONS, ActiveBadge, auditColumns, codeName, handleSubmitError, RowActions, Section } from '@/features/common/shared';
import { fmtDateTime } from '@/lib/format';
import { useHasPerm } from '@/stores/sessionStore';

interface PerspectiveRow {
  id: number;
  code: string;
  name: string;
  sortOrder?: number | null;
  description?: string;
  color?: string | null;
  status: string;
  kpiCount?: number;
  version: number;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export function ColorSwatch({ color }: { color?: string | null }) {
  if (!color) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-4 w-4 rounded border border-border" style={{ backgroundColor: color }} aria-hidden="true" />
      <span className="font-mono text-xs">{color}</span>
    </span>
  );
}

/** 26.9–26.16 Viễn cảnh */
export function PerspectiveTab() {
  const canCreate = useHasPerm('PERSPECTIVE:CREATE');
  const canUpdate = useHasPerm('PERSPECTIVE:UPDATE');
  const canDelete = useHasPerm('PERSPECTIVE:DELETE');
  const canImport = useHasPerm('PERSPECTIVE:IMPORT');
  const canExport = useHasPerm('PERSPECTIVE:EXPORT');
  const list = useListState<{ keyword: string; status: string }, PerspectiveRow>('perspectives', EP.perspectives.list, { keyword: '', status: '' });
  const [form, setForm] = useState<{ open: boolean; row?: PerspectiveRow }>({ open: false });
  const [view, setView] = useState<PerspectiveRow | null>(null);
  const [imp, setImp] = useState(false);
  const refresh = () => list.query.refetch();

  const remove = async (r: PerspectiveRow) => {
    if (!(await confirmDelete(codeName(r.code, r.name)))) return;
    try {
      await del(EP.perspectives.one(r.id), { version: r.version });
      toast.success('Xóa thành công');
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <SearchBar
        keyword={list.draft.keyword}
        onKeywordChange={(v) => list.set('keyword', v)}
        placeholder="Mã hoặc tên viễn cảnh"
        onSearch={list.search}
        onReset={list.reset}
        actions={
          <>
            {canCreate && (
              <Button onClick={() => setForm({ open: true })}>
                <Plus className="h-4 w-4" />
                Thêm viễn cảnh
              </Button>
            )}
            {canImport && (
              <Button variant="outline" onClick={() => setImp(true)}>
                <Upload className="h-4 w-4" />
                Nhập dữ liệu
              </Button>
            )}
            {canExport && <ExportButton url={EP.perspectives.export} params={list.exportParams} />}
          </>
        }
      >
        <FilterItem label="Trạng thái" width="w-40">
          <Select aria-label="Trạng thái" options={ACTIVE_OPTIONS} placeholder="Tất cả" value={list.draft.status} onChange={(e) => list.set('status', e.target.value)} />
        </FilterItem>
      </SearchBar>
      <h3 className="mb-2 text-sm font-semibold">Danh sách viễn cảnh</h3>
      <DataGrid<PerspectiveRow>
        title="Danh sách viễn cảnh"
        {...list.gridProps}
        rowKey={(r) => r.id}
        columns={[
          { key: 'code', header: 'Mã – Tên viễn cảnh', sortable: true, width: 220, render: (r) => `${r.code} – ${r.name}` },
          { key: 'sortOrder', header: 'Thứ tự', sortable: true, width: 70, align: 'right' },
          { key: 'description', header: 'Mô tả' },
          { key: 'color', header: 'Màu', width: 100, render: (r) => <ColorSwatch color={r.color} /> },
          { key: 'status', header: 'Trạng thái', sortable: true, width: 120, render: (r) => <ActiveBadge status={r.status} /> },
          ...auditColumns<PerspectiveRow>(),
          {
            key: 'actions',
            header: 'Thao tác',
            width: 120,
            render: (r) => (
              <RowActions
                actions={[
                  { label: 'Xem', onClick: () => setView(r) },
                  { label: 'Sửa', onClick: () => setForm({ open: true, row: r }), show: canUpdate },
                  { label: 'Xóa', onClick: () => remove(r), show: canDelete, danger: true },
                ]}
              />
            ),
          },
        ]}
      />
      {form.open && <PerspectiveForm row={form.row} onClose={() => setForm({ open: false })} onSaved={refresh} />}
      {view && (
        <Drawer open onOpenChange={(o) => !o && setView(null)} title="Thông tin viễn cảnh">
          <Section title="Thông tin chung">
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Mã viễn cảnh" value={view.code} />
              <ReadField label="Tên viễn cảnh" value={view.name} />
              <ReadField label="Thứ tự" value={view.sortOrder} />
              <ReadField label="Màu" value={<ColorSwatch color={view.color} />} />
              <ReadField label="Trạng thái" value={<ActiveBadge status={view.status} />} />
              <ReadField label="Số KPI sử dụng" value={view.kpiCount ?? 0} />
              <ReadField label="Mô tả" value={view.description} className="col-span-2" />
              <ReadField label="Người tạo" value={view.createdBy} />
              <ReadField label="Ngày tạo" value={fmtDateTime(view.createdAt)} />
              <ReadField label="Người cập nhật" value={view.updatedBy} />
              <ReadField label="Ngày cập nhật" value={fmtDateTime(view.updatedAt)} />
            </div>
          </Section>
        </Drawer>
      )}
      <ImportDialog
        open={imp}
        onOpenChange={setImp}
        templateUrl={EP.perspectives.importTemplate}
        validateUrl={EP.perspectives.importValidate}
        commitUrl={EP.perspectives.importCommit}
        onDone={refresh}
      />
    </div>
  );
}

const HEX = /^#[0-9A-Fa-f]{6}$/;

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập Mã viễn cảnh')
    .max(10, 'Mã viễn cảnh tối đa 10 ký tự')
    .regex(/^[A-Z0-9]+$/, 'Mã viễn cảnh chỉ gồm chữ in hoa và số'),
  name: z.string().trim().min(1, 'Vui lòng nhập Tên viễn cảnh').max(255, 'Tên viễn cảnh tối đa 255 ký tự'),
  sortOrder: z.string().refine((s) => s.trim() === '' || (/^\d+$/.test(s.trim()) && Number(s) <= 1000), 'Thứ tự phải là số nguyên từ 0 đến 1000'),
  description: z.string().max(1000, 'Mô tả tối đa 1000 ký tự').optional(),
  color: z.string().refine((s) => s.trim() === '' || HEX.test(s.trim()), 'Màu phải theo định dạng #RRGGBB'),
  status: z.string().min(1, 'Vui lòng chọn Trạng thái'),
});

function PerspectiveForm({ row, onClose, onSaved }: { row?: PerspectiveRow; onClose: () => void; onSaved: () => void }) {
  const codeLocked = !!row && (row.kpiCount ?? 0) > 0;
  const { register, handleSubmit, formState, setError, control } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      code: row?.code ?? '',
      name: row?.name ?? '',
      sortOrder: row?.sortOrder != null ? String(row.sortOrder) : '',
      description: row?.description ?? '',
      color: row?.color ?? '#0EA5E9',
      status: row?.status ?? 'HIEU_LUC',
    },
  });
  const onSubmit = async (v: z.output<typeof schema>) => {
    try {
      const body = {
        code: v.code.trim().toUpperCase(),
        name: v.name.trim(),
        sortOrder: v.sortOrder.trim() === '' ? null : Number(v.sortOrder),
        description: v.description || null,
        color: v.color.trim() || null,
        status: v.status,
        version: row?.version,
      };
      if (row) {
        await put(EP.perspectives.one(row.id), body);
        toast.success('Cập nhật thành công');
      } else {
        await post(EP.perspectives.list, body);
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
      title={row ? 'Sửa viễn cảnh' : 'Thêm viễn cảnh'}
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
        <Field label="Mã viễn cảnh" required error={formState.errors.code?.message} htmlFor="p-code">
          <Input
            id="p-code"
            maxLength={10}
            disabled={codeLocked}
            title={codeLocked ? 'Không được sửa mã viễn cảnh vì đã được dùng làm tiền tố mã KPI' : undefined}
            {...register('code', { setValueAs: (s: string) => s.toUpperCase() })}
          />
          {codeLocked && <p className="mt-1 text-xs text-muted">Không được sửa mã viễn cảnh vì đã được dùng làm tiền tố mã KPI</p>}
        </Field>
        <Field label="Tên viễn cảnh" required error={formState.errors.name?.message} htmlFor="p-name">
          <Input id="p-name" {...register('name')} />
        </Field>
        <Field label="Thứ tự" error={formState.errors.sortOrder?.message} htmlFor="p-sort">
          <Input id="p-sort" type="number" min={0} {...register('sortOrder')} />
        </Field>
        <Field label="Màu" error={formState.errors.color?.message} htmlFor="p-color">
          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Chọn màu"
                  className="h-9 w-12 cursor-pointer rounded border border-border bg-white p-0.5"
                  value={HEX.test(field.value) ? field.value : '#000000'}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
                <Input id="p-color" placeholder="#RRGGBB" maxLength={7} value={field.value} onChange={(e) => field.onChange(e.target.value)} onBlur={field.onBlur} />
              </div>
            )}
          />
        </Field>
        <Field label="Trạng thái" required error={formState.errors.status?.message} htmlFor="p-status">
          <Select id="p-status" options={ACTIVE_OPTIONS} placeholder="-- Chọn --" {...register('status')} />
        </Field>
        <Field label="Mô tả" error={formState.errors.description?.message} className="col-span-2" htmlFor="p-desc">
          <Textarea id="p-desc" {...register('description')} />
        </Field>
      </form>
    </Dialog>
  );
}
