package com.controller;

import com.entity.Project;
import com.entity.Subgroup;
import com.entity.User;
import com.service.ImportService;
import com.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/import")
public class ImportController {

    private final ImportService importService;
    private final UserService userService;

    public ImportController(ImportService importService, UserService userService) {
        this.importService = importService;
        this.userService = userService;
    }

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof UserDetails userDetails) {
            Long userId = Long.parseLong(userDetails.getUsername());
            return userService.findById(userId).orElse(null);
        }
        return null;
    }

    @PostMapping("/project")
    public ResponseEntity<?> importProject(@RequestParam("file") MultipartFile file) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }
        try {
            Project project = importService.importProjectFromZip(file, currentUser);
            return ResponseEntity.ok(Map.of("id", project.getId(), "name", project.getName()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/subgroup/{projectId}")
    public ResponseEntity<?> importSubgroup(@PathVariable Long projectId,
                                            @RequestParam("file") MultipartFile file) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }
        try {
            Subgroup subgroup = importService.importSubgroupIntoProject(file, projectId, currentUser);
            return ResponseEntity.ok(Map.of("id", subgroup.getId(), "name", subgroup.getName()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}