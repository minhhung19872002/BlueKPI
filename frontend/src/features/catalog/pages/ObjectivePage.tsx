import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Plus, Upload } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { Field, Input, ReadField, Select, Textarea, type Option } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/Misc';
import { errorMessage, toast } from '@/components/ui/Toast';
import { auditColumns, codeName, handleSubmitError, RowActions, Section } from '@/features/common/shared';
import { fmtDateTime } from '@/lib/format';
import { useHasPerm } from '@/stores/sessionStore';

interface ObjectiveRow {
  id: number;
  code: string;
  name: string;
  perspectiveId: number;
  perspectiveCode?: string;
  perspectiveName?: string;
  perspectiveColor?: string | null;
  description?: string;
  version: number;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}

interface PerspectiveOption {
  id: number;
  code: string;
  name: string;
  color?: string | null;
}

function PerspectiveLabel({ code, name, color }: { code?: string; name?: string; color?: string | null }) {
  if (!code && !name) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {color && <span className="inline-block h-3 w-3 shrink-0 rounded-sm border border-border" style={{ backgroundColor: color }} aria-hidden="true" />}
      {codeName(code, name)}
    </span>
  );
}

/** 28.1–28.8 Danh mục mục tiêu trọng tâm */
export function ObjectivePage() {
  const canCreate = useHasPerm('OBJECTIVE:CREATE');
  const canUpdate = useHasPerm('OBJECTIVE:UPDATE');
  const canDelete = useHasPerm('OBJECTIVE:DELETE');
  const canImport = useHasPerm('OBJECTIVE:IMPORT');
  const canExport = useHasPerm('OBJECTIVE:EXPORT');
  const list = useListState<{ keyword: string; perspectiveId: string }, ObjectiveRow>('objectives', EP.objectives.list, { keyword: '', perspectiveId: '' });
  const perspectives = useQuery({ queryKey: ['perspectives-all'], queryFn: () => get<PerspectiveOption[]>(`${EP.perspectives.list}/all`), staleTime: 60_000 });
  const perspectiveOptions: Option[] = (perspectives.data ?? []).map((p) => ({ value: p.id, label: codeName(p.code, p.name) }));
  const [form, setForm] = useState<{ open: boolean; row?: ObjectiveRow }>({ open: false });
  const [view, setView] = useState<ObjectiveRow | null>(null);
  const [imp, setImp] = useState(false);
  const refresh = () => list.query.refetch();

  const remove = async (r: ObjectiveRow) => {
    if (!(await confirmDelete(codeName(r.code, r.name)))) return;
    try {
      await del(EP.objectives.one(r.id), { version: r.version });
      toast.success('Xóa thành công');
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <PageHeader title="Danh mục mục tiêu trọng tâm" />
      <SearchBar
        keyword={list.draft.keyword}
        onKeywordChange={(v) => list.set('keyword', v)}
        placeholder="Mã hoặc tên mục tiêu"
        onSearch={list.search}
        onReset={list.reset}
        actions={
          <>
            {canCreate && (
              <Button onClick={() => setForm({ open: true })}>
                <Plus className="h-4 w-4" />
                Thêm mục tiêu
              </Button>
            )}
            {canImport && (
              <Button variant="outline" onClick={() => setImp(true)}>
                <Upload className="h-4 w-4" />
                Nhập dữ liệu
              </Button>
            )}
            {canExport && <ExportButton url={EP.objectives.export} params={list.exportParams} />}
          </>
        }
      >
        <FilterItem label="Viễn cảnh" width="w-56">
          <Select aria-label="Viễn cảnh" options={perspectiveOptions} placeholder="Tất cả" value={list.draft.perspectiveId} onChange={(e) => list.set('perspectiveId', e.target.value)} />
        </FilterItem>
      </SearchBar>
      <h3 className="mb-2 text-sm font-semibold">Danh sách mục tiêu trọng tâm</h3>
      <DataGrid<ObjectiveRow>
        title="Danh sách mục tiêu trọng tâm"
        {...list.gridProps}
        rowKey={(r) => r.id}
        columns={[
          { key: 'code', header: 'Mã – Tên mục tiêu', sortable: true, width: 280, render: (r) => `${r.code} – ${r.name}` },
          {
            key: 'perspectiveName',
            header: 'Viễn cảnh',
            width: 180,
            render: (r) => <PerspectiveLabel code={r.perspectiveCode} name={r.perspectiveName} color={r.perspectiveColor} />,
          },
          { key: 'description', header: 'Mô tả' },
          ...auditColumns<ObjectiveRow>(),
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
      {form.open && <ObjectiveForm row={form.row} perspectiveOptions={perspectiveOptions} onClose={() => setForm({ open: false })} onSaved={refresh} />}
      {view && (
        <Drawer open onOpenChange={(o) => !o && setView(null)} title="Thông tin mục tiêu trọng tâm">
          <Section title="Thông tin chung">
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Mã mục tiêu" value={view.code} />
              <ReadField label="Tên mục tiêu" value={view.name} />
              <ReadField label="Viễn cảnh" value={<PerspectiveLabel code={view.perspectiveCode} name={view.perspectiveName} color={view.perspectiveColor} />} className="col-span-2" />
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
        templateUrl={EP.objectives.importTemplate}
        validateUrl={EP.objectives.importValidate}
        commitUrl={EP.objectives.importCommit}
        onDone={refresh}
      />
    </div>
  );
}

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập Mã mục tiêu')
    .max(50, 'Mã mục tiêu tối đa 50 ký tự')
    .regex(/^[A-Za-z0-9_.-]+$/, 'Mã mục tiêu chỉ gồm chữ, số, _ . -'),
  name: z.string().trim().min(1, 'Vui lòng nhập Tên mục tiêu').max(500, 'Tên mục tiêu tối đa 500 ký tự'),
  perspectiveId: z.string().min(1, 'Vui lòng chọn Viễn cảnh'),
  description: z.string().max(2000, 'Mô tả tối đa 2000 ký tự').optional(),
});

function ObjectiveForm({ row, perspectiveOptions, onClose, onSaved }: { row?: ObjectiveRow; perspectiveOptions: Option[]; onClose: () => void; onSaved: () => void }) {
  const { register, handleSubmit, formState, setError } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      code: row?.code ?? '',
      name: row?.name ?? '',
      perspectiveId: row?.perspectiveId != null ? String(row.perspectiveId) : '',
      description: row?.description ?? '',
    },
  });
  const onSubmit = async (v: z.output<typeof schema>) => {
    try {
      const body = { code: v.code.trim(), name: v.name.trim(), perspectiveId: Number(v.perspectiveId), description: v.description || null, version: row?.version };
      if (row) {
        await put(EP.objectives.one(row.id), body);
        toast.success('Cập nhật thành công');
      } else {
        await post(EP.objectives.list, body);
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
      title={row ? 'Sửa mục tiêu' : 'Thêm mục tiêu'}
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
        <Field label="Mã mục tiêu" required error={formState.errors.code?.message} htmlFor="o-code">
          <Input id="o-code" disabled={!!row} {...register('code')} />
        </Field>
        <Field label="Tên mục tiêu" required error={formState.errors.name?.message} htmlFor="o-name">
          <Input id="o-name" {...register('name')} />
        </Field>
        <Field label="Viễn cảnh" required error={formState.errors.perspectiveId?.message} className="col-span-2" htmlFor="o-per">
          <Select id="o-per" options={perspectiveOptions} placeholder="-- Chọn --" {...register('perspectiveId')} />
        </Field>
        <Field label="Mô tả" error={formState.errors.description?.message} className="col-span-2" htmlFor="o-desc">
          <Textarea id="o-desc" {...register('description')} />
        </Field>
      </form>
    </Dialog>
  );
}
