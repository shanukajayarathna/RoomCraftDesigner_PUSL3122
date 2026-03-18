package com.roomcraft.controller;

import com.roomcraft.dto.AuthDTOs;
import com.roomcraft.dto.ProjectDTO;
import com.roomcraft.dto.UserDTO;
import com.roomcraft.model.FurnitureModel;
import com.roomcraft.model.User;
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

    @PutMapping("/users/{id}")
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody AuthDTOs.AdminUpdateUserRequest req) {
        return userRepository.findById(id).map(user -> {
            if (req.getUsername() != null && !req.getUsername().isBlank() && !req.getUsername().equals(user.getUsername())) {
                if (userRepository.existsByUsername(req.getUsername())) return ResponseEntity.badRequest().body(Map.of("error", "Username already taken"));
                user.setUsername(req.getUsername());
            }
            if (req.getEmail() != null && !req.getEmail().isBlank() && !req.getEmail().equals(user.getEmail())) {
                if (userRepository.existsByEmail(req.getEmail())) return ResponseEntity.badRequest().body(Map.of("error", "Email already registered"));
                user.setEmail(req.getEmail());
            }
            if (req.getPassword() != null && !req.getPassword().isBlank()) {
                user.setPasswordHash(new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().encode(req.getPassword()));
            }
            if (req.getRole() != null) {
                try { user.setRole(User.Role.valueOf(req.getRole().toUpperCase())); } catch (Exception ignored) {}
            }
            if (req.getActive() != null) user.setActive(req.getActive());
            userRepository.save(user);
            return ResponseEntity.ok(UserDTO.from(user));
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

    @PutMapping("/furniture/{id}")
    public ResponseEntity<?> updateFurniture(@PathVariable Long id, @RequestBody Map<String, Object> patch) {
        return furnitureModelRepository.findById(id).map(m -> {
            if (patch.containsKey("active")) m.setActive(Boolean.TRUE.equals(patch.get("active")));
            if (patch.containsKey("visibility")) {
                try {
                    m.setVisibility(FurnitureModel.Visibility.valueOf(String.valueOf(patch.get("visibility")).toUpperCase()));
                } catch (Exception ignored) {}
            }
            if (patch.containsKey("name")) m.setName(String.valueOf(patch.get("name")));
            if (patch.containsKey("category")) m.setCategory(String.valueOf(patch.get("category")));
            if (patch.containsKey("subcategory")) m.setSubcategory(String.valueOf(patch.get("subcategory")));
            if (patch.containsKey("tags")) m.setTags(String.valueOf(patch.get("tags")));
            return ResponseEntity.ok(furnitureModelRepository.save(m));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/furniture/{id}")
    public ResponseEntity<?> deleteFurniture(@PathVariable Long id) {
        furnitureModelRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Furniture deleted"));
    }
}
