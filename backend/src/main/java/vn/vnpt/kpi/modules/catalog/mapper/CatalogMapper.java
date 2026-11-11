package vn.vnpt.kpi.modules.catalog.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import vn.vnpt.kpi.common.PageQuery;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.Objective;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.Perspective;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.ScoringMethod;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.Stage;
import vn.vnpt.kpi.modules.catalog.model.CatalogModels.Uom;

import java.util.List;

@Mapper
public interface CatalogMapper {
    // ---- Đơn vị đo ----
    List<Uom> searchUom(@Param("keyword") String keyword, @Param("status") String status, @Param("q") PageQuery q);
    long countUom(@Param("keyword") String keyword, @Param("status") String status);
    Uom findUom(@Param("id") Long id);
    Uom findUomByName(@Param("name") String name);
    Uom findUomByCodeOrName(@Param("v") String v);
    int insertUom(Uom u);
    int setUomCode(@Param("id") Long id);
    int updateUom(Uom u);
    int deleteUom(@Param("id") Long id, @Param("version") Integer version, @Param("by") String by);
    long countUomUsage(@Param("id") Long id);

    // ---- Viễn cảnh ----
    List<Perspective> searchPerspective(@Param("keyword") String keyword, @Param("status") String status, @Param("q") PageQuery q);
    long countPerspective(@Param("keyword") String keyword, @Param("status") String status);
    List<Perspective> allPerspectives();
    Perspective findPerspective(@Param("id") Long id);
    Perspective findPerspectiveByCode(@Param("code") String code);
    int insertPerspective(Perspective p);
    int updatePerspective(Perspective p);
    int deletePerspective(@Param("id") Long id, @Param("version") Integer version, @Param("by") String by);
    long countPerspectiveKpi(@Param("id") Long id);
    long countPerspectiveObjective(@Param("id") Long id);

    // ---- Mục tiêu trọng tâm ----
    List<Objective> searchObjective(@Param("keyword") String keyword, @Param("perspectiveId") Long perspectiveId, @Param("status") String status,
                                    @Param("strategyId") Long strategyId, @Param("q") PageQuery q);
    long countObjective(@Param("keyword") String keyword, @Param("perspectiveId") Long perspectiveId, @Param("status") String status);
    Objective findObjective(@Param("id") Long id);
    Objective findObjectiveByCode(@Param("code") String code);
    int insertObjective(Objective o);
    int updateObjective(Objective o);
    int deleteObjective(@Param("id") Long id, @Param("version") Integer version, @Param("by") String by);
    long countObjectiveKpi(@Param("id") Long id);
    long countObjectiveStrategy(@Param("id") Long id);

    // ---- Phương pháp tính điểm / Giai đoạn ----
    List<ScoringMethod> allScoringMethods();
    ScoringMethod findScoringMethod(@Param("id") Long id);
    ScoringMethod findScoringMethodByCode(@Param("code") String code);
    List<Stage> allStages();
    Stage findStage(@Param("id") Long id);
    int insertStage(Stage s);
    int updateStage(Stage s);
    int deleteStage(@Param("id") Long id, @Param("by") String by);
    long countStageUsage(@Param("id") Long id);
}
