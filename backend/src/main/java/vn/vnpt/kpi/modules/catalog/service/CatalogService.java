package vn.vnpt.kpi.modules.catalog.service;

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
import vn.vnpt.kpi.common.Guards;
import vn.vnpt.kpi.common.Labels;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.common.PageResult;
import vn.vnpt.kpi.common.audit.AuditService;
import vn.vnpt.kpi.common.excel.ExcelColumn;
import vn.vnpt.kpi.common.excel.ExcelExporter;
import vn.vnpt.kpi.common.util.Strs;
import vn.vnpt.kpi.modules.catalog.mapper.CatalogMapper;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.Objective;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.Perspective;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.ScoringMethod;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.Stage;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.Uom;
import vn.vnpt.kpi.security.CurrentUser;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Danh mục: Đơn vị đo (26.1–26.8), Viễn cảnh (26.9–26.16), Mục tiêu trọng tâm (28.1–28.8), Phương pháp tính điểm, Giai đoạn */
@Service
@RequiredArgsConstructor
public class CatalogService {
    public record UomRequest(@NotBlank(message = "Vui lòng nhập Tên đơn vị đo") @Size(max = 255, message = "Tên đơn vị đo tối đa 255 ký tự") String name,
                             @Size(max = 1000) String description,
                             @NotBlank(message = "Vui lòng chọn Trạng thái") @Pattern(regexp = "HIEU_LUC|KHONG_HIEU_LUC") String status,
                             Integer version) {}

    public record PerspectiveRequest(
            @NotBlank(message = "Vui lòng nhập Mã viễn cảnh") @Size(max = 10, message = "Mã viễn cảnh tối đa 10 ký tự")
            @Pattern(regexp = "^[A-Z0-9]+$", message = "Mã viễn cảnh chỉ gồm chữ in hoa và số") String code,
            @NotBlank(message = "Vui lòng nhập Tên viễn cảnh") @Size(max = 255) String name,
            @Min(0) @Max(1000) Integer sortOrder,
            @Size(max = 1000) String description,
            @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Màu phải theo định dạng #RRGGBB") String color,
            @NotBlank(message = "Vui lòng chọn Trạng thái") @Pattern(regexp = "HIEU_LUC|KHONG_HIEU_LUC") String status,
            Integer version) {}

    public record ObjectiveRequest(
            @NotBlank(message = "Vui lòng nhập Mã mục tiêu") @Size(max = 50) @Pattern(regexp = "^[A-Za-z0-9_.-]+$", message = "Mã mục tiêu chỉ gồm chữ, số, _ . -") String code,
            @NotBlank(message = "Vui lòng nhập Tên mục tiêu") @Size(max = 500) String name,
            @NotNull(message = "Vui lòng chọn Viễn cảnh") Long perspectiveId,
            @Size(max = 2000) String description,
            Integer version) {}

    public record StageRequest(@NotBlank @Size(max = 50) String code, @NotBlank @Size(max = 255) String name,
                               @NotNull @Min(2000) @Max(2100) Integer fromYear, @NotNull @Min(2000) @Max(2100) Integer toYear) {}

    static final Map<String, String> UOM_SORT = Map.of("code", "code", "name", "name", "status", "status", "createdAt", "created_at", "updatedAt", "updated_at");
    static final Map<String, String> PER_SORT = Map.of("code", "p.code", "name", "p.name", "sortOrder", "p.sort_order", "createdAt", "p.created_at", "updatedAt", "p.updated_at");
    static final Map<String, String> OBJ_SORT = Map.of("code", "o.code", "name", "o.name", "perspectiveName", "p.sort_order", "createdAt", "o.created_at", "updatedAt", "o.updated_at");

    private final CatalogMapper mapper;
    private final AuditService audit;

    // ======================= Đơn vị đo =======================
    public PageResult<Uom> searchUom(String keyword, String status, PageQuery q) {
        q.applySort(UOM_SORT, "id");
        String kw = Strs.like(keyword);
        return PageResult.of(mapper.searchUom(kw, status, q), mapper.countUom(kw, status), q);
    }

    public Uom getUom(Long id) { return Guards.found(mapper.findUom(id), "đơn vị đo"); }

    @Transactional
    public Uom createUom(UomRequest r) {
        if (mapper.findUomByName(r.name().trim()) != null) throw BusinessException.field("name", "Tên đơn vị đo đã tồn tại");
        Uom u = new Uom();
        u.setName(r.name().trim());
        u.setDescription(Strs.trimToNull(r.description()));
        u.setStatus(r.status());
        u.setCreatedBy(CurrentUser.currentUsername());
        u.setUpdatedBy(CurrentUser.currentUsername());
        mapper.insertUom(u);
        mapper.setUomCode(u.getId());
        Uom saved = getUom(u.getId());
        audit.log("THEM", "unit_of_measure", u.getId(), null, saved);
        return saved;
    }

    @Transactional
    public Uom updateUom(Long id, UomRequest r) {
        Uom before = getUom(id);
        Uom dup = mapper.findUomByName(r.name().trim());
        if (dup != null && !dup.getId().equals(id)) throw BusinessException.field("name", "Tên đơn vị đo đã tồn tại");
        Uom u = new Uom();
        u.setId(id);
        u.setName(r.name().trim());
        u.setDescription(Strs.trimToNull(r.description()));
        u.setStatus(r.status());
        u.setVersion(r.version() == null ? before.getVersion() : r.version());
        u.setUpdatedBy(CurrentUser.currentUsername());
        Guards.updated(mapper.updateUom(u));
        Uom after = getUom(id);
        audit.log("SUA", "unit_of_measure", id, before, after);
        return after;
    }

    @Transactional
    public void deleteUom(Long id, Integer version) {
        Uom u = getUom(id);
        long used = mapper.countUomUsage(id);
        if (used > 0) throw BusinessException.inUse("danh mục chỉ tiêu KPI (" + used + " KPI)");
        Guards.updated(mapper.deleteUom(id, version == null ? u.getVersion() : version, CurrentUser.currentUsername()));
        audit.log("XOA", "unit_of_measure", id, u, null);
    }

    public byte[] exportUom(String keyword, String status, PageQuery q) {
        List<ExcelColumn<Uom>> cols = List.of(ExcelColumn.of("Mã đơn vị đo", Uom::getCode), ExcelColumn.of("Tên đơn vị đo", Uom::getName, 30),
                ExcelColumn.of("Mô tả", Uom::getDescription, 40), ExcelColumn.of("Trạng thái", x -> Labels.of(Labels.ACTIVE, x.getStatus())),
                ExcelColumn.of("Người tạo", Uom::getCreatedBy), ExcelColumn.of("Ngày tạo", Uom::getCreatedAt),
                ExcelColumn.of("Người cập nhật", Uom::getUpdatedBy), ExcelColumn.of("Ngày cập nhật", Uom::getUpdatedAt));
        return ExcelExporter.export("Don vi do", "DANH SÁCH ĐƠN VỊ ĐO", cols, searchUom(keyword, status, q.forExport()).items());
    }

    // ======================= Viễn cảnh =======================
    public PageResult<Perspective> searchPerspective(String keyword, String status, PageQuery q) {
        q.applySort(PER_SORT, "p.sort_order, p.id");
        String kw = Strs.like(keyword);
        return PageResult.of(mapper.searchPerspective(kw, status, q), mapper.countPerspective(kw, status), q);
    }

    public List<Perspective> allPerspectives() { return mapper.allPerspectives(); }

    public Perspective getPerspective(Long id) { return Guards.found(mapper.findPerspective(id), "viễn cảnh"); }

    @Transactional
    public Perspective createPerspective(PerspectiveRequest r) {
        if (mapper.findPerspectiveByCode(r.code()) != null) throw BusinessException.field("code", "Mã viễn cảnh đã tồn tại");
        Perspective p = toPerspective(r);
        p.setCreatedBy(CurrentUser.currentUsername());
        mapper.insertPerspective(p);
        Perspective saved = getPerspective(p.getId());
        audit.log("THEM", "perspective", p.getId(), null, saved);
        return saved;
    }

    /** 26.13: mã khóa sửa nếu đã có KPI dùng làm tiền tố */
    @Transactional
    public Perspective updatePerspective(Long id, PerspectiveRequest r) {
        Perspective before = getPerspective(id);
        if (!before.getCode().equals(r.code())) {
            if (mapper.countPerspectiveKpi(id) > 0) throw BusinessException.field("code", "Không được sửa mã viễn cảnh vì đã được dùng làm tiền tố mã KPI");
            Perspective dup = mapper.findPerspectiveByCode(r.code());
            if (dup != null) throw BusinessException.field("code", "Mã viễn cảnh đã tồn tại");
        }
        Perspective p = toPerspective(r);
        p.setId(id);
        p.setVersion(r.version() == null ? before.getVersion() : r.version());
        Guards.updated(mapper.updatePerspective(p));
        Perspective after = getPerspective(id);
        audit.log("SUA", "perspective", id, before, after);
        return after;
    }

    @Transactional
    public void deletePerspective(Long id, Integer version) {
        Perspective p = getPerspective(id);
        List<String> where = new ArrayList<>();
        long k = mapper.countPerspectiveKpi(id), o = mapper.countPerspectiveObjective(id);
        if (k > 0) where.add("danh mục chỉ tiêu KPI (" + k + ")");
        if (o > 0) where.add("mục tiêu trọng tâm (" + o + ")");
        if (!where.isEmpty()) throw BusinessException.inUse(String.join(", ", where));
        Guards.updated(mapper.deletePerspective(id, version == null ? p.getVersion() : version, CurrentUser.currentUsername()));
        audit.log("XOA", "perspective", id, p, null);
    }

    public byte[] exportPerspective(String keyword, String status, PageQuery q) {
        List<ExcelColumn<Perspective>> cols = List.of(ExcelColumn.of("Mã viễn cảnh", Perspective::getCode), ExcelColumn.of("Tên viễn cảnh", Perspective::getName, 30),
                ExcelColumn.of("Thứ tự", Perspective::getSortOrder), ExcelColumn.of("Mô tả", Perspective::getDescription, 40),
                ExcelColumn.of("Màu", Perspective::getColor), ExcelColumn.of("Trạng thái", x -> Labels.of(Labels.ACTIVE, x.getStatus())),
                ExcelColumn.of("Người tạo", Perspective::getCreatedBy), ExcelColumn.of("Ngày tạo", Perspective::getCreatedAt),
                ExcelColumn.of("Người cập nhật", Perspective::getUpdatedBy), ExcelColumn.of("Ngày cập nhật", Perspective::getUpdatedAt));
        return ExcelExporter.export("Vien canh", "DANH SÁCH VIỄN CẢNH", cols, searchPerspective(keyword, status, q.forExport()).items());
    }

    private static Perspective toPerspective(PerspectiveRequest r) {
        Perspective p = new Perspective();
        p.setCode(r.code().trim());
        p.setName(r.name().trim());
        p.setSortOrder(r.sortOrder() == null ? 0 : r.sortOrder());
        p.setDescription(Strs.trimToNull(r.description()));
        p.setColor(r.color() == null ? "#2563EB" : r.color().toUpperCase());
        p.setStatus(r.status());
        p.setUpdatedBy(CurrentUser.currentUsername());
        return p;
    }

    // ======================= Mục tiêu trọng tâm =======================
    public PageResult<Objective> searchObjective(String keyword, Long perspectiveId, String status, Long strategyId, PageQuery q) {
        q.applySort(OBJ_SORT, "p.sort_order, o.code");
        String kw = Strs.like(keyword);
        return PageResult.of(mapper.searchObjective(kw, perspectiveId, status, strategyId, q), mapper.countObjective(kw, perspectiveId, status), q);
    }

    public Objective getObjective(Long id) { return Guards.found(mapper.findObjective(id), "mục tiêu trọng tâm"); }

    @Transactional
    public Objective createObjective(ObjectiveRequest r) {
        if (mapper.findObjectiveByCode(r.code().trim()) != null) throw BusinessException.field("code", "Mã mục tiêu đã tồn tại");
        getPerspective(r.perspectiveId());
        Objective o = new Objective();
        o.setCode(r.code().trim());
        o.setName(r.name().trim());
        o.setPerspectiveId(r.perspectiveId());
        o.setDescription(Strs.trimToNull(r.description()));
        o.setCreatedBy(CurrentUser.currentUsername());
        o.setUpdatedBy(CurrentUser.currentUsername());
        mapper.insertObjective(o);
        Objective saved = getObjective(o.getId());
        audit.log("THEM", "strategic_objective", o.getId(), null, saved);
        return saved;
    }

    @Transactional
    public Objective updateObjective(Long id, ObjectiveRequest r) {
        Objective before = getObjective(id);
        if (!before.getCode().equals(r.code().trim())) throw BusinessException.field("code", "Mã mục tiêu không được sửa");
        if (!before.getPerspectiveId().equals(r.perspectiveId()) && mapper.countObjectiveKpi(id) > 0) {
            throw BusinessException.field("perspectiveId", "Không được đổi viễn cảnh vì mục tiêu đã gắn KPI");
        }
        getPerspective(r.perspectiveId());
        Objective o = new Objective();
        o.setId(id);
        o.setName(r.name().trim());
        o.setPerspectiveId(r.perspectiveId());
        o.setDescription(Strs.trimToNull(r.description()));
        o.setVersion(r.version() == null ? before.getVersion() : r.version());
        o.setUpdatedBy(CurrentUser.currentUsername());
        Guards.updated(mapper.updateObjective(o));
        Objective after = getObjective(id);
        audit.log("SUA", "strategic_objective", id, before, after);
        return after;
    }

    @Transactional
    public void deleteObjective(Long id, Integer version) {
        Objective o = getObjective(id);
        List<String> where = new ArrayList<>();
        long k = mapper.countObjectiveKpi(id), s = mapper.countObjectiveStrategy(id);
        if (k > 0) where.add("danh mục chỉ tiêu KPI (" + k + ")");
        if (s > 0) where.add("bản đồ chiến lược (" + s + ")");
        if (!where.isEmpty()) throw BusinessException.inUse(String.join(", ", where));
        Guards.updated(mapper.deleteObjective(id, version == null ? o.getVersion() : version, CurrentUser.currentUsername()));
        audit.log("XOA", "strategic_objective", id, o, null);
    }

    public byte[] exportObjective(String keyword, Long perspectiveId, PageQuery q) {
        List<ExcelColumn<Objective>> cols = List.of(ExcelColumn.of("Mã mục tiêu", Objective::getCode), ExcelColumn.of("Tên mục tiêu", Objective::getName, 45),
                ExcelColumn.of("Mã viễn cảnh", Objective::getPerspectiveCode), ExcelColumn.of("Viễn cảnh", Objective::getPerspectiveName, 25),
                ExcelColumn.of("Mô tả", Objective::getDescription, 40),
                ExcelColumn.of("Người tạo", Objective::getCreatedBy), ExcelColumn.of("Ngày tạo", Objective::getCreatedAt),
                ExcelColumn.of("Người cập nhật", Objective::getUpdatedBy), ExcelColumn.of("Ngày cập nhật", Objective::getUpdatedAt));
        return ExcelExporter.export("Muc tieu trong tam", "DANH SÁCH MỤC TIÊU TRỌNG TÂM", cols,
                searchObjective(keyword, perspectiveId, null, null, q.forExport()).items());
    }

    // ======================= Phương pháp tính điểm / Giai đoạn =======================
    public List<ScoringMethod> scoringMethods() { return mapper.allScoringMethods(); }

    public List<Stage> stages() { return mapper.allStages(); }

    @Transactional
    public Stage createStage(StageRequest r) {
        if (r.toYear() < r.fromYear()) throw BusinessException.field("toYear", "Đến năm phải ≥ Từ năm");
        Stage s = new Stage();
        s.setCode(r.code());
        s.setName(r.name());
        s.setFromYear(r.fromYear());
        s.setToYear(r.toYear());
        s.setCreatedBy(CurrentUser.currentUsername());
        s.setUpdatedBy(CurrentUser.currentUsername());
        mapper.insertStage(s);
        audit.log("THEM", "evaluation_stage", s.getId(), null, s);
        return mapper.findStage(s.getId());
    }

    @Transactional
    public Stage updateStage(Long id, StageRequest r) {
        Stage before = Guards.found(mapper.findStage(id), "giai đoạn");
        Stage s = new Stage();
        s.setId(id);
        s.setName(r.name());
        s.setFromYear(r.fromYear());
        s.setToYear(r.toYear());
        s.setUpdatedBy(CurrentUser.currentUsername());
        mapper.updateStage(s);
        audit.log("SUA", "evaluation_stage", id, before, s);
        return mapper.findStage(id);
    }

    @Transactional
    public void deleteStage(Long id) {
        Stage s = Guards.found(mapper.findStage(id), "giai đoạn");
        if (mapper.countStageUsage(id) > 0) throw BusinessException.inUse("chiến lược");
        mapper.deleteStage(id, CurrentUser.currentUsername());
        audit.log("XOA", "evaluation_stage", id, s, null);
    }
}
