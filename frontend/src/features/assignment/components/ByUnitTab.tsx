import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Lock, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { del, get, post } from '@/api/http';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { FilterItem, SearchBar } from '@/components/data-grid/SearchBar';
import { useListState } from '@/components/data-grid/useListState';
import { ExportButton } from '@/components/import-export/ExportButton';
import { Button } from '@/components/ui/Button';
import { confirmDelete } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, ReadField, Select } from '@/components/ui/Input';
import { errorMessage, toast } from '@/components/ui/Toast';
import { RowActions } from '@/features/common/shared';
import { fmtDateTime } from '@/lib/format';
import { useHasPerm } from '@/stores/sessionStore';
import { ASSIGN_STATUS, CloseResultDialog, CopyResultBox, CUR_YEAR, runClose, StatusBadge, yearOptions, type AssignHeader, type CloseResult, type CopyResult } from './common';

/** 29.1–29.5, 31.1 Tab “Danh sách giao KPI theo đơn vị” */
export function ByUnitTab() {
  const navigate = useNavigate();
  const canCreate = useHasPerm('ASSIGN:CREATE');
  const canUpdate = useHasPerm('ASSIGN:UPDATE');
  const canDelete = useHasPerm('ASSIGN:DELETE');
  const canCopy = useHasPerm('ASSIGN:COPY');
  const canClose = useHasPerm('ASSIGN:CLOSE');
  const canExport = useHasPerm('ASSIGN:EXPORT');
  const list = useListState<{ keyword: string; year: string; status: string }, AssignHeader>('assign-by-unit', EP.assignByUnit.list, {
    keyword: '',
    year: String(CUR_YEAR),
    status: '',
  });
  const [selected, setSelected] = useState<(string | number)[]>([]);
  const [closeRes, setCloseRes] = useState<CloseResult | null>(null);
  const [copySrc, setCopySrc] = useState<AssignHeader | null>(null);
  const refresh = () => list.query.refetch();

  const remove = async (r: AssignHeader) => {
    if (!(await confirmDelete(`${r.orgUnitName} – ${r.year}`))) return;
    try {
      await del(EP.assignByUnit.one(r.id));
      toast.success('Xóa thành công');
      setSelected((s) => s.filter((x) => x !== r.id));
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const close = async () => {
    await runClose(EP.assignByUnit.close, { ids: selected }, selected.length, setCloseRes);
    setSelected([]);
    refresh();
  };

  return (
    <div>
      <SearchBar
        keyword={list.draft.keyword}
        onKeywordChange={(v) => list.set('keyword', v)}
        placeholder="Tên hoặc mã đơn vị"
        onSearch={list.search}
        onReset={list.reset}
        actions={
          <>
            {canCreate && (
              <Button onClick={() => navigate({ to: '/kpi-admin/assignments/unit/$id', params: { id: 'new' } })}>
                <Plus className="h-4 w-4" />
                Thêm mới
              </Button>
            )}
            {canClose && (
              <Button variant="secondary" disabled={!selected.length} onClick={close}>
                <Lock className="h-4 w-4" />
                Chốt số liệu giao KPI
              </Button>
            )}
            {canExport && <ExportButton url={EP.assignByUnit.export} params={list.exportParams} />}
          </>
        }
      >
        <FilterItem label="Năm" width="w-28">
          <Select aria-label="Năm" placeholder="Tất cả" options={yearOptions()} value={list.draft.year} onChange={(e) => list.set('year', e.target.value)} />
        </FilterItem>
        <FilterItem label="Trạng thái" width="w-40">
          <Select aria-label="Trạng thái" placeholder="Tất cả" options={ASSIGN_STATUS} value={list.draft.status} onChange={(e) => list.set('status', e.target.value)} />
        </FilterItem>
      </SearchBar>
      <h3 className="mb-2 text-sm font-semibold">Danh sách giao KPI theo đơn vị</h3>
      <DataGrid<AssignHeader>
        title="Danh sách giao KPI theo đơn vị"
        {...list.gridProps}
        rowKey={(r) => r.id}
        selectable={canClose}
        selected={selected}
        onSelectedChange={setSelected}
        isRowSelectable={(r) => r.status === 'DANG_SOAN'}
        columns={[
          { key: 'orgUnitName', header: 'Đơn vị được giao', sortable: true, width: 260, render: (r) => r.orgUnitName },
          { key: 'year', header: 'Năm', sortable: true, width: 70, align: 'center' },
          { key: 'createdAt', header: 'Ngày tạo', sortable: true, width: 130, render: (r) => fmtDateTime(r.createdAt) },
          { key: 'updatedAt', header: 'Ngày cập nhật', sortable: true, width: 130, render: (r) => fmtDateTime(r.updatedAt) },
          { key: 'status', header: 'Trạng thái', sortable: true, width: 110, render: (r) => <StatusBadge status={r.status} /> },
          {
            key: 'actions',
            header: 'Thao tác',
            width: 170,
            render: (r) => (
              <RowActions
                actions={[
                  { label: 'Xem', onClick: () => navigate({ to: '/kpi-admin/assignments/unit/$id', params: { id: String(r.id) }, search: { mode: 'view' } }) },
                  { label: 'Sửa', onClick: () => navigate({ to: '/kpi-admin/assignments/unit/$id', params: { id: String(r.id) } }), show: canUpdate && r.status === 'DANG_SOAN' },
                  { label: 'Xóa', onClick: () => remove(r), show: canDelete && r.status === 'DANG_SOAN', danger: true },
                  { label: 'Sao chép', onClick: () => setCopySrc(r), show: canCopy },
                ]}
              />
            ),
          },
        ]}
      />
      <CloseResultDialog result={closeRes} onClose={() => setCloseRes(null)} />
      {copySrc && <CopyByUnitDialog src={copySrc} onClose={() => setCopySrc(null)} onDone={refresh} />}
    </div>
  );
}

interface CopyTarget {
  id: number;
  code: string;
  name: string;
  parentId: number | null;
  unitType: string;
  unitGroup: string;
  assignStatus: string | null;
  assignStatusName: string;
  children?: CopyTarget[];
}

/** 29.5 Dialog “Sao chép giao KPI theo đơn vị” */
function CopyByUnitDialog({ src, onClose, onDone }: { src: AssignHeader; onClose: () => void; onDone: () => void }) {
  const [targetYear, setTargetYear] = useState(String(src.year + 1));
  const [kw, setKw] = useState('');
  const [selected, setSelected] = useState<(string | number)[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<CopyResult | null>(null);
  const targets = useQuery({
    queryKey: ['assign-copy-targets', src.id, targetYear],
    queryFn: () => get<CopyTarget[]>(EP.assignByUnit.copyTargets(src.id), { targetYear }),
    enabled: !!targetYear,
  });

  const tree = useMemo(() => {
    const flat = targets.data ?? [];
    const k = kw.trim().toLowerCase();
    if (k) return flat.filter((t) => t.name.toLowerCase().includes(k) || t.code.toLowerCase().includes(k)).map((t) => ({ ...t, children: undefined }));
    const byId = new Map<number, CopyTarget>(flat.map((t) => [t.id, { ...t, children: [] }]));
    const roots: CopyTarget[] = [];
    for (const t of byId.values()) {
      const p = t.parentId != null ? byId.get(t.parentId) : undefined;
      if (p) p.children!.push(t);
      else roots.push(t);
    }
    return roots;
  }, [targets.data, kw]);

  const submit = async () => {
    setErr(null);
    if (!targetYear) return setErr('Vui lòng chọn Năm giao đích');
    if (!selected.length) return setErr('Vui lòng chọn đơn vị nhận bản sao');
    setBusy(true);
    try {
      const r = await post<CopyResult>(EP.assignByUnit.copy(src.id), { targetYear: Number(targetYear), targetUnitIds: selected });
      const d = r.data!;
      toast.success(r.message || d.message);
      setResult(d);
      setSelected([]);
      targets.refetch();
      onDone();
      if (!d.skipped.length) onClose();
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
      title="Sao chép giao KPI theo đơn vị"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button onClick={submit} loading={busy}>
            Xác nhận
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <ReadField label="Đơn vị nguồn" value={src.orgUnitName} />
          <ReadField label="Năm giao nguồn" value={src.year} />
          <Field label="Năm giao đích" required htmlFor="cp-year" error={err && !targetYear ? err : undefined}>
            <Select id="cp-year" options={yearOptions(src.year + 1)} value={targetYear} onChange={(e) => setTargetYear(e.target.value)} />
          </Field>
        </div>
        <Input placeholder="Tìm theo mã hoặc tên đơn vị" aria-label="Tìm theo mã hoặc tên đơn vị" value={kw} onChange={(e) => setKw(e.target.value)} />
        <DataGrid<CopyTarget>
          key={kw ? 'flat' : 'tree'}
          title="Đơn vị nhận bản sao"
          rows={tree}
          loading={targets.isFetching}
          rowKey={(r) => r.id}
          getChildren={kw ? undefined : (r) => r.children}
          defaultExpandAll
          pagination={false}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          maxHeight="max-h-80"
          columns={[
            { key: 'name', header: 'Đơn vị nhận bản sao', width: 300, render: (r) => r.name },
            { key: 'assignStatusName', header: 'Trạng thái giao', width: 120, render: (r) => (r.assignStatus ? <StatusBadge status={r.assignStatus} /> : r.assignStatusName) },
            { key: 'unitGroup', header: 'Nhóm đơn vị', width: 150 },
          ]}
        />
        <p className="text-[13px] text-amber-700">Đơn vị đích đã có bản “Đang soạn” sẽ bị ghi đè; đơn vị “Đã giao” sẽ được bỏ qua.</p>
        {err && <p className="field-error">{err}</p>}
        <CopyResultBox result={result} />
      </div>
    </Dialog>
  );
}
