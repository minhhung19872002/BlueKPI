package vn.vnpt.kpi.security;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vnpt.kpi.security.mapper.SecurityMapper;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Dữ liệu /api/auth/me: user, roles, permissions, menu (lọc theo quyền), phạm vi đơn vị */
@Service
@RequiredArgsConstructor
public class MeService {
    private final SecurityMapper securityMapper;
    private final DataScopeService dataScopeService;

    public Map<String, Object> me(CurrentUser u) {
        Map<String, Object> user = new LinkedHashMap<>();
        user.put("id", u.getId());
        user.put("username", u.getUsername());
        user.put("fullName", u.getFullName());
        user.put("email", u.getEmail());
        user.put("orgUnitId", u.getOrgUnitId());
        user.put("orgUnitName", u.getOrgUnitName());
        user.put("authMethod", u.getAuthMethod());

        List<Map<String, Object>> roles = u.getGrants().stream().map(g -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("code", g.roleCode());
            m.put("name", g.roleName());
            m.put("dataScope", g.dataScope());
            m.put("orgUnitId", g.orgUnitId());
            return m;
        }).toList();

        DataScope scope = dataScopeService.scopeFor(u, null);
        Map<String, Object> orgScope = new LinkedHashMap<>();
        orgScope.put("all", scope.all());
        orgScope.put("unitIds", scope.all() ? List.of() : scope.unitIds());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("user", user);
        out.put("roles", roles);
        out.put("permissions", u.getPermissions().stream().sorted().toList());
        out.put("menu", buildMenu(u.getPermissions()));
        out.put("orgScope", orgScope);
        return out;
    }

    List<Map<String, Object>> buildMenu(Set<String> perms) {
        List<Map<String, Object>> all = securityMapper.findMenus();
        Map<Long, Map<String, Object>> byId = new LinkedHashMap<>();
        for (Map<String, Object> m : all) {
            Map<String, Object> n = new LinkedHashMap<>();
            n.put("code", m.get("code"));
            n.put("name", m.get("name"));
            n.put("route", m.get("route"));
            n.put("icon", m.get("icon"));
            n.put("permission", m.get("permissionCode"));
            n.put("children", new ArrayList<Map<String, Object>>());
            n.put("_parent", m.get("parentId"));
            byId.put(((Number) m.get("id")).longValue(), n);
        }
        List<Map<String, Object>> roots = new ArrayList<>();
        for (Map<String, Object> n : byId.values()) {
            Object p = n.remove("_parent");
            if (p == null) roots.add(n);
            else {
                Map<String, Object> parent = byId.get(((Number) p).longValue());
                if (parent != null) castList(parent.get("children")).add(n);
            }
        }
        return filter(roots, perms);
    }

    private List<Map<String, Object>> filter(List<Map<String, Object>> nodes, Set<String> perms) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> n : nodes) {
            List<Map<String, Object>> kids = filter(castList(n.get("children")), perms);
            n.put("children", kids);
            String pc = (String) n.get("permission");
            boolean allowed = pc == null || pc.isBlank() ? !kids.isEmpty()
                    : Arrays.stream(pc.split(",")).map(String::trim).anyMatch(perms::contains);
            if (allowed) out.add(n);
        }
        return out;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> castList(Object o) {
        return (List<Map<String, Object>>) o;
    }
}
