package vn.vnpt.kpi.modules;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
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

/** Integration P2: danh mục đơn vị đo / viễn cảnh / mục tiêu / định nghĩa công thức / KPI (sinh mã, cha – con) */
class CatalogIT extends AbstractIT {

    @Test
    void permissions() throws Exception {
        Cookie u = login("tinh_hni");
        mvc.perform(get("/kpis/tree").cookie(u)).andExpect(status().isForbidden());
        mvc.perform(get("/uoms").cookie(u)).andExpect(status().isForbidden());
        mvc.perform(get("/formula-definitions").cookie(u)).andExpect(status().isForbidden());
        mvc.perform(get("/kpis/tree")).andExpect(status().isUnauthorized());
    }

    @Test
    void uomPerspectiveObjectiveCrud() throws Exception {
        Cookie a = login("admin");
        var uom = json(mvc.perform(as(post("/uoms"), a).content(om.writeValueAsString(Map.of("name", "Lượt IT", "status", "HIEU_LUC")))).andExpect(status().isOk()).andReturn());
        assertThat(uom.at("/data/code").asText()).matches("DVD\\d{3,}");
        mvc.perform(as(post("/uoms"), a).content(om.writeValueAsString(Map.of("name", "Lượt IT", "status", "HIEU_LUC"))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].message").value("Tên đơn vị đo đã tồn tại"));
        var per = json(mvc.perform(as(post("/perspectives"), a).content(om.writeValueAsString(Map.of("code", "ITP", "name", "Viễn cảnh IT", "color", "#123456", "status", "HIEU_LUC"))))
                .andExpect(status().isOk()).andReturn());
        long perId = per.at("/data/id").asLong();
        mvc.perform(as(post("/perspectives"), a).content(om.writeValueAsString(Map.of("code", "ITX", "name", "X", "color", "red", "status", "HIEU_LUC"))))
                .andExpect(status().isBadRequest());
        var obj = json(mvc.perform(as(post("/objectives"), a).content(om.writeValueAsString(Map.of("code", "MT-IT-01", "name", "Mục tiêu IT", "perspectiveId", perId))))
                .andExpect(status().isOk()).andReturn());
        // viễn cảnh đang có mục tiêu → chặn xóa
        mvc.perform(as(delete("/perspectives/" + perId), a)).andExpect(status().isConflict());
        mvc.perform(as(delete("/objectives/" + obj.at("/data/id").asLong()), a)).andExpect(status().isOk());
        mvc.perform(as(delete("/perspectives/" + perId), a)).andExpect(status().isOk());
    }

    @Test
    void formulaValidation() throws Exception {
        Cookie a = login("admin");
        mvc.perform(as(post("/formula-definitions"), a).content(om.writeValueAsString(Map.of("code", "IT_CT", "name", "CT", "definitionType", "CONG_THUC_TONG_HOP", "dataType", "SO"))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("expression"));
        mvc.perform(as(post("/formula-definitions"), a).content(om.writeValueAsString(Map.of("code", "IT_API", "name", "API", "definitionType", "THANH_PHAN_API", "dataType", "SO"))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("apiPath"));
        mvc.perform(as(post("/formula-definitions/validate-expression"), a).content("{\"expression\":\"A + \",\"variables\":[\"A\"]}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.valid").value(false));
    }

    @Test
    void kpiCodeGenerationAndParentChild() throws Exception {
        Cookie a = login("admin");
        long per = idOf(a, "/perspectives?keyword=HP", "/data/items/0/id");
        long obj = idOf(a, "/objectives?keyword=MT-HP-01", "/data/items/0/id");
        long uom = idOf(a, "/uoms?status=HIEU_LUC", "/data/items/0/id");
        long sm = json(mvc.perform(get("/scoring-methods").cookie(a)).andReturn()).at("/data/0/id").asLong();
        long root = idOf(a, "/org-units?keyword=VNPT_HNI", "/data/items/0/id");
        long user = json(mvc.perform(get("/users/options?orgUnitId=" + root).cookie(a)).andReturn()).at("/data/0/id").asLong();
        String next = json(mvc.perform(get("/kpis/next-code?perspectiveId=" + per).cookie(a)).andReturn()).at("/data/code").asText();
        assertThat(next).matches("HP-\\d{3}");

        Map<String, Object> child = kpi("Con IT", per, obj, uom, sm, root, user);
        child.put("structure", "DON_LE");
        Map<String, Object> parent = kpi("Cha IT", per, obj, uom, sm, root, user);
        parent.put("structure", "CHA_CON");
        parent.put("children", List.of(child, new HashMap<>(child)));
        var r = json(mvc.perform(as(post("/kpis"), a).content(om.writeValueAsString(parent))).andExpect(status().isOk()).andReturn());
        String code = r.at("/data/code").asText();
        assertThat(code).isEqualTo(next);
        assertThat(r.at("/data/children/0/code").asText()).isEqualTo(code + ".01");
        assertThat(r.at("/data/children/1/code").asText()).isEqualTo(code + ".02");
        // cha – con không có con → lỗi
        Map<String, Object> bad = kpi("Cha rỗng", per, obj, uom, sm, root, user);
        bad.put("structure", "CHA_CON");
        mvc.perform(as(post("/kpis"), a).content(om.writeValueAsString(bad))).andExpect(status().isBadRequest());
        // mục tiêu không thuộc viễn cảnh
        Map<String, Object> mismatch = kpi("Lệch", per, idOf(a, "/objectives?keyword=MT-TC-01", "/data/items/0/id"), uom, sm, root, user);
        mvc.perform(as(post("/kpis"), a).content(om.writeValueAsString(mismatch))).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("objectiveId"));
        long id = r.at("/data/id").asLong();
        // cập nhật: mã không đổi, đổi viễn cảnh bị chặn
        parent.put("perspectiveId", idOf(a, "/perspectives?keyword=TC", "/data/items/0/id"));
        mvc.perform(as(put("/kpis/" + id), a).content(om.writeValueAsString(parent))).andExpect(status().isBadRequest());
        // xóa KPI cha có con → yêu cầu xác nhận, rồi xóa
        mvc.perform(as(delete("/kpis/" + id), a)).andExpect(status().isConflict()).andExpect(jsonPath("$.data.confirmRequired").value(true));
        mvc.perform(as(delete("/kpis/" + id + "?withChildren=true"), a)).andExpect(status().isOk());
    }

    private Map<String, Object> kpi(String name, long per, long obj, long uom, long sm, long unit, long user) {
        Map<String, Object> m = new HashMap<>();
        m.put("structure", "DON_LE");
        m.put("name", name);
        m.put("groupAggregation", "TONG");
        m.put("perspectiveId", per);
        m.put("targetDataType", "LUY_KE");
        m.put("completionFormula", "THUAN");
        m.put("scoringMethodId", sm);
        m.put("objectiveId", obj);
        m.put("assigningUnitId", unit);
        m.put("assigningOfficerId", user);
        m.put("evaluatingUnitId", unit);
        m.put("evaluatingOfficerId", user);
        m.put("unitOfMeasureId", uom);
        m.put("components", List.of(Map.of("code", "A", "name", name, "source", "NHAP_TAY")));
        return m;
    }

    private long idOf(Cookie a, String url, String ptr) throws Exception {
        return json(mvc.perform(get(url).cookie(a)).andReturn()).at(ptr).asLong();
    }
}
