package com.roomcraft.model;

import java.awt.Color;

public class FurnitureItem {
    public String type;
    public double x;       // meters from left wall
    public double y;       // meters from top wall
    public double width;   // meters
    public double height;  // meters (depth in 2D)
    public double rotation; // degrees
    public Color color;
    public boolean shaded;
    public String objFilePath; // path to .obj file, empty if default

    public FurnitureItem() {}

    public FurnitureItem(String type, double x, double y, double width, double height,
                         double rotation, Color color, boolean shaded, String objFilePath) {
        this.type = type;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.rotation = rotation;
        this.color = color;
        this.shaded = shaded;
        this.objFilePath = objFilePath;
    }

    public FurnitureItem copy() {
        return new FurnitureItem(type, x, y, width, height, rotation,
                new Color(color.getRed(), color.getGreen(), color.getBlue()),
                shaded, objFilePath);
    }

    public double get3DHeight() {
        switch (type) {
            case "Chair":    return 0.9;
            case "Table":    return 0.75;
            case "Bed":      return 0.6;
            case "Sofa":     return 0.85;
            case "Cupboard": return 1.8;
            default:         return 1.0;
        }
    }
}

