package me.harshal.content_calendar.controller;

import me.harshal.content_calendar.auth.AccessKeyInterceptor;
import me.harshal.content_calendar.hibernate.UserHibernateRepository;
import me.harshal.content_calendar.model.User;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserHibernateRepository repository;

    public UserController(UserHibernateRepository repository) {
        this.repository = repository;
    }

    // POST /api/users  -> "Create unique key"
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public User create() {
        return repository.create();
    }

    // GET /api/users/me  (header X-Access-Key) -> "Enter your access key"
    // The interceptor already rejected unknown keys with 401, so reaching here means it is valid.
    @GetMapping("/me")
    public User me(@RequestAttribute(AccessKeyInterceptor.ATTRIBUTE) String accessKey) {
        return repository.findByAccessKey(accessKey)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.UNAUTHORIZED,
                                "Unknown access key"
                        ));
    }
}
