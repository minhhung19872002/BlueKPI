package vn.vnpt.kpi.job;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.common.Labels;
import vn.vnpt.kpi.modules.notification.service.NotificationService;
import vn.vnpt.kpi.modules.sysconfig.service.SysConfigService;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

/**
 * Job NHAC_HAN_CAP_NHAT: hạn cập nhật kết quả = ngày cuối kỳ + DEADLINE_DAY_AFTER_PERIOD; nhắc trước REMIND_DAYS_BEFORE_DEADLINE ngày
 * (và khi đã quá hạn) cho cán bộ đánh giá các KPI chưa có kết quả trong kỳ — chuông + email.
 */
@Component
@RequiredArgsConstructor
public class ReminderJobHandler implements JobHandler {
    private final JdbcTemplate jdbc;
    private final SysConfigService config;
    private final NotificationService notifications;

    @Override public String jobType() { return "NHAC_HAN_CAP_NHAT"; }

    @Override
    public Result run(Context ctx) {
        LocalDate today = LocalDate.now();
        int after = config.getInt(SysConfigService.DEADLINE_DAY_AFTER_PERIOD, 15);
        int before = config.getInt(SysConfigService.REMIND_DAYS_BEFORE_DEADLINE, 5);
        int sent = 0, periods = 0;
        for (int year : List.of(today.getYear() - 1, today.getYear())) {
            for (String p : List.of("Q1", "Q2", "H1", "Q3", "Q4", "Y")) {
                LocalDate deadline = periodEnd(year, p).plusDays(after);
                long days = ChronoUnit.DAYS.between(today, deadline);
                if (days > before || days < -30) continue;
                periods++;
                List<Map<String, Object>> rows = jdbc.queryForList("""
                        SELECT k.evaluating_officer_id AS id, COUNT(*) AS pending
                        FROM evaluation_result r JOIN evaluation_kpi ek ON ek.id = r.evaluation_kpi_id JOIN kpi k ON k.id = ek.kpi_id
                        WHERE r.deleted = 0 AND ek.year = ? AND ek.period_code = ? AND r.status IN ('CHUA_CO_KQ','BCL_YEU_CAU_LAM_LAI')
                        GROUP BY k.evaluating_officer_id""", year, p);
                for (Map<String, Object> r : rows) {
                    List<Map<String, Object>> users = jdbc.queryForList("SELECT id, username, full_name AS fullName, email, phone FROM app_user WHERE id = ? AND deleted = 0 AND status = 'HOAT_DONG'", r.get("id"));
                    String when = days >= 0 ? "còn " + days + " ngày đến hạn " : "đã quá hạn ";
                    sent += notifications.send(users, new NotificationService.Message(NotificationService.EV_NHAC_HAN,
                            "Nhắc hạn cập nhật kết quả KPI " + Labels.of(Labels.PERIOD, p) + " " + year,
                            "Còn " + r.get("pending") + " kết quả KPI chưa cập nhật, " + when + deadline.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy")),
                            "/kpi-admin/evaluations", Map.of("tab", "kpi")), NotificationService.Channel.BELL, NotificationService.Channel.EMAIL);
                }
            }
        }
        return new Result(periods, periods, 0, "Đã gửi " + sent + " thông báo nhắc hạn");
    }

    static LocalDate periodEnd(int year, String p) {
        return switch (p) {
            case "Q1" -> LocalDate.of(year, 3, 31);
            case "Q2", "H1" -> LocalDate.of(year, 6, 30);
            case "Q3" -> LocalDate.of(year, 9, 30);
            default -> LocalDate.of(year, 12, 31);
        };
    }
}
