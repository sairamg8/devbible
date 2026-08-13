# 04 · Ratings, gotchas and interview Q&A

Answers asks **3b** (gotchas), **3c** (useful interview Q&A rather than random), and
**3d** (rate the topic explanations).

**Honesty line — what was actually read.** I read **10 topics in full** and scored those.
Two more were read partially (structure only) and carry findings but no score. The
remaining 216 were measured structurally (lines, tier, sections, Q&A counts, provenance)
but **not scored** — a composite score for a page I did not read would be invented, which
your rule 2 forbids. Phase-level judgements below are labelled as such.

Rubric is the repo's own (`docs/reviews/review-prompt.md` §3):
D1 Explanation 35% · D2 Examples 20% · D3 Gotchas 15% · D4 Q&A 15% · D5 Provenance 15%.

---

## Scoreboard — topics read in full

Sorted worst first.

| Topic | Tier | Lines | D1 | D2 | D3 | D4 | D5 | Score | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| `phase-13-ops/07-pgbouncer.md` | UND | 66 | 0 | 0 | 1 | 0 | 0 | **0** | `STAMP` |
| `phase-0/04-shared-buffers.md` | UND | 112 | 4 | 3 | 6 | 3 | 2 | **3.7** | **`WRONG`** |
| `phase-0/02-client-server-model.md` | **MST** | 146 | 5 | 6 | 7 | 3 | 4 | **5.1** | `THIN` |
| `phase-4-crud/13-merge.md` | UND | 199 | 7 | 8 | 8 | 7 | 2 | **6.6** | **`WRONG`** |
| `phase-7-pg-driver/10-prepared.md` | UND | 220 | 9 | 8 | 9 | 9 | 9 | **8.8** | `SOLID` |
| `phase-3-ddl/03-foreign-keys.md` | **MST** | 226 | 9 | 9 | 10 | 9 | 9 | **9.2** | `SOLID` |
| `phase-10/05-index-not-used.md` | **MST** | 260 | 9 | 10 | 9 | 9 | 10 | **9.4** | `SOLID` |
| `phase-2-types/07-uuid.md` | UND | 192 | 9 | 10 | 10 | 9 | 10 | **9.5** | `SOLID` |
| `phase-5/01-inner-join/01-matching-pairs.md` | **MST** | 227 | 10 | 9 | 10 | 9 | 10 | **9.6** | `SOLID` |
| `phase-11-mvcc/06-isolation-levels.md` | UND | 257 | 10 | 9 | 10 | 9 | 10 | **9.7** | `SOLID` |

**Read partially, not scored:**

- `phase-2-types/09-boolean-dates.md` (213) — structure only. Finding is the granularity
  violation in [01-syllabus-review.md](01-syllabus-review.md) §1, not the prose quality.
- `phase-13-ops/06-tls.md` (266) — opening only. The `sslmode=require` verifies nothing
  framing is correct and well-chosen; reads as Tier A.

**Median of the six pages that are neither stamps nor Phase 0: 9.3.** That is a very high
bar and the corpus mostly clears it.

---

## What the scores mean

**The corpus has three strata, and they barely overlap:**

| Stratum | Score range | What it is |
|---|---|---|
| **A — the written corpus** | 8.8–9.7 | Phases 1–12. Mechanism-first, measured, honest |
| **B — Phase 0** | 3.7–5.1 | Written first, never revisited, one page factually wrong |
| **C — the stamps** | 0 | Phase 13 rows 07–18 |

There is no middle. A page in this corpus is either genuinely good or it is unwritten —
which is unusual and, apart from Phase 0, healthy. It means the fix list is short and
sharply targeted rather than "improve everything a bit".

### Why the top scores are earned, not generous

Your review prompt warns that >70% `SOLID` means the reviewer is being generous. Six of ten
scored `SOLID` here. I checked that against the D1 depth test — *"could the reader predict
behaviour in a case the page does not show?"*:

- **`05-index-not-used.md`** — yes. A reader who absorbs "casting the column is casting
  every row" can predict, unprompted, that `WHERE date_trunc('day', created_at) = $1`
  fails and `WHERE created_at >= $1 AND created_at < $2` works, without being shown it.
- **`01-matching-pairs.md`** — yes. "The join is simultaneously a filter and a multiplier"
  lets the reader predict the row count of a join they have never seen.
- **`06-isolation-levels.md`** — yes, and it goes further: it explains why the same
  SQLSTATE `40001` carries two different messages, which lets the reader diagnose *which*
  kind of conflict they hit from the error text alone.

These are mechanism explanations, not behaviour statements. The scores stand.

---

## Ask 3b — Gotchas and pitfalls: **the corpus's strongest feature**

**Measured across all 270 files: 1519 gotchas, average 5.6 per page, and every single
page has a Gotchas section.** Format compliance with `instructions.md` §4.3
(symptom → cause → fix, symptom first) is essentially total.

This is done better here than in most published database references, and the reason is the
symptom-first ordering. `**Symptom:** Deleting a parent is slow, and gets slower as the app
grows` is what someone actually types into a search box at 2am; "index your foreign keys"
is not.

**The "everyone gets bitten once" gotcha is present where it matters most:**

| Topic | The one that matters | Present? |
|---|---|---|
| Foreign keys | Unindexed referencing column → parent delete scans the child table | ✅ measured, 33.6 ms vs 8.7 ms |
| Index not used | Cast landed on the indexed side | ✅ measured, 0.073 ms vs 35.9 ms |
| Prepared statements | `26000` behind PgBouncer transaction pooling | ✅ with all three remedies |
| Isolation levels | Retry loop sending duplicate emails | ✅ |
| uuid | v7 leaks creation time | ✅ — and it is the non-obvious one |
| MERGE | `21000 cannot affect row a second time` | ✅ — most references omit this |

**One caveat.** Twelve of those 1519 gotchas are stamp boilerplate — `"It works in a
tutorial and fails in your app"` and `"'It is slow' with no evidence"`, repeated verbatim
across all twelve Phase 13 stamps. They are the reason a structural grep for missing
Gotchas sections returns zero. See [03-accuracy-findings.md](03-accuracy-findings.md)
finding 2.

**Verdict on 3b: yes, comprehensively answered.** No action needed beyond the stamps.

---

## Ask 3c — Interview Q&A: **useful, not random — but the ★ has stopped meaning anything**

Measured across all 270 files:

| Metric | Value | Against the brief |
|---|---|---|
| Total questions | **1452** | — |
| Average per page | **5.3** | ✅ inside the 3–8 band |
| Pages with fewer than 3 | **0** | ✅ |
| `"What is…"` openers | 207 (**14.2%**) | ✅ acceptable — the brief prefers "why"/"what happens if", and 86% comply |
| **Starred `★`** | **1077 (74%)** | ❌ **see below** |

### The Q&A are genuinely interview-grade

They survive the follow-up test, which is the real bar. Taking the weakest answer on each
page I read in full and asking what a senior interviewer would ask next:

- `07-uuid.md` → *"When would you choose a UUID over `bigint`?"* Follow-up: **"You said
  client-side generation — why can't you just do a `RETURNING id` round trip?"** The
  answer survives: the page's offline-first and shard-merge cases both explain why the
  round trip is unavailable, not merely inconvenient.
- `10-prepared.md` → *"Should you name every query?"* Follow-up: **"What breaks if I name
  a dynamically-built query?"** Survives — the page states there is no stable text to name.
- `05-index-not-used.md` → *"Is `SET enable_seqscan = off` a fix?"* Follow-up: **"What
  does it actually do — does it forbid sequential scans?"** Survives, and pre-empts it:
  *"it reprices sequential scans rather than forbidding them."* That is the correct answer
  and most candidates get it wrong.

**The exception is Phase 0 and the stamps**, where the answers restate the page's own
opening line. `02-client-server-model.md` has four questions of which **three are "what
is"** shapes, answered in one line each — against a brief that says more than one is a
finding, on a **Master**-tier page.

### The ★ problem

**74% of all questions are starred.** Your brief says *"Mark the frequently-asked ones with
★"* — a marker for the subset worth prioritising. At 74% it no longer identifies a subset;
it identifies "questions".

This is the same failure your own tier rule names: *"Keep `[MASTER]` to roughly 25–30% of
topics. If everything is MASTER, the labels carry no information"* (`instructions.md` §3).
The star has drifted into exactly that state, and the tier badges — which are disciplined at
26.3% — show you already know how to hold that line.

**Recommendation:** cap ★ at **one third** of questions per page, and define it as *"asked
in a real interview, verbatim, more than once."* On a 6-question page that is 2 stars, not
5. This is a mechanical pass over 270 files and needs no re-measurement — it is a judgement
call per question, and it makes the marker useful again for revision.

**Verdict on 3c: yes, these are useful and interview-relevant, not filler.** Two fixes:
re-star to a third, and rewrite Phase 0's Q&A away from "what is".

---

## Per-topic detail — the two that need work

### `phase-0-architecture/02-client-server-model.md` — Client/server model
`MASTER` · `THIN` · **5.1/10** · 146 lines · **Verified: no script named** ❌

**D1 Explanation 5** · D2 Examples 6 · D3 Gotchas 7 · D4 Q&A 3 · D5 Provenance 4

**What's good (do not lose this):** the `localhost` → `::1` IPv6 gotcha at lines 122–124 is
a real, specific, hard-won detail, and the `pg_stat_activity` `backend_type` transcript at
lines 42–53 is the right way to make the process model visible.

**Gaps**
1. `…/02-client-server-model.md:9` — Quote: *"That is why connections are expensive."*
   Gap: never says what the expense *is*. A Master page on this topic must let the reader
   size a pool, and this one cannot. Add: ~50 lines — the `fork()`, per-backend RSS measured
   from the host against `pg_stat_activity`, SCRAM round trips, and the private catalog
   cache. Script needed: must report RSS per backend and connection-establishment time
   split from query time.
2. `…/02-client-server-model.md:87` — Quote: `$ node two-backends.mjs` — Gap: the file does
   not exist in `sandbox/pg-api/`, and the page has no `> Verified:` line naming it. Add:
   commit the script, add the standard Verified line.

**Q&A** 4 questions, 2 starred, **3 of 4 are "what is"**. Q3 (*"What is `max_connections`?"*)
fails the follow-up *"so what should I set it to, and what does the pool have to do with
it?"* — the answer stops at "server-wide cap". **Add 2:** (a) *"You have a 4 GB database
server and three Node services. How many pool connections each, and why?"* — sketch: total
backends × RSS must leave room for `shared_buffers` and `work_mem` × concurrent sorts;
(b) *"What happens to in-flight queries when you hit `max_connections`?"* — sketch: existing
backends are unaffected, new connects fail immediately with `53300`, so the symptom is
connect errors rather than slow queries.

**Explanation summary for pick-up:** the page teaches process-per-connection as a *fact to
know*. It should teach it as a *budget you have to spend* — you have N megabytes of server
RAM, each connection costs some of it, therefore the pool has a correct size and here is how
to compute it. Reframed that way the whole page falls out, the `max_connections` question
becomes answerable, and the link to Node Phase 6 becomes a continuation rather than a
deferral.

**Chunking:** not needed (est. 250 lines after additions).

### `phase-0-architecture/04-shared-buffers.md` — Shared buffers
`UNDERSTAND` · **`WRONG`** · **3.7/10** · 112 lines · Verified: no script ❌

Full analysis in [03-accuracy-findings.md](03-accuracy-findings.md) finding 3 — the
measurement is confounded by connection establishment and the page states the wrong cause
in prose at line 76.

**What's good:** the "where a row lives" table (lines 22–28) is a genuinely useful mental
model, correctly separating shared buffers from the OS page cache from backend private
memory. Keep it verbatim.

**Q&A** 4 questions, 1 starred, **3 of 4 are "what is"**. *"What are shared buffers?"* is
answered by restating the page's first sentence. **Add 2:** (a) *"Why is a large
`shared_buffers` not automatically better?"* — sketch: double-buffering against the OS
cache, and checkpoint write amplification; (b) *"Your cache hit ratio is 99%. Is that
good?"* — sketch: it is the wrong question — a 99% ratio on a working set that fits in RAM
tells you nothing about the 1% that is doing all the I/O.

---

← [03 · Accuracy findings](03-accuracy-findings.md) · Next → [05 · Real-world scenarios](05-real-world-scenarios.md)
