package vn.vnpt.kpi.job;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.integration.hrm.HrmClient;

/** Job DONG_BO_HRM — mặc định tắt (kpi.hrm.enabled=false) */
@Component
@RequiredArgsConstructor
public class HrmSyncJobHandler implements JobHandler {
    private final HrmClient hrm;
    @Value("${kpi.hrm.enabled:false}")
    private boolean enabled;

    @Override
    public String jobType() { return "DONG_BO_HRM"; }

    @Override
    public Result run(Context ctx) {
        if (!enabled) return Result.ok("Tích hợp HRM đang tắt (kpi.hrm.enabled=false)");
        int units = hrm.syncOrgUnits().size();
        int users = hrm.syncUsers().size();
        return new Result(units + users, units + users, 0, "Đồng bộ HRM: " + units + " đơn vị, " + users + " người dùng");
    }
}
