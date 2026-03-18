package com.roomcraft.service;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class FileStorageService {

    private final Path rootDir;

    public FileStorageService() {
        this.rootDir = Path.of(System.getProperty("user.home"), "roomcraft-data", "uploads");
    }

    public String store(byte[] bytes, String originalFilename) throws IOException {
        Files.createDirectories(rootDir);
        String ext = "";
        if (originalFilename != null) {
            int dot = originalFilename.lastIndexOf('.');
            if (dot >= 0 && dot < originalFilename.length() - 1) ext = originalFilename.substring(dot).toLowerCase();
        }
        String name = UUID.randomUUID() + ext;
        Path dst = rootDir.resolve(name).normalize();
        Files.write(dst, bytes);
        return name;
    }

    public String storeFromTemp(Path tmp, String originalFilename) throws IOException {
        Files.createDirectories(rootDir);
        String ext = "";
        if (originalFilename != null) {
            int dot = originalFilename.lastIndexOf('.');
            if (dot >= 0 && dot < originalFilename.length() - 1) ext = originalFilename.substring(dot).toLowerCase();
        }
        String name = UUID.randomUUID() + ext;
        Path dst = rootDir.resolve(name).normalize();
        Files.move(tmp, dst, StandardCopyOption.REPLACE_EXISTING);
        return name;
    }

    public Resource loadAsResource(String filename) {
        Path f = rootDir.resolve(filename).normalize();
        return new FileSystemResource(f.toFile());
    }

    public boolean exists(String filename) {
        return Files.exists(rootDir.resolve(filename).normalize());
    }

    public boolean delete(String filename) {
        try {
            Path f = rootDir.resolve(filename).normalize();
            return Files.deleteIfExists(f);
        } catch (IOException e) {
            return false;
        }
    }
}

