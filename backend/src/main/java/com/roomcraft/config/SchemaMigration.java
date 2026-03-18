package com.roomcraft.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Lightweight schema patching for the file-based H2 database.
 * Hibernate "update" is not always reliable for adding NOT NULL / enum-like columns.
 */
@Configuration
@RequiredArgsConstructor
public class SchemaMigration {

    private final JdbcTemplate jdbc;

    @Bean
    CommandLineRunner patchSchema() {
        return args -> {
            // furniture_models additions
            try { jdbc.execute("ALTER TABLE furniture_models ADD COLUMN IF NOT EXISTS top_view_url VARCHAR(255)"); } catch (Exception ignored) {}
            try { jdbc.execute("ALTER TABLE furniture_models ADD COLUMN IF NOT EXISTS visibility VARCHAR(16) DEFAULT 'PUBLIC'"); } catch (Exception ignored) {}

            // Backfill visibility if column exists but values are null
            try { jdbc.update("UPDATE furniture_models SET visibility='PUBLIC' WHERE visibility IS NULL"); } catch (Exception ignored) {}

            // projects additions (for plan thumbnails)
            try { jdbc.execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(255)"); } catch (Exception ignored) {}
        };
    }
}

