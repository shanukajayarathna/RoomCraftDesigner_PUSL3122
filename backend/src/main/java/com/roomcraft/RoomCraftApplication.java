package com.roomcraft;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class RoomCraftApplication {
    public static void main(String[] args) {
        SpringApplication.run(RoomCraftApplication.class, args);
    }
}
