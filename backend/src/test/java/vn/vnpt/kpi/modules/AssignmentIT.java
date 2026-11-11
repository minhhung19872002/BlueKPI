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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Integration P3: giao KPI theo đơn vị / chỉ tiêu, chốt (sinh đánh giá), điều chỉnh, sao chép, phạm vi đơn vị */
class AssignmentIT extends AbstractIT {
    @Autowired JdbcTemplate jdbc;

    long kpi(Cookie a) throws Exception {
        long per = json(mvc.perform(get("/perspectives?keyword=QT").cookie(a)).andReturn()).at("/data/items/0/id").asLong();
        long obj = json(mvc.perform(get("/objectives?keyword=MT-QT-01").cookie(a)).andReturn()).at("/data/items/0/id").asLong();
        long uom = json(mvc.perform(get("/uoms?status=HIEU_LUC").cookie(a)).andReturn()).at("/data/items/0/id").asLong();
        long sm = json(mvc.perform(get("/scoring-methods").cookie(a)).andReturn()).at("/data/0/id").asLong();
        long unit = unit(a, "VNPT");
        long user = json(mvc.perform(get("/users/options?orgUnitId=" + unit).cookie(a)).andReturn()).at("/data/0/id").asLong();
        Map<String, Object> m = new HashMap<>();
        m.put("structure", "DON_LE");
        m.put("name", "KPI giao IT " + System.nanoTime());
        m.put("groupAggregation", "TONG");
        m.put("perspectiveId", per);
        m.put("targetDataType", "THEO_KY");
        m.put("scoringMethodId", sm);
        m.put("objectiveId", obj);
        m.put("assigningUnitId", unit);
        m.put("assigningOfficerId", user);
        m.put("evaluatingUnitId", unit);
        m.put("evaluatingOfficerId", user);
        m.put("unitOfMeasureId", uom);
        return json(mvc.perform(as(post("/kpis"), a).content(om.writeValueAsString(m))).andExpect(status().isOk()).andReturn()).at("/data/id").asLong();
    }

    long unit(Cookie a, String code) throws Exception {
        return json(mvc.perform(get("/org-units?keyword=" + code).cookie(a)).andReturn()).at("/data/items/0/id").asLong();
    }

    Map<String, Object> detail(Object kpiId, Object unitId, int weight, Integer year) {
        Map<String, Object> d = new HashMap<>();
        if (kpiId != null) d.put("kpiId", kpiId);
        if (unitId != null) d.put("orgUnitId", unitId);
        d.put("weight", weight);
        d.put("targetQ1", 10);
        d.put("targetQ2", 10);
        d.put("targetH1", 20);
        d.put("targetQ3", 10);
        d.put("targetQ4", 10);
        if (year != null) d.put("targetYear", year);
        return d;
    }

    @Test
    void byUnitLifecycle() throws Exception {
        Cookie a = login("admin");
        long k1 = kpi(a), k2 = kpi(a);
        long hni = unit(a, "VNPT_HNI");
        var r = json(mvc.perform(as(post("/assignments/by-unit"), a).content(om.writeValueAsString(Map.of("orgUnitId", hni, "year", 2031,
                "details", List.of(detail(k1, null, 60, 40), detail(k2, null, 30, 40)))))).andExpect(status().isOk()).andReturn());
        long id = r.at("/data/header/id").asLong();
        assertThat(r.at("/data/header/status").asText()).isEqualTo("DANG_SOAN");
        assertThat(r.at("/data/warnings/0").asText()).contains("khác 100");
        // trùng đơn vị, năm
        mvc.perform(as(post("/assignments/by-unit"), a).content(om.writeValueAsString(Map.of("orgUnitId", hni, "year", 2031, "details", List.of()))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("orgUnitId"));
        // số âm bị chặn
        mvc.perform(as(post("/assignments/by-unit"), a).content(om.writeValueAsString(Map.of("orgUnitId", unit(a, "VNPT_HPG"), "year", 2031,
                "details", List.of(Map.of("kpiId", k1, "weight", 50, "targetQ1", -1)))))).andExpect(status().isBadRequest());
        // chốt lỗi tổng trọng số
        var c1 = json(mvc.perform(as(post("/assignments/by-unit/close"), a).content(om.writeValueAsString(Map.of("ids", List.of(id))))).andExpect(status().isOk()).andReturn());
        assertThat(c1.at("/data/closed").asInt()).isZero();
        assertThat(c1.at("/data/errors/0/reasons/0").asText()).contains("Tổng trọng số khác 100");
        // sửa 70/30 rồi chốt → Đã giao, sinh evaluation
        mvc.perform(as(put("/assignments/by-unit/" + id), a).content(om.writeValueAsString(Map.of("orgUnitId", hni, "year", 2031,
                "details", List.of(detail(k1, null, 70, 40), detail(k2, null, 30, 40)))))).andExpect(status().isOk());
        var c2 = json(mvc.perform(as(post("/assignments/by-unit/close"), a).content(om.writeValueAsString(Map.of("ids", List.of(id))))).andExpect(status().isOk()).andReturn());
        assertThat(c2.at("/data/closed").asInt()).isEqualTo(1);
        mvc.perform(get("/assignments/by-unit/" + id).cookie(a)).andExpect(jsonPath("$.data.status").value("DA_GIAO"));
        Integer ek = jdbc.queryForObject("SELECT COUNT(*) FROM evaluation_kpi WHERE kpi_id IN (?, ?) AND year = 2031", Integer.class, k1, k2);
        Integer er = jdbc.queryForObject("SELECT COUNT(*) FROM evaluation_result r JOIN evaluation_kpi e ON e.id = r.evaluation_kpi_id WHERE e.kpi_id = ? AND e.year = 2031 AND r.plan_value IS NOT NULL", Integer.class, k1);
        assertThat(ek).isEqualTo(12);
        assertThat(er).isEqualTo(6);
        // Đã giao → không sửa / xóa được
        mvc.perform(as(delete("/assignments/by-unit/" + id), a)).andExpect(status().isConflict());
        // điều chỉnh: lưu nháp, lưu chốt, lịch sử
        long detailId = jdbc.queryForObject("SELECT id FROM kpi_assignment_detail WHERE kpi_id = ? AND year = 2031", Long.class, k1);
        Map<String, Object> adj = Map.of("decisionNo", "QĐ-IT", "decisionDate", "2026-11-11", "reason", "IT",
                "lines", List.of(Map.of("detailId", detailId, "periodCode", "Q4", "newValue", 15)));
        mvc.perform(as(post("/assignments/by-kpi/" + k1 + "/2031/adjustment/draft"), a).content(om.writeValueAsString(adj)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.draft.decisionNo").value("QĐ-IT"));
        mvc.perform(as(post("/assignments/by-kpi/" + k1 + "/2031/adjustment/commit"), a).content(om.writeValueAsString(adj)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("DA_DIEU_CHINH"));
        mvc.perform(get("/assignments/details/" + detailId + "/history").cookie(a))
                .andExpect(jsonPath("$.data[0].oldValue").value(10.0)).andExpect(jsonPath("$.data[0].newValue").value(15.0));
        Integer plan = jdbc.queryForObject("SELECT r.plan_value FROM evaluation_result r JOIN evaluation_kpi e ON e.id = r.evaluation_kpi_id WHERE e.kpi_id = ? AND e.year = 2031 AND e.period_code = 'Q4'", Integer.class, k1);
        assertThat(plan).isEqualTo(15);
        // sao chép sang năm 2032 cho 2 đơn vị
        var cp = json(mvc.perform(as(post("/assignments/by-unit/" + id + "/copy"), a).content(om.writeValueAsString(Map.of("targetYear", 2032,
                "targetUnitIds", List.of(unit(a, "VNPT_HUE"), unit(a, "VNPT_QTI")))))).andExpect(status().isOk()).andReturn());
        assertThat(cp.at("/data/copied").size()).isEqualTo(2);
    }

    @Test
    void byKpiAndScope() throws Exception {
        Cookie a = login("admin");
        long k = kpi(a);
        long dng = unit(a, "VNPT_DNG"), hni = unit(a, "VNPT_HNI");
        mvc.perform(as(post("/assignments/by-kpi"), a).content(om.writeValueAsString(Map.of("kpiId", k, "year", 2033,
                "details", List.of(detail(null, dng, 10, 40), detail(null, hni, 10, 40)))))).andExpect(status().isOk())
                .andExpect(jsonPath("$.data.details.length()").value(2));
        mvc.perform(get("/assignments/by-kpi?year=2033").cookie(a)).andExpect(jsonPath("$.data.items[0].unitCount").value(2));
        mvc.perform(as(post("/assignments/by-kpi/close"), a).content(om.writeValueAsString(Map.of("keys", List.of(Map.of("kpiId", k, "year", 2033))))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.closed").value(1));
        // đơn vị đã giao → lỗi dòng
        mvc.perform(as(post("/assignments/by-kpi"), a).content(om.writeValueAsString(Map.of("kpiId", k, "year", 2033, "details", List.of(detail(null, dng, 10, 40))))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("details[0].orgUnitId"));
        // người dùng đơn vị không có quyền giao
        Cookie u = login("tinh_hni");
        mvc.perform(get("/assignments/by-unit").cookie(u)).andExpect(status().isForbidden());
    }
}
