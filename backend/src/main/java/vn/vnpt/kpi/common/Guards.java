package vn.vnpt.kpi.common;

/** Kiểm tra kết quả ghi có optimistic lock */
public final class Guards {
    private Guards() {}

    /** rows = 0 khi version lệch hoặc bản ghi đã bị xóa → “Dữ liệu đã bị người khác thay đổi, vui lòng tải lại” */
    public static void updated(int rows) {
        if (rows == 0) throw new BusinessException(ErrorCode.ERR_VERSION_CONFLICT);
    }

    public static <T> T found(T o, String what) {
        if (o == null) throw BusinessException.notFound(what);
        return o;
    }
}
