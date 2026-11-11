package vn.vnpt.kpi.security;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vn.vnpt.kpi.common.util.RequestInfo;
import vn.vnpt.kpi.security.mapper.SecurityMapper;

/** Ghi login_log trong transaction riêng để luôn được lưu kể cả khi đăng nhập thất bại */
@Component
@RequiredArgsConstructor
public class LoginAttemptLogger {
    private final SecurityMapper securityMapper;

    // REQUIRED (không REQUIRES_NEW): tham gia transaction đăng nhập — REQUIRES_NEW cần kết nối thứ 2 khi đang giữ 1,
    // gây deadlock pool HikariCP dưới tải (k6). Các nơi gọi (AuthService) commit cả khi đăng nhập thất bại.
    @Transactional(propagation = Propagation.REQUIRED)
    public void log(String username, String result, String method, String ip, String userAgent) {
        securityMapper.insertLoginLog(RequestInfo.truncate(username, 100), result, method, ip, userAgent);
    }
}
