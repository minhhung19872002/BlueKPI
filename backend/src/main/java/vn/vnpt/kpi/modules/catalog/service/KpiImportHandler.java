package vn.vnpt.kpi.modules.catalog.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.common.Labels;
import vn.vnpt.kpi.common.excel.ExcelParse;
import vn.vnpt.kpi.common.excel.ImportHandler;
import vn.vnpt.kpi.common.excel.ImportRow;
import vn.vnpt.kpi.modules.catalog.dto.KpiRequest;
import vn.vnpt.kpi.modules.catalog.mapper.CatalogMapper;
import vn.vnpt.kpi.modules.catalog.mapper.KpiMapper;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels;
import vn.vnpt.kpi.modules.catalog.model.Kpi;
import vn.vnpt.kpi.modules.org.mapper.OrgUnitMapper;
import vn.vnpt.kpi.modules.org.model.OrgUnit;
import vn.vnpt.kpi.modules.user.mapper.UserMapper;
import vn.vnpt.kpi.modules.user.model.AppUser;
import vn.vnpt.kpi.security.PermissionCodes;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 23.6 Nhập dữ liệu – Danh sách KPI: các cột của form; “Mã KPI cha” để tạo cây (mã KPI đã có hoặc “Mã tham chiếu”
 * của dòng KPI cha trong cùng file); danh mục tra cứu theo mã.
 */
@Component
@RequiredArgsConstructor
public class KpiImportHandler implements ImportHandler<KpiImportHandler.Row> {
    public record Row(String ref, String parentRef, KpiRequest req) {}

    private final KpiMapper kpiMapper;
    private final CatalogMapper catalogMapper;
    private final OrgUnitMapper orgMapper;
    private final UserMapper userMapper;
    private final KpiService service;

    @Override public String name() { return "Danh sách KPI"; }
    @Override public String permission() { return PermissionCodes.KPI_IMPORT; }

    @Override
    public List<Column> columns() {
        return List.of(
                new Column("ref", "Mã tham chiếu", false, "R1", "Mã tạm của dòng để KPI con tham chiếu qua “Mã KPI cha”"),
                new Column("parentCode", "Mã KPI cha", false, "", "Mã KPI cha đã có (vd TC-001) hoặc Mã tham chiếu của dòng cha trong file"),
                new Column("name", "Tên tiêu chí", true, "Doanh thu dịch vụ số", null),
                new Column("groupAggregation", "Cách tính kết quả KPI Tập đoàn", true, "Tổng", "Tổng/Trung bình/Trung bình có trọng số/Lớn nhất/Nhỏ nhất/Nhập tay"),
                new Column("perspectiveCode", "Mã viễn cảnh", true, "TC", "Xem sheet Vien canh"),
                new Column("groupKpiCode", "Link với KPI tập đoàn", false, "", "Mã KPI tập đoàn"),
                new Column("targetDataType", "Loại số liệu giao", true, "Lũy kế", "Lũy kế/Theo kỳ/Cuối kỳ/Bình quân"),
                new Column("completionFormula", "Công thức tỷ lệ hoàn thành chỉ tiêu", false, "Thuận (TH/KH)", "THUAN/NGHICH"),
                new Column("scoringCode", "Mã phương pháp tính điểm", true, "KHUNG_TY_LE_5", "Xem sheet Phuong phap"),
                new Column("scoreByResult", "Tính điểm theo kết quả thực hiện", false, "Có", "Có/Không"),
                new Column("objectiveCode", "Mã mục tiêu trọng tâm", true, "", "Xem sheet Muc tieu"),
                new Column("weight", "Tỷ trọng (1–100)", false, "10", null),
                new Column("assigningUnitCode", "Mã đơn vị giao", true, "VNPT", null),
                new Column("assigningOfficer", "Cán bộ giao (tên đăng nhập)", true, "giaokpi", null),
                new Column("evaluatingUnitCode", "Mã đơn vị đánh giá", true, "VNPT", null),
                new Column("evaluatingOfficer", "Cán bộ đánh giá (tên đăng nhập)", true, "danhgia", null),
                new Column("dataSource", "Nguồn dữ liệu", false, "Nhập tay", "API/Nhập tay/Kết hợp"),
                new Column("uom", "Đơn vị đo", true, "Tỷ đồng", "Mã hoặc tên đơn vị đo"),
                new Column("isFocus", "Thuộc vùng chỉ đạo trọng tâm", false, "Không", "Có/Không"));
    }

    @Override
    public Map<String, List<String[]>> lookups() {
        Map<String, List<String[]>> m = new LinkedHashMap<>();
        m.put("Vien canh", catalogMapper.allPerspectives().stream().map(p -> new String[]{p.getCode(), p.getName()}).toList());
        m.put("Phuong phap", catalogMapper.allScoringMethods().stream().map(p -> new String[]{p.getCode(), p.getName()}).toList());
        var q = new vn.vnpt.kpi.common.PageQuery();
        q.forExport();
        q.applySort(Map.of(), "o.code");
        m.put("Muc tieu", catalogMapper.searchObjective(null, null, null, null, q).stream().map(o -> new String[]{o.getCode(), o.getName()}).toList());
        return m;
    }

    @Override
    public Row parse(Map<String, String> c, List<String> e) {
        String agg = Labels.codeOf(Labels.GROUP_AGG, c.get("groupAggregation"));
        if (c.get("groupAggregation") != null && (agg == null || "CONG_THUC".equals(agg))) e.add("Cách tính kết quả KPI Tập đoàn không hợp lệ");
        CatalogModels.Perspective p = c.get("perspectiveCode") == null ? null : catalogMapper.findPerspectiveByCode(c.get("perspectiveCode").toUpperCase());
        if (c.get("perspectiveCode") != null && p == null) e.add("Mã viễn cảnh không tồn tại");
        Long groupKpi = null;
        if (c.get("groupKpiCode") != null) {
            Kpi g = kpiMapper.findByCode(c.get("groupKpiCode"));
            if (g == null) e.add("Link với KPI tập đoàn không tồn tại");
            else groupKpi = g.getId();
        }
        String tdt = Labels.codeOf(Labels.TARGET_DATA_TYPE, c.get("targetDataType"));
        if (c.get("targetDataType") != null && tdt == null) e.add("Loại số liệu giao không hợp lệ");
        String cf = c.get("completionFormula") == null ? "THUAN" : Labels.codeOf(Labels.COMPLETION, c.get("completionFormula"));
        if (cf == null || "TUY_CHINH".equals(cf)) e.add("Công thức tỷ lệ hoàn thành không hợp lệ (THUAN/NGHICH)");
        CatalogModels.ScoringMethod sm = c.get("scoringCode") == null ? null : catalogMapper.findScoringMethodByCode(c.get("scoringCode"));
        if (c.get("scoringCode") != null && sm == null) e.add("Mã phương pháp tính điểm không tồn tại");
        CatalogModels.Objective ob = c.get("objectiveCode") == null ? null : catalogMapper.findObjectiveByCode(c.get("objectiveCode"));
        if (c.get("objectiveCode") != null && ob == null) e.add("Mã mục tiêu trọng tâm không tồn tại");
        if (ob != null && p != null && !ob.getPerspectiveId().equals(p.getId())) e.add("Mục tiêu trọng tâm không thuộc viễn cảnh");
        Integer w = ExcelParse.integer(c.get("weight"), "Tỷ trọng", e);
        if (w != null && (w < 1 || w > 100)) e.add("Tỷ trọng phải từ 1 đến 100");
        Long au = unit(c.get("assigningUnitCode"), "Mã đơn vị giao", e), eu = unit(c.get("evaluatingUnitCode"), "Mã đơn vị đánh giá", e);
        Long ao = user(c.get("assigningOfficer"), "Cán bộ giao", e), eo = user(c.get("evaluatingOfficer"), "Cán bộ đánh giá", e);
        String ds = c.get("dataSource") == null ? "NHAP_TAY" : Labels.codeOf(Labels.DATA_SOURCE, c.get("dataSource"));
        if (ds == null) e.add("Nguồn dữ liệu không hợp lệ");
        CatalogModels.Uom uom = c.get("uom") == null ? null : catalogMapper.findUomByCodeOrName(c.get("uom"));
        if (c.get("uom") != null && uom == null) e.add("Đơn vị đo không tồn tại");
        if (c.get("parentCode") != null && c.get("ref") != null && c.get("parentCode").equals(c.get("ref"))) e.add("KPI không thể là cha của chính nó");
        KpiRequest req = new KpiRequest(null, "DON_LE", c.get("name"), agg, null, p == null ? null : p.getId(), groupKpi, tdt, cf, null,
                sm == null ? null : sm.getId(), c.get("scoreByResult") == null || Boolean.TRUE.equals(ExcelParse.bool(c.get("scoreByResult"))),
                ob == null ? null : ob.getId(), w, au, ao, eu, eo, ds, uom == null ? null : uom.getId(), Boolean.TRUE.equals(ExcelParse.bool(c.get("isFocus"))),
                null, null, null, null, null);
        return new Row(c.get("ref"), c.get("parentCode"), req);
    }

    private Long unit(String code, String label, List<String> e) {
        if (code == null) return null;
        OrgUnit o = orgMapper.findByCode(code);
        if (o == null) e.add(label + " không tồn tại");
        return o == null ? null : o.getId();
    }

    private Long user(String username, String label, List<String> e) {
        if (username == null) return null;
        AppUser u = userMapper.findByUsername(username);
        if (u == null) e.add(label + " không tồn tại");
        return u == null ? null : u.getId();
    }

    @Override
    public void validateBatch(List<ImportRow<Row>> rows) {
        Map<String, Integer> refs = new HashMap<>();
        for (ImportRow<Row> r : rows) {
            if (r.getRecord() == null || r.getRecord().ref() == null) continue;
            if (refs.putIfAbsent(r.getRecord().ref(), r.getRow()) != null) r.addError("Trùng Mã tham chiếu trong file");
        }
        for (ImportRow<Row> r : rows) {
            Row x = r.getRecord();
            if (x == null || x.parentRef() == null) continue;
            Integer pr = refs.get(x.parentRef());
            if (pr != null) {
                if (pr > r.getRow()) r.addError("Dòng KPI cha phải đặt trước KPI con");
            } else {
                Kpi existing = kpiMapper.findByCode(x.parentRef());
                if (existing == null) r.addError("Mã KPI cha không tồn tại");
                else if (existing.getParentId() != null) r.addError("KPI cha không được là KPI con");
                else if (x.req().perspectiveId() != null && !existing.getPerspectiveId().equals(x.req().perspectiveId())) r.addError("KPI con phải cùng viễn cảnh với KPI cha");
            }
        }
    }

    @Override
    public void commit(List<Row> valid) {
        Map<String, List<Row>> childrenByRef = new LinkedHashMap<>();
        List<Row> roots = new ArrayList<>();
        for (Row r : valid) {
            if (r.parentRef() == null) roots.add(r);
            else childrenByRef.computeIfAbsent(r.parentRef(), k -> new ArrayList<>()).add(r);
        }
        for (Row r : roots) {
            List<Row> kids = r.ref() == null ? List.of() : childrenByRef.remove(r.ref());
            if (kids == null) kids = List.of();
            KpiRequest req = r.req();
            if (!kids.isEmpty()) {
                req = withStructure(req, "CHA_CON", kids.stream().map(Row::req).toList());
            }
            service.create(req);
        }
        // KPI con của KPI cha đã có trong hệ thống
        for (Map.Entry<String, List<Row>> e : childrenByRef.entrySet()) {
            Kpi parent = kpiMapper.findByCode(e.getKey());
            if (parent == null) continue;
            Kpi full = service.get(parent.getId());
            List<KpiRequest> kids = new ArrayList<>();
            for (Kpi c : full.getChildren()) kids.add(KpiRequests.fromEntity(c));
            e.getValue().forEach(r -> kids.add(r.req()));
            service.update(parent.getId(), withStructure(KpiRequests.fromEntity(full), "CHA_CON", kids));
        }
    }

    private static KpiRequest withStructure(KpiRequest r, String structure, List<KpiRequest> children) {
        return new KpiRequest(r.id(), structure, r.name(), r.groupAggregation(), r.groupExpression(), r.perspectiveId(), r.groupKpiId(), r.targetDataType(),
                r.completionFormula(), r.completionExpression(), r.scoringMethodId(), r.scoreByResult(), r.objectiveId(), r.weight(), r.assigningUnitId(),
                r.assigningOfficerId(), r.evaluatingUnitId(), r.evaluatingOfficerId(), r.dataSource(), r.unitOfMeasureId(), r.isFocus(), r.resultExpression(),
                r.components(), children, r.sortOrder(), r.version());
    }
}
