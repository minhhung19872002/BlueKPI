package vn.vnpt.kpi.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vn.vnpt.kpi.security.PasswordPolicy;

/**
 * Khởi tạo tài khoản “Admin hệ thống” đầu tiên khi CSDL chưa có ai giữ vai trò ADMIN_HT (môi trường mới cài).
 * Mật khẩu lấy từ biến môi trường KPI_BOOTSTRAP_ADMIN_PASSWORD (không có giá trị mặc định); phải đổi sau lần đăng nhập đầu.
 * Ở production, StartupSecurityCheck từ chối khởi động nếu mật khẩu này là giá trị mặc định/yếu.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AdminBootstrap {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    private final Environment env;

    /** Mật khẩu mặc định của dữ liệu dev — không bao giờ được tồn tại ở production */
    static final String DEV_DEFAULT_PASSWORD = "Kpi@2026";
    /** Hash bcrypt của DEV_DEFAULT_PASSWORD trong db/seed-dev/R__seed_90_dev_users.sql */
    static final String DEV_SEED_HASH = "$2a$12$o7K1Xsbln3wG3ZLymyDEHOdud8BZx6YZu9yUsTw4ck/eJLk3YLUpy";

    @Value("${kpi.bootstrap.admin-username:admin}")
    private String username;
    @Value("${kpi.bootstrap.admin-password:}")
    private String password;

    @Order(0)
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void ensureAdmin() {
        if (env.acceptsProfiles(Profiles.of("prod"))) rejectDevPasswords();
        // Admin “dùng được” = đang hoạt động và có mật khẩu (seed chung tạo 'admin' không mật khẩu)
        Integer admins = jdbc.queryForObject("""
                SELECT COUNT(*) FROM user_role ur JOIN role r ON r.id = ur.role_id JOIN app_user u ON u.id = ur.user_id
                WHERE r.code = 'ADMIN_HT' AND u.deleted = 0 AND u.status = 'HOAT_DONG' AND u.password_hash IS NOT NULL""", Integer.class);
        if (admins != null && admins > 0) return;
        if (password == null || password.isBlank()) {
            log.error("Chưa có tài khoản Admin hệ thống. Đặt KPI_BOOTSTRAP_ADMIN_PASSWORD rồi khởi động lại để tạo tài khoản '{}'", username);
            return;
        }
        if (!PasswordPolicy.valid(password)) {
            log.error("KPI_BOOTSTRAP_ADMIN_PASSWORD không đạt chính sách mật khẩu: {}", PasswordPolicy.MESSAGE);
            return;
        }
        Long root = jdbc.queryForObject("SELECT id FROM org_unit WHERE parent_id IS NULL AND deleted = 0 ORDER BY sort_order, id LIMIT 1", Long.class);
        Integer exists = jdbc.queryForObject("SELECT COUNT(*) FROM app_user WHERE username = ? AND deleted = 0", Integer.class, username);
        if (exists != null && exists > 0) {
            jdbc.update("UPDATE app_user SET status = 'HOAT_DONG', password_hash = ?, password_changed_at = NULL, failed_login_count = 0, locked_until = NULL, "
                    + "updated_by = 'system', updated_at = NOW(3) WHERE username = ? AND deleted = 0", encoder.encode(password), username);
        } else {
            jdbc.update("INSERT INTO app_user (username, full_name, email, org_unit_id, status, auth_source, password_hash, created_by, updated_by) "
                    + "VALUES (?, 'Quản trị hệ thống', NULL, ?, 'HOAT_DONG', 'LOCAL', ?, 'system', 'system')", username, root, encoder.encode(password));
        }
        jdbc.update("""
                INSERT INTO user_role (user_id, role_id, org_unit_id, assigned_by)
                SELECT u.id, r.id, NULL, 'system' FROM app_user u JOIN role r ON r.code = 'ADMIN_HT'
                WHERE u.username = ? AND u.deleted = 0 AND NOT EXISTS (SELECT 1 FROM user_role x WHERE x.user_id = u.id AND x.role_id = r.id)""", username);
        log.warn("Đã khởi tạo tài khoản Admin hệ thống '{}' — đổi mật khẩu ngay sau lần đăng nhập đầu và xóa KPI_BOOTSTRAP_ADMIN_PASSWORD", username);
    }

    /**
     * Production: chặn tài khoản còn mật khẩu mặc định của dev (vd bản cài cũ có hash seed).
     * Có KPI_BOOTSTRAP_ADMIN_PASSWORD → đặt lại mật khẩu admin; tài khoản khác → vô hiệu mật khẩu (phải cấp lại). Không có → từ chối khởi động.
     */
    void rejectDevPasswords() {
        var rows = jdbc.queryForList("SELECT id, username, password_hash AS h FROM app_user WHERE deleted = 0 AND password_hash IS NOT NULL");
        for (var r : rows) {
            String h = (String) r.get("h");
            String u = (String) r.get("username");
            // hash seed dev (so khớp chuỗi, rẻ) hoặc riêng tài khoản admin: kiểm bcrypt mật khẩu mặc định
            if (!DEV_SEED_HASH.equals(h) && !(username.equals(u) && encoder.matches(DEV_DEFAULT_PASSWORD, h))) continue;
            if (username.equals(u)) {
                if (password == null || password.isBlank())
                    throw new IllegalStateException("Tài khoản '" + u + "' đang dùng mật khẩu mặc định của môi trường dev. Đặt KPI_BOOTSTRAP_ADMIN_PASSWORD để đặt lại rồi khởi động lại");
                jdbc.update("UPDATE app_user SET password_hash = NULL WHERE id = ?", r.get("id"));
            } else {
                jdbc.update("UPDATE app_user SET password_hash = NULL, updated_by = 'system', updated_at = NOW(3) WHERE id = ?", r.get("id"));
                log.warn("Đã vô hiệu mật khẩu mặc định (dev) của tài khoản '{}' — cấp lại mật khẩu qua Quản lý người dùng", u);
            }
        }
    }
}