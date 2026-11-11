package vn.vnpt.kpi.common.util;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

public final class Strs {
    private Strs() {}

    public static boolean isBlank(String s) { return s == null || s.isBlank(); }

    public static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    /** Escape ký tự đặc biệt của LIKE; dùng cùng #{} trong mapper */
    public static String like(String keyword) {
        String k = trimToNull(keyword);
        if (k == null) return null;
        return "%" + k.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    /** Bỏ dấu tiếng Việt (dùng cho tên file, gợi ý username) */
    public static String unaccent(String s) {
        if (s == null) return null;
        String n = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return n.replace('đ', 'd').replace('Đ', 'D');
    }

    /** Tên file xuất: <TenDanhMuc>_ddMMyyyy_HHmm.xlsx */
    public static String exportFileName(String baseName) {
        String safe = unaccent(baseName).replaceAll("[^A-Za-z0-9]+", "");
        return safe + "_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("ddMMyyyy_HHmm", Locale.ROOT)) + ".xlsx";
    }
}
