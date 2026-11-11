package vn.vnpt.kpi.security;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.common.audit.AuditService;
import vn.vnpt.kpi.modules.sysconfig.service.SysConfigService;
import vn.vnpt.kpi.security.mapper.SecurityMapper;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Đăng nhập nội bộ / SSO, refresh xoay vòng, đăng xuất (PHẦN B §9, PHẦN C 1.x, 2.1)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {
    private final SecurityMapper securityMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final JwtProperties props;
    private final SysConfigService config;
    private final AuditService auditService;
    private final LoginAttemptLogger attemptLogger;

    public record Tokens(String accessToken, String refreshToken, Long userId, String username) {}

    /** Hash bcrypt giả để cân bằng thời gian khi user không tồn tại (chống dò tài khoản) */
    private volatile String dummyHash;

    private String dummyHash() {
        if (dummyHash == null) dummyHash = passwordEncoder.encode("dummy-password-for-timing");
        return dummyHash;
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public Tokens login(String username, String password, String ip, String userAgent) {
        Map<String, Object> u = securityMapper.findLoginUser(username);
        if (u == null) {
            passwordEncoder.matches(password, dummyHash());
            attemptLogger.log(username, "SAI_THONG_TIN", "LOCAL", ip, userAgent);
            throw new BusinessException(ErrorCode.ERR_LOGIN_FAILED);
        }
        Long id = ((Number) u.get("id")).longValue();
        String hash = (String) u.get("passwordHash");
        String authSource = (String) u.get("authSource");
        boolean pwOk = hash != null && !"CAS".equals(authSource) && passwordEncoder.matches(password, hash);
        LocalDateTime lockedUntil = toLdt(u.get("lockedUntil"));
        int failed = u.get("failedLoginCount") == null ? 0 : ((Number) u.get("failedLoginCount")).intValue();

        if (!pwOk) {
            int max = config.getInt(SysConfigService.LOGIN_MAX_FAILED, 5);
            int lockMin = config.getInt(SysConfigService.LOGIN_LOCK_MINUTES, 15);
            int next = failed + 1;
            LocalDateTime lock = lockedUntil;
            if (next >= max) {
                lock = LocalDateTime.now().plusMinutes(lockMin);
                next = 0;
                log.warn("Tài khoản {} bị khóa tạm thời {} phút do đăng nhập sai {} lần, ip={}", username, lockMin, max, ip);
            } else if (next >= 3) {
                log.warn("Cảnh báo đăng nhập bất thường: {} sai {} lần liên tiếp, ip={}", username, next, ip);
            }
            securityMapper.recordLoginFailure(id, next, lock);
            attemptLogger.log(username, "SAI_THONG_TIN", "LOCAL", ip, userAgent);
            throw new BusinessException(ErrorCode.ERR_LOGIN_FAILED);
        }
        // Chỉ tiết lộ trạng thái khóa khi mật khẩu đúng (không lộ tài khoản tồn tại)
        if (lockedUntil != null && lockedUntil.isAfter(LocalDateTime.now())) {
            attemptLogger.log(username, "TAM_KHOA", "LOCAL", ip, userAgent);
            long mins = Math.max(1, java.time.Duration.between(LocalDateTime.now(), lockedUntil).toMinutes() + 1);
            throw new BusinessException(ErrorCode.ERR_ACCOUNT_LOCKED,
                    "Tài khoản tạm khóa do đăng nhập sai quá số lần cho phép. Vui lòng thử lại sau " + mins + " phút");
        }
        checkStatus((String) u.get("status"), username, "LOCAL", ip, userAgent);

        String lastIp = (String) u.get("lastLoginIp");
        if (lastIp != null && !Objects.equals(lastIp, ip)) {
            log.warn("Cảnh báo đăng nhập từ IP mới: user={}, ip={}, ipTruoc={}", username, ip, lastIp);
        }
        securityMapper.recordLoginSuccess(id, ip);
        attemptLogger.log(username, "THANH_CONG", "LOCAL", ip, userAgent);
        Tokens t = createSession(id, username, "LOCAL", ip, userAgent);
        auditService.log(id, username, "DANG_NHAP", "app_user", id, null, Map.of("method", "LOCAL", "ip", String.valueOf(ip)));
        return t;
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public Tokens loginSso(String casUser, String email, String ip, String userAgent) {
        Map<String, Object> u = securityMapper.findUserForSso(casUser, email);
        if (u == null || "LOCAL".equals(u.get("authSource"))) {
            attemptLogger.log(casUser, "SSO_CHUA_CAP_QUYEN", "CAS", ip, userAgent);
            throw new BusinessException(ErrorCode.ERR_SSO_NOT_GRANTED);
        }
        String status = (String) u.get("status");
        if (!"HOAT_DONG".equals(status)) {
            attemptLogger.log(casUser, "SSO_CHUA_CAP_QUYEN", "CAS", ip, userAgent);
            throw new BusinessException(ErrorCode.ERR_SSO_NOT_GRANTED);
        }
        Long id = ((Number) u.get("id")).longValue();
        String username = (String) u.get("username");
        securityMapper.recordLoginSuccess(id, ip);
        attemptLogger.log(username, "THANH_CONG", "CAS", ip, userAgent);
        Tokens t = createSession(id, username, "CAS", ip, userAgent);
        auditService.log(id, username, "DANG_NHAP", "app_user", id, null, Map.of("method", "CAS"));
        return t;
    }

    private void checkStatus(String status, String username, String method, String ip, String ua) {
        if ("KHOA".equals(status)) {
            attemptLogger.log(username, "BI_KHOA", method, ip, ua);
            throw new BusinessException(ErrorCode.ERR_ACCOUNT_LOCKED);
        }
        if ("NGUNG".equals(status)) {
            attemptLogger.log(username, "NGUNG_HOAT_DONG", method, ip, ua);
            throw new BusinessException(ErrorCode.ERR_ACCOUNT_INACTIVE);
        }
    }

    private Tokens createSession(Long userId, String username, String method, String ip, String ua) {
        String refresh = JwtService.newRefreshToken();
        Map<String, Object> s = new HashMap<>();
        s.put("userId", userId);
        s.put("hash", JwtService.sha256(refresh));
        s.put("expiresAt", LocalDateTime.now().plus(props.refreshTtl()));
        s.put("authMethod", method);
        s.put("ip", ip);
        s.put("userAgent", ua);
        securityMapper.insertSession(s);
        Long sid = ((Number) s.get("id")).longValue();
        return new Tokens(jwtService.issueAccessToken(userId, username, sid, method), refresh, userId, username);
    }

    /** Refresh token xoay vòng; kiểm tra idle timeout */
    @Transactional
    public Tokens refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) throw new BusinessException(ErrorCode.ERR_UNAUTHORIZED);
        Map<String, Object> s = securityMapper.findSessionByHash(JwtService.sha256(refreshToken));
        if (s == null || Integer.valueOf(1).equals(toInt(s.get("revoked")))) throw new BusinessException(ErrorCode.ERR_UNAUTHORIZED);
        LocalDateTime exp = toLdt(s.get("expiresAt"));
        LocalDateTime lastSeen = toLdt(s.get("lastSeenAt"));
        Long sid = ((Number) s.get("id")).longValue();
        if (exp.isBefore(LocalDateTime.now()) || (lastSeen != null && lastSeen.plus(props.idleTimeout()).isBefore(LocalDateTime.now()))) {
            securityMapper.revokeSession(sid);
            throw new BusinessException(ErrorCode.ERR_UNAUTHORIZED);
        }
        Long userId = ((Number) s.get("userId")).longValue();
        Map<String, Object> u = securityMapper.findUserCore(userId);
        if (u == null || !"HOAT_DONG".equals(u.get("status"))) {
            securityMapper.revokeSession(sid);
            throw new BusinessException(ErrorCode.ERR_UNAUTHORIZED);
        }
        String next = JwtService.newRefreshToken();
        // xoay vòng token nhưng giữ hạn tuyệt đối của phiên (refresh TTL 8h tính từ lúc đăng nhập, không trượt)
        securityMapper.rotateSession(sid, JwtService.sha256(next), exp);
        String method = (String) s.get("authMethod");
        return new Tokens(jwtService.issueAccessToken(userId, (String) u.get("username"), sid, method), next, userId, (String) u.get("username"));
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public void logout(String refreshToken, CurrentUser u) {
        if (refreshToken != null && !refreshToken.isBlank()) securityMapper.revokeSessionByHash(JwtService.sha256(refreshToken));
        if (u != null) {
            if (u.getSessionId() != null) securityMapper.revokeSession(u.getSessionId());
            auditService.log(u.getId(), u.getUsername(), "DANG_XUAT", "app_user", u.getId(), null, null);
        }
    }

    private static Integer toInt(Object o) {
        return o == null ? null : ((Number) (o instanceof Boolean b ? (b ? 1 : 0) : o)).intValue();
    }

    static LocalDateTime toLdt(Object o) {
        if (o == null) return null;
        if (o instanceof LocalDateTime l) return l;
        if (o instanceof java.sql.Timestamp t) return t.toLocalDateTime();
        return LocalDateTime.parse(o.toString().replace(" ", "T"));
    }
}
