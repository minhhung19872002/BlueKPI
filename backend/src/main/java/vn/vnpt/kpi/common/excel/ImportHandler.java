package vn.vnpt.kpi.common.excel;

import java.util.List;
import java.util.Map;

/**
 * Bộ xử lý nhập dữ liệu cho một danh mục (dialog “Nhập dữ liệu từ file” — PHẦN C §0.2).
 *
 * @param <R> kiểu bản ghi đã parse
 */
public interface ImportHandler<R> {

    /** Cột mẫu: tiêu đề hiển thị, bắt buộc?, ví dụ, ghi chú hướng dẫn */
    record Column(String key, String header, boolean required, String example, String note) {}

    /** Tên danh mục (dùng cho tên file mẫu, tiêu đề) */
    String name();

    /** Mã quyền IMPORT cần có */
    String permission();

    List<Column> columns();

    /** Sheet tra cứu: tên sheet → các dòng [mã, tên] */
    default Map<String, List<String[]>> lookups() { return Map.of(); }

    /**
     * Parse + validate một dòng. Thêm lỗi vào errors (tiếng Việt). Trả về bản ghi (có thể null nếu lỗi nặng).
     * @param cells key → giá trị chuỗi đã trim (null nếu trống)
     */
    R parse(Map<String, String> cells, List<String> errors);

    /** Kiểm tra chéo giữa các dòng (trùng mã trong file, thứ tự cha–con...) */
    default void validateBatch(List<ImportRow<R>> rows) {}

    /** Lưu các bản ghi hợp lệ (trong 1 transaction) */
    void commit(List<R> valid);
}
