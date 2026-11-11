package vn.vnpt.kpi.modules.mykpi.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.common.Guards;
import vn.vnpt.kpi.common.Labels;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.audit.AuditService;
import vn.vnpt.kpi.common.util.Strs;
import vn.vnpt.kpi.engine.KpiCalculationEngine;
import vn.vnpt.kpi.modules.evaluation.mapper.EvaluationMapper;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.AdjustmentRequest;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.ComponentValue;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.EvalKpi;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.Result;
import vn.vnpt.kpi.modules.evaluation.service.EvaluationService;
import vn.vnpt.kpi.modules.evaluation.service.EvaluationStateMachine;
import vn.vnpt.kpi.modules.file.service.FileAccessPolicy;
import vn.vnpt.kpi.modules.file.service.FileService;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** “KPI đơn vị của tôi” (18.1–22.1) */
@Service
@RequiredArgsConstructor
public class MyKpiService {
    static final List<String> PERIODS = List.of("Q1", "Q2", "H1", "Q3", "Q4", "Y");

    public record ProposalInput(List<EvaluationService.ComponentInput> components, String note) {}

    private final EvaluationMapper mapper;
    private final EvaluationService evaluation;
    private final EvaluationStateMachine sm;
    private final DataScopeService scopes;
    private final OrgUnitMapper orgMapper;
    private final FileService fileService;
    private final NotificationService notifications;
    private final NotificationMapper notificationMapper;
    private final AuditService audit;

    /** Đơn vị trong phạm vi “KPI đơn vị của tôi” — mặc định đơn vị của người dùng */
    public Map<String, Object> units() {
        CurrentUser u = CurrentUser.current();
        DataScope scope = scopes.scopeFor(PermissionCodes.MYKPI_VIEW);
        List<OrgUnit> list = orgMapper.findAllActive(scope, true);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("defaultUnitId", scope.contains(u.getOrgUnitId()) ? u.getOrgUnitId() : list.isEmpty() ? null : list.get(0).getId());
        m.put("units", list.stream().map(o -> Map.of("id", o.getId(), "code", o.getCode(), "name", o.getName(), "parentId", o.getParentId() == null ? 0L : o.getParentId())).toList());
        m.put("multiple", list.size() > 1);
        return m;
    }

    private Long unit(Long unitId) {
        Long id = unitId != null ? unitId : CurrentUser.current().getOrgUnitId();
        scopes.assertUnit(PermissionCodes.MYKPI_VIEW, id);
        return id;
    }

    private List<Result> rows(Long unitId, int year, String period, Long kpiId) {
        Map<String, Object> f = new HashMap<>();
        f.put("unitId", unitId);
        f.put("year", year);
        f.put("period", period);
        f.put("kpiId", kpiId);
        PageQuery q = new PageQuery().forExport();
        q.applySort(Map.of(), "pe.sort_order, COALESCE((SELECT pk.code FROM kpi pk WHERE pk.id = k.parent_id), k.code), k.parent_id IS NOT NULL, k.code");
        return mapper.searchResults(f, DataScope.ALL, q);
    }

    /** 18.1 Theo kỳ đánh giá: cây KPI cha – con, dòng cuối “Điểm BSC đơn vị” */
    public Map<String, Object> byPeriod(Long unitId, int year, String period) {
        Long u = unit(unitId);
        List<Result> all = rows(u, year, period, null);
        Map<Long, Result> byKpi = all.stream().collect(Collectors.toMap(Result::getKpiId, r -> r, (a, b) -> a));
        List<Result> roots = new ArrayList<>();
        for (Result r : all) {
            if (r.getParentKpiId() != null && byKpi.containsKey(r.getParentKpiId())) byKpi.get(r.getParentKpiId()).getChildren().add(r);
            else roots.add(r);
        }
        BigDecimal bsc = KpiCalculationEngine.bscUnit(roots.stream().map(r -> new KpiCalculationEngine.WeightedScore(r.getScore(), r.getWeight())).toList());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("rows", roots);
        m.put("bscScore", bsc);
        m.put("totalWeight", roots.stream().map(r -> r.getWeight() == null ? BigDecimal.ZERO : r.getWeight()).reduce(BigDecimal.ZERO, BigDecimal::add));
        return m;
    }

    public List<Map<String, Object>> kpiOptions(Long unitId, int year) {
        Long u = unit(unitId);
        Map<Long, Map<String, Object>> out = new LinkedHashMap<>();
        for (Result r : rows(u, year, "Y", null)) {
            out.putIfAbsent(r.getKpiId(), Map.of("id", r.getKpiId(), "code", r.getKpiCode(), "name", r.getKpiName()));
        }
        return new ArrayList<>(out.values());
    }

    /** 19.1 Theo chỉ tiêu KPI: các cột kỳ × dòng (KH giao, Kết quả thực hiện, % TH/KH, Điểm) */
    public Map<String, Object> byKpi(Long unitId, int year, Long kpiId) {
        Long u = unit(unitId);
        Map<String, Result> byPeriod = rows(u, year, null, kpiId).stream().collect(Collectors.toMap(Result::getPeriodCode, r -> r, (a, b) -> a));
        List<Map<String, Object>> cols = new ArrayList<>();
        for (String p : PERIODS) {
            Result r = byPeriod.get(p);
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("period", p);
            c.put("periodName", Labels.of(Labels.PERIOD, p));
            c.put("plan", r == null ? null : r.getPlanValue());
            c.put("result", r == null ? null : r.getFinalResult());
            c.put("rate", r == null ? null : r.getCompletionRate());
            c.put("score", r == null ? null : r.getScore());
            c.put("status", r == null ? null : r.getStatus());
            cols.add(c);
        }
        Result any = byPeriod.values().stream().findFirst().orElse(null);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("kpi", any == null ? null : Map.of("id", any.getKpiId(), "code", any.getKpiCode(), "name", any.getKpiName(), "unitOfMeasureName", any.getUnitOfMeasureName()));
        m.put("periods", cols);
        return m;
    }

    /** 20.1 Theo dõi kết quả thẩm định và phản hồi */
    public List<Map<String, Object>> review(Long unitId, int year, String period) {
        Long u = unit(unitId);
        List<Map<String, Object>> out = new ArrayList<>();
        Map<Long, EvalKpi> eks = new HashMap<>();
        for (Result r : rows(u, year, period, null)) {
            EvalKpi ek = eks.computeIfAbsent(r.getEvaluationKpiId(), mapper::findEvalKpi);
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("result", r);
            m.put("statusName", Labels.of(Labels.RESULT_STATUS, r.getStatus()));
            m.put("canPropose", canPropose(r, ek));
            out.add(m);
        }
        return out;
    }

    boolean canPropose(Result r, EvalKpi ek) {
        boolean statusOk = EvaluationStateMachine.DA_CO_KQ.equals(r.getStatus()) || EvaluationStateMachine.DA_XU_LY.equals(r.getStatus());
        boolean periodOpen = mapper.periodClosingStatus(ek.getYear(), ek.getPeriodCode()) == null;
        return statusOk && periodOpen && !EvaluationStateMachine.CHOT_KQ_R2.equals(ek.getStatus());
    }

    public Map<String, Object> resultDetail(Long id) {
        Map<String, Object> m = evaluation.resultDetail(id, PermissionCodes.MYKPI_VIEW);
        Result r = (Result) m.get("result");
        m.put("canPropose", canPropose(r, (EvalKpi) m.get("evalKpi")));
        return m;
    }

    /** 21.1 Đề nghị điều chỉnh kết quả KPI → “ĐV đề nghị điều chỉnh”; notify cán bộ đánh giá + vai trò thẩm định */
    @Transactional
    public Map<String, Object> propose(Long id, ProposalInput in, List<MultipartFile> files) {
        Result r = Guards.found(mapper.findResult(id), "kết quả đánh giá");
        scopes.assertUnit(PermissionCodes.MYKPI_PROPOSE_ADJUST, r.getOrgUnitId());
        EvalKpi ek = mapper.findEvalKpi(r.getEvaluationKpiId());
        if (!canPropose(r, ek)) throw new BusinessException(ErrorCode.ERR_INVALID_STATE, "Chỉ đề nghị điều chỉnh với KPI chưa chốt kết quả (Đã có kết quả / Đã xử lý điều chỉnh)");
        if (in == null || Strs.isBlank(in.note())) throw BusinessException.field("note", "Vui lòng nhập Ý kiến đề xuất");
        Set<Long> valid = mapper.kpiComponents(ek.getKpiId()).stream().map(ComponentValue::getComponentId).collect(Collectors.toSet());
        for (var c : in.components() == null ? List.<EvaluationService.ComponentInput>of() : in.components()) {
            if (!valid.contains(c.componentId())) throw new BusinessException(ErrorCode.ERR_VALIDATION, "Thành phần không thuộc KPI");
            mapper.setComponentProposal(id, c.componentId(), c.proposedValue(), c.proposedAdjustment());
        }
        AdjustmentRequest a = new AdjustmentRequest();
        a.setResultId(id);
        a.setProposalNote(in.note().trim());
        a.setRequestedById(CurrentUser.current().getId());
        a.setCreatedBy(CurrentUser.currentUsername());
        mapper.insertAdjustmentRequest(a);
        for (MultipartFile f : files == null ? List.<MultipartFile>of() : files) {
            if (f != null && !f.isEmpty()) fileService.upload(f, FileAccessPolicy.OWNER_ADJUST_REQUEST, a.getId());
        }
        mapper.insertFeedback(id, CurrentUser.current().getId(), in.note().trim(), "DE_NGHI");
        sm.transitionResults(List.of(r), EvaluationStateMachine.DV_DE_NGHI, in.note().trim());
        List<Map<String, Object>> recipients = new ArrayList<>(notificationMapper.findUsersWithRole("QT_TH_THAM_DINH"));
        recipients.addAll(notificationMapper.findUsersByIds(List.of(evaluatingOfficer(ek))));
        notifications.send(recipients, new NotificationService.Message(NotificationService.EV_DE_NGHI_DIEU_CHINH,
                "Đề nghị điều chỉnh KPI " + r.getKpiCode() + " – " + r.getOrgUnitName(),
                r.getOrgUnitName() + " đề nghị điều chỉnh kết quả KPI " + r.getKpiCode() + " (" + Labels.of(Labels.PERIOD, r.getPeriodCode()) + "/" + r.getYear() + "): " + in.note().trim(),
                "/kpi-admin/evaluations", Map.of("tab", "review", "resultId", id)), NotificationService.Channel.BELL, NotificationService.Channel.EMAIL);
        audit.log("DE_NGHI_DIEU_CHINH", "evaluation_result", id, null, Map.of("note", in.note().trim(), "files", files == null ? 0 : files.size()));
        return resultDetail(id);
    }

    private Long evaluatingOfficer(EvalKpi ek) {
        return ek.getEvaluatingOfficerId();
    }

    public List<Result> exportRows(Long unitId, int year, String period) {
        return rows(unit(unitId), year, period, null);
    }
}
