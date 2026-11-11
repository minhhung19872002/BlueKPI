package vn.vnpt.kpi.modules.mykpi.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import vn.vnpt.kpi.common.Labels;
import vn.vnpt.kpi.engine.KpiCalculationEngine;
import vn.vnpt.kpi.modules.evaluation.model.EvalModels.Result;
import vn.vnpt.kpi.modules.report.service.ReportTemplateService;
import vn.vnpt.kpi.modules.report.service.ReportTemplateService.Col;
import vn.vnpt.kpi.modules.report.service.ReportTemplateService.Spec;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 22.1 Xuất kết quả đánh giá KPI theo mẫu (report_template KQ_DANH_GIA_DON_VI) */
@Component
@RequiredArgsConstructor
public class MyKpiExporter {
    static final Spec SPEC = new Spec("KẾT QUẢ ĐÁNH GIÁ KPI ĐƠN VỊ",
            List.of("Đơn vị: ${unitName}", "Năm: ${year}    Kỳ đánh giá: ${periodName}", "Ngày xuất: ${exportDate}"),
            List.of(Col.t("STT", "${r.stt}", 6), Col.t("Mã KPI", "${r.code}", 12), Col.t("Tên tiêu chí KPI", "${r.name}", 45),
                    Col.t("Viễn cảnh", "${r.perspective}", 18), Col.t("Đơn vị đo", "${r.uom}", 12), Col.n("Trọng số", "${r.weight}", 10),
                    Col.n("KH giao", "${r.plan}", 14), Col.n("Kết quả thực hiện", "${r.result}", 16), Col.n("% TH/KH", "${r.rate}", 10),
                    Col.n("Điểm", "${r.score}", 8), Col.t("Trạng thái đánh giá", "${r.status}", 22)),
            null, "Điểm BSC đơn vị: ${bsc}");

    private final MyKpiService service;
    private final ReportTemplateService reports;

    public byte[] export(Long unitId, int year, String period) {
        List<Result> rows = service.exportRows(unitId, year, period);
        List<Map<String, Object>> items = new ArrayList<>();
        int i = 0;
        for (Result r : rows) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("stt", r.getParentKpiId() == null ? String.valueOf(++i) : "");
            m.put("code", r.getKpiCode());
            m.put("name", (r.getParentKpiId() == null ? "" : "   ↳ ") + r.getKpiName());
            m.put("perspective", r.getPerspectiveName());
            m.put("uom", r.getUnitOfMeasureName());
            m.put("weight", r.getWeight());
            m.put("plan", r.getPlanValue());
            m.put("result", r.getFinalResult());
            m.put("rate", r.getCompletionRate());
            m.put("score", r.getScore());
            m.put("status", Labels.of(Labels.RESULT_STATUS, r.getStatus()));
            items.add(m);
        }
        BigDecimal bsc = KpiCalculationEngine.bscUnit(rows.stream().filter(r -> r.getParentKpiId() == null)
                .map(r -> new KpiCalculationEngine.WeightedScore(r.getScore(), r.getWeight())).toList());
        Map<String, Object> vars = new HashMap<>();
        vars.put("rows", items);
        vars.put("unitName", rows.isEmpty() ? "" : rows.get(0).getOrgUnitName());
        vars.put("year", year);
        vars.put("periodName", Labels.of(Labels.PERIOD, period));
        vars.put("exportDate", LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")));
        vars.put("bsc", bsc == null ? "Chưa có" : bsc.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString().replace('.', ','));
        return reports.render("KQ_DANH_GIA_DON_VI", SPEC, vars);
    }
}
