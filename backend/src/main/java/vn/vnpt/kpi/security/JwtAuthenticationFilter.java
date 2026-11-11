package vn.vnpt.kpi.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Nhận Bearer header hoặc cookie ACCESS_TOKEN; kiểm tra chữ ký + hạn;
 * tra user còn hoạt động trong DB; quyền lấy từ DB (cache 60s).
 */
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    public static final String ACCESS_COOKIE = "ACCESS_TOKEN";
    public static final String REFRESH_COOKIE = "REFRESH_TOKEN";

    private final JwtService jwtService;
    private final UserAuthorityService authorityService;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String token = resolveToken(req);
        if (token != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            Claims c = jwtService.parse(token);
            if (c != null) {
                try {
                    Long userId = Long.valueOf(c.getSubject());
                    CurrentUser u = authorityService.load(userId);
                    if (u != null && "HOAT_DONG".equals(u.getStatus())) {
                        Number sid = c.get("sid", Number.class);
                        u = u.withSession(sid == null ? null : sid.longValue(), c.get("am", String.class));
                        var auths = u.getPermissions().stream().map(SimpleGrantedAuthority::new).toList();
                        var auth = new UsernamePasswordAuthenticationToken(u, null, auths);
                        SecurityContextHolder.getContext().setAuthentication(auth);
                        MDC.put("username", u.getUsername());
                    }
                } catch (NumberFormatException ignored) {
                    // token không hợp lệ → anonymous
                }
            }
        }
        chain.doFilter(req, res);
    }

    static String resolveToken(HttpServletRequest req) {
        String h = req.getHeader("Authorization");
        if (h != null && h.startsWith("Bearer ")) return h.substring(7).trim();
        if (req.getCookies() != null) {
            for (Cookie ck : req.getCookies()) {
                if (ACCESS_COOKIE.equals(ck.getName()) && ck.getValue() != null && !ck.getValue().isBlank()) return ck.getValue();
            }
        }
        return null;
    }
}
