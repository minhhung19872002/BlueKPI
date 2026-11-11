package vn.vnpt.kpi.common.audit;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import vn.vnpt.kpi.common.PageQuery;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface AuditMapper {
    void insert(AuditLog log);

    List<AuditLog> search(@Param("username") String username, @Param("action") String action,
                          @Param("entity") String entity, @Param("from") LocalDateTime from,
                          @Param("to") LocalDateTime to, @Param("q") PageQuery q);

    long count(@Param("username") String username, @Param("action") String action,
               @Param("entity") String entity, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);
}
