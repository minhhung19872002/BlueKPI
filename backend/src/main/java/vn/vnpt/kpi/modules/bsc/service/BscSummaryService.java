package vn.vnpt.kpi.modules.bsc.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import vn.vnpt.kpi.engine.KpiCalculationEngine;
import vn.vnpt.kpi.modules.bsc.mapper.BscMapper;
import vn.vnpt.kpi.modules.evaluation.service.EvaluationCalcService;
import vn.vnpt.kpi.modules.sysconfig.service.SysConfigService;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Tính bsc_unit_summary cho (năm, kỳ): số KPI, đạt/chưa đạt/đang theo dõi/cảnh báo, % TH/KH, điểm BSC; xếp hạng trong nhóm
 * (khối VNPT tỉnh; khối Tổng công ty/Công ty) theo bsc giảm dần → % TH/KH → mã; biến động so với kỳ trước (PHẦN B §6.9).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BscSummaryService {
    public static final String GROUP_PROVINCE = "VNPT_TINH", GROUP_CORP = "TCT_CT";

    private final BscMapper mapper;
    private final SysConfigService config;

    @Transactional
    public void recompute(int year, String period) {
        BigDecimal warn = config.getDecimal(SysConfigService.KPI_WARNING_RATE, BigDecimal.valueOf(90));
        List<Map<String, Object>> agg = mapper.aggregateUnits(year, period, warn);
        List<Long> ids = new ArrayList<>();
        for (Map<String, Object> a : agg) {
            Map<String, Object> row = new HashMap<>(a);
            row.put("year", year);
            row.put("period", period);
            row.put("completionRate", KpiCalculationEngine.scale((BigDecimal) a.get("completionRate")));
            row.put("bscScore", KpiCalculationEngine.scale((BigDecimal) a.get("bscScore")));
            mapper.upsertSummary(row);
            ids.add(((Number) a.get("unitId")).longValue());
        }
        mapper.deleteSummaryNotIn(year, period, ids);
        rank(year, period);
    }

    void rank(int year, String period) {
        List<Map<String, Object>> rows = mapper.summaries(year, period);
        String[] prev = previous(year, period);
        Map<Long, Map<String, Object>> prevById = new HashMap<>();
        if (prev != null) for (Map<String, Object> p : mapper.summaries(Integer.parseInt(prev[0]), prev[1])) prevById.put(((Number) p.get("unitId")).longValue(), p);
        Map<String, List<KpiCalculationEngine.RankItem>> groups = new HashMap<>();
        for (Map<String, Object> r : rows) {
            String g = group((String) r.get("unitType"), r.get("level"));
            if (g == null) continue;
            groups.computeIfAbsent(g, k -> new ArrayList<>()).add(new KpiCalculationEngine.RankItem(((Number) r.get("unitId")).longValue(),
                    (String) r.get("unitCode"), (BigDecimal) r.get("bscScore"), (BigDecimal) r.get("completionRate")));
        }
        Map<Long, Integer> ranks = new HashMap<>();
        Map<Long, String> gOf = new HashMap<>();
        groups.forEach((g, items) -> {
            ranks.putAll(KpiCalculationEngine.rank(items));
            items.forEach(i -> gOf.put(i.unitId(), g));
        });
        for (Map<String, Object> r : rows) {
            Long id = ((Number) r.get("unitId")).longValue();
            Map<String, Object> p = prevById.get(id);
            mapper.updateRank(year, period, id, ranks.get(id), gOf.get(id), p == null ? null : (BigDecimal) p.get("bscScore"),
                    p == null || p.get("rankInGroup") == null ? null : ((Number) p.get("rankInGroup")).intValue());
        }
    }

    /** Nhóm xếp hạng: khối VNPT tỉnh/thành phố; khối Tổng công ty/Công ty (cấp 2) */
    public static String group(String unitType, Object level) {
        if ("VNPT_TINH".equals(unitType)) return GROUP_PROVINCE;
        if (("TONG_CONG_TY".equals(unitType) || "CONG_TY".equals(unitType)) && level != null && ((Number) level).intValue() == 2) return GROUP_CORP;
        return null;
    }

    /** Kỳ trước để tính biến động: Q1→Q4 năm trước, Q2→Q1, Q3→Q2, Q4→Q3, H1/Y → cùng kỳ năm trước */
    public static String[] previous(int year, String period) {
        return switch (period) {
            case "Q1" -> new String[]{String.valueOf(year - 1), "Q4"};
            case "Q2" -> new String[]{String.valueOf(year), "Q1"};
            case "Q3" -> new String[]{String.valueOf(year), "Q2"};
            case "Q4" -> new String[]{String.valueOf(year), "Q3"};
            default -> new String[]{String.valueOf(year - 1), period};
        };
    }

    /** Tính lại khi có kết quả/chốt/“Tính lại điểm” (PHẦN B §6.10) */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onBscChanged(EvaluationCalcService.BscChangedEvent e) {
        try {
            recompute(e.year(), e.period());
        } catch (Exception ex) {
            log.warn("Tính bsc_unit_summary {} {} lỗi: {}", e.year(), e.period(), ex.getMessage());
        }
    }
}
