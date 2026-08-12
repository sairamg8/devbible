---
title: "Audit logging and tamper-evidence"
sidebar_label: "27 · Audit logging"
sidebar_position: 27
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** — every output below is from
> `sandbox/p8-security/ex25-audit-log.mjs`.

An audit log answers *who did what to which record, when, and did it work* — months later,
to someone who was not there, possibly in a dispute. That is a different job from
application logging ([phase 10](../phase-10-observability/01-structured-logging.md)), and
it fails in a specific way: nobody notices it is wrong until the day it matters.

Reach for this when you have privileged actions, regulated data, or multiple tenants. Not
every service needs one.

## An audit event is not a log line

```json
{"ts":"2026-08-11T02:15:00.000Z",
 "actor":{"id":"u_1042","type":"user","ip":"203.0.113.9"},
 "action":"permission.grant",
 "target":{"type":"project","id":"p_77"},
 "before":{"role":"viewer"},"after":{"role":"admin"},
 "outcome":"success","requestId":"01J9Z3K7WQ","actorSession":"s_88f1"}
```

Six things make it auditable rather than merely logged:

- **Actor**, including *type* — a human, a service account and an admin impersonating a
  user are three different answers to "who".
- **Action** from a closed vocabulary (`permission.grant`), not a sentence. You will
  filter on this.
- **Target** as type plus id, so the record survives renaming.
- **`before` and `after`** — the state change is the evidence; "updated the project" is
  not.
- **Outcome**, because **denied attempts are the interesting ones.** A log with only
  successes cannot show an attacker probing.
- **`requestId`**, tying it to the application logs and traces
  ([phase 10, page 03](../phase-10-observability/03-correlation-ids.md)).

Write it where the decision is made — in the service layer, in the same transaction as the
change when the store allows it. An audit record written by a controller records what was
*requested*; one written next to the update records what *happened*.

## Tamper-evidence: a hash chain

You cannot stop someone with database access from editing history. You can make the edit
detectable. Each record commits to the previous record's MAC:

```js
const body = canonical({ ...payload, seq, prev });        // stable key order
const mac  = crypto.createHmac('sha256', KEY).update(body).digest('hex');
```

```console
seq 0 login              mac 724f6b0ef2bc5189…
seq 1 permission.grant   mac 0c3296c615204b23…
seq 2 export.download    mac 026191a87412614e…
verify -> intact
```

`canonical` matters more than it looks: `JSON.stringify` preserves insertion order, so the
same object built two ways hashes differently. Sort the keys, or verification fails on
records nobody touched.

**What it catches, and what it does not:**

```console
edit a field     -> BROKEN at seq 1
delete a record  -> BROKEN at seq 2
truncate the end -> intact          <- a chain alone CANNOT detect this
```

That third line is the one people miss. Removing records from the *end* leaves a shorter
but perfectly valid chain. Since "delete the evidence of what I just did" means removing
the most recent entries, this is precisely the attack.

**The fix is an external anchor.** Periodically publish the head:

```console
{ seq: 2, mac: 026191a87412614e… }
```

to somewhere the attacker does not control — a second account, a signed receipt to a
customer, an append-only object store with retention lock, or a monitoring system. Then
truncation past the last anchor is visible. Anchoring every few minutes bounds the window;
that trade is the whole design.

Use HMAC with a key the application holds, or an asymmetric signature
([page 26](./26-encryption-and-keys.md)) if a third party must verify without being able
to forge. A bare `sha256(prev + record)` with no key lets anyone who can edit a record
recompute the whole chain.

## It is cheap

```console
JSON.stringify only            0.46 µs
canonical + HMAC (the chain)   8.99 µs
```

Nine microseconds per privileged action, against a database write of milliseconds.
Verification is one linear pass, so store a checkpoint every N records rather than
re-reading ten million to check the last hour.

## Append-only is a property of the storage, not the code

```console
opened with "a" -> 2 lines
same process truncated it -> 10 bytes
```

Opening with `'a'` makes writes go to the end; it does nothing to stop the same process
from truncating the file. Real enforcement is outside your process: `chattr +a`, WORM or
object-lock storage, a database table with no UPDATE or DELETE grant for the application
user, or shipping to a log service the app cannot rewrite.

Two more storage properties worth deciding deliberately:

- **Durability.** `fs.fsyncSync(fd)` after the write, or a crash loses the record that
  mattered. For most systems the audit row belongs in the database transaction instead.
- **Ordering.** Server clocks drift, so a record ordered only by timestamp is not ordered
  ([phase 7, page 10](../phase-7-background-work/10-time-on-the-server.md)). The sequence
  number is the authority; the timestamp is data.

Timestamps are UTC ISO-8601, always:

```console
UTC   -> 2026-08-11T02:15:00.000Z
local -> Tue Aug 11 2026 07:45:00 GMT+0530     <- ambiguous across DST and hosts
```

## What must never go in

```console
raw       -> {"action":"login","password":"hunter2","token":"eyJhbGci…","card":"4111111111111111"}
auditable -> {"action":"login","password":"[redacted]","token":"[redacted]","card":"[redacted]"}
```

An audit log is long-lived, widely readable and often exported — the worst possible home
for a secret ([page 18](./18-secrets.md)). Card numbers become a last-4 or a token;
credentials never appear at all, not even hashed.

Personal data is a genuine tension: the audit log's purpose is to record who did
something, and privacy regimes ask you to minimise and delete. The usual resolutions are a
stable pseudonymous actor id resolvable through a separate, access-controlled mapping, and
a retention period set by policy rather than by disk space. Both are decisions to write
down before the first record exists, because they cannot be applied retroactively to an
immutable log.

## Gotchas

**Symptom:** Verification fails on records nobody edited
**Cause:** Non-canonical serialisation — `JSON.stringify` preserves insertion order, so the same data hashes two ways.
**Fix:** Sort keys before hashing, and pin the serialisation format alongside the chain.

**Symptom:** The chain verifies but recent events are missing
**Cause:** Truncation. A chain shortened from the end is still internally valid — verified, `intact`.
**Fix:** Publish the head MAC periodically to a system the application cannot rewrite.

**Symptom:** Anyone who can edit a row can also repair the chain
**Cause:** An unkeyed hash chain — `sha256(prev + record)` is recomputable by anyone.
**Fix:** HMAC with an application-held key, or an asymmetric signature for third-party verification.

**Symptom:** The audit log shows nothing during an incident
**Cause:** Only successful actions are recorded.
**Fix:** Log denials, failed authentications and authorization refusals with the same schema — that is where an attack is visible.

**Symptom:** The log survived the audit but not a crash
**Cause:** Buffered writes with no `fsync`, or a file write outside the transaction that changed the data.
**Fix:** Write the audit row in the same transaction, or `fsync` explicitly.

**Symptom:** A secret was found in five-year-old audit records
**Cause:** The event object was logged wholesale.
**Fix:** An explicit allowlist of fields per action type. Redaction after the fact is not possible on an immutable log.

## Interview questions

**★ How is an audit log different from an application log?**
Different audience, retention and threat model. It records who did what to which entity,
with `before`/`after` and an outcome, in a closed action vocabulary, kept for years and
read by people investigating a dispute. Application logs are for debugging and are
routinely dropped, sampled and reformatted.

**★ How do you make a log tamper-evident?**
Chain each record to the previous one's HMAC over a canonical serialisation. Editing a
field or deleting a record breaks verification — verified, `BROKEN at seq 1` and
`BROKEN at seq 2`.

**★ What can a hash chain not detect?**
Truncation. Removing records from the end leaves a shorter valid chain — verified, it
reported `intact`. Since deleting the newest evidence is the actual attack, you must anchor
the head MAC externally at intervals; the anchoring period is the size of the window an
attacker gets.

**★ Is opening a file with `'a'` enough to make it append-only?**
No. It only directs writes to the end — the same process truncated the file immediately
afterward, verified. Append-only must be enforced by storage: `chattr +a`, object-lock,
or revoking UPDATE and DELETE from the application's database user.

**What does it cost?**
About 9 µs per record for canonical serialisation plus HMAC, against 0.46 µs for
`JSON.stringify` alone — negligible next to the write it accompanies. Verification is
linear, so keep periodic checkpoints.

**What do you deliberately leave out?**
Credentials, tokens, full card numbers — an audit log is long-lived and widely read, so it
is the worst place for a secret. Personal data gets a pseudonymous actor id with a separate
mapping and a policy-driven retention period, decided before the first record, because an
immutable log cannot be edited later.

---

← Prev: [Encryption, signing and key management](./26-encryption-and-keys.md) · Next → [Phase 9 · Testing](../phase-9-testing/)
