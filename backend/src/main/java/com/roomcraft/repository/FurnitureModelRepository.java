package com.roomcraft.repository;

import com.roomcraft.model.FurnitureModel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FurnitureModelRepository extends JpaRepository<FurnitureModel, Long> {
    List<FurnitureModel> findByActiveTrue();
    List<FurnitureModel> findByCategoryAndActiveTrue(String category);
    List<FurnitureModel> findByNameContainingIgnoreCaseAndActiveTrue(String name);

    List<FurnitureModel> findByActiveTrueAndVisibility(FurnitureModel.Visibility visibility);
    List<FurnitureModel> findByActiveTrueAndUploadedBy_Username(String username);

    @Query("""
        select f from FurnitureModel f
        left join f.uploadedBy u
        where f.active = true and (f.visibility = :vis or u.username = :username)
        """)
    List<FurnitureModel> findVisibleToUser(@Param("vis") FurnitureModel.Visibility vis, @Param("username") String username);

    @Query("""
        select u.username from FurnitureModel f
        left join f.uploadedBy u
        where f.id = :id
        """)
    Optional<String> findOwnerUsername(@Param("id") Long id);
}
