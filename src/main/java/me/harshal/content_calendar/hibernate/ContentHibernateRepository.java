package me.harshal.content_calendar.hibernate;

import me.harshal.content_calendar.model.Content;
import me.harshal.content_calendar.model.Status;
import me.harshal.content_calendar.model.Type;
import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.hibernate.Transaction;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Every method takes the caller's access key and only ever touches rows that
 * belong to it. That "and accessKey = :key" in each query is the whole reason
 * one user cannot see or delete another user's content - never drop it.
 */
@Repository
public class ContentHibernateRepository {

    private final SessionFactory sessionFactory;

    public ContentHibernateRepository(SessionFactory sessionFactory) {
        this.sessionFactory = sessionFactory;
    }

    public Content save(String accessKey, Content content) {
        try (Session session = sessionFactory.openSession()) {
            Transaction tx = session.beginTransaction();
            try {
                ContentEntity entity = ContentEntity.fromRecord(content);
                entity.setId(null);                 // the database assigns ids, never the client
                entity.setAccessKey(accessKey);
                session.persist(entity);
                tx.commit();
                return entity.toRecord();
            } catch (RuntimeException e) {
                tx.rollback();
                throw e;
            }
        }
    }

    public Optional<Content> findById(String accessKey, int id) {
        try (Session session = sessionFactory.openSession()) {
            return Optional.ofNullable(findOwned(session, accessKey, id))
                    .map(ContentEntity::toRecord);
        }
    }

    public List<Content> findAll(String accessKey) {
        try (Session session = sessionFactory.openSession()) {
            return session
                    .createQuery(
                            """
                            FROM ContentEntity
                            WHERE accessKey = :key
                            ORDER BY id
                            """,
                            ContentEntity.class
                    )
                    .setParameter("key", accessKey)
                    .list()
                    .stream()
                    .map(ContentEntity::toRecord)
                    .toList();
        }
    }

    public List<Content> findByStatus(String accessKey, Status status) {
        try (Session session = sessionFactory.openSession()) {
            return session
                    .createQuery(
                            """
                            FROM ContentEntity
                            WHERE accessKey = :key AND status = :status
                            ORDER BY id
                            """,
                            ContentEntity.class
                    )
                    .setParameter("key", accessKey)
                    .setParameter("status", status)
                    .list()
                    .stream()
                    .map(ContentEntity::toRecord)
                    .toList();
        }
    }

    public List<Content> findByContentType(String accessKey, Type contentType) {
        try (Session session = sessionFactory.openSession()) {
            return session
                    .createQuery(
                            """
                            FROM ContentEntity
                            WHERE accessKey = :key AND contentType = :type
                            ORDER BY id
                            """,
                            ContentEntity.class
                    )
                    .setParameter("key", accessKey)
                    .setParameter("type", contentType)
                    .list()
                    .stream()
                    .map(ContentEntity::toRecord)
                    .toList();
        }
    }

    public List<Content> searchByTitle(String accessKey, String fragment) {
        try (Session session = sessionFactory.openSession()) {
            return session
                    .createQuery(
                            """
                            FROM ContentEntity
                            WHERE accessKey = :key AND LOWER(title) LIKE :query
                            ORDER BY id
                            """,
                            ContentEntity.class
                    )
                    .setParameter("key", accessKey)
                    .setParameter("query", "%" + fragment.toLowerCase() + "%")
                    .list()
                    .stream()
                    .map(ContentEntity::toRecord)
                    .toList();
        }
    }

    public long countByStatus(String accessKey, Status status) {
        try (Session session = sessionFactory.openSession()) {
            return session
                    .createQuery(
                            """
                            SELECT COUNT(c)
                            FROM ContentEntity c
                            WHERE c.accessKey = :key AND c.status = :status
                            """,
                            Long.class
                    )
                    .setParameter("key", accessKey)
                    .setParameter("status", status)
                    .getSingleResult();
        }
    }

    /** Load-then-change inside one transaction; dirty checking writes the UPDATE on commit. */
    public boolean update(String accessKey, Content content) {
        try (Session session = sessionFactory.openSession()) {
            Transaction tx = session.beginTransaction();
            try {
                ContentEntity entity = findOwned(session, accessKey, content.id());
                if (entity == null) {
                    tx.rollback();
                    return false;
                }
                entity.setTitle(content.title());
                entity.setDescription(content.description());
                entity.setStatus(content.status());
                entity.setContentType(content.contentType());
                entity.setDueDate(content.dueDate());
                entity.setUrl(content.url());
                entity.setDateUpdated(LocalDateTime.now());
                tx.commit();
                return true;
            } catch (RuntimeException e) {
                tx.rollback();
                throw e;
            }
        }
    }

    public boolean updateStatus(String accessKey, int id, Status newStatus) {
        try (Session session = sessionFactory.openSession()) {
            Transaction tx = session.beginTransaction();
            try {
                ContentEntity entity = findOwned(session, accessKey, id);
                if (entity == null) {
                    tx.rollback();
                    return false;
                }
                entity.setStatus(newStatus);
                entity.setDateUpdated(LocalDateTime.now());
                tx.commit();
                return true;
            } catch (RuntimeException e) {
                tx.rollback();
                throw e;
            }
        }
    }

    public boolean deleteById(String accessKey, int id) {
        try (Session session = sessionFactory.openSession()) {
            Transaction tx = session.beginTransaction();
            try {
                ContentEntity entity = findOwned(session, accessKey, id);
                if (entity == null) {
                    tx.rollback();
                    return false;
                }
                session.remove(entity);
                tx.commit();
                return true;
            } catch (RuntimeException e) {
                tx.rollback();
                throw e;
            }
        }
    }

    /** Deletes only this user's content - never the whole table. */
    public void deleteAll(String accessKey) {
        try (Session session = sessionFactory.openSession()) {
            Transaction tx = session.beginTransaction();
            try {
                session.createMutationQuery("DELETE FROM ContentEntity WHERE accessKey = :key")
                        .setParameter("key", accessKey)
                        .executeUpdate();
                tx.commit();
            } catch (RuntimeException e) {
                tx.rollback();
                throw e;
            }
        }
    }

    public boolean existsById(String accessKey, int id) {
        try (Session session = sessionFactory.openSession()) {
            return findOwned(session, accessKey, id) != null;
        }
    }

    /**
     * Finds a row only if it belongs to this key. A row owned by someone else
     * comes back as null, exactly like a row that does not exist, so the API
     * answers 404 and never even reveals that the id is taken.
     */
    private ContentEntity findOwned(Session session, String accessKey, Integer id) {
        if (id == null) {
            return null;
        }
        return session
                .createQuery(
                        "FROM ContentEntity WHERE id = :id AND accessKey = :key",
                        ContentEntity.class
                )
                .setParameter("id", id)
                .setParameter("key", accessKey)
                .uniqueResult();
    }
}
