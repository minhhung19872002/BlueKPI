package vn.vnpt.kpi.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.support.ReloadableResourceBundleMessageSource;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;
import vn.vnpt.kpi.integration.kpisource.KpiSourceProperties;
import vn.vnpt.kpi.security.CasProperties;
import vn.vnpt.kpi.security.JwtProperties;

import java.util.List;
import java.util.Locale;
import java.util.concurrent.Executor;

@Configuration
@EnableAsync
@EnableConfigurationProperties({JwtProperties.class, CasProperties.class, MinioProperties.class, KpiSourceProperties.class})
public class WebConfig implements WebMvcConfigurer {

    public static final Locale VI = Locale.of("vi");

    /** Ngôn ngữ theo header Accept-Language (vi mặc định, en dự phòng) */
    @Bean
    public LocaleResolver localeResolver() {
        AcceptHeaderLocaleResolver r = new AcceptHeaderLocaleResolver();
        r.setSupportedLocales(List.of(VI, Locale.ENGLISH));
        r.setDefaultLocale(VI);
        return r;
    }

    @Bean
    public MessageSource messageSource() {
        ReloadableResourceBundleMessageSource ms = new ReloadableResourceBundleMessageSource();
        ms.setBasename("classpath:messages");
        ms.setDefaultEncoding("UTF-8");
        ms.setFallbackToSystemLocale(false);
        ms.setDefaultLocale(VI);
        return ms;
    }

    @Bean
    public LocalValidatorFactoryBean validator(MessageSource messageSource) {
        LocalValidatorFactoryBean b = new LocalValidatorFactoryBean();
        b.setValidationMessageSource(messageSource);
        return b;
    }

    @Bean(name = "taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(4);
        ex.setMaxPoolSize(16);
        ex.setQueueCapacity(1000);
        ex.setThreadNamePrefix("kpi-async-");
        ex.setWaitForTasksToCompleteOnShutdown(true);
        ex.setAwaitTerminationSeconds(30);
        ex.initialize();
        return ex;
    }
}
