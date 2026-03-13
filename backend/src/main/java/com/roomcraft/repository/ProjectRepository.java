package com.roomcraft.repository;

import com.roomcraft.model.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {
    List<Project> findByUserIdOrderByUpdatedAtDesc(Long userId);
    long countByUserId(Long userId);
}
