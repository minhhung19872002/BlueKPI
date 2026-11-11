package vn.vnpt.kpi.common.util;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

public final class RequestInfo {
    private RequestInfo() {}

    public static HttpServletRequest current() {
        var attrs = RequestContextHolder.getRequestAttributes();
        return attrs instanceof ServletRequestAttributes sra ? sra.getRequest() : null;
    }

    /** IP client — Nginx đặt X-Real-IP / X-Forwarded-For (server.forward-headers-strategy=native) */
    public static String ip() {
        HttpServletRequest r = current();
        if (r == null) return null;
        return ip(r);
    }

    public static String ip(HttpServletRequest r) {
        String real = r.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) return truncate(real.trim(), 64);
        String fwd = r.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) return truncate(fwd.split(",")[0].trim(), 64);
        return truncate(r.getRemoteAddr(), 64);
    }

    public static String userAgent() {
        HttpServletRequest r = current();
        return r == null ? null : truncate(r.getHeader("User-Agent"), 500);
    }

    public static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
