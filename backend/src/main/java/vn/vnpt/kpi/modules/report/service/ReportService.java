package vn.vnpt.kpi.modules.report.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.common.Labels;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.audit.AuditService;
import vn.vnpt.kpi.modules.assignment.mapper.AssignmentMapper;
import vn.vnpt.kpi.modules.assignment.model.AssignmentModels.Detail;
import vn.vnpt.kpi.modules.assignment.model.AssignmentModels.Header;
import vn.vnpt.kpi.modules.bsc.mapper.BscMapper;
import vn.vnpt.kpi.modules.evaluation.mapper.EvaluationMapper;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.Result;
import vn.vnpt.kpi.modules.org.mapper.OrgUnitMapper;
import vn.vnpt.kpi.modules.org.model.OrgUnit;
import vn.vnpt.kpi.modules.report.service.ReportTemplateService.Col;
import vn.vnpt.kpi.modules.report.service.ReportTemplateService.Spec;
import vn.vnpt.kpi.security.DataScope;
import vn.vnpt.kpi.security.DataScopeService;
import vn.vnpt.kpi.security.PermissionCodes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Predicate;

/**
 * Báo cáo theo mẫu (JXLS): “Báo cáo TTr94 tổng hợp BSC” (51.x), “Báo cáo TTr94 chi tiết KPI” (52.x),
 * “Báo cáo KPI từng tỉnh” (53.x), “Biểu giao KPI” (45.1), “Biểu kết quả KPI” (45.2).
 */
@Service
@RequiredArgsConstructor
public class ReportService {
    public record ReportRequest(String scope, Integer year, String period) {}

    static final List<String> INFO = List.of("Phạm vi đơn vị: ${scopeName}", "Năm: ${year}    Kỳ đánh giá: ${periodName}", "Ngày xuất: ${exportDate}");

    static final Spec TONG_HOP = new Spec("BÁO CÁO TTr94 TỔNG HỢP BSC", INFO,
            List.of(Col.t("STT", "${r.stt}", 6), Col.t("Mã đơn vị", "${r.unitCode}", 16), Col.t("Tên đơn vị", "${r.unitName}", 40),
                    Col.n("Tổng số KPI giao", "${r.totalKpi}", 12), Col.n("KPI đạt/vượt", "${r.achieved}", 12), Col.n("KPI chưa đạt", "${r.notAchieved}", 12),
                    Col.n("KPI đang theo dõi", "${r.tracking}", 12), Col.n("% TH/KH kỳ", "${r.completionRate}", 12), Col.n("Điểm BSC", "${r.bscScore}", 10),
                    Col.t("Hạng trong khối", "${r.rank}", 10)), null, null);
    static final List<Col> DETAIL_COLS = List.of(Col.t("STT", "${r.stt}", 6), Col.t("Mã đơn vị", "${r.unitCode}", 14), Col.t("Tên đơn vị", "${r.unitName}", 30),
            Col.t("Mã KPI", "${r.kpiCode}", 12), Col.t("Tên tiêu chí KPI", "${r.kpiName}", 40), Col.t("Viễn cảnh", "${r.perspective}", 16),
            Col.t("Đơn vị đo", "${r.uom}", 10), Col.n("Trọng số", "${r.weight}", 9), Col.n("KH giao", "${r.plan}", 12), Col.n("Kết quả", "${r.result}", 12),
            Col.n("% TH/KH", "${r.rate}", 10), Col.n("Điểm", "${r.score}", 8), Col.t("Đánh giá", "${r.rating}", 12), Col.t("Tình trạng", "${r.status}", 18));
    static final Spec CHI_TIET = new Spec("BÁO CÁO TTr94 CHI TIẾT KPI", INFO, DETAIL_COLS, null, null);
    static final Spec TUNG_TINH = new Spec("BÁO CÁO KPI TỪNG TỈNH", INFO, DETAIL_COLS.stream().filter(c -> !c.header().equals("Mã đơn vị") && !c.header().equals("Tên đơn vị")).toList(),
            "groups", null);
    static final Spec BIEU_GIAO = new Spec("BIỂU GIAO KPI", List.of("Đơn vị: ${unitName}", "Năm giao: ${year}", "Trạng thái: ${status}", "Ngày xuất: ${exportDate}"),
            List.of(Col.t("STT", "${r.stt}", 6), Col.t("Mã KPI", "${r.kpiCode}", 12), Col.t("Tên tiêu chí KPI", "${r.kpiName}", 45), Col.t("Viễn cảnh", "${r.perspective}", 16),
                    Col.t("Đơn vị đo", "${r.uom}", 10), Col.n("Trọng số", "${r.weight}", 9), Col.n("Quý I", "${r.q1}", 11), Col.n("Quý II", "${r.q2}", 11),
                    Col.n("6T ĐN", "${r.h1}", 11), Col.n("Quý III", "${r.q3}", 11), Col.n("Quý IV", "${r.q4}", 11), Col.n("Cả năm", "${r.y}", 11),
                    Col.t("Ghi chú", "${r.note}", 20)), null, "Tổng trọng số: ${totalWeight}");
    static final Spec BIEU_KQ = new Spec("BIỂU KẾT QUẢ KPI", List.of("Đơn vị: ${unitName}", "Năm: ${year}    Kỳ đánh giá: ${periodName}", "Ngày xuất: ${exportDate}"),
            DETAIL_COLS.stream().filter(c -> !c.header().equals("Mã đơn vị") && !c.header().equals("Tên đơn vị")).toList(), null, "Điểm BSC đơn vị: ${bsc}");

    private final ReportTemplateService templates;
    private final BscMapper bscMapper;
    private final EvaluationMapper evalMapper;
    private final AssignmentMapper assignMapper;
    private final OrgUnitMapper orgMapper;
    private final DataScopeService scopes;
    private final AuditService audit;

    public static String fileName(String code) {
        return switch (code) {
            case "TTR94_TONG_HOP" -> "BaoCaoTTr94TongHopBSC";
            case "TTR94_CHI_TIET" -> "BaoCaoTTr94ChiTietKPI";
            case "KPI_TUNG_TINH" -> "BaoCaoKPITungTinh";
            case "BIEU_GIAO_KPI" -> "BieuGiaoKPI";
            case "BIEU_KET_QUA_KPI" -> "BieuKetQuaKPI";
            default -> code;
        };
    }

    /** POST /reports/{templateCode} — scope: ALL | PROVINCES | CORPS | &lt;id đơn vị&gt; */
    public byte[] render(String code, ReportRequest req) {
        if (req == null || req.year() == null || req.period() == null || req.scope() == null) {
            throw new BusinessException(ErrorCode.ERR_VALIDATION, "Vui lòng chọn Phạm vi đơn vị, Năm, Kỳ đánh giá");
        }
        Predicate<Map<String, Object>> inScope = scopeFilter(req.scope());
        Map<String, Object> vars = base(req);
        byte[] out = switch (code) {
            case "TTR94_TONG_HOP" -> {
                List<Map<String, Object>> rows = new ArrayList<>();
                for (Map<String, Object> s : bscMapper.summaries(req.year(), req.period())) {
                    if (!inScope.test(s)) continue;
                    Map<String, Object> r = new LinkedHashMap<>(s);
                    r.put("stt", rows.size() + 1);
                    r.put("rank", s.get("rankInGroup") == null ? "" : s.get("rankInGroup"));
                    rows.add(r);
                }
                vars.put("rows", rows);
                yield templates.render(code, TONG_HOP, vars);
            }
            case "TTR94_CHI_TIET" -> {
                vars.put("rows", detailRows(req, inScope));
                yield templates.render(code, CHI_TIET, vars);
            }
            case "KPI_TUNG_TINH" -> {
                Map<String, Map<String, Object>> groups = new LinkedHashMap<>();
                for (Map<String, Object> r : detailRows(req, s -> "VNPT_TINH".equals(s.get("unitType")) && inScope.test(s))) {
                    Map<String, Object> g = groups.computeIfAbsent((String) r.get("unitCode"), k -> {
                        Map<String, Object> x = new LinkedHashMap<>();
                        x.put("name", r.get("unitCode") + " – " + r.get("unitName"));
                        x.put("rows", new ArrayList<Map<String, Object>>());
                        return x;
                    });
                    @SuppressWarnings("unchecked") List<Map<String, Object>> rs = (List<Map<String, Object>>) g.get("rows");
                    Map<String, Object> copy = new LinkedHashMap<>(r);
                    copy.put("stt", rs.size() + 1);
                    rs.add(copy);
                }
                vars.put("groups", new ArrayList<>(groups.values()));
                yield templates.render(code, TUNG_TINH, vars);
            }
            default -> throw new BusinessException(ErrorCode.ERR_BAD_REQUEST, "Mẫu báo cáo không hợp lệ");
        };
        audit.log("XUAT_BAO_CAO", "report_template", code, null, req);
        return out;
    }

    /** 45.1 Xuất biểu giao KPI theo mẫu BIEU_GIAO_KPI */
    public byte[] assignmentSheet(Long unitId, int year) {
        scopes.assertUnit(PermissionCodes.BSC_REPORT, unitId);
        Header h = assignMapper.findHeaderByUnitYear(unitId, year);
        if (h == null) throw new BusinessException(ErrorCode.ERR_NOT_FOUND, "Đơn vị chưa được giao KPI năm " + year);
        List<Map<String, Object>> rows = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        int i = 0;
        for (Detail d : assignMapper.findDetailsOfHeader(h.getId())) {
            Map<String, Object> r = new LinkedHashMap<>();
            r.put("stt", d.getParentKpiId() == null ? String.valueOf(++i) : "");
            r.put("kpiCode", d.getKpiCode());
            r.put("kpiName", (d.getParentKpiId() == null ? "" : "   ↳ ") + d.getKpiName());
            r.put("perspective", d.getPerspectiveName());
            r.put("uom", d.getUnitOfMeasureName());
            r.put("weight", d.getWeight());
            r.put("q1", eff(d.getAdjQ1(), d.getTargetQ1()));
            r.put("q2", eff(d.getAdjQ2(), d.getTargetQ2()));
            r.put("h1", eff(d.getAdjH1(), d.getTargetH1()));
            r.put("q3", eff(d.getAdjQ3(), d.getTargetQ3()));
            r.put("q4", eff(d.getAdjQ4(), d.getTargetQ4()));
            r.put("y", d.getTargetYear());
            r.put("note", d.getNote());
            if (d.getParentKpiId() == null && d.getWeight() != null) total = total.add(d.getWeight());
            rows.add(r);
        }
        Map<String, Object> vars = new HashMap<>();
        vars.put("rows", rows);
        vars.put("unitName", h.getOrgUnitName());
        vars.put("year", year);
        vars.put("status", Labels.of(Labels.ASSIGN_STATUS, h.getStatus()));
        vars.put("exportDate", today());
        vars.put("totalWeight", total.stripTrailingZeros().toPlainString());
        audit.log("XUAT_BAO_CAO", "report_template", "BIEU_GIAO_KPI", null, Map.of("unitId", unitId, "year", year));
        return templates.render("BIEU_GIAO_KPI", BIEU_GIAO, vars);
    }

    /** 45.2 Xuất biểu kết quả KPI theo mẫu BIEU_KET_QUA_KPI */
    public byte[] resultSheet(Long unitId, int year, String period) {
        scopes.assertUnit(PermissionCodes.BSC_REPORT, unitId);
        OrgUnit u = orgMapper.findById(unitId);
        if (u == null) throw BusinessException.notFound("đơn vị");
        List<Map<String, Object>> rows = detailRows(new ReportRequest(String.valueOf(unitId), year, period), s -> true);
        Map<String, Object> s = bscMapper.summaries(year, period).stream().filter(x -> unitId.equals(((Number) x.get("unitId")).longValue())).findFirst().orElse(null);
        Map<String, Object> vars = new HashMap<>();
        vars.put("rows", rows);
        vars.put("unitName", u.getName());
        vars.put("year", year);
        vars.put("periodName", Labels.of(Labels.PERIOD, period));
        vars.put("exportDate", today());
        vars.put("bsc", s == null || s.get("bscScore") == null ? "Chưa có" : ((BigDecimal) s.get("bscScore")).setScale(2, java.math.RoundingMode.HALF_UP).toPlainString().replace('.', ','));
        audit.log("XUAT_BAO_CAO", "report_template", "BIEU_KET_QUA_KPI", null, Map.of("unitId", unitId, "year", year, "period", period));
        return templates.render("BIEU_KET_QUA_KPI", BIEU_KQ, vars);
    }

    List<Map<String, Object>> detailRows(ReportRequest req, Predicate<Map<String, Object>> inScope) {
        Map<String, Object> f = new HashMap<>();
        f.put("year", req.year());
        f.put("period", req.period());
        if (req.scope().matches("\\d+")) f.put("unitId", Long.valueOf(req.scope()));
        PageQuery q = new PageQuery().forExport();
        q.applySort(Map.of(), "o.level, o.sort_order, o.code, pe.sort_order, COALESCE((SELECT pk.code FROM kpi pk WHERE pk.id = k.parent_id), k.code), k.code");
        DataScope scope = scopes.scopeFor(PermissionCodes.BSC_REPORT);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Result r : evalMapper.searchResults(f, scope, q)) {
            Map<String, Object> unit = Map.of("unitId", r.getOrgUnitId(), "unitType", r.getUnitType() == null ? "" : r.getUnitType(), "level", 2);
            if (!inScope.test(unit)) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("stt", out.size() + 1);
            m.put("unitCode", r.getOrgUnitCode());
            m.put("unitName", r.getOrgUnitName());
            m.put("unitType", r.getUnitType());
            m.put("kpiCode", r.getKpiCode());
            m.put("kpiName", (r.getParentKpiId() == null ? "" : "   ↳ ") + r.getKpiName());
            m.put("perspective", r.getPerspectiveName());
            m.put("uom", r.getUnitOfMeasureName());
            m.put("weight", r.getWeight());
            m.put("plan", r.getPlanValue());
            m.put("result", r.getFinalResult());
            m.put("rate", r.getCompletionRate());
            m.put("score", r.getScore());
            m.put("rating", Labels.of(Labels.RATING, r.getRating()));
            m.put("status", Labels.of(Labels.RESULT_STATUS, r.getStatus()));
            out.add(m);
        }
        return out;
    }

    private Predicate<Map<String, Object>> scopeFilter(String scope) {
        DataScope ds = scopes.scopeFor(PermissionCodes.BSC_REPORT);
        Predicate<Map<String, Object>> base = s -> ds.contains(((Number) s.get("unitId")).longValue());
        return switch (scope) {
            case "ALL" -> base;
            case "PROVINCES" -> base.and(s -> "VNPT_TINH".equals(s.get("unitType")));
            case "CORPS" -> base.and(s -> "TONG_CONG_TY".equals(s.get("unitType")) || "CONG_TY".equals(s.get("unitType")));
            default -> {
                long id = Long.parseLong(scope);
                List<Long> sub = scopes.subtree(id);
                yield base.and(s -> sub.contains(((Number) s.get("unitId")).longValue()));
            }
        };
    }

    private Map<String, Object> base(ReportRequest req) {
        Map<String, Object> vars = new HashMap<>();
        vars.put("year", req.year());
        vars.put("periodName", Labels.of(Labels.PERIOD, req.period()));
        vars.put("exportDate", today());
        vars.put("scopeName", switch (req.scope()) {
            case "ALL" -> "Toàn Tập đoàn";
            case "PROVINCES" -> "Khối VNPT tỉnh/thành phố";
            case "CORPS" -> "Khối Tổng công ty/Công ty";
            default -> {
                OrgUnit u = orgMapper.findById(Long.parseLong(req.scope()));
                yield u == null ? req.scope() : u.getName();
            }
        });
        return vars;
    }

    private static String today() { return LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")); }

    private static BigDecimal eff(BigDecimal adj, BigDecimal t) { return adj != null ? adj : t; }
}
