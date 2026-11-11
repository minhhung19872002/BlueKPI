package vn.vnpt.kpi.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

/** Rate limit theo IP cho /api/auth/login (cửa sổ cố định 1 phút) — PHẦN B §9.8 */
@Component
public class LoginRateLimiter {
    private final Cache<String, AtomicInteger> counters = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofMinutes(1)).maximumSize(100_000).build();
    private final int limit;

    public LoginRateLimiter(JwtProperties props) {
        this.limit = props.loginRateLimitPerMinute();
    }

    public void check(String ip) {
        AtomicInteger c = counters.get(ip == null ? "unknown" : ip, k -> new AtomicInteger());
        if (c.incrementAndGet() > limit) throw new BusinessException(ErrorCode.ERR_TOO_MANY_REQUESTS);
    }

    public void reset() { counters.invalidateAll(); }
}
