package vn.vnpt.kpi.common.util;

import ch.qos.logback.classic.pattern.MessageConverter;
import ch.qos.logback.classic.spi.ILoggingEvent;

import java.util.regex.Pattern;

/** Che token/ticket/mật khẩu trong log (logback mask pattern) */
public class MaskingConverter extends MessageConverter {
    private static final Pattern[] PATTERNS = {
            Pattern.compile("(?i)(ticket=)[^&\\s\"]+"),
            Pattern.compile("(?i)(ST-)[A-Za-z0-9\\-]{6,}"),
            Pattern.compile("(?i)(bearer\\s+)[A-Za-z0-9._\\-]+"),
            Pattern.compile("(?i)(\"?(password|refreshToken|accessToken|token|secret)\"?\\s*[:=]\\s*\"?)[^\",\\s}]+"),
            Pattern.compile("eyJ[A-Za-z0-9_\\-]{10,}\\.[A-Za-z0-9_\\-]{10,}\\.[A-Za-z0-9_\\-]+")
    };

    @Override
    public String convert(ILoggingEvent event) {
        return mask(super.convert(event));
    }

    public static String mask(String s) {
        if (s == null) return null;
        String out = s;
        for (int i = 0; i < PATTERNS.length; i++) {
            out = i == PATTERNS.length - 1 ? PATTERNS[i].matcher(out).replaceAll("***JWT***") : PATTERNS[i].matcher(out).replaceAll("$1***");
        }
        return out;
    }
}
