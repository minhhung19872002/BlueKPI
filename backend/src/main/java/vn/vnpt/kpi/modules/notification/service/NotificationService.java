package vn.vnpt.kpi.modules.notification.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.PageResult;
import vn.vnpt.kpi.common.util.Jsons;
import vn.vnpt.kpi.modules.notification.mapper.NotificationMapper;
import vn.vnpt.kpi.modules.notification.model.Notification;
import vn.vnpt.kpi.modules.sysconfig.service.SysConfigService;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Phát thông báo nghiệp vụ (54.1): chuông (bảng notification) + Email (nếu bật) + Zalo (nếu bật).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationService {
    public enum Channel { BELL, EMAIL, ZALO }

    public static final String EV_GIAO_KPI = "GIAO_KPI";
    public static final String EV_NHAC_HAN = "NHAC_HAN";
    public static final String EV_DE_NGHI_DIEU_CHINH = "DE_NGHI_DIEU_CHINH";
    public static final String EV_XU_LY_DIEU_CHINH = "XU_LY_DIEU_CHINH";
    public static final String EV_CHOT_KET_QUA = "CHOT_KET_QUA";
    public static final String EV_TGD_DUYET = "TGD_DUYET";
    public static final String EV_DIEU_CHINH_MUC_TIEU = "DIEU_CHINH_MUC_TIEU";
    public static final String EV_THU_HOI = "THU_HOI";

    public record Message(String eventType, String title, String content, String linkRoute, Map<String, Object> linkParams) {}

    private final NotificationMapper mapper;
    private final SysConfigService config;
    private final NotificationDispatcher dispatcher;

    /** Gửi cho danh sách người nhận (map có id, email, phone...) */
    @Transactional
    public int send(Collection<Map<String, Object>> recipients, Message m, Channel... channels) {
        Map<Long, Map<String, Object>> uniq = new LinkedHashMap<>();
        for (Map<String, Object> r : recipients) uniq.putIfAbsent(((Number) r.get("id")).longValue(), r);
        if (uniq.isEmpty()) return 0;
        boolean email = has(channels, Channel.EMAIL) && config.getBool(SysConfigService.NOTIFY_EMAIL_ENABLED, false);
        boolean z = has(channels, Channel.ZALO) && config.getBool(SysConfigService.NOTIFY_ZALO_ENABLED, false);
        List<Notification> list = new ArrayList<>();
        for (Long uid : uniq.keySet()) {
            Notification n = new Notification();
            n.setUserId(uid);
            n.setEventType(m.eventType());
            n.setTitle(m.title());
            n.setContent(m.content());
            n.setLinkRoute(m.linkRoute());
            n.setLinkParams(m.linkParams() == null ? null : Jsons.toJson(m.linkParams()));
            n.setEmailStatus(email ? "CHO_GUI" : null);
            n.setZaloStatus(z ? "CHO_GUI" : null);
            list.add(n);
        }
        for (int i = 0; i < list.size(); i += 500) mapper.insertBatch(list.subList(i, Math.min(list.size(), i + 500)));
        if (email || z) dispatchAfterCommit(list, new ArrayList<>(uniq.values()), email, z);
        return list.size();
    }

    public PageResult<Notification> list(Long userId, boolean unreadOnly, PageQuery q) {
        return PageResult.of(mapper.findByUser(userId, unreadOnly, q), mapper.countByUser(userId, unreadOnly), q);
    }

    public long unreadCount(Long userId) { return mapper.countByUser(userId, true); }

    public void markRead(Long id, Long userId) { mapper.markRead(id, userId); }

    public void markAllRead(Long userId) { mapper.markAllRead(userId); }

    private static boolean has(Channel[] cs, Channel c) {
        for (Channel x : cs) if (x == c) return true;
        return false;
    }

    private void dispatchAfterCommit(List<Notification> list, List<Map<String, Object>> users, boolean email, boolean z) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() { dispatcher.dispatchAsync(list, users, email, z); }
            });
        } else {
            dispatcher.dispatchAsync(list, users, email, z);
        }
    }
}
