import { useQuery } from '@tanstack/react-query';
import { get } from '@/api/http';
import { EP } from '@/api/endpoints';
import type { Breakdown, CorporationTable, DashFilters, DashParams, DashStrategyMap, KpiRow, Overview, ProvinceStageRow, RankRow } from './types';

/** Mỗi lần đổi bộ lọc → query CSDL lại (17.2): queryKey gồm unit/year/period, staleTime ngắn */
const STALE = 5_000;

export const useDashFilters = () => useQuery({ queryKey: ['dashboard', 'filters'], queryFn: () => get<DashFilters>(EP.dashboard.filters), staleTime: 60_000 });

export const useOverview = (p: DashParams | null) =>
  useQuery({
    queryKey: ['dashboard', 'overview', p],
    queryFn: () => get<Overview>(EP.dashboard.overview, p),
    enabled: !!p,
    staleTime: STALE,
  });

export const useRanking = (year: number, period: string, all: boolean, enabled: boolean) =>
  useQuery({
    queryKey: ['dashboard', 'ranking', year, period, all],
    queryFn: () => get<{ total: number; rows: RankRow[] }>(EP.dashboard.rankingProvinces, { year, period, all }),
    enabled,
    staleTime: STALE,
  });

export const useCorporations = (year: number, period: string, enabled: boolean) =>
  useQuery({
    queryKey: ['dashboard', 'corporations', year, period],
    queryFn: () => get<RankRow[]>(EP.dashboard.corporations, { year, period }),
    enabled,
    staleTime: STALE,
  });

export const useCorporationTable = (unitId: number | null, year: number, period: string) =>
  useQuery({
    queryKey: ['dashboard', 'corp-table', unitId, year, period],
    queryFn: () => get<CorporationTable>(EP.dashboard.corporationTable(unitId!), { year, period }),
    enabled: unitId !== null,
  });

export const useKpiList = (p: DashParams, card: string, keyword: string, perspectiveId: number | null, enabled: boolean) =>
  useQuery({
    queryKey: ['dashboard', 'kpi-list', p, card, keyword, perspectiveId],
    queryFn: () => get<KpiRow[]>(EP.dashboard.kpiList, { ...p, card, keyword: keyword || undefined, perspectiveId: perspectiveId ?? undefined }),
    enabled,
  });

export const useBreakdown = (kpiId: number | null, p: DashParams) =>
  useQuery({
    queryKey: ['dashboard', 'breakdown', kpiId, p],
    queryFn: () => get<Breakdown>(EP.dashboard.focusBreakdown(kpiId!), p),
    enabled: kpiId !== null,
  });

export const useProvinceStage = (unitId: number | null, stageId: number | null) =>
  useQuery({
    queryKey: ['dashboard', 'province-stage', unitId, stageId],
    queryFn: () => get<ProvinceStageRow[]>(EP.dashboard.provinceStage, { unitId, stageId }),
    enabled: unitId !== null && stageId !== null,
    staleTime: STALE,
  });

export const useDashStrategyMap = (p: DashParams, enabled: boolean) =>
  useQuery({
    queryKey: ['dashboard', 'strategy-map', p],
    queryFn: () => get<DashStrategyMap>(EP.dashboard.strategyMap, p),
    enabled,
  });
