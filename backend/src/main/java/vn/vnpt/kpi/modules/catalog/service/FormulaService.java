package vn.vnpt.kpi.modules.catalog.service;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.vnpt.kpi.common.BusinessException;
import vn.vnpt.kpi.common.Guards;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.PageResult;
import vn.vnpt.kpi.common.audit.AuditService;
import vn.vnpt.kpi.common.util.Jsons;
import vn.vnpt.kpi.common.util.Strs;
import vn.vnpt.kpi.engine.FormulaEvaluator;
import vn.vnpt.kpi.integration.kpisource.KpiSourceClient;
import vn.vnpt.kpi.modules.catalog.mapper.FormulaMapper;
import vn.vnpt.kpi.modules.catalog.model.FormulaDefinition;
import vn.vnpt.kpi.modules.sync.mapper.SyncBatchMapper;
import vn.vnpt.kpi.security.CurrentUser;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Định nghĩa KPI công thức (27.1–27.6) */
@Service
@RequiredArgsConstructor
public class FormulaService {
    static final Map<String, String> SORT = Map.of("code", "code", "name", "name", "definitionType", "definition_type", "status", "status", "createdAt", "created_at");

    public record FormulaRequest(
            @NotBlank(message = "Vui lòng nhập Mã định nghĩa") @Size(max = 50) @Pattern(regexp = "^[A-Za-z][A-Za-z0-9_]*$", message = "Mã định nghĩa bắt đầu bằng chữ, chỉ gồm chữ, số và _") String code,
            @NotBlank(message = "Vui lòng nhập Tên định nghĩa") @Size(max = 500) String name,
            @NotBlank(message = "Vui lòng chọn Loại định nghĩa") @Pattern(regexp = "THANH_PHAN_API|THANH_PHAN_NHAP_TAY|CONG_THUC_TONG_HOP") String definitionType,
            @NotBlank(message = "Vui lòng chọn Loại số liệu") @Pattern(regexp = "SO|TY_LE|TIEN_TE|SO_LUONG") String dataType,
            @Size(max = 2000) String expression,
            @Size(max = 4000) String sourceDefinition,
            @Size(max = 1000) String apiPath,
            @Pattern(regexp = "GET|POST", message = "Phương thức HTTP không hợp lệ") String httpMethod,
            @Size(max = 500) String responsePath,
            @Size(max = 2000) String businessDescription,
            @Pattern(regexp = "HIEU_LUC|KHONG_HIEU_LUC") String status,
            Integer version) {}

    public record TestRequest(FormulaRequest definition, Integer year, String period, String unitCode, String kpiCode, Map<String, BigDecimal> sampleValues) {}

    public record ExpressionCheck(String expression, Set<String> variables, Map<String, BigDecimal> sampleValues) {}

    private final FormulaMapper mapper;
    private final SyncBatchMapper batchMapper;
    private final KpiSourceClient source;
    private final AuditService audit;

    public PageResult<FormulaDefinition> search(String keyword, String status, String type, PageQuery q) {
        q.applySort(SORT, "code");
        String kw = Strs.like(keyword);
        return PageResult.of(mapper.search(kw, status, type, q), mapper.count(kw, status, type), q);
    }

    public List<FormulaDefinition> active() { return mapper.findAllActive(); }

    /** 27.3: kèm 10 lần đồng bộ gần nhất */
    public Map<String, Object> get(Long id) {
        FormulaDefinition f = Guards.found(mapper.findById(id), "định nghĩa KPI công thức");
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("definition", f);
        m.put("recentSyncs", batchMapper.recentItemsByFormula(id, 10));
        return m;
    }

    @Transactional
    public FormulaDefinition create(FormulaRequest r) {
        if (mapper.findByCode(r.code()) != null) throw BusinessException.field("code", "Mã định nghĩa đã tồn tại");
        validate(r);
        FormulaDefinition f = toEntity(r);
        f.setCreatedBy(CurrentUser.currentUsername());
        mapper.insert(f);
        FormulaDefinition saved = mapper.findById(f.getId());
        audit.log("THEM", "formula_definition", f.getId(), null, saved);
        return saved;
    }

    @Transactional
    public FormulaDefinition update(Long id, FormulaRequest r) {
        FormulaDefinition before = Guards.found(mapper.findById(id), "định nghĩa KPI công thức");
        if (!before.getCode().equals(r.code())) throw BusinessException.field("code", "Mã định nghĩa không được sửa");
        validate(r);
        FormulaDefinition f = toEntity(r);
        f.setId(id);
        f.setVersion(r.version() == null ? before.getVersion() : r.version());
        Guards.updated(mapper.update(f));
        FormulaDefinition after = mapper.findById(id);
        audit.log("SUA", "formula_definition", id, before, after);
        return after;
    }

    @Transactional
    public void delete(Long id, Integer version) {
        FormulaDefinition f = Guards.found(mapper.findById(id), "định nghĩa KPI công thức");
        long used = mapper.countComponentUsage(id);
        if (used > 0) throw BusinessException.inUse("thành phần KPI (" + used + ")");
        List<String> refs = mapper.findCodesUsingInExpression(f.getCode()).stream().filter(c -> !c.equals(f.getCode())).toList();
        if (!refs.isEmpty()) throw BusinessException.inUse("biểu thức công thức " + String.join(", ", refs));
        Guards.updated(mapper.softDelete(id, version == null ? f.getVersion() : version, CurrentUser.currentUsername()));
        audit.log("XOA", "formula_definition", id, f, null);
    }

    void validate(FormulaRequest r) {
        if ("CONG_THUC_TONG_HOP".equals(r.definitionType())) {
            if (Strs.isBlank(r.expression())) throw BusinessException.field("expression", "Vui lòng nhập Biểu thức công thức (bắt buộc với Công thức tổng hợp)");
            Set<String> codes = mapper.findAllActive().stream().map(FormulaDefinition::getCode).filter(c -> !c.equals(r.code())).collect(Collectors.toSet());
            var v = FormulaEvaluator.validate(r.expression(), codes);
            if (!v.valid()) throw BusinessException.field("expression", String.join("; ", v.errors()));
        }
        if ("THANH_PHAN_API".equals(r.definitionType()) && Strs.isBlank(r.apiPath())) {
            throw BusinessException.field("apiPath", "Vui lòng nhập Đường dẫn API (bắt buộc với loại API)");
        }
        if (!Strs.isBlank(r.sourceDefinition()) && !Jsons.isValidJson(r.sourceDefinition())) {
            throw BusinessException.field("sourceDefinition", "Định nghĩa nguồn phải là JSON hợp lệ");
        }
    }

    /** “Kiểm tra kết nối”: gọi thử API với tham số mẫu và hiện giá trị nhận được */
    public Map<String, Object> testConnection(TestRequest t) {
        FormulaRequest d = t.definition();
        if (d == null || Strs.isBlank(d.apiPath())) throw BusinessException.field("apiPath", "Vui lòng nhập Đường dẫn API");
        int year = t.year() == null ? LocalDate.now().getYear() : t.year();
        var resp = source.fetch(new KpiSourceClient.Request(d.apiPath(), d.httpMethod(), d.responsePath(), null, year,
                t.period() == null ? "Q1" : t.period(), t.unitCode() == null ? "VNPT_HNI" : t.unitCode(), t.kpiCode() == null ? d.code() : t.kpiCode()));
        Map<String, Object> m = new HashMap<>();
        m.put("success", resp.ok());
        m.put("value", resp.value());
        m.put("error", resp.error());
        m.put("request", resp.requestSummary());
        m.put("elapsedMs", resp.elapsedMs());
        return m;
    }

    public Map<String, Object> testById(Long id, TestRequest t) {
        FormulaDefinition f = Guards.found(mapper.findById(id), "định nghĩa KPI công thức");
        FormulaRequest d = new FormulaRequest(f.getCode(), f.getName(), f.getDefinitionType(), f.getDataType(), f.getExpression(), f.getSourceDefinition(),
                f.getApiPath(), f.getHttpMethod(), f.getResponsePath(), null, f.getStatus(), null);
        return testConnection(new TestRequest(d, t == null ? null : t.year(), t == null ? null : t.period(), t == null ? null : t.unitCode(), t == null ? null : t.kpiCode(), null));
    }

    /** “Kiểm tra biểu thức”: kiểm tra cú pháp/biến; nếu có giá trị mẫu thì tính thử */
    public Map<String, Object> checkExpression(ExpressionCheck c) {
        Set<String> allowed = c.variables() != null ? c.variables()
                : mapper.findAllActive().stream().map(FormulaDefinition::getCode).collect(Collectors.toSet());
        var v = FormulaEvaluator.validate(c.expression(), allowed);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("valid", v.valid());
        m.put("errors", v.errors());
        m.put("variables", v.variables());
        if (v.valid()) {
            Map<String, BigDecimal> sample = new HashMap<>();
            for (String var : v.variables()) sample.put(var, c.sampleValues() != null && c.sampleValues().get(var) != null ? c.sampleValues().get(var) : BigDecimal.ONE);
            var r = FormulaEvaluator.eval(c.expression(), sample);
            m.put("sampleValues", sample);
            m.put("sampleResult", r.value());
            m.put("sampleError", r.error());
        }
        return m;
    }

    private static FormulaDefinition toEntity(FormulaRequest r) {
        FormulaDefinition f = new FormulaDefinition();
        f.setCode(r.code().trim());
        f.setName(r.name().trim());
        f.setDefinitionType(r.definitionType());
        f.setDataType(r.dataType());
        f.setExpression(Strs.trimToNull(r.expression()));
        f.setSourceDefinition(Strs.trimToNull(r.sourceDefinition()));
        f.setApiPath(Strs.trimToNull(r.apiPath()));
        f.setHttpMethod(r.httpMethod() == null ? "GET" : r.httpMethod());
        f.setResponsePath(Strs.trimToNull(r.responsePath()));
        f.setBusinessDescription(Strs.trimToNull(r.businessDescription()));
        f.setStatus(r.status() == null ? "HIEU_LUC" : r.status());
        f.setUpdatedBy(CurrentUser.currentUsername());
        return f;
    }
}
