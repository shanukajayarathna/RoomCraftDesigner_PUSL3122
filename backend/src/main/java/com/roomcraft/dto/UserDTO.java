package com.roomcraft.dto;

import com.roomcraft.model.User;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class UserDTO {
    private Long id;
    private String username;
    private String email;
    private String role;
    private boolean active;
    private String avatarUrl;
    private LocalDateTime createdAt;

    public static UserDTO from(User u) {
        UserDTO dto = new UserDTO();
        dto.setId(u.getId());
        dto.setUsername(u.getUsername());
        dto.setEmail(u.getEmail());
        dto.setRole(u.getRole().name());
        dto.setActive(u.isActive());
        dto.setAvatarUrl(u.getAvatarUrl());
        dto.setCreatedAt(u.getCreatedAt());
        return dto;
    }
}
