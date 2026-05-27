package com.entity;

public enum TaskStatus {
    TODO(0),
    IN_PROGRESS(1),
    REVIEW(2);

    private final int code;

    TaskStatus(int code) {
        this.code = code;
    }

    public int getCode() {
        return code;
    }
}