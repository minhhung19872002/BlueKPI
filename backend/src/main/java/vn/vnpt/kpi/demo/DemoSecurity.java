package vn.vnpt.kpi.demo;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.security.CurrentUser;
import vn.vnpt.kpi.security.UserAuthorityService;

/** Chạy seed demo / job nền dưới danh nghĩa một tài khoản (mặc định admin) */
@Component
@RequiredArgsConstructor
public class DemoSecurity {
    private final JdbcTemplate jdbc;
    private final UserAuthorityService authorities;

    public void runAsAdmin(Runnable r) {
        runAs("admin", r);
    }

    public void runAs(String username, Runnable r) {
        Long id = jdbc.queryForObject("SELECT id FROM app_user WHERE username = ? AND deleted = 0", Long.class, username);
        CurrentUser u = authorities.load(id);
        var prev = SecurityContextHolder.getContext().getAuthentication();
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(u, null,
                u.getPermissions().stream().map(SimpleGrantedAuthority::new).toList()));
        try {
            r.run();
        } finally {
            SecurityContextHolder.getContext().setAuthentication(prev);
        }
    }
}
