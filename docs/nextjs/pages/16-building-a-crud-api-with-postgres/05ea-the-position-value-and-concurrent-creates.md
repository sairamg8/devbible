---
title: "`position` is `NOT NULL` with no default, so somebody has to invent it — and the obvious `max(position) + 1` is a read-modify-write that two concurrent creates both win under READ COMMITTED, producing two cards at the same place and a board whose order changes on every refresh"
sidebar_label: "05ea · The position value"
sidebar_position: 37
description: "Why max+1 races, what a single-statement INSERT ... SELECT does and does not fix, the three real remedies, fractional positioning and how many midpoints binary64 actually survives, and why every ORDER BY needs a tiebreaker."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 documentation — [Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html), [Numeric Types](https://www.postgresql.org/docs/18/datatype-numeric.html), [`LIMIT` and `OFFSET`](https://www.postgresql.org/docs/18/queries-limit.html), [`INSERT`](https://www.postgresql.org/docs/18/sql-insert.html), [Advisory Locks](https://www.postgresql.org/docs/18/explicit-locking.html).
> Documentation-verified; **no sandbox run, no timings**. The binary64 midpoint bound below is arithmetic from the IEEE 754 significand width, stated as arithmetic and not as a measurement.
> Target: **Next.js 16.3.4** · **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · Node **24.20.0**.

**Of the eleven columns in the canonical `cards` table, `position` is the only one that is `NOT NULL`, has no default, and is not supplied by the client on a normal create. Something has to invent it, and the obvious invention — read the largest position on this board, add one — is a read-modify-write across two statements. PostgreSQL's default isolation level guarantees the second request reads the same maximum as the first, so both cards land on the same position. Nothing errors, nothing is logged, and the board's order becomes nondeterministic in a way that reproduces only under concurrency.**

## Why `max + 1` races

```ts
// 🔴 the obvious version, and it is wrong
async function nextPosition(boardId: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${cards.position}), 0)` })
    .from(cards)
    .where(and(eq(cards.boardId, boardId), isNull(cards.deletedAt)))
  return row.max + 1
}
```

PostgreSQL's Transaction Isolation chapter states the mechanism precisely:

> *"Read Committed is the default isolation level in PostgreSQL. When a transaction uses this isolation level, a SELECT query (without a FOR UPDATE/SHARE clause) sees only data committed before the query began; it never sees either uncommitted data or changes committed by concurrent transactions during the query's execution. In effect, a SELECT query sees a snapshot of the database as of the instant the query begins to run."*

Two creates arriving close together therefore run their `SELECT max(...)` against snapshots taken before either insert has committed. Both read the same maximum. Both compute the same next value. Both insert successfully, because nothing in the schema says two cards may not share a position.

🔴 **The failure is silent by construction.** There is no constraint to violate, so there is no SQLSTATE, no 409, and no log line. What you get is two rows with equal `position`, and the doc that explains what happens next is the one about `LIMIT`:

> *"When using LIMIT, it is important to use an ORDER BY clause that constrains the result rows into a unique order. Otherwise you will get an unpredictable subset of the query's rows."*

> *"using different LIMIT/OFFSET values to select different subsets of a query result will give inconsistent results unless you enforce a predictable result ordering with ORDER BY. This is not a bug; it is an inherent consequence of the fact that SQL does not promise to deliver the results of a query in any particular order"*

So the user-visible symptom is not "two cards at position 7". It is **the two cards swapping places between page loads**, and a bug report that says the board "shuffles sometimes".

## What a single statement does and does not fix

The natural first move is to collapse the read and the write into one statement:

```sql
INSERT INTO cards (board_id, title, position)
SELECT $1, $2, coalesce(max(position), 0) + 1024
  FROM cards
 WHERE board_id = $1
   AND deleted_at IS NULL
RETURNING id, position;
```

In Drizzle 0.45.2 the same thing, using the `sql` template so the subselect is parameterised rather than concatenated:

```ts
const [card] = await db
  .insert(cards)
  .values({
    boardId,
    title: input.title,
    body: input.body ?? null,
    status: input.status ?? 'todo',
    position: sql<number>`(
      select coalesce(max(${cards.position}), 0) + 1024
        from ${cards}
       where ${cards.boardId} = ${boardId}
         and ${cards.deletedAt} is null
    )`,
  })
  .returning(CARD_COLUMNS)
```

**This is a genuine improvement and it does not close the race.** The window narrows from "two network round trips" to "the duration of one statement", which is a large constant-factor reduction and nothing more. Under READ COMMITTED both statements still take their own snapshot, and neither sees the other's uncommitted row. Two simultaneous creates can still compute the same maximum.

⚠️ **Do not report this pattern as a fix.** It is worth doing — it removes a round trip and eliminates the much wider window where application code holds a stale maximum across an `await` — but a design that depends on it being atomic is a design that will produce duplicates at exactly the traffic level where it matters.

## The three remedies that actually close it

### 1 · A unique constraint, so the race becomes an error you can retry

```sql
CREATE UNIQUE INDEX cards_board_position_unique
  ON cards (board_id, position)
  WHERE deleted_at IS NULL;
```

Now the loser of the race gets `23505` instead of silently succeeding, and the mapping in [05ca](05ca-mapping-sqlstate-to-status-codes.md) turns a *known* constraint into a *retryable* outcome:

```ts
// lib/dal/cards.ts
const MAX_POSITION_ATTEMPTS = 3

export async function createCardAtEnd(boardId: string, input: CreateCardInput) {
  for (let attempt = 1; attempt <= MAX_POSITION_ATTEMPTS; attempt++) {
    try {
      return await insertWithComputedPosition(boardId, input)
    } catch (error) {
      const pg = asPgError(error)
      const lostTheRace =
        pg?.code === '23505' && pg.constraint === 'cards_board_position_unique'
      if (!lostTheRace || attempt === MAX_POSITION_ATTEMPTS) throw error
      // The next attempt recomputes max(position) and will see the winner's row.
    }
  }
  throw new Error('unreachable')
}
```

The retry is bounded, it is keyed on **one specific constraint** rather than on `23505` generally — retrying a duplicate-title violation would loop three times and still fail — and each attempt recomputes the maximum against a fresh snapshot, so it converges. 🔴 **The cost is real and you should know it before choosing this:** the unique index forbids two cards from sharing a position permanently, which means every drag-and-drop reorder that would transiently create a tie now needs its own handling, and a bulk import cannot insert a block of rows and renumber afterwards.

### 2 · An advisory lock on the board, so the creates serialise

```sql
-- inside a transaction; released automatically at COMMIT or ROLLBACK
SELECT pg_advisory_xact_lock(hashtext($1));
```

```ts
await db.transaction(async (tx) => {
  // Serialise position assignment per board. hashtext maps the board id to
  // the bigint the advisory-lock functions take.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${boardId}))`)
  const [{ max }] = await tx
    .select({ max: sql<number>`coalesce(max(${cards.position}), 0)` })
    .from(cards)
    .where(and(eq(cards.boardId, boardId), isNull(cards.deletedAt)))
  return tx.insert(cards).values({ boardId, title: input.title, position: max + 1024 })
    .returning(CARD_COLUMNS)
})
```

Concurrent creates on the *same* board queue; creates on different boards do not interact, because the lock key is derived from the board id. The transaction-scoped variant (`pg_advisory_xact_lock`) is the one to use, because it is released by `COMMIT` or `ROLLBACK` and cannot be leaked by a handler that returns early.

⚠️ **Two caveats, and the second is specific to this stack.** `hashtext` returns a 32-bit value, so two different board ids can share a lock key — harmless here, since a collision only means two unrelated boards briefly serialise, but not something to build on if the lock guarded correctness across tenants. And **session-level advisory locks do not work through a transaction-mode connection pooler**: the ch15 material on Neon's PgBouncer configuration lists session-level advisory locks among the features a pooled connection does not support. `pg_advisory_xact_lock` is scoped to the transaction and is therefore compatible with transaction pooling; `pg_advisory_lock` is not. Getting that distinction wrong produces a lock that appears to work in development and silently protects nothing in production.

### 3 · Give up on a total order and use a fractional index

If the product need is *drag a card between these two* rather than *append to the end*, the right structure is a value strictly between the neighbours:

```ts
/** The new position for a card dropped between `before` and `after`. */
function between(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0
  if (before === null) return after! - 1024   // dropped at the top
  if (after === null) return before + 1024    // dropped at the bottom
  return (before + after) / 2                 // dropped in the middle
}
```

This makes a reorder a **single-row update** rather than a renumbering of every card below the insertion point, which is the whole reason `position` is `double precision` rather than `integer` in the schema. It also removes the `max + 1` race for insertions in the middle, because the two neighbours are values the client already read and sent — though it introduces its own conflict, where two users drop cards into the same gap and both compute the same midpoint.

🔴 **The sparse-double scheme is defined here, on the create side, because this is where the value is first minted** — the spacing constant, the `between` midpoint, the binary64 bound below and the renormalisation statement are all stated once, in this chunk. What happens when a *move* collides rather than a create — why a tie between two reordered cards is usually harmless rather than a bug, and why a reorder is a move rather than a patch — is [07g · `position` and `updatedAt`](07g-position-collisions-and-updatedat.md), which builds on this section rather than restating it.

## How many midpoints a `double precision` column actually survives

The PostgreSQL numeric-types reference is explicit about what the column is:

> *"The data types `real` and `double precision` are inexact, variable-precision numeric types. On all currently supported platforms, these types are implementations of IEEE Standard 754 for Binary Floating-Point Arithmetic (single and double precision, respectively)"*

and the type table gives `double precision` as *"8 bytes, variable-precision, inexact, 15 decimal digits precision"*.

Binary64 has a 53-bit significand. Repeatedly taking the midpoint between the same pair of neighbours halves the gap each time, so after roughly **50 successive insertions into the same gap** the midpoint is no longer representable strictly between the endpoints and `(before + after) / 2` returns one of them. That is arithmetic on the significand width, not a measurement — but the practical consequence is concrete: a user who repeatedly drops cards into the same slot will, after a few dozen operations, create two cards with identical positions and no error.

**So a fractional index needs a renormalisation path**, and it needs it before you ship, not after a support ticket:

```sql
-- Renormalise one board to evenly spaced integers, preserving current order.
-- The id tiebreaker makes the ordering total, so the result is deterministic.
WITH renumbered AS (
  SELECT id, row_number() OVER (ORDER BY position, id) * 1024 AS new_position
    FROM cards
   WHERE board_id = $1
     AND deleted_at IS NULL
)
UPDATE cards
   SET position = renumbered.new_position
  FROM renumbered
 WHERE cards.id = renumbered.id;
```

Trigger it when a computed midpoint fails to be strictly between its neighbours — that is a cheap check on a value you already have, and it is a far better signal than a scheduled job guessing:

```ts
const mid = between(before, after)
if ((before !== null && mid <= before) || (after !== null && mid >= after)) {
  await renormaliseBoard(boardId)   // then recompute against the new neighbours
}
```

The wider spacing constant matters here too. Starting at `1024` rather than `1` buys ten free midpoints before any renormalisation is needed on freshly-appended cards, at no storage cost.

The same 53-bit bound governs the update path, where midpoints are consumed much faster than on create because every drag into an existing gap spends one — that is [07g](07g-position-collisions-and-updatedat.md), and the renormalisation statement above is the one it calls.

## Every `ORDER BY` on `position` needs a tiebreaker anyway

Whichever remedy you pick — including the unique index — the ordering has to be total, because `position` alone cannot be relied upon to be unique during a reorder, during an import, or in the window before a renormalisation runs:

```ts
// Always. The id is the tiebreaker that makes the order deterministic.
.orderBy(asc(cards.position), asc(cards.id))
```

The `LIMIT` reference is the authority for why: without an `ORDER BY` that *"constrains the result rows into a unique order"*, paginated reads can repeat a row on one page and skip it on the next, because the planner is free to return equal-ranked rows in any order and *"is very likely to get different plans (yielding different row orders) depending on what you give for LIMIT and OFFSET."* That is the same argument the pagination material in [06](06-read.md) makes for `(created_at, id)`, and it is the same reason the chapter's composite index carries `id` as its third column.

## Gotchas

**★ Symptom: two cards created within a second of each other share a position, and the board's order changes between refreshes.** Cause: `max(position) + 1` read in one statement and written in another; under READ COMMITTED both requests read the same snapshot and computed the same value, and no constraint objected. Fix: pick one of the three remedies above. The unique partial index plus a bounded retry is the smallest change; the advisory lock is the right one if reorders also need serialising.

**★ Symptom: moving the `max` subquery inside the `INSERT` "fixed" it in staging and it came back in production.** Cause: the single statement narrows the window to the statement's duration but does not make the read and write atomic under READ COMMITTED — two concurrent statements still take independent snapshots. Fix: do it anyway for the round trip it saves, but do not treat it as the remedy. Correctness needs the constraint, the lock, or a structure that does not depend on a global maximum.

**★ Symptom: the retry loop on `23505` spins three times and still fails, on a duplicate title.** Cause: the loop keyed on the SQLSTATE rather than on the constraint name, so it retried a violation that will never succeed. Fix: match `pg.constraint === 'cards_board_position_unique'` specifically, as the loop above does. A retry is only correct when the next attempt reads new state; a duplicate title reads the same state forever.

**★ Symptom: `pg_advisory_lock` protects nothing in production and works perfectly in development.** Cause: session-level advisory locks are among the features a transaction-mode pooler does not support, and the pooled connection string is production-only. Fix: use the transaction-scoped function, which is released by `COMMIT` and is compatible with transaction pooling:

```ts
// ❌ session-scoped: does not survive a transaction-mode pooler
await tx.execute(sql`select pg_advisory_lock(hashtext(${boardId}))`)
// ✅ transaction-scoped: released at COMMIT/ROLLBACK, pooler-safe
await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${boardId}))`)
```

**★ Symptom: after enough drag-and-drops into the same gap, two cards end up at exactly the same position.** Cause: binary64 has a 53-bit significand, so repeated halving of the same interval exhausts representable values after roughly fifty midpoints and `(before + after) / 2` returns an endpoint. Fix: detect it on the value you already computed — if the midpoint is not strictly between its neighbours, renormalise the board with the `row_number()` statement above and recompute. Do not wait for a scheduled job; the condition is free to check at the moment it occurs.

**★ Symptom: a card sorts to the bottom of every board and nobody can move it.** Cause: `NaN` reached the column, and PostgreSQL *"treats NaN values as equal, and greater than all non-NaN values"*, so it sorts last and every comparison against it behaves unlike IEEE 754. Fix: reject it at both ends — `z.number().finite()` at the boundary and the range `CHECK` in [05ca](05ca-mapping-sqlstate-to-status-codes.md). Note that the reflexive `CHECK (position = position)` does **not** work in PostgreSQL, for the same reason.

**★ Symptom: pagination repeats one card on page 2 and omits another.** Cause: `ORDER BY position` alone, with two cards sharing a position; the reference says an `ORDER BY` must *"constrain the result rows into a unique order"* or the subset returned is unpredictable. Fix: `ORDER BY position, id` on every query that also has a `LIMIT`. This is not optional even after you have added the unique index, because a reorder can transiently produce ties.

**★ Symptom: the first card on a brand-new board is created at position `1`, and a card dropped above it needs a position below `1` that keeps colliding.** Cause: the spacing constant was `1` rather than a wide value, so there is almost no room above the first row before midpoints exhaust. Fix: space by `1024` and start the first card at a value with room on both sides. The column is 8 bytes whatever number you put in it; wide spacing is free.

**★ Symptom: a bulk import of 500 cards produces 500 identical positions.** Cause: every row in the batch computed `max(position) + 1` against the same pre-import snapshot, because they were all in one statement or one transaction and none of them could see the others. Fix: assign positions in the statement rather than per row, using the window function that already knows the batch:

```sql
INSERT INTO cards (board_id, title, position)
SELECT $1, t.title,
       coalesce((SELECT max(position) FROM cards WHERE board_id = $1 AND deleted_at IS NULL), 0)
         + row_number() OVER (ORDER BY t.ord) * 1024
  FROM unnest($2::text[]) WITH ORDINALITY AS t(title, ord);
```

**★ Symptom: the soft-delete predicate was left out of `max(position)`, and new cards stack on top of deleted ones.** Cause: `max(position)` over all rows includes tombstones, so the maximum reflects cards nobody can see and the new card gets a position far past the visible end. It is not wrong exactly — order is preserved — but it makes the numbers meaningless and any renormalisation jumpy. Fix: `AND deleted_at IS NULL` in every position computation, exactly as in every read. This is the same predicate [06](06-read.md) argues is the easiest one in the codebase to forget.

## Interview questions

**★ Why does `SELECT max(position) + 1` then `INSERT` produce duplicates, when neither statement is wrong?**
Because they are two statements and PostgreSQL's default isolation puts a snapshot boundary between them. READ COMMITTED gives each `SELECT` a view *"as of the instant the query begins to run"*, and it never sees uncommitted rows, so two requests that both read before either commits necessarily read the same maximum and compute the same next value. The insert then succeeds for both, because nothing in the schema forbids a tie. What makes it nasty rather than merely wrong is that there is no error anywhere — no constraint, no SQLSTATE, no log line — so the only evidence is a board whose order changes between page loads, which arrives as a UI bug report weeks later and reproduces only under concurrency.

**★ You move the `max()` into the `INSERT` as a subquery. What have you actually improved?**
The window, by a large constant factor, and nothing about the guarantee. Collapsing two round trips into one statement removes the interval where your application code holds a stale maximum across an `await` — which on a serverless deployment can be milliseconds or, if the function is descheduled, considerably more. That is worth having. But under READ COMMITTED the statement still takes its own snapshot and still cannot see a concurrent uncommitted insert, so two statements executing simultaneously compute the same maximum exactly as before. The honest description is "a much smaller race", and the failure mode of describing it as a fix is that the duplicates reappear precisely at the traffic level where they matter most.

**★ Compare the unique-index-plus-retry remedy with the advisory lock. When would you choose each?**
The unique index is optimistic: it lets both requests proceed and turns the loser into a `23505` you catch and retry, so uncontended creates pay nothing at all and contended ones pay one extra round trip. That is the right shape when collisions are rare, which for appending to a board they usually are. Its cost is a permanent invariant — no two live cards on a board may ever share a position — which makes transient ties during a reorder or a bulk import illegal and forces you to handle them. The advisory lock is pessimistic: creates on the same board serialise, so there is no collision to retry and no invariant on the data, but every create on a busy board waits for the one before it and you have taken on a lock to reason about. I would default to the index and reach for the lock when reorders, imports and creates all need to agree on the same ordering, because at that point the lock is expressing a rule that a per-row constraint cannot.

**★ Why is a fractional index worth the complexity, and where does it break?**
It converts a reorder from an O(n) renumbering into a single-row update. Dropping a card between two others sets one `position` to the midpoint of its neighbours; nothing else changes, so a drag on a thousand-card board writes one row. That is the entire reason the column is `double precision` rather than `integer`. It breaks on precision: binary64 carries a 53-bit significand, so repeatedly halving the same interval runs out of representable values after around fifty insertions into the same gap, and the midpoint silently equals an endpoint. The fix is not a bigger type — it is a renormalisation pass triggered by the condition itself, checking that the computed midpoint really is strictly between its neighbours before using it, and rewriting the board to evenly spaced values when it is not. Starting with wide spacing buys you a lot of headroom for free, but it does not remove the need for the path.

**★ Why does `ORDER BY position` need a tiebreaker even after you have added a unique index on `(board_id, position)`?**
Because the index guarantees uniqueness at rest and your queries also run during writes. A reorder that shifts several cards, a bulk import that inserts a block before renumbering, or a migration that adds the index to a table that already contains ties — all of them produce moments where two rows compare equal on `position`, and the `LIMIT` reference is explicit that without an ordering that *"constrains the result rows into a unique order"* the subset returned is unpredictable, and different `LIMIT`/`OFFSET` values *"will give inconsistent results"*. The user-visible symptom is a row appearing twice across two pages, or vanishing entirely. Adding `id` as a second sort key costs nothing, is covered by the index you already have if you put it there, and makes the order total in every state the table can be in — which is also exactly the property keyset pagination requires.

**★ Which of the position remedies would you not use, and why?**
An `integer` position with a renumbering `UPDATE` on every reorder. It is the design people reach for first because the numbers stay tidy, and it makes a single drag write every row below the insertion point — hundreds of rows per interaction, each generating a new tuple version and index entries, on the exact interaction users perform most often on a board. It also makes the reorder a long-running write that conflicts with every concurrent read and write on that board, which converts a UI nicety into a lock-contention problem. The fractional index exists specifically to avoid this, and the cost it charges in return — an occasional renormalisation — is paid rarely and in the background rather than constantly and in the user's interaction path.

---

← [05e · Identifier choice](05e-client-supplied-ids-and-identifier-choice.md) · Next → [06 · READ](06-read.md)
