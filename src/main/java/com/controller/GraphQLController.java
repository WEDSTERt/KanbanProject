package com.controller;

import com.entity.*;
import com.service.*;
import com.config.JwtUtil;
import org.springframework.graphql.data.method.annotation.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Controller;
import java.util.List;

@Controller
public class GraphQLController {

    private final UserService userService;
    private final JwtUtil jwtUtil;

    public GraphQLController(UserService userService,
                             JwtUtil jwtUtil) {
        this.userService = userService;
        this.jwtUtil = jwtUtil;
    }

    // ---------- QUERY ----------
    @QueryMapping
    public User user(@Argument Long id) {
        return userService.findById(id).orElse(null);
    }

    @QueryMapping
    public List<User> users(@Argument Integer limit, @Argument Integer offset) {
        return userService.findAll(limit, offset);
    }

    @QueryMapping
    public User me() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof UserDetails userDetails) {
            Long userId = Long.parseLong(userDetails.getUsername());
            return userService.findById(userId).orElse(null);
        }
        return null;
    }

    // ---------- MUTATION ----------
    @MutationMapping
    public AuthPayload createUser(@Argument String fullName,
                                  @Argument String email,
                                  @Argument String password) {
        User user = userService.createUser(fullName, email, password);
        String token = jwtUtil.generateToken(user.getId(), user.getEmail());
        return new AuthPayload(token, user);
    }

    @MutationMapping
    public AuthPayload login(@Argument String email, @Argument String password) {
        User user = userService.login(email, password);
        if (user == null) {
            throw new RuntimeException("Invalid email or password");
        }
        String token = jwtUtil.generateToken(user.getId(), user.getEmail());
        return new AuthPayload(token, user);
    }

    @MutationMapping
    public User updateUser(@Argument Long id,
                           @Argument String fullName,
                           @Argument String email,
                           @Argument String password) {
        return userService.updateUser(id, fullName, email, password);
    }

    @MutationMapping
    public boolean deleteUser(@Argument Long id) {
        return userService.deleteUser(id);
    }

}