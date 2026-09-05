---
title: "Put the membership test in the WHERE clause and the query cannot return a card the caller may not see — which turns authorization from something the function does, and can therefore forget, into something the function is"
sidebar_label: "04c · The ownership predicate"
sidebar_position: 24
description: "The three-hop predicate written once as an EXISTS fragment and reused by every read and every write, the supporting tables and the two indexes that exist only for it, why the subject of a check is never a parameter, and why the same predicate makes 404 the only answer the function is capable of giving."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security) (§ *Authentication and authorization*, § *Auditing*) and [Next.js · Server Actions](https://nextjs.org/docs/app/guides/server-actions) — both `version: 16.3.4` — the [PostgreSQL 18 subquery expressions reference](https://www.postgresql.org/docs/18/functions-subquery.html), and [React · `cache`](https://react.dev/reference/react/cache).
> Target: **Next.js 16.3.4** · `drizzle-orm` **0.45.2** · **PostgreSQL 18.4** · React **19.2.8** · Node **24.20.0**.
> Documentation-verified; **no sandbox run, no timings**.

**This is the spine of the chapter, and it is one sentence: a caller may touch a card only if they are a member of the team that owns the board that owns the card. Where that sentence lives decides how much of the rest of the chapter has to talk about security. Written in each handler, it is a rule with as many copies as there are entry points and it has to be repeated in every future one. Written as a predicate inside the DAL's queries, it is a property of the query — a non-member's `SELECT` returns zero rows and their `UPDATE` affects none, with no branch anywhere that could have been forgotten. That is why topics 05 through 08 can discuss status codes without re-litigating authorization on every page.**

## The shape of the data

The `cards` table is the canonical one from [02](02-the-schema-and-the-migration-story.md). The three tables the predicate walks through are supporting, and the only interesting thing about them is that `team_members` is a join table with a composite primary key, so membership is a single index lookup rather than a scan.

```ts
// db/schema.ts — the supporting tables the predicate needs.
import { pgTable, uuid, text, index, primaryKey } from 'drizzle-orm/pg-core'

export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
})

export const teamMembers = pgTable('team_members', {
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(),
  role: text('role').notNull().default('member'),
}, (t) => ({
  pk: primaryKey({ columns: [t.teamId, t.userId] }),
  byUser: index('team_members_user_idx').on(t.userId, t.teamId),
}))

export const boards = pgTable('boards', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
}, (t) => ({
  byTeam: index('boards_team_idx').on(t.teamId),
}))
```

Two indexes, both there for the predicate rather than for a feature. `team_members_user_idx` on `(user_id, team_id)` exists because the predicate is always evaluated *for a given user*, and the composite primary key on `(team_id, user_id)` is the wrong leading column for that direction.

## The predicate, in SQL

```sql
EXISTS (
  SELECT 1
    FROM boards b
    JOIN team_members tm ON tm.team_id = b.team_id
   WHERE b.id = cards.board_id
     AND tm.user_id = $1
)
```

`EXISTS` rather than a join into the main query, deliberately. PostgreSQL's `EXISTS` stops at the first matching row:

> *"The subquery will generally only be executed long enough to determine whether at least one row is returned, not all the way to completion."*
> — [PostgreSQL 18 · Subquery Expressions](https://www.postgresql.org/docs/18/functions-subquery.html)

and, unlike a join, it cannot multiply the outer result. A user who is somehow a member twice would produce two copies of every card through a join and exactly one through `EXISTS`. That is not a hypothetical worth designing around so much as a reason not to need to think about it.

## The predicate, written once

```ts
// lib/dal/access.ts
import 'server-only'
import { sql } from 'drizzle-orm'
import { cards } from '@/db/schema'

/**
 * The chapter's ownership rule, as a SQL fragment.
 * Written as raw SQL rather than assembled from helpers so that what the
 * database receives is visible in one place and reviewable as one thing.
 *
 * Correlates on `cards.board_id`, so it composes into any query over `cards`.
 */
export function callerOwnsCard(userId: string) {
  return sql`EXISTS (
    SELECT 1
      FROM boards b
      JOIN team_members tm ON tm.team_id = b.team_id
     WHERE b.id = ${cards.boardId}
       AND tm.user_id = ${userId}
  )`
}

/** The same rule for a board id, used by the collection routes. */
export function callerOwnsBoard(userId: string, boardId: string) {
  return sql`EXISTS (
    SELECT 1
      FROM boards b
      JOIN team_members tm ON tm.team_id = b.team_id
     WHERE b.id = ${boardId}
       AND tm.user_id = ${userId}
  )`
}
```

Both take `userId` as an argument, which looks like it contradicts the next section. It does not, and the distinction is where the argument comes from: these are internal helpers, unexported from the DAL's public surface, and the only thing that calls them is `requireUser()`. That is the pattern from [ch10 · 06f](../10-forms-authentication-and-security-hardening/06f-milestone-authorization-on-the-board.md) — an unexported function that takes an id, reachable only through an exported one that derives it.

## The subject of a check is never a parameter

```ts
// lib/dal/session.ts
import 'server-only'
import { cache } from 'react'
import { auth } from '@/lib/auth'
import { Unauthorized } from './errors'

/** The ONLY call site of auth() in the application. */
export const readSession = cache(async (): Promise<{ userId: string } | null> => {
  const session = await auth()
  return session?.user?.id ? { userId: session.user.id } : null
})

/** Throws rather than returning null, so a caller cannot forget to check. */
export const requireUser = cache(async (): Promise<{ userId: string }> => {
  const session = await readSession()
  if (!session) throw new Unauthorized('no session')
  return session
})
```

🔴 **A DAL function signature of `readCard(cardId, userId)` is an authorization bypass with a pleasant name.** Any caller can pass any id, so the check is only as good as every call site — which is exactly the property the layer was created to remove. The documented comment on the canonical DAL is *"Don't pass values, read back cached values"*, and `cache()` is what makes re-deriving the viewer free: nine call sites in one request produce one session read.

⚠️ **Treat `cache()` as an optimisation during render and never as a correctness guarantee.** Whether it deduplicates two calls inside one Server Action invocation is not something the documentation settles; the code above is correct if `readSession` runs twice.

## Read: the predicate in the `WHERE` clause

```ts
// lib/dal/cards.ts
import 'server-only'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from './db'
import { cards } from '@/db/schema'
import { requireUser } from './session'
import { callerOwnsCard } from './access'
import { NotFound } from './errors'
import type { CardRepresentation } from '@/contracts/cards'
import { toRepresentation } from './projections'

export async function readCard(cardId: string): Promise<CardRepresentation> {
  const { userId } = await requireUser()

  const rows = await db
    .select({
      id: cards.id,
      boardId: cards.boardId,
      title: cards.title,
      body: cards.body,
      status: cards.status,
      position: cards.position,
      version: cards.version,
      createdAt: cards.createdAt,
      updatedAt: cards.updatedAt,
    })
    .from(cards)
    .where(and(
      eq(cards.id, cardId),
      isNull(cards.deletedAt),
      callerOwnsCard(userId),   // ← the rule, in the statement
    ))
    .limit(1)

  const row = rows[0]
  if (!row) throw new NotFound('card')
  return toRepresentation(row)
}
```

Note what is *absent*: there is no `if (!isMember) throw new Forbidden()`. There is nothing to forget, because there is no branch. And `NotFound` is thrown for both "no such card" and "not your card" — not as a policy the function implements, but because **the function cannot tell them apart.** The disclosure decision from [01b](01b-the-six-routes-and-the-codes-they-commit-to.md) is enforced by the shape of the query rather than by anyone remembering it.

## Write: the same predicate, and `rowCount` as the answer

```ts
export async function deleteCard(cardId: string): Promise<void> {
  const { userId } = await requireUser()

  const deleted = await db
    .delete(cards)
    .where(and(eq(cards.id, cardId), callerOwnsCard(userId)))
    .returning({ id: cards.id })

  if (deleted.length === 0) throw new NotFound('card')
}
```

```ts
export async function setCardStatus(
  cardId: string,
  status: 'todo' | 'doing' | 'done',
  expectedVersion: number,
): Promise<CardRepresentation> {
  const { userId } = await requireUser()

  const updated = await db
    .update(cards)
    .set({ status, version: sql`${cards.version} + 1`, updatedAt: new Date() })
    .where(and(
      eq(cards.id, cardId),
      eq(cards.version, expectedVersion),
      isNull(cards.deletedAt),
      callerOwnsCard(userId),
    ))
    .returning({
      id: cards.id, boardId: cards.boardId, title: cards.title, body: cards.body,
      status: cards.status, position: cards.position, version: cards.version,
      createdAt: cards.createdAt, updatedAt: cards.updatedAt,
    })

  if (updated.length === 0) throw new NotFound('card')
  return toRepresentation(updated[0])
}
```

⚠️ **That last function has a genuine ambiguity and it is worth naming rather than hiding.** Zero rows can mean three things: no such card, not your card, or the version did not match. The first two must be indistinguishable; the third is a `409`, not a `404` — and 🔴 **not a `412` either.** RFC 9110 defines 412 narrowly: *"one or more conditions given in the request header fields evaluated to false when tested on the server"*. A version arriving as a function argument or a body field is not a request header field, so the precondition machinery never ran; 409's own section names this exact case, *"if versioning were being used and the representation being PUT included changes to a resource that conflict with those made by an earlier (third-party) request"*. `412` is reserved for the `If-Match` path in [07e](07e-etag-if-match-and-412.md). Resolving it needs a second, predicate-scoped read to ask "does this card exist *for you*?" and only then to conclude the version was stale. [Topic 07d · Optimistic concurrency with a version column](07d-optimistic-concurrency-with-a-version-column.md) owns that resolution; what this page owns is the reason the ambiguity exists at all, which is that the predicate deliberately makes two of the three cases identical.

## Gotchas

**★ Symptom: a DAL function takes `userId` as a parameter and the IDOR you removed from the handler reappears one layer down.** Cause: the code moved and the *trust decision* did not. Fix: derive identity inside the DAL with `requireUser()`, and keep any id-taking helper unexported. The documented rule is *"Don't pass values, read back cached values."*

**★ Symptom: the predicate is present and a non-member gets `403` instead of `404`.** Cause: someone added a second, explicit membership read to produce a "better" error. Fix: remove it. The whole value of the predicate form is that the two cases are indistinguishable, and re-introducing the distinction re-introduces the disclosure the contract refused.

**★ Symptom: every card query got slower after the predicate was added.** Cause: the membership lookup is running per row without a usable index in the direction it is queried. Fix: index `team_members` on `(user_id, team_id)` as well as the `(team_id, user_id)` primary key — the predicate is always evaluated for a given user, so `user_id` must be able to lead.

**★ Symptom: a user who is a member twice sees every card twice.** Cause: the predicate was written as a join into the main query rather than as `EXISTS`, so duplicate membership rows multiply the result. Fix: `EXISTS`, which by definition returns a boolean and *"will generally only be executed long enough to determine whether at least one row is returned"*.

**★ Symptom: an update returns `404` and the caller is certain the card exists and is theirs.** Cause: the predicate and the version check are in the same `WHERE` clause, so a stale version is indistinguishable from a missing card. Fix: this is a real ambiguity and it needs a second scoped read to resolve — do not paper over it by dropping the version from the clause, which would silently remove the concurrency control.

**★ Symptom: `requireUser()` is called and a `403` is returned for a signed-out visitor.** Cause: `Unauthorized` was mapped to `403` rather than `401`. Fix: `401` means "you have not told me who you are" and is recoverable by signing in; `404` means "for you, this does not exist". Mapping the first to `403` tells an anonymous caller the resource exists, which is the disclosure the design avoids everywhere else.

**★ Symptom: `callerOwnsCard()` produces a SQL error about a missing `cards` reference.** Cause: it is a *correlated* subquery — it refers to `cards.board_id` from the outer query — so it is only valid in a statement whose target is `cards`. Fix: use `callerOwnsBoard(userId, boardId)` for anything that is not scoped to a card, such as the collection route, and keep the two helpers separate rather than trying to make one do both.

**★ Symptom: the collection route returns nothing for a board the caller is definitely on.** Cause: the wrong helper. `callerOwnsCard` correlates on `cards.board_id`, and a list query filtered by a board id needs the uncorrelated `callerOwnsBoard`, which takes the id directly. Fix: two helpers with two shapes and names that say which is which — this is the one place where "just make it generic" costs more than it saves.

**★ Symptom: a soft-deleted card is returned to its owner.** Cause: `isNull(cards.deletedAt)` is not part of the predicate helper and was omitted from that one query. Fix: it is deliberately *not* in the helper, because a restore endpoint legitimately needs to see deleted rows — so it belongs in each query, and a DAL function that reads live cards without it is a review failure. [Topic 08 · DELETE](08-delete.md) owns the semantics, and what that predicate costs every read is [08b](08b-what-soft-delete-costs-every-read.md).

## Interview questions

**★ Why must the subject of an authorization check never be a parameter?**
Because a parameter is chosen by the caller, and the caller is exactly who the check is about. `readCard(cardId, userId)` looks like it centralises the rule and actually delegates the most important input back to every call site — so the safety of the layer becomes the safety of the least careful place that calls it, which is precisely the property the layer was created to remove. Deriving identity inside the DAL, with `cache()` making the re-derivation free, means there is no argument to get wrong and no way for one call site to be weaker than another. The documented DAL says this in a comment on its own example: *"Don't pass values, read back cached values."*

**★ Why does a non-member get `404` rather than `403`, and how is that enforced?**
`403` confirms that a resource exists to someone who has no right to know it exists, which turns the API into an oracle for enumerating boards and by extension customers. `404` says nothing. The enforcement is the interesting part: because the membership test is a predicate in the `WHERE` clause, a non-member's query simply returns zero rows, so the function *cannot* distinguish "no such card" from "not your card" even if its author wanted to. That is much stronger than a policy someone has to remember, and it is why the error vocabulary in [04](04-the-data-access-layer.md) has one `NotFound` class covering both situations rather than two classes and a rule about which to use.

**★ Where does the check go for a `PATCH`, given the update also has a version precondition?**
In the same `WHERE` clause, alongside the version comparison — and that creates a real ambiguity you have to resolve rather than hide. Zero affected rows now means one of three things: the card does not exist, it is not yours, or the version was stale. The first two must remain indistinguishable, and the third should be `412` rather than `404`, so resolving it takes a second read scoped by the same predicate: "does this card exist *for you*?" If yes, the version was stale and the answer is `412`; if no, it is `404`. What you must not do is remove the version from the clause to make the error clearer, because that removes the concurrency control that was the point of the column.

**★ Why is the predicate written as a correlated `EXISTS` rather than a join, and why raw SQL rather than the query builder?**
`EXISTS` because it returns a boolean and cannot change the cardinality of the outer result — a join into `team_members` would duplicate every card for a user who is somehow a member twice, which is a data-quality accident turning into a visible bug. It also short-circuits, since the subquery *"will generally only be executed long enough to determine whether at least one row is returned"*. Raw SQL because this is the single most security-relevant fragment in the codebase and it should be reviewable as one literal thing: what the database receives is what is written on the page, with the user id parameterised. A version assembled from builder helpers is equally correct and is harder to read adversarially, which is the property that actually matters for this particular fragment.

**★ Why are there two helpers, and why not one that takes an optional board id?**
Because they have different shapes, not different arguments. `callerOwnsCard` is correlated — it references `cards.board_id` from the enclosing query, so it is only valid in a statement over `cards` and it needs no id passed in. `callerOwnsBoard` is uncorrelated and takes the id explicitly, because a collection query is scoped by a board rather than by a card. Merging them behind an optional parameter would produce a helper whose SQL shape depends on an argument, which is exactly the generic-passthrough failure [04e](04e-function-per-use-case.md) argues against: the moment a caller can change what the predicate correlates on, the caller is back in control of the rule.

---

← [04b · What it does not protect](04b-what-server-only-does-not-protect.md) · Next → [04ca · Where the check must not live](04ca-where-the-check-must-not-live.md)
