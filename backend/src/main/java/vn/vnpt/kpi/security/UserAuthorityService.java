package vn.vnpt.kpi.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vnpt.kpi.security.mapper.SecurityMapper;

import java.time.Duration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Nạp user + role + permission từ DB, cache Caffeine 60s; evict khi đổi role/quyền/user (PHẦN B §9.2).
 */
@Service
@RequiredArgsConstructor
public class UserAuthorityService {
    private final SecurityMapper securityMapper;
    private final Cache<Long, CurrentUser> cache = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofSeconds(60)).maximumSize(20_000).build();

    public CurrentUser load(Long userId) {
        return cache.get(userId, this::loadFromDb);
    }

    private CurrentUser loadFromDb(Long userId) {
        Map<String, Object> u = securityMapper.findUserCore(userId);
        if (u == null) return null;
        List<Map<String, Object>> rows = securityMapper.findGrants(userId);
        Map<String, CurrentUser.RoleGrant> grants = new HashMap<>();
        Set<String> all = new HashSet<>();
        Map<Long, Set<String>> permsByRole = new HashMap<>();
        for (Map<String, Object> r : securityMapper.findPermissionsOfUser(userId)) {
            Long roleId = ((Number) r.get("roleId")).longValue();
            permsByRole.computeIfAbsent(roleId, k -> new HashSet<>()).add((String) r.get("code"));
        }
        for (Map<String, Object> r : rows) {
            Long roleId = ((Number) r.get("roleId")).longValue();
            Long orgId = r.get("orgUnitId") == null ? null : ((Number) r.get("orgUnitId")).longValue();
            Set<String> perms = permsByRole.getOrDefault(roleId, Set.of());
            all.addAll(perms);
            grants.put(roleId + ":" + orgId, new CurrentUser.RoleGrant(roleId, (String) r.get("code"), (String) r.get("name"),
                    (String) r.get("dataScope"), orgId, Set.copyOf(perms)));
        }
        return CurrentUser.builder()
                .id(userId)
                .username((String) u.get("username"))
                .fullName((String) u.get("fullName"))
                .email((String) u.get("email"))
                .orgUnitId(((Number) u.get("orgUnitId")).longValue())
                .orgUnitName((String) u.get("orgUnitName"))
                .orgUnitPath((String) u.get("orgUnitPath"))
                .status((String) u.get("status"))
                .permissions(Set.copyOf(all))
                .grants(List.copyOf(grants.values()))
                .build();
    }

    public void evict(Long userId) { cache.invalidate(userId); }

    public void evictAll() { cache.invalidateAll(); }
}
