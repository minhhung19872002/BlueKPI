package vn.vnpt.kpi.security;

import java.util.Set;

/**
 * Phạm vi dữ liệu dùng trong mapper XML:
 * &lt;if test="!scope.all"&gt; AND x.org_unit_id IN (...) &lt;/if&gt; — unitIds rỗng → không thấy gì.
 */
public record DataScope(boolean all, Set<Long> unitIds) {
    public static final DataScope ALL = new DataScope(true, Set.of());

    public boolean contains(Long unitId) {
        return all || unitIds.contains(unitId);
    }

    /** MyBatis OGNL truy cập getter kiểu JavaBean */
    public boolean isAll() { return all; }
    public Set<Long> getUnitIds() { return unitIds; }
    public boolean isEmpty() { return !all && unitIds.isEmpty(); }
}
