---
title: "A database-backed HTTP surface only ever asks three questions — does the SQL do what I think, does the boundary render the outcome as the right status, and does the whole thing hold when two clients arrive at once — and almost every wasted test in this chapter is an assertion filed under the wrong one"
sidebar_label: "12 · Testing the API"
sidebar_position: 56
description: "The three layers a CRUD-over-Postgres API actually has, which of this chapter's claims are testable at which layer, the two assertions that are pure waste (a status code in a DAL test, a SQL spy in a route test), and the boundary with chapter 13's runners."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the [PostgreSQL 18 documentation](https://www.postgresql.org/docs/18/index.html), the Next.js [Testing guide](https://nextjs.org/docs/app/guides/testing) and [Route Handlers reference](https://nextjs.org/docs/app/api-reference/file-conventions/route), and [Vitest · Parallelism](https://vitest.dev/guide/parallelism). Documentation-verified; **no sandbox run, no timings, no coverage figures**.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · `drizzle-kit` **0.31.10** · Vitest **5.0.0** · React 19.2.8 · Node **24.20.0**.

**Chapter 13 owns the runners: which of Jest, Vitest, React Testing Library and Playwright renders what, how each is configured, and how they run in CI. This topic owns the question that chapter structurally cannot answer, because it is a question about *this* API rather than about any suite — given eleven topics of decisions that live half in PostgreSQL and half in an HTTP response, what is worth asserting, and where does each assertion belong? The answer is that a database-backed CRUD surface asks exactly three questions, they have exactly three homes, and the most common failure in a suite like this is not a missing test. It is a test that asks the right question in the wrong layer: a status code asserted against a function that has never heard of HTTP, or a SQL spy asserted against a route handler whose entire job is to not care what the SQL was.**

## The three questions, and the one home each has

Every assertion you could write about `/api/cards/[cardId]` reduces to one of these.

| | Question | Runs against | Knows about | Owns |
|---|---|---|---|---|
| **1 · DAL test** | Does the SQL return the rows I think it returns? | a real PostgreSQL 18 database, no HTTP | `cards`, `boards`, `team_members`, SQLSTATE | the ownership predicate, the projection, ordering, cascades, constraints, the version bump |
| **2 · Boundary test** | Does the route render this domain outcome as the right status, headers and envelope? | the exported `GET`/`POST`/`PATCH` function, in-process | `Request`, `Response`, `DomainError`, `toHttpResponse` | status codes, `Location`, `ETag`, `If-Match` parsing, the error envelope's `code` |
| **3 · Flow test** | Does it hold with a browser, a session and two overlapping clients? | `next start`, a real database, Playwright | everything | auth, revalidation, optimistic UI reconciliation, the concurrency claims |

🔴 **The rule that makes the table useful: an assertion belongs to the lowest-numbered layer that can make it.** A 404 can only be asserted at layer 2, because layer 1 has no status codes. Cascade-on-board-delete can only be asserted at layer 1, because layer 3 would need a UI affordance for deleting a board that may not exist yet. The layer that *can* make an assertion is almost always the layer that will still make it correctly in a year.

## Which of this chapter's claims are testable, and where

This chapter made a lot of claims. Not all of them are assertions; some are architecture, and one is deliberately untestable.

| Chapter claim | Layer | The assertion |
|---|---|---|
| [04c](04c-the-ownership-predicate.md) — a non-member's query returns zero rows | 1 | `readCard(cardId)` as a non-member resolves to `null`/throws `not_found`, not a row |
| [11](11-ownership-on-the-api-surface.md) — a non-member gets the same answer as for a missing card | 2 | the two responses are byte-identical: same status, same `code`, same headers |
| [05c](05c-constraint-violations-and-sqlstate.md) — a duplicate title raises `23505` | 1 | the DAL rejects it; the SQLSTATE is on the thrown error |
| [05ca](05ca-mapping-sqlstate-to-status-codes.md) — `23505` on `cards_board_title_unique` becomes `409 duplicate_title` | 2 | a `DomainError(409, 'duplicate_title')` renders as status 409 and `code: "duplicate_title"` |
| [05d](05d-idempotency-keys-for-a-retried-post.md) — a replayed `POST` returns the first card, not a second | 3 (needs two overlapping requests) | one row exists; both responses carry the same `id` |
| [06d](06d-keyset-pagination.md) — the cursor is a total order | 1 | concatenating pages equals one unpaginated query, with no duplicates and no gaps, across an insert mid-scan |
| [06g](06g-conditional-requests-and-etag.md) — `If-None-Match` on an unchanged card is `304` | 2 | status 304 and an empty body |
| [07c](07c-the-lost-update.md) — the read-modify-write loses a write | 3 | 🔴 requires a forced interleaving; a sequential test proves nothing |
| [07d](07d-optimistic-concurrency-with-a-version-column.md) / [07e](07e-etag-if-match-and-412.md) — a stale `If-Match` is `412` | 2 and 3 | 2 for the parse and the status; 3 for the claim that the *second* real writer is the one rejected |
| [08c](08c-cascades-and-referential-integrity.md) — deleting a board deletes its cards | 1 | zero `cards` rows for that `board_id` after the parent delete |
| [08d](08d-status-codes-and-idempotency.md) — `DELETE` twice is not an error the second time | 2 | both calls return the same status |
| [09d](09d-serialization-failures-and-the-retry-loop.md) — `40001` is retried and the request succeeds | 3 | two Serializable transactions forced into a read/write cycle; the retry loop swallows it |
| [09f](09f-transaction-duration-as-pool-occupancy.md) — a long transaction occupies a pooled connection | — | **not a test.** It is a capacity property; asserting it means asserting a timing |
| [02d](02d-the-lock-a-migration-actually-takes.md) — a migration takes `ACCESS EXCLUSIVE` | — | not a test either; it is a fact about the DDL you are about to run |

**Two rows in that table are the whole reason this topic exists as more than a paragraph.** The rows marked "requires a forced interleaving" cannot be tested by any amount of care in a single-threaded test; [12i](12i-forcing-the-interleaving.md) writes them. And the seed/reset strategy that most suites reach for first — wrap each test in a transaction and roll it back — is structurally incompatible with those same rows, which is [12f](12f-the-seed-and-reset-story.md).

## Waste 1 — asserting a status code in a DAL test

This is the most common one, and it looks like thoroughness.

```ts
// ❌ test/dal/cards.test.ts — this assertion is in the wrong building
import { readCard } from '@/lib/dal/cards'

it('404s for a card the caller cannot see', async () => {
  const err = await readCard(otherTeamsCardId).catch((e) => e)
  expect(err.status).toBe(404)          // 🔴 why does the DAL know what 404 is?
})
```

The test passes. It also *encodes* the thing topic 10 spent a page preventing: a `status` field reachable from the DAL. The moment the API grows a second entry point — a Server Action, which has no status line at all — that field is meaningless, and the test that asserted it is now guarding a property the product no longer has.

```ts
// ✅ the DAL test asserts the domain outcome
it('returns nothing for a card the caller cannot see', async () => {
  await expect(readCard(otherTeamsCardId)).rejects.toMatchObject({ code: 'not_found' })
})

// ✅ the boundary test asserts the rendering — once, for the whole mapping
it('renders not_found as 404', async () => {
  const res = toHttpResponse(new DomainError(404, 'not_found', 'No such card'))
  expect(res.status).toBe(404)
  expect((await res.json()).error.code).toBe('not_found')
})
```

The second test does not need a database, does not need a route, and covers every endpoint at once, because [topic 10](10-errors-and-one-response-shape.md) made the mapping a single exhaustive `Record`. That is what a well-placed layer boundary buys you: **one test for a rule that would otherwise be re-asserted on six routes.**

## Waste 2 — asserting the SQL in a route test

The mirror image, and it is worse, because it fails in both directions.

```ts
// ❌ test/api/cards.route.test.ts
vi.mock('@/db', () => ({ db: { select: vi.fn().mockReturnThis(), from: vi.fn(), where: vi.fn() } }))

it('queries cards scoped to the board', async () => {
  await GET(new Request('http://x/api/boards/b1/cards'), { params: Promise.resolve({ boardId: 'b1' }) })
  expect(db.select).toHaveBeenCalled()
  expect(db.from).toHaveBeenCalledWith(cards)   // 🔴 asserts a call shape, not a result
})
```

**It fails when the code is right.** Swap `db.select().from(cards)` for `db.query.cards.findMany()` — same rows, same order, same projection — and the test breaks. You now have a test that punishes refactoring.

**It passes when the code is wrong.** Drop the `and(eq(cards.boardId, boardId), isNull(cards.deletedAt))` clause entirely and every one of those assertions still holds: `select` was called, `from` was called with `cards`. The test's whole subject — *does this query return the right rows* — is the one thing a mock cannot observe.

The right split is that the route test never sees SQL at all:

```ts
// ✅ the route test mocks the DAL FUNCTION, not the driver
vi.mock('@/lib/dal/cards', () => ({ listBoardCards: vi.fn() }))

it('renders a page of cards with a next cursor', async () => {
  vi.mocked(listBoardCards).mockResolvedValue({ items: [aCardRepresentation()], nextCursor: 'c2' })
  const res = await GET(new Request('http://x/api/boards/b1/cards'), {
    params: Promise.resolve({ boardId: 'b1' }),
  })
  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ nextCursor: 'c2' })
})
```

`listBoardCards` is a seam with a contract ([04e](04e-function-per-use-case.md) made it one function per use case precisely so it could be). `db.select` is an implementation detail with no contract at all. **Mock the seam; never mock the driver.** The full argument, including the three cases where a mocked database is right and the six things it silently stops checking, is [12b](12b-the-database-is-the-thing-under-test.md).

## Waste 3 — testing the framework

A third category, smaller but persistent: assertions about Next.js rather than about your API.

```ts
// ❌ this asserts that Next.js awaits params. It does. That is Next.js's test to write.
it('reads the dynamic segment', async () => {
  const res = await GET(req, { params: Promise.resolve({ cardId: 'abc' }) })
  expect(getCard).toHaveBeenCalledWith('abc')
})
```

If it were broken, every route would fail, and you would find out from the first real test rather than from this one. The rule of thumb: **if the assertion would be identical in an application about invoices, it is a framework test and someone upstream already owns it.**

The genuine exception is where the framework's behaviour is the surprising part of *your* contract — `params` being a `Promise` in Next.js 16 is exactly the kind of thing type-checking catches for free, and [ch13 · 3c](../13-testing-and-developer-experience/03c-typed-routes-and-generated-types.md) settles that with `RouteContext` rather than with a runtime test.

## Where the boundary with chapter 13 actually runs

There is a clean line and it is worth stating so neither side re-teaches the other.

- **Chapter 13 owns the tool.** How to configure Vitest for the App Router, why an `async` Server Component is not unit-testable today, how Playwright authenticates, how the suite shards in CI. Start at [ch13 · 1](../13-testing-and-developer-experience/01-unit-and-component-testing-jest-vitest-react-testing-library.md) and [ch13 · 1b](../13-testing-and-developer-experience/01b-testing-server-components-and-server-actions.md).
- **This topic owns the subject.** What an assertion about a row, a status code or two concurrent writers should say, and which of chapter 13's five layers it lands in.

Concretely: when you need to know *how* to call an exported `PATCH` handler from a Vitest file, that is [ch13 · 1b](../13-testing-and-developer-experience/01b-testing-server-components-and-server-actions.md). When you need to know *what to assert* once you have called it, that is [12c](12c-asserting-on-the-envelope-not-the-prose.md).

One overlap is real and deliberate: [ch13 · 5](../13-testing-and-developer-experience/05-project-milestone-sprintdesk-test-suite.md) already argues that the tenancy predicate is the highest-value test in the suite, and gives it a per-test-team fixture strategy. This topic agrees and goes further in two directions that chapter cannot: the predicate needs a **negative** assertion on *every verb* ([12e](12e-the-ownership-negative-test.md)), and the per-test-team strategy is only one of four reset strategies, with the other three each surviving a different subset of this chapter's topics ([12f](12f-the-seed-and-reset-story.md)).

## The suite this topic ends up prescribing

Not a file layout — chapter 13 owns that — but a shape, so you can tell whether yours is missing a whole category rather than a case.

```
test/
  dal/          layer 1 · real Postgres, no HTTP. The predicate, ordering,
                constraints, cascades, the version bump, keyset continuity.
  boundary/     layer 2 · exported route functions, DAL mocked at the seam.
                Status codes, ETag, If-Match, the error envelope's `code`.
  concurrency/  layer 1.5 · real Postgres, TWO connections, forced interleaving.
                Lost update, 412, 40001 retry, the idempotency-key race.
  e2e/          layer 3 · Playwright against `next start` (chapter 13 owns this).
```

`concurrency/` is the directory nobody has. It is not a layer in chapter 13's five-layer table because chapter 13's layers are defined by *what renders*, and these tests render nothing — they are two database sessions and a barrier. They also cannot run under the same reset strategy as `dal/`, which is why they get their own directory rather than a `describe` block.

## Gotchas

**★ Symptom: a refactor from `db.select()` to a relational query broke forty tests and no behaviour.** Cause: the tests asserted on driver calls rather than on returned rows, so the query builder's API became part of your test contract. Fix: delete the driver mocks. Layer 1 tests hit a real database and assert rows; layer 2 tests mock the DAL function and assert the response. There is no legitimate reason for a test file to import `db` and `vi.fn()` in the same breath.

**★ Symptom: coverage on the DAL is 95% and a customer saw another team's cards.** Cause: coverage measures lines executed, and the ownership predicate is a `WHERE` clause — a query with the clause deleted executes exactly the same lines. Fix: the predicate needs a *negative* test with a second, non-member caller, on every verb ([12e](12e-the-ownership-negative-test.md)). No line-coverage number can substitute for it, and [ch13 · 5](../13-testing-and-developer-experience/05-project-milestone-sprintdesk-test-suite.md) makes the same point about the ratchet.

**★ Symptom: the DAL suite duplicates the status-code mapping in nine files.** Cause: each DAL test was written as an end-to-end assertion "from function call to HTTP status", so the mapping got re-asserted per use case. Fix: assert the mapping once against `toHttpResponse` with a synthetic `DomainError`, and let each DAL test assert only its own `code`. Topic 10's exhaustive `Record<FailureKind, number>` means the compiler already forces you to handle a new kind; the test only has to prove the `Record` is wired in.

**★ Symptom: the test for "a long transaction ties up a pooled connection" is flaky.** Cause: it is a timing assertion wearing a functional costume — you set a small pool, opened a transaction, and asserted the next request "waited". What you actually measured was the scheduler. Fix: do not write it. Assert the *functional* consequence instead if there is one (a `503` from a pool-acquisition timeout, which is deterministic if you configure `connectionTimeoutMillis`), and leave occupancy to the metrics in [ch17](../17-deployment-scaling-and-observability/01-explanation.md).

**★ Symptom: a test asserts `expect(plan).toContain('Index Scan')` and fails on a small table.** Cause: the planner is allowed to choose a sequential scan when the table is tiny, which every test fixture is. Fix: never assert on `EXPLAIN` output in a functional suite — it is a property of statistics, not of correctness. If index usage matters, assert it against production-sized data in a separate, explicitly non-blocking job, and understand that you are testing PostgreSQL's planner rather than your code.

**★ Symptom: adding a sixth route meant writing the same four "unauthenticated returns 401" tests again.** Cause: the auth check is per-handler rather than in one place, so it needs per-handler proof. Fix: this is a design smell the test surfaced. Move it to the single place topic 04 argues for, then the assertion becomes one test of that helper plus a cheap structural check that every handler calls it.

## Interview questions

**★ Why is asserting a status code inside a Data Access Layer test a mistake even though the assertion passes?**
Because it means the DAL knows what a status code is, and the whole reason the DAL exists is that it does not. This API has two entry points — Route Handlers and Server Actions — and a Server Action has no status line, so a `status` field on a DAL error is meaningless in half the callers. The DAL's job is to produce a domain outcome (`not_found`, `conflict`, `precondition_failed`), and one translator per entry point renders that outcome. If the test can only be written by reaching a status code out of the DAL, the layering is wrong and the test is proving the wrong thing correct.

**★ A colleague argues that mocking `db` in route tests makes the suite fast and hermetic. What is the counter-argument?**
That it makes the suite fast at asserting nothing. A driver mock can observe which builder methods were called; it cannot observe which rows come back, and "which rows come back" is the entire content of a CRUD API. Concretely: delete the ownership predicate from a query and every driver-mock assertion still passes. The speed argument is also weaker than it looks, because the alternative is not "route test with a real database" — it is a route test that mocks the *DAL function*, which is just as fast and asserts something real, plus a DAL test against a real database that asserts the rows.

**★ Which claims in this chapter are not testable at all, and why is that acceptable?**
Two kinds. First, capacity and timing properties — a long transaction occupying a pooled connection, a migration's lock duration. Asserting them requires measuring, and a measurement in a test suite is a flake generator; they belong to observability. Second, planner behaviour — whether a query used the `(board_id, created_at, id)` index. The planner is allowed to choose differently on a small table, and every fixture is small. That is acceptable because neither is a correctness claim: the API returns the same answers either way. What must be tested is what the client can observe.

**★ Why does "concurrency" need its own test directory rather than being a group inside the DAL tests?**
Because it cannot use the same reset strategy. DAL tests can run inside a wrapping transaction that is rolled back afterwards; concurrency tests cannot, since they need two independent sessions that can actually see each other's committed work, and the code under test may run its own `SET TRANSACTION ISOLATION LEVEL` — which PostgreSQL forbids after the first statement of a transaction. Two tests with incompatible setup requirements in one file means one of them is silently running under the wrong conditions, so the split is structural, not organisational.

**★ How do you decide which layer an assertion belongs in?**
The lowest layer that can make it. Not the lowest layer that *could be made to* make it — a DAL test can be tortured into asserting a 404, and a Playwright test can be tortured into asserting a cascade — but the lowest layer that can make it *natively*, with the vocabulary it already has. If an assertion needs you to import something from a higher layer to express it, it belongs in that higher layer.

---

← [11 · Ownership on the API surface](11-ownership-on-the-api-surface.md) · [Chapter 16 overview](01-explanation.md) · Next → [12b · The database is the thing under test](12b-the-database-is-the-thing-under-test.md)
