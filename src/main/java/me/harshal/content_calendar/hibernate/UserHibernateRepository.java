package me.harshal.content_calendar.hibernate;

import me.harshal.content_calendar.auth.AccessKeys;
import me.harshal.content_calendar.model.User;
import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.hibernate.Transaction;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class UserHibernateRepository {

    private static final int MAX_ATTEMPTS = 5;

    private final SessionFactory sessionFactory;

    public UserHibernateRepository(SessionFactory sessionFactory) {
        this.sessionFactory = sessionFactory;
    }

    /**
     * Creates a user with a brand-new random key.
     * A collision at ~79 bits is practically impossible, but checking costs nothing.
     */
    public User create() {
        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            String accessKey = AccessKeys.generate();

            try (Session session = sessionFactory.openSession()) {
                Transaction tx = session.beginTransaction();
                try {
                    if (session.find(UserEntity.class, accessKey) != null) {
                        tx.rollback();
                        continue;
                    }
                    UserEntity user = new UserEntity(accessKey);
                    session.persist(user);
                    tx.commit();
                    return user.toRecord();
                } catch (RuntimeException e) {
                    tx.rollback();
                    throw e;
                }
            }
        }
        throw new IllegalStateException("Could not generate a unique access key");
    }

    public Optional<User> findByAccessKey(String accessKey) {
        try (Session session = sessionFactory.openSession()) {
            return Optional.ofNullable(session.find(UserEntity.class, accessKey))
                    .map(UserEntity::toRecord);
        }
    }

    public boolean exists(String accessKey) {
        return findByAccessKey(accessKey).isPresent();
    }
}
