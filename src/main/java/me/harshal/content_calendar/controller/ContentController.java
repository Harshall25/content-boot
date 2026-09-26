package me.harshal.content_calendar.controller;

import jakarta.validation.Valid;
import me.harshal.content_calendar.auth.AccessKeyInterceptor;
import me.harshal.content_calendar.hibernate.ContentHibernateRepository;
import me.harshal.content_calendar.model.Content;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Every request here must carry an X-Access-Key header. AccessKeyInterceptor
 * checks it before any method runs and hands the key over as a request attribute.
 */
@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/api/content")
public class ContentController {

    private final ContentHibernateRepository repository;

    public ContentController(ContentHibernateRepository repository) {
        this.repository = repository;
    }

    // GET /api/content
    @GetMapping
    public List<Content> findAll(@RequestAttribute(AccessKeyInterceptor.ATTRIBUTE) String accessKey) {
        return repository.findAll(accessKey);
    }

    // GET /api/content/{id}
    @GetMapping("/{id}")
    public Content findById(@RequestAttribute(AccessKeyInterceptor.ATTRIBUTE) String accessKey,
                            @PathVariable Integer id) {

        return repository.findById(accessKey, id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Content not found"
                        ));
    }

    // POST /api/content
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public Content create(@RequestAttribute(AccessKeyInterceptor.ATTRIBUTE) String accessKey,
                          @Valid @RequestBody Content content) {

        return repository.save(accessKey, content);
    }

    // PUT /api/content/{id}
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PutMapping("/{id}")
    public void update(@RequestAttribute(AccessKeyInterceptor.ATTRIBUTE) String accessKey,
                       @PathVariable Integer id,
                       @Valid @RequestBody Content content) {

        Content updatedContent = new Content(
                id,
                content.title(),
                content.description(),
                content.status(),
                content.contentType(),
                content.dateCreated(),
                content.dateUpdated(),
                content.dueDate(),
                content.url()
        );

        if (!repository.update(accessKey, updatedContent)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Content not found"
            );
        }
    }

    // DELETE /api/content/{id}
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteById(@RequestAttribute(AccessKeyInterceptor.ATTRIBUTE) String accessKey,
                           @PathVariable Integer id) {

        if (!repository.deleteById(accessKey, id)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Content not found"
            );
        }
    }

    // DELETE /api/content  (only this user's content)
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping
    public void deleteAll(@RequestAttribute(AccessKeyInterceptor.ATTRIBUTE) String accessKey) {
        repository.deleteAll(accessKey);
    }
}
