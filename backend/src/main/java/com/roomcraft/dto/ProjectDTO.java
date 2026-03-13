package com.roomcraft.dto;

import com.roomcraft.model.Project;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ProjectDTO {
    private Long id;
    private String name;
    private String description;
    private String roomConfig;
    private String furnitureLayout;
    private String thumbnailUrl;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Long userId;
    private String username;

    public static ProjectDTO from(Project p) {
        ProjectDTO dto = new ProjectDTO();
        dto.setId(p.getId());
        dto.setName(p.getName());
        dto.setDescription(p.getDescription());
        dto.setRoomConfig(p.getRoomConfig());
        dto.setFurnitureLayout(p.getFurnitureLayout());
        dto.setThumbnailUrl(p.getThumbnailUrl());
        dto.setCreatedAt(p.getCreatedAt());
        dto.setUpdatedAt(p.getUpdatedAt());
        if (p.getUser() != null) {
            dto.setUserId(p.getUser().getId());
            dto.setUsername(p.getUser().getUsername());
        }
        return dto;
    }
}
