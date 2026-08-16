---
title: "Money and time"
sidebar_label: "07 · Money & time"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against PostgreSQL 17 documentation (numeric types,
> date/time types) and the node-postgres type-parsing docs. Concept home:
> [PostgreSQL — data types](../../../postgresql/pages/phase-2-types/README.md)
> and [Node — time on the server](../../../nodejs/pages/phase-7-background-work/10-time-on-the-server.md).

## The problem

The two data families every commerce bug report mentions. Money must survive
arithmetic, JSON and two languages without losing a cent; time must mean the
same instant to the database, the worker, and a browser in another timezone.
The schema committed to `bigint` cents and `timestamptz`; this chapter is the
full defence and the working rules.

## Money

**Why not `float`/`double`:** binary floating point cannot represent most
decimal fractions — `0.1 + 0.2 !== 0.3` in JavaScript *and* in Postgres
`float8`. Rounding artifacts in money are not cosmetic; they are audit
failures.

**Why not `numeric` (the usual "right answer"):** `numeric` is exact in
Postgres — and then `pg` hands it to JavaScript, whose `number` cannot hold
`numeric`'s range, so the driver returns **a string**. Every consumer now
chooses between `parseFloat` (reintroducing float) or a decimal library
(a dependency and a discipline). Exactness that evaporates at the boundary
is not exactness.

**Why integer cents work:** every price, total and discount in this app is a
whole number of cents. JavaScript integers are exact to 2⁵³−1 — 90 *trillion*
dollars in cents — and JSON, `pg`, and arithmetic all pass integers through
untouched. The rules that make it stick:

1. **The unit is in the name.** `price_cents`, `total_cents` — never a bare
   `price` someone multiplies by 100 twice.
2. **One boundary quirk, fixed at the pool.** `bigint` (int8) arrives as a
   string by default — the driver won't silently lose precision above 2⁵³.
   Cents never approach that, so the app opts in to numbers once, centrally:

```js
// db/pool.js (Phase 2 owns the full file)
import pg from 'pg';
// int8 → number; safe because every int8 in this schema is cents or an id,
// and both stay far below Number.MAX_SAFE_INTEGER
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
```

3. **Division rounds explicitly, once.** Discounts and tax splits use
   `Math.round` at the point the business rule defines — "10% off 1999 cents"
   is `Math.round(1999 * 0.9) = 1799`, and the rule (round half up, per line
   item) is written where it happens. Fractions of a cent never travel.
4. **Display is `Intl`'s job, at the edge** — the
   [frontend formatting chapter](../../syllabus/02-frontend.md) renders
   `1799` as `$17.99` or `17,99 €`; the backend never formats money.

**When this stops being enough:** multi-currency (minor units vary — JPY has
none, KWD has three) or fractional-cent unit pricing. The upgrade path is a
`(amount_minor, currency)` pair and a minor-units table — a migration, not a
rewrite, because the integer discipline survives it.

## Time

**`timestamptz` does not store a timezone.** It stores an instant (UTC
microseconds) and *converts* on the way in and out using the session's
`TimeZone`. `timestamp` stores wall-clock digits with no meaning attached —
the same column can mean three instants to three writers. Every timestamp in
the schema is `timestamptz`; the app adds three working rules:

1. **The database compares, JavaScript doesn't.** "Is the session expired?" is
   `where expires_at < now()` — one clock, the database's, and no
   client-server skew in the comparison. The Node side passes `Date` objects
   (which `pg` binds as instants) and never does `new Date() > row.expires_at`
   arithmetic for anything that gates access.
2. **Durations are intervals in SQL, milliseconds in JS — convert at the
   boundary, name the unit.** `expires_at = now() + interval '30 days'` in the
   session insert; `ttlMs` in JavaScript config. A bare `timeout = 30` is the
   bug factory.
3. **The UI localizes, nothing else does.** The API ships ISO-8601 UTC
   (`2026-08-16T09:30:00Z` — `JSON.stringify(date)`'s native output); the
   React layer formats with `Intl.DateTimeFormat` in the viewer's zone. No
   server-rendered "August 16th" anywhere — the server doesn't know where the
   reader is.

The one genuinely hard case — "sale ends at midnight" — is a *policy*
question before a technical one: midnight **where**? This app's answer:
promotions store an instant (`ends_at timestamptz`), chosen by the admin UI
which converts "midnight store-time" to that instant once, at creation. The
alternative (store a local time + zone name, resolve per query) is what
multi-region storefronts need; the trade is named in the concept page.

## Using it in the app

The type parser lands in Phase 2's pool module; the checkout totals
([chunk 1](06-the-checkout-transaction/01-the-transaction.md)) already lean on
cents-as-numbers; session expiry (Phase 3 auth) uses rule 1 verbatim; the
abandoned-cart sweep (Phase 2) is `where updated_at < now() - interval '3
days'` — the database doing the date math, as always.

## Gotchas

- **Symptom:** totals like `"19992999"` — string concatenation. **Cause:** the
  int8 parser isn't set in some environment (a script created its own pool).
  **Fix:** the parser lives in the *one* pool module everything imports; a
  second `new pg.Pool` anywhere is the actual bug.
- **Symptom:** timestamps shift by an hour after a container rebuild.
  **Cause:** the server's `TZ` changed and someone used `timestamp` (without
  tz) in an ad-hoc table — the digits stayed, the meaning moved. **Fix:** the
  schema-wide `timestamptz` rule; the
  [container time page](../../../docker/pages/phase-10-production/15-time-and-timezones.md)
  explains why `TZ` in a container is formatting, not truth.
- **Symptom:** a promotion "ends at midnight" ended at 10 a.m. for European
  customers. **Cause:** the ending was stored as the admin's local midnight
  instant — correct by this app's policy, surprising to a different-zone
  customer. **Fix:** none in code — display the deadline localized
  (`Intl.DateTimeFormat` with the instant) so every viewer sees *their* clock
  reading of the same moment.
- **Symptom:** `select … where created_at > '2026-08-16'` returns different
  rows on laptop vs production. **Cause:** a bare date literal is interpreted
  in the *session's* timezone — laptops and servers disagree. **Fix:** bind
  parameters as `Date`/ISO instants, never string literals with implicit
  zones.

## Interview questions

1. **★ Why integer cents over `numeric` when `numeric` is the exact type?**
   Exact in the database, a *string* in JavaScript — `pg` refuses to parse it
   to a lossy float, correctly. Integer cents are exact in both worlds with
   zero ceremony, JSON-safe, and sufficient for single-currency whole-cent
   pricing. Choose the exactness that survives your whole stack.
2. **★ What does `timestamptz` actually store, and what does the "tz" do?**
   A UTC instant — 8 bytes, no zone stored. The zone acts at the *edges*:
   input strings with offsets convert to UTC, output renders in the session's
   `TimeZone`. `timestamp` skips both conversions and stores meaningless
   digits. "Timestamptz stores the timezone" is the most common false answer.
3. **Why must expiry checks compare in SQL rather than in Node?** Because
   `new Date()` on the app server and `now()` on the database can disagree
   (clock skew), and with several app instances there are several wrong
   clocks. One authority — the database that stores the timestamps — makes
   expiry consistent for everyone.
4. **A discount computes to 1799.5 cents. What happens?** Whatever the
   business rule says, explicitly — the code calls `Math.round` (or a
   documented floor) at that line, once. What must *not* happen: the .5
   travelling onward — fractional cents in storage mean the invariant "money
   is integers" is gone and every consumer re-decides the rounding.

---

← Prev: [The checkout transaction](06-the-checkout-transaction/README.md) ·
Next → [JSONB for product attributes](08-jsonb-attributes.md)
