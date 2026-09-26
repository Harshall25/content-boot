# Pages (Notion-like docs)

Rich documents inside the app: a page tree for notes and plans, and a **draft page
attached to every card**, so the article or talk you're planning is written right
next to the card that tracks it.

> **Status:** proposed · **Depends on:** Foundations. **v1 works with today's access-key boards.** · **Works with:** [mentions](../mentions/README.md) (`@person`, `#CC-12` inside pages), [comments](../comments/README.md) (comment on a selection), [github-pr-linking](../github-pr-linking/README.md) (PR chips in drafts)

---

## Positioning: better than Notion at one job

Trying to out-Notion Notion (databases, templates, wikis, AI, 50 block types) is a
losing race for a small project. Being **better for one workflow** is realistic:

> *Plan, write and ship developer content, with the board, the draft and the code in one place.*

What Notion can't do, and this app can:

| This app | Notion |
|---|---|
| A card's draft knows its status. The board shows "Draft · 1,240 words · 6 min read". | A page and a board card are separate things you link by hand. |
| `#CC-12` and PR chips inside a draft are **live** (status, merged state). | Links are static text. |
| "Ready to publish" checklist per content type (article: title, intro, code samples, cover, tags). | Generic checklists. |
| Export a draft to clean Markdown with front-matter for Dev.to / Hashnode / a static blog. | Export exists but isn't publish-ready Markdown for blogs. |
| Fast and small. The whole app is ~84 KB gzipped today. | Heavy client. |

Everything below serves that positioning. Features that don't (databases, formulas,
public wikis) are deliberately out of scope.

## 1. Goals and non-goals

**Goals (v1)**

- **Pages** with a title, optional emoji icon, and a block-based body.
- **Page tree** in the sidebar (nest pages under pages; drag to reorder/re-nest).
- **Card drafts:** every card can have exactly one draft page, one click from the card.
- **Blocks:** paragraph, headings 1–3, bulleted / numbered / to-do lists, quote, callout,
  code block with language + syntax highlighting, divider, image (by URL in v1), table (simple).
- **Inline:** bold, italic, strike, inline code, links, `@mention`, `#card` chip, PR chip.
- **Slash menu** (`/`) to insert blocks; Markdown shortcuts (`# `, `- `, `1. `, ` ``` `, `> `).
- **Autosave**, **version history** (restore any earlier version), **full-text search**.
- **Backlinks:** "Mentioned in" list at the bottom of a page.
- **Markdown import/export.**

**Non-goals (v1)**

- Real-time co-editing of the same page by two people (v2, §8; v1 uses a soft lock).
- Notion-style databases / views inside pages. The board *is* the database.
- Public sharing of pages on the web (follow-up; needs careful security work).
- File uploads (images by URL only in v1; uploads need object storage, §11).
- AI writing features.

## 2. User flows

**Write a draft for a card**

1. On CC-12, the detail modal gets a **Draft** button (or "Open draft · 1,240 words" if one exists).
2. It opens the page full-screen (not in the modal: writing needs room). Breadcrumb:
   `Board / CC-12 · Hibernate deep dive / Draft`.
3. Typing autosaves ~1 second after you stop. A subtle "Saved" / "Saving…" in the header.
4. The card on the board shows a doc icon with the word count.

**Organize notes**

1. Sidebar gets a **Pages** section under Board: a tree with ▸ toggles, "+" on hover to add a
   child page, drag to move.
2. Pages can reference cards (`#CC-12`) and people (`@priya`). Those are live chips.

**Restore a mistake**

1. Page header "⋯" → **Version history**: a list of versions (time, author, word delta).
2. Selecting one shows it read-only with changes highlighted; **Restore** creates a *new* version
   equal to the old one (history is never rewritten).

**Publish**

1. "⋯" → **Export as Markdown** downloads `hibernate-deep-dive.md` with YAML front-matter
   (`title`, `tags` from the card type, `canonical_url` from the card URL).
2. Follow-up: direct "Publish to Dev.to" using their API.

## 3. Choosing the editor

Building a rich text editor from scratch on `contenteditable` is a famous trap (selection,
IME input, undo, paste handling, mobile keyboards). Use a proven engine.

| Option | Built on | Strengths | Watch out for |
|---|---|---|---|
| **TipTap** | ProseMirror | Huge extension ecosystem (mention, slash command, code block, tables); headless, so it fits the existing CSS; first-class Yjs collaboration | Some advanced extensions and hosted collaboration are paid. The open-source core covers everything in v1. |
| **Lexical** | Meta's own engine | Fast, small core, good accessibility | Fewer ready-made extensions; more to build yourself |
| **BlockNote** | TipTap / ProseMirror | Notion-like block UI out of the box | Opinionated styling; harder to match the Stitch design exactly; check the license of any extra packages |

**Recommendation: TipTap.** It's headless (we style it with our own tokens), and the mention
and slash-command patterns already exist.

**Keep the app light:** the editor will likely add more JavaScript than the entire current app.
Load it with a **dynamic `import()`** only when a page opens, so the board's first load stays
at ~84 KB. Vite splits it into its own chunk automatically.

```js
const PageEditor = lazy(() => import("./pages/PageEditor.jsx"));
```

## 4. Storage format

Store the editor's **JSON document** (ProseMirror JSON), not HTML and not Markdown.

- JSON round-trips perfectly through the editor. HTML and Markdown lose information
  (callouts, mention ids, card chips).
- Rendering is done by the editor's schema: only known node types become DOM, so there's no
  way for stored data to inject arbitrary HTML.
- Keep a **plain-text extraction** alongside for search and word counts.

```json
{ "type": "doc", "content": [
  { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "Why Hibernate" }] },
  { "type": "paragraph", "content": [
    { "type": "text", "text": "Ask " },
    { "type": "mention", "attrs": { "accountId": 3 } },
    { "type": "text", "text": " before merging " },
    { "type": "cardRef", "attrs": { "number": 12 } }
  ]}
]}
```

Mentions store ids, never handles (same reason as [mentions §4](../mentions/README.md#4-storage-format)).

## 5. Database schema

```sql
-- V{n}__pages.sql
CREATE TABLE page (
    id             BIGSERIAL PRIMARY KEY,
    board_ref      VARCHAR(40)  NOT NULL,            -- access key today, workspace id later
    parent_id      BIGINT       REFERENCES page(id) ON DELETE CASCADE,
    content_id     INT          UNIQUE REFERENCES content(id) ON DELETE SET NULL,  -- the card this is the draft of
    title          VARCHAR(255) NOT NULL DEFAULT '',
    icon           VARCHAR(16),                       -- an emoji
    doc            JSONB        NOT NULL DEFAULT '{"type":"doc","content":[]}',
    text_content   TEXT         NOT NULL DEFAULT '',  -- plain text, maintained on save
    word_count     INT          NOT NULL DEFAULT 0,
    position       NUMERIC      NOT NULL DEFAULT 0,   -- order among siblings (fractional indexing)
    version        INT          NOT NULL DEFAULT 0,   -- optimistic locking (@Version)
    created_by     BIGINT,                            -- account id once accounts exist
    updated_by     BIGINT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    archived_at    TIMESTAMPTZ,                       -- soft delete: "Trash" for 30 days
    search         TSVECTOR GENERATED ALWAYS AS (
                       setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                       setweight(to_tsvector('english', text_content), 'B')
                   ) STORED,
    CHECK (octet_length(doc::text) < 2000000)         -- ~2 MB cap per page
);
CREATE INDEX page_tree   ON page (board_ref, parent_id, position) WHERE archived_at IS NULL;
CREATE INDEX page_search ON page USING GIN (search);

CREATE TABLE page_revision (
    id          BIGSERIAL PRIMARY KEY,
    page_id     BIGINT      NOT NULL REFERENCES page(id) ON DELETE CASCADE,
    version     INT         NOT NULL,
    title       VARCHAR(255) NOT NULL,
    doc         JSONB       NOT NULL,
    word_count  INT         NOT NULL,
    author_id   BIGINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (page_id, version)
);

CREATE TABLE page_link (              -- backlinks: this page references that thing
    page_id      BIGINT      NOT NULL REFERENCES page(id) ON DELETE CASCADE,
    target_type  VARCHAR(8)  NOT NULL CHECK (target_type IN ('PAGE','CARD','PR')),
    target_id    BIGINT      NOT NULL,
    PRIMARY KEY (page_id, target_type, target_id)
);
CREATE INDEX page_link_target ON page_link (target_type, target_id);
```

**Ordering siblings with `position`:** to drop a page between siblings at 1.0 and 2.0, give it
1.5. No need to renumber everything else. Rebalance occasionally if numbers get very close.

**Revisions without bloat:** don't snapshot on every autosave (that's every second of typing).
Create a revision when the last one is more than 10 minutes old, when a different person edits,
and before any restore. Keep all revisions from the last 7 days, then one per day for 90 days.

## 6. API

| Method & path | Purpose |
|---|---|
| `GET /api/pages/tree` | All non-archived pages for the board: `id, parentId, title, icon, position, contentId` (no docs). |
| `POST /api/pages` `{ parentId?, title?, contentId? }` | Create. With `contentId`, creates the card's draft (409 if one exists). |
| `GET /api/pages/{id}` | Full page incl. `doc` and `version`. |
| `PUT /api/pages/{id}` `{ title, icon, doc, version }` | Autosave. Server derives `text_content`, `word_count`, `page_link` rows. `409` on stale version. |
| `PATCH /api/pages/{id}/move` `{ parentId, position }` | Re-nest / reorder. Reject moving a page under its own descendant (cycle). |
| `DELETE /api/pages/{id}` | Archive (to Trash). `POST /api/pages/{id}/restore` undoes it. |
| `GET /api/pages/{id}/revisions` / `GET .../revisions/{v}` / `POST .../revisions/{v}/restore` | History. |
| `GET /api/pages/{id}/backlinks` | Pages that link to this page. |
| `GET /api/search?q=` | Pages (and cards) ranked by `ts_rank`, with highlighted snippets via `ts_headline`. |
| `GET /api/pages/{id}/export.md` | Markdown download. |
| `POST /api/pages/import` (multipart `.md`) | Markdown → new page. |

Until collaboration ships, all of these are scoped by the `X-Access-Key` header like content.

## 7. Saving: autosave + optimistic locking

1. The editor fires `onUpdate`; debounce 1s, and also save on blur and on `visibilitychange`
   to hidden, so closing the tab doesn't lose the last second.
2. `PUT` with the `version` the client has. Success returns the new version.
3. **409** means someone (or another tab) saved in between. v1 behaviour: show a banner
   *"This page changed elsewhere."* with **Reload** / **Keep my version** (which re-sends with the
   new version, overwriting).
4. **Soft lock:** while a page is open, the client pings `POST /api/pages/{id}/presence` every
   20s. Others opening it see *"Priya is editing"* and get read-only mode with "Edit anyway".
   Cheap, and prevents most conflicts until real-time co-editing exists.

**Server-side on every save**, in one transaction: validate the JSON against allowed node/mark
types (reject unknown types, so the stored doc can't contain something the renderer doesn't
expect), extract text, count words, sync `page_link` and [mentions](../mentions/README.md),
maybe create a revision.

## 8. v2: real-time co-editing

When two people need to type in the same page at once, conflict banners aren't enough. The
standard answer is a **CRDT**, specifically **Yjs**, which TipTap supports directly.

- Each client keeps a Yjs document; edits become small binary updates that merge
  automatically in any order, so there are no conflicts by design.
- Updates travel over a **WebSocket** to a sync server, which relays them to other clients and
  persists them.
- **The sync server:** the mature Yjs servers (Hocuspocus, y-websocket) are **Node.js**. Options:
  1. Run a small Node service next to Spring Boot just for page sync, with Spring still owning
     auth (the Node service validates a short-lived token issued by Spring) and persistence
     (it calls Spring's API or writes the `page` row).
  2. Relay opaque Yjs updates through Spring (WebSocket endpoint) and store them as `bytea`,
     letting clients do all merging. Simpler infrastructure, more custom code.
- Store periodic snapshots as ProseMirror JSON too, so search, word count, export and revisions
  keep working unchanged.
- Cursors and selections of other people come from Yjs "awareness".

Recommendation: ship v1 with the soft lock, and add Yjs only once there are actually several
people editing the same page regularly.

## 9. Frontend

```
frontend/src/pages/
  PageView.jsx         header (breadcrumb, icon, title, Saved state, ⋯ menu), editor, backlinks
  PageEditor.jsx       lazy-loaded TipTap setup and extensions
  SlashMenu.jsx        "/" command popup (same popup component as mentions)
  PageTree.jsx         sidebar tree with drag and drop
  History.jsx          revision list and read-only preview
  extensions/
    CardRef.js         inline node, renders a live card chip
    Mention.js         configured with the member search endpoint
    PrRef.js           inline node for PR chips
```

- **Navigation:** the app has no router yet. Pages need URLs you can bookmark and share
  (`/pages/42`). Add a tiny router (a ~40-line hash or History-API router, or `wouter` at ~2 KB)
  rather than React Router, to stay light.
- **Typography for writing:** 16px/1.6 body text, max line length ~70 characters (about 720px),
  headings following the design system scale (24 / 20 / 16px, weight 600). Writing space should
  feel calmer and roomier than the dense board.
- **Code blocks:** syntax highlighting with `lowlight` (highlight.js grammars), loading only the
  languages you register (Java, JS, SQL, bash, JSON), not all of them.
- **Card chips** reuse `TypeBadge` / `StatusPill` from `ui.jsx`.
- **Board card:** doc icon + word count in `card__info` when a draft exists.

## 10. Search

Postgres full-text search, no extra service:

```sql
SELECT id, title,
       ts_headline('english', text_content, q, 'MaxWords=20, MinWords=8') AS snippet,
       ts_rank(search, q) AS rank
FROM page, websearch_to_tsquery('english', :query) q
WHERE board_ref = :board AND archived_at IS NULL AND search @@ q
ORDER BY rank DESC
LIMIT 20;
```

`websearch_to_tsquery` understands what people type (`"exact phrase"`, `-exclude`, `or`).
Add the `pg_trgm` extension later for typo-tolerant title search. The top-bar search box then
searches cards *and* pages, with results grouped.

## 11. Security

- **Rendering:** documents render only through the editor schema. Never render stored content
  with `dangerouslySetInnerHTML`. Link marks only allow `http`, `https` and `mailto`.
- **Validation on save:** unknown node or mark types rejected server-side; attribute values
  type-checked (e.g. `heading.level` in 1..3).
- **Images by URL:** load them with `referrerpolicy="no-referrer"`. For uploads later, use object
  storage (S3 / Cloudflare R2) with presigned URLs, content-type allowlist (png/jpeg/webp/gif),
  size limit, and serve from a **separate domain** so an uploaded file can never run as part of the app.
- **Paste:** TipTap parses pasted HTML through the schema, which strips scripts and styles. Keep it that way.
- **Size limits:** 2 MB per document (DB `CHECK` and API), to stop runaway pages and slow saves.
- **Scoping:** every query filters by board (and later workspace) exactly like content.

## 12. Edge cases

- Card deleted: its draft page stays (`content_id` becomes `NULL`) and moves to the tree root,
  titled "Draft: <old title>", so writing is never lost.
- Moving a page under its own child: reject with 400 (check ancestors with a recursive CTE).
- Deleting a parent page: children go to Trash with it; restoring the parent restores them.
- Very long pages: TipTap handles thousands of blocks, but the 2 MB cap keeps saves quick.
- Offline for a minute: unsaved changes stay in the editor; retry with backoff; warn on tab close
  (`beforeunload`) only while there are unsaved changes.

## 13. Testing

- **Save pipeline:** JSON with an unknown node type → 400; valid doc → text, word count and links
  extracted correctly.
- **Locking:** two saves with the same version → second gets 409.
- **Tree:** move/reorder keeps positions ordered; cycle rejected.
- **Revisions:** retention policy keeps the right snapshots.
- **Markdown:** export → import round-trip keeps headings, lists, code blocks and links.
- **Bundle:** assert in CI that the board's initial JS chunk doesn't grow when the editor changes
  (the editor must stay in its lazy chunk).

## 14. Milestones

1. **Drafts only:** one draft page per card, basic blocks, autosave, word count on the card. (~2 weeks)
2. **Page tree + slash menu + search.** (~1–2 weeks)
3. **History, backlinks, card/PR chips, Markdown import/export.** (~1–2 weeks)
4. **Collaboration-aware:** mentions in pages, soft lock, then Yjs if needed. (after collaborative-boards)
5. **Publish integrations:** Dev.to / Hashnode APIs, "Ready to publish" checklists per content type.
