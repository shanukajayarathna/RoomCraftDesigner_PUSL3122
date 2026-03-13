package com.roomcraft.repository;

import com.roomcraft.model.FurnitureModel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FurnitureModelRepository extends JpaRepository<FurnitureModel, Long> {
    List<FurnitureModel> findByActiveTrue();
    List<FurnitureModel> findByCategoryAndActiveTrue(String category);
    List<FurnitureModel> findByNameContainingIgnoreCaseAndActiveTrue(String name);
}
