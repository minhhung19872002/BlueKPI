package vn.vnpt.kpi.modules.catalog.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Form “Thêm mới tiêu chí KPI” (24.1/25.1) — children[] cho KPI cha – con, components[] cho thành phần */
public record KpiRequest(
        Long id,
        @NotBlank(message = "Vui lòng chọn Cấu trúc tiêu chí") @Pattern(regexp = "DON_LE|CHA_CON", message = "Cấu trúc tiêu chí không hợp lệ") String structure,
        @NotBlank(message = "Vui lòng nhập Tên tiêu chí") @Size(max = 500, message = "Tên tiêu chí tối đa 500 ký tự") String name,
        @NotBlank(message = "Vui lòng chọn Cách tính kết quả KPI Tập đoàn")
        @Pattern(regexp = "TONG|TRUNG_BINH|TRUNG_BINH_TRONG_SO|LON_NHAT|NHO_NHAT|CONG_THUC|NHAP_TAY") String groupAggregation,
        @Size(max = 2000) String groupExpression,
        @NotNull(message = "Vui lòng chọn Viễn cảnh") Long perspectiveId,
        Long groupKpiId,
        @NotBlank(message = "Vui lòng chọn Loại số liệu giao") @Pattern(regexp = "LUY_KE|THEO_KY|CUOI_KY|BINH_QUAN") String targetDataType,
        @Pattern(regexp = "THUAN|NGHICH|TUY_CHINH") String completionFormula,
        @Size(max = 2000) String completionExpression,
        @NotNull(message = "Vui lòng chọn Phương pháp tính điểm") Long scoringMethodId,
        Boolean scoreByResult,
        @NotNull(message = "Vui lòng chọn Mục tiêu trọng tâm") Long objectiveId,
        @Min(value = 1, message = "Tỷ trọng phải từ 1 đến 100") @Max(value = 100, message = "Tỷ trọng phải từ 1 đến 100") Integer weight,
        @NotNull(message = "Vui lòng chọn Đơn vị giao") Long assigningUnitId,
        @NotNull(message = "Vui lòng chọn Cán bộ giao") Long assigningOfficerId,
        @NotNull(message = "Vui lòng chọn Đơn vị đánh giá") Long evaluatingUnitId,
        @NotNull(message = "Vui lòng chọn Cán bộ đánh giá") Long evaluatingOfficerId,
        @Pattern(regexp = "API|NHAP_TAY|KET_HOP") String dataSource,
        @NotNull(message = "Vui lòng chọn Đơn vị đo") Long unitOfMeasureId,
        Boolean isFocus,
        @Size(max = 2000) String resultExpression,
        @Valid List<ComponentRequest> components,
        @Valid List<KpiRequest> children,
        Integer sortOrder,
        Integer version
) {
    public record ComponentRequest(
            Long id,
            @NotBlank(message = "Vui lòng nhập Mã biến") @Pattern(regexp = "^[A-Za-z][A-Za-z0-9_]{0,29}$", message = "Mã biến bắt đầu bằng chữ, chỉ gồm chữ/số/_") String code,
            @NotBlank(message = "Vui lòng nhập Tên thành phần") @Size(max = 500) String name,
            Long formulaDefinitionId,
            @NotBlank(message = "Vui lòng chọn Nguồn") @Pattern(regexp = "API|NHAP_TAY") String source) {}
}
