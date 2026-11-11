import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Copy, Lock, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { get, post } from '@/api/http';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { FilterItem, SearchBar } from '@/components/data-grid/SearchBar';
import { useListState } from '@/components/data-grid/useListState';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Input';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { errorMessage, toast } from '@/components/ui/Toast';
import { labelOf, RowActions, UNIT_TYPE_OPTIONS } from '@/features/common/shared';
import { useKpiOptions, usePerspectives } from '@/features/catalog/hooks';
import { fmtDateTime } from '@/lib/format';
import { useHasPerm } from '@/stores/sessionStore';
import { ApiError } from '@/api/http';
import {
  ASSIGN_STATUS,
  CloseResultDialog,
  CopyResultBox,
  CUR_YEAR,
  flattenOrgs,
  runClose,
  StatusBadge,
  useAssignableOrgs,
  yearOptions,
  type CloseResult,
  type CopyResult,
} from './common';

export interface ByKpiRow {
  key: string;
  kpiId: number;
  kpiCode: string;
  kpiName: string;
  parentKpiId: number | null;
  perspectiveName?: string;
  perspectiveColor?: string;
  unitOfMeasureName?: string;
  assigningUnitName?: string;
  year: number;
  unitCount: number;
  status: string;
  updatedAt?: string;
  children?: ByKpiRow[];
}

/** 31.2, 32.1–32.4 Tab “Danh sách giao KPI theo chỉ tiêu” */
export function ByKpiTab() {
  const navigate = useNavigate();
  const canCreate = useHasPerm('ASSIGN:CREATE');
  const canUpdate = useHasPerm('ASSIGN:UPDATE');
  const canCopy = useHasPerm('ASSIGN:COPY');
  const canClose = useHasPerm('ASSIGN:CLOSE');
  const canAdjust = useHasPerm('ASSIGN:ADJUST');
  const perspectives = usePerspectives();
  const list = useListState<{ keyword: string; year: string; perspectiveId: string; status: string }, ByKpiRow>('assign-by-kpi', EP.assignByKpi.list, {
    keyword: '',
    year: String(CUR_YEAR),
    perspectiveId: '',
    status: '',
  });
  const [selected, setSelected] = useState<(string | number)[]>([]);
  const [closeRes, setCloseRes] = useState<CloseResult | null>(null);
  const [copy, setCopy] = useState(false);
  const refresh = () => list.query.refetch();
  const searching = !!list.applied.keyword;

  const close = async () => {
    const keys = selected.map((k) => {
      const [kpiId, year] = String(k).split('-');
      return { kpiId: Number(kpiId), year: Number(year) };
    });
    await runClose(EP.assignByKpi.close, { keys }, keys.length, setCloseRes);
    setSelected([]);
    refresh();
  };

  return (
    <div>
      <SearchBar
        keyword={list.draft.keyword}
        onKeywordChange={(v) => list.set('keyword', v)}
        placeholder="Mã hoặc tên tiêu chí"
        onSearch={list.search}
        onReset={list.reset}
        actions={
          <>
            {canCreate && (
              <Button onClick={() => navigate({ to: '/kpi-admin/assignments/kpi/$kpiId/$year', params: { kpiId: 'new', year: 'new' } })}>
                <Plus className="h-4 w-4" />
                Thêm mới
              </Button>
            )}
            {canCopy && (
              <Button variant="outline" onClick={() => setCopy(true)}>
                <Copy className="h-4 w-4" />
                Sao chép
              </Button>
            )}
            {canClose && (
              <Button variant="secondary" disabled={!selected.length} onClick={close}>
                <Lock className="h-4 w-4" />
                Chốt số liệu giao KPI
              </Button>
            )}
          </>
        }
      >
        <FilterItem label="Năm" width="w-28">
          <Select aria-label="Năm" placeholder="Tất cả" options={yearOptions()} value={list.draft.year} onChange={(e) => list.set('year', e.target.value)} />
        </FilterItem>
        <FilterItem label="Viễn cảnh" width="w-44">
          <Select
            aria-label="Viễn cảnh"
            placeholder="Tất cả"
            options={(perspectives.data ?? []).map((p) => ({ value: p.id, label: `${p.code} – ${p.name}` }))}
            value={list.draft.perspectiveId}
            onChange={(e) => list.set('perspectiveId', e.target.value)}
          />
        </FilterItem>
        <FilterItem label="Trạng thái" width="w-40">
          <Select aria-label="Trạng thái" placeholder="Tất cả" options={ASSIGN_STATUS} value={list.draft.status} onChange={(e) => list.set('status', e.target.value)} />
        </FilterItem>
      </SearchBar>
      <h3 className="mb-2 text-sm font-semibold">Danh sách giao KPI theo chỉ tiêu</h3>
      <DataGrid<ByKpiRow>
        key={searching ? 'expanded' : 'collapsed'}
        title="Danh sách giao KPI theo chỉ tiêu"
        {...list.gridProps}
        rowKey={(r) => r.key}
        getChildren={(r) => r.children}
        defaultExpandAll={searching}
        selectable={canClose}
        selected={selected}
        onSelectedChange={setSelected}
        isRowSelectable={(r) => r.status === 'DANG_SOAN'}
        columns={[
          {
            key: 'kpiCode',
            header: 'Mã – Tên tiêu chí KPI',
            sortable: true,
            width: 300,
            render: (r) => (
              <span>
                <b>{r.kpiCode}</b> – {r.kpiName}
              </span>
            ),
          },
          { key: 'unitCount', header: 'Số đơn vị được giao', sortable: true, width: 90, align: 'right' },
          {
            key: 'perspectiveName',
            header: 'Viễn cảnh',
            width: 130,
            render: (r) => (
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.perspectiveColor }} />
                {r.perspectiveName}
              </span>
            ),
          },
          { key: 'updatedAt', header: 'Ngày cập nhật', sortable: true, width: 125, render: (r) => fmtDateTime(r.updatedAt) },
          { key: 'status', header: 'Trạng thái', width: 105, render: (r) => <StatusBadge status={r.status} /> },
          { key: 'year', header: 'Năm', sortable: true, width: 60, align: 'center' },
          { key: 'assigningUnitName', header: 'Đơn vị giao', width: 140 },
          {
            key: 'actions',
            header: 'Thao tác',
            width: 150,
            render: (r) => (
              <RowActions
                actions={[
                  {
                    label: 'Xem',
                    onClick: () => navigate({ to: '/kpi-admin/assignments/kpi/$kpiId/$year', params: { kpiId: String(r.kpiId), year: String(r.year) }, search: { mode: 'view' } }),
                  },
                  {
                    label: 'Sửa',
                    onClick: () => navigate({ to: '/kpi-admin/assignments/kpi/$kpiId/$year', params: { kpiId: String(r.kpiId), year: String(r.year) } }),
                    show: canUpdate && r.status === 'DANG_SOAN',
                  },
                  {
                    label: 'Điều chỉnh',
                    onClick: () => navigate({ to: '/kpi-admin/assignments/kpi/$kpiId/$year/adjust', params: { kpiId: String(r.kpiId), year: String(r.year) } }),
                    show: canAdjust && (r.status === 'DA_GIAO' || r.status === 'DA_DIEU_CHINH'),
                  },
                ]}
              />
            ),
          },
        ]}
      />
      <CloseResultDialog result={closeRes} onClose={() => setCloseRes(null)} />
      {copy && <CopyByKpiDialog onClose={() => setCopy(false)} onDone={refresh} />}
    </div>
  );
}

/** 32.4 Dialog “Sao chép chỉ tiêu giao KPI” */
function CopyByKpiDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [kpiId, setKpiId] = useState<number | null>(null);
  const [year, setYear] = useState(String(CUR_YEAR));
  const [sourceUnitId, setSourceUnitId] = useState('');
  const [kw, setKw] = useState('');
  const [selected, setSelected] = useState<(string | number)[]>([]);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CopyResult | null>(null);
  const kpis = useKpiOptions({ rootOnly: true });
  const orgs = useAssignableOrgs();
  const sources = useQuery({
    queryKey: ['assign-copy-sources', kpiId, year],
    queryFn: () => get<{ orgUnitId: number; orgUnitName: string; status: string }[]>(EP.assignByKpi.copySources, { kpiId, year }),
    enabled: !!kpiId && !!year,
  });
  const units = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return flattenOrgs(orgs.data)
      .filter((o) => o.isKpiAssignable !== false)
      .filter((o) => String(o.id) !== sourceUnitId)
      .filter((o) => !k || o.name.toLowerCase().includes(k) || o.code.toLowerCase().includes(k));
  }, [orgs.data, kw, sourceUnitId]);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!kpiId) e.kpiId = 'Vui lòng chọn Sao chép KPI';
    if (!year) e.year = 'Vui lòng chọn Năm';
    if (!sourceUnitId) e.sourceUnitId = 'Vui lòng chọn đơn vị sao chép';
    if (!selected.length) e.targetUnitIds = 'Vui lòng chọn đơn vị được sao chép';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const r = await post<CopyResult>(EP.assignByKpi.copy, { kpiId, year: Number(year), sourceUnitId: Number(sourceUnitId), targetUnitIds: selected });
      const d = r.data!;
      toast.success(r.message || d.message);
      setResult(d);
      setSelected([]);
      onDone();
      if (!d.skipped.length) onClose();
    } catch (er) {
      if (er instanceof ApiError && er.fieldErrors.length) setErrs(Object.fromEntries(er.fieldErrors.map((f) => [f.field, f.message])));
      toast.error(errorMessage(er));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Sao chép chỉ tiêu giao KPI"
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
          <Field label="Sao chép KPI" required error={errs.kpiId}>
            <SearchSelect
              aria-label="Sao chép KPI"
              options={(kpis.data ?? []).map((k) => ({ value: k.id, label: `${k.code} – ${k.name}`, sub: k.perspectiveName }))}
              value={kpiId}
              onChange={(v) => {
                setKpiId(v);
                setSourceUnitId('');
              }}
            />
          </Field>
          <Field label="Năm" required error={errs.year} htmlFor="cpk-year">
            <Select
              id="cpk-year"
              options={yearOptions()}
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                setSourceUnitId('');
              }}
            />
          </Field>
          <Field label="Chọn đơn vị sao chép" error={errs.sourceUnitId} htmlFor="cpk-src">
            <Select
              id="cpk-src"
              aria-label="Chọn đơn vị sao chép"
              placeholder="-- Chọn --"
              options={(sources.data ?? []).map((s) => ({ value: s.orgUnitId, label: s.orgUnitName }))}
              value={sourceUnitId}
              onChange={(e) => setSourceUnitId(e.target.value)}
            />
          </Field>
        </div>
        <Input placeholder="Tìm theo mã hoặc tên đơn vị" aria-label="Tìm theo mã hoặc tên đơn vị" value={kw} onChange={(e) => setKw(e.target.value)} />
        <DataGrid
          title="Đơn vị được sao chép"
          rows={units}
          loading={orgs.isFetching}
          rowKey={(r) => r.id}
          pagination={false}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          maxHeight="max-h-72"
          columns={[
            { key: 'name', header: 'Đơn vị được sao chép', width: 320 },
            { key: 'unitType', header: 'Nhóm đơn vị', width: 160, render: (r) => labelOf(UNIT_TYPE_OPTIONS, r.unitType) },
          ]}
        />
        {errs.targetUnitIds && <p className="field-error">{errs.targetUnitIds}</p>}
        <CopyResultBox result={result} />
      </div>
    </Dialog>
  );
}
