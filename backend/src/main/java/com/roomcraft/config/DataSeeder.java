package com.roomcraft.config;

import com.roomcraft.model.FurnitureModel;
import com.roomcraft.model.Project;
import com.roomcraft.model.User;
import com.roomcraft.repository.FurnitureModelRepository;
import com.roomcraft.repository.ProjectRepository;
import com.roomcraft.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@RequiredArgsConstructor
public class DataSeeder {

    @Bean
    CommandLineRunner seedData(UserRepository users,
                               ProjectRepository projects,
                               FurnitureModelRepository furniture,
                               PasswordEncoder encoder) {
        return args -> {
            // Seed admin user
            if (!users.existsByUsername("admin")) {
                User admin = User.builder()
                        .username("admin")
                        .email("admin@roomcraft.com")
                        .passwordHash(encoder.encode("admin123"))
                        .role(User.Role.ADMIN)
                        .active(true)
                        .build();
                users.save(admin);
            }

            // Seed demo user
            User demoUser;
            if (!users.existsByUsername("demo")) {
                demoUser = User.builder()
                        .username("demo")
                        .email("demo@roomcraft.com")
                        .passwordHash(encoder.encode("demo123"))
                        .role(User.Role.USER)
                        .active(true)
                        .build();
                demoUser = users.save(demoUser);
            } else {
                demoUser = users.findByUsername("demo").get();
            }

            // Seed furniture models
            if (furniture.count() == 0) {
                String[][] items = {
                    {"Modern Sofa", "Seating", "Sofa", "2.20", "0.85", "0.90"},
                    {"Armchair", "Seating", "Chair", "0.85", "0.90", "0.85"},
                    {"Dining Chair", "Seating", "Chair", "0.50", "0.95", "0.50"},
                    {"Coffee Table", "Tables", "Coffee Table", "1.20", "0.45", "0.60"},
                    {"Dining Table", "Tables", "Dining Table", "1.80", "0.75", "0.90"},
                    {"King Bed", "Bedroom", "Bed", "1.93", "0.55", "2.13"},
                    {"Wardrobe", "Bedroom", "Storage", "1.80", "2.10", "0.60"},
                    {"Bookshelf", "Storage", "Shelf", "0.80", "1.80", "0.30"},
                    {"Work Desk", "Office", "Desk", "1.40", "0.75", "0.70"},
                    {"Office Chair", "Seating", "Chair", "0.60", "1.10", "0.60"},
                    {"Floor Lamp", "Lighting", "Lamp", "0.35", "1.60", "0.35"},
                    {"TV Unit", "Living Room", "Media", "1.50", "0.50", "0.40"},
                    {"Bathroom Sink", "Bathroom", "Sink", "0.60", "0.85", "0.45"},
                    {"Bathtub", "Bathroom", "Bath", "1.70", "0.55", "0.75"},
                    {"Kitchen Counter", "Kitchen", "Counter", "2.00", "0.90", "0.60"},
                    {"Nightstand", "Bedroom", "Table", "0.50", "0.55", "0.40"},
                    {"Dresser", "Bedroom", "Storage", "1.20", "1.10", "0.45"},
                    {"Side Table", "Tables", "Side Table", "0.50", "0.55", "0.50"},
                    {"Ottoman", "Seating", "Ottoman", "0.80", "0.42", "0.80"},
                    {"Plant Pot", "Decor", "Plant", "0.40", "0.80", "0.40"},
                };

                for (String[] item : items) {
                    furniture.save(FurnitureModel.builder()
                            .name(item[0])
                            .category(item[1])
                            .subcategory(item[2])
                            .width(Double.parseDouble(item[3]))
                            .height(Double.parseDouble(item[4]))
                            .depth(Double.parseDouble(item[5]))
                            .active(true)
                            .build());
                }
            }

            // Seed demo project
            if (projects.count() == 0) {
                projects.save(Project.builder()
                        .user(demoUser)
                        .name("Living Room Design")
                        .description("A cozy modern living room")
                        .roomConfig("{\"shape\":\"rectangle\",\"width\":6,\"depth\":5,\"height\":2.8,\"wallColor\":\"#F5F5F0\",\"floorTexture\":\"wood\",\"ceilingColor\":\"#FFFFFF\"}")
                        .furnitureLayout("[]")
                        .build());

                projects.save(Project.builder()
                        .user(demoUser)
                        .name("Master Bedroom")
                        .description("Elegant master bedroom with walk-in space")
                        .roomConfig("{\"shape\":\"rectangle\",\"width\":5,\"depth\":4,\"height\":2.8,\"wallColor\":\"#E8E0D5\",\"floorTexture\":\"carpet\",\"ceilingColor\":\"#FFFFFF\"}")
                        .furnitureLayout("[]")
                        .build());
            }
        };
    }
}
