package vn.vnpt.kpi.modules.file.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import vn.vnpt.kpi.modules.file.model.FileObject;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface FileMapper {
    int insert(FileObject f);

    FileObject findById(@Param("id") Long id);

    List<FileObject> findByOwner(@Param("ownerType") String ownerType, @Param("ownerId") Long ownerId);

    int attach(@Param("ids") List<Long> ids, @Param("ownerType") String ownerType, @Param("ownerId") Long ownerId);

    List<FileObject> findExpired(@Param("today") LocalDate today);

    int markDeleted(@Param("id") Long id);
}
