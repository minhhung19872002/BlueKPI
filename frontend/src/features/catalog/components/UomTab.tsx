import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Upload } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { ACTIVE_OPTIONS, ActiveBadge, auditColumns, handleSubmitError, RowActions, Section } from '@/features/common/shared';
import { fmtDateTime } from '@/lib/format';
import { useHasPerm } from '@/stores/sessionStore';

interface UomRow {
  id: number;
  code: string;
  name: string;
  description?: string;
  status: string;
  version: number;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}

/** 26.1–26.8 Đơn vị đo */
export function UomTab() {
  const canCreate = useHasPerm('UOM:CREATE');
  const canUpdate = useHasPerm('UOM:UPDATE');
  const canDelete = useHasPerm('UOM:DELETE');
  const canImport = useHasPerm('UOM:IMPORT');
  const canExport = useHasPerm('UOM:EXPORT');
  const list = useListState<{ keyword: string; status: string }, UomRow>('uoms', EP.uoms.list, { keyword: '', status: '' });
  const [form, setForm] = useState<{ open: boolean; row?: UomRow }>({ open: false });
  const [view, setView] = useState<UomRow | null>(null);
  const [imp, setImp] = useState(false);
  const refresh = () => list.query.refetch();

  const remove = async (r: UomRow) => {
    if (!(await confirmDelete(r.name))) return;
    try {
      await del(EP.uoms.one(r.id), { version: r.version });
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
        placeholder="Tên hoặc mã đơn vị đo"
        onSearch={list.search}
        onReset={list.reset}
        actions={
          <>
            {canCreate && (
              <Button onClick={() => setForm({ open: true })}>
                <Plus className="h-4 w-4" />
                Thêm đơn vị đo
              </Button>
            )}
            {canImport && (
              <Button variant="outline" onClick={() => setImp(true)}>
                <Upload className="h-4 w-4" />
                Nhập dữ liệu
              </Button>
            )}
            {canExport && <ExportButton url={EP.uoms.export} params={list.exportParams} />}
          </>
        }
      >
        <FilterItem label="Trạng thái" width="w-40">
          <Select aria-label="Trạng thái" options={ACTIVE_OPTIONS} placeholder="Tất cả" value={list.draft.status} onChange={(e) => list.set('status', e.target.value)} />
        </FilterItem>
      </SearchBar>
      <h3 className="mb-2 text-sm font-semibold">Danh sách đơn vị đo</h3>
      <DataGrid<UomRow>
        title="Danh sách đơn vị đo"
        {...list.gridProps}
        rowKey={(r) => r.id}
        columns={[
          { key: 'code', header: 'Mã', sortable: true, width: 90, render: (r) => <code className="text-xs">{r.code}</code> },
          { key: 'name', header: 'Tên đơn vị đo', sortable: true, width: 180 },
          { key: 'description', header: 'Mô tả' },
          { key: 'status', header: 'Trạng thái', sortable: true, width: 120, render: (r) => <ActiveBadge status={r.status} /> },
          ...auditColumns<UomRow>(),
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
      {form.open && <UomForm row={form.row} onClose={() => setForm({ open: false })} onSaved={refresh} />}
      {view && (
        <Drawer open onOpenChange={(o) => !o && setView(null)} title="Thông tin đơn vị đo">
          <Section title="Thông tin chung">
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Mã" value={view.code} />
              <ReadField label="Tên đơn vị đo" value={view.name} />
              <ReadField label="Trạng thái" value={<ActiveBadge status={view.status} />} />
              <ReadField label="Mô tả" value={view.description} className="col-span-2" />
              <ReadField label="Người tạo" value={view.createdBy} />
              <ReadField label="Ngày tạo" value={fmtDateTime(view.createdAt)} />
              <ReadField label="Người cập nhật" value={view.updatedBy} />
              <ReadField label="Ngày cập nhật" value={fmtDateTime(view.updatedAt)} />
            </div>
          </Section>
        </Drawer>
      )}
      <ImportDialog open={imp} onOpenChange={setImp} templateUrl={EP.uoms.importTemplate} validateUrl={EP.uoms.importValidate} commitUrl={EP.uoms.importCommit} onDone={refresh} />
    </div>
  );
}

const schema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập Tên đơn vị đo').max(255, 'Tên đơn vị đo tối đa 255 ký tự'),
  description: z.string().max(1000, 'Mô tả tối đa 1000 ký tự').optional(),
  status: z.string().min(1, 'Vui lòng chọn Trạng thái'),
});

function UomForm({ row, onClose, onSaved }: { row?: UomRow; onClose: () => void; onSaved: () => void }) {
  const { register, handleSubmit, formState, setError } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: row?.name ?? '', description: row?.description ?? '', status: row?.status ?? 'HIEU_LUC' },
  });
  const onSubmit = async (v: z.output<typeof schema>) => {
    try {
      const body = { ...v, description: v.description || null, version: row?.version };
      if (row) {
        await put(EP.uoms.one(row.id), body);
        toast.success('Cập nhật thành công');
      } else {
        await post(EP.uoms.list, body);
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
      title={row ? 'Sửa đơn vị đo' : 'Thêm đơn vị đo'}
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
        <Field label="Tên đơn vị đo" required error={formState.errors.name?.message} htmlFor="u-name">
          <Input id="u-name" {...register('name')} />
        </Field>
        <Field label="Trạng thái" required error={formState.errors.status?.message} htmlFor="u-status">
          <Select id="u-status" options={ACTIVE_OPTIONS} placeholder="-- Chọn --" {...register('status')} />
        </Field>
        <Field label="Mô tả" error={formState.errors.description?.message} className="col-span-2" htmlFor="u-desc">
          <Textarea id="u-desc" {...register('description')} />
        </Field>
      </form>
    </Dialog>
  );
}
