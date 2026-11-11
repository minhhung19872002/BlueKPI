import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { del, get, post } from '@/api/http';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { FilterItem, SearchBar } from '@/components/data-grid/SearchBar';
import { useListState } from '@/components/data-grid/useListState';
import { Button } from '@/components/ui/Button';
import { confirmDelete } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Input';
import { Badge, PageHeader } from '@/components/ui/Misc';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { errorMessage, toast } from '@/components/ui/Toast';
import { TreeSelect } from '@/components/ui/TreeSelect';
import { useUnitUsers } from '@/features/catalog/hooks';
import { codeName, handleSubmitError, RowActions, useOrgTree } from '@/features/common/shared';
import { fmtDateTime } from '@/lib/format';
import { useHasPerm } from '@/stores/sessionStore';
import { STRATEGY_STATUS, type Strategy } from '../types';

interface StageOpt {
  id: number;
  code: string;
  name: string;
  fromYear: number;
  toYear: number;
}

export const useStages = () => useQuery({ queryKey: ['stages'], queryFn: () => get<StageOpt[]>(EP.stages.list), staleTime: 300_000 });

const CUR = new Date().getFullYear();
const YEARS = Array.from({ length: 16 }, (_, i) => CUR - 6 + i).map((y) => ({ value: y, label: String(y) }));

export function StrategyStatusBadge({ status }: { status?: string }) {
  return <Badge color={status === 'HOAN_THANH' ? 'green' : 'blue'}>{STRATEGY_STATUS.find((s) => s.value === status)?.label ?? status}</Badge>;
}

type Filter = { keyword: string; ownerUserId: string; fromYear: string; toYear: string; status: string; orgUnitId: string };

/** 36.1–36.6 “Quản lý bản đồ chiến lược” */
export function StrategyListPage() {
  const navigate = useNavigate();
  const canCreate = useHasPerm('STRATEGY:CREATE');
  const canUpdate = useHasPerm('STRATEGY:UPDATE');
  const canDelete = useHasPerm('STRATEGY:DELETE');
  const org = useOrgTree();
  const owners = useQuery({ queryKey: ['users-options-all'], queryFn: () => get<{ id: number; fullName: string; username: string }[]>(EP.users_options), staleTime: 60_000 });
  const list = useListState<Filter, Strategy>('strategies', EP.strategies.list, { keyword: '', ownerUserId: '', fromYear: '', toYear: '', status: '', orgUnitId: '' });
  const [adding, setAdding] = useState(false);

  const remove = async (s: Strategy) => {
    if (!(await confirmDelete(`${s.code} – ${s.name}`, 'Bản đồ, liên kết và khung KPI của chiến lược cũng bị xóa.'))) return;
    try {
      await del(EP.strategies.one(s.id), { version: s.version });
      toast.success('Xóa thành công');
      list.query.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <PageHeader title="Quản lý bản đồ chiến lược" />
      <SearchBar
        keyword={list.draft.keyword}
        onKeywordChange={(v) => list.set('keyword', v)}
        placeholder="Mã hoặc tên chiến lược"
        onSearch={list.search}
        onReset={list.reset}
        actions={
          canCreate && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" />
              Thêm chiến lược
            </Button>
          )
        }
      >
        <FilterItem label="Chủ trì" width="w-44">
          <SearchSelect
            aria-label="Chủ trì"
            placeholder="Tất cả"
            options={(owners.data ?? []).map((u) => ({ value: u.id, label: u.fullName, sub: u.username }))}
            value={list.draft.ownerUserId ? Number(list.draft.ownerUserId) : null}
            onChange={(v) => list.set('ownerUserId', v == null ? '' : String(v))}
          />
        </FilterItem>
        <FilterItem label="Khoảng thời gian" width="w-48">
          <div className="flex items-center gap-1">
            <Select aria-label="Từ năm" placeholder="Từ năm" options={YEARS} value={list.draft.fromYear} onChange={(e) => list.set('fromYear', e.target.value)} />
            <span>–</span>
            <Select aria-label="Đến năm" placeholder="Đến năm" options={YEARS} value={list.draft.toYear} onChange={(e) => list.set('toYear', e.target.value)} />
          </div>
        </FilterItem>
        <FilterItem label="Trạng thái" width="w-36">
          <Select aria-label="Trạng thái" placeholder="Tất cả" options={STRATEGY_STATUS} value={list.draft.status} onChange={(e) => list.set('status', e.target.value)} />
        </FilterItem>
        <FilterItem label="Đơn vị" width="w-52">
          <TreeSelect
            aria-label="Đơn vị"
            placeholder="Tất cả"
            nodes={org.data ?? []}
            value={list.draft.orgUnitId ? Number(list.draft.orgUnitId) : null}
            onChange={(v) => list.set('orgUnitId', v == null ? '' : String(v))}
          />
        </FilterItem>
      </SearchBar>
      <h3 className="mb-2 text-sm font-semibold">Danh sách chiến lược</h3>
      <DataGrid<Strategy>
        title="Danh sách chiến lược"
        {...list.gridProps}
        rowKey={(r) => r.id}
        columns={[
          { key: 'code', header: 'Mã – Tên chiến lược', sortable: true, width: 300, render: (r) => codeName(r.code, r.name) },
          { key: 'stageName', header: 'Giai đoạn', sortable: true, width: 150 },
          { key: 'status', header: 'Trạng thái', sortable: true, width: 120, render: (r) => <StrategyStatusBadge status={r.status} /> },
          { key: 'ownerName', header: 'Chủ trì', sortable: true, width: 150 },
          { key: 'orgUnitName', header: 'Đơn vị', sortable: true, width: 170 },
          { key: 'updatedAt', header: 'Ngày cập nhật', sortable: true, width: 130, render: (r) => fmtDateTime(r.updatedAt) },
          {
            key: 'actions',
            header: 'Thao tác',
            width: 130,
            render: (r) => (
              <RowActions
                actions={[
                  { label: 'Xem', onClick: () => navigate({ to: '/kpi-admin/strategies/$id', params: { id: String(r.id) }, search: { mode: 'view' } }) },
                  { label: 'Sửa', onClick: () => navigate({ to: '/kpi-admin/strategies/$id', params: { id: String(r.id) } }), show: canUpdate && r.status === 'DANG_THUC_HIEN' },
                  { label: 'Xóa', onClick: () => remove(r), show: canDelete && r.status === 'DANG_THUC_HIEN', danger: true },
                ]}
              />
            ),
          },
        ]}
      />
      {adding && (
        <StrategyFormDialog
          onClose={() => setAdding(false)}
          onSaved={(s) => {
            setAdding(false);
            list.query.refetch();
            if (canUpdate) navigate({ to: '/kpi-admin/strategies/$id', params: { id: String(s.id) } });
          }}
        />
      )}
    </div>
  );
}

const schema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập Tên chiến lược').max(500, 'Tên chiến lược tối đa 500 ký tự'),
  stageId: z.custom<number | null>((v) => typeof v === 'number', 'Vui lòng chọn Giai đoạn'),
  orgUnitId: z.custom<number | null>((v) => typeof v === 'number', 'Vui lòng chọn Đơn vị'),
  ownerUserId: z.custom<number | null>((v) => typeof v === 'number', 'Vui lòng chọn Chủ trì'),
});
type FormValues = z.infer<typeof schema>;

/** 36.4 Dialog “Thêm chiến lược” */
function StrategyFormDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (s: Strategy) => void }) {
  const org = useOrgTree();
  const stages = useStages();
  const { register, control, handleSubmit, watch, setValue, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', stageId: null, orgUnitId: null, ownerUserId: null },
  });
  const unitId = watch('orgUnitId');
  const users = useUnitUsers(unitId);
  const e = formState.errors;
  const submit = handleSubmit(async (v) => {
    try {
      const r = await post<Strategy>(EP.strategies.list, v);
      toast.success(r.message || 'Thêm mới thành công');
      onSaved(r.data!);
    } catch (err) {
      handleSubmitError(err, setError);
    }
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Thêm chiến lược"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} loading={formState.isSubmitting}>
            Lưu
          </Button>
        </>
      }
    >
      <form className="space-y-3" onSubmit={submit}>
        <Field label="Tên chiến lược" required htmlFor="st-name" error={e.name?.message}>
          <Input id="st-name" {...register('name')} />
        </Field>
        <Field label="Giai đoạn" required htmlFor="st-stage" error={e.stageId?.message}>
          <Controller
            control={control}
            name="stageId"
            render={({ field }) => (
              <Select
                id="st-stage"
                placeholder="-- Chọn --"
                options={(stages.data ?? []).map((s) => ({ value: s.id, label: s.name }))}
                value={field.value ?? ''}
                onChange={(ev) => field.onChange(ev.target.value ? Number(ev.target.value) : null)}
              />
            )}
          />
        </Field>
        <Field label="Đơn vị" required htmlFor="st-unit" error={e.orgUnitId?.message}>
          <Controller
            control={control}
            name="orgUnitId"
            render={({ field }) => (
              <TreeSelect
                id="st-unit"
                aria-label="Đơn vị"
                nodes={org.data ?? []}
                value={field.value}
                onChange={(v) => {
                  field.onChange(v ?? null);
                  setValue('ownerUserId', null);
                }}
              />
            )}
          />
        </Field>
        <Field label="Chủ trì" required htmlFor="st-owner" error={e.ownerUserId?.message}>
          <Controller
            control={control}
            name="ownerUserId"
            render={({ field }) => (
              <SearchSelect
                id="st-owner"
                aria-label="Chủ trì"
                disabled={!unitId}
                placeholder={unitId ? 'Chọn…' : 'Chọn Đơn vị trước'}
                options={(users.data ?? []).map((u) => ({ value: u.id, label: u.fullName, sub: u.username }))}
                value={field.value}
                onChange={(v) => field.onChange(v ?? null)}
              />
            )}
          />
        </Field>
      </form>
    </Dialog>
  );
}
