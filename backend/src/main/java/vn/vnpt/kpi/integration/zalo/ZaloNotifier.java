package vn.vnpt.kpi.integration.zalo;

import java.util.Map;

/** Zalo OA/ZNS — bật/tắt bằng NOTIFY_ZALO_ENABLED, template id trong sys_config (ZALO_TEMPLATE_<EVENT>) */
public interface ZaloNotifier {
    boolean send(Map<String, Object> user, String eventType, String title, String content);
}
