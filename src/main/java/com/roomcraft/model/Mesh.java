package com.roomcraft.model;

import java.util.List;

public class Mesh {
    public List<double[]> vertices; // each is [x, y, z]
    public List<int[]> faces;       // each is array of vertex indices

    public Mesh(List<double[]> vertices, List<int[]> faces) {
        this.vertices = vertices;
        this.faces = faces;
    }
}
