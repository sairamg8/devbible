# 03 · Accuracy findings — where it is wrong, explicitly

Answers asks **3a** (is the explanation 100% accurate) and **3e** (say explicitly where it
is wrong).

**Every claim below was executed** against the live sandbox — PostgreSQL **18.4** on
`127.0.0.1:55432` (container `devbible-pg`, `postgres:18-alpine`), the same server the
corpus is verified on. No correction here is written from memory.

---

## Finding 1 — `MERGE … RETURNING` **does** work on PostgreSQL 18 · `WRONG`

**File:** `docs/postgresql/pages/phase-4-crud/13-merge.md`
**Severity:** high — the error appears **seven times** and is the basis of the page's
central recommendation.

### The claim

> `13-merge.md:90` — *"`MERGE` also has **no `RETURNING`** in PostgreSQL 18, which rules
> it out wherever you need the affected rows back — a significant practical limitation
> compared with `INSERT … ON CONFLICT … RETURNING`."*

> `13-merge.md:107` — *"`MERGE` arrived in **PostgreSQL 15**; `RETURNING` support is not
> present in 18."*

Also at lines 88, 125, 148–150, 177, 194.

### What actually happens

`RETURNING` for `MERGE`, together with the `merge_action()` function, was added in
**PostgreSQL 17**. Run on your server:

```console
$ psql "postgresql://devbible:devbible@127.0.0.1:55432/devbible"
MERGE INTO m_t t USING m_s s ON t.id = s.id
WHEN MATCHED THEN UPDATE SET v = s.v
WHEN NOT MATCHED THEN INSERT (id,v) VALUES (s.id,s.v)
RETURNING merge_action(), t.id, t.v;

 merge_action | id |  v
--------------+----+-----
 UPDATE       |  1 | new
 INSERT       |  3 | add
(2 rows)

MERGE 2
```

This also falsifies a second claim on the same page:

> `13-merge.md:41` — *"If you need to know how many were inserted versus updated, `MERGE`
> will not tell you."*

`merge_action()` returns exactly that, per row — which is strictly **better** than the
`ON CONFLICT … RETURNING (xmax = 0)` trick the page recommends instead at line 88.

### A third gap on the same page

PostgreSQL 17 also added `WHEN NOT MATCHED BY SOURCE`, which the page never mentions. Its
"when `MERGE` genuinely wins" section (lines 95–98) describes reconciling against an
upstream feed "where absent rows must be deleted" — and shows no way to do it. That is the
clause:

```console
MERGE INTO n_t t USING n_s s ON t.id = s.id
WHEN MATCHED THEN UPDATE SET v = s.v
WHEN NOT MATCHED BY TARGET THEN INSERT (id,v) VALUES (s.id,s.v)
WHEN NOT MATCHED BY SOURCE THEN DELETE
RETURNING merge_action(), t.id, t.v;

 merge_action | id |        v
--------------+----+------------------
 UPDATE       |  1 | new
 INSERT       |  3 | add
 DELETE       |  2 | gone-from-source
(3 rows)

MERGE 3
```

The page's own example achieves the delete by a proxy condition (`WHEN MATCHED AND s.v IS
NULL THEN DELETE`) — which only fires for rows that *are* in the source. It cannot delete
a target row the source omits, which is the actual reconciliation case.

### Exact replacement text

**Replace lines 88–92** with:

```markdown
| Need to know insert vs update per row | **`MERGE … RETURNING merge_action()`** |

`MERGE` supports `RETURNING` from **PostgreSQL 17**, together with `merge_action()`,
which returns `'INSERT'`, `'UPDATE'` or `'DELETE'` for each affected row — the per-action
breakdown `rowCount` alone cannot give you.
```

**Replace line 107** with:

```markdown
`MERGE` arrived in **PostgreSQL 15**. **PostgreSQL 17** added `RETURNING` with
`merge_action()`, and `WHEN NOT MATCHED BY SOURCE` for rows the source omits. On 16 and
earlier, `MERGE` has no `RETURNING`; on 14 and earlier there is no `MERGE` at all — use
`ON CONFLICT` or a CTE-based upsert.
```

**Delete the gotcha at lines 148–150** (`RETURNING is rejected on a MERGE`) — it describes
behaviour that does not occur on the target version. Replace with:

```markdown
**Symptom:** `merge_action()` is an unknown function
**Cause:** PostgreSQL 16 or earlier — `RETURNING` for `MERGE` arrived in 17.
**Fix:** Upgrade, or re-query after the merge.
```

**Rewrite the interview answer at lines 176–178.** The concurrency half is correct and
should be kept; strike the `RETURNING` sentence:

```markdown
It uses a unique index as an arbiter, so concurrent transactions are resolved correctly.
`MERGE` evaluates its `ON` condition against its snapshot, so two concurrent transactions
can both take the `NOT MATCHED` branch and produce a `23505` — or a duplicate if no unique
constraint exists. Both support `RETURNING` on PostgreSQL 17+; the difference is purely
concurrency arbitration.
```

**Line 194** — same correction as line 107.

**Add ~40 lines** on `WHEN NOT MATCHED BY SOURCE` after line 98, with the transcript
above. Script needed: extend `sandbox/pg-api/ex14-crud.mjs` §8 to cover both clauses.

### What is still correct — keep it

The page's core argument survives intact and is genuinely good: **`MERGE` is not
index-arbitrated and `ON CONFLICT` is**, so `MERGE` is the wrong tool for concurrent
upsert. That is right, well-explained, and the `21000 MERGE command cannot affect row a
second time` material is a real gotcha most references omit. Only the `RETURNING` claim
and the resulting "three things you usually want" framing need surgery.

---

## Finding 2 — twelve Phase 13 pages are template stamps · `STAMP`

**Files:** `docs/postgresql/pages/phase-13-ops/07-pgbouncer.md` through `18-disaster-drill.md`
— twelve files, **66 lines each, byte-identical in structure.**

These are unwritten, which is fine and expected. The problem is that **they do not look
unwritten.** Each carries a tier badge, `## How it works`, `## Gotchas` with two
symptom→cause→fix entries, and `## Interview questions` with four Q&As. Every structural
check passes. My own audit grep for "pages missing a Gotchas section" returned zero hits
across the entire corpus *because these files have one*.

They are also actively misleading. From `07-pgbouncer.md`:

- **Line 13** — *"`psql` is how you prove every later claim. Connection limits and
  PgBouncer is daily operator skill."* The first sentence is template boilerplate about a
  different topic entirely.
- **Line 17** — the `## How it works` body is a verbatim copy of the one-line summary at
  line 9.
- **Lines 23–27** — the `## Ops surface` code block shows `pg_dump`/`pg_restore` on a page
  about connection pooling.
- **Lines 52–53** — *"★ What is the core idea of 'Connection limits and PgBouncer'?"*
  answered by re-pasting line 9 verbatim. This is the exact failure your review prompt
  names: *"a question with a one-line restatement of the page's bold opener is a fail."*

There is real content that ought to be here — and the corpus already knows it.
`phase-7-pg-driver/10-prepared.md:116–131` explains transaction-pooling breakage
(`26000 prepared statement does not exist`), the three remedies, and PgBouncer 1.21+
`max_prepared_statements`, better than most published material. The stamp should link to
it rather than duplicate it.

**Recommended:** either write them, or **strip them to a single honest line** —
`> Not yet written. Tracked in the phase index.` — and delete the fake Gotchas and Q&A.
A stamp that impersonates a finished page will eventually be read as one.

**Also fix `docs/README.md:40`**, which says *"13 topics outstanding in phase 13"*. It is
**12** (rows 07–18). Rows 01–06 are written and `06-tls.md` is genuinely strong — its
`sslmode=require` verifies nothing framing is the correct and commonly-missed point.

---

## Finding 3 — Phase 0's shared-buffers measurement is confounded · `WRONG`

**File:** `docs/postgresql/pages/phase-0-architecture/04-shared-buffers.md:50–78`

The page presents this as evidence for shared buffers:

```console
$ node warm-read.mjs
first 44.52 ms
second 2.64 ms
```

> Line 76 — *"the **shape** matters: second call is cheaper because catalogs (and paths)
> are warm."*

**That is not what the number measures.** Read the script at lines 53–67: `once('first')`
is called on a `Pool` that has never connected. So the 44.52 ms includes TCP connect, the
SCRAM-SHA-256 authentication round trips, the backend process fork, and session startup —
**none of which is shared buffers**, and all of which the second call skips because the
connection now exists. Buffer-cache warming is a small fraction of a gap that is
overwhelmingly connection establishment.

This trips your global rule 3 exactly: *"If a benchmark's 'slow' side is doing work the
'fast' side never has to do, it is measuring nothing."* Worse, it appears on the page
whose entire job is to explain what shared buffers do, so the reader draws precisely the
wrong causal conclusion — and the page's own prose (line 76) states that wrong conclusion.

### Fix

The measurement needs to isolate the buffer cache from connection setup. Script needed —
must, on **one already-warmed connection**:

1. `SELECT pg_stat_reset_shared('io')` or capture the baseline from `pg_statio_user_tables`.
2. `EXPLAIN (ANALYZE, BUFFERS) SELECT …` over a table larger than `shared_buffers`, cold,
   recording `Buffers: shared read=N`.
3. Re-run the identical query, recording `Buffers: shared hit=N`.

The honest headline is then `read=` → `hit=` on the same connection, which *is* the buffer
cache and nothing else. Keep the existing `show shared_buffers` transcript (lines 34–39) —
that one is fine.

**Minimum fix if no new script is written:** delete lines 50–78 entirely. A page with no
measurement is better than a page with a measurement that proves something else.

---

## Finding 4 — Phase 0 is under-explained throughout · `THIN`

**Path:** `docs/postgresql/pages/phase-0-architecture/` — 12 topics, **1398 lines, 116 per
topic.** The thinnest phase in the corpus by a factor of two, and it contains two
**Master**-tier topics.

The phase reads as though it were written first, to a different standard, and never
revisited. Concretely, `02-client-server-model.md` (146 lines, **Master**):

- **Line 9** — *"Each client connection is backed by its own server process (backend).
  That is why connections are expensive"* — states the fact, never the mechanism. **Gap:**
  *why* it is expensive is never quantified: the `fork()`, the ~5–10 MB RSS per backend,
  the SCRAM round trips, the catalog cache each backend builds privately. A reader cannot
  answer "how many connections can this 4 GB server take?" from this page. **Add:** ~50
  lines, with per-backend RSS measured from `pg_stat_activity` joined against the host.
- **Lines 126–143** — four interview questions, of which **three are "what is" questions**
  answered in one line. Your brief (`instructions.md` §4.2) says *"Prefer 'why' and 'what
  happens if' over 'what is'"*; more than one is a finding.
- **No `> Verified:` line naming a script.** The Node transcript at lines 87–90 has no
  provenance — the file `two-backends.mjs` is not in `sandbox/pg-api/`.

`04-shared-buffers.md` has the same shape: no eviction mechanism (clock sweep), no ring
buffers for sequential scans, no `pg_buffercache`, no relationship between `shared_buffers`
and `effective_cache_size`, and a Q&A set of four "what is" questions.

**Also:** `11-vs-other-databases.md` (83 lines) is the only page in the entire corpus with
**no `> Verified:` line at all** outside the twelve stamps.

**Recommendation:** treat Phase 0 as a rewrite target, not a patch target — it is 12
topics and ~1400 lines that should be ~2600. It is also the *first* thing a reader of the
PostgreSQL corpus meets, so it sets their expectation of everything after it.

---

## Where the corpus is accurate — checked, not assumed

To avoid manufacturing findings, I swept every version-gated claim in the corpus
(`grep -rnE "PostgreSQL 1[0-9]"`) and spot-verified the risky ones. **Finding 1 is the only
version error.** Confirmed correct:

- `phase-10-indexes/06-multicolumn.md` — **PostgreSQL 18 skip scan**, and its correct
  framing that it *softens* rather than removes the leftmost-prefix rule. This is a genuinely
  new PG18 feature captured accurately, which is the opposite of a stale corpus.
- `phase-2-types/07-uuid.md` — `uuidv7()`, `uuidv4()`, `uuid_extract_version()`,
  `uuid_extract_timestamp()` as PG18 built-ins. Correct, including that `gen_random_uuid()`
  is PG13+.
- `phase-7-pg-driver/10-prepared.md` — custom plan for five executions then the generic-plan
  switch on the sixth; `plan_cache_mode` values; per-session scope. All correct, and the
  `generic_plans: 4 / custom_plans: 5` transcript is consistent with the documented rule.
- `phase-11-mvcc/06-isolation-levels.md` — snapshot at first statement not `BEGIN`; the two
  distinct `40001` messages; read-only `REPEATABLE READ` cannot serialization-fail. All
  correct, and the two-message distinction is a detail most references miss.
- `phase-3-ddl/03-foreign-keys.md` — `23503` vs `23001`, and `RESTRICT` being
  non-deferrable while `NO ACTION` defers. Correct.

---

← [02 · The cap and depth](02-the-cap-and-depth.md) · Next → [04 · Ratings](04-ratings.md)
