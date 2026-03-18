package com.roomcraft.controller;

import com.roomcraft.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Files;

@RestController
@RequestMapping("/files")
@RequiredArgsConstructor
public class FileController {

    private final FileStorageService storage;

    @GetMapping("/{filename}")
    public ResponseEntity<Resource> getFile(@PathVariable String filename) {
        if (filename == null || filename.contains("..") || filename.contains("/") || filename.contains("\\")) {
            return ResponseEntity.badRequest().build();
        }
        if (!storage.exists(filename)) return ResponseEntity.notFound().build();
        Resource res = storage.loadAsResource(filename);
        try {
            String contentType = Files.probeContentType(res.getFile().toPath());
            MediaType mt = contentType != null ? MediaType.parseMediaType(contentType) : MediaType.APPLICATION_OCTET_STREAM;
            return ResponseEntity.ok()
                    .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                    .header("Access-Control-Allow-Origin", "*")
                    .contentType(mt)
                    .body(res);
        } catch (Exception e) {
            return ResponseEntity.ok()
                    .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                    .header("Access-Control-Allow-Origin", "*")
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .body(res);
        }
    }
}

