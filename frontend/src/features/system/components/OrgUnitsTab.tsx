import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { List as ListIcon, Network, Plus, Upload } from 'lucide-react';
import { useState } from 'react';
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
import { Checkbox } from '@/components/ui/Misc';
import { errorMessage, toast } from '@/components/ui/Toast';
import { TreeSelect, type TreeNode } from '@/components/ui/TreeSelect';
import { auditColumns, handleSubmitError, labelOf, REGION_OPTIONS, RowActions, Section, UNIT_TYPE_OPTIONS, useOrgTree } from '@/features/common/shared';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useHasPerm } from '@/stores/sessionStore';

interface OrgRow {
  id: number;
  code: string;
  name: string;
  shortName?: string;
  parentId: number | null;
  parentName?: string;
  unitType: string;
  regionCode?: string;
  isKpiAssignable: boolean;
  sortOrder: number;
  version: number;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  children?: OrgRow[];
}

/** 5.1–5.8 Quản lý đơn vị/phòng ban */
export function OrgUnitsTab() {
  const canCreate = useHasPerm('ORG:CREATE');
  const canUpdate = useHasPerm('ORG:UPDATE');
  const canDelete = useHasPerm('ORG:DELETE');
  const canImport = useHasPerm('ORG:IMPORT');
  const canExport = useHasPerm('ORG:EXPORT');
  const [mode, setMode] = useState<'grid' | 'tree'>('grid');
  const list = useListState<{ keyword: string; unitType: string; regionCode: string }, OrgRow>('org-units', EP.orgUnits.list, { keyword: '', unitType: '', regionCode: '' });
  const tree = useQuery({ queryKey: ['org-tree-admin'], queryFn: () => get<OrgRow[]>(EP.orgUnits.tree, { scope: 'mine' }), enabled: mode === 'tree' });
  const orgNodes = useOrgTree({ mine: true });
  const [form, setForm] = useState<{ open: boolean; row?: OrgRow }>({ open: false });
  const [view, setView] = useState<OrgRow | null>(null);
  const [imp, setImp] = useState(false);
  const refresh = () => {
    list.query.refetch();
    tree.refetch();
    orgNodes.refetch();
  };

  const remove = async (r: OrgRow) => {
    if (!(await confirmDelete(`${r.code} – ${r.name}`))) return;
    try {
      await del(EP.orgUnits.one(r.id), { version: r.version });
      toast.success('Xóa thành công');
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const columns = [
    { key: 'code', header: 'Mã đơn vị', sortable: true, width: 130 },
    { key: 'name', header: 'Tên đơn vị', sortable: true, width: 220 },
    { key: 'parentName', header: 'Đơn vị cha', sortable: true, width: 160 },
    { key: 'shortName', header: 'Tên viết tắt', sortable: true, width: 110 },
    { key: 'unitType', header: 'Loại đơn vị', sortable: true, width: 120, render: (r: OrgRow) => labelOf(UNIT_TYPE_OPTIONS, r.unitType) },
    { key: 'regionCode', header: 'Vùng', sortable: true, width: 90, render: (r: OrgRow) => labelOf(REGION_OPTIONS, r.regionCode) },
    { key: 'isKpiAssignable', header: 'Giao KPI', width: 80, align: 'center' as const, render: (r: OrgRow) => (r.isKpiAssignable ? '✓' : '') },
    { key: 'sortOrder', header: 'Thứ tự', sortable: true, width: 70, align: 'right' as const },
    ...auditColumns<OrgRow>(),
    {
      key: 'actions',
      header: 'Thao tác',
      width: 120,
      render: (r: OrgRow) => (
        <RowActions
          actions={[
            { label: 'Xem', onClick: () => setView(r) },
            { label: 'Sửa', onClick: () => setForm({ open: true, row: r }), show: canUpdate },
            { label: 'Xóa', onClick: () => remove(r), show: canDelete, danger: true },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <SearchBar
        keyword={list.draft.keyword}
        onKeywordChange={(v) => list.set('keyword', v)}
        placeholder="Mã, tên hoặc tên viết tắt"
        onSearch={list.search}
        onReset={list.reset}
        actions={
          <>
            {canCreate && (
              <Button onClick={() => setForm({ open: true })}>
                <Plus className="h-4 w-4" />
                Thêm đơn vị
              </Button>
            )}
            {canImport && (
              <Button variant="outline" onClick={() => setImp(true)}>
                <Upload className="h-4 w-4" />
                Nhập dữ liệu
              </Button>
            )}
            {canExport && <ExportButton url={EP.orgUnits.export} params={list.exportParams} />}
          </>
        }
      >
        <FilterItem label="Loại đơn vị" width="w-44">
          <Select aria-label="Loại đơn vị" options={UNIT_TYPE_OPTIONS} placeholder="Tất cả" value={list.draft.unitType} onChange={(e) => list.set('unitType', e.target.value)} />
        </FilterItem>
        <FilterItem label="Vùng" width="w-36">
          <Select aria-label="Vùng" options={REGION_OPTIONS} placeholder="Tất cả" value={list.draft.regionCode} onChange={(e) => list.set('regionCode', e.target.value)} />
        </FilterItem>
      </SearchBar>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Danh sách đơn vị</h3>
        <div className="inline-flex rounded-md border border-border bg-white p-0.5" role="group" aria-label="Chế độ xem">
          <button type="button" onClick={() => setMode('grid')} className={cn('flex items-center gap-1 rounded px-2 py-1 text-xs', mode === 'grid' && 'bg-primary text-white')}>
            <ListIcon className="h-3.5 w-3.5" />
            Lưới
          </button>
          <button type="button" onClick={() => setMode('tree')} className={cn('flex items-center gap-1 rounded px-2 py-1 text-xs', mode === 'tree' && 'bg-primary text-white')}>
            <Network className="h-3.5 w-3.5" />
            Cây
          </button>
        </div>
      </div>
      {mode === 'grid' ? (
        <DataGrid<OrgRow> title="Danh sách đơn vị" {...list.gridProps} rowKey={(r) => r.id} columns={columns} />
      ) : (
        <DataGrid<OrgRow>
          title="Cây đơn vị"
          rows={tree.data ?? []}
          loading={tree.isFetching}
          rowKey={(r) => r.id}
          getChildren={(r) => r.children}
          pagination={false}
          columns={columns}
        />
      )}
      {form.open && <OrgForm row={form.row} orgNodes={orgNodes.data ?? []} onClose={() => setForm({ open: false })} onSaved={refresh} />}
      {view && (
        <Drawer open onOpenChange={(o) => !o && setView(null)} title="Thông tin đơn vị">
          <Section title="Thông tin chung">
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Mã đơn vị" value={view.code} />
              <ReadField label="Tên đơn vị" value={view.name} />
              <ReadField label="Đơn vị cha" value={view.parentName} />
              <ReadField label="Tên viết tắt" value={view.shortName} />
              <ReadField label="Loại đơn vị" value={labelOf(UNIT_TYPE_OPTIONS, view.unitType)} />
              <ReadField label="Vùng" value={labelOf(REGION_OPTIONS, view.regionCode)} />
              <ReadField label="Giao KPI" value={view.isKpiAssignable ? 'Có' : 'Không'} />
              <ReadField label="Thứ tự" value={view.sortOrder} />
              <ReadField label="Người tạo" value={view.createdBy} />
              <ReadField label="Ngày tạo" value={fmtDateTime(view.createdAt)} />
              <ReadField label="Người cập nhật" value={view.updatedBy} />
              <ReadField label="Ngày cập nhật" value={fmtDateTime(view.updatedAt)} />
            </div>
          </Section>
        </Drawer>
      )}
      <ImportDialog open={imp} onOpenChange={setImp} templateUrl={EP.orgUnits.importTemplate} validateUrl={EP.orgUnits.importValidate} commitUrl={EP.orgUnits.importCommit} onDone={refresh} />
    </div>
  );
}

const schema = z.object({
  code: z.string().trim().min(1, 'Vui lòng nhập Mã đơn vị').max(50).regex(/^[A-Za-z0-9_.-]+$/, 'Mã đơn vị chỉ gồm chữ, số, dấu gạch dưới, gạch ngang, chấm'),
  name: z.string().trim().min(1, 'Vui lòng nhập Tên đơn vị').max(255),
  parentId: z.number().nullable(),
  shortName: z.string().max(100).optional(),
  unitType: z.string().min(1, 'Vui lòng chọn Loại đơn vị'),
  regionCode: z.string().optional(),
  isKpiAssignable: z.boolean(),
  sortOrder: z.coerce.number().int().min(0, 'Thứ tự phải ≥ 0'),
});

function OrgForm({ row, orgNodes, onClose, onSaved }: { row?: OrgRow; orgNodes: TreeNode[]; onClose: () => void; onSaved: () => void }) {
  const { register, handleSubmit, formState, control, setError } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      code: row?.code ?? '',
      name: row?.name ?? '',
      parentId: row?.parentId ?? null,
      shortName: row?.shortName ?? '',
      unitType: row?.unitType ?? '',
      regionCode: row?.regionCode ?? '',
      isKpiAssignable: row?.isKpiAssignable ?? false,
      sortOrder: row?.sortOrder ?? 0,
    },
  });
  const onSubmit = async (v: z.output<typeof schema>) => {
    try {
      const body = { ...v, regionCode: v.regionCode || null, shortName: v.shortName || null, version: row?.version };
      if (row) {
        await put(EP.orgUnits.one(row.id), body);
        toast.success('Cập nhật thành công');
      } else {
        await post(EP.orgUnits.list, body);
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
      title={row ? 'Sửa đơn vị' : 'Thêm đơn vị'}
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
        <Field label="Mã đơn vị" required error={formState.errors.code?.message} htmlFor="o-code">
          <Input id="o-code" disabled={!!row} {...register('code')} />
        </Field>
        <Field label="Tên đơn vị" required error={formState.errors.name?.message} htmlFor="o-name">
          <Input id="o-name" {...register('name')} />
        </Field>
        <Field label="Đơn vị cha" error={formState.errors.parentId?.message}>
          <Controller control={control} name="parentId" render={({ field }) => <TreeSelect aria-label="Đơn vị cha" nodes={orgNodes} value={field.value} onChange={field.onChange} />} />
        </Field>
        <Field label="Tên viết tắt" htmlFor="o-short">
          <Input id="o-short" {...register('shortName')} />
        </Field>
        <Field label="Loại đơn vị" required error={formState.errors.unitType?.message} htmlFor="o-type">
          <Select id="o-type" options={UNIT_TYPE_OPTIONS} placeholder="-- Chọn --" {...register('unitType')} />
        </Field>
        <Field label="Vùng" htmlFor="o-region">
          <Select id="o-region" options={REGION_OPTIONS} placeholder="-- Chọn --" {...register('regionCode')} />
        </Field>
        <Field label="Thứ tự" error={formState.errors.sortOrder?.message} htmlFor="o-sort">
          <Input id="o-sort" type="number" {...register('sortOrder')} />
        </Field>
        <div className="flex items-end pb-2">
          <Controller control={control} name="isKpiAssignable" render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} label="Giao KPI" />} />
        </div>
      </form>
    </Dialog>
  );
}
