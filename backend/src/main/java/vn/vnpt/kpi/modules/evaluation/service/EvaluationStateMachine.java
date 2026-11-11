package vn.vnpt.kpi.modules.evaluation.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.common.Labels;
import vn.vnpt.kpi.common.audit.AuditService;
import vn.vnpt.kpi.modules.evaluation.mapper.EvaluationMapper;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.EvalKpi;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.Result;
import vn.vnpt.kpi.security.CurrentUser;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Mọi chuyển trạng thái đánh giá đi qua đây (PHẦN C §VII): chặn nếu không hợp lệ, ghi dòng thời gian và audit.
 */
@Service
@RequiredArgsConstructor
public class EvaluationStateMachine {
    // ---- Trạng thái kết quả theo đơn vị ----
    public static final String CHUA_CO_KQ = "CHUA_CO_KQ", DA_CO_KQ = "DA_CO_KQ", DV_DE_NGHI = "DV_DE_NGHI_DIEU_CHINH",
            DA_XU_LY = "DA_XU_LY_DIEU_CHINH", CHOT_DANH_GIA = "CHOT_DANH_GIA", BCL = "BCL_YEU_CAU_LAM_LAI", TGD = "TGD_DA_DUYET";
    // ---- Tình trạng KPI-kỳ ----
    public static final String CHUA_CHAM = "CHUA_CHAM", DA_CHAM = "DA_CHAM", EK_DA_XU_LY = "DA_XU_LY_DIEU_CHINH", EK_BCL = "BCL_YEU_CAU_LAM_LAI",
            CHOT_KQ_R2 = "CHOT_KQ_R2";

    /** Trạng thái được phép nhập/đồng bộ kết quả */
    public static final Set<String> EDITABLE = Set.of(CHUA_CO_KQ, DA_CO_KQ, DA_XU_LY, BCL);

    static final Map<String, Set<String>> RESULT = Map.of(
            CHUA_CO_KQ, Set.of(DA_CO_KQ),
            DA_CO_KQ, Set.of(DA_CO_KQ, DV_DE_NGHI, CHOT_DANH_GIA, BCL),
            DV_DE_NGHI, Set.of(DA_XU_LY, BCL),
            DA_XU_LY, Set.of(DA_CO_KQ, DA_XU_LY, DV_DE_NGHI, CHOT_DANH_GIA, BCL),
            CHOT_DANH_GIA, Set.of(TGD, BCL),
            BCL, Set.of(DA_CO_KQ, BCL),
            TGD, Set.of());

    static final Map<String, Set<String>> EVAL_KPI = Map.of(
            CHUA_CHAM, Set.of(DA_CHAM, CHOT_KQ_R2),
            DA_CHAM, Set.of(DA_CHAM, EK_DA_XU_LY, CHOT_KQ_R2, EK_BCL),
            EK_DA_XU_LY, Set.of(DA_CHAM, EK_DA_XU_LY, CHOT_KQ_R2, EK_BCL),
            EK_BCL, Set.of(DA_CHAM, CHOT_KQ_R2, EK_BCL),
            CHOT_KQ_R2, Set.of(EK_BCL));

    private final EvaluationMapper mapper;
    private final AuditService audit;

    public boolean canResult(String from, String to) {
        return RESULT.getOrDefault(from, Set.of()).contains(to);
    }

    public void assertResult(Result r, String to) {
        if (!canResult(r.getStatus(), to)) {
            throw new BusinessException(ErrorCode.ERR_INVALID_STATE, "Không thể chuyển trạng thái đánh giá từ “" + Labels.of(Labels.RESULT_STATUS, r.getStatus())
                    + "” sang “" + Labels.of(Labels.RESULT_STATUS, to) + "” (" + r.getOrgUnitName() + ")");
        }
    }

    /** Chuyển trạng thái kết quả (đã kiểm tra hợp lệ từng dòng) */
    public void transitionResults(Collection<Result> rows, String to, String note) {
        if (rows.isEmpty()) return;
        rows.forEach(r -> assertResult(r, to));
        String by = CurrentUser.currentUsername();
        List<Long> ids = rows.stream().filter(r -> !to.equals(r.getStatus())).map(Result::getId).toList();
        for (int i = 0; i < ids.size(); i += 1000) mapper.setResultStatus(ids.subList(i, Math.min(ids.size(), i + 1000)), to, by);
        for (Result r : rows) {
            if (!to.equals(r.getStatus())) mapper.insertStatusEvent(r.getId(), r.getEvaluationKpiId(), r.getStatus(), to, note, by);
        }
        if (!ids.isEmpty()) audit.log("CHUYEN_TRANG_THAI", "evaluation_result", null, null, Map.of("to", to, "count", ids.size(), "note", note == null ? "" : note));
    }

    public void transitionEvalKpi(EvalKpi ek, String to, String note) {
        if (to.equals(ek.getStatus())) return;
        if (!EVAL_KPI.getOrDefault(ek.getStatus(), Set.of()).contains(to)) {
            throw new BusinessException(ErrorCode.ERR_INVALID_STATE, "Không thể chuyển tình trạng KPI-kỳ từ “" + Labels.of(Labels.EVAL_KPI_STATUS, ek.getStatus())
                    + "” sang “" + Labels.of(Labels.EVAL_KPI_STATUS, to) + "”");
        }
        mapper.setEvalKpiStatus(ek.getId(), to, CurrentUser.currentUsername());
        mapper.insertStatusEvent(null, ek.getId(), ek.getStatus(), to, note, CurrentUser.currentUsername());
        audit.log("CHUYEN_TINH_TRANG", "evaluation_kpi", ek.getId(), Map.of("status", ek.getStatus()), Map.of("status", to));
    }

    /** Kỳ đã TGĐ duyệt → khóa toàn bộ dữ liệu kỳ */
    public void assertPeriodOpen(int year, String period) {
        String st = mapper.periodClosingStatus(year, period);
        if (TGD.equals(st)) throw new BusinessException(ErrorCode.ERR_PERIOD_LOCKED);
    }

    /** KPI-kỳ đã “Chốt KQ R2” → không cho đánh giá lại (409) */
    public void assertEvalKpiOpen(EvalKpi ek) {
        if (CHOT_KQ_R2.equals(ek.getStatus())) {
            throw new BusinessException(ErrorCode.ERR_INVALID_STATE, "KPI đã “Chốt KQ R2”, không cho phép đánh giá lại");
        }
        assertPeriodOpen(ek.getYear(), ek.getPeriodCode());
    }
}
