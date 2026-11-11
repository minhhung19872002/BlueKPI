package vn.vnpt.kpi.common;

import java.util.List;

public class BusinessException extends RuntimeException {
    private final ErrorCode code;
    private final transient Object data;
    private final transient List<ApiResponse.FieldError> errors;

    public BusinessException(ErrorCode code) {
        this(code, code.defaultMessage(), null, null);
    }

    public BusinessException(ErrorCode code, String message) {
        this(code, message, null, null);
    }

    public BusinessException(ErrorCode code, String message, Object data) {
        this(code, message, data, null);
    }

    public BusinessException(ErrorCode code, String message, Object data, List<ApiResponse.FieldError> errors) {
        super(message);
        this.code = code;
        this.data = data;
        this.errors = errors;
    }

    public static BusinessException notFound(String what) {
        return new BusinessException(ErrorCode.ERR_NOT_FOUND, "Không tìm thấy " + what);
    }

    public static BusinessException field(String field, String message) {
        return new BusinessException(ErrorCode.ERR_VALIDATION, message, null,
                List.of(new ApiResponse.FieldError(field, message)));
    }

    public static BusinessException inUse(String where) {
        return new BusinessException(ErrorCode.ERR_IN_USE, "Không thể xóa vì dữ liệu đang được sử dụng tại: " + where);
    }

    public ErrorCode getCode() { return code; }
    public Object getData() { return data; }
    public List<ApiResponse.FieldError> getErrors() { return errors; }
}
