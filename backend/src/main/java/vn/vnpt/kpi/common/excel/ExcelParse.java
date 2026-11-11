package vn.vnpt.kpi.common.excel;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;

/** Tiện ích parse giá trị ô khi nhập file */
public final class ExcelParse {
    private ExcelParse() {}

    /** Số: chấp nhận 1.234.567,89 hoặc 1234567.89 */
    public static BigDecimal decimal(String s, String label, List<String> errors) {
        if (s == null) return null;
        String t = s.trim().replace(" ", "");
        if (t.contains(",") && t.contains(".")) {
            t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(".", "").replace(',', '.') : t.replace(",", "");
        } else if (t.contains(",")) {
            t = t.replace(',', '.');
        }
        try {
            return new BigDecimal(t);
        } catch (NumberFormatException e) {
            errors.add("“" + label + "” phải là số");
            return null;
        }
    }

    public static Integer integer(String s, String label, List<String> errors) {
        BigDecimal d = decimal(s, label, errors);
        if (d == null) return null;
        try {
            return d.intValueExact();
        } catch (ArithmeticException e) {
            errors.add("“" + label + "” phải là số nguyên");
            return null;
        }
    }

    public static LocalDate date(String s, String label, List<String> errors) {
        if (s == null) return null;
        try {
            return LocalDate.parse(s.trim(), DateTimeFormatter.ofPattern("d/M/yyyy"));
        } catch (DateTimeParseException e) {
            errors.add("“" + label + "” phải theo định dạng dd/mm/yyyy");
            return null;
        }
    }

    public static Boolean bool(String s) {
        if (s == null) return null;
        String t = s.trim().toLowerCase();
        return t.equals("có") || t.equals("co") || t.equals("x") || t.equals("1") || t.equals("true") || t.equals("yes");
    }

    public static String maxLen(String s, int max, String label, List<String> errors) {
        if (s != null && s.length() > max) errors.add("“" + label + "” tối đa " + max + " ký tự");
        return s;
    }
}
