package com.roomcraft.db;

import com.roomcraft.model.Design;
import com.roomcraft.model.User;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;

public class DatabaseManager {

    private static final String DB_URL = "jdbc:sqlite:roomcraft.db";

    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL);
    }

    public static void initialize() {
        try (Connection conn = getConnection(); Statement stmt = conn.createStatement()) {
            stmt.executeUpdate(
                    "CREATE TABLE IF NOT EXISTS users (" +
                            "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
                            "  name TEXT NOT NULL," +
                            "  email TEXT UNIQUE NOT NULL," +
                            "  password_hash TEXT NOT NULL," +
                            "  role TEXT DEFAULT 'user'" +
                            ")"
            );
            stmt.executeUpdate(
                    "CREATE TABLE IF NOT EXISTS designs (" +
                            "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
                            "  user_id INTEGER," +
                            "  name TEXT," +
                            "  date_created TEXT," +
                            "  design_data_json TEXT," +
                            "  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE" +
                            ")"
            );
            stmt.executeUpdate(
                    "CREATE TABLE IF NOT EXISTS furniture_library (" +
                            "  id INTEGER PRIMARY KEY AUTOINCREMENT," +
                            "  type_name TEXT," +
                            "  default_width REAL," +
                            "  default_height REAL," +
                            "  obj_file_path TEXT" +
                            ")"
            );

            // Seed default admin if no users exist
            ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM users");
            if (rs.next() && rs.getInt(1) == 0) {
                String hash = com.roomcraft.util.PasswordHasher.hash("admin123");
                PreparedStatement ps = conn.prepareStatement(
                        "INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)"
                );
                ps.setString(1, "Admin");
                ps.setString(2, "admin@roomcraft.com");
                ps.setString(3, hash);
                ps.setString(4, "admin");
                ps.executeUpdate();
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

    // ---- USER OPERATIONS ----

    public static boolean createUser(String name, String email, String passwordHash, String role) {
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "INSERT INTO users (name, email, password_hash, role) VALUES (?,?,?,?)"
             )) {
            ps.setString(1, name);
            ps.setString(2, email);
            ps.setString(3, passwordHash);
            ps.setString(4, role);
            ps.executeUpdate();
            return true;
        } catch (SQLException e) {
            return false;
        }
    }

    public static User getUserByEmail(String email) {
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT * FROM users WHERE email = ?"
             )) {
            ps.setString(1, email);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) {
                return new User(
                        rs.getInt("id"),
                        rs.getString("name"),
                        rs.getString("email"),
                        rs.getString("password_hash"),
                        rs.getString("role")
                );
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return null;
    }

    public static List<User> getAllUsers() {
        List<User> users = new ArrayList<>();
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT * FROM users WHERE role != 'admin'"
             )) {
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                users.add(new User(
                        rs.getInt("id"),
                        rs.getString("name"),
                        rs.getString("email"),
                        rs.getString("password_hash"),
                        rs.getString("role")
                ));
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return users;
    }

    public static boolean deleteUser(int userId) {
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement("DELETE FROM users WHERE id = ?")) {
            ps.setInt(1, userId);
            ps.executeUpdate();
            // also delete designs
            PreparedStatement ps2 = conn.prepareStatement("DELETE FROM designs WHERE user_id = ?");
            ps2.setInt(1, userId);
            ps2.executeUpdate();
            return true;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public static boolean updateUser(int id, String name, String newHash) {
        try (Connection conn = getConnection()) {
            if (newHash != null && !newHash.isEmpty()) {
                PreparedStatement ps = conn.prepareStatement(
                        "UPDATE users SET name=?, password_hash=? WHERE id=?"
                );
                ps.setString(1, name);
                ps.setString(2, newHash);
                ps.setInt(3, id);
                ps.executeUpdate();
            } else {
                PreparedStatement ps = conn.prepareStatement(
                        "UPDATE users SET name=? WHERE id=?"
                );
                ps.setString(1, name);
                ps.setInt(2, id);
                ps.executeUpdate();
            }
            return true;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public static int getDesignCountByUser(int userId) {
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT COUNT(*) FROM designs WHERE user_id = ?"
             )) {
            ps.setInt(1, userId);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) return rs.getInt(1);
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return 0;
    }

    // ---- DESIGN OPERATIONS ----

    public static boolean saveDesign(int userId, String name, String json) {
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "INSERT INTO designs (user_id, name, date_created, design_data_json) VALUES (?,?,datetime('now'),?)"
             )) {
            ps.setInt(1, userId);
            ps.setString(2, name);
            ps.setString(3, json);
            ps.executeUpdate();
            return true;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public static boolean updateDesign(int designId, String name, String json) {
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "UPDATE designs SET name=?, design_data_json=?, date_created=datetime('now') WHERE id=?"
             )) {
            ps.setString(1, name);
            ps.setString(2, json);
            ps.setInt(3, designId);
            ps.executeUpdate();
            return true;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public static List<Design> getDesignsByUser(int userId) {
        List<Design> list = new ArrayList<>();
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "SELECT * FROM designs WHERE user_id = ? ORDER BY date_created DESC"
             )) {
            ps.setInt(1, userId);
            ResultSet rs = ps.executeQuery();
            while (rs.next()) {
                list.add(new Design(
                        rs.getInt("id"),
                        rs.getInt("user_id"),
                        rs.getString("name"),
                        rs.getString("date_created"),
                        rs.getString("design_data_json")
                ));
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public static List<Design> getAllDesigns() {
        List<Design> list = new ArrayList<>();
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(
                     "SELECT d.*, u.name as owner FROM designs d JOIN users u ON d.user_id = u.id ORDER BY d.date_created DESC"
             )) {
            while (rs.next()) {
                Design d = new Design(
                        rs.getInt("id"),
                        rs.getInt("user_id"),
                        rs.getString("name"),
                        rs.getString("date_created"),
                        rs.getString("design_data_json")
                );
                list.add(d);
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public static boolean deleteDesign(int designId) {
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement("DELETE FROM designs WHERE id = ?")) {
            ps.setInt(1, designId);
            ps.executeUpdate();
            return true;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    // ---- FURNITURE LIBRARY ----

    public static List<String[]> getFurnitureLibrary() {
        List<String[]> list = new ArrayList<>();
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT * FROM furniture_library")) {
            while (rs.next()) {
                list.add(new String[]{
                        String.valueOf(rs.getInt("id")),
                        rs.getString("type_name"),
                        String.valueOf(rs.getDouble("default_width")),
                        String.valueOf(rs.getDouble("default_height")),
                        rs.getString("obj_file_path")
                });
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return list;
    }

    public static boolean addFurnitureLibraryItem(String typeName, double w, double h, String objPath) {
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(
                     "INSERT INTO furniture_library (type_name, default_width, default_height, obj_file_path) VALUES (?,?,?,?)"
             )) {
            ps.setString(1, typeName);
            ps.setDouble(2, w);
            ps.setDouble(3, h);
            ps.setString(4, objPath);
            ps.executeUpdate();
            return true;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public static boolean deleteFurnitureLibraryItem(int id) {
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement("DELETE FROM furniture_library WHERE id = ?")) {
            ps.setInt(1, id);
            ps.executeUpdate();
            return true;
        } catch (SQLException e) {
            e.printStackTrace();
            return false;
        }
    }

    public static String getOwnerName(int userId) {
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement("SELECT name FROM users WHERE id = ?")) {
            ps.setInt(1, userId);
            ResultSet rs = ps.executeQuery();
            if (rs.next()) return rs.getString("name");
        } catch (SQLException e) {
            e.printStackTrace();
        }
        return "Unknown";
    }
}