package me.harshal.content_calendar.hibernate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import me.harshal.content_calendar.model.User;

import java.time.LocalDateTime;

/**
 * One row of app_user ("user" is a reserved word in PostgreSQL).
 * The access key itself is the primary key - it is the user's identity.
 */
@Entity
@Table(name = "app_user")
public class UserEntity {

    @Id
    @Column(name = "access_key", length = 19)
    private String accessKey;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public UserEntity() {
    }

    public UserEntity(String accessKey) {
        this.accessKey = accessKey;
        this.createdAt = LocalDateTime.now();
    }

    public User toRecord() {
        return new User(accessKey, createdAt);
    }

    public String getAccessKey() {
        return accessKey;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
