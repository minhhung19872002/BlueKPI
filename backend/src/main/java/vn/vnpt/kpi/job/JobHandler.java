package vn.vnpt.kpi.job;

import java.util.Map;

/** Bộ xử lý cho một loại công việc lịch (sync_schedule.job_type) */
public interface JobHandler {
    record Context(Long scheduleId, Long batchId, String trigger, String triggeredBy, Map<String, Object> params) {}

    record Result(int total, int success, int failed, String message) {
        public static Result ok(String message) { return new Result(1, 1, 0, message); }
        public String status() { return failed == 0 ? "THANH_CONG" : success == 0 ? "LOI" : "MOT_PHAN"; }
    }

    String jobType();

    Result run(Context ctx) throws Exception;
}
