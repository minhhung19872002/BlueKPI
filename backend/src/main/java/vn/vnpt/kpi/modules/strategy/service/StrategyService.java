package vn.vnpt.kpi.modules.strategy.service;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.common.Guards;
import vn.vnpt.kpi.common.Labels;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.PageResult;
import vn.vnpt.kpi.common.audit.AuditService;
import vn.vnpt.kpi.common.util.Jsons;
import vn.vnpt.kpi.common.util.Strs;
import vn.vnpt.kpi.modules.catalog.mapper.CatalogMapper;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.Stage;
import vn.vnpt.kpi.modules.strategy.mapper.StrategyMapper;
import vn.vnpt.kpi.modules.strategy.model.StrategyModels.MapKpi;
import vn.vnpt.kpi.modules.strategy.model.StrategyModels.MapNode;
import vn.vnpt.kpi.modules.strategy.model.StrategyModels.ObjectiveKpi;
import vn.vnpt.kpi.modules.strategy.model.StrategyModels.Strategy;
import vn.vnpt.kpi.security.CurrentUser;
import vn.vnpt.kpi.security.DataScope;
import vn.vnpt.kpi.security.DataScopeService;
import vn.vnpt.kpi.security.PermissionCodes;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/** 36.x Chiến lược, 37.x bản đồ chiến lược, 38.1 khung KPI */
@Service
@RequiredArgsConstructor
public class StrategyService {
    public static final String DANG_THUC_HIEN = "DANG_THUC_HIEN", HOAN_THANH = "HOAN_THANH";

    public record StrategyRequest(
            @NotBlank(message = "Vui lòng nhập Tên chiến lược") @Size(max = 500, message = "Tên chiến lược tối đa 500 ký tự") String name,
            @NotNull(message = "Vui lòng chọn Giai đoạn") Long stageId,
            @NotNull(message = "Vui lòng chọn Chủ trì") Long ownerUserId,
            @NotNull(message = "Vui lòng chọn Đơn vị") Long orgUnitId,
            @Min(value = 2000, message = "Năm không hợp lệ") @Max(value = 2100, message = "Năm không hợp lệ") Integer year,
            @Pattern(regexp = "DANG_THUC_HIEN|HOAN_THANH", message = "Trạng thái không hợp lệ") String status,
            Integer version) {}

    public record NodeIn(@NotNull Long objectiveId, Double posX, Double posY) {}

    public record LinkIn(@NotNull Long source, @NotNull Long target, @Size(max = 20) String sourceHandle, @Size(max = 20) String targetHandle) {}

    public record KpiIn(@NotNull Long objectiveId, @NotNull Long kpiId) {}

    public record MapRequest(@NotNull @Valid List<NodeIn> nodes, @NotNull @Valid List<LinkIn> edges, @NotNull @Valid List<KpiIn> kpis,
                             String viewport, Integer version) {}

    private static final Map<String, String> SORT = Map.of("code", "s.code", "name", "s.name", "updatedAt", "s.updated_at", "status", "s.status",
            "orgUnitName", "o.name", "ownerName", "u.full_name", "stageName", "st.from_year");

    private final StrategyMapper mapper;
    private final CatalogMapper catalog;
    private final DataScopeService scopes;
    private final AuditService audit;

    public Map<String, Object> filter(String keyword, Long ownerUserId, Integer fromYear, Integer toYear, String status, Long orgUnitId) {
        Map<String, Object> f = new HashMap<>();
        f.put("keyword", Strs.like(keyword));
        f.put("ownerUserId", ownerUserId);
        f.put("fromYear", fromYear);
        f.put("toYear", toYear);
        f.put("status", Strs.trimToNull(status));
        f.put("orgUnitId", orgUnitId);
        return f;
    }

    public PageResult<Strategy> search(Map<String, Object> f, PageQuery q) {
        q.applySort(SORT, "s.updated_at DESC, s.id DESC");
        DataScope scope = scopes.scopeFor(PermissionCodes.STRATEGY_VIEW);
        return PageResult.of(mapper.search(f, scope, q), mapper.count(f, scope), q);
    }

    public Strategy get(Long id) {
        Strategy s = Guards.found(mapper.find(id), "chiến lược");
        scopes.assertUnit(PermissionCodes.STRATEGY_VIEW, s.getOrgUnitId());
        return s;
    }

    private Stage stage(Long id) {
        return Guards.found(catalog.findStage(id), "giai đoạn");
    }

    /** 36.4 Thêm mới — tự sinh mã CL-yyyy-NNN */
    @Transactional
    public Strategy create(StrategyRequest r) {
        scopes.assertUnit(PermissionCodes.STRATEGY_CREATE, r.orgUnitId());
        Stage st = stage(r.stageId());
        int year = r.year() != null ? r.year() : Math.max(st.getFromYear(), Math.min(st.getToYear(), LocalDate.now().getYear()));
        checkYear(st, year);
        Strategy s = new Strategy();
        String prefix = "CL-" + LocalDate.now().getYear() + "-";
        s.setCode(prefix + String.format("%03d", mapper.maxCodeSeq(prefix) + 1));
        s.setName(r.name().trim());
        s.setStageId(r.stageId());
        s.setOwnerUserId(r.ownerUserId());
        s.setOrgUnitId(r.orgUnitId());
        s.setYear(year);
        s.setStatus(DANG_THUC_HIEN);
        s.setCreatedBy(CurrentUser.currentUsername());
        s.setUpdatedBy(CurrentUser.currentUsername());
        mapper.insert(s);
        Strategy saved = get(s.getId());
        audit.log("THEM", "strategy", s.getId(), null, saved);
        return saved;
    }

    private static void checkYear(Stage st, int year) {
        if (year < st.getFromYear() || year > st.getToYear()) {
            throw BusinessException.field("year", "Năm phải nằm trong giai đoạn " + st.getFromYear() + " – " + st.getToYear());
        }
    }

    private Strategy editable(Long id, String permission) {
        Strategy s = Guards.found(mapper.find(id), "chiến lược");
        scopes.assertUnit(permission, s.getOrgUnitId());
        if (!DANG_THUC_HIEN.equals(s.getStatus())) {
            throw new BusinessException(ErrorCode.ERR_INVALID_STATE, "Chỉ chiến lược “Đang thực hiện” mới được sửa hoặc xóa");
        }
        return s;
    }

    /** 36.5 Ghi lại thông tin chung */
    @Transactional
    public Strategy update(Long id, StrategyRequest r) {
        Strategy before = editable(id, PermissionCodes.STRATEGY_UPDATE);
        scopes.assertUnit(PermissionCodes.STRATEGY_UPDATE, r.orgUnitId());
        Stage st = stage(r.stageId());
        int year = r.year() != null ? r.year() : before.getYear();
        checkYear(st, year);
        Strategy s = new Strategy();
        s.setId(id);
        s.setName(r.name().trim());
        s.setStageId(r.stageId());
        s.setOwnerUserId(r.ownerUserId());
        s.setOrgUnitId(r.orgUnitId());
        s.setYear(year);
        s.setStatus(r.status() == null ? before.getStatus() : r.status());
        s.setVersion(r.version() == null ? before.getVersion() : r.version());
        s.setUpdatedBy(CurrentUser.currentUsername());
        Guards.updated(mapper.update(s));
        Strategy after = get(id);
        audit.log("SUA", "strategy", id, before, after);
        return after;
    }

    /** 36.6 Xóa cả bản đồ, liên kết và khung KPI */
    @Transactional
    public void delete(Long id, Integer version) {
        Strategy s = editable(id, PermissionCodes.STRATEGY_DELETE);
        mapper.deleteKpis(id);
        mapper.deleteLinks(id);
        mapper.deleteNodes(id);
        Guards.updated(mapper.softDelete(id, version == null ? s.getVersion() : version, CurrentUser.currentUsername()));
        audit.log("XOA", "strategy", id, s, null);
    }

    // ============================== Bản đồ ==============================
    public Map<String, Object> getMap(Long id) {
        Strategy s = get(id);
        return mapOf(s);
    }

    /** Bản đồ readonly cho Dashboard (chiến lược mới nhất của đơn vị chứa năm) */
    public Map<String, Object> mapForUnit(Long unitId, int year) {
        Long id = mapper.latestForUnit(unitId, year);
        return id == null ? null : mapOf(Guards.found(mapper.find(id), "chiến lược"));
    }

    private Map<String, Object> mapOf(Strategy s) {
        List<MapNode> nodes = mapper.nodes(s.getId());
        Map<Long, List<MapKpi>> kpis = mapper.kpis(s.getId()).stream().collect(Collectors.groupingBy(MapKpi::getObjectiveId, LinkedHashMap::new, Collectors.toList()));
        nodes.forEach(n -> n.setKpis(kpis.getOrDefault(n.getObjectiveId(), List.of())));
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("strategy", s);
        m.put("lanes", mapper.lanes());
        m.put("nodes", nodes);
        m.put("edges", mapper.links(s.getId()));
        return m;
    }

    /** PUT /strategies/{id}/map — nodes (vị trí), edges, khung KPI trong một transaction */
    @Transactional
    public Map<String, Object> saveMap(Long id, MapRequest r, boolean canAssignKpi) {
        Strategy s = editable(id, PermissionCodes.STRATEGY_UPDATE);
        Map<Long, NodeIn> nodes = new LinkedHashMap<>();
        for (NodeIn n : r.nodes()) {
            if (nodes.putIfAbsent(n.objectiveId(), n) != null) throw new BusinessException(ErrorCode.ERR_VALIDATION, "Mục tiêu bị trùng trên bản đồ");
        }
        if (!nodes.isEmpty()) {
            Map<Long, Map<String, Object>> found = mapper.objectivesByIds(nodes.keySet()).stream()
                    .collect(Collectors.toMap(o -> ((Number) o.get("id")).longValue(), Function.identity()));
            Set<Long> existing = mapper.nodes(id).stream().map(MapNode::getObjectiveId).collect(Collectors.toSet());
            for (Long oid : nodes.keySet()) {
                Map<String, Object> o = found.get(oid);
                if (o == null) throw new BusinessException(ErrorCode.ERR_VALIDATION, "Mục tiêu trọng tâm không tồn tại (id " + oid + ")");
                if (!"HIEU_LUC".equals(o.get("status")) && !existing.contains(oid)) {
                    throw new BusinessException(ErrorCode.ERR_VALIDATION, "Mục tiêu " + o.get("code") + " không còn hiệu lực");
                }
            }
        }
        Set<String> pairs = new HashSet<>();
        List<Map<String, Object>> links = new ArrayList<>();
        for (LinkIn l : r.edges()) {
            if (l.source().equals(l.target())) throw new BusinessException(ErrorCode.ERR_VALIDATION, "Không được nối mục tiêu với chính nó");
            if (!nodes.containsKey(l.source()) || !nodes.containsKey(l.target())) throw new BusinessException(ErrorCode.ERR_VALIDATION, "Liên kết tới mục tiêu không có trên bản đồ");
            String key = Math.min(l.source(), l.target()) + "-" + Math.max(l.source(), l.target());
            if (!pairs.add(key)) throw new BusinessException(ErrorCode.ERR_VALIDATION, "Liên kết giữa hai mục tiêu đã tồn tại");
            Map<String, Object> m = new HashMap<>();
            m.put("source", l.source());
            m.put("target", l.target());
            m.put("sourceHandle", Strs.trimToNull(l.sourceHandle()));
            m.put("targetHandle", Strs.trimToNull(l.targetHandle()));
            links.add(m);
        }
        Set<String> kpiPairs = new HashSet<>();
        List<Map<String, Object>> kpis = new ArrayList<>();
        for (KpiIn k : r.kpis()) {
            if (!nodes.containsKey(k.objectiveId())) continue; // mục tiêu bị xóa khỏi bản đồ → bỏ KPI gán (37.3)
            if (kpiPairs.add(k.objectiveId() + "-" + k.kpiId())) kpis.add(Map.of("objectiveId", k.objectiveId(), "kpiId", k.kpiId()));
        }
        if (!kpis.isEmpty()) {
            Set<Long> ids = kpis.stream().map(k -> (Long) k.get("kpiId")).collect(Collectors.toSet());
            if (mapper.existingKpiIds(ids).size() != ids.size()) throw new BusinessException(ErrorCode.ERR_VALIDATION, "Tiêu chí KPI không tồn tại");
        }
        Set<String> before = mapper.kpis(id).stream().map(k -> k.getObjectiveId() + "-" + k.getKpiId()).collect(Collectors.toSet());
        Set<String> after = kpis.stream().map(k -> k.get("objectiveId") + "-" + k.get("kpiId")).collect(Collectors.toSet());
        // KPI gán theo mục tiêu đã bị xóa khỏi bản đồ được loại bỏ tự động; thay đổi khác cần quyền STRATEGY:ASSIGN_KPI
        Set<String> beforeKept = before.stream().filter(k -> nodes.containsKey(Long.valueOf(k.substring(0, k.indexOf('-'))))).collect(Collectors.toSet());
        if (!beforeKept.equals(after) && !canAssignKpi) throw new BusinessException(ErrorCode.ERR_FORBIDDEN, "Bạn không có quyền gán khung KPI vào chiến lược");

        Map<String, Object> snapshotBefore = getMapSnapshot(id);
        Guards.updated(mapper.touch(id, r.version() == null ? s.getVersion() : r.version(), Strs.trimToNull(r.viewport()), CurrentUser.currentUsername()));
        mapper.deleteKpis(id);
        mapper.deleteLinks(id);
        mapper.deleteNodes(id);
        String by = CurrentUser.currentUsername();
        if (!nodes.isEmpty()) {
            List<Map<String, Object>> ns = nodes.values().stream().map(n -> {
                Map<String, Object> m = new HashMap<>();
                m.put("objectiveId", n.objectiveId());
                m.put("posX", n.posX() == null ? 0d : n.posX());
                m.put("posY", n.posY() == null ? 0d : n.posY());
                return m;
            }).toList();
            mapper.insertNodes(id, ns, by);
        }
        if (!links.isEmpty()) mapper.insertLinks(id, links, by);
        if (!kpis.isEmpty()) mapper.insertKpis(id, kpis, by);
        audit.log("CAP_NHAT_BAN_DO", "strategy", id, snapshotBefore, getMapSnapshot(id));
        Map<String, Object> m = getMap(id);
        m.put("message", "Lưu bản đồ chiến lược thành công");
        return m;
    }

    private Map<String, Object> getMapSnapshot(Long id) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("nodes", mapper.nodes(id).stream().map(n -> n.getCode()).toList());
        m.put("edges", mapper.links(id).stream().map(l -> l.getSource() + "->" + l.getTarget()).toList());
        m.put("kpis", mapper.kpis(id).stream().map(k -> k.getObjectiveId() + ":" + k.getKpiCode()).toList());
        return m;
    }

    /** 37.4 KPI của mục tiêu: KH, kết quả, kỳ gần nhất có kết quả của đơn vị chiến lược trong năm */
    public List<ObjectiveKpi> objectiveKpis(Long id, Long objectiveId, Integer year, String period) {
        Strategy s = get(id);
        int y = year != null ? year : s.getYear();
        List<ObjectiveKpi> rows = mapper.objectiveKpis(id, objectiveId, s.getOrgUnitId(), y, Strs.trimToNull(period));
        rows.forEach(r -> r.setPeriodName(Labels.of(Labels.PERIOD, r.getPeriodCode())));
        return rows;
    }

    /** Job “Hoàn tất chiến lược”: giai đoạn đã kết thúc → “Hoàn thành” */
    @Transactional
    public int completeFinished(int currentYear) {
        int n = mapper.completeFinished(currentYear);
        if (n > 0) audit.log(null, "system", "HOAN_TAT_CHIEN_LUOC", "strategy", null, null, Jsons.toJson(Map.of("count", n)));
        return n;
    }
}
