package vn.vnpt.kpi.common;

import lombok.Getter;
import lombok.Setter;

import java.util.Map;
import java.util.Set;

/**
 * Tham số phân trang chuẩn: ?page=1&size=20&sort=field,asc
 * Cột sắp xếp chỉ được dùng trong ${} sau khi qua whitelist (CLAUDE.md §4.5).
 */
@Getter
@Setter
public class PageQuery {
    private static final Set<Integer> ALLOWED_SIZES = Set.of(10, 20, 50, 100);
    public static final int MAX_EXPORT = 100_000;

    private int page = 1;
    private int size = 20;
    private String sort;

    /** Kết quả ORDER BY đã whitelist — dùng ${orderBy} trong mapper */
    private String orderBy;

    public int getPage() { return Math.max(page, 1); }

    public int getSize() {
        if (size == Integer.MAX_VALUE || size == MAX_EXPORT) return size;
        return ALLOWED_SIZES.contains(size) ? size : (size <= 0 ? 20 : Math.min(size, 100));
    }

    public long getOffset() { return (long) (getPage() - 1) * getSize(); }

    /**
     * @param whitelist map tên field FE → biểu thức cột SQL an toàn
     * @param defaultOrder ORDER BY mặc định (hằng số trong code)
     */
    public PageQuery applySort(Map<String, String> whitelist, String defaultOrder) {
        String result = defaultOrder;
        if (sort != null && !sort.isBlank()) {
            String[] parts = sort.split(",");
            String col = whitelist.get(parts[0].trim());
            if (col != null) {
                String dir = parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim()) ? "DESC" : "ASC";
                result = col + " " + dir;
            }
        }
        this.orderBy = result;
        return this;
    }

    /** Dùng cho xuất dữ liệu: lấy toàn bộ theo điều kiện tìm kiếm hiện tại */
    public PageQuery forExport() {
        this.page = 1;
        this.size = MAX_EXPORT;
        return this;
    }
}
