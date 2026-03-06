package com.roomcraft.util;

import com.roomcraft.model.FurnitureItem;
import com.roomcraft.model.RoomConfig;
import org.json.JSONArray;
import org.json.JSONObject;

import java.awt.Color;
import java.util.ArrayList;
import java.util.List;

public class JsonHelper {

    public static String toJson(RoomConfig room, List<FurnitureItem> furniture) {
        JSONObject obj = new JSONObject();
        obj.put("roomName", room.name);
        obj.put("roomWidth", room.width);
        obj.put("roomLength", room.length);
        obj.put("roomHeight", room.height);
        obj.put("roomShape", room.shape);
        obj.put("wallColor", colorToHex(room.wallColor));
        obj.put("floorColor", colorToHex(room.floorColor));
        obj.put("theme", room.theme);

        JSONArray arr = new JSONArray();
        for (FurnitureItem item : furniture) {
            JSONObject f = new JSONObject();
            f.put("type", item.type);
            f.put("x", item.x);
            f.put("y", item.y);
            f.put("width", item.width);
            f.put("height", item.height);
            f.put("rotation", item.rotation);
            f.put("color", colorToHex(item.color));
            f.put("shaded", item.shaded);
            f.put("objFilePath", item.objFilePath == null ? "" : item.objFilePath);
            arr.put(f);
        }
        obj.put("furniture", arr);
        return obj.toString();
    }

    public static RoomConfig roomFromJson(String json) {
        JSONObject obj = new JSONObject(json);
        RoomConfig room = new RoomConfig();
        room.name = obj.optString("roomName", "My Room");
        room.width = obj.optDouble("roomWidth", 5.0);
        room.length = obj.optDouble("roomLength", 4.0);
        room.height = obj.optDouble("roomHeight", 2.8);
        room.shape = obj.optString("roomShape", "Rectangle");
        room.wallColor = hexToColor(obj.optString("wallColor", "#F5F5DC"));
        room.floorColor = hexToColor(obj.optString("floorColor", "#8B5A2B"));
        room.theme = obj.optString("theme", "Modern");
        return room;
    }

    public static List<FurnitureItem> furnitureFromJson(String json) {
        List<FurnitureItem> list = new ArrayList<>();
        JSONObject obj = new JSONObject(json);
        JSONArray arr = obj.optJSONArray("furniture");
        if (arr == null) return list;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject f = arr.getJSONObject(i);
            FurnitureItem item = new FurnitureItem();
            item.type = f.optString("type", "Chair");
            item.x = f.optDouble("x", 0);
            item.y = f.optDouble("y", 0);
            item.width = f.optDouble("width", 0.6);
            item.height = f.optDouble("height", 0.6);
            item.rotation = f.optDouble("rotation", 0);
            item.color = hexToColor(f.optString("color", "#8B5A2B"));
            item.shaded = f.optBoolean("shaded", false);
            item.objFilePath = f.optString("objFilePath", "");
            list.add(item);
        }
        return list;
    }

    private static String colorToHex(Color c) {
        return String.format("#%02X%02X%02X", c.getRed(), c.getGreen(), c.getBlue());
    }

    private static Color hexToColor(String hex) {
        try {
            return Color.decode(hex);
        } catch (Exception e) {
            return Color.LIGHT_GRAY;
        }
    }
}
