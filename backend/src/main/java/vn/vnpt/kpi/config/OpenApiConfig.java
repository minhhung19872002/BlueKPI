package vn.vnpt.kpi.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

/** Springdoc tại /api/docs (prod chỉ mở cho IP nội bộ qua Nginx) */
@Configuration
public class OpenApiConfig {
    @Bean
    public OpenAPI kpiOpenApi() {
        return new OpenAPI()
                .info(new Info().title("KPI-BSC API").version("1.0.0")
                        .description("API phần mềm quản trị và theo dõi chỉ tiêu KPI theo BSC — VNPT-IT"))
                .servers(List.of(new Server().url("/api")));
    }
}
