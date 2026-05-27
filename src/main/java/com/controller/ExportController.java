package com.controller;

import com.entity.User;
import com.service.ExportService;
import com.service.UserService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/export")
public class ExportController {

    private final ExportService exportService;
    private final UserService userService;

    public ExportController(ExportService exportService, UserService userService) {
        this.exportService = exportService;
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

    @GetMapping("/project/{projectId}")
    public ResponseEntity<byte[]> exportProject(@PathVariable Long projectId) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(401).build();
        }
        byte[] zipData = exportService.exportProjectToZip(projectId, currentUser);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=project_" + projectId + ".zip")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(zipData);
    }

    @GetMapping("/subgroup/{subgroupId}")
    public ResponseEntity<byte[]> exportSubgroup(@PathVariable Long subgroupId) {
        User currentUser = getCurrentUser();
        if (currentUser == null) {
            return ResponseEntity.status(401).build();
        }
        byte[] zipData = exportService.exportSubgroupToZip(subgroupId, currentUser);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=subgroup_" + subgroupId + ".zip")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(zipData);
    }
}