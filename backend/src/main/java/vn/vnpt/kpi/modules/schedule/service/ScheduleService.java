package vn.vnpt.kpi.modules.schedule.service;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.quartz.CronExpression;
import org.quartz.CronScheduleBuilder;
import org.quartz.JobBuilder;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.TriggerKey;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
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
import vn.vnpt.kpi.job.ScheduledJob;
import vn.vnpt.kpi.modules.schedule.mapper.ScheduleMapper;
import vn.vnpt.kpi.modules.schedule.model.SyncSchedule;
import vn.vnpt.kpi.modules.sync.mapper.SyncBatchMapper;
import vn.vnpt.kpi.security.CurrentUser;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TimeZone;

/** Lịch đồng bộ (26.17–26.19): Quartz JDBC clustered; sửa lịch → reschedule ngay; “Chạy ngay” */
@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduleService {
    static final TimeZone TZ = TimeZone.getTimeZone("Asia/Ho_Chi_Minh");
    static final String GROUP = "kpi";

    public record ScheduleUpdate(@NotBlank(message = "Vui lòng nhập Tên lịch") @Size(max = 255) String name,
                                 @NotBlank(message = "Vui lòng nhập Lịch chạy") @Size(max = 100) String cron,
                                 @NotNull(message = "Vui lòng chọn Trạng thái") Boolean enabled,
                                 String params, Integer version) {}

    private final ScheduleMapper mapper;
    private final SyncBatchMapper batchMapper;
    private final Scheduler scheduler;
    private final AuditService audit;

    public PageResult<SyncSchedule> search(String keyword, PageQuery q) {
        q.applySort(Map.of("code", "code", "name", "name", "lastRunAt", "last_run_at"), "id");
        String kw = Strs.like(keyword);
        return PageResult.of(mapper.search(kw, q).stream().map(this::decorate).toList(), mapper.count(kw), q);
    }

    public Map<String, Object> get(Long id) {
        SyncSchedule s = decorate(Guards.found(mapper.findById(id), "lịch đồng bộ"));
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("schedule", s);
        m.put("runs", batchMapper.recentBySchedule(id, 20));
        return m;
    }

    @Transactional
    public SyncSchedule update(Long id, ScheduleUpdate u) {
        SyncSchedule before = decorate(Guards.found(mapper.findById(id), "lịch đồng bộ"));
        String cron = u.cron().trim();
        if (!CronExpression.isValidExpression(cron)) throw BusinessException.field("cron", "Lịch chạy (cron) không hợp lệ");
        String params = Strs.isBlank(u.params()) ? "{}" : u.params().trim();
        if (!Jsons.isValidJson(params)) throw BusinessException.field("params", "Tham số phải là JSON hợp lệ");
        SyncSchedule s = new SyncSchedule();
        s.setId(id);
        s.setName(u.name().trim());
        s.setCron(cron);
        s.setEnabled(u.enabled());
        s.setParams(params);
        s.setNextRunAt(u.enabled() ? nextRun(cron) : null);
        s.setVersion(u.version() == null ? before.getVersion() : u.version());
        s.setUpdatedBy(CurrentUser.currentUsername());
        Guards.updated(mapper.update(s));
        SyncSchedule after = mapper.findById(id);
        register(after); // reschedule trigger Quartz ngay
        audit.log("SUA", "sync_schedule", id, before, after);
        return decorate(after);
    }

    /** “Chạy ngay” (SCHEDULE:RUN) — trigger Quartz một lần, ghi sync_batch trigger = USER */
    public void runNow(Long id) {
        SyncSchedule s = Guards.found(mapper.findById(id), "lịch đồng bộ");
        try {
            JobKey key = jobKey(s);
            if (!scheduler.checkExists(key)) register(s);
            JobDataMap data = new JobDataMap();
            data.put("scheduleId", s.getId());
            data.put("trigger", "USER");
            data.put("triggeredBy", CurrentUser.currentUsername());
            scheduler.triggerJob(key, data);
        } catch (SchedulerException e) {
            throw new BusinessException(ErrorCode.ERR_INTERNAL, "Không chạy được lịch: " + e.getMessage());
        }
        audit.log("CHAY_NGAY", "sync_schedule", id, null, Map.of("code", s.getCode()));
    }

    /** Đồng bộ toàn bộ lịch từ DB vào Quartz khi khởi động */
    @EventListener(ApplicationReadyEvent.class)
    public void registerAll() {
        for (SyncSchedule s : mapper.findAll()) {
            try {
                register(s);
            } catch (RuntimeException e) {
                log.warn("Không đăng ký được lịch {}: {}", s.getCode(), e.getMessage());
            }
        }
    }

    void register(SyncSchedule s) {
        try {
            JobKey key = jobKey(s);
            JobDetail job = JobBuilder.newJob(ScheduledJob.class).withIdentity(key).storeDurably()
                    .usingJobData("scheduleId", s.getId()).withDescription(s.getName()).build();
            scheduler.addJob(job, true);
            TriggerKey tk = TriggerKey.triggerKey(s.getCode(), GROUP);
            if (Boolean.TRUE.equals(s.getEnabled()) && CronExpression.isValidExpression(s.getCron())) {
                Trigger t = TriggerBuilder.newTrigger().withIdentity(tk).forJob(key)
                        .withSchedule(CronScheduleBuilder.cronSchedule(s.getCron()).inTimeZone(TZ).withMisfireHandlingInstructionDoNothing())
                        .build();
                if (scheduler.checkExists(tk)) scheduler.rescheduleJob(tk, t);
                else scheduler.scheduleJob(t);
                Date next = t.getFireTimeAfter(new Date());
                mapper.updateNextRun(s.getId(), next == null ? null : LocalDateTime.ofInstant(next.toInstant(), ZoneId.systemDefault()));
            } else {
                if (scheduler.checkExists(tk)) scheduler.unscheduleJob(tk);
                mapper.updateNextRun(s.getId(), null);
            }
        } catch (SchedulerException e) {
            throw new BusinessException(ErrorCode.ERR_INTERNAL, "Lỗi đăng ký lịch Quartz: " + e.getMessage());
        }
    }

    static LocalDateTime nextRun(String cron) {
        try {
            CronExpression ce = new CronExpression(cron);
            ce.setTimeZone(TZ);
            Date d = ce.getNextValidTimeAfter(new Date());
            return d == null ? null : LocalDateTime.ofInstant(d.toInstant(), ZoneId.systemDefault());
        } catch (java.text.ParseException e) {
            return null;
        }
    }

    private static JobKey jobKey(SyncSchedule s) {
        return JobKey.jobKey(s.getCode(), GROUP);
    }

    private SyncSchedule decorate(SyncSchedule s) {
        s.setCronDescription(CronDescriber.describe(s.getCron()));
        s.setJobTypeName(Labels.of(Labels.JOB_TYPE, s.getJobType()));
        return s;
    }
}
