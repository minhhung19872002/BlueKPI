import { useState } from 'react';
import { get } from '@/api/http';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { FilterItem, SearchBar } from '@/components/data-grid/SearchBar';
import { useListState } from '@/components/data-grid/useListState';
import { Select } from '@/components/ui/Input';
import { errorMessage, toast } from '@/components/ui/Toast';
import { codeName, RowActions } from '@/features/common/shared';
import { fmtNum } from '@/lib/format';
import { useHasPerm } from '@/stores/sessionStore';
import { AdjustDialog } from './AdjustDialog';
import { ResultDetailDrawer, ResultStatusBadge } from './common';
import { CURRENT_YEAR, PERIOD_OPTIONS, periodLabel, RESULT_STATUS, YEAR_OPTIONS } from './labels';
import type { Result, ResultDetail } from './types';

type Filter = { keyword: string; year: string; period: string; status: string };

/** 40.1–40.3, 41.1, 42.1 Tab “Theo dõi kết quả thẩm định và phản hồi” */
export function ReviewTab({ initialResultId }: { initialResultId?: number }) {
  const canAdjust = useHasPerm('EVAL:ADJUST');
  const canInput = useHasPerm('EVAL:INPUT');
  const list = useListState<Filter, Result>('eval-review', EP.evaluations.review, { keyword: '', year: String(CURRENT_YEAR), period: '', status: '' });
  const [view, setView] = useState<number | null>(initialResultId ?? null);
  const [edit, setEdit] = useState<{ id: number; mode: 'adjust' | 'manual' } | null>(null);

  const startEdit = async (r: Result) => {
    if (r.status === 'DV_DE_NGHI_DIEU_CHINH' && canAdjust) {
      setEdit({ id: r.id, mode: 'adjust' });
      return;
    }
    if (canInput) {
      try {
        const d = await get<ResultDetail>(EP.evaluations.result(r.id));
        if (d.canManual) {
          setEdit({ id: r.id, mode: 'manual' });
          return;
        }
      } catch (e) {
        toast.error(errorMessage(e));
        return;
      }
    }
    toast.error('Bản ghi không ở trạng thái cho phép chỉnh sửa');
  };

  return (
    <div>
      <SearchBar
        keyword={list.draft.keyword}
        onKeywordChange={(v) => list.set('keyword', v)}
        placeholder="Mã hoặc tên đơn vị, mã hoặc tên chỉ tiêu"
        onSearch={list.search}
        onReset={list.reset}
      >
        <FilterItem label="Năm" width="w-24">
          <Select aria-label="Năm" options={YEAR_OPTIONS} value={list.draft.year} onChange={(e) => list.set('year', e.target.value)} />
        </FilterItem>
        <FilterItem label="Kỳ đánh giá" width="w-40">
          <Select aria-label="Kỳ đánh giá" placeholder="Tất cả" options={PERIOD_OPTIONS} value={list.draft.period} onChange={(e) => list.set('period', e.target.value)} />
        </FilterItem>
        <FilterItem label="Trạng thái" width="w-48">
          <Select aria-label="Trạng thái" placeholder="Tất cả" options={RESULT_STATUS} value={list.draft.status} onChange={(e) => list.set('status', e.target.value)} />
        </FilterItem>
      </SearchBar>
      <h3 className="mb-2 text-sm font-semibold">Danh sách kết quả thẩm định</h3>
      <DataGrid<Result>
        title="Danh sách kết quả thẩm định"
        {...list.gridProps}
        rowKey={(r) => r.id}
        columns={[
          { key: 'orgUnitCode', header: 'Mã – Tên đơn vị', width: 180, render: (r) => codeName(r.orgUnitCode, r.orgUnitName) },
          { key: 'kpiCode', header: 'Mã – Tên chỉ tiêu KPI', width: 220, render: (r) => codeName(r.kpiCode, r.kpiName) },
          { key: 'weight', header: 'Trọng số', align: 'right', width: 70, render: (r) => fmtNum(r.weight, 2) },
          { key: 'planValue', header: 'Mục tiêu giao', align: 'right', width: 90, render: (r) => fmtNum(r.planValue, 2) },
          { key: 'finalResult', header: 'Kết quả', align: 'right', width: 90, render: (r) => fmtNum(r.finalResult, 2) },
          { key: 'score', header: 'Điểm', align: 'right', width: 60, render: (r) => fmtNum(r.score, 2) },
          { key: 'status', header: 'Trạng thái đánh giá', width: 130, render: (r) => <ResultStatusBadge status={r.status} /> },
          { key: 'periodCode', header: 'Kỳ đánh giá', width: 100, render: (r) => `${periodLabel(r.periodCode)} ${r.year}` },
          {
            key: 'actions',
            header: 'Thao tác',
            width: 110,
            render: (r) => (
              <RowActions
                actions={[
                  { label: 'Xem', onClick: () => setView(r.id) },
                  { label: 'Chỉnh sửa', onClick: () => startEdit(r), show: canAdjust || canInput },
                ]}
              />
            ),
          },
        ]}
      />
      {view !== null && <ResultDetailDrawer id={view} url={EP.evaluations.result} onClose={() => setView(null)} />}
      {edit && <AdjustDialog resultId={edit.id} mode={edit.mode} onClose={() => setEdit(null)} onSaved={() => list.query.refetch()} />}
    </div>
  );
}
