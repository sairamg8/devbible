---
title: "`now()` does not advance inside a transaction, a double does not round-trip through JSON the way you expect, and an ETag is only stable because it was derived from a version rather than from a body — so three of the fields in a card's representation cannot be asserted the obvious way"
sidebar_label: "12d · Representation and non-assertions"
sidebar_position: 76
description: "Why updatedAt > createdAt is a flaky assertion, how to assert time without asserting a clock, ETag stability across serialisations and the strong-comparison test, floating-point position assertions, and the four things a functional suite must never assert."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 documentation — [§9.9.5 Current Date/Time](https://www.postgresql.org/docs/18/functions-datetime.html), [§8.1.3 Floating-Point Types](https://www.postgresql.org/docs/18/datatype-numeric.html), [§7.5 Sorting Rows](https://www.postgresql.org/docs/18/queries-order.html) — and [RFC 9110 §8.8.3 ETag](https://www.rfc-editor.org/rfc/rfc9110.txt) and §15.5.13, fetched as raw text from rfc-editor.org. Documentation-verified; **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · **Next.js 16.3.4** · `drizzle-orm` **0.45.2** · Vitest **5.0.0** · Node **24.20.0**.

**Three fields in a card's representation are produced by a mechanism the test author usually has a slightly wrong model of, and each produces a class of assertion that is either flaky or vacuous. `createdAt` and `updatedAt` come from `now()`, which is the *transaction* timestamp and does not advance between statements — so the obvious `expect(updatedAt).toBeGreaterThan(createdAt)` is false whenever the create and the update happen in one transaction, which is exactly what a transaction-per-test harness arranges. `position` is a `double precision` computed by bisection, so the value that comes back is not the value you would compute in JavaScript and asserting equality on it is a coin flip. And `ETag` is stable only because [07e](07e-etag-if-match-and-412.md) derived it from `version` rather than from a serialised body; a test that does not know that will happily accept an implementation that hashes JSON and breaks conditional writes forever. This page writes the assertions that are actually true, and then closes with the four things a functional suite must not assert at all.**

## `now()` is the transaction timestamp, and this is a documented feature

> *"Since these functions return the start time of the current transaction, their values do not change during the transaction. This is considered a feature: the intent is to allow a single transaction to have a consistent notion of the 'current' time, so that multiple modifications within the same transaction bear the same time stamp."*
> — [PostgreSQL 18 · §9.9.5](https://www.postgresql.org/docs/18/functions-datetime.html)

Three consequences land directly on this suite.

**1 · Five cards created in one transaction share a `created_at`.** That is why [06d](06d-keyset-pagination.md)'s cursor is `(created_at, id)` and not `created_at` alone — and it is also the only convenient way to *produce* the tie the tiebreaker exists for. Seed a keyset test inside one transaction and you get five equal timestamps for free.

**2 · `updatedAt > createdAt` is not guaranteed.** If the card is created and then patched within one transaction — which a transaction-per-test harness ([12f](12f-the-seed-and-reset-story.md)) makes the default — both calls see the same `now()`.

```ts
// ❌ flaky: true when create and patch are separate transactions, false when they are not
expect(new Date(after.updatedAt) > new Date(after.createdAt)).toBe(true)

// ✅ the assertion that is always true and is the actual contract
expect(new Date(after.updatedAt) >= new Date(after.createdAt)).toBe(true)
expect(after.version).toBe(before.version + 1)
```

🔴 **`version` is the deterministic freshness signal in this schema, not `updatedAt`.** [07g](07g-position-collisions-and-updatedat.md) already made that argument for the API's behaviour; it is equally the right choice for a test. Assert `version`, and treat `updatedAt` as a display value.

**3 · If you genuinely need a per-statement timestamp**, PostgreSQL names it:

> *"`statement_timestamp()` returns the start time of the current statement (more specifically, the time of receipt of the latest command message from the client). `statement_timestamp()` and `transaction_timestamp()` return the same value during the first statement of a transaction, but might differ during subsequent statements."*

Changing the column default to `statement_timestamp()` to make a test pass would be a schema change made for a test's convenience, and it changes the meaning of `created_at` for every row. Fix the assertion instead.

## Asserting time without asserting a clock

The general form: **assert an ordering or a window, never an instant.**

```ts
// ✅ a window that cannot be flaky unless the clock is genuinely wrong
const before = Date.now()
const card = await createCard(board.id, { title: 'Write the seed script' })
const after = Date.now()
const created = new Date(card.createdAt).getTime()
expect(created).toBeGreaterThanOrEqual(before - 1000)   // clock skew between app and db
expect(created).toBeLessThanOrEqual(after + 1000)
```

The two one-second slacks are not superstition: the timestamp is generated by **the database server's** clock and compared against **the test process's** clock, and those are two machines whenever the database is a container, a CI service or Neon.

⚠️ **Do not reach for fake timers here.** Vitest's `vi.useFakeTimers()` replaces the *Node process's* clock. `now()` runs in PostgreSQL and is completely unaffected, so a fake-timer test against a database column produces a comparison between a frozen 1970 and a real instant, and the failure message is baffling. Fake timers are correct for code that calls `new Date()` in JavaScript — an idempotency-key expiry computed in the application ([05da](05da-scoping-expiry-and-the-records-table.md)) — and wrong for anything the database stamped.

## ETag stability, and the test that protects it

`cardETag` is `"c-${id}-${version}"`. Two properties follow, and both are worth a test because both are silently lost by a plausible "improvement".

**Stable across serialisations.** Two `GET`s of an unchanged card produce byte-identical tags, because nothing in the tag depends on how the row was rendered. An implementation that hashes `JSON.stringify(card)` instead is stable only as long as key order, float formatting and timezone rendering never change — and `position` alone breaks that, since `0.1 + 0.2` and a value read back from a `double precision` column can serialise differently.

**Strong, therefore usable for `If-Match`.** RFC 9110 requires strong comparison for `If-Match`, so a weak tag can never satisfy the precondition and every conditional write would return:

> *"The 412 (Precondition Failed) status code indicates that one or more conditions given in the request header fields evaluated to false when tested on the server (Section 13)."*
> — [RFC 9110 §15.5.13](https://www.rfc-editor.org/rfc/rfc9110.txt)

Both properties in three tests:

```ts
// ✅ test/boundary/etag.test.ts
it('is byte-identical across two reads of an unchanged card', async () => {
  const a = await GET(req, ctx)
  const b = await GET(req, ctx)
  expect(a.headers.get('etag')).toBe(b.headers.get('etag'))
  expect(a.headers.get('etag')).toMatch(/^"c-[0-9a-f-]{36}-\d+"$/)   // strong: no W/ prefix
})

it('changes when the version changes', async () => {
  const before = (await GET(req, ctx)).headers.get('etag')!
  await patchCard(cardId, { title: 'Renamed' }, versionOf(before))
  const after = (await GET(req, ctx)).headers.get('etag')!
  expect(after).not.toBe(before)
})

it('rejects a conditional write carrying a superseded tag with 412', async () => {
  const stale = (await GET(req, ctx)).headers.get('etag')!
  await patchCard(cardId, { title: 'First writer wins' }, versionOf(stale))
  const res = await PATCH(new Request(url, {
    method: 'PATCH',
    headers: { 'if-match': stale, 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Second writer' }),
  }), ctx)
  await expectFailure(res, 412, 'precondition_failed')
})
```

🔴 **The regex asserting no `W/` prefix is the load-bearing line.** It is the only assertion in the suite that fails if someone switches to a weak validator, and the symptom of that change in production is *every* conditional update returning 412 forever — a total outage of the write path that no other test would catch, because a suite that never sends `If-Match` cannot notice.

## Floating-point `position`

`position` is a `double precision`, computed by bisection, and there are two things not to do.

```ts
// ❌ asserts a bit pattern you did not compute the way the database did
expect(card.position).toBe(1.5)
expect(card.position).toBe((1.0 + 2.0) / 2)

// ✅ assert the ordering property, which is what position means
const positions = page.items.map((c) => c.position)
expect(positions).toEqual([...positions].sort((a, b) => a - b))
expect(positions.every(Number.isFinite)).toBe(true)
```

`position` is not a value the client is promised; it is an ordering key ([01c](01c-what-the-client-may-rely-on.md)). The assertion should therefore be about order and finiteness, not about arithmetic. And PostgreSQL's `NaN` ordering makes the finiteness check meaningful rather than paranoid: a `NaN` sorts to the end and is treated as equal to every other `NaN`, so a corrupt position degrades the board's order without raising anything.

The one place an exact position assertion is right is the *bisection* unit test, where the input and the expectation are both in JavaScript and the database is not involved:

```ts
// ✅ pure function, no database, exact assertion is fine
expect(midpoint(1.0, 2.0)).toBe(1.5)
expect(midpoint(1.0, Number.MIN_VALUE)).toBeGreaterThan(0)   // the exhaustion boundary
```

## `timestamptz` on the wire

`pg` returns a JavaScript `Date` for a `timestamptz` column, and `Response.json()` serialises a `Date` via `toJSON()`, which is ISO 8601 in UTC with a `Z` suffix. That is a chain of three conversions and none of them is your code, so assert the property rather than the format:

```ts
// ✅ parseable, and an instant — not a string comparison
expect(Number.isNaN(Date.parse(card.createdAt))).toBe(false)
```

Asserting `expect(card.createdAt).toMatch(/Z$/)` is asserting `Date.prototype.toJSON`. If the offset representation genuinely matters to a client, that is a contract decision and belongs in the `CardRepresentation` schema from [12c](12c-asserting-on-the-envelope-not-the-prose.md) — `z.iso.datetime({ offset: true })` — where it is stated once rather than repeated per test.

## The four things a functional suite must not assert

### 1 · That a query used a particular index

```ts
// ❌ the planner is allowed to disagree, and on a 12-row fixture it will
expect(plan).toContain('Index Scan using cards_board_created_idx')
```

Index choice is a function of statistics, and every fixture table is small enough that a sequential scan is genuinely cheaper. The planner choosing correctly for a tiny table is not a bug. If index usage matters — and for `(board_id, created_at, id)` at scale it does — it is measured against production-sized data in a separate, non-blocking job, and even then you are testing PostgreSQL's planner rather than your code.

### 2 · That a response arrived within N milliseconds

A latency assertion in a functional suite is a random number generator wired to the build status. CI runners are shared, the database may be cold, and the number that makes the test stable is so large it asserts nothing. Latency belongs to the observability chapter ([ch17](../17-deployment-scaling-and-observability/01-explanation.md)) where it is a percentile over many samples rather than a single sample compared to a constant.

### 3 · That a connection pool reached a particular size

The pool's size is a consequence of scheduling. Asserting it is asserting timing with extra steps. What *is* assertable is the functional consequence you configured — that acquisition failure produces a `503` rather than hanging — and that can be forced deterministically by setting the pool to one connection and holding it.

### 4 · Anything about a `console` transcript

There is no assertion to be made about the shape of a log line at this layer. If a log field is genuinely part of a contract — `correlationId` reaching your log aggregator — assert it against a **structured** logger you injected, by capturing the object passed to it, never by parsing stdout.

## The nuance: asserting query *count* is legitimate, unlike the four above

Query count looks like the same category and is not, and it matters because [06f](06f-the-n-plus-1-on-a-card-list.md) exists.

An N+1 is a correctness-adjacent regression with no visible symptom — the response is identical, and only the query count changed. It cannot be caught by any assertion on the body, it is not a timing (a count is exact and deterministic), and it is not a planner decision (the number of statements your code issues is your code's behaviour). So:

```ts
// ✅ a deterministic regression guard, in its own clearly-named file
it('lists twenty cards with labels in a bounded number of statements', async () => {
  const statements = await countStatements(() => listCardsWithLabels(board.id, {}))
  expect(statements).toBeLessThanOrEqual(2)   // the list, and one batched label fetch
})
```

Two rules keep this honest. **Assert an upper bound, not an exact number** — an exact count makes an added `SET` or a health check into a failure. And **count statements through a driver hook, not by timing** — `pg`'s `Pool` emits a `query` event you can subscribe to for the duration of the call, so the count is exact rather than inferred.

⚠️ **This test does not belong in the DAL suite.** It is asserting an implementation property, so it belongs in a separately-named file that a reader will not mistake for a behaviour test — and it must be excluded from any harness that adds its own statements, which a transaction-per-test wrapper does.

## Gotchas

**★ Symptom: `expect(updatedAt).toBeGreaterThan(createdAt)` passes locally and fails under the transaction-wrapped harness.** Cause: `now()` is the transaction timestamp and both writes happened in one transaction, so the two values are equal. Fix: assert `>=`, and assert `version` incremented — that is the field the API actually promises changes on every write.

**★ Symptom: fake timers made a timestamp assertion fail with a 1970 date.** Cause: `vi.useFakeTimers()` replaces Node's clock; the column was stamped by PostgreSQL's. Fix: never fake time for a database-generated value. Use a window assertion with slack for clock skew, or move the timestamp generation into application code if the test genuinely needs to control it — but understand that is a schema decision, not a test decision.

**★ Symptom: every `PATCH` with `If-Match` started returning 412 after a refactor and no test caught it.** Cause: the ETag became weak — typically because someone replaced the version-derived tag with a hash of the serialised body and prefixed it `W/`, or because a proxy rewrote it. RFC 9110 mandates strong comparison for `If-Match`, so a weak tag can never satisfy it. Fix: assert the tag's shape with a regex that rejects a `W/` prefix; it is the only test that fails on this change.

**★ Symptom: a position assertion fails by one bit.** Cause: `expect(position).toBe(1.5)` on a value that made a round trip through `double precision` and JSON. Fix: assert the ordering of the returned list and `Number.isFinite` on each element; keep exact assertions for the pure bisection function where no database is involved.

**★ Symptom: an index assertion fails in CI and passes locally.** Cause: different row counts produced different statistics and the planner chose a sequential scan. Fix: delete the assertion. It was never testing your code.

**★ Symptom: a keyset-pagination test never exercises the `id` tiebreaker.** Cause: each fixture card was inserted in its own transaction, so every `created_at` is distinct and the tie never occurs. Fix: seed the fixture inside a single transaction — `now()` is constant within it, so all the rows share a timestamp and the tiebreaker is the only thing ordering them. This is the rare case where the harness's transaction is doing you a favour.

**★ Symptom: the query-count test flakes after adding connection-level setup.** Cause: an exact `toBe(1)` assertion, and the harness now issues a `SET` or a `SELECT 1` health check on the same connection. Fix: assert an upper bound, and subscribe to the driver's query event only for the duration of the call under test rather than for the whole connection's life.

**★ Symptom: `expect(card.createdAt).toBe(someIsoString)` fails on a machine in another timezone.** Cause: the expectation was generated by formatting a `Date` locally somewhere in the fixture. Fix: compare instants — `Date.parse(a) === Date.parse(b)` — never formatted strings. `timestamptz` stores an instant and does not store a zone; any string you compare against has had a zone applied by something.

## Interview questions

**★ Why is `expect(updatedAt).toBeGreaterThan(createdAt)` an unsafe assertion in this API?**
Because `now()` returns the transaction start time and PostgreSQL documents that as a deliberate feature — every modification inside one transaction bears the same timestamp. If the card is created and then updated within a single transaction, which is exactly what a transaction-per-test harness produces, the two values are equal and the strict comparison fails. The contract the API actually makes about a write is that `version` increments, so that is the assertion with no timing in it at all.

**★ What single assertion protects the entire conditional-write path, and what does it protect against?**
A regex on the `ETag` header that rejects a `W/` prefix and requires the `"c-<uuid>-<n>"` form. `If-Match` requires strong comparison, so the moment the server emits a weak validator no conditional write can ever succeed and every `PATCH` carrying `If-Match` returns 412. That is a complete outage of the safe write path, and no assertion on a response body or a status code in a suite that does not send `If-Match` would notice it. The tag being derived from `version` rather than from a hash of the body is what makes it strong and stable, so the regex is really asserting that derivation.

**★ Asserting a query count looks like asserting an implementation detail. Why is it acceptable when asserting an index is not?**
Because the two are different kinds of fact. The number of statements your code issues is a property of your code, deterministic and exact, and an N+1 regression has no other observable symptom — same body, same status, same everything. Which index the planner chooses is a property of PostgreSQL's cost model over current statistics, is allowed to differ between a twelve-row fixture and a ten-million-row table, and choosing a sequential scan on a small table is correct behaviour rather than a regression. The first is a claim about you; the second is a claim about the planner.

**★ How would you assert that a `position` computed by bisection is correct?**
Split it. The arithmetic is a pure function, so test `midpoint` directly with exact expectations, including the boundary where repeated bisection exhausts double precision. The database round trip is then tested as an ordering property: insert cards at computed positions, read the list back, and assert the returned sequence is sorted and every value is finite. Never assert an exact float on a value that made a round trip, because you did not compute it the way the database did and the comparison is a coin flip about representation.

**★ A test asserts a response arrives in under 200 ms to guard against an N+1. What is wrong with it and what replaces it?**
It is measuring a shared CI runner, a possibly-cold database and a JIT, so the threshold that makes it stable is far above any real regression and the threshold that catches a regression makes it flake. It also cannot distinguish an N+1 from a slow disk. The replacement is a deterministic statement count with an upper bound, captured through the driver's query event for the duration of the call — exact, reproducible, and it fails for exactly the reason you care about.

---

← [12c · Asserting on the envelope](12c-asserting-on-the-envelope-not-the-prose.md) · [Chapter index](01-explanation.md) · Next → [12e · The ownership negative test](12e-the-ownership-negative-test.md)
