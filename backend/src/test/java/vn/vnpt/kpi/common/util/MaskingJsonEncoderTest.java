package vn.vnpt.kpi.common.util;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.LoggingEvent;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/** Log JSON production không chứa ticket CAS / JWT / mật khẩu */
class MaskingJsonEncoderTest {

    @Test
    void masksSecretsInJsonLog() {
        LoggerContext ctx = new LoggerContext();
        ctx.setMDCAdapter(new ch.qos.logback.classic.util.LogbackMDCAdapter());
        MaskingJsonEncoder enc = new MaskingJsonEncoder();
        enc.setContext(ctx);
        enc.setWithFormattedMessage(true);
        enc.setWithMessage(false);
        enc.setWithArguments(false);
        enc.start();
        String jwt = "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6MX0.abcdefghijklmnop";
        LoggingEvent ev = new LoggingEvent("x", ctx.getLogger("t"), Level.INFO,
                "callback ticket={} token={} password={}", null, new Object[]{"ST-abcdef123456", jwt, "Kpi@2026"});
        String out = new String(enc.encode(ev), StandardCharsets.UTF_8);
        assertThat(out).doesNotContain("ST-abcdef123456").doesNotContain(jwt).doesNotContain("Kpi@2026");
        assertThat(out).contains("ticket=***").contains("\"level\":\"INFO\"");
    }
}
