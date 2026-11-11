package vn.vnpt.kpi.modules;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import vn.vnpt.kpi.AbstractIT;
import vn.vnpt.kpi.job.StrategyCompleteJobHandler;

import java.time.LocalDate;
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

/** Integration P6: chiến lược (36.x), bản đồ (37.x), khung KPI (38.1), job Hoàn tất chiến lược */
class StrategyIT extends AbstractIT {
    @Autowired JdbcTemplate jdbc;
    @Autowired StrategyCompleteJobHandler completeJob;

    long first(Cookie a, String url) throws Exception {
        return json(mvc.perform(get(url).cookie(a)).andReturn()).at("/data/items/0/id").asLong();
    }

    long stage(String code) {
        return jdbc.queryForObject("SELECT id FROM evaluation_stage WHERE code = ?", Long.class, code);
    }

    JsonNode create(Cookie a, String name, long stageId, Integer year) throws Exception {
        long unit = first(a, "/org-units?keyword=VNPT_HNI");
        long owner = json(mvc.perform(get("/users/options?orgUnitId=" + unit).cookie(a)).andReturn()).at("/data/0/id").asLong();
        Map<String, Object> m = new HashMap<>(Map.of("name", name, "stageId", stageId, "ownerUserId", owner, "orgUnitId", unit));
        if (year != null) m.put("year", year);
        return json(mvc.perform(as(post("/strategies"), a).content(om.writeValueAsString(m))).andExpect(status().isOk()).andReturn()).at("/data");
    }

    long kpi(Cookie a) throws Exception {
        long unit = first(a, "/org-units?keyword=VNPT");
        long user = json(mvc.perform(get("/users/options?orgUnitId=" + unit).cookie(a)).andReturn()).at("/data/0/id").asLong();
        Map<String, Object> m = new HashMap<>();
        m.put("structure", "DON_LE");
        m.put("name", "KPI chiến lược IT " + System.nanoTime());
        m.put("groupAggregation", "TONG");
        m.put("perspectiveId", first(a, "/perspectives?keyword=TC"));
        m.put("targetDataType", "THEO_KY");
        m.put("scoringMethodId", json(mvc.perform(get("/scoring-methods").cookie(a)).andReturn()).at("/data/0/id").asLong());
        m.put("objectiveId", objective(a, "MT-TC-01"));
        m.put("assigningUnitId", unit);
        m.put("assigningOfficerId", user);
        m.put("evaluatingUnitId", unit);
        m.put("evaluatingOfficerId", user);
        m.put("unitOfMeasureId", first(a, "/uoms?status=HIEU_LUC"));
        return json(mvc.perform(as(post("/kpis"), a).content(om.writeValueAsString(m))).andExpect(status().isOk()).andReturn()).at("/data/id").asLong();
    }

    long objective(Cookie a, String code) throws Exception {
        return first(a, "/objectives?keyword=" + code);
    }

    @Test
    void crudMapAndKpiFrame() throws Exception {
        Cookie a = login("admin");
        // 36.4 bắt buộc + tự sinh mã
        mvc.perform(as(post("/strategies"), a).content("{}")).andExpect(status().isBadRequest());
        JsonNode s = create(a, "Chiến lược IT " + System.nanoTime(), stage("GD_2026_2030"), null);
        long id = s.at("/id").asLong();
        assertThat(s.at("/code").asText()).matches("CL-" + LocalDate.now().getYear() + "-\\d{3}");
        assertThat(s.at("/status").asText()).isEqualTo("DANG_THUC_HIEN");
        JsonNode s2 = create(a, "Chiến lược IT 2 " + System.nanoTime(), stage("GD_2026_2030"), 2027);
        assertThat(Integer.parseInt(s2.at("/code").asText().substring(8))).isEqualTo(Integer.parseInt(s.at("/code").asText().substring(8)) + 1);
        // năm ngoài giai đoạn
        long unit = s.at("/orgUnitId").asLong(), owner = s.at("/ownerUserId").asLong();
        mvc.perform(as(post("/strategies"), a).content(om.writeValueAsString(Map.of("name", "X", "stageId", stage("GD_2026_2030"), "ownerUserId", owner, "orgUnitId", unit, "year", 2024))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("year"));

        // 36.1/36.2 tìm kiếm: khoảng thời gian giao với giai đoạn
        mvc.perform(get("/strategies?keyword=" + s.at("/code").asText() + "&fromYear=2029&toYear=2035").cookie(a)).andExpect(jsonPath("$.data.total").value(1));
        mvc.perform(get("/strategies?keyword=" + s.at("/code").asText() + "&fromYear=2031").cookie(a)).andExpect(jsonPath("$.data.total").value(0));

        // 37.x / 38.1 lưu bản đồ
        long tc = objective(a, "MT-TC-01"), kh = objective(a, "MT-KH-01"), qt = objective(a, "MT-QT-01");
        long kpi = kpi(a);
        Map<String, Object> map = new HashMap<>();
        map.put("nodes", List.of(Map.of("objectiveId", tc, "posX", 180, "posY", 40), Map.of("objectiveId", kh, "posX", 180, "posY", 240), Map.of("objectiveId", qt, "posX", 180, "posY", 440)));
        map.put("edges", List.of(Map.of("source", kh, "target", tc, "sourceHandle", "top", "targetHandle", "bottom"), Map.of("source", qt, "target", kh)));
        map.put("kpis", List.of(Map.of("objectiveId", tc, "kpiId", kpi)));
        JsonNode r = json(mvc.perform(as(put("/strategies/" + id + "/map"), a).content(om.writeValueAsString(map))).andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Lưu bản đồ chiến lược thành công")).andReturn()).at("/data");
        assertThat(r.at("/nodes").size()).isEqualTo(3);
        assertThat(r.at("/edges").size()).isEqualTo(2);
        assertThat(r.at("/lanes").size()).isGreaterThanOrEqualTo(4);
        int version = r.at("/strategy/version").asInt();

        // cấm tự nối / trùng (cả chiều ngược) / liên kết tới node không có trên bản đồ
        Map<String, Object> bad = new HashMap<>(map);
        bad.put("version", version);
        bad.put("edges", List.of(Map.of("source", tc, "target", tc)));
        mvc.perform(as(put("/strategies/" + id + "/map"), a).content(om.writeValueAsString(bad))).andExpect(status().isBadRequest());
        bad.put("edges", List.of(Map.of("source", kh, "target", tc), Map.of("source", tc, "target", kh)));
        mvc.perform(as(put("/strategies/" + id + "/map"), a).content(om.writeValueAsString(bad))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Liên kết giữa hai mục tiêu đã tồn tại"));
        // phiên bản cũ → xung đột
        mvc.perform(as(put("/strategies/" + id + "/map"), a).content(om.writeValueAsString(Map.of("nodes", List.of(), "edges", List.of(), "kpis", List.of(), "version", version - 1))))
                .andExpect(status().isConflict());

        // 37.3 xóa mục tiêu → loại liên kết và KPI gán (client gửi bản đồ không còn node; KPI của node bị bỏ qua)
        Map<String, Object> m2 = new HashMap<>();
        m2.put("nodes", List.of(Map.of("objectiveId", kh, "posX", 180, "posY", 240), Map.of("objectiveId", qt, "posX", 180, "posY", 440)));
        m2.put("edges", List.of(Map.of("source", qt, "target", kh)));
        m2.put("kpis", List.of(Map.of("objectiveId", tc, "kpiId", kpi)));
        m2.put("version", version);
        mvc.perform(as(put("/strategies/" + id + "/map"), a).content(om.writeValueAsString(m2))).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM strategy_kpi WHERE strategy_id = ?", Integer.class, id)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM strategy_link WHERE strategy_id = ?", Integer.class, id)).isEqualTo(1);

        // 37.4 KPI của mục tiêu
        mvc.perform(get("/strategies/" + id + "/objectives/" + kh + "/kpis").cookie(a)).andExpect(status().isOk()).andExpect(jsonPath("$.data").isArray());
        // 37.1 mục tiêu đã có trên bản đồ được đánh dấu
        mvc.perform(get("/objectives/search-for-strategy?strategyId=" + id + "&keyword=MT-KH-01").cookie(a)).andExpect(jsonPath("$.data.items[0].onMap").value(true));

        // 36.5 cập nhật → “Hoàn thành” khóa sửa/xóa
        long cur = json(mvc.perform(get("/strategies/" + id).cookie(a)).andReturn()).at("/data/version").asLong();
        mvc.perform(as(put("/strategies/" + id), a).content(om.writeValueAsString(Map.of("name", "Đổi tên", "stageId", stage("GD_2026_2030"), "ownerUserId", owner,
                "orgUnitId", unit, "year", 2028, "status", "HOAN_THANH", "version", cur)))).andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("HOAN_THANH"));
        mvc.perform(as(put("/strategies/" + id + "/map"), a).content(om.writeValueAsString(m2))).andExpect(status().isConflict());
        mvc.perform(as(delete("/strategies/" + id), a)).andExpect(status().isConflict());

        // 36.6 xóa (cả bản đồ)
        long id2 = s2.at("/id").asLong();
        mvc.perform(as(put("/strategies/" + id2 + "/map"), a).content(om.writeValueAsString(Map.of("nodes", List.of(Map.of("objectiveId", tc)), "edges", List.of(), "kpis", List.of()))))
                .andExpect(status().isOk());
        mvc.perform(as(delete("/strategies/" + id2), a)).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM strategy_objective WHERE strategy_id = ?", Integer.class, id2)).isZero();
        mvc.perform(get("/strategies/" + id2).cookie(a)).andExpect(status().isNotFound());
    }

    @Test
    void completeJobAndPermissions() throws Exception {
        Cookie a = login("admin");
        long id = create(a, "Chiến lược cũ " + System.nanoTime(), stage("GD_2021_2025"), 2025).at("/id").asLong();
        var res = completeJob.run(new vn.vnpt.kpi.job.JobHandler.Context(null, null, "MANUAL", "admin", Map.of()));
        assertThat(res.success()).isGreaterThanOrEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT status FROM strategy WHERE id = ?", String.class, id)).isEqualTo("HOAN_THANH");

        Cookie u = login("tinh_hni");
        mvc.perform(as(post("/strategies"), u).content("{\"name\":\"x\",\"stageId\":1,\"ownerUserId\":1,\"orgUnitId\":1}")).andExpect(status().isForbidden());
        mvc.perform(as(put("/strategies/" + id + "/map"), u).content("{\"nodes\":[],\"edges\":[],\"kpis\":[]}")).andExpect(status().isForbidden());
    }
}
