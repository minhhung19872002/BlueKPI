package vn.vnpt.kpi.modules;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import vn.vnpt.kpi.AbstractIT;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Integration P1: người dùng, vai trò, quyền, đơn vị, tham số, lịch — quyền 401/403, phạm vi, validate, happy path */
class SystemAdminIT extends AbstractIT {

    @Test
    void endpointsRequireAuthAndPermission() throws Exception {
        for (String url : List.of("/users", "/roles", "/permissions", "/org-units", "/sys-configs", "/schedules", "/audit-logs")) {
            mvc.perform(get(url)).andExpect(status().isUnauthorized());
        }
        Cookie u = login("tinh_hni");
        for (String url : List.of("/users", "/roles", "/permissions", "/org-units", "/sys-configs", "/schedules", "/audit-logs")) {
            mvc.perform(get(url).cookie(u)).andExpect(status().isForbidden());
        }
        mvc.perform(as(post("/sys-configs"), u).content("{\"configKey\":\"X_Y\",\"configValue\":\"1\",\"dataType\":\"NUMBER\"}")).andExpect(status().isForbidden());
    }

    @Test
    void userCrudAndRoles() throws Exception {
        Cookie a = login("admin");
        long hni = orgId(a, "VNPT_HNI");
        // validate
        mvc.perform(as(post("/users"), a).content("{}")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors").isArray());
        // mật khẩu yếu
        mvc.perform(as(post("/users"), a).content(om.writeValueAsString(Map.of("fullName", "A", "email", "it1@vnpt.vn", "orgUnitId", hni,
                "status", "HOAT_DONG", "username", "it1", "authSource", "BOTH", "initialPassword", "abc"))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("initialPassword"));
        var r = mvc.perform(as(post("/users"), a).content(om.writeValueAsString(Map.of("fullName", "IT User", "email", "it2@vnpt.vn", "orgUnitId", hni,
                "status", "HOAT_DONG", "username", "it2", "authSource", "BOTH", "initialPassword", "Matkhau@123", "phone", "0912345678"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message").value("Thêm mới thành công")).andReturn();
        long id = json(r).at("/data/id").asLong();
        assertThat(json(r).at("/data/phone").asText()).isEqualTo("0912345678");
        // trùng tên đăng nhập
        mvc.perform(as(post("/users"), a).content(om.writeValueAsString(Map.of("fullName", "X", "email", "it3@vnpt.vn", "orgUnitId", hni,
                "status", "HOAT_DONG", "username", "it2", "authSource", "CAS"))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("username"));
        // gán vai trò theo đơn vị
        long roleId = json(mvc.perform(get("/roles?keyword=DANH_GIA_KPI").cookie(a)).andReturn()).at("/data/items/0/id").asLong();
        mvc.perform(as(put("/users/" + id + "/roles"), a).content(om.writeValueAsString(List.of(Map.of("roleId", roleId, "orgUnitId", hni)))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].roleCode").value("DANH_GIA_KPI"));
        // version conflict
        mvc.perform(as(put("/users/" + id), a).content(om.writeValueAsString(Map.of("fullName", "IT User 2", "email", "it2@vnpt.vn", "orgUnitId", hni,
                "status", "HOAT_DONG", "authSource", "BOTH", "version", 99))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.message").value("Dữ liệu đã bị người khác thay đổi, vui lòng tải lại"));
        // tìm theo đơn vị gồm cả đơn vị con
        mvc.perform(get("/users?orgUnitId=" + orgId(a, "VNPT") + "&keyword=it2").cookie(a)).andExpect(jsonPath("$.data.total").value(1));
        mvc.perform(delete("/users/" + id).cookie(a).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().isOk());
    }

    @Test
    void cannotDeleteSelfOrSystemRole() throws Exception {
        Cookie a = login("admin");
        long adminId = json(mvc.perform(get("/auth/me").cookie(a)).andReturn()).at("/data/user/id").asLong();
        mvc.perform(as(delete("/users/" + adminId), a)).andExpect(status().isConflict());
        long sys = json(mvc.perform(get("/roles?keyword=ADMIN_HT").cookie(a)).andReturn()).at("/data/items/0/id").asLong();
        mvc.perform(as(delete("/roles/" + sys), a)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Vai trò hệ thống không được xóa"));
    }

    @Test
    void orgUnitCycleAndInUse() throws Exception {
        Cookie a = login("admin");
        long hni = orgId(a, "VNPT_HNI");
        var r = mvc.perform(as(post("/org-units"), a).content(om.writeValueAsString(Map.of("code", "IT_P1", "name", "IT Phòng 1", "parentId", hni, "unitType", "PHONG_BAN"))))
                .andExpect(status().isOk()).andReturn();
        long p1 = json(r).at("/data/id").asLong();
        assertThat(json(r).at("/data/path").asText()).endsWith("/" + hni + "/" + p1 + "/");
        long p2 = json(mvc.perform(as(post("/org-units"), a).content(om.writeValueAsString(Map.of("code", "IT_P2", "name", "IT Phòng 2", "parentId", p1, "unitType", "PHONG_BAN"))))
                .andReturn()).at("/data/id").asLong();
        mvc.perform(as(put("/org-units/" + p1), a).content(om.writeValueAsString(Map.of("code", "IT_P1", "name", "IT Phòng 1", "parentId", p2, "unitType", "PHONG_BAN"))))
                .andExpect(status().isBadRequest());
        mvc.perform(as(delete("/org-units/" + p1), a)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("Không thể xóa vì dữ liệu đang được sử dụng tại:")));
        // rebase path cả cây con
        long hpg = orgId(a, "VNPT_HPG");
        mvc.perform(as(put("/org-units/" + p1), a).content(om.writeValueAsString(Map.of("code", "IT_P1", "name", "IT Phòng 1", "parentId", hpg, "unitType", "PHONG_BAN"))))
                .andExpect(status().isOk());
        var child = json(mvc.perform(get("/org-units/" + p2).cookie(a)).andReturn());
        assertThat(child.at("/data/path").asText()).isEqualTo("/1/" + hpg + "/" + p1 + "/" + p2 + "/");
    }

    @Test
    void sysConfigValidationAndCore() throws Exception {
        Cookie a = login("admin");
        mvc.perform(as(post("/sys-configs"), a).content(om.writeValueAsString(Map.of("configKey", "IT_NUM", "configValue", "x", "dataType", "NUMBER"))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].message").value("Giá trị phải là số"));
        mvc.perform(as(post("/sys-configs"), a).content(om.writeValueAsString(Map.of("configKey", "IT_SECRET", "configValue", "s3cr3t", "dataType", "STRING", "isSecret", true))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.configValue").value("********"));
        long core = json(mvc.perform(get("/sys-configs?keyword=KPI_PASS_SCORE").cookie(a)).andReturn()).at("/data/items/0/id").asLong();
        mvc.perform(as(delete("/sys-configs/" + core), a)).andExpect(status().isConflict());
    }

    @Test
    void schedulesListAndReschedule() throws Exception {
        Cookie a = login("admin");
        var list = json(mvc.perform(get("/schedules?size=50").cookie(a)).andExpect(status().isOk()).andReturn());
        assertThat(list.at("/data/total").asInt()).isEqualTo(6);
        long id = 0;
        for (var n : list.at("/data/items")) if ("DONG_BO_HRM".equals(n.get("code").asText())) id = n.get("id").asLong();
        mvc.perform(as(put("/schedules/" + id), a).content(om.writeValueAsString(Map.of("name", "Đồng bộ HRM", "cron", "bad", "enabled", false))))
                .andExpect(status().isBadRequest());
        mvc.perform(as(put("/schedules/" + id), a).content(om.writeValueAsString(Map.of("name", "Đồng bộ HRM", "cron", "0 0 4 ? * MON", "enabled", true))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.cronDescription").value("04:00 hằng tuần (Thứ Hai)"))
                .andExpect(jsonPath("$.data.nextRunAt").isNotEmpty());
    }

    private long orgId(Cookie a, String code) throws Exception {
        return json(mvc.perform(get("/org-units?keyword=" + code).cookie(a)).andReturn()).at("/data/items/0/id").asLong();
    }
}
