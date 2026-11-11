package vn.vnpt.kpi.modules.assignment.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** DTO Giao KPI (29–35) */
public final class AssignmentDtos {
    private AssignmentDtos() {}

    public record DetailInput(
            Long id, Long kpiId, Long orgUnitId,
            @DecimalMin(value = "1", message = "Trọng số phải từ 1 đến 100") @DecimalMax(value = "100", message = "Trọng số phải từ 1 đến 100") BigDecimal weight,
            @DecimalMin(value = "0", message = "Giá trị phải lớn hơn hoặc bằng 0") BigDecimal targetQ1,
            @DecimalMin(value = "0", message = "Giá trị phải lớn hơn hoặc bằng 0") BigDecimal targetQ2,
            @DecimalMin(value = "0", message = "Giá trị phải lớn hơn hoặc bằng 0") BigDecimal targetH1,
            @DecimalMin(value = "0", message = "Giá trị phải lớn hơn hoặc bằng 0") BigDecimal targetQ3,
            @DecimalMin(value = "0", message = "Giá trị phải lớn hơn hoặc bằng 0") BigDecimal targetQ4,
            @DecimalMin(value = "0", message = "Giá trị phải lớn hơn hoặc bằng 0") BigDecimal targetYear,
            @Size(max = 1000) String note) {}

    public record ByUnitRequest(@NotNull(message = "Vui lòng chọn Đơn vị được giao") Long orgUnitId,
                                @NotNull(message = "Vui lòng chọn Năm giao") @Min(2000) @Max(2100) Integer year,
                                @Valid List<DetailInput> details, String source) {}

    public record ByKpiRequest(@NotNull(message = "Vui lòng chọn Tiêu chí KPI") Long kpiId,
                               @NotNull(message = "Vui lòng chọn Năm giao") @Min(2000) @Max(2100) Integer year,
                               @Valid List<DetailInput> details, String source) {}

    public record CopyByUnit(@NotNull(message = "Vui lòng chọn Năm giao đích") @Min(2000) @Max(2100) Integer targetYear,
                             @NotEmpty(message = "Vui lòng chọn đơn vị nhận bản sao") List<Long> targetUnitIds) {}

    public record CopyByKpi(@NotNull(message = "Vui lòng chọn Sao chép KPI") Long kpiId,
                            @NotNull(message = "Vui lòng chọn Năm") Integer year,
                            @NotNull(message = "Vui lòng chọn đơn vị sao chép") Long sourceUnitId,
                            @NotEmpty(message = "Vui lòng chọn đơn vị được sao chép") List<Long> targetUnitIds) {}

    public record KpiYear(@NotNull Long kpiId, @NotNull Integer year) {}

    public record CloseByUnit(@NotEmpty(message = "Vui lòng chọn bản ghi") List<Long> ids) {}

    public record CloseByKpi(@NotEmpty(message = "Vui lòng chọn bản ghi") List<KpiYear> keys) {}

    public record AdjLine(@NotNull Long detailId, @NotBlank @Pattern(regexp = "Q1|Q2|H1|Q3|Q4") String periodCode,
                          @DecimalMin(value = "0", message = "Giá trị phải lớn hơn hoặc bằng 0") BigDecimal newValue) {}

    public record AdjustRequest(@NotBlank(message = "Vui lòng nhập Quyết định điều chỉnh số") @Size(max = 100) String decisionNo,
                                @NotNull(message = "Vui lòng nhập Ngày") LocalDate decisionDate,
                                @NotBlank(message = "Vui lòng nhập Lý do điều chỉnh") @Size(max = 2000) String reason,
                                @Valid List<AdjLine> lines) {}
}
