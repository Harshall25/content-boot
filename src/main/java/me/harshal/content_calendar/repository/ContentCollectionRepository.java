package me.harshal.content_calendar.repository;

import me.harshal.content_calendar.model.Content;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * This basically is just an in memory database,
 * just connect to db if you want.
 */
@Repository
public class ContentCollectionRepository {
    private final List<Content> contentList = new ArrayList<>();

    public ContentCollectionRepository(){

    }

    public List<Content> findAll(){
        return contentList;
    }

    public Optional<Content> findById(Integer id){
        return contentList.stream().filter(content -> content.id().equals(id)).findFirst();
    }

    public void save(Content content) {
        contentList.removeIf(c -> c.id().equals(content.id()));
        contentList.add(content);
    }

    public boolean existById(Integer realId) {
        return contentList.stream().anyMatch(content -> content.id().equals(realId));
    }

    public void delete(Integer realId) {
        contentList.removeIf(c -> c.id().equals(realId));
    }
}
