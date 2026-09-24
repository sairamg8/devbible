---
name: progress-java-python-syllabus
description: devbible — Java + Python syllabi → JAVA PAGES (session 01HjXPf1, 2026-08-17)
metadata:
  type: progress
---


> 🔴🔴 **DO NOT READ THIS FILE TO START WORK.** It is ~1,400 lines of audit trail.
> **The Java cursor is `CURSOR-JAVA.md` in this directory — 90 lines, and it is the whole
> instruction.** Open this file only when the cursor is contradicted by what is on disk,
> and then `grep`/`sed -n` the section you need rather than reading it whole.
> (Added 2026-08-28.)

# devbible — Java + Python syllabi → JAVA PAGES (session 01HjXPf1, 2026-08-17)

🔴 **JAVA IS LOCKED TO THIS SESSION AND PAGES ARE IN PROGRESS.** The user approved
and ordered the pages the same evening: *"Can you immediately start workring on
java ? … start working on it to finish the lanaguage"*. Run to completion, phase by
phase 0 → 16, per-file board updates, memory every 2–3 files.

## 🔴🔴 THE USAGE KILL SWITCH — hard rule, set 2026-08-18

The user, verbatim: *"one crucial request when i said we reached 80 or 90% usage
immediately kill everything and wire UI and make sure new session auto pickup where
you left off"*.

**The moment the user says usage has hit 80–90% (or you see it yourself):**

1. **KILL everything immediately** — no new forks, no new topics, and do not wait
   for in-flight forks to finish a topic. Stop dispatching mid-sentence if needed.
2. **Wire the UI with whatever is on disk** — phase README rows for every completed
   file, `src/data/progress.js` counts, `docs/java/pages/README.md` board,
   `docs/README.md` rows. Partial topics get their completed chunks linked and the
   topic marked in-progress.
3. **Commit explicit paths, then update THIS file's START HERE table** to name the
   exact next file to write, and commit the store.
4. A new session told "continue with java" reads THIS file first and starts at the
   cursor — no re-derivation, no questions.

This is the generalisation of the 2026-08-18 "Do not deploy more we are 95% usage"
order and it applies to **every future Java session, at 80% — not 95%**.

## 🔴 START HERE (the live cursor)

### 🔴🔴 SESSION `0f9ee927` — 2026-08-27 — ✅ PHASE 10 CLOSED 14/14 · START AT PHASE 11

**This supersedes every section below it.** Phase 10 · Data access is **complete**: all 14
topics written and indexed. **Java stands at 153/232, phases 0–10 done.**

🔴 **The next session starts at PHASE 11 · TESTING (11 topics, 0 written).** Read
`docs/java/syllabus/` for its topic table and begin at topic 01, in row order. Scaffold
`docs/java/pages/phase-11-testing/` — check whether it exists before assuming.
**Remaining: 79 topics across phases 11–16** — 11 (11) · 12 (15) · 13 (14) · 14 (12) ·
15 (14) · 16 (13).

#### 🔴🔴 SESSION `f45e7c15` — 2026-08-27 — PHASE 11 SALVAGED AND RESUMED

**The three 2026-08-27 forks were killed mid-topic. Everything they wrote is now committed**
(`a26d542e`), QC'd rather than assumed. Topic state, as of this session:

| Topic | Chunks on disk | `sidebar_position` | Next file |
|---|---|---|---|
| **01 · JUnit 5** | 23 (01 → 09b) | 1–23 | `10-extensions.md` @ 24, then 11 → 15 + README — **held by a fork** |
| **02 · AssertJ** | ✅ **CLOSED — 24 + README** | 1–24 | — nothing queued |
| **03 · Parameterized** | 20 (01 → 08e) | 1–20 | `09-when-not-to-parameterize.md` @ 21, then 10 + README — **held by a fork** |

⚠️ **Both forks died to mid-response network errors and were RESUMED, not restarted**
(`SendMessage` to the agent id keeps its transcript). Neither lost a file, because both were
writing each chunk to disk before researching the next — that instruction is worth repeating
in every fork brief. The first topic-01 fork died having written nothing and was
re-dispatched; the second time both had files on disk and resuming was correct.

⚠️ **Positions drifted well past the plan because the forks split aggressively and correctly**
— `07-display-names` 354 → four files, `08b-aggregation` 403 → split, `08c` 399 → three,
`06d-tagging` 340 → two, `09-tempdir` 306 → two. **Always re-read the actual positions off
disk before telling a fork where to continue**; the numbers in a plan table go stale within
one chunk.

✅ **TOPIC 02 · AssertJ IS CLOSED (`ce752481`) — 24 chunks + README, ~5,600 lines.** QC run,
not assumed: `sidebar_position` sequential 1–24 with no gaps or reuse, **0 files over the
300-line cap, 0 MDX hazards**, and **138 markdown links resolved against the filesystem** —
the only 2 unresolved are `../01-junit-5/README.md` and `../03-parameterized-tests/README.md`,
which the forks holding those topics have not written yet. **NOT a build.**

🔴 **The AssertJ doc site is not a sufficient source and cost this session two dead ends.**
`https://assertj.github.io/doc/` **truncates mid-page**, before soft assertions, custom
assertions, `Optional`, temporal assertions and descriptions. `javadoc.io` returns **403** to
WebFetch. What works, and what topic 02 was actually written from:

```
https://raw.githubusercontent.com/assertj/assertj/assertj-build-3.27.7/assertj-core/src/main/java/org/assertj/core/api/<Class>.java
```

The tag is **`assertj-build-3.27.7`** — not `v3.27.7`, not `3.27.7`, both 404. The class
javadocs are a *better* source than the doc site: they carry the argument, the exact wording
of each failure mode, and worked examples the site omits. Several of topic 02's strongest
findings came straight out of them — `hasValue` being literally `return contains(x)`,
`isEqualToIgnoringNanos` failing on a 1ns difference by its own example, the
`SoftAssertions` javadoc's bolded warning that a forgotten `assertAll()` means the test
*"will pass"*, and `SoftAssertionsExtension` refusing to inject into lifecycle methods.

🔴 **Each topic's `_plan.md` carries a "SALVAGE STATE" table naming the EXACT filenames and
positions the remaining chunks must use.** The committed chunks already link to those names
and the forks' names drifted from the original plan tables — **the links win**. Read the
plan before writing a chunk in any of these three topics.

**Salvage QC that was actually applied**, not just run:
- `02-assertj/03c-extracting` came off the fork at **314 lines** → split on the
  String-overload boundary into `03c` + `03d-extracting-by-name`.
- Two links pointed at filenames that do not exist: `04b-fieldsource` → `04c-fieldsource`,
  and `03d-filtering-and-navigating` → **`03e`** (03d is now the extracting split).
- **15MB of downloaded javadoc jars and scratch HTML** the forks left inside the topic
  directories was removed. Research byproduct, never content.

🔴 **A real correctness defect was found in the salvaged `01-junit-5/03b`** and fixed
(`811891aa`): it carried "a `@Nested` class cannot declare `@BeforeAll`, because an inner
class cannot have `static` members". **That expired at Java SE 16** — JLS SE 25 §8.1.3 says
an inner class *"may declare and inherit `static` members"*, with the historical note that
the restriction held *"prior to Java SE 16"*. JUnit 6 baselines Java 17 and the nested-tests
page documents full lifecycle support *"on each level"*. `PER_CLASS` is a **choice** there
now, not a workaround. **Do not let any fork reintroduce the pre-16 rule** — it is what every
tutorial still says.

Written by this session so far: `01/06b-nested-tests` + `01/06c-nesting-lifecycle-and-limits`
(`811891aa`), `02/03e-filtering` + `02/03f-navigating-to-elements` (`f92a8269`).
Two `devbible-author` forks hold topics **01** and **03**; the coordinator holds **02**.
⚠️ The first topic-01 fork died to a mid-response network error having written nothing and
was re-dispatched — forks are now told to write each file to disk before starting the next.

#### 🔴 PHASE 11 IN FLIGHT — the spine, verified 2026-08-27, do not re-derive

Everything is scaffolded: `docs/java/pages/phase-11-testing/` has all 11 topic directories,
each with a `_plan.md`, plus an excellent `_PHASE-NOTES.md` carrying the phase boundaries and
three traps. **Read `_PHASE-NOTES.md` first — it is binding.**

Read straight out of `spring-boot-dependencies:4.1.0`'s POM on Maven Central:
**JUnit (Jupiter) `org.junit:junit-bom:6.0.3` · Mockito 5.23.0 · AssertJ 3.27.7 ·
Testcontainers 2.0.5 · Hamcrest 3.0 · JSONassert 1.5.3 · XMLUnit 2.11.0 · Awaitility 4.3.0.**

🔴🔴 **JUnit is at 6, not 5** — and topic 01's directory is `01-junit-5`. **Do not rename it**
(the ecosystem still calls the Jupiter model "JUnit 5", and inbound links point at the
directory); verify content against the **JUnit 6** docs and reconcile the two in topic 01's
prose. Banked in `_PHASE-NOTES.md` (`16acd558`) so no later fork re-derives it. The phase notes
had told each fork to check the versions itself — doing it once centrally is what surfaced this.

**Dispatched 2026-08-27 (killed; salvaged — see the session `f45e7c15` block above):**
topics 01 (JUnit), 02 (AssertJ), 03 (Parameterized). Order after those: 04 Mockito · 05 the pyramid · 06 MockMvc · 07 Testcontainers ·
08 test data · 09 JaCoCo · 10 jqwik · 11 PIT.

#### Phase 10 final state — audited, not assumed

**569 files / ~141,700 lines**, 14/14 topics indexed. Verified across the whole phase:
**0 files over the 300-line cap · 0 dangling links · 0 MDX hazards.** Links were resolved
**against the filesystem**, not with `fixlinks.py` — see the audit command below, which is the
only check that finds these.

Closed by this session: **12 · Caching** (35 chunks, `f3fd7b07`), **10 · Lazy-loading
pitfalls** (35, `4dd24bda`), **11 · Migrations with Flyway** (44, `168fbebd`). Boards wired in
`478ca0bd`. Per-topic memories: `progress_java_p10_t10_lazyloading.md`,
`…_t11_flyway.md`, `…_t12_caching.md` — the last two carry banked verbatim quotes and the
claims that could **not** be confirmed in the documentation.

**3 `*(not written yet)*` placeholders remain in the phase and are deliberate**: Phase 15
(Messaging) ×2 and Phase 11's test pyramid ×1. Repoint the Phase 11 one when Phase 11 lands.


### 🔴🔴 SESSION `0f9ee927` — 2026-08-27 — CONTINUING BATCH 6 · SUPERSEDES EVERY SECTION BELOW

Successor to `8f239b23`. **Start at exactly the file this table names.**

Phase 10 is **11/14 closed**, Java **150/232**. Topics 09, 13, 14 are closed with indexes and
need nothing. Topics **10, 11, 12 are the whole remaining job**, and each needs its last
chunks *and* a `README.md` index — **a topic is not closed without one**, and its phase README
row stays *(in progress)* until it exists.

| Topic | On disk | 🔴 Next file | `sidebar_position` | Memory |
|---|---|---|---|---|
| **10 · Lazy-loading** | 34 chunks, no index | finish the `09b-symptom-to-chunk.md` split (it is 322 lines), then `README.md` | **35** | `progress_java_p10_t10_lazyloading.md` |
| **11 · Flyway** | 38 chunks, no index | `11c`/`11d` (the rest of the `11-testing-migrations` split), then `12-the-checklist.md`, `README.md` | **39** | `progress_java_p10_t11_flyway.md` |
| **12 · Caching** | ✅ **CLOSED 35 chunks + index** (`f3fd7b07`) | — nothing queued | — | `progress_java_p10_t12_caching.md` |

**Phase 10 is 12/14, Java 151/232.** Boards wired in `da809997`.

**Landed 2026-08-27, session `0f9ee927`** (`6d7d4d39`, `63d413e5`, `0a1d0ea2` — 18 chunks):
T10 `08c`+`08c2`–`08c5` (the enhancement-on failures, split five ways) and `09-the-checklist`;
T11 `10c`+`10c2`+`10c3`, `11-testing-migrations`, and the missing Interview questions on
`09-many-instances-one-database`; T12 `07d`+`07e`+`07f` and `08`+`08b`+`08c`+`08d`.
All under the cap, 0 MDX hazards, positions sequential with no duplicate and no gap.

⛔ **The "ONE KNOWN DEFECT" below is STALE — do not act on it.**
`10-lazy-loading/07b-doing-the-migration.md` is **216 lines**, not 318; that split was already
done. **Nothing in phase 10 is over the cap.** The real salvage this session was
`10-lazy-loading/08-lazy-basic-attributes.md`, left uncommitted at 379 lines by `8f239b23` and
split into `08` (175) + `08b-the-lob-reflex-and-the-group.md` (256) in `f7eaeb74`.

🔴 **`fixlinks.py` cannot be trusted alone here.** It reported 0 unresolved on three links to
chunks that do not exist. Resolve every `](*.md)` target with `ls`. See the topic-10 memory.

🔴 **`README.md` is `sidebar_position: 0`** with `sidebar_label: "Overview"` — position 1 is
each topic's `01-*.md`. Copy `09-spring-data-jpa/README.md`'s shape.

#### 🔴 The phase-wide link audit `fixlinks.py` cannot do

Run this from `docs/java/pages/phase-10-data-access/`. It resolves every `](*.md)` target
against the filesystem, which is the check the python resolver silently passes:

```bash
find . -name '*.md' ! -name '_*' | while read f; do d=$(dirname "$f"); \
  grep -o '](\([^)]*\)\.md)' "$f" | sed 's/^](//;s/)$//' | while read l; do \
    [ -e "$d/$l" ] || echo "${f#./} -> $l"; done; done
```

2026-08-27, session `0f9ee927`: **0 files over the cap** across the whole phase, and **10
dangling links** — every one of them reported clean by `fixlinks.py`. Three kinds:

1. **A live 404 from rename drift.** `12-caching/06-hibernate-second-level.md` pointed at
   `06c-turning-it-on.md`; a later split moved that chunk to `06d` and gave `06c` to the
   mapping/strategies page. Repaired in `67ea73a0`.
2. **Links to chunks that were planned and never written** —
   `11-flyway-migrations/10c-when-it-should-not-be-a-migration.md` (linked from `10` and
   `10b`) and `12-caching/07d-the-invalidation-you-forgot.md` (linked from `07`). Neither was
   in any resume table; both were only visible through this audit.
3. **Forward references to the chunks still queued** — `08c`, `09b`, `08-when-not-to-cache`,
   `11-testing-migrations`. These resolve as the topics close.

**Run this audit before declaring any topic closed.** A chunk plan that got split is exactly
how kind 1 and kind 2 are created, and neither the build's `onBrokenLinks` warning nor the
resolver will hand them to you.

#### The `*(not written yet)*` placeholder sweep — seam 1, done

31 of the 59 phase-10 placeholders were stale: topics 02, 03, 05, 06, 08, 13 and 14 have all
closed with indexes since those sentences were written. Repointed in `6020cd04` (19) and
`5a97e38e` (12) — the second pass existed only because **the first pass's regex missed every
placeholder that wrapped across a line break**. If you sweep these again, match across `\n`.

Four of them named a *chunk*, not a topic, and an index link would have been the wrong answer:
`"the shape that survives failure"` and `"returning a connection mid-transaction"` both →
`03/02-commit-rollback-and-the-shape-that-survives.md`; `"Topic 03's killer bug"` →
`03/08b-the-level-and-the-pool.md`; `"chunk 21 · SQLException"` → `01-jdbc/21-sqlexception.md`.
**Read the sentence before repointing** — the placeholder text says how precise the link owes
to be.

**8 left, all deliberate:** 2 × Phase 15 (Messaging), which is genuinely unwritten, and 6
pointing at topics 10/11/12. Repoint those 6 the moment each topic's `README.md` lands.



### 🔴🔴 SESSION f046b762 — 2026-08-27 — BATCH 6 CLOSED BY THE 95% KILL SWITCH

**This supersedes every resume table below it. Start at exactly the file its row names.**

The user: *"Kill all and save the progress we are at 95 of usage"*. All three live forks were
stopped immediately, everything on disk was QC'd and committed, all four boards were wired,
and this cursor was repointed. **Nothing was lost** — every file the killed forks had written
was complete, footer included; there was no truncated scrap.

**Committed:** `d0337aa5` (91 files / 20,633 lines, the six topic directories) and `1b42cf89`
(all four boards). Phase 10 is **11/14 closed**, Java **150/232**. 194 chunks on disk across
the six topics: 09·49 10·25 11·34 12·27 13·33 14·26.

| Topic | State | 🔴 Next file | `sidebar_position` | Per-topic notes |
|---|---|---|---|---|
| **09 · Spring Data JPA** | ✅ **CLOSED** 49 chunks + index | — nothing queued | — | `progress_java_p10_t09_springdata.md` |
| **10 · Lazy-loading** | 🔴 killed at 25 chunks, **no index** | `08-lazy-basic-attributes.md` | **26** | `progress_java_p10_t10_lazyloading.md` |
| **11 · Flyway** | 🔴 killed at 34 chunks, **no index** | `11-testing-migrations.md` | **34** | `progress_java_p10_t11_flyway.md` |
| **12 · Caching** | 🔴 killed at 27 chunks, **no index** | `08-when-not-to-cache.md` | **27** | `progress_java_p10_t12_caching.md` |
| **13 · jOOQ** | ✅ **CLOSED** 33 chunks + index | — nothing queued | — | `progress_java_p10_t13_jooq.md` |
| **14 · Mongo/Redis** | ✅ **CLOSED** 26 chunks + index | — nothing queued | — | `progress_java_p10_t14_springdata_other.md` |

After each of 10, 11 and 12 finishes its last two planned chunks it still needs its
`README.md` index — **a topic is not closed without one**, and the phase README row stays
*(in progress)* until it exists.

#### 🔴 THE ONE KNOWN DEFECT — fix this FIRST, before writing anything new

`docs/java/pages/phase-10-data-access/10-lazy-loading/07b-doing-the-migration.md` is
**318 lines**. It is committed that way deliberately, to save the work rather than lose it at
95% usage. **Split it on the `## Step 2 · Read each exception properly` boundary** (line ~115)
into `07b` (Step 0 + Step 1, the test suite) and a new `07b2` (Step 2 onward), each with its
own frontmatter, tier badge, `> Verified:` line, Gotchas and Interview questions, and
distribute the existing gotchas and questions to whichever half each belongs to. Nothing is
trimmed. Then bump the `sidebar_position` of `07c` and everything after it. It is the only
file in the phase over the cap.

#### Seams the coordinator still owes the phase

1. **Stale forward links.** Topic 09's pages reference topics **13 and 14** as bold plain text
   plus *(not written yet)* — both now have a `README.md` on disk, so those become real links.
   Likewise, once 10/11/12 have indexes, every *(not written yet)* pointing at them resolves.
2. **`README.md` is `sidebar_position: 0`, not 1.** All three closing forks found this
   independently: position 1 is taken by each topic's `01-*.md`, and every phase-10 topic index
   uses 0 with `sidebar_label: "Overview"`. **My dispatch said 1 and was wrong** — use 0.
3. **Real footers.** Every page still ends with the literal `{/* FOOTER */}` placeholder.
4. **`_plan.md` files are stale everywhere** — they list the original 8–13 chunk plans against
   25–49 on disk. That is expected (the cap forces splits); the plans give argument order only,
   and **the disk is authoritative**.

#### What the forks proved about the dispatch shape

Six forks, ~194 chunks. Every one of them split well past its plan (topic 09: 8 planned chunks
became 19; topic 14's `05` became `05`–`05e`) and **none trimmed to fit** — which is the rule
working. Two forks corrected real defects they were not asked to look for: topic 09 repaired
two live 404s (`03b-native-queries.md` had been renamed `03g-` by an earlier split) and caught
itself writing folklore about missing fragment implementations, then fixed both pages off the
`RepositoryFactorySupport` source. **Keep the "read `_plan.md` and the topic's progress memory
first, the disk is authoritative" clause** — it is what let them diverge correctly.

---


### 🔴🔴 SESSION fe13fcef — 2026-08-27 — PHASE 10 BATCH 6 · CURSOR RE-DERIVED FROM DISK

**What happened.** Session `69f1de49` closed abruptly leaving **5 files written but
uncommitted**. They were QC'd and committed (`8216839c`): T09 `05b` + `05b2`, T11 `08` +
`08a`, T13 `08`. `11/08a` came in at **314 lines** and was split on the `NOT VALID`
concept boundary into `08a` (columns + CHECK + FK) and **`08a2-adding-indexes-and-enum-values.md`**
(index, unique-via-`USING INDEX`, enum) — nothing trimmed, gotchas and questions
distributed to the half each belongs to. All four boards wired (`33f5222e`).

🔴 **RESUME TABLE — re-derived from disk 2026-08-27, this supersedes the 2026-08-26 one
below. Start at exactly this file. No plan, no confirmation, no clarifying question.**

| Topic | Chunks on disk | 🔴 Next file | `sidebar_position` | Per-topic research + notes |
|---|---|---|---|---|
| **09 · Spring Data JPA** | 29 | `06-projections.md` | **30** | `progress_java_p10_t09_springdata.md` |
| **10 · Lazy-loading pitfalls** | 9 | `04-the-detached-entity.md` | **10** | `progress_java_p10_t10_lazyloading.md` |
| **11 · Migrations with Flyway** | 23 | `08b-locks-and-long-migrations.md` | **24** | `progress_java_p10_t11_flyway.md` |
| **12 · Caching** | 10 | `05-redis-as-the-store.md` | **11** | `progress_java_p10_t12_caching.md` |
| **13 · jOOQ** | 26 | `08b-using-both.md` | **27** | `progress_java_p10_t13_jooq.md` |
| **14 · Spring Data Mongo/Redis** | 9 | `03d-aggregation-from-java.md` | **10** | `progress_java_p10_t14_springdata_other.md` |

### 🔴 SESSION f046b762 — 2026-08-27 — BATCH 6 DISPATCHED

All six `devbible-author` forks are **in flight** against the resume table above (09 row corrected from disk: 05c/05c2 landed in `fa497052`, so 09 starts at `06-projections.md` at position **30**, not 05c at 28). Each fork was given: its topic directory, tier, the version spine, "read `_plan.md` and the topic's progress memory first — a completed research pass, do not re-fetch it", the chunks already on disk, the next file with its `sidebar_position`, the full remaining plan order, "write EVERY remaining chunk, do not stop after one or two", and the topic `README.md` index plus `_category_.json` at close. Forks do not commit, build or touch a board.

⚠️ Where a topic's written chunk letters diverge from `_plan.md` (10 and 14 both do), the fork was told **the disk is authoritative** and the plan supplies argument order only.

Coordinator holds: QC (`wc -l` ≤300, `mdxcheck.py --no-rawtag`, `fixlinks.py`, varied section counts), the real footers, the four boards, and every commit. Running neither a build nor a dev server — registry row claimed in `shared/session_build_devserver_registry.md`.

---

🔴 **DISPATCH THIS BATCH WITH THE `devbible-author` AGENT TYPE**, not `general-purpose`.
It lives at `devbible/.claude/agents/devbible-author.md` (created 2026-08-27) and carries
the hard rules, the MDX rules, the link forms and the page shape in its own system prompt,
with a **narrow tool list** (`Read, Write, Edit, Bash, WebFetch, WebSearch`). A
`general-purpose` fork inherits the entire tool surface and starts ~20k tokens heavier —
about 120k wasted across a six-fork batch. ⚠️ **The agent registry is read at session
start**, so a session that creates or edits that file cannot dispatch it until the next
session begins.

**The six dispatch prompts are one per topic and all the same shape:** topic directory,
tier, the version spine, "read `_plan.md` and `<the topic's progress memory>` first — a
completed research pass, do not re-fetch it and do not assert what it records as
unconfirmed", the chunks on disk, the next file with its `sidebar_position`, the plan order
after it, "write EVERY remaining chunk, do not stop after one or two", and finally the
topic `README.md` index plus `_category_.json`. Forks never commit, never build and never
touch a board — the coordinator does all four.

⚠️ **A topic is not closed until it has a `README.md` index** and its `{/* FOOTER */}`
markers are replaced with real ← Prev / Index / Next → footers. Until then its phase-README
row stays **unlinked** and reads *(in progress — N chunks written)*.

### ⬛ SUPERSEDED — SESSION 69f1de49 — 2026-08-26 — the batch-6 dispatch narrative

**What happened.** Batch 6 (topics 09–14) was dispatched as six forks. The first set died on
an API limit with 24 files on disk and uncommitted; those were salvaged. A second set of six
resume forks ran, took the batch to **53 files**, and was then **killed deliberately by the
user on a usage concern** — not by a failure. Every file each fork finished is committed.
**Nothing is lost and nothing needs re-deriving.**

🔴 **RESUME TABLE — a new session or agent starts at exactly this file. No plan, no
confirmation, no clarifying question.**

| Topic | Written | 🔴 Next file | `sidebar_position` | Per-topic research + notes |
|---|---|---|---|---|
| **09 · Spring Data JPA** | 11 | `03-at-query-jpql.md` | **12** | `progress_java_p10_t09_springdata.md` |
| **10 · Lazy-loading pitfalls** | 9 | `04-the-detached-entity.md` | **10** | `progress_java_p10_t10_lazyloading.md` |
| **11 · Migrations with Flyway** | 7 | `04-checksums-and-immutability.md` | **8** | `progress_java_p10_t11_flyway.md` |
| **12 · Caching** | 10 | `05-redis-as-the-store.md` | **11** | `progress_java_p10_t12_caching.md` |
| **13 · jOOQ** | 7 | `02e-generating-from-a-real-database.md` | **8** | `progress_java_p10_t13_jooq.md` |
| **14 · Spring Data Mongo/Redis** | 9 | `03d-aggregation-from-java.md` | **10** | `progress_java_p10_t14_springdata_other.md` |

**Each topic's `_plan.md` sits in its own directory** and lists every remaining chunk in
order. **Each topic's memory file above already holds a completed research pass** — verbatim
doc quotes with URLs, traps found, and the claims that could NOT be confirmed. 🔴 **Do not
re-fetch what is already recorded there**; that research survived both kills and is the
reason this batch is cheap to resume.

⚠️ **`sidebar_position` must continue with no gaps and no reuse** — the numbers above are the
next free one in each directory, computed from what is on disk.

⚠️ **79 forward links are currently dangling in phase 10** — pages linking to chunks their own
topic has not written yet. They are build **warnings**, not failures, and they close
themselves as each topic completes. Do not "fix" them by deleting the links.

#### 🔴 The MDX rule this batch discovered the hard way

**Docusaurus v3 parses `.md` as MDX, so three things that are valid CommonMark abort the
production build.** Every GitHub Pages deploy failed from **2026-08-23 to 2026-08-26** on the
first of them, and the cause was a single scaffolding marker:

1. **A bare `<!-- ... -->` in prose.** *"Unexpected character `!` (U+0021) before name"*. Use
   **`{/* ... */}`**. Inside a fenced code block it is fine. 🔴 **Every page in this phase now
   ends with the literal line `{/* FOOTER */}`** — the coordinator replaces it with the real
   ← Prev / Index / Next → footer when the topic closes. Never write `<!--FOOTER-->` again.
2. **An inline code span left OPEN at end of line whose continuation starts with `{`.** MDX
   reads the `{` as a JSX expression before the span closes. Reflow so the brace is not at
   line start.
3. **A bare `<Something` in prose** — `List<String>`, `RedisTemplate<K, V>`, `<clinit>`. MDX
   parses it as a JSX tag and demands a closing one. Always backtick generics.

🔴 **`shared/scripts/mdxcheck.py` now catches all three** (it previously caught only the
second). **Run it before every push:**

```bash
python3 /mnt/Storage/my-learning/claude/shared/scripts/mdxcheck.py --no-rawtag docs
```

#### 🔴 Splitting a chunk that lands over 300 — the worked example from this batch

`10-lazy-loading/03-why-it-never-fires-in-dev.md` came in at **318 lines with 11 gotchas and
10 interview questions**. It was split on the concept boundary the page already had (group A
= the session stayed open; group B = there was never a proxy), and **its gotchas and
questions were distributed to the group each one is actually about — none dropped, none
reworded**. Result: `03` (164) + new `03b` (192), and the existing `03b` was renamed `03c`
with its position bumped. ⚠️ **When you rename a chunk, grep for inbound links to the old
name** — one had to be repointed here.

### 🔴🔴 SESSION 4428ff1e — 2026-08-26 — PHASE 10 BATCH 5

#### 🔴 BATCH 6 DISPATCHED — 2026-08-26 — the last six topics of phase 10

Six forks, one per topic, **no shared directories**. All six plans were written by the
coordinator *before* dispatch (commit `971fe5f6`), so no fork spends a round deciding
what its topic contains.

| Fork | Topic | Tier | Memory file |
|---|---|---|---|
| T09 | 09 · Spring Data JPA | U | `progress_java_p10_t09_springdata.md` |
| T10 | 10 · Lazy-loading pitfalls | U | `progress_java_p10_t10_lazyloading.md` |
| T11 | 11 · Migrations with Flyway | U | `progress_java_p10_t11_flyway.md` |
| T12 | 12 · Caching | K | `progress_java_p10_t12_caching.md` |
| T13 | 13 · jOOQ | K | `progress_java_p10_t13_jooq.md` |
| T14 | 14 · Spring Data for Mongo/Redis | K | `progress_java_p10_t14_springdata_other.md` |

🔴 **The boundary that needed the most care is T10's.** Topic 08 is now complete and owns
N+1 **and every performance fix**, including three chunks on open-session-in-view. T10 was
given the **correctness** half only — `LazyInitializationException` — and told to read
`08/15-open-in-view.md` first and link across rather than re-derive. The same split that
worked for topic 06's `18c`.

⚠️ **Every fork was told the other five topics do not exist** and must be referred to as
bold plain text. The coordinator repoints them all once the batch lands — that is now a
54-placeholder job per batch and it is done one sentence at a time.

#### ✅ BATCH 5 CLOSED — phase 10 is **8 of 14**, boards committed `253267cc`

**Topic 08 · The N+1 problem closed at 61 chunks** (`253267cc`). Ten planned chunks in the
fixes half became 22; eight in the not-a-fix half became 17. Phase 10 now stands at
**335 chunks / ~88,000 lines / 0 over the cap / 0 dangling links / 0 console blocks**.

🔴 **The repoint lesson held an 8th time, and this is the clearest example yet.** 54
placeholders in topic 08, each read in its own sentence. One said *"attach an
`@EntityGraph` to the derived method — **chunk 9d**"*. By the time the batch landed,
`09d` was **"Hibernate's graph syntax"** — the intended target had become **`09g`**. A
bulk replace on the label would have shipped a confidently wrong link.

🔴 **Concept findings from the topic-08 forks worth keeping:**

- ⛔ **"Hibernate pads the batch size to the next power of two" is FOLKLORE.** That is
  `hibernate.query.in_clause_parameter_padding`, a **separate, opt-in, query-level**
  setting. And on PostgreSQL it is moot for batch fetching: Hibernate passes the ids as a
  SQL **ARRAY** (`where … = any (?)`), so it is one bind parameter and constant statement
  text.
- 🔴 **`fetchgraph` is a floor, never a ceiling.** JPA 3.2 §3.8.1: *"The persistence
  provider is permitted to fetch additional entity state beyond that specified by a fetch
  graph or load graph."* That sentence settles the decade-old "Hibernate ignores
  fetchgraph" argument and is almost never quoted.
- ⛔ **Passing an entity into a DTO constructor makes it managed** (§4.9.2) — so
  `select new View(o, count(l))` is not a projection at all, it is the N+1 wrapped.
- A mistyped fetch-profile name throws **`UnknownProfileException`**; the fork's first
  draft said "silently does nothing" and it caught itself.
- ✅ **Uncertainty stated rather than papered over:** the Hibernate 7.4 intro guide says an
  entity graph adds a **left outer** join while the user guide's own worked example prints
  **three inner joins**. Irreconcilable from the 7.4 docs, so `09h` says so — and the fork
  went back and corrected an over-confident sentence it had already written in `09`.

#### ✅ BATCH 5 · THREE OF FOUR FORKS LANDED — phase 10 is 7/14, boards committed `fc8f58ae`

| Topic | Result | Commit |
|---|---|---|
| **05 · SQL-first access** | ✅ **COMPLETE, 33 chunks** — the one planned chunk became **ten** | `35f20787` |
| **06 · The JPA/Hibernate model** | ✅ **COMPLETE, 42 chunks** — eight planned became **twenty** | `35f20787` |
| **08 · The N+1 problem** | 🚧 fork 08b landed 17 files; **fork 08a still running** | — |
| **04 · Spring `@Transactional`** | ✅ 68 chunks — **two defects found and repaired**, see below | `35f20787` |

QC on both closed topics: **0 files over the cap, 0 dangling links, 0 console blocks**,
and section counts genuinely varied (topic 05 gotchas 5–12 / questions 4–7; topic 06
gotchas 8–11 / questions 7–10). No uniform-count tell.

#### 🔴🔴 A WRONG CLAIM IN A "COMPLETE" TOPIC — verified independently before acting

Fork T05 reported that topic 04's `20j` still taught
`@AutoConfigureTestDatabase(replace = NONE)` as the way to get a real database under a
test. **The coordinator verified it against the Boot 4.1.1 javadoc rather than taking the
fork's word** — and it holds:

- 🔴 **`replace` defaults to `Replace.NON_TEST` on Boot 4**, documented as replacing the
  bean *"unless it is auto-configured and connecting to a test database"*, and the javadoc
  names three things that count: a bean definition carrying `ContainerImageMetadata`
  (which is what `@ServiceConnection` and Docker Compose produce), a
  `spring.datasource.url` backed by `@DynamicPropertySource`, and one in the Testcontainers
  JDBC syntax.
- ⛔ **So `replace = NONE` with a container is not merely redundant — it is LESS SAFE.**
  `NONE` is *"don't replace the application default `DataSource`"* unconditionally, so it
  also removes the fallback that would have caught a missing container and connects the
  test to whatever `spring.datasource.url` resolves to. Nearly every example online still
  adds it.
- ✅ Also confirmed from the generated appendix: **Boot 4.1's `@JdbcTest` slice imports
  neither Flyway nor Liquibase nor `SqlInitializationAutoConfiguration`** — all four were
  in the 3.5 slice. Nothing in it builds a schema, so an inherited test now fails with
  "relation does not exist". ⚠️ **No release-note or migration-guide entry announces
  this** — the fork looked and said so on the page rather than inventing a citation.

**Repaired by SPLITTING, never trimming:** `20j` → `20j` (the fixture) + `20k` (getting
the real engine in). And `14b-three-honest-options.md` was found at **301 lines** — a cap
violation on a topic the boards called complete — split into `14b` (the two options that
keep the `catch` inside the boundary) and `14b2` (the one that moves the boundary).

#### 🔴 THE REPOINT LESSON HELD FOR THE 7th TIME

25 placeholders repointed in topic 06, **each read in its own sentence**. The fork's own
map was accurate on targets but the **link labels were stale**: planned `14b · what dirty
checking costs` landed as **`14e`**, and planned `15b` split into `15b`/`15c`/`15d`. A
bulk replace would have shipped links whose text names a chunk that does not exist.
Also swept the references to topics **07 and 08**, unwritten when those chunks were
authored and written now. The 4 placeholders still standing point at topics **10 and 11**
and are correct as plain text.

#### ⚠️ Two overlaps checked rather than assumed

- **Open-in-view is in BOTH topic 06 (`18c`) and topic 08 (`15`–`15c`)** — and that is
  correct, because they were briefed to different angles: 06 owns context *lifetime*
  (dirty checking, flush, `readOnly`), 08 owns *query counts* (why it is not an N+1 fix).
  Both now carry a `:::note` naming the other half and linking to it.
- Two files named `19-the-checklist.md` in two different topics is **not** a conflict —
  Docusaurus ids are path-based.

#### 🔴 Concept findings banked from the forks (full detail + URLs in their memories)

- `hibernate.enhancer.enableDirtyTracking` is **deprecated for removal without a
  replacement** in 7.4; **`@SelectBeforeUpdate` no longer exists** in 7.4 though UG §11.1.1
  still recommends it. Hibernate-5 advice is actively wrong on this baseline.
- **`ddl-auto=create` drops your tables** — `create` means drop+recreate via
  `hbm2ddl.auto` but `CREATE_ONLY` via the JPA-standard property; Hibernate's own
  `@apiNote` flags the ambiguity.
- 🔴 **Original, read from Spring Framework 7.0.x source and not in any reference doc:**
  `@Transactional(readOnly = true)` has two effects on Hibernate and only one always
  happens. `FlushMode.MANUAL` always; `session.setDefaultReadOnly(true)` — the switch that
  actually skips the snapshot — only when `isLocalResource()` is true. **So
  `spring.jpa.open-in-view=true` silently weakens `readOnly = true`.** Written up as
  source-read, explicitly not claimed as documented.
- A mistyped fetch-profile name throws **`UnknownProfileException`**; the fork's first
  draft said "silently does nothing" and it caught itself.

### 🔴 BATCH 5 DISPATCH RECORD (2026-08-26)

**Order:** *"Continue on java please"*. Read this file, started at the cursor below,
no questions asked. Running to completion, phase by phase, per the standing order.

**Batch 5 — four forks, dispatched together 2026-08-26 ~15:4x. Ownership is by
FILENAME and it is absolute.**

| Fork | Directory | Owns | Memory file |
|---|---|---|---|
| T05 | `05-sql-first-access/` | `12-testing-and-the-shape-of-a-repository.md` + splits — **closes the topic** | `progress_java_p10_t05_sqlfirst.md` (appends) |
| T06 | `06-jpa-hibernate-model/` | chunks **14–19** + splits (dirty checking, flush, `@Version`, `ddl-auto`, observability, checklist) | `progress_java_p10_t06_jpa_model.md` (appends) |
| T08a | `08-the-n-plus-1-problem/` | 🔴 **finish `08e2` first** (it has no Gotchas/Q&A), then **09–12c** + splits — the fixes | `progress_java_p10_t08a_fixes.md` (new) |
| T08b | `08-the-n-plus-1-problem/` | chunks **13–19** + splits — fetch profiles, choosing a fix, what is NOT a fix, prevention | `progress_java_p10_t08b_notafix.md` (new) |

🔴 **T08a and T08b share one directory** — the second intra-topic split in phase 10.
T08a owns `08e2` and every `09`/`10`/`11`/`12` file; T08b owns every `13`–`19` file.
Neither writes `README.md`, `_plan.md` or a footer. T08b was started at
`sidebar_position: 50` deliberately so the two never collide on a number; the
coordinator renormalises to 1..N at wire time anyway.

**Coordinator tooling regenerated this session** (the scratchpad is session-scoped —
regenerate, never hunt for the old one): `JAVA-P10-BRIEF.md` (179 lines) ·
`wire_topic.py` · `qc_topic.py`. Both scripts smoke-tested against topic 05 before
dispatch: 24 files, 0 issues, gotchas 2–8 and questions 2–7 — genuinely varied.

**Claim taken over in `docs/README.md` (row 42) before writing began.**

**Coordinator prep done while batch 5 ran (committed `971fe5f6` and `ed519714`):**

- 🔴 **Phase 10 topics 09–14 are SCAFFOLDED** — `_category_.json` + a real `_plan.md`
  each (Spring Data JPA, lazy-loading pitfalls, Flyway, caching, jOOQ, Spring Data for
  Mongo/Redis). Every plan fixes its boundary against what exists (08 owns N+1 and every
  fix; 06 owns the persistence context; 05 owns `JdbcClient`) and lists the claims to
  **verify rather than assume**. **Batch 6 dispatches straight from these — no research
  round needed.**
- 🔴 **Phase 11 · Testing is FULLY SCAFFOLDED** — all 11 topic directories with plans,
  plus `_PHASE-NOTES.md` carrying the three facts that make most online samples wrong:
  **Boot 4 removed `@MockBean`/`@SpyBean`** (now `@MockitoBean`/`@MockitoSpyBean`, moved
  into Spring Framework), **no Docker and no sandbox** so Testcontainers is
  documentation-validated with no run output, and the `t-when` tier class is to be
  **matched, not corrected** mid-run. Intra-phase boundaries are fixed so parallel forks
  cannot overlap (04 = plain Mockito, 05 = `@MockitoBean` in a context; 03 = the table of
  cases, 08 = the objects; 09 sets up the question 11 answers).

⚠️ **A trap that cost two minutes and could cost a whole misplaced batch:** a `cd` that
fails inside a compound Bash command does **not** stop the rest of it — eleven phase-11
directories were created inside `phase-10-data-access` before it was noticed. **Use
absolute paths in scaffolding commands**, or `cd … || exit 1`.


**If this session dies mid-batch:** everything each fork finished is already on disk
and each fork has its own memory file. Re-run
`python3 <scratchpad>/qc_topic.py docs/java/pages/phase-10-data-access/<topic>` to see
exactly what landed, then resume from each fork's RESUME HERE section.

**After batch 5 lands:** QC → wire footers + READMEs → repoint the ~54 *(not written
yet)* placeholders (**one at a time, each read in its own sentence** — a bulk replace
has produced a wrong target 6 times in this phase) → four boards → commit → memory →
**batch 6 = topics 09–14** → close phase 10 → **phase 11 · Testing**.


### 🔴🔴 STOPPED ON USER ORDER — 2026-08-25 12:47 — READ THIS FIRST

The user's words: *"stop everything sace current session progress"*. All four
authoring forks were killed mid-batch, everything on disk was QC'd, wired,
committed and boarded, and this cursor was repointed. **Nothing is in flight.**

**Where phase 10 actually stands — 5 of 14 topics complete, 3 part-written:**

| Topic | State | Chunks | Lines | Resume at |
|---|---|---|---|---|
| 01 · JDBC | ✅ | 50 | 13,838 | — |
| 02 · Connection pooling | ✅ | 27 | 7,125 | — |
| 03 · JDBC transactions | ✅ | 27 | 6,565 | — |
| 04 · Spring `@Transactional` | ✅ | 65 | 18,039 | — |
| **05 · SQL-first access** | 🚧 **23/24** | 23 | 5,573 | 🔴 **`12-testing-and-the-shape-of-a-repository.md` — ONE file and the topic closes** |
| **06 · The JPA/Hibernate model** | 🚧 **22/30** | 22 | 5,619 | 🔴 **`14-dirty-checking.md`**, then 14b, 15, 15b, 16, 17, 18, 19 |
| 07 · Relationships and fetch types | ✅ | 28 | 6,859 | — |
| **08 · The N+1 problem** (M) | 🚧 **23/~42** | 23 | 5,454 | 🔴 **finish `08e2-the-three-ways-out.md` FIRST** (see below), then `09-entity-graph.md` onward |
| 09–14 | ⬜ not started | — | — | batch 4 |

**Phase 10 totals on disk: 69,683 lines · 0 files over the 300-line cap · 0
dangling links · 0 console blocks.** Commits: `ed0fd96d` (topic 04), `06fb946e`
(boards), `8681f53b` (topics 05/06/07/08 + boards). Boards read **phase 10 5/14**,
`progress.js` `pages: 5, pagesPlanned: 14`, java `updated: '2026-08-25 12:47'`,
`docs/README` **144/232**.

🔴 **`08-the-n-plus-1-problem/08e2-the-three-ways-out.md` is the one INCOMPLETE
file in the phase.** 120 lines; its prose is finished (three ways out of
`MultipleBagFetchException`) but it has **no `## Gotchas` and no
`## Interview questions` section**. The fork was mid-file when it was stopped.
Finish that file before writing anything new in topic 08.

⚠️ **54 forward links were converted from links to bold plain text *(not written
yet)*** so the build stays clean — 17 in topic 06, 37 in topic 08. **Repoint each
as its target lands, reading every one in its own sentence.** Several in topic 08
are bare labels ("chunk 10", "chunk 9") that will read badly until repointed. A
bulk replace has produced a wrong target **every** time it has been tried in this
phase — that is now 6 occurrences.

**Per-topic detail, every claim with its URL, in the six per-agent memories:**
`progress_java_p10_t04_depthpass_a.md` · `..._b.md` ·
`progress_java_p10_t05_sqlfirst.md` · `progress_java_p10_t06_jpa_model.md` ·
`progress_java_p10_t07_relationships.md` · `progress_java_p10_t08_nplus1.md`.
Per-topic resume detail is also in each topic directory's `_plan.md`, under a
**RESUME HERE** heading.

✅ **The per-file checkpoint rule and the per-agent memory rule both paid for
themselves here.** Four forks were killed with no warning; all four had written
every finished file to disk and all four had a memory file. Total loss across the
kill: **one partially-written file** (`08e2`, and even that kept its prose).

**When work resumes:** batch = finish 05 (1 file), 06 (8 files), 08 (~19 files),
then **batch 4 = topics 09–14**, close phase 10, then **phase 11 · Testing**
(scaffolded, 11 rows, 0 written; 4-fork split in the section below).


### 🔴🔴 SESSION 84000ade — 2026-08-25 — PHASE 10 BATCH 3 (RETRY) IN FLIGHT

**Order:** *"pick it up where it left off previous abruptly existed due to usage
exhaustion and please continue"*, then, mid-turn: 🔴 *"Look untill completing java
please proceed phase by phase and do not wait for me"*. **Run to completion, phase
by phase, no stopping to ask.**

**What the 2026-08-25 07:40 cut-off actually left.** The previous session dispatched
batch 3 (5 forks: topic 04 depth repair + topics 05/06/07/08) and died almost
immediately. Measured on disk this session, not taken from the old report:

| Topic | On disk at pickup | Verdict |
|---|---|---|
| 04 · `@Transactional` | **50 chunks, 13,738 lines**, wired, README 49 rows | ⚠️ **1 dangling link + Q&A tell** |
| 05 · SQL-first | `_category_.json` + `_plan.md` only | fork never wrote a file |
| 06 · JPA model | **directory did not exist** | scaffolded this session |
| 07 · Relationships | **directory did not exist** | scaffolded this session |
| 08 · N+1 | `_category_.json` only | fork never wrote a file |

🔴 **So batch 3 produced nothing except a partial topic-04 repair, and the depth fork
died before writing ANY memory file** — its intent survived only in what it left on
disk. The lesson from 2026-08-24 (a fork's FIRST action is its plan memory) was in the
cursor but was **not in the fork prompts**. It is now in the brief as §8.1.

**The two topic-04 defects, both measured this session:**

1. 🔴 **`20c-the-other-ways-a-test-lies.md` links forward to
   `20d-what-a-test-must-assert.md`, which does not exist.** The depth fork was
   mid-split of `20b` (301 → 20b/20c/20d) and died between 20c and 20d. That is the
   only dangling link in the whole phase.
2. 🔴 **The uniform-Q tell is REAL and now measured across all 50 files.** Chunks
   `02b`–`14b` sit at **exactly six** interview questions, 29 files in a row, while
   `15b`–`22b` range **6–9**. Gotchas vary 5–9 throughout, so it is the Q&A section
   alone. `README.md` is also stale — it has 49 rows for 50 files (missing `20c`).

**Batch 3 RETRY dispatch — 6 forks, one batch, 2026-08-25 ~11:5x:**

| Fork | Owns | Memory file |
|---|---|---|
| R1 | topic 04: **write `20d`** + Q&A re-judge chunks `01`–`09b` | `progress_java_p10_t04_depthpass_a.md` |
| R2 | topic 04: Q&A re-judge chunks `10`–`14b` | `progress_java_p10_t04_depthpass_b.md` |
| 05 | **05 · SQL-first access**, U, ~12 planned | `progress_java_p10_t05_sqlfirst.md` |
| 06 | **06 · The JPA/Hibernate model**, U, ~15 planned | `progress_java_p10_t06_jpa_model.md` |
| 07 | **07 · Relationships and fetch types**, U, ~13 planned | `progress_java_p10_t07_relationships.md` |
| 08 | **08 · The N+1 problem**, 🔴 **M**, ~14 planned | `progress_java_p10_t08_nplus1.md` |

R1 and R2 share `04-spring-transactional/` with **absolute ownership by filename**
(R1 = `01`–`09b` + `20d`, R2 = `10`–`14b`; `15`–`22b` off-limits to both). Neither
writes `README.md` or footers.

⚠️ **The R1/R2 prompts forbid a blanket "add two questions everywhere"** and require a
stated reason for every file left alone — the 2026-08-19 correction. A second uniform
number is the same defect.

**Coordinator tooling regenerated this session** (session-scoped scratchpad; regenerate
rather than hunt):
`JAVA-P10-BRIEF.md` (226 lines — the version spine, rules 1/13/2/8 in full, the ≤296
body-line footer allowance, page shape, link forms, per-file checkpointing, the fixed
60s/120s retry, per-agent memory with the `-m` before `--` fix, the do-not list) ·
`wire_topic.py` (positions 1..N, markerless 4-line footers, README table; idempotent —
the strip rule matches BOTH `← Prev:` and a first chunk's bare `Index: [`) ·
`qc_topic.py` · `checklinks.py`.

🔴 **qc_topic.py section-detection fix, needed again next batch:** matching a heading
on `/question/` picked up prose headings like *"The decision, in one question"* and
*"The two questions underneath everything"*, reporting **Q=1** and **Q=0** on two files
that actually had 6. It now prefers `^#+\s*interview` and takes the **last** match.
A wrong counter hides the uniform-count tell completely, which is the whole reason the
counter exists.

#### ✅ TOPIC 04 · SPRING `@Transactional` COMPLETE AND COMMITTED — `ed0fd96d` (2026-08-25)

**65 chunks, 18,039 lines, 0 over the cap, 0 dangling links, 0 console blocks.**
Boards committed `06fb946e` — phase 10 **4 of 14**, `progress.js` `pages: 4,
pagesPlanned: 14`, java `updated: '2026-08-25 12:36'`, `docs/README` **143/232**, and
the claim row taken over by session `84000ade`.

Both repair forks landed and both did real work:

- **R1** (`01`–`09b` + `20d`): wrote `20d`–`20j` — **seven** chunks, 1,741 lines, from
  one planned file — and re-judged 22 files. Created three further splits (`02d`,
  `06d`, `08c`) rather than trimming.
- **R2** (`10`–`14b`): re-judged 11 files and created five splits (`10c`, `12c`,
  `13d`, `13e`, `14c`).

🔴 **The uniform-Q tell is gone and it was worth chasing.** Counts went from **29 files
at exactly six** to a genuine **4–9** spread (gotchas 2–9). The point is not the
numbers: the re-judge is what *found the four correctness defects below*, none of
which a line-count or link check would ever have surfaced.

### 🔴🔴 FOUR WRONG CLAIMS FOUND AND CORRECTED — check these before reusing any of them

1. ⛔ **`rollbackFor = RuntimeException.class` is a NO-OP, not a narrowing.** Banked
   here on 2026-08-25 as "silently stops rolling back on `Error`" — **wrong**, and the
   pages asserting it (`13`, `13b`) have been fixed. An unmatched rule leaves
   `winner == null` in `RuleBasedTransactionAttribute.rollbackOn`, which falls through
   to `DefaultTransactionAttribute.rollbackOn` — literally
   `return (ex instanceof RuntimeException || ex instanceof Error);`. **The general
   form is the useful half: explicit rules ADD to the default, they do not replace
   it**, so `rollbackFor = SomeChecked.class` keeps unchecked rollback too.
   Re-verified independently by the coordinator against the raw Spring source, not
   taken on the fork's word.
2. ⛔ **It is the SHALLOWEST match that wins, not the deepest.** `deepest` is
   initialised to `Integer.MAX_VALUE` and the test is `depth < deepest`. Spring's own
   variable name is where the folklore comes from — and **this session's fork brief
   repeated the folklore**, which the fork caught and corrected. Documented in `13d`.
3. ⛔ **AspectJ weaving DOES advise a `private` `@Transactional` method.** `04c` said
   the opposite. `AnnotationTransactionAspect` is built with
   `AnnotationTransactionAttributeSource(false)`, its pointcut is
   `execution(@Transactional * *(..))` with no visibility clause, and its javadoc says
   *"Annotating non-public methods directly is the only way to get transaction
   demarcation for the execution of such operations."* **The visibility rule flips on
   migration** — that is the interesting fact, and it was inverted.
4. ⛔ **`JpaTransactionManager` DOES support savepoints.** `11b` said "not out of the
   box". The javadoc says it supports them via JDBC savepoints;
   `nestedTransactionAllowed` merely defaults to `false`, because *"nested transactions
   will just apply to the JDBC Connection, not to the JPA EntityManager and its cached
   entity objects"*.

Two structural defects also repaired: `04c` had `## The trade-off` **three times** and
`## The decision table` twice; `09b` had a duplicated `## Seeing it coming`. And `12`
/ `12b` carried the **same interview question verbatim**.

⚠️ **Both forks reported a "missing" file the OTHER fork had just written.** R1's report
says `13d-the-matching-algorithm.md` does not exist; R2 had created it minutes earlier.
**A concurrent fork's view of a shared directory is stale by construction — verify
every "dangling link" claim on disk before acting on it.** Costs nothing, and acting
on it would have produced a duplicate file.

✅ **Two claims correctly left as uncertain rather than invented** (rule 8 working):
what an *empty* transaction reports to its `TransactionSynchronization` callbacks on
`setRollbackOnly()`, and the exact-tie resolution between rollback rules — real in the
source but promised nowhere, so `13e` says to treat a tie as a defect rather than a
precedence rule.

**After batch 3 lands:** QC → wire 04/05/06/07/08 → repoint the 05↔06↔07↔08 cross-topic
placeholders → four boards → commit → memory → **batch 4 = topics 09–14** → close
phase 10 → **phase 11 · Testing** (4 forks, split in the section below).


### 🔴🔴 SESSION 8a6354f0 — 2026-08-25 — PHASE 10 BATCH 2 IN FLIGHT

**Order:** *"cook it up yesterday it was cut off due to usage completed"* then
*"make sure to follow instructions and deploy agenets to split the task and
complete it phase by phase"*. Resume the batch the previous session lost, then
run phase 10 to its close, then phase 11 — do not wait to be asked.

**What the cut-off left on disk, uncommitted.** The 2026-08-24 session dispatched
topics 02, 03 and 04 in parallel and died mid-write. Their surviving files are
sound and are **off-limits to any retry**:

| Topic | Tier | On disk | Planned | Left |
|---|---|---|---|---|
| 02 · Connection pooling (HikariCP) | Understand | `01` 282 · `02` 268 | 8 + README | 6 + README |
| 03 · Transactions at the JDBC level | Understand | `01` 199 · `02` 259 | — none recorded | plan written this session, 13 + README |
| 04 · Spring `@Transactional` | Master | `01` 253 · `02` 249 · `02b` **336** | 22 + README | 20 + README, **plus the 02b split** |

🔴 **`04/02b-where-the-annotation-lives.md` is 336 lines — over the hard cap.** It
is split, never trimmed (rule 1). Assigned to the 03–12 fork as its first task.

⚠️ **Topic 03 had NO progress memory** — the fork died before its first checkpoint,
so its chunk plan was gone. Reconstructed this session as 13 chunks (isolation →
PG's three levels → read committed → repeatable read → serializable/SSI → setting
it from Java → savepoints → `25P02` aborted transaction → read-only → row locks →
deadlocks and the four timeout clocks → retrying safely → where the boundary
belongs). ⚠️ **The lesson: a fork's FIRST action must be to write its plan memory,
before chunk 1** — not after two files.

**Batch 2 dispatch (4 forks, one batch, 2026-08-25):**

| Fork | Owns | Memory file |
|---|---|---|
| A | topic 02, chunks 03–08 | `progress_java_p10_t02_hikaricp.md` (updates in place) |
| B | topic 03, chunks 03–15 | `progress_java_p10_t03_transactions.md` (new) |
| C | topic 04, the 02b split + chunks 03–12 | `progress_java_p10_t04_transactional.md` (updates in place) |
| D | topic 04, chunks 13–22 | `progress_java_p10_t04b_transactional.md` (new) |

🔴 **C and D share one directory** — the first intra-topic split in phase 10.
Ownership is by chunk number and absolute: C owns `02b`/`02c`/`03`–`12`, D owns
`13`–`22`. Separate plan files (`_plan-c.md`, `_plan-d.md`) and separate memory
files, because parallel forks reliably clobber a shared one. Neither writes
`README.md` — the coordinator generates it.

**Coordinator tooling regenerated this session** (the previous scratchpad was
session-scoped and is gone). Both live in this session's scratchpad and should be
regenerated the same way next time rather than hunted for:

- `wire_topic.py` — normalises `sidebar_position` to a strict 1..N reading order
  (`07 < 07b < 07c < 08`), generates every ← Prev / Next → footer from that order,
  and rebuilds `README.md`'s chunk table. Chunks end in a bare `<!--FOOTER-->`
  which it replaces; it preserves any hand-written README intro above `<!--CHUNKS-->`.
- `qc_topic.py` — per chunk: line cap, tier badge, `> Verified:` line, footer
  marker, fabricated-console detection, gotcha/question counts, and every relative
  `.md` link resolved against the filesystem.
- `JAVA-P10-BRIEF.md` — the 191-line authoring brief every fork reads first
  (rules 1/13/2/8 in full, the Boot 4.1 / Framework 7.0.8 / PG 18 version spine,
  page shape, link forms, per-file checkpointing, the fixed-60s retry rule,
  per-agent memory, and the do-not-build / do-not-commit list).

**After batch 2 lands:** QC → wire footers and READMEs → repoint the cross-topic
placeholders (02↔03↔04 all refer to each other as *(not written yet)* right now) →
four boards → commit → memory → **then batch 3 = topics 05–08**, then 09–14, then
phase 11.

#### ✅ BATCH 2 CLOSED · 🔴 BATCH 3 DISPATCHED (2026-08-25)

**All four batch-2 forks landed. 101 new chunks, ~25,800 lines.**

| Topic | Chunks | Commit | State |
|---|---|---|---|
| 02 · Connection pooling (HikariCP) | 27 | `74128b06` | ✅ ALL CLEAN, committed |
| 03 · Transactions at the JDBC level | 27 | `8142e703` | ✅ ALL CLEAN, committed |
| 04 · Spring `@Transactional` | 49 | — | ⏳ content-complete, **2 defects, depth pass in flight** |

**Boards wired and committed `a574103f`** — phase 10 **3 of 14**, `progress.js`
`pages: 3, pagesPlanned: 14`, java `updated: '2026-08-25 07:38'`, pages board,
`docs/README` technology row (**142/232**) and the claim row taken over by this
session. 🔴 **Topic 04 is deliberately NOT counted yet** — counting a topic with a
cap violation on disk is how a board starts lying.

🔴 **16 cross-topic placeholders converted to real links** now that 02/03/04 all
exist. Each was read **in its own sentence** first, not bulk-replaced. The 2 that
remain point at **Phase 15 — Messaging** and correctly stay bold plain text.

**Topic 04's two open defects, both handed to the depth-pass fork:**

1. **`20b-the-false-positives.md` is 301 lines wired** (297 body + 4 footer). No
   redundant whitespace to reclaim — checked. It is **split**, not trimmed, on the
   boundary between the flush/clear false positive and the other ways a
   transactional test lies.
2. **The rule-13 uniform-count tell, measured:** 22 of fork C's 26 files carry
   **exactly six** interview questions, where fork D's files in the same directory
   and tier range **5–9**. Confirmed as a real gap by spot-check, not assumed —
   `08b-whose-settings-win.md` argues that a participating transaction inherits the
   outer scope's settings, yet never asks whether an inner `rollbackFor` still
   marks the shared physical transaction rollback-only, nor whether `timeout`
   inherits the way isolation does. Both are load-bearing and both are answerable
   from the banked sources. 🔴 **The fork is instructed to re-judge PER FILE and to
   leave a genuinely exhaustive file alone with a stated reason** — a blanket
   "add two everywhere" just swaps one uniform number for another, which is the
   exact mistake a previous session was corrected for.

**Batch 3 — 5 forks, dispatched together, no shared directories:**

| Fork | Owns | Memory file |
|---|---|---|
| depth | topic 04 repair (split `20b` + per-file Q&A pass) | `progress_java_p10_t04_depthpass.md` |
| 05 | **05 · SQL-first access** (`JdbcTemplate`/`JdbcClient`), U, ~12 planned | `progress_java_p10_t05_sqlfirst.md` |
| 06 | **06 · The JPA/Hibernate model**, U, ~15 planned | `progress_java_p10_t06_jpa_model.md` |
| 07 | **07 · Relationships and fetch types**, U, ~13 planned | `progress_java_p10_t07_relationships.md` |
| 08 | **08 · The N+1 problem**, 🔴 **M**, ~14 planned | `progress_java_p10_t08_nplus1.md` |

⚠️ **The JPA sequence has hard internal boundaries and every prompt names them**,
because 06/07/08 overlap badly if left to their own judgement: **06** owns the
persistence context, dirty checking, flush and entity states; **07** owns the
mappings, owning side, `mappedBy` and the fetch-type defaults; **08** owns the
query explosion and *every fix for it* (fetch join, `@EntityGraph`, `@BatchSize`,
projections). 07 names the `EAGER` danger and hands off rather than solving it.

🔴 **A version warning given to all three JPA forks, and it matters for the whole
corpus:** Hibernate 6 and 7 changed real behaviour the web has not caught up with —
`DISTINCT` handling, pagination-with-fetch-join (`HHH000104`), the statistics API,
and several mapping defaults. The prompts require each to be **verified against the
Hibernate 7.4 docs, with "I could not confirm this" written on the page** where it
cannot be (rule 8), rather than reproducing Hibernate 5 folklore.

**After batch 3:** QC → wire → repoint the 06/07/08 cross-links → boards → commit →
**batch 4 = topics 09–14** (Spring Data JPA, lazy loading, Flyway, caching, jOOQ,
Spring Data for Mongo/Redis) → close phase 10 → **phase 11 · Testing**.

#### ✅ TOPIC 03 · JDBC TRANSACTIONS COMPLETE AND COMMITTED — `8142e703` (2026-08-25)

**27 chunks, 6,565 lines, 0 over the cap, 0 broken links, ALL CLEAN.** Fork B's 25
new chunks (`03`–`15b`) resumed the topic the 2026-08-24 crash lost. Ten planned
chunks became 25 files. Line counts run **152–300** and gotchas **2–7** / questions
**3–6** — genuinely varied, no template. Memory:
`progress_java_p10_t03_transactions.md` (517 lines, every claim carries its URL).

🔴 **THE REPOINT LESSON HELD AGAIN — 2 of the fork's 3 suggested targets were
WRONG.** It correctly spotted three stale links in the two pre-existing chunks it
was forbidden to edit, but its proposed targets came from the *old filenames*, not
from reading each link in its own sentence:

| Sentence | Fork proposed | Actually correct |
|---|---|---|
| "the same duration problem …" | `15-where-the-boundary-belongs.md` | ✅ right |
| "the nearest thing PostgreSQL offers is **a savepoint**, …" | `10-the-aborted-transaction.md` | ❌ → **`09-savepoints.md`** |
| "[Chunk 8] has **the server side**" of a connection returned mid-transaction | `15-where-the-boundary-belongs.md` | ❌ → **`13b-the-four-clocks.md`** (`pg_stat_activity`, `idle in transaction`) |

**Never apply a repoint table without reading each link in its sentence.** That is
now proven 6 times across phases 9 and 10.

🔴 **Concept findings from fork B** (full detail with URLs in its memory):

- **pgJDBC's `setTransactionIsolation` sends `SET SESSION CHARACTERISTICS`**, not
  `SET TRANSACTION` — it changes the **session default**, not the transaction.
  Combined with HikariCP's dirty-bit reset only firing on *method calls*, a raw
  `SET SESSION CHARACTERISTICS` run through a `Statement` **leaks the level to
  every later borrower of that physical connection**. Same hole for `READ ONLY`.
- **`setReadOnly(true)` sends nothing** at pgJDBC's default
  `readOnlyMode=transaction` when autocommit is on — a pure Java field with zero
  server enforcement.
- `Connection.TRANSACTION_READ_UNCOMMITTED` is accepted end-to-end and
  **round-trips faithfully** through `getTransactionIsolation()` while behaving as
  Read Committed.
- The `25P02` check runs **before parse analysis** and appears in all four protocol
  handlers — verified from `REL_18_STABLE` source.
- ✅ **Uncertainty stated rather than papered over** (rule 8 working): no primary
  source quantifies per-savepoint cost, and the command tag PostgreSQL reports for
  `COMMIT` in an aborted block could not be confirmed — both pages say so instead
  of inventing a number.

🔴 **WIRING CONVENTION SETTLED — the footer is chrome and it COSTS LINES.**
`13-deadlocks-and-timeouts.md` was written at 296 body lines and the first
generated footer pushed it to **302, over the cap**. Fixes now baked into
`wire_topic.py`:

1. **Match topic 01's proven footer exactly** — blank, `---`, blank, then one line
   `← Prev: [x](y) · Index: [Topic](README.md) · Next → [z](w)`. **4 lines, no HTML
   comment marker.** (The `<!--FOOTER:GENERATED-->` marker was dropped: MDX is
   hostile to HTML comments and topic 01's markerless format is already proven.)
2. **Stripping must match `Index: [` as well as `← `** — the FIRST chunk's footer
   has no `← Prev`, so a strip rule keyed only on `←` silently DUPLICATED it on a
   re-wire. Verified idempotent by running the script three times and checking the
   line count never moves.
3. 🔴 **Tell every future fork the cap includes the footer** — write to **≤296 body
   lines**, not 300. Add this to the brief.

⚠️ **`qc_topic.py` must accept the markerless footer** (`"Index: ["`), or it
reports NO-FOOTER on all 27 correctly-wired files.

#### ✅ FORK D LANDED — topic 04 chunks 13–22 → **21 files, 6,058 lines** (2026-08-25)

Ten planned chunks became 21 files: `13` split three ways, and `14`–`22` each into
two. **That is rule 1 working as intended** — written out in full first, split on a
concept boundary at 301, never trimmed. Coordinator-verified, not taken on trust:
0 over the cap, 0 console blocks, every file carries `t-master` + `> Verified:` +
`<!--FOOTER-->`, gotchas **5–9** and questions **5–9**, all varied.

🔴 **Concept findings from fork D worth keeping** (full detail with URLs in
`progress_java_p10_t04b_transactional.md`, 492 lines, committed):

- **Spring's `@Transactional` has NO `rollbackOn`/`dontRollbackOn`** — those are
  JTA's `jakarta.transaction.Transactional`. `@EnableTransactionManagement`'s
  "See Also" list is actively misleading on this.
- ⛔ **CORRECTED 2026-08-25 — `rollbackFor = RuntimeException.class` is NOT narrower
  than the default. It is a NO-OP.** Fork D banked the opposite ("silently stops
  rolling back on `Error`") and it is **wrong**; the pages that asserted it (`13`,
  `13b`) were fixed by the depth pass and `13d` now documents the mechanism.
  Verified from `RuleBasedTransactionAttribute.rollbackOn` on `main` **and
  re-verified independently by the coordinator against the raw source**: a rule whose
  `getDepth(ex)` is `-1` does not match, so with only a `RuntimeException` rule an
  `Error` leaves `winner == null` and the method falls through to
  `super.rollbackOn(ex)` → `DefaultTransactionAttribute.rollbackOn`, which is literally
  `return (ex instanceof RuntimeException || ex instanceof Error);`. The `Error` rolls
  back anyway. **The general form matters more than the example: explicit rules ADD to
  the default, they do not replace it** — so `rollbackFor = SomeCheckedException.class`
  keeps unchecked rollback as well.
- ⛔ **CORRECTED 2026-08-25 — it is NOT "the deepest match wins".** The javadoc says
  *"a rule with a **lower** matching depth wins"*, and the source agrees: `deepest` is
  initialised to `Integer.MAX_VALUE` and the test is `depth < deepest`, so the
  **shallowest** (closest in the hierarchy) match wins. Spring's own local variable is
  named `deepest` while holding the smallest depth, which is where the folklore comes
  from. ⚠️ This session's own fork brief repeated the folklore; the fork caught it.
- **Apparent doc conflict on `readOnly`, reconciled in `15b` with both sides
  quoted:** the reference's settings table says "Only applicable to `REQUIRED` or
  `REQUIRES_NEW`", while `TransactionDefinition.isReadOnly()` says it applies to
  any context including `PROPAGATION_SUPPORTS` (managed resources only).
- **A write inside an `AFTER_COMMIT` listener silently never commits** without
  `REQUIRES_NEW` — the javadoc's own words: *"with no commit following anymore!"*.
- **Boot 4 has no property for the rollback rule.** `spring.transaction.*` carries
  only `default-timeout` and `rollback-on-commit-failure`.
- ⚠️ **openjdk.org returns HTTP 403 to WebFetch** — use `curl -A "Mozilla/5.0"`.
  JEP 491 (virtual threads, no pinning on `synchronized`) is **delivered in JDK 24**,
  so pinning is a resolved question on the JDK 25 baseline. Worth telling every
  future fork, it costs a retry loop otherwise.

⚠️ **QUALITY SIGNAL ON FORK C, act on it at batch close.** C's files `03c` through
`11b` sit at **exactly 6 interview questions, fourteen files in a row**, while D's
range 5–9 over the same tier. That is precisely rule 13's uniform-count tell. It is
**re-judged per chunk, never blanket-passed** (the 2026-08-19 lesson) — the
thinnest candidates by line count are `05` (226), `11b` (229), `07b` (236),
`11` (238), `05c` (239), `09` (243).

⚠️ `12-the-other-propagations.md` came in at **363 lines** — over the cap. C was
still running when this was measured; if C has not split it by its report, the
coordinator splits it on a concept boundary. Never trim.

⚠️ **The QC script's entry counter needed fixing and the fix matters for every
future batch:** interview questions are written as `**★ …**` bold runs that **wrap
across lines**, so a one-line-bold regex under-counted them (reported 1 where the
file had 8) and would have hidden the uniform-count tell entirely. The counter now
counts a section entry as *a line opening with `**` whose predecessor is blank*,
falling back from `### ` headings. Verified against known-good files.

#### 🔴 ORDER EXTENDED 2026-08-25 — "continue with phase 11 after this batch lands"

The user's words, given while batch 2 was in flight. Read together with the same
message's *"complete it phase by phase"* and the standing *"One phase at a time to
complete"*, this is the **continuation** order, not a jump: **do not stop when
batch 2 lands.** Phase 10 has 14 topics and batch 2 only closes 04, so the run is:

**batch 3 = phase 10 topics 05–08 · batch 4 = 09–14 · close phase 10 · then phase 11.**

⚠️ Flagged to the user in the same turn so they can redirect if they did mean to
jump straight to phase 11 and leave phase 10 at 4/14. Absent that correction,
phase 10 is finished first — it is the phase the "phase by phase" rule names.

**Phase 11 · Testing is scaffolded and ready** — `docs/java/pages/phase-11-testing/`
holds `README.md` (11 rows, `🚧 0 of 11 written`) and `_category_.json`, nothing
else. Syllabus rows: `docs/java/syllabus/04-production.md` line 14 onward.
Target stack **JUnit 5 · Mockito · AssertJ · Testcontainers on Java 25**, and
⚠️ **Boot 4 removed `@MockBean`/`@SpyBean` → `@MockitoBean`/`@MockitoSpyBean`** —
every online sample of the Spring test slices is stale on exactly that point.
⚠️ **No Docker on this machine and no sandbox**, so Testcontainers (topic 07) is
documentation-validated like everything else — **no test-run output, ever.**

⚠️ Phase 11's README uses the tier class `t-when` for topics 10 and 11, where the
rest of devbible uses `t-when-needed`. Match the phase README, do not "fix" it
mid-run — it is a whole-corpus rename, not a phase-10/11 job.

Likely fork split for phase 11 (4 forks, whole topics, no shared directory):
**F1** 01 JUnit 5 (Master) + 03 parameterized · **F2** 04 Mockito (Master) + 02
AssertJ · **F3** 05 the pyramid + 06 MockMvc + 08 test data · **F4** 07
Testcontainers + 09 JaCoCo + 10 jqwik + 11 PIT.

### 🔴🔴 STANDING ORDER — 2026-08-24 night, session `bace755f`: RUN PHASE TO PHASE, DO NOT WAIT

The user's words, given as they went to sleep:

> *"I am going to sleep and once you complete current phase pick next phase and
> deploy agents make sure they are working the way your doing correct way and
> following instructions and they are taking valid documentation with simpler
> explanations"*

**What it authorises and requires:**

1. **Finish phase 10 · Data access — all 14 topics**, not just the topic in flight.
   Then **pick phase 11 · Testing and keep going**, phase by phase, without asking.
2. **Deploy agents.** Explicitly granted (*"You can deploy other agents … share the
   task and finish it"*, earlier the same evening). One chunk per agent; the
   coordinator QCs and wires.

   🔴🔴 **ONE BATCH AT A TIME — NEVER dispatch a new agent while another is still
   running.** The user's words, given as a correction the same night:

   🔴 **AGENT CRASH POLICY — set 2026-08-24 after a fork died mid-topic.** The user
   asked whether an agent could be told to wait out an internet or power failure
   instead of dying. **It cannot, and saying otherwise would be wrong:** when the
   fork's own model connection drops, the harness terminates it — there is nothing
   left running to do the waiting, and no prompt text changes that. What IS in the
   prompt's control, and what must be in every agent prompt from now on:

   1. 🔴 **Checkpoint to disk per FILE, never at the end.** This is the whole
      mitigation. The 2026-08-24 timeouts fork died mid-sentence on its sixth file
      and lost **nothing** — five finished files (1,460 lines) were already
      written. Had it batched its writes, all of it would have been gone.
   2. **Keep a `_plan.md` in the topic directory** listing every planned file and
      its status, so a retry resumes without the coordinator reverse-engineering
      what happened from `wc -l` and dangling links.
   3. 🔴 **Retry your own failed tool calls FOREVER, on a FIXED 60-second recheck,
      capped at 2 minutes. Never exponential.** The user's instruction, verbatim
      (2026-08-24): *"they have to wait and retry infinitely every 60 seconds once
      they will check either internet is available or not rather multiplying by 5
      min or 10 min etc max interval to re check is upto 2mins"*.

      So: a failed doc fetch waits **60s** and retries. Still down → wait **60s**
      again, and from there **never longer than 120s** between checks. There is no
      give-up count and no doubling — a 10-minute outage is ten quiet checks, not
      an abandoned topic. The wait command (a fork may not use a foreground
      `sleep`; poll with an until-loop):

      ```bash
      until curl -sS --max-time 10 -o /dev/null https://docs.oracle.com/; do sleep 60; done
      ```

      **Why fixed and not exponential**, in the user's own reasoning: *"power will
      eventually back up within 5 mins or 10, worst half an hour."* On that scale a
      60–120s recheck costs 15–30 quiet polls for the worst case, while a doubling
      backoff would be asleep through most of the outage and wake up late. There is
      nothing to back off from — the thing being waited for returns in minutes.

      ⚠️ **Know which failure each rule covers, they are not the same:**
      **network drops, machine up** → the retry loop is the protection and the fork
      finishes its topic. **Power actually cuts** → the whole session dies, forks
      included, and no retry loop survives because nothing is running. That case is
      covered only by rule 1 (per-file checkpointing) plus this file's cursor: a new
      session reads the cursor and resumes, losing at most one in-flight file.

      Only if a source is reachable but the specific *page* is permanently gone
      (404) do you move on — and then write the page without that claim and say so
      in the report. **Never invent the fact to avoid the wait.**
   5. 🔴🔴 **EVERY AGENT WRITES ITS OWN MEMORY — every 2 concept explanations, and
      again before it reports.** The user's instruction (2026-08-24): *"please
      inform to sub agents once they finish the task they have to update memory
      automatically and they have to update must n should every 2 concepts
      explanation they have update memory incase of worst there will good amount
      memory is saved."*

      ⚠️ **Each agent gets its OWN file — never a shared one.** Parallel forks
      editing one memory file clobber each other. Naming:
      `devbible/progress_java_p<NN>_t<NN>_<slug>.md`, that agent's alone, with
      normal frontmatter (`type: project`). It records: the files it wrote (name,
      lines, gotcha/question counts), **every load-bearing claim with the URL or
      source file it came from**, traps found, and anything still owed.

      The coordinator consolidates those per-agent files into the phase concept
      record at the batch close, and repoints this cursor.

      **Committing needs a retry** — another fork may hold the git index:

      ```bash
      cd /mnt/Storage/my-learning/claude
      until git commit -q -m "<msg>" -- devbible/<the file>; do sleep 20; done
      ```
      (with the `GIT_AUTHOR_*` / `GIT_COMMITTER_*` env vars, which this repo needs.)
      🔴 **`-m` must come BEFORE `--`.** An agent caught the earlier form here —
      `git commit -q -- <file> -m "msg"` — parsing `-m` as a pathspec and failing
      every time. Fixed 2026-08-24.

   4. 🔴 **The COORDINATOR auto-retries a `failed` agent**, immediately, with a
      resume-scoped prompt that lists the already-written files as **off-limits
      and not to be duplicated**. Do not ask whether to retry; do not re-dispatch
      the original prompt, which would rewrite what survived.

   > *"Do not deploy right now wait for current agents to finish this phase and
   > then only deploy not just now in future as well. One phase at a time to
   > complete. And once all the agents finish the task make sure to update memory
   > about the progress."*

   So the loop is fixed and has no judgement in it: **dispatch a batch → wait for
   every agent in it to report → QC and wire their output → write the memory →
   only then dispatch the next batch.** Overlapping batches are banned even when
   the work is in different directories and could not collide. And **one phase is
   finished before the next is started.**
3. 🔴 **The coordinator is responsible for agent output.** *"make sure they are
   working the way your doing correct way and following instructions"* — every
   returned file gets checked: `wc -l ≤ 300`, varied gotcha/question counts (a
   uniform 5 is the template tell), **no console blocks / no invented timings**,
   every link resolves, tier badge + `> Verified:` line present, footer wired.
4. 🔴 **"Valid documentation with SIMPLER EXPLANATIONS"** — this is now a style
   requirement in every agent prompt: primary sources only (docs.oracle.com,
   postgresql.org, jdbc.postgresql.org, spring.io, the JEPs), **and** plain
   language — short sentences, the concrete example before the abstraction, jargon
   defined the first time it appears. Depth is not the same as density.
5. 🔴🔴 **The USAGE KILL SWITCH at 80% still governs everything above** — see the
   section below. Wire the boards and repoint this cursor before stopping.


### 🔴 SESSION bace755f — 2026-08-24 — PHASE 10 TOPIC 01 · JDBC, IN FLIGHT

**Order:** *"Kick off java and focus one chapter at a time"*, then *"You can deploy
other agents … share the task and finish it"*. One topic at a time, forks author
chunks in parallel, coordinator QCs and wires.

🔴 **What the previous cursor got WRONG: phase 10 topic 01 was NOT "nothing
written".** Commit `ec241ea7` ("Working on java") left **16 chunks / 4,234 lines on
disk with no topic README, 5 dangling links, and the phase board still reading
0 of 14.** The topic was planned as **21 chunks** and stopped at 16 — inbound links
across 9 files pointed at `17-resource-handling.md`, `18-batch-updates.md`,
`19-generated-keys.md`, `20-sqlexception.md`, `21-timeouts-cancellation-metadata.md`,
none of which existed. **Always check for dangling links before trusting a "topic
done" claim.**

**Landed this session (`f0789595`):**

| File | Lines | Note |
|---|---|---|
| `01-jdbc/README.md` | 78 | the topic index — 16 chunks were unnavigable without it |
| `17-resource-handling.md` | 279 | draft hit **355 → SPLIT** on the mechanism/ownership boundary, not trimmed |
| `18-ownership-and-leaks.md` | 281 | 10 gotchas, 8 questions |
| `09-…-prepared-statements.md` | 160 → **294** | rule-13 depth pass: client-side statement cache, `DEALLOCATE`/`search_path` invalidation, **`cached plan must not change result type` (0A000)** |

### ✅ BATCH 1 LANDED (2026-08-24 late) — 24 files, ~5,100 lines, commit `8a8386cf`

| Fork | Files | Lines | Gotchas | Questions |
|---|---|---|---|---|
| 19 · Batch updates | 8 (`19`–`19h`) | 2,123 | 48 | 32 |
| 20 · Generated keys | 5 (`20`–`20e`) | 1,477 | 37 | 22 |
| 21 · `SQLException` | 5 (`21`–`21e`) | 1,414 | 28 | 25 |
| 22 · Timeouts | 6 so far (`22`–`22f`) | ~1,700 | — | — |

⚠️ **The 22 fork DIED mid-topic** (connection lost) after writing `22`–`22e`. It
lost **nothing** — per-file checkpointing meant a retry only had to cover `22f`
(cancellation) and `22g` (metadata). **This is the crash policy working; keep it.**

🔴 **Four coordinator repairs that a future batch will need again** — parallel forks
in one directory reliably produce these:

1. **Duplication across forks.** `19d` and `20d` both wrote the ON CONFLICT /
   batch-key correlation trap. Resolution: the richer one keeps it (`20d` — both
   fixes plus the manual's wording), the other keeps only its unique material and
   links across, with a reverse pointer added. Same for `19f` vs `22f` on the
   cancel-request mechanism.
2. **A dead fork's renames leave dangling links** — it had renamed files mid-run,
   so 3 links pointed at names that no longer existed.
3. **Frontmatter drift**: `22b`–`22e` carried `sidebar_label` "23"–"26" from the
   dead fork's original numbering, not matching their filenames.
4. **The 8 inherited links** naming the *planned* chunk numbers
   (`18-batch-updates.md`, `19-generated-keys.md`, `20-sqlexception.md`,
   `21-timeouts-…`) all repointed — **and their prose "chunk NN" labels corrected
   too**, which is the half that gets forgotten.

🔴 **DECISION — letter suffixes are KEPT, files are NOT renumbered.** `19b`, `22f`,
`06b` stay. They are self-documenting about their parent chunk, Docusaurus orders by
`sidebar_position` regardless, and renaming ~40 files to close a cosmetic gap would
churn every internal link for no reader benefit. The wiring script
(`scratchpad/wire_topic.py`) normalises `sidebar_position` to a strict 1..N reading
order and generates every footer from that order.

### ✅ TOPIC 01 · JDBC COMPLETE — 2026-08-24, 50 chunks, 13,838 lines

The cancellation/metadata retry closed it with **7 files, not 2**: a 554-line draft
split on four concept boundaries for cancellation and three for metadata.

**Whole-topic QC, all clean:** 0 files over 300 · 0 dangling links · 0 console
blocks · every file has a tier badge and `> Verified:` · question counts spread
**3–8** (the inherited 16 had been 10-of-16 at exactly five). Wired with
`scratchpad/wire_topic.py`: positions normalised 1..50, all 50 footers generated,
README rebuilt with a 50-row table. ⚠️ **Link-checked against the filesystem, NOT
built** — the build registry was not claimed (global rule 12).

🔴 **Concept findings worth keeping** (full detail in the per-agent memories
`progress_java_p10_t01_batch.md` and `progress_java_p10_t01_cancellation.md`):

- **`getColumnName` is NOT the underlying column on PostgreSQL** —
  `PgResultSetMetaData.getColumnName` is literally `return getColumnLabel(column);`.
  The universal "label = alias, name = real column" advice is **wrong here**; the
  real name needs `getBaseColumnName`, which fires a catalog query.
- **pgjdbc's cancel socket does no TLS negotiation** — `sendQueryCancel()` never
  calls `enableSSL`, so the cancel key crosses in clear text on a TLS connection.
  libpq deprecated `PQcancel` for the same defect.
- **`Thread.interrupt()` on a VIRTUAL thread closes the socket** (JDK 25
  `Socket.getInputStream` javadoc) — it destroys the connection without cancelling
  the query. Worse than the platform-thread no-op.
- **An autocommit batch IS atomic per Sync segment** — no `BEGIN`, but PostgreSQL
  opens an implicit transaction block, and the driver forces a Sync about every 256
  entries. A big batch is many implicit transactions.
- **`statement_timeout` does not bound a batch** (restarts per Parse/Bind/Execute);
  `transaction_timeout` is the real bound.
- **`RETURN_GENERATED_KEYS` becomes `RETURNING *`** and thereby **disables
  `reWriteBatchedInserts`** — asking for keys silently costs the 2–3× rewrite.
- **pgjdbc `getErrorCode()` is always 0** — an Oracle-style `switch (getErrorCode())`
  routes everything to `default`. And `PSQLException extends SQLException` directly,
  so `catch (SQLIntegrityConstraintViolationException)` is dead code on PostgreSQL.
- **`SQLRecoverableException` is a SIBLING** of the transient/non-transient branches
  — a two-branch retry predicate has a hole exactly at connection loss.

**Still in flight — nothing**, writing into
`docs/java/pages/phase-10-data-access/01-jdbc/`: `19-batch-updates.md`,
`20-generated-keys.md`, `21-sqlexception.md`,
`22-timeouts-cancellation-metadata.md` (+ `22b-` if split). Each writes
`<!--FOOTER-->` as its last line; **the coordinator wires every Prev/Next footer in
one scripted pass at the end**, then renumbers any `Nb-` split files.

🔴 **STILL OWED when the forks land** — do not call the topic done before these:
1. Wire all footers, renumber `Nb-` files, and **repoint the 12 stale inbound links**
   (they name old chunk numbers *and* old filenames — e.g. `[chunk 14](17-…)`).
2. Extend `01-jdbc/README.md`'s chunk table from 16 rows to the final count.
3. Phase README: `🚧 1 of 14`, topic 01 row → `01-jdbc/README.md`.
4. `src/data/progress.js` java phase 10 → `pages: 1, pagesPlanned: 14` **and the
   `updated:` stamp** (rule 15); `docs/java/pages/README.md`; `docs/README.md`.
5. ⚠️ `03-jdbc-transactions/` is an **empty scaffold** (only `_category_.json`) — an
   autogenerated category with no docs. Decide: delete it, or leave until topic 03.

⚠️ **Rule-13 tell measured on this topic:** the 16 inherited chunks ran 252–296 lines
with **10 of 16 at exactly 5 interview questions** — a template. Re-judged per chunk
(never a blanket pass). **Done: 09, 07, 06.**

| Chunk | Was | Now | What was actually missing |
|---|---|---|---|
| 09 | 160 / 3 Q | **294 / 5 Q** | the client-side statement cache, `DEALLOCATE`/`search_path` invalidation, `cached plan must not change result type` |
| 07 | 202 / 4 Q | **241 / 5 Q** + new **07b** (255 / 5 Q) | ordinal `ORDER BY`, NULLS FIRST/LAST defaults, the `CASE` sort and its planning cost, optional filters, dynamic projection |
| 06 | 285 / 4 Q | **273 / 4 Q** + new **06b** (189 / 5 Q) | statement **reuse** (values persist between executions — a data-corruption bug), `clearParameters`, `ParameterMetaData` |

**Both splits happened at 373 lines** — write it all, then split on the concept
boundary. Provisional positions: `06b`=7, `07b`=8; the whole topic is renumbered in
one pass at the end.

✅ **Empty `03-jdbc-transactions/` scaffold DELETED** (`_category_.json` only). The
java sidebar is autogenerated (`sidebars.js:39`) and a category with no items fails
the build. Recreate when topic 03 is written.


### ✅ SESSION 885d2430 — 2026-08-20 — PHASE 9 CLOSED 16/16. STOPPED ON THE USER'S WORD.

**Order:** *"Please focus on java completion"*, then mid-session *"Once completing
current task enough"* — finish phase 9, do **not** start phase 10.

🔴 **PHASE 9 IS COMPLETE. Phases 0–9 = 139/232 topics (60%).** All four boards wired,
everything committed, nothing left uncommitted on disk.

**Phase 9 final: 209 files, 51,348 lines, 0 over the 300-line cap, 0 broken links
across all 16 topic directories, 0 duplicated sections, no fabricated output.**

| Topic | Result | Commit |
|---|---|---|
| **08 · Validation** | repaired — 17 chunks + index, 4,554 lines. Missing messages chunk split into FOUR | `5d198852` |
| **16 · The alternatives** | new — 7 chunks + index, 1,914 lines | `87277187` |
| **10 · The request pipeline** | new — 10 chunks + index, 2,817 lines. Pinned filenames honoured | `ec2719bf` |
| **14 · OpenAPI with springdoc** | new — 10 chunks + index, 2,520 lines | `4def4f2a` |
| **13 · Actuator** | repaired — 20 chunks + index, 5,270 lines. 3 planned chunks became 9 | `4b74ec47` |
| **09 · Error handling** | repaired — 20 chunks + index, 5,613 lines. 'The gaps' became 6 chunks | `985b9ab0` |
| **12 · Outbound HTTP** | new — 18 chunks + index, 4,766 lines | `6fa61816` |
| **seam repair** | 59 stale placeholders repointed (incl. a backlog from EARLIER waves pointing at topics 02–07, 15) + 6 in topic 12 | `a186842a` |
| **boards + close** | phase README 16/16, progress.js, pages board, docs/README | `6fa61816` |

🔴 **Concepts recorded — READ THIS BEFORE PHASE 10 or any Spring work:**
`devbible/reference_java_concepts_phase9.md`. It carries three Boot 4 property
corrections that every online sample gets wrong, the springdoc stale-README trap,
and the repoint-table lesson.

⚠️ **Standing lesson, now proven 4 times in one session:** every agent handed a
repoint table found errors in it. **Never apply one without reading each link in its
sentence.**

⚠️ **Rule-13 judgement item left open (deliberately, not forgotten):** topic 13 has
twelve of twenty files at exactly 6 questions. The 2026-08-19 lesson says re-judge
per chunk rather than running a blanket pass — the thinnest are
`01-what-actuator-is` (227 lines), `10-custom-metrics` (215),
`05-liveness-and-readiness` (271).

## 🔴 START HERE — PHASE 10 · Data access (14 topics), nothing written

Phase 9 is closed and needs nothing. Begin at **phase 10 topic 01**, per
`docs/java/syllabus/03-application.md`'s phase 10 table, in row order.
Scaffold `docs/java/pages/phase-10-data-access/` exists with a README only.

**Remaining: 93 topics across phases 10–16** — 10 (14) · 11 (11) · 12 (15) · 13 (14)
· 14 (12) · 15 (14) · 16 (13). Estimated ~9 clean sessions, 10–12 with crash
overhead; the user was given that estimate and the option to split the remaining
phases three ways across parallel sessions (not yet answered).

| | |
|---|---|
| Phases 0–2 | ✅ **ALL COMPLETE — 44/232 topics** (P0 `dd7352b4`, P1+P2 `fe27f01e`+`90c3c691`+`d5df6063`), boards+progress.js+claims all current, 0 unresolved links |
| 2026-08-18 wave 1 landed | Session `143ea7ad` hit its usage limit mid-save; its final state IS committed as `9e3239ca`+`7789271e`: **P3 at 11/16, P4 at 3/13, depth pass 7 of 11 done** (P1 01,02,11,14 · P2 01,02,04 are chunked dirs). Incomplete scaffolds (P1 04, P2 03) were **rolled back to single-file form** and all links repaired — resolver reports **0 unresolved** |
| ✅ 2026-08-18 wave 2 COMPLETE | **Phases 3 and 4 CLOSED, depth pass 11/11 done — phases 0–4 = 73/232 topics.** Commits `f87eddc9` `abbef521` `63a03846` `0bd9960b` `b6f0db0f` `fcaf5528`. The 2 chunks the overnight run stranded (comparator contract, lambda composition) found and written. All inbound links to converted single-file Masters repointed (⚠️ the python resolver has a BLIND SPOT: it resolves `NN-topic.md` against directory `NN-topic/` and misses the dangling link — always grep for old paths after a conversion, don't trust "0 unresolved" alone) |
| ✅ Sweep done | `172f4a95`: 45 placeholders → links across P0–P4; 19 remain, all targeting unwritten phases 5–16. Concepts record: `reference_java_concepts_phase3-4.md` |
| ✅ PHASE 5 · Exceptions 8/8 WRITTEN (2026-08-18, session 01GCtxzK) | All 8 topics on disk; 03-try-with-resources (3 chunks, 720) + all board wiring committed `f2bf39d6` (phase README 8/8, pages board, progress.js P5=8 no pagesPlanned, docs/README rows+claim). Footer seams done (07←06, 04←03, 06→03 links restored). Resolver + old-path grep clean; 2 stale depth-pass links found and fixed (P1 primitives→04-operators-overflow/README.md, P3 contract→../07-hashmap-internals.md) |
| ✅ Rule-13 depth pass on P5 01–06 COMMITTED `225887e1` | The uniform-count tell (11 files at exactly 6 questions) fixed: counts now 6–8 varied, 2 files confirmed already exhaustive. Topic 03 re-pass done and committed `da2e68e9` — 🔴 **PHASE 5 IS CLOSED, 8/8, all boards current** |
| ✅ PHASE 6 · Concurrency CLOSED 17/17 (2026-08-18) | Commits `5da5c6cb` `4aff01a5` `1cce18c0` `21493401` `29047407` `d8346ad1` `12b9da89`. 42 files ~7,150 lines; Masters 02/03/04/06/15 + big Understands as chunked dirs; 80 intra-phase placeholders repointed at close (scripted — see concepts doc); boards all say phases 0–6, 98/232; syllabus pinning row corrected (tracePinnedThreads removed JDK 24). Concepts: `reference_java_concepts_phase5-6.md`. ⚠️ JEP 505 structured concurrency is STILL PREVIEW in 25; ScopedValue JEP 506 IS final |
| User orders today | *"finish the rest"* · *"ALll of the explanations should be indepth"* + wants per-topic line report · *"continue with nex phase"* · 2026-08-18: *"can you continue where we left off with java?"* |
| After wave | link-sweep (python resolver) → footers → P3/P4 board rows → progress.js → commit → memory → dispatch phase 5 (8), then 6 (17), 7 (13), 8 (12), 9 (16), 10 (14), 11 (11), 12 (15), 13 (14), 14 (12), 15 (14), 16 (13) |
| ✅ PHASE 7 CLOSED 13/13 (2026-08-18 evening) | Commits `c1cd81da` `44c99bc8` `580a7b93`. All 13 topics on disk; `java.time` (4 chunks) and Jackson (3 chunks) are chunked Master dirs. Boards all say phases 0–7, **111/232**. Footer seams closed, 0 unresolved links, 0 files over cap. Depth pass applied to java.time chunks 2 and 4 after a uniform-6-questions tell was caught. Stale phase-5/6/7 placeholders across phases 1,2,3,5,7 repointed to live links |
| ✅ PHASE 8 · The build CLOSED 12/12 (2026-08-19, session 32f4663f) | Commits `5b32ffdd` (11 topics) + `8fa5bf33` (Maven core + seams + boards; ⚠️ its message says Maven core is 2,264 lines — the fork was still writing when the count was taken, the true figure is 2,575). **53 files, 11,156 lines, 0 over the 300-line cap** (Maven core alone is 9 chunks / 2,575 lines) — every one of the 12 topics needed chunking, so **every phase README row points at `NN-topic/README.md`**, not a leaf `.md`. 6 forks authored in parallel; 2 got a rule-13 Q&A depth pass after landing on uniform counts (fork 6 had three files at exactly 5 questions; fork 5's thinnest chunks were 3). Both depth passes **split rather than trimmed** when a file ran out of headroom — `11-javac-flags/02` split into 02+03, and `01-maven-core` closed at **9 chunks**. Seams: 16 files had stale *(not written yet)* placeholders repointed once all 12 topics existed; Phase 7→8 boundary wired. **1,924 links across `docs/java` resolve, 0 broken, 0 resolving to a directory.** No fabricated build output (scanned `[INFO]`, `BUILD SUCCESS`, tree glyphs). All 4 boards at phases 0–8, **123/232** |
| ⬛ SUPERSEDED — kept ONLY for the version spine, which is still correct. Phase 9 is no longer "in flight" under `0fa3a189`; read the KILL SWITCH row below instead (2026-08-19, session `0fa3a189`) | Scaffold README existed (16 rows) and its banner said **"Spring Boot 3.x"** — 🔴 **STALE, corrected**. Web-verified 2026-08-19: **Spring Boot 4.1.0 (11 Jun 2026)** on **Spring Framework 7.0** (GA 13 Nov 2025), Jakarta EE 11, Jackson 3, JDK 25 first-class / 17 baseline. 🔴 **Boot 4 renames that break every online sample:** `spring-boot-starter-web`→**`-webmvc`**, `-aop`→`-aspectj`, `@MockBean`/`@SpyBean` **REMOVED**→`@MockitoBean`/`@MockitoSpyBean`, `Jackson2ObjectMapperBuilderCustomizer`→`JsonMapperBuilderCustomizer`, `@JsonComponent`→`@JacksonComponent`, new `-restclient`/`-webclient` starters, validation no longer transitive. **Framework 7:** `RestTemplate` DEPRECATED (formal in 7.1), Undertow/`spring-jcl`/`javax.annotation`/`ListenableFuture` REMOVED, **API versioning** + `@Retryable`/`@ConcurrencyLimit`/`@EnableResilientMethods` + `BeanRegistrar` + `@ImportHttpServices` NEW, JSpecify replaces JSR 305. Shared authoring brief (rules 1/13/2/8 + link forms + page shape + version spine) written to scratchpad `JAVA-P9-BRIEF.md` and given to every fork |
| ⬛ SUPERSEDED — the original fork split; both waves are over. Kept only to show which topics were assigned to whom. Phase 9 fork split (historical) | **Wave 1 dispatched** (4 forks, topics 01–08): F1=01 servlet model(U)+02 IoC container(M) · F2=03 DI(M)+04 scopes/lifecycle(U) · F3=05 auto-config(U)+06 config/profiles(M) · F4=07 REST controllers(M)+08 validation(U). **Wave 2 planned** (4 forks, 09–16): F5=09 error handling(M)+10 request pipeline(U) · F6=11 Spring Security(U)+12 outbound HTTP(U) · F7=13 Actuator(U)+14 OpenAPI(K) · F8=15 WebFlux(K)+16 alternatives(K). Forks are forbidden to commit, build, or touch boards — coordinator does all four boards at close |
| 🔴🔴 PHASE 9 — KILL SWITCH FIRED 2026-08-19 (session `60f3bc56`) | The user: *"We are about to hit 80% of usage from now onwards you go to save the sessions progress per file where it was completed for next session it should pick up where you left off"*. **All six forks stopped immediately, all four boards wired, everything sound committed.** Commits this session: `854936bc` (topics 01,02,05,07 recovered from the previous crash) · `0f322124` (topic 03 depth pass finished, chunk 05 split) · `d4bbe12c` (topics 06,11,15) · `8d589248` (all four boards). |
| ✅ PHASE 9 — COMMITTED AND DONE: **9 of 16 topics** | **01** servlet model 6+README · **02** IoC container 9+README · **03** DI **10**+README (was 9; chunk 05 split during the depth pass) · **04** scopes/lifecycle 5+README · **05** auto-config 8+README · **06** config/profiles **13**+README · **07** REST controllers 13+README · **11** Spring Security 14+README · **15** WebFlux 12+README. **869 links across `docs/java/pages/phase-9-spring-boot` resolve, 0 broken, 0 files over the 300-line cap, no fabricated output.** Boards all say **phase 9 = 9/16, Java 132/232**. |
| 🔴 START HERE — PHASE 9 · repair three half-written topics FIRST, they are ON DISK and UNCOMMITTED | Three forks were stopped mid-split. **Their chunks are complete, well-sized files — do NOT rewrite them.** Each needs (a) the missing chunk(s) named below, (b) a `README.md` topic index (every chunk links `README.md` and it does not exist), (c) its stale forward links repointed — the forks renamed chunks after linking them, the same failure class as the previous crash. Then QC and commit. |
| 🟡 2026-08-19 SECOND WAVE — dispatched then STOPPED on the user's word (*"I told them enough for now"*). **NO FILES WERE WRITTEN.** Disk state is exactly as at the kill switch. But the topic-08 fork did its reading first and returned research that must NOT be re-derived — recorded in the next three rows. |
| 🔴 CORRECTION — the repoint table for topic 08 in the "🔴 08 · Validation" row further down is WRONG in three places | Following it literally produces links whose *text* no longer matches the sentence. Verified by reading each in context: **`01:190`** `[chunk 5](05-custom-validators.md)` — the sentence is about the create-versus-update case, so it must become **`[chunk 12](12-validation-groups.md)`**, NOT 09. **`01:148`** `[chunk 5](05-custom-validators.md)` — "anything conditional needs a class-level custom constraint" → **`[chunk 11](11-cross-field-rules.md)`**, NOT 09. **`04:133`** `[chunk 7](07-custom-validators.md)` — the table row is labelled "cross-field rules" → **`[chunk 11](11-cross-field-rules.md)`**, NOT 09. **`01:72`** ("what injecting a repository into a validator can and cannot buy you") is arguably **chunk 10** (Spring-managed validators), a judgement call for whoever edits. The other ~20 repoints in that table are correct. ⚠️ **The general lesson: never apply a repoint table without reading each link in context.** |
| ✅ RESEARCH BANKED for topic 08's missing chunk 14 (messages and interpolation) — all quotable, do not re-fetch | **`LocalValidatorFactoryBean.setValidationMessageSource(MessageSource)`** javadoc: *"instead of relying on JSR-303's default `ValidationMessages.properties` bundle in the classpath"*; needs HV 4.3+; specify **either** this **or** `messageInterpolator`, never both; and 🔴 the `MessageSource` **must not** use `useCodeAsDefaultMessage` or Hibernate's own default messages stop resolving — that is the non-obvious gotcha to lead with. **Spring reference `core/validation/beanvalidation.html`** gives the exact adapted-error example: codes `Size.person.name` → `Size.name` → `Size.java.lang.String` → `Size`, message arguments `"name"`, `10`, `1`, and the properties form `Size.person.name=Please, provide a {0} that is between {2} and {1} characters long` plus `person.name=username` — ⚠️ **argument order is field-name, MAX, MIN**, a real trap. `DefaultMessageCodesResolver` defaults to `Format.PREFIX_ERROR_CODE`, resolving object+field → field → plain, collection elements resolved both indexed and whole. **Hibernate Validator 9.1 `ExpressionLanguageFeatureLevel`** (since 6.2), verbatim: `NONE` / `VARIABLES` / `BEAN_PROPERTIES` (*"minimal level to have a specification-compliant implementation"*) / `BEAN_METHODS` (*"can lead to serious security issues, including arbitrary code execution, if not very carefully handled"*). **Default is `BEAN_PROPERTIES` for constraint messages and `NONE` for custom violations** (HV-1816, 6.2) — precisely because custom-violation templates get built from user input. ⚠️ **NOT confirmed:** the escaping syntax for literal braces, and a verbatim sentence on `${validatedValue}` — re-fetch HV 9.1 reference §4.1 or state both cautiously (rule 8). |
| ⚠️ Topic 08 — two more findings | (1) **`../09-error-handling/` EXISTS and is fully written**, so chunk 14 links `../09-error-handling/09-message-codes-and-i18n.md` as a REAL link. That file already owns the `problemDetail.title.[FQCN]` scheme and `ProblemDetail` localisation, so chunk 14 must stay on **constraint** messages and hand off rather than duplicate. ⚠️ `08-reading-the-errors.md` ~line 136 still says "Topic 09 — Error handling *(not written yet)*" — stale, fix it when topic 09 lands. (2) **Footer chain audit:** 01→13 is correct EXCEPT `10-spring-managed-and-composition.md:244`, whose `Next →` reads "Cross-field rules and groups" pointing at the nonexistent `11-cross-field-and-groups.md` — fix both target and label. `08-reading-the-errors.md:267` labels its Next "Custom validators and groups" while chunk 9 is titled "Writing a custom constraint" — target valid, label stale. (3) **Tier: all 13 chunks are `t-understand`** — chunk 14 and the topic README must match, NOT `t-master` like the DI model file. |
| ✅ TOPIC 06 chunk 04 RE-CHECKED 2026-08-19 — the rule-13 worry was overstated | Spot-checked `04-relaxed-binding-and-env-vars.md` against the Boot reference. It **already covers** the three env-var rules with the critical dash-REMOVAL detail (`my.main-project.person.first-name` → `MY_MAINPROJECT_PERSON_FIRSTNAME`, not `MY_MAIN_PROJECT_…`), the four-format table with which property source each is valid for, the lossy-direction argument, `@Value` not getting relaxed binding, and a full "Map keys — where relaxed binding stops" section (keys are data, original characters preserved). 7 questions, 8 gotchas, 298 lines. **The content is genuinely there** — topic 06's uniform 6-or-7 counts look more like a well-covered topic than a starved one. Re-judge per chunk before assuming a pass is owed; the thinner candidates are 03 (204 lines) and 12 (231). |
| 🔴 08 · Validation — 13 chunks on disk, **24 broken links**, no README | Files 01–13: why-validate-at-the-edge(269) the-constraints(234) null-empty-blank(283) text-containers-placement(260) valid-at-the-boundary(203) collections-parts-parameters(251) the-failure(297) reading-the-errors(267) custom-validators(247) spring-managed-and-composition(244) cross-field-rules(277) validation-groups(258) beyond-the-controller(288). Q counts 5–9, varied. **Content is essentially complete except MESSAGES AND INTERPOLATION**, which is linked from four files as `NN-messages-and-interpolation.md` and was never written — write it as chunk 14. Stale targets to repoint: `05-custom-validators`→`09-`, `06-the-failure`→`07-`, `07-custom-validators`→`09-`, `08-beyond-the-controller`→`13-`, `10-beyond-the-controller`→`13-`, `11-cross-field-and-groups`→`11-cross-field-rules`+`12-validation-groups`, and the four `*-messages-and-interpolation` variants→the new chunk 14. |
| 🔴 09 · Error handling — 14 chunks on disk, **36 broken links**, no README | Files 01–14: the-error-shape-is-a-contract(235) the-resolver-chain(289) matching-which-handler-wins(244) handler-signatures(284) controlleradvice(279) problemdetail-and-rfc-9457(255) extension-members(229) errorresponse(214) message-codes-and-i18n(221) responseentityexceptionhandler(276) mapping-domain-exceptions(254) validation-and-foreign-exceptions(291) never-reaches-the-client(236) correlation-ids-and-logging(275). **MISSING: the final chunk, "the gaps"** — the fork's last words were *"Now the final chunk of topic 09 — the gaps"*; it is linked from five files as `NN-the-gaps.md`. It must cover: errors thrown in a Filter never reach `@ControllerAdvice` (outside `DispatcherServlet`), the `/error` fallback and `ErrorController`, async/`WebAsyncTask`, and errors during response-body writing after the status is committed. ⚠️ **Q counts are 3–7 with three files at 5 and one at 3 — run a rule-13 pass on 07 (Q=3) and 09 (Q=4).** ⚠️ Three links point into `../10-the-request-pipeline/` which does **not exist** — make them bold plain text *(not written yet)* unless you write topic 10 in the same session. |
| 🔴 13 · Actuator — 11 chunks on disk, **25 broken links**, no README | Files 01–11: what-actuator-is(227) exposure-access-and-ports(293) health-properly(266) health-aggregation-and-details(237) liveness-and-readiness(271) what-belongs-in-each-probe(297) groups-and-graceful-shutdown(286) metrics(232) what-boot-measures(266) custom-metrics(215) tags-filters-cardinality(284). **MISSING THREE CHUNKS**, all linked already: **12 · distributions and observations** (the fork was writing this when stopped), **13 · `/info` and the endpoint catalogue** (`env`, `configprops`, `beans`, `conditions`, `mappings`, `loggers`, `threaddump`, `heapdump`, `httpexchanges`, `scheduledtasks`, `caches`, `startup`), **14 · locking it down** (heapdump leaks every secret in memory; separate `management.server.port`; `EndpointRequest.toAnyEndpoint()`; sanitisation). Also repoint `06-groups-probes-and-shutdown`→`07-groups-and-graceful-shutdown` and `11-cardinality-and-observations`→`11-tags-filters-cardinality`. |
| 🔴 PHASE 9 — THEN WRITE THE FOUR UNSTARTED TOPICS | **10 · The request pipeline** (Understand — filters vs interceptors vs AOP, the full request path, the decision table for auth/logging/metrics, what Spring already gives you) · **12 · Outbound HTTP** (Understand — `RestClient`, 🔴 `RestTemplate` DEPRECATED, timeouts as the section that earns the topic, error mapping, Framework 7 `@Retryable`/`@ConcurrencyLimit`) · **14 · OpenAPI with springdoc** (Know — ⚠️ confirm its Boot 4 compatibility from the springdoc docs or say plainly it must be checked; never invent a version) · **16 · The alternatives** (Know — Quarkus/Micronaut/Helidon, build-time DI, native image, CDS/AOT). Their scaffold dirs were **deleted** at the kill switch (they held only a `_category_.json` and would have rendered as empty sidebar categories) — recreate them. Detailed per-topic outlines are in this session's transcript; the syllabus rows in `docs/java/syllabus/03-application.md` are sufficient to redo them. |
| ⚠️ PHASE 9 — QUALITY DEBTS (⚠️ item 1 is PARTLY RETRACTED — see the "TOPIC 06 chunk 04 RE-CHECKED" row above, which found the content genuinely exhaustive; re-judge per chunk rather than running a blanket pass) | (1) **Topic 06's question counts are 6-or-7 on all thirteen files** — this looked like the rule-13 uniform-count tell. A depth pass was dispatched with a specific gap list (relaxed binding's exact env-var rules and indexed properties; list-vs-map merging across property sources — lists REPLACE, maps MERGE; profile expressions and why `spring.profiles.active` is rejected inside a profile-specific document; what `configtree` does not do) and was **stopped before it ran**. (2) Topic 09's chunks 07 (Q=3) and 09 (Q=4) are thin. |
| 🔴 PHASE 9 — THE BRIEF, REGENERATE IT | A 167-line authoring brief (rules 1/13/2/8 in full, link forms, page shape, tier→shape guidance, the Boot 4.1 / Framework 7 version spine) was written to this session's scratchpad as `JAVA-P9-BRIEF.md` and given to every fork, plus a follow-up hard-rule reinforcement message. **The scratchpad is session-scoped and is GONE.** Regenerate it from the version-spine row below plus rules 1 and 13 in `~/.claude/CLAUDE.md`; every fork must read it in full before writing. Forks are forbidden to commit, build, or touch boards. |
| ⚠️ THE REPAIR CLASSES A KILLED FORK LEAVES — check all three, every time | (1) **Missing `README.md`** — chunks link it and the build breaks. (2) **Stale forward links**: the fork linked a chunk, then renamed it during a split. Seen 9 times in the first crash and ~85 times in this one. (3) **Duplicated body sections** — detect with `grep '^## ' f | sort | uniq -d`. A dead fork's link graph is the LAST thing it wrote and the least trustworthy part of its output. |
| Exemplar | `phase-0-platform-jvm/01-what-java-is/` — copy its shape exactly |
| Fork QC checklist | wc -l ≤300 · varied gotcha counts · no fabricated output · footers only to existing files · then: phase README rows → progress.js pages count → pages board → commit explicit paths |
| Phase 0 worklist | the 13 rows of `docs/java/syllabus/01-foundations.md` Phase 0 table, in order |
| Page shape | copy `docs/git/pages/phase-0-*/02-commit-is-a-snapshot.md`: frontmatter, tier badge, `> Verified:` line, bold thesis, sections, trade-off, Gotchas (Symptom/Cause/Fix), Interview questions (exhaustive — rule 13), ← Prev / Next → footer |
| Evidence | **NO sandbox, NO console blocks** — documentation-validated (docs.oracle.com/en/java/javase/25/, JLS, openjdk.org JEPs); Java *code examples* fine, program *output* never |
| Chunking | >300 lines → `NN-topic/` dir with `_category_.json` + README + chunks |

**Order (2026-08-17, superseded by the above):** *"review the existing syllabus in such
way with all topics and real world explanation snippets i want you to create a syllabus
for java and python in this"* — syllabus only (instructions.md §10).
Style copied from the Node.js syllabus: part files with phase tables, tier badges,
real-world framing inside each topic row, phase gates, `.md` prev/next links.

## Part 5 — Distributed Java (added 2026-08-17, evening)

User asked whether Spring/JDBC/REST/Security/JWT+OAuth/Hibernate/Maven/microservices
were covered; gaps were **OAuth2 flows** and **microservices**. On *"Please cover all
non covered topics"* wrote `docs/java/syllabus/05-distributed.md` (140 lines,
commit 0fb94449): **Phase 13** OAuth2/OIDC (14 topics) · **Phase 14** microservice
architecture (12) · **Phase 15** messaging/event-driven — Kafka, RabbitMQ, outbox,
sagas (14) · **Phase 16** resilience + fleet ops (13). Java totals now **5 parts,
17 phases, 232 topics — Master 68 (29%) · U 111 (48%) · K 46 (20%) · WN 7 (3%)**.
All boards updated (java README, pages board, progress.js 4 new phases, docs/README
claims + technology rows). Unit testing was already covered — Phase 11 (JUnit 5,
Mockito, AssertJ, MockMvc, Testcontainers); told the user so.

## Version facts (web-verified 2026-08-17)

- **Java**: LTS = **JDK 25** (Sept 2025); JDK 26 GA 17 Mar 2026 (26.0.2, non-LTS,
  support ends Sept 2026); **JDK 27 GA 15 Sept 2026** (non-LTS; structured concurrency
  heading to final, per ADTmag/InfoQ). LTS cadence 2 years: 17 → 21 → 25.
- **Python**: current **3.14.7** (5 Aug 2026); 3.13.15 maintained; **3.15.0 due
  1 Oct 2026** (PEP 790; RC1 4 Aug 2026; lazy `lazy` imports headline).
  Free-threaded CPython officially supported since 3.14 (PEP 779).

## State

| File | State |
|---|---|
| `docs/java/{,syllabus/,pages/}_category_.json` | ✅ written (positions: java 31, python 32) |
| `docs/java/syllabus/01-foundations.md` | ✅ phases 0–2 (13+16+15 topics) |
| `docs/java/syllabus/02-core-library.md` | ✅ phases 3–6 (16+13+8+17) |
| `docs/java/syllabus/03-application.md` | ✅ phases 7–10 (13+12+16+14) |
| `docs/java/syllabus/04-production.md` | ✅ phases 11 (11) + 12 (15) |
| `docs/java/README.md` | ✅ — **179 topics, Master 53 (30%) · U 84 · K 36 · WN 6**; parts 44/54/55/26; JDK 25 LTS target |
| `docs/java/pages/README.md` | ✅ stub status board, all 13 phases Planned |
| `docs/python/syllabus/01-foundations.md` | ✅ phases 0–2 (12+16+10) |
| `docs/python/syllabus/02-data-model.md` | ✅ phases 3–6 (12+15+10+12) |
| `docs/python/syllabus/03-application.md` | ✅ phases 7–10 (12+13+14+13) |
| `docs/python/syllabus/04-production.md` | ✅ phases 11 (12) + 12 (12) |
| `docs/python/README.md` | ✅ — **163 topics, Master 49 (30%) · U 77 · K 30 · WN 7**; parts 38/49/52/24; 3.14 target |
| `docs/python/pages/README.md` | ✅ stub status board, all 13 phases Planned |
| Wiring | ✅ DONE (c8614f76) — sidebars.js (2 entries), progress.js (java+python LANGUAGES), homepage index.js (cards n 26/27 in Backend group), docs/README.md claims row + technology rows |

## Traps / decisions

- **No build** (rule 12, registry unclaimed) — verify by filesystem link-check + `wc -l ≤300`.
- Links: `.md` form with numeric prefixes kept (global rule 1) — NOT the instructions.md §6 slug form.
- `pages: 0` phases render unlinked in Progress component → no broken links without pages/.
- Java/Python are NOT in instructions.md §2 scope table — left untouched (rule 6); flag to user.
- Java Master target ~28%; count badges with grep before writing tier-distribution tables.

## Build-fix episode (2026-08-17 evening)

User reported the build failing. Two causes, both fixed:
1. **Missing progress.js entries** — `summarise('java')` crashed on `lang.phases`
   once the new READMEs rendered `<Progress>`. Fixed by the wiring commit `c8614f76`.
2. **Two MDX-broken TypeScript pages** (registry-flagged, other lanes' files) fixed
   mechanically on the user's instruction in `8458da80`: bare `Promise<User>` in prose
   backticked (`phase-10-strictness/10-the-error-codes/06`), stray literal `</content>`
   removed (`phase-10-strictness/11-typescript-eslint/05`). The third registry-flagged
   file (phase-6 `05-export-equals-vs-default.md`) already compiled — owner fixed it.
- Whole-tree MDX sweep: **3,264 files, 0 failing** outside the excluded `**/reviews/**`.
- One build failure on `docs/README.md` was NOT reproducible — almost certainly another
  session's mid-edit snapshot (shared checkout).
- Isolated build claimed in the registry as `01HjXPf1`; user's own `yarn start` dev server
  (PID 39568, ~4 GB) was running unclaimed throughout — not mine, left alone.
