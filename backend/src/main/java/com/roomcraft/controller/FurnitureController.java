package com.roomcraft.controller;

import com.roomcraft.model.FurnitureModel;
import com.roomcraft.repository.FurnitureModelRepository;
import com.roomcraft.repository.UserRepository;
import com.roomcraft.service.FileStorageService;
import com.roomcraft.service.ModelConversionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/furniture")
@RequiredArgsConstructor
public class FurnitureController {

    private final FurnitureModelRepository furnitureModelRepository;
    private final UserRepository userRepository;
    private final FileStorageService storage;
    private final ModelConversionService conversionService;

    @GetMapping
    public ResponseEntity<List<FurnitureModel>> getAllFurniture(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String search) {
        List<FurnitureModel> models;
        if (search != null && !search.isBlank()) {
            models = furnitureModelRepository.findByNameContainingIgnoreCaseAndActiveTrue(search);
        } else if (category != null && !category.isBlank()) {
            models = furnitureModelRepository.findByCategoryAndActiveTrue(category);
        } else {
            // Visible-to-user filtering happens in /api/furniture/visible
            models = furnitureModelRepository.findByActiveTrueAndVisibility(FurnitureModel.Visibility.PUBLIC);
        }
        return ResponseEntity.ok(models);
    }

    @GetMapping("/visible")
    public ResponseEntity<List<FurnitureModel>> getVisibleFurniture(
            Authentication auth,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String search
    ) {
        String username = auth != null ? (String) auth.getPrincipal() : null;
        if (username == null || username.isBlank()) return ResponseEntity.ok(List.of());

        // For simplicity we filter in-memory for category/search after the visibility query.
        List<FurnitureModel> models = furnitureModelRepository.findVisibleToUser(FurnitureModel.Visibility.PUBLIC, username);
        if (search != null && !search.isBlank()) {
            String s = search.toLowerCase();
            models = models.stream().filter(m -> (m.getName() != null && m.getName().toLowerCase().contains(s))).toList();
        }
        if (category != null && !category.isBlank()) {
            models = models.stream().filter(m -> category.equalsIgnoreCase(m.getCategory())).toList();
        }
        return ResponseEntity.ok(models);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getFurniture(@PathVariable Long id) {
        return furnitureModelRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadModel(
            Authentication auth,
            @RequestParam String name,
            @RequestParam String category,
            @RequestParam(required = false) String subcategory,
            @RequestParam(required = false) Double width,
            @RequestParam(required = false) Double height,
            @RequestParam(required = false) Double depth,
            @RequestParam(required = false) String tags,
            @RequestParam(required = false, defaultValue = "PRIVATE") FurnitureModel.Visibility visibility,
            @RequestPart("modelFile") MultipartFile modelFile,
            @RequestPart(value = "topViewPng", required = false) MultipartFile topViewPng,
            @RequestPart(value = "thumbnailPng", required = false) MultipartFile thumbnailPng
    ) throws IOException {
        String username = auth != null ? (String) auth.getPrincipal() : null;
        if (username == null || username.isBlank()) return ResponseEntity.status(401).build();

        var user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return ResponseEntity.status(401).build();

        boolean isAdmin = auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        FurnitureModel.Visibility finalVis = isAdmin ? visibility : FurnitureModel.Visibility.PRIVATE;

        // Always store original; also try to convert to GLB for best 3D fidelity.
        String originalStored = storage.store(modelFile.getBytes(), modelFile.getOriginalFilename());
        String originalUrl = "/files/" + originalStored;
        String modelUrl = originalUrl;

        // Convert to GLB (Option A) when possible.
        Path tmpInput = null;
        Path tmpGlb = null;
        try {
            tmpInput = Files.createTempFile("roomcraft-upload-", "-" + (modelFile.getOriginalFilename() == null ? "model" : modelFile.getOriginalFilename()));
            Files.write(tmpInput, modelFile.getBytes());
            tmpGlb = conversionService.convertToGlb(tmpInput);
            String glbStored = storage.store(Files.readAllBytes(tmpGlb), "converted.glb");
            modelUrl = "/files/" + glbStored;
        } catch (Exception convErr) {
            // If conversion fails, keep original; 3D view will still attempt to render it if supported.
            System.out.println("Model conversion failed, using original: " + convErr.getMessage());
        } finally {
            try { if (tmpInput != null) Files.deleteIfExists(tmpInput); } catch (Exception ignored) {}
            try { if (tmpGlb != null) Files.deleteIfExists(tmpGlb); } catch (Exception ignored) {}
        }

        String topViewUrl = null;
        if (topViewPng != null && !topViewPng.isEmpty()) {
            String tvStored = storage.store(topViewPng.getBytes(), topViewPng.getOriginalFilename());
            topViewUrl = "/files/" + tvStored;
        }

        String thumbUrl = null;
        if (thumbnailPng != null && !thumbnailPng.isEmpty()) {
            String thStored = storage.store(thumbnailPng.getBytes(), thumbnailPng.getOriginalFilename());
            thumbUrl = "/files/" + thStored;
        }

        FurnitureModel m = FurnitureModel.builder()
                .name(name)
                .category(category)
                .subcategory(subcategory)
                .width(width)
                .height(height)
                .depth(depth)
                .tags(tags)
                .modelUrl(modelUrl)
                .topViewUrl(topViewUrl)
                .thumbnailUrl(thumbUrl)
                .uploadedBy(user)
                .visibility(finalVis)
                .active(true)
                .build();

        return ResponseEntity.ok(furnitureModelRepository.save(m));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteOwnModel(Authentication auth, @PathVariable Long id) {
        String username = auth != null ? (String) auth.getPrincipal() : null;
        if (username == null || username.isBlank()) return ResponseEntity.status(401).build();
        boolean isAdmin = auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));

        return furnitureModelRepository.findById(id).map(m -> {
            // Avoid touching lazy uploadedBy proxy (open-in-view is disabled).
            String owner = furnitureModelRepository.findOwnerUsername(id).orElse(null);
            if (!isAdmin) {
                if (owner == null || !owner.equals(username)) return ResponseEntity.status(403).build();
            }
            furnitureModelRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("message", "Deleted"));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping(value = "/{id}/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadPreview(
            Authentication auth,
            @PathVariable Long id,
            @RequestPart(value = "topViewPng", required = false) MultipartFile topViewPng,
            @RequestPart(value = "thumbnailPng", required = false) MultipartFile thumbnailPng
    ) throws IOException {
        String username = auth != null ? (String) auth.getPrincipal() : null;
        if (username == null || username.isBlank()) return ResponseEntity.status(401).build();
        boolean isAdmin = auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));

        return furnitureModelRepository.findById(id).map(m -> {
            String owner = furnitureModelRepository.findOwnerUsername(id).orElse(null);
            if (!isAdmin) {
                if (owner == null || !owner.equals(username)) return ResponseEntity.status(403).build();
            }
            try {
                if (topViewPng != null && !topViewPng.isEmpty()) {
                    String tvStored = storage.store(topViewPng.getBytes(), topViewPng.getOriginalFilename());
                    m.setTopViewUrl("/files/" + tvStored);
                }
                if (thumbnailPng != null && !thumbnailPng.isEmpty()) {
                    String thStored = storage.store(thumbnailPng.getBytes(), thumbnailPng.getOriginalFilename());
                    m.setThumbnailUrl("/files/" + thStored);
                }
                return ResponseEntity.ok(furnitureModelRepository.save(m));
            } catch (IOException e) {
                return ResponseEntity.status(500).body(Map.of("error", "Preview upload failed", "message", e.getMessage()));
            }
        }).orElse(ResponseEntity.notFound().build());
    }
}
