package me.harshal.content_calendar.auth;

import java.security.SecureRandom;
import java.util.Locale;

/**
 * Generates and normalizes access keys like "7KQM-3XPA-HN2W-9RTC".
 *
 * The key is the ONLY thing standing between a stranger and a user's board,
 * so it has to be unguessable: 16 characters picked by SecureRandom from a
 * 31-character alphabet is about 79 bits of randomness.
 *
 * The alphabet leaves out look-alikes (0/O, 1/I/L) so a key read off the
 * screen and typed back in cannot be mistyped that way.
 */
public final class AccessKeys {

    private static final String ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final int LENGTH = 16;
    private static final int GROUP_SIZE = 4;
    private static final SecureRandom RANDOM = new SecureRandom();

    private AccessKeys() {
    }

    public static String generate() {
        StringBuilder chars = new StringBuilder(LENGTH);
        for (int i = 0; i < LENGTH; i++) {
            chars.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return withDashes(chars.toString());
    }

    /**
     * Turns whatever the user typed into the canonical form, so
     * "7kqm 3xpa hn2w 9rtc" and "7KQM3XPAHN2W9RTC" both become "7KQM-3XPA-HN2W-9RTC".
     * Returns null when the input cannot possibly be a key.
     */
    public static String normalize(String raw) {
        if (raw == null) {
            return null;
        }
        String chars = raw.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        if (chars.length() != LENGTH) {
            return null;
        }
        for (char c : chars.toCharArray()) {
            if (ALPHABET.indexOf(c) < 0) {
                return null;
            }
        }
        return withDashes(chars);
    }

    private static String withDashes(String chars) {
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < chars.length(); i++) {
            if (i > 0 && i % GROUP_SIZE == 0) {
                out.append('-');
            }
            out.append(chars.charAt(i));
        }
        return out.toString();
    }
}
