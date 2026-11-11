package vn.vnpt.kpi.job;

import com.fasterxml.jackson.core.type.TypeReference;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.common.util.Jsons;
import vn.vnpt.kpi.modules.schedule.mapper.ScheduleMapper;
import vn.vnpt.kpi.modules.schedule.model.SyncSchedule;
import vn.vnpt.kpi.modules.sync.mapper.SyncBatchMapper;
import vn.vnpt.kpi.modules.sync.model.SyncBatch;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Chạy một lịch: ghi sync_batch (trigger JOB/USER), gọi handler theo job_type, cập nhật lần chạy gần nhất */
@Slf4j
@Component
public class JobRunner {
    private final ScheduleMapper scheduleMapper;
    private final SyncBatchMapper batchMapper;
    private final Map<String, JobHandler> handlers;

    public JobRunner(ScheduleMapper scheduleMapper, SyncBatchMapper batchMapper, List<JobHandler> handlers) {
        this.scheduleMapper = scheduleMapper;
        this.batchMapper = batchMapper;
        this.handlers = handlers.stream().collect(Collectors.toMap(JobHandler::jobType, Function.identity(), (a, b) -> a));
    }

    public JobHandler.Result run(Long scheduleId, String trigger, String triggeredBy, Date nextFire) {
        SyncSchedule s = scheduleMapper.findById(scheduleId);
        if (s == null) return new JobHandler.Result(0, 0, 0, "Không tìm thấy lịch");
        SyncBatch b = new SyncBatch();
        b.setJobType(s.getJobType());
        b.setScheduleId(s.getId());
        b.setTrigger(trigger);
        b.setTriggeredBy(triggeredBy);
        batchMapper.insert(b);
        JobHandler h = handlers.get(s.getJobType());
        JobHandler.Result r;
        try {
            Map<String, Object> params = s.getParams() == null ? new HashMap<>() : Jsons.fromJson(s.getParams(), new TypeReference<Map<String, Object>>() {});
            r = h == null ? new JobHandler.Result(0, 0, 1, "Chưa có bộ xử lý cho loại công việc " + s.getJobType())
                    : h.run(new JobHandler.Context(s.getId(), b.getId(), trigger, triggeredBy, params == null ? new HashMap<>() : params));
        } catch (Exception e) {
            log.error("Lịch {} lỗi", s.getCode(), e);
            r = new JobHandler.Result(1, 0, 1, "Lỗi: " + truncate(e.getMessage()));
        }
        batchMapper.finish(b.getId(), r.status(), r.total(), r.success(), r.failed(), truncate(r.message()));
        LocalDateTime next = nextFire == null ? s.getNextRunAt() : LocalDateTime.ofInstant(nextFire.toInstant(), ZoneId.systemDefault());
        scheduleMapper.updateRun(s.getId(), LocalDateTime.now(), r.status(), next);
        return r;
    }

    private static String truncate(String s) {
        return s == null ? null : s.length() > 1900 ? s.substring(0, 1900) : s;
    }
}
