package vn.vnpt.kpi.security;

import lombok.Builder;
import lombok.Getter;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;

import java.io.Serializable;
import java.util.List;
import java.util.Set;

/** Principal đã nạp từ DB (quyền lấy từ DB, không tin claim trong token — PHẦN B §9.2) */
@Getter
@Builder(toBuilder = true)
public class CurrentUser implements Serializable {
    private final Long id;
    private final String username;
    private final String fullName;
    private final String email;
    private final Long orgUnitId;
    private final String orgUnitName;
    private final String orgUnitPath;
    private final String status;
    private final Set<String> permissions;
    private final List<RoleGrant> grants;
    private final String authMethod;
    private final Long sessionId;

    /** Vai trò gán cho user (có thể giới hạn theo đơn vị áp dụng) */
    public record RoleGrant(Long roleId, String roleCode, String roleName, String dataScope,
                            Long orgUnitId, Set<String> permissions) implements Serializable {}

    public boolean has(String perm) {
        return permissions != null && permissions.contains(perm);
    }

    public boolean hasRole(String roleCode) {
        return grants != null && grants.stream().anyMatch(g -> g.roleCode().equals(roleCode));
    }

    public static CurrentUser currentOrNull() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getPrincipal() instanceof CurrentUser u ? u : null;
    }

    public static CurrentUser current() {
        CurrentUser u = currentOrNull();
        if (u == null) throw new BusinessException(ErrorCode.ERR_UNAUTHORIZED);
        return u;
    }

    public static String currentUsername() {
        CurrentUser u = currentOrNull();
        return u == null ? "system" : u.getUsername();
    }

    public CurrentUser withSession(Long sid, String method) {
        return toBuilder().sessionId(sid).authMethod(method).build();
    }
}
