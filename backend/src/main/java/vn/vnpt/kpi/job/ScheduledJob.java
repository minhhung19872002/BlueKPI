package vn.vnpt.kpi.job;

import org.quartz.DisallowConcurrentExecution;
import org.quartz.JobExecutionContext;
import org.quartz.PersistJobDataAfterExecution;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.quartz.QuartzJobBean;

/**
 * Quartz job chung cho mọi lịch đồng bộ (JobDataMap: scheduleId). Không chạy song song cùng một lịch
 * (cluster-safe nhờ JDBC JobStore + DisallowConcurrentExecution).
 */
@DisallowConcurrentExecution
@PersistJobDataAfterExecution
public class ScheduledJob extends QuartzJobBean {
    @Autowired
    private JobRunner runner;

    @Override
    protected void executeInternal(JobExecutionContext ctx) {
        var data = ctx.getMergedJobDataMap();
        Long scheduleId = data.getLong("scheduleId");
        String trigger = data.containsKey("trigger") ? data.getString("trigger") : "JOB";
        String by = data.containsKey("triggeredBy") ? data.getString("triggeredBy") : "system";
        runner.run(scheduleId, trigger, by, ctx.getNextFireTime());
    }
}
