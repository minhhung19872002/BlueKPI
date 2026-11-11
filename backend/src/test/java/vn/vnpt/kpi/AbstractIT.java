package vn.vnpt.kpi;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.containers.MariaDBContainer;
import org.testcontainers.containers.MinIOContainer;
import vn.vnpt.kpi.security.LoginRateLimiter;

import java.util.Map;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Integration test nền: MariaDB 10.11 + MinIO qua Testcontainers (singleton cho cả bộ test).
 * Dùng seed dev (tài khoản test mỗi vai trò, mật khẩu Kpi@2026).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles({"dev", "it"})
public abstract class AbstractIT {
    public static final String PASSWORD = "Kpi@2026";

    static final MariaDBContainer<?> MARIADB = new MariaDBContainer<>("mariadb:10.11")
            .withDatabaseName("kpi_bsc").withUsername("kpi_migrate").withPassword("kpi_migrate_it")
            .withCommand("--character-set-server=utf8mb4", "--collation-server=utf8mb4_vietnamese_ci", "--default-time-zone=+07:00");
    /** minio/minio đã ngừng phát hành trên Docker Hub → bản build Chainguard (ghim digest); /data là tmpfs (tránh lỗi rename trên overlayfs) */
    static final MinIOContainer MINIO = new MinIOContainer(org.testcontainers.utility.DockerImageName
            .parse("cgr.dev/chainguard/minio@sha256:db3f583fa49121942168bd6383a773b2cde3384c9a99bf7193560b9a0f3a28fd")
            .asCompatibleSubstituteFor("minio/minio"))
            .withTmpFs(java.util.Map.of("/data", "rw"))
            .withUserName("itminio").withPassword("itminio_secret_123");

    static {
        MARIADB.start();
        MINIO.start();
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", MARIADB::getJdbcUrl);
        r.add("spring.datasource.username", MARIADB::getUsername);
        r.add("spring.datasource.password", MARIADB::getPassword);
        r.add("spring.flyway.user", MARIADB::getUsername);
        r.add("spring.flyway.password", MARIADB::getPassword);
        r.add("kpi.minio.endpoint", MINIO::getS3URL);
        r.add("kpi.minio.access-key", MINIO::getUserName);
        r.add("kpi.minio.secret-key", MINIO::getPassword);
        r.add("kpi.demo-seed", () -> "false");
        r.add("spring.quartz.auto-startup", () -> "false");
    }

    @Autowired protected MockMvc mvc;
    @Autowired protected ObjectMapper om;
    @Autowired LoginRateLimiter rateLimiter;

    @BeforeEach
    void resetLimiter() { rateLimiter.reset(); }

    /** Đăng nhập, trả cookie ACCESS_TOKEN */
    protected Cookie login(String username) throws Exception {
        MvcResult r = mvc.perform(post("/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(om.writeValueAsString(Map.of("username", username, "password", PASSWORD)))).andReturn();
        Cookie c = r.getResponse().getCookie("ACCESS_TOKEN");
        if (c == null) throw new IllegalStateException("Đăng nhập thất bại: " + r.getResponse().getContentAsString());
        return c;
    }

    protected MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder b, Cookie token) {
        return b.cookie(token).with(csrf()).contentType(MediaType.APPLICATION_JSON);
    }

    protected JsonNode json(MvcResult r) throws Exception {
        return om.readTree(r.getResponse().getContentAsString());
    }
}
