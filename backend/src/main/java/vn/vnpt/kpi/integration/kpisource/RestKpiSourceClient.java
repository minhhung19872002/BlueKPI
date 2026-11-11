package vn.vnpt.kpi.integration.kpisource;

import com.jayway.jsonpath.JsonPath;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import vn.vnpt.kpi.modules.sysconfig.service.SysConfigService;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * KpiSourceClient bằng Spring RestClient: base URL từ sys_config KPI_SOURCE_BASE_URL; xác thực NONE/API_KEY/BEARER/BASIC
 * (secret từ secret store); timeout 10s; retry 2 lần (backoff); circuit breaker đơn giản (5 lỗi liên tiếp → mở 30s).
 */
@Slf4j
@Component
public class RestKpiSourceClient implements KpiSourceClient {
    static final int CB_THRESHOLD = 5;
    static final long CB_OPEN_MS = 30_000;

    private final SysConfigService config;
    private final KpiSourceProperties props;
    private final RestClient client;
    private final AtomicInteger consecutiveFailures = new AtomicInteger();
    private final AtomicLong openUntil = new AtomicLong();

    public RestKpiSourceClient(SysConfigService config, KpiSourceProperties props) {
        this.config = config;
        this.props = props;
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(props.timeoutSeconds() * 1000);
        f.setReadTimeout(props.timeoutSeconds() * 1000);
        this.client = RestClient.builder().requestFactory(f).build();
    }

    @Override
    public Response fetch(Request r) {
        long start = System.currentTimeMillis();
        String path = expand(r.apiPath(), r);
        String base = config.getString(SysConfigService.KPI_SOURCE_BASE_URL, "");
        String url = path.startsWith("http://") || path.startsWith("https://") ? path : stripSlash(base) + (path.startsWith("/") ? path : "/" + path);
        String method = r.httpMethod() == null ? "GET" : r.httpMethod().toUpperCase();
        String summary = method + " " + url;
        if (System.currentTimeMillis() < openUntil.get()) {
            return new Response(null, "Nguồn dữ liệu tạm ngắt (circuit breaker mở) do lỗi liên tiếp", summary, 0);
        }
        String lastError = null;
        for (int attempt = 0; attempt <= props.retries(); attempt++) {
            try {
                if (attempt > 0) Thread.sleep(300L * attempt);
                String body = call(method, url, r.body() == null ? null : expand(r.body(), r));
                Object v = JsonPath.read(body, r.responsePath() == null || r.responsePath().isBlank() ? "$.value" : r.responsePath());
                BigDecimal value = toDecimal(v);
                if (value == null) {
                    lastError = "Giá trị tại đường dẫn JSONPath không phải là số";
                    break;
                }
                consecutiveFailures.set(0);
                return new Response(value, null, summary, System.currentTimeMillis() - start);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                lastError = "Bị gián đoạn";
                break;
            } catch (com.jayway.jsonpath.PathNotFoundException e) {
                lastError = "Không tìm thấy giá trị tại JSONPath " + r.responsePath();
                break;
            } catch (Exception e) {
                lastError = e.getClass().getSimpleName() + ": " + (e.getMessage() == null ? "" : e.getMessage());
            }
        }
        if (consecutiveFailures.incrementAndGet() >= CB_THRESHOLD) {
            openUntil.set(System.currentTimeMillis() + CB_OPEN_MS);
            consecutiveFailures.set(0);
            log.warn("Circuit breaker nguồn KPI mở {} ms", CB_OPEN_MS);
        }
        return new Response(null, truncate(lastError), summary, System.currentTimeMillis() - start);
    }

    private String call(String method, String url, String body) {
        String auth = config.getString(SysConfigService.KPI_SOURCE_AUTH_TYPE, "NONE");
        RestClient.RequestBodySpec spec = client.method("POST".equals(method) ? org.springframework.http.HttpMethod.POST : org.springframework.http.HttpMethod.GET)
                .uri(java.net.URI.create(url)).accept(MediaType.APPLICATION_JSON);
        switch (auth) {
            case "API_KEY" -> spec.header(props.apiKeyHeader(), props.apiKey());
            case "BEARER" -> spec.header(HttpHeaders.AUTHORIZATION, "Bearer " + props.bearerToken());
            case "BASIC" -> spec.header(HttpHeaders.AUTHORIZATION, "Basic " + Base64.getEncoder()
                    .encodeToString((props.basicUser() + ":" + props.basicPassword()).getBytes(StandardCharsets.UTF_8)));
            default -> { }
        }
        if (body != null && "POST".equals(method)) spec.contentType(MediaType.APPLICATION_JSON).body(body);
        return spec.retrieve().body(String.class);
    }

    static String expand(String template, Request r) {
        if (template == null) return "";
        return template.replace("{year}", String.valueOf(r.year()))
                .replace("{period}", enc(r.period()))
                .replace("{unitCode}", enc(r.unitCode()))
                .replace("{kpiCode}", enc(r.kpiCode()));
    }

    private static String enc(String s) {
        return s == null ? "" : URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private static String stripSlash(String s) {
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }

    static BigDecimal toDecimal(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return new BigDecimal(n.toString());
        try {
            return new BigDecimal(v.toString().trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String truncate(String s) {
        return s == null ? null : s.length() > 1000 ? s.substring(0, 1000) : s;
    }
}
