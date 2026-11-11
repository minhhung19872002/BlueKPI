package vn.vnpt.kpi.modules.report.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.ClientAnchor;
import org.apache.poi.ss.usermodel.Comment;
import org.apache.poi.ss.usermodel.CreationHelper;
import org.apache.poi.ss.usermodel.Drawing;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.util.CellReference;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.jxls.common.Context;
import org.jxls.util.JxlsHelper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.modules.file.mapper.FileMapper;
import vn.vnpt.kpi.modules.file.model.FileObject;
import vn.vnpt.kpi.modules.file.service.FileAccessPolicy;
import vn.vnpt.kpi.modules.file.service.FileService;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;

/**
 * Xuất báo cáo theo mẫu bằng JXLS 2 (PHẦN C §VIII): template xlsx lưu trong report_template (MinIO); admin thay
 * template không cần build lại. Chưa có file → tự sinh template mặc định (markup jx:area / jx:each trong comment ô).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportTemplateService {
    /** Cột mẫu: tiêu đề + biểu thức JXLS (vd ${r.code}) + độ rộng */
    public record Col(String header, String expr, int width, boolean number) {
        public static Col t(String h, String e, int w) { return new Col(h, e, w, false); }
        public static Col n(String h, String e, int w) { return new Col(h, e, w, true); }
    }

    /**
     * Đặc tả template mặc định.
     * @param infoLines các dòng thông tin dưới tiêu đề (biểu thức JXLS)
     * @param groupVar  null: một bảng (items = rows); khác null: nhiều khối theo nhóm (items = groups, mỗi nhóm có g.name, g.rows)
     * @param footer    dòng cuối (biểu thức), có thể null
     */
    public record Spec(String title, List<String> infoLines, List<Col> cols, String groupVar, String footer) {}

    private final JdbcTemplate jdbc;
    private final FileService fileService;
    private final FileMapper fileMapper;

    public byte[] render(String code, Spec defaultSpec, Map<String, Object> vars) {
        byte[] template = template(code, defaultSpec);
        try (ByteArrayInputStream in = new ByteArrayInputStream(template); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Context ctx = new Context();
            vars.forEach(ctx::putVar);
            JxlsHelper.getInstance().processTemplate(in, out, ctx);
            return out.toByteArray();
        } catch (Exception e) {
            log.error("Xuất báo cáo {} thất bại", code, e);
            throw new BusinessException(ErrorCode.ERR_INTERNAL, "Không xuất được báo cáo theo mẫu " + code);
        }
    }

    /** Template hiện hành (file trên MinIO) hoặc tự sinh + lưu lần đầu */
    public byte[] template(String code, Spec defaultSpec) {
        List<Long> ids = jdbc.queryForList("SELECT file_id FROM report_template WHERE code = ? AND deleted = 0 AND active = 1 AND file_id IS NOT NULL", Long.class, code);
        if (!ids.isEmpty()) {
            FileObject f = fileMapper.findById(ids.get(0));
            if (f != null) {
                try {
                    return fileService.read(f);
                } catch (Exception e) {
                    log.warn("Không đọc được template {} từ kho lưu trữ, dùng mẫu mặc định", code);
                }
            }
        }
        byte[] gen = generate(defaultSpec);
        try {
            FileObject f = fileService.store(gen, "Mau_" + code + ".xlsx", FileAccessPolicy.OWNER_REPORT_TEMPLATE, null);
            jdbc.update("UPDATE report_template SET file_id = ?, updated_at = NOW(3) WHERE code = ?", f.getId(), code);
        } catch (Exception e) {
            log.warn("Không lưu được template mặc định {}: {}", code, e.getMessage());
        }
        return gen;
    }

    /** Sinh template JXLS: tiêu đề, thông tin, bảng (hoặc các khối theo nhóm), dòng cuối */
    static byte[] generate(Spec s) {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Sheet sh = wb.createSheet("Bao cao");
            CreationHelper ch = wb.getCreationHelper();
            Drawing<?> drawing = sh.createDrawingPatriarch();
            Font bold = wb.createFont();
            bold.setBold(true);
            Font big = wb.createFont();
            big.setBold(true);
            big.setFontHeightInPoints((short) 14);
            CellStyle title = wb.createCellStyle();
            title.setFont(big);
            title.setAlignment(HorizontalAlignment.CENTER);
            CellStyle head = wb.createCellStyle();
            head.setFont(bold);
            head.setFillForegroundColor(IndexedColors.PALE_BLUE.getIndex());
            head.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            head.setAlignment(HorizontalAlignment.CENTER);
            head.setWrapText(true);
            border(head);
            CellStyle text = wb.createCellStyle();
            border(text);
            text.setWrapText(true);
            CellStyle num = wb.createCellStyle();
            border(num);
            num.setDataFormat(wb.createDataFormat().getFormat("#,##0.00"));
            CellStyle group = wb.createCellStyle();
            group.setFont(bold);
            int n = s.cols().size();
            int r = 0;
            Row tr = sh.createRow(r++);
            cell(tr, 0, s.title(), title);
            sh.addMergedRegion(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, n - 1));
            for (String info : s.infoLines()) cell(sh.createRow(r++), 0, info, null);
            r++;
            int eachStart;
            int lastRow;
            if (s.groupVar() == null) {
                Row hr = sh.createRow(r++);
                for (int i = 0; i < n; i++) cell(hr, i, s.cols().get(i).header(), head);
                eachStart = r;
                Row dr = sh.createRow(r++);
                for (int i = 0; i < n; i++) cell(dr, i, s.cols().get(i).expr(), s.cols().get(i).number() ? num : text);
                comment(sh, drawing, ch, eachStart, 0, "jx:each(items=\"rows\" var=\"r\" lastCell=\"" + ref(eachStart, n - 1) + "\")");
                lastRow = eachStart;
            } else {
                int blockStart = r;
                cell(sh.createRow(r++), 0, "${g.name}", group);
                Row hr = sh.createRow(r++);
                for (int i = 0; i < n; i++) cell(hr, i, s.cols().get(i).header(), head);
                int inner = r;
                Row dr = sh.createRow(r++);
                for (int i = 0; i < n; i++) cell(dr, i, s.cols().get(i).expr(), s.cols().get(i).number() ? num : text);
                int blockEnd = r;
                sh.createRow(r++); // dòng trống giữa các khối
                comment(sh, drawing, ch, inner, 0, "jx:each(items=\"g.rows\" var=\"r\" lastCell=\"" + ref(inner, n - 1) + "\")");
                comment(sh, drawing, ch, blockStart, 0, "jx:each(items=\"groups\" var=\"g\" lastCell=\"" + ref(blockEnd, n - 1) + "\")");
                lastRow = blockEnd;
            }
            if (s.footer() != null) {
                r = lastRow + 2;
                cell(sh.createRow(r), 0, s.footer(), group);
                lastRow = r;
            }
            comment(sh, drawing, ch, 0, 0, "jx:area(lastCell=\"" + ref(lastRow, n - 1) + "\")");
            for (int i = 0; i < n; i++) sh.setColumnWidth(i, s.cols().get(i).width() * 256);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("Không tạo được template mặc định", e);
        }
    }

    private static String ref(int row, int col) {
        return new CellReference(row, col).formatAsString(false);
    }

    private static void cell(Row r, int c, String v, CellStyle st) {
        Cell cell = r.createCell(c);
        cell.setCellValue(v);
        if (st != null) cell.setCellStyle(st);
    }

    private static void comment(Sheet sh, Drawing<?> d, CreationHelper ch, int row, int col, String text) {
        Row r = sh.getRow(row) == null ? sh.createRow(row) : sh.getRow(row);
        Cell c = r.getCell(col) == null ? r.createCell(col) : r.getCell(col);
        ClientAnchor a = ch.createClientAnchor();
        a.setCol1(col);
        a.setCol2(col + 3);
        a.setRow1(row);
        a.setRow2(row + 3);
        Comment cm = d.createCellComment(a);
        cm.setString(ch.createRichTextString(text));
        c.setCellComment(cm);
    }

    private static void border(CellStyle s) {
        s.setBorderBottom(BorderStyle.THIN);
        s.setBorderTop(BorderStyle.THIN);
        s.setBorderLeft(BorderStyle.THIN);
        s.setBorderRight(BorderStyle.THIN);
    }
}
