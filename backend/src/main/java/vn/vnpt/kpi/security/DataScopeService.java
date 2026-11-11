package vn.vnpt.kpi.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.security.mapper.SecurityMapper;

import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Lọc dữ liệu theo phạm vi đơn vị (PHẦN B §1.1). Phạm vi tính theo các vai trò CÓ quyền đang dùng:
 * ALL → toàn bộ; UNIT → đơn vị áp dụng (hoặc đơn vị của user); UNIT_AND_CHILDREN → đơn vị đó + con cháu.
 */
@Service
@RequiredArgsConstructor
public class DataScopeService {
    private final SecurityMapper securityMapper;
    private final Cache<Long, List<Long>> subtreeCache = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofSeconds(60)).maximumSize(5_000).build();

    public DataScope scopeFor(String permission) {
        return scopeFor(CurrentUser.current(), permission);
    }

    public DataScope scopeFor(CurrentUser u, String permission) {
        Set<Long> ids = new HashSet<>();
        for (CurrentUser.RoleGrant g : u.getGrants()) {
            if (permission != null && !g.permissions().contains(permission)) continue;
            Long base = g.orgUnitId() != null ? g.orgUnitId() : u.getOrgUnitId();
            switch (g.dataScope()) {
                case "ALL" -> { return DataScope.ALL; }
                case "UNIT" -> ids.add(base);
                default -> ids.addAll(subtree(base));
            }
        }
        return new DataScope(false, Set.copyOf(ids));
    }

    public List<Long> subtree(Long unitId) {
        return subtreeCache.get(unitId, securityMapper::findSubtreeIds);
    }

    public void assertUnit(String permission, Long unitId) {
        if (unitId == null) return;
        if (!scopeFor(permission).contains(unitId)) {
            throw new BusinessException(ErrorCode.ERR_FORBIDDEN, "Bạn không có quyền trên dữ liệu của đơn vị này");
        }
    }

    public void evictOrgTree() { subtreeCache.invalidateAll(); }
}
