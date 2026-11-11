import { useQuery } from '@tanstack/react-query';
import { get } from '@/api/http';
import type { PageResult } from '@/api/types';

export interface PerspectiveOpt {
  id: number;
  code: string;
  name: string;
  color: string;
  sortOrder: number;
  status: string;
}
export interface ObjectiveOpt {
  id: number;
  code: string;
  name: string;
  perspectiveId: number;
  perspectiveName?: string;
  perspectiveColor?: string;
  description?: string;
}
export interface ScoringOpt {
  id: number;
  code: string;
  name: string;
  type: string;
}
export interface UomOpt {
  id: number;
  code: string;
  name: string;
  status: string;
}
export interface FormulaOpt {
  id: number;
  code: string;
  name: string;
  definitionType: string;
}
export interface UserOpt {
  id: number;
  username: string;
  fullName: string;
  orgUnitName?: string;
}
export interface KpiOpt {
  id: number;
  code: string;
  name: string;
  parentId: number | null;
  perspectiveId: number;
  perspectiveName: string;
  objectiveId: number;
  objectiveCode?: string;
  objectiveName: string;
  unitOfMeasureName: string;
  structure: string;
}

export const usePerspectives = () => useQuery({ queryKey: ['perspectives-all'], queryFn: () => get<PerspectiveOpt[]>('/perspectives/all'), staleTime: 60_000 });

export const useObjectives = (perspectiveId?: number | null) =>
  useQuery({
    queryKey: ['objectives-opt', perspectiveId ?? null],
    queryFn: () => get<PageResult<ObjectiveOpt>>('/objectives', { perspectiveId: perspectiveId ?? undefined, size: 100, page: 1 }).then((r) => r.items),
    staleTime: 60_000,
  });

export const useScoringMethods = () => useQuery({ queryKey: ['scoring-methods'], queryFn: () => get<ScoringOpt[]>('/scoring-methods'), staleTime: 300_000 });

export const useUoms = () =>
  useQuery({ queryKey: ['uoms-opt'], queryFn: () => get<PageResult<UomOpt>>('/uoms', { status: 'HIEU_LUC', size: 100, page: 1 }).then((r) => r.items), staleTime: 60_000 });

export const useFormulas = () => useQuery({ queryKey: ['formulas-active'], queryFn: () => get<FormulaOpt[]>('/formula-definitions/active'), staleTime: 60_000 });

export const useUnitUsers = (orgUnitId?: number | null) =>
  useQuery({
    queryKey: ['unit-users', orgUnitId ?? null],
    queryFn: () => get<UserOpt[]>('/users/options', { orgUnitId, includeChildren: true }),
    enabled: !!orgUnitId,
    staleTime: 60_000,
  });

export const useKpiOptions = (params: { keyword?: string; perspectiveId?: number | null; objectiveId?: number | null; rootOnly?: boolean } = {}) =>
  useQuery({
    queryKey: ['kpi-options', params],
    queryFn: () => get<KpiOpt[]>('/kpis/options', { ...params, perspectiveId: params.perspectiveId ?? undefined, objectiveId: params.objectiveId ?? undefined }),
    staleTime: 30_000,
  });

export const GROUP_AGG = [
  { value: 'TONG', label: 'Tổng' },
  { value: 'TRUNG_BINH', label: 'Trung bình' },
  { value: 'TRUNG_BINH_TRONG_SO', label: 'Trung bình có trọng số' },
  { value: 'LON_NHAT', label: 'Lớn nhất' },
  { value: 'NHO_NHAT', label: 'Nhỏ nhất' },
  { value: 'CONG_THUC', label: 'Theo công thức' },
  { value: 'NHAP_TAY', label: 'Nhập tay' },
];
export const TARGET_DATA_TYPES = [
  { value: 'LUY_KE', label: 'Lũy kế' },
  { value: 'THEO_KY', label: 'Theo kỳ' },
  { value: 'CUOI_KY', label: 'Cuối kỳ' },
  { value: 'BINH_QUAN', label: 'Bình quân' },
];
export const COMPLETION = [
  { value: 'THUAN', label: 'Thuận (TH/KH)' },
  { value: 'NGHICH', label: 'Nghịch (KH/TH)' },
  { value: 'TUY_CHINH', label: 'Tùy chỉnh' },
];
export const DATA_SOURCES = [
  { value: 'API', label: 'API' },
  { value: 'NHAP_TAY', label: 'Nhập tay' },
  { value: 'KET_HOP', label: 'Kết hợp' },
];
export const COMPONENT_SOURCES = [
  { value: 'API', label: 'API' },
  { value: 'NHAP_TAY', label: 'Nhập tay' },
];
