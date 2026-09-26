# Email alerts

Deliver the important notifications by email: instantly for mentions and replies,
as a daily digest for everything else, and as due-date reminders.

> **Status:** proposed · **Depends on:** [notifications](../notifications/README.md) (what to send), a verified email on the account from [collaborative-boards](../collaborative-boards/README.md) · The same email sender is also needed by collaborative-boards for magic links and invites, so build §6 first there.

---

## 1. Goals and non-goals

**Goals (v1)**

- **Instant emails** for `MENTIONED` and `REPLY` (per the defaults in notifications §2).
- A **daily digest** at 08:00 in the user's time zone: everything else unread since the last digest,
  grouped by workspace and card.
- **Due-date reminders** (`DUE_SOON`, `OVERDUE`) inside the digest.
- **One-click unsubscribe** per type and "unsubscribe from all".
- **Reliable delivery:** retries with backoff, no duplicates, bounces handled.
- **Transactional emails** that aren't notifications: magic links, invites (shared infrastructure).

**Non-goals (v1)**

- Replying to an email to post a comment (inbound email parsing: follow-up, §12).
- Marketing / newsletter email. Different legal rules; keep it out of this system.
- Rich HTML design systems (MJML etc.). Simple, accessible HTML + a plain-text part.

## 2. Email types

| Email | Trigger | Timing | Can unsubscribe? |
|---|---|---|---|
| Sign-in link | `POST /api/auth/magic-link` | immediate | No (the user asked for it) |
| Invite | Owner invites an email | immediate | No, but it's one email; reply-to is the inviter |
| Mention / reply | Notification with email = INSTANT | within ~1 minute, **held 60s** (see §5) | Yes |
| Daily digest | Unread notifications with email = DIGEST | 08:00 local | Yes |

## 3. What an email looks like

**Instant mention** (subject: `Priya mentioned you on CC-12: Hibernate deep dive`)

```
Priya mentioned you on CC-12 · Hibernate deep dive

  "Can @harshal review the SessionFactory section before Friday?"

  [ Open CC-12 ]

You're receiving this because you were mentioned in "Personal Workspace".
Unsubscribe from mention emails · Notification settings
```

**Daily digest** (subject: `3 updates in Personal Workspace · 1 overdue`)

```
Good morning, Harshal. Here's what happened since yesterday.

⚠ Overdue
  CC-4 · Record Hibernate video · was due Sep 30

Personal Workspace
  CC-12 · Hibernate deep dive
    · 3 new comments (Priya, Alex)
    · Moved to In Progress by Alex
  CC-7 · Portfolio rewrite
    · PR #42 merged

  [ Open board ]
```

Rules:

- Subject lines under 70 characters, card key first so they sort and scan well.
- Always a **plain-text** part (accessibility, some clients, spam scores).
- HTML: single column, max-width 600px, system fonts, inline styles only, the brand blue
  `#0052CC` for the button, real text (no images of text), `alt` on any image.
- Never include the full description or long comment bodies. 200-character snippets, then "Open".
- **Never include an access key or session token** in an email body.

## 4. Database schema

```sql
-- V{n}__email.sql
CREATE TABLE email_job (
    id               BIGSERIAL PRIMARY KEY,
    kind             VARCHAR(20) NOT NULL,   -- MAGIC_LINK, INVITE, INSTANT, DIGEST
    to_address       CITEXT      NOT NULL,
    account_id       BIGINT      REFERENCES account(id) ON DELETE CASCADE,
    dedupe_key       VARCHAR(120) NOT NULL UNIQUE,   -- e.g. 'INSTANT:notification:9812', 'DIGEST:3:2026-10-02'
    payload          JSONB       NOT NULL,           -- ids needed to render at send time
    send_after       TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempts         INT         NOT NULL DEFAULT 0,
    last_error       TEXT,
    provider_msg_id  VARCHAR(120),
    sent_at          TIMESTAMPTZ,
    cancelled_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_pending ON email_job (send_after) WHERE sent_at IS NULL AND cancelled_at IS NULL;

CREATE TABLE email_suppression (         -- addresses we must not email
    address     CITEXT PRIMARY KEY,
    reason      VARCHAR(20) NOT NULL CHECK (reason IN ('HARD_BOUNCE','COMPLAINT','MANUAL')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification ADD COLUMN emailed_at TIMESTAMPTZ;  -- so a digest doesn't repeat what was sent instantly
ALTER TABLE account      ADD COLUMN last_digest_at TIMESTAMPTZ;
```

The `dedupe_key UNIQUE` is the idempotency guarantee: the notification worker can enqueue
the same email twice (on a retry) and the second insert is a no-op (`ON CONFLICT DO NOTHING`).

## 5. How sending works

```
notification worker ──(email=INSTANT)──▶ email_job(send_after = now()+60s)
digest scheduler (hourly, users at 08:00 local) ──▶ email_job(kind=DIGEST)
email worker @Scheduled(fixedDelay=5s):
   claim due jobs FOR UPDATE SKIP LOCKED
   skip if suppressed / user unsubscribed / notification already read  → cancelled_at
   render template → EmailSender.send() → sent_at, provider_msg_id
   on failure → attempts++, send_after = now() + backoff
```

**The 60-second hold** on instant emails: if the person reads the notification in the app
within a minute (they're online), the job is cancelled. This is how GitHub and Slack avoid
emailing you about something you already saw.

**Backoff:** 1m, 5m, 30m, 2h, 6h, then give up. Don't retry 4xx "invalid address" errors;
suppress the address instead.

**Throughput:** providers rate-limit (often ~10 requests/second on starter plans). The worker
sends at most N per tick; that's plenty for this app.

## 6. Provider abstraction

```java
public interface EmailSender {
    SendResult send(OutgoingEmail email);   // to, subject, text, html, headers
}
```

| Implementation | When |
|---|---|
| `SmtpEmailSender` (Spring's `JavaMailSender`, `spring-boot-starter-mail`) | Local dev against **Mailpit** (a local SMTP server with a web inbox at `localhost:8025`) |
| `ResendEmailSender` / `PostmarkEmailSender` / `SesEmailSender` (HTTP API) | Production. Pick one; all have free tiers suitable for a side project. |
| `LoggingEmailSender` | Tests and CI: records emails in memory so tests can assert on them. |

Choose the implementation with a property (`app.email.provider=smtp|resend|log`). API keys come
from environment variables only.

## 7. Deliverability (why emails end up in spam, and how to avoid it)

- Send from **your own domain** (e.g. `notifications@contentcalendar.app`), never from a Gmail address.
- DNS records on that domain, all provided by the email provider's setup page:
  - **SPF**: which servers may send for the domain.
  - **DKIM**: cryptographic signature on each message.
  - **DMARC**: policy telling inboxes what to do when SPF/DKIM fail (start with `p=none`, move to `quarantine`).
- Separate subdomains for transactional mail vs anything bulk, so one can't hurt the other's reputation.
- Keep complaint rates low: easy unsubscribe, no email the user didn't expect, digests instead of floods.

## 8. Unsubscribe

- Every non-transactional email has:
  - a visible "Unsubscribe from <type> emails" link, and
  - `List-Unsubscribe: <https://app/.../unsubscribe?t=...>` plus
    `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers (RFC 8058). Gmail and Yahoo
    require one-click unsubscribe for bulk senders.
- The token is an **HMAC-signed** string `accountId.type.expiry.signature`, so the link works
  without being signed in and can't be forged to unsubscribe someone else.
- Unsubscribing sets that type's preference to `email = OFF`. A settings link lets people fine-tune.

## 9. Bounces and complaints

Providers call a webhook when an email hard-bounces or is marked as spam.

- `POST /api/webhooks/email/{provider}`: verify the provider's signature first.
- Hard bounce or complaint → insert into `email_suppression`; the worker skips suppressed addresses.
- Show the user a banner in the app: "We couldn't deliver email to x@y.com. Update your address."

## 10. Security

- **Header injection:** never put raw user input into headers. Subjects are built from
  templates; strip `\r` and `\n` from any interpolated value (card titles!).
- **Links in emails** point only at the app's own domain; card titles and comment snippets are
  HTML-escaped in the HTML part.
- **Magic links** expire in 15 minutes and are single use (see collaborative-boards §10).
- **Don't reveal account existence:** the magic-link endpoint returns 202 whether or not the email exists.
- **Rate limits** on magic-link and invite sending per address and per IP.

## 11. Single-user version (before collaboration)

Access-key boards have no email address. A small early version:

1. "Email me reminders" in a new Settings screen asks for an email address.
2. Verify it with a confirmation link (never send reminders to an unverified address,
   otherwise anyone could make the app email a stranger).
3. Send only the daily due-date digest.

Store it as `app_user.email` + `email_verified_at`. When collaboration ships, it becomes the
account's email during the claim flow.

## 12. Testing

- **Unit:** templates render with long titles, emoji, and HTML-looking titles (`<b>` must appear
  as text); subject never contains newlines.
- **Integration:** `LoggingEmailSender` + fixed clock: mention → one instant email after the hold;
  read within 60s → none; digest at 08:00 local for two time zones.
- **Idempotency:** enqueue the same job twice → one email.
- **Manual:** Mailpit locally to see real rendering; send to Gmail and Outlook test accounts
  before launch and check the "show original" SPF/DKIM/DMARC results say PASS.

## 13. Follow-ups

- **Reply by email** to comment (inbound parsing via the provider's inbound webhook, signed reply-to addresses per thread).
- **Weekly summary** email: cards completed this week, what's due next week.
- **Per-workspace digest** instead of one combined digest.
