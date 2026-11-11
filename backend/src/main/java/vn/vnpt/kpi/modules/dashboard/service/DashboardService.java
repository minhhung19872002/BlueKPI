package vn.vnpt.kpi.modules.dashboard.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.common.Labels;
import vn.vnpt.kpi.common.excel.ExcelColumn;
import vn.vnpt.kpi.common.excel.ExcelExporter;
import vn.vnpt.kpi.engine.KpiCalculationEngine;
import vn.vnpt.kpi.engine.KpiCalculationEngine.RankItem;
import vn.vnpt.kpi.engine.KpiCalculationEngine.YearPair;
import vn.vnpt.kpi.modules.bsc.service.BscSummaryService;
import vn.vnpt.kpi.modules.dashboard.mapper.DashboardMapper;
import vn.vnpt.kpi.modules.strategy.mapper.StrategyMapper;
import vn.vnpt.kpi.modules.strategy.model.StrategyModels.MapNode;
import vn.vnpt.kpi.modules.strategy.model.StrategyModels.ObjectiveKpi;
import vn.vnpt.kpi.modules.strategy.service.StrategyService;
import vn.vnpt.kpi.modules.sysconfig.service.SysConfigService;
import vn.vnpt.kpi.security.CurrentUser;
import vn.vnpt.kpi.security.DataScope;
import vn.vnpt.kpi.security.DataScopeService;
import vn.vnpt.kpi.security.PermissionCodes;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

/**
 * Dashboard TGĐ BSC (STT 6 → 17.8).
 * Tham số: unit = GROUP (“1. Công ty mẹ – Tập đoàn”) | PROVINCES (“Khối VNPT tỉnh/thành phố”) | id đơn vị;
 * period = Q1..Q4 | H1 | Y | GD:&lt;id giai đoạn&gt; (lũy kế giai đoạn đến năm đang xem — PHẦN B §6.8).
 */
@Service
@RequiredArgsConstructor
public class DashboardService {
    public static final String GROUP = "GROUP", PROVINCES = "PROVINCES", UNIT = "UNIT";
    static final List<String> PERIODS = List.of("Q1", "Q2", "H1", "Q3", "Q4", "Y");
    static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final DashboardMapper mapper;
    private final StrategyMapper strategyMapper;
    private final StrategyService strategies;
    private final DataScopeService scopes;
    private final SysConfigService config;

    /** Phạm vi đã phân giải */
    public record Ctx(String mode, Map<String, Object> unit, List<Long> unitIds, int year, String period, Map<String, Object> stage, List<Integer> years) {
        boolean isStage() { return stage != null; }

        String dataPeriod() { return stage != null ? "Y" : period; }

        String periodParam() { return stage != null ? "GD:" + stage.get("id") : period; }

        Long unitId() { return unit == null ? null : ((Number) unit.get("id")).longValue(); }
    }

    // ============================== Phân giải bộ lọc + phân quyền ==============================
    public Ctx resolve(String unitParam, Integer yearParam, String periodParam) {
        CurrentUser u = CurrentUser.current();
        boolean group = u.has(PermissionCodes.DASHBOARD_VIEW_GROUP);
        Map<String, Object> defaults = defaults();
        String up = unitParam == null || unitParam.isBlank() ? (String) defaults.get("unit") : unitParam.trim();
        int year = yearParam != null ? yearParam : LocalDate.now().getYear();
        String mode;
        Map<String, Object> unit;
        List<Long> ids;
        Map<String, Object> root = mapper.rootUnit();
        if (GROUP.equals(up)) {
            if (!group) throw new BusinessException(ErrorCode.ERR_FORBIDDEN, "Bạn không có quyền xem biểu tổng hợp Tập đoàn");
            mode = GROUP;
            unit = root;
            ids = List.of(id(root));
        } else if (PROVINCES.equals(up)) {
            if (!group && !u.has(PermissionCodes.DASHBOARD_VIEW_PROVINCE)) throw new BusinessException(ErrorCode.ERR_FORBIDDEN, "Bạn không có quyền xem biểu tổng hợp khối VNPT tỉnh/thành phố");
            mode = PROVINCES;
            unit = null;
            ids = mapper.provinceIds();
        } else {
            long uid;
            try {
                uid = Long.parseLong(up);
            } catch (NumberFormatException e) {
                throw new BusinessException(ErrorCode.ERR_BAD_REQUEST, "Đơn vị không hợp lệ");
            }
            unit = mapper.unit(uid);
            if (unit == null) throw new BusinessException(ErrorCode.ERR_NOT_FOUND, "Không tìm thấy đơn vị");
            if (!group) scopes.assertUnit(PermissionCodes.DASHBOARD_VIEW_UNIT, uid);
            mode = uid == id(root) ? GROUP : UNIT;
            ids = List.of(uid);
        }
        String period = periodParam == null || periodParam.isBlank() ? (String) defaults.get("period") : periodParam.trim();
        Map<String, Object> stage = null;
        List<Integer> years = List.of(year);
        if (period.startsWith("GD:")) {
            stage = mapper.stage(Long.valueOf(period.substring(3)));
            if (stage == null) throw new BusinessException(ErrorCode.ERR_NOT_FOUND, "Không tìm thấy giai đoạn");
            int from = (Integer) stage.get("fromYear"), to = (Integer) stage.get("toYear");
            if (year < from || year > to) year = Math.min(Math.max(year, from), to);
            years = IntStream.rangeClosed(from, year).boxed().toList();
        } else if (!PERIODS.contains(period)) {
            throw new BusinessException(ErrorCode.ERR_BAD_REQUEST, "Kỳ đánh giá không hợp lệ");
        }
        return new Ctx(mode, unit, ids, year, period, stage, years);
    }

    /** 17.1 Mặc định: đơn vị cao nhất trong phạm vi, năm hiện tại, kỳ gần nhất đã có kết quả */
    public Map<String, Object> defaults() {
        CurrentUser u = CurrentUser.current();
        int year = LocalDate.now().getYear();
        Map<String, Object> root = mapper.rootUnit();
        String unit;
        Long unitId;
        if (u.has(PermissionCodes.DASHBOARD_VIEW_GROUP)) {
            unit = GROUP;
            unitId = id(root);
        } else {
            DataScope s = scopes.scopeFor(PermissionCodes.DASHBOARD_VIEW_UNIT);
            unitId = s.contains(u.getOrgUnitId()) ? u.getOrgUnitId() : s.unitIds().stream().min(Long::compare).orElse(u.getOrgUnitId());
            unit = String.valueOf(unitId);
        }
        String period = unitId == null ? null : mapper.latestPeriod(unitId, year);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("unit", unit);
        m.put("year", year);
        m.put("period", period == null ? "Y" : period);
        return m;
    }

    public Map<String, Object> filters() {
        CurrentUser u = CurrentUser.current();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("defaults", defaults());
        m.put("canGroup", u.has(PermissionCodes.DASHBOARD_VIEW_GROUP));
        m.put("canProvinces", u.has(PermissionCodes.DASHBOARD_VIEW_GROUP) || u.has(PermissionCodes.DASHBOARD_VIEW_PROVINCE));
        m.put("rootUnit", mapper.rootUnit());
        m.put("stages", mapper.stages());
        return m;
    }

    // ============================== Tổng quan (thẻ, gauge, chỉ đạo trọng tâm) ==============================
    public Map<String, Object> overview(Ctx c) {
        List<Map<String, Object>> kpis = kpis(c, false, null);
        Ctx prev = previous(c);
        List<Map<String, Object>> prevKpis = prev == null ? List.of() : kpis(prev, false, null);
        Map<String, Object> cards = cards(kpis), prevCards = prev == null ? null : cards(prevKpis);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("mode", c.mode());
        m.put("unit", c.unit());
        m.put("year", c.year());
        m.put("period", c.periodParam());
        m.put("periodName", periodName(c));
        m.put("stage", c.stage());
        m.put("lastUpdated", mapper.lastUpdated(c.unitIds(), c.years(), c.dataPeriod()));
        m.put("cards", cards);
        m.put("prevCards", prevCards);
        m.put("changes", changes(cards, prevCards));
        BigDecimal bsc = bsc(c);
        m.put("bsc", Map.of("score", opt(bsc), "prevScore", opt(prev == null ? null : bsc(prev)), "periodName", periodName(c),
                "prevPeriodName", prev == null ? "" : periodName(prev)));
        m.put("focus", kpis.stream().filter(k -> Boolean.TRUE.equals(k.get("isFocus")) || Objects.equals(k.get("isFocus"), 1)).toList());
        if (c.isStage()) m.put("stageYears", stageYears(c));
        if (UNIT.equals(c.mode()) && !c.isStage()) {
            mapper.summaries(c.unitIds(), null, null, List.of(c.year()), c.period()).stream().findFirst().ifPresent(s -> {
                m.put("rankInGroup", s.get("rankInGroup"));
                m.put("rankGroup", s.get("rankGroup"));
            });
        }
        return m;
    }

    private static Object opt(Object v) { return v == null ? "" : v; }

    /** Kỳ trước: theo BscSummaryService.previous; giai đoạn: lũy kế đến năm trước */
    Ctx previous(Ctx c) {
        if (c.isStage()) {
            if (c.years().size() <= 1) return null;
            List<Integer> ys = c.years().subList(0, c.years().size() - 1);
            return new Ctx(c.mode(), c.unit(), c.unitIds(), ys.get(ys.size() - 1), c.period(), c.stage(), ys);
        }
        String[] p = BscSummaryService.previous(c.year(), c.period());
        int y = Integer.parseInt(p[0]);
        return new Ctx(c.mode(), c.unit(), c.unitIds(), y, p[1], null, List.of(y));
    }

    public String periodName(Ctx c) {
        if (c.isStage()) return c.stage().get("name") + " (đến năm " + c.year() + ")";
        return Labels.of(Labels.PERIOD, c.period()) + " " + c.year();
    }

    private Map<String, Object> cards(List<Map<String, Object>> kpis) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("total", kpis.size());
        m.put("achieved", kpis.stream().filter(k -> "DAT_VUOT".equals(k.get("rating"))).count());
        m.put("notAchieved", kpis.stream().filter(k -> "CHUA_DAT".equals(k.get("rating"))).count());
        m.put("tracking", kpis.stream().filter(k -> "DANG_THEO_DOI".equals(k.get("rating"))).count());
        return m;
    }

    /** Tỷ lệ so với kỳ trước (%) */
    private static Map<String, Object> changes(Map<String, Object> cur, Map<String, Object> prev) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (String k : List.of("total", "achieved", "notAchieved", "tracking")) {
            long a = ((Number) cur.get(k)).longValue();
            Long b = prev == null ? null : ((Number) prev.get(k)).longValue();
            m.put(k, b == null || b == 0 ? "" : BigDecimal.valueOf(a - b).multiply(HUNDRED).divide(BigDecimal.valueOf(b), 2, RoundingMode.HALF_UP));
        }
        return m;
    }

    // ============================== Danh sách KPI (đã gộp theo phạm vi) ==============================
    /** Mỗi KPI gốc một dòng; gộp nhiều năm (giai đoạn) rồi nhiều đơn vị (khối tỉnh) */
    public List<Map<String, Object>> kpis(Ctx c, boolean focusOnly, Long kpiId) {
        if (c.unitIds().isEmpty()) return List.of();
        BigDecimal pass = config.getDecimal(SysConfigService.KPI_PASS_SCORE, BigDecimal.valueOf(3));
        List<Map<String, Object>> rows = mapper.kpiRows(c.unitIds(), c.years(), c.dataPeriod(), kpiId, focusOnly);
        Map<Long, List<Map<String, Object>>> byKpi = rows.stream().collect(Collectors.groupingBy(r -> lng(r.get("kpiId")), LinkedHashMap::new, Collectors.toList()));
        List<Map<String, Object>> out = new ArrayList<>();
        for (List<Map<String, Object>> kr : byKpi.values()) {
            Map<Long, List<Map<String, Object>>> byUnit = kr.stream().collect(Collectors.groupingBy(r -> lng(r.get("unitId")), LinkedHashMap::new, Collectors.toList()));
            List<Map<String, Object>> perUnit = byUnit.values().stream().map(ur -> c.isStage() ? stageRow(ur, c.year()) : ur.get(0)).toList();
            Map<String, Object> m = perUnit.size() == 1 ? new LinkedHashMap<>(perUnit.get(0)) : unitsRow(perUnit);
            BigDecimal score = dec(m.get("score"));
            m.put("rating", score == null ? "DANG_THEO_DOI" : score.compareTo(pass) >= 0 ? "DAT_VUOT" : "CHUA_DAT");
            m.put("ratingName", Labels.of(Labels.RATING, (String) m.get("rating")));
            m.put("unitCount", perUnit.size());
            m.remove("unitId");
            m.remove("updatedAt");
            out.add(m);
        }
        return out;
    }

    /** Lũy kế giai đoạn của một đơn vị: TH = Σ, % TH/KH = Σ TH / Σ KH, điểm = trung bình các năm có kết quả */
    private Map<String, Object> stageRow(List<Map<String, Object>> rows, int year) {
        Map<String, Object> last = rows.stream().filter(r -> ((Number) r.get("year")).intValue() == year).findFirst().orElse(rows.get(rows.size() - 1));
        Map<String, Object> m = new LinkedHashMap<>(last);
        m.put("finalResult", sum(rows, "finalResult"));
        m.put("planValue", sum(rows, "planValue"));
        m.put("completionRate", KpiCalculationEngine.stageCompletion(rows.stream().map(r -> new YearPair(dec(r.get("finalResult")), dec(r.get("planValue")))).toList()));
        m.put("yearCompletionRate", last.get("yearCompletionRate") != null ? last.get("yearCompletionRate") : last.get("completionRate"));
        m.put("score", avg(rows, "score"));
        m.put("bscScore", avg(rows, "bscScore"));
        return m;
    }

    /** Gộp nhiều đơn vị: TH, KH = Σ; % TH/KH, điểm = trung bình */
    private Map<String, Object> unitsRow(List<Map<String, Object>> rows) {
        Map<String, Object> m = new LinkedHashMap<>(rows.get(0));
        m.put("finalResult", sum(rows, "finalResult"));
        m.put("planValue", sum(rows, "planValue"));
        m.put("yearPlanValue", sum(rows, "yearPlanValue"));
        m.put("completionRate", avg(rows, "completionRate"));
        m.put("yearCompletionRate", avg(rows, "yearCompletionRate"));
        m.put("score", avg(rows, "score"));
        m.put("bscScore", avg(rows, "bscScore"));
        return m;
    }

    /** 17.3 / 17.4 Danh sách chi tiết các KPI (lọc theo thẻ, từ khóa, viễn cảnh) */
    public List<Map<String, Object>> kpiList(Ctx c, String card, String keyword, Long perspectiveId) {
        String rating = card == null ? null : switch (card) {
            case "ACHIEVED" -> "DAT_VUOT";
            case "NOT_ACHIEVED" -> "CHUA_DAT";
            case "TRACKING" -> "DANG_THEO_DOI";
            default -> null;
        };
        String kw = keyword == null || keyword.isBlank() ? null : keyword.trim().toLowerCase();
        return kpis(c, "FOCUS".equals(card), null).stream()
                .filter(k -> rating == null || rating.equals(k.get("rating")))
                .filter(k -> kw == null || ((String) k.get("kpiCode")).toLowerCase().contains(kw) || ((String) k.get("kpiName")).toLowerCase().contains(kw))
                .filter(k -> perspectiveId == null || perspectiveId.equals(lng(k.get("perspectiveId"))))
                .toList();
    }

    /** 17.5 Chi tiết KPI trọng tâm + phân rã kết quả các đơn vị con cùng được giao KPI */
    public Map<String, Object> breakdown(Ctx c, Long kpiId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("kpi", kpis(c, false, kpiId).stream().findFirst().orElseThrow(() -> new BusinessException(ErrorCode.ERR_NOT_FOUND, "KPI không được giao cho phạm vi đang xem")));
        List<Map<String, Object>> rows;
        int childCount;
        if (PROVINCES.equals(c.mode())) {
            rows = mapper.kpiRows(c.unitIds(), List.of(c.year()), c.dataPeriod(), kpiId, false).stream().map(r -> {
                Map<String, Object> x = new LinkedHashMap<>(r);
                x.put("unitName", unitName(lng(r.get("unitId"))));
                return x;
            }).toList();
            childCount = c.unitIds().size();
        } else {
            rows = mapper.breakdown(kpiId, c.unitId(), c.year(), c.dataPeriod());
            childCount = mapper.childCount(c.unitId());
        }
        rows = rows.stream().map(r -> {
            Map<String, Object> x = new LinkedHashMap<>(r);
            x.put("statusName", Labels.of(Labels.RESULT_STATUS, (String) r.get("status")));
            x.put("ratingName", Labels.of(Labels.RATING, (String) r.get("rating")));
            return x;
        }).toList();
        m.put("childCount", childCount);
        m.put("assignedCount", rows.size());
        m.put("rows", rows);
        m.put("message", rows.isEmpty() ? "Không có đơn vị con" : null);
        return m;
    }

    private final Map<Long, String> unitNames = new java.util.concurrent.ConcurrentHashMap<>();

    private String unitName(Long id) {
        return unitNames.computeIfAbsent(id, k -> {
            Map<String, Object> u = mapper.unit(k);
            return u == null ? "" : (String) u.get("name");
        });
    }

    // ============================== Điểm BSC ==============================
    BigDecimal bsc(Ctx c) {
        if (c.unitIds().isEmpty()) return null;
        List<Map<String, Object>> sums = mapper.summaries(c.unitIds(), null, null, c.years(), c.dataPeriod());
        Map<Long, List<BigDecimal>> byUnit = new LinkedHashMap<>();
        for (Map<String, Object> s : sums) byUnit.computeIfAbsent(lng(s.get("unitId")), k -> new ArrayList<>()).add(dec(s.get("bscScore")));
        List<BigDecimal> perUnit = byUnit.values().stream().map(v -> c.isStage() ? KpiCalculationEngine.stageBsc(v) : v.get(0)).filter(Objects::nonNull).toList();
        return avgOf(perUnit);
    }

    /** Biểu đồ giai đoạn: điểm BSC, % TH/KH từng năm (kỳ “Cả năm”) — nhấn cột → chuyển sang năm đó */
    List<Map<String, Object>> stageYears(Ctx c) {
        int from = (Integer) c.stage().get("fromYear"), to = (Integer) c.stage().get("toYear");
        List<Integer> all = IntStream.rangeClosed(from, to).boxed().toList();
        Map<Integer, List<Map<String, Object>>> byYear = mapper.summaries(c.unitIds(), null, null, all, "Y").stream()
                .collect(Collectors.groupingBy(s -> ((Number) s.get("year")).intValue()));
        return all.stream().map(y -> {
            List<Map<String, Object>> v = byYear.getOrDefault(y, List.of());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("year", y);
            m.put("bscScore", avgOf(v.stream().map(s -> dec(s.get("bscScore"))).filter(Objects::nonNull).toList()));
            m.put("completionRate", avgOf(v.stream().map(s -> dec(s.get("completionRate"))).filter(Objects::nonNull).toList()));
            return m;
        }).toList();
    }

    // ============================== Bảng xếp hạng khối tỉnh / các TCT-CT ==============================
    /** 6.1 “Bảng xếp hạng điểm BSC khối VNPT tỉnh/thành phố” và 12.1/13.1 bảng tổng hợp các tỉnh */
    public Map<String, Object> rankingProvinces(Ctx c, boolean all) {
        List<Map<String, Object>> rows = groupRows(c, BscSummaryService.GROUP_PROVINCE, null);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("total", rows.size());
        m.put("rows", all ? rows : rows.stream().limit(10).toList());
        return m;
    }

    /** “Điểm BSC các Tổng công ty/Công ty” */
    public List<Map<String, Object>> corporations(Ctx c) {
        return groupRows(c, BscSummaryService.GROUP_CORP, null);
    }

    /** 17.7 Bảng tổng hợp kết quả các KPI giao cho đơn vị (các đơn vị thành viên trực thuộc) */
    public Map<String, Object> corporationTable(Ctx c, Long corpId) {
        Map<String, Object> corp = mapper.unit(corpId);
        if (corp == null) throw new BusinessException(ErrorCode.ERR_NOT_FOUND, "Không tìm thấy đơn vị");
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("unit", corp);
        m.put("periodName", periodName(c));
        m.put("summary", groupRows(c, null, List.of(corpId)).stream().findFirst().orElse(null));
        m.put("rows", groupRows(c, null, corpId));
        return m;
    }

    public byte[] corporationTableExcel(Ctx c, Long corpId) {
        Map<String, Object> t = corporationTable(c, corpId);
        @SuppressWarnings("unchecked") List<Map<String, Object>> src = (List<Map<String, Object>>) t.get("rows");
        // “xuất đúng bảng đang xem” (17.8): giữ cột STT như trên dialog
        List<Map<String, Object>> rows = IntStream.range(0, src.size()).mapToObj(i -> {
            Map<String, Object> r = new LinkedHashMap<>(src.get(i));
            r.put("stt", i + 1);
            return r;
        }).toList();
        List<ExcelColumn<Map<String, Object>>> cols = List.of(
                ExcelColumn.of("STT", r -> r.get("stt"), 6),
                ExcelColumn.of("Đơn vị thành viên", r -> r.get("unitName"), 45), ExcelColumn.of("Tổng số KPI giao", r -> r.get("totalKpi")),
                ExcelColumn.of("KPI đạt", r -> r.get("achieved")), ExcelColumn.of("KPI cảnh báo", r -> r.get("warning")),
                ExcelColumn.of("% TH/KH kỳ", r -> r.get("completionRate")), ExcelColumn.of("Điểm BSC đơn vị (thang 5)", r -> r.get("bscScore")),
                ExcelColumn.of("Xếp hạng", r -> r.get("rank")));
        return ExcelExporter.export("Tong hop", "BẢNG TỔNG HỢP KẾT QUẢ CÁC KPI GIAO CHO " + String.valueOf(((Map<?, ?>) t.get("unit")).get("name")).toUpperCase()
                + " – " + t.get("periodName"), cols, rows);
    }

    /**
     * Dòng tổng hợp theo đơn vị: nhóm xếp hạng (rankGroup), hoặc đơn vị con của parentId (xếp hạng trong nhóm anh em), hoặc danh sách đơn vị (parentId = null, group = null → dùng unitIds).
     * Giai đoạn: điểm = trung bình điểm các năm; số KPI theo năm đang xem.
     */
    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> groupRows(Ctx c, String rankGroup, Object parentOrIds) {
        Long parentId = parentOrIds instanceof Long l ? l : null;
        List<Long> ids = parentOrIds instanceof List<?> li ? (List<Long>) li : null;
        List<Map<String, Object>> sums = mapper.summaries(ids, rankGroup, parentId, c.years(), c.dataPeriod());
        Map<Long, List<Map<String, Object>>> byUnit = sums.stream().collect(Collectors.groupingBy(s -> lng(s.get("unitId")), LinkedHashMap::new, Collectors.toList()));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (List<Map<String, Object>> v : byUnit.values()) {
            Map<String, Object> last = v.get(v.size() - 1);
            Map<String, Object> r = new LinkedHashMap<>(last);
            if (c.isStage()) {
                r.put("bscScore", KpiCalculationEngine.stageBsc(v.stream().map(s -> dec(s.get("bscScore"))).toList()));
                r.put("completionRate", avgOf(v.stream().map(s -> dec(s.get("completionRate"))).filter(Objects::nonNull).toList()));
                r.put("prevRank", null);
            }
            rows.add(r);
        }
        boolean recomputeRank = c.isStage() || rankGroup == null;
        if (recomputeRank) {
            Map<Long, Integer> rank = KpiCalculationEngine.rank(rows.stream().map(r -> new RankItem(lng(r.get("unitId")), (String) r.get("unitCode"), dec(r.get("bscScore")), dec(r.get("completionRate")))).toList());
            rows.forEach(r -> r.put("rank", rank.get(lng(r.get("unitId")))));
        } else {
            rows.forEach(r -> r.put("rank", r.get("rankInGroup")));
        }
        rows.forEach(r -> r.put("movement", KpiCalculationEngine.movement((Integer) r.get("prevRank"), (Integer) r.get("rank"))));
        rows.sort(Comparator.comparing((Map<String, Object> r) -> r.get("rank") == null ? Integer.MAX_VALUE : (Integer) r.get("rank")).thenComparing(r -> (String) r.get("unitCode")));
        return rows;
    }

    /** 14.1 Một tỉnh qua các kỳ đánh giá trong giai đoạn */
    public List<Map<String, Object>> provinceStage(Long unitId, Long stageId) {
        if (!CurrentUser.current().has(PermissionCodes.DASHBOARD_VIEW_GROUP)) scopes.assertUnit(PermissionCodes.DASHBOARD_VIEW_UNIT, unitId);
        Map<String, Object> st = mapper.stage(stageId);
        if (st == null) throw new BusinessException(ErrorCode.ERR_NOT_FOUND, "Không tìm thấy giai đoạn");
        List<Integer> years = IntStream.rangeClosed((Integer) st.get("fromYear"), (Integer) st.get("toYear")).boxed().toList();
        return mapper.summaries(List.of(unitId), null, null, years, null).stream()
                .filter(s -> ((Number) s.get("totalKpi")).intValue() > 0 && s.get("bscScore") != null)
                .map(s -> {
                    Map<String, Object> m = new LinkedHashMap<>(s);
                    m.put("periodName", Labels.of(Labels.PERIOD, (String) s.get("period")) + " " + s.get("year"));
                    return m;
                }).toList();
    }

    // ============================== 17.6 Xuất kết quả đánh giá KPI ==============================
    public byte[] exportResults(Ctx c) {
        Map<String, Object> o = overview(c);
        Map<String, Object> cards = castMap(o.get("cards"));
        Map<String, Object> bsc = castMap(o.get("bsc"));
        String unitName = c.unit() != null ? (String) c.unit().get("name") : "Khối VNPT tỉnh/thành phố";
        List<Object[]> summary = new ArrayList<>(List.of(
                new Object[]{"Đơn vị", unitName}, new Object[]{"Kỳ đánh giá", periodName(c)},
                new Object[]{"Tổng số KPI giao", cards.get("total")}, new Object[]{"KPI đạt/vượt", cards.get("achieved")},
                new Object[]{"KPI chưa đạt", cards.get("notAchieved")}, new Object[]{"KPI đang theo dõi", cards.get("tracking")},
                new Object[]{"Điểm BSC tổng hợp", bsc.get("score")}, new Object[]{"Điểm BSC kỳ trước", bsc.get("prevScore")},
                new Object[]{"Thời điểm cập nhật mới nhất", o.get("lastUpdated")}));
        List<ExcelColumn<Object[]>> sc = List.of(ExcelColumn.of("Chỉ tiêu", r -> r[0], 32), ExcelColumn.of("Giá trị", r -> r[1] instanceof String s && s.isEmpty() ? null : r[1], 40));
        List<ExcelColumn<Map<String, Object>>> dc = List.of(
                ExcelColumn.of("Mã KPI", r -> r.get("kpiCode"), 14), ExcelColumn.of("Tên chỉ tiêu KPI", r -> r.get("kpiName"), 45),
                ExcelColumn.of("Viễn cảnh", r -> r.get("perspectiveName"), 16), ExcelColumn.of("Đơn vị đo", r -> r.get("unitOfMeasureName")),
                ExcelColumn.of("KH giao kỳ", r -> r.get("planValue")), ExcelColumn.of("TH kỳ đánh giá", r -> r.get("finalResult")),
                ExcelColumn.of("% TH/KH kỳ", r -> r.get("completionRate")), ExcelColumn.of("% TH/KH năm", r -> r.get("yearCompletionRate")),
                ExcelColumn.of("Điểm đánh giá", r -> r.get("score")), ExcelColumn.of("Điểm BSC (thang 5)", r -> r.get("bscScore")),
                ExcelColumn.of("Đánh giá", r -> r.get("ratingName")));
        String title = "KẾT QUẢ ĐÁNH GIÁ KPI – " + unitName.toUpperCase() + " – " + periodName(c).toUpperCase();
        return ExcelExporter.exportSheets(List.of(new ExcelExporter.SheetSpec<>("Tong hop", title, sc, summary),
                new ExcelExporter.SheetSpec<>("Chi tiet KPI", title, dc, kpis(c, false, null))));
    }

    // ============================== 15.1 Bản đồ chiến lược (chỉ đọc) ==============================
    public Map<String, Object> strategyMap(Ctx c) {
        Long unitId = c.unitId() != null ? c.unitId() : id(mapper.rootUnit());
        Map<String, Object> map = strategies.mapForUnit(unitId, c.year());
        Map<String, Object> m = new LinkedHashMap<>();
        if (map == null) {
            m.put("message", "Chưa có bản đồ chiến lược cho đơn vị/kỳ đã chọn");
            return m;
        }
        m.putAll(map);
        Long sid = ((vn.vnpt.kpi.modules.strategy.model.StrategyModels.Strategy) map.get("strategy")).getId();
        @SuppressWarnings("unchecked") List<MapNode> nodes = (List<MapNode>) map.get("nodes");
        String period = c.isStage() ? null : c.period();
        Map<Long, List<ObjectiveKpi>> results = new HashMap<>();
        for (MapNode n : nodes) {
            List<ObjectiveKpi> ks = strategyMapper.objectiveKpis(sid, n.getObjectiveId(), unitId, c.year(), period);
            ks.forEach(k -> k.setPeriodName(Labels.of(Labels.PERIOD, k.getPeriodCode())));
            results.put(n.getObjectiveId(), ks);
        }
        m.put("kpiResults", results);
        m.put("periodName", periodName(c));
        return m;
    }

    // ============================== tiện ích ==============================
    private static long id(Map<String, Object> m) { return ((Number) m.get("id")).longValue(); }

    private static Long lng(Object o) { return o == null ? null : ((Number) o).longValue(); }

    private static BigDecimal dec(Object o) {
        if (o == null) return null;
        return o instanceof BigDecimal b ? b : new BigDecimal(o.toString());
    }

    private static BigDecimal sum(List<Map<String, Object>> rows, String k) {
        List<BigDecimal> v = rows.stream().map(r -> dec(r.get(k))).filter(Objects::nonNull).toList();
        return v.isEmpty() ? null : KpiCalculationEngine.scale(v.stream().reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    private static BigDecimal avg(List<Map<String, Object>> rows, String k) {
        return avgOf(rows.stream().map(r -> dec(r.get(k))).filter(Objects::nonNull).toList());
    }

    private static BigDecimal avgOf(List<BigDecimal> v) {
        if (v.isEmpty()) return null;
        return v.stream().reduce(BigDecimal.ZERO, BigDecimal::add).divide(BigDecimal.valueOf(v.size()), KpiCalculationEngine.SCALE, RoundingMode.HALF_UP);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Object o) { return (Map<String, Object>) o; }

}
