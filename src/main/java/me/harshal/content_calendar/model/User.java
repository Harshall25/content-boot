package me.harshal.content_calendar.model;

import java.time.LocalDateTime;

public record User(
        String accessKey,
        LocalDateTime createdAt
) {

}
