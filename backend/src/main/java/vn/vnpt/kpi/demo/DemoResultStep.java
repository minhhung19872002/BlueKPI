package vn.vnpt.kpi.demo;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import vn.vnpt.kpi.modules.evaluation.service.EvaluationCalcService;

import java.time.LocalDate;
import java.util.List;

/**
 * Seed demo kết quả đánh giá: năm trước đủ 6 kỳ; năm hiện tại Q1, Q2, H1, Q3 (Q4/Cả năm chưa có kết quả).
 * Giá trị = KH × hệ số ổn định 0,60–1,29; một số đơn vị thiếu kết quả / đề nghị điều chỉnh để demo luồng chốt.
 */
@Component
@RequiredArgsConstructor
public class DemoResultStep implements DemoDataSeeder.DemoStep {
    private final JdbcTemplate jdbc;
    private final EvaluationCalcService calc;
    private final TransactionTemplate tx;

    @Override public int order() { return 20; }

    @Override public String name() { return "Kết quả đánh giá demo"; }

    @Override
    public boolean done() {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM evaluation_component_value", Integer.class);
        Integer a = jdbc.queryForObject("SELECT COUNT(*) FROM kpi_assignment", Integer.class);
        return (n != null && n > 0) || a == null || a == 0;
    }

    @Override
    public void run() {
        int cur = LocalDate.now().getYear();
        for (String p : List.of("Q1", "Q2", "H1", "Q3", "Q4", "Y")) fill(cur - 1, p);
        for (String p : List.of("Q1", "Q2", "H1", "Q3")) fill(cur, p);
        tx.executeWithoutResult(st -> {
            // Q3 năm hiện tại: 2 tỉnh thiếu kết quả một KPI (chưa đủ điều kiện chốt)
            jdbc.update("""
                    DELETE v FROM evaluation_component_value v JOIN evaluation_result r ON r.id = v.result_id
                    JOIN evaluation_kpi ek ON ek.id = r.evaluation_kpi_id JOIN kpi k ON k.id = ek.kpi_id JOIN org_unit o ON o.id = r.org_unit_id
                    WHERE ek.year = ? AND ek.period_code = 'Q3' AND k.code = 'QT-004' AND o.code IN ('VNPT_CMU','VNPT_AGG')""", cur);
            jdbc.update("""
                    UPDATE evaluation_result r JOIN evaluation_kpi ek ON ek.id = r.evaluation_kpi_id JOIN kpi k ON k.id = ek.kpi_id JOIN org_unit o ON o.id = r.org_unit_id
                    SET r.status = 'CHUA_CO_KQ', r.kpi_result = NULL, r.final_result = NULL, r.completion_rate = NULL, r.score = NULL, r.rating = 'DANG_THEO_DOI', r.bsc_score = NULL
                    WHERE ek.year = ? AND ek.period_code = 'Q3' AND k.code = 'QT-004' AND o.code IN ('VNPT_CMU','VNPT_AGG')""", cur);
            // VNPT Hà Nội đề nghị điều chỉnh KH-001 Q3; VNPT TP. HCM đã được xử lý điều chỉnh KH-004 Q3
            Long hni = jdbc.queryForObject("""
                    SELECT r.id FROM evaluation_result r JOIN evaluation_kpi ek ON ek.id = r.evaluation_kpi_id JOIN kpi k ON k.id = ek.kpi_id
                    JOIN org_unit o ON o.id = r.org_unit_id WHERE ek.year = ? AND ek.period_code = 'Q3' AND k.code = 'KH-001' AND o.code = 'VNPT_HNI'""", Long.class, cur);
            Long user = jdbc.queryForObject("SELECT id FROM app_user WHERE username = 'tinh_hni'", Long.class);
            jdbc.update("UPDATE evaluation_result SET status = 'DV_DE_NGHI_DIEU_CHINH' WHERE id = ?", hni);
            jdbc.update("INSERT INTO adjustment_request (result_id, proposal_note, status, requested_by_id, created_by, updated_by) VALUES (?, ?, 'CHO_XU_LY', ?, 'tinh_hni', 'tinh_hni')",
                    hni, "Số liệu khảo sát NPS quý III chưa bao gồm kênh trực tuyến, đề nghị bổ sung 3 điểm", user);
            jdbc.update("INSERT INTO evaluation_feedback (result_id, author_id, content, feedback_type, at) VALUES (?, ?, ?, 'DE_NGHI', NOW(3))",
                    hni, user, "Số liệu khảo sát NPS quý III chưa bao gồm kênh trực tuyến, đề nghị bổ sung 3 điểm");
            jdbc.update("INSERT INTO evaluation_status_history (result_id, from_status, to_status, note, at, `by`) VALUES (?, 'DA_CO_KQ', 'DV_DE_NGHI_DIEU_CHINH', 'Đề nghị điều chỉnh', NOW(3), 'tinh_hni')", hni);
            jdbc.update("""
                    UPDATE evaluation_result r JOIN evaluation_kpi ek ON ek.id = r.evaluation_kpi_id JOIN kpi k ON k.id = ek.kpi_id JOIN org_unit o ON o.id = r.org_unit_id
                    SET r.status = 'DA_XU_LY_DIEU_CHINH' WHERE ek.year = ? AND ek.period_code = 'Q3' AND k.code = 'KH-004' AND o.code = 'VNPT_HCM'""", cur);
        });
    }

    void fill(int year, String period) {
        tx.executeWithoutResult(st -> {
            jdbc.update("""
                    INSERT INTO evaluation_component_value (result_id, component_id, source, value, synced_at, created_by, updated_by)
                    SELECT r.id, c.id, c.source,
                      ROUND(COALESCE(r.plan_value, 100) * (0.60 + MOD(r.id * 37 + c.id * 11 + r.org_unit_id * 7, 70) / 100), 4),
                      IF(c.source = 'API', NOW(3), NULL), 'system', 'system'
                    FROM evaluation_result r JOIN evaluation_kpi ek ON ek.id = r.evaluation_kpi_id JOIN kpi_component c ON c.kpi_id = ek.kpi_id AND c.deleted = 0
                    WHERE ek.year = ? AND ek.period_code = ? AND r.deleted = 0
                    ON DUPLICATE KEY UPDATE value = VALUES(value)""", year, period);
        });
        calc.recalcPeriod(year, period);
        tx.executeWithoutResult(st -> {
            jdbc.update("""
                    UPDATE evaluation_result r JOIN evaluation_kpi ek ON ek.id = r.evaluation_kpi_id
                    SET r.status = 'DA_CO_KQ' WHERE ek.year = ? AND ek.period_code = ? AND r.status = 'CHUA_CO_KQ' AND (r.final_result IS NOT NULL OR r.score IS NOT NULL)""",
                    year, period);
            jdbc.update("UPDATE evaluation_kpi SET status = 'DA_CHAM' WHERE year = ? AND period_code = ? AND status = 'CHUA_CHAM'", year, period);
        });
    }
}
