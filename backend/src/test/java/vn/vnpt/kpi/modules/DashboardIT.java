package vn.vnpt.kpi.modules;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import vn.vnpt.kpi.AbstractIT;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Integration P7: Dashboard TGĐ BSC — bộ lọc mặc định, chế độ xem, phân quyền theo đơn vị, xuất Excel */
class DashboardIT extends AbstractIT {
    @Autowired JdbcTemplate jdbc;

    @Test
    void groupModesAndExports() throws Exception {
        Cookie a = login("admin");
        int year = LocalDate.now().getYear();
        long stage = jdbc.queryForObject("SELECT id FROM evaluation_stage WHERE code = 'GD_2026_2030'", Long.class);
        mvc.perform(get("/dashboard/filters").cookie(a)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.defaults.unit").value("GROUP")).andExpect(jsonPath("$.data.defaults.year").value(year))
                .andExpect(jsonPath("$.data.canGroup").value(true)).andExpect(jsonPath("$.data.stages.length()").value(2));
        mvc.perform(get("/dashboard/overview?unit=GROUP&year=2026&period=Q1").cookie(a)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mode").value("GROUP")).andExpect(jsonPath("$.data.periodName").value("Quý I 2026"))
                .andExpect(jsonPath("$.data.cards.total").isNumber()).andExpect(jsonPath("$.data.bsc").exists());
        mvc.perform(get("/dashboard/overview?unit=PROVINCES&year=2026&period=Y").cookie(a)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mode").value("PROVINCES"));
        // giai đoạn: lũy kế đến năm đang xem, có dữ liệu biểu đồ theo năm
        mvc.perform(get("/dashboard/overview?unit=GROUP&year=2027&period=GD:" + stage).cookie(a)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.period").value("GD:" + stage)).andExpect(jsonPath("$.data.stageYears.length()").value(5))
                .andExpect(jsonPath("$.data.periodName").value("Giai đoạn 2026–2030 (đến năm 2027)"));
        mvc.perform(get("/dashboard/overview?unit=GROUP&period=Q9").cookie(a)).andExpect(status().isBadRequest());
        mvc.perform(get("/dashboard/ranking-provinces?year=2026&period=Q1").cookie(a)).andExpect(status().isOk()).andExpect(jsonPath("$.data.rows").isArray());
        mvc.perform(get("/dashboard/corporations?year=2026&period=Q1").cookie(a)).andExpect(status().isOk());
        mvc.perform(get("/dashboard/kpi-list?unit=GROUP&year=2026&period=Q1&card=ACHIEVED").cookie(a)).andExpect(status().isOk()).andExpect(jsonPath("$.data").isArray());
        mvc.perform(get("/dashboard/strategy-map?unit=GROUP&year=2026").cookie(a)).andExpect(status().isOk());
        var x = mvc.perform(get("/dashboard/export-results?unit=GROUP&year=2026&period=Q1").cookie(a)).andExpect(status().isOk()).andReturn();
        assertThat(x.getResponse().getHeader("Content-Disposition")).contains("KetQuaDanhGiaKPI_");
        assertThat(x.getResponse().getContentAsByteArray().length).isGreaterThan(1000);
    }

    @Autowired vn.vnpt.kpi.modules.sysconfig.service.SysConfigService sysConfig;

    @Test
    void defaultPeriodFromSystemParameterAndExportForViewRoles() throws Exception {
        Cookie a = login("admin");
        // 17.1: DASHBOARD_DEFAULT_PERIOD cố định → kỳ mặc định theo tham số; LATEST → kỳ gần nhất có kết quả
        jdbc.update("UPDATE sys_config SET config_value = 'Y' WHERE config_key = 'DASHBOARD_DEFAULT_PERIOD'");
        sysConfig.evict();
        try {
            mvc.perform(get("/dashboard/filters").cookie(a)).andExpect(status().isOk()).andExpect(jsonPath("$.data.defaults.period").value("Y"));
        } finally {
            jdbc.update("UPDATE sys_config SET config_value = 'LATEST' WHERE config_key = 'DASHBOARD_DEFAULT_PERIOD'");
            sysConfig.evict();
        }
        // 17.6: vai trò xem dashboard Tập đoàn (vd Lập chiến lược, Giao KPI) được xuất kết quả đánh giá KPI (V005)
        for (String r : java.util.List.of("LAP_CHIEN_LUOC", "GIAO_KPI", "PHOI_HOP_KPI", "DANH_GIA_KPI", "NGUOI_DUNG_DV")) {
            Integer n = jdbc.queryForObject("""
                    SELECT COUNT(*) FROM role_permission rp JOIN role ro ON ro.id = rp.role_id JOIN permission p ON p.id = rp.permission_id
                    WHERE ro.code = ? AND p.code = 'DASHBOARD:EXPORT'""", Integer.class, r);
            assertThat(n).as(r).isEqualTo(1);
        }
    }

    @Test
    void unitUserIsScoped() throws Exception {
        Cookie u = login("tinh_hni");
        long hni = jdbc.queryForObject("SELECT id FROM org_unit WHERE code = 'VNPT_HNI'", Long.class);
        long hcm = jdbc.queryForObject("SELECT id FROM org_unit WHERE code = 'VNPT_HCM'", Long.class);
        mvc.perform(get("/dashboard/filters").cookie(u)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.defaults.unit").value(String.valueOf(hni))).andExpect(jsonPath("$.data.canGroup").value(false));
        mvc.perform(get("/dashboard/overview").cookie(u)).andExpect(status().isOk()).andExpect(jsonPath("$.data.mode").value("UNIT"))
                .andExpect(jsonPath("$.data.unit.code").value("VNPT_HNI"));
        mvc.perform(get("/dashboard/overview?unit=GROUP").cookie(u)).andExpect(status().isForbidden());
        mvc.perform(get("/dashboard/overview?unit=" + hcm).cookie(u)).andExpect(status().isForbidden());
        mvc.perform(get("/dashboard/corporations").cookie(u)).andExpect(status().isForbidden());
    }
}
