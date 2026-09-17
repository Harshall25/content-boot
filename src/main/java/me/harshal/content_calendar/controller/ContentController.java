package me.harshal.content_calendar.controller;

import me.harshal.content_calendar.model.Content;
import me.harshal.content_calendar.repository.ContentCollectionRepository;
import org.springframework.http.HttpCookie;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

/**
 * To create APIs
 * 1. @RestController defines this is an api
 * 2. @RequestMapping tells that how to reach this api in the url
 **/

@CrossOrigin("8080")
@RestController
@RequestMapping("/api/content")
public class ContentController {

    private final ContentCollectionRepository repository;

    private ContentController(ContentCollectionRepository repository) {
        this.repository = repository;
    }

    // read all
    // make request and get all the content in the system
    @GetMapping("")
    public List<Content> findAll(){
        return repository.findAll();
    }

    // read by id
    @GetMapping("/{id}")
    public Content findById(@PathVariable String id){
        Integer realId = Integer.parseInt(id);
        return repository.findById(realId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,"Content Not found"));
    }

    // create
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/post")
    public void create(@RequestBody Content content){
        repository.save(content);
    }

    //update
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PutMapping("/{id}")
    public void update(@RequestBody Content content, @PathVariable String id){
        Integer realId = Integer.parseInt(id);
        if(!repository.existById(realId)){
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Content Not found");
        }
        repository.save(content);
    }

    //delete
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @DeleteMapping("/{id}")
    public void deleteById(@PathVariable String id){
        Integer realId = Integer.parseInt(id);
        if(!repository.existById(realId)){
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Content Not found");
        }
        repository.delete(realId);
    }

}
