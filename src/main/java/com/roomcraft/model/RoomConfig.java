package com.roomcraft.model;

import java.awt.Color;

public class RoomConfig {
    public String name;
    public double width;
    public double length;
    public double height;
    public String shape; // Rectangle, L-Shape, U-Shape
    public Color wallColor;
    public Color floorColor;
    public String theme;

    public RoomConfig() {
        this.name = "My Room";
        this.width = 5.0;
        this.length = 4.0;
        this.height = 2.8;
        this.shape = "Rectangle";
        this.wallColor = new Color(245, 245, 220);
        this.floorColor = new Color(139, 90, 43);
        this.theme = "Modern";
    }

    public RoomConfig(String name, double width, double length, double height,
                      String shape, Color wallColor, Color floorColor, String theme) {
        this.name = name;
        this.width = width;
        this.length = length;
        this.height = height;
        this.shape = shape;
        this.wallColor = wallColor;
        this.floorColor = floorColor;
        this.theme = theme;
    }
}