package com.roomcraft.controller;

import com.roomcraft.model.FurnitureModel;
import com.roomcraft.repository.FurnitureModelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/furniture")
@RequiredArgsConstructor
public class FurnitureController {

    private final FurnitureModelRepository furnitureModelRepository;

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
            models = furnitureModelRepository.findByActiveTrue();
        }
        return ResponseEntity.ok(models);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getFurniture(@PathVariable Long id) {
        return furnitureModelRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
