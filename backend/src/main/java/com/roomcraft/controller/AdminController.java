package com.roomcraft.controller;

import com.roomcraft.dto.ProjectDTO;
import com.roomcraft.dto.UserDTO;
import com.roomcraft.model.FurnitureModel;
import com.roomcraft.model.Project;
import com.roomcraft.repository.FurnitureModelRepository;
import com.roomcraft.repository.ProjectRepository;
import com.roomcraft.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final FurnitureModelRepository furnitureModelRepository;

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Long>> getStats() {
        return ResponseEntity.ok(Map.of(
                "totalUsers",     userRepository.count(),
                "totalProjects",  projectRepository.count(),
                "totalFurniture", furnitureModelRepository.count()
        ));
    }

    @GetMapping("/users")
    public ResponseEntity<List<UserDTO>> getAllUsers() {
        return ResponseEntity.ok(
            userRepository.findAll().stream().map(UserDTO::from).toList()
        );
    }

    @PutMapping("/users/{id}/toggle")
    public ResponseEntity<?> toggleUser(@PathVariable Long id) {
        return userRepository.findById(id).map(user -> {
            user.setActive(!user.isActive());
            userRepository.save(user);
            return ResponseEntity.ok(Map.of("active", user.isActive()));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        userRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "User deleted"));
    }

    @GetMapping("/projects")
    public ResponseEntity<List<ProjectDTO>> getAllProjects() {
        return ResponseEntity.ok(
            projectRepository.findAll().stream().map(ProjectDTO::from).toList()
        );
    }

    @DeleteMapping("/projects/{id}")
    public ResponseEntity<?> deleteProject(@PathVariable Long id) {
        projectRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Project deleted"));
    }

    @GetMapping("/furniture")
    public ResponseEntity<List<FurnitureModel>> getAllFurniture() {
        return ResponseEntity.ok(furnitureModelRepository.findAll());
    }

    @PostMapping("/furniture")
    public ResponseEntity<FurnitureModel> addFurniture(@RequestBody FurnitureModel model) {
        return ResponseEntity.ok(furnitureModelRepository.save(model));
    }

    @DeleteMapping("/furniture/{id}")
    public ResponseEntity<?> deleteFurniture(@PathVariable Long id) {
        furnitureModelRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Furniture deleted"));
    }
}
