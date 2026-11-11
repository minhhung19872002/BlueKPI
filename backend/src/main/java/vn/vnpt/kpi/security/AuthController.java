package vn.vnpt.kpi.security;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.vnpt.kpi.common.ApiResponse;
import vn.vnpt.kpi.common.util.RequestInfo;

import java.util.Map;

@Tag(name = "Auth", description = "Đăng nhập / đăng xuất / phiên")
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;
    private final AuthCookies cookies;
    private final LoginRateLimiter rateLimiter;
    private final MeService meService;
    private final CasProperties casProperties;

    public record LoginRequest(@NotBlank(message = "Vui lòng nhập tên đăng nhập") @Size(max = 100) String username,
                               @NotBlank(message = "Vui lòng nhập mật khẩu") @Size(max = 200) String password) {}

    @Operation(summary = "1.1 Đăng nhập tài khoản nội bộ")
    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@Valid @RequestBody LoginRequest req, HttpServletRequest http, HttpServletResponse res) {
        String ip = RequestInfo.ip(http);
        rateLimiter.check(ip);
        AuthService.Tokens t = authService.login(req.username().trim(), req.password(), ip, RequestInfo.truncate(http.getHeader("User-Agent"), 500));
        cookies.write(res, t);
        return ApiResponse.ok("Đăng nhập thành công", Map.of("userId", t.userId(), "username", t.username()));
    }

    @Operation(summary = "Refresh token (xoay vòng)")
    @PostMapping("/refresh")
    public ApiResponse<Void> refresh(HttpServletRequest http, HttpServletResponse res) {
        try {
            cookies.write(res, authService.refresh(readCookie(http, JwtAuthenticationFilter.REFRESH_COOKIE)));
            return ApiResponse.okMessage("OK");
        } catch (RuntimeException e) {
            cookies.clear(res);
            throw e;
        }
    }

    @Operation(summary = "2.1 Đăng xuất")
    @PostMapping("/logout")
    public ApiResponse<Map<String, Object>> logout(HttpServletRequest http, HttpServletResponse res) {
        CurrentUser u = CurrentUser.currentOrNull();
        authService.logout(readCookie(http, JwtAuthenticationFilter.REFRESH_COOKIE), u);
        cookies.clear(res);
        boolean slo = u != null && "CAS".equals(u.getAuthMethod()) && casProperties.sloEnabled();
        String casLogout = slo ? casProperties.logoutUrl() : null;
        return ApiResponse.ok("Đăng xuất thành công", casLogout == null ? Map.of() : Map.of("casLogoutUrl", casLogout));
    }

    @Operation(summary = "Thông tin phiên: user, roles, permissions, menu, org scope")
    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Map<String, Object>> me() {
        return ApiResponse.ok(meService.me(CurrentUser.current()));
    }

    static String readCookie(HttpServletRequest req, String name) {
        if (req.getCookies() == null) return null;
        for (Cookie c : req.getCookies()) if (name.equals(c.getName())) return c.getValue();
        return null;
    }
}
