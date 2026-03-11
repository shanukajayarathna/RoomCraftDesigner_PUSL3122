package com.roomcraft.util;

import com.roomcraft.model.Design;
import com.roomcraft.model.RoomConfig;
import com.roomcraft.model.User;

public class SessionManager {

    public static User currentUser = null;
    public static RoomConfig currentRoom = null;
    public static Design currentDesign = null; // null = new design
    public static int filterUserId = -1;       // for admin filtering

    public static void clear() {
        currentUser = null;
        currentRoom = null;
        currentDesign = null;
        filterUserId = -1;
    }

    public static boolean isLoggedIn() {
        return currentUser != null;
    }

    public static boolean isAdmin() {
        return currentUser != null && "admin".equals(currentUser.role);
    }
}
