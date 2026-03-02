package com.roomcraft.db;

/**
 * SQLite Database Manager
 * DB file: roomcraft.db (created in working directory on first run)
 *
 * Tables:
 *   users           (id, name, email, password_hash, role)
 *   designs         (id, user_id, name, date_created, design_data_json)
 *   furniture_library (id, type_name, default_width, default_height, obj_file_path)
 *
 * Methods (User):
 *   initialize()                                    - create tables + seed admin
 *   createUser(name, email, hash, role) -> boolean
 *   getUserByEmail(email) -> User
 *   getAllUsers() -> List<User>
 *   deleteUser(userId) -> boolean
 *   updateUser(id, name, newHash) -> boolean
 *   getDesignCountByUser(userId) -> int
 *
 * Methods (Design):
 *   saveDesign(userId, name, json) -> boolean
 *   updateDesign(designId, name, json) -> boolean
 *   getDesignsByUser(userId) -> List<Design>
 *   getAllDesigns() -> List<Design>
 *   deleteDesign(designId) -> boolean
 *
 * Methods (Furniture Library):
 *   getFurnitureLibrary() -> List<String[]>
 *   addFurnitureLibraryItem(typeName, w, h, objPath) -> boolean
 *   deleteFurnitureLibraryItem(id) -> boolean
 *
 * Assigned to: Member 2
 */
public class DatabaseManager {
    // TODO: implement all methods above
}
