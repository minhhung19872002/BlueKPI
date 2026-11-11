package vn.vnpt.kpi.modules.evaluation.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.common.Guards;
import vn.vnpt.kpi.common.audit.AuditService;
import vn.vnpt.kpi.engine.FormulaEvaluator;
import vn.vnpt.kpi.integration.kpisource.KpiSourceClient;
import vn.vnpt.kpi.modules.catalog.mapper.FormulaMapper;
import vn.vnpt.kpi.modules.catalog.model.FormulaDefinition;
import vn.vnpt.kpi.modules.evaluation.mapper.EvaluationMapper;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.ComponentValue;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.EvalKpi;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.Result;
import vn.vnpt.kpi.modules.sync.mapper.SyncBatchMapper;
import vn.vnpt.kpi.modules.sync.model.SyncBatch;
import vn.vnpt.kpi.security.CurrentUser;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 43.1 “Đồng bộ lại”: gọi API nguồn cho các thành phần nguồn API của mọi đơn vị trong lưới, cập nhật “Kết quả KPI”,
 * tính lại; ghi sync_batch / sync_batch_item / formula_result. ≤ 100 đơn vị chạy đồng bộ (< 10s), lớn hơn chạy nền và poll.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SyncService {
    static final int SYNC_LIMIT = 100;
    private static final ExecutorService POOL = Executors.newFixedThreadPool(8, r -> {
        Thread t = new Thread(r, "kpi-sync");
        t.setDaemon(true);
        return t;
    });

    private final EvaluationMapper mapper;
    private final FormulaMapper formulaMapper;
    private final SyncBatchMapper batchMapper;
    private final KpiSourceClient source;
    private final EvaluationCalcService calc;
    private final EvaluationStateMachine sm;
    private final AuditService audit;
    private final JdbcTemplate jdbc;

    public record SyncOutcome(Long batchId, int total, int success, int failed, boolean running, String message) {}

    /** Đồng bộ một KPI-kỳ (từ nút “Đồng bộ lại”) */
    public SyncOutcome syncEvalKpi(Long evalKpiId, String trigger) {
        EvalKpi ek = Guards.found(mapper.findEvalKpi(evalKpiId), "KPI-kỳ");
        sm.assertEvalKpiOpen(ek);
        List<ComponentValue> apiComps = mapper.kpiComponents(ek.getKpiId()).stream().filter(c -> "API".equals(c.getSource()) && c.getFormulaDefinitionId() != null).toList();
        if (apiComps.isEmpty()) throw new BusinessException(ErrorCode.ERR_VALIDATION, "KPI không có thành phần lấy kết quả từ API");
        List<Result> rows = mapper.findResultsOfEvalKpi(evalKpiId).stream().filter(r -> EvaluationStateMachine.EDITABLE.contains(r.getStatus())).toList();
        SyncBatch b = new SyncBatch();
        b.setJobType("DONG_BO_KET_QUA_KPI");
        b.setYear(ek.getYear());
        b.setPeriodCode(ek.getPeriodCode());
        b.setKpiId(ek.getKpiId());
        b.setTrigger(trigger);
        b.setTriggeredBy(CurrentUser.currentUsername());
        batchMapper.insert(b);
        if (rows.size() > SYNC_LIMIT) {
            var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            CompletableFuture.runAsync(() -> {
                org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(auth);
                run(ek, apiComps, rows, b.getId());
            }, POOL);
            return new SyncOutcome(b.getId(), rows.size(), 0, 0, true, "Đang đồng bộ " + rows.size() + " đơn vị (chạy nền)");
        }
        return run(ek, apiComps, rows, b.getId());
    }

    SyncOutcome run(EvalKpi ek, List<ComponentValue> apiComps, List<Result> rows, Long batchId) {
        AtomicInteger ok = new AtomicInteger(), fail = new AtomicInteger();
        Map<Long, FormulaDefinition> formulas = new HashMap<>();
        apiComps.forEach(c -> formulas.computeIfAbsent(c.getFormulaDefinitionId(), formulaMapper::findById));
        List<CompletableFuture<Void>> fs = new ArrayList<>();
        for (Result r : rows) {
            fs.add(CompletableFuture.runAsync(() -> {
                boolean allOk = true;
                for (ComponentValue c : apiComps) {
                    FormulaDefinition f = formulas.get(c.getFormulaDefinitionId());
                    Resolved v = resolve(f, ek, r, batchId, 0);
                    if (v.error() == null) {
                        mapper.setComponentValue(r.getId(), c.getComponentId(), "API", v.value(), true, null);
                        jdbc.update("INSERT INTO formula_result (formula_definition_id, org_unit_id, year, period_code, value, batch_id) VALUES (?,?,?,?,?,?) "
                                + "ON DUPLICATE KEY UPDATE value = VALUES(value), batch_id = VALUES(batch_id), updated_at = NOW(3)",
                                f.getId(), r.getOrgUnitId(), ek.getYear(), ek.getPeriodCode(), v.value(), batchId);
                    } else allOk = false;
                }
                if (allOk) ok.incrementAndGet();
                else fail.incrementAndGet();
            }, POOL));
        }
        CompletableFuture.allOf(fs.toArray(new CompletableFuture[0])).join();
        mapper.touchSynced(ek.getId());
        calc.recalc(rows.stream().map(Result::getId).toList());
        // kết quả đã có → “Đã có kết quả”; KPI-kỳ → “Đã chấm”
        List<Result> fresh = mapper.findResultsByIds(rows.stream().map(Result::getId).toList());
        List<Result> toDone = fresh.stream().filter(x -> x.getFinalResult() != null && (EvaluationStateMachine.CHUA_CO_KQ.equals(x.getStatus())
                || EvaluationStateMachine.BCL.equals(x.getStatus()))).toList();
        sm.transitionResults(toDone, EvaluationStateMachine.DA_CO_KQ, "Đồng bộ kết quả từ API");
        if (ok.get() > 0 && !EvaluationStateMachine.CHOT_KQ_R2.equals(ek.getStatus())) sm.transitionEvalKpi(mapper.findEvalKpi(ek.getId()), EvaluationStateMachine.DA_CHAM, "Đồng bộ");
        String msg = "Đồng bộ thành công " + ok.get() + "/" + rows.size() + " đơn vị; lỗi " + fail.get();
        String status = fail.get() == 0 ? "THANH_CONG" : ok.get() == 0 ? "LOI" : "MOT_PHAN";
        batchMapper.finish(batchId, status, rows.size(), ok.get(), fail.get(), msg);
        audit.log("DONG_BO", "evaluation_kpi", ek.getId(), null, Map.of("message", msg, "batchId", batchId));
        return new SyncOutcome(batchId, rows.size(), ok.get(), fail.get(), false, msg);
    }

    record Resolved(BigDecimal value, String error) {}

    /** API → gọi nguồn; Công thức tổng hợp → tính biểu thức theo các định nghĩa thành phần (đệ quy ≤ 3 cấp) */
    Resolved resolve(FormulaDefinition f, EvalKpi ek, Result r, Long batchId, int depth) {
        if (f == null) return new Resolved(null, "Không tìm thấy định nghĩa");
        if ("CONG_THUC_TONG_HOP".equals(f.getDefinitionType())) {
            if (depth > 3) return new Resolved(null, "Công thức lồng quá sâu");
            var v = FormulaEvaluator.validate(f.getExpression(), null);
            Map<String, BigDecimal> vars = new HashMap<>();
            for (String code : v.variables()) {
                Resolved x = resolve(formulaMapper.findByCode(code), ek, r, batchId, depth + 1);
                if (x.error() != null) return x;
                vars.put(code, x.value());
            }
            var res = FormulaEvaluator.eval(f.getExpression(), vars);
            batchMapper.insertItem(batchId, f.getId(), r.getOrgUnitId(), "Công thức: " + f.getExpression(), res.value(), res.error());
            return new Resolved(res.value(), res.error());
        }
        if (!"THANH_PHAN_API".equals(f.getDefinitionType())) return new Resolved(null, "Định nghĩa " + f.getCode() + " không phải nguồn API");
        var resp = source.fetch(new KpiSourceClient.Request(f.getApiPath(), f.getHttpMethod(), f.getResponsePath(), null, ek.getYear(),
                ek.getPeriodCode(), r.getOrgUnitCode(), ek.getKpiCode()));
        batchMapper.insertItem(batchId, f.getId(), r.getOrgUnitId(), resp.requestSummary(), resp.value(), resp.error());
        return new Resolved(resp.value(), resp.error());
    }

    public Map<String, Object> batch(Long batchId) {
        SyncBatch b = Guards.found(batchMapper.findById(batchId), "lần đồng bộ");
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("batch", b);
        m.put("running", "DANG_CHAY".equals(b.getStatus()));
        m.put("errors", batchMapper.errorItems(batchId));
        return m;
    }
}
