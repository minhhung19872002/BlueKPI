package vn.vnpt.kpi.security.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Mapper
public interface SecurityMapper {
    Map<String, Object> findUserCore(@Param("id") Long id);

    Map<String, Object> findLoginUser(@Param("username") String username);

    Map<String, Object> findUserForSso(@Param("username") String username, @Param("email") String email);

    List<Map<String, Object>> findGrants(@Param("userId") Long userId);

    List<Map<String, Object>> findPermissionsOfUser(@Param("userId") Long userId);

    List<Long> findSubtreeIds(@Param("unitId") Long unitId);

    void recordLoginFailure(@Param("id") Long id, @Param("count") int count, @Param("lockedUntil") LocalDateTime lockedUntil);

    void recordLoginSuccess(@Param("id") Long id, @Param("ip") String ip);

    void insertLoginLog(@Param("username") String username, @Param("result") String result,
                        @Param("authMethod") String authMethod, @Param("ip") String ip, @Param("userAgent") String userAgent);

    void insertSession(Map<String, Object> s);

    Map<String, Object> findSessionByHash(@Param("hash") String hash);

    void rotateSession(@Param("id") Long id, @Param("newHash") String newHash, @Param("expiresAt") LocalDateTime expiresAt);

    void revokeSession(@Param("id") Long id);

    void revokeSessionByHash(@Param("hash") String hash);

    void revokeUserSessions(@Param("userId") Long userId);

    List<Map<String, Object>> findMenus();
}
