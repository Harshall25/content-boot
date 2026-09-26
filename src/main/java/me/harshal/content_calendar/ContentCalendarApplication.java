package me.harshal.content_calendar;

import me.harshal.content_calendar.hibernate.ContentHibernateRepository;
import me.harshal.content_calendar.model.Content;
import me.harshal.content_calendar.model.Status;
import me.harshal.content_calendar.model.Type;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Bean;

import java.time.LocalDateTime;

@SpringBootApplication
public class ContentCalendarApplication {

	public static void main(String[] args) {
		  SpringApplication.run(ContentCalendarApplication.class, args);

	}


	// on start of applications initalizes the hibernate utils to postgres
	@Bean
    CommandLineRunner startup(ContentHibernateRepository repository) {
		return args -> {
			System.out.println("Application startup initialization...");
			Content content = new Content(
					null,
					"Learn Spring Boot",
					"Learn Spring Boot with Hibernate",
					Status.IDEA,
					Type.ARTICLE,
					LocalDateTime.now(),
					null,
					"https://spring.io/projects/spring-boot"
			);
			repository.save(content);
			System.out.println("Initial content loaded!");
		};
	}
}
