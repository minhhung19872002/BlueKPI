package vn.vnpt.kpi.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.slf4j.MDC;

import java.util.List;

/**
 * Response envelope chuẩn (CLAUDE.md §4.1):
 * { success, code, message, data, errors[{field,message}], traceId }
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(boolean success, String code, String message, T data,
                             List<FieldError> errors, String traceId) {

    public record FieldError(String field, String message) {}

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, "OK", null, data, null, MDC.get("traceId"));
    }

    public static <T> ApiResponse<T> ok(String message, T data) {
        return new ApiResponse<>(true, "OK", message, data, null, MDC.get("traceId"));
    }

    public static ApiResponse<Void> okMessage(String message) {
        return new ApiResponse<>(true, "OK", message, null, null, MDC.get("traceId"));
    }

    public static <T> ApiResponse<T> error(String code, String message, List<FieldError> errors, T data) {
        return new ApiResponse<>(false, code, message, data, errors, MDC.get("traceId"));
    }
}
