package com.roomcraft.controller;

import com.roomcraft.dto.AuthDTOs;
import com.roomcraft.dto.UserDTO;
import com.roomcraft.model.User;
import com.roomcraft.repository.UserRepository;
import com.roomcraft.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.security.core.context.SecurityContextHolder;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final FileStorageService fileStorageService;

    private String currentUsername() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? String.valueOf(auth.getPrincipal()) : null;
    }

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser() {
        String username = currentUsername();
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        return ResponseEntity.ok(UserDTO.from(user));
    }

    @PutMapping("/me")
    public ResponseEntity<?> updateCurrentUser(@RequestBody AuthDTOs.UpdateProfileRequest req) {
        String username = currentUsername();
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return ResponseEntity.status(404).body(Map.of("error", "User not found"));

        if (req.getUsername() != null && !req.getUsername().isBlank() && !req.getUsername().equals(user.getUsername())) {
            if (userRepository.existsByUsername(req.getUsername())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Username already taken"));
            }
            user.setUsername(req.getUsername());
        }

        if (req.getEmail() != null && !req.getEmail().isBlank() && !req.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(req.getEmail())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Email already registered"));
            }
            user.setEmail(req.getEmail());
        }

        if (req.getNewPassword() != null && !req.getNewPassword().isBlank()) {
            if (req.getCurrentPassword() == null || req.getCurrentPassword().isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Current password is required to change password"));
            }
            if (!passwordEncoder.matches(req.getCurrentPassword(), user.getPasswordHash())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Current password does not match"));
            }
            if (req.getNewPassword().length() < 6) {
                return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 6 characters"));
            }
            user.setPasswordHash(passwordEncoder.encode(req.getNewPassword()));
        }

        userRepository.save(user);
        return ResponseEntity.ok(UserDTO.from(user));
    }

    @PostMapping("/me/avatar")
    public ResponseEntity<?> uploadAvatar(@RequestParam("avatar") MultipartFile file) {
        String username = currentUsername();
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return ResponseEntity.status(404).body(Map.of("error", "User not found"));

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
        }

        String name = file.getOriginalFilename();
        if (name == null || !name.matches("^.*\\.(jpg|jpeg|png|webp)$")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Use .jpg, .jpeg, .png, or .webp image file"));
        }

        try {
            String stored = fileStorageService.store(file.getBytes(), file.getOriginalFilename());
            user.setAvatarUrl("/files/" + stored);
            userRepository.save(user);
            return ResponseEntity.ok(Map.of("avatarUrl", user.getAvatarUrl()));
        } catch (IOException e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to save avatar"));
        }
    }

    @DeleteMapping("/me/avatar")
    public ResponseEntity<?> deleteAvatar() {
        String username = currentUsername();
        if (username == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return ResponseEntity.status(404).body(Map.of("error", "User not found"));

        String current = user.getAvatarUrl();
        if (current != null && current.startsWith("/files/")) {
            String filename = current.substring("/files/".length());
            fileStorageService.delete(filename);
        }
        user.setAvatarUrl(null);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("avatarUrl", null));
    }
}
