# 02 · The 300-line cap, read as a content budget

Answers ask **3f**. This is the corpus's main defect, and it is measurable rather than a
matter of taste — which is why I led with the measurement instead of an opinion.

> Your rule: *"The tell that you got this wrong: a run of pages all landing in a narrow
> band just under the cap. Real topic lengths vary widely. Clustering at ~200–290 is
> evidence of budgeting, not of topics that happened to be that size."*
> — `~/.claude/CLAUDE.md` §1

---

## 1 · The whole-corpus distribution

269 content files (READMEs excluded), computed with `wc -l`:

```
n=269   min=66   p25=202   median=226   p75=250   p90=273   max=299
```

| Band | Files | Share |
|---|---|---|
| 50–174 (Phase 0 + the 12 stamps) | 31 | 12% |
| **175–299** | **238** | **88%** |
| **300+** | **0** | **0%** |

**Not one file in 269 exceeds 299 lines.** The maximum is 299. With 269 files written
across 14 phases over months, a max of exactly 299 and zero overruns is not what
content-driven length looks like — it is what a budget looks like.

That said, the clustering statistic alone would be an unfair charge, because chunking is
*supposed* to keep files under 300. So I tested it properly.

---

## 2 · The real test — same tier, same corpus, 6× the depth

If the cap were being applied correctly (write the explanation, then split), topic
*totals* would vary by topic. They do — but they vary by **which phase you are in**, not
by what the topic needs.

Every **Master-tier** topic in the corpus, by total lines across all its chunks:

| Phases that chunk topics | Lines | Phases that never chunk | Lines |
|---|---|---|---|
| `phase-6/01-group-by/` | **1470** | `phase-4/07-update.md` | 292 |
| `phase-6/02-count-variants/` | **821** | `phase-4/08-parameters.md` | 291 |
| `phase-9/01-repository/` | **758** | `phase-7/03-connection-config.md` | 287 |
| `phase-6/03-having/` | **576** | `phase-10/05-index-not-used.md` | 260 |
| `phase-5/01-inner-join/` | **563** | `phase-4/06-on-conflict.md` | 234 |
| `phase-9/05-transactions-request/` | **560** | `phase-3/03-foreign-keys.md` | 226 |
| `phase-5/02-left-join/` | **514** | `phase-2/04-timestamptz.md` | 220 |
| `phase-12/01-jsonb-operators/` | **507** | `phase-11/03-read-committed.md` | 170 |
| `phase-5/03-semi-anti/` | **494** | `phase-10/03-explain.md` | **186** |
| `phase-9/04-allowlists/` | **382** | `phase-10/01-what-index.md` | **169** |

**Median Master topic: 530 lines in the chunked phases, 220 in the unchunked ones.**

The two rows that make the case on their own:

> **`count(*)` vs `count(col)` vs `count(DISTINCT col)` — 821 lines.**
> **`EXPLAIN` vs `EXPLAIN ANALYZE` — 186 lines.**

Both are Master. Both are in the same corpus, written to the same brief. `EXPLAIN` is the
tool the reader uses to diagnose every performance problem they will ever have, and the
syllabus itself calls its neighbour *"the single highest-value page in the syllabus"*
(`04-performance-and-production.md:28`). It gets 23% of the space given to counting rows.

Nothing about `EXPLAIN` is smaller than `count()`. It got less space because Phase 10 was
written before the rule was corrected, and Phase 6 after.

---

## 3 · The split is by phase, and the phase boundary is the date

| Phase | Topics | Lines/topic | Chunked topics | Stratum |
|---|---|---|---|---|
| **6 · Aggregation** | 16 | **633** | 16 of 16 | **A — written to the corrected rule** |
| **9 · API CRUD** | 18 | **311** | 5 of 18 | A |
| **5 · Joins** | 13 | **287** | 3 of 13 | A |
| **12 · Beyond tables** | 17 | **272** | 2 of 17 | A |
| 8 · Schema from Node | 14 | 251 | 1 of 14 | B |
| 4 · CRUD | 20 | 250 | **0** | **B — capped** |
| 7 · pg driver | 16 | 221 | **0** | B |
| 1 · psql | 15 | 219 | **0** | B |
| 3 · DDL | 19 | 213 | **0** | B |
| 10 · Indexes | 18 | **213** | **0** | B |
| 11 · MVCC | 16 | 211 | **0** | B |
| 2 · Types | 16 | 209 | **0** | B |
| 13 · Ops | 18 | 194 | 3 of 18 | **C — 12 stamps** |
| **0 · Architecture** | 12 | **116** | **0** | **C — never revised** |

**Eight phases — 132 topics, 58% of the corpus — contain not one chunked topic.** Phase 5
found three topics worth chunking out of thirteen; Phase 6 found sixteen out of sixteen.
Phases 0, 1, 2, 3, 4, 7, 10 and 11 found zero out of 132.

---

## 4 · The important nuance — this is not a quality problem

I read four Tier-B pages in full expecting to find them thin. **They are not.**
`phase-3-ddl/03-foreign-keys.md` (226 lines) and `phase-10-indexes/05-index-not-used.md`
(260 lines) are excellent: mechanism-first, measured, honest about the case where the
planner is right. They score 9.2 and 9.4 in [04-ratings.md](04-ratings.md).

So the finding is **not** "Tier B is badly written". It is:

> **Tier B is as good as it can be in 220 lines, and several of its topics need 500.**

What a capped page loses is not correctness — it is the *second half*: the case the page
does not show, the failure reproduced rather than described, the neighbouring concept it
should connect to. `03-explain.md` at 186 lines can define `EXPLAIN` and read one plan. It
cannot also cover cost units and what `cost=0.42..8.44` actually means, every node type
the reader will meet, `BUFFERS`/`WAL`/`SETTINGS`, `loops=` and why actual time is
per-loop, `rows=` estimate vs actual as the central diagnostic skill, or the JSON format
you parse from Node. Those are not padding. They are the reason someone reads an `EXPLAIN`
page.

The cost is invisible in review precisely because what is there is good. That is why this
needs measuring rather than reading.

---

## 5 · The proposed splits

Concept boundaries, never line counts. Ranked by payoff:

### 5.1 `phase-10-indexes/03-explain.md` (186) → `03-explain/` — est. 620

| Chunk | Contents |
|---|---|
| `01-reading-a-plan.md` | Tree shape, inside-out execution order, the two cost numbers, `rows`/`width`, `loops=` and per-loop actual time |
| `02-explain-vs-analyze.md` | `ANALYZE` actually runs it (and the `BEGIN`/`ROLLBACK` habit for writes), `BUFFERS`, `SETTINGS`, `WAL`, timing overhead |
| `03-estimate-vs-actual.md` | The single diagnostic skill: reading `rows=` against `actual rows` and what each gap means. Existing stale-stats material from `05-index-not-used.md` links here rather than duplicating |
| `04-explain-from-node.md` | `FORMAT JSON`, capturing plans for slow queries in a request path, and why you never `EXPLAIN ANALYZE` untrusted SQL |

### 5.2 `phase-11-mvcc/03-read-committed.md` (170) → `03-read-committed/` — est. 480

The default isolation level of the database, at 170 lines. Split: `01-statement-snapshots.md`
(a new snapshot per statement, what that means mid-transaction) · `02-the-anomalies-it-allows.md`
(non-repeatable read, phantom, read skew — each *shown failing*, which the page currently
only describes) · `03-the-recheck-rule.md` (`UPDATE` re-evaluating its `WHERE` against the
new row version — the mechanism behind lost update, currently taught only in `04-lost-update.md`).

### 5.3 `phase-2-types/04-timestamptz.md` (220) → `04-timestamptz/` — est. 520

The syllabus calls this *"the single most consequential type choice in a schema"* and gives
it 220 lines. Split: `01-what-it-stores.md` (UTC instant, not a zone — the misconception the
name causes) · `02-session-timezone-and-at-time-zone.md` · `03-node-and-the-driver.md`
(what `pg` hands back, `Date` vs string, the `date` off-by-one, storing vs displaying).

### 5.4 `phase-4-crud/06-on-conflict.md` (234) → `06-on-conflict/` — est. 500

The most-used Master statement in the phase. Split: `01-arbiters-and-do-nothing.md` (how the
unique index arbitrates — the mechanism `13-merge.md` correctly contrasts against but never
explains here) · `02-do-update-and-excluded.md` · `03-upsert-in-practice.md` (`xmax = 0` to
detect insert vs update, partial-index arbiters, and why concurrent upsert still needs the
retry).

### 5.5 Phase 0 — see [03-accuracy-findings.md](03-accuracy-findings.md) §3

Phase 0 is a different problem (116 lines/topic, and one page is wrong). Handle it as a
rewrite, not a split.

---

## 6 · The guard for next time

The clustering tell is cheap to check, and it would have caught this months ago. Run it
after each phase:

```bash
# any phase whose Master topics never exceed ~300 total lines is suspect
cd docs/<lang>/pages
for d in phase-*; do
  for f in $d/*.md; do case "$f" in */README.md) continue;; esac
    grep -q t-master "$f" && printf "%4d  %s\n" "$(wc -l < "$f")" "$f"; done
  for t in $d/*/; do grep -q t-master "$t/README.md" 2>/dev/null &&
    printf "%4d  %s\n" "$(cat $t/*.md | wc -l)" "$t"; done
done | sort -rn
```

If the Master topics in a phase all land in one narrow band, the phase was budgeted. A
healthy phase looks like Phase 6: 1470, 821, 576 — wildly uneven, because topics are.

---

← [01 · Syllabus review](01-syllabus-review.md) · Next → [03 · Accuracy findings](03-accuracy-findings.md)
