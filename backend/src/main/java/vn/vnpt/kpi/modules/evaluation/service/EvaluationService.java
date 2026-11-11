package vn.vnpt.kpi.modules.evaluation.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.common.Guards;
import vn.vnpt.kpi.common.Labels;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.PageResult;
import vn.vnpt.kpi.common.audit.AuditService;
import vn.vnpt.kpi.common.excel.ExcelParse;
import vn.vnpt.kpi.common.excel.ImportHandler;
import vn.vnpt.kpi.common.excel.ImportRow;
import vn.vnpt.kpi.common.excel.ImportService;
import vn.vnpt.kpi.common.util.Strs;
import vn.vnpt.kpi.modules.evaluation.mapper.EvaluationMapper;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.ComponentValue;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.EvalKpi;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.Result;
import vn.vnpt.kpi.modules.file.service.FileAccessPolicy;
import vn.vnpt.kpi.modules.file.service.FileService;
import vn.vnpt.kpi.modules.notification.mapper.NotificationMapper;
import vn.vnpt.kpi.modules.notification.service.NotificationService;
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
import java.util.stream.Collectors;

/** Đánh giá KPI (39–44, 49.1) và thẩm định/phản hồi (40–42) */
@Service
@RequiredArgsConstructor
public class EvaluationService {
    static final Map<String, String> EK_SORT = Map.of("kpiCode", "k.code", "periodCode", "FIELD(ek.period_code,'Q1','Q2','H1','Q3','Q4','Y')", "status", "ek.status", "year", "ek.year");
    static final Map<String, String> R_SORT = Map.of("orgUnitName", "o.name", "kpiCode", "k.code", "score", "r.score", "status", "r.status", "orgUnitCode", "o.code");

    public record ComponentInput(Long componentId, BigDecimal value, BigDecimal adjustment, BigDecimal proposedValue, BigDecimal proposedAdjustment) {}

    public record RowInput(Long resultId, BigDecimal kpiResult, List<ComponentInput> components, BigDecimal adjustment, String description, BigDecimal manualScore) {}

    public record SaveRows(List<RowInput> rows) {}

    public record AdjustInput(List<ComponentInput> components, String reason) {}

    private final EvaluationMapper mapper;
    private final EvaluationStateMachine sm;
    private final EvaluationCalcService calc;
    private final DataScopeService scopes;
    private final AuditService audit;
    private final ImportService importService;
    private final FileService fileService;
    private final NotificationService notifications;
    private final NotificationMapper notificationMapper;

    // ============================ 39 Tổng hợp BSC theo chỉ tiêu KPI ============================
    public Map<String, Object> filter(String keyword, Integer year, String period, Long perspectiveId, String status, String resultType) {
        Map<String, Object> f = new HashMap<>();
        f.put("keyword", Strs.like(keyword));
        f.put("year", year);
        f.put("period", Strs.trimToNull(period));
        f.put("perspectiveId", perspectiveId);
        f.put("status", Strs.trimToNull(status));
        f.put("resultType", Strs.trimToNull(resultType));
        return f;
    }

    public PageResult<EvalKpi> searchByKpi(Map<String, Object> f, PageQuery q) {
        DataScope scope = scopes.scopeFor(PermissionCodes.EVAL_VIEW);
        q.applySort(EK_SORT, "ek.year DESC, FIELD(ek.period_code,'Q1','Q2','H1','Q3','Q4','Y'), pe.sort_order, k.code");
        return PageResult.of(mapper.searchEvalKpis(f, scope, q), mapper.countEvalKpis(f, scope), q);
    }

    /** Thông tin chung màn hình “Cập nhật kết quả KPI cho tất cả đơn vị” */
    public Map<String, Object> header(Long evalKpiId) {
        EvalKpi ek = Guards.found(mapper.findEvalKpi(evalKpiId), "KPI-kỳ");
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("evalKpi", ek);
        m.put("components", mapper.kpiComponents(ek.getKpiId()));
        boolean locked = EvaluationStateMachine.CHOT_KQ_R2.equals(ek.getStatus()) || EvaluationStateMachine.TGD.equals(mapper.periodClosingStatus(ek.getYear(), ek.getPeriodCode()));
        m.put("locked", locked);
        m.put("statusName", Labels.of(Labels.EVAL_KPI_STATUS, ek.getStatus()));
        return m;
    }

    /** Lưới “Danh sách đơn vị được giao” (tìm theo mã/tên đơn vị, lọc theo “Đánh giá”) */
    public List<Result> results(Long evalKpiId, String keyword, String rating) {
        Map<String, Object> f = new HashMap<>();
        f.put("evalKpiId", evalKpiId);
        f.put("unitKeyword", Strs.like(keyword));
        f.put("rating", Strs.trimToNull(rating));
        PageQuery q = new PageQuery().forExport();
        q.applySort(Map.of(), "o.level, o.sort_order, o.code");
        List<Result> rows = mapper.searchResults(f, scopes.scopeFor(PermissionCodes.EVAL_VIEW), q);
        attachComponents(rows);
        return rows;
    }

    void attachComponents(List<Result> rows) {
        if (rows.isEmpty()) return;
        Map<Long, List<ComponentValue>> comps = new HashMap<>();
        List<Long> ids = rows.stream().map(Result::getId).toList();
        for (int i = 0; i < ids.size(); i += 1000) {
            mapper.findComponentValues(ids.subList(i, Math.min(ids.size(), i + 1000))).forEach(c -> comps.computeIfAbsent(c.getResultId(), k -> new ArrayList<>()).add(c));
        }
        Map<Long, List<ComponentValue>> defs = new HashMap<>();
        for (Result r : rows) {
            List<ComponentValue> def = defs.computeIfAbsent(r.getKpiId(), mapper::kpiComponents);
            Map<Long, ComponentValue> have = comps.getOrDefault(r.getId(), List.of()).stream().collect(Collectors.toMap(ComponentValue::getComponentId, c -> c, (a, b) -> a));
            List<ComponentValue> out = new ArrayList<>();
            for (ComponentValue d : def) {
                ComponentValue c = have.get(d.getComponentId());
                if (c == null) {
                    c = new ComponentValue();
                    c.setResultId(r.getId());
                    c.setComponentId(d.getComponentId());
                    c.setCode(d.getCode());
                    c.setName(d.getName());
                    c.setSource(d.getSource());
                    c.setFormulaCode(d.getFormulaCode());
                }
                out.add(c);
            }
            r.setComponents(out);
        }
    }

    /** 44.1 Lưu kết quả nhập tay của các đơn vị → “Đã có kết quả”; KPI-kỳ → “Đã chấm” */
    @Transactional
    public List<Result> saveResults(Long evalKpiId, SaveRows body) {
        EvalKpi ek = Guards.found(mapper.findEvalKpi(evalKpiId), "KPI-kỳ");
        sm.assertEvalKpiOpen(ek);
        List<RowInput> rows = body.rows() == null ? List.of() : body.rows();
        Map<Long, Result> current = mapper.findResultsOfEvalKpi(evalKpiId).stream().collect(Collectors.toMap(Result::getId, r -> r));
        List<ComponentValue> defs = mapper.kpiComponents(ek.getKpiId());
        DataScope scope = scopes.scopeFor(PermissionCodes.EVAL_INPUT);
        List<Long> touched = new ArrayList<>();
        for (RowInput in : rows) {
            Result r = current.get(in.resultId());
            if (r == null) throw new BusinessException(ErrorCode.ERR_VALIDATION, "Dòng kết quả không thuộc KPI-kỳ");
            if (!scope.contains(r.getOrgUnitId())) throw new BusinessException(ErrorCode.ERR_FORBIDDEN, "Ngoài phạm vi đánh giá: " + r.getOrgUnitName());
            if (!EvaluationStateMachine.EDITABLE.contains(r.getStatus())) {
                throw new BusinessException(ErrorCode.ERR_INVALID_STATE, r.getOrgUnitName() + ": trạng thái “" + Labels.of(Labels.RESULT_STATUS, r.getStatus()) + "” không cho phép nhập kết quả");
            }
            applyComponents(r, defs, in, false);
            mapper.updateInput(r.getId(), in.adjustment(), Strs.trimToNull(in.description()), in.manualScore(), CurrentUser.currentUsername());
            touched.add(r.getId());
        }
        calc.recalc(touched);
        List<Result> fresh = touched.isEmpty() ? List.of() : mapper.findResultsByIds(touched);
        sm.transitionResults(fresh.stream().filter(x -> (x.getFinalResult() != null || x.getScore() != null) && !EvaluationStateMachine.DA_CO_KQ.equals(x.getStatus())
                && !EvaluationStateMachine.DA_XU_LY.equals(x.getStatus())).toList(), EvaluationStateMachine.DA_CO_KQ, "Nhập kết quả");
        if (fresh.stream().anyMatch(x -> x.getFinalResult() != null || x.getScore() != null)) {
            sm.transitionEvalKpi(mapper.findEvalKpi(evalKpiId), EvaluationStateMachine.DA_CHAM, "Nhập kết quả");
        }
        audit.log("NHAP_KET_QUA", "evaluation_kpi", evalKpiId, null, Map.of("rows", touched.size()));
        return results(evalKpiId, null, null);
    }

    private void applyComponents(Result r, List<ComponentValue> defs, RowInput in, boolean apiAllowed) {
        Map<Long, ComponentValue> byId = defs.stream().collect(Collectors.toMap(ComponentValue::getComponentId, c -> c));
        List<ComponentInput> comps = in.components() == null ? new ArrayList<>() : new ArrayList<>(in.components());
        // “Kết quả KPI” trên lưới cho KPI một thành phần nhập tay
        if (in.kpiResult() != null && comps.isEmpty() && defs.size() == 1) comps.add(new ComponentInput(defs.get(0).getComponentId(), in.kpiResult(), null, null, null));
        for (ComponentInput c : comps) {
            ComponentValue d = byId.get(c.componentId());
            if (d == null) throw new BusinessException(ErrorCode.ERR_VALIDATION, "Thành phần không thuộc KPI");
            if ("API".equals(d.getSource()) && !apiAllowed && c.value() != null) continue; // thành phần API chỉ đồng bộ
            mapper.setComponentValue(r.getId(), d.getComponentId(), d.getSource(), c.value(), false, null);
            if (c.adjustment() != null) mapper.setComponentAdjustment(r.getId(), d.getComponentId(), c.adjustment());
        }
    }

    /** calculate-preview (debounce 300ms phía FE) */
    public List<Map<String, Object>> preview(Long evalKpiId, SaveRows body) {
        Guards.found(mapper.findEvalKpi(evalKpiId), "KPI-kỳ");
        List<ComponentValue> defs = mapper.kpiComponents(mapper.findEvalKpi(evalKpiId).getKpiId());
        List<EvaluationCalcService.Override> ov = new ArrayList<>();
        for (RowInput in : body.rows() == null ? List.<RowInput>of() : body.rows()) {
            Map<Long, BigDecimal> vals = new HashMap<>(), adjs = new HashMap<>();
            if (in.components() != null) in.components().forEach(c -> {
                if (c.value() != null) vals.put(c.componentId(), c.value());
                if (c.adjustment() != null) adjs.put(c.componentId(), c.adjustment());
            });
            if (in.kpiResult() != null && defs.size() == 1) vals.put(defs.get(0).getComponentId(), in.kpiResult());
            ov.add(new EvaluationCalcService.Override(in.resultId(), vals, in.adjustment(), in.manualScore(), adjs));
        }
        return calc.preview(ov);
    }

    /** 49.1 Chốt kết quả R2 → không cho đánh giá lại */
    @Transactional
    public EvalKpi closeR2(Long evalKpiId) {
        EvalKpi ek = Guards.found(mapper.findEvalKpi(evalKpiId), "KPI-kỳ");
        if (EvaluationStateMachine.CHOT_KQ_R2.equals(ek.getStatus())) throw new BusinessException(ErrorCode.ERR_INVALID_STATE, "KPI-kỳ đã “Chốt KQ R2”");
        sm.assertPeriodOpen(ek.getYear(), ek.getPeriodCode());
        sm.transitionEvalKpi(ek, EvaluationStateMachine.CHOT_KQ_R2, "Chốt kết quả R2");
        Set<Long> units = mapper.findResultsOfEvalKpi(evalKpiId).stream().map(Result::getOrgUnitId).collect(Collectors.toSet());
        notifications.send(notificationMapper.findUsersWithPermissionInUnits(PermissionCodes.MYKPI_VIEW, units),
                new NotificationService.Message(NotificationService.EV_CHOT_KET_QUA, "Chốt kết quả R2 " + ek.getKpiCode(),
                        "Kết quả KPI " + ek.getKpiCode() + " – " + ek.getKpiName() + " " + Labels.of(Labels.PERIOD, ek.getPeriodCode()) + " " + ek.getYear() + " đã được chốt (R2)",
                        "/my-kpi", Map.of("view", "review", "year", ek.getYear(), "period", ek.getPeriodCode())), NotificationService.Channel.BELL);
        return mapper.findEvalKpi(evalKpiId);
    }

    // ============================ 44.2 Nhập dữ liệu nhập tay từ file ============================
    record ManualRow(Long resultId, BigDecimal value, String note) {}

    final class ManualHandler implements ImportHandler<ManualRow> {
        final Map<String, Result> byCode;

        ManualHandler(List<Result> rows) { byCode = rows.stream().collect(Collectors.toMap(Result::getOrgUnitCode, r -> r, (a, b) -> a)); }

        @Override public String name() { return "Nhập dữ liệu nhập tay"; }
        @Override public String permission() { return PermissionCodes.EVAL_IMPORT; }

        @Override
        public List<Column> columns() {
            return List.of(new Column("unitCode", "Mã đơn vị", true, null, "Không sửa"), new Column("unitName", "Tên đơn vị", false, null, null),
                    new Column("value", "Giá trị", true, null, "Số"), new Column("note", "Ghi chú", false, null, null));
        }

        @Override
        public ManualRow parse(Map<String, String> c, List<String> e) {
            Result r = c.get("unitCode") == null ? null : byCode.get(c.get("unitCode"));
            if (c.get("unitCode") != null && r == null) e.add("Mã đơn vị không thuộc danh sách giao");
            BigDecimal v = ExcelParse.decimal(c.get("value"), "Giá trị", e);
            if (r != null && !EvaluationStateMachine.EDITABLE.contains(r.getStatus())) e.add("Trạng thái không cho phép nhập");
            return new ManualRow(r == null ? null : r.getId(), v, c.get("note"));
        }

        @Override
        public void validateBatch(List<ImportRow<ManualRow>> rows) {
            Set<Long> seen = new HashSet<>();
            for (ImportRow<ManualRow> r : rows) if (r.getRecord() != null && r.getRecord().resultId() != null && !seen.add(r.getRecord().resultId())) r.addError("Trùng đơn vị");
        }

        @Override public void commit(List<ManualRow> valid) { throw new UnsupportedOperationException(); }
    }

    /** “Tải file mẫu”: Mã đơn vị, Tên đơn vị (đổ sẵn các đơn vị được giao), Giá trị, Ghi chú */
    public byte[] manualTemplate(Long evalKpiId, Long componentId) {
        EvalKpi ek = Guards.found(mapper.findEvalKpi(evalKpiId), "KPI-kỳ");
        ComponentValue comp = manualComponent(ek, componentId);
        List<Result> rows = results(evalKpiId, null, null);
        var cols = List.<vn.vnpt.kpi.common.excel.ExcelColumn<Result>>of(
                vn.vnpt.kpi.common.excel.ExcelColumn.of("Mã đơn vị", Result::getOrgUnitCode, 18),
                vn.vnpt.kpi.common.excel.ExcelColumn.of("Tên đơn vị", Result::getOrgUnitName, 45),
                vn.vnpt.kpi.common.excel.ExcelColumn.of("Giá trị", r -> r.getComponents().stream().filter(c -> c.getComponentId().equals(comp.getComponentId()))
                        .findFirst().map(ComponentValue::getValue).orElse(null), 16),
                vn.vnpt.kpi.common.excel.ExcelColumn.of("Ghi chú", r -> null, 30));
        return vn.vnpt.kpi.common.excel.ExcelExporter.export("Du lieu", null, cols, rows);
    }

    /** 44.2 “Xác nhận”: kiểm tra (đơn vị thuộc danh sách giao, giá trị là số, không trùng), cập nhật và tính lại */
    @Transactional
    public Map<String, Object> manualImport(Long evalKpiId, Long componentId, MultipartFile file) {
        EvalKpi ek = Guards.found(mapper.findEvalKpi(evalKpiId), "KPI-kỳ");
        sm.assertEvalKpiOpen(ek);
        ComponentValue comp = manualComponent(ek, componentId);
        List<Result> rows = results(evalKpiId, null, null);
        ManualHandler h = new ManualHandler(rows);
        List<ImportRow<ManualRow>> parsed = importService.parseFile(h, file);
        for (ImportRow<ManualRow> r : parsed) {
            List<String> e = new ArrayList<>();
            if (r.getData().get("unitCode") == null) e.add("Thiếu “Mã đơn vị”");
            if (r.getData().get("value") == null) e.add("Thiếu “Giá trị”");
            ManualRow rec = h.parse(r.getData(), e);
            e.forEach(r::addError);
            r.setRecord(rec);
        }
        h.validateBatch(parsed);
        List<RowInput> inputs = parsed.stream().filter(ImportRow::isValid).map(r -> new RowInput(r.getRecord().resultId(), null,
                List.of(new ComponentInput(comp.getComponentId(), r.getRecord().value(), null, null, null)), currentAdj(rows, r.getRecord().resultId()),
                currentDesc(rows, r.getRecord().resultId()), null)).toList();
        if (!inputs.isEmpty()) saveResults(evalKpiId, new SaveRows(inputs));
        List<Map<String, Object>> errors = parsed.stream().filter(r -> !r.isValid()).map(r -> Map.<String, Object>of("row", r.getRow(), "message", r.getErrorMessage())).toList();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("imported", inputs.size());
        m.put("total", parsed.size());
        m.put("errors", errors);
        m.put("message", "Đã cập nhật " + inputs.size() + "/" + parsed.size() + " đơn vị; " + errors.size() + " dòng lỗi");
        m.put("results", results(evalKpiId, null, null));
        return m;
    }

    private static BigDecimal currentAdj(List<Result> rows, Long id) {
        return rows.stream().filter(r -> r.getId().equals(id)).findFirst().map(Result::getAdjustment).orElse(null);
    }

    private static String currentDesc(List<Result> rows, Long id) {
        return rows.stream().filter(r -> r.getId().equals(id)).findFirst().map(Result::getDescription).orElse(null);
    }

    private ComponentValue manualComponent(EvalKpi ek, Long componentId) {
        return mapper.kpiComponents(ek.getKpiId()).stream().filter(c -> c.getComponentId().equals(componentId) && "NHAP_TAY".equals(c.getSource())).findFirst()
                .orElseThrow(() -> BusinessException.field("componentId", "Vui lòng chọn Thành phần nhập tay"));
    }

    // ============================ 40 Theo dõi kết quả thẩm định và phản hồi ============================
    public Map<String, Object> reviewFilter(String keyword, Integer year, String period, String status, Long unitId) {
        Map<String, Object> f = new HashMap<>();
        f.put("keyword", Strs.like(keyword));
        f.put("year", year);
        f.put("period", Strs.trimToNull(period));
        f.put("status", Strs.trimToNull(status));
        f.put("unitId", unitId);
        if (Strs.isBlank(status)) f.put("statuses", List.of(EvaluationStateMachine.DA_CO_KQ, EvaluationStateMachine.DV_DE_NGHI, EvaluationStateMachine.DA_XU_LY,
                EvaluationStateMachine.CHOT_DANH_GIA, EvaluationStateMachine.BCL, EvaluationStateMachine.TGD));
        return f;
    }

    public PageResult<Result> review(Map<String, Object> f, String perm, PageQuery q) {
        DataScope scope = scopes.scopeFor(perm);
        q.applySort(R_SORT, "ek.year DESC, FIELD(ek.period_code,'Q1','Q2','H1','Q3','Q4','Y') DESC, FIELD(r.status,'DV_DE_NGHI_DIEU_CHINH') DESC, o.code, k.code");
        return PageResult.of(mapper.searchResults(f, scope, q), mapper.countResults(f, scope), q);
    }

    /** 40.3 Chi tiết: kết quả, ý kiến đề xuất (kèm file minh chứng), thông tin điều chỉnh, dòng thời gian */
    public Map<String, Object> resultDetail(Long id, String perm) {
        Result r = Guards.found(mapper.findResult(id), "kết quả đánh giá");
        scopes.assertUnit(perm, r.getOrgUnitId());
        attachComponents(List.of(r));
        EvalKpi ek = mapper.findEvalKpi(r.getEvaluationKpiId());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("result", r);
        m.put("evalKpi", ek);
        m.put("statusName", Labels.of(Labels.RESULT_STATUS, r.getStatus()));
        var requests = mapper.findAdjustmentRequests(id);
        requests.forEach(a -> a.setFiles(mapper.filesOf(FileAccessPolicy.OWNER_ADJUST_REQUEST, a.getId())));
        m.put("requests", requests);
        m.put("feedback", mapper.findFeedback(id));
        m.put("timeline", mapper.findStatusEvents(id));
        boolean hasManual = r.getComponents().stream().anyMatch(c -> "NHAP_TAY".equals(c.getSource()));
        boolean open = !EvaluationStateMachine.CHOT_KQ_R2.equals(ek.getStatus()) && !EvaluationStateMachine.TGD.equals(mapper.periodClosingStatus(ek.getYear(), ek.getPeriodCode()));
        m.put("canAdjust", open && EvaluationStateMachine.DV_DE_NGHI.equals(r.getStatus()));
        m.put("canManual", open && hasManual && EvaluationStateMachine.EDITABLE.contains(r.getStatus()));
        return m;
    }

    /** 41.1 Điều chỉnh kết quả KPI cho đơn vị (từ “ĐV đề nghị điều chỉnh”) → “Đã xử lý điều chỉnh” */
    @Transactional
    public Map<String, Object> adjust(Long id, AdjustInput in, MultipartFile decisionFile) {
        Result r = Guards.found(mapper.findResult(id), "kết quả đánh giá");
        scopes.assertUnit(PermissionCodes.EVAL_ADJUST, r.getOrgUnitId());
        EvalKpi ek = mapper.findEvalKpi(r.getEvaluationKpiId());
        sm.assertEvalKpiOpen(ek);
        sm.assertResult(r, EvaluationStateMachine.DA_XU_LY);
        if (in == null || Strs.isBlank(in.reason())) throw BusinessException.field("reason", "Vui lòng nhập Lý do điều chỉnh");
        List<ComponentValue> defs = mapper.kpiComponents(ek.getKpiId());
        Set<Long> valid = defs.stream().map(ComponentValue::getComponentId).collect(Collectors.toSet());
        for (ComponentInput c : in.components() == null ? List.<ComponentInput>of() : in.components()) {
            if (!valid.contains(c.componentId())) throw new BusinessException(ErrorCode.ERR_VALIDATION, "Thành phần không thuộc KPI");
            mapper.setComponentAdjustment(id, c.componentId(), c.adjustment());
        }
        Long fileId = null;
        if (decisionFile != null && !decisionFile.isEmpty()) fileId = fileService.upload(decisionFile, FileAccessPolicy.OWNER_ADJUST_DECISION, id).getId();
        calc.recalc(List.of(id));
        var req = mapper.findOpenAdjustmentRequest(id);
        if (req != null) mapper.handleAdjustmentRequest(req.getId(), CurrentUser.currentUsername(), CurrentUser.current().getId(), in.reason().trim(), fileId);
        mapper.insertFeedback(id, CurrentUser.current().getId(), in.reason().trim(), "XU_LY_DIEU_CHINH");
        sm.transitionResults(List.of(mapper.findResult(id)), EvaluationStateMachine.DA_XU_LY, in.reason().trim());
        if (!EvaluationStateMachine.CHOT_KQ_R2.equals(ek.getStatus())) sm.transitionEvalKpi(mapper.findEvalKpi(ek.getId()), EvaluationStateMachine.EK_DA_XU_LY, "Xử lý điều chỉnh");
        // notify người gửi đề nghị + user đơn vị
        List<Map<String, Object>> recipients = new ArrayList<>(notificationMapper.findUsersWithPermissionInUnits(PermissionCodes.MYKPI_VIEW, Set.of(r.getOrgUnitId())));
        if (req != null && req.getRequestedById() != null) recipients.addAll(notificationMapper.findUsersByIds(List.of(req.getRequestedById())));
        notifications.send(recipients, new NotificationService.Message(NotificationService.EV_XU_LY_DIEU_CHINH, "Đã xử lý điều chỉnh KPI " + r.getKpiCode(),
                "Kết quả KPI " + r.getKpiCode() + " – " + r.getKpiName() + " (" + Labels.of(Labels.PERIOD, r.getPeriodCode()) + "/" + r.getYear() + ") đã được điều chỉnh. Lý do: " + in.reason().trim(),
                "/my-kpi", Map.of("view", "review", "year", r.getYear(), "period", r.getPeriodCode())), NotificationService.Channel.BELL, NotificationService.Channel.EMAIL);
        audit.log("DIEU_CHINH_KET_QUA", "evaluation_result", id, r, mapper.findResult(id));
        return resultDetail(id, PermissionCodes.EVAL_VIEW);
    }

    /** 42.1 Cập nhật kết quả (SL nhập tay) cho đơn vị: nhập từng thành phần nhập tay → tính lại Kết quả cuối */
    @Transactional
    public Map<String, Object> manual(Long id, AdjustInput in) {
        Result r = Guards.found(mapper.findResult(id), "kết quả đánh giá");
        scopes.assertUnit(PermissionCodes.EVAL_INPUT, r.getOrgUnitId());
        if (in == null || in.components() == null || in.components().isEmpty()) throw new BusinessException(ErrorCode.ERR_VALIDATION, "Vui lòng nhập kết quả thành phần nhập tay");
        saveResults(r.getEvaluationKpiId(), new SaveRows(List.of(new RowInput(id, null, in.components(), r.getAdjustment(), r.getDescription(), r.getManualScore()))));
        return resultDetail(id, PermissionCodes.EVAL_VIEW);
    }
}
