package vn.vnpt.kpi.common;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.List;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    private final MessageSource messageSource;

    public GlobalExceptionHandler(MessageSource messageSource) {
        this.messageSource = messageSource;
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Object>> business(BusinessException ex) {
        return ResponseEntity.status(ex.getCode().status())
                .body(ApiResponse.error(ex.getCode().name(), ex.getMessage(), ex.getErrors(), ex.getData()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Object>> validation(MethodArgumentNotValidException ex) {
        List<ApiResponse.FieldError> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> new ApiResponse.FieldError(fe.getField(), resolve(fe.getDefaultMessage())))
                .toList();
        String msg = errors.isEmpty() ? ErrorCode.ERR_VALIDATION.defaultMessage() : errors.get(0).message();
        return ResponseEntity.badRequest().body(ApiResponse.error(ErrorCode.ERR_VALIDATION.name(), msg, errors, null));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Object>> constraint(ConstraintViolationException ex) {
        List<ApiResponse.FieldError> errors = ex.getConstraintViolations().stream()
                .map(v -> new ApiResponse.FieldError(v.getPropertyPath().toString(), resolve(v.getMessage())))
                .toList();
        return ResponseEntity.badRequest().body(ApiResponse.error(ErrorCode.ERR_VALIDATION.name(),
                errors.isEmpty() ? ErrorCode.ERR_VALIDATION.defaultMessage() : errors.get(0).message(), errors, null));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class})
    public ResponseEntity<ApiResponse<Object>> badRequest(Exception ex) {
        log.debug("Bad request: {}", ex.getMessage());
        return ResponseEntity.badRequest().body(ApiResponse.error(ErrorCode.ERR_BAD_REQUEST.name(),
                ErrorCode.ERR_BAD_REQUEST.defaultMessage(), null, null));
    }

    @ExceptionHandler(DuplicateKeyException.class)
    public ResponseEntity<ApiResponse<Object>> duplicate(DuplicateKeyException ex) {
        log.debug("Duplicate key", ex);
        return ResponseEntity.status(ErrorCode.ERR_DUPLICATE.status()).body(ApiResponse.error(ErrorCode.ERR_DUPLICATE.name(),
                "Dữ liệu đã tồn tại (trùng mã hoặc khóa duy nhất)", null, null));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Object>> integrity(DataIntegrityViolationException ex) {
        log.warn("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
        String m = String.valueOf(ex.getMostSpecificCause().getMessage());
        if (m.contains("foreign key constraint fails") && m.contains("Cannot delete")) {
            return ResponseEntity.status(ErrorCode.ERR_IN_USE.status()).body(ApiResponse.error(ErrorCode.ERR_IN_USE.name(),
                    ErrorCode.ERR_IN_USE.defaultMessage(), null, null));
        }
        return ResponseEntity.badRequest().body(ApiResponse.error(ErrorCode.ERR_VALIDATION.name(),
                "Dữ liệu vi phạm ràng buộc toàn vẹn", null, null));
    }

    @ExceptionHandler({AccessDeniedException.class, AuthorizationDeniedException.class})
    public ResponseEntity<ApiResponse<Object>> denied(Exception ex) {
        return ResponseEntity.status(ErrorCode.ERR_FORBIDDEN.status()).body(ApiResponse.error(ErrorCode.ERR_FORBIDDEN.name(),
                ErrorCode.ERR_FORBIDDEN.defaultMessage(), null, null));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Object>> upload(MaxUploadSizeExceededException ex) {
        return ResponseEntity.badRequest().body(ApiResponse.error(ErrorCode.ERR_FILE.name(),
                "Tệp vượt quá dung lượng cho phép", null, null));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Object>> method(HttpRequestMethodNotSupportedException ex) {
        return ResponseEntity.status(405).body(ApiResponse.error(ErrorCode.ERR_BAD_REQUEST.name(), "Phương thức không được hỗ trợ", null, null));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Object>> noResource(NoResourceFoundException ex) {
        return ResponseEntity.status(404).body(ApiResponse.error(ErrorCode.ERR_NOT_FOUND.name(), ErrorCode.ERR_NOT_FOUND.defaultMessage(), null, null));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Object>> other(Exception ex) {
        log.error("Unhandled error", ex);
        return ResponseEntity.internalServerError().body(ApiResponse.error(ErrorCode.ERR_INTERNAL.name(),
                ErrorCode.ERR_INTERNAL.defaultMessage(), null, null));
    }

    private String resolve(String msg) {
        if (msg == null) return ErrorCode.ERR_VALIDATION.defaultMessage();
        if (msg.startsWith("{") && msg.endsWith("}")) {
            return messageSource.getMessage(msg.substring(1, msg.length() - 1), null, msg, LocaleContextHolder.getLocale());
        }
        return msg;
    }
}
