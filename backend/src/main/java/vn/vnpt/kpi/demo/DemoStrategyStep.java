package vn.vnpt.kpi.demo;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.modules.strategy.service.StrategyService;
import vn.vnpt.kpi.modules.strategy.service.StrategyService.KpiIn;
import vn.vnpt.kpi.modules.strategy.service.StrategyService.LinkIn;
import vn.vnpt.kpi.modules.strategy.service.StrategyService.MapRequest;
import vn.vnpt.kpi.modules.strategy.service.StrategyService.NodeIn;
import vn.vnpt.kpi.modules.strategy.service.StrategyService.StrategyRequest;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Seed demo bản đồ chiến lược: Tập đoàn 2026–2030 (đủ 4 viễn cảnh, liên kết nhân quả, khung KPI), VNPT Hà Nội 2026–2030,
 * và chiến lược giai đoạn 2021–2025 đã “Hoàn thành” (qua job Hoàn tất chiến lược).
 * Toạ độ node: dải viễn cảnh thứ i (theo “Thứ tự”) nằm ở y = i × {@value #LANE_H}; cột j ở x = {@value #X0} + j × {@value #COL_W}.
 */
@Component
@RequiredArgsConstructor
public class DemoStrategyStep implements DemoDataSeeder.DemoStep {
    static final int LANE_H = 200, X0 = 180, COL_W = 280, Y_PAD = 40;

    private final JdbcTemplate jdbc;
    private final StrategyService strategies;
    private final DemoSecurity security;

    @Override public int order() { return 40; }

    @Override public String name() { return "Bản đồ chiến lược demo"; }

    @Override
    public boolean done() {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM strategy", Integer.class);
        Integer o = jdbc.queryForObject("SELECT COUNT(*) FROM strategic_objective WHERE code LIKE 'MT-%'", Integer.class);
        return (n != null && n > 0) || o == null || o == 0;
    }

    @Override
    public void run() {
        int cur = LocalDate.now().getYear();
        long vnpt = id("SELECT id FROM org_unit WHERE code = 'VNPT'"), hni = id("SELECT id FROM org_unit WHERE code = 'VNPT_HNI'");
        long owner = id("SELECT id FROM app_user WHERE username = 'lapchienluoc'");
        long hniOwner = id("SELECT id FROM app_user WHERE username = 'tinh_hni'");
        long gd2630 = id("SELECT id FROM evaluation_stage WHERE code = 'GD_2026_2030'"), gd2125 = id("SELECT id FROM evaluation_stage WHERE code = 'GD_2021_2025'");
        security.runAsAdmin(() -> {
            var s1 = strategies.create(new StrategyRequest("Chiến lược phát triển Tập đoàn VNPT giai đoạn 2026–2030", gd2630, owner, vnpt, Math.min(Math.max(cur, 2026), 2030), null, null));
            strategies.saveMap(s1.getId(), map(List.of("MT-TC-01", "MT-TC-02", "MT-TC-03", "MT-TC-04", "MT-KH-01", "MT-KH-02", "MT-KH-03", "MT-KH-04",
                    "MT-QT-01", "MT-QT-02", "MT-QT-03", "MT-QT-04", "MT-HP-01", "MT-HP-02", "MT-HP-03", "MT-HP-04"), List.of(
                    "MT-HP-01>MT-QT-01", "MT-HP-02>MT-QT-02", "MT-HP-03>MT-QT-03", "MT-HP-04>MT-QT-04",
                    "MT-QT-01>MT-KH-01", "MT-QT-04>MT-KH-01", "MT-QT-02>MT-KH-04", "MT-QT-03>MT-KH-03",
                    "MT-KH-01>MT-TC-01", "MT-KH-02>MT-TC-01", "MT-KH-03>MT-TC-03", "MT-KH-04>MT-TC-04", "MT-TC-03>MT-TC-02")), true);
            var s2 = strategies.create(new StrategyRequest("Chiến lược phát triển VNPT Hà Nội giai đoạn 2026–2030", gd2630, hniOwner, hni, Math.min(Math.max(cur, 2026), 2030), null, null));
            strategies.saveMap(s2.getId(), map(List.of("MT-TC-01", "MT-TC-04", "MT-KH-01", "MT-KH-02", "MT-QT-01", "MT-QT-04", "MT-HP-01"), List.of(
                    "MT-HP-01>MT-QT-01", "MT-QT-01>MT-KH-01", "MT-QT-04>MT-KH-01", "MT-KH-01>MT-TC-01", "MT-KH-02>MT-TC-01")), true);
            var s3 = strategies.create(new StrategyRequest("Chiến lược Tập đoàn VNPT giai đoạn 2021–2025", gd2125, owner, vnpt, 2025, null, null));
            strategies.saveMap(s3.getId(), map(List.of("MT-TC-01", "MT-KH-01", "MT-QT-01", "MT-HP-01"), List.of("MT-HP-01>MT-QT-01", "MT-QT-01>MT-KH-01", "MT-KH-01>MT-TC-01")), true);
            strategies.completeFinished(cur);
        });
    }

    private long id(String sql) {
        Long v = jdbc.queryForObject(sql, Long.class);
        return v == null ? 0 : v;
    }

    /** Dựng bản đồ: node theo dải viễn cảnh, liên kết dưới → trên, khung KPI = KPI gốc gắn mục tiêu */
    private MapRequest map(List<String> codes, List<String> links) {
        Map<String, Long> ids = new LinkedHashMap<>();
        Map<String, Integer> lane = new LinkedHashMap<>();
        List<Map<String, Object>> lanes = jdbc.queryForList("SELECT id FROM perspective WHERE deleted = 0 AND status = 'HIEU_LUC' ORDER BY sort_order, code");
        for (String c : codes) {
            Map<String, Object> o = jdbc.queryForMap("SELECT id, perspective_id FROM strategic_objective WHERE code = ? AND deleted = 0", c);
            ids.put(c, ((Number) o.get("id")).longValue());
            int idx = 0;
            for (int i = 0; i < lanes.size(); i++) if (((Number) lanes.get(i).get("id")).longValue() == ((Number) o.get("perspective_id")).longValue()) idx = i;
            lane.put(c, idx);
        }
        Map<Integer, Integer> col = new LinkedHashMap<>();
        List<NodeIn> nodes = new ArrayList<>();
        for (String c : codes) {
            int l = lane.get(c), j = col.merge(l, 1, Integer::sum) - 1;
            nodes.add(new NodeIn(ids.get(c), (double) (X0 + j * COL_W), (double) (l * LANE_H + Y_PAD)));
        }
        List<LinkIn> edges = links.stream().map(s -> s.split(">")).map(p -> {
            boolean up = lane.get(p[0]) > lane.get(p[1]), same = lane.get(p[0]).equals(lane.get(p[1]));
            return new LinkIn(ids.get(p[0]), ids.get(p[1]), same ? "right" : up ? "top" : "bottom", same ? "left" : up ? "bottom" : "top");
        }).toList();
        List<KpiIn> kpis = new ArrayList<>();
        for (Long oid : ids.values()) {
            for (Long k : jdbc.queryForList("SELECT id FROM kpi WHERE objective_id = ? AND parent_id IS NULL AND deleted = 0 ORDER BY code LIMIT 4", Long.class, oid)) {
                kpis.add(new KpiIn(oid, k));
            }
        }
        return new MapRequest(nodes, edges, kpis, null, null);
    }
}
