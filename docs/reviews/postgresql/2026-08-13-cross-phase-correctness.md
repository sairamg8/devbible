# PostgreSQL — cross-phase correctness review

> **Resolution status (2026-08-13, later the same day).** Work-order items **1–13 are done**
> and the site rebuilds clean (`grep -iE 'warning|broken|anchor'` exit 1 on a wiped
> `.docusaurus`/`build`/cache). **Item 14 (the re-split) is not started** — the queue of 20
> Master-tier single-file pages is at the end of this document.
>
> Two of this review's own claims did not survive verification and are corrected in place
> below: **A5** overstated the pool-starvation effect (see the note under A5), and **A2**
> predicted that adding `created_at` would invalidate committed console output — it does not.

| Field | Value |
|---|---|
| Reviewer / exact model | `claude-opus-5` via `/code-review high` |
| Date | 2026-08-13 |
| Path | `docs/postgresql/pages/` — phases 1, 2, 5, 10, 11 (the rewritten set) |
| Target runtime | PostgreSQL 16 / Node 20, `pg` driver |
| **Examples executed** | **no** — findings are from static reading plus arithmetic re-checked against `sandbox/pg-api/ex35-joins.mjs` and the committed console blocks |
| Topics reviewed | 81 pages across 5 phases (diff-scoped, not the full 235) |
| **Phase score** | **not scored — see below** |
| Verdict | 14 findings; 5 are code that fails or misleads when copied |

## What this document is not

This is **not** the per-phase review that `review-prompt.md` §11 prescribes. That format
requires D1–D5 dimension scores for every topic, a coverage check against the phase
syllabus, and a missing-topics section — none of which this pass performed. It was a
correctness sweep over the working-tree diff, so it reads changed pages for things that
are *wrong*, not every page for whether it is *deep enough*.

**No scores appear here because none were computed.** The rubric review still needs to be
run per phase. Treat this as a defect list that pass can assume is already known.

Rule 1 of the prompt was honoured: nothing outside this file was edited.

## Verdict in three sentences

The measured claims are sound — the arithmetic in every benchmark spot-checked against the
sandbox script holds, and the LATERAL page discloses its own confound, which is the habit
that matters most. The highest-payoff fix is the five code samples that fail or teach the
ineffective half of a technique, because those are the lines a reader pastes into
production. The structural problem is separate and larger: all 81 pages landed between 169
and 269 lines, which is the clustering tell, and re-splitting is a bigger job than all 14
findings combined.

## Line distribution — clustering tell: **YES**

| Phase | n | min | median | max |
|---|---|---|---|---|
| phase-1-psql | 15 | 181 | 216 | 244 |
| phase-2-types | 16 | 182 | 207 | 255 |
| phase-5-joins | 16 | 210 | 232 | 269 |
| phase-10-indexes | 18 | 169 | 205 | 264 |
| phase-11-mvcc | 16 | 170 | 202 | 224 |
| **all** | **81** | **169** | **~209** | **269** |

**81 of 81 pages fall inside 169–269. Not one exceeds 270, and not one is under 169.**

`~/.claude/CLAUDE.md` names this signature explicitly: "a run of pages all landing in a
narrow band just under the cap … Clustering at ~200–290 is evidence of budgeting, not of
topics that happened to be that size." Three Master-tier topics *were* correctly split into
chunk directories this pass (`01-inner-join/`, `02-left-join/`, `03-semi-anti/`), which
proves the mechanism is understood. But other Master-tier topics — `phase-2-types/06-null.md`,
`phase-10-indexes/05-index-not-used.md` — sit inside the band as single files, which is the
outcome the rule exists to prevent.

This is the second time this has been caught. The memory store records the first as
devbible Phase 5, 2026-08-13.

---

## Findings

Each carries `file:line`, the offending text, why it is wrong, and the replacement.

### A. Code that fails or misleads when copied

#### A1 · `SET` cannot take bind parameters

**`phase-2-types/05-time-zones.md:100`**

```js
  await c.query(`SET LOCAL TIME ZONE $1`, [user.timezone]);   // reverts at COMMIT
```

`SET` is a utility statement, not a planned query, so it has no parameter slots. This
fails at parse on every call with `42601 syntax error at or near "$1"`. The danger is the
obvious "fix": a reader who hits that error reaches for
`` `SET LOCAL TIME ZONE '${user.timezone}'` ``, which is an injection hole on a value that
came from user input.

**Replacement:**

```js
  await c.query('SELECT set_config($1, $2, true)', ['timezone', user.timezone]);  // true = LOCAL
```

Line 96 ("Inside a transaction, `SET LOCAL TIME ZONE` is safe because it reverts on
commit") is correct as prose about the SQL statement and needs no change — only the JS
sample is wrong. Worth adding one sentence: `set_config(..., true)` is the parameterised
equivalent of `SET LOCAL`, and it is the only form that accepts a runtime value.

#### A2 · Five queries filter on a column the fixture does not have

**`phase-5-joins/02-left-join/02-on-vs-where.md:167`**

```sql
         AND o.created_at >= $2
```

The phase fixture at `01-inner-join/README.md:32-33` defines:

```sql
CREATE TABLE j_orders (id int PRIMARY KEY, customer_id int REFERENCES j_customers(id),
                       status text NOT NULL, total int NOT NULL);
```

No `created_at`. Every one of these errors `42703 column o.created_at does not exist`:

| File | Line | Note |
|---|---|---|
| `02-left-join/02-on-vs-where.md` | 167 | "From Node" block |
| `03-semi-anti/01-semi-joins.md` | 122 | |
| `03-semi-anti/02-anti-joins.md` | 160 | |
| `07-cross-join.md` | 121 | calendar-spine, presented as runnable |
| `07-cross-join.md` | 156 | calendar-spine, presented as runnable |

**Fix — add the column to the fixture** (preferred; five call sites want it):

```sql
CREATE TABLE j_orders (id int PRIMARY KEY, customer_id int REFERENCES j_customers(id),
                       status text NOT NULL, total int NOT NULL,
                       created_at timestamptz NOT NULL DEFAULT now());
```

> **Verified 2026-08-13 — this paragraph's prediction was wrong.** `ex35-joins.mjs` contains
> no `SELECT *` or `o.*` against `j_orders` (the only `SELECT *` output on any page is the
> `j_u1`/`j_u2` duplicate-column demo), so adding the column changed **no** committed block.
> Re-running the script before and after produced byte-identical output apart from
> `EXPLAIN ANALYZE` timing jitter — every plan shape and row count identical. Fixed
> timestamps were used rather than `DEFAULT now()`, as recommended below. All five queries
> were then executed against the fixture and return rows.

**This was expected not to be a one-line change.** Adding a column would alter any `SELECT *`
or `console.log(rows)` block in the phase that shows a `j_orders` row. `ex35-joins.mjs` must
be re-run and any affected console blocks re-pasted — do not hand-edit the outputs. The
existing seed inserts (including `(14, NULL, 'open', 5)`) keep working via the `DEFAULT`,
but a fixed timestamp per row is better than `now()` if any output block is to stay stable
across runs.

#### A3 · Sorting an id array does not order row locks

**`phase-11-mvcc/11-deadlocks.md:90`**

```js
ids.sort((a, b) => a - b);
```

…before `UPDATE items SET n = n+1 WHERE id = ANY($1::int[])`.

The sort has no effect on lock order. A multi-row `UPDATE` locks rows in the order the
plan produces them — heap order for a seq or bitmap scan — and the order of values inside
the array literal never reaches the executor as an ordering. Two concurrent bulk updates
over overlapping id sets still deadlock exactly as before.

The page already knows this. Two lines below, the prose reads: *"a multi-row `UPDATE` locks
rows in the order it finds them, which is plan-dependent."* The code sample contradicts the
paragraph explaining it, and the sample is the part that gets copied.

**Fix:** delete the `sort()` + `ANY()` sample. Promote the `ORDER BY … FOR UPDATE` locking
subquery — already mentioned on the page — to be *the* worked example, since it is the only
construct here that actually imposes an order:

```js
await c.query(`
  SELECT id FROM items WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE
`, [ids]);
await c.query('UPDATE items SET n = n + 1 WHERE id = ANY($1::int[])', [ids]);
```

Then state plainly: the ordering comes from `ORDER BY` in a locking `SELECT`, never from
the order of values you pass in.

#### A4 · Session advisory lock leaks on a pooled client

**`phase-11-mvcc/15-advisory-locks.md:92`**

`runIfLeader` takes a session-level `pg_try_advisory_lock` on a client checked out of the
pool. If the inner `pg_advisory_unlock` query throws, the outer `finally` runs
`client.release()` with no error argument — returning a connection to the pool that still
holds `CRON_LOCK`. Nothing ever reclaims it. Every later `runIfLeader` fails for the
lifetime of the process.

Lines 100–102 offer the backstop: *"the lock dies with the connection — so a crashed
instance releases it automatically."* True for a dedicated connection; false here, because
a pooled connection that is released rather than closed never dies.

**Fix — either:**

```js
} finally {
  client.release(true);   // destroy, don't reuse: lock state is unknown
}
```

…or switch to `pg_advisory_xact_lock` inside a transaction, which the server releases at
`COMMIT`/`ROLLBACK` regardless of what the client does. The second is the better default
and worth recommending as such; keep the session-level form only for the case that
genuinely outlives a transaction, and say which one that is.

#### A5 · Backoff sleep holds a pooled connection

**`phase-11-mvcc/06-isolation-levels.md:119-124`**

In `withSerializable`, `await sleep(...)` is inside the `catch`, so the enclosing
`finally { client.release(); }` cannot run until the backoff elapses. Each retrying
transaction pins a connection while doing no work.

On this page's own measured workload — 20 concurrent transfers, 115 retries — against a
default `max: 10` pool, that starves `pool.connect()` for callers that were ready to
proceed. The page is measuring retry cost and accidentally including pool starvation in it.

> **Corrected 2026-08-13 — the defect is real, this justification was not.** Two errors here.
> First, `ex28-mvcc-isolation.mjs` opens its pool with **`max: 25`**, not the default 10,
> against 20 concurrent transfers — so every sleeper had its own connection and the committed
> 12.4 s contains no queueing at all. Second, a probe at `max: 10` did not show the predicted
> slowdown: capping the pool also caps how many transactions conflict simultaneously, which
> cut the retry count, and the sleep-inside variant came out *faster* than the fixed one
> (8.3 s vs 12.4 s) while retry counts swung 71–156 between runs. **Fix the code because
> holding a pooled connection while deliberately idle is wrong on its face, not because a
> benchmark of this shape demonstrates it.** The page now says exactly that and cites no
> probe numbers, since the probe was not a committed sandbox script.

**Fix:** release before sleeping — move the sleep out of the `try`/`finally` entirely:

```js
for (let attempt = 1; attempt <= MAX; attempt++) {
  const client = await pool.connect();
  try {
    /* … BEGIN ISOLATION LEVEL SERIALIZABLE … COMMIT … */
    return result;
  } catch (e) {
    if (e.code !== '40001' || attempt === MAX) throw e;
  } finally {
    client.release();
  }
  await sleep(backoff(attempt));   // outside: no connection held
}
```

Worth a sentence of its own, since it generalises: never `await` anything slow between
acquiring a pooled resource and releasing it.

---

### B. Factual errors

#### B1 · Merge join cannot serve a range predicate

**`phase-5-joins/01-inner-join/01-matching-pairs.md:110`**

> entirely** — `ON b.v BETWEEN a.lo AND a.hi` can only be a nested loop or merge, which is

Merge join requires **mergejoinable** clauses — btree equality operators. A pure range
condition has none, so the only strategy available is a nested loop. Naming merge as an
option understates how bad a large range join gets, which is the whole point of the
passage.

The corpus already states this correctly elsewhere: `06-outer-joins.md:229` explains FULL
OUTER is restricted to "hash- or merge-joinable" conditions. The docs contradict each other.

**Same error, two more sites:** `13-join-expressions.md:120` ("only nested-loop and merge
strategies apply") and `13-join-expressions.md:191`.

**Replacement for :110** — "can only be a nested loop; merge join needs a mergejoinable
(equality) clause and a range predicate has none, so there is no alternative plan to fall
back to."

#### B2 · Wraparound warning threshold is off by ~1.1 billion

**`phase-11-mvcc/16-xid-wraparound.md:98`**

```
| ~1 billion | `WARNING: database "x" must be vacuumed within N transactions` |
```

PostgreSQL derives these from the wrap limit, not from round numbers:

- `xidWrapLimit` ≈ 2^31 ≈ **2,147,483,648**
- `xidStopLimit` = `xidWrapLimit − 3,000,000` ≈ **2.144 billion** — writes refused
- `xidWarnLimit` = `xidStopLimit − 10,000,000` ≈ **2.134 billion** — the WARNING

So that warning first appears at an age near **2.13 billion**, roughly 10 million XIDs
before shutdown — not at 1 billion, and not halfway to it. Anyone building alerting from
this table believes they have a billion transactions of headroom between warning and
refusal. They have about 10 million, which at a few thousand XIDs/sec is minutes.

**Repeated at line 176:** "warnings near 1 billion".

**Replacement:** correct both numbers, and add the threshold that actually deserves the
alert — `autovacuum_freeze_max_age` (default **200 million**), which is where an aggressive
anti-wraparound autovacuum kicks in whether or not autovacuum is otherwise enabled. That is
the number to page on. The 2.13 billion warning is the "you already lost" line.

#### B3 · `count(DISTINCT …)` survives fan-out — the page says it doesn't

**`phase-5-joins/01-inner-join/02-fan-out-and-aggregates.md:66`**

> post with 2 tags and 3 comments yields 6 rows and both `count(DISTINCT tag)` and any naive

False, and self-contradictory twice over. Over the 6-row product, `count(DISTINCT tag_id)`
still returns 2 — that is exactly what `DISTINCT` is doing. Meanwhile:

- `04-multi-join.md:127` states it correctly: "`count(DISTINCT tag)` **survives**, a naive
  `sum(comment.score)` does not."
- §3 of *this same page* presents `count(DISTINCT …)` as the fix for miscounts.

**Replacement:** "…yields 6 rows, and a naive `sum(comment.score)` triples while
`count(DISTINCT tag_id)` still returns the right 2 — which is the asymmetry §3 turns into
a rule."

#### B4 · The phase fixture is five orders, not four

**`phase-5-joins/01-inner-join/README.md:27`**

> Every page in this phase uses these four customers and four orders. Dee has no orders;

`03-semi-anti/02-anti-joins.md:37` inserts a fifth:

```sql
INSERT INTO j_orders VALUES (14, NULL, 'open', 5);
```

`ex35-joins.mjs` runs that before section 7, which is why `07-cross-join.md:41` reads
"4 customers x 5 orders = 20 rows" and `10-lateral.md` shows orders 13 **and** 14 with
`sku: null`. A reader who builds the fixture from this README and runs the CROSS JOIN
example gets 16 rows against documented output of 20, with nothing on the page explaining
the gap.

**Fix:** move the order-14 insert into the README's fixture block so the fixture is
complete where it is defined, and say what it is for — the orphan row with a `NULL`
`customer_id` that the anti-join and LATERAL pages both depend on. Then `02-anti-joins.md:37`
becomes a reminder rather than a hidden mutation.

#### B5 · Column order in the duplicate-name walkthrough

**`phase-5-joins/08-on-using-natural.md:116`**

> The server sent six columns: `id, name, created_at, id, created_at, label`. The JS object

The DDL at lines 20-21 gives `j_u2 (id int, label text, created_at date)`, so the real
order is `id, name, created_at, id, **label, created_at**`.

The conclusion — rightmost `created_at` wins in the JS object — is right, but this list is
the evidence offered for it, and a reader checking it against the DDL finds it doesn't
match.

**Replacement:** `id, name, created_at, id, label, created_at`.

---

### C. Smaller

#### C1 · Unbounded retry loop contradicts the phase's own rule

**`phase-11-mvcc/04-lost-update.md:89`** — the optimistic-concurrency sample is `for (;;)`
with no attempt cap and no backoff. Under sustained contention on `m_ctr` id 1 it spins
indefinitely at two queries per iteration.

Both other retry helpers in this phase bound attempts and jitter
(`04-lost-update.md:124`, `06-isolation-levels.md:109`), and `06-isolation-levels.md:135`
says outright: "an unbounded loop under sustained contention is a livelock." This snippet
is the phase's own counterexample.

**Fix:** bound it to `MAX` attempts with jittered backoff, matching the helper at line 124.

#### C2 · Sidebar label doesn't match the topic name

**`phase-5-joins/03-semi-anti/_category_.json`**

```json
{"label":"03 · EXISTS","position":3,"collapsed":true}
```

The topic is "Semi and anti joins" in the phase README, in both chunk READMEs, and in every
inbound "Where this connects" link. A reader sent to "Semi and anti joins" scans the sidebar
for it and finds `03 · EXISTS`. Siblings are consistent (`01 · INNER JOIN`, `02 · LEFT JOIN`),
so this is the odd one out.

**Fix:** `{"label":"03 · Semi and anti joins","position":3,"collapsed":true}`

#### C3 · Sentence names the wrong construct

**`phase-5-joins/02-left-join/02-on-vs-where.md:135`**

> **`USING` in a `HAVING` or a later `GROUP BY` filter** behaves the same way — `HAVING` runs

`USING` has nothing to do with `HAVING`. The point being made is correct — a `HAVING`
predicate on the outer-joined table cancels the outer join for the same reason a `WHERE`
predicate does — but the subject of the sentence is wrong.

**Replacement:** "**A `HAVING` predicate on the outer-joined table** behaves the same way —
`HAVING` runs after the join and the grouping, so a condition on `o.status` there discards
the null-extended row just as a `WHERE` would."

---

## Work order — ranked by payoff

| # | File(s) | Action | Est. lines | Needs a script? | Blocked by |
|---|---|---|---|---|---|
| 1 | `phase-2-types/05-time-zones.md:100` | Swap `SET LOCAL … $1` for `set_config($1,$2,true)`; add the "only parameterised form" sentence | +3 | no | — |
| 2 | `phase-11-mvcc/11-deadlocks.md:90` | Delete `sort()`+`ANY()` sample; promote `ORDER BY … FOR UPDATE` to the worked example | ±10 | no | — |
| 3 | `phase-11-mvcc/16-xid-wraparound.md:98,176` | Correct to ~2.13bn warn / ~2.14bn stop; add `autovacuum_freeze_max_age` 200M as the alerting threshold | +6 | no | — |
| 4 | `phase-11-mvcc/15-advisory-locks.md:92` | `client.release(true)` on unlock failure; recommend `pg_advisory_xact_lock` as default; fix the "dies with the connection" claim for pooled clients | +8 | no | — |
| 5 | `phase-11-mvcc/06-isolation-levels.md:119` | Move sleep outside `try`/`finally`; add the general rule | +4 | re-run to confirm retry count unchanged | — |
| 6 | `01-inner-join/01-matching-pairs.md:110`, `13-join-expressions.md:120,191` | Merge join needs mergejoinable equality — nested loop only for ranges | +4 | no | — |
| 7 | `01-inner-join/02-fan-out-and-aggregates.md:66` | Rewrite so `count(DISTINCT)` survives and `sum` doesn't | ±3 | no | — |
| 8 | `01-inner-join/README.md:27,32` | Add order 14 to the fixture block; correct "four orders" to five; explain the orphan row | +5 | no | — |
| 9 | `08-on-using-natural.md:116` | Fix column order to `…id, label, created_at` | ±1 | no | — |
| 10 | `03-semi-anti/_category_.json` | Label → "Semi and anti joins" | ±1 | no | — |
| 11 | `02-left-join/02-on-vs-where.md:135` | Replace `USING` with `A HAVING predicate on the outer-joined table` | ±2 | no | — |
| 12 | `phase-11-mvcc/04-lost-update.md:89` | Bound the loop, add jitter, match the helper at :124 | +5 | no | — |
| 13 | **5 files** (see A2 table) | Add `created_at` to `j_orders` DDL; re-run `ex35-joins.mjs`; re-paste every affected console block | +2 DDL, N output | **yes — `ex35-joins.mjs`** | — |
| 14 | **62 pages**, phases 1/2/5/10/11 | Re-split against the cap rule: identify Master-tier topics sized to the band, expand to the depth the topic deserves, then chunk on concept boundaries | large | per topic | do 1–13 first |

Items 1–12 are independent and can be done in any order in one sitting. **13** is separate
because it invalidates committed output. **14** is a project, not a fix — and it will
rewrite pages that items 1–12 touch, so doing it first wastes that work.

## What is already good — do not destroy this in the re-split

- **Every measured claim spot-checked holds.** Fan-out 450 vs 350 (29% error), UUID 82%/94%,
  `INCLUDE` 73→10 buffers and 4× index size, LATERAL 5.6×, `UNION` 3.5×, expression index
  59×, XID budget 169 days / 0.0027%. Arithmetic re-derived from `ex35-joins.mjs` and the
  console blocks, and it agrees.
- **The LATERAL page discloses its own confound.** This is the habit that separates a
  benchmark from a number, and it is the single most valuable thing in the corpus.
- **`date_trunc('day', ts, 'UTC')` immutability is backed by measured `42P17` output**, not
  asserted from memory.
- **Three Master-tier topics were correctly chunked** — `01-inner-join/`, `02-left-join/`,
  `03-semi-anti/` — with per-chunk tier badges, `Verified:` lines, and their own gotchas.
  These are the model for item 14.
- **`src/data/progress.js` is accurate.** The `0 → 15/16/13/18/16` updates and the removed
  `pagesPlanned` on phase 10 match the files on disk and the `phaseStatus`/`summarise`
  logic. No phase is miscounted.
- **The link graph resolves.** All new `inner-join/`, `left-join/`, `semi-anti/` directory
  links use the prefix-dropped form and all `.md` links keep both prefixes. No broken links
  introduced.

## Item 14 — the re-split queue

Every page below is tagged **Master** tier and is still a single file inside the clustering
band. These are the candidates, largest first; the three already-chunked topics
(`01-inner-join/`, `02-left-join/`, `03-semi-anti/`) are the model.

| Lines | Page |
|---|---|
| 260 | `phase-10-indexes/05-index-not-used.md` |
| 255 | `phase-2-types/06-null.md` |
| 222 | `phase-11-mvcc/04-lost-update.md` |
| 221 | `phase-1-psql/02-daily-meta-commands.md` |
| 220 | `phase-2-types/04-timestamptz.md` |
| 216 | `phase-1-psql/01-connecting.md` |
| 216 | `phase-11-mvcc/01-acid.md` |
| 215 | `phase-1-psql/04-output-control.md` |
| 210 | `phase-2-types/02-numeric-vs-float.md` |
| 205 | `phase-11-mvcc/02-begin-commit.md` |
| 204 | `phase-2-types/01-integers.md` |
| 199 | `phase-2-types/05-time-zones.md` |
| 199 | `phase-2-types/03-text.md` |
| 197 | `phase-1-psql/03-describe-table.md` |
| 186 | `phase-10-indexes/03-explain.md` |
| 182 | `phase-10-indexes/02-btree.md` |
| 181 | `phase-1-psql/05-help.md` |
| 177 | `phase-10-indexes/04-scan-types.md` |
| 170 | `phase-11-mvcc/03-read-committed.md` |
| 169 | `phase-10-indexes/01-what-index.md` |

**The job is not "split these files".** A 199-line page split in two produces two 100-line
pages and fixes nothing — the cap was never the constraint. The job is to write each topic to
the depth a Master-tier topic deserves, which for most of these means 400–1000+ lines with
measured output backing every claim, and *then* chunk on concept boundaries. Splitting is the
consequence, not the task. Expect new sandbox scripts per topic.

## Still outstanding

The per-phase rubric review from `review-prompt.md` §11 has **not** been run for any of
these five phases. This document covers defects only — not coverage against the syllabus,
not missing topics, not per-topic depth scores. Phases 12, 13, 6 and 9 (stamps and
unwritten areas) were untouched by this diff and were not read at all.
