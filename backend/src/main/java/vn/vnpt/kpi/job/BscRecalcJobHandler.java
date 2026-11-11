package vn.vnpt.kpi.job;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.modules.bsc.mapper.BscMapper;
import vn.vnpt.kpi.modules.bsc.service.BscSummaryService;
import vn.vnpt.kpi.modules.evaluation.service.EvaluationCalcService;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Job TINH_LAI_BSC: tính lại điểm các kỳ chưa TGĐ duyệt của năm hiện tại (tham số {"year":..., "periods":[...]}) */
@Component
@RequiredArgsConstructor
public class BscRecalcJobHandler implements JobHandler {
    private final EvaluationCalcService calc;
    private final BscSummaryService summary;
    private final BscMapper mapper;

    @Override public String jobType() { return "TINH_LAI_BSC"; }

    @Override
    @SuppressWarnings("unchecked")
    public Result run(Context ctx) {
        int year = ctx.params().get("year") instanceof Number n ? n.intValue() : LocalDate.now().getYear();
        List<String> periods = ctx.params().get("periods") instanceof List<?> l ? (List<String>) l : List.of("Q1", "Q2", "H1", "Q3", "Q4", "Y");
        int done = 0;
        for (String p : periods) {
            Map<String, Object> c = mapper.periodClosing(year, p);
            if (c != null && "TGD_DA_DUYET".equals(c.get("status"))) continue;
            calc.recalcPeriod(year, p);
            summary.recompute(year, p);
            done++;
        }
        return new Result(periods.size(), done, 0, "Đã tính lại " + done + " kỳ năm " + year);
    }
}
