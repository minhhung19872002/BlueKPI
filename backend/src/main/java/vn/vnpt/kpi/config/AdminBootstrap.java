package vn.vnpt.kpi.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
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

    @Value("${kpi.bootstrap.admin-username:admin}")
    private String username;
    @Value("${kpi.bootstrap.admin-password:}")
    private String password;

    @Order(0)
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void ensureAdmin() {
        Integer admins = jdbc.queryForObject("""
                SELECT COUNT(*) FROM user_role ur JOIN role r ON r.id = ur.role_id JOIN app_user u ON u.id = ur.user_id
                WHERE r.code = 'ADMIN_HT' AND u.deleted = 0 AND u.status = 'HOAT_DONG'""", Integer.class);
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
}
