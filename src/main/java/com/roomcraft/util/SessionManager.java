package com.roomcraft.util;

/**
 * Session Manager - global state holder for the running app
 * Static fields:
 *   currentUser   (User)    - the logged-in user, null if not logged in
 *   currentRoom   (RoomConfig) - the room being designed
 *   currentDesign (Design)  - the design being edited, null if new
 *   filterUserId  (int)     - admin filter: show designs for this user (-1 = all)
 *
 * Methods:
 *   clear()     - reset all fields to null / -1
 *   isLoggedIn() -> boolean
 *   isAdmin()    -> boolean
 *
 * Assigned to: Member 2
 */
public class SessionManager {
    // TODO: implement static fields and methods
}
