# GitHub PR linking

Connect cards to the pull requests that deliver them: see PR status on the board,
link PRs automatically from their title or branch, and move cards to Completed when
the PR merges.

> **Status:** proposed · **Depends on:** Foundations only. **Phase 1 works with today's access-key boards.** · **Unlocks:** `PR_MERGED` [notifications](../notifications/README.md)

---

## 1. Why this first

- It works for a single user, so it doesn't wait for accounts.
- It's the feature that makes this *a developer's* content calendar: the article card and
  the demo-repo PR live together.
- It teaches real integration skills: third-party REST APIs, webhooks, signature verification,
  idempotency, rate limits.

## 2. Goals and non-goals

**Goals**

- **Link** one or more PRs to a card (paste a URL).
- **Show** each PR's live state on the card: Open, Draft, Merged, Closed; checks passing/failing;
  review state (approved / changes requested).
- **Auto-link:** a PR whose title, branch or body mentions `CC-12` links itself to card 12.
- **Automations** (opt-in): PR opened → card to *In Progress*; PR merged → card to *Completed*.
- **Branch helper:** "Copy branch name" on a card → `cc-12-hibernate-deep-dive`.

**Non-goals**

- Creating PRs or pushing code from the app.
- GitLab / Bitbucket in v1 (design for a provider interface so they can be added).
- Showing diffs or reviewing code inside the app.

## 3. Phases

| Phase | What | Auth to GitHub | Updates |
|---|---|---|---|
| **1. Paste a link** | Link public PRs by URL; show state | None, or one server token | Refreshed when the card opens + every 10 min |
| **2. GitHub App** | Private repos, webhooks, auto-link, automations | GitHub App installation | Real time via webhooks |

Phase 1 is a weekend. Phase 2 is the real feature.

## 4. User flows

**Link manually (phase 1+)**

1. Open CC-12. Sidebar has a new **Development** section with "Link pull request".
2. Paste `https://github.com/harshall25/content-boot/pull/42`.
3. The server validates the URL, fetches the PR, stores a snapshot, and shows:
   `⟟ #42 Add Hibernate docs · Open · ✓ checks · harshall25/content-boot`.
4. The card on the board gets a small PR icon with the state colour.

**Connect GitHub (phase 2)**

1. Settings → Integrations → **Connect GitHub** → GitHub's "Install app" screen, where you pick
   *All repositories* or specific ones.
2. GitHub redirects back with an `installation_id`; the server stores it against the board.
3. From now on, opening a PR titled `CC-12: Add Hibernate docs` (or branch `cc-12-…`)
   links it to card 12 automatically, within seconds, and card 12 shows it.

**Automation**

- Settings → Automations: two toggles, both off by default:
  - "When a linked PR is opened, move the card to *In Progress*"
  - "When a linked PR is merged, move the card to *Completed*"
- Moves made by automation show up in history as "GitHub (via PR #42)".

## 5. Parsing card keys

Accept, case-insensitive: `CC-12`, `cc-12`, `CC 12`, `[CC-12]` in the **title**; `cc-12` or `cc/12`
at the **start of the branch name**; `CC-12` anywhere in the **body**. Use the board's prefix
(from collaborative-boards; `CC` until then).

```java
Pattern key = Pattern.compile("(?i)(?<![a-z0-9])" + Pattern.quote(prefix) + "[-_ /]?(\\d{1,6})(?![0-9])");
```

**Numbers must belong to one board.** Today `CC-12` is the global row id, so two boards would
both claim "CC-12". Phase 2 auto-linking should wait for per-workspace card numbers
(collaborative-boards, "Card numbers per workspace"), or resolve keys only within the board that
owns the GitHub installation. Manual linking (phase 1) has no such problem.

## 6. Database schema

```sql
-- V{n}__github.sql
CREATE TABLE github_installation (
    id                BIGSERIAL PRIMARY KEY,
    board_ref         VARCHAR(40) NOT NULL,     -- access key today, workspace id after collaboration
    installation_id   BIGINT      NOT NULL UNIQUE,
    account_login     VARCHAR(100) NOT NULL,    -- user/org the app is installed on
    automation_open   BOOLEAN NOT NULL DEFAULT false,
    automation_merge  BOOLEAN NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    suspended_at      TIMESTAMPTZ
);

CREATE TABLE pr_link (
    id              BIGSERIAL PRIMARY KEY,
    content_id      INT          NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    repo_full_name  VARCHAR(200) NOT NULL,        -- 'harshall25/content-boot'
    pr_number       INT          NOT NULL,
    url             VARCHAR(300) NOT NULL,
    title           VARCHAR(300) NOT NULL,
    state           VARCHAR(10)  NOT NULL CHECK (state IN ('OPEN','DRAFT','MERGED','CLOSED')),
    author_login    VARCHAR(100),
    head_ref        VARCHAR(255),
    checks_state    VARCHAR(10)  CHECK (checks_state IN ('PENDING','SUCCESS','FAILURE','NONE')),
    review_state    VARCHAR(20)  CHECK (review_state IN ('APPROVED','CHANGES_REQUESTED','REVIEW_REQUIRED','NONE')),
    merged_at       TIMESTAMPTZ,
    link_source     VARCHAR(12)  NOT NULL CHECK (link_source IN ('MANUAL','AUTO_TITLE','AUTO_BRANCH','AUTO_BODY')),
    unlinked        BOOLEAN      NOT NULL DEFAULT false,   -- user removed an auto-link; don't re-add it
    github_updated_at TIMESTAMPTZ,                         -- ignore webhook payloads older than this
    etag            VARCHAR(100),                          -- for conditional polling (phase 1)
    refreshed_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (content_id, repo_full_name, pr_number)
);
CREATE INDEX pr_link_by_pr ON pr_link (repo_full_name, pr_number);

CREATE TABLE github_webhook_delivery (   -- idempotency: GitHub can deliver the same event more than once
    delivery_id  UUID PRIMARY KEY,
    event        VARCHAR(40) NOT NULL,
    received_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Why store a snapshot instead of asking GitHub on every board load? A board with 40 cards would
make 40+ API calls per page view and hit rate limits immediately. The snapshot is refreshed by
webhooks (phase 2) or polling (phase 1).

**`unlinked`** matters: if auto-linking attached the wrong PR and the user removes it, the next
webhook for that PR must not silently re-link it.

## 7. API

| Method & path | Purpose |
|---|---|
| `GET /api/content/{id}/prs` | Linked PRs for a card (also embedded in the card list as a compact summary). |
| `POST /api/content/{id}/prs` `{ "url": "..." }` | Link manually. 400 if not a GitHub PR URL; 404 if GitHub says it doesn't exist or isn't visible. |
| `DELETE /api/content/{id}/prs/{linkId}` | Unlink (sets `unlinked = true` for auto links). |
| `POST /api/content/{id}/prs/refresh` | Force refresh (rate-limited to once per 30s per card). |
| `GET /api/integrations/github/install` | Redirect to the GitHub App install page with a signed `state`. |
| `GET /api/integrations/github/callback?installation_id=&state=` | Store the installation after verifying `state`. |
| `PATCH /api/integrations/github` `{ automationOpen, automationMerge }` | Toggles. |
| `DELETE /api/integrations/github` | Disconnect (also remind the user to uninstall on GitHub). |
| `POST /api/webhooks/github` | GitHub → us. **Excluded from the access-key interceptor**, authenticated by signature instead (§9). |

The card list response gains a compact field so the board can draw icons without extra calls:

```json
{ "id": 12, "title": "...", "prs": { "count": 2, "state": "OPEN", "checks": "FAILURE" } }
```

`state` is the "most important" one: any MERGED → MERGED, else any OPEN → OPEN, else DRAFT, else CLOSED.

## 8. Talking to GitHub

### Phase 1: REST API, optional token

- Parse the URL strictly with `java.net.URI`: host must be exactly `github.com`, path
  `/{owner}/{repo}/pull/{number}`. **Never fetch the URL the user gave you**; build the API URL
  yourself: `https://api.github.com/repos/{owner}/{repo}/pulls/{number}`. This prevents SSRF
  (tricking the server into requesting internal addresses).
- Unauthenticated calls are limited to 60/hour per server IP; with a server-side token
  (fine-grained, read-only, public repos) it's 5,000/hour.
- Use **conditional requests**: send `If-None-Match: <etag>`; a `304 Not Modified` doesn't count
  against the rate limit.
- Checks: `GET /repos/{o}/{r}/commits/{head_sha}/check-runs` → combine into SUCCESS / FAILURE / PENDING.
- Reviews: `GET /repos/{o}/{r}/pulls/{n}/reviews` → latest review per reviewer.
- HTTP client: Spring's `RestClient` (no extra dependency).

### Phase 2: GitHub App

Why an **App** rather than OAuth or personal tokens: installs are per repository, permissions
are minimal and visible to the user, tokens are short-lived, and webhooks come built in.

- **Permissions:** Pull requests: read · Checks: read · Metadata: read. Nothing else.
- **Events:** `pull_request`, `pull_request_review`, `check_suite`, `installation`, `installation_repositories`.
- **Auth flow per API call:**
  1. Sign a JWT (RS256, 10-minute expiry) with the App's private key.
  2. `POST /app/installations/{id}/access_tokens` → an installation token valid 1 hour.
  3. Cache it in memory until 5 minutes before expiry.
- **Secrets:** App private key and webhook secret come from environment variables / a secret manager,
  never from a file in the repo.

## 9. Webhook handling (the part to get exactly right)

```java
@PostMapping("/api/webhooks/github")
ResponseEntity<Void> receive(@RequestHeader("X-Hub-Signature-256") String sig,
                             @RequestHeader("X-GitHub-Event") String event,
                             @RequestHeader("X-GitHub-Delivery") UUID deliveryId,
                             @RequestBody byte[] rawBody) {
    if (!signatures.valid(rawBody, sig)) return ResponseEntity.status(401).build();   // 1
    if (!deliveries.firstTime(deliveryId, event)) return ResponseEntity.ok().build(); // 2
    outbox.enqueue("GITHUB_" + event.toUpperCase(), rawBody);                         // 3
    return ResponseEntity.accepted().build();                                          // 4
}
```

1. **Verify the signature over the raw bytes**: HMAC-SHA256 with the webhook secret, compared with
   `MessageDigest.isEqual` (constant time). Read the body as `byte[]`; parsing to JSON and
   re-serializing changes the bytes and breaks the signature.
2. **Dedupe** on `X-GitHub-Delivery` (insert into `github_webhook_delivery`, `ON CONFLICT DO NOTHING`).
3. **Don't process inline.** GitHub expects a response within 10 seconds. Store the payload and let
   the outbox worker (see notifications §4) handle it.
4. Respond quickly with 2xx.

**Processing** a `pull_request` event:

- Find the installation → the board.
- Update any existing `pr_link` rows for `(repo, number)`, but only if
  `payload.pull_request.updated_at > github_updated_at` (events can arrive out of order).
- If not linked yet, parse keys from title/branch/body and link to matching cards on that board
  (skip rows marked `unlinked`).
- If `action = closed` and `merged = true` and automation is on, move the card to Completed and
  write an activity row + `PR_MERGED` outbox event.

**Local development:** GitHub can't reach `localhost`. Use `gh webhook forward` (GitHub CLI) or
smee.io to tunnel webhook deliveries to your machine.

## 10. Frontend

| Place | Change |
|---|---|
| Card (board) | In `card__info`: a PR icon coloured by state (Open `#1f883d` green, Draft grey, Merged `#8250df` purple, Closed `#cf222e` red), plus a count if >1, plus a small ✗ if checks fail. Tooltip lists PR titles. |
| Detail sidebar | **Development** section under URL: each PR as a row: icon, `#42`, title (ellipsized), state pill, checks icon, review icon, "…" menu with Unlink. "Link pull request" input underneath. "Copy branch name" button. |
| Settings (new) | Integrations: Connect / Disconnect GitHub, connected account, the two automation toggles. |
| History | "Linked PR #42 automatically (title mentions CC-12)" entries. |

The GitHub state colours are GitHub's own, used only on PR indicators so they're recognisable;
everything else stays in the Editorial Flow palette.

## 11. Security checklist

- Webhook: signature verified over raw bytes, constant-time compare, dedupe by delivery id,
  reject payloads over 1 MB.
- Install callback: verify a signed, expiring `state` parameter tying the install to the board
  that started it (prevents someone attaching their installation to your board).
- URL input: strict parsing, API URL built server-side, no redirects followed to other hosts.
- Least privilege: read-only App permissions; no user OAuth tokens stored at all.
- Auto-link only within the board that owns the installation, never across boards.
- Rate-limit manual refresh; back off when `X-RateLimit-Remaining` is low.

## 12. Edge cases

- PR mentions `CC-12` and `CC-15`: link to both.
- PR title edited to remove `CC-12`: keep the link (people edit titles; unlinking is explicit).
- Repo renamed or transferred: GitHub sends the new `full_name` in later events; update rows by the
  PR's stable `node_id` (store it too) rather than the name.
- App uninstalled (`installation.deleted`): mark installation removed, keep links as static snapshots
  with a "no longer syncing" hint.
- Force-pushed branch / reopened PR: state simply follows the latest event.
- Card deleted: links cascade away.

## 13. Testing

- **Signature:** known payload + secret → valid; one byte changed → 401.
- **Idempotency:** same delivery twice → processed once.
- **Ordering:** an older `updated_at` payload after a newer one doesn't roll state back.
- **Parser:** table-driven tests for all key formats in §5, including false positives
  (`ABCC-12`, `CC-123` shouldn't match `CC-12`).
- **Recorded fixtures:** save real webhook payloads from a test repo as JSON files under
  `src/test/resources/github/` and replay them.
- **Manual:** a throwaway test repo with the App installed; open, review, merge a PR and watch the card.

## 14. Follow-ups

- **Issues and commits:** link issues the same way; show commits mentioning `CC-12`.
- **GitLab provider** behind a `CodeHostProvider` interface.
- **Deploy status:** show "deployed to production" from GitHub Deployments.
