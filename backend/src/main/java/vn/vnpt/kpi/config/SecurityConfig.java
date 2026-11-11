package vn.vnpt.kpi.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.security.web.csrf.CsrfTokenRequestHandler;
import org.springframework.security.web.csrf.XorCsrfTokenRequestAttributeHandler;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.OncePerRequestFilter;
import vn.vnpt.kpi.common.ApiResponse;
import vn.vnpt.kpi.common.ErrorCode;
import vn.vnpt.kpi.security.JwtAuthenticationFilter;
import vn.vnpt.kpi.security.JwtProperties;
import vn.vnpt.kpi.security.JwtService;
import vn.vnpt.kpi.security.UserAuthorityService;

import java.io.IOException;
import java.util.List;
import java.util.function.Supplier;

/**
 * Stateless JWT; CSRF double-submit cookie XSRF-TOKEN ↔ header X-XSRF-TOKEN; CORS whitelist;
 * method security @PreAuthorize (PHẦN B §9).
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private static final String[] PUBLIC = {
            "/auth/login", "/auth/refresh", "/auth/sso/login", "/auth/sso/callback", "/auth/csrf",
            "/actuator/health/**", "/actuator/info", "/docs/**", "/v3/api-docs/**", "/swagger-ui/**", "/error"
    };

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtService jwtService, UserAuthorityService authorityService,
                                           ObjectMapper om) throws Exception {
        CookieCsrfTokenRepository csrfRepo = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrfRepo.setCookiePath("/");
        csrfRepo.setCookieCustomizer(c -> c.sameSite("Lax"));

        http
                .cors(c -> {})
                .csrf(c -> c.csrfTokenRepository(csrfRepo)
                        .csrfTokenRequestHandler(new SpaCsrfTokenRequestHandler())
                        .ignoringRequestMatchers("/auth/login"))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(b -> b.disable())
                .formLogin(f -> f.disable())
                .logout(l -> l.disable())
                .headers(h -> h
                        .frameOptions(f -> f.deny())
                        .contentTypeOptions(c -> {})
                        .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                        .httpStrictTransportSecurity(hs -> hs.includeSubDomains(true).maxAgeInSeconds(31536000)))
                .authorizeHttpRequests(a -> a
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(PUBLIC).permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> writeError(res, om, ErrorCode.ERR_UNAUTHORIZED))
                        .accessDeniedHandler((req, res, ex) -> writeError(res, om,
                                ex instanceof org.springframework.security.web.csrf.CsrfException ? null : ErrorCode.ERR_FORBIDDEN)))
                .addFilterBefore(new JwtAuthenticationFilter(jwtService, authorityService), UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(new CsrfCookieFilter(), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    private static void writeError(HttpServletResponse res, ObjectMapper om, ErrorCode code) throws IOException {
        res.setStatus(code == null ? 403 : code.status().value());
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding("UTF-8");
        String c = code == null ? "ERR_CSRF" : code.name();
        String m = code == null ? "Phiên làm việc không hợp lệ (CSRF), vui lòng tải lại trang" : code.defaultMessage();
        om.writeValue(res.getOutputStream(), ApiResponse.error(c, m, null, null));
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(JwtProperties props) {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(props.corsAllowedOrigins());
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("Content-Type", "X-XSRF-TOKEN", "Accept-Language", "Authorization", "X-Trace-Id"));
        cfg.setExposedHeaders(List.of("Content-Disposition", "X-Trace-Id"));
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }

    /** Spring Security 6 SPA: nhận token thô từ header, mã hóa BREACH khi render */
    static final class SpaCsrfTokenRequestHandler implements CsrfTokenRequestHandler {
        private final CsrfTokenRequestHandler plain = new CsrfTokenRequestAttributeHandler();
        private final CsrfTokenRequestHandler xor = new XorCsrfTokenRequestAttributeHandler();

        @Override
        public void handle(HttpServletRequest request, HttpServletResponse response, Supplier<CsrfToken> csrfToken) {
            xor.handle(request, response, csrfToken);
            csrfToken.get();
        }

        @Override
        public String resolveCsrfTokenValue(HttpServletRequest request, CsrfToken csrfToken) {
            String header = request.getHeader(csrfToken.getHeaderName());
            return StringUtils.hasText(header) ? plain.resolveCsrfTokenValue(request, csrfToken) : xor.resolveCsrfTokenValue(request, csrfToken);
        }
    }

    /** Bảo đảm cookie XSRF-TOKEN luôn được phát cho SPA */
    static final class CsrfCookieFilter extends OncePerRequestFilter {
        @Override
        protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
            CsrfToken token = (CsrfToken) req.getAttribute("_csrf");
            if (token != null) token.getToken();
            if (MDC.get("traceId") == null) MDC.put("traceId", "-");
            chain.doFilter(req, res);
        }
    }
}
