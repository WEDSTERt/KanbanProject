package com.service;

import com.entity.User;
import com.repository.UserRepository;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.Collections;
import org.springframework.cache.annotation.Cacheable;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    public CustomUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    @Cacheable(value = "currentUser", key = "#userId")
    public UserDetails loadUserByUsername(String userId) throws UsernameNotFoundException {
        Long id = Long.parseLong(userId);
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + userId));
        return new org.springframework.security.core.userdetails.User(
                user.getId().toString(),
                user.getUserPassword(),
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER"))
        );
    }
}