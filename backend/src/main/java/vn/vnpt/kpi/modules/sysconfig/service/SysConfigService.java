package vn.vnpt.kpi.modules.sysconfig.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vnpt.kpi.modules.sysconfig.mapper.SysConfigMapper;
import vn.vnpt.kpi.modules.sysconfig.model.SysConfig;

import java.math.BigDecimal;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Đọc tham số hệ thống có cache (evict khi sửa — 26.23). Giá trị mặc định dùng khi DB chưa có khóa.
 */
@Service
@RequiredArgsConstructor
public class SysConfigService {
    public static final String KPI_PASS_SCORE = "KPI_PASS_SCORE";
    public static final String KPI_WARNING_RATE = "KPI_WARNING_RATE";
    public static final String KPI_COMPLETION_CAP = "KPI_COMPLETION_CAP";
    public static final String UPLOAD_MAX_MB = "UPLOAD_MAX_MB";
    public static final String UPLOAD_ALLOWED_EXT = "UPLOAD_ALLOWED_EXT";
    public static final String LOGIN_MAX_FAILED = "LOGIN_MAX_FAILED";
    public static final String LOGIN_LOCK_MINUTES = "LOGIN_LOCK_MINUTES";
    public static final String KPI_SOURCE_BASE_URL = "KPI_SOURCE_BASE_URL";
    public static final String KPI_SOURCE_ALLOWED_HOSTS = "KPI_SOURCE_ALLOWED_HOSTS";
    public static final String KPI_SOURCE_AUTH_TYPE = "KPI_SOURCE_AUTH_TYPE";
    public static final String NOTIFY_EMAIL_ENABLED = "NOTIFY_EMAIL_ENABLED";
    public static final String NOTIFY_ZALO_ENABLED = "NOTIFY_ZALO_ENABLED";
    public static final String REMIND_DAYS_BEFORE_DEADLINE = "REMIND_DAYS_BEFORE_DEADLINE";
    public static final String DEADLINE_DAY_AFTER_PERIOD = "DEADLINE_DAY_AFTER_PERIOD";
    public static final String DASHBOARD_DEFAULT_PERIOD = "DASHBOARD_DEFAULT_PERIOD";

    private final SysConfigMapper mapper;
    /** Cụm 2 node: cache mỗi node tự hết hạn sau TTL để nhận thay đổi ghi từ node khác (evict chỉ tác động node xử lý request) */
    static final long TTL_MS = 30_000;
    private volatile Map<String, SysConfig> cache;
    private volatile long loadedAt;
    private final Map<String, Object> parsed = new ConcurrentHashMap<>();

    private Map<String, SysConfig> all() {
        Map<String, SysConfig> c = cache;
        if (c == null || System.currentTimeMillis() - loadedAt > TTL_MS) {
            synchronized (this) {
                if (cache == null || System.currentTimeMillis() - loadedAt > TTL_MS) {
                    parsed.clear();
                    cache = mapper.findAll().stream().collect(Collectors.toMap(SysConfig::getConfigKey, Function.identity(), (a, b) -> a));
                    loadedAt = System.currentTimeMillis();
                }
                c = cache;
            }
        }
        return c;
    }

    public void evict() {
        cache = null;
        parsed.clear();
    }

    public String getString(String key, String def) {
        SysConfig c = all().get(key);
        return c == null || c.getConfigValue() == null ? def : c.getConfigValue();
    }

    public int getInt(String key, int def) {
        try {
            return new BigDecimal(getString(key, String.valueOf(def)).trim()).intValue();
        } catch (NumberFormatException e) {
            return def;
        }
    }

    public BigDecimal getDecimal(String key, BigDecimal def) {
        try {
            String s = getString(key, null);
            return s == null ? def : new BigDecimal(s.trim());
        } catch (NumberFormatException e) {
            return def;
        }
    }

    public boolean getBool(String key, boolean def) {
        String s = getString(key, null);
        return s == null ? def : "true".equalsIgnoreCase(s.trim()) || "1".equals(s.trim());
    }
}
