export interface EvalKpi {
  id: number;
  kpiId: number;
  kpiCode: string;
  kpiName: string;
  parentKpiId: number | null;
  parentKpiCode?: string | null;
  perspectiveId?: number;
  perspectiveName?: string;
  perspectiveColor?: string;
  unitOfMeasureName?: string;
  assigningUnitName?: string;
  year: number;
  periodCode: string;
  status: string;
  resultType?: string;
  dataSource?: string;
  targetDataType?: string;
  completionFormula?: string;
  scoringMethodName?: string;
  unitCount?: number;
  resultCount?: number;
  lastSyncedAt?: string | null;
}

export interface ComponentValue {
  id?: number | null;
  resultId?: number;
  componentId: number;
  code: string;
  name: string;
  source: 'API' | 'NHAP_TAY' | string;
  formulaCode?: string | null;
  value?: number | null;
  unitProposedValue?: number | null;
  prevAdjustment?: number | null;
  unitProposedAdjustment?: number | null;
  adjustment?: number | null;
  finalValue?: number | null;
}

export interface Result {
  id: number;
  evaluationKpiId: number;
  kpiId: number;
  kpiCode: string;
  kpiName: string;
  parentKpiId?: number | null;
  perspectiveName?: string;
  perspectiveColor?: string;
  unitOfMeasureName?: string;
  year: number;
  periodCode: string;
  evalKpiStatus?: string;
  orgUnitId: number;
  orgUnitCode: string;
  orgUnitName: string;
  weight?: number | null;
  planValue?: number | null;
  yearPlanValue?: number | null;
  kpiResult?: number | null;
  prevAdjustment?: number | null;
  adjustment?: number | null;
  finalResult?: number | null;
  completionRate?: number | null;
  yearCompletionRate?: number | null;
  score?: number | null;
  bscScore?: number | null;
  rating?: string | null;
  status: string;
  description?: string | null;
  calcError?: string | null;
  resultBeforeAdjust?: number | null;
  resultAfterAdjust?: number | null;
  feedback?: string | null;
  updatedAt?: string | null;
  components?: ComponentValue[];
  children?: Result[];
}

export interface FileRef {
  id: number;
  originalName: string;
  size?: number;
}

export interface AdjustmentRequest {
  id: number;
  proposalNote?: string;
  status: 'CHO_XU_LY' | 'DA_XU_LY' | string;
  requestedByName?: string;
  createdAt?: string;
  handledBy?: string;
  handledAt?: string;
  handlingReason?: string;
  decisionFileId?: number | null;
  decisionFileName?: string | null;
  files?: FileRef[];
}

export interface ResultDetail {
  result: Result;
  evalKpi: EvalKpi;
  statusName?: string;
  requests: AdjustmentRequest[];
  feedback: { authorName?: string; content?: string; feedbackType?: string; at?: string }[];
  timeline: { fromStatus?: string | null; toStatus?: string; note?: string; at?: string; by?: string }[];
  canAdjust?: boolean;
  canManual?: boolean;
  canPropose?: boolean;
}

export interface PreviewRow {
  resultId: number;
  kpiResult?: number | null;
  finalResult?: number | null;
  completionRate?: number | null;
  score?: number | null;
  rating?: string | null;
  error?: string | null;
}

export interface EvalHeader {
  evalKpi: EvalKpi;
  components: { componentId: number; code: string; name: string; source: string; formulaCode?: string | null }[];
  locked: boolean;
  statusName?: string;
}
