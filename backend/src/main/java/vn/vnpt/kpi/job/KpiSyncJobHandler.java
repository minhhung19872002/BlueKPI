package vn.vnpt.kpi.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.demo.DemoSecurity;
import vn.vnpt.kpi.modules.evaluation.mapper.EvaluationMapper;
import vn.vnpt.kpi.modules.evaluation.service.SyncService;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Job DONG_BO_KET_QUA_KPI: đồng bộ kết quả các KPI có thành phần API cho các kỳ đã bắt đầu trong năm (chưa chốt R2/TGĐ duyệt).
 * Tham số: {"year": 2026, "periods": ["Q3"]} (tùy chọn).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class KpiSyncJobHandler implements JobHandler {
    private final EvaluationMapper mapper;
    private final SyncService sync;
    private final DemoSecurity security;

    @Override public String jobType() { return "DONG_BO_KET_QUA_KPI"; }

    @Override
    public Result run(Context ctx) {
        LocalDate today = LocalDate.now();
        int year = ctx.params().get("year") instanceof Number n ? n.intValue() : today.getYear();
        List<String> periods = new ArrayList<>();
        if (ctx.params().get("periods") instanceof List<?> l) l.forEach(p -> periods.add(String.valueOf(p)));
        else periods.addAll(startedPeriods(year, today));
        if (periods.isEmpty()) return Result.ok("Không có kỳ cần đồng bộ");
        AtomicInteger ok = new AtomicInteger(), fail = new AtomicInteger();
        List<Long> ids = mapper.evalKpiIdsWithApi(year, periods);
        security.runAs(ctx.triggeredBy() == null || "system".equals(ctx.triggeredBy()) ? "admin" : ctx.triggeredBy(), () -> {
            for (Long id : ids) {
                try {
                    var o = sync.syncEvalKpi(id, ctx.trigger());
                    if (o.failed() == 0) ok.incrementAndGet();
                    else fail.incrementAndGet();
                } catch (Exception e) {
                    log.debug("Bỏ qua KPI-kỳ {}: {}", id, e.getMessage());
                    fail.incrementAndGet();
                }
            }
        });
        return new Result(ids.size(), ok.get(), fail.get(), "Đồng bộ " + ok.get() + "/" + ids.size() + " KPI-kỳ năm " + year + " (" + String.join(", ", periods) + ")");
    }

    static List<String> startedPeriods(int year, LocalDate today) {
        List<String> out = new ArrayList<>();
        if (today.getYear() > year) return List.of("Q1", "Q2", "H1", "Q3", "Q4", "Y");
        if (today.getYear() < year) return out;
        int m = today.getMonthValue();
        out.add("Q1");
        out.add("Y");
        if (m >= 4) { out.add("Q2"); out.add("H1"); }
        if (m >= 7) out.add("Q3");
        if (m >= 10) out.add("Q4");
        return out;
    }
}
