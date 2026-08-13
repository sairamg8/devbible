# PostgreSQL — findings and ratings · Fable · 2026-08-13

The findings half of the condensed review. Syllabus, scenarios and the work order are in
[postgresql-syllabus-and-plan.md](postgresql-syllabus-and-plan.md). The long-form version
of both, split by concern, is in [../README.md](../README.md).

| | |
|---|---|
| Corpus | `docs/postgresql/` — 229 syllabus topics, 228 pages, 269 files, 55 128 lines |
| Server | **PostgreSQL 18.4** live at `127.0.0.1:55432` (`devbible-pg`) |
| **Claims executed** | **yes** — every correction below was run on that server; every count computed |
| Read in full | 10 topics · partially 2 · structurally measured 228 |
| Nothing was modified | reviewer only; all changes appear here as replacement text |

**Verdict.** The written corpus is the best material in this repo — Phases 5, 6, 9, 11 and
12 explain *mechanism*, not behaviour. The syllabus is well-tiered (26.3% Master) and
~93% aligned to fullstack work. But eight phases were written to the 300-line cap read as
a content budget, one page states a falsehood about PostgreSQL 18, and twelve pages are
templates that impersonate finished work.

---

## 1 · The cap was read as a content budget — the main defect

Master-tier topics, total lines across all chunks:

| Phases that chunk | | Phases that never chunk | |
|---|---|---|---|
| `phase-6/01-group-by/` | **1470** | `phase-4/07-update.md` | 292 |
| `phase-6/02-count-variants/` | **821** | `phase-10/05-index-not-used.md` | 260 |
| `phase-9/01-repository/` | **758** | `phase-2/04-timestamptz.md` | 220 |
| `phase-5/01-inner-join/` | **563** | `phase-11/03-read-committed.md` | 170 |
| `phase-12/01-jsonb-operators/` | **507** | `phase-10/03-explain.md` | **186** |

> **`count(*)` vs `count(col)` gets 821 lines. `EXPLAIN` gets 186.** Both Master, same
> corpus, same brief.

Median Master topic: **530 lines where chunked, 220 where not.** Across 269 files the max
is **299** and *nothing* exceeds it. Phases 0, 1, 2, 3, 4, 7, 10, 11 — 132 topics, 58% of
the corpus — contain **not one** chunked topic; Phase 6 chunked 16 of 16.

| Phase | Lines/topic | Chunked | |
|---|---|---|---|
| 6 Aggregation | **633** | 16/16 | written to the corrected rule |
| 9 API CRUD · 5 Joins · 12 Beyond tables | 311 · 287 · 272 | 5/18 · 3/13 · 2/17 | ” |
| 4 · 7 · 1 · 3 · **10** · 11 · 2 | 250 → 209 | **0** | **capped** |
| 13 Ops | 194 | 3/18 | + 12 stamps |
| **0 Architecture** | **116** | 0 | never revised |

**The nuance that matters: this is not a quality problem.** I read four capped pages in
full expecting thin material and found the opposite — `03-foreign-keys.md` (226) and
`05-index-not-used.md` (260) score 9.2 and 9.4. They are as good as 220 lines allows, and
several of their topics need 500. What a capped page loses is the second half: the case it
doesn't show, the failure reproduced rather than described. `03-explain.md` can define
`EXPLAIN` and read one plan; it cannot also cover cost units, `loops=`, `BUFFERS`,
estimate-vs-actual as a diagnostic skill, or `FORMAT JSON` from Node.

**Proposed splits** — concept boundaries, never line counts:

| Topic | → | Chunks |
|---|---|---|
| `phase-10/03-explain.md` (186) | ~620 | reading a plan · vs ANALYZE · estimate-vs-actual · from Node |
| `phase-11/03-read-committed.md` (170) | ~480 | statement snapshots · the anomalies it allows, *shown failing* · the recheck rule |
| `phase-2/04-timestamptz.md` (220) | ~520 | what it stores · session timezone and `AT TIME ZONE` · Node and the driver |
| `phase-4/06-on-conflict.md` (234) | ~500 | arbiters and DO NOTHING · DO UPDATE and EXCLUDED · upsert in practice |

**Guard for next time** — run after each phase; a healthy phase looks like 1470/821/576,
wildly uneven, because topics are:

```bash
cd docs/<lang>/pages
for d in phase-*; do
  for f in $d/*.md; do case "$f" in */README.md) continue;; esac
    grep -q t-master "$f" && printf "%4d  %s\n" "$(wc -l < "$f")" "$f"; done
  for t in $d/*/; do grep -q t-master "$t/README.md" 2>/dev/null &&
    printf "%4d  %s\n" "$(cat $t/*.md | wc -l)" "$t"; done
done | sort -rn
```

---

## 2 · `13-merge.md` is wrong about PostgreSQL 18 · `WRONG`

`docs/postgresql/pages/phase-4-crud/13-merge.md` — the error appears **seven times**
(lines 41, 88, 90, 107, 125, 148–150, 177, 194) and is the basis of the page's central
recommendation.

> **:90** — *"`MERGE` also has **no `RETURNING`** in PostgreSQL 18, which rules it out
> wherever you need the affected rows back."*

`RETURNING` for `MERGE`, with `merge_action()`, landed in **PostgreSQL 17**. On your server:

```console
MERGE INTO m_t t USING m_s s ON t.id = s.id
WHEN MATCHED THEN UPDATE SET v = s.v
WHEN NOT MATCHED THEN INSERT (id,v) VALUES (s.id,s.v)
RETURNING merge_action(), t.id, t.v;

 merge_action | id |  v
--------------+----+-----
 UPDATE       |  1 | new
 INSERT       |  3 | add
```

This also falsifies **:41** (*"If you need to know how many were inserted versus updated,
`MERGE` will not tell you"*) — `merge_action()` does exactly that, better than the
`ON CONFLICT … RETURNING (xmax = 0)` trick the page recommends at :88.

PG17 also added `WHEN NOT MATCHED BY SOURCE`, unmentioned — yet :95–98 describes
reconciling a feed "where absent rows must be deleted" and shows no way to do it. The
page's proxy condition (`WHEN MATCHED AND s.v IS NULL THEN DELETE`) only fires for rows
that *are* in the source. Verified working on 18.4, returning `UPDATE`/`INSERT`/`DELETE`.

**Fix.** Replace **:107** and **:194** with:

```markdown
`MERGE` arrived in **PostgreSQL 15**. **PostgreSQL 17** added `RETURNING` with
`merge_action()`, and `WHEN NOT MATCHED BY SOURCE` for rows the source omits. On 16 and
earlier there is no `RETURNING`; on 14 and earlier no `MERGE` — use `ON CONFLICT`.
```

Replace **:88–92** with a `MERGE … RETURNING merge_action()` row and one sentence.
Delete the gotcha at **:148–150** (describes behaviour that doesn't occur on the target
version); replace with `merge_action()` unknown → PG16 or earlier. Strike the `RETURNING`
sentence from **:177**. Add ~40 lines on `NOT MATCHED BY SOURCE` after :98. Script: extend
`sandbox/pg-api/ex14-crud.mjs` §8.

**Keep the rest** — the core argument is right and well made: `MERGE` is not
index-arbitrated and `ON CONFLICT` is, so `MERGE` is wrong for concurrent upsert. The
`21000 cannot affect row a second time` material is a real gotcha most references omit.

---

## 3 · Twelve Phase 13 pages are stamps that pass every check

`phase-13-ops/07-pgbouncer.md` … `18-disaster-drill.md` — **66 lines each, identical
structure.** Being unwritten is fine. The problem is they don't *look* unwritten: each has
a tier badge, `## Gotchas` with two entries, and four Q&A. My audit grep for pages missing
a Gotchas section returned zero hits corpus-wide **because these have one**.

From `07-pgbouncer.md`: **:13** — *"`psql` is how you prove every later claim"* (boilerplate
about another topic) · **:17** — `## How it works` repeats :9 verbatim · **:23–27** — a
`pg_dump` block on a connection-pooling page · **:52** — *"★ What is the core idea of
'Connection limits and PgBouncer'?"* answered by re-pasting :9.

**Fix:** strip to `> Not yet written.` and delete the fake Gotchas and Q&A. Real content
already exists — `phase-7-pg-driver/10-prepared.md:116–131` covers transaction-pooling
breakage better than most published material; link it.

Also `docs/README.md:40` says *"270 pages … 13 topics outstanding"*. Actual: **269 files,
228 topics, 12 stamps.**

---

## 4 · Phase 0 — confounded measurement, and half the corpus depth

**`04-shared-buffers.md:50–78` · `WRONG`.** Presented as evidence for shared buffers:

```console
first 44.52 ms
second 2.64 ms
```

The script at :53–67 calls `once('first')` on a `Pool` that has never connected — so
44.52 ms is TCP connect, SCRAM auth, backend fork and session startup, none of which is
the buffer cache, all of which the second call skips. **:76** then states that wrong cause
in prose (*"second call is cheaper because catalogs are warm"*). Your global rule 3, on the
page whose entire job is explaining shared buffers.

**Fix:** measure `Buffers: shared read=N` → `hit=N` for the same query on **one already-warm
connection**. Script needed. If none is written, **delete :50–78** — no measurement beats a
measurement that proves something else. Keep the `show shared_buffers` transcript at :34–39
and the "where a row lives" table at :22–28.

**The phase overall:** 12 topics, 1398 lines, **116 per topic** against a corpus median of
226 — thinnest by a factor of two, and it holds two Master topics. `02-client-server-model.md`
(146, Master) says connections are expensive but never what the expense *is* — no `fork()`
cost, no per-backend RSS, no SCRAM round trips — so a reader cannot size a pool from it.
Its Node transcript at :87 cites `two-backends.mjs`, which **does not exist** in
`sandbox/pg-api/`, and the page has no `> Verified:` line. `11-vs-other-databases.md` is
the only non-stamp page in the corpus with no `Verified:` line at all.

Treat Phase 0 as a rewrite, not a patch. Reframe `02` from *a fact to know* to *a budget you
spend*: N MB of server RAM, each connection costs some, therefore the pool has a correct
size — and the whole page falls out.

---

## 5 · Ratings, gotchas, Q&A

**Scored only the 10 topics read in full** — a composite for a page I didn't read would be
invented. Rubric is the repo's own (D1 35 · D2 20 · D3 15 · D4 15 · D5 15).

| Topic | Tier | Lines | Score | Verdict |
|---|---|---|---|---|
| `phase-13-ops/07-pgbouncer.md` | UND | 66 | **0** | `STAMP` |
| `phase-0/04-shared-buffers.md` | UND | 112 | **3.7** | **`WRONG`** |
| `phase-0/02-client-server-model.md` | **MST** | 146 | **5.1** | `THIN` |
| `phase-4-crud/13-merge.md` | UND | 199 | **6.6** | **`WRONG`** |
| `phase-7/10-prepared.md` | UND | 220 | **8.8** | `SOLID` |
| `phase-3-ddl/03-foreign-keys.md` | **MST** | 226 | **9.2** | `SOLID` |
| `phase-10/05-index-not-used.md` | **MST** | 260 | **9.4** | `SOLID` |
| `phase-2-types/07-uuid.md` | UND | 192 | **9.5** | `SOLID` |
| `phase-5/01-inner-join/01-matching-pairs.md` | **MST** | 227 | **9.6** | `SOLID` |
| `phase-11-mvcc/06-isolation-levels.md` | UND | 257 | **9.7** | `SOLID` |

Three strata with no middle: the written corpus (8.8–9.7), Phase 0 (3.7–5.1), the stamps
(0). A page here is either genuinely good or unwritten — which keeps the fix list short.

The top scores are earned, not generous. On the D1 test — *could the reader predict a case
the page doesn't show?* — `05-index-not-used.md` teaches "casting the column is casting
every row", from which a reader predicts unprompted that `WHERE date_trunc('day',
created_at) = $1` fails. That's mechanism, not behaviour.

**Gotchas — the corpus's strongest feature.** 1519 across 270 files, **5.6 per page, every
page has a section**, symptom-first per §4.3. Done better than most published references,
because `**Symptom:** Deleting a parent is slow, and gets slower` is what someone types at
2am. The "everyone gets bitten once" case is present where it matters: unindexed FK
(measured 33.6 vs 8.7 ms), cast on the indexed side (0.073 vs 35.9 ms), `26000` behind
PgBouncer, v7 leaking creation time. **No action needed** beyond the 12 stamp copies.

**Interview Q&A — useful, not random.** 1452 questions, **5.3/page**, zero pages under 3,
only **14.2%** are "what is" openers. They survive follow-ups: *"Is `SET enable_seqscan =
off` a fix?"* pre-empts *"does it forbid seq scans?"* with "it reprices them rather than
forbidding them" — the correct answer most candidates miss.

**One real problem: 74% of questions are starred.** The brief says mark the
*frequently-asked* ones — at 74% the ★ identifies "questions", not a subset. This is the
failure your own tier rule names (*"if everything is MASTER, the labels carry no
information"*), and your 26.3% Master shows you already hold that line elsewhere. Cap ★ at
**one third**, defined as "asked verbatim in a real interview more than once".

The exception to all of the above is Phase 0 and the stamps, where answers restate the
page's opening line. `02-client-server-model.md` has 4 questions, **3 of them "what is"**,
on a Master page.

---

## What's already good — don't lose this in a rewrite

- **`phase-11-mvcc/06-isolation-levels.md`** is the best page in the repo. It measures
  SERIALIZABLE at 12.4 s against 71 ms for ordered `FOR UPDATE`, then argues against its
  own benchmark — naming the backoff as part of the cost and *refusing* to predict a
  smaller-pool result it didn't measure. That's exactly your global rule 3, self-applied.
- **`05-index-not-used.md`** — five causes, each measured, and it names the one where the
  planner is right. `enable_seqscan = off` framed as a diagnostic, not a fix.
- **`03-foreign-keys.md`** — `NO ACTION` vs `RESTRICT` shown through deferral; most
  references wrongly call them synonyms.
- **`07-uuid.md`** — attributes the v4 cost to B-tree locality rather than the 8 extra
  bytes, and proves it with the v7 number in between.
- **The example policy** (SQL + the `pg` call that issues it), enforced consistently — it's
  what makes this a fullstack reference rather than a database manual.
- **Version currency.** I swept every version-gated claim in the corpus; §2 is the *only*
  error. PG18 skip scan, `uuidv7()`, the generic-plan switch on the sixth execution, and
  the two distinct `40001` messages are all correct.

---

Next → [postgresql-syllabus-and-plan.md](postgresql-syllabus-and-plan.md)
