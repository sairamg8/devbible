---
title: "Two columns on the cards table are updated by mechanisms rather than by clients — position, which two people can legally set to the same value, and updatedAt, which must be the server's clock or it is worthless as an audit field"
sidebar_label: "07g · position and updatedAt"
sidebar_position: 56
description: "Why a tie in position is not corruption and a unique constraint on it is, why the move path is what exhausts float precision and how renormalisation recovers, why reordering is a move not a patch, and the three ways to maintain updatedAt with the trigger written out."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 manual — [8.1.3. Floating-Point Types](https://www.postgresql.org/docs/18/datatype-numeric.html), [F.41.4. `moddatetime`](https://www.postgresql.org/docs/18/contrib-spi.html), [`CREATE TRIGGER`](https://www.postgresql.org/docs/18/sql-createtrigger.html), [13.2.1 Read Committed](https://www.postgresql.org/docs/18/transaction-iso.html).
> Documentation-verified; **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · **Next.js 16.3.4** · Node **24.20.0**.

**`position` and `updatedAt` sit in the same table as `title` and `status` and are not the same kind of column. `position` is written by clients but its *value* is computed from other rows, which makes every reorder a read-modify-write and therefore a lost-update candidate in the sense of [07c](07c-the-lost-update.md) — except that here a collision is often harmless and forcing uniqueness costs more than it saves. `updatedAt` is written by nobody: a client-supplied value is unverifiable, a client's clock is wrong, and an `updated_at` you cannot trust is worse than no column at all because people build sync logic on it. This page settles both.**

## The scheme belongs to 05ea; this page is what a *move* does to it

`position` is `double precision`, appended cards are seeded `max(position) + 1024`, and a card dropped between two neighbours takes their midpoint. 🔴 **That scheme is defined once, on the create side, in [05ea · the `position` value](05ea-the-position-value-and-concurrent-creates.md)** — the spacing constant, the `between` midpoint, why an integer rank is the wrong shape, the binary64 bound, the renormalisation statement, and the three remedies for two concurrent creates computing the same maximum. None of it is re-derived here, because two statements of one scheme drift.

What that page hands to this one is a single fact with consequences for every update: **`position` is neither unique nor dense.** 05ea's collision is a create racing a create — two `SELECT max(...)` statements reading the same snapshot under Read Committed. The rest of the problem is on the write path, and it is this page: what a tie *means* once it exists, what happens when two people drag cards into the same gap, why a reorder must not be expressed as a patch at all, and what every one of those writes owes `updatedAt`.

## A position collision is usually not a bug

Two cards with `position = 3072` on the same board is a *tie*, not corruption. The question is only whether your ordering is deterministic when it happens, and it is — if you order by a tiebreaker:

```ts
// lib/dal/cards.ts — the read that makes ties harmless
await db.select().from(cards)
  .where(and(eq(cards.boardId, boardId), isNull(cards.deletedAt)))
  .orderBy(asc(cards.position), asc(cards.createdAt), asc(cards.id))
```

`(position, createdAt, id)` is a total order because `id` is unique. Two clients see the same sequence, a refresh does not shuffle the list, and pagination does not skip or repeat a row. **Without the tiebreaker, ties make the order non-deterministic across queries, and that is the actual bug people diagnose as "the board jumps around".**

🔴 **Do not put a unique constraint on `(board_id, position)` if the board supports drag-and-drop.** It converts a harmless tie into a failed request, makes every reorder a potential 409, and forces the shift-everything-after-it algorithm the float was chosen to avoid. ⚠️ [05ea](05ea-the-position-value-and-concurrent-creates.md) offers that same partial unique index as its first create-side remedy, and names this as its cost — the index turns the silent create race into a `23505` you can retry, at the price of making transient ties illegal forever. The two pages are not in disagreement about the mechanism; they are weighing it for different write paths, and a board whose primary interaction is dragging cards is the case where the price is too high. Decide once, for the whole table.

If you genuinely need a canonical dense order — for an export, or a numbered display — compute it at read time and leave the stored value alone:

```sql
SELECT id, title,
       row_number() OVER (ORDER BY position, created_at, id) AS rank
  FROM cards
 WHERE board_id = $1 AND deleted_at IS NULL;
```

## Precision runs out on the move path, not the create path

[05ea](05ea-the-position-value-and-concurrent-creates.md) states the budget from the type — binary64's 53-bit significand gives roughly fifty successive midpoints in one gap before `(a + b) / 2` returns an endpoint, which is arithmetic on the significand width and not a measurement. It is not restated here.

What is this page's business is *who spends them*. An append consumes no midpoint at all; only a card dropped **between** two neighbours does, and every drag into an existing gap spends exactly one. So on a board a team reorders all day, exhaustion arrives through the update path or it does not arrive at all — which is why the check belongs inside the function that computes a move, not in a scheduled job. The manual also warns, in the same numeric-types section 05ea quotes, that *"comparing two floating-point values for equality might not always work as expected"*, which is why the test below is a gap threshold rather than `a === b`:

```ts
// lib/dal/positions.ts
const MIN_GAP = 1e-6

export async function positionBetween(tx: Tx, boardId: string,
                                      before: number | null, after: number | null) {
  if (before === null && after === null) return 1024
  if (before === null) return after! - 1024
  if (after === null) return before + 1024
  if (after - before > MIN_GAP) return (before + after) / 2
  await renormalize(tx, boardId)          // gap exhausted — rebuild, then retry
  return null                             // caller re-reads the neighbours
}

/** Rewrite every position on one board to 1024, 2048, 3072 … Rare, and bounded. */
export async function renormalize(tx: Tx, boardId: string) {
  await tx.execute(sql`
    WITH ranked AS (
      SELECT id, row_number() OVER (ORDER BY position, created_at, id) AS n
        FROM cards
       WHERE board_id = ${boardId} AND deleted_at IS NULL
    )
    UPDATE cards c
       SET position = ranked.n * 1024, version = c.version + 1, updated_at = now()
      FROM ranked
     WHERE c.id = ranked.id
  `)
}
```

`renormalize` is [05ea](05ea-the-position-value-and-concurrent-creates.md)'s `row_number()` renumbering statement with two additions the update path needs, and both are worth naming. It bumps `version` on every row it touches, so any client holding an open editor gets a 409 rather than writing a position computed against the old scale — the alternative is a silent reordering. And it runs inside the caller's transaction, so a reader either sees the whole old scale or the whole new one.

⚠️ **`renormalize` rewrites every card on a board.** On a board with thousands of cards that is a long transaction holding many row locks, which is [09f](09f-transaction-duration-as-pool-occupancy.md)'s cost. It is acceptable because it is rare; it stops being acceptable if a bug makes it frequent, so count it.

## Reordering is a move, not a patch

`PATCH {"position": 3072}` is a lie about what the client meant. The client did not decide on the number 3072 — it decided *"put this card after card X"*, and 3072 was its guess at what that meant given the list it had rendered. If the list moved, the number is wrong and the card lands somewhere nobody chose.

**Express the intent, let the server compute the number:**

```ts
// app/api/cards/[cardId]/move/route.ts
const MoveBody = z.strictObject({
  boardId: z.uuid(),
  afterCardId: z.uuid().nullable(),    // null = first in the column
  beforeCardId: z.uuid().nullable(),   // null = last in the column
  version: z.number().int().positive(),
})
```

The server locks the two neighbours, computes the midpoint, and writes — which is the `insertCardBetween` shape in [07f](07f-pessimistic-locking-and-when-it-is-right.md), and one of the three cases where a row lock is the right tool. If the neighbours have themselves moved, the server can still produce a sensible answer, because it is working from the ids the user pointed at rather than from a stale coordinate.

## `updatedAt` — three mechanisms, one rule

🔴 **The rule: `updated_at` is the server's clock, always, and a client-supplied value is never written.** A client's clock can be wrong by hours, is trivially forged, and — because the value is usually used to drive "what changed since I last synced" — a single bad value silently drops rows out of every subsequent sync. If a client needs to record when *it* believes something happened, that is a different column with a different name.

### 1 · Application-set, in the DAL

```ts
set.updatedAt = sql`now()`     // the database's clock, not Node's
```

``sql`now()` `` rather than `new Date()` matters: `now()` is the transaction's start time on the database server, so every row written in one transaction gets the same value and no application server's clock skew is involved.

**Cost:** every write path must remember. One `db.update` that forgets leaves a stale timestamp, and nothing errors.

### 2 · A trigger, so forgetting is impossible

```sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cards_set_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
```

Now a manual `UPDATE` in `psql`, a migration, an admin tool and a forgotten code path all maintain it. **Cost:** the value is no longer visible in the ORM's returned row unless you use `RETURNING` (which the DAL already does), and a bulk maintenance update now bumps `updated_at` on every row it touches — which may be exactly what you did not want. Guard it if so:

```sql
CREATE TRIGGER cards_set_updated_at
  BEFORE UPDATE ON cards
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)     -- no-op updates do not bump the clock
  EXECUTE FUNCTION set_updated_at();
```

### 3 · The contrib trigger, if you would rather not own the function

PostgreSQL ships one:

> *"`moddatetime()` is a trigger that stores the current time into a timestamp field. This can be useful for tracking the last modification time of a particular row within a table. To use, create a `BEFORE UPDATE` trigger using this function. Specify a single trigger argument: the name of the column to be modified. The column must be of type `timestamp` or `timestamp with time zone`."*
> — [PostgreSQL 18 · F.41.4](https://www.postgresql.org/docs/18/contrib-spi.html)

```sql
CREATE EXTENSION IF NOT EXISTS moddatetime;
CREATE TRIGGER cards_moddatetime
  BEFORE UPDATE ON cards
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

⚠️ It needs `CREATE EXTENSION`, which not every managed provider grants on every plan. Check before designing around it; a nine-line plpgsql function has no such dependency.

**Which to pick.** Trigger, if you have any write path outside the DAL — migrations, admin scripts, a data-fix console. Application-set, if the DAL is genuinely the only writer *and* you want the flexibility of deciding per statement whether a write counts as a modification. Doing both is fine and is not redundant: the trigger is the floor, the explicit `set` is documentation.

## Gotchas

**★ Symptom: the board's card order changes between refreshes with nobody editing.** Cause: two cards share a `position` and the query orders by `position` alone, so the tie is broken by whatever the planner happens to produce. Fix: order by a total order — `ORDER BY position, created_at, id` — which makes ties deterministic and costs nothing.

**★ Symptom: dragging a card into a specific gap sometimes drops it in a different place.** Cause: the client sent a computed `position` number derived from the list it had rendered, and the list changed. Fix: send the intent instead of the coordinate — `afterCardId` and `beforeCardId` — and let the server compute the number from the rows as they are now.

**★ Symptom: after many reorders, two cards become impossible to separate.** Cause: repeated halving exhausted `double precision`, so `(a + b) / 2` now equals `a` — the bound is [05ea](05ea-the-position-value-and-concurrent-creates.md)'s fifty-midpoint figure, reached here because moves are what spend midpoints. Fix: detect the exhausted gap and renormalise the board, as `positionBetween` does — and bump `version` on every renormalised row so open editors get a conflict instead of writing against the old scale.

**★ Symptom: adding `UNIQUE (board_id, position)` turned reordering into a stream of 409s.** Cause: the constraint makes a benign tie into a failed write, and every insertion between neighbours now risks colliding with a concurrent one. Fix: drop the constraint and use the tiebreaker ordering. If a dense canonical rank is genuinely required, compute it at read time with `row_number()` rather than storing it.

**★ Symptom: two cards appended at the same moment land on the same position.** Cause: the create-side race — both `max(position)` reads took snapshots before either insert committed. That mechanism and its three remedies are [05ea](05ea-the-position-value-and-concurrent-creates.md)'s. What belongs here is the answer once the tie exists: accept it, because the `(position, created_at, id)` tiebreaker above makes it invisible, or, if append order must be strictly serialised, lock the board row first — the pattern in [07f](07f-pessimistic-locking-and-when-it-is-right.md).

**★ Symptom: a sync client stops receiving changes for a subset of rows and never recovers.** Cause: a client-supplied `updatedAt` was written with a clock that was ahead, so the row's timestamp is in the future and every subsequent `WHERE updated_at > $lastSync` skips it — permanently. Fix: never accept the field from a client. Strip it at the schema boundary and set it in SQL:

```ts
export const CardPatch = z.strictObject({
  title: z.string().min(1).max(200).optional(),
  // no updatedAt, no createdAt, no version, no id — these are not client fields
})
```

**★ Symptom: `updated_at` is stale on rows changed by a migration or an admin script.** Cause: only the DAL sets it. Fix: the `BEFORE UPDATE` trigger above, which no write path can bypass — including `psql`.

**★ Symptom: a maintenance job that changed nothing bumped `updated_at` on the whole table, and every client re-synced everything.** Cause: an unconditional trigger fires on any `UPDATE`, including one that writes identical values. Fix: `WHEN (OLD.* IS DISTINCT FROM NEW.*)` on the trigger, so a no-op update does not move the clock.

**★ Symptom: rows written in one transaction have `updated_at` values microseconds apart, and a "changed together" query misses some.** Cause: the timestamps came from `new Date()` in application code, evaluated per statement. Fix: use `now()` in SQL — it returns the transaction start time, so every row written in one transaction shares a value, which is exactly what makes "changed in the same operation" answerable.

**★ Symptom: `updated_at` is `timestamp` without a time zone and comparisons across deployments disagree.** Cause: the column stores a wall-clock reading with no offset, so its meaning depends on the session's `TimeZone`. Fix: the chapter's schema already uses `timestamp('updated_at', { withTimeZone: true })`, which stores an absolute instant; changing an existing column is a migration and belongs to [02c · The migration is a release step](02c-the-migration-is-a-release-step.md).

## Interview questions

**★ Why is a float position better than an integer rank?**
Because inserting between two rows costs one write instead of rewriting every row after the insertion point. A contiguous integer rank makes a single drag into an `UPDATE` of up to the whole column — every one of those rows locked, versioned and written — while a float lets the server average two neighbours and touch exactly one row. The price is that positions are not dense and are not unique, which is fine as long as the read query carries a tiebreaker.

**★ Two cards end up with the same position. Is that a bug?**
Not by itself. It is a tie, and a tie is only a problem if the order is non-deterministic, which is a property of your `ORDER BY`, not of the data. Ordering by `(position, created_at, id)` makes the sequence total and stable, so the two cards always appear in the same relative order to every client. Enforcing uniqueness instead converts a harmless tie into a failed write and drags you back to shifting every subsequent row.

**★ What actually breaks when float precision runs out, and how do you recover?**
`(a + b) / 2` stops producing a value strictly between `a` and `b` and returns one of them, so the "inserted" card lands on top of a neighbour rather than between it. Recovery is to renormalise the board — rewrite every position to a fresh 1024, 2048, 3072 scale in one transaction — and to bump the version on every row you touch, so any client holding an editor gets a conflict rather than writing a position computed against the old scale.

**★ Why should a reorder endpoint take neighbour ids rather than a position number?**
Because the number is the client's inference from a list that may have changed, while the ids are what the user actually pointed at. If the neighbours moved, a coordinate puts the card somewhere nobody chose, whereas ids let the server recompute the right value from the rows as they exist at write time. It also means the server owns the position scheme entirely, so switching from floats to something else later is not a client-visible change.

**★ Why must `updated_at` never come from the client?**
Because it is unverifiable and load-bearing. A client clock that is ahead writes a future timestamp, and every subsequent incremental sync using `WHERE updated_at > $since` skips that row forever — a silent, permanent data-visibility bug caused by one bad value. It is also trivially forged, so anything using it for auditing or conflict resolution is trusting the party with the most reason to lie.

**★ Trigger or application code for `updated_at`?**
Trigger, if there is any write path outside the Data Access Layer — and there always is eventually: a migration, an incident fix in `psql`, an admin console. A trigger cannot be forgotten. The cost is that a bulk update touching many rows bumps the timestamp on all of them, which you defuse with `WHEN (OLD.* IS DISTINCT FROM NEW.*)` so a no-op write does not move the clock. Setting it explicitly in the DAL as well is not redundant; it documents intent at the call site and lets one statement deliberately opt out.

**★ Why ``sql`now()` `` rather than `new Date()`?**
Because `now()` is evaluated on the database server at the transaction's start, so it is immune to application-server clock skew and gives every row written in one transaction the same value. `new Date()` is per-statement and per-process, which means rows written together get slightly different timestamps and a query for "everything changed by that one operation" cannot be written reliably.

---

← [07f · Pessimistic locking](07f-pessimistic-locking-and-when-it-is-right.md) · [Chapter 16 overview](01-explanation.md) · Next → [08 · DELETE — hard vs soft](08-delete.md)
