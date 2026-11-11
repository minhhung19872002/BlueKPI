package vn.vnpt.kpi.modules.bsc.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.common.Guards;
import vn.vnpt.kpi.common.Labels;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.PageResult;
import vn.vnpt.kpi.common.audit.AuditService;
import vn.vnpt.kpi.common.util.Jsons;
import vn.vnpt.kpi.common.util.Strs;
import vn.vnpt.kpi.modules.bsc.mapper.BscMapper;
import vn.vnpt.kpi.modules.evaluation.mapper.EvaluationMapper;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.EvalKpi;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.Result;
import vn.vnpt.kpi.modules.evaluation.service.EvaluationCalcService;
import vn.vnpt.kpi.modules.evaluation.service.EvaluationService;
import vn.vnpt.kpi.modules.evaluation.service.EvaluationStateMachine;
import vn.vnpt.kpi.modules.notification.mapper.NotificationMapper;
import vn.vnpt.kpi.modules.notification.service.NotificationService;
import vn.vnpt.kpi.security.DataScope;
import vn.vnpt.kpi.security.DataScopeService;
import vn.vnpt.kpi.security.PermissionCodes;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Tổng hợp kết quả BSC (46–50): danh sách, thu hồi, tính lại điểm, chốt đánh giá KPI, Tổng giám đốc duyệt */
@Service
@RequiredArgsConstructor
public class BscService {
    public static final String MSG_CLOSE_NOT_ELIGIBLE = "Danh sách chưa hoàn thành. Vui lòng hoàn thiện trước khi thực hiện chốt đánh giá KPI";
    public static final String MSG_APPROVE_NOT_ELIGIBLE = "Danh sách chưa hoàn thành. Vui lòng hoàn thiện trước khi thực hiện ký duyệt TGĐ";
    static final Set<String> HAS_RESULT = Set.of(EvaluationStateMachine.DA_CO_KQ, EvaluationStateMachine.DV_DE_NGHI, EvaluationStateMachine.DA_XU_LY,
            EvaluationStateMachine.CHOT_DANH_GIA);

    public record YearPeriod(Integer year, String period) {}

    private final BscMapper mapper;
    private final EvaluationMapper evalMapper;
    private final EvaluationService evaluation;
    private final EvaluationCalcService calc;
    private final EvaluationStateMachine sm;
    private final BscSummaryService summary;
    private final DataScopeService scopes;
    private final NotificationService notifications;
    private final NotificationMapper notificationMapper;
    private final AuditService audit;

    // ============================== 46.1 / 46.2 ==============================
    public Map<String, Object> filter(String keyword, Integer year, String period, Long perspectiveId, String status, String dataType) {
        Map<String, Object> f = new HashMap<>();
        f.put("keyword", Strs.like(keyword));
        f.put("year", year);
        f.put("period", Strs.trimToNull(period));
        f.put("perspectiveId", perspectiveId);
        f.put("status", Strs.trimToNull(status));
        f.put("resultType", Strs.trimToNull(dataType));
        return f;
    }

    public PageResult<Result> list(Map<String, Object> f, PageQuery q) {
        DataScope scope = scopes.scopeFor(PermissionCodes.BSC_VIEW);
        q.applySort(Map.of("orgUnitName", "o.name", "kpiCode", "k.code", "score", "r.score", "status", "r.status"), "o.level, o.sort_order, o.code, pe.sort_order, k.code");
        return PageResult.of(evalMapper.searchResults(f, scope, q), evalMapper.countResults(f, scope), q);
    }

    /** 46.3 Xem theo đơn vị */
    public Map<String, Object> byUnit(Long unitId, int year, String period) {
        scopes.assertUnit(PermissionCodes.BSC_VIEW, unitId);
        Map<String, Object> f = new HashMap<>();
        f.put("unitId", unitId);
        f.put("year", year);
        f.put("period", period);
        PageQuery q = new PageQuery().forExport();
        q.applySort(Map.of(), "pe.sort_order, COALESCE((SELECT pk.code FROM kpi pk WHERE pk.id = k.parent_id), k.code), k.parent_id IS NOT NULL, k.code");
        List<Result> rows = evalMapper.searchResults(f, DataScope.ALL, q);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("rows", rows);
        m.put("summary", mapper.summaries(year, period).stream().filter(s -> unitId.equals(((Number) s.get("unitId")).longValue())).findFirst().orElse(null));
        return m;
    }

    /** 46.3 Xem theo KPI (cho tất cả đơn vị) */
    public Map<String, Object> byKpi(Long evalKpiId) {
        EvalKpi ek = Guards.found(evalMapper.findEvalKpi(evalKpiId), "KPI-kỳ");
        Map<String, Object> f = new HashMap<>();
        f.put("evalKpiId", evalKpiId);
        PageQuery q = new PageQuery().forExport();
        q.applySort(Map.of(), "o.level, o.sort_order, o.code");
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("evalKpi", ek);
        m.put("rows", evalMapper.searchResults(f, scopes.scopeFor(PermissionCodes.BSC_VIEW), q));
        return m;
    }

    // ============================== 46.4 / 47.4 Thu hồi ==============================
    @Transactional
    public Map<String, Object> revoke(Long evalKpiId) {
        EvalKpi ek = Guards.found(evalMapper.findEvalKpi(evalKpiId), "KPI-kỳ");
        sm.assertPeriodOpen(ek.getYear(), ek.getPeriodCode());
        List<Result> rows = evalMapper.findResultsOfEvalKpi(evalKpiId).stream()
                .filter(r -> HAS_RESULT.contains(r.getStatus()) && (r.getFinalResult() != null || r.getScore() != null)).toList();
        if (rows.isEmpty()) throw new BusinessException(ErrorCode.ERR_INVALID_STATE, "Không có kết quả đủ điều kiện thu hồi");
        sm.transitionResults(rows, EvaluationStateMachine.BCL, "Thu hồi kết quả đánh giá");
        sm.transitionEvalKpi(evalMapper.findEvalKpi(evalKpiId), EvaluationStateMachine.EK_BCL, "Thu hồi kết quả đánh giá");
        afterRevoke(ek, rows);
        return Map.of("revoked", rows.size(), "message", "Thu hồi kết quả đánh giá thành công (" + rows.size() + " đơn vị)");
    }

    @Transactional
    public Map<String, Object> revokeUnit(Long resultId) {
        Result r = Guards.found(evalMapper.findResult(resultId), "kết quả đánh giá");
        scopes.assertUnit(PermissionCodes.BSC_REVOKE, r.getOrgUnitId());
        EvalKpi ek = evalMapper.findEvalKpi(r.getEvaluationKpiId());
        sm.assertPeriodOpen(ek.getYear(), ek.getPeriodCode());
        if (!HAS_RESULT.contains(r.getStatus()) || (r.getFinalResult() == null && r.getScore() == null)) {
            throw new BusinessException(ErrorCode.ERR_INVALID_STATE, "Kết quả của đơn vị chưa đủ điều kiện thu hồi");
        }
        sm.transitionResults(List.of(r), EvaluationStateMachine.BCL, "Thu hồi kết quả đánh giá theo đơn vị");
        if (!EvaluationStateMachine.EK_BCL.equals(ek.getStatus())) sm.transitionEvalKpi(ek, EvaluationStateMachine.EK_BCL, "Thu hồi theo đơn vị " + r.getOrgUnitCode());
        afterRevoke(ek, List.of(r));
        return Map.of("revoked", 1, "message", "Thu hồi kết quả đánh giá của đơn vị thành công");
    }

    private void afterRevoke(EvalKpi ek, List<Result> rows) {
        summary.recompute(ek.getYear(), ek.getPeriodCode());
        Set<Long> units = rows.stream().map(Result::getOrgUnitId).collect(Collectors.toSet());
        notifications.send(notificationMapper.findUsersWithPermissionInUnits(PermissionCodes.MYKPI_VIEW, units),
                new NotificationService.Message(NotificationService.EV_THU_HOI, "Thu hồi kết quả đánh giá " + ek.getKpiCode(),
                        "Kết quả KPI " + ek.getKpiCode() + " – " + ek.getKpiName() + " " + Labels.of(Labels.PERIOD, ek.getPeriodCode()) + " " + ek.getYear()
                                + " đã bị thu hồi (BCL yêu cầu làm lại)", "/my-kpi", Map.of("view", "review", "year", ek.getYear(), "period", ek.getPeriodCode())),
                NotificationService.Channel.BELL);
        audit.log("THU_HOI", "evaluation_kpi", ek.getId(), null, Map.of("results", rows.size()));
    }

    // ============================== 46.5 Tính lại điểm ==============================
    @Transactional
    public Map<String, Object> recalculate(YearPeriod p) {
        validate(p);
        Map<String, Object> closing = mapper.periodClosing(p.year(), p.period());
        if (closing != null && "TGD_DA_DUYET".equals(closing.get("status"))) throw new BusinessException(ErrorCode.ERR_PERIOD_LOCKED);
        calc.recalcPeriod(p.year(), p.period());
        summary.recompute(p.year(), p.period());
        int n = mapper.countResultsOfPeriod(p.year(), p.period());
        audit.log("TINH_LAI_DIEM", "bsc_unit_summary", p.year() + "-" + p.period(), null, Map.of("results", n));
        return Map.of("results", n, "message", "Tính lại điểm KPI thành công cho " + n + " kết quả (" + Labels.of(Labels.PERIOD, p.period()) + " " + p.year() + ")");
    }

    // ============================== 48 Chốt đánh giá KPI ==============================
    @Transactional
    public Map<String, Object> close(YearPeriod p) {
        validate(p);
        Map<String, Object> closing = mapper.periodClosing(p.year(), p.period());
        if (closing != null) {
            if ("TGD_DA_DUYET".equals(closing.get("status"))) throw new BusinessException(ErrorCode.ERR_PERIOD_LOCKED);
            // Đã chốt trước đó: chỉ cho chốt lại khi có kết quả mới sau thu hồi (46.4/47.4 → đơn vị đánh giá lại → 48.1)
            boolean pending = !mapper.resultIdsOfPeriod(p.year(), p.period(), List.of(EvaluationStateMachine.DA_CO_KQ, EvaluationStateMachine.DA_XU_LY)).isEmpty()
                    || !mapper.notEligibleForClose(p.year(), p.period()).isEmpty();
            if (!pending) {
                throw new BusinessException(ErrorCode.ERR_INVALID_STATE, "Kỳ " + Labels.of(Labels.PERIOD, p.period()) + " năm " + p.year() + " đã được chốt đánh giá KPI");
            }
        }
        if (mapper.countResultsOfPeriod(p.year(), p.period()) == 0) throw new BusinessException(ErrorCode.ERR_INVALID_STATE, "Kỳ đánh giá chưa có dữ liệu");
        List<Map<String, Object>> bad = mapper.notEligibleForClose(p.year(), p.period());
        if (!bad.isEmpty()) throw new BusinessException(ErrorCode.ERR_NOT_ELIGIBLE, MSG_CLOSE_NOT_ELIGIBLE, Map.of("units", bad));
        List<Long> ids = mapper.resultIdsOfPeriod(p.year(), p.period(), List.of(EvaluationStateMachine.DA_CO_KQ, EvaluationStateMachine.DA_XU_LY));
        for (int i = 0; i < ids.size(); i += 1000) {
            sm.transitionResults(evalMapper.findResultsByIds(ids.subList(i, Math.min(ids.size(), i + 1000))), EvaluationStateMachine.CHOT_DANH_GIA, "Chốt đánh giá KPI");
        }
        summary.recompute(p.year(), p.period());
        mapper.insertClosing(p.year(), p.period(), vn.vnpt.kpi.security.CurrentUser.currentUsername(), Jsons.toJson(mapper.summaries(p.year(), p.period())));
        Set<Long> units = Set.copyOf(mapper.unitIdsOfPeriod(p.year(), p.period()));
        notifications.send(notificationMapper.findUsersWithPermissionInUnits(PermissionCodes.MYKPI_VIEW, units),
                new NotificationService.Message(NotificationService.EV_CHOT_KET_QUA, "Chốt đánh giá KPI " + Labels.of(Labels.PERIOD, p.period()) + " " + p.year(),
                        "Kết quả đánh giá KPI " + Labels.of(Labels.PERIOD, p.period()) + " năm " + p.year() + " đã được chốt",
                        "/my-kpi", Map.of("view", "period", "year", p.year(), "period", p.period())), NotificationService.Channel.BELL);
        audit.log("CHOT_DANH_GIA", "period_closing", p.year() + "-" + p.period(), null, Map.of("results", ids.size()));
        return Map.of("closed", ids.size(), "message", "Chốt đánh giá KPI thành công (" + Labels.of(Labels.PERIOD, p.period()) + " " + p.year() + ")");
    }

    // ============================== 50 Tổng giám đốc duyệt ==============================
    public Map<String, Object> approveCheck(YearPeriod p) {
        validate(p);
        Map<String, Object> m = new LinkedHashMap<>();
        Map<String, Object> closing = mapper.periodClosing(p.year(), p.period());
        List<Map<String, Object>> bad = mapper.notEligibleForApprove(p.year(), p.period());
        boolean approved = closing != null && "TGD_DA_DUYET".equals(closing.get("status"));
        boolean eligible = closing != null && bad.isEmpty() && !approved && mapper.countResultsOfPeriod(p.year(), p.period()) > 0;
        m.put("eligible", eligible);
        m.put("approved", approved);
        m.put("units", bad);
        m.put("message", approved ? "Kỳ đánh giá đã được Tổng giám đốc ký duyệt" : eligible ? null : MSG_APPROVE_NOT_ELIGIBLE);
        List<Map<String, Object>> sums = mapper.summaries(p.year(), p.period());
        List<Map<String, Object>> ranked = sums.stream().filter(s -> s.get("rankGroup") != null && s.get("bscScore") != null)
                .sorted(Comparator.comparing((Map<String, Object> s) -> (BigDecimal) s.get("bscScore")).reversed()).toList();
        Map<String, Object> sum = new LinkedHashMap<>();
        sum.put("year", p.year());
        sum.put("period", p.period());
        sum.put("periodName", Labels.of(Labels.PERIOD, p.period()));
        sum.put("unitCount", sums.size());
        sum.put("groupBscScore", sums.stream().filter(s -> "CONG_TY_ME".equals(s.get("unitType"))).map(s -> s.get("bscScore")).findFirst().orElse(null));
        sum.put("top5", ranked.stream().limit(5).toList());
        List<Map<String, Object>> bottom = new ArrayList<>(ranked.subList(Math.max(0, ranked.size() - 5), ranked.size()));
        java.util.Collections.reverse(bottom);
        sum.put("bottom5", bottom);
        m.put("summary", sum);
        return m;
    }

    @Transactional
    public Map<String, Object> approve(YearPeriod p) {
        Map<String, Object> check = approveCheck(p);
        if (Boolean.TRUE.equals(check.get("approved"))) throw new BusinessException(ErrorCode.ERR_INVALID_STATE, "Kỳ đánh giá đã được Tổng giám đốc ký duyệt");
        if (!Boolean.TRUE.equals(check.get("eligible"))) throw new BusinessException(ErrorCode.ERR_NOT_ELIGIBLE, MSG_APPROVE_NOT_ELIGIBLE, Map.of("units", check.get("units")));
        List<Long> ids = mapper.resultIdsOfPeriod(p.year(), p.period(), List.of(EvaluationStateMachine.CHOT_DANH_GIA));
        for (int i = 0; i < ids.size(); i += 1000) {
            sm.transitionResults(evalMapper.findResultsByIds(ids.subList(i, Math.min(ids.size(), i + 1000))), EvaluationStateMachine.TGD, "Tổng giám đốc ký duyệt");
        }
        mapper.approveClosing(p.year(), p.period(), vn.vnpt.kpi.security.CurrentUser.currentUsername());
        notifications.send(notificationMapper.findUsersWithPermission("DASHBOARD:"),
                new NotificationService.Message(NotificationService.EV_TGD_DUYET, "Tổng giám đốc đã ký duyệt kết quả KPI " + Labels.of(Labels.PERIOD, p.period()) + " " + p.year(),
                        "Kết quả đánh giá KPI " + Labels.of(Labels.PERIOD, p.period()) + " năm " + p.year() + " đã được Tổng giám đốc ký duyệt",
                        "/dashboard", Map.of("year", p.year(), "period", p.period())), NotificationService.Channel.BELL, NotificationService.Channel.EMAIL);
        audit.log("TGD_DUYET", "period_closing", p.year() + "-" + p.period(), null, Map.of("results", ids.size()));
        return Map.of("approved", ids.size(), "message", "Tổng giám đốc ký duyệt thành công (" + Labels.of(Labels.PERIOD, p.period()) + " " + p.year() + ")");
    }

    // ============================== 47 Theo dõi kết quả thẩm định và phản hồi (tab 2) ==============================
    public PageResult<Result> review(String keyword, Integer year, String period, String status, PageQuery q) {
        return evaluation.review(evaluation.reviewFilter(keyword, year, period, status, null), PermissionCodes.BSC_VIEW, q);
    }

    public Map<String, Object> resultDetail(Long id) {
        return evaluation.resultDetail(id, PermissionCodes.BSC_VIEW);
    }

    private static void validate(YearPeriod p) {
        if (p == null || p.year() == null) throw BusinessException.field("year", "Vui lòng chọn Năm");
        if (p.period() == null || !Labels.PERIOD.containsKey(p.period())) throw BusinessException.field("period", "Vui lòng chọn Kỳ đánh giá");
    }
}
