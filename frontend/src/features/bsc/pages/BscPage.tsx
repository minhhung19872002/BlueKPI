import { useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { EP } from '@/api/endpoints';
import { DataGrid } from '@/components/data-grid/DataGrid';
import { FilterItem, SearchBar } from '@/components/data-grid/SearchBar';
import { useListState } from '@/components/data-grid/useListState';
import { Select } from '@/components/ui/Input';
import { PageHeader, Tabs } from '@/components/ui/Misc';
import { usePerspectives } from '@/features/catalog/hooks';
import { codeName, RowActions } from '@/features/common/shared';
import { ResultDetailDrawer, ResultStatusBadge } from '@/features/evaluation/components/common';
import { CURRENT_YEAR, PERIOD_OPTIONS, periodLabel, RESULT_STATUS, RESULT_TYPE_OPTIONS, YEAR_OPTIONS } from '@/features/evaluation/components/labels';
import type { Result } from '@/features/evaluation/components/types';
import { fmtNum } from '@/lib/format';
import { useHasPerm } from '@/stores/sessionStore';
import { BscToolbar, RevokeDialog, useBscRefresh, ViewChoiceDialog } from '../components/common';

/** Có kết quả để thu hồi (chưa TGĐ duyệt) */
const REVOCABLE = ['DA_CO_KQ', 'DA_XU_LY_DIEU_CHINH', 'CHOT_DANH_GIA', 'DV_DE_NGHI_DIEU_CHINH'];

/** 46–53 “Tổng hợp kết quả BSC”: hai tab “Tổng hợp kết quả BSC” và “Theo dõi kết quả thẩm định và phản hồi” */
export function BscPage() {
  const search = useSearch({ strict: false }) as { tab?: string; year?: number; period?: string };
  const navigate = useNavigate();
  const active = search.tab === 'review' ? 'review' : 'summary';
  const refresh = useBscRefresh();
  return (
    <div>
      <PageHeader title="Tổng hợp kết quả BSC" />
      <Tabs
        value={active}
        onChange={(v) => navigate({ to: '/kpi-admin/bsc', search: { tab: v } })}
        tabs={[
          { value: 'summary', label: 'Tổng hợp kết quả BSC', content: <SummaryTab year={search.year} period={search.period} onChanged={refresh} /> },
          { value: 'review', label: 'Theo dõi kết quả thẩm định và phản hồi', content: <ReviewTab onChanged={refresh} /> },
        ]}
      />
    </div>
  );
}

type SummaryFilter = { keyword: string; year: string; period: string; perspectiveId: string; status: string; dataType: string };

/** 46.1–46.5, 48.1/48.2, 50.1/50.2, 51.1, 52.1, 53.1, 45.x */
function SummaryTab({ year, period, onChanged }: { year?: number; period?: string; onChanged: () => void }) {
  const canRevoke = useHasPerm('BSC:REVOKE');
  const perspectives = usePerspectives();
  const list = useListState<SummaryFilter, Result>('bsc-summary', EP.bsc.summary, {
    keyword: '',
    year: String(year ?? CURRENT_YEAR),
    period: period ?? '',
    perspectiveId: '',
    status: '',
    dataType: '',
  });
  const [view, setView] = useState<Result | null>(null);
  const [revoke, setRevoke] = useState<Result | null>(null);
  return (
    <div>
      <SearchBar
        keyword={list.draft.keyword}
        onKeywordChange={(v) => list.set('keyword', v)}
        placeholder="Mã hoặc tên đơn vị, mã hoặc tên tiêu chí"
        onSearch={list.search}
        onReset={list.reset}
        actions={<BscToolbar tab="summary" onChanged={onChanged} />}
      >
        <FilterItem label="Năm" width="w-24">
          <Select aria-label="Năm" options={YEAR_OPTIONS} value={list.draft.year} onChange={(e) => list.set('year', e.target.value)} />
        </FilterItem>
        <FilterItem label="Kỳ đánh giá" width="w-40">
          <Select aria-label="Kỳ đánh giá" placeholder="Tất cả" options={PERIOD_OPTIONS} value={list.draft.period} onChange={(e) => list.set('period', e.target.value)} />
        </FilterItem>
        <FilterItem label="Viễn cảnh" width="w-40">
          <Select
            aria-label="Viễn cảnh"
            placeholder="Tất cả"
            options={(perspectives.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            value={list.draft.perspectiveId}
            onChange={(e) => list.set('perspectiveId', e.target.value)}
          />
        </FilterItem>
        <FilterItem label="Trạng thái" width="w-44">
          <Select aria-label="Trạng thái" placeholder="Tất cả" options={RESULT_STATUS} value={list.draft.status} onChange={(e) => list.set('status', e.target.value)} />
        </FilterItem>
        <FilterItem label="Loại dữ liệu" width="w-32">
          <Select aria-label="Loại dữ liệu" placeholder="Tất cả" options={RESULT_TYPE_OPTIONS} value={list.draft.dataType} onChange={(e) => list.set('dataType', e.target.value)} />
        </FilterItem>
      </SearchBar>
      <h3 className="mb-2 text-sm font-semibold">Tổng hợp kết quả BSC</h3>
      <DataGrid<Result>
        title="Tổng hợp kết quả BSC"
        {...list.gridProps}
        rowKey={(r) => r.id}
        columns={[
          { key: 'orgUnitName', header: 'Mã – Tên đơn vị', sortable: true, width: 200, render: (r) => codeName(r.orgUnitCode, r.orgUnitName) },
          { key: 'kpiCode', header: 'Mã – Tên tiêu chí KPI', sortable: true, width: 230, render: (r) => codeName(r.kpiCode, r.kpiName) },
          { key: 'perspectiveName', header: 'Viễn cảnh', width: 90 },
          { key: 'weight', header: 'Trọng số', align: 'right', width: 70, render: (r) => fmtNum(r.weight, 2) },
          { key: 'planValue', header: 'Mục tiêu giao', align: 'right', width: 90, render: (r) => fmtNum(r.planValue, 2) },
          { key: 'finalResult', header: 'Kết quả', align: 'right', width: 90, render: (r) => fmtNum(r.finalResult, 2) },
          { key: 'score', header: 'Điểm', sortable: true, align: 'right', width: 60, render: (r) => fmtNum(r.score, 2) },
          { key: 'status', header: 'Tình trạng', sortable: true, width: 130, render: (r) => <ResultStatusBadge status={r.status} /> },
          {
            key: 'actions',
            header: 'Thao tác',
            width: 120,
            render: (r) => (
              <RowActions
                actions={[
                  { label: 'Xem', onClick: () => setView(r) },
                  { label: 'Thu hồi kết quả đánh giá', onClick: () => setRevoke(r), show: canRevoke && REVOCABLE.includes(r.status), danger: true },
                ]}
              />
            ),
          },
        ]}
      />
      {view && <ViewChoiceDialog row={view} onClose={() => setView(null)} />}
      {revoke && <RevokeDialog row={revoke} byUnit={false} onClose={() => setRevoke(null)} onDone={onChanged} />}
    </div>
  );
}

type ReviewFilter = { keyword: string; year: string; period: string; status: string };

/** 47.1–47.4, 48.3/48.4, 50.3/50.4, 51.2, 52.2, 53.2 */
function ReviewTab({ onChanged }: { onChanged: () => void }) {
  const canRevoke = useHasPerm('BSC:REVOKE');
  const list = useListState<ReviewFilter, Result>('bsc-review', EP.bsc.review, { keyword: '', year: String(CURRENT_YEAR), period: '', status: '' });
  const [view, setView] = useState<number | null>(null);
  const [revoke, setRevoke] = useState<Result | null>(null);
  return (
    <div>
      <SearchBar
        keyword={list.draft.keyword}
        onKeywordChange={(v) => list.set('keyword', v)}
        placeholder="Mã hoặc tên đơn vị, mã hoặc tên chỉ tiêu"
        onSearch={list.search}
        onReset={list.reset}
        actions={<BscToolbar tab="review" onChanged={onChanged} />}
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
      <h3 className="mb-2 text-sm font-semibold">Theo dõi kết quả thẩm định và phản hồi</h3>
      <DataGrid<Result>
        title="Theo dõi kết quả thẩm định và phản hồi"
        {...list.gridProps}
        rowKey={(r) => r.id}
        columns={[
          { key: 'orgUnitCode', header: 'Mã – Tên đơn vị', width: 190, render: (r) => codeName(r.orgUnitCode, r.orgUnitName) },
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
            width: 120,
            render: (r) => (
              <RowActions
                actions={[
                  { label: 'Xem', onClick: () => setView(r.id) },
                  { label: 'Thu hồi kết quả đánh giá', onClick: () => setRevoke(r), show: canRevoke && REVOCABLE.includes(r.status), danger: true },
                ]}
              />
            ),
          },
        ]}
      />
      {view !== null && <ResultDetailDrawer id={view} url={EP.bsc.result} onClose={() => setView(null)} />}
      {revoke && <RevokeDialog row={revoke} byUnit onClose={() => setRevoke(null)} onDone={onChanged} />}
    </div>
  );
}
