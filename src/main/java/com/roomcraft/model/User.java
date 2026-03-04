package com.roomcraft.model;

public class User {
    public int id;
    public String name;
    public String email;
    public String passwordHash;
    public String role;

    public User() {}

    public User(int id, String name, String email, String passwordHash, String role) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.passwordHash = passwordHash;
        this.role = role;
    }
}

