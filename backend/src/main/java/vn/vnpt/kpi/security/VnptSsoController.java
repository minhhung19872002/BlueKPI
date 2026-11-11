package vn.vnpt.kpi.security;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.common.util.RequestInfo;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

/**
 * VNPT CAS/SSO (PHẦN B §8.1): redirect CAS → nhận ticket → validate → map app_user → phát JWT cookie.
 * Không ghi ticket vào log.
 */
@Slf4j
@Tag(name = "Auth")
@RestController
@RequestMapping("/auth/sso")
@RequiredArgsConstructor
public class VnptSsoController {
    private final CasProperties cas;
    private final CasTicketValidator validator;
    private final AuthService authService;
    private final AuthCookies cookies;

    @Operation(summary = "Chuyển hướng sang VNPT CAS")
    @GetMapping("/login")
    public void login(HttpServletResponse res) throws IOException {
        if (!cas.enabled()) {
            res.sendRedirect(cas.frontendUrl() + "login?error=" + enc("Đăng nhập VNPT SSO chưa được bật"));
            return;
        }
        res.sendRedirect(cas.loginUrl());
    }

    @Operation(summary = "CAS callback ?ticket=")
    @GetMapping("/callback")
    public void callback(@RequestParam("ticket") String ticket, HttpServletRequest req, HttpServletResponse res) throws IOException {
        try {
            if (ticket == null || !ticket.matches("^[A-Za-z0-9._\\-]{4,256}$")) throw new BusinessException(ErrorCode.ERR_UNAUTHORIZED);
            CasTicketValidator.CasPrincipal p = validator.validate(ticket);
            AuthService.Tokens t = authService.loginSso(p.user(), p.attributes().get("email"),
                    RequestInfo.ip(req), RequestInfo.truncate(req.getHeader("User-Agent"), 500));
            cookies.write(res, t);
            res.sendRedirect(cas.frontendUrl() + "dashboard");
        } catch (BusinessException e) {
            log.info("SSO thất bại: {}", e.getCode());
            res.sendRedirect(cas.frontendUrl() + "sso-error?message=" + enc(e.getMessage()));
        }
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
