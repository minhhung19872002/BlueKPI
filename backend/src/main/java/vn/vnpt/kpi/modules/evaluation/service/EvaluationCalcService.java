package vn.vnpt.kpi.modules.evaluation.service;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import vn.vnpt.kpi.common.util.Jsons;
import vn.vnpt.kpi.engine.KpiCalculationEngine;
import vn.vnpt.kpi.engine.KpiCalculationEngine.ComponentIn;
import vn.vnpt.kpi.engine.KpiCalculationEngine.Config;
import vn.vnpt.kpi.engine.KpiCalculationEngine.Output;
import vn.vnpt.kpi.engine.KpiCalculationEngine.Scoring;
import vn.vnpt.kpi.engine.KpiCalculationEngine.UnitValue;
import vn.vnpt.kpi.engine.KpiCalculationEngine.WeightedScore;
import vn.vnpt.kpi.modules.evaluation.mapper.EvaluationMapper;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.ComponentValue;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.EvalKpi;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.Result;
import vn.vnpt.kpi.modules.sysconfig.service.SysConfigService;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Nối KpiCalculationEngine (hàm thuần) với dữ liệu: tính lại các dòng evaluation_result liên quan (PHẦN B §6.10),
 * cuộn điểm KPI cha – con, gộp kết quả cấp Tập đoàn, phát sự kiện cập nhật bsc_unit_summary.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EvaluationCalcService {
    /** Kỳ trước cùng năm (cho ĐC kỳ trước khi LŨY KẾ) */
    static final Map<String, List<String>> PREVIOUS = Map.of("Q1", List.of(), "Q2", List.of("Q1"), "H1", List.of("Q1"),
            "Q3", List.of("Q1", "Q2"), "Q4", List.of("Q1", "Q2", "Q3"), "Y", List.of("Q1", "Q2", "Q3"));

    /** Sự kiện: điểm BSC đơn vị cần tính lại cho (năm, kỳ) */
    public record BscChangedEvent(int year, String period, Set<Long> unitIds) {}

    /** Ghi đè đầu vào khi xem trước (calculate-preview) */
    public record Override(Long resultId, Map<Long, BigDecimal> componentValues, BigDecimal adjustment, BigDecimal manualScore,
                           Map<Long, BigDecimal> componentAdjustments) {}

    /** Chế độ nạp dữ liệu hàng loạt (seed/migration): bỏ qua tính lại nền, bên gọi tự tính lại theo kỳ */
    private static volatile boolean bulkMode;

    public static void setBulkMode(boolean on) { bulkMode = on; }

    /** Bộ nhớ đệm trong một lượt tính */
    final class Ctx {
        final Map<Long, List<ComponentValue>> defs = new HashMap<>();
        final Map<String, BigDecimal> totals = new HashMap<>();
        Set<Long> parents;

        List<ComponentValue> defs(Long kpiId) { return defs.computeIfAbsent(kpiId, mapper::kpiComponents); }

        BigDecimal total(Long unitId, int year) { return totals.computeIfAbsent(unitId + "|" + year, k -> mapper.totalRootWeight(unitId, year)); }

        boolean isParent(Long kpiId) {
            if (parents == null) parents = new java.util.HashSet<>(mapper.parentKpiIds());
            return parents.contains(kpiId);
        }
    }

    private final EvaluationMapper mapper;
    private final SysConfigService config;
    private final ApplicationEventPublisher events;

    public Config engineConfig() {
        return new Config(config.getDecimal(SysConfigService.KPI_PASS_SCORE, BigDecimal.valueOf(3)),
                config.getDecimal(SysConfigService.KPI_WARNING_RATE, BigDecimal.valueOf(90)),
                config.getDecimal(SysConfigService.KPI_COMPLETION_CAP, BigDecimal.valueOf(200)));
    }

    /** Đọc scoring_method.config (JSON) → Scoring của engine */
    public static Scoring scoring(String type, String json) {
        JsonNode n = json == null ? null : Jsons.fromJson(json, JsonNode.class);
        if ("DAT_KHONG_DAT".equals(type)) {
            return new Scoring(type, List.of(), dec(n, "passRate", 100), dec(n, "passScore", 5), dec(n, "failScore", 1), dec(n, "maxScore", 5));
        }
        if ("NHAP_DIEM".equals(type)) return Scoring.nhapDiem();
        if (n == null || !n.has("bands")) return Scoring.defaultBands();
        List<KpiCalculationEngine.Band> bands = new ArrayList<>();
        for (JsonNode b : n.get("bands")) {
            bands.add(new KpiCalculationEngine.Band(b.hasNonNull("from") ? b.get("from").decimalValue() : null,
                    b.hasNonNull("to") ? b.get("to").decimalValue() : null, b.get("score").decimalValue()));
        }
        return new Scoring("KHUNG_TY_LE", bands, null, null, null, dec(n, "maxScore", 5));
    }

    private static BigDecimal dec(JsonNode n, String k, int d) {
        return n != null && n.hasNonNull(k) ? n.get(k).decimalValue() : BigDecimal.valueOf(d);
    }

    // ================================ Tính lại ================================
    @Transactional
    public void recalc(Collection<Long> resultIds) {
        if (resultIds == null || resultIds.isEmpty()) return;
        LinkedHashSet<Long> set = new LinkedHashSet<>(resultIds);
        // thêm dòng KPI cha của các dòng KPI con để cuộn điểm
        List<Long> base = new ArrayList<>(set);
        for (int i = 0; i < base.size(); i += 1000) set.addAll(mapper.parentResultIds(base.subList(i, Math.min(base.size(), i + 1000))));
        List<Long> all = new ArrayList<>(set);
        // KPI con trước, KPI cha sau trên toàn bộ tập
        all = sortChildrenFirst(all);
        Map<Long, EvalKpi> eks = new HashMap<>();
        Map<String, Set<Long>> bscUnits = new LinkedHashMap<>();
        Config cfg = engineConfig();
        Ctx ctx = new Ctx();
        for (int i = 0; i < all.size(); i += 500) {
            List<Long> chunk = all.subList(i, Math.min(all.size(), i + 500));
            List<Result> rows = mapper.findResultsByIds(chunk);
            Map<Long, List<ComponentValue>> comps = mapper.findComponentValues(chunk).stream().collect(Collectors.groupingBy(ComponentValue::getResultId));
            // KPI con trước, KPI cha sau (để cuộn điểm)
            Map<Long, Integer> order = new HashMap<>();
            for (int j = 0; j < chunk.size(); j++) order.put(chunk.get(j), j);
            rows.sort((a, b) -> Integer.compare(order.get(a.getId()), order.get(b.getId())));
            for (Result r : rows) {
                EvalKpi ek = eks.computeIfAbsent(r.getEvaluationKpiId(), mapper::findEvalKpi);
                compute(r, ek, comps.getOrDefault(r.getId(), List.of()), null, cfg, true, ctx);
                bscUnits.computeIfAbsent(ek.getYear() + "|" + ek.getPeriodCode(), k -> new LinkedHashSet<>()).add(r.getOrgUnitId());
            }
        }
        // Gộp kết quả cấp Tập đoàn cho các KPI-kỳ bị ảnh hưởng
        for (EvalKpi ek : eks.values()) aggregateGroup(ek, cfg, ctx);
        bscUnits.forEach((k, units) -> {
            String[] p = k.split("\\|");
            events.publishEvent(new BscChangedEvent(Integer.parseInt(p[0]), p[1], units));
        });
    }

    private List<Long> sortChildrenFirst(List<Long> ids) {
        List<Long> kids = new ArrayList<>(), roots = new ArrayList<>();
        for (int i = 0; i < ids.size(); i += 1000) {
            for (Result r : mapper.findResultsByIds(ids.subList(i, Math.min(ids.size(), i + 1000)))) (r.getParentKpiId() != null ? kids : roots).add(r.getId());
        }
        kids.addAll(roots);
        return kids;
    }

    @Transactional
    public void recalcEvalKpi(Long evalKpiId) {
        recalc(mapper.findResultsOfEvalKpi(evalKpiId).stream().map(Result::getId).toList());
    }

    @Transactional
    public void recalcPeriod(int year, String period) {
        recalc(mapper.resultIdsOfPeriod(year, period));
    }

    /** Tính lại sau khi phát sinh dữ liệu mới (chốt giao, điều chỉnh KH) — bất đồng bộ sau commit */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    public void onResultsChanged(EvaluationProvisioner.ResultsChangedEvent e) {
        if (bulkMode) return;
        try {
            recalc(e.resultIds());
        } catch (Exception ex) {
            log.error("Tính lại kết quả thất bại", ex);
        }
    }

    /** Xem trước (không lưu): trả kết quả tính cho các dòng với dữ liệu ghi đè */
    public List<Map<String, Object>> preview(List<Override> overrides) {
        Config cfg = engineConfig();
        List<Long> ids = overrides.stream().map(Override::resultId).toList();
        if (ids.isEmpty()) return List.of();
        Map<Long, Override> byId = overrides.stream().collect(Collectors.toMap(Override::resultId, o -> o, (a, b) -> b));
        Map<Long, List<ComponentValue>> comps = mapper.findComponentValues(ids).stream().collect(Collectors.groupingBy(ComponentValue::getResultId));
        Map<Long, EvalKpi> eks = new HashMap<>();
        Ctx ctx = new Ctx();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Result r : mapper.findResultsByIds(ids)) {
            EvalKpi ek = eks.computeIfAbsent(r.getEvaluationKpiId(), mapper::findEvalKpi);
            Output o = compute(r, ek, comps.getOrDefault(r.getId(), List.of()), byId.get(r.getId()), cfg, false, ctx);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("resultId", r.getId());
            m.put("kpiResult", o.kpiResult());
            m.put("prevAdjustment", r.getPrevAdjustment());
            m.put("finalResult", o.finalResult());
            m.put("completionRate", o.completionRate());
            m.put("score", o.score());
            m.put("rating", o.rating());
            m.put("error", o.error());
            m.put("components", o.components());
            out.add(m);
        }
        return out;
    }

    /** Tính 1 dòng; persist=true thì ghi DB */
    Output compute(Result r, EvalKpi ek, List<ComponentValue> stored, Override ov, Config cfg, boolean persist, Ctx ctx) {
        boolean cumulative = "LUY_KE".equals(ek.getTargetDataType());
        List<String> prevPeriods = PREVIOUS.getOrDefault(ek.getPeriodCode(), List.of());
        // Thành phần: đủ theo định nghĩa KPI (thiếu → giá trị null)
        Map<Long, ComponentValue> byComp = stored.stream().collect(Collectors.toMap(ComponentValue::getComponentId, c -> c, (a, b) -> a));
        List<ComponentValue> defs = ctx.defs(ek.getKpiId());
        List<ComponentIn> ins = new ArrayList<>();
        Map<String, BigDecimal> prevByCode = new HashMap<>();
        for (ComponentValue def : defs) {
            ComponentValue cv = byComp.get(def.getComponentId());
            BigDecimal value = cv == null ? null : cv.getValue();
            BigDecimal adj = cv == null ? null : cv.getAdjustment();
            if (ov != null && ov.componentValues() != null && ov.componentValues().containsKey(def.getComponentId())) value = ov.componentValues().get(def.getComponentId());
            if (ov != null && ov.componentAdjustments() != null && ov.componentAdjustments().containsKey(def.getComponentId())) adj = ov.componentAdjustments().get(def.getComponentId());
            BigDecimal prev = BigDecimal.ZERO;
            if (cumulative && !prevPeriods.isEmpty()) {
                prev = KpiCalculationEngine.prevAdjustment("LUY_KE", mapper.componentAdjustmentsOfYear(def.getComponentId(), r.getOrgUnitId(), ek.getYear()).stream()
                        .filter(m -> prevPeriods.contains((String) m.get("period"))).map(m -> (BigDecimal) m.get("adjustment")).toList());
            }
            prevByCode.put(def.getCode(), prev);
            ins.add(new ComponentIn(def.getCode(), value, prev, adj));
        }
        BigDecimal kpiPrev = BigDecimal.ZERO;
        if (cumulative && !prevPeriods.isEmpty()) {
            kpiPrev = KpiCalculationEngine.prevAdjustment("LUY_KE", mapper.adjustmentsOfYear(ek.getKpiId(), r.getOrgUnitId(), ek.getYear()).stream()
                    .filter(m -> prevPeriods.contains((String) m.get("period"))).map(m -> (BigDecimal) m.get("adjustment")).toList());
        }
        BigDecimal adjustment = ov != null && ov.adjustment() != null ? ov.adjustment() : r.getAdjustment();
        BigDecimal manual = ov != null && ov.manualScore() != null ? ov.manualScore() : r.getManualScore();
        KpiCalculationEngine.Input in = new KpiCalculationEngine.Input(ek.getCompletionFormula(), ek.getCompletionExpression(), ek.getResultExpression(),
                scoring(ek.getScoringMethodType(), ek.getScoringConfig()), !Boolean.FALSE.equals(ek.getScoreByResult()), manual,
                r.getPlanValue(), r.getYearPlanValue(), ins, kpiPrev, adjustment);
        Output o = KpiCalculationEngine.calculate(in, cfg);
        BigDecimal score = o.score();
        String rating = o.rating();
        // KPI cha – con: điểm KPI cha = TB có trọng số điểm KPI con [GIẢ ĐỊNH]
        List<Map<String, Object>> kids = ctx.isParent(ek.getKpiId()) ? mapper.childScores(ek.getKpiId(), r.getOrgUnitId(), ek.getYear(), ek.getPeriodCode()) : List.of();
        if (!kids.isEmpty()) {
            BigDecimal ps = KpiCalculationEngine.parentScore(kids.stream().map(m -> new WeightedScore((BigDecimal) m.get("score"),
                    m.get("weight") == null ? BigDecimal.ONE : (BigDecimal) m.get("weight"))).toList());
            if (ps != null) {
                score = ps;
                rating = ps.compareTo(cfg.passScore()) >= 0 ? "DAT_VUOT" : "CHUA_DAT";
            }
        }
        if (persist) {
            for (KpiCalculationEngine.ComponentOut co : o.components()) {
                ComponentValue def = defs.stream().filter(d -> d.getCode().equals(co.code())).findFirst().orElse(null);
                ComponentValue cv = def == null ? null : byComp.get(def.getComponentId());
                if (cv != null) mapper.updateComponentCalc(cv.getId(), prevByCode.get(co.code()), co.finalValue());
            }
            Result u = new Result();
            u.setId(r.getId());
            u.setKpiResult(o.kpiResult());
            u.setPrevAdjustment(KpiCalculationEngine.scale(kpiPrev));
            u.setFinalResult(o.finalResult());
            u.setCompletionRate(o.completionRate());
            u.setYearCompletionRate(o.yearCompletionRate());
            u.setScore(score);
            u.setRating(rating);
            u.setCalcError(o.error());
            u.setResultBeforeAdjust(o.kpiResult() == null ? null : KpiCalculationEngine.scale(o.kpiResult().add(kpiPrev)));
            u.setResultAfterAdjust(o.finalResult());
            u.setBscScore(r.getParentKpiId() == null ? KpiCalculationEngine.bscItem(score, r.getWeight(), ctx.total(r.getOrgUnitId(), ek.getYear())) : null);
            mapper.updateCalc(u);
        }
        return new Output(o.components(), o.kpiResult(), o.finalResult(), o.completionRate(), o.yearCompletionRate(), score, rating, o.warning(), o.error());
    }

    /** 6.7 Kết quả cấp Tập đoàn: gộp final_result các đơn vị cấp 2 theo group_aggregation (NHAP_TAY: dòng Công ty mẹ) */
    void aggregateGroup(EvalKpi ek, Config cfg, Ctx ctx) {
        String agg = ek.getGroupAggregation();
        if (agg == null || "NHAP_TAY".equals(agg)) return;
        List<Result> rows = mapper.findResultsOfEvalKpi(ek.getId());
        Result root = rows.stream().filter(r -> "CONG_TY_ME".equals(r.getUnitType())).findFirst().orElse(null);
        if (root == null) return;
        List<Result> members = rows.stream().filter(r -> r != root && r.getFinalResult() != null && !"PHONG_BAN".equals(r.getUnitType())
                && !"TRUNG_TAM".equals(r.getUnitType())).toList();
        if (members.isEmpty()) return;
        Map<String, BigDecimal> named = new HashMap<>();
        members.forEach(m -> named.put(m.getOrgUnitCode(), m.getFinalResult()));
        BigDecimal value = KpiCalculationEngine.aggregate(agg, members.stream().map(m -> new UnitValue(m.getFinalResult(), m.getWeight())).toList(),
                ek.getGroupExpression(), named);
        if (value == null) return;
        KpiCalculationEngine.Input in = new KpiCalculationEngine.Input(ek.getCompletionFormula(), ek.getCompletionExpression(), "A",
                scoring(ek.getScoringMethodType(), ek.getScoringConfig()), !Boolean.FALSE.equals(ek.getScoreByResult()), root.getManualScore(),
                root.getPlanValue(), root.getYearPlanValue(), List.of(new ComponentIn("A", value, null, null)), root.getPrevAdjustment(), root.getAdjustment());
        Output o = KpiCalculationEngine.calculate(in, cfg);
        Result u = new Result();
        u.setId(root.getId());
        u.setKpiResult(o.kpiResult());
        u.setPrevAdjustment(root.getPrevAdjustment());
        u.setFinalResult(o.finalResult());
        u.setCompletionRate(o.completionRate());
        u.setYearCompletionRate(o.yearCompletionRate());
        u.setScore(o.score());
        u.setRating(o.rating());
        u.setCalcError(o.error());
        u.setResultBeforeAdjust(o.kpiResult());
        u.setResultAfterAdjust(o.finalResult());
        u.setBscScore(root.getParentKpiId() == null ? KpiCalculationEngine.bscItem(o.score(), root.getWeight(), ctx.total(root.getOrgUnitId(), ek.getYear())) : null);
        mapper.updateCalc(u);
    }
}
