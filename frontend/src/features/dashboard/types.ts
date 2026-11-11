import type { Lane, MapLink, MapNode, ObjectiveKpi, Strategy } from '@/features/strategy/types';

/** Dashboard TGĐ BSC (STT 6 → 17.8) — kiểu dữ liệu khớp DashboardService */
export type Num = number | string | null | undefined;

export const GROUP = 'GROUP';
export const PROVINCES = 'PROVINCES';

export const GROUP_LABEL = '1. Công ty mẹ – Tập đoàn';
export const PROVINCES_LABEL = 'Khối VNPT tỉnh/thành phố';

export interface Stage {
  id: number;
  code: string;
  name: string;
  fromYear: number;
  toYear: number;
}

export interface DashFilters {
  defaults: { unit: string; year: number; period: string };
  canGroup: boolean;
  canProvinces: boolean;
  rootUnit: { id: number; code: string; name: string };
  stages: Stage[];
}

export interface DashParams {
  unit: string;
  year: number;
  period: string;
}

export type Rating = 'DAT_VUOT' | 'CHUA_DAT' | 'DANG_THEO_DOI';

export interface KpiRow {
  kpiId: number;
  kpiCode: string;
  kpiName: string;
  perspectiveId: number;
  perspectiveName: string;
  perspectiveColor?: string;
  unitOfMeasureName?: string;
  planValue?: Num;
  yearPlanValue?: Num;
  finalResult?: Num;
  completionRate?: Num;
  yearCompletionRate?: Num;
  score?: Num;
  bscScore?: Num;
  rating: Rating;
  ratingName?: string;
  isFocus?: boolean | number;
}

export interface Cards {
  total: number;
  achieved: number;
  notAchieved: number;
  tracking: number;
}

export interface Overview {
  mode: 'GROUP' | 'UNIT' | 'PROVINCES';
  unit: { id: number; code: string; name: string; unitType?: string; level?: number; parentId?: number } | null;
  year: number;
  period: string;
  periodName: string;
  stage: Stage | null;
  lastUpdated?: string | null;
  cards: Cards;
  prevCards: Cards | null;
  changes: Record<keyof Cards, Num>;
  bsc: { score: Num; prevScore: Num; periodName: string; prevPeriodName: string };
  focus: KpiRow[];
  stageYears?: { year: number; bscScore: Num; completionRate: Num }[];
  rankInGroup?: number | null;
  rankGroup?: string | null;
}

export interface RankRow {
  rank: number | null;
  unitId: number;
  unitCode: string;
  unitName: string;
  totalKpi: number;
  achieved: number;
  notAchieved: number;
  tracking: number;
  warning?: number;
  completionRate: Num;
  bscScore: Num;
  movement: number | null;
}

export interface CorporationTable {
  unit: { id: number; code: string; name: string };
  periodName: string;
  summary: RankRow | null;
  rows: RankRow[];
}

export interface BreakdownRow {
  unitId?: number;
  unitCode?: string;
  unitName: string;
  finalResult: Num;
  completionRate: Num;
  score: Num;
  bscScore: Num;
  status?: string;
  statusName?: string;
  rating?: Rating;
}

export interface Breakdown {
  kpi: KpiRow;
  childCount: number;
  assignedCount: number;
  rows: BreakdownRow[];
  message: string | null;
}

export interface ProvinceStageRow {
  year: number;
  period: string;
  periodName: string;
  totalKpi: number;
  achieved: number;
  notAchieved: number;
  completionRate: Num;
  bscScore: Num;
  rankInGroup: number | null;
}

export interface DashStrategyMap {
  message?: string;
  strategy?: Strategy;
  lanes?: Lane[];
  nodes?: MapNode[];
  edges?: MapLink[];
  kpiResults?: Record<string, ObjectiveKpi[]>;
  periodName?: string;
}

/** “Kỳ đánh giá” — thứ tự theo đặc tả */
export const DASH_PERIODS = [
  { value: 'Y', label: 'Cả năm' },
  { value: 'Q1', label: 'Quý I' },
  { value: 'Q2', label: 'Quý II' },
  { value: 'Q3', label: 'Quý III' },
  { value: 'Q4', label: 'Quý IV' },
  { value: 'H1', label: '6 tháng đầu năm' },
];

export const isStagePeriod = (p?: string) => !!p && p.startsWith('GD:');
export const stageIdOf = (p?: string) => (isStagePeriod(p) ? Number(p!.slice(3)) : null);

/** Màu theo rating (token --color-rating-*) */
export const RATING_COLOR: Record<string, string> = { DAT_VUOT: '#16a34a', CHUA_DAT: '#dc2626', DANG_THEO_DOI: '#94a3b8' };
export const ratingColor = (r?: string | null) => RATING_COLOR[r ?? ''] ?? RATING_COLOR.DANG_THEO_DOI;
export const RATING_LABEL: Record<string, string> = { DAT_VUOT: 'Đạt/Vượt', CHUA_DAT: 'Chưa đạt', DANG_THEO_DOI: 'Đang theo dõi' };

export const toNum = (v: Num): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
