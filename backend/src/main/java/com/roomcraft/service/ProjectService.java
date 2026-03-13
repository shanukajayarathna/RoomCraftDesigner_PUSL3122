package com.roomcraft.service;

import com.roomcraft.model.Project;
import com.roomcraft.model.User;
import com.roomcraft.repository.ProjectRepository;
import com.roomcraft.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;

    public List<Project> getUserProjects(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return projectRepository.findByUserIdOrderByUpdatedAtDesc(user.getId());
    }

    public Project getProject(Long id, String username) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Project not found"));
        if (!project.getUser().getUsername().equals(username)) {
            throw new RuntimeException("Access denied");
        }
        return project;
    }

    @Transactional
    public Project createProject(String username, Map<String, String> body) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Project project = Project.builder()
                .user(user)
                .name(body.getOrDefault("name", "New Room"))
                .description(body.getOrDefault("description", ""))
                .roomConfig(body.getOrDefault("roomConfig",
                    "{\"shape\":\"rectangle\",\"width\":5,\"depth\":4,\"height\":2.8,\"wallColor\":\"#F5F5F0\",\"floorTexture\":\"wood\"}"))
                .furnitureLayout(body.getOrDefault("furnitureLayout", "[]"))
                .build();

        return projectRepository.save(project);
    }

    @Transactional
    public Project updateProject(Long id, String username, Map<String, String> body) {
        Project project = getProject(id, username);
        if (body.containsKey("name"))           project.setName(body.get("name"));
        if (body.containsKey("description"))    project.setDescription(body.get("description"));
        if (body.containsKey("roomConfig"))     project.setRoomConfig(body.get("roomConfig"));
        if (body.containsKey("furnitureLayout"))project.setFurnitureLayout(body.get("furnitureLayout"));
        if (body.containsKey("thumbnailUrl"))   project.setThumbnailUrl(body.get("thumbnailUrl"));
        return projectRepository.save(project);
    }

    @Transactional
    public void deleteProject(Long id, String username) {
        Project project = getProject(id, username);
        projectRepository.delete(project);
    }
}
