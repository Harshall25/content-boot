# Comments

Threaded discussion on each card: ask a question, leave feedback on a draft,
record a decision.

> **Status:** proposed · **Depends on:** [collaborative-boards](../collaborative-boards/README.md) for multi-person use (a single-user "notes" version can ship earlier, see §9) · **Unlocks:** [mentions](../mentions/README.md), comment [notifications](../notifications/README.md)

---

## 1. Goals and non-goals

**Goals (v1)**

- Anyone who can view a card can read and write comments on it (VIEWER and up).
- Replies are one level deep (a comment, and replies under it), like GitHub PR review threads.
- Authors can edit and delete their own comments; owners can delete any comment.
- Light formatting: paragraphs, **bold**, *italic*, `inline code`, code blocks, links, lists.
- Cards show a comment count on the board.
- New comments from others appear live (via the SSE stream from collaborative-boards).

**Non-goals (v1)**

- Emoji reactions (easy follow-up, §12).
- Attachments / image uploads.
- Comments anchored to a specific sentence of a description or page (that's a [pages](../pages/README.md) feature).
- Resolving threads (follow-up).

## 2. User flows

1. Open CC-12. Under the description is an **Activity** section with two tabs:
   **Comments** (default) and **History** (the activity log from collaborative-boards).
2. A composer sits at the top: textarea, "Comment" button, hint "⌘/Ctrl + Enter to post".
3. Posting inserts the comment immediately (optimistic) with a faint "Sending…" state;
   on failure it turns red with **Retry** / **Discard**.
4. Hovering a comment shows **Reply**, and for your own comments **Edit** / **Delete**.
5. Edited comments show "(edited)" with the edit time on hover.
6. Deleted comments that have replies become "This comment was deleted" so the thread
   still reads correctly. Deleted comments without replies disappear.

## 3. Database schema

```sql
-- V{n}__comments.sql
CREATE TABLE comment (
    id            BIGSERIAL PRIMARY KEY,
    workspace_id  BIGINT      NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    content_id    INT         NOT NULL REFERENCES content(id)   ON DELETE CASCADE,
    parent_id     BIGINT      REFERENCES comment(id) ON DELETE CASCADE,  -- NULL = top level
    author_id     BIGINT      REFERENCES account(id) ON DELETE SET NULL,
    body          TEXT        NOT NULL CHECK (length(body) BETWEEN 1 AND 10000),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    edited_at     TIMESTAMPTZ,
    deleted_at    TIMESTAMPTZ             -- soft delete, see §2.6
);
CREATE INDEX comment_by_card ON comment (content_id, created_at);

-- Denormalized count so the board query doesn't join comments for every card.
ALTER TABLE content ADD COLUMN comment_count INT NOT NULL DEFAULT 0;
```

**One level of replies** is enforced in the service: if `parent_id` points at a comment
that itself has a parent, reject with 400 (or re-point to the top-level parent, like Slack).

**Why `workspace_id` on the comment** when it's reachable via `content`: every
authorization check becomes a single-table filter (`WHERE workspace_id = ?`), which is
harder to get wrong than a join.

**Keeping `comment_count` right:** increment/decrement in the same transaction as the
insert/soft-delete. A nightly job can recompute it as a safety net:
`UPDATE content c SET comment_count = (SELECT count(*) FROM comment WHERE content_id = c.id AND deleted_at IS NULL)`.

## 4. Storage format: plain Markdown text

Store exactly what the user typed (Markdown source) in `body`. Render on the client.

- Editing is trivial: put the source back in the textarea.
- Search works on the raw text.
- Mentions are stored as tokens inside the text (see [mentions §4](../mentions/README.md#4-storage-format)).

**Rendering safely** is the important part (§8). Use a Markdown renderer configured to
**not allow raw HTML**, e.g. `markdown-it` with `html: false`, or write a tiny renderer for
the subset in §1. Never `dangerouslySetInnerHTML` unsanitized output.

## 5. API

Paths are under the workspace scope from collaborative-boards.

| Method & path | Role | Notes |
|---|---|---|
| `GET /api/workspaces/{ws}/content/{number}/comments?after={cursor}&limit=50` | VIEWER | Oldest first. Returns top-level comments with their replies nested. Cursor = `created_at,id` of the last item. |
| `POST /api/workspaces/{ws}/content/{number}/comments` | VIEWER | Body `{ body, parentId? }` → `201` with the created comment. |
| `PATCH /api/workspaces/{ws}/comments/{id}` | author | Body `{ body }`. Sets `edited_at`. |
| `DELETE /api/workspaces/{ws}/comments/{id}` | author or OWNER | Soft delete. `204`. |

**Response shape**

```json
{
  "id": 481,
  "author": { "id": 3, "handle": "harshal", "displayName": "Harshal", "avatarColor": "#0052CC" },
  "body": "Can we split the Hibernate part into its own post?",
  "createdAt": "2026-10-02T09:14:03Z",
  "editedAt": null,
  "deleted": false,
  "replies": [ { "...": "same shape, no nested replies" } ]
}
```

Deleted comments come back as `{ "id": 481, "deleted": true, "body": null, "author": null, "replies": [...] }`.

## 6. Backend

```
hibernate/CommentEntity.java
hibernate/CommentHibernateRepository.java   findThread(contentId, cursor), insert, softDelete
service/CommentService.java                 @Transactional:
                                             1. check role + card belongs to workspace
                                             2. insert comment, bump comment_count
                                             3. write activity row (verb COMMENTED)
                                             4. (later) extract mentions, write outbox event
                                             5. after commit: publish SSE "comment.created"
controller/CommentController.java
```

**Validation** (reject with 400): empty after trim, over 10,000 characters, `parentId`
from a different card, reply-to-a-reply.

**Rate limit:** 30 comments per minute per account (a simple in-memory token bucket is fine
for one instance; move to Postgres or Redis when running several).

## 7. Frontend

| File | Change |
|---|---|
| `DetailModal.jsx` | Add the Activity section below Description with Comments / History tabs. |
| `Comments.jsx` (new) | Thread list, composer, reply/edit/delete, optimistic insert. |
| `Markdown.jsx` (new) | Safe renderer (no raw HTML, links through the existing `safeHref`). |
| `Board.jsx` → `Card` | Small speech-bubble icon + count in `card__info`, next to the link icon. |
| `api.js` | `listComments`, `createComment`, `updateComment`, `deleteComment`. |
| SSE handler | On `comment.created` for the open card, append it; for any card, bump its count. |

**Design:** comments sit on the white surface with 12px vertical gaps. Author line in
`title-sm` (13px/600) + timestamp in `body-sm` muted. Replies indented 32px with a 2px
`--border` rule on the left. Composer uses the existing `.textarea` and `.btn--primary`.

## 8. Security

- **XSS:** the renderer must never output raw HTML from the body. Only `http(s)` links
  (reuse `safeHref` from `format.js`) with `rel="noopener noreferrer nofollow"`.
- **Authorization:** the comment's `workspace_id` must match the path's `{ws}`, and the
  caller must be a member. Test cross-workspace access returns 404.
- **Edit/delete:** only the author edits; author or OWNER deletes. VIEWERs can't delete others'.
- **Size limits** at the database (CHECK) *and* the API, so a bug in one layer isn't enough.

## 9. Shipping early as single-user "notes"

Before collaboration exists, the same UI can ship as **Notes** on access-key boards:

- `comment` gets `access_key` instead of `workspace_id`/`author_id` (or `author_id` is just `NULL`).
- No replies, no author line: a simple timestamped log per card.
- When collaboration ships, a migration assigns existing notes to the workspace that claimed
  the key, authored by its owner.

This is a good small first step: it brings back the "Activity & Notes" section that the Stitch
design had, as a real feature.

## 10. Edge cases

- Card deleted: comments cascade. (If we ever add "undo delete", switch to soft-deleting cards.)
- Author removed from workspace: their comments stay, shown with their name greyed.
- Very long thread (500+ comments): cursor pagination, "Load earlier comments" at the top.
- Two people editing the same comment: impossible (only the author edits), except the same
  author in two tabs: last write wins, acceptable here.

## 11. Testing

- Repository: thread ordering, pagination cursor stability, soft delete keeps replies.
- Service: count stays correct through create → delete → create.
- Security: member of workspace B can't read, post, edit or delete on workspace A (expect 404).
- Frontend: optimistic insert then failure shows Retry; Ctrl+Enter posts; XSS strings like
  `<img src=x onerror=alert(1)>` render as text.

## 12. Follow-ups

- **Reactions:** `comment_reaction(comment_id, account_id, emoji, PRIMARY KEY(...))`, a small fixed set (👍 🎉 👀 ❤️).
- **Resolve threads:** `resolved_at`, `resolved_by`; collapsed by default.
- **Comment on a page selection:** anchors into [pages](../pages/README.md).
