package com.roomcraft.model;

public class Design {
    public int id;
    public int userId;
    public String name;
    public String dateCreated;
    public String designDataJson;

    public Design() {}

    public Design(int id, int userId, String name, String dateCreated, String designDataJson) {
        this.id = id;
        this.userId = userId;
        this.name = name;
        this.dateCreated = dateCreated;
        this.designDataJson = designDataJson;
    }
}
