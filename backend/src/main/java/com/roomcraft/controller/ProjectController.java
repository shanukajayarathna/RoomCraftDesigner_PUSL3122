package com.roomcraft.controller;

import com.roomcraft.dto.ProjectDTO;
import com.roomcraft.service.ProjectService;
import com.roomcraft.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;
    private final FileStorageService storage;

    @GetMapping
    public ResponseEntity<List<ProjectDTO>> getMyProjects(Principal principal) {
        return ResponseEntity.ok(
            projectService.getUserProjects(principal.getName())
                .stream().map(ProjectDTO::from).toList()
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getProject(@PathVariable Long id, Principal principal) {
        try {
            return ResponseEntity.ok(ProjectDTO.from(projectService.getProject(id, principal.getName())));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createProject(@RequestBody Map<String, String> body, Principal principal) {
        try {
            return ResponseEntity.ok(ProjectDTO.from(projectService.createProject(principal.getName(), body)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateProject(@PathVariable Long id,
                                            @RequestBody Map<String, String> body,
                                            Principal principal) {
        try {
            return ResponseEntity.ok(ProjectDTO.from(projectService.updateProject(id, principal.getName(), body)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping(value = "/{id}/thumbnail", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadThumbnail(@PathVariable Long id,
                                             @RequestPart("thumbnailPng") MultipartFile thumbnailPng,
                                             Principal principal) {
        try {
            var project = projectService.getProject(id, principal.getName());
            if (thumbnailPng == null || thumbnailPng.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Missing thumbnailPng"));
            }
            String stored = storage.store(thumbnailPng.getBytes(), thumbnailPng.getOriginalFilename());
            String url = "/files/" + stored;
            projectService.updateProject(id, principal.getName(), Map.of("thumbnailUrl", url));
            return ResponseEntity.ok(Map.of("thumbnailUrl", url));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Thumbnail upload failed", "message", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteProject(@PathVariable Long id, Principal principal) {
        try {
            projectService.deleteProject(id, principal.getName());
            return ResponseEntity.ok(Map.of("message", "Project deleted"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
