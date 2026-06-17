package com.studhub;

import com.studhub.auth.OAuth2LoginSuccessHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import jakarta.servlet.http.HttpServletResponse;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           SecurityContextRepository securityContextRepository,
                                           OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler,
                                           @Value("${frontend.url:http://localhost:5173}") String frontendUrl) throws Exception {

        CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName(null);

        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(csrfHandler)
                        .ignoringRequestMatchers(
                                "/api/auth/**",
                                "/api/test",
                                "/api/csrf",
                                "/api/internal/**",
                                "/error",
                                "/api/courses/*/enroll",
                                "/api/materials/material/*/upload-file",
                                "/api/materials/*/submit",
                                "/api/user/group"
                        )
                )
                .securityContext(sc -> sc.securityContextRepository(securityContextRepository))
                //новенькое:
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                                response.setContentType("application/json;charset=UTF-8");
                                response.getWriter().write("{\"error\":\"Unauthorized\"}");
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                        if (request.getUserPrincipal() == null) {
                        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                        response.setContentType("application/json;charset=UTF-8");
                        response.getWriter().write("{\"error\":\"Unauthorized\"}");
                        } else {
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        response.setContentType("application/json;charset=UTF-8");
                        response.getWriter().write("{\"error\":\"Forbidden\"}");
                        }
                })
)
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/", "/api/test", "/api/csrf", "/api/auth/**", "/error").permitAll()
                        .requestMatchers("/api/internal/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/schedule/upload").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/user/change-role").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/grades/**").hasAnyRole("TEACHER", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/grades/upload").hasAnyRole("TEACHER", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/grades/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/schedule/download/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/schedule/uploads", "/api/schedule/uploads/**").authenticated()
                        .requestMatchers("/api/announcements/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/courses/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/courses/*/enroll").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/courses").hasAnyRole("TEACHER", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/user/{id}").authenticated()
                        .requestMatchers("/api/user/me", "/api/user/groups", "/api/user/group").authenticated()
                        .requestMatchers("/api/user", "/api/cpp-profile", "/api/schedule/latest").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/courses/**").hasAnyRole("TEACHER", "ADMIN")
                        .requestMatchers("/api/materials/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/grades").authenticated() //grades
                        .anyRequest().authenticated()
                )
                .oauth2Login(oauth2 -> oauth2.successHandler(oAuth2LoginSuccessHandler))
                .logout(logout -> logout
                        .logoutUrl("/logout")
                        .logoutSuccessUrl(frontendUrl)
                        .permitAll()
                );

        return http.build();
    }

    @Bean public PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
    @Bean public SecurityContextRepository securityContextRepository() { return new HttpSessionSecurityContextRepository(); }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${frontend.url:http://localhost:5173}") String frontendUrl,
            @Value("${app.backend.url:http://localhost:8080}") String backendUrl) {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(List.of(
                frontendUrl,
                backendUrl,
                "https://45.146.165.184.sslip.io",
                "http://localhost:5173",
                "http://localhost:8080",
                "http://localhost"
        ));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}