package com.roomcraft.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;

@Service
@Slf4j
public class ModelConversionService {

    /**
     * Converts an input model file into GLB using the Node/assimpjs tool.
     * Returns the path to the converted GLB. Caller should delete temp files after storing.
     */
    public Path convertToGlb(Path inputFile) throws IOException, InterruptedException {
        String tmpName = "roomcraft_conv_" + UUID.randomUUID() + ".glb";
        Path out = Files.createTempDirectory("roomcraft-conv").resolve(tmpName);

        Path toolDir = Path.of("tools", "model-converter").toAbsolutePath().normalize();
        Path script = toolDir.resolve("convert.mjs");
        if (!Files.exists(script)) throw new IOException("Converter script missing: " + script);

        ProcessBuilder pb = new ProcessBuilder(
                "node",
                script.toString(),
                inputFile.toAbsolutePath().toString(),
                out.toAbsolutePath().toString()
        );
        pb.directory(toolDir.toFile());
        pb.redirectErrorStream(true);
        Process p = pb.start();

        boolean done = p.waitFor(Duration.ofSeconds(180).toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
        String output = new String(p.getInputStream().readAllBytes());
        if (!done) {
            p.destroyForcibly();
            throw new IOException("Model conversion timed out.\n" + output);
        }
        int code = p.exitValue();
        if (code != 0) {
            throw new IOException("Model conversion failed (exit " + code + ").\n" + output);
        }
        if (!Files.exists(out) || Files.size(out) < 16) {
            throw new IOException("Model conversion produced empty output.\n" + output);
        }
        log.info("Model converted to GLB: {} bytes", Files.size(out));
        return out;
    }
}

