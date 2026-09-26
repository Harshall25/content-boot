package me.harshal.content_calendar.model;

import jakarta.validation.constraints.NotEmpty;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record Content(
        Integer id,
        @NotEmpty String title,
        String description,
        Status status,
        Type contentType,
        LocalDateTime dateCreated,
        LocalDateTime dateUpdated,
        LocalDate dueDate,
        String url
) {

}

