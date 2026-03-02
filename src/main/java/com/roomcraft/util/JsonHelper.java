package com.roomcraft.util;

/**
 * JSON Helper utility
 * Converts design data to/from JSON string for storage in SQLite
 * Uses org.json library
 *
 * Methods:
 *   toJson(RoomConfig, List<FurnitureItem>) -> String
 *   roomFromJson(String json)               -> RoomConfig
 *   furnitureFromJson(String json)          -> List<FurnitureItem>
 *
 * JSON format stored in designs.design_data_json:
 * {
 *   "roomName": "...", "roomWidth": 5.0, "roomLength": 4.0, "roomHeight": 2.8,
 *   "roomShape": "Rectangle", "wallColor": "#F5F5DC", "floorColor": "#8B5A2B",
 *   "theme": "Modern",
 *   "furniture": [
 *     { "type": "Chair", "x": 1.0, "y": 1.0, "width": 0.6, "height": 0.6,
 *       "rotation": 0.0, "color": "#8B5A2B", "shaded": false, "objFilePath": "" }
 *   ]
 * }
 *
 * Assigned to: Member 2
 */
public class JsonHelper {
    // TODO: implement toJson(), roomFromJson(), furnitureFromJson()
}
