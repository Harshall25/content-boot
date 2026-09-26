package me.harshal.content_calendar.hibernate;

import jakarta.persistence.*;
import me.harshal.content_calendar.model.Content;
import me.harshal.content_calendar.model.Status;
import me.harshal.content_calendar.model.Type;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "content")
public class ContentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Status status;

    @Enumerated(EnumType.STRING)
    @Column(name = "content_type", length = 20)
    private Type contentType;

    @Column(name = "date_created")
    private LocalDateTime dateCreated;

    @Column(name = "date_updated")
    private LocalDateTime dateUpdated;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(length = 500)
    private String url;

    // Owner of this row. Deliberately not part of the Content record,
    // so the key is never echoed back inside content JSON.
    @Column(name = "access_key", length = 19)
    private String accessKey;

    public ContentEntity() {
    }

    public Content toRecord() {
        return new Content(
                id,
                title,
                description,
                status,
                contentType,
                dateCreated,
                dateUpdated,
                dueDate,
                url
        );
    }

    public static ContentEntity fromRecord(Content content) {

        ContentEntity entity = new ContentEntity();

        entity.id = content.id();
        entity.title = content.title();
        entity.description = content.description();
        entity.status = content.status();
        entity.contentType = content.contentType();

        entity.dateCreated =
                content.dateCreated() != null
                        ? content.dateCreated()
                        : LocalDateTime.now();

        entity.dateUpdated = content.dateUpdated();
        entity.dueDate = content.dueDate();
        entity.url = content.url();

        return entity;
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }

    public Type getContentType() {
        return contentType;
    }

    public void setContentType(Type contentType) {
        this.contentType = contentType;
    }

    public LocalDateTime getDateCreated() {
        return dateCreated;
    }

    public void setDateCreated(LocalDateTime dateCreated) {
        this.dateCreated = dateCreated;
    }

    public LocalDateTime getDateUpdated() {
        return dateUpdated;
    }

    public void setDateUpdated(LocalDateTime dateUpdated) {
        this.dateUpdated = dateUpdated;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public String getAccessKey() {
        return accessKey;
    }

    public void setAccessKey(String accessKey) {
        this.accessKey = accessKey;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    @Override
    public String toString() {
        return "ContentEntity{" +
                "id=" + id +
                ", title='" + title + '\'' +
                ", status=" + status +
                ", contentType=" + contentType +
                '}';
    }
}