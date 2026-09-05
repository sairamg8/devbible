---
title: "The ownership predicate is a `WHERE` clause, so deleting it changes no line of coverage and breaks no positive test — which makes the negative test, with a second caller who is a member of a different team, the only assertion in the suite that can detect the chapter's worst failure"
sidebar_label: "12e · The ownership negative test"
sidebar_position: 77
description: "Why a positive-only suite cannot see a missing predicate, the six-route by three-caller matrix, the identity assertion that a non-member and a missing card produce the same response, the write-side check a response assertion misses, the two-predicate move, and how to prove the negative test is not decorative."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [RFC 9110 · HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.txt) §15.5.4 and §15.5.5 (fetched as raw text from rfc-editor.org), the [PostgreSQL 18 `SELECT` reference](https://www.postgresql.org/docs/18/sql-select.html), and the Next.js [Data Security guide](https://nextjs.org/docs/app/guides/data-security). Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Vitest **5.0.0** · Node **24.20.0**.

**Every other failure in this chapter announces itself. A broken cascade leaves orphan rows somebody notices, a wrong status code breaks a client, a lost update produces a support ticket. A missing ownership predicate produces nothing at all: the query runs, the row comes back, the page renders, the response is a perfectly well-formed `200`, and one customer is reading another customer's cards. It is invisible to line coverage, because the predicate is a clause inside a statement that executes identically without it. It is invisible to every positive test, because the caller in those tests *is* a member and the clause they are missing would have matched anyway. It is invisible to type checking, unless you went out of your way to make the scope a branded type. The only thing that can see it is a test that logs in as somebody else — and that test has to exist on every verb, because a predicate is only as good as the query that forgot it.**

## Why a positive-only suite is blind to this

Take the read:

```ts
// lib/dal/cards.ts — the predicate is the second half of the WHERE
export async function getCard(cardId: string): Promise<CardDTO | null> {
  const userId = await requireUserId()
  const [row] = await db
    .select(CARD_COLUMNS)
    .from(cards)
    .innerJoin(boards, eq(boards.id, cards.boardId))
    .innerJoin(teamMembers, eq(teamMembers.teamId, boards.teamId))
    .where(and(
      eq(cards.id, cardId),
      isNull(cards.deletedAt),
      eq(teamMembers.userId, userId),          // 🔴 delete this line
    ))
    .limit(1)
  return row ?? null
}
```

Delete the marked line. Now list every test that changes colour:

- The positive read test: the caller is a member, the join still matches, **the same row comes back. Green.**
- Line coverage: identical. Branch coverage: identical — there is no branch.
- The type checker: `userId` is still used by the join, so no unused-variable error. Even removing the `teamMembers` join entirely only trips a lint rule about an unused binding, which most configurations do not have.
- The Playwright flow: the fixture user owns the board. **Green.**

The suite is fully green and the API is fully open. That is the failure this page exists to make impossible.

## The matrix, and it is not optional to fill it in

Six routes, four caller kinds. The full grid is what a predicate audit looks like.

| Route | member of owning team | **member of a different team** | unauthenticated | card does not exist |
|---|---|---|---|---|
| `GET /api/boards/[boardId]/cards` | `200` + rows | 🔴 `404` (the *board* is invisible) | `401` | `404` |
| `POST /api/boards/[boardId]/cards` | `201` | 🔴 `404` — **not** `403`, and **no row written** | `401` | `404` |
| `GET /api/cards/[cardId]` | `200` | 🔴 `404` | `401` | `404` |
| `PATCH /api/cards/[cardId]` | `200` | 🔴 `404` — and **no row written** | `401` | `404` |
| `PUT /api/cards/[cardId]` | `200` | 🔴 `404` — and **no row written** | `401` | `404` |
| `DELETE /api/cards/[cardId]` | `204` | 🔴 `404` — and **not soft-deleted** | `401` | `204` ([08d](08d-status-codes-and-idempotency.md)) |

Two cells deserve their own sentence.

**The collection endpoint returns `404`, not an empty `200`.** The resource being addressed is `/api/boards/<id>/cards`, and if the caller cannot see the board, the *collection* does not exist for them — same reasoning as [11](11-ownership-on-the-api-surface.md) applies to a card. An empty `200` would be a defensible alternative for a board the caller *can* see that happens to have no cards, and that distinction is the test:

```ts
// ✅ two different emptinesses, two different answers
it('returns 200 with an empty page for an owned board with no cards', async () => {
  const res = await GET(asMember(emptyOwnedBoard))
  expect(res.status).toBe(200)
  expect((await res.json()).items).toEqual([])
})

it('returns 404 for a board the caller is not a member of', async () => {
  const res = await GET(asOutsider(otherTeamsBoard))
  await expectFailure(res, 404, 'not_found')
})
```

**`DELETE` of a non-existent card returns `204`, and `DELETE` of somebody else's card must return the same thing as whatever your contract chose** — because if absent gives `204` and forbidden gives `404`, you have rebuilt the existence oracle on the delete verb. Whichever you pick, both cells must agree.

## The identity assertion

The matrix above says "the same status". The stronger claim topic 11 makes is that the two responses are *indistinguishable*, and that is a comparison rather than two expectations.

```ts
// ✅ test/dal/ownership.identity.test.ts
async function shapeOf(res: Response) {
  const body = await res.clone().json().catch(() => null)
  return {
    status: res.status,
    headers: Object.fromEntries([...res.headers].filter(([k]) => k !== 'date')),
    error: body?.error ? { ...body.error, correlationId: '<unstable>' } : body,
  }
}

it('a non-member and a missing card are indistinguishable', async () => {
  const forbidden = await GET(asOutsider(realCardOwnedByAnotherTeam))
  const missing   = await GET(asOutsider(randomUUID()))
  expect(await shapeOf(forbidden)).toEqual(await shapeOf(missing))
})
```

`correlationId` and `Date` are normalised because they are unstable by construction ([12c](12c-asserting-on-the-envelope-not-the-prose.md)); everything else — including the header set — must match. **Compare, do not assert twice.** Two separate `expect(res.status).toBe(404)` calls pass while one response carries `Cache-Control: private` and the other does not, and a header difference is a distinguisher just as surely as a status difference.

## The write-side check a response assertion misses

A `404` on a `PATCH` proves what the caller was told. It does not prove what the server did.

```ts
// ❌ incomplete: the row may have been updated before the check ran
const res = await PATCH(asOutsider(card.id), { title: 'Hijacked' })
await expectFailure(res, 404, 'not_found')
```

The failure this misses is real and has a plausible shape: a handler that updates first and checks ownership on the returned row, or a DAL function where the ownership join was moved from the `UPDATE ... WHERE` into a follow-up `SELECT`. Both produce a `404` **after** writing.

```ts
// ✅ assert the response AND the state
it('does not modify the row when the caller is not a member', async () => {
  const before = await readRowDirectly(card.id)          // a raw query, no predicate
  const res = await PATCH(asOutsider(card.id), { title: 'Hijacked' })
  await expectFailure(res, 404, 'not_found')
  const after = await readRowDirectly(card.id)
  expect(after).toEqual(before)                           // including version and updated_at
})
```

`readRowDirectly` is deliberately a *different* code path from the DAL — a raw `db.select().from(cards).where(eq(cards.id, id))` in the test helper. If you verified the state by calling `getCard` as an administrator, you would be checking the predicate with the predicate.

🔴 **Do the same for `DELETE`**, and check `deleted_at` specifically, because a soft delete leaves the row present and a naive "the row still exists" assertion passes on a successfully-hijacked delete.

```ts
expect(after.deletedAt).toBeNull()
```

## The move has two predicates and everyone tests one

`moveCard(cardId, toBoardId, position, expectedVersion)` ([09g](09g-the-one-genuine-superpower.md)) is the function where the predicate is easiest to half-implement, because there are two resources.

| Caller is a member of… | Correct answer |
|---|---|
| the source board's team **and** the target board's team | `200`, the card moves |
| the source board's team only | 🔴 `404` — and the card must **not** move |
| the target board's team only | 🔴 `404` — and the card must not move |
| neither | `404` |

Row two is the one that ships broken. The implementation reads the card (predicate applied, passes), then writes `board_id = $2` — and nothing ever checked that the caller may write into board 2. The result is a card teleported into a team the caller has no relationship with, which in a multi-tenant product is a data-leak in the other direction: you have injected a row into someone else's tenant.

```ts
// ✅ the test row two needs
it('refuses a move into a board the caller is not a member of', async () => {
  const res = await PATCH(asMemberOfSourceOnly(card.id), { boardId: foreignBoard.id, position: 1 })
  await expectFailure(res, 404, 'not_found')
  expect((await readRowDirectly(card.id)).boardId).toBe(sourceBoard.id)
})
```

The general rule the test encodes: **every identifier that arrives from the client is a resource reference, and every resource reference needs the predicate applied to it** — not just the one in the path.

## The other five places an identifier arrives from the client

Same rule, five more surfaces, each with a negative test.

**A pagination cursor from another board.** The cursor encodes `(created_at, id)` ([06d](06d-keyset-pagination.md)). Passing board A's cursor to board B's list must not page through A's rows — assert the returned rows all carry `boardId === B`.

**An `If-Match` ETag for another team's card.** The tag embeds a card id. Parsing it before checking ownership lets a `412` confirm that the version guessed was wrong, which is an oracle. `versionFromIfMatch` already rejects a tag whose id does not match the path's `cardId` ([07e](07e-etag-if-match-and-412.md)), and the test asserts the *precedence*: a non-member sending a syntactically perfect `If-Match` gets `404`, never `412`.

```ts
it('answers 404 before 412 for a non-member with a valid-looking If-Match', async () => {
  const res = await PATCH(asOutsider(card.id), { title: 'x' }, { 'if-match': `"c-${card.id}-1"` })
  await expectFailure(res, 404, 'not_found')     // 🔴 not 412 — 412 would confirm existence
})
```

**An idempotency key replayed by a different user.** [05da](05da-scoping-expiry-and-the-records-table.md) scopes the key by user for exactly this reason; the negative test replays user A's key as user B and asserts a fresh creation (or a `404`, per your contract) rather than A's card.

**A `restoreCard` on a soft-deleted card.** Restore ([08e](08e-restoring-a-soft-deleted-row.md)) is a separate DAL function and therefore a separate `WHERE`. Its predicate is forgotten roughly as often as the move's target check.

**A board id in a `POST` body rather than the path.** If any endpoint accepts `boardId` in the body, it needs the predicate applied to the *body's* value, and the negative test sends a path the caller owns with a body naming a board they do not.

## Proving the negative test is not decorative

A negative test can pass for the wrong reason — the outsider fixture was never actually created, the helper silently fell back to the member session, the assertion was on a `404` that came from a typo'd URL. There is one check that settles it, it takes two minutes, and it should be done once per predicate:

🔴 **Comment out the predicate. The negative test must go red. If the suite is still green, the test is decoration.**

That is mutation testing done by hand on the one mutation that matters. It is worth writing the instruction into the test file as a comment, because the person who eventually breaks the predicate will be reading that file:

```ts
// To verify this test is real: delete `eq(teamMembers.userId, userId)` from getCard
// in lib/dal/cards.ts. Every test in this file must fail. If any passes, fix the test.
```

Two structural guards make the by-hand check less necessary over time.

**A branded scope type.** [ch13 · 5](../13-testing-and-developer-experience/05-project-milestone-sprintdesk-test-suite.md) builds a `TeamScope` branded type that a query cannot be written without, which converts a forgotten predicate from a runtime leak into a compile error. That is a stronger guarantee than any test and it is the right first move; the negative tests remain, because a branded type proves the scope was *passed*, not that it was *used in the WHERE*.

**An enumeration test over the DAL's exports.** Cheap, and it catches the new function nobody wrote a negative test for:

```ts
// ✅ every exported DAL function is covered by a negative test, or the list says why not
import * as dal from '@/lib/dal/cards'

const NEGATIVE_TESTED = new Set([
  'listBoardCards', 'readCard', 'getCard', 'createCard', 'patchCard',
  'moveCard', 'deleteCard', 'restoreCard', 'listCards',
])
const EXEMPT = new Set<string>([])   // add with a comment saying why, never silently

it('every DAL export has a negative ownership test', () => {
  const exported = Object.keys(dal).filter((k) => typeof (dal as never)[k] === 'function')
  const uncovered = exported.filter((k) => !NEGATIVE_TESTED.has(k) && !EXEMPT.has(k))
  expect(uncovered).toEqual([])
})
```

This is the rare test that fails on an *addition*, which is what you want: the day someone adds `archiveCard`, the build tells them a negative test is missing before the code review does.

## Gotchas

**★ Symptom: the predicate was deleted in a refactor and the entire suite stayed green.** Cause: every test authenticated as a member of the owning team, so the clause was never load-bearing. Fix: at least one test per DAL function with an outsider session, plus the by-hand mutation check above. Coverage cannot substitute — the statement executes identically either way.

**★ Symptom: a non-member `PATCH` returns 404 and the row's `version` incremented.** Cause: the update ran and the ownership check happened afterwards, on the returned row. Fix: the predicate belongs in the `UPDATE ... WHERE`, so zero rows are affected and there is nothing to check afterwards ([04ca](04ca-where-the-check-must-not-live.md)); the test asserts the row is byte-identical before and after, read through a raw query rather than through the DAL.

**★ Symptom: a card ended up in another team's board.** Cause: `moveCard` applied the predicate to the source card and never to the target board. Fix: apply it to both, and add the "member of source only" test — it is the single most-missed cell in the matrix, and it leaks in the direction most people do not think to check.

**★ Symptom: a non-member gets 412 instead of 404 when they send `If-Match`.** Cause: the handler parses and evaluates the precondition before consulting the DAL, so the version comparison happens on a card the caller may not see. Fix: resolve the resource under the predicate first; only a caller who could have read the card may receive a precondition verdict. Assert the precedence explicitly, because the natural handler ordering — parse headers, then query — produces the wrong answer.

**★ Symptom: the collection endpoint returns `200 {"items": []}` for another team's board.** Cause: the predicate was applied to `cards` but the board's existence was never checked, so an unknown board and a forbidden board both produce zero rows. Fix: decide which of `404` and empty-`200` the contract says, then make both the outsider case and the genuinely-empty case assert it — they are two different situations and exactly one of them should be `200`.

**★ Symptom: the outsider test passes even with the predicate removed.** Cause: the fixture's "other team" user was never inserted, so the session helper fell back to the default member, or the request hit a URL that 404s for an unrelated reason. Fix: assert the *positive* case for the outsider first — that they can read their own team's card — inside the same file. A fixture that cannot succeed at anything is not proving a failure.

**★ Symptom: a user replayed another user's idempotency key and received their card.** Cause: the key was treated as globally unique rather than scoped per caller. Fix: the uniqueness constraint includes the user id ([05da](05da-scoping-expiry-and-the-records-table.md)), and the negative test is a replay across two sessions. This one is easy to miss because the positive replay test — same user, same key — passes either way.

**★ Symptom: `restoreCard` lets an outsider un-delete a card.** Cause: restore is a separate DAL function with its own `WHERE`, written after the negative tests were "finished". Fix: the export-enumeration test above, which fails the moment a function exists without an entry in the covered list.

**★ Symptom: negative tests were removed as "duplicative" during a cleanup.** Cause: they all assert `404`, so they look like the same test six times. Fix: name each one for the *route and caller* rather than for the outcome — `PATCH by a member of another team`, not `returns 404` — so the grid is legible as a grid and a missing row is visibly missing.

## Interview questions

**★ Why can't code coverage detect a missing ownership predicate?**
Because coverage measures which lines and branches executed, and the predicate is a conjunct inside a `WHERE` clause. Removing it does not remove a line, a branch or a function call — the same statement runs, returns rows, and the same application lines process them. Branch coverage is equally blind: there is no `if`. The only observable difference is *which rows come back*, and that difference is only visible if a caller exists who should get zero of them. That caller has to be created by the test, which is why the negative test is not optional and no metric substitutes for it.

**★ Why does the collection endpoint's forbidden case need its own test when the single-card case is already covered?**
Because they are different queries with different predicates. `getCard` joins to `team_members` through the card's board; `listBoardCards` is given a `boardId` directly and may have been written to filter cards by that id without ever checking the board. The failure mode is specific to the list: an outsider who guesses a board id receives its entire contents in one request, which is worse than the single-card leak by a factor of the page size. Every query needs its own negative test because every query has its own `WHERE`.

**★ A `PATCH` by a non-member returns 404. Is that sufficient to conclude nothing happened?**
No. The response tells you what the caller was told, not what the server did. A handler that performs the update and then checks ownership on the result produces exactly that 404 while having incremented `version` and rewritten `title`. The complete test reads the row through a raw query before and after and asserts it is unchanged, including `version`, `updated_at` and `deleted_at`. Reading it back through the DAL would not do, because that path applies the predicate you are trying to test.

**★ Where does the ownership predicate most commonly get half-implemented, and why there?**
On a move, or on any operation naming two resources. The developer applies the predicate to the resource in the path and forgets the one in the body, because the mental model is "check that they own the thing they are changing" — and the target board is not the thing being changed, it is the thing being changed *into*. The leak runs the other way from the usual one: rather than reading someone else's data, you write a row into their tenant. The generalisation is that every client-supplied identifier is a resource reference and every reference needs the predicate.

**★ How do you know a negative test is actually testing anything?**
Break the thing it guards and watch it fail. Comment out the predicate; every negative test must go red. If any stays green, the test is not exercising the path it claims to — usually because the outsider fixture was never created or the session helper silently fell back. It is worth also asserting the positive case for the outsider in the same file, so a fixture that can never succeed at anything cannot masquerade as proof of a refusal.

**★ If a branded `TeamScope` type makes the predicate impossible to forget at compile time, why keep the runtime tests?**
Because the type proves the scope was passed into the function, not that it reached the `WHERE` clause. A query can accept a `TeamScope`, use it for a log line, and filter on nothing. The brand also cannot cover the second resource in a move, a value that arrived in a request body and was cast, or a query written with raw SQL. The type and the tests guard different halves: the type makes the mistake harder to make, and the test makes it impossible to keep.

---

← [12d · Representation and non-assertions](12d-representation-assertions-and-what-not-to-assert.md) · [Chapter index](01-explanation.md) · Next → [12f · The seed and reset story](12f-the-seed-and-reset-story.md)
