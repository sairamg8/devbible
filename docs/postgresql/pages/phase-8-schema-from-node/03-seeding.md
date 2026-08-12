---
title: "Seeding"
sidebar_label: "03 · Seeding"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex8-bulk-and-seed.mjs`,
> `ex2-ddl-edges.mjs`.

**A seed script runs more than once — on every developer machine, in CI on every
run, and once per replica at deploy. If running it twice is not identical to
running it once, it is not a seed script, it is a data-corruption script.**

## `ON CONFLICT DO NOTHING` is the whole technique

```js
const seed = `INSERT INTO seed_roles (slug, label)
              VALUES ('admin','Admin'), ('user','User')
              ON CONFLICT (slug) DO NOTHING`;
await pool.query(seed);   // run it three times
```

```console
$ node ex8-bulk-and-seed.mjs
=== 3. ON CONFLICT DO NOTHING vs a bare INSERT ===
run 1 rowCount: 2 | run 2: 0 | run 3: 0
rows in table: 2
ids: 1, 2
bare re-INSERT → 23505 seed_roles_slug_key
```

`rowCount` tells you exactly what happened: 2 inserted the first time, 0 thereafter.
The bare `INSERT` raises `23505` on the second run, which is why seed scripts
guarded by `try { … } catch {}` are so common — and why they hide real errors.

**`ON CONFLICT (slug)` requires a unique constraint on `slug`.** Without one you
get `42P10 there is no unique or exclusion constraint matching the ON CONFLICT
specification`. That is the mechanism doing its job: idempotency is enforced by the
database, not asserted by the script. A seed that "checks if it exists first" with a
`SELECT` is not idempotent — two processes can both see nothing and both insert.

### The gotcha: identity values are consumed anyway

```console
sequence last_value after 3 runs: 6 ← identity is consumed even when ON CONFLICT skips the row
```

Two rows, three runs, and the sequence is at **6**. `ON CONFLICT DO NOTHING`
evaluates the row — including drawing its identity value — and only then discovers
the conflict. The number is burned regardless.

This is harmless for correctness (sequences never promise gaplessness) but it
surprises people who expect id 3 for the next real row, and it matters if you have
built anything that assumes contiguous ids. It is also a reason not to run a seed
script in a hot loop against a table with an `int` (not `bigint`) identity.

## `DO NOTHING` versus `DO UPDATE`

The two answer different questions:

```sql
-- "make sure these rows exist" — never touches an existing row
ON CONFLICT (slug) DO NOTHING

-- "make these rows match this definition" — overwrites every run
ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label
```

Use `DO NOTHING` for rows a human may legitimately edit afterwards — a demo user
whose name someone changed should stay changed. Use `DO UPDATE` for reference data
the code depends on: status enums, feature flags, country lists. If the application
reads `label` and behaves differently based on it, the seed owns that value and
should reassert it.

`EXCLUDED` is the row that *would* have been inserted. It is the only way to reach
those values inside the conflict branch.

## Deterministic fixtures

A fixture that uses `Math.random()`, `Date.now()` or a faker without a fixed seed
produces a different database every run, which means a test that passes today can
fail tomorrow with no code change.

```js
// ✗ different every run — a flaky test generator
{email: `user${Math.random()}@x.com`, createdAt: new Date()}

// ✓ same every run
{email: 'user1@x.com', createdAt: '2026-01-01T00:00:00Z'}
```

Fix the timestamps too. `now()` in a fixture makes any test that asserts on dates,
sorting, or "created in the last 7 days" depend on when it runs. Pin the values, and
if the code needs "recent", compute it relative to a pinned clock rather than the
wall clock.

Generate volume with `generate_series` rather than a JavaScript loop — it is one
statement, it is deterministic, and it does not pay the round-trip cost from
[Bulk insert that scales](04-bulk-insert.md):

```sql
INSERT INTO bulk_users (email, name, score)
SELECT 'r' || g || '@x.com', 'N' || g, g % 100
  FROM generate_series(1, 10000) g;
```

## Seeding is not migration

Keep them separate, in separate files, run by separate commands.

| | Migrations | Seeds |
|---|---|---|
| Change the schema | yes | no |
| Run in production | yes | reference data only |
| Run more than once | no — recorded and skipped | yes, every time |
| Safe to edit after shipping | no | yes |

The one overlap is **reference data the schema depends on** — a `status` lookup
table with a foreign key pointing at it. That belongs in a migration, because a
later migration may add a constraint that assumes those rows exist. Demo users and
sample orders never belong in a migration.

## Concurrency: the reason the constraint matters

The measured failure from [Startup races](./01-ddl-from-node/03-startup-races.md) is
what a "check first, then insert" seed does under a rolling deploy:

```console
=== C. create-then-seed at boot, 20 workers ===
ok: 20 | failed: 0
rows in boot_seed after "idempotent" startup: 20
```

Twenty processes, twenty duplicate rows, **no errors**. Every one of them checked,
saw nothing, and inserted. `ON CONFLICT` on a real unique constraint is what makes
that impossible — the database resolves the race, because it is the only thing that
can see all twenty attempts.

## Trade-off

Idempotent seeds cost you a unique constraint on something meaningful — a natural
key like `slug` or `email`, not just the surrogate `id`. That is a schema decision
you may not otherwise have made, and it constrains what the data can hold.

The alternative, a seed that assumes an empty database, is simpler and only works
in one situation: a database you just created. Every CI run that reuses a container,
every developer running the script twice, and every multi-replica deploy breaks it.
The constraint is cheaper than the class of bug.

## Gotchas

**Symptom:** `23505 duplicate key` the second time the seed runs
**Cause:** A bare `INSERT` with no conflict handling.
**Fix:** `ON CONFLICT (col) DO NOTHING`. Do not wrap the insert in an empty
`catch` — it hides genuine failures too.

**Symptom:** `42P10 there is no unique or exclusion constraint matching the ON
CONFLICT specification`
**Cause:** `ON CONFLICT (slug)` with no unique constraint on `slug`.
**Fix:** Add the constraint. Without it there is nothing for the database to detect.

**Symptom:** Ids jump — the third seeded row gets id 7
**Cause:** `ON CONFLICT DO NOTHING` draws the identity value before detecting the
conflict. Measured: sequence at 6 after three runs inserting two rows.
**Fix:** Nothing to fix; sequences are not gapless. Do not build anything that
assumes contiguous ids.

**Symptom:** Duplicate seed rows, once per replica, no errors logged
**Cause:** A `SELECT`-then-`INSERT` guard, which cannot see concurrent inserters.
**Fix:** A unique constraint plus `ON CONFLICT` — let the database arbitrate.

**Symptom:** A test passes locally and fails in CI, or passes today and fails
tomorrow
**Cause:** Fixtures built from `Math.random()`, `now()` or an unseeded faker.
**Fix:** Pin every value including timestamps; derive "recent" from a fixed clock.

**Symptom:** A seed edit does not take effect on an existing database
**Cause:** `DO NOTHING` leaves existing rows untouched by design.
**Fix:** `DO UPDATE SET col = EXCLUDED.col` for data the seed owns.

**Symptom:** Seeding takes 20 seconds
**Cause:** A per-row loop.
**Fix:** `generate_series` in SQL, or `unnest` — see
[Bulk insert that scales](04-bulk-insert.md).

## Interview questions

**★ What makes a seed script idempotent, and how do you prove it?**
`ON CONFLICT (natural_key) DO NOTHING` on top of a real unique constraint. Prove it
by running it three times and reading `rowCount` — measured 2, 0, 0, with two rows
in the table. Idempotency has to be enforced by the constraint; a `SELECT` guard
only looks idempotent until two processes run at once.

**★ `DO NOTHING` or `DO UPDATE` — how do you choose?**
`DO NOTHING` for rows a human may legitimately edit afterwards; `DO UPDATE SET col
= EXCLUDED.col` for reference data the code depends on, so every run reasserts the
correct value. `EXCLUDED` is the row that would have been inserted.

**★ Why do the ids skip when a seed runs repeatedly?**
`ON CONFLICT DO NOTHING` still evaluates the row and draws its identity value
before the conflict is detected, so the number is consumed either way. Measured:
after three runs seeding two rows, the sequence's `last_value` was 6. Sequences
have never guaranteed gaplessness.

**★ Why isn't "check whether it exists, then insert" good enough?**
It has a race between the check and the insert. Measured with 20 concurrent
workers: all 20 checked, all 20 saw nothing, all 20 inserted — 20 duplicate rows
and zero errors. Only a unique constraint can arbitrate, because only the database
sees all the attempts.

**★ What belongs in a migration versus a seed?**
Schema changes and reference data that later migrations or constraints depend on go
in migrations — they run once, are recorded, and must not be edited after shipping.
Demo and test data goes in seeds, which run repeatedly and are safe to edit.

**Why are non-deterministic fixtures a problem rather than a nicety?**
They make the database different on every run, so a test can pass today and fail
tomorrow with no code change — and the failure is unreproducible because the input
that caused it is gone. Pinned values make failures repeatable.

---

← [Migrations](02-migrations.md) · Next → [Bulk insert that scales](04-bulk-insert.md)
