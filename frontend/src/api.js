// Every call to the Spring Boot API goes through request(), which attaches the
// access key header and turns failures into one error type the UI can show.

const BASE = import.meta.env.VITE_API_URL ?? "";
const STORAGE_KEY = "workmesh.session";
const LEGACY_STORAGE_KEY = "contentCalendar.accessKey"; // pre-rename format, migrated on first load

// Signing in on a device lasts this long; after that the app forgets the key
// and asks for it again. The key itself stays valid - this only logs out the device.
export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

let currentKey = null;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function setAccessKey(key) {
  currentKey = key;
}

// localStorage can throw (private windows, blocked storage). In that case the
// key simply lives for this tab only - the user still has it on screen.
// Stored as {"key": "...", "expiresAt": <epoch ms>}.
export const session = {
  /** Returns { key, expiresAt } or null. Expired sessions are returned too, so the caller can say why. */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { key, expiresAt } = JSON.parse(raw);
        if (typeof key === "string" && Number.isFinite(expiresAt)) return { key, expiresAt };
        localStorage.removeItem(STORAGE_KEY); // unreadable: treat as signed out
        return null;
      }
      // Someone signed in before the rename: keep them in, and start their 30 days now.
      const legacyKey = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyKey) {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return { key: legacyKey, expiresAt: session.save(legacyKey) };
      }
    } catch {
      /* storage unavailable */
    }
    return null;
  },
  /** Starts a fresh 30-day session and returns when it expires. */
  save(key) {
    const expiresAt = Date.now() + SESSION_MS;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ key, expiresAt }));
    } catch {
      /* not persisted: the in-memory expiry below still applies */
    }
    return expiresAt;
  },
  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* nothing to clear */
    }
  },
};

const MESSAGES = {
  400: "Some fields are invalid.",
  401: "Unknown access key.",
  404: "This item no longer exists.",
};

async function request(path, { method = "GET", body, key = currentKey } = {}) {
  const headers = {};
  if (key) headers["X-Access-Key"] = key;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Couldn't reach the server.");
  }

  if (!res.ok) {
    throw new ApiError(res.status, MESSAGES[res.status] ?? "Something went wrong on the server.");
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  createUser: () => request("/api/users", { method: "POST", key: null }),
  verify: (key) => request("/api/users/me", { key }),
  list: () => request("/api/content"),
  create: (content) => request("/api/content", { method: "POST", body: content }),
  update: (id, content) => request(`/api/content/${id}`, { method: "PUT", body: content }),
  remove: (id) => request(`/api/content/${id}`, { method: "DELETE" }),
};
