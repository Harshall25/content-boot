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

@Repository
public class ContentHibernateRepository {

    private final SessionFactory sessionFactory;

    public ContentHibernateRepository(SessionFactory sessionFactory) {
        this.sessionFactory = sessionFactory;
    }

    public Content save(Content content) {
        try (Session session = sessionFactory.openSession()) {
            Transaction tx = session.beginTransaction();
            try {
                ContentEntity entity = ContentEntity.fromRecord(content);
                session.persist(entity);
                tx.commit();
                return entity.toRecord();
            } catch (RuntimeException e) {
                tx.rollback();
                throw e;
            }
        }
    }

    public Optional<Content> findById(int id) {

        try (Session session =
                     sessionFactory.openSession()) {

            ContentEntity entity =
                    session.find(ContentEntity.class, id);

            return Optional.ofNullable(entity)
                    .map(ContentEntity::toRecord);
        }
    }

    public List<Content> findAll() {

        try (Session session =
                     sessionFactory.openSession()) {

            return session
                    .createQuery(
                            "FROM ContentEntity ORDER BY id",
                            ContentEntity.class
                    )
                    .list()
                    .stream()
                    .map(ContentEntity::toRecord)
                    .toList();
        }
    }

    public List<Content> findByStatus(Status status) {

        try (Session session =
                     sessionFactory.openSession()) {

            return session
                    .createQuery(
                            """
                            FROM ContentEntity
                            WHERE status = :status
                            ORDER BY id
                            """,
                            ContentEntity.class
                    )
                    .setParameter("status", status)
                    .list()
                    .stream()
                    .map(ContentEntity::toRecord)
                    .toList();
        }
    }

    public List<Content> findByContentType(Type contentType) {

        try (Session session =
                     sessionFactory.openSession()) {

            return session
                    .createQuery(
                            """
                            FROM ContentEntity
                            WHERE contentType = :type
                            ORDER BY id
                            """,
                            ContentEntity.class
                    )
                    .setParameter("type", contentType)
                    .list()
                    .stream()
                    .map(ContentEntity::toRecord)
                    .toList();
        }
    }

    public List<Content> searchByTitle(String fragment) {
        try (Session session =
                     sessionFactory.openSession()) {

            return session
                    .createQuery(
                            """
                            FROM ContentEntity
                            WHERE LOWER(title) LIKE :query
                            ORDER BY id
                            """,
                            ContentEntity.class
                    )
                    .setParameter(
                            "query",
                            "%" + fragment.toLowerCase() + "%"
                    )
                    .list()
                    .stream()
                    .map(ContentEntity::toRecord)
                    .toList();
        }
    }

    public long countByStatus(Status status) {
        try (Session session = sessionFactory.openSession()) {
            return session
                    .createQuery(
                            """
                            SELECT COUNT(c)
                            FROM ContentEntity c
                            WHERE c.status = :status
                            """,
                            Long.class
                    )
                    .setParameter("status", status)
                    .getSingleResult();
        }
    }

    public boolean update(Content content) {
        try (Session session = sessionFactory.openSession()) {
            Transaction tx = session.beginTransaction();
            try {
                ContentEntity entity =
                        session.find(ContentEntity.class, content.id());
                if (entity == null) {
                    tx.rollback();
                    return false;
                }
                entity.setTitle(content.title());
                entity.setDescription(content.description());
                entity.setStatus(content.status());
                entity.setContentType(content.contentType());
                entity.setDateUpdated(LocalDateTime.now());
                entity.setUrl(content.url());
                tx.commit();
                return true;

            } catch (RuntimeException e) {
                tx.rollback();
                throw e;
            }
        }
    }

    public boolean updateStatus(int id, Status newStatus) {

        try (Session session =
                     sessionFactory.openSession()) {

            Transaction tx = session.beginTransaction();

            try {
                ContentEntity entity =
                        session.find(ContentEntity.class, id);

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

    public boolean deleteById(int id) {

        try (Session session =
                     sessionFactory.openSession()) {

            Transaction tx = session.beginTransaction();

            try {
                ContentEntity entity =
                        session.find(ContentEntity.class, id);

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

    public void deleteAll() {
        try (Session session =
                     sessionFactory.openSession()) {
            Transaction tx = session.beginTransaction();
            try {
                session.createMutationQuery(
                        "DELETE FROM ContentEntity"
                ).executeUpdate();
                tx.commit();
            } catch (RuntimeException e) {
                tx.rollback();
                throw e;
            }
        }
    }

    public boolean existsById(int id) {

        try (Session session =
                     sessionFactory.openSession()) {

            return session.find(ContentEntity.class, id) != null;
        }
    }
}