package vn.vnpt.kpi.demo;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.modules.bsc.service.BscService;
import vn.vnpt.kpi.modules.bsc.service.BscSummaryService;

import java.time.LocalDate;
import java.util.List;

/** Seed demo chốt/duyệt: năm trước đủ 6 kỳ đã chốt, TGĐ duyệt 5 kỳ (Cả năm chờ ký duyệt); năm hiện tại Q1 đã duyệt; Q2/H1 đủ điều kiện chờ chốt; Q3 còn mở */
@Component
@RequiredArgsConstructor
public class DemoClosingStep implements DemoDataSeeder.DemoStep {
    private final JdbcTemplate jdbc;
    private final BscService bsc;
    private final BscSummaryService summary;
    private final DemoSecurity security;

    @Override public int order() { return 30; }

    @Override public String name() { return "Chốt / TGĐ duyệt các kỳ demo"; }

    @Override
    public boolean done() {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM period_closing", Integer.class);
        Integer r = jdbc.queryForObject("SELECT COUNT(*) FROM evaluation_component_value", Integer.class);
        return (n != null && n > 0) || r == null || r == 0;
    }

    @Override
    public void run() {
        int cur = LocalDate.now().getYear();
        security.runAsAdmin(() -> {
            for (String p : List.of("Q1", "Q2", "H1", "Q3", "Q4", "Y")) {
                bsc.close(new BscService.YearPeriod(cur - 1, p));
                if (!"Y".equals(p)) bsc.approve(new BscService.YearPeriod(cur - 1, p));
            }
            bsc.close(new BscService.YearPeriod(cur, "Q1"));
            bsc.approve(new BscService.YearPeriod(cur, "Q1"));
            // tính lại xếp hạng theo thứ tự thời gian để biến động chính xác
            for (int y : List.of(cur - 1, cur)) for (String p : List.of("Q1", "Q2", "H1", "Q3", "Q4", "Y")) summary.recompute(y, p);
        });
    }
}
