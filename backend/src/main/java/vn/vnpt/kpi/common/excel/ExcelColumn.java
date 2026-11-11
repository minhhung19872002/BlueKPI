package vn.vnpt.kpi.common.excel;

import java.util.function.Function;

/** Cột xuất Excel: tiêu đề + hàm lấy giá trị + độ rộng (ký tự) */
public record ExcelColumn<T>(String header, Function<T, Object> getter, int width) {
    public static <T> ExcelColumn<T> of(String header, Function<T, Object> getter) {
        return new ExcelColumn<>(header, getter, Math.max(12, Math.min(50, header.length() + 6)));
    }

    public static <T> ExcelColumn<T> of(String header, Function<T, Object> getter, int width) {
        return new ExcelColumn<>(header, getter, width);
    }
}
