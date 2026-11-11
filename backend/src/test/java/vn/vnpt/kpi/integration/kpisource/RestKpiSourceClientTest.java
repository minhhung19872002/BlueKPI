package vn.vnpt.kpi.integration.kpisource;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

/** Chống SSRF/rò rỉ thông tin xác thực: chỉ gọi tới máy chủ nguồn dữ liệu được cấu hình */
class RestKpiSourceClientTest {
    static final String BASE = "https://kpi-source.vnpt.vn/api";

    @ParameterizedTest(name = "{0} [{1}] → {2}")
    @CsvSource(delimiter = '|', nullValues = "NULL", value = {
            "https://kpi-source.vnpt.vn/api/kpi/2026          | ''                     | true",
            "https://KPI-SOURCE.vnpt.vn/x                     | ''                     | true",
            "https://evil.example.com/steal                   | ''                     | false",
            "http://169.254.169.254/latest/meta-data          | ''                     | false",
            "https://other.vnpt.vn/v1                         | other.vnpt.vn, x.vn    | true",
            "https://user:pw@kpi-source.vnpt.vn/x             | ''                     | false",
            "file:///etc/passwd                               | ''                     | false",
            "gopher://kpi-source.vnpt.vn/x                    | ''                     | false",
            "not a url                                        | ''                     | false",
    })
    void hostAllowed(String url, String allow, boolean expected) {
        assertThat(RestKpiSourceClient.hostAllowed(url, BASE, allow)).isEqualTo(expected);
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {"/kpi/{kpiCode}?y={year} | /kpi/TC-001?y=2026", "/u/{unitCode} | /u/VNPT+H%26N"})
    void expandEncodesPlaceholders(String tpl, String expected) {
        var r = new KpiSourceClient.Request(tpl, "GET", "$.value", null, 2026, "Q1", "VNPT H&N", "TC-001");
        assertThat(RestKpiSourceClient.expand(tpl, r)).isEqualTo(expected);
    }
}
