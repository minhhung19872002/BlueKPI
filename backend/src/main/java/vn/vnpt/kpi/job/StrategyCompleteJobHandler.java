package vn.vnpt.kpi.job;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.modules.strategy.service.StrategyService;

import java.time.LocalDate;

/** Job HOAN_TAT_CHIEN_LUOC: chiến lược “Đang thực hiện” có giai đoạn đã kết thúc (đến năm &lt; năm hiện tại) → “Hoàn thành” */
@Component
@RequiredArgsConstructor
public class StrategyCompleteJobHandler implements JobHandler {
    private final StrategyService strategies;

    @Override
    public String jobType() { return "HOAN_TAT_CHIEN_LUOC"; }

    @Override
    public Result run(Context ctx) {
        int year = ctx.params().get("year") instanceof Number n ? n.intValue() : LocalDate.now().getYear();
        int n = strategies.completeFinished(year);
        return new Result(n, n, 0, "Đã chuyển " + n + " chiến lược sang “Hoàn thành”");
    }
}
