import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { del, post, put } from '@/api/http';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { FilterItem, SearchBar } from '@/components/data-grid/SearchBar';
import { useListState } from '@/components/data-grid/useListState';
import { Button } from '@/components/ui/Button';
import { confirmDelete } from '@/components/ui/ConfirmDialog';
import { Dialog, Drawer } from '@/components/ui/Dialog';
import { Field, Input, ReadField, Select, Textarea } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Misc';
import { errorMessage, toast } from '@/components/ui/Toast';
import { auditColumns, handleSubmitError, labelOf, RowActions, Section } from '@/features/common/shared';
import { fmtDateTime } from '@/lib/format';
import { useHasPerm } from '@/stores/sessionStore';

interface ConfigRow {
  id: number;
  configKey: string;
  configValue: string;
  dataType: string;
  configGroup?: string;
  description?: string;
  isSecret: boolean;
  isCore: boolean;
  version: number;
  updatedBy?: string;
  updatedAt?: string;
}
const TYPES = [
  { value: 'STRING', label: 'Chuỗi' },
  { value: 'NUMBER', label: 'Số' },
  { value: 'BOOLEAN', label: 'Đúng/Sai' },
  { value: 'JSON', label: 'JSON' },
];

/** 26.20–26.24 Tham số hệ thống */
export function SysConfigTab() {
  const canCreate = useHasPerm('SYSCONFIG:CREATE');
  const canUpdate = useHasPerm('SYSCONFIG:UPDATE');
  const canDelete = useHasPerm('SYSCONFIG:DELETE');
  const list = useListState<{ keyword: string; dataType: string }, ConfigRow>('sys-configs', EP.sysConfigs.list, { keyword: '', dataType: '' });
  const [form, setForm] = useState<{ open: boolean; row?: ConfigRow }>({ open: false });
  const [view, setView] = useState<ConfigRow | null>(null);
  const remove = async (r: ConfigRow) => {
    if (!(await confirmDelete(r.configKey))) return;
    try {
      await del(EP.sysConfigs.one(r.id), { version: r.version });
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
        placeholder="Mã tham số hoặc mô tả"
        onSearch={list.search}
        onReset={list.reset}
        actions={
          canCreate && (
            <Button onClick={() => setForm({ open: true })}>
              <Plus className="h-4 w-4" />
              Thêm tham số
            </Button>
          )
        }
      >
        <FilterItem label="Kiểu dữ liệu" width="w-40">
          <Select aria-label="Kiểu dữ liệu" options={TYPES} placeholder="Tất cả" value={list.draft.dataType} onChange={(e) => list.set('dataType', e.target.value)} />
        </FilterItem>
      </SearchBar>
      <h3 className="mb-2 text-sm font-semibold">Danh sách tham số hệ thống</h3>
      <DataGrid<ConfigRow>
        title="Danh sách tham số hệ thống"
        {...list.gridProps}
        rowKey={(r) => r.id}
        columns={[
          { key: 'configKey', header: 'Mã tham số', sortable: true, width: 220, render: (r) => <code className="text-xs">{r.configKey}</code> },
          { key: 'configValue', header: 'Giá trị', width: 200, render: (r) => <span className="break-all">{r.configValue}</span> },
          { key: 'dataType', header: 'Kiểu dữ liệu', sortable: true, width: 100, render: (r) => labelOf(TYPES, r.dataType) },
          { key: 'configGroup', header: 'Nhóm', sortable: true, width: 110 },
          { key: 'description', header: 'Mô tả' },
          ...auditColumns<ConfigRow>({ created: false }),
          {
            key: 'actions',
            header: 'Thao tác',
            width: 120,
            render: (r) => (
              <RowActions
                actions={[
                  { label: 'Xem', onClick: () => setView(r) },
                  { label: 'Sửa', onClick: () => setForm({ open: true, row: r }), show: canUpdate },
                  { label: 'Xóa', onClick: () => remove(r), show: canDelete && !r.isCore, danger: true },
                ]}
              />
            ),
          },
        ]}
      />
      {form.open && <ConfigForm row={form.row} onClose={() => setForm({ open: false })} onSaved={() => list.query.refetch()} />}
      {view && (
        <Drawer open onOpenChange={(o) => !o && setView(null)} title="Thông tin tham số hệ thống">
          <Section title="Thông tin chung">
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="Mã tham số" value={view.configKey} />
              <ReadField label="Giá trị" value={view.configValue} />
              <ReadField label="Kiểu dữ liệu" value={labelOf(TYPES, view.dataType)} />
              <ReadField label="Nhóm" value={view.configGroup} />
              <ReadField label="Tham số lõi" value={view.isCore ? 'Có' : 'Không'} />
              <ReadField label="Bí mật" value={view.isSecret ? 'Có' : 'Không'} />
              <ReadField label="Mô tả" value={view.description} className="col-span-2" />
              <ReadField label="Người cập nhật" value={view.updatedBy} />
              <ReadField label="Ngày cập nhật" value={fmtDateTime(view.updatedAt)} />
            </div>
          </Section>
        </Drawer>
      )}
    </div>
  );
}

const schema = z
  .object({
    configKey: z.string().trim().min(1, 'Vui lòng nhập Mã tham số').regex(/^[A-Z0-9_]+$/, 'Mã tham số chỉ gồm chữ in hoa, số và dấu gạch dưới'),
    configValue: z.string().trim().min(1, 'Vui lòng nhập Giá trị'),
    dataType: z.string().min(1, 'Vui lòng chọn Kiểu dữ liệu'),
    configGroup: z.string().optional(),
    description: z.string().optional(),
    isSecret: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const t = v.configValue.trim();
    if (v.dataType === 'NUMBER' && t !== '********' && Number.isNaN(Number(t))) ctx.addIssue({ code: 'custom', path: ['configValue'], message: 'Giá trị phải là số' });
    if (v.dataType === 'BOOLEAN' && !['true', 'false'].includes(t.toLowerCase())) ctx.addIssue({ code: 'custom', path: ['configValue'], message: 'Giá trị phải là true hoặc false' });
    if (v.dataType === 'JSON') {
      try {
        JSON.parse(t);
      } catch {
        ctx.addIssue({ code: 'custom', path: ['configValue'], message: 'Giá trị phải là JSON hợp lệ' });
      }
    }
  });

function ConfigForm({ row, onClose, onSaved }: { row?: ConfigRow; onClose: () => void; onSaved: () => void }) {
  const { register, handleSubmit, formState, control, setError } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      configKey: row?.configKey ?? '',
      configValue: row?.configValue ?? '',
      dataType: row?.dataType ?? 'STRING',
      configGroup: row?.configGroup ?? '',
      description: row?.description ?? '',
      isSecret: row?.isSecret ?? false,
    },
  });
  const onSubmit = async (v: z.output<typeof schema>) => {
    try {
      const body = { ...v, version: row?.version };
      if (row) {
        await put(EP.sysConfigs.one(row.id), body);
        toast.success('Cập nhật thành công');
      } else {
        await post(EP.sysConfigs.list, body);
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
      title={row ? 'Sửa tham số' : 'Thêm tham số'}
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
        <Field label="Mã tham số" required error={formState.errors.configKey?.message} htmlFor="c-key">
          <Input id="c-key" disabled={!!row} {...register('configKey')} />
        </Field>
        <Field label="Kiểu dữ liệu" required error={formState.errors.dataType?.message} htmlFor="c-type">
          <Select id="c-type" options={TYPES} {...register('dataType')} />
        </Field>
        <Field label="Giá trị" required error={formState.errors.configValue?.message} className="col-span-2" htmlFor="c-value">
          <Textarea id="c-value" rows={2} {...register('configValue')} />
        </Field>
        <Field label="Nhóm" htmlFor="c-group">
          <Input id="c-group" {...register('configGroup')} />
        </Field>
        <div className="flex items-end pb-2">
          <Controller control={control} name="isSecret" render={({ field }) => <Checkbox checked={field.value} onCheckedChange={field.onChange} label="Giá trị bí mật (che khi hiển thị)" />} />
        </div>
        <Field label="Mô tả" className="col-span-2" htmlFor="c-desc">
          <Textarea id="c-desc" {...register('description')} />
        </Field>
      </form>
    </Dialog>
  );
}
