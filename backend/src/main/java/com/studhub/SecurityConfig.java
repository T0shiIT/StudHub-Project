// package com.studhub;

// import com.studhub.auth.OAuth2LoginSuccessHandler;
// import org.springframework.context.annotation.Bean;
// import org.springframework.context.annotation.Configuration;
// import org.springframework.http.HttpMethod;
// import org.springframework.security.config.Customizer;
// import org.springframework.security.config.annotation.web.builders.HttpSecurity;
// import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
// import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
// import org.springframework.security.crypto.password.PasswordEncoder;
// import org.springframework.security.web.SecurityFilterChain;
// import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
// import org.springframework.security.web.context.SecurityContextRepository;
// import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
// import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
// import org.springframework.web.cors.CorsConfiguration;
// import org.springframework.web.cors.CorsConfigurationSource;
// import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

// import java.util.List;

// @Configuration
// @EnableWebSecurity
// public class SecurityConfig {

//     @Bean
//     public SecurityFilterChain filterChain(HttpSecurity http,
//                                            SecurityContextRepository securityContextRepository,
//                                            OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler) throws Exception {

//         CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();
//         csrfHandler.setCsrfRequestAttributeName(null);

//         http
//                 .cors(Customizer.withDefaults())
//                 .csrf(csrf -> csrf
//                         .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
//                         .csrfTokenRequestHandler(csrfHandler)
//                         .ignoringRequestMatchers("/api/auth/**", "/api/test", "/api/csrf", "/api/internal/**", "/error")
//                 )
//                 .securityContext(sc -> sc.securityContextRepository(securityContextRepository))
//                 .authorizeHttpRequests(auth -> auth
//                         .requestMatchers("/", "/api/test", "/api/csrf", "/api/auth/**", "/error").permitAll()
//                         .requestMatchers("/api/internal/**").authenticated()
//                         .requestMatchers(HttpMethod.POST, "/api/schedule/upload").authenticated()
//                         .requestMatchers(HttpMethod.POST, "/api/user/change-role").hasRole("ADMIN")
//                         .requestMatchers(HttpMethod.PATCH, "/api/grades/**").hasAnyRole("TEACHER", "ADMIN")
//                         .requestMatchers(HttpMethod.POST, "/api/grades/upload").hasAnyRole("TEACHER", "ADMIN")
//                         .requestMatchers(HttpMethod.GET, "/api/grades/**").authenticated()
//                         .requestMatchers(HttpMethod.GET, "/api/schedule/download/**").authenticated()
//                         .requestMatchers(HttpMethod.GET, "/api/schedule/uploads", "/api/schedule/uploads/**").authenticated()
//                         .requestMatchers("/api/user", "/api/cpp-profile", "/api/schedule/latest").authenticated()
//                         .anyRequest().authenticated()
//                 )
//                 .oauth2Login(oauth2 -> oauth2.successHandler(oAuth2LoginSuccessHandler))
//                 .logout(logout -> logout
//                         .logoutUrl("/logout")
//                         .logoutSuccessUrl("http://localhost:5173")
//                         .permitAll()
//                 );

//         return http.build();
//     }

//     @Bean public PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
//     @Bean public SecurityContextRepository securityContextRepository() { return new HttpSessionSecurityContextRepository(); }

//     @Bean
//     public CorsConfigurationSource corsConfigurationSource() {
//         CorsConfiguration cfg = new CorsConfiguration();
//         cfg.setAllowedOrigins(List.of("http://localhost:5173", "http://localhost"));
//         cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
//         cfg.setAllowedHeaders(List.of("*"));
//         cfg.setAllowCredentials(true);
//         UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
//         source.registerCorsConfiguration("/**", cfg);
//         return source;
//     }
// }

package com.studhub;

import com.studhub.auth.OAuth2LoginSuccessHandler;
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

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           SecurityContextRepository securityContextRepository,
                                           OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler) throws Exception {

        CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName(null);

        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(csrfHandler)
                        .ignoringRequestMatchers("/api/auth/**", "/api/test", "/api/csrf", "/api/internal/**", "/error")
                )
                .securityContext(sc -> sc.securityContextRepository(securityContextRepository))
                .authorizeHttpRequests(auth -> auth
                        // Полностью публичные
                        .requestMatchers("/", "/api/test", "/api/csrf", "/api/auth/**", "/error").permitAll()
                        // Internal — permitAll, но контроллер сам проверяет аутентификацию
                        .requestMatchers("/api/internal/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/schedule/upload").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/user/change-role").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/grades/**").hasAnyRole("TEACHER", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/grades/upload").hasAnyRole("TEACHER", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/grades/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/schedule/download/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/schedule/uploads", "/api/schedule/uploads/**").authenticated()
                        .requestMatchers("/api/user", "/api/cpp-profile", "/api/schedule/latest").authenticated()
                        .anyRequest().authenticated()
                )
                .oauth2Login(oauth2 -> oauth2.successHandler(oAuth2LoginSuccessHandler))
                .logout(logout -> logout
                        .logoutUrl("/logout")
                        .logoutSuccessUrl("http://localhost:5173")
                        .permitAll()
                );

        return http.build();
    }

    @Bean public PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
    @Bean public SecurityContextRepository securityContextRepository() { return new HttpSessionSecurityContextRepository(); }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(List.of("http://localhost:5173", "http://localhost"));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}