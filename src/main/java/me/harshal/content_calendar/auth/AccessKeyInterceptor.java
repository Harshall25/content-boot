package me.harshal.content_calendar.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import me.harshal.content_calendar.hibernate.UserHibernateRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Runs before every protected controller method (see MyWebConfig for which paths).
 *
 * Reads the X-Access-Key header, checks the key exists in app_user, and stores
 * the normalized key on the request so controllers can read it with
 * {@code @RequestAttribute(AccessKeyInterceptor.ATTRIBUTE) String accessKey}.
 * No valid key -> 401, and the controller never runs.
 */
@Component
public class AccessKeyInterceptor implements HandlerInterceptor {

    public static final String HEADER = "X-Access-Key";
    public static final String ATTRIBUTE = "accessKey";

    private final UserHibernateRepository users;

    public AccessKeyInterceptor(UserHibernateRepository users) {
        this.users = users;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // The browser sends a CORS "preflight" OPTIONS request before the real one,
        // and it never carries custom headers. Let it through or every call fails.
        if (CorsUtils.isPreFlightRequest(request)) {
            return true;
        }

        String accessKey = AccessKeys.normalize(request.getHeader(HEADER));
        if (accessKey == null || !users.exists(accessKey)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing or unknown access key");
        }

        request.setAttribute(ATTRIBUTE, accessKey);
        return true;
    }
}
