package vn.vnpt.kpi.modules.notification.service;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.integration.mail.MailNotifier;
import vn.vnpt.kpi.integration.zalo.ZaloNotifier;
import vn.vnpt.kpi.modules.notification.mapper.NotificationMapper;
import vn.vnpt.kpi.modules.notification.model.Notification;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Gửi Email/Zalo bất đồng bộ sau commit; cập nhật trạng thái kênh trên bản ghi thông báo */
@Component
@RequiredArgsConstructor
public class NotificationDispatcher {
    private final NotificationMapper mapper;
    private final MailNotifier mail;
    private final ZaloNotifier zalo;

    @Async
    public void dispatchAsync(List<Notification> list, List<Map<String, Object>> users, boolean email, boolean z) {
        Map<Long, Map<String, Object>> byId = new LinkedHashMap<>();
        users.forEach(u -> byId.put(((Number) u.get("id")).longValue(), u));
        for (Notification n : list) {
            Map<String, Object> u = byId.get(n.getUserId());
            String es = null, zs = null;
            if (email && u != null) es = mail.send((String) u.get("email"), n.getTitle(), n.getContent()) ? "DA_GUI" : "LOI";
            if (z && u != null) zs = zalo.send(u, n.getEventType(), n.getTitle(), n.getContent()) ? "DA_GUI" : "LOI";
            if (n.getId() != null) mapper.updateChannelStatus(n.getId(), es, zs);
        }
    }
}
