package com.planbookai.backend.config;

import com.planbookai.backend.Security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import jakarta.servlet.http.HttpServletResponse;


@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true) // Bật @PreAuthorize / @PostAuthorize
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {

        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            // ✅ Trả 401 khi chưa xác thực (token hết hạn/thiếu) thay vì 403
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) -> {
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setContentType("application/json");
                    response.getWriter().write("{\"error\":\"Unauthorized\",\"message\":\"Token hết hạn hoặc không hợp lệ\"}");
                })
            )
            .authorizeHttpRequests(auth -> auth
                    // =============================================================
                    // PUBLIC endpoints – không cần xác thực
                    // =============================================================
                    .requestMatchers(
                            "/api/v1/auth/**",
                            "/api/v1/payment/**",        // VNPay return/IPN – không cần login
                            "/api-docs",
                            "/api-docs/**",
                            "/v3/api-docs",
                            "/v3/api-docs/**",
                            "/swagger-ui.html",
                            "/swagger-ui/**",
                            "/swagger-ui.html",
                            "/swagger-resources/**",
                            "/configuration/ui",
                            "/configuration/security",
                            "/swagger-resources/**",
                            "/webjars/**")
                    .permitAll()

                    // =============================================================
                    // ADMIN-only endpoints
                    // =============================================================
                    .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")

                    // =============================================================
                    // MANAGER endpoints (Manager + Admin)
                    // =============================================================
                    .requestMatchers("/api/v1/manager/**").hasAnyRole("MANAGER", "ADMIN")

                    // =============================================================
                    // STAFF endpoints (Staff + Manager + Admin)
                    // =============================================================
                    .requestMatchers("/api/v1/staff/**").hasAnyRole("STAFF", "MANAGER", "ADMIN")

                    // =============================================================
                    // TEACHER endpoints
                    // =============================================================
                    .requestMatchers("/api/v1/teacher/**").hasRole("TEACHER")

                    // Tất cả request còn lại phải authenticated
                    .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList("http://localhost:3000", "http://localhost:3001", "http://localhost:5173"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type"));
        configuration.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}