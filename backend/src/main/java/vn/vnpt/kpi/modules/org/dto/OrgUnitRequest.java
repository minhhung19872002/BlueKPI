package vn.vnpt.kpi.modules.org.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record OrgUnitRequest(
        @NotBlank(message = "Vui lòng nhập Mã đơn vị") @Size(max = 50, message = "Mã đơn vị tối đa 50 ký tự")
        @Pattern(regexp = "^[A-Za-z0-9_.-]+$", message = "Mã đơn vị chỉ gồm chữ, số, dấu gạch dưới, gạch ngang, chấm") String code,
        @NotBlank(message = "Vui lòng nhập Tên đơn vị") @Size(max = 255, message = "Tên đơn vị tối đa 255 ký tự") String name,
        Long parentId,
        @Size(max = 100, message = "Tên viết tắt tối đa 100 ký tự") String shortName,
        @NotBlank(message = "Vui lòng chọn Loại đơn vị")
        @Pattern(regexp = "CONG_TY_ME|TONG_CONG_TY|CONG_TY|VNPT_TINH|TRUNG_TAM|PHONG_BAN", message = "Loại đơn vị không hợp lệ") String unitType,
        @Size(max = 30) String regionCode,
        Boolean isKpiAssignable,
        @Min(value = 0, message = "Thứ tự phải ≥ 0") @Max(value = 1_000_000, message = "Thứ tự quá lớn") Integer sortOrder,
        Integer version
) {}
