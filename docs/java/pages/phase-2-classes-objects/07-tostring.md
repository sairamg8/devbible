---
title: "toString — for logs, not for parsing"
sidebar_label: "07 · toString"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the `java.lang.Object#toString` Javadoc and the
> `java.util.StringJoiner` Javadoc (JDK 25 API documentation), and JEP 395 for
> the record-generated form.

**`toString` has exactly one contract-level promise — "a concise,
informative, human-readable representation" — and exactly one correct
audience: a human reading a log line, a debugger pane, or a test failure. The
two ways teams get it wrong are opposites: leaving the useless default
(`Order@1b6d3586` in every log), or making it so rich it leaks passwords,
triggers lazy loading, or becomes an accidental API that other code parses.**

## What the default gives you, and why you override it

`Object.toString()` returns `getClass().getName() + "@" + hex(hashCode())` —
which identifies *an* instance but describes nothing. The first time an
incident log shows `payment failed for Order@1b6d3586`, the override writes
itself.

The audiences that consume `toString`, all human:

- **Log lines** — `log.info("processing {}", order)` calls it via the logging
  framework's formatter.
- **Debugger and IDE views** — variable panes render it.
- **Test failure messages** — `assertEquals` prints both sides' `toString`;
  a good one turns "expected X but was Y" from riddle into diagnosis.
- **Exception messages** — `"no rate for " + currencyPair` interpolates it.

## What a good one includes — and omits

Include: **the identity fields** (id, business key) and the **few state
fields a human needs to distinguish instances** (status, amount). Aim for one
line.

Omit, each for its own failure mode:

| Omit | Because |
|---|---|
| **Secrets** — passwords, tokens, keys, full card numbers, session ids | `toString` output lands in logs, which are shipped, indexed, retained, and read by more people than your database is. A credential in `toString` is a credential in Splunk. Mask (`"****" + last4`) or exclude |
| **PII beyond need** — emails, addresses, birthdates | Log retention meets privacy regulation (GDPR-era log-scrubbing is expensive); log the user *id*, not the user |
| **Lazy-loaded JPA relations** | A `toString` that touches `order.getItems()` on a detached entity throws `LazyInitializationException` — *from inside a log statement*, the least expected crash site in Java. Entities' `toString` uses id + own columns only |
| **Large collections / byte arrays** | One logged object becomes a 4MB log line; log sizes, not contents (`items=27`) |
| **Other objects' full `toString` recursively** | Bidirectional relations (`Order` ↔ `Customer`) recurse to `StackOverflowError` |

## Implementations, ranked

- **Records**: generated automatically — `Money[amount=9.99, currency=EUR]`
  (JEP 395 specifies the `Type[name=value, ...]` shape). Right by default
  *unless* a component is secret — then override just `toString`, keeping the
  generated `equals`/`hashCode`.
- **IDE generation / `StringJoiner`**: for regular classes. `StringJoiner`
  keeps hand-written ones tidy:

  ```java
  @Override public String toString() {
      return new StringJoiner(", ", "Order[", "]")
          .add("id=" + id)
          .add("status=" + status)
          .toString();
  }
  ```
- **Lombok `@ToString`** where Lombok is already in the build — note its
  `exclude`/`@ToString.Exclude` for secrets and relations.

## The anti-pattern: parsing `toString`

The moment code does `order.toString().split(",")` — or a test asserts on the
exact string — the format has become an API. `toString` promises no format
stability: adding a field, reordering, or switching to a record changes it,
and now refactoring breaks parsers you didn't know existed. The rule both
directions:

- **Never parse it.** Machine-readable output is a *serializer's* job
  (Jackson — [phase 7, topic 05 territory](../phase-7-io-time-stdlib/README.md)).
- **Never promise it.** Don't document the format; feel free to change it.
  (One JDK-sanctioned exception: `Integer.toString` and friends *are*
  specified — value types in `java.lang` document their formats. Your domain
  classes are not `Integer`.)

## Gotchas

**Symptom:** `LazyInitializationException` thrown by a log statement
**Cause:** entity `toString` walks a lazy relation after the session closed
**Fix:** entity `toString` = id + own scalar columns, never relations; the full lazy-loading story is phase 10

**Symptom:** a password or bearer token appears in production logs
**Cause:** `toString` (often Lombok- or record-generated over all fields) included a credential field, and a debug log printed the object
**Fix:** override `toString` on secret-bearing classes (mask or omit); add a log-scrubbing check in review for `password`, `token`, `secret` fields on logged types

**Symptom:** `StackOverflowError` with a stack full of alternating `toString` frames
**Cause:** bidirectional relationship, both sides printing each other
**Fix:** one side prints the other's *id* only — break the cycle explicitly

**Symptom:** refactoring a class to a record broke a test
**Cause:** the test asserted on the exact `toString` output — an accidental format API
**Fix:** assert on fields, not string forms; treat any `toString` parsing found in review as a bug

**Symptom:** logs unreadable — one entry spans thousands of characters
**Cause:** `toString` embeds a large collection or byte array
**Fix:** print sizes and identifying samples (`items=412`), never full contents

**Symptom:** debugging is slow because the debugger shows `Repository@3f2a...` for everything
**Cause:** infrastructure classes left on the default — which is *usually correct* for stateless services, but painful for value-ish classes
**Fix:** override on classes whose *state* distinguishes instances; leave true singletons/services alone

## Interview questions

**★ Who is `toString` for, and what follows from that?**
Humans: logs, debuggers, test failures, exception messages. It follows that
the format is unstable by design (never parse it, never assert on it), that
it must be safe to call anywhere (no lazy loading, no exceptions), and that
its contents are governed by log hygiene (no secrets, no PII, no megabytes).

**★ What belongs in a JPA entity's `toString`?**
The id and the entity's own scalar columns. Relations are excluded because
they may be lazy proxies — touching them in a detached context throws from
inside logging — and bidirectional ones recurse.

**★ Records generate `toString` over every component. When is that wrong?**
When a component is a secret or oversized. Override `toString` alone — the
generated `equals`/`hashCode` stay — masking or omitting the sensitive
component.

**Why is parsing `toString` output a bug even when it works today?**
The format carries no compatibility promise; any field addition or the
class-to-record migration silently changes it. Code that needs structured
output should use a serializer with a schema it controls.

**What's the difference between `toString` for a value class and for a service?**
Value classes (money, ids, DTOs) have distinguishing state — override.
Stateless services and singletons are distinguished by *role*, not state —
the default identity form is fine and the override would say nothing.

---

← Prev: [equals and hashCode](06-equals-hashcode/README.md) · Next → [Records](08-records/README.md)
