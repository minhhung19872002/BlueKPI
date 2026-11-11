package vn.vnpt.kpi.config;

import org.mybatis.spring.boot.autoconfigure.ConfigurationCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import vn.vnpt.kpi.common.util.EncryptedStringTypeHandler;
import vn.vnpt.kpi.security.JwtProperties;

/** MyBatis: map_underscore_to_camel_case + đăng ký EncryptedStringTypeHandler (khóa từ secret store) */
@Configuration
public class MyBatisConfig {
    @Bean
    public ConfigurationCustomizer mybatisCustomizer(JwtProperties props) {
        EncryptedStringTypeHandler.init(props.piiEncryptionKey());
        return c -> {
            c.setMapUnderscoreToCamelCase(true);
            c.setCallSettersOnNulls(true);
            c.setReturnInstanceForEmptyRow(false);
            c.setDefaultFetchSize(500);
        };
    }
}
