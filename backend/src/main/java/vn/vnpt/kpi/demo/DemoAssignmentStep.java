package vn.vnpt.kpi.demo;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.modules.assignment.dto.AssignmentDtos.ByUnitRequest;
import vn.vnpt.kpi.modules.assignment.dto.AssignmentDtos.DetailInput;
import vn.vnpt.kpi.modules.assignment.service.AssignmentService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/** Seed demo giao KPI: năm trước + năm hiện tại đã giao (sinh dữ liệu đánh giá); năm sau “Đang soạn” cho 2 tỉnh */
@Component
@RequiredArgsConstructor
public class DemoAssignmentStep implements DemoDataSeeder.DemoStep {
    private final JdbcTemplate jdbc;
    private final AssignmentService service;
    private final DemoSecurity security;
    private final org.springframework.transaction.support.TransactionTemplate tx;

    /** KPI gốc và trọng số (Σ = 100); KPI cha kèm KPI con 50/50 */
    static final Map<String, Integer> SET = new LinkedHashMap<>();
    static {
        SET.put("TC-001", 15); SET.put("TC-002", 15); SET.put("TC-003", 10);
        SET.put("KH-001", 10); SET.put("KH-002", 10); SET.put("KH-004", 5);
        SET.put("QT-001", 10); SET.put("QT-002", 5); SET.put("QT-004", 5);
        SET.put("HP-001", 5); SET.put("HP-002", 5); SET.put("HP-004", 5);
    }
    static final Map<String, Integer> DEPT_SET = Map.of("TC-002", 25, "KH-001", 25, "QT-001", 25, "HP-001", 25);

    @Override public int order() { return 10; }

    @Override public String name() { return "Giao KPI năm trước/năm hiện tại"; }

    @Override
    public boolean done() {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM kpi_assignment", Integer.class);
        return n != null && n > 0;
    }

    @Override
    public void run() {
        security.runAsAdmin(() -> tx.executeWithoutResult(st -> {
            int cur = LocalDate.now().getYear();
            List<Long> units = jdbc.queryForList("SELECT id FROM org_unit WHERE deleted = 0 AND is_kpi_assignable = 1 AND level <= 2 ORDER BY level, sort_order", Long.class);
            List<Long> depts = jdbc.queryForList("SELECT id FROM org_unit WHERE deleted = 0 AND level = 3 AND (code LIKE 'VNPT\\_HNI\\_%' OR code LIKE 'VNPT\\_HCM\\_%' OR code LIKE '%\\_TT1')", Long.class);
            for (int year : List.of(cur - 1, cur)) {
                List<Long> headers = new ArrayList<>();
                Long root = units.get(0);
                List<Long> children = units.subList(1, units.size());
                // Công ty mẹ: chỉ tiêu = tổng hợp chỉ tiêu các đơn vị cấp 2 theo “Cách tính kết quả KPI Tập đoàn” → % TH/KH Tập đoàn hợp lý
                headers.add(service.createByUnit(new ByUnitRequest(root, year, groupDetails(root, children, year), null)).header().getId());
                for (Long u : children) headers.add(service.createByUnit(new ByUnitRequest(u, year, details(u, year, SET), null)).header().getId());
                for (Long u : depts) headers.add(service.createByUnit(new ByUnitRequest(u, year, details(u, year, DEPT_SET), null)).header().getId());
                service.closeByUnit(headers);
            }
            for (String code : List.of("VNPT_HNI", "VNPT_HCM")) {
                Long u = jdbc.queryForObject("SELECT id FROM org_unit WHERE code = ? AND deleted = 0", Long.class, code);
                service.createByUnit(new ByUnitRequest(u, cur + 1, details(u, cur + 1, SET), null));
            }
        }));
    }

    private List<DetailInput> details(Long unitId, int year, Map<String, Integer> set) {
        List<DetailInput> out = new ArrayList<>();
        for (Map.Entry<String, Integer> e : set.entrySet()) {
            Map<String, Object> k = jdbc.queryForMap("SELECT id, target_data_type FROM kpi WHERE code = ? AND deleted = 0", e.getKey());
            Long kid = ((Number) k.get("id")).longValue();
            out.add(input(kid, unitId, year, BigDecimal.valueOf(e.getValue()), (String) k.get("target_data_type")));
            for (Map<String, Object> c : jdbc.queryForList("SELECT id, target_data_type FROM kpi WHERE parent_id = ? AND deleted = 0 ORDER BY code", kid)) {
                out.add(input(((Number) c.get("id")).longValue(), unitId, year, BigDecimal.valueOf(50), (String) c.get("target_data_type")));
            }
        }
        return out;
    }

    /** Chỉ tiêu cấp Tập đoàn: TONG → Σ chỉ tiêu đơn vị con; cách tính khác → trung bình. Giữ trọng số của bộ KPI */
    private List<DetailInput> groupDetails(Long root, List<Long> children, int year) {
        List<DetailInput> base = details(root, year, SET);
        List<List<DetailInput>> kids = children.stream().map(u -> details(u, year, SET)).toList();
        List<DetailInput> out = new ArrayList<>();
        for (int i = 0; i < base.size(); i++) {
            DetailInput b = base.get(i);
            boolean sum = "TONG".equals(jdbc.queryForObject("SELECT group_aggregation FROM kpi WHERE id = ?", String.class, b.kpiId()));
            final int idx = i;
            Function<Function<DetailInput, BigDecimal>, BigDecimal> agg = g -> {
                BigDecimal s = kids.stream().map(k -> g.apply(k.get(idx))).reduce(BigDecimal.ZERO, BigDecimal::add);
                return sum ? s : s.divide(BigDecimal.valueOf(Math.max(1, kids.size())), 4, RoundingMode.HALF_UP);
            };
            out.add(new DetailInput(null, b.kpiId(), root, b.weight(), agg.apply(DetailInput::targetQ1), agg.apply(DetailInput::targetQ2), agg.apply(DetailInput::targetH1),
                    agg.apply(DetailInput::targetQ3), agg.apply(DetailInput::targetQ4), agg.apply(DetailInput::targetYear), null));
        }
        return out;
    }

    /** Chỉ tiêu ổn định theo (đơn vị, KPI): LUY_KE tích lũy theo quý, loại khác mỗi kỳ bằng chỉ tiêu năm */
    static DetailInput input(Long kpiId, Long unitId, int year, BigDecimal weight, String tdt) {
        int h = (int) Math.abs((kpiId * 7919L + unitId * 104729L + year) % 1_000_003L);
        BigDecimal base = BigDecimal.valueOf(60 + h % 60);
        if ("LUY_KE".equals(tdt)) {
            BigDecimal q = base.divide(BigDecimal.valueOf(4), 4, RoundingMode.HALF_UP);
            return new DetailInput(null, kpiId, unitId, weight, q, q.multiply(BigDecimal.TWO), q.multiply(BigDecimal.TWO), q.multiply(BigDecimal.valueOf(3)), base, base, null);
        }
        return new DetailInput(null, kpiId, unitId, weight, base, base, base, base, base, base, null);
    }
}
