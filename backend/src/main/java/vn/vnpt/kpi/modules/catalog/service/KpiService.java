package vn.vnpt.kpi.modules.catalog.service;

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
import vn.vnpt.kpi.common.excel.ExcelColumn;
import vn.vnpt.kpi.common.excel.ExcelExporter;
import vn.vnpt.kpi.common.util.Strs;
import vn.vnpt.kpi.engine.FormulaEvaluator;
import vn.vnpt.kpi.modules.catalog.dto.KpiRequest;
import vn.vnpt.kpi.modules.catalog.mapper.CatalogMapper;
import vn.vnpt.kpi.modules.catalog.mapper.FormulaMapper;
import vn.vnpt.kpi.modules.catalog.mapper.KpiMapper;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.Objective;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.Perspective;
import vn.vnpt.kpi.modules.catalog.model.Kpi;
import vn.vnpt.kpi.security.CurrentUser;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Danh mục chỉ tiêu KPI (23.1–23.7), thêm mới KPI đơn lẻ (24.1) / cha – con (25.1) */
@Service
@RequiredArgsConstructor
public class KpiService {
    static final Map<String, String> SORT = Map.of("code", "k.code", "name", "k.name", "perspectiveName", "pe.sort_order",
            "unitOfMeasureName", "uom.name", "objectiveName", "ob.code", "assigningUnitName", "au.name");

    private final KpiMapper mapper;
    private final CatalogMapper catalogMapper;
    private final FormulaMapper formulaMapper;
    private final AuditService audit;

    public static Map<String, Object> filter(String keyword, Long perspectiveId, Long objectiveId) {
        Map<String, Object> f = new HashMap<>();
        f.put("keyword", Strs.like(keyword));
        f.put("perspectiveId", perspectiveId);
        f.put("objectiveId", objectiveId);
        return f;
    }

    /** 23.1/23.2: phân trang KPI gốc; KPI con hiển thị dạng cây (khớp KPI con → hiện cả nhánh cha) */
    public PageResult<Kpi> tree(Map<String, Object> f, PageQuery q) {
        q.applySort(SORT, "pe.sort_order, k.sort_order, k.code");
        List<Kpi> roots = mapper.searchRoots(f, q);
        long total = mapper.countRoots(f);
        attachChildren(roots, f);
        return PageResult.of(roots, total, q);
    }

    void attachChildren(List<Kpi> roots, Map<String, Object> f) {
        if (roots.isEmpty()) return;
        Map<Long, Kpi> byId = roots.stream().collect(Collectors.toMap(Kpi::getId, Function.identity()));
        for (Kpi c : mapper.findChildrenOf(byId.keySet(), f)) {
            Kpi p = byId.get(c.getParentId());
            if (p == null) continue;
            if (Boolean.TRUE.equals(p.getMatched()) || Boolean.TRUE.equals(c.getMatched())) p.getChildren().add(c);
        }
    }

    public List<Kpi> options(String keyword, Long perspectiveId, Long objectiveId, boolean rootOnly, Long excludeId) {
        Map<String, Object> f = filter(keyword, perspectiveId, objectiveId);
        if (rootOnly) f.put("rootOnly", true);
        f.put("excludeId", excludeId);
        return mapper.options(f, 500);
    }

    /** 23.3: toàn bộ trường + KPI con + thành phần */
    public Kpi get(Long id) {
        Kpi k = Guards.found(mapper.findById(id), "tiêu chí KPI");
        k.setComponents(mapper.findComponents(id));
        if (k.getParentId() == null) {
            List<Kpi> kids = mapper.findChildrenOf(List.of(id), new HashMap<>());
            if (!kids.isEmpty()) {
                Map<Long, List<Kpi.KpiComponent>> comps = mapper.findComponentsOf(kids.stream().map(Kpi::getId).toList()).stream()
                        .collect(Collectors.groupingBy(Kpi.KpiComponent::getKpiId));
                kids.forEach(c -> c.setComponents(comps.getOrDefault(c.getId(), new ArrayList<>())));
            }
            k.setChildren(kids);
        }
        return k;
    }

    /** “Mã tiêu chí”: <Mã viễn cảnh>-<NNN> (xem trước, không giữ số) */
    public String nextCode(Long perspectiveId) {
        Perspective p = Guards.found(catalogMapper.findPerspective(perspectiveId), "viễn cảnh");
        Integer max = mapper.maxRootNumber(p.getCode());
        return String.format("%s-%03d", p.getCode(), (max == null ? 0 : max) + 1);
    }

    /** Chốt số khi lưu: khóa sequence theo viễn cảnh (SELECT … FOR UPDATE) để chống trùng */
    String reserveCode(Perspective p) {
        Integer last = mapper.lockSequence(p.getId());
        Integer max = mapper.maxRootNumber(p.getCode());
        int next = Math.max(last == null ? 0 : last, max == null ? 0 : max) + 1;
        if (last == null) mapper.insertSequence(p.getId(), next);
        else mapper.updateSequence(p.getId(), next);
        return String.format("%s-%03d", p.getCode(), next);
    }

    /** 24.1 / 25.1 — KPI cha và các KPI con lưu trong một transaction */
    @Transactional
    public Kpi create(KpiRequest r) {
        Perspective p = validateCommon(r, null, "");
        if ("CHA_CON".equals(r.structure()) && (r.children() == null || r.children().isEmpty())) {
            throw BusinessException.field("children", "Vui lòng thêm ít nhất một KPI con");
        }
        Kpi k = toEntity(r);
        k.setCode(reserveCode(p));
        k.setCreatedBy(CurrentUser.currentUsername());
        mapper.insert(k);
        saveComponents(k.getId(), r, k.getName());
        saveOfficers(k);
        if ("CHA_CON".equals(r.structure())) {
            int i = 0;
            for (KpiRequest c : r.children()) createChild(k, c, ++i);
        }
        Kpi saved = get(k.getId());
        audit.log("THEM", "kpi", k.getId(), null, saved);
        return saved;
    }

    private void createChild(Kpi parent, KpiRequest c, int index) {
        validateCommon(c, parent, "children[" + (index - 1) + "].");
        if (!Objects.equals(c.perspectiveId(), parent.getPerspectiveId())) {
            throw BusinessException.field("children[" + (index - 1) + "].perspectiveId", "KPI con phải cùng viễn cảnh với KPI cha");
        }
        Kpi k = toEntity(c);
        k.setStructure("DON_LE");
        k.setParentId(parent.getId());
        Integer max = mapper.maxChildNumber(parent.getCode());
        k.setCode(String.format("%s.%02d", parent.getCode(), (max == null ? 0 : max) + 1));
        k.setSortOrder(c.sortOrder() == null ? index : c.sortOrder());
        k.setCreatedBy(CurrentUser.currentUsername());
        mapper.insert(k);
        saveComponents(k.getId(), c, k.getName());
        saveOfficers(k);
    }

    /** 23.4: không đổi Cấu trúc tiêu chí / Viễn cảnh nếu KPI đã được giao; mã không đổi */
    @Transactional
    public Kpi update(Long id, KpiRequest r) {
        Kpi before = get(id);
        boolean assigned = mapper.countAssigned(id) > 0;
        if (assigned && !before.getStructure().equals(r.structure()) && before.getParentId() == null) {
            throw BusinessException.field("structure", "Không được đổi Cấu trúc tiêu chí vì KPI đã được giao");
        }
        if (assigned && !before.getPerspectiveId().equals(r.perspectiveId())) {
            throw BusinessException.field("perspectiveId", "Không được đổi Viễn cảnh vì KPI đã được giao");
        }
        if (!before.getPerspectiveId().equals(r.perspectiveId()) && before.getParentId() == null) {
            throw BusinessException.field("perspectiveId", "Không được đổi Viễn cảnh vì mã tiêu chí đã sinh theo viễn cảnh");
        }
        validateCommon(r, null, "");
        Kpi k = toEntity(r);
        k.setId(id);
        k.setParentId(before.getParentId());
        if (before.getParentId() != null) k.setStructure("DON_LE");
        k.setVersion(r.version() == null ? before.getVersion() : r.version());
        Guards.updated(mapper.update(k));
        saveComponents(id, r, k.getName());
        saveOfficers(mapper.findById(id));
        if (before.getParentId() == null) syncChildren(before, r);
        Kpi after = get(id);
        audit.log("SUA", "kpi", id, before, after);
        return after;
    }

    private void syncChildren(Kpi parent, KpiRequest r) {
        List<KpiRequest> wanted = "CHA_CON".equals(r.structure()) && r.children() != null ? r.children() : List.of();
        if ("CHA_CON".equals(r.structure()) && wanted.isEmpty()) throw BusinessException.field("children", "Vui lòng thêm ít nhất một KPI con");
        Set<Long> keep = wanted.stream().map(KpiRequest::id).filter(Objects::nonNull).collect(Collectors.toSet());
        for (Kpi existing : parent.getChildren()) {
            if (!keep.contains(existing.getId())) {
                if (mapper.countAssigned(existing.getId()) > 0 || mapper.countInStrategy(existing.getId()) > 0) {
                    throw new BusinessException(ErrorCode.ERR_IN_USE, "Không thể xóa KPI con " + existing.getCode() + " vì đã được giao hoặc gắn vào chiến lược");
                }
                mapper.softDelete(existing.getId(), CurrentUser.currentUsername());
            }
        }
        Map<Long, Kpi> byId = parent.getChildren().stream().collect(Collectors.toMap(Kpi::getId, Function.identity()));
        Kpi freshParent = mapper.findById(parent.getId());
        int i = 0;
        for (KpiRequest c : wanted) {
            i++;
            if (c.id() != null && byId.containsKey(c.id())) {
                validateCommon(c, freshParent, "children[" + (i - 1) + "].");
                Kpi old = byId.get(c.id());
                Kpi k = toEntity(c);
                k.setId(c.id());
                k.setParentId(parent.getId());
                k.setStructure("DON_LE");
                k.setPerspectiveId(freshParent.getPerspectiveId());
                k.setSortOrder(c.sortOrder() == null ? i : c.sortOrder());
                k.setVersion(c.version() == null ? old.getVersion() : c.version());
                Guards.updated(mapper.update(k));
                saveComponents(c.id(), c, k.getName());
                saveOfficers(mapper.findById(c.id()));
            } else {
                createChild(freshParent, c, i);
            }
        }
    }

    /** 23.5: chặn nếu đã giao hoặc gắn chiến lược; KPI cha có con → cần xác nhận (withChildren) */
    @Transactional
    public void delete(Long id, boolean withChildren) {
        Kpi k = get(id);
        List<String> where = new ArrayList<>();
        long a = mapper.countAssigned(id), s = mapper.countInStrategy(id);
        if (a > 0) where.add("giao KPI (" + a + ")");
        if (s > 0) where.add("khung KPI của chiến lược (" + s + ")");
        if (!where.isEmpty()) throw BusinessException.inUse(String.join(", ", where));
        if (!k.getChildren().isEmpty() && !withChildren) {
            throw new BusinessException(ErrorCode.ERR_INVALID_STATE,
                    "KPI cha có " + k.getChildren().size() + " KPI con, xóa KPI cha sẽ xóa cả KPI con. Tiếp tục?",
                    Map.of("confirmRequired", true, "childCount", k.getChildren().size()));
        }
        for (Kpi c : k.getChildren()) mapper.softDelete(c.getId(), CurrentUser.currentUsername());
        mapper.softDelete(id, CurrentUser.currentUsername());
        audit.log("XOA", "kpi", id, k, null);
    }

    // -------------------------------------------------------------------------------------------------
    Perspective validateCommon(KpiRequest r, Kpi parent, String prefix) {
        List<ApiResponse.FieldError> errs = new ArrayList<>();
        Perspective p = catalogMapper.findPerspective(r.perspectiveId());
        if (p == null) errs.add(new ApiResponse.FieldError(prefix + "perspectiveId", "Viễn cảnh không tồn tại"));
        Objective o = catalogMapper.findObjective(r.objectiveId());
        if (o == null) errs.add(new ApiResponse.FieldError(prefix + "objectiveId", "Mục tiêu trọng tâm không tồn tại"));
        else if (p != null && !o.getPerspectiveId().equals(p.getId())) {
            errs.add(new ApiResponse.FieldError(prefix + "objectiveId", "Mục tiêu trọng tâm phải thuộc viễn cảnh đã chọn"));
        }
        if (catalogMapper.findScoringMethod(r.scoringMethodId()) == null) errs.add(new ApiResponse.FieldError(prefix + "scoringMethodId", "Phương pháp tính điểm không tồn tại"));
        if (catalogMapper.findUom(r.unitOfMeasureId()) == null) errs.add(new ApiResponse.FieldError(prefix + "unitOfMeasureId", "Đơn vị đo không tồn tại"));
        if ("CONG_THUC".equals(r.groupAggregation())) {
            if (Strs.isBlank(r.groupExpression())) errs.add(new ApiResponse.FieldError(prefix + "groupExpression", "Vui lòng nhập biểu thức cách tính kết quả KPI Tập đoàn"));
            else {
                var v = FormulaEvaluator.validate(r.groupExpression(), null);
                if (!v.valid()) errs.add(new ApiResponse.FieldError(prefix + "groupExpression", String.join("; ", v.errors())));
            }
        }
        if ("TUY_CHINH".equals(r.completionFormula())) {
            if (Strs.isBlank(r.completionExpression())) errs.add(new ApiResponse.FieldError(prefix + "completionExpression", "Vui lòng nhập biểu thức công thức tỷ lệ hoàn thành"));
            else {
                var v = FormulaEvaluator.validate(r.completionExpression(), Set.of("TH", "KH", "KH_NAM"));
                if (!v.valid()) errs.add(new ApiResponse.FieldError(prefix + "completionExpression", String.join("; ", v.errors())));
            }
        }
        List<KpiRequest.ComponentRequest> comps = r.components() == null ? List.of() : r.components();
        Set<String> codes = new HashSet<>();
        for (int i = 0; i < comps.size(); i++) {
            var c = comps.get(i);
            if (!codes.add(c.code().toUpperCase())) errs.add(new ApiResponse.FieldError(prefix + "components[" + i + "].code", "Trùng mã biến " + c.code()));
            if (c.formulaDefinitionId() != null && formulaMapper.findById(c.formulaDefinitionId()) == null) {
                errs.add(new ApiResponse.FieldError(prefix + "components[" + i + "].formulaDefinitionId", "Định nghĩa KPI công thức không tồn tại"));
            }
            if ("API".equals(c.source()) && c.formulaDefinitionId() == null) {
                errs.add(new ApiResponse.FieldError(prefix + "components[" + i + "].formulaDefinitionId", "Thành phần nguồn API phải chọn Định nghĩa KPI công thức"));
            }
        }
        if (!Strs.isBlank(r.resultExpression())) {
            var v = FormulaEvaluator.validate(r.resultExpression(), codes.isEmpty() ? Set.of() : comps.stream().map(KpiRequest.ComponentRequest::code).collect(Collectors.toSet()));
            if (!v.valid()) errs.add(new ApiResponse.FieldError(prefix + "resultExpression", String.join("; ", v.errors())));
        } else if (comps.size() > 1) {
            errs.add(new ApiResponse.FieldError(prefix + "resultExpression", "Vui lòng nhập Biểu thức kết quả khi có nhiều thành phần"));
        }
        if (!errs.isEmpty()) throw new BusinessException(ErrorCode.ERR_VALIDATION, errs.get(0).message(), null, errs);
        return p;
    }

    private void saveComponents(Long kpiId, KpiRequest r, String kpiName) {
        List<KpiRequest.ComponentRequest> comps = r.components() == null || r.components().isEmpty()
                ? List.of(new KpiRequest.ComponentRequest(null, "A", kpiName, null, "NHAP_TAY"))
                : r.components();
        List<Kpi.KpiComponent> existing = mapper.findComponents(kpiId);
        Map<Long, Kpi.KpiComponent> byId = existing.stream().collect(Collectors.toMap(Kpi.KpiComponent::getId, Function.identity()));
        Map<String, Kpi.KpiComponent> byCode = existing.stream().collect(Collectors.toMap(c -> c.getCode().toUpperCase(), Function.identity(), (a, b) -> a));
        Set<Long> kept = new HashSet<>();
        int i = 0;
        for (KpiRequest.ComponentRequest c : comps) {
            Kpi.KpiComponent e = c.id() != null ? byId.get(c.id()) : byCode.get(c.code().toUpperCase());
            Kpi.KpiComponent x = new Kpi.KpiComponent();
            x.setKpiId(kpiId);
            x.setCode(c.code().trim());
            x.setName(c.name().trim());
            x.setFormulaDefinitionId(c.formulaDefinitionId());
            x.setSource(c.source());
            x.setSortOrder(++i);
            if (e != null) {
                x.setId(e.getId());
                mapper.updateComponent(x);
                kept.add(e.getId());
            } else {
                mapper.insertComponent(x);
            }
        }
        for (Kpi.KpiComponent e : existing) {
            if (kept.contains(e.getId())) continue;
            if (mapper.countComponentValues(e.getId()) > 0) {
                throw new BusinessException(ErrorCode.ERR_IN_USE, "Không thể xóa thành phần " + e.getCode() + " vì đã có kết quả đánh giá");
            }
            mapper.deleteComponent(e.getId());
        }
    }

    private void saveOfficers(Kpi k) {
        mapper.deleteOfficerMap(k.getId());
        String by = CurrentUser.currentUsername();
        mapper.insertOfficerMap(k.getId(), k.getAssigningUnitId(), k.getAssigningOfficerId(), "GIAO", by);
        mapper.insertOfficerMap(k.getId(), k.getEvaluatingUnitId(), k.getEvaluatingOfficerId(), "DANH_GIA", by);
    }

    private static Kpi toEntity(KpiRequest r) {
        Kpi k = new Kpi();
        k.setName(r.name().trim());
        k.setStructure(r.structure());
        k.setGroupAggregation(r.groupAggregation());
        k.setGroupExpression("CONG_THUC".equals(r.groupAggregation()) ? Strs.trimToNull(r.groupExpression()) : null);
        k.setPerspectiveId(r.perspectiveId());
        k.setGroupKpiId(r.groupKpiId());
        k.setTargetDataType(r.targetDataType());
        k.setCompletionFormula(r.completionFormula() == null ? "THUAN" : r.completionFormula());
        k.setCompletionExpression("TUY_CHINH".equals(r.completionFormula()) ? Strs.trimToNull(r.completionExpression()) : null);
        k.setScoringMethodId(r.scoringMethodId());
        k.setScoreByResult(r.scoreByResult() == null || r.scoreByResult());
        k.setObjectiveId(r.objectiveId());
        k.setWeight(r.weight());
        k.setUnitOfMeasureId(r.unitOfMeasureId());
        k.setAssigningUnitId(r.assigningUnitId());
        k.setAssigningOfficerId(r.assigningOfficerId());
        k.setEvaluatingUnitId(r.evaluatingUnitId());
        k.setEvaluatingOfficerId(r.evaluatingOfficerId());
        k.setDataSource(r.dataSource() == null ? "NHAP_TAY" : r.dataSource());
        List<KpiRequest.ComponentRequest> comps = r.components();
        String expr = Strs.trimToNull(r.resultExpression());
        if (expr == null) expr = comps == null || comps.isEmpty() ? "A" : comps.get(0).code();
        k.setResultExpression(expr);
        k.setIsFocus(Boolean.TRUE.equals(r.isFocus()));
        k.setSortOrder(r.sortOrder() == null ? 0 : r.sortOrder());
        k.setUpdatedBy(CurrentUser.currentUsername());
        return k;
    }

    // ------------------------------------------- Xuất (23.7) -------------------------------------------
    public byte[] export(Map<String, Object> f, PageQuery q) {
        List<Kpi> roots = tree(f, q.forExport()).items();
        List<Kpi> flat = new ArrayList<>();
        for (Kpi r : roots) {
            flat.add(r);
            flat.addAll(r.getChildren());
        }
        List<ExcelColumn<Kpi>> cols = new ArrayList<>(List.of(
                ExcelColumn.of("Mã tiêu chí", Kpi::getCode),
                ExcelColumn.of("Tên tiêu chí", Kpi::getName, 50),
                ExcelColumn.of("Cấu trúc tiêu chí", k -> k.getParentId() != null ? "KPI con" : Labels.of(Labels.STRUCTURE, k.getStructure())),
                ExcelColumn.of("Mã KPI cha", Kpi::getParentCode),
                ExcelColumn.of("Viễn cảnh", Kpi::getPerspectiveName),
                ExcelColumn.of("Mục tiêu trọng tâm", k -> k.getObjectiveCode() + " – " + k.getObjectiveName(), 40),
                ExcelColumn.of("Đơn vị đo", Kpi::getUnitOfMeasureName),
                ExcelColumn.of("Cách tính kết quả KPI Tập đoàn", k -> Labels.of(Labels.GROUP_AGG, k.getGroupAggregation())),
                ExcelColumn.of("Link với KPI tập đoàn", Kpi::getGroupKpiCode),
                ExcelColumn.of("Loại số liệu giao", k -> Labels.of(Labels.TARGET_DATA_TYPE, k.getTargetDataType())),
                ExcelColumn.of("Công thức tỷ lệ hoàn thành chỉ tiêu", k -> Labels.of(Labels.COMPLETION, k.getCompletionFormula())),
                ExcelColumn.of("Phương pháp tính điểm", Kpi::getScoringMethodName, 30),
                ExcelColumn.of("Tính điểm theo kết quả thực hiện", Kpi::getScoreByResult),
                ExcelColumn.of("Tỷ trọng", Kpi::getWeight),
                ExcelColumn.of("Đơn vị giao", Kpi::getAssigningUnitName, 30),
                ExcelColumn.of("Cán bộ giao", Kpi::getAssigningOfficerName),
                ExcelColumn.of("Đơn vị đánh giá", Kpi::getEvaluatingUnitName, 30),
                ExcelColumn.of("Cán bộ đánh giá", Kpi::getEvaluatingOfficerName),
                ExcelColumn.of("Nguồn dữ liệu", k -> Labels.of(Labels.DATA_SOURCE, k.getDataSource())),
                ExcelColumn.of("Thuộc vùng chỉ đạo trọng tâm", Kpi::getIsFocus),
                ExcelColumn.of("Biểu thức kết quả", Kpi::getResultExpression)));
        return ExcelExporter.export("Danh sach KPI", "DANH SÁCH KPI", cols, flat);
    }

    public Map<String, Object> components(Long kpiId) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("components", mapper.findComponents(kpiId));
        return m;
    }
}
