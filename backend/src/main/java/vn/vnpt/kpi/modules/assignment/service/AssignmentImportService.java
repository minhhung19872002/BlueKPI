package vn.vnpt.kpi.modules.assignment.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import vn.vnpt.kpi.common.Labels;
import vn.vnpt.kpi.common.excel.ExcelColumn;
import vn.vnpt.kpi.common.excel.ExcelExporter;
import vn.vnpt.kpi.common.excel.ExcelParse;
import vn.vnpt.kpi.common.excel.ImportHandler;
import vn.vnpt.kpi.common.excel.ImportRow;
import vn.vnpt.kpi.common.excel.ImportService;
import vn.vnpt.kpi.modules.assignment.model.AssignmentModels.Detail;
import vn.vnpt.kpi.modules.assignment.model.AssignmentModels.Header;
import vn.vnpt.kpi.modules.catalog.mapper.KpiMapper;
import vn.vnpt.kpi.modules.catalog.model.Kpi;
import vn.vnpt.kpi.modules.org.mapper.OrgUnitMapper;
import vn.vnpt.kpi.modules.org.model.OrgUnit;
import vn.vnpt.kpi.security.PermissionCodes;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 35.1 Giao KPI – Nhập dữ liệu: đọc file theo biểu mẫu (theo đơn vị: một dòng mỗi KPI; theo chỉ tiêu: một dòng mỗi đơn vị),
 * kiểm tra hợp lệ và trả số liệu để cập nhật lên màn hình nhập giao (chưa lưu DB). 35.2 Xuất dữ liệu.
 */
@Service
@RequiredArgsConstructor
public class AssignmentImportService {
    private final ImportService importService;
    private final KpiMapper kpiMapper;
    private final OrgUnitMapper orgMapper;

    public record Row(Long kpiId, String kpiCode, String kpiName, Long parentKpiId, String perspectiveName, String unitOfMeasureName,
                      Long orgUnitId, String orgUnitCode, String orgUnitName,
                      BigDecimal weight, BigDecimal targetQ1, BigDecimal targetQ2, BigDecimal targetH1, BigDecimal targetQ3,
                      BigDecimal targetQ4, BigDecimal targetYear, String note) {}

    private static List<ImportHandler.Column> numberCols() {
        return List.of(
                new ImportHandler.Column("weight", "Trọng số", false, "10", "1–100"),
                new ImportHandler.Column("q1", "Quý I", false, "25", "Số ≥ 0"),
                new ImportHandler.Column("q2", "Quý II", false, "50", null),
                new ImportHandler.Column("h1", "6T ĐN", false, "50", null),
                new ImportHandler.Column("q3", "Quý III", false, "75", null),
                new ImportHandler.Column("q4", "Quý IV", false, "100", null),
                new ImportHandler.Column("year", "Cả năm", true, "100", "Bắt buộc khi chốt"),
                new ImportHandler.Column("note", "Ghi chú", false, "", null));
    }

    abstract class Base implements ImportHandler<Row> {
        @Override public String permission() { return PermissionCodes.ASSIGN_IMPORT; }

        Row numbers(Map<String, String> c, List<String> e, Kpi k, OrgUnit u) {
            BigDecimal w = ExcelParse.decimal(c.get("weight"), "Trọng số", e);
            if (w != null && (w.compareTo(BigDecimal.ONE) < 0 || w.compareTo(new BigDecimal("100")) > 0)) e.add("Trọng số phải từ 1 đến 100");
            BigDecimal q1 = nonNeg(c.get("q1"), "Quý I", e), q2 = nonNeg(c.get("q2"), "Quý II", e), h1 = nonNeg(c.get("h1"), "6T ĐN", e),
                    q3 = nonNeg(c.get("q3"), "Quý III", e), q4 = nonNeg(c.get("q4"), "Quý IV", e), y = nonNeg(c.get("year"), "Cả năm", e);
            return new Row(k == null ? null : k.getId(), k == null ? null : k.getCode(), k == null ? null : k.getName(),
                    k == null ? null : k.getParentId(), k == null ? null : k.getPerspectiveName(), k == null ? null : k.getUnitOfMeasureName(),
                    u == null ? null : u.getId(), u == null ? null : u.getCode(), u == null ? null : u.getName(), w, q1, q2, h1, q3, q4, y, c.get("note"));
        }

        @Override public void commit(List<Row> valid) { throw new UnsupportedOperationException(); }
    }

    /** Mẫu theo đơn vị: một dòng mỗi KPI */
    final class ByUnit extends Base {
        @Override public String name() { return "Giao KPI theo đơn vị"; }

        @Override
        public List<Column> columns() {
            List<Column> c = new ArrayList<>(List.of(new Column("kpiCode", "Mã KPI", true, "TC-002", "Mã tiêu chí KPI (xem sheet KPI)")));
            c.addAll(numberCols());
            return c;
        }

        @Override
        public Map<String, List<String[]>> lookups() {
            return Map.of("KPI", kpiMapper.options(new java.util.HashMap<>(), 2000).stream().map(k -> new String[]{k.getCode(), k.getName()}).toList());
        }

        @Override
        public Row parse(Map<String, String> c, List<String> e) {
            Kpi k = c.get("kpiCode") == null ? null : kpiMapper.findByCode(c.get("kpiCode"));
            if (c.get("kpiCode") != null && k == null) e.add("Mã KPI không tồn tại");
            return numbers(c, e, k, null);
        }

        @Override
        public void validateBatch(List<ImportRow<Row>> rows) {
            Set<Long> seen = new HashSet<>();
            for (ImportRow<Row> r : rows) if (r.getRecord() != null && r.getRecord().kpiId() != null && !seen.add(r.getRecord().kpiId())) r.addError("Trùng Mã KPI trong file");
        }
    }

    /** Mẫu theo chỉ tiêu: một dòng mỗi đơn vị */
    final class ByKpi extends Base {
        @Override public String name() { return "Giao KPI theo chỉ tiêu"; }

        @Override
        public List<Column> columns() {
            List<Column> c = new ArrayList<>(List.of(new Column("unitCode", "Mã đơn vị", true, "VNPT_HNI", "Đơn vị có “Giao KPI” (xem sheet Don vi)")));
            c.addAll(numberCols());
            return c;
        }

        @Override
        public Map<String, List<String[]>> lookups() {
            return Map.of("Don vi", orgMapper.findAllActive(null, true).stream().map(o -> new String[]{o.getCode(), o.getName()}).toList());
        }

        @Override
        public Row parse(Map<String, String> c, List<String> e) {
            OrgUnit u = c.get("unitCode") == null ? null : orgMapper.findByCode(c.get("unitCode"));
            if (c.get("unitCode") != null && u == null) e.add("Mã đơn vị không tồn tại");
            else if (u != null && !Boolean.TRUE.equals(u.getIsKpiAssignable())) e.add("Đơn vị không được giao KPI");
            return numbers(c, e, null, u);
        }

        @Override
        public void validateBatch(List<ImportRow<Row>> rows) {
            Set<Long> seen = new HashSet<>();
            for (ImportRow<Row> r : rows) if (r.getRecord() != null && r.getRecord().orgUnitId() != null && !seen.add(r.getRecord().orgUnitId())) r.addError("Trùng Mã đơn vị trong file");
        }
    }

    private static BigDecimal nonNeg(String s, String label, List<String> e) {
        BigDecimal v = ExcelParse.decimal(s, label, e);
        if (v != null && v.signum() < 0) e.add("“" + label + "” phải ≥ 0");
        return v;
    }

    private Base handler(String mode) {
        return "kpi".equals(mode) ? new ByKpi() : new ByUnit();
    }

    public byte[] template(String mode) {
        return importService.template(handler(mode));
    }

    /** Kiểm tra file và trả dữ liệu hợp lệ để cập nhật lên màn hình nhập giao */
    public Map<String, Object> parse(String mode, MultipartFile file) {
        Base h = handler(mode);
        List<ImportRow<Row>> rows = importService.parseFile(h, file);
        for (ImportRow<Row> r : rows) {
            List<String> e = new ArrayList<>();
            for (ImportHandler.Column c : h.columns()) if (c.required() && r.getData().get(c.key()) == null) e.add("Thiếu “" + c.header() + "”");
            Row rec = h.parse(r.getData(), e);
            e.forEach(r::addError);
            r.setRecord(rec);
        }
        h.validateBatch(rows);
        List<Row> valid = rows.stream().filter(ImportRow::isValid).map(ImportRow::getRecord).toList();
        List<Map<String, Object>> errors = rows.stream().filter(r -> !r.isValid()).map(r -> Map.<String, Object>of("row", r.getRow(), "message", r.getErrorMessage())).toList();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("rows", valid);
        m.put("errors", errors);
        m.put("message", "Đã cập nhật " + valid.size() + "/" + rows.size() + " dòng lên màn hình; " + errors.size() + " dòng lỗi");
        return m;
    }

    /** 35.2 Xuất dữ liệu – Giao KPI theo đơn vị: sheet tổng hợp + sheet chi tiết KPI từng đơn vị */
    public byte[] export(List<Header> headers, List<Detail> details) {
        List<ExcelColumn<Header>> h = List.of(
                ExcelColumn.of("Mã đơn vị", Header::getOrgUnitCode),
                ExcelColumn.of("Đơn vị được giao", Header::getOrgUnitName, 40),
                ExcelColumn.of("Năm", Header::getYear),
                ExcelColumn.of("Số KPI", Header::getKpiCount),
                ExcelColumn.of("Tổng trọng số", Header::getTotalWeight),
                ExcelColumn.of("Trạng thái", x -> Labels.of(Labels.ASSIGN_STATUS, x.getStatus())),
                ExcelColumn.of("Ngày tạo", Header::getCreatedAt),
                ExcelColumn.of("Ngày cập nhật", Header::getUpdatedAt));
        List<ExcelColumn<Detail>> d = List.of(
                ExcelColumn.of("Mã đơn vị", Detail::getOrgUnitCode),
                ExcelColumn.of("Đơn vị được giao", Detail::getOrgUnitName, 35),
                ExcelColumn.of("Năm", Detail::getYear),
                ExcelColumn.of("Mã KPI", Detail::getKpiCode),
                ExcelColumn.of("Tên tiêu chí KPI", Detail::getKpiName, 45),
                ExcelColumn.of("Viễn cảnh", Detail::getPerspectiveName),
                ExcelColumn.of("Đơn vị đo", Detail::getUnitOfMeasureName),
                ExcelColumn.of("Trọng số", Detail::getWeight),
                ExcelColumn.of("Quý I", x -> eff(x.getAdjQ1(), x.getTargetQ1())),
                ExcelColumn.of("Quý II", x -> eff(x.getAdjQ2(), x.getTargetQ2())),
                ExcelColumn.of("6T ĐN", x -> eff(x.getAdjH1(), x.getTargetH1())),
                ExcelColumn.of("Quý III", x -> eff(x.getAdjQ3(), x.getTargetQ3())),
                ExcelColumn.of("Quý IV", x -> eff(x.getAdjQ4(), x.getTargetQ4())),
                ExcelColumn.of("Cả năm", Detail::getTargetYear),
                ExcelColumn.of("Ghi chú", Detail::getNote, 30),
                ExcelColumn.of("Trạng thái", x -> Labels.of(Labels.ASSIGN_STATUS, x.getStatus())));
        return ExcelExporter.exportSheets(List.of(
                new ExcelExporter.SheetSpec<>("Tong hop", "TỔNG HỢP GIAO KPI THEO ĐƠN VỊ", h, headers),
                new ExcelExporter.SheetSpec<>("Chi tiet KPI", "CHI TIẾT KPI GIAO CHO TỪNG ĐƠN VỊ", d, details)));
    }

    private static BigDecimal eff(BigDecimal adj, BigDecimal target) {
        return adj != null ? adj : target;
    }
}
