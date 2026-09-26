package me.harshal.content_calendar.hibernate;

import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.springframework.context.annotation.Bean;

import javax.sql.DataSource;

/**
 * Builds the single SessionFactory as a Spring bean instead of a static singleton.
 *
 * Spring Boot already built a HikariCP-backed DataSource from the
 * spring.datasource.* properties (HikariCP + the Postgres driver are on the
 * classpath, that's the only trigger it needs) and offers it here as a bean -
 * this class just hands that same pooled DataSource to Hibernate instead of
 * letting Hibernate open its own unpooled connections.
 *
 * SessionFactory  = expensive to build, created ONCE by Spring, thread-safe.
 * Session         = cheap, one per unit of work, NOT thread-safe, always closed
 *                   (ContentHibernateRepository does that with try-with-resources).
 */
@org.springframework.context.annotation.Configuration
public class HibernateConfig {

    @Bean
    public SessionFactory sessionFactory(DataSource dataSource) {
        Configuration configuration = new Configuration();

        configuration.addAnnotatedClass(ContentEntity.class);   // register every @Entity here
        configuration.addAnnotatedClass(UserEntity.class);

        // Hand Hibernate the pooled connections instead of raw driver settings
        configuration.getProperties().put("hibernate.connection.datasource", dataSource);

        // validate = check the entities match the existing tables,
        // never change it. Run schema.sql yourself first.
        configuration.setProperty("hibernate.hbm2ddl.auto", "validate");

        // Print the SQL Hibernate generates - keep this on while learning.
        configuration.setProperty("hibernate.show_sql", "true");
        configuration.setProperty("hibernate.format_sql", "true");

        return configuration.buildSessionFactory();
    }
}
