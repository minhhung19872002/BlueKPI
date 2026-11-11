package vn.vnpt.kpi.security;

import org.junit.jupiter.api.Test;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.util.EncryptedStringTypeHandler;
import vn.vnpt.kpi.common.util.MaskingConverter;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SecurityUnitTest {
    static final String S1 = "a".repeat(64);
    static final String S2 = "b".repeat(64);

    static JwtProperties props(String cur, String prev) {
        return new JwtProperties(cur, prev, Duration.ofMinutes(15), Duration.ofHours(8), Duration.ofMinutes(30),
                false, "Lax", null, false, List.of(), 20, "p".repeat(40));
    }

    @Test
    void jwtIssueAndParse() {
        JwtService s = new JwtService(props(S1, null));
        String t = s.issueAccessToken(5L, "admin", 9L, "LOCAL");
        var c = s.parse(t);
        assertThat(c).isNotNull();
        assertThat(c.getSubject()).isEqualTo("5");
        assertThat(c.get("sid", Number.class).longValue()).isEqualTo(9L);
        assertThat(s.parse(t + "x")).isNull();
    }

    @Test
    void jwtKeyRotationAcceptsPreviousKey() {
        String oldToken = new JwtService(props(S2, null)).issueAccessToken(1L, "u", 1L, "LOCAL");
        JwtService rotated = new JwtService(props(S1, S2));
        assertThat(rotated.parse(oldToken)).isNotNull();
        assertThat(new JwtService(props(S1, null)).parse(oldToken)).isNull();
    }

    @Test
    void jwtSecretMustBe64Bytes() {
        assertThatThrownBy(() -> new JwtService(props("short", null))).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void maskingHidesTokensAndTickets() {
        String m = MaskingConverter.mask("callback?ticket=ST-12345abcdef&x=1 Bearer eyJhbGciOi.eyJzdWIiOiIx.sig password=Secret1");
        assertThat(m).doesNotContain("ST-12345abcdef").doesNotContain("Secret1").doesNotContain("eyJzdWIiOiIx");
    }

    @Test
    void piiEncryptionRoundTrip() {
        EncryptedStringTypeHandler.init("k".repeat(40));
        String enc = EncryptedStringTypeHandler.encrypt("0912345678");
        assertThat(enc).startsWith("v1:").doesNotContain("0912345678");
        assertThat(EncryptedStringTypeHandler.decrypt(enc)).isEqualTo("0912345678");
        assertThat(EncryptedStringTypeHandler.encrypt("0912345678")).isNotEqualTo(enc);
    }

    @Test
    void sortWhitelistBlocksInjection() {
        PageQuery q = new PageQuery();
        q.setSort("name;DROP TABLE x,asc");
        q.applySort(Map.of("name", "u.full_name"), "u.id DESC");
        assertThat(q.getOrderBy()).isEqualTo("u.id DESC");
        q.setSort("name,desc");
        q.applySort(Map.of("name", "u.full_name"), "u.id DESC");
        assertThat(q.getOrderBy()).isEqualTo("u.full_name DESC");
        q.setSize(37);
        assertThat(q.getSize()).isEqualTo(37);
        q.setSize(1000);
        assertThat(q.getSize()).isEqualTo(100);
    }

    @Test
    void casXmlParsing() {
        String ok = "<cas:serviceResponse xmlns:cas=\"http://www.yale.edu/tp/cas\"><cas:authenticationSuccess><cas:user>admin</cas:user>"
                + "<cas:attributes><cas:email>admin@vnpt.vn</cas:email></cas:attributes></cas:authenticationSuccess></cas:serviceResponse>";
        var p = CasTicketValidator.parse(ok);
        assertThat(p.user()).isEqualTo("admin");
        assertThat(p.attributes()).containsEntry("email", "admin@vnpt.vn");
        String fail = "<cas:serviceResponse xmlns:cas=\"http://www.yale.edu/tp/cas\"><cas:authenticationFailure code=\"INVALID_TICKET\"/></cas:serviceResponse>";
        assertThatThrownBy(() -> CasTicketValidator.parse(fail)).isInstanceOf(BusinessException.class);
        String xxe = "<?xml version=\"1.0\"?><!DOCTYPE x [<!ENTITY e SYSTEM \"file:///etc/passwd\">]><x>&e;</x>";
        assertThatThrownBy(() -> CasTicketValidator.parse(xxe)).isInstanceOf(BusinessException.class);
    }
}
