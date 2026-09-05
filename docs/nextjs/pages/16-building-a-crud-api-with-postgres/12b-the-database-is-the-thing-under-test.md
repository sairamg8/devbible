---
title: "Every argument this chapter made lives inside PostgreSQL, so a suite that swaps the database for a fake or for SQLite is not a faster version of the same suite — it is a suite that has deleted its own subject and kept the assertions"
sidebar_label: "12b · The database under test"
sidebar_position: 74
description: "The ten things a fake or in-memory database silently stops checking, why SQLite is not a fast PostgreSQL, the three places where a mock is exactly right, and the seam rule that decides which is which."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 documentation — [§8.1.3 Floating-Point Types](https://www.postgresql.org/docs/18/datatype-numeric.html), [§7.5 Sorting Rows](https://www.postgresql.org/docs/18/queries-order.html), [`TRUNCATE`](https://www.postgresql.org/docs/18/sql-truncate.html) and [Appendix A · Error Codes](https://www.postgresql.org/docs/18/errcodes-appendix.html) — and [Drizzle · Transactions](https://orm.drizzle.team/docs/transactions). Documentation-verified; **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · **Next.js 16.3.4** · Vitest **5.0.0** · Node **24.20.0**.

**The instinct to replace the database in tests is sound in most codebases and wrong in this one, and the difference is not a matter of degree. In an application whose data layer is `SELECT * FROM widgets WHERE id = $1`, a fake repository loses almost nothing, because almost nothing was delegated to the database. This chapter delegated on purpose: title validation is a `CHECK` constraint, referential integrity is a foreign key, the lost update is prevented by a `WHERE version = $2`, uniqueness is an index, and the ownership predicate is a join. Every one of those is a claim about PostgreSQL's behaviour, and a fake that returns whatever you told it to return will agree with every one of them unconditionally. The suite goes green, it goes fast, and it has stopped testing the application. This page enumerates exactly what is lost, then draws the line: there are three places in this API where a mock is not a compromise but the correct instrument.**

## The ten things a fake database stops checking

Go through them individually, because "use a real database" is advice everyone has heard and nobody costs out.

### 1 · Constraints, which are this API's first validation layer

[02b](02b-constraints-are-the-first-validation-layer.md) put the 1–200 character rule in a `CHECK` constraint rather than only in Zod, on purpose: a constraint holds for every writer, including the migration script and the person in `psql`. A fake has no constraints. A test that inserts a 5,000-character title through a fake and expects a rejection has to *simulate* the rejection, which means the test is asserting that you wrote the simulation correctly.

```ts
// ❌ this asserts that the fake was configured, not that the database rejects it
fakeDb.insert.mockRejectedValue({ code: '23514', constraint: 'cards_title_length' })
await expect(createCard(boardId, { title: 'x'.repeat(5000) })).rejects.toMatchObject({ code: 'title_too_long' })
```

Delete the constraint from the migration and this test still passes. That is the definition of a test that does not test its subject.

### 2 · The SQLSTATE code, and the constraint name on it

[05ca](05ca-mapping-sqlstate-to-status-codes.md) keys the entire error mapping on `pg.constraint` first and `pg.code` second. Both fields are produced by the server, in the `ErrorResponse` message, and neither exists in a fake unless you invent it. Inventing it is where the drift starts: rename `cards_board_title_unique` in a migration and the real database starts sending a name your `CONSTRAINT_RULES` map has never heard of, degrading a `409 duplicate_title` into a generic `409 conflict` — and every mocked test still passes, because the mock still emits the old name.

**This is the highest-value real-database test in the create path**, and it is three lines:

```ts
// ✅ test/dal/cards.constraints.test.ts — against real PostgreSQL 18
it('maps a duplicate title to duplicate_title, by constraint name', async () => {
  await createCard(board.id, { title: 'Ship the migration' })
  await expect(createCard(board.id, { title: 'Ship the migration' }))
    .rejects.toMatchObject({ code: 'duplicate_title', status: 409, field: 'title' })
})
```

It fails the day someone renames the constraint without updating the map, which is the only day it needs to fail.

### 3 · Ordering — and `position` is a `double precision`

The sparse ordering key ([05ea](05ea-the-position-value-and-concurrent-creates.md)) is a float, and floats have two behaviours in PostgreSQL that no JavaScript array sort reproduces.

> *"IEEE 754 specifies that `NaN` should not compare equal to any other floating-point value (including `NaN`). In order to allow floating-point values to be sorted and used in tree-based indexes, PostgreSQL treats `NaN` values as equal, and greater than all non-`NaN` values."*
> — [PostgreSQL 18 · §8.1.3 Floating-Point Types](https://www.postgresql.org/docs/18/datatype-numeric.html)

A `NaN` position sorts to the **end** in PostgreSQL. In JavaScript, `[3, NaN, 1].sort((a, b) => a - b)` produces an order that depends on the comparator returning `NaN`, which is not a valid comparator at all. A fake that sorts in JS and a database that sorts in SQL will disagree about a board containing one corrupt row, and the fake will disagree *silently*.

Null ordering is the second one, and it bites `body` and `deletedAt`:

> *"By default, null values sort as if larger than any non-null value; that is, `NULLS FIRST` is the default for `DESC` order, and `NULLS LAST` otherwise."*
> — [PostgreSQL 18 · §7.5 Sorting Rows](https://www.postgresql.org/docs/18/queries-order.html)

And the reason [06d](06d-keyset-pagination.md) insists the cursor's ordering is a *total* order:

> *"If sorting is not chosen, the rows will be returned in an unspecified order. The actual order in that case will depend on the scan and join plan types and the order on disk, but it must not be relied on."*

A fake returns insertion order, always. That means **every pagination test against a fake passes, including the ones with a non-deterministic tiebreaker**, and the bug appears in production the first time the planner picks a different scan.

### 4 · Cascades

`onDelete: 'cascade'` on `cards.board_id` is a data-loss primitive that fires from a statement which never mentions `cards` ([08c](08c-cascades-and-referential-integrity.md)). There is nothing in application code to test. Either the foreign key is declared with the right action or it is not, and only the database knows.

```ts
// ✅ the only place this claim can be checked
it('deleting a board deletes its cards', async () => {
  await db.delete(boards).where(eq(boards.id, board.id))
  const left = await db.select().from(cards).where(eq(cards.boardId, board.id))
  expect(left).toHaveLength(0)
})
```

### 5 · Isolation, locking and the whole of topic 09

`SELECT ... FOR UPDATE` blocking, `40001`, `40P01`, `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`, predicate locks. A fake has one thread and no concept of a snapshot. This is not "a fake is less accurate here"; it is that the subject does not exist in a fake. [12i](12i-forcing-the-interleaving.md) and [12j](12j-testing-the-retry-loop-and-the-idempotency-key.md) are entirely un-fakeable.

### 6 · `timestamptz` and server-side time

`createdAt` and `updatedAt` default to `now()`, which inside a transaction is the *transaction* start time, not the statement time — so two rows inserted in one transaction share a timestamp. A keyset cursor of `(created_at, id)` depends on the `id` tiebreaker precisely because of this. A fake that stamps `new Date()` per insert gives every row a distinct timestamp and hides the case the tiebreaker exists for. [12d](12d-representation-assertions-and-what-not-to-assert.md) has the full time argument.

### 7 · Enum rejection

`status` is a `pgEnum` ([02](02-the-schema-and-the-migration-story.md)). An invalid value is rejected by the server as `22P02 invalid_text_representation`, not by your code — and that is deliberate, because it holds for a writer that bypassed Zod. A fake accepts `'in_progress'` happily.

### 8 · Three-valued logic on `deletedAt`

Soft delete ([08b](08b-what-soft-delete-costs-every-read.md)) means every read carries `IS NULL`. `deleted_at != NULL` is not a syntax error in SQL — it evaluates to `NULL`, which filters out every row. A fake written in JavaScript uses `!== null` and behaves the way you expected, so the test agrees with your mental model rather than with the database's.

### 9 · Whatever the pooler does to your session

[03d](03d-what-does-not-survive-the-pooler.md) is a list of things that do not survive a transaction-mode pooler: session-level `SET`, prepared statements, `LISTEN/NOTIFY`, advisory locks held across statements. A fake has no pooler, so a test suite on a fake will never discover that your `SET search_path` or session-level `statement_timeout` evaporated between two calls.

### 10 · `RETURNING` and the affected-row count

`patchCard` decides between success and `412` by whether `UPDATE ... WHERE id = $1 AND version = $2 RETURNING *` returned a row ([07d](07d-optimistic-concurrency-with-a-version-column.md)). "Zero rows affected" is genuinely ambiguous — the card is missing, or the version moved, or the caller is not a member — and resolving that ambiguity is [11](11-ownership-on-the-api-surface.md)'s subject. A fake returns exactly the rows you programmed it to return, which means the ambiguity never arises and the disambiguation logic is never exercised.

## SQLite is not a fast PostgreSQL

The middle path — "use a real SQL engine, just an in-process one" — fails on the same list, and it fails more insidiously because the tests now *look* like database tests.

| | PostgreSQL 18 | SQLite |
|---|---|---|
| SQLSTATE on a unique violation | `23505`, with the constraint name | a driver-specific code and a message string |
| Enum type | `pgEnum`, rejected as `22P02` | no enum type |
| `timestamptz` | a UTC instant, converted on I/O | text or a number, by convention |
| `NaN` in a float column | equal to `NaN`, greater than everything | not a comparable ordering guarantee you can rely on |
| `SERIALIZABLE` behaviour | SSI, `40001`, retry required | a different concurrency model entirely |
| `RETURNING` on `UPDATE` | yes | yes, but the row-count semantics differ per driver |
| `ON DELETE CASCADE` | enforced by default | enforced **only** if `PRAGMA foreign_keys = ON` |

That last row is the one that has cost real teams real data: SQLite ships with foreign-key enforcement off unless the connection turns it on, so a cascade test against SQLite can pass by doing nothing at all.

**The honest summary:** SQLite is an excellent database and a poor stand-in for a specific other database whose specific behaviours are your API's contract. If you want speed, the answer is a real PostgreSQL that resets quickly ([12g](12g-truncate-templates-and-schema-per-worker.md)), not a different engine.

## The three places a mock is exactly right

Now the other direction, because "always use a real database" is equally wrong and produces a suite nobody runs.

### Right 1 · Rendering a domain outcome as a response

`toHttpResponse` and `toActionResult` are pure functions of a `DomainError`. They have no database in them, and constructing a `DomainError` by hand is not mocking — it is supplying an input.

```ts
// ✅ test/boundary/envelope.test.ts — no database, and none is missing
import { DomainError } from '@/lib/db/constraint-map'
import { toHttpResponse, toActionResult } from '@/lib/errors-http'

it.each([
  ['not_found', 404],
  ['duplicate_title', 409],
  ['precondition_failed', 412],
  ['title_blank', 422],
])('renders %s as %i', async (code, status) => {
  const res = toHttpResponse(new DomainError(status, code, 'irrelevant prose'))
  expect(res.status).toBe(status)
  expect((await res.json()).error.code).toBe(code)
})
```

### Right 2 · Route-handler behaviour that is not about rows

Header parsing, `Location` construction, `304` on a matching `If-None-Match`, the shape of a `400` on an unparseable body. Here the DAL is mocked *at the function seam* — `vi.mock('@/lib/dal/cards')` — because the row content is irrelevant to the assertion and supplying it from a real database only adds a way for the test to fail for an unrelated reason.

```ts
// ✅ the DAL is mocked because the assertion is about a header
vi.mock('@/lib/dal/cards', () => ({ getCard: vi.fn() }))

it('returns 304 when If-None-Match matches the current ETag', async () => {
  vi.mocked(getCard).mockResolvedValue({ id: CARD_ID, version: 7, title: 'x' } as CardDTO)
  const res = await GET(new Request(`http://x/api/cards/${CARD_ID}`, {
    headers: { 'if-none-match': `"c-${CARD_ID}-7"` },
  }), { params: Promise.resolve({ cardId: CARD_ID }) })
  expect(res.status).toBe(304)
})
```

### Right 3 · Anything that is not your database

The idempotency store if it is Redis, the outbound webhook, the object store. [ch13 · 3e](../13-testing-and-developer-experience/03e-env-schemas-and-contract-tests.md) argues the two-test split for third-party contracts and this chapter has nothing to add to it.

## The seam rule

One sentence decides every case above.

🔴 **Mock at a boundary that has a contract you wrote down. Never mock inside one.**

`listBoardCards(boardId, opts)` has a contract: [04e](04e-function-per-use-case.md) declared its signature and its return type, and [01c](01c-what-the-client-may-rely-on.md) declared what the representation means. Mocking it substitutes one honest implementation of a stated contract for another.

`db.select().from(cards).where(...)` has no contract. It is Drizzle's fluent builder, mid-expression. Mocking it substitutes a guess about the query builder's internal call sequence for the query builder — and asserts on the guess.

The same rule explains why `translatePgError` must never be mocked: it *is* the thing under test in the constraint suite. Mocking it turns "does a real `23505` reach my mapping" into "does my mapping run when I call it", which was never in doubt.

## Gotchas

**★ Symptom: the constraint tests pass in CI and a duplicate title returns a generic 409 in production.** Cause: the tests mocked the driver error, so the fabricated `constraint` field never had to match the real one; a migration renamed the index. Fix: at least one real-database test per named constraint, asserting the mapped `code` rather than the SQLSTATE — that is what couples the migration's constraint name to `CONSTRAINT_RULES`.

**★ Symptom: pagination tests are green but production shows a card twice across pages.** Cause: the fake returned insertion order, so a cursor built on `(created_at, id)` was never exercised against a plan that returned rows in a different physical order. The manual is explicit that unsorted order "must not be relied on". Fix: run the keyset test against real PostgreSQL, with several rows sharing a `created_at` — which is exactly what an insert of five cards inside one transaction produces, since `now()` is the transaction timestamp.

**★ Symptom: a cascade test passes and the production board delete leaves orphan cards.** Cause: SQLite, with `PRAGMA foreign_keys` at its default. The cascade "worked" because nothing checked anything. Fix: assert cascades only against PostgreSQL, and phrase the test as a count of remaining rows rather than as an absence of an error.

**★ Symptom: `expect(rows).toEqual([...])` fails only on CI.** Cause: no `ORDER BY`, or an `ORDER BY` that is not a total order, plus a different plan on a differently-sized CI dataset. Fix: never assert on an unordered result set. Either add the total order the query is supposed to have — in which case you are testing the real contract — or assert with a set comparison such as `expect(new Set(rows.map(r => r.id))).toEqual(new Set(expected))`.

**★ Symptom: a soft-delete filter test passes against the fake and returns deleted cards in production.** Cause: the DAL wrote `ne(cards.deletedAt, null)` or a JS `!== null`, and only PostgreSQL's three-valued logic makes that wrong. Fix: `isNull(cards.deletedAt)` in Drizzle, and a real-database test that soft-deletes one row and asserts the list excludes it — with a second assertion that the row still exists when queried without the filter, so a test that passes by deleting the row for real is caught.

**★ Symptom: "we mock the database because CI has no Postgres."** Cause: an infrastructure gap being paid for with correctness. Fix: this is the one gotcha whose fix is not code. A PostgreSQL 18 service container in CI is a handful of YAML lines, and Neon offers a branch per run ([12g](12g-truncate-templates-and-schema-per-worker.md)). If neither is available, be explicit in the suite's README that the DAL layer is untested rather than letting a green tick imply otherwise — [ch13 · 5](../13-testing-and-developer-experience/05-project-milestone-sprintdesk-test-suite.md) makes writing down what a layer cannot see the milestone's actual deliverable.

**★ Symptom: `vi.mock('@/db')` in one file leaks into another and a real-database test starts returning `undefined`.** Cause: module mocks are per-module-graph, and Vitest's isolation is per *file*; a shared setup file that calls `vi.mock` applies everywhere it is loaded. Fix: never put a `db` mock in a global setup file. Mocked and real-database tests belong in different directories with different Vitest projects, which is also what lets them have different reset strategies.

## Interview questions

**★ Why is an in-memory fake acceptable in most applications and not in this one?**
Because the amount a fake costs you is exactly the amount you delegated to the database. An application that treats SQL as a key-value store loses very little. This API deliberately pushed validation into `CHECK` constraints, integrity into foreign keys, uniqueness into an index, conflict detection into `WHERE version = $2`, and authorization into a join — so a fake removes the implementation of roughly half the behaviour the API promises, while leaving every assertion about that behaviour standing and green.

**★ What specifically breaks if you test this API against SQLite instead?**
Constraint identity, first: SQLite does not give you `23505` and a PostgreSQL constraint name, so the entire SQLSTATE-to-status mapping is untestable and the tests silently become tests of a hand-written translation. Then enums, which do not exist; `timestamptz`, which does not exist as a type; `SERIALIZABLE`, which is a different concurrency model with no `40001`; and foreign keys, which are not enforced at all unless the connection sets `PRAGMA foreign_keys = ON`, so a cascade test can pass without a cascade existing.

**★ When is mocking the Data Access Layer the right call rather than a compromise?**
When the assertion is about the boundary rather than about the rows: a status code, a `Location` header, a `304`, the error envelope's `code`, the shape of a validation failure. Those are properties of the translation from a domain outcome to a response, and supplying the domain outcome directly is the cleanest possible input. Reaching a real database for them adds latency and a second reason for the test to fail without adding a single thing to what it proves.

**★ Why is mocking `db.select()` different in kind from mocking `listBoardCards()`?**
`listBoardCards` is a declared seam with a signature and a documented return contract; substituting an implementation of a stated contract is a legitimate test double. `db.select()` is a point inside an expression in a fluent builder — there is no contract at that point, so the double can only encode a guess about the builder's internal call sequence. The consequence is asymmetric: the DAL mock fails when behaviour changes, and the builder mock fails when *syntax* changes and passes when behaviour changes, which is the exact opposite of what a test should do.

**★ Your team wants faster feedback and proposes mocking the database in the DAL suite. What do you propose instead?**
Keep the real database and make the reset cheap. A transaction-per-test rollback is typically the fastest reset available and it covers most of the DAL suite; the concurrency subset needs a different strategy and is a small number of tests. Beyond that, run the layers as separate projects so the boundary suite — which is pure functions and mocked seams and needs no database — gives feedback in the watch loop, while the DAL suite runs on save of a DAL file and in CI. The gain people actually want is a fast inner loop, and layering delivers it without deleting the subject.

---

← [12 · Testing the API](12-testing-the-api.md) · [Chapter index](01-explanation.md) · Next → [12c · Asserting on the envelope, not the prose](12c-asserting-on-the-envelope-not-the-prose.md)
