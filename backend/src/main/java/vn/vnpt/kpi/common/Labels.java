package vn.vnpt.kpi.common;

import java.util.LinkedHashMap;
import java.util.Map;

/** Nhãn hiển thị tiếng Việt cho các mã enum (dùng cho xuất Excel, thông báo, import) */
public final class Labels {
    private Labels() {}

    public static final Map<String, String> UNIT_TYPE = ordered(
            "CONG_TY_ME", "Công ty mẹ", "TONG_CONG_TY", "Tổng công ty", "CONG_TY", "Công ty",
            "VNPT_TINH", "VNPT tỉnh/thành phố", "TRUNG_TAM", "Trung tâm", "PHONG_BAN", "Phòng ban");
    public static final Map<String, String> REGION = ordered("MB", "Miền Bắc", "MT", "Miền Trung", "MN", "Miền Nam");
    public static final Map<String, String> USER_STATUS = ordered("HOAT_DONG", "Hoạt động", "KHOA", "Khóa", "NGUNG", "Ngưng");
    public static final Map<String, String> AUTH_SOURCE = ordered("LOCAL", "Nội bộ", "CAS", "SSO", "BOTH", "Cả hai");
    public static final Map<String, String> ACTIVE = ordered("HIEU_LUC", "Hiệu lực", "KHONG_HIEU_LUC", "Không hiệu lực");
    public static final Map<String, String> DATA_SCOPE = ordered("ALL", "Toàn bộ", "UNIT", "Đơn vị mình", "UNIT_AND_CHILDREN", "Đơn vị mình và đơn vị con");
    public static final Map<String, String> CONFIG_TYPE = ordered("STRING", "Chuỗi", "NUMBER", "Số", "BOOLEAN", "Đúng/Sai", "JSON", "JSON");
    public static final Map<String, String> JOB_TYPE = ordered(
            "DONG_BO_KET_QUA_KPI", "Đồng bộ kết quả KPI", "HOAN_TAT_CHIEN_LUOC", "Hoàn tất chiến lược",
            "NHAC_HAN_CAP_NHAT", "Nhắc hạn cập nhật kết quả", "TINH_LAI_BSC", "Tính lại điểm BSC",
            "DONG_BO_HRM", "Đồng bộ HRM", "SAO_LUU_LOGIC", "Sao lưu logic dữ liệu", "DON_DEP_TEP", "Dọn tệp hết hạn lưu giữ");
    public static final Map<String, String> PERIOD = ordered(
            "Q1", "Quý I", "Q2", "Quý II", "H1", "6 tháng đầu năm", "Q3", "Quý III", "Q4", "Quý IV", "Y", "Cả năm");
    public static final Map<String, String> ASSIGN_STATUS = ordered("DANG_SOAN", "Đang soạn", "DA_GIAO", "Đã giao", "DA_DIEU_CHINH", "Đã điều chỉnh");
    public static final Map<String, String> EVAL_KPI_STATUS = ordered(
            "CHUA_CHAM", "Chưa chấm", "DA_CHAM", "Đã chấm", "DA_XU_LY_DIEU_CHINH", "Đã xử lý điều chỉnh",
            "BCL_YEU_CAU_LAM_LAI", "BCL yêu cầu làm lại", "CHOT_KQ_R2", "Chốt KQ R2");
    public static final Map<String, String> RESULT_STATUS = ordered(
            "CHUA_CO_KQ", "Chưa có kết quả", "DA_CO_KQ", "Đã có kết quả", "DV_DE_NGHI_DIEU_CHINH", "ĐV đề nghị điều chỉnh",
            "DA_XU_LY_DIEU_CHINH", "Đã xử lý điều chỉnh", "CHOT_DANH_GIA", "Chốt đánh giá KPI",
            "BCL_YEU_CAU_LAM_LAI", "BCL yêu cầu làm lại", "TGD_DA_DUYET", "TGĐ đã ký duyệt");
    public static final Map<String, String> RATING = ordered("DAT_VUOT", "Đạt/Vượt", "CHUA_DAT", "Chưa đạt", "DANG_THEO_DOI", "Đang theo dõi");
    public static final Map<String, String> DATA_SOURCE = ordered("API", "API", "NHAP_TAY", "Nhập tay", "KET_HOP", "Kết hợp");
    public static final Map<String, String> STRUCTURE = ordered("DON_LE", "KPI đơn lẻ", "CHA_CON", "KPI cha – con");
    public static final Map<String, String> GROUP_AGG = ordered(
            "TONG", "Tổng", "TRUNG_BINH", "Trung bình", "TRUNG_BINH_TRONG_SO", "Trung bình có trọng số",
            "LON_NHAT", "Lớn nhất", "NHO_NHAT", "Nhỏ nhất", "CONG_THUC", "Theo công thức", "NHAP_TAY", "Nhập tay");
    public static final Map<String, String> TARGET_DATA_TYPE = ordered("LUY_KE", "Lũy kế", "THEO_KY", "Theo kỳ", "CUOI_KY", "Cuối kỳ", "BINH_QUAN", "Bình quân");
    public static final Map<String, String> COMPLETION = ordered("THUAN", "Thuận (TH/KH)", "NGHICH", "Nghịch (KH/TH)", "TUY_CHINH", "Tùy chỉnh");
    public static final Map<String, String> FORMULA_TYPE = ordered(
            "THANH_PHAN_API", "Thành phần lấy từ API", "THANH_PHAN_NHAP_TAY", "Thành phần nhập tay", "CONG_THUC_TONG_HOP", "Công thức tổng hợp");
    public static final Map<String, String> FORMULA_DATA_TYPE = ordered("SO", "Số", "TY_LE", "Tỷ lệ", "TIEN_TE", "Tiền tệ", "SO_LUONG", "Số lượng");
    public static final Map<String, String> STRATEGY_STATUS = ordered("DANG_THUC_HIEN", "Đang thực hiện", "HOAN_THANH", "Hoàn thành");

    public static String of(Map<String, String> m, String code) {
        return code == null ? null : m.getOrDefault(code, code);
    }

    /** Tra ngược nhãn → mã (import): chấp nhận cả mã lẫn nhãn, không phân biệt hoa thường */
    public static String codeOf(Map<String, String> m, String labelOrCode) {
        if (labelOrCode == null) return null;
        String v = labelOrCode.trim();
        for (Map.Entry<String, String> e : m.entrySet()) {
            if (e.getKey().equalsIgnoreCase(v) || e.getValue().equalsIgnoreCase(v)) return e.getKey();
        }
        return null;
    }

    private static Map<String, String> ordered(String... kv) {
        Map<String, String> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put(kv[i], kv[i + 1]);
        return java.util.Collections.unmodifiableMap(m);
    }
}
