import { useNavigate } from '@tanstack/react-router';
import { post } from '@/api/http';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { FilterItem, SearchBar } from '@/components/data-grid/SearchBar';
import { useListState } from '@/components/data-grid/useListState';
import { confirm } from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Misc';
import { errorMessage, toast } from '@/components/ui/Toast';
import { usePerspectives } from '@/features/catalog/hooks';
import { RowActions } from '@/features/common/shared';
import { useHasPerm } from '@/stores/sessionStore';
import { CURRENT_YEAR, EVAL_KPI_STATUS, evalKpiStatusColor, lbl, PERIOD_OPTIONS, periodLabel, RESULT_TYPE_OPTIONS, YEAR_OPTIONS } from './labels';
import type { EvalKpi } from './types';

type Filter = { keyword: string; year: string; period: string; perspectiveId: string; status: string; resultType: string };

/** 39.1/39.2/39.3/49.1 Tab “Tổng hợp BSC theo chỉ tiêu KPI” */
export function ByKpiTab() {
  const canInput = useHasPerm('EVAL:INPUT');
  const canClose = useHasPerm('EVAL:CLOSE_R2');
  const navigate = useNavigate();
  const perspectives = usePerspectives();
  const list = useListState<Filter, EvalKpi>('eval-by-kpi', EP.evaluations.byKpi, {
    keyword: '',
    year: String(CURRENT_YEAR),
    period: '',
    perspectiveId: '',
    status: '',
    resultType: '',
  });

  const open = (r: EvalKpi, view: boolean) =>
    navigate({ to: '/kpi-admin/evaluations/$evalKpiId', params: { evalKpiId: String(r.id) }, search: view ? { mode: 'view' } : {} });

  const closeR2 = async (r: EvalKpi) => {
    const ok = await confirm({
      title: 'Chốt kết quả R2',
      message: `Xác nhận chốt kết quả R2 cho tiêu chí ${r.kpiCode} – ${r.kpiName} kỳ ${periodLabel(r.periodCode)} năm ${r.year}? Sau khi chốt sẽ không cho phép đánh giá lại.`,
      confirmText: 'Xác nhận',
    });
    if (!ok) return;
    try {
      const res = await post(EP.evaluations.closeR2(r.id));
      toast.success(res.message || 'Chốt kết quả R2 thành công');
      list.query.refetch();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <div>
      <SearchBar keyword={list.draft.keyword} onKeywordChange={(v) => list.set('keyword', v)} placeholder="Mã hoặc tên tiêu chí" onSearch={list.search} onReset={list.reset}>
        <FilterItem label="Năm" width="w-24">
          <Select aria-label="Năm" options={YEAR_OPTIONS} value={list.draft.year} onChange={(e) => list.set('year', e.target.value)} />
        </FilterItem>
        <FilterItem label="Kỳ đánh giá" width="w-40">
          <Select aria-label="Kỳ đánh giá" placeholder="Tất cả" options={PERIOD_OPTIONS} value={list.draft.period} onChange={(e) => list.set('period', e.target.value)} />
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
        <FilterItem label="Trạng thái" width="w-44">
          <Select aria-label="Trạng thái" placeholder="Tất cả" options={EVAL_KPI_STATUS} value={list.draft.status} onChange={(e) => list.set('status', e.target.value)} />
        </FilterItem>
        <FilterItem label="Loại kết quả" width="w-32">
          <Select aria-label="Loại kết quả" placeholder="Tất cả" options={RESULT_TYPE_OPTIONS} value={list.draft.resultType} onChange={(e) => list.set('resultType', e.target.value)} />
        </FilterItem>
      </SearchBar>
      <h3 className="mb-2 text-sm font-semibold">Tổng hợp BSC theo chỉ tiêu KPI</h3>
      <DataGrid<EvalKpi>
        title="Tổng hợp BSC theo chỉ tiêu KPI"
        {...list.gridProps}
        rowKey={(r) => r.id}
        columns={[
          {
            key: 'kpiCode',
            header: 'Mã – Tên tiêu chí KPI',
            width: 260,
            render: (r) => (
              <span>
                <b>{r.kpiCode}</b> – {r.kpiName}
              </span>
            ),
          },
          {
            key: 'perspectiveName',
            header: 'Viễn cảnh',
            width: 120,
            render: (r) => (
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.perspectiveColor }} />
                {r.perspectiveName}
              </span>
            ),
          },
          { key: 'unitOfMeasureName', header: 'Đơn vị đo', width: 80 },
          { key: 'status', header: 'Tình trạng', width: 120, render: (r) => <Badge color={evalKpiStatusColor(r.status)}>{lbl(EVAL_KPI_STATUS, r.status)}</Badge> },
          { key: 'periodCode', header: 'Kỳ đánh giá', width: 110, render: (r) => `${periodLabel(r.periodCode)} ${r.year}` },
          { key: 'resultType', header: 'Loại kết quả', width: 90, render: (r) => lbl(RESULT_TYPE_OPTIONS, r.resultType ?? r.dataSource) },
          { key: 'assigningUnitName', header: 'Đơn vị giao', width: 130 },
          {
            key: 'actions',
            header: 'Thao tác',
            width: 150,
            render: (r) => (
              <RowActions
                actions={[
                  { label: 'Xem', onClick: () => open(r, true) },
                  { label: 'Đánh giá', onClick: () => open(r, false), show: canInput && r.status !== 'CHOT_KQ_R2' },
                  { label: 'Chốt kết quả R2', onClick: () => closeR2(r), show: canClose && r.status !== 'CHOT_KQ_R2' },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
