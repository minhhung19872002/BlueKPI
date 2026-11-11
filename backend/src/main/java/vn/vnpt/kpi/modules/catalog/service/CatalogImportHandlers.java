package vn.vnpt.kpi.modules.catalog.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.common.Labels;
import vn.vnpt.kpi.common.excel.ExcelParse;
import vn.vnpt.kpi.common.excel.ImportHandler;
import vn.vnpt.kpi.common.excel.ImportRow;
import vn.vnpt.kpi.modules.catalog.mapper.CatalogMapper;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.Perspective;
import vn.vnpt.kpi.security.PermissionCodes;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Nhập dữ liệu: Đơn vị đo (26.7), Viễn cảnh (26.15), Mục tiêu trọng tâm (28.7) */
public final class CatalogImportHandlers {
    private CatalogImportHandlers() {}

    private static List<String[]> activeLookup() {
        return Labels.ACTIVE.entrySet().stream().map(e -> new String[]{e.getKey(), e.getValue()}).toList();
    }

    private static <R> void uniqueBy(List<ImportRow<R>> rows, java.util.function.Function<R, String> key, String msg) {
        Set<String> seen = new HashSet<>();
        for (ImportRow<R> r : rows) {
            if (r.getRecord() == null) continue;
            String k = key.apply(r.getRecord());
            if (k != null && !seen.add(k.toLowerCase())) r.addError(msg);
        }
    }

    @Component
    @RequiredArgsConstructor
    public static class UomImport implements ImportHandler<CatalogService.UomRequest> {
        private final CatalogMapper mapper;
        private final CatalogService service;

        @Override public String name() { return "Danh sách đơn vị đo"; }
        @Override public String permission() { return PermissionCodes.UOM_IMPORT; }

        @Override
        public List<Column> columns() {
            return List.of(new Column("name", "Tên đơn vị đo", true, "Tỷ đồng", "Duy nhất"),
                    new Column("description", "Mô tả", false, "Đơn vị tiền tệ", null),
                    new Column("status", "Trạng thái", true, "Hiệu lực", "Hiệu lực/Không hiệu lực"));
        }

        @Override public Map<String, List<String[]>> lookups() { return Map.of("Trang thai", activeLookup()); }

        @Override
        public CatalogService.UomRequest parse(Map<String, String> c, List<String> errors) {
            ExcelParse.maxLen(c.get("name"), 255, "Tên đơn vị đo", errors);
            if (c.get("name") != null && mapper.findUomByName(c.get("name")) != null) errors.add("Tên đơn vị đo đã tồn tại");
            String st = Labels.codeOf(Labels.ACTIVE, c.get("status"));
            if (c.get("status") != null && st == null) errors.add("Trạng thái không hợp lệ");
            return new CatalogService.UomRequest(c.get("name"), c.get("description"), st, null);
        }

        @Override public void validateBatch(List<ImportRow<CatalogService.UomRequest>> rows) { uniqueBy(rows, CatalogService.UomRequest::name, "Trùng tên đơn vị đo trong file"); }

        @Override public void commit(List<CatalogService.UomRequest> valid) { valid.forEach(service::createUom); }
    }

    @Component
    @RequiredArgsConstructor
    public static class PerspectiveImport implements ImportHandler<CatalogService.PerspectiveRequest> {
        private final CatalogMapper mapper;
        private final CatalogService service;

        @Override public String name() { return "Danh sách viễn cảnh"; }
        @Override public String permission() { return PermissionCodes.PERSPECTIVE_IMPORT; }

        @Override
        public List<Column> columns() {
            return List.of(new Column("code", "Mã viễn cảnh", true, "MT", "Chữ in hoa/số, ≤ 10 ký tự; dùng làm tiền tố mã KPI"),
                    new Column("name", "Tên viễn cảnh", true, "Môi trường", null),
                    new Column("sortOrder", "Thứ tự", false, "5", "Số nguyên"),
                    new Column("description", "Mô tả", false, "", null),
                    new Column("color", "Màu", false, "#0EA5E9", "#RRGGBB"),
                    new Column("status", "Trạng thái", true, "Hiệu lực", "Hiệu lực/Không hiệu lực"));
        }

        @Override public Map<String, List<String[]>> lookups() { return Map.of("Trang thai", activeLookup()); }

        @Override
        public CatalogService.PerspectiveRequest parse(Map<String, String> c, List<String> errors) {
            String code = c.get("code") == null ? null : c.get("code").toUpperCase();
            if (code != null && !code.matches("^[A-Z0-9]{1,10}$")) errors.add("Mã viễn cảnh không hợp lệ");
            if (code != null && mapper.findPerspectiveByCode(code) != null) errors.add("Mã viễn cảnh đã tồn tại");
            Integer sort = ExcelParse.integer(c.get("sortOrder"), "Thứ tự", errors);
            String color = c.get("color");
            if (color != null && !color.matches("^#[0-9A-Fa-f]{6}$")) errors.add("Màu phải theo định dạng #RRGGBB");
            String st = Labels.codeOf(Labels.ACTIVE, c.get("status"));
            if (c.get("status") != null && st == null) errors.add("Trạng thái không hợp lệ");
            return new CatalogService.PerspectiveRequest(code, c.get("name"), sort, c.get("description"), color, st, null);
        }

        @Override public void validateBatch(List<ImportRow<CatalogService.PerspectiveRequest>> rows) { uniqueBy(rows, CatalogService.PerspectiveRequest::code, "Trùng mã viễn cảnh trong file"); }

        @Override public void commit(List<CatalogService.PerspectiveRequest> valid) { valid.forEach(service::createPerspective); }
    }

    @Component
    @RequiredArgsConstructor
    public static class ObjectiveImport implements ImportHandler<CatalogService.ObjectiveRequest> {
        private final CatalogMapper mapper;
        private final CatalogService service;

        @Override public String name() { return "Danh sách mục tiêu trọng tâm"; }
        @Override public String permission() { return PermissionCodes.OBJECTIVE_IMPORT; }

        @Override
        public List<Column> columns() {
            return List.of(new Column("code", "Mã mục tiêu", true, "MT-TC-05", "Duy nhất"),
                    new Column("name", "Tên mục tiêu", true, "Tăng doanh thu dịch vụ số", null),
                    new Column("perspectiveCode", "Mã viễn cảnh", true, "TC", "Xem sheet Vien canh"),
                    new Column("description", "Mô tả", false, "", null));
        }

        @Override
        public Map<String, List<String[]>> lookups() {
            return Map.of("Vien canh", mapper.allPerspectives().stream().map(p -> new String[]{p.getCode(), p.getName()}).toList());
        }

        @Override
        public CatalogService.ObjectiveRequest parse(Map<String, String> c, List<String> errors) {
            if (c.get("code") != null && mapper.findObjectiveByCode(c.get("code")) != null) errors.add("Mã mục tiêu đã tồn tại");
            Long pid = null;
            if (c.get("perspectiveCode") != null) {
                Perspective p = mapper.findPerspectiveByCode(c.get("perspectiveCode").toUpperCase());
                if (p == null) errors.add("Mã viễn cảnh không tồn tại");
                else pid = p.getId();
            }
            ExcelParse.maxLen(c.get("name"), 500, "Tên mục tiêu", errors);
            return new CatalogService.ObjectiveRequest(c.get("code"), c.get("name"), pid, c.get("description"), null);
        }

        @Override public void validateBatch(List<ImportRow<CatalogService.ObjectiveRequest>> rows) { uniqueBy(rows, CatalogService.ObjectiveRequest::code, "Trùng mã mục tiêu trong file"); }

        @Override public void commit(List<CatalogService.ObjectiveRequest> valid) { valid.forEach(service::createObjective); }
    }
}
