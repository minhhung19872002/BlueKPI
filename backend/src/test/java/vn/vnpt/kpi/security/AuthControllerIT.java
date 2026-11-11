package vn.vnpt.kpi.security;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import vn.vnpt.kpi.AbstractIT;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthControllerIT extends AbstractIT {

    @Test
    void loginSuccessAndMe() throws Exception {
        Cookie t = login("admin");
        var r = mvc.perform(get("/auth/me").cookie(t)).andExpect(status().isOk()).andReturn();
        var j = json(r);
        assertThat(j.at("/data/user/username").asText()).isEqualTo("admin");
        assertThat(j.at("/data/permissions").toString()).contains("USER:VIEW", "BSC:APPROVE");
        assertThat(j.at("/data/menu/0/name").asText()).isEqualTo("Dashboard TGĐ BSC");
        assertThat(j.at("/data/menu/2/children/0/name").asText()).isEqualTo("Danh mục chỉ tiêu KPI");
    }

    @Test
    void loginWrongPasswordGeneric() throws Exception {
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(Map.of("username", "admin", "password", "wrong"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Tên đăng nhập hoặc mật khẩu không đúng"));
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(Map.of("username", "khong_ton_tai", "password", "wrong"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Tên đăng nhập hoặc mật khẩu không đúng"));
    }

    @Test
    void lockedAndInactiveAccounts() throws Exception {
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(om.writeValueAsString(Map.of("username", "khoa_test", "password", PASSWORD))))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.message").value("Tài khoản đã bị khóa"));
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(om.writeValueAsString(Map.of("username", "ngung_test", "password", PASSWORD))))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.message").value("Tài khoản đã ngưng hoạt động"));
    }

    @Test
    void temporaryLockAfterMaxFailures() throws Exception {
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                    .content(om.writeValueAsString(Map.of("username", "phoihop", "password", "bad" + i))));
        }
        mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(Map.of("username", "phoihop", "password", PASSWORD))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ERR_ACCOUNT_LOCKED"));
    }

    @Test
    void unauthenticatedIs401AndCsrfRequired() throws Exception {
        mvc.perform(get("/auth/me")).andExpect(status().isUnauthorized());
        Cookie t = login("admin");
        mvc.perform(post("/auth/logout").cookie(t)).andExpect(status().isForbidden());
        mvc.perform(post("/auth/logout").cookie(t).with(csrf())).andExpect(status().isOk());
    }

    @Test
    void notificationEndpointsRequireAuth() throws Exception {
        mvc.perform(get("/notifications/unread-count")).andExpect(status().isUnauthorized());
        Cookie t = login("tinh_hni");
        mvc.perform(get("/notifications/unread-count").cookie(t)).andExpect(status().isOk()).andExpect(jsonPath("$.data.count").isNumber());
    }
}
