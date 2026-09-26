package me.harshal.content_calendar.controller;

import jakarta.validation.Valid;
import me.harshal.content_calendar.hibernate.ContentHibernateRepository;
import me.harshal.content_calendar.model.Content;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

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
    public List<Content> findAll() {
        return repository.findAll();
    }

    // GET /api/content/{id}
    @GetMapping("/{id}")
    public Content findById(@PathVariable Integer id) {

        return repository.findById(id)
                .orElseThrow(() ->
                        new ResponseStatusException(
                                HttpStatus.NOT_FOUND,
                                "Content not found"
                        ));
    }

    // POST /api/content
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping
    public Content create(
            @Valid @RequestBody Content content) {

        return repository.save(content);
    }

    // PUT /api/content/{id}
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PutMapping("/{id}")
    public void update(@PathVariable Integer id, @Valid @RequestBody Content content) {
        if (!repository.existsById(id)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Content not found"
            );
        }
        Content updatedContent = new Content(
                id,
                content.title(),
                content.description(),
                content.status(),
                content.contentType(),
                content.dateCreated(),
                content.dateUpdated(),
                content.url()
        );

        repository.update(updatedContent);
    }

    // DELETE /api/content/{id}
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteById(@PathVariable Integer id) {

        if (!repository.deleteById(id)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Content not found"
            );
        }
    }

    // DELETE /api/content
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping
    public void deleteAll() {
        repository.deleteAll();
    }
}