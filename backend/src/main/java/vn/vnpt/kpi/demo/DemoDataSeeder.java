package vn.vnpt.kpi.demo;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.modules.catalog.dto.KpiRequest;
import vn.vnpt.kpi.modules.catalog.service.KpiService;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Seed dữ liệu demo (profile dev/demo, kpi.demo-seed=true) — PHẦN D §2.
 * Tạo qua service thật để mã KPI, sequence, audit nhất quán. Chạy một lần khi chưa có KPI.
 * Các bước giao KPI / kết quả / chiến lược được bổ sung bởi {@link DemoStep} của các phase sau.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DemoDataSeeder {
    private final JdbcTemplate jdbc;
    private final KpiService kpiService;
    private final List<DemoStep> steps;
    @Value("${kpi.demo-seed:false}")
    private boolean enabled;

    /** Bước seed bổ sung (theo thứ tự order()) */
    public interface DemoStep {
        int order();

        String name();

        boolean done();

        void run();
    }

    record Def(String name, String objective, String uom, String source, String formula, String completion, boolean parent) {}

    @EventListener(ApplicationReadyEvent.class)
    @Order(100)
    public void seed() {
        if (!enabled) return;
        try {
            Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM kpi", Integer.class);
            if (n == null || n == 0) seedKpis();
            for (DemoStep s : steps.stream().sorted(java.util.Comparator.comparingInt(DemoStep::order)).toList()) {
                if (!s.done()) {
                    log.info("Seed demo: {}", s.name());
                    s.run();
                }
            }
        } catch (Exception e) {
            log.error("Seed demo thất bại", e);
        }
    }

    void seedKpis() {
        Long root = id("SELECT id FROM org_unit WHERE code = 'VNPT' AND deleted = 0");
        Long giao = id("SELECT id FROM app_user WHERE username = 'giaokpi'");
        Long danhgia = id("SELECT id FROM app_user WHERE username = 'danhgia'");
        Long khung = id("SELECT id FROM scoring_method WHERE code = 'KHUNG_TY_LE_5'");
        Long datKhong = id("SELECT id FROM scoring_method WHERE code = 'DAT_KHONG_DAT'");
        Map<String, List<Def>> plan = Map.of(
                "TC", List.of(
                        new Def("Tổng doanh thu", "MT-TC-01", "Tỷ đồng", "API", "DT_VT", "THUAN", true),
                        new Def("Lợi nhuận trước thuế", "MT-TC-02", "Tỷ đồng", "NHAP_TAY", null, "THUAN", false),
                        new Def("Doanh thu dịch vụ số", "MT-TC-04", "Tỷ đồng", "API", "DT_SO", "THUAN", false),
                        new Def("Tỷ lệ chi phí trên doanh thu", "MT-TC-03", "%", "NHAP_TAY", null, "NGHICH", false),
                        new Def("Doanh thu khách hàng doanh nghiệp", "MT-TC-01", "Tỷ đồng", "API", "DT_CNTT", "THUAN", true),
                        new Def("Tỷ suất lợi nhuận trên vốn chủ sở hữu (ROE)", "MT-TC-02", "%", "NHAP_TAY", null, "THUAN", false),
                        new Def("Nộp ngân sách nhà nước", "MT-TC-01", "Tỷ đồng", "NHAP_TAY", null, "THUAN", false),
                        new Def("Chi phí vận hành", "MT-TC-03", "Tỷ đồng", "API", "CP_VH", "NGHICH", false),
                        new Def("Doanh thu dịch vụ CNTT", "MT-TC-04", "Tỷ đồng", "API", "DT_CNTT", "THUAN", true),
                        new Def("Tăng trưởng doanh thu so với cùng kỳ", "MT-TC-01", "%", "NHAP_TAY", null, "THUAN", false)),
                "KH", List.of(
                        new Def("Chỉ số hài lòng khách hàng (NPS)", "MT-KH-01", "Điểm", "API", "NPS", "THUAN", false),
                        new Def("Thuê bao di động phát triển mới", "MT-KH-02", "Thuê bao", "API", "TB_DD", "THUAN", true),
                        new Def("Thuê bao băng rộng cố định", "MT-KH-02", "Thuê bao", "API", "TB_BRCD", "THUAN", false),
                        new Def("Tỷ lệ rời mạng", "MT-KH-03", "%", "API", "TL_ROI_MANG", "NGHICH", false),
                        new Def("Khách hàng doanh nghiệp mới", "MT-KH-04", "Khách hàng", "NHAP_TAY", null, "THUAN", true),
                        new Def("Thị phần di động", "MT-KH-02", "%", "NHAP_TAY", null, "THUAN", false),
                        new Def("Tỷ lệ khiếu nại được giải quyết đúng hạn", "MT-KH-01", "%", "NHAP_TAY", null, "THUAN", false),
                        new Def("Khách hàng sử dụng dịch vụ số", "MT-KH-04", "Khách hàng", "NHAP_TAY", null, "THUAN", false),
                        new Def("Thuê bao truyền hình MyTV", "MT-KH-02", "Thuê bao", "NHAP_TAY", null, "THUAN", true),
                        new Def("Doanh thu bình quân trên thuê bao (ARPU)", "MT-KH-03", "Triệu đồng", "NHAP_TAY", null, "THUAN", false)),
                "QT", List.of(
                        new Def("Chất lượng mạng di động đạt chuẩn", "MT-QT-01", "%", "NHAP_TAY", null, "THUAN", false),
                        new Def("Thời gian lắp đặt bình quân", "MT-QT-04", "Giờ", "NHAP_TAY", "TG_LAP_DAT", "NGHICH", false),
                        new Def("Tỷ lệ quy trình được số hóa", "MT-QT-02", "%", "NHAP_TAY", null, "THUAN", true),
                        new Def("Số sự cố an toàn thông tin nghiêm trọng", "MT-QT-03", "Sản phẩm", "NHAP_TAY", "SU_CO_ATTT", "NGHICH", false),
                        new Def("Tỷ lệ trạm BTS hoạt động ổn định", "MT-QT-01", "%", "NHAP_TAY", null, "THUAN", false),
                        new Def("Thời gian xử lý sự cố mạng", "MT-QT-04", "Giờ", "NHAP_TAY", null, "NGHICH", false),
                        new Def("Tỷ lệ hồ sơ xử lý trực tuyến", "MT-QT-02", "%", "NHAP_TAY", null, "THUAN", false),
                        new Def("Mức độ tuân thủ quy định ATTT", "MT-QT-03", "%", "NHAP_TAY", null, "THUAN", true),
                        new Def("Tỷ lệ cáp quang hóa", "MT-QT-01", "%", "NHAP_TAY", null, "THUAN", false),
                        new Def("Hiệu suất khai thác hạ tầng", "MT-QT-01", "%", "NHAP_TAY", null, "THUAN", false)),
                "HP", List.of(
                        new Def("Tỷ lệ CBNV được đào tạo", "MT-HP-01", "%", "NHAP_TAY", "TL_DAO_TAO", "THUAN", false),
                        new Def("Số sáng kiến được công nhận", "MT-HP-02", "Sản phẩm", "NHAP_TAY", "SL_SANG_KIEN", "THUAN", false),
                        new Def("Năng suất lao động", "MT-HP-04", "Triệu đồng", "NHAP_TAY", null, "THUAN", true),
                        new Def("Điểm văn hóa doanh nghiệp", "MT-HP-03", "Điểm", "NHAP_TAY", "DIEM_VH", "THUAN", false),
                        new Def("Số sản phẩm số mới ra mắt", "MT-HP-02", "Sản phẩm", "NHAP_TAY", null, "THUAN", false),
                        new Def("Tỷ lệ nhân sự có chứng chỉ quốc tế", "MT-HP-01", "%", "NHAP_TAY", null, "THUAN", false),
                        new Def("Mức độ gắn kết nhân viên", "MT-HP-03", "%", "NHAP_TAY", null, "THUAN", false),
                        new Def("Số bằng sáng chế/giải pháp hữu ích", "MT-HP-02", "Sản phẩm", "NHAP_TAY", null, "THUAN", true),
                        new Def("Tỷ lệ nghỉ việc tự nguyện", "MT-HP-03", "%", "NHAP_TAY", null, "NGHICH", false),
                        new Def("Giờ đào tạo bình quân/người", "MT-HP-01", "Giờ", "NHAP_TAY", null, "THUAN", false)));
        int created = 0;
        for (String per : List.of("TC", "KH", "QT", "HP")) {
            Long perId = id("SELECT id FROM perspective WHERE code = '" + per + "' AND deleted = 0");
            String tdt = switch (per) { case "TC" -> "LUY_KE"; case "KH" -> "THEO_KY"; case "QT" -> "CUOI_KY"; default -> "BINH_QUAN"; };
            int i = 0;
            for (Def d : plan.get(per)) {
                i++;
                Long obj = id("SELECT id FROM strategic_objective WHERE code = '" + d.objective() + "' AND deleted = 0");
                Long uom = id("SELECT id FROM unit_of_measure WHERE name = '" + d.uom() + "' AND deleted = 0");
                boolean focus = i <= 2;
                Long scoring = i % 5 == 0 ? datKhong : khung;
                List<KpiRequest> children = null;
                if (d.parent()) {
                    children = new ArrayList<>();
                    for (int c = 1; c <= 2; c++) {
                        children.add(req(null, "DON_LE", d.name() + (c == 1 ? " – khối tỉnh/thành" : " – khối Tổng công ty/Công ty"), perId, obj, uom, tdt,
                                d.completion(), khung, root, giao, danhgia, d.source(), d.formula(), false, null));
                    }
                }
                kpiService.create(req(null, d.parent() ? "CHA_CON" : "DON_LE", d.name(), perId, obj, uom, tdt, d.completion(), scoring, root, giao,
                        danhgia, d.source(), d.formula(), focus, children));
                created += 1 + (children == null ? 0 : children.size());
            }
        }
        log.info("Seed demo: đã tạo {} KPI", created);
    }

    private KpiRequest req(Long id, String structure, String name, Long per, Long obj, Long uom, String tdt, String completion, Long scoring,
                           Long root, Long giao, Long danhgia, String source, String formula, boolean focus, List<KpiRequest> children) {
        Long formulaId = formula == null ? null : id("SELECT id FROM formula_definition WHERE code = '" + formula + "' AND deleted = 0");
        boolean api = "API".equals(source) && formulaId != null;
        List<KpiRequest.ComponentRequest> comps = List.of(new KpiRequest.ComponentRequest(null, "A", name, formulaId, api ? "API" : "NHAP_TAY"));
        return new KpiRequest(id, structure, name, "TONG", null, per, null, tdt, completion, null, scoring, true, obj, null,
                root, giao, root, danhgia, api ? "API" : "NHAP_TAY", uom, focus, "A", comps, children, null, null);
    }

    private Long id(String sql) {
        return jdbc.queryForObject(sql, Long.class);
    }
}
