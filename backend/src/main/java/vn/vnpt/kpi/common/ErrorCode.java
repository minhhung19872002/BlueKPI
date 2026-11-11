package vn.vnpt.kpi.common;

import org.springframework.http.HttpStatus;

public enum ErrorCode {
    ERR_VALIDATION(HttpStatus.BAD_REQUEST, "Dữ liệu không hợp lệ"),
    ERR_BAD_REQUEST(HttpStatus.BAD_REQUEST, "Yêu cầu không hợp lệ"),
    ERR_UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn"),
    ERR_LOGIN_FAILED(HttpStatus.UNAUTHORIZED, "Tên đăng nhập hoặc mật khẩu không đúng"),
    ERR_ACCOUNT_LOCKED(HttpStatus.FORBIDDEN, "Tài khoản đã bị khóa"),
    ERR_ACCOUNT_INACTIVE(HttpStatus.FORBIDDEN, "Tài khoản đã ngưng hoạt động"),
    ERR_SSO_NOT_GRANTED(HttpStatus.FORBIDDEN, "Tài khoản chưa được cấp quyền truy cập hệ thống"),
    ERR_FORBIDDEN(HttpStatus.FORBIDDEN, "Bạn không có quyền truy cập chức năng này"),
    ERR_NOT_FOUND(HttpStatus.NOT_FOUND, "Không tìm thấy dữ liệu"),
    ERR_DUPLICATE(HttpStatus.CONFLICT, "Dữ liệu đã tồn tại"),
    ERR_VERSION_CONFLICT(HttpStatus.CONFLICT, "Dữ liệu đã bị người khác thay đổi, vui lòng tải lại"),
    ERR_IN_USE(HttpStatus.CONFLICT, "Không thể xóa vì dữ liệu đang được sử dụng"),
    ERR_INVALID_STATE(HttpStatus.CONFLICT, "Trạng thái dữ liệu không cho phép thao tác này"),
    ERR_NOT_ELIGIBLE(HttpStatus.CONFLICT, "Danh sách chưa hoàn thành"),
    ERR_PERIOD_LOCKED(HttpStatus.CONFLICT, "Kỳ đánh giá đã được Tổng giám đốc ký duyệt, dữ liệu đã khóa"),
    ERR_FILE(HttpStatus.BAD_REQUEST, "Tệp không hợp lệ"),
    ERR_TOO_MANY_REQUESTS(HttpStatus.TOO_MANY_REQUESTS, "Quá nhiều yêu cầu, vui lòng thử lại sau"),
    ERR_INTEGRATION(HttpStatus.BAD_GATEWAY, "Lỗi kết nối hệ thống ngoài"),
    ERR_INTERNAL(HttpStatus.INTERNAL_SERVER_ERROR, "Đã xảy ra lỗi hệ thống");

    private final HttpStatus status;
    private final String defaultMessage;

    ErrorCode(HttpStatus status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }

    public HttpStatus status() { return status; }
    public String defaultMessage() { return defaultMessage; }
}
