package vn.vnpt.kpi.modules.assignment.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vnpt.kpi.common.ApiResponse;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.common.Guards;
import vn.vnpt.kpi.common.Labels;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.PageResult;
import vn.vnpt.kpi.common.audit.AuditService;
import vn.vnpt.kpi.common.util.Jsons;
import vn.vnpt.kpi.common.util.Strs;
import vn.vnpt.kpi.modules.assignment.dto.AssignmentDtos.AdjLine;
import vn.vnpt.kpi.modules.assignment.dto.AssignmentDtos.AdjustRequest;
import vn.vnpt.kpi.modules.assignment.dto.AssignmentDtos.ByKpiRequest;
import vn.vnpt.kpi.modules.assignment.dto.AssignmentDtos.ByUnitRequest;
import vn.vnpt.kpi.modules.assignment.dto.AssignmentDtos.CopyByKpi;
import vn.vnpt.kpi.modules.assignment.dto.AssignmentDtos.CopyByUnit;
import vn.vnpt.kpi.modules.assignment.dto.AssignmentDtos.DetailInput;
import vn.vnpt.kpi.modules.assignment.dto.AssignmentDtos.KpiYear;
import vn.vnpt.kpi.modules.assignment.mapper.AssignmentMapper;
import vn.vnpt.kpi.modules.assignment.model.AssignmentModels.Adjustment;
import vn.vnpt.kpi.modules.assignment.model.AssignmentModels.AdjustmentLine;
import vn.vnpt.kpi.modules.assignment.model.AssignmentModels.ByKpiRow;
import vn.vnpt.kpi.modules.assignment.model.AssignmentModels.Detail;
import vn.vnpt.kpi.modules.assignment.model.AssignmentModels.Header;
import vn.vnpt.kpi.modules.catalog.mapper.KpiMapper;
import vn.vnpt.kpi.modules.catalog.model.Kpi;
import vn.vnpt.kpi.modules.evaluation.service.EvaluationProvisioner;
import vn.vnpt.kpi.modules.notification.mapper.NotificationMapper;
import vn.vnpt.kpi.modules.notification.service.NotificationService;
import vn.vnpt.kpi.modules.org.mapper.OrgUnitMapper;
import vn.vnpt.kpi.modules.org.model.OrgUnit;
import vn.vnpt.kpi.security.CurrentUser;
import vn.vnpt.kpi.security.DataScope;
import vn.vnpt.kpi.security.DataScopeService;
import vn.vnpt.kpi.security.PermissionCodes;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Giao KPI (29–35): trạng thái “Đang soạn” → “Đã giao” → “Đã điều chỉnh”. Chỉ “Đang soạn” được Sửa/Xóa;
 * chỉ “Đã giao”/“Đã điều chỉnh” được Điều chỉnh.
 */
@Service
@RequiredArgsConstructor
public class AssignmentService {
    public static final String DANG_SOAN = "DANG_SOAN", DA_GIAO = "DA_GIAO", DA_DIEU_CHINH = "DA_DIEU_CHINH";
    static final Map<String, String> H_SORT = Map.of("orgUnitName", "o.name", "year", "h.year", "status", "h.status", "createdAt", "h.created_at", "updatedAt", "h.updated_at");
    static final Map<String, String> K_SORT = Map.of("kpiCode", "k.code", "year", "d.year", "unitCount", "unit_count", "updatedAt", "updated_at");
    static final Map<String, String> ADJ_COL = Map.of("Q1", "adj_q1", "Q2", "adj_q2", "H1", "adj_h1", "Q3", "adj_q3", "Q4", "adj_q4");
    static final BigDecimal HUNDRED = new BigDecimal("100");

    public record SaveResult(Header header, List<String> warnings) {}

    public record CloseResult(int closed, List<String> closedNames, List<Map<String, Object>> errors, String message) {}

    public record CopyResult(List<String> copied, List<Map<String, Object>> skipped, String message) {}

    private final AssignmentMapper mapper;
    private final KpiMapper kpiMapper;
    private final OrgUnitMapper orgMapper;
    private final DataScopeService scopes;
    private final EvaluationProvisioner provisioner;
    private final NotificationService notifications;
    private final NotificationMapper notificationMapper;
    private final AuditService audit;

    // =============================== Theo đơn vị ===============================
    public Map<String, Object> unitFilter(String keyword, Integer year, String status) {
        Map<String, Object> f = new HashMap<>();
        f.put("keyword", Strs.like(keyword));
        f.put("year", year);
        f.put("status", Strs.trimToNull(status));
        return f;
    }

    public PageResult<Header> searchByUnit(Map<String, Object> f, PageQuery q) {
        DataScope scope = scopes.scopeFor(PermissionCodes.ASSIGN_VIEW);
        q.applySort(H_SORT, "h.year DESC, o.level, o.sort_order, o.code");
        return PageResult.of(mapper.searchHeaders(f, scope, q), mapper.countHeaders(f, scope), q);
    }

    /** 29.3: danh sách tiêu chí đã giao trong năm + tổng trọng số */
    public Header getByUnit(Long id) {
        Header h = Guards.found(mapper.findHeader(id), "bản giao KPI");
        scopes.assertUnit(PermissionCodes.ASSIGN_VIEW, h.getOrgUnitId());
        h.setDetails(mapper.findDetailsOfHeader(id));
        return h;
    }

    /** 30.1 Thêm mới giao KPI theo đơn vị — lưu “Đang soạn”; tổng trọng số ≠ 100 → cảnh báo */
    @Transactional
    public SaveResult createByUnit(ByUnitRequest r) {
        OrgUnit unit = assignableUnit(r.orgUnitId(), PermissionCodes.ASSIGN_CREATE);
        if (mapper.findHeaderByUnitYear(r.orgUnitId(), r.year()) != null) {
            throw BusinessException.field("orgUnitId", "Đơn vị " + unit.getName() + " đã có bản giao KPI năm " + r.year() + " (trùng đơn vị, năm)");
        }
        List<DetailInput> details = r.details() == null ? List.of() : r.details();
        validateKpis(details);
        Header h = newHeader(r.orgUnitId(), r.year());
        String action = "IMPORT".equals(r.source()) ? "NHAP_FILE" : "TAO";
        for (DetailInput d : details) insertDetail(h.getId(), d.kpiId(), r.orgUnitId(), r.year(), d, action);
        mapper.refreshHeaderStatus(h.getId());
        Header saved = getByUnit(h.getId());
        audit.log("THEM", "kpi_assignment", h.getId(), null, saved);
        return new SaveResult(saved, weightWarnings(saved));
    }

    /** 30.2 Ghi lại: chỉ bản ghi “Đang soạn” */
    @Transactional
    public SaveResult updateByUnit(Long id, ByUnitRequest r) {
        Header before = getByUnit(id);
        scopes.assertUnit(PermissionCodes.ASSIGN_UPDATE, before.getOrgUnitId());
        if (!DANG_SOAN.equals(before.getStatus())) throw new BusinessException(ErrorCode.ERR_INVALID_STATE, "Chỉ bản ghi “Đang soạn” được sửa");
        List<DetailInput> details = r.details() == null ? List.of() : r.details();
        validateKpis(details);
        Map<Long, Detail> existingByKpi = before.getDetails().stream().collect(Collectors.toMap(Detail::getKpiId, Function.identity()));
        Set<Long> keep = new HashSet<>();
        String action = "IMPORT".equals(r.source()) ? "NHAP_FILE" : "SUA";
        for (DetailInput d : details) {
            Detail ex = existingByKpi.get(d.kpiId());
            keep.add(d.kpiId());
            if (ex == null) insertDetail(id, d.kpiId(), before.getOrgUnitId(), before.getYear(), d, "TAO");
            else if (DANG_SOAN.equals(ex.getStatus())) updateDetail(ex, d, action);
        }
        for (Detail ex : before.getDetails()) {
            if (!keep.contains(ex.getKpiId()) && DANG_SOAN.equals(ex.getStatus())) mapper.deleteDetail(ex.getId());
        }
        mapper.touchHeader(id, CurrentUser.currentUsername());
        mapper.refreshHeaderStatus(id);
        Header after = getByUnit(id);
        audit.log("SUA", "kpi_assignment", id, before, after);
        return new SaveResult(after, weightWarnings(after));
    }

    /** 29.4 Xóa: chỉ “Đang soạn” → xóa header và detail */
    @Transactional
    public void deleteByUnit(Long id) {
        Header h = getByUnit(id);
        scopes.assertUnit(PermissionCodes.ASSIGN_DELETE, h.getOrgUnitId());
        if (!DANG_SOAN.equals(h.getStatus()) || h.getDetails().stream().anyMatch(d -> !DANG_SOAN.equals(d.getStatus()))) {
            throw new BusinessException(ErrorCode.ERR_INVALID_STATE, "Chỉ xóa được bản giao KPI ở trạng thái “Đang soạn”");
        }
        h.getDetails().forEach(d -> mapper.deleteDetail(d.getId()));
        mapper.deleteHeader(id);
        audit.log("XOA", "kpi_assignment", id, h, null);
    }

    /** Danh sách đơn vị nhận bản sao (29.5) — kèm “Trạng thái giao” ở năm đích, “Nhóm đơn vị” */
    public List<Map<String, Object>> copyTargets(Integer targetYear) {
        Map<Long, String> status = new HashMap<>();
        for (Map<String, Object> m : mapper.unitAssignStatus(targetYear, null)) status.put(((Number) m.get("orgUnitId")).longValue(), (String) m.get("status"));
        DataScope scope = scopes.scopeFor(PermissionCodes.ASSIGN_COPY);
        List<Map<String, Object>> out = new ArrayList<>();
        for (OrgUnit o : orgMapper.findAllActive(scope, true)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", o.getId());
            m.put("code", o.getCode());
            m.put("name", o.getName());
            m.put("parentId", o.getParentId());
            m.put("unitType", o.getUnitType());
            m.put("unitGroup", Labels.of(Labels.UNIT_TYPE, o.getUnitType()));
            String st = status.get(o.getId());
            m.put("assignStatus", st);
            m.put("assignStatusName", st == null ? "Chưa giao" : Labels.of(Labels.ASSIGN_STATUS, st));
            out.add(m);
        }
        return out;
    }

    /** 29.5 Sao chép giao KPI theo đơn vị: đích “Đang soạn” → ghi đè; đích “Đã giao” → bỏ qua và liệt kê */
    @Transactional
    public CopyResult copyByUnit(Long id, CopyByUnit r) {
        Header src = getByUnit(id);
        List<String> copied = new ArrayList<>();
        List<Map<String, Object>> skipped = new ArrayList<>();
        for (Long unitId : r.targetUnitIds().stream().distinct().toList()) {
            OrgUnit u = orgMapper.findById(unitId);
            if (u == null) continue;
            if (!scopes.scopeFor(PermissionCodes.ASSIGN_COPY).contains(unitId)) {
                skipped.add(Map.of("unit", u.getName(), "reason", "Ngoài phạm vi quản lý"));
                continue;
            }
            if (!Boolean.TRUE.equals(u.getIsKpiAssignable())) {
                skipped.add(Map.of("unit", u.getName(), "reason", "Đơn vị không được giao KPI"));
                continue;
            }
            if (unitId.equals(src.getOrgUnitId()) && r.targetYear().equals(src.getYear())) {
                skipped.add(Map.of("unit", u.getName(), "reason", "Trùng đơn vị nguồn"));
                continue;
            }
            Header target = mapper.findHeaderByUnitYear(unitId, r.targetYear());
            if (target != null) {
                List<Detail> tds = mapper.findDetailsOfHeader(target.getId());
                if (!DANG_SOAN.equals(target.getStatus()) || tds.stream().anyMatch(d -> !DANG_SOAN.equals(d.getStatus()))) {
                    skipped.add(Map.of("unit", u.getName(), "reason", "Đã " + Labels.of(Labels.ASSIGN_STATUS, target.getStatus()).toLowerCase().replace("đã ", "") + " — bỏ qua"));
                    continue;
                }
                tds.forEach(d -> mapper.deleteDetail(d.getId()));
            } else {
                target = newHeader(unitId, r.targetYear());
            }
            for (Detail d : src.getDetails()) {
                Detail nd = copyOf(d, target.getId(), unitId, r.targetYear());
                mapper.insertDetail(nd);
                history(nd.getId(), "SAO_CHEP", nd);
            }
            mapper.touchHeader(target.getId(), CurrentUser.currentUsername());
            mapper.refreshHeaderStatus(target.getId());
            copied.add(u.getName());
        }
        audit.log("SAO_CHEP", "kpi_assignment", id, null, Map.of("targetYear", r.targetYear(), "copied", copied, "skipped", skipped));
        String msg = "Sao chép thành công " + copied.size() + " đơn vị" + (skipped.isEmpty() ? "" : "; bỏ qua " + skipped.size() + " đơn vị");
        return new CopyResult(copied, skipped, msg);
    }

    /** 31.1 Chốt số liệu giao KPI theo đơn vị */
    @Transactional
    public CloseResult closeByUnit(List<Long> ids) {
        List<Long> toClose = new ArrayList<>();
        List<String> names = new ArrayList<>();
        List<Map<String, Object>> errors = new ArrayList<>();
        for (Header h : mapper.findHeadersByIds(ids)) {
            if (!scopes.scopeFor(PermissionCodes.ASSIGN_CLOSE).contains(h.getOrgUnitId())) {
                errors.add(err(h.getId(), h.getOrgUnitName() + " – " + h.getYear(), List.of("Ngoài phạm vi quản lý")));
                continue;
            }
            List<Detail> ds = mapper.findDetailsOfHeader(h.getId());
            List<Detail> drafts = ds.stream().filter(d -> DANG_SOAN.equals(d.getStatus())).toList();
            List<String> reasons = new ArrayList<>();
            if (drafts.isEmpty()) reasons.add("Không có chỉ tiêu ở trạng thái “Đang soạn”");
            BigDecimal total = ds.stream().filter(d -> d.getParentKpiId() == null).map(d -> d.getWeight() == null ? BigDecimal.ZERO : d.getWeight())
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (total.compareTo(HUNDRED) != 0) reasons.add("Tổng trọng số khác 100 (hiện tại " + total.stripTrailingZeros().toPlainString() + ")");
            for (Detail d : drafts) {
                if (d.getTargetYear() == null) reasons.add("Thiếu KH năm: " + d.getKpiCode());
            }
            if (!reasons.isEmpty()) {
                errors.add(err(h.getId(), h.getOrgUnitName() + " – " + h.getYear(), reasons));
                continue;
            }
            drafts.forEach(d -> toClose.add(d.getId()));
            names.add(h.getOrgUnitName() + " – " + h.getYear());
        }
        finishClose(toClose);
        return closeResult(toClose.isEmpty() ? 0 : names.size(), names, errors);
    }

    // =============================== Theo chỉ tiêu ===============================
    public Map<String, Object> kpiFilter(String keyword, Integer year, Long perspectiveId, String status) {
        Map<String, Object> f = new HashMap<>();
        f.put("keyword", Strs.like(keyword));
        f.put("year", year);
        f.put("perspectiveId", perspectiveId);
        f.put("status", Strs.trimToNull(status));
        return f;
    }

    /** 32.1/32.2 — KPI cha có biểu tượng mở rộng hiển thị thông tin giao của KPI con */
    public PageResult<ByKpiRow> searchByKpi(Map<String, Object> f, PageQuery q) {
        DataScope scope = scopes.scopeFor(PermissionCodes.ASSIGN_VIEW);
        q.applySort(K_SORT, "d.year DESC, k.code");
        List<ByKpiRow> rows = mapper.searchByKpi(f, scope, q);
        if (!rows.isEmpty()) {
            Set<Long> pids = rows.stream().map(ByKpiRow::getKpiId).collect(Collectors.toSet());
            Set<Integer> years = rows.stream().map(ByKpiRow::getYear).collect(Collectors.toSet());
            Map<String, ByKpiRow> byKey = rows.stream().collect(Collectors.toMap(ByKpiRow::getKey, Function.identity()));
            for (ByKpiRow c : mapper.byKpiChildren(pids, years, scope)) {
                ByKpiRow p = byKey.get(c.getParentKpiId() + "-" + c.getYear());
                if (p != null) p.getChildren().add(c);
            }
        }
        return PageResult.of(rows, mapper.countByKpi(f, scope), q);
    }

    /** 32.3: danh sách đơn vị được giao của tiêu chí */
    public Map<String, Object> getByKpi(Long kpiId, int year) {
        Kpi k = Guards.found(kpiMapper.findById(kpiId), "tiêu chí KPI");
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("kpi", k);
        m.put("year", year);
        List<Detail> ds = mapper.findDetailsOfKpiYear(kpiId, year, scopes.scopeFor(PermissionCodes.ASSIGN_VIEW));
        m.put("details", ds);
        m.put("status", derive(ds));
        return m;
    }

    /** 33.1 Thêm mới giao KPI theo chỉ tiêu — “Đang soạn”; (KPI, đơn vị, năm) ở trạng thái khác “Đang soạn” → lỗi dòng */
    @Transactional
    public Map<String, Object> saveByKpi(ByKpiRequest r, boolean replace) {
        Kpi k = Guards.found(kpiMapper.findById(r.kpiId()), "tiêu chí KPI");
        List<DetailInput> details = r.details() == null ? List.of() : r.details();
        List<ApiResponse.FieldError> errs = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        for (int i = 0; i < details.size(); i++) {
            DetailInput d = details.get(i);
            OrgUnit u = d.orgUnitId() == null ? null : orgMapper.findById(d.orgUnitId());
            if (u == null) {
                errs.add(new ApiResponse.FieldError("details[" + i + "].orgUnitId", "Dòng " + (i + 1) + ": đơn vị không tồn tại"));
                continue;
            }
            if (!seen.add(u.getId())) errs.add(new ApiResponse.FieldError("details[" + i + "].orgUnitId", "Dòng " + (i + 1) + ": trùng đơn vị " + u.getName()));
            if (!Boolean.TRUE.equals(u.getIsKpiAssignable())) errs.add(new ApiResponse.FieldError("details[" + i + "].orgUnitId", "Dòng " + (i + 1) + ": đơn vị " + u.getName() + " không được giao KPI"));
            if (!scopes.scopeFor(PermissionCodes.ASSIGN_CREATE).contains(u.getId())) errs.add(new ApiResponse.FieldError("details[" + i + "].orgUnitId", "Dòng " + (i + 1) + ": ngoài phạm vi quản lý"));
            Detail ex = mapper.findDetailByKey(k.getId(), u.getId(), r.year());
            if (ex != null && !DANG_SOAN.equals(ex.getStatus())) {
                errs.add(new ApiResponse.FieldError("details[" + i + "].orgUnitId", "Dòng " + (i + 1) + ": " + u.getName() + " đã được giao KPI này năm "
                        + r.year() + " ở trạng thái “" + Labels.of(Labels.ASSIGN_STATUS, ex.getStatus()) + "”"));
            }
        }
        if (!errs.isEmpty()) throw new BusinessException(ErrorCode.ERR_VALIDATION, errs.get(0).message(), null, errs);
        String action = "IMPORT".equals(r.source()) ? "NHAP_FILE" : "TAO";
        Set<Long> headers = new HashSet<>();
        for (DetailInput d : details) {
            Detail ex = mapper.findDetailByKey(k.getId(), d.orgUnitId(), r.year());
            if (ex != null) {
                updateDetail(ex, d, "IMPORT".equals(r.source()) ? "NHAP_FILE" : "SUA");
                headers.add(ex.getAssignmentId());
            } else {
                Header h = mapper.findHeaderByUnitYear(d.orgUnitId(), r.year());
                if (h == null) h = newHeader(d.orgUnitId(), r.year());
                insertDetail(h.getId(), k.getId(), d.orgUnitId(), r.year(), d, action);
                headers.add(h.getId());
            }
        }
        if (replace) {
            for (Detail ex : mapper.findDetailsOfKpiYear(k.getId(), r.year(), scopes.scopeFor(PermissionCodes.ASSIGN_UPDATE))) {
                if (!seen.contains(ex.getOrgUnitId()) && DANG_SOAN.equals(ex.getStatus())) {
                    mapper.deleteDetail(ex.getId());
                    headers.add(ex.getAssignmentId());
                }
            }
        }
        refreshHeaders(headers);
        audit.log(replace ? "SUA" : "THEM", "kpi_assignment_detail", k.getId() + "-" + r.year(), null, Map.of("kpi", k.getCode(), "year", r.year(), "units", details.size()));
        return getByKpi(k.getId(), r.year());
    }

    /** 33.2: chỉ khi có bản ghi “Đang soạn” */
    @Transactional
    public Map<String, Object> updateByKpi(Long kpiId, int year, ByKpiRequest r) {
        List<Detail> ds = mapper.findDetailsOfKpiYear(kpiId, year, scopes.scopeFor(PermissionCodes.ASSIGN_UPDATE));
        if (ds.stream().noneMatch(d -> DANG_SOAN.equals(d.getStatus()))) {
            throw new BusinessException(ErrorCode.ERR_INVALID_STATE, "Chỉ bản ghi “Đang soạn” được sửa");
        }
        return saveByKpi(new ByKpiRequest(kpiId, year, r.details(), r.source()), true);
    }

    /** 32.4 Sao chép giao KPI theo chỉ tiêu: sao chép trọng số, chỉ tiêu các kỳ của đơn vị nguồn cho các đơn vị đã chọn */
    @Transactional
    public CopyResult copyByKpi(CopyByKpi r) {
        Kpi k = Guards.found(kpiMapper.findById(r.kpiId()), "tiêu chí KPI");
        List<Long> kpiIds = new ArrayList<>(List.of(k.getId()));
        kpiMapper.findChildrenOf(List.of(k.getId()), new HashMap<>()).forEach(c -> kpiIds.add(c.getId()));
        Map<Long, Detail> srcByKpi = new LinkedHashMap<>();
        for (Long kid : kpiIds) {
            Detail d = mapper.findDetailByKey(kid, r.sourceUnitId(), r.year());
            if (d != null) srcByKpi.put(kid, d);
        }
        if (srcByKpi.isEmpty()) throw BusinessException.field("sourceUnitId", "Đơn vị nguồn chưa được giao KPI này");
        List<String> copied = new ArrayList<>();
        List<Map<String, Object>> skipped = new ArrayList<>();
        Set<Long> headers = new HashSet<>();
        for (Long unitId : r.targetUnitIds().stream().distinct().filter(u -> !u.equals(r.sourceUnitId())).toList()) {
            OrgUnit u = orgMapper.findById(unitId);
            if (u == null) continue;
            if (!Boolean.TRUE.equals(u.getIsKpiAssignable()) || !scopes.scopeFor(PermissionCodes.ASSIGN_COPY).contains(unitId)) {
                skipped.add(Map.of("unit", u.getName(), "reason", "Không được giao KPI hoặc ngoài phạm vi"));
                continue;
            }
            boolean blocked = srcByKpi.keySet().stream().map(kid -> mapper.findDetailByKey(kid, unitId, r.year()))
                    .anyMatch(ex -> ex != null && !DANG_SOAN.equals(ex.getStatus()));
            if (blocked) {
                skipped.add(Map.of("unit", u.getName(), "reason", "Đã giao — bỏ qua"));
                continue;
            }
            Header h = mapper.findHeaderByUnitYear(unitId, r.year());
            if (h == null) h = newHeader(unitId, r.year());
            for (Detail sd : srcByKpi.values()) {
                Detail ex = mapper.findDetailByKey(sd.getKpiId(), unitId, r.year());
                if (ex != null) mapper.deleteDetail(ex.getId());
                Detail nd = copyOf(sd, h.getId(), unitId, r.year());
                mapper.insertDetail(nd);
                history(nd.getId(), "SAO_CHEP", nd);
            }
            headers.add(h.getId());
            copied.add(u.getName());
        }
        refreshHeaders(headers);
        audit.log("SAO_CHEP", "kpi_assignment_detail", k.getId(), null, Map.of("year", r.year(), "source", r.sourceUnitId(), "copied", copied));
        return new CopyResult(copied, skipped, "Sao chép thành công " + copied.size() + " đơn vị" + (skipped.isEmpty() ? "" : "; bỏ qua " + skipped.size() + " đơn vị"));
    }

    /** Đơn vị nguồn đã được giao KPI (32.4 “Chọn đơn vị sao chép”) */
    public List<Map<String, Object>> copySources(Long kpiId, int year) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Detail d : mapper.findDetailsOfKpiYear(kpiId, year, scopes.scopeFor(PermissionCodes.ASSIGN_VIEW))) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("orgUnitId", d.getOrgUnitId());
            m.put("orgUnitName", d.getOrgUnitName());
            m.put("status", d.getStatus());
            out.add(m);
        }
        return out;
    }

    /** 31.2 Chốt số liệu giao KPI theo chỉ tiêu (cùng hậu xử lý 31.1) */
    @Transactional
    public CloseResult closeByKpi(List<KpiYear> keys) {
        List<Long> toClose = new ArrayList<>();
        List<String> names = new ArrayList<>();
        List<Map<String, Object>> errors = new ArrayList<>();
        DataScope scope = scopes.scopeFor(PermissionCodes.ASSIGN_CLOSE);
        for (KpiYear ky : keys) {
            Kpi k = kpiMapper.findById(ky.kpiId());
            if (k == null) continue;
            List<Long> kpiIds = new ArrayList<>(List.of(k.getId()));
            kpiMapper.findChildrenOf(List.of(k.getId()), new HashMap<>()).forEach(c -> kpiIds.add(c.getId()));
            List<Detail> drafts = new ArrayList<>();
            for (Long kid : kpiIds) {
                mapper.findDetailsOfKpiYear(kid, ky.year(), scope).stream().filter(d -> DANG_SOAN.equals(d.getStatus())).forEach(drafts::add);
            }
            List<String> reasons = new ArrayList<>();
            if (drafts.isEmpty()) reasons.add("Không có đơn vị ở trạng thái “Đang soạn”");
            for (Detail d : drafts) {
                if (d.getTargetYear() == null) reasons.add(d.getOrgUnitName() + ": thiếu KH năm");
                if (d.getParentKpiId() == null && d.getWeight() == null) reasons.add(d.getOrgUnitName() + ": thiếu trọng số");
            }
            String label = k.getCode() + " – " + k.getName() + " (" + ky.year() + ")";
            if (!reasons.isEmpty()) {
                errors.add(err(k.getId(), label, reasons));
                continue;
            }
            drafts.forEach(d -> toClose.add(d.getId()));
            names.add(label);
        }
        finishClose(toClose);
        return closeResult(names.size(), names, errors);
    }

    // =============================== Điều chỉnh (34) ===============================
    public Map<String, Object> getAdjustment(Long kpiId, int year) {
        Kpi k = Guards.found(kpiMapper.findById(kpiId), "tiêu chí KPI");
        List<Detail> ds = mapper.findDetailsOfKpiYear(kpiId, year, scopes.scopeFor(PermissionCodes.ASSIGN_ADJUST)).stream()
                .filter(d -> !DANG_SOAN.equals(d.getStatus())).toList();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("kpi", k);
        m.put("year", year);
        m.put("status", derive(ds));
        m.put("statusName", Labels.of(Labels.ASSIGN_STATUS, derive(ds)));
        m.put("details", ds);
        m.put("lockedPeriods", lockedPeriods(year));
        Adjustment draft = mapper.findDraftAdjustment(kpiId, year);
        if (draft != null) draft.setLines(mapper.findAdjustmentLines(draft.getId()));
        m.put("draft", draft);
        return m;
    }

    /** 34.1 Lưu nháp */
    @Transactional
    public Map<String, Object> saveDraft(Long kpiId, int year, AdjustRequest r) {
        List<Detail> ds = validateAdjustment(kpiId, year, r);
        Adjustment a = upsertAdjustment(kpiId, year, r, "NHAP", ds);
        audit.log("LUU_NHAP_DIEU_CHINH", "kpi_assignment_adjustment", a.getId(), null, r);
        return getAdjustment(kpiId, year);
    }

    /** 34.2 Lưu chốt: cập nhật adj_*, “Đã điều chỉnh”, lịch sử, tính lại plan_value kết quả chưa chốt, notify */
    @Transactional
    public Map<String, Object> commitAdjustment(Long kpiId, int year, AdjustRequest r) {
        List<Detail> ds = validateAdjustment(kpiId, year, r);
        Map<Long, Detail> byId = ds.stream().collect(Collectors.toMap(Detail::getId, Function.identity()));
        Adjustment a = upsertAdjustment(kpiId, year, r, "DA_CHOT", ds);
        Set<Long> changed = new HashSet<>();
        Set<Long> headers = new HashSet<>();
        for (AdjLine l : r.lines() == null ? List.<AdjLine>of() : r.lines()) {
            Detail d = byId.get(l.detailId());
            BigDecimal cur = d.adj(l.periodCode()) != null ? d.adj(l.periodCode()) : d.target(l.periodCode());
            if (l.newValue() == null || (cur != null && cur.compareTo(l.newValue()) == 0)) continue;
            mapper.applyAdjustment(d.getId(), ADJ_COL.get(l.periodCode()), l.newValue(), CurrentUser.currentUsername());
            changed.add(d.getId());
            headers.add(d.getAssignmentId());
        }
        for (Long did : changed) {
            Detail after = mapper.findDetail(did);
            mapper.insertHistory(did, "DIEU_CHINH", r.decisionNo(), r.decisionDate(), r.reason(), Jsons.toJson(after), CurrentUser.currentUsername());
        }
        refreshHeaders(headers);
        if (!changed.isEmpty()) {
            provisioner.provision(changed);
            Kpi k = kpiMapper.findById(kpiId);
            Set<Long> units = changed.stream().map(byId::get).map(Detail::getOrgUnitId).collect(Collectors.toSet());
            notifyUnits(units, PermissionCodes.MYKPI_VIEW, new NotificationService.Message(NotificationService.EV_DIEU_CHINH_MUC_TIEU,
                    "Điều chỉnh mục tiêu giao KPI " + k.getCode(),
                    "Mục tiêu giao KPI " + k.getCode() + " – " + k.getName() + " năm " + year + " đã được điều chỉnh theo quyết định số " + r.decisionNo(),
                    "/my-kpi", Map.of("view", "period", "year", year)), NotificationService.Channel.BELL);
        }
        audit.log("CHOT_DIEU_CHINH", "kpi_assignment_adjustment", a.getId(), null, Map.of("decisionNo", r.decisionNo(), "changedDetails", changed));
        Map<String, Object> m = getAdjustment(kpiId, year);
        m.put("changedCount", changed.size());
        return m;
    }

    /** 34.3 Lịch sử điều chỉnh của đơn vị */
    public List<?> history(Long detailId) {
        Detail d = Guards.found(mapper.findDetail(detailId), "chi tiết giao KPI");
        scopes.assertUnit(PermissionCodes.ASSIGN_VIEW, d.getOrgUnitId());
        return mapper.adjustmentHistory(detailId);
    }

    private List<Detail> validateAdjustment(Long kpiId, int year, AdjustRequest r) {
        Guards.found(kpiMapper.findById(kpiId), "tiêu chí KPI");
        List<Detail> ds = mapper.findDetailsOfKpiYear(kpiId, year, scopes.scopeFor(PermissionCodes.ASSIGN_ADJUST)).stream()
                .filter(d -> DA_GIAO.equals(d.getStatus()) || DA_DIEU_CHINH.equals(d.getStatus())).toList();
        if (ds.isEmpty()) throw new BusinessException(ErrorCode.ERR_INVALID_STATE, "Chỉ bản ghi “Đã giao” hoặc “Đã điều chỉnh” được điều chỉnh");
        Set<Long> ids = ds.stream().map(Detail::getId).collect(Collectors.toSet());
        Set<String> locked = new HashSet<>(lockedPeriods(year));
        for (AdjLine l : r.lines() == null ? List.<AdjLine>of() : r.lines()) {
            if (!ids.contains(l.detailId())) throw new BusinessException(ErrorCode.ERR_VALIDATION, "Dòng điều chỉnh không thuộc KPI/năm hoặc chưa ở trạng thái “Đã giao”");
            if (l.newValue() != null && locked.contains(l.periodCode())) {
                throw new BusinessException(ErrorCode.ERR_PERIOD_LOCKED, "Kỳ " + Labels.of(Labels.PERIOD, l.periodCode()) + " đã chốt đánh giá, không được điều chỉnh");
            }
        }
        return ds;
    }

    private Adjustment upsertAdjustment(Long kpiId, int year, AdjustRequest r, String status, List<Detail> ds) {
        Map<Long, Detail> byId = ds.stream().collect(Collectors.toMap(Detail::getId, Function.identity()));
        Adjustment a = mapper.findDraftAdjustment(kpiId, year);
        boolean isNew = a == null;
        if (isNew) {
            a = new Adjustment();
            a.setKpiId(kpiId);
            a.setYear(year);
            a.setCreatedBy(CurrentUser.currentUsername());
        }
        a.setDecisionNo(r.decisionNo().trim());
        a.setDecisionDate(r.decisionDate());
        a.setReason(r.reason().trim());
        a.setStatus(status);
        a.setUpdatedBy(CurrentUser.currentUsername());
        if (isNew) mapper.insertAdjustment(a);
        else {
            mapper.updateAdjustment(a);
            mapper.deleteAdjustmentLines(a.getId());
        }
        for (AdjLine l : r.lines() == null ? List.<AdjLine>of() : r.lines()) {
            if (l.newValue() == null) continue;
            Detail d = byId.get(l.detailId());
            BigDecimal cur = d.adj(l.periodCode()) != null ? d.adj(l.periodCode()) : d.target(l.periodCode());
            if ("DA_CHOT".equals(status) && cur != null && cur.compareTo(l.newValue()) == 0) continue;
            AdjustmentLine x = new AdjustmentLine();
            x.setAdjustmentId(a.getId());
            x.setDetailId(l.detailId());
            x.setPeriodCode(l.periodCode());
            x.setOldValue(cur);
            x.setNewValue(l.newValue());
            mapper.insertAdjustmentLine(x);
        }
        return a;
    }

    public List<String> lockedPeriods(int year) {
        List<String> closed = mapper.closedPeriods(year);
        if (closed.contains("Y")) return vn.vnpt.kpi.modules.assignment.model.AssignmentModels.PERIODS;
        return closed;
    }


    // =============================== Helpers ===============================
    private void finishClose(List<Long> detailIds) {
        if (detailIds.isEmpty()) return;
        String by = CurrentUser.currentUsername();
        List<Detail> ds = mapper.findDetailsByIds(detailIds);
        for (int i = 0; i < detailIds.size(); i += 1000) mapper.setDetailStatus(detailIds.subList(i, Math.min(i + 1000, detailIds.size())), DA_GIAO, by);
        for (Detail d : ds) mapper.insertHistory(d.getId(), "CHOT_GIAO", null, null, null, Jsons.toJson(d), by);
        refreshHeaders(new HashSet<>(mapper.headerIdsOfDetails(detailIds)));
        // Sinh evaluation_kpi và evaluation_result cho các kỳ trong năm
        provisioner.provision(detailIds);
        // Notify sự kiện “giao KPI” tới người dùng đơn vị được giao
        Map<Long, List<Detail>> byUnit = ds.stream().collect(Collectors.groupingBy(Detail::getOrgUnitId));
        for (Map.Entry<Long, List<Detail>> e : byUnit.entrySet()) {
            Detail any = e.getValue().get(0);
            notifyUnits(Set.of(e.getKey()), PermissionCodes.MYKPI_VIEW, new NotificationService.Message(NotificationService.EV_GIAO_KPI,
                            "Giao KPI năm " + any.getYear(),
                            "Đơn vị " + any.getOrgUnitName() + " đã được giao " + e.getValue().size() + " chỉ tiêu KPI năm " + any.getYear(),
                            "/my-kpi", Map.of("view", "period", "year", any.getYear())),
                    NotificationService.Channel.BELL, NotificationService.Channel.EMAIL, NotificationService.Channel.ZALO);
        }
        audit.log("CHOT_GIAO", "kpi_assignment_detail", null, null, Map.of("detailIds", detailIds.size()));
    }

    private void notifyUnits(Set<Long> unitIds, String perm, NotificationService.Message m, NotificationService.Channel... channels) {
        if (unitIds.isEmpty()) return;
        notifications.send(notificationMapper.findUsersWithPermissionInUnits(perm, unitIds), m, channels);
    }

    private CloseResult closeResult(int closed, List<String> names, List<Map<String, Object>> errors) {
        String msg = closed > 0 ? "Chốt số liệu giao KPI thành công " + closed + " bản ghi" : "Không có bản ghi nào được chốt";
        if (!errors.isEmpty()) msg += "; " + errors.size() + " bản ghi lỗi không được chốt";
        return new CloseResult(closed, names, errors, msg);
    }

    private static Map<String, Object> err(Long id, String name, List<String> reasons) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("name", name);
        m.put("reasons", reasons);
        return m;
    }

    private void refreshHeaders(Set<Long> ids) {
        for (Long h : ids) {
            mapper.touchHeader(h, CurrentUser.currentUsername());
            mapper.refreshHeaderStatus(h);
        }
    }

    private OrgUnit assignableUnit(Long id, String perm) {
        OrgUnit u = orgMapper.findById(id);
        if (u == null) throw BusinessException.field("orgUnitId", "Đơn vị không tồn tại");
        if (!Boolean.TRUE.equals(u.getIsKpiAssignable())) throw BusinessException.field("orgUnitId", "Đơn vị " + u.getName() + " không được giao KPI");
        scopes.assertUnit(perm, id);
        return u;
    }

    private void validateKpis(List<DetailInput> details) {
        Set<Long> seen = new HashSet<>();
        for (int i = 0; i < details.size(); i++) {
            DetailInput d = details.get(i);
            if (d.kpiId() == null || kpiMapper.findById(d.kpiId()) == null) throw BusinessException.field("details[" + i + "].kpiId", "Dòng " + (i + 1) + ": tiêu chí KPI không tồn tại");
            if (!seen.add(d.kpiId())) throw BusinessException.field("details[" + i + "].kpiId", "Dòng " + (i + 1) + ": trùng tiêu chí KPI");
        }
    }

    private Header newHeader(Long unitId, int year) {
        Header h = new Header();
        h.setOrgUnitId(unitId);
        h.setYear(year);
        h.setCreatedBy(CurrentUser.currentUsername());
        h.setUpdatedBy(CurrentUser.currentUsername());
        mapper.insertHeader(h);
        return h;
    }

    private void insertDetail(Long headerId, Long kpiId, Long unitId, int year, DetailInput in, String action) {
        Detail d = new Detail();
        d.setAssignmentId(headerId);
        d.setKpiId(kpiId);
        d.setOrgUnitId(unitId);
        d.setYear(year);
        fill(d, in);
        mapper.insertDetail(d);
        history(d.getId(), action, d);
    }

    private void updateDetail(Detail ex, DetailInput in, String action) {
        Detail d = new Detail();
        d.setId(ex.getId());
        fill(d, in);
        mapper.updateDetail(d);
        history(ex.getId(), action, d);
    }

    private static void fill(Detail d, DetailInput in) {
        d.setWeight(in.weight());
        d.setTargetQ1(in.targetQ1());
        d.setTargetQ2(in.targetQ2());
        d.setTargetH1(in.targetH1());
        d.setTargetQ3(in.targetQ3());
        d.setTargetQ4(in.targetQ4());
        d.setTargetYear(in.targetYear());
        d.setNote(Strs.trimToNull(in.note()));
        d.setUpdatedBy(CurrentUser.currentUsername());
    }

    private static Detail copyOf(Detail s, Long headerId, Long unitId, int year) {
        Detail d = new Detail();
        d.setAssignmentId(headerId);
        d.setKpiId(s.getKpiId());
        d.setOrgUnitId(unitId);
        d.setYear(year);
        d.setWeight(s.getWeight());
        d.setTargetQ1(s.getTargetQ1());
        d.setTargetQ2(s.getTargetQ2());
        d.setTargetH1(s.getTargetH1());
        d.setTargetQ3(s.getTargetQ3());
        d.setTargetQ4(s.getTargetQ4());
        d.setTargetYear(s.getTargetYear());
        d.setNote(s.getNote());
        d.setUpdatedBy(CurrentUser.currentUsername());
        return d;
    }

    private void history(Long detailId, String action, Detail snapshot) {
        mapper.insertHistory(detailId, action, null, null, null, Jsons.toJson(snapshot), CurrentUser.currentUsername());
    }

    static String derive(List<Detail> ds) {
        if (ds.isEmpty() || ds.stream().anyMatch(d -> DANG_SOAN.equals(d.getStatus()))) return DANG_SOAN;
        if (ds.stream().anyMatch(d -> DA_DIEU_CHINH.equals(d.getStatus()))) return DA_DIEU_CHINH;
        return DA_GIAO;
    }

    private List<String> weightWarnings(Header h) {
        BigDecimal total = h.getDetails().stream().filter(d -> d.getParentKpiId() == null).map(d -> d.getWeight() == null ? BigDecimal.ZERO : d.getWeight())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<String> w = new ArrayList<>();
        if (total.compareTo(HUNDRED) != 0) w.add("Tổng trọng số hiện là " + total.stripTrailingZeros().toPlainString() + ", khác 100. Cần điều chỉnh trước khi chốt số liệu giao KPI");
        return w;
    }

    /** Dùng cho xuất dữ liệu (35.2) */
    public List<Detail> detailsOfHeaders(List<Header> headers) {
        List<Detail> all = new ArrayList<>();
        for (Header h : headers) all.addAll(mapper.findDetailsOfHeader(h.getId()));
        return all;
    }

}
