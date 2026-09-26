# Collaborative boards

Let several people work on the same board: invite members, give them roles, and
see each other's changes live without refreshing.

> **Status:** proposed · **Depends on:** Foundations (see [../README.md](../README.md#foundations-to-do-before-any-feature)) · **Unlocks:** comments, mentions, notifications, email alerts

---

## 1. Why this is the big one

Today one access key = one private board. That model has no idea *who* someone is,
so it cannot:

- show who changed a card,
- let two people share a board with different permissions,
- @mention anyone, or notify anyone, or email anyone.

Every social feature in this folder needs **identity**. This doc introduces it
without throwing away the access-key boards people already have.

## 2. Goals and non-goals

**Goals (v1)**

- People sign in as themselves (an **account**).
- A **workspace** holds one board; it has **members** with **roles**.
- Owners invite people by email; invitees join with one click.
- Every change is attributed ("Harshal moved CC-12 to Completed, 2m ago").
- Changes made by one member appear on everyone else's screen within ~1 second.
- Two people editing the same card never silently overwrite each other.
- Existing access-key boards can be **claimed** and become workspaces.

**Non-goals (v1)**

- Multiple boards per workspace (one board per workspace keeps the model simple; add later).
- Guests with per-card permissions.
- Presence avatars ("who is looking at this card right now"). Nice, later.
- Real-time co-editing of the same text field. Handled by conflict detection instead (§8).
- SSO / SAML.

## 3. Concepts

| Term | Meaning |
|---|---|
| **Account** | A person. Has an email, a display name and a unique `@handle`. |
| **Workspace** | A board plus its settings. Replaces "the board behind an access key". |
| **Member** | An account's membership in a workspace, with a role. |
| **Role** | `OWNER` (everything, incl. delete workspace and manage members), `EDITOR` (create/edit/move/delete cards, comment), `VIEWER` (read and comment only). |
| **Invite** | A pending, single-use, expiring offer to join a workspace. |
| **Activity** | An append-only log of what happened ("moved", "renamed", "commented"). Feeds the card history and, later, notifications. |

## 4. User flows

### 4.1 Sign in (passwordless)

Passwords mean hashing, resets and breach handling. Skip them.

1. User enters their email on the start screen.
2. Server emails a one-time link (`/auth/verify?token=...`), valid 15 minutes, single use.
3. Clicking it creates a session cookie and lands on their last workspace.

Optional second method: **Sign in with GitHub** (OAuth). Worth adding because it pairs
naturally with [PR linking](../github-pr-linking/README.md).

> Magic links need outgoing email, so this feature shares infrastructure with
> [email alerts](../email-alerts/README.md#6-provider-abstraction). Build the email
> sender once, here, and reuse it there.

### 4.2 Claiming an existing access-key board

1. A signed-in user clicks **"I have an access key"** and enters it.
2. The server checks the key, creates a workspace from it, makes the user `OWNER`,
   and moves the key's cards to the workspace.
3. The key stops working for writes (optionally keep read-only for 30 days, then retire).

This keeps every existing board and gives people a reason to create an account.

### 4.3 Inviting someone

1. Owner opens **Members** (new sidebar item), types an email and picks a role.
2. Server stores an invite (token **hashed**, expires in 7 days) and emails the link.
3. The invitee signs in (or creates an account) via the link and becomes a member.
4. Owner sees them move from "Pending" to "Members". Owner can revoke pending invites
   and change or remove members. The last owner cannot leave or be demoted.

### 4.4 Working together

- Member A drags CC-12 to *In Progress*. Member B's board animates the card over
  within about a second, with a subtle "moved by A" toast.
- Both open CC-12. A saves first. When B saves, B sees
  *"A changed this card while you were editing"* with **Review changes** / **Overwrite**.

## 5. Database schema

```sql
-- V{n}__accounts_and_workspaces.sql

CREATE EXTENSION IF NOT EXISTS citext;           -- case-insensitive email

CREATE TABLE account (
    id                 BIGSERIAL PRIMARY KEY,
    email              CITEXT      NOT NULL UNIQUE,
    email_verified_at  TIMESTAMPTZ,
    display_name       VARCHAR(80) NOT NULL,
    handle             VARCHAR(30) NOT NULL UNIQUE,     -- for @mentions, [a-z0-9_]{3,30}
    avatar_color       CHAR(7)     NOT NULL,            -- initials avatar, no image uploads in v1
    time_zone          VARCHAR(64) NOT NULL DEFAULT 'UTC',  -- needed for due-date reminders
    github_user_id     BIGINT UNIQUE,                   -- set if they sign in with GitHub
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE auth_session (
    id             BIGSERIAL PRIMARY KEY,
    account_id     BIGINT      NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    token_hash     CHAR(64)    NOT NULL UNIQUE,   -- SHA-256 of the cookie value; never store the raw token
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at     TIMESTAMPTZ NOT NULL,
    user_agent     VARCHAR(255)
);

CREATE TABLE login_token (                      -- magic links
    token_hash   CHAR(64)    PRIMARY KEY,
    email        CITEXT      NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    used_at      TIMESTAMPTZ
);

CREATE TABLE workspace (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(80) NOT NULL,
    key_prefix          VARCHAR(6)  NOT NULL DEFAULT 'CC',   -- shown as CC-12
    next_card_number    INT         NOT NULL DEFAULT 1,
    legacy_access_key   VARCHAR(19) UNIQUE REFERENCES app_user(access_key),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workspace_member (
    workspace_id  BIGINT      NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    account_id    BIGINT      NOT NULL REFERENCES account(id)   ON DELETE CASCADE,
    role          VARCHAR(10) NOT NULL CHECK (role IN ('OWNER','EDITOR','VIEWER')),
    joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, account_id)
);

CREATE TABLE workspace_invite (
    id            BIGSERIAL PRIMARY KEY,
    workspace_id  BIGINT      NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    email         CITEXT      NOT NULL,
    role          VARCHAR(10) NOT NULL CHECK (role IN ('EDITOR','VIEWER')),
    token_hash    CHAR(64)    NOT NULL UNIQUE,
    invited_by    BIGINT      NOT NULL REFERENCES account(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL,
    accepted_at   TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ
);
CREATE UNIQUE INDEX one_open_invite_per_email
    ON workspace_invite (workspace_id, email)
    WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- Content moves from "owned by an access key" to "belongs to a workspace".
ALTER TABLE content ADD COLUMN workspace_id BIGINT REFERENCES workspace(id) ON DELETE CASCADE;
ALTER TABLE content ADD COLUMN number       INT;              -- per-workspace card number
ALTER TABLE content ADD COLUMN created_by   BIGINT REFERENCES account(id);
ALTER TABLE content ADD COLUMN updated_by   BIGINT REFERENCES account(id);
ALTER TABLE content ADD COLUMN version      INT NOT NULL DEFAULT 0;   -- if not added in Foundations
CREATE UNIQUE INDEX content_number_per_workspace ON content (workspace_id, number);

CREATE TABLE activity (
    id            BIGSERIAL PRIMARY KEY,
    workspace_id  BIGINT      NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    content_id    INT         REFERENCES content(id) ON DELETE CASCADE,
    actor_id      BIGINT      REFERENCES account(id),
    verb          VARCHAR(30) NOT NULL,     -- CREATED, UPDATED, MOVED, DELETED, COMMENTED, PR_LINKED ...
    payload       JSONB       NOT NULL DEFAULT '{}',   -- e.g. {"from":"TODO","to":"IN_PROGRESS"}
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activity_by_content ON activity (content_id, created_at DESC);
CREATE INDEX activity_by_workspace ON activity (workspace_id, created_at DESC);
```

### Card numbers per workspace

Assign `content.number` in the same transaction as the insert:

```sql
UPDATE workspace SET next_card_number = next_card_number + 1
WHERE id = :workspaceId
RETURNING next_card_number - 1;
```

The `UPDATE` row-locks the workspace, so two simultaneous creates can never get the
same number. The frontend's `itemKey()` becomes `${prefix}-${number}` instead of using `id`.

### Backfilling existing boards (claim)

```sql
-- inside the claim transaction, for one access key :key and new workspace :ws
UPDATE content c
SET workspace_id = :ws,
    number = numbered.n
FROM (SELECT id, row_number() OVER (ORDER BY id) AS n
      FROM content WHERE access_key = :key) numbered
WHERE c.id = numbered.id;

UPDATE workspace
SET next_card_number = (SELECT coalesce(max(number), 0) + 1 FROM content WHERE workspace_id = :ws)
WHERE id = :ws;
```

After every key is claimed or retired, a later migration drops `content.access_key`
and makes `workspace_id` and `number` `NOT NULL`.

## 6. API

All paths below require a signed-in session cookie. Workspace paths also require membership;
the role column says the minimum role.

| Method & path | Role | Purpose |
|---|---|---|
| `POST /api/auth/magic-link` `{email}` | public | Send sign-in email. Always returns 202 (don't reveal whether the email exists). |
| `GET /api/auth/verify?token=` | public | Exchange token for session cookie, redirect to app. |
| `POST /api/auth/logout` | any | Delete session. |
| `GET /api/me` | any | Current account + list of workspaces with role. |
| `PATCH /api/me` `{displayName, handle, timeZone}` | any | Profile. |
| `POST /api/workspaces` `{name}` | any | Create workspace, caller becomes OWNER. |
| `POST /api/workspaces/claim` `{accessKey}` | any | Claim an access-key board (§4.2). |
| `GET /api/workspaces/{ws}` | VIEWER | Name, prefix, my role. |
| `PATCH /api/workspaces/{ws}` | OWNER | Rename, change prefix. |
| `GET /api/workspaces/{ws}/members` | VIEWER | Members + pending invites (invites only for OWNER). |
| `POST /api/workspaces/{ws}/invites` `{email, role}` | OWNER | Invite. |
| `DELETE /api/workspaces/{ws}/invites/{id}` | OWNER | Revoke. |
| `POST /api/invites/accept` `{token}` | any | Join. |
| `PATCH /api/workspaces/{ws}/members/{accountId}` `{role}` | OWNER | Change role. |
| `DELETE /api/workspaces/{ws}/members/{accountId}` | OWNER, or self | Remove / leave. |
| `GET/POST/PUT/DELETE /api/workspaces/{ws}/content[/{number}]` | VIEWER to read, EDITOR to write | Today's content API, re-scoped. Cards addressed by **number**, not global id. |
| `GET /api/workspaces/{ws}/content/{number}/activity` | VIEWER | Card history. |
| `GET /api/workspaces/{ws}/events` | VIEWER | Server-Sent Events stream (§7). |

### Conflict handling on update

`PUT` bodies include the `version` the client last saw. The server responds:

- `204` and increments `version` if it matches.
- `409 Conflict` with the current card in the body if it doesn't. The frontend shows the
  diff (field by field) and lets the user pick.

Hibernate does the check for free with `@Version`: it adds `WHERE version = ?` to the
`UPDATE` and throws `OptimisticLockException` when zero rows match. Map that exception to 409
in a `@RestControllerAdvice`.

## 7. Live updates

**Choice: Server-Sent Events (SSE)**, not WebSockets.

- Updates only flow server → browser; writes already go through normal REST calls.
- SSE is plain HTTP: works through proxies, reconnects automatically, no extra library.
- Spring MVC supports it with `SseEmitter`. With Java 21, set
  `spring.threads.virtual.enabled=true` so each open stream costs a cheap virtual
  thread instead of a platform thread.

**Event shape**

```json
{ "id": 1834, "type": "card.moved", "workspaceId": 7, "number": 12,
  "actor": { "id": 3, "handle": "harshal" },
  "data": { "from": "TODO", "to": "IN_PROGRESS", "version": 5 } }
```

Types: `card.created`, `card.updated`, `card.moved`, `card.deleted`, `member.joined`, `member.left`,
later `comment.created`, `pr.updated`.

**Delivery**

1. The service writes the change and an `activity` row in one transaction.
2. *After commit* (`TransactionSynchronization.afterCommit`) it publishes the event.
3. A `WorkspaceEventBroadcaster` keeps `Map<workspaceId, Set<SseEmitter>>` and sends to each.

**Running more than one server instance:** in-memory broadcasting only reaches browsers
connected to the same instance. Use Postgres `LISTEN/NOTIFY` (channel `workspace_events`)
so every instance hears every event. No Redis or Kafka needed at this scale.

**Reconnects:** the browser sends `Last-Event-ID`. The server replays `activity` rows with a
higher id for that workspace (cap at 500; beyond that, tell the client to refetch the board).

**Frontend:** `new EventSource('/api/workspaces/7/events')` in `Board.jsx`; merge events into
`items` state; ignore events where `actor.id` is me (my own optimistic update already applied);
show a small toast for moves by others.

## 8. Backend changes

```
auth/
  SessionInterceptor.java          replaces AccessKeyInterceptor for /api/workspaces/**
  CurrentAccount.java              request-scoped holder (id, handle)
  MagicLinkService.java
  TokenHasher.java                 SHA-256 + constant-time compare
hibernate/
  AccountEntity, AuthSessionEntity, WorkspaceEntity, WorkspaceMemberEntity,
  WorkspaceInviteEntity, ActivityEntity (+ repositories)
service/
  WorkspaceService.java            create, claim, membership checks
  ContentService.java              wraps ContentHibernateRepository: numbering, activity, events
  InviteService.java
realtime/
  WorkspaceEventBroadcaster.java
  PostgresNotifyListener.java      (only when running >1 instance)
controller/
  AuthController, WorkspaceController, MemberController, EventController
```

**Authorization in one place.** A `@RequiresRole(Role.EDITOR)` annotation on controller methods,
checked by the interceptor using `{ws}` from the path and the member row. Never trust a
workspace id sent in a body.

**Keep access keys working during the transition:** `AccessKeyInterceptor` stays on the old
`/api/content/**` paths until all boards are claimed or retired.

## 9. Frontend changes

| Area | Change |
|---|---|
| Start screen | Email field + "Send sign-in link". Secondary: "I have an access key" (claim flow). |
| Top bar | The key chip is replaced by an **avatar menu** (profile, sign out) and a **workspace switcher**. |
| Sidebar | Workspace name (editable by owner), **Board**, **Members**. |
| Members page | Table: avatar, name, @handle, role dropdown (owner only), remove. Pending invites with "Resend" / "Revoke". |
| Cards | Tiny avatar of the last editor on hover; "Updated by A · 2m" in the detail sidebar. |
| Detail modal | New **Activity** tab under the description (the Stitch design had an "Activity & Notes" area; this is where it comes back, for real). |
| Conflicts | 409 dialog: side-by-side fields, "Keep mine" / "Keep theirs" per field. |
| Live updates | `EventSource` hook `useWorkspaceEvents(ws)`. |
| Read-only | VIEWERs get no drag handles, disabled inputs, no Create button. The server enforces this anyway. |

## 10. Security

- **Cookies:** `HttpOnly; Secure; SameSite=Lax; Path=/`. 30-day sliding expiry.
  Store only the SHA-256 of the token so a database leak doesn't leak sessions.
- **CSRF:** `SameSite=Lax` blocks most cross-site POSTs. Also require a custom header
  (`X-Requested-With: fetch`) on mutating requests: browsers can't send custom headers
  cross-site without a CORS preflight, which the server refuses.
- **Magic links:** 256-bit random token, 15-minute expiry, single use, rate-limit per email
  (5/hour) and per IP.
- **Invites:** single use, expire in 7 days, bound to the invited email (the accepting
  account must have that verified email).
- **Every query filters by workspace** the way every query filters by access key today.
  Add a test per endpoint: "member of workspace A gets 404 for workspace B's card".
- **Enumeration:** return 404, not 403, for workspaces you're not in.
- **Last owner:** block leaving/demotion if it would leave zero owners.

## 11. Edge cases

- User deletes their account: their cards stay; `created_by`/`updated_by` become `NULL`,
  shown as "Former member".
- Invite sent to an email that already has an account: link still works; just joins.
- Two tabs of the same user: both get SSE events; each ignores events it caused
  (track a per-tab `clientId` sent as a header and echoed in the event).
- Workspace prefix changed from `CC` to `BLOG`: numbers stay, keys become `BLOG-12`.
  PR auto-linking should then accept both for a grace period.

## 12. Testing

- **Unit:** role checks, token hashing, number assignment under concurrency
  (two threads creating cards → distinct numbers).
- **Integration (Testcontainers):** full invite → accept → edit flow; cross-workspace isolation
  for every endpoint; 409 on stale version.
- **SSE:** open two `EventSource` clients in a test, move a card, assert both receive it.
- **Manual:** two browsers side by side (normal + incognito) on the same workspace.

## 13. Rollout

1. Ship accounts + magic link + workspaces, with the claim flow. Access keys keep working.
2. Ship members + invites.
3. Ship SSE live updates and 409 conflict handling.
4. Announce key retirement; after 30–60 days, make keys read-only, then remove
   `AccessKeyInterceptor` and drop `content.access_key`.

## 14. Open questions

- Keep a "no-account" mode forever for people who liked the access-key simplicity?
  (Possible: an anonymous workspace that can later be claimed.)
- One board per workspace, or several boards per workspace from day one?
- Should VIEWERs be able to comment? (Proposed: yes.)
