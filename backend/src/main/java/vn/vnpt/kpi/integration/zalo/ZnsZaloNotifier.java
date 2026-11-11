package vn.vnpt.kpi.integration.zalo;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import vn.vnpt.kpi.common.util.EncryptedStringTypeHandler;
import vn.vnpt.kpi.modules.sysconfig.service.SysConfigService;

import java.util.Map;

/**
 * Adapter Zalo ZNS (https://business.openapi.zalo.me/message/template). Access token OA lấy từ secret store.
 * Khi chưa cấu hình (OPEN-QUESTIONS #6) adapter trả false và chỉ ghi log.
 */
@Slf4j
@Component
public class ZnsZaloNotifier implements ZaloNotifier {
    private final SysConfigService config;
    private final String accessToken;
    private final RestClient client;

    public ZnsZaloNotifier(SysConfigService config, @Value("${kpi.zalo.access-token:}") String accessToken,
                           @Value("${kpi.zalo.endpoint:https://business.openapi.zalo.me/message/template}") String endpoint) {
        this.config = config;
        this.accessToken = accessToken;
        SimpleClientHttpRequestFactory f = new SimpleClientHttpRequestFactory();
        f.setConnectTimeout(5000);
        f.setReadTimeout(10000);
        this.client = RestClient.builder().baseUrl(endpoint).requestFactory(f).build();
    }

    @Override
    public boolean send(Map<String, Object> user, String eventType, String title, String content) {
        String templateId = config.getString("ZALO_TEMPLATE_" + eventType, null);
        Object phoneRaw = user.get("phone");
        String phone = phoneRaw == null ? null : EncryptedStringTypeHandler.decrypt(String.valueOf(phoneRaw));
        if (accessToken == null || accessToken.isBlank() || templateId == null || phone == null) {
            log.info("Zalo chưa cấu hình (token/template/phone) — bỏ qua sự kiện {}", eventType);
            return false;
        }
        try {
            String normalized = phone.replaceAll("\\D", "").replaceFirst("^0", "84");
            client.post().header("access_token", accessToken).contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("phone", normalized, "template_id", templateId,
                            "template_data", Map.of("title", title, "content", content == null ? "" : content)))
                    .retrieve().toBodilessEntity();
            return true;
        } catch (Exception e) {
            log.warn("Gửi Zalo thất bại: {}", e.getMessage());
            return false;
        }
    }
}
