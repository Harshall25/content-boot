# Mentions

Type `@` to pull a teammate into a conversation, and `#` to reference another card.

> **Status:** proposed · **Depends on:** [collaborative-boards](../collaborative-boards/README.md) (people to mention), [comments](../comments/README.md) (a place to mention them) · **Unlocks:** "you were mentioned" [notifications](../notifications/README.md) and [email alerts](../email-alerts/README.md)

---

## 1. Goals and non-goals

**Goals (v1)**

- `@handle` mentions of **workspace members** in comments and card descriptions (later: [pages](../pages/README.md)).
- `#CC-12` references to **cards** in the same places, rendered as live chips (title + status).
- An autocomplete popup while typing, fully keyboard-driven.
- Each new mention creates exactly one notification for the mentioned person. Editing a
  comment doesn't re-notify people who were already mentioned.
- Cards show **backlinks**: "Referenced in CC-3, CC-9".

**Non-goals (v1)**

- `@here` / `@all`. Easy to abuse; add later with owner-only permission.
- Mentioning people outside the workspace (that's an invite, not a mention).
- Mentions of PRs (`!123`): covered by [github-pr-linking](../github-pr-linking/README.md).

## 2. User flows

**Mentioning someone**

1. In a comment, type `@ha`. A popup appears under the caret listing members whose
   handle or name matches: avatar, display name, `@handle`.
2. ↑/↓ to move, Enter or Tab to pick, Esc to close. Clicking works too.
3. The pick is inserted as `@harshal` (rendered as a blue chip once posted).
4. On post, Harshal gets a notification: *"Priya mentioned you on CC-12: 'Can @harshal review…'"*.

**Referencing a card**

1. Type `#hib` or `#12`. The popup lists cards by number and title match.
2. Posted text shows a chip: `CC-12 · Hibernate deep dive · In Progress`.
3. Clicking the chip opens that card. CC-12's detail shows "Referenced in CC-15".

## 3. Rules

| Rule | Why |
|---|---|
| Only current members can be mentioned. | Unknown handles stay plain text, so no one outside the workspace learns anything. |
| Mentioning yourself creates no notification. | Noise. |
| Mentioning someone in a card they can't see is impossible: all members see all cards in v1. | Revisit if per-card permissions ever exist. |
| A person mentioned several times in one comment gets one notification. | Dedup per (source, person). |
| Editing a comment notifies only **newly added** mentions. | Diff old vs new mention sets. |
| Deleting a comment removes its mention rows but doesn't recall notifications already sent. | Recalling is confusing; the notification links to "comment deleted". |

## 4. Storage format

Store mentions **by id, not by handle**, inside the text, so renaming a handle or a
card title doesn't break old comments:

```
Can <@3> review this before <#c:12> ships?
```

- `<@3>` = account id 3.
- `<#c:12>` = card **number** 12 in this workspace.

The client converts on the way in and out:

- **Editing:** tokens are shown as `@harshal` / `#CC-12`. On submit, the client sends the
  tokenized form. The server re-validates every token (see §6) and never trusts the client's list.
- **Displaying:** tokens are replaced by chips using a lookup of members and cards that the
  API returns alongside the text (so the client doesn't need N extra requests).

Why not store `@harshal` as typed? If Harshal changes their handle to `@hb`, every old comment
would point at nobody (or worse, at a new person who later takes `@harshal`).

## 5. Database schema

```sql
-- V{n}__mentions.sql
CREATE TABLE mention (
    id               BIGSERIAL PRIMARY KEY,
    workspace_id     BIGINT      NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    source_type      VARCHAR(12) NOT NULL CHECK (source_type IN ('COMMENT','DESCRIPTION','PAGE')),
    source_id        BIGINT      NOT NULL,             -- comment.id, content.id or page.id
    content_id       INT         REFERENCES content(id) ON DELETE CASCADE,  -- the card it happened on, for linking
    mentioned_id     BIGINT      NOT NULL REFERENCES account(id) ON DELETE CASCADE,
    mentioned_by     BIGINT      REFERENCES account(id) ON DELETE SET NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source_type, source_id, mentioned_id)      -- one row per person per source
);
CREATE INDEX mention_by_person ON mention (mentioned_id, created_at DESC);

CREATE TABLE card_reference (                          -- #CC-12 backlinks
    workspace_id     BIGINT      NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    source_type      VARCHAR(12) NOT NULL,
    source_id        BIGINT      NOT NULL,
    from_content_id  INT         REFERENCES content(id) ON DELETE CASCADE,
    to_content_id    INT         NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    PRIMARY KEY (source_type, source_id, to_content_id)
);
CREATE INDEX backlinks ON card_reference (to_content_id);
```

The `UNIQUE` constraint is what makes "one notification per person per comment" reliable:
the service inserts with `ON CONFLICT DO NOTHING` and only notifies for rows actually inserted.

## 6. Backend

```
service/MentionParser.java      extracts <@id> and <#c:n> tokens with one regex each
service/MentionService.java     sync(sourceType, sourceId, contentId, newBody, author):
                                  1. parse tokens
                                  2. keep only ids that are members / card numbers that exist in this workspace
                                  3. replace unknown tokens with plain text (server-side, before saving)
                                  4. diff against existing mention rows for this source
                                  5. insert added, delete removed (ON CONFLICT DO NOTHING)
                                  6. for each inserted mention → outbox event MENTIONED (see notifications)
                                  7. same for card_reference
controller/MemberSearchController GET /api/workspaces/{ws}/members/search?q=har&limit=8
controller/CardSearchController   GET /api/workspaces/{ws}/content/search?q=hib&limit=8
```

`MentionService.sync` is called by `CommentService` and `ContentService` inside **their**
transaction, so a comment and its mentions are saved (or rolled back) together.

**Regexes**

```java
static final Pattern PERSON = Pattern.compile("<@(\\d{1,18})>");
static final Pattern CARD   = Pattern.compile("<#c:(\\d{1,9})>");
```

**Limits:** max 20 person mentions and 50 card references per source; beyond that, extra
tokens become plain text. Stops a single comment from notifying a whole company.

**Search endpoints** are prefix/substring matches on `handle`, `display_name` (members) and
`title`, `number` (cards). With a few hundred rows per workspace, `ILIKE` is fine; add
`pg_trgm` indexes if workspaces get large.

## 7. Frontend

### 7.1 Autocomplete in a plain `<textarea>`

No editor library needed for comments:

1. On `input`, look backwards from the caret for `@` or `#` that starts a word
   (start of text or preceded by whitespace) with no space after it.
2. If found, take the query (text between trigger and caret) and call the search endpoint
   (debounced 120ms, cancel stale requests with `AbortController`).
3. Position the popup at the caret. A textarea can't tell you caret pixel coordinates, so use
   the **mirror-div trick**: an invisible `div` with identical font, padding and width, containing
   the text up to the caret plus a marker `span`; the span's offset is the caret position.
4. On select, replace `@que` with `@handle ` and remember `{start, end, accountId}` in a small
   side list, so submit can turn it into `<@id>`.
5. Keyboard: ↑/↓, Enter/Tab select, Esc close. `role="listbox"` + `aria-activedescendant`
   so screen readers announce options.

In [pages](../pages/README.md), the editor library (TipTap) has a mention extension that does
this natively; reuse the same search endpoints.

### 7.2 Rendering chips

`Markdown.jsx` (from comments) gets two extra token rules:

- `<@3>` → `<span class="mention">@harshal</span>`. Highlight differently if it's *me*
  (`--nav-active` background, like Slack).
- `<#c:12>` → a button chip with status dot and title, opening the card.

Unknown ids (member left, card deleted) render as `@former-member` / `#CC-12 (deleted)`.

### 7.3 Backlinks

In the detail modal sidebar, under Details: **Referenced in**: list of card chips.
Source: `GET /api/workspaces/{ws}/content/{number}/backlinks`.

## 8. Security and privacy

- Server-side validation of every token is non-negotiable: a crafted request with `<@999>`
  must not notify account 999 unless they're a member.
- Member search only returns members of the caller's workspace.
- Don't leak whether a handle exists outside the workspace (unknown → plain text, no error).
- Rate-limit mentions per author per hour (e.g. 100 notifications generated) to stop spam loops.

## 9. Edge cases

- `email@example.com`: `@` not at a word start, so no popup. The parser only acts on tokens anyway.
- Code blocks: mentions inside backticks are **not** tokens. The client doesn't tokenize inside
  code spans; the server strips tokens found inside code fences before parsing.
- Handle renamed while someone is typing: selection already stored the id, so fine.
- Card deleted after being referenced: `card_reference` cascades; old text shows "(deleted)".

## 10. Testing

- Parser: tokens inside code, duplicates, 21st mention ignored, malformed tokens.
- Sync: edit adds one and removes one → exactly one insert, one delete, one notification.
- Security: non-member id in token → stored as text, no notification.
- UI: caret positioning with long wrapped lines, IME input (Chinese/Japanese keyboards
  fire `compositionstart`/`compositionend`: don't open the popup mid-composition).
