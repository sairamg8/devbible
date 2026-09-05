---
title: "A migration is not slow because the DDL is slow — it is dangerous because ALTER TABLE takes a lock that conflicts with everything including SELECT, and the documented behaviour of a conflicting request is to wait indefinitely, which is how a one-millisecond statement becomes a ten-minute outage"
sidebar_label: "02d · The lock it takes"
sidebar_position: 16
description: "ACCESS EXCLUSIVE and what it conflicts with, which ALTER TABLE forms rewrite and which do not, why ADD COLUMN NOT NULL with no default fails rather than blocks, NOT VALID and VALIDATE CONSTRAINT, CREATE INDEX CONCURRENTLY and why it cannot live in a normal migration, and lock_timeout as the thing that turns an outage into a retry."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 documentation — [`ALTER TABLE`](https://www.postgresql.org/docs/18/sql-altertable.html) (§ *Notes*), [Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html) (§ *Table-Level Locks*), [`CREATE INDEX`](https://www.postgresql.org/docs/18/sql-createindex.html) (§ *Building Indexes Concurrently*), [Client Connection Defaults](https://www.postgresql.org/docs/18/runtime-config-client.html) (`lock_timeout`, `statement_timeout`) and the [PostgreSQL 18 release notes](https://www.postgresql.org/docs/18/release-18.html).
> Target: **PostgreSQL 18.4** · `drizzle-kit` **0.31.10** · `pg` **8.23.0** · **Next.js 16.3.4**.
> Documentation-verified; **no sandbox run, no timings**. Every lock-mode and rewrite claim below is quoted from the PostgreSQL 18 reference.

**Most migration advice is about duration: avoid the operations that rewrite the table, because a rewrite of ten million rows takes minutes. That is true and it is the smaller half. The larger half is that `ALTER TABLE` takes `ACCESS EXCLUSIVE`, which conflicts with every other lock mode including the one a plain `SELECT` takes — so for however long the statement runs, nothing else may touch the table at all. A statement that completes in a millisecond is safe. A statement that has to *wait* for a lock is not, because the documented behaviour of a lock request is to wait indefinitely, and every reader arriving in the meantime is waiting behind it.**

## `ACCESS EXCLUSIVE`, quoted

> *"Conflicts with locks of all modes (`ACCESS SHARE`, `ROW SHARE`, `ROW EXCLUSIVE`, `SHARE UPDATE EXCLUSIVE`, `SHARE`, `SHARE ROW EXCLUSIVE`, `EXCLUSIVE`, and `ACCESS EXCLUSIVE`). This mode guarantees that the holder is the only transaction accessing the table in any way."*

> *"Many forms of `ALTER INDEX` and `ALTER TABLE` also acquire a lock at this level."*
> — [PostgreSQL 18 · Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html)

`ALTER TABLE` itself states the default:

> *"An `ACCESS EXCLUSIVE` lock is acquired unless explicitly noted. When multiple subcommands are given, the lock acquired will be the strictest one required by any subcommand."*
> — [PostgreSQL 18 · `ALTER TABLE`](https://www.postgresql.org/docs/18/sql-altertable.html)

That second sentence is the one people trip over: **a migration file that bundles four `ALTER TABLE` subcommands takes the strictest lock any of them needs, for the duration of all four.** Splitting them into separate statements does not make it better inside one transaction — a lock is *"normally held until the end of the transaction"* — but splitting them into separate *migrations* does.

And the reader's side:

> *"Conflicts with the `ACCESS EXCLUSIVE` lock mode only. The `SELECT` command acquires a lock of this mode on referenced tables."*

So `SELECT` and `ALTER TABLE` are mutually exclusive on the same table. There is no read-mostly exemption.

## The waiting problem, which is the actual outage

> *"So long as no deadlock situation is detected, a transaction seeking either a table-level or row-level lock will wait indefinitely for conflicting locks to be released."*
> — [PostgreSQL 18 · Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html)

Put the pieces together for a live `cards` table:

1. A long-running query — an analytics `SELECT`, a forgotten idle-in-transaction session, a `pg_dump` — holds `ACCESS SHARE`.
2. Your migration issues `ALTER TABLE cards …`, which needs `ACCESS EXCLUSIVE`, which conflicts. It waits, indefinitely.
3. Every subsequent request touching `cards` also waits.

Step 3 is where the outage comes from, and it is worth being precise about what is documented and what is not. **What the documentation states is step 2: a conflicting request waits indefinitely.** That alone is enough to justify the fix. That newly-arriving readers pile up *behind* the waiting DDL rather than being granted alongside the existing reader is the commonly-described behaviour of the lock manager, and I could not find it stated as a guarantee in the pages above — so treat it as the behaviour to design against rather than as a quoted rule. Either way the design response is identical, because a migration that waits indefinitely is unacceptable on its own.

**The fix is to refuse to wait.**

> *"Abort any statement that waits longer than the specified amount of time while attempting to acquire a lock on a table, index, row, or other database object. The time limit applies separately to each lock acquisition attempt… A value of zero (the default) disables the timeout."*
> — [PostgreSQL 18 · `lock_timeout`](https://www.postgresql.org/docs/18/runtime-config-client.html)

```sql
-- The first two lines of every migration that touches a live table.
SET lock_timeout = '3s';
SET statement_timeout = '30s';

ALTER TABLE cards ADD COLUMN archived_at timestamptz;
```

With `lock_timeout` set, the migration either gets the lock within three seconds or fails. A failed migration is a red deploy you retry in a quieter minute. A waiting migration is an outage that grows for as long as nobody notices.

⚠️ **`statement_timeout` must be larger than `lock_timeout` or it defeats it.** The documentation is explicit: *"if `statement_timeout` is nonzero, it is rather pointless to set `lock_timeout` to the same or larger value, since the statement timeout would always trigger first."* And *"Setting `lock_timeout` in `postgresql.conf` is not recommended because it would affect all sessions"* — so it goes in the migration, per session, not in the server config.

## Which `ALTER TABLE` forms rewrite, and which do not

This is the part where received wisdom is a version behind. The current rules, quoted:

> *"When a column is added with `ADD COLUMN` and a non-volatile `DEFAULT` is specified, the default value is evaluated at the time of the statement and the result stored in the table's metadata, where it will be returned when any existing rows are accessed. The value will be only applied when the table is rewritten, making the `ALTER TABLE` very fast even on large tables. If no column constraints are specified, NULL is used as the `DEFAULT`. In neither case is a rewrite of the table required."*

> *"Adding a column with a volatile `DEFAULT` (e.g., `clock_timestamp()`), a stored generated column, an identity column, or a column with a domain data type that has constraints will cause the entire table and its indexes to be rewritten. Adding a virtual generated column never requires a rewrite."*
> — [PostgreSQL 18 · `ALTER TABLE`](https://www.postgresql.org/docs/18/sql-altertable.html)

| Operation | Rewrites? | Scans? | Lock |
|---|---|---|---|
| `ADD COLUMN x text` | no | no | `ACCESS EXCLUSIVE`, brief |
| `ADD COLUMN x text DEFAULT 'todo'` | **no** — non-volatile default is stored in metadata | no | `ACCESS EXCLUSIVE`, brief |
| `ADD COLUMN x timestamptz DEFAULT clock_timestamp()` | **yes** — volatile default | — | `ACCESS EXCLUSIVE`, long |
| `ADD COLUMN x int GENERATED ALWAYS AS IDENTITY` | **yes** | — | `ACCESS EXCLUSIVE`, long |
| `ADD COLUMN x int GENERATED ALWAYS AS (…) STORED` | **yes** | — | `ACCESS EXCLUSIVE`, long |
| `ADD COLUMN x int GENERATED ALWAYS AS (…) VIRTUAL` | **no** — *"never requires a rewrite"* | no | `ACCESS EXCLUSIVE`, brief |
| `ADD CONSTRAINT … CHECK (…)` | no | **yes** | `ACCESS EXCLUSIVE`, for the scan |
| `ADD CONSTRAINT … CHECK (…) NOT VALID` | no | no | `ACCESS EXCLUSIVE`, brief |
| `VALIDATE CONSTRAINT …` | no | yes | **`SHARE UPDATE EXCLUSIVE`** |
| `DROP COLUMN x` | no | no | `ACCESS EXCLUSIVE`, brief |

🔴 **Note what is *not* in that table: `ADD COLUMN x text NOT NULL` with no default.** It does not rewrite and it does not block — **it fails**, on any table that has rows. The quoted rule says *"If no column constraints are specified, NULL is used as the `DEFAULT`"*, and NULL is exactly what a `NOT NULL` column cannot hold, so every existing row would violate the constraint the statement is adding. This is worth stating carefully because it is frequently taught as a long-blocking rewrite, and it is not: on an empty table it succeeds instantly, and on a populated one it errors out immediately. The genuinely dangerous form is the *volatile default*, which does rewrite, and which nobody warns you about because it looks identical.

Virtual generated columns are new and directly useful here:

> *"Allow generated columns to be virtual, and make them the default… Virtual generated columns generate their values when the columns are read, not written. The write behavior can still be specified via the `STORED` option."*
> — [PostgreSQL 18 release notes](https://www.postgresql.org/docs/18/release-18.html)

A derived column that would previously have meant a rewrite is now a metadata change, provided you accept the read-time cost.

## `NOT VALID` — the two-step constraint

Adding a `CHECK` to a populated table is a scan under the worst lock:

> *"Adding a `CHECK` or `NOT NULL` constraint requires scanning the table to verify that existing rows meet the constraint, but does not require a table rewrite. If a `CHECK` constraint is added as `NOT ENFORCED`, no verification will be performed."*

The escape is documented and it exists for exactly this reason:

> *"Scanning a large table to verify new foreign-key, check, or not-null constraints can take a long time, and other updates to the table are locked out until the `ALTER TABLE ADD CONSTRAINT` command is committed. The main purpose of the `NOT VALID` constraint option is to reduce the impact of adding a constraint on concurrent updates. With `NOT VALID`, the `ADD CONSTRAINT` command does not scan the table and can be committed immediately. After that, a `VALIDATE CONSTRAINT` command can be issued to verify that existing rows satisfy the constraint. The validation step does not need to lock out concurrent updates, since it knows that other transactions will be enforcing the constraint for rows that they insert or update; only pre-existing rows need to be checked. Hence, validation acquires only a `SHARE UPDATE EXCLUSIVE` lock on the table being altered."*
> — [PostgreSQL 18 · `ALTER TABLE`](https://www.postgresql.org/docs/18/sql-altertable.html)

Read the middle clause carefully, because it is the property that makes this safe rather than merely faster: **from the moment the `NOT VALID` constraint is added, new and updated rows are enforced.** The constraint is doing its job immediately; validation is only about the backlog.

So the title-length check from [02b](02b-constraints-are-the-first-validation-layer.md), on a live table, is two migrations:

```sql
-- migrations/0007_card_title_check_add.sql
SET lock_timeout = '3s';

ALTER TABLE cards
  ADD CONSTRAINT cards_title_len_chk
  CHECK (char_length(btrim(title)) BETWEEN 1 AND 200)
  NOT VALID;
```

```sql
-- migrations/0008_card_title_check_validate.sql
SET lock_timeout = '3s';
SET statement_timeout = 0;   -- the scan may legitimately take a while

ALTER TABLE cards VALIDATE CONSTRAINT cards_title_len_chk;
```

Two files, because they want different timeouts and because the second may need to be re-run. Between them, the constraint is enforced for everything new and unproven for everything old — which is a completely reasonable state to sit in for a day while you fix whatever the backlog contains.

PostgreSQL 18 extends the same treatment to `NOT NULL`:

> *"Allow `ALTER TABLE` to set the `NOT VALID` attribute of `NOT NULL` constraints"*
> — [PostgreSQL 18 release notes](https://www.postgresql.org/docs/18/release-18.html)

which removes one of the classic reasons a `NOT NULL` on an existing column had to be done as a `CHECK` first.

And 18 adds an escape hatch worth knowing about and using rarely:

> *"Allow `CHECK` and foreign key constraints to be specified as `NOT ENFORCED`"*

`NOT ENFORCED` means the constraint is declared and not checked at all. It documents intent and validates nothing, which is occasionally what you want for a constraint you intend to enforce later — and is never what you want for one you believe is protecting data.

## `CREATE INDEX CONCURRENTLY`, and why it cannot be in a normal migration

An ordinary `CREATE INDEX` locks out writes for the whole build. The concurrent form does not, and the price is stated in the reference:

> *"PostgreSQL supports building indexes without locking out writes. This method is invoked by specifying the `CONCURRENTLY` option of `CREATE INDEX`. When this option is used, PostgreSQL must perform two scans of the table, and in addition it must wait for all existing transactions that could potentially modify or use the index to terminate."*

> *"Regular index builds permit other regular index builds on the same table to occur simultaneously, but only one concurrent index build can occur on a table at a time. In either case, schema modification of the table is not allowed while the index is being built."*

> *"Another difference is that a regular `CREATE INDEX` command can be performed within a transaction block, but `CREATE INDEX CONCURRENTLY` cannot."*

> *"If a problem arises while scanning the table, such as a deadlock or a uniqueness violation in a unique index, the `CREATE INDEX` command will fail but leave behind an "invalid" index. This index will be ignored for querying purposes because it might be incomplete; however it will still consume update overhead."*
> — [PostgreSQL 18 · `CREATE INDEX`](https://www.postgresql.org/docs/18/sql-createindex.html)

Three consequences for a Drizzle migration:

1. **It cannot go in a migration file that the runner wraps in a transaction**, because a regular build *"can be performed within a transaction block, but `CREATE INDEX CONCURRENTLY` cannot"*. ⚠️ Whether `drizzle-kit` 0.31.10 offers a per-file opt-out of the wrapping transaction is not something I could settle from its published documentation; do not assume one exists. The arrangement that is safe regardless is to keep concurrent index builds out of the generated sequence entirely and run them as a named operational step.
2. **A failure leaves an invalid index behind**, which is not automatically cleaned up and which *"will still consume update overhead"* while being ignored by the planner. The recovery is `DROP INDEX` and retry — so a "did the index build?" check belongs beside the "did the migration run?" check from [02c](02c-the-migration-is-a-release-step.md).
3. **It needs `DIRECT_URL`.** Neon lists it explicitly among the operations that require a direct connection, for the same reason migrations do: it cannot be expressed in the unit a transaction-mode pooler multiplexes.

```sql
-- ops/2026-09-05-cards-live-index.sql — run manually against DIRECT_URL, not in the sequence.
-- Not in a transaction. Re-runnable because of IF NOT EXISTS.
CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_board_created_live_idx
  ON cards (board_id, created_at, id)
  WHERE deleted_at IS NULL;
```

## Gotchas

**★ Symptom: a migration that adds a nullable column took the site down for eleven minutes.** Cause: the `ALTER TABLE` itself was instant, and it waited for `ACCESS EXCLUSIVE` behind a long-running `SELECT` — and while it waited, nothing else could proceed. Fix: `SET lock_timeout` at the top of every migration touching a live table. The migration then fails fast and you retry; it never sits in the queue.

**★ Symptom: `lock_timeout` is set and the migration still hangs.** Cause: `statement_timeout` was set to the same or a smaller value, or `lock_timeout` was set after the statement began. The documentation says it directly — *"if `statement_timeout` is nonzero, it is rather pointless to set `lock_timeout` to the same or larger value, since the statement timeout would always trigger first"* — and the two must be set as separate statements before the DDL, in the same session.

**★ Symptom: `ADD COLUMN … NOT NULL` failed immediately and the team concluded the table was too big.** Cause: it is not a size problem. With no default, the implicit default is NULL — *"If no column constraints are specified, NULL is used as the `DEFAULT`"* — and NULL violates the constraint being added, so it errors regardless of how many rows there are. Fix: add the column nullable, backfill in batches, then add the `NOT NULL` (in PostgreSQL 18, `NOT VALID` first if the backfill is long). Or, if a default is genuinely correct for existing rows, add it with a **non-volatile** default in one statement, which does not rewrite.

**★ Symptom: `ADD COLUMN created_by_at timestamptz DEFAULT clock_timestamp()` rewrote a large table.** Cause: `clock_timestamp()` is volatile, and *"Adding a column with a volatile `DEFAULT`… will cause the entire table and its indexes to be rewritten."* Fix: use `now()`, which is non-volatile within a transaction and therefore stored in metadata, or add the column nullable and backfill.

**★ Symptom: a migration bundling five subcommands held a lock far longer than any one of them needed.** Cause: *"When multiple subcommands are given, the lock acquired will be the strictest one required by any subcommand"*, and a lock is held to the end of the transaction. Fix: one concern per migration file. The additional files cost nothing and each takes its lock for the shortest possible window.

**★ Symptom: `CREATE INDEX CONCURRENTLY` fails inside the migration runner with an error about transaction blocks.** Cause: it *"cannot be executed inside a transaction block"*, and migration runners wrap files in one by default. Fix: run concurrent index builds as an explicit operational step against `DIRECT_URL`, outside the generated sequence, with `IF NOT EXISTS` so a retry is safe.

**★ Symptom: an index exists, the planner ignores it, and rebuilding it works.** Cause: a previous `CREATE INDEX CONCURRENTLY` failed part-way and *"leave[s] behind an "invalid" index"*, which the planner will not use. Fix: drop it and rebuild. The broader fix is to check for invalid indexes as part of the same deploy verification that checks the migration ledger, because nothing else will tell you.

**★ Symptom: adding a `CHECK` to a busy table blocked writes for minutes.** Cause: *"Adding a `CHECK` or `NOT NULL` constraint requires scanning the table"*, and the scan happens under `ACCESS EXCLUSIVE`. Fix: two steps — `NOT VALID`, then `VALIDATE CONSTRAINT`, which *"acquires only a `SHARE UPDATE EXCLUSIVE` lock"*. New rows are enforced from the first step, so the window between them is not a hole.

**★ Symptom: a constraint was added `NOT ENFORCED` "to be safe" and bad rows appeared.** Cause: `NOT ENFORCED` is not a milder form of validation, it is the absence of it — *"If a `CHECK` constraint is added as `NOT ENFORCED`, no verification will be performed"*, and it is not enforced for new rows either. Fix: `NOT VALID` is the option that means "enforce from now on, verify the backlog later". `NOT ENFORCED` means "do not enforce". The names are close and the behaviours are opposite.

**★ Symptom: the migration ran fine in staging and locked in production.** Cause: staging has no long-running readers, so the `ACCESS EXCLUSIVE` request was granted instantly and the dangerous property — waiting — never manifested. Fix: assume every migration will contend, and set `lock_timeout` unconditionally. A migration whose safety depends on the table being idle is a migration with an untested failure path.

**★ Symptom: an idle-in-transaction session held the table hostage and nobody knew.** Cause: a connection that opened a transaction, read something, and never committed — a debugging session, or an application path that awaited an external call inside a transaction ([15 · 01b](../15-databases-apis-and-full-stack-patterns/01b-the-three-kinds-of-pool.md)). Its `ACCESS SHARE` lock is held *"until the end of the transaction"*, which is never. Fix: `idle_in_transaction_session_timeout` on the role, and the standing rule that no transaction ever awaits anything that is not the database.

## Interview questions

**★ Why is a fast `ALTER TABLE` still dangerous?**
Because the risk is not the duration of the statement, it is the duration of the *wait*. `ALTER TABLE` takes `ACCESS EXCLUSIVE`, which by definition *"conflicts with locks of all modes"* — including the `ACCESS SHARE` that every `SELECT` takes — and the documented behaviour of a conflicting request is that it *"will wait indefinitely for conflicting locks to be released"*. So one long-running reader, or one session that opened a transaction and wandered off, is enough to turn a millisecond of DDL into an unbounded stall on that table, and every request arriving during the stall is affected too. The remedy is not to make the statement faster; it is to make it refuse to wait, with `lock_timeout`.

**★ Does adding a column with a default rewrite the table?**
Not if the default is non-volatile, and that has been true for several major versions now. The reference states it plainly: the value *"is evaluated at the time of the statement and the result stored in the table's metadata, where it will be returned when any existing rows are accessed… making the `ALTER TABLE` very fast even on large tables"*. What *does* rewrite is a **volatile** default such as `clock_timestamp()`, or a stored generated column, an identity column, or a column whose domain type carries constraints. The trap is that the safe and the dangerous versions look identical in a diff — `DEFAULT now()` and `DEFAULT clock_timestamp()` differ by one word and by an entire table rewrite.

**★ What actually happens with `ADD COLUMN x text NOT NULL` and no default?**
It fails, immediately, on any table that has rows — it does not rewrite and it does not block. The mechanism is in one quoted sentence: *"If no column constraints are specified, NULL is used as the `DEFAULT`"*, and NULL is precisely what the `NOT NULL` being added forbids, so every existing row would violate it. This is worth knowing because the operation is widely taught as a long-blocking rewrite, and treating it that way sends people looking for a maintenance window when what they actually need is a different sequence: add the column nullable, backfill in batches, then add the constraint — and in PostgreSQL 18, `NOT VALID` first if the backfill will run long.

**★ Why is `NOT VALID` safe rather than merely faster?**
Because the constraint is enforced from the moment it is added; only the pre-existing rows are unverified. The reference spells out why validation can then take a weaker lock: *"validation… does not need to lock out concurrent updates, since it knows that other transactions will be enforcing the constraint for rows that they insert or update; only pre-existing rows need to be checked"*, so it takes `SHARE UPDATE EXCLUSIVE` rather than `ACCESS EXCLUSIVE`. That is the whole trick — you have split "stop new bad data" from "prove there is no old bad data", and only the second one is expensive. Sitting in that state for a day while you clean up the backlog is a legitimate operational position, not a hole.

**★ What is the difference between `NOT VALID` and `NOT ENFORCED`?**
They sound similar and they are opposites. `NOT VALID` means *enforce this from now on, and do not check the existing rows yet* — new and updated rows are constrained immediately. `NOT ENFORCED`, new in PostgreSQL 18, means the constraint is declared and *"no verification will be performed"* at all, for existing rows or for new ones; it is documentation with a catalogue entry. `NOT VALID` is the tool for adding a real constraint to a live table. `NOT ENFORCED` is for the case where you want the constraint recorded before you are ready to honour it, and using it in place of `NOT VALID` gives you the appearance of protection with none of the substance.

**★ Why can `CREATE INDEX CONCURRENTLY` not be part of an ordinary migration?**
Because it *"cannot be executed inside a transaction block"*, and migration runners wrap each file in one — that is how they get atomic rollback of a failed migration. The concurrent build works by making multiple passes over the table with other transactions running in between, which is fundamentally incompatible with being inside a single transaction. Two operational consequences follow. It has to be a separate, explicitly non-transactional step, run against the direct connection. And because *"a problem arises while scanning the table… will fail but leave behind an 'invalid' index"*, a failure is not self-cleaning: the index exists, the planner ignores it, and only an explicit check will tell you. Both of those are reasons to treat concurrent index builds as an operational task with its own verification rather than as a line in the migration sequence.

**★ Your migration is stuck. What do you look at, in what order?**
First, what is *blocking* it rather than what it is doing — the migration is almost certainly waiting, not working, so the interesting session is somebody else's. Look for the lock holder and, in particular, for a session that is idle in transaction, because that is the shape that holds `ACCESS SHARE` forever with no query to blame. Second, ask whether anything else is now queued behind the migration, since that is what turns a stall into an outage. Third — and this is the part that should have happened before the deploy — set `lock_timeout` so that this situation resolves itself into a failed migration in three seconds instead of a growing queue. The lasting fix is organisational rather than technical: no transaction awaits anything that is not the database, and `idle_in_transaction_session_timeout` is set on the role so that a forgotten session cannot hold a lock indefinitely.

---

← [02c · Migration as a release step](02c-the-migration-is-a-release-step.md) · Next → [02e · Expand and contract](02e-expand-and-contract.md)
