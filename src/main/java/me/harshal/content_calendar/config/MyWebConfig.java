package me.harshal.content_calendar.config;

import me.harshal.content_calendar.auth.AccessKeyInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class MyWebConfig implements WebMvcConfigurer {

    private final AccessKeyInterceptor accessKeyInterceptor;

    public MyWebConfig(AccessKeyInterceptor accessKeyInterceptor) {
        this.accessKeyInterceptor = accessKeyInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Everything that needs to know "whose board is this" goes through the key check.
        // POST /api/users (create a key) is deliberately NOT here - you have no key yet.
        registry.addInterceptor(accessKeyInterceptor)
                .addPathPatterns("/api/content/**", "/api/users/me");
    }
}
