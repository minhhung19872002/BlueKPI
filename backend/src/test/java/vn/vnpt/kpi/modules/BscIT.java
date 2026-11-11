package vn.vnpt.kpi.modules;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import vn.vnpt.kpi.AbstractIT;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Integration P5: chốt đánh giá KPI (48.x), TGĐ duyệt (50.x), thu hồi (46.4/47.4), tính lại (46.5), phân quyền */
class BscIT extends AbstractIT {
    @Autowired JdbcTemplate jdbc;

    static final int YEAR = 2035; // năm riêng: AssignmentIT dùng 2031–2033 trên cùng container

    long id(Cookie a, String url) throws Exception {
        return json(mvc.perform(get(url).cookie(a)).andReturn()).at("/data/items/0/id").asLong();
    }

    long kpi(Cookie a) throws Exception {
        long unit = id(a, "/org-units?keyword=VNPT");
        Map<String, Object> m = new HashMap<>();
        m.put("structure", "DON_LE");
        m.put("name", "KPI BSC IT " + System.nanoTime());
        m.put("groupAggregation", "TONG");
        m.put("perspectiveId", id(a, "/perspectives?keyword=TC"));
        m.put("targetDataType", "THEO_KY");
        m.put("scoringMethodId", json(mvc.perform(get("/scoring-methods").cookie(a)).andReturn()).at("/data/0/id").asLong());
        m.put("objectiveId", id(a, "/objectives?keyword=MT-TC-01"));
        m.put("assigningUnitId", unit);
        m.put("assigningOfficerId", json(mvc.perform(get("/users/options?orgUnitId=" + unit).cookie(a)).andReturn()).at("/data/0/id").asLong());
        m.put("evaluatingUnitId", unit);
        m.put("evaluatingOfficerId", m.get("assigningOfficerId"));
        m.put("unitOfMeasureId", id(a, "/uoms?status=HIEU_LUC"));
        return json(mvc.perform(as(post("/kpis"), a).content(om.writeValueAsString(m))).andExpect(status().isOk()).andReturn()).at("/data/id").asLong();
    }

    String yp(String period) throws Exception {
        return om.writeValueAsString(Map.of("year", YEAR, "period", period));
    }

    @Test
    void closeApproveRevokeLifecycle() throws Exception {
        Cookie a = login("admin");
        long k = kpi(a);
        long hni = id(a, "/org-units?keyword=VNPT_HNI"), hcm = id(a, "/org-units?keyword=VNPT_HCM");
        for (long u : List.of(hni, hcm)) {
            Map<String, Object> d = new HashMap<>(Map.of("kpiId", k, "weight", 100, "targetQ1", 10, "targetQ2", 10, "targetH1", 20, "targetQ3", 10, "targetQ4", 10, "targetYear", 40));
            long h = json(mvc.perform(as(post("/assignments/by-unit"), a).content(om.writeValueAsString(Map.of("orgUnitId", u, "year", YEAR, "details", List.of(d)))))
                    .andExpect(status().isOk()).andReturn()).at("/data/header/id").asLong();
            mvc.perform(as(post("/assignments/by-unit/close"), a).content(om.writeValueAsString(Map.of("ids", List.of(h))))).andExpect(status().isOk());
        }
        Integer provisioned = jdbc.queryForObject("SELECT COUNT(*) FROM evaluation_result r JOIN evaluation_kpi ek ON ek.id = r.evaluation_kpi_id WHERE ek.year = ? AND ek.period_code = 'Q1'", Integer.class, YEAR);
        assertThat(provisioned).isEqualTo(2);

        // 48.2 chưa có kết quả → 409 kèm danh sách đơn vị, không chốt
        mvc.perform(as(post("/bsc/close"), a).content(yp("Q1"))).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ERR_NOT_ELIGIBLE"))
                .andExpect(jsonPath("$.message").value("Danh sách chưa hoàn thành. Vui lòng hoàn thiện trước khi thực hiện chốt đánh giá KPI"))
                .andExpect(jsonPath("$.data.units.length()").value(2));
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM period_closing WHERE year = ?", Integer.class, YEAR)).isZero();

        // 50.1 chưa chốt → chưa đủ điều kiện ký duyệt
        mvc.perform(as(post("/bsc/approve/check"), a).content(yp("Q1"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.eligible").value(false))
                .andExpect(jsonPath("$.data.message").value("Danh sách chưa hoàn thành. Vui lòng hoàn thiện trước khi thực hiện ký duyệt TGĐ"));
        mvc.perform(as(post("/bsc/approve"), a).content(yp("Q1"))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ERR_NOT_ELIGIBLE"));

        // có kết quả cho cả hai đơn vị
        jdbc.update("""
                UPDATE evaluation_result r JOIN evaluation_kpi ek ON ek.id = r.evaluation_kpi_id
                SET ek.status = 'DA_CHAM', r.status = 'DA_CO_KQ', r.kpi_result = 12, r.final_result = 12, r.completion_rate = 120, r.score = 5, r.rating = 'DAT_VUOT'
                WHERE ek.year = ? AND ek.period_code = 'Q1'""", YEAR);
        long resultHni = jdbc.queryForObject("SELECT r.id FROM evaluation_result r JOIN evaluation_kpi ek ON ek.id = r.evaluation_kpi_id WHERE ek.year = ? AND ek.period_code = 'Q1' AND r.org_unit_id = ?", Long.class, YEAR, hni);

        // 46.1 / 46.2 danh sách
        mvc.perform(get("/bsc/summary?year=" + YEAR + "&period=Q1&keyword=VNPT_HNI").cookie(a)).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.total").value(1)).andExpect(jsonPath("$.data.items[0].status").value("DA_CO_KQ"));

        // 47.4 thu hồi theo đơn vị → BCL yêu cầu làm lại → chốt bị chặn
        mvc.perform(as(post("/bsc/revoke-unit"), a).content(om.writeValueAsString(Map.of("resultId", resultHni)))).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT status FROM evaluation_result WHERE id = ?", String.class, resultHni)).isEqualTo("BCL_YEU_CAU_LAM_LAI");
        mvc.perform(as(post("/bsc/close"), a).content(yp("Q1"))).andExpect(status().isConflict()).andExpect(jsonPath("$.data.units.length()").value(1))
                .andExpect(jsonPath("$.data.units[0].unitCode").value("VNPT_HNI"));
        jdbc.update("UPDATE evaluation_result SET status = 'DA_CO_KQ' WHERE id = ?", resultHni);

        // 48.1 đủ điều kiện → chốt
        mvc.perform(as(post("/bsc/close"), a).content(yp("Q1"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Chốt đánh giá KPI thành công (Quý I " + YEAR + ")"));
        assertThat(jdbc.queryForObject("SELECT status FROM period_closing WHERE year = ? AND period_code = 'Q1'", String.class, YEAR)).isEqualTo("CHOT");
        assertThat(jdbc.queryForObject("SELECT status FROM evaluation_result WHERE id = ?", String.class, resultHni)).isEqualTo("CHOT_DANH_GIA");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM bsc_unit_summary WHERE year = ? AND period_code = 'Q1' AND bsc_score IS NOT NULL", Integer.class, YEAR)).isGreaterThanOrEqualTo(2);
        mvc.perform(as(post("/bsc/close"), a).content(yp("Q1"))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ERR_INVALID_STATE"));

        // 47.4 thu hồi SAU khi chốt (chưa TGĐ duyệt) → TGĐ duyệt bị chặn → đơn vị đánh giá lại → chốt lại được (48.1) → duyệt (50.2)
        mvc.perform(as(post("/bsc/revoke-unit"), a).content(om.writeValueAsString(Map.of("resultId", resultHni)))).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT status FROM evaluation_result WHERE id = ?", String.class, resultHni)).isEqualTo("BCL_YEU_CAU_LAM_LAI");
        mvc.perform(as(post("/bsc/approve/check"), a).content(yp("Q1"))).andExpect(status().isOk()).andExpect(jsonPath("$.data.eligible").value(false));
        mvc.perform(as(post("/bsc/close"), a).content(yp("Q1"))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ERR_NOT_ELIGIBLE"));
        jdbc.update("UPDATE evaluation_result SET status = 'DA_CO_KQ' WHERE id = ?", resultHni);
        mvc.perform(as(post("/bsc/close"), a).content(yp("Q1"))).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT status FROM evaluation_result WHERE id = ?", String.class, resultHni)).isEqualTo("CHOT_DANH_GIA");

        // 50.2 ký duyệt
        mvc.perform(as(post("/bsc/approve/check"), a).content(yp("Q1"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.eligible").value(true)).andExpect(jsonPath("$.data.summary.unitCount").isNumber());
        mvc.perform(as(post("/bsc/approve"), a).content(yp("Q1"))).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT status FROM period_closing WHERE year = ? AND period_code = 'Q1'", String.class, YEAR)).isEqualTo("TGD_DA_DUYET");
        assertThat(jdbc.queryForObject("SELECT approved_by FROM period_closing WHERE year = ? AND period_code = 'Q1'", String.class, YEAR)).isEqualTo("admin");
        assertThat(jdbc.queryForObject("SELECT status FROM evaluation_result WHERE id = ?", String.class, resultHni)).isEqualTo("TGD_DA_DUYET");

        // kỳ đã TGĐ duyệt → khóa: tính lại / thu hồi / duyệt lại bị chặn
        mvc.perform(as(post("/bsc/recalculate"), a).content(yp("Q1"))).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ERR_PERIOD_LOCKED"));
        mvc.perform(as(post("/bsc/revoke-unit"), a).content(om.writeValueAsString(Map.of("resultId", resultHni)))).andExpect(status().isConflict());
        mvc.perform(as(post("/bsc/approve"), a).content(yp("Q1"))).andExpect(status().isConflict());

        // báo cáo theo mẫu
        mvc.perform(as(post("/reports/TTR94_TONG_HOP"), a).content(om.writeValueAsString(Map.of("scope", "ALL", "year", YEAR, "period", "Q1"))))
                .andExpect(status().isOk()).andExpect(r -> assertThat(r.getResponse().getContentAsByteArray().length).isGreaterThan(1000));
    }

    @Test
    void validationAndPermissions() throws Exception {
        Cookie a = login("admin");
        mvc.perform(as(post("/bsc/close"), a).content("{\"year\":" + YEAR + "}")).andExpect(status().isBadRequest());
        mvc.perform(as(post("/bsc/close"), a).content(yp("Q4"))).andExpect(status().isConflict()).andExpect(jsonPath("$.message").value("Kỳ đánh giá chưa có dữ liệu"));
        Cookie u = login("tinh_hni");
        mvc.perform(as(post("/bsc/close"), u).content(yp("Q1"))).andExpect(status().isForbidden());
        mvc.perform(as(post("/bsc/approve"), u).content(yp("Q1"))).andExpect(status().isForbidden());
        mvc.perform(as(post("/bsc/recalculate"), u).content(yp("Q1"))).andExpect(status().isForbidden());
        mvc.perform(get("/bsc/summary").cookie(u)).andExpect(status().isForbidden());
    }
}
