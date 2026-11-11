package vn.vnpt.kpi.common.excel;

import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Xuất xlsx (streaming SXSSF) — ngày dd/mm/yyyy, số kiểu #,##0.00 (Excel tự hiển thị theo locale máy).
 */
public final class ExcelExporter {
    private static final DateTimeFormatter D = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private ExcelExporter() {}

    public record SheetSpec<T>(String name, String title, List<ExcelColumn<T>> columns, List<T> rows) {}

    public static <T> byte[] export(String sheetName, String title, List<ExcelColumn<T>> columns, List<T> rows) {
        return exportSheets(List.of(new SheetSpec<>(sheetName, title, columns, rows)));
    }

    public static byte[] exportSheets(List<? extends SheetSpec<?>> sheets) {
        try (SXSSFWorkbook wb = new SXSSFWorkbook(200)) {
            Styles st = new Styles(wb);
            for (SheetSpec<?> s : sheets) writeSheet(wb, st, s);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            wb.dispose();
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Không tạo được file Excel", e);
        }
    }

    private static <T> void writeSheet(Workbook wb, Styles st, SheetSpec<T> s) {
        Sheet sh = wb.createSheet(safeSheetName(s.name()));
        int r = 0;
        if (s.title() != null) {
            Row tr = sh.createRow(r++);
            Cell c = tr.createCell(0);
            c.setCellValue(s.title());
            c.setCellStyle(st.title);
            if (s.columns().size() > 1) sh.addMergedRegion(new CellRangeAddress(0, 0, 0, s.columns().size() - 1));
            r++;
        }
        Row hr = sh.createRow(r++);
        for (int i = 0; i < s.columns().size(); i++) {
            Cell c = hr.createCell(i);
            c.setCellValue(s.columns().get(i).header());
            c.setCellStyle(st.header);
            sh.setColumnWidth(i, s.columns().get(i).width() * 256);
        }
        for (T row : s.rows()) {
            Row xr = sh.createRow(r++);
            for (int i = 0; i < s.columns().size(); i++) {
                setValue(xr.createCell(i), s.columns().get(i).getter().apply(row), st);
            }
        }
    }

    static void setValue(Cell c, Object v, Styles st) {
        if (v == null) {
            c.setCellStyle(st.text);
            return;
        }
        if (v instanceof BigDecimal b) {
            c.setCellValue(b.doubleValue());
            c.setCellStyle(st.number);
        } else if (v instanceof Integer || v instanceof Long) {
            c.setCellValue(((Number) v).doubleValue());
            c.setCellStyle(st.integer);
        } else if (v instanceof Number n) {
            c.setCellValue(n.doubleValue());
            c.setCellStyle(st.number);
        } else if (v instanceof LocalDateTime t) {
            c.setCellValue(t.format(DT));
            c.setCellStyle(st.text);
        } else if (v instanceof LocalDate d) {
            c.setCellValue(d.format(D));
            c.setCellStyle(st.text);
        } else if (v instanceof Boolean b) {
            c.setCellValue(b ? "Có" : "Không");
            c.setCellStyle(st.text);
        } else {
            c.setCellValue(String.valueOf(v));
            c.setCellStyle(st.text);
        }
    }

    public static String safeSheetName(String n) {
        String s = n == null ? "Sheet" : n.replaceAll("[\\\\/?*\\[\\]:]", "_");
        return s.length() > 31 ? s.substring(0, 31) : s;
    }

    static final class Styles {
        final CellStyle header, text, number, integer, title;

        Styles(Workbook wb) {
            Font bold = wb.createFont();
            bold.setBold(true);
            Font white = wb.createFont();
            white.setBold(true);
            white.setColor(IndexedColors.WHITE.getIndex());
            header = wb.createCellStyle();
            header.setFont(white);
            header.setFillForegroundColor(IndexedColors.ROYAL_BLUE.getIndex());
            header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            header.setAlignment(HorizontalAlignment.CENTER);
            header.setVerticalAlignment(VerticalAlignment.CENTER);
            header.setWrapText(true);
            border(header);
            text = wb.createCellStyle();
            border(text);
            number = wb.createCellStyle();
            number.setDataFormat(wb.createDataFormat().getFormat("#,##0.00"));
            border(number);
            integer = wb.createCellStyle();
            integer.setDataFormat(wb.createDataFormat().getFormat("#,##0"));
            border(integer);
            Font big = wb.createFont();
            big.setBold(true);
            big.setFontHeightInPoints((short) 14);
            title = wb.createCellStyle();
            title.setFont(big);
            title.setAlignment(HorizontalAlignment.CENTER);
        }

        private static void border(CellStyle s) {
            s.setBorderBottom(BorderStyle.THIN);
            s.setBorderTop(BorderStyle.THIN);
            s.setBorderLeft(BorderStyle.THIN);
            s.setBorderRight(BorderStyle.THIN);
        }
    }
}
