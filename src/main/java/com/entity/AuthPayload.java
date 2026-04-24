package com.entity;

public class AuthPayload {
    private String token;
    private User user;

    public AuthPayload(String token, User user) {
        this.token = token;
        this.user = user;
    }

    public String getToken() { return token; }
    public User getUser() { return user; }
}