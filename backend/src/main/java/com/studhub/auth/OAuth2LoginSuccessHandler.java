package com.studhub.auth;

import com.studhub.user.UserRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Component
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private static final Logger log = LoggerFactory.getLogger(OAuth2LoginSuccessHandler.class);
    private final CppUserClient cppUserClient;
    private final UserRepository userRepository;
    private final SecurityContextRepository securityContextRepository;

    public OAuth2LoginSuccessHandler(CppUserClient cppUserClient, UserRepository userRepository,
                                     SecurityContextRepository securityContextRepository,
                                     @Value("${frontend.url:http://localhost:5173}") String frontendUrl) {
        this.cppUserClient = cppUserClient;
        this.userRepository = userRepository;
        this.securityContextRepository = securityContextRepository;
        setDefaultTargetUrl(frontendUrl);
        setAlwaysUseDefaultTargetUrl(true);
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {
        if (authentication.getPrincipal() instanceof OAuth2User principal) {
            Map<String, Object> attrs = principal.getAttributes();
            String email = attrs.get("default_email") != null ? attrs.get("default_email").toString() : 
                          (attrs.get("email") != null ? attrs.get("email").toString() : null);

            if (email != null && !email.isBlank()) {
                userRepository.findByEmail(email.toLowerCase()).ifPresent(user -> {
                    List<GrantedAuthority> authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().toUpperCase()));
                    Authentication newAuth = new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(
                            principal, authentication.getCredentials(), authorities);
                    
                    SecurityContext context = SecurityContextHolder.createEmptyContext();
                    context.setAuthentication(newAuth);
                    SecurityContextHolder.setContext(context);
                    
                    // Критически важно: сохраняем контекст в сессию
                    securityContextRepository.saveContext(context, request, response);
                });
            }
        }
        super.onAuthenticationSuccess(request, response, authentication);
    }
}