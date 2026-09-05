---
title: "A generic `findCards(where, orderBy, limit)` is not a Data Access Layer with fewer functions — it is the driver with an extra import, because every parameter it accepts hands a decision back to the caller that the layer existed to take away"
sidebar_label: "04e · One function per use case"
sidebar_position: 27
description: "The seven things a generic passthrough re-opens, the complete list of card functions and why it is exactly that long, the options-object middle ground and the line it must not cross, what is legitimately parameterisable, and the counting test that tells you which kind of layer you have."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security) (§ *Data Access Layer*, § *Auditing*) — `version: 16.3.4` — and the [Drizzle ORM · select](https://orm.drizzle.team/docs/select) reference. Composes material already verified in [04](04-the-data-access-layer.md) through [04d](04d-projections-not-rows.md); it introduces no new external claims.
> Target: **Next.js 16.3.4** · `drizzle-orm` **0.45.2** · **PostgreSQL 18.4** · Node **24.20.0**.
> Documentation-verified; **no sandbox run, no timings**.

**The pressure to generalise a Data Access Layer arrives about two weeks in, and it arrives sounding correct: there are now nine functions over one table, several of them differ by one clause, and a single `findCards(criteria)` would replace all of them. It would, and it would also undo every property the previous four chunks built — because each of those properties is a decision the layer takes *away from the caller*, and a parameter is precisely how you hand a decision back. The number of functions is not the cost of the design; it is the design.**

## The seven things a passthrough re-opens

```ts
// 🔴 lib/dal/cards.ts — looks like a DAL, is a driver with an extra import.
export async function findCards(opts: {
  where?: SQL
  orderBy?: SQL
  limit?: number
  columns?: Record<string, unknown>
}) {
  const { userId } = await requireUser()
  return db.select(opts.columns ?? getTableColumns(cards))
    .from(cards)
    .where(and(callerOwnsCard(userId), opts.where))
    .orderBy(opts.orderBy ?? cards.createdAt)
    .limit(opts.limit ?? 100)
}
```

That version even keeps the ownership predicate, which is the strongest version of the argument for it. It still gives back seven things.

**1 · The projection.** `columns` is a parameter, so [04d](04d-projections-not-rows.md)'s guarantee is gone — and the default is every column, which is the leak that migration widens. A caller who passes nothing gets `SELECT *`.

**2 · The filter.** `where` is a parameter, so the set of predicates that can be applied to `cards` is now open. The ownership clause survives here, but nothing stops a caller passing a fragment that is trivially true — or one that references another table and changes the plan entirely.

**3 · The ordering.** [01c](01c-what-the-client-may-rely-on.md) committed to an ordering, and a cursor is meaningless without it. With `orderBy` as a parameter, the contract's ordering promise is enforced at each call site rather than once, and a call site that passes a different order silently breaks pagination for that endpoint only.

**4 · The bound.** `limit` defaults to 100 and accepts anything. There is now a code path that can ask for a million rows, and finding it means reading every caller.

**5 · Auditability.** The documented audit asks whether database access is delegated to a `server-only` DAL, and the useful version of that question is *"what queries can this application issue?"*. With one function per use case the answer is the export list. With a passthrough the answer is "read every call site", which is the same answer you get with no DAL at all.

**6 · Indexability.** You cannot index for query shapes you cannot enumerate. The composite index in [02](02-the-schema-and-the-migration-story.md) exists because exactly one query shape needs it; a passthrough means the set of shapes is whatever callers wrote, so index decisions become archaeology.

**7 · Error translation.** [02b](02b-constraints-are-the-first-validation-layer.md)'s mapping turns `23505` on `cards_idem_key_uq` into a specific message. A generic function does not know which constraint its caller might hit, so it can only produce a generic domain error — and the specificity you built in the schema is discarded at the layer that was supposed to use it.

🔴 **Notice that none of the seven is fixed by adding validation to the parameters.** They are re-opened by the parameters *existing*. A `where` you validate is still a `where` the caller chose.

## The complete list, and why it is exactly this long

```ts
// lib/dal/cards.ts — the entire public surface. Nine functions, no options bags.
import 'server-only'

export async function listBoardCards(boardId: string, cursor?: string): Promise<CardListResult>
export async function readCard(cardId: string): Promise<CardRepresentation>
export async function createCard(boardId: string, input: NewCardInput): Promise<CardRepresentation>
export async function replaceCard(cardId: string, input: FullCardInput, expectedVersion: number): Promise<CardRepresentation>
export async function patchCard(cardId: string, input: PartialCardInput, expectedVersion: number): Promise<CardRepresentation>
export async function deleteCard(cardId: string): Promise<void>
export async function moveCard(cardId: string, toBoardId: string, position: number, expectedVersion: number): Promise<CardRepresentation>
export async function restoreCard(cardId: string): Promise<CardRepresentation>
export async function countBoardCards(boardId: string): Promise<number>
```

Six of those are the six routes from [01](01-the-resource-contract.md), one-for-one. `moveCard` exists because moving is a `PATCH` with a different transaction — it touches two boards' orderings — and giving it a name is cheaper than giving `patchCard` a branch. `restoreCard` belongs to soft delete. `countBoardCards` exists precisely so that the expensive thing has a name, which is why the contract can refuse to include a count in the list response and still let an admin screen ask for one.

**That is the whole surface, and you can read it.** "What can this application do to a card?" is answered by nine lines. Every property from [04](04-the-data-access-layer.md) onward holds because each of those functions makes every decision itself:

| Decision | Who makes it |
|---|---|
| Which columns | the function ([04d](04d-projections-not-rows.md)) |
| Which filter, including ownership | the function ([04c](04c-the-ownership-predicate.md)) |
| Which ordering | the function, matching the contract |
| The bound on rows returned | the function |
| Which errors are possible | the function, so it can translate them |

## The options object, and the line it must not cross

Not every parameter is a surrender, and pretending otherwise produces nine near-identical functions instead. The line is precise:

🔴 **A parameter may change *which rows* within a shape the query already fixes. It may never change the shape.**

Legitimate, because they select within a fixed query:

```ts
export type ListOptions = {
  /** Opaque, produced by this module. Decodes to (createdAt, id) — 01c. */
  cursor?: string
  /** Clamped, not trusted. */
  limit?: number
  /** A closed set, not a SQL fragment. */
  sort?: 'created' | 'position'
  /** A closed set. */
  status?: 'todo' | 'doing' | 'done'
}

export async function listBoardCards(boardId: string, opts: ListOptions = {}) {
  const { userId } = await requireUser()
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100)   // clamped here, always
  // ... the ordering is chosen from a closed set inside this function,
  //     never assembled from the caller's input.
}
```

Illegitimate, because each changes the shape:

```ts
// 🔴 every one of these hands a decision back
{ where: SQL }                    // the filter set becomes open
{ orderBy: SQL }                  // the contract's ordering becomes per-call-site
{ columns: string[] }             // the projection becomes the caller's
{ includeDeleted: boolean }       // soft-delete semantics become a flag
{ skipOwnershipCheck: boolean }   // no comment
```

The `sort` field is the instructive case, because it is a parameter that *looks* like `orderBy` and is not: it is a member of a closed set that the function maps to a specific `ORDER BY` it wrote itself, so every value produces a query shape you have enumerated and can index. A string that becomes SQL is a different thing wearing the same name. [Topic 06b · Filtering and sorting without injection](06b-filtering-and-sorting-without-injection.md) owns the sorting and filtering surface in full.

⚠️ **`includeDeleted` deserves a specific warning**, because it is the most reasonable-looking item on that list. A boolean that toggles `deleted_at IS NULL` means every caller decides soft-delete semantics, and the caller who gets it wrong is the one whose endpoint shows deleted cards to customers. `restoreCard` and an explicit `listDeletedBoardCards` are two functions with two names and no flag — and the reason the list is nine functions long rather than six.

## The counting test

A quick diagnostic on any DAL, including one you inherited:

> **Divide the number of exported functions by the number of distinct things the application does to that resource. If the answer is much below one, it is a passthrough.**

Nine functions for nine use cases is a DAL. Three functions serving forty use cases means thirty-seven decisions are being made somewhere else, and "somewhere else" is the call sites — which is where the layer was created to remove them from.

The corollary is a good review heuristic: **a new DAL function is cheap and a new DAL parameter is expensive.** Adding `listArchivedBoardCards` costs eight lines and no risk. Adding `archived?: boolean` to `listBoardCards` costs one line and changes what every existing caller could do.

## What it does to tests

One function per use case means one test per use case, and each test is import-seed-call-assert with no framework. The passthrough version has no such mapping: you cannot test `findCards` meaningfully, because its behaviour is a function of arguments the test invents rather than of arguments any caller passes — so you end up testing the call sites, which means testing route handlers, which means a `Request`/`Response` round trip for what should have been a function call.

The security tests are the sharper case. With one function per use case, "a non-member cannot read a card" is a test of `readCard`, and it covers every entry point permanently. With a passthrough, the same assertion has to be made once per call site, and a call site added later is a hole no existing test notices.

## Gotchas

**★ Symptom: a generic `findCards` was introduced to reduce duplication, and six months later nobody can say what queries the app issues.** Cause: the query set became the set of arguments callers happen to pass. Fix: one function per use case, so the export list *is* the query set. The duplication being removed was mostly the boilerplate of naming a projection, which is exactly the part worth keeping.

**★ Symptom: an endpoint returns deleted cards.** Cause: an `includeDeleted` flag defaulted wrong, or a caller passed it without understanding it. Fix: two named functions, no flag. A boolean that changes which rows exist is a shape change wearing a parameter's clothes.

**★ Symptom: pagination skips rows on one endpoint and not another.** Cause: `orderBy` is a parameter and one call site passed a different order than the cursor encodes. Fix: the ordering lives inside the function, chosen from a closed set, and matches what the contract promises and what the index supports — one decision, three places, all inside the DAL.

**★ Symptom: a query asked for a million rows in production.** Cause: `limit` was a trusted parameter with a generous default. Fix: clamp inside the function — `Math.min(Math.max(opts.limit ?? 50, 1), 100)` — so the bound is the function's, not the caller's, and no call site can raise it.

**★ Symptom: adding a sort option required a new index and nobody knew until it was slow.** Cause: sorting was open, so the query shapes were unknown until they ran. Fix: a closed `sort` set means the shapes are enumerable, and each one either has an index or is a known, deliberate scan.

**★ Symptom: a `columns` parameter was added "for the mobile app" and the mobile app now receives `deletedAt`.** Cause: the projection became the caller's. Fix: a second named projection and a second named function, both in the DAL, both in the contract.

**★ Symptom: the error mapping stopped producing specific messages after a refactor.** Cause: one generic function cannot know which constraint its caller might violate, so it can only emit a generic domain error. Fix: per-use-case functions, each translating the constraints its own statement can actually hit ([02b](02b-constraints-are-the-first-validation-layer.md)).

**★ Symptom: someone adds `skipOwnershipCheck: true` for an admin tool.** Cause: an admin use case that genuinely exists, solved with a flag. Fix: it is a different use case, so it is a different function with a different name and its own authorization rule — `adminReadCardAnyTeam`, guarded by a check on the admin role. A flag that disables the predicate makes the predicate optional for every caller forever, and the audit question "can this bypass ownership?" changes from "no" to "read every call site".

**★ Symptom: the DAL has nine functions and a reviewer calls it bloated.** Cause: measuring the layer by line count rather than by what it decides. Fix: the counting test. Nine functions for nine use cases is the correct ratio; the alternative is not fewer decisions, it is the same decisions made in more places by people who were not thinking about them.

**★ Symptom: two functions in the DAL differ only in their `ORDER BY` and someone merges them.** Cause: they look like duplication. Fix: check whether the two orderings have different cursors and different indexes. If they do, they are two query shapes with one name, which is the passthrough failure arriving one merge at a time. If they genuinely do not differ in anything that matters, merging them is fine — the test is the shape, not the line count.

## Interview questions

**★ Why is a generic `findCards(criteria)` not a Data Access Layer?**
Because every property that makes a DAL a DAL is a decision it takes away from the caller, and every parameter hands one back. `columns` returns the projection, `where` returns the filter set, `orderBy` returns the ordering the contract promised, and `limit` returns the bound. What remains is a function that authenticates and then does whatever it was told — which is the driver with an authentication wrapper. The clearest test is the audit question: with one function per use case, "what queries can this application issue?" is answered by the export list; with a passthrough it is answered by reading every call site, which is the same answer you get with no layer at all.

**★ Where exactly is the line between a legitimate parameter and a passthrough?**
A parameter may select *which rows* within a query shape the function has already fixed; it may not change the shape. A cursor and a clamped limit select rows. A `status` drawn from a closed set selects rows, because every value produces a query the function wrote. A `sort` value from a closed set is borderline and lands on the right side, because the function maps the token to an `ORDER BY` it authored and each option is a shape you can index. A `where` fragment, an `orderBy` fragment, a column list or a boolean that toggles a predicate are all shape changes, and the giveaway is that you cannot enumerate the resulting queries without reading the callers.

**★ Someone needs an admin tool that reads any card. How do you support it without a bypass flag?**
As a separate function with its own name and its own authorization rule — `adminReadCardAnyTeam`, which checks an admin role rather than team membership. It is a different use case, so it gets a different function; that is the whole rule and it scales. The alternative, a `skipOwnershipCheck` option, makes the predicate optional for every caller of the original function forever, and changes the answer to "can anything in this codebase bypass ownership?" from a flat no into an audit. The named function also documents itself: it appears in the export list, so anyone reading the DAL sees that a bypass path exists and what guards it, which is exactly the visibility a flag removes.

**★ How does one-function-per-use-case change what you can test?**
It creates a one-to-one mapping between use cases and tests, and each test is a plain function call — import, seed a session, call, assert — with no framework, no `Request`, no browser. The security tests are where this pays most: "a non-member cannot read a card" is one test of `readCard`, and it holds for every entry point that exists now or later, because there is only one way to read a card. With a passthrough, the same assertion has to be repeated once per call site, and a call site added six months from now is a hole no existing test can notice. So the shape of the layer decides whether your authorization tests are a fixed cost or a per-endpoint one.

**★ Nine functions over one table feels like a lot. What is the counter-argument?**
That the count is the wrong measure. What matters is the ratio of exported functions to distinct things the application does, and nine-to-nine is exactly right — the alternative is not fewer decisions, it is the same decisions relocated to call sites where nobody was thinking about projections, ordering, bounds or error translation. It is also worth being clear about what the "duplication" being removed actually is: mostly a named column set and a `WHERE` clause, which are the two things you specifically want written down per use case. The useful review heuristic is that a new function is cheap and a new parameter is expensive — `listArchivedBoardCards` costs eight lines and no risk, while `archived?: boolean` costs one line and widens what every existing caller can do.

**★ Two DAL functions differ only in their `ORDER BY`. Merge them?**
Only after checking whether the two orderings imply different cursors and different indexes, because if they do, they are two query shapes and merging them means one function with a shape that depends on an argument — the passthrough failure arriving one reasonable merge at a time. If the orderings genuinely differ in nothing that matters downstream, merging is fine and the closed-set `sort` parameter is the right way to express it. The test is not how similar the code looks; it is whether you can still enumerate the queries the application issues after the merge.

**★ What is the single strongest argument for this shape, if you had to pick one?**
That it makes the security question answerable by reading one file. Every other benefit — indexability, error specificity, testability, a contract that cannot drift — is real and is a consequence of the same property: the set of things that can happen to this resource is written down, in one place, as an export list. A layer whose behaviour depends on what callers pass has replaced a readable artefact with an investigation, and investigations do not happen on a Tuesday afternoon when someone is adding an endpoint.

---

← [04d · Projections, not rows](04d-projections-not-rows.md) · [Chapter index](01-explanation.md) · Next → [05 · CREATE](05-create.md)
