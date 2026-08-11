---
title: "What to log and what never to log"
sidebar_label: "04 · What to log"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Logs are a liability as well as an asset — every field you write is stored, replicated, and often visible to more people than the production database.**

The skill is not "log more"; it is choosing events that debug production without
creating a second copy of your users' secrets.

## Log the decisions and the outcomes

Useful lines answer: *what did we decide, for whom, and what happened next?*

| Log | Why |
|---|---|
| Authz deny with reason code | Explains 403s without replaying the request |
| State transitions (`pending → paid`) | Reconstruct business timeline |
| Outbound dependency failure with status/code | Separates *your* bug from *their* outage |
| Retry / backoff exhausted | Ties to [Phase 7](../phase-7-background-work/) behaviour |
| Config fallback at boot | "Why is it using the default pool size?" |

```js
log().info({
  orderId,
  from: order.status,
  to: 'paid',
  paymentId,
}, 'order state transition');

log().warn({
  orderId,
  provider: 'stripe',
  status: 503,
  attempt: 2,
}, 'payment provider unavailable, will retry');
```

**Prefer domain events over HTTP chatter.** Access logs cover method/path/status.
App logs should still make sense if you never open the access log.

## Never log these

| Category | Examples | Why |
|---|---|---|
| Secrets | Passwords, API keys, `Authorization` headers, session tokens | Instant credential leak |
| Payment data | Full PAN, CVV, bank account numbers | PCI and basic competence |
| Government ids | National ID, passport, SSN equivalents | Legal + irreversible exposure |
| Raw PII dumps | Full address books, message bodies "just in case" | Retention nightmares |
| Encryption material | Private keys | Breaks the security model |

```js
// Wrong
log().info({body: req.body}, 'signup');

// Right — explicit allowlist
log().info({
  emailDomain: email.split('@')[1],
  plan: body.plan,
}, 'signup');
```

**Redaction is a seatbelt, not a license.** Configure pino redact paths
([page 02](./02-pino-in-practice.md)), and still do not put passwords on the object.

## PII: minimize, hash, or drop

1. **Opaque internal ids** (`userId`) already in your DB.
2. **HMAC or hash of email** if you must match support tickets without storing raw email in logs.
3. **Truncation** — last 4 of a phone, never the full number by default.

```js
import {createHmac} from 'node:crypto';

function emailFingerprint(email) {
  return createHmac('sha256', process.env.LOG_HASH_SECRET)
    .update(email.toLowerCase())
    .digest('hex')
    .slice(0, 16);
}
```

## Volume discipline

| Bad default | Cost |
|---|---|
| Log every SQL query in production | Disk + PII in queries + noise |
| Log full request/response bodies | Secrets + huge lines + cost |
| `debug` fleet-wide | Alert fatigue; real errors hide |
| Log inside tight loops | Hot path becomes I/O bound |

**Sample high-volume success paths** if you need examples (1 in N), and always keep
errors. Metrics cover rates; logs cover instances.

## Access logs vs app logs

- **Access log**: method, path, status, duration, request id.
- **App log**: domain events and failures with business fields.

Duplicating every request as an `info` line doubles cost and rarely adds signal.

## Retention and access

- **Retention** shorter than the database for high-volume streams.
- **Who can query** production logs (often broader than who can `SELECT` users).
- **A delete story** for erasure — if email is in logs, erasure is hard.

## Gotchas

**Symptom:** Security review finds bearer tokens in the log platform
**Cause:** Middleware logged headers or `req` wholesale
**Fix:** Allowlist fields; redact `authorization` and `cookie`

**Symptom:** "I logged the body only on errors" still leaks passwords
**Cause:** Signup/login errors include the submitted body
**Fix:** Explicit field allowlists for auth routes

**Symptom:** Cannot debug which user failed, and compliance forbids email in logs
**Cause:** No stable internal id on the event
**Fix:** Log `userId` always; fingerprint email only when support requires it

**Symptom:** Log pipeline drops lines or delays under load
**Cause:** Enormous per-request payloads or debug volume
**Fix:** Cap message size; cut body logging; return to `info` default

**Symptom:** Erasure request cannot be fulfilled for logs
**Cause:** Raw email/name stored in log indexes for months
**Fix:** Stop writing raw PII; shorten retention

**Symptom:** Useful context missing when something fails
**Cause:** Over-aggressive "log nothing" culture after a leak scare
**Fix:** Log outcomes and ids; ban secrets and bodies, not all context

## Interview questions

**★ What should never appear in application logs?**
Passwords, tokens, raw card data, private keys, and usually full request bodies.
Prefer internal ids and outcome codes.

**★ Why are logs a bigger confidentiality risk than many people expect?**
Log stores often have wider read access and longer copies than the primary database,
and they are built for search, not least-privilege row access.

**How do you log enough to debug payment failures without storing card numbers?**
Log `orderId`, provider, decline code, HTTP status, latency, and retry count.

**When is logging every request at `info` wrong?**
When an access log or metric already covers success traffic.

**What is the difference between redaction and data minimization?**
Minimization means not putting sensitive fields on the object. Redaction strips fields
that slipped through. You want both; minimization first.

---

← Prev: [Correlation IDs](./03-correlation-ids.md) · Next → [OpenTelemetry](./05-opentelemetry.md)
