package vn.vnpt.kpi.common.excel;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.common.audit.AuditService;
import vn.vnpt.kpi.modules.file.model.FileObject;
import vn.vnpt.kpi.modules.file.service.FileAccessPolicy;
import vn.vnpt.kpi.modules.file.service.FileService;
import vn.vnpt.kpi.modules.sysconfig.service.SysConfigService;
import vn.vnpt.kpi.security.CurrentUser;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Luồng nhập chuẩn: Tải file mẫu → Kiểm tra (xem trước) → Xác nhận nhập (chỉ lưu dòng hợp lệ)
 * → “Đã nhập X/Y bản ghi; Z bản ghi lỗi” + file lỗi.
 */
@Service
@RequiredArgsConstructor
public class ImportService {
    private final FileService fileService;
    private final SysConfigService config;
    private final AuditService audit;
    private final TransactionTemplate tx;

    private final Cache<String, Session<?>> sessions = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofMinutes(30)).maximumSize(2_000).build();

    record Session<R>(String handler, Long userId, List<ImportRow<R>> rows) {}

    public record Preview(String importToken, int total, int valid, int invalid, List<Map<String, Object>> columns,
                          List<ImportRow<?>> rows) {}

    public record CommitResult(int imported, int total, int failed, Long errorFileId, String message) {}

    // ---------------- Template ----------------
    public byte[] template(ImportHandler<?> h) {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Sheet data = wb.createSheet("Du lieu");
            CellStyle head = headerStyle(wb, IndexedColors.ROYAL_BLUE);
            CellStyle req = headerStyle(wb, IndexedColors.DARK_RED);
            Row hr = data.createRow(0);
            Row ex = data.createRow(1);
            List<ImportHandler.Column> cols = h.columns();
            for (int i = 0; i < cols.size(); i++) {
                ImportHandler.Column c = cols.get(i);
                Cell cell = hr.createCell(i);
                cell.setCellValue(c.header() + (c.required() ? " (*)" : ""));
                cell.setCellStyle(c.required() ? req : head);
                ex.createCell(i).setCellValue(c.example() == null ? "" : c.example());
                data.setColumnWidth(i, Math.max(16, c.header().length() + 6) * 256);
            }
            Sheet guide = wb.createSheet("Huong dan");
            int r = 0;
            guide.createRow(r++).createCell(0).setCellValue("HƯỚNG DẪN NHẬP DỮ LIỆU — " + h.name().toUpperCase(Locale.ROOT));
            guide.createRow(r++).createCell(0).setCellValue("Dòng 1 là tiêu đề (không sửa). Dòng 2 là ví dụ — xóa hoặc ghi đè trước khi nhập. Cột có (*) là bắt buộc.");
            guide.createRow(r++).createCell(0).setCellValue("Ngày nhập theo định dạng dd/mm/yyyy. Số thập phân dùng dấu phẩy hoặc dấu chấm. Tối đa 10 MB.");
            r++;
            Row gh = guide.createRow(r++);
            gh.createCell(0).setCellValue("Cột");
            gh.createCell(1).setCellValue("Bắt buộc");
            gh.createCell(2).setCellValue("Hướng dẫn");
            for (ImportHandler.Column c : cols) {
                Row gr = guide.createRow(r++);
                gr.createCell(0).setCellValue(c.header());
                gr.createCell(1).setCellValue(c.required() ? "Có" : "Không");
                gr.createCell(2).setCellValue(c.note() == null ? "" : c.note());
            }
            guide.setColumnWidth(0, 30 * 256);
            guide.setColumnWidth(2, 90 * 256);
            for (Map.Entry<String, List<String[]>> e : h.lookups().entrySet()) {
                Sheet lk = wb.createSheet(ExcelExporter.safeSheetName(e.getKey()));
                Row lh = lk.createRow(0);
                lh.createCell(0).setCellValue("Mã");
                lh.createCell(1).setCellValue("Tên");
                lh.getCell(0).setCellStyle(head);
                lh.getCell(1).setCellStyle(head);
                int lr = 1;
                for (String[] v : e.getValue()) {
                    Row row = lk.createRow(lr++);
                    row.createCell(0).setCellValue(v[0]);
                    row.createCell(1).setCellValue(v.length > 1 ? v[1] : "");
                }
                lk.setColumnWidth(0, 22 * 256);
                lk.setColumnWidth(1, 60 * 256);
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    // ---------------- Validate ----------------
    public <R> Preview validate(ImportHandler<R> h, MultipartFile file) {
        List<ImportRow<R>> rows = parseFile(h, file);
        for (ImportRow<R> row : rows) {
            List<String> errs = new ArrayList<>();
            for (ImportHandler.Column c : h.columns()) {
                if (c.required() && row.getData().get(c.key()) == null) errs.add("Thiếu “" + c.header() + "”");
            }
            R rec = null;
            try {
                rec = h.parse(row.getData(), errs);
            } catch (BusinessException e) {
                errs.add(e.getMessage());
            } catch (RuntimeException e) {
                errs.add("Dữ liệu không hợp lệ");
            }
            errs.forEach(row::addError);
            row.setRecord(rec);
        }
        h.validateBatch(rows);
        String token = UUID.randomUUID().toString();
        sessions.put(token, new Session<>(h.name(), CurrentUser.current().getId(), rows));
        int valid = (int) rows.stream().filter(ImportRow::isValid).count();
        List<Map<String, Object>> cols = h.columns().stream().map(c -> Map.<String, Object>of("key", c.key(), "header", c.header())).toList();
        return new Preview(token, rows.size(), valid, rows.size() - valid, cols, new ArrayList<>(rows));
    }

    /** Parse file thành danh sách dòng (không lưu phiên) — dùng cho import lên màn hình (35.1, 44.2) */
    public <R> List<ImportRow<R>> parseFile(ImportHandler<R> h, MultipartFile file) {
        checkFile(file);
        List<ImportHandler.Column> cols = h.columns();
        List<ImportRow<R>> rows = new ArrayList<>();
        try (InputStream in = file.getInputStream(); Workbook wb = WorkbookFactory.create(in)) {
            Sheet sh = wb.getSheetAt(0);
            Row header = sh.getRow(sh.getFirstRowNum());
            if (header == null) throw new BusinessException(ErrorCode.ERR_FILE, "File không có dòng tiêu đề");
            Map<Integer, String> idx = new LinkedHashMap<>();
            for (Cell c : header) {
                String t = norm(fmt.formatCellValue(c));
                for (ImportHandler.Column col : cols) {
                    if (norm(col.header()).equals(t) || norm(col.header() + " (*)").equals(t)) idx.put(c.getColumnIndex(), col.key());
                }
            }
            long requiredMatched = cols.stream().filter(ImportHandler.Column::required).filter(c -> idx.containsValue(c.key())).count();
            long requiredTotal = cols.stream().filter(ImportHandler.Column::required).count();
            if (requiredMatched < requiredTotal) {
                throw new BusinessException(ErrorCode.ERR_FILE, "File không đúng biểu mẫu. Vui lòng dùng “Tải file mẫu”.");
            }
            for (int r = header.getRowNum() + 1; r <= sh.getLastRowNum(); r++) {
                Row row = sh.getRow(r);
                if (row == null) continue;
                Map<String, String> data = new LinkedHashMap<>();
                boolean any = false;
                for (Map.Entry<Integer, String> e : idx.entrySet()) {
                    String v = cellString(row.getCell(e.getKey()));
                    data.put(e.getValue(), v);
                    if (v != null) any = true;
                }
                if (any) rows.add(new ImportRow<>(r + 1, data));
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.ERR_FILE, "Không đọc được file Excel. Vui lòng kiểm tra định dạng .xlsx");
        }
        if (rows.size() > 20_000) throw new BusinessException(ErrorCode.ERR_FILE, "File vượt quá 20.000 dòng dữ liệu");
        return rows;
    }

    // ---------------- Commit ----------------
    @SuppressWarnings("unchecked")
    public <R> CommitResult commit(ImportHandler<R> h, String token) {
        Session<R> s = (Session<R>) sessions.getIfPresent(token == null ? "" : token);
        CurrentUser u = CurrentUser.current();
        if (s == null || !s.handler().equals(h.name()) || !s.userId().equals(u.getId())) {
            throw new BusinessException(ErrorCode.ERR_BAD_REQUEST, "Phiên nhập dữ liệu đã hết hạn, vui lòng thực hiện “Kiểm tra” lại");
        }
        List<R> valid = s.rows().stream().filter(ImportRow::isValid).map(ImportRow::getRecord).toList();
        if (!valid.isEmpty()) {
            tx.executeWithoutResult(st -> h.commit(valid));
        }
        sessions.invalidate(token);
        int total = s.rows().size();
        int failed = total - valid.size();
        Long errorFileId = failed > 0 ? errorFile(h, s.rows(), u) : null;
        audit.log("NHAP_DU_LIEU", h.name(), null, null, Map.of("imported", valid.size(), "total", total, "failed", failed));
        return new CommitResult(valid.size(), total, failed, errorFileId,
                "Đã nhập " + valid.size() + "/" + total + " bản ghi; " + failed + " bản ghi lỗi");
    }

    private <R> Long errorFile(ImportHandler<R> h, List<ImportRow<R>> rows, CurrentUser u) {
        List<ExcelColumn<ImportRow<R>>> cols = new ArrayList<>();
        cols.add(ExcelColumn.of("Dòng", ImportRow::getRow, 8));
        for (ImportHandler.Column c : h.columns()) cols.add(ExcelColumn.of(c.header(), r -> r.getData().get(c.key())));
        cols.add(ExcelColumn.of("Mô tả lỗi", ImportRow::getErrorMessage, 60));
        byte[] bytes = ExcelExporter.export("Loi", null, cols, rows.stream().filter(r -> !r.isValid()).toList());
        FileObject f = fileService.store(bytes, "Loi_nhap_" + vn.vnpt.kpi.common.util.Strs.exportFileName(h.name()),
                FileAccessPolicy.OWNER_IMPORT_ERROR, u.getId());
        return f.getId();
    }

    private void checkFile(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new BusinessException(ErrorCode.ERR_FILE, "Vui lòng chọn file");
        String n = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        if (!n.endsWith(".xlsx")) throw new BusinessException(ErrorCode.ERR_FILE, "Chỉ chấp nhận file .xlsx");
        int maxMb = config.getInt(SysConfigService.UPLOAD_MAX_MB, 10);
        if (file.getSize() > (long) maxMb * 1024 * 1024) throw new BusinessException(ErrorCode.ERR_FILE, "File vượt quá " + maxMb + " MB");
    }

    private final DataFormatter fmt = new DataFormatter(Locale.ROOT);

    String cellString(Cell c) {
        if (c == null) return null;
        String v;
        if (c.getCellType() == CellType.NUMERIC || (c.getCellType() == CellType.FORMULA && c.getCachedFormulaResultType() == CellType.NUMERIC)) {
            if (DateUtil.isCellDateFormatted(c)) {
                LocalDate d = c.getDateCellValue().toInstant().atZone(ZoneId.of("Asia/Ho_Chi_Minh")).toLocalDate();
                v = d.format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));
            } else {
                v = BigDecimal.valueOf(c.getNumericCellValue()).stripTrailingZeros().toPlainString();
            }
        } else {
            v = fmt.formatCellValue(c);
        }
        v = v == null ? null : v.trim();
        return v == null || v.isEmpty() ? null : v;
    }

    private static String norm(String s) {
        return s == null ? "" : s.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private static CellStyle headerStyle(Workbook wb, IndexedColors color) {
        Font f = wb.createFont();
        f.setBold(true);
        f.setColor(IndexedColors.WHITE.getIndex());
        CellStyle s = wb.createCellStyle();
        s.setFont(f);
        s.setFillForegroundColor(color.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return s;
    }
}
