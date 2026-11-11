package vn.vnpt.kpi.common.audit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import vn.vnpt.kpi.common.util.Jsons;
import vn.vnpt.kpi.common.util.RequestInfo;
import vn.vnpt.kpi.security.CurrentUser;

/**
 * Ghi audit_log cho mọi thao tác ghi (CLAUDE.md §4.4). before/after là JSON đã che trường nhạy cảm.
 * Chạy trong transaction của nghiệp vụ để audit và dữ liệu nhất quán.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {
    private final AuditMapper auditMapper;

    public void log(String action, String entity, Object entityId, Object before, Object after) {
        CurrentUser u = CurrentUser.currentOrNull();
        log(u == null ? null : u.getId(), u == null ? null : u.getUsername(), action, entity, entityId, before, after);
    }

    public void log(Long userId, String username, String action, String entity, Object entityId, Object before, Object after) {
        AuditLog a = new AuditLog();
        a.setUserId(userId);
        a.setUsername(username);
        a.setAction(action);
        a.setEntity(entity);
        a.setEntityId(entityId == null ? null : String.valueOf(entityId));
        a.setBeforeJson(Jsons.toMaskedJson(before));
        a.setAfterJson(Jsons.toMaskedJson(after));
        a.setIp(RequestInfo.ip());
        a.setUserAgent(RequestInfo.userAgent());
        a.setTraceId(MDC.get("traceId"));
        auditMapper.insert(a);
    }
}
