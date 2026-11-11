package vn.vnpt.kpi.integration.kpisource;

import java.math.BigDecimal;

/**
 * Nguồn dữ liệu KPI công thức (PHẦN B §8.2). api_path có placeholder {year}, {period}, {unitCode}, {kpiCode};
 * response_path là JSONPath lấy giá trị số.
 */
public interface KpiSourceClient {
    record Request(String apiPath, String httpMethod, String responsePath, String body, int year, String period, String unitCode, String kpiCode) {}

    record Response(BigDecimal value, String error, String requestSummary, long elapsedMs) {
        public boolean ok() { return error == null; }
    }

    Response fetch(Request r);
}
