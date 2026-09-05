---
title: "A test that prescribes an exact schedule demonstrates a bug, and a test that asserts an invariant refuses to break under any schedule — they are different instruments, the second one is the one usually missing, and neither may ever assert that something took time"
sidebar_label: "12ia · Invariants and blocking"
sidebar_position: 65
description: "Asserting exactly-one-succeeds without prescribing a winner, why Promise.all does not guarantee overlap, a fully deterministic blocking test built on FOR UPDATE NOWAIT and 55P03, SKIP LOCKED as the other answer, and the concurrent-append race on a sparse position."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 documentation — [`SELECT` · The Locking Clause](https://www.postgresql.org/docs/18/sql-select.html), [§13.3 Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html), [§8.1.3 Floating-Point Types](https://www.postgresql.org/docs/18/datatype-numeric.html) and [Appendix A · Error Codes](https://www.postgresql.org/docs/18/errcodes-appendix.html) — and [RFC 9110 §15.5.13](https://www.rfc-editor.org/rfc/rfc9110.txt), fetched as raw text. Documentation-verified; **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · `pg` **8.23.0** · Vitest **5.0.0** · Node **24.20.0**.

**[12i](12i-forcing-the-interleaving.md) built a gate and used it to prescribe an exact schedule, which is the right instrument when the goal is to *demonstrate* a specific failure. It is the wrong instrument for the three claims on this page, and using it anyway is how a concurrency suite becomes fragile. "Exactly one of two conditional updates succeeds" is not a statement about an order — it must hold under every order — so a test that pins one is testing less than the contract says while acquiring a way to flake. "A locked row is unavailable to a second session" looks like it needs a sleep, and does not, because PostgreSQL offers a documented way to turn a wait into an immediate named error. And "two concurrent appends do not collide on `position`" is a claim about a computation whose correctness the chapter asserted and never proved. All three use the machinery from the previous page and none of them prescribe a schedule.**

## Assert the invariant, not the winner

Two clients send `PATCH` with the same `If-Match`. What you want to know is that **exactly one succeeds** — never which one.

```ts
// test/concurrency/conditional-update.test.ts
it('exactly one of two concurrent conditional updates succeeds', async () => {
  const card = await seedCommittedCard({ title: 'original' })
  const etag = `"c-${card.id}-1"`

  const [x, y] = await Promise.all([
    patchViaHandler(card.id, { title: 'X' }, { 'if-match': etag }),
    patchViaHandler(card.id, { title: 'Y' }, { 'if-match': etag }),
  ])

  const statuses = [x.status, y.status].sort()
  expect(statuses).toEqual([200, 412])                 // 🔴 not "x wins"

  const final = await readRowDirectly(card.id)
  expect(final.version).toBe(2)                        // exactly one write landed
  expect(['X', 'Y']).toContain(final.title)
})
```

**This is the more valuable of the two test styles and it is the one usually missing.** It has no ordering assumption, so it cannot flake on scheduling; it fails only when the invariant is genuinely broken. Both realistic breakages are caught by two assertions:

| Breakage | What the test sees |
|---|---|
| the version guard is removed | both `200`, `version` becomes 3 |
| the zero-rows-to-`412` mapping is broken | both `412`, `version` stays 1 |
| the guard compares against a value the caller did not read | both `200` or both `412`, and `version` is wrong either way |

⚠️ **`Promise.all` does not guarantee overlap.** It starts both, but if the first completes before the second's first statement reaches the server, they ran sequentially and the test still passes vacuously. That is acceptable *here* precisely because the assertion is an invariant — it holds under both schedules — but it means this style cannot **demonstrate** a race, only refuse to break under one.

🔴 **Use gates when the point is the demonstration and `Promise.all` when the point is the invariant, and never describe a `Promise.all` test as proving a race.** A suite that confuses the two ends up with a file of `Promise.all` tests that a reader believes are exercising contention and which, on a fast machine with a warm connection, may never overlap at all.

## Blocking, asserted without a single duration

[07f](07f-pessimistic-locking-and-when-it-is-right.md) argues for `SELECT … FOR UPDATE` where the work between read and write is genuinely serial. Testing "B blocks until A commits" looks like it needs a sleep. It does not — the locking clause has a documented non-blocking form.

> *"With `NOWAIT`, the statement reports an error, rather than waiting, if a selected row cannot be locked immediately."*
> — [PostgreSQL 18 · `SELECT`, The Locking Clause](https://www.postgresql.org/docs/18/sql-select.html)

```ts
// test/concurrency/pessimistic-lock.test.ts
it('a row locked FOR UPDATE is not available to a second session', async () => {
  const card = await seedCommittedCard({ title: 'original' })
  const aHasLocked = gate()
  const bHasTried = gate()

  const a = session(async (c) => {
    await c.query('BEGIN')
    await c.query('SELECT * FROM cards WHERE id = $1 FOR UPDATE', [card.id])
    aHasLocked.open()
    await bHasTried.wait()
    await c.query('COMMIT')
  })

  const b = session(async (c) => {
    await aHasLocked.wait()
    const err = await c.query('SELECT * FROM cards WHERE id = $1 FOR UPDATE NOWAIT', [card.id])
      .then(() => null, (e) => e as { code?: string })
    bHasTried.open()                                   // gate first, assert later
    return err
  })

  const [, bErr] = await Promise.all([a, b])
  expect(bErr?.code).toBe('55P03')                     // lock_not_available — no sleep
})
```

`55P03 lock_not_available` is in the error-code appendix, so the assertion is on a documented, stable value. **This is the pattern for every blocking assertion in the suite: never assert that something took time; assert that a non-blocking variant reported unavailability.** Where a statement has no `NOWAIT` form — a plain `UPDATE`, an `ALTER TABLE` — a small `lock_timeout` on the test role ([12h](12h-parallel-workers-against-one-postgres.md)) produces the same shape, converting the wait into a bounded, named error.

### The sibling clause, and why it is a different test

> *"With `SKIP LOCKED`, any selected rows that cannot be immediately locked are skipped."*

`SKIP LOCKED` never errors; it returns fewer rows. So a test written against `SKIP LOCKED` asserts a **row count**, not an error code:

```ts
// two consumers of a work queue must not both claim the same row
const [claimedByA, claimedByB] = await Promise.all([claimOneCard(board.id), claimOneCard(board.id)])
expect(claimedByA!.id).not.toBe(claimedByB!.id)
```

The manual is candid that this is a narrow tool — it notes `SKIP LOCKED` gives an inconsistent view of the data and is unsuitable for general-purpose work, while being useful to avoid lock contention among multiple consumers of a queue-like table. If your DAL uses it anywhere other than a queue claim, that is worth a second look before it is worth a test.

## Two concurrent appends racing for a `position`

[05ea](05ea-the-position-value-and-concurrent-creates.md) computes a new card's position from the board's current contents, which is a read-modify-write with a different shape from the update: both sessions read the same maximum and both write a value derived from it. Whether the mitigation chosen there actually works is a claim the chapter asserted and never demonstrated.

```ts
// test/concurrency/position-race.test.ts
it('two concurrent appends do not produce two cards at the same position', async () => {
  const board = await seedCommittedBoard()

  await Promise.all([
    createCardAtEnd(board.id, { title: 'first' }),
    createCardAtEnd(board.id, { title: 'second' }),
  ])

  const rows = await db.select().from(cards).where(eq(cards.boardId, board.id))
  const positions = rows.map((r) => r.position)
  expect(rows).toHaveLength(2)
  expect(new Set(positions).size).toBe(positions.length)      // no collision
  expect(positions.every(Number.isFinite)).toBe(true)         // no NaN, no Infinity
})
```

Two notes on the assertions. `new Set(positions).size` is the collision check and it is exact — no tolerance, no ordering assumption. `Number.isFinite` is there because PostgreSQL treats `NaN` as *"equal, and greater than all non-`NaN` values"* in a `double precision` column, so a corrupt position sorts silently to the end rather than raising anything, and this is the only place the suite would notice.

🔴 **If your design accepts occasional collisions and relies on the `id` tiebreaker instead, invert the assertion and say so explicitly**, so the file records the decision:

```ts
it('accepts position collisions and keeps a total order via the id tiebreaker', async () => {
  await Promise.all([createCardAtEnd(board.id, { title: 'first' }),
                     createCardAtEnd(board.id, { title: 'second' })])
  const page = await listBoardCards(board.id, {})
  const keys = page.items.map((c) => `${c.position}:${c.id}`)
  expect(keys).toEqual([...keys].sort())        // ordering holds even if positions tie
})
```

Either test is correct. A file containing neither is a design decision that exists only in someone's head.

## The three-session case

Occasionally a claim needs more than two participants — a WIP limit of two being violated by a third writer, or three consumers competing for two queue rows. `gate()` does not generalise; `counter(n)` from [12i](12i-forcing-the-interleaving.md)'s support module does, because every participant blocks until all `n` have arrived.

```ts
it('a WIP limit of 2 rejects the third concurrent claim', async () => {
  const board = await seedCommittedBoard({ wipLimit: 2 })
  const cards3 = await seedCommittedCards(board.id, 3)
  const allRead = counter(3)

  const results = await Promise.all(cards3.map((card) => session(async (c) => {
    await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
    await c.query("SELECT count(*) FROM cards WHERE board_id = $1 AND status = 'doing'",
      [board.id])
    await allRead.arriveAndWait()
    try {
      await c.query("UPDATE cards SET status = 'doing' WHERE id = $1", [card.id])
      await c.query('COMMIT')
      return 'committed'
    } catch (e) {
      return (e as { code?: string }).code ?? 'unknown'
    }
  })))

  expect(results.filter((r) => r === 'committed').length).toBeLessThanOrEqual(2)
})
```

⚠️ **Note the assertion is `toBeLessThanOrEqual(2)`, not `toBe(2)`.** Under Serializable, more than one participant may be aborted, and the manual is explicit that it is *"very hard to predict exactly which transactions might contribute to the read/write dependencies and need to be rolled back"*. The invariant the limit promises is that no more than two land — asserting that exactly two land asserts something the isolation level does not guarantee. [12j](12j-testing-the-retry-loop-and-the-idempotency-key.md) picks this up as the retry-loop question.

**The `counter(n)` barrier scales, but the test's legibility does not.** Past three participants, ask whether the claim really needs the extra session or whether it is the same claim with more decoration; the second is usually true, and a smaller test that fails clearly is worth more than a larger one that fails ambiguously.

## Gotchas

**★ Symptom: a `Promise.all` race test never actually overlaps.** Cause: `Promise.all` starts both promises but does not synchronise their statements; a fast first request can finish before the second's first round trip. Fix: nothing, if the assertion is an invariant — it is valid under both schedules. If the test is meant to *demonstrate* the race, it needs gates; a `Promise.all` test described as demonstrating one is claiming more than it proves.

**★ Symptom: a blocking test flakes on CI.** Cause: it asserted elapsed time, or slept a fixed interval and hoped the other session had progressed. Fix: `FOR UPDATE NOWAIT` and an assertion on `55P03`, or a small `lock_timeout` and an assertion on the resulting error. Neither contains a duration, so neither can be affected by a shared runner.

**★ Symptom: the concurrency file passes alone and fails in the full suite.** Cause: it ran in parallel with other workers writing the same rows, so an unrelated transaction interfered with the schedule. Fix: `fileParallelism: false` on the concurrency project, and its own database ([12g](12g-truncate-templates-and-schema-per-worker.md)). These tests are about contention, so any contention you did not create is noise.

**★ Symptom: the pool is exhausted halfway through the concurrency file.** Cause: `session()` acquires a dedicated connection and a test that starts three sessions against a pool of two waits forever. Fix: size the concurrency pool for the widest test in the file plus one, and set `connectionTimeoutMillis` so exhaustion fails rather than hangs.

**★ Symptom: `expect(statuses).toEqual([200, 412])` fails as `[412, 412]`.** Cause: both writers were rejected, which means the guard compared against something neither caller actually read — typically a version fetched inside the handler rather than the one carried in `If-Match`. Fix: check `version` in the same assertion. `[412, 412]` with `version` still 1 is a different defect from `[200, 200]` with `version` at 3, and asserting the row state alongside the statuses is what distinguishes them.

**★ Symptom: the `NOWAIT` test returns rows instead of erroring.** Cause: the first session's lock was already released — it committed before the second even ran, because the gate opened too early or the first session's transaction was never opened at all (a missing `BEGIN` makes each statement its own autocommit transaction, so `FOR UPDATE` releases immediately). Fix: the lock holder must be inside an explicit `BEGIN` that is still open when the second session tries; assert that by having the holder wait on a gate the second session opens.

**★ Symptom: the position race test passes with a collision present.** Cause: the assertion compared a sorted array to itself, or used `toHaveLength` on the rows rather than on the distinct positions. Fix: `new Set(positions).size === positions.length` is the only form of this assertion that cannot pass vacuously, and it should sit next to a `toHaveLength(2)` on the rows so a test that created only one card fails rather than trivially passing.

**★ Symptom: a `NaN` position reached production and no test noticed.** Cause: the suite asserted ordering and never finiteness, and PostgreSQL sorts `NaN` last rather than raising, so ordering assertions still hold. Fix: `positions.every(Number.isFinite)` in the race test, plus `z.number().finite()` in the response contract ([12c](12c-asserting-on-the-envelope-not-the-prose.md)) so both the storage and the wire are covered.

**★ Symptom: a three-party test asserts exactly two commits and intermittently sees one.** Cause: under Serializable more than one participant can be aborted, and the documentation warns that which transactions get rolled back is hard to predict. Fix: assert the bound the feature actually promises — at most two — rather than the outcome you expected to see.

## Interview questions

**★ When should a concurrency test prescribe an order and when should it assert an invariant?**
Prescribe an order when the point is to demonstrate a specific failure — the lost update needs A-read, B-read, A-write, B-write and nothing else shows the loss. Assert an invariant when the point is that the outcome is safe under *any* order: two conditional updates must produce exactly one 200 and one 412, and which client wins is not part of the contract. The invariant form is more robust because it cannot flake on scheduling, and it is usually the one missing from a suite, because it is less obvious that it is testing anything.

**★ How do you assert that a session blocked on a row lock, without asserting on time?**
Ask for the lock in a form that refuses to wait. `SELECT … FOR UPDATE NOWAIT` is documented to report an error rather than waiting if a selected row cannot be locked immediately, and that error is `55P03 lock_not_available` — a stable, documented code. So the assertion is on an error rather than on a duration and is fully deterministic. Where a statement has no `NOWAIT` form, a small `lock_timeout` on the test role gives the same shape. Asserting elapsed milliseconds is measuring a shared CI runner and will flake.

**★ What is the difference between `NOWAIT` and `SKIP LOCKED`, and why does it change the shape of a test?**
`NOWAIT` raises an error when a selected row cannot be locked immediately; `SKIP LOCKED` silently omits those rows from the result. So a `NOWAIT` test asserts an error code and a `SKIP LOCKED` test asserts a row count, or that two consumers claimed different rows. The manual is also careful that `SKIP LOCKED` gives an inconsistent view of the data and is meant for queue-like consumption rather than general use — so encountering it outside a queue claim is a design question before it is a testing one.

**★ Why is `Promise.all` acceptable for the exactly-one-succeeds test but not for the lost-update test?**
Because the assertion in the first case is true under every schedule. If the two requests happen to run sequentially, exactly one still gets 200 and one still gets 412, so a vacuous overlap does not make the test wrong — it just makes it less interesting on that run. The lost update is the opposite: it exists *only* in one interleaving, so a run where the requests did not overlap produces the correct final state and a green test that has demonstrated nothing. An invariant tolerates a weak schedule; a demonstration does not.

**★ Your position-race test passes. What does that actually tell you?**
That whatever mitigation [05ea](05ea-the-position-value-and-concurrent-creates.md) chose produced two distinct finite positions on the schedule that happened to occur — no more. If the two calls did not overlap, it says only that sequential appends work. It becomes genuinely informative when paired with the honest alternative: if your design accepts collisions and relies on the `id` tiebreaker, the test should assert the ordering invariant instead, and having neither test in the file means the decision is undocumented.

**★ Why should a three-party Serializable test assert "at most two committed" rather than "exactly two committed"?**
Because Serializable Snapshot Isolation aborts whichever transactions it must to break a dependency cycle, and the manual is explicit that predicting which ones is very hard — so a run where two of the three are aborted is correct behaviour, not a defect. The property the feature promises is an upper bound: the WIP limit is not exceeded. Asserting the exact number asserts something about SSI's victim selection, which is not documented as deterministic and would flake accordingly.

---

← [12i · Forcing the interleaving](12i-forcing-the-interleaving.md) · [Chapter index](01-explanation.md) · Next → [12j · Retry loop and idempotency](12j-testing-the-retry-loop-and-the-idempotency-key.md)
