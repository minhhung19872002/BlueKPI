package vn.vnpt.kpi.modules.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UserRequest(
        @NotBlank(message = "Vui lòng nhập Họ tên") @Size(max = 255, message = "Họ tên tối đa 255 ký tự") String fullName,
        @NotBlank(message = "Vui lòng nhập Email") @Email(message = "Email không hợp lệ") @Size(max = 255) String email,
        @NotNull(message = "Vui lòng chọn Đơn vị") Long orgUnitId,
        @NotBlank(message = "Vui lòng chọn Trạng thái") @Pattern(regexp = "HOAT_DONG|KHOA|NGUNG", message = "Trạng thái không hợp lệ") String status,
        @Size(max = 100) @Pattern(regexp = "^[A-Za-z0-9._@-]*$", message = "Tên đăng nhập chỉ gồm chữ, số và . _ @ -") String username,
        @Size(max = 20) @Pattern(regexp = "^[0-9+ ().-]*$", message = "Số điện thoại không hợp lệ") String phone,
        @Pattern(regexp = "LOCAL|CAS|BOTH", message = "Nguồn xác thực không hợp lệ") String authSource,
        @Size(max = 128) String initialPassword,
        Integer version
) {}
