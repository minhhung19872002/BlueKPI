/** Chiến lược (36–38) */
export interface Strategy {
  id: number;
  code: string;
  name: string;
  orgUnitId: number;
  orgUnitCode: string;
  orgUnitName: string;
  ownerUserId: number;
  ownerName: string;
  ownerUsername: string;
  stageId: number;
  stageName: string;
  stageFromYear: number;
  stageToYear: number;
  year: number;
  status: 'DANG_THUC_HIEN' | 'HOAN_THANH';
  objectiveCount: number;
  kpiCount: number;
  updatedAt: string;
  updatedBy?: string;
  createdAt?: string;
  createdBy?: string;
  version: number;
}

export interface Lane {
  id: number;
  code: string;
  name: string;
  color: string;
  sortOrder: number;
}

export interface MapKpi {
  objectiveId: number;
  kpiId: number;
  kpiCode: string;
  kpiName: string;
}

export interface MapNode {
  objectiveId: number;
  code: string;
  name: string;
  description?: string;
  perspectiveId: number;
  perspectiveCode: string;
  perspectiveName: string;
  perspectiveColor: string;
  perspectiveSort: number;
  posX: number;
  posY: number;
  kpis: MapKpi[];
}

export interface MapLink {
  id?: number;
  source: number;
  target: number;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface StrategyMapData {
  strategy: Strategy;
  lanes: Lane[];
  nodes: MapNode[];
  edges: MapLink[];
}

export interface ObjectiveKpi {
  kpiId: number;
  kpiCode: string;
  kpiName: string;
  unitOfMeasureName?: string;
  year?: number;
  periodCode?: string;
  periodName?: string;
  planValue?: number | null;
  finalResult?: number | null;
  completionRate?: number | null;
  score?: number | null;
  rating?: string | null;
}

export const STRATEGY_STATUS = [
  { value: 'DANG_THUC_HIEN', label: 'Đang thực hiện' },
  { value: 'HOAN_THANH', label: 'Hoàn thành' },
];

/** Hình học bản đồ — khớp với seed demo (DemoStrategyStep) */
export const LANE_H = 200;
export const LANE_LABEL_W = 150;
export const NODE_W = 240;
export const NODE_H = 120;
export const COL_W = 280;
export const X0 = 180;
export const Y_PAD = 40;
