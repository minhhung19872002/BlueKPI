/** Nhãn nguyên văn dùng chung cho “Đánh giá KPI” và “KPI đơn vị của tôi” */
export interface Opt {
  value: string;
  label: string;
}

export const PERIOD_OPTIONS: Opt[] = [
  { value: 'Q1', label: 'Quý I' },
  { value: 'Q2', label: 'Quý II' },
  { value: 'H1', label: '6 tháng đầu năm' },
  { value: 'Q3', label: 'Quý III' },
  { value: 'Q4', label: 'Quý IV' },
  { value: 'Y', label: 'Cả năm' },
];

/** Tình trạng KPI-kỳ (evaluation_kpi.status) */
export const EVAL_KPI_STATUS: Opt[] = [
  { value: 'CHUA_CHAM', label: 'Chưa chấm' },
  { value: 'DA_CHAM', label: 'Đã chấm' },
  { value: 'DA_XU_LY_DIEU_CHINH', label: 'Đã xử lý điều chỉnh' },
  { value: 'BCL_YEU_CAU_LAM_LAI', label: 'BCL yêu cầu làm lại' },
  { value: 'CHOT_KQ_R2', label: 'Chốt KQ R2' },
];

/** Trạng thái kết quả theo đơn vị */
export const RESULT_STATUS: Opt[] = [
  { value: 'CHUA_CO_KQ', label: 'Chưa có kết quả' },
  { value: 'DA_CO_KQ', label: 'Đã có kết quả' },
  { value: 'DV_DE_NGHI_DIEU_CHINH', label: 'ĐV đề nghị điều chỉnh' },
  { value: 'DA_XU_LY_DIEU_CHINH', label: 'Đã xử lý điều chỉnh' },
  { value: 'CHOT_DANH_GIA', label: 'Chốt đánh giá KPI' },
  { value: 'BCL_YEU_CAU_LAM_LAI', label: 'BCL yêu cầu làm lại' },
  { value: 'TGD_DA_DUYET', label: 'TGĐ đã ký duyệt' },
];

export const RATING_OPTIONS: Opt[] = [
  { value: 'DAT_VUOT', label: 'Đạt/Vượt' },
  { value: 'CHUA_DAT', label: 'Chưa đạt' },
  { value: 'DANG_THEO_DOI', label: 'Đang theo dõi' },
];

export const RESULT_TYPE_OPTIONS: Opt[] = [
  { value: 'API', label: 'API' },
  { value: 'NHAP_TAY', label: 'Nhập tay' },
  { value: 'KET_HOP', label: 'Kết hợp' },
];

export const TARGET_DATA_TYPE_OPTIONS: Opt[] = [
  { value: 'LUY_KE', label: 'Lũy kế' },
  { value: 'THEO_KY', label: 'Theo kỳ' },
  { value: 'CUOI_KY', label: 'Cuối kỳ' },
  { value: 'BINH_QUAN', label: 'Bình quân' },
];

export const COMPLETION_OPTIONS: Opt[] = [
  { value: 'THUAN', label: 'Thuận (TH/KH)' },
  { value: 'NGHICH', label: 'Nghịch (KH/TH)' },
  { value: 'TUY_CHINH', label: 'Tùy chỉnh' },
];

/** Trạng thái kết quả cho phép nhập/đánh giá trên lưới */
export const EDITABLE_RESULT_STATUS = ['CHUA_CO_KQ', 'DA_CO_KQ', 'DA_XU_LY_DIEU_CHINH', 'BCL_YEU_CAU_LAM_LAI'];

export const lbl = (opts: Opt[], v?: string | null) => (v ? (opts.find((o) => o.value === v)?.label ?? v) : '');
export const periodLabel = (v?: string | null) => lbl(PERIOD_OPTIONS, v);

export const CURRENT_YEAR = new Date().getFullYear();
export const YEAR_OPTIONS = Array.from({ length: 7 }, (_, i) => CURRENT_YEAR + 1 - i).map((y) => ({ value: y, label: String(y) }));

export type BadgeColor = 'green' | 'red' | 'amber' | 'blue' | 'slate' | 'purple';

export const evalKpiStatusColor = (s?: string | null): BadgeColor =>
  s === 'CHOT_KQ_R2' ? 'purple' : s === 'DA_CHAM' ? 'green' : s === 'DA_XU_LY_DIEU_CHINH' ? 'blue' : s === 'BCL_YEU_CAU_LAM_LAI' ? 'red' : 'slate';

export const resultStatusColor = (s?: string | null): BadgeColor =>
  s === 'DA_CO_KQ'
    ? 'green'
    : s === 'DV_DE_NGHI_DIEU_CHINH'
      ? 'amber'
      : s === 'DA_XU_LY_DIEU_CHINH'
        ? 'blue'
        : s === 'BCL_YEU_CAU_LAM_LAI'
          ? 'red'
          : s === 'CHOT_DANH_GIA' || s === 'TGD_DA_DUYET'
            ? 'purple'
            : 'slate';

export const ratingColor = (s?: string | null): BadgeColor => (s === 'DAT_VUOT' ? 'green' : s === 'CHUA_DAT' ? 'red' : 'slate');
