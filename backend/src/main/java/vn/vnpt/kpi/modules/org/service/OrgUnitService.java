package vn.vnpt.kpi.modules.org.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.Guards;
import vn.vnpt.kpi.common.Labels;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.PageResult;
import vn.vnpt.kpi.common.audit.AuditService;
import vn.vnpt.kpi.common.excel.ExcelColumn;
import vn.vnpt.kpi.common.excel.ExcelExporter;
import vn.vnpt.kpi.common.util.Strs;
import vn.vnpt.kpi.modules.org.dto.OrgUnitRequest;
import vn.vnpt.kpi.modules.org.mapper.OrgUnitMapper;
import vn.vnpt.kpi.modules.org.model.OrgUnit;
import vn.vnpt.kpi.security.CurrentUser;
import vn.vnpt.kpi.security.DataScope;
import vn.vnpt.kpi.security.DataScopeService;
import vn.vnpt.kpi.security.PermissionCodes;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Quản lý đơn vị/phòng ban (5.1–5.8) */
@Service
@RequiredArgsConstructor
public class OrgUnitService {
    static final Map<String, String> SORT = Map.of("code", "o.code", "name", "o.name", "shortName", "o.short_name",
            "unitType", "o.unit_type", "regionCode", "o.region_code", "sortOrder", "o.sort_order",
            "createdAt", "o.created_at", "updatedAt", "o.updated_at", "parentName", "p.name");

    private final OrgUnitMapper mapper;
    private final DataScopeService scopes;
    private final AuditService audit;

    public static Map<String, Object> filter(String keyword, String unitType, String regionCode) {
        Map<String, Object> f = new HashMap<>();
        f.put("keyword", Strs.like(keyword));
        f.put("unitType", Strs.trimToNull(unitType));
        f.put("regionCode", Strs.trimToNull(regionCode));
        return f;
    }

    public PageResult<OrgUnit> search(Map<String, Object> f, PageQuery q) {
        DataScope scope = scopes.scopeFor(PermissionCodes.ORG_VIEW);
        q.applySort(SORT, "o.level, o.sort_order, o.code");
        return PageResult.of(mapper.search(f, scope, q), mapper.count(f, scope), q);
    }

    /** Cây đơn vị (TreeSelect): scope=mine lọc theo phạm vi user; assignableOnly chỉ đơn vị “Giao KPI” */
    public List<OrgUnit> tree(boolean mine, boolean assignableOnly) {
        DataScope scope = mine ? scopes.scopeFor(CurrentUser.current(), null) : DataScope.ALL;
        List<OrgUnit> all = mapper.findAllActive(scope, assignableOnly);
        return buildTree(all);
    }

    public static List<OrgUnit> buildTree(List<OrgUnit> all) {
        Map<Long, OrgUnit> byId = new LinkedHashMap<>();
        all.forEach(o -> {
            o.setChildren(new ArrayList<>());
            byId.put(o.getId(), o);
        });
        List<OrgUnit> roots = new ArrayList<>();
        for (OrgUnit o : all) {
            OrgUnit p = o.getParentId() == null ? null : byId.get(o.getParentId());
            if (p == null) roots.add(o);
            else p.getChildren().add(o);
        }
        return roots;
    }

    public OrgUnit get(Long id) {
        OrgUnit o = Guards.found(mapper.findById(id), "đơn vị");
        scopes.assertUnit(PermissionCodes.ORG_VIEW, id);
        return o;
    }

    @Transactional
    public OrgUnit create(OrgUnitRequest r) {
        if (mapper.findByCode(r.code().trim()) != null) throw BusinessException.field("code", "Mã đơn vị đã tồn tại");
        OrgUnit parent = null;
        if (r.parentId() != null) {
            parent = Guards.found(mapper.findById(r.parentId()), "đơn vị cha");
            scopes.assertUnit(PermissionCodes.ORG_CREATE, parent.getId());
        } else if (!scopes.scopeFor(PermissionCodes.ORG_CREATE).all()) {
            throw BusinessException.field("parentId", "Vui lòng chọn Đơn vị cha thuộc phạm vi quản lý");
        }
        OrgUnit o = new OrgUnit();
        apply(o, r);
        o.setCode(r.code().trim());
        o.setCreatedBy(CurrentUser.currentUsername());
        o.setUpdatedBy(CurrentUser.currentUsername());
        mapper.insert(o);
        String path = (parent == null ? "/" : parent.getPath()) + o.getId() + "/";
        mapper.updatePath(o.getId(), path, parent == null ? 1 : parent.getLevel() + 1);
        scopes.evictOrgTree();
        OrgUnit saved = mapper.findById(o.getId());
        audit.log("THEM", "org_unit", o.getId(), null, saved);
        return saved;
    }

    @Transactional
    public OrgUnit update(Long id, OrgUnitRequest r) {
        OrgUnit before = get(id);
        scopes.assertUnit(PermissionCodes.ORG_UPDATE, id);
        OrgUnit newParent = null;
        if (r.parentId() != null) {
            if (r.parentId().equals(id)) throw BusinessException.field("parentId", "Không được chọn đơn vị cha là chính nó");
            newParent = Guards.found(mapper.findById(r.parentId()), "đơn vị cha");
            if (newParent.getPath().startsWith(before.getPath())) {
                throw BusinessException.field("parentId", "Không được chọn đơn vị cha là đơn vị con cháu của nó");
            }
        }
        OrgUnit o = new OrgUnit();
        apply(o, r);
        o.setId(id);
        o.setVersion(r.version() == null ? before.getVersion() : r.version());
        o.setUpdatedBy(CurrentUser.currentUsername());
        Guards.updated(mapper.update(o));
        boolean parentChanged = !java.util.Objects.equals(before.getParentId(), r.parentId());
        if (parentChanged) {
            String newPath = (newParent == null ? "/" : newParent.getPath()) + id + "/";
            int newLevel = newParent == null ? 1 : newParent.getLevel() + 1;
            mapper.updatePath(id, newPath, newLevel);
            mapper.rebasePaths(before.getPath(), newPath, newLevel - before.getLevel());
        }
        scopes.evictOrgTree();
        OrgUnit after = mapper.findById(id);
        audit.log("SUA", "org_unit", id, before, after);
        return after;
    }

    @Transactional
    public void delete(Long id, Integer version) {
        OrgUnit o = get(id);
        scopes.assertUnit(PermissionCodes.ORG_DELETE, id);
        Map<String, Object> refs = mapper.countReferences(id);
        List<String> where = new ArrayList<>();
        if (n(refs, "children") > 0) where.add("đơn vị con (" + n(refs, "children") + ")");
        if (n(refs, "users") > 0) where.add("người dùng (" + n(refs, "users") + ")");
        if (n(refs, "assignments") > 0) where.add("giao KPI (" + n(refs, "assignments") + ")");
        if (n(refs, "evaluations") > 0) where.add("đánh giá KPI (" + n(refs, "evaluations") + ")");
        if (n(refs, "kpis") > 0) where.add("danh mục KPI (" + n(refs, "kpis") + ")");
        if (n(refs, "strategies") > 0) where.add("chiến lược (" + n(refs, "strategies") + ")");
        if (!where.isEmpty()) throw BusinessException.inUse(String.join(", ", where));
        Guards.updated(mapper.softDelete(id, version == null ? o.getVersion() : version, CurrentUser.currentUsername()));
        scopes.evictOrgTree();
        audit.log("XOA", "org_unit", id, o, null);
    }

    public byte[] export(Map<String, Object> f, PageQuery q) {
        List<OrgUnit> rows = search(f, q.forExport()).items();
        List<ExcelColumn<OrgUnit>> cols = List.of(
                ExcelColumn.of("Mã đơn vị", OrgUnit::getCode),
                ExcelColumn.of("Tên đơn vị", OrgUnit::getName, 45),
                ExcelColumn.of("Mã đơn vị cha", OrgUnit::getParentCode),
                ExcelColumn.of("Đơn vị cha", OrgUnit::getParentName, 40),
                ExcelColumn.of("Tên viết tắt", OrgUnit::getShortName),
                ExcelColumn.of("Loại đơn vị", o -> Labels.of(Labels.UNIT_TYPE, o.getUnitType())),
                ExcelColumn.of("Vùng", o -> Labels.of(Labels.REGION, o.getRegionCode())),
                ExcelColumn.of("Giao KPI", OrgUnit::getIsKpiAssignable),
                ExcelColumn.of("Thứ tự", OrgUnit::getSortOrder),
                ExcelColumn.of("Người tạo", OrgUnit::getCreatedBy),
                ExcelColumn.of("Ngày tạo", OrgUnit::getCreatedAt),
                ExcelColumn.of("Người cập nhật", OrgUnit::getUpdatedBy),
                ExcelColumn.of("Ngày cập nhật", OrgUnit::getUpdatedAt));
        return ExcelExporter.export("Danh sach don vi", "DANH SÁCH ĐƠN VỊ", cols, rows);
    }

    private static void apply(OrgUnit o, OrgUnitRequest r) {
        o.setName(r.name().trim());
        o.setShortName(Strs.trimToNull(r.shortName()));
        o.setParentId(r.parentId());
        o.setUnitType(r.unitType());
        o.setRegionCode(Strs.trimToNull(r.regionCode()));
        o.setIsKpiAssignable(Boolean.TRUE.equals(r.isKpiAssignable()));
        o.setSortOrder(r.sortOrder() == null ? 0 : r.sortOrder());
    }

    private static long n(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v == null ? 0 : ((Number) v).longValue();
    }

    /** Dùng nội bộ (import, các module khác) */
    public OrgUnit findByCode(String code) { return mapper.findByCode(code); }

}
