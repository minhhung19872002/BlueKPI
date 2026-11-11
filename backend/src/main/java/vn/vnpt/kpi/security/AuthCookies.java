package vn.vnpt.kpi.security;

import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

/** Cookie HttpOnly; Path /api; Secure (prod); SameSite cấu hình (mặc định Lax) — PHẦN B §9.3 */
@Component
@RequiredArgsConstructor
public class AuthCookies {
    private final JwtProperties props;

    public void write(HttpServletResponse res, AuthService.Tokens t) {
        add(res, JwtAuthenticationFilter.ACCESS_COOKIE, t.accessToken(), props.accessTtl());
        add(res, JwtAuthenticationFilter.REFRESH_COOKIE, t.refreshToken(), props.refreshTtl());
    }

    public void clear(HttpServletResponse res) {
        add(res, JwtAuthenticationFilter.ACCESS_COOKIE, "", Duration.ZERO);
        add(res, JwtAuthenticationFilter.REFRESH_COOKIE, "", Duration.ZERO);
    }

    private void add(HttpServletResponse res, String name, String value, Duration maxAge) {
        ResponseCookie.ResponseCookieBuilder b = ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(props.cookieSecure())
                .path("/api")
                .sameSite(props.cookieSameSite())
                .maxAge(maxAge);
        if (props.cookieDomain() != null && !props.cookieDomain().isBlank()) b.domain(props.cookieDomain());
        res.addHeader(HttpHeaders.SET_COOKIE, b.build().toString());
    }
}
