---
title: "A DAL that returns rows has made every future migration a change to your API, because adding a column widens every response that carries it — in a file nobody edited, with no review, no type error and no deploy note"
sidebar_label: "04d · Projections, not rows"
sidebar_position: 17
description: "Why the third DAL obligation is the one people skip, the migration that leaks a column nobody exposed, naming columns in the select and typing the mapper against the contract so a rename is a compile error, two projections for two use cases, field-level predicates, and why classes cannot cross the RSC boundary."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security) (§ *Data Access Layer*, § *Auditing*) and [Next.js · Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — both `version: 16.3.4` — and the [Drizzle ORM · select](https://orm.drizzle.team/docs/select) and [type API](https://orm.drizzle.team/docs/goodies) references.
> Target: **Next.js 16.3.4** · `drizzle-orm` **0.45.2** · **PostgreSQL 18.4** · React **19.2.8** · Node **24.20.0**.
> Documentation-verified; **no sandbox run, no timings**.

**Of the three documented obligations of a Data Access Layer, this is the one that gets skipped, because the other two produce visible failures and this one does not. A missing `server-only` is a build error eventually. A missing authorization check is a pentest finding. A DAL that returns rows works perfectly, forever — right up until a migration adds `internal_notes` or `stripe_customer_id` to the table, at which point every response that carried that row silently widens, in a file nobody edited, with no type error and nothing in the pull request that mentions the API at all. That is a leak introduced by a database change, and it is the only kind that has no author.**

## The obligation, quoted

> *"A Data Access Layer should:"*
> *"* Only run on the server.
> * Perform authorization checks.
> * **Return safe, minimal Data Transfer Objects (DTOs).**"*

and the audit question that operationalises it for actions:

> *"Are return values filtered to only what the client needs?"*
> — [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security)

*Filtered to only what the client needs* — not "filtered of anything obviously secret". The default direction is to name what you send, not to strip what you do not.

## The bug, shown

```ts
// 🔴 lib/dal/cards.ts — every obligation satisfied except the third.
export async function readCard(cardId: string) {
  const { userId } = await requireUser()
  const rows = await db.select().from(cards)
    .where(and(eq(cards.id, cardId), callerOwnsCard(userId)))
  if (!rows[0]) throw new NotFound('card')
  return rows[0]
}
```

`server-only` is present. The ownership predicate is in the `WHERE` clause. And `deletedAt` is in the response today, plus whatever the next migration adds tomorrow.

Now play the tape forward. Someone ships a feature that needs a moderation flag:

```sql
ALTER TABLE cards ADD COLUMN flagged_reason text;
```

Nothing else changed. No TypeScript file was edited. `db.select()` with no argument selects every column, so `flagged_reason` is now in the `GET /api/cards/[cardId]` response, in the RSC payload of every board page, and in the return value of every Server Action that returned a card. **The migration was the deploy that changed the API**, and the pull request that contained it had one `.sql` file in it.

⚠️ **The ORM shape of this is identical and slightly better hidden.** `db.query.cards.findFirst()` with no `columns` option returns the whole model, and it reads like a scoped, type-safe API rather than like `SELECT *`.

## Name the columns, then map to the contract

Two steps, and the second is what makes the first hold.

```ts
// lib/dal/projections.ts
import 'server-only'
import type { CardRepresentation } from '@/contracts/cards'
import { cards } from '@/db/schema'

/**
 * The exact column set every card-shaped query selects. One object, so the
 * list query and the item query cannot drift from each other.
 */
export const CARD_COLUMNS = {
  id: cards.id,
  boardId: cards.boardId,
  title: cards.title,
  body: cards.body,
  status: cards.status,
  position: cards.position,
  version: cards.version,
  createdAt: cards.createdAt,
  updatedAt: cards.updatedAt,
} as const

/** What the database gives back for CARD_COLUMNS. Derived, never hand-written. */
type CardRow = {
  id: string
  boardId: string
  title: string
  body: string | null
  status: 'todo' | 'doing' | 'done'
  position: number
  version: number
  createdAt: Date
  updatedAt: Date
}

/**
 * The single mapper from storage shape to contract shape.
 * Its return type is the contract, so a schema change that breaks the mapping
 * is a compile error here rather than a silent change to the API.
 */
export function toRepresentation(row: CardRow): CardRepresentation {
  return {
    id: row.id,
    boardId: row.boardId,
    title: row.title,
    body: row.body,
    status: row.status,
    position: row.position,
    version: row.version,
    createdAt: row.createdAt.toISOString(),   // Date → RFC 3339 string, per 01c
    updatedAt: row.updatedAt.toISOString(),
  }
}
```

Three properties are doing the work.

**`CARD_COLUMNS` is one object.** The list query and the item query both spread it, so they cannot select different sets — which is the drift that produces a field present on `GET /api/cards/[cardId]` and absent from the list, and a client that works on one page and not another.

**The mapper's return type is `CardRepresentation`.** That is the compile-time link between the schema and the contract. Rename `body` to `description` in the schema and this file stops compiling; add a column and nothing happens, which is exactly right. **A new column should require an edit to be exposed, and no edit to stay hidden.**

**Dates are converted here.** A `Date` crossing the RSC boundary is a serialization question you do not want to have; a string is a string everywhere. The contract in [01c](01c-what-the-client-may-rely-on.md) committed to RFC 3339 in UTC, and `toISOString()` produces exactly that.

⚠️ **`CardRow` is written out rather than inferred** because Drizzle's inferred select type follows the schema, and the whole point of the mapper is to sit *between* the schema and the contract. If both sides are inferred from the schema, a schema change propagates through the mapper without complaint and you have lost the compile error you were buying. Deriving `CardRow` from `typeof cards.$inferSelect` is convenient and gives up the guarantee.

## Two use cases, two projections

A card's `body` can be long. The board page renders a hundred cards and shows none of their bodies. Selecting it anyway means transferring text the client discards, on the query that runs most often.

```ts
// lib/dal/projections.ts
export const CARD_SUMMARY_COLUMNS = {
  id: cards.id,
  boardId: cards.boardId,
  title: cards.title,
  status: cards.status,
  position: cards.position,
  version: cards.version,
  updatedAt: cards.updatedAt,
} as const

export type CardSummary = {
  id: string
  boardId: string
  title: string
  status: 'todo' | 'doing' | 'done'
  position: number
  version: number
  updatedAt: string
}
```

🔴 **But that is a change to the contract, so it has to be in the contract.** [01c](01c-what-the-client-may-rely-on.md) says the list returns `data: CardRepresentation[]`. Introducing a summary shape means the list returns something narrower, and a client that read `body` from a list item breaks. Two projections are the right design and they are a decision the contract has to state — which is the argument of [01](01-the-resource-contract.md) arriving from the other end. **Deciding a projection in the DAL and not telling the contract is how an API acquires a second, undocumented shape for the same noun.**

## Field-level predicates

Authorization is not only "may you see this row" but "which of its columns may you see". The documented DAL expresses that as small predicate functions beside the DTO, so the rule sits next to the data it governs:

```ts
// lib/dal/projections.ts
import type { BoardRole } from './access'

/** Only a team admin sees why a card was flagged. Everyone else sees that it was. */
export function toRepresentationFor(row: CardRow & { flaggedReason: string | null }, role: BoardRole) {
  return {
    ...toRepresentation(row),
    flagged: row.flaggedReason !== null,
    flaggedReason: role === 'admin' ? row.flaggedReason : null,
  }
}
```

The shape is stable regardless of the viewer — `flaggedReason` is always present as a key — and only the value varies. That matters because a client whose object shape changes with the viewer's role has to handle two shapes, and the one it handles worse is the privileged one nobody tests.

## Classes, and the guard rail that fires

The documented DAL returns a class instance for the current user, and the reason is mechanical rather than stylistic:

> *"Use classes to avoid accidentally passing the whole object to the client."*

> *"Functions and classes are already blocked from being passed to Client Components by default."*
> — [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security)

So modelling internal identity as `new CurrentUser(id)` makes leaking the whole session a build-time impossibility rather than something a reviewer must notice. The trade is that a class also cannot be a Server Action's return value, so you construct a plain DTO at the boundary — which is the right shape anyway.

For cards the calculus is different and worth stating: a `CardRepresentation` is *meant* to cross to the client, so it is a plain object. **Use a class for the things that must never cross, and a plain object for the things that are designed to.** A refusal to serialize is a guard rail firing, not an inconvenience — and if you find yourself writing `.toClient()` to work around it, check first whether the object should have been a projection all along.

## Gotchas

**★ Symptom: a column nobody exposed appears in an API response after an unrelated migration.** Cause: the DAL returns rows, so `SELECT *` widened. Nobody edited a TypeScript file and no review mentioned the API. Fix: name the columns in one shared object and map through a function typed against the contract — then a new column requires an edit to be exposed and no edit to stay hidden.

**★ Symptom: `deletedAt` is visible to clients.** Cause: it is on the table and the projection was `select()`. Fix: it is deliberately absent from `CARD_COLUMNS`, which is what lets [topic 08 · DELETE](08-delete.md) change how soft delete works without touching the contract. A column the contract never mentioned is a column you are still free to redesign.

**★ Symptom: the list endpoint and the item endpoint return different field sets and nobody decided that.** Cause: two queries each wrote their own column list. Fix: one exported `CARD_COLUMNS` object that both spread. If they genuinely should differ, that is two named projections and a line in the contract, not two ad-hoc selects.

**★ Symptom: a schema rename compiled fine and broke every client.** Cause: the row type and the response type were both inferred from the schema, so renaming a column renamed the API field with no error anywhere. Fix: type the mapper's return against the hand-written contract type. That is the one place the two worlds are pinned together, and it must not be inferred from either side.

**★ Symptom: `createdAt` arrives at the client as `{}` or as a string on one route and an object on another.** Cause: a `Date` was returned from one path and converted on another. Fix: convert in the mapper, once. The contract says RFC 3339 string, so there is exactly one representation and it is produced in one function.

**★ Symptom: the board page transfers megabytes for a hundred cards.** Cause: the list query selects `body`, which the board never renders. Fix: a summary projection — and put it in the contract, because narrowing a list response is a breaking change for anyone who was reading the field.

**★ Symptom: a Server Action returns a DAL value and React refuses to serialize it.** Cause: the DAL returned a class instance, and *"functions and classes are already blocked from being passed to Client Components by default"*. Fix: that refusal is the guard rail working. Keep classes for internal identity and construct a plain DTO at the boundary.

**★ Symptom: a privileged field is present for admins and absent for everyone else, and the client crashes for admins.** Cause: the object's *shape* varies with the viewer, so the branch that handles the extra field is the one exercised least. Fix: keep the shape constant and vary only the value — `flaggedReason: role === 'admin' ? row.flaggedReason : null` — so there is one shape and one code path.

**★ Symptom: the mapper was inlined into the route handler "since it is one object literal".** Cause: it looks like formatting. Fix: it is the boundary. Inlined in a handler it exists once per entry point, which reintroduces exactly the drift the DAL removed — and the Server Action path, which has no handler, gets whatever the raw row was.

**★ Symptom: a `select` with named columns still returned a field nobody wanted, because a join brought it.** Cause: a joined query returns nested objects keyed by table unless you name the shape. Fix: always pass an explicit selection object to `select()`, including for joins, so the result shape is something you wrote rather than something the builder assembled.

## Interview questions

**★ Why is returning database rows a security problem rather than a tidiness problem?**
Because it makes a migration into an API change with no author. Adding a column is a `.sql` file in a pull request that touches no TypeScript, passes every type check, and quietly widens every response that carried that row — the item endpoint, the list endpoint, every RSC payload containing a card, and every Server Action return value. Nobody reviewed an API change because nobody made one. That is qualitatively different from a leak someone wrote, because there is no diff to catch it in and no test that would fail; the only defence is that the exposure requires an edit, which is precisely what naming the columns buys.

**★ What makes the mapper the right place for the compile-time link between schema and contract?**
Because it is the one function that mentions both worlds, so it is the only place where a disagreement between them can be an error. Its parameter is the storage shape and its return type is the contract type, so renaming a column breaks it and adding a column does not — which is exactly the asymmetry you want. The mistake that destroys this is inferring the row type from the schema *and* the response type from the schema, which is convenient and means a schema change flows straight through to the API with nothing objecting. The contract type has to be hand-written, in a file with no imports, or it is not a contract.

**★ You need a lighter response for the list endpoint. Where is the decision made?**
In the contract first, and in the DAL second. A narrower list response is a breaking change for any client reading a field you removed, so it is exactly the kind of thing [01c](01c-what-the-client-may-rely-on.md) exists to state — and the migration path is the additive one: publish the summary shape as the documented list response, keep the full one available on the item route, and let clients that need `body` fetch the card. What you must not do is make the change only in the DAL, because then the API has two undocumented shapes for the same noun and the difference between them is which function a handler happened to call.

**★ Why does the documented DAL return a class for the current user and a plain object for a card?**
Because they have opposite intentions about crossing the boundary. The session must never reach the client, and classes are blocked from being passed to Client Components by default — so making it a class turns an accidental `<Panel user={user} />` into a build failure rather than a review item. A card representation is *designed* to reach the client, so a class would only get in the way and you would end up writing a `.toClient()` method that reintroduces the same mapping by hand. The rule is: class for the things that must not cross, plain object for the things that are meant to, and if you are fighting the serializer, ask which of the two you actually have.

**★ How do field-level permissions fit into a projection?**
As small predicate functions applied inside the mapper, so the rule sits next to the data it governs rather than in whichever component happened to render it. The important design detail is that the object's *shape* stays constant and only the value varies — a nullable field for the unprivileged viewer rather than an absent key. Varying the shape means the client has two object types to handle, and the branch that handles the privileged one is the least exercised and the least tested. It also makes the response type honest: one `CardRepresentation` with a nullable field is something you can write down in a contract, and "sometimes this key is there" is not.

**★ What does an audit of this actually look like?**
Three greps and one habit. Grep for `db.select()` with no argument and for `findFirst`/`findMany` with no `columns` option — those are the `SELECT *` shapes. Grep for `db.` outside `lib/dal/`, which the lint boundary should already be preventing. Grep for return types in the DAL that are inferred rather than annotated, since an inferred return type is one that follows the schema silently. The habit is to check, at every point where a DAL result becomes a Client Component prop or a Server Action return value, that it went through the mapper — because that is the crossing the type system does not police and the migration-driven leak is invisible everywhere else.

---

← [04ca · Where it must not live](04ca-where-the-check-must-not-live.md) · [Chapter 16 overview](01-explanation.md) · Next → [04e · One function per use case](04e-function-per-use-case.md)
