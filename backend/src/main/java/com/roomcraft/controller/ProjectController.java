package com.roomcraft.controller;

import com.roomcraft.dto.ProjectDTO;
import com.roomcraft.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

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
