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

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String username, String result, String method, String ip, String userAgent) {
        securityMapper.insertLoginLog(RequestInfo.truncate(username, 100), result, method, ip, userAgent);
    }
}
