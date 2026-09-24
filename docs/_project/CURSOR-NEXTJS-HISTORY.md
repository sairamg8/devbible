---
name: cursor-nextjs-history
description: Cold history rotated out of CURSOR-NEXTJS.md — superseded session blocks, verbatim. Opened by name or by recall.sh, never on the hot path
metadata:
  type: progress
---

# CURSOR-NEXTJS.md — history

---

<!-- rotated out of CURSOR-NEXTJS.md on 2026-09-08 -->

## ⏹️ (the wind-down that preceded the close) 2026-09-05 · everything committed and PUSHED

`origin/main` = **`1caf0238`** · memory store pushed · **working tree CLEAN, 0 uncommitted.**
CI green: build **and** deploy, with `onBrokenLinks: 'throw'` and **0 broken links**.

### 🔴 THE HEADLINE — the corpus is in far better shape than the review scores implied

**86 quote suspects were read by hand across six lanes. 14 were real defects. The false-positive
rate was 82–100% in EVERY lane and every chapter.** Genuine quote defects are on the order of
**1–3% of 3,280**, so **quote accuracy is ~97–99%**, not the 77.5% mechanical match rate.

⚠️ **Do not repeat "77.5%" as a defect rate** — it is a *match* rate and 87% of what it flagged was
fine. Full numbers, the five defect classes and the tool refinements:
[[reference-nextjs-quote-sweep]].

### What was DONE this session

| | |
|---|---|
| **ch16 CLOSED** | 72 files · 16,066 lines · 1,139 ★ — the last unwritten chapter |
| **ch09 CLOSED** | the 3 pages it promised and never wrote |
| **ch05 VALIDATED** | 26 files · **12 S1s** · 5 concept-boundary splits |
| **ch01 + ch03 VALIDATED** | 19 files · 8 S1s |
| **Quote sweep** | 3,280 quotes vs a 546-page mirror; 2,541 proven verbatim |
| **Attribution sweep** | 350/399 (87.7%) match their own cited page |
| **Stale-mechanism sweep** | 115 candidates, **no live defect class** — the corpus teaches the inversions |
| **`onBrokenLinks` → `'throw'`** | on the user's instruction, proven green |
| **Pins** | `vitest` 5.0.0 added — 92 pages taught it unwatched |

### 🔴 STILL OWED — small, and none of it blocking

1. **Two lanes were stopped mid-run at windup** and their worklists deleted. **Regenerate with
   `shared/scripts/quotesweep.py`** rather than hunting for the old JSON:
   - **misattribution** — ~46 remaining of 48 (ch03 + ch10's 18 came back **18/18 exact**)
   - **self-quotation** — ~39 remaining of 42 (ch19 `04b`'s 3 were done, and were verdict **E**,
     missing citations rather than miscostumed prose)
2. ⚠️ **Two house-convention questions, raised twice, still undecided** — bold added inside quotes
   the source lacks, and elided signatures inside quotes. 🔴 **Do not mass-change either.**
   Recommendation: write the convention into `.agents/references/house-style.md` and leave the
   quotes alone.
3. **Validation coverage is 47 of 659 files (~7%).** Every chapter-level review scored 0–70% against
   the user's 90% bar — but see the headline: that metric fails a whole page for one defect, and
   the quote-level measurement is ~97–99%. **Decide which metric the 90% bar applies to before
   spending 30 fork-runs.**
4. `DATABASE_URL_DIRECT` vs `DIRECT_URL` (ch15 `01b`/`01c` are the outliers) · PostgreSQL **18.6**
   vs pinned **18.4** (currency lane) · ch03's four depth findings (**authoring, not validation**).

### 🔴 Method that is now proven — do not relearn it

- **Validation forks must be TOPIC-scoped (3–8 files)** and must carry *"stamp each file as you
  finish that file"*. Three chapter-scoped forks stalled at 600s having written **nothing**; the
  retry with that one line succeeded completely.
- **Decide every cross-lane question BEFORE dispatch.** Five forks in one directory, zero collisions.
- **Give a lane the proven false-positive classes up front.** That is what stopped the adjudication
  lanes wasting 87% of their effort.

## ✅ (closed) ch05 VALIDATED · the quote-adjudication lanes

**ch05 is DONE** (`693e6ba3`): 26 files stamped, **12 S1s**, and 🔴 **five concept-boundary splits**
rather than trims — the three-cache-directives topic went 9 files / 2,267 lines to **14 / 3,315**.
Four topic-scoped lanes; the topic-scoped brief worked where chapter-scoped stalled three times.

### 🔴 THE SAMPLING RULE RETURNED "REWORK"

Every review scored **0–70%** against the user's 90% bar (clean = zero S1 **and** zero S2):
ch01 67% · ch03 70% · ch05 lane A 40% · lane B 50% · **lane C 0%**. A 20-file random sample was
drawn with a fixed seed ([[project-nextjs-validation-sample]]) and **deliberately not run** — five
reviews at 0–70% cannot be overturned by twenty more files. ⚠️ Both samples were judgement-picked,
which biases **downward**; say so when quoting the numbers.

### 🔴 THE QUOTE SWEEP — read [[reference-nextjs-quote-sweep]] before any validation work

**3,280 quotes vs a 10.5 M-char mirror of ALL Next.js docs + every cited source: 2,541 (77.5%)
proven verbatim**, 429 unverifiable, 212 MED, **98 HIGH**. Measured banding showed **~50% of the
HIGH list is tool noise**, so lanes were sent at the **52** with least real text behind them.

⚠️ **The tool matches the whole corpus, not the cited page** — so 77.5% proves the sentence is real,
**not** that the page cites it correctly. A second pass would close that.

🔴 **Second defect class, worse than misquoting: the author's own prose formatted as a quotation.**
*"A published blog post should appear on the index within an hour. If it takes two, nobody
notices."* — no doc says that. **Restyle as prose; the idea stays, the false framing goes.**

**Lanes E / F / G were mid-flight** on ch02 · ch11+13+15 · ch06+08+09+10+19. Their worklists are the
untracked `.qs-lane{E,F,G}.json` in the repo root — 🔴 **delete those once read; scratch, not
content.** What they return — the A/B/C/D verdict ratio — is the number that settles the sweep.

### ch11 is still the next chapter-wise validation target
29 files (`01b` done). ⚠️ ch05 and ch11 were claimed by forks that stalled and wrote nothing; both
were free, and ch05 is now done.

## 🔒 (closed) LIVE CLAIM — ch05 validation lanes

`docs/nextjs/pages/05-caching-ppr-and-cache-components/` — **21 files, 4 lanes, topic-scoped.**
⚠️ **Off-limits to every other session while this block stands.**

| Lane | Files | Scope |
|---|---:|---|
| A | 5 | index + topic 01 (the `cacheComponents` model) |
| B | 4 | topics 02 + 03 (`cacheLife`, PPR, the shell, crawlers) |
| C | 3 | topics 04–06 — **the numbers lane** (`05-turbopack-build-caches` is the riskiest page) |
| D | 9 | the chunked `10-the-three-cache-directives/` |

🔴 **Every lane carries "SAVE PROGRESS FIRST, THEN WORK"**, on the user's explicit order: validate
one file → write its `> Validated:` stamp to disk **immediately** → only then move on. Never hold a
batch of edits in memory. **A stamp on disk is the progress bar**, so an interrupt at any moment
loses at most one file. The coordinator commits stamped files incrementally rather than at the end.

**ch11 is NEXT, chapter-wise** — 29 files left (`01b` already validated). Do not start it in another
session while ch05 runs.

## 🔴 START HERE — the track is WRITTEN. The remaining work is VALIDATION.

**Do not look for an unwritten chapter; there isn't one.** All 20 chapters, every page badged and
carrying a `> Verified:` line. `origin/main` = `fcc4193d`, memory store = `93cff07`, both pushed.

### The next session's first move, in order

**1 · Read the CI result before anything else.** Run `33960724317` was in progress at hand-off:

```bash
gh run view 33960724317
```
If it failed, `gh run view 33960724317 --log-failed`. 🔴 **Fix it in CI, not with a local build** —
see the banner at the top of this file.

**2 · Then take ONE TOPIC of validation.** Not a chapter. The unit that works is a topic (3–8
files). Pick from the unvalidated list below, and put this line in the brief verbatim:

> *"Stamp each file as you finish that file, rather than reading everything and editing at the end."*

That single instruction is the difference between the three forks that stalled and the one that
finished. **Also carry:** the S1–S5 ladder, 🔴 S5 is ledger-only, and 🔴 **check every `> *"…"*`
against its source — the highest-value finding of the first pass was quotes the source does not
contain.**

### Validation ledger — 20 of ~599 files

✅ **ch01** 9/9 · **ch03** 10/10 · **ch11** 1/30 · **ch07** 1/35 (pre-existing)

🔴 **Unvalidated, pick any:** ch02 (51) · ch04 (39) · ch05 (12+9 chunked) · ch06 (26) · ch08 (57) ·
ch09 (23) · ch10 (46) · ch12 (59) · ch13 (20) · ch14 (10) · ch15 (68) · ch16 (72) · ch17 (20) ·
ch18 (18) · ch19 (19) · ch20 (14).

⚠️ **ch05 and ch11 were claimed by forks that stalled and wrote nothing — both are FREE.**

### Also owed, and small — under an hour total

- **`DATABASE_URL_DIRECT` vs `DIRECT_URL`.** ch15 `01b` and `01c` are the outliers; ch15 `01ga`,
  `01ia`, the ch15 milestone and all of ch16 use `DIRECT_URL`. One variable, two names.
- **PostgreSQL 18.6 shipped 2026-08-13**; the corpus pins **18.4**. 🔴 Currency lane's call, not a
  topic session's.
- **ch03's four depth findings** — recorded in this file below. 🔴 **Authoring, not validation.
  Do not fold them into a validation pass.**

---

## ✅ 2026-09-05 · session `d2e9b9fe` — 🔴 **CHAPTER 16 IS CLOSED. EVERY CHAPTER IN THE TRACK IS NOW WRITTEN.**

**ch16: 72 files · 16,066 lines · 1,139 ★ · 13 topics · positions 0–71 gap-free** (`ed9cb623`).
Chapter-wide QC all green — 0 over cap · 0 missing badge/`> Verified:`/Gotchas/Interview questions ·
0 `{/* FOOTER */}` · 0 `*(not written yet)*` · 0 duplicate positions · 0 control bytes ·
0 ` ```console ` · **948 relative links, 0 dangling** · 0 MDX hazards.

**ch09 also closed** (`ecea9696`) — it had promised three pages nobody ever wrote, one of them a
dead `Next →` footer. 23 files, gap-free 0–22.

### 🔴 WHAT IS ACTUALLY LEFT IN THIS TRACK — read this before picking anything

**Not authoring. Every one of the 20 chapters is written and every page carries a `> Verified:`
line.** What the track has never had is a **re-validation pass**: `grep -c '^> Validated:'` was
**ZERO on 19 of 20 chapters** when this session measured it. That is the remaining work, and it is
`devbible-topic` **Job 4**, not Job 1.

**Validated in session `d2e9b9fe`: ch01 (9/9), ch03 (10/10), ch11 `01b`.** 20 files of ~600.

🔴 **Forks F, G and H all stalled on the FIRST attempt at chapter scope. Fork G's RETRY succeeded
completely**, and the only thing that changed was one instruction: **stamp each file as you finish
that file, rather than reading everything and editing at the end.** That is the fix — not a
smaller chapter, not fewer fetches. Put it in every validation brief.

**What ch01+ch03 found, and why the programme is worth continuing:** four Next.js changes
**inverted** behaviour rather than adding to it, so the old advice is not incomplete — it is
backwards, and a page written against it reads as correct:
- `GET` Route Handlers were cached by default before 15 and are **not** now, which makes the
  widely-repeated *"your handler only logs at build time"* pitfall exactly wrong.
- `request.ip` / `request.geo` removed in 15 — a removed property reads `undefined` in plain JS,
  so a rate limiter keyed on it collapses every caller into one bucket and **fails open, silently**.
  TypeScript users get a compile error and never see it.
- `force-static` does not error on `cookies()`/`headers()` — it **blanks** them, so an auth check
  takes the logged-out branch.
- `experimental.useTypeScriptCli` is an **opt-out** despite its name.
🔴 **Unclaimed and unvalidated — 15 chapters, pick any:** ch02 (51 files) · ch04 (39) · ch06 (26) ·
ch07 (35, has 1 stamp) · ch08 (57) · ch09 (23) · ch10 (46) · ch12 (59) · ch13 (20) · ch14 (10) ·
ch15 (68) · ch16 (72) · ch17 (20) · ch18 (18) · ch19 (19) · ch20 (14).

### 🔴 The S1 class the ch01/ch03 pass found — check for it in EVERY chapter

Fork G found **8 S1s across 19 files**, and the majority were one defect class the corpus has no
detector for: **text presented as a verbatim quote that the source does not contain.**

- `05-enforcing-boundaries` quoted the docs *twice* as *"keeps lint rules about extraneous
  dependencies quiet"*. **That sentence does not exist.** The real one is *"In Next.js, installing
  `server-only` or `client-only` is **optional**. However, if your linting rules flag extraneous
  dependencies, you may install them to avoid issues."*
- `02-use-client` had a table column headed **"The error says"** with three approximate error
  strings under it — program output reconstructed from memory, which the no-sandbox rule forbids.
  Column renamed to "What failed" and the cells rewritten as descriptions.
- `03-core-philosophy` and ch03 `03-composition-patterns` both raised
  `` `Functions cannot be passed directly to Client Components` `` as an error string. Replaced with
  the documented sentence.
- `03-composition-patterns` listed **Promises as non-serializable**. React supports them and
  Next.js documents the `use` pattern outright — a flatly wrong row in a reference table.

🔴 **`> *"…"*` formatting makes a paraphrase look sourced, and nothing checks it.** A page can pass
the badge, `> Verified:`, link, cap and MDX checks while quoting a sentence nobody wrote. **This is
the single highest-value thing a validation pass does** — assume every chapter has some.

### ch03 depth findings — recorded, NOT written (they are authoring, not validation)

Fork G judged ch03 well-evidenced overall, and named four specific gaps:
1. `01-explanation.md` (56 lines) has **no `## Gotchas` and no `## Interview questions`**; ch01's
   equivalent overview has both.
2. `03-composition-patterns` is missing the **compound-component break** — a Server Component
   importing a Client Component gets a client reference, so `Menu.Item` is `undefined` and React
   throws *"Element type is invalid"*; the fix is named exports rather than static properties.
3. Same page misses the **TypeScript-plugin rule for function props** — allowed when the prop is
   named `action` or ends in `Action`, flagged otherwise. Its table has a flat "Receive a function
   prop: **No**" row that this qualifies.
4. **No ch03 page cites `/docs/app/guides/server-and-client-boundary`**, now the doc most directly
   about the chapter's subject and the crispest statement of its central claim.

⚠️ **Do not fold these into a validation pass.** They are a separate authoring job.

🔴 **SCOPE A VALIDATION FORK TO ONE TOPIC, NOT ONE CHAPTER — three of four stalled at chapter scope.**
Session `d2e9b9fe` dispatched four: ch05 (21 files), ch01+ch03 (19), ch11 (30), and a retry of the
ch01+ch03 pair. **Three stalled with the watchdog reporting no progress for 600s, and all three had
written NOTHING to disk** — they stalled inside the research phase, before the first stamp. Nothing
to salvage, which is the one mercy.

**What to do differently:** give a fork **one topic** (3–8 files), tell it to **stamp each file as it
finishes that file** rather than reading everything and editing at the end, and cap the number of
`WebFetch` calls it plans. A chapter-scoped validation brief asks for ~25 fetches plus 30 file
reads before the first write, and that shape is what died.

⚠️ **Fork H did produce one real finding before it stalled, and it was worth the run** — see
`be32b5db`, ch11 `01b`. So partial output from a stalled fork is worth chasing down by hand.

**Method for whoever takes one:** read `.agents/references/verification.md`, re-check LOAD-BEARING
claims only at the lowest sufficient tier, classify **S1–S5**, and 🔴 **S5 is ledger-only** — a
validation pass that rewrites prose stops being a validation pass. Stamp every file under its
`> Verified:` line, leaving that line intact.

⚠️ **Both repos are AHEAD of their remotes and unpushed** — `devbible` main and the memory store.
The user has not been asked yet; a push is worth doing deliberately.

---

## 🔒 (closed) LIVE CLAIM — 2026-09-05 · session `d2e9b9fe` · ch16

### 🔒 ALSO CLAIMED — the first re-validation pass the track has ever had

On *"Deploy 3 agents and you monitor"*. 🔴 **Measured 2026-09-05: `grep -c '^> Validated:'` was
ZERO on 19 of 20 chapters** (ch07 had a single stamped file). Every page in the track was written
and none had ever been re-checked. That is the genuine remaining work once ch16 closes, and it is
`devbible-topic` **Job 4**, not authoring.

| Fork | Chapter | Files | Chosen because |
|---|---|---:|---|
| F | `05-caching-ppr-and-cache-components/` (incl. the chunked `10-the-three-cache-directives/`) | 21 | most volatile surface in Next 16 — `use cache` × 3, `cacheLife`, PPR, `updateTag` |
| G | `01-introduction-to-next-js/` + `03-server-components-vs-client-components/` | 19 | the foundations; ch01 drifts every release, ch03 is the most load-bearing chapter in the track |
| H | `11-performance-optimization-turbopack/` | 30 | Turbopack moves fastest, **and performance pages attract unprovenanced NUMBERS** — no sandbox has ever existed here |

**All three briefs carry the S1–S5 ladder and the same hard line: 🔴 S5 is ledger-only.** A
validation pass that rewrites prose stops being a validation pass, and that is the failure mode to
watch for in the reports.

⚠️ **Do not start a validation pass on ch01, ch03, ch05 or ch11 from another session** while this
block stands. Every other chapter is unclaimed and unvalidated — that is 15 chapters of the same
work available to whoever picks it up.

### Progress so far this session — all committed

| Commit | What |
|---|---|
| `930aa53d` | ch04: the "chapter 5, cache directives" placeholder was **stale** — that topic has nine files since 2026-09-03 |
| `caca0f2a` | ch16 forks **C + D** — 4 footers, 18 placeholders, both overlaps, and the 412→409 fix |
| `5e77338f` | ch16 fork **E** — 3 footers, 13 placeholders, and 🔴 **the two `cardETag` definitions never agreed** |
| `f14e3135` | ch16 `05ea` — the coordinator ruling on `UNIQUE (board_id, position)`: the schema declines it |
| `ecea9696` | **ch09 CLOSED** — the three pages it promised and never wrote (`02c`, `04e`, `04f`), renumbered 0–22 |

🔴 **Forks A (topic 12) and B (topic 13) were still writing when this block was last updated.**
Their files are on disk and **untracked** — `12*.md`, `13*.md`. If this session died, they are
**salvage**: QC them (cap, badge, `> Verified:`, footers, links, mdxcheck) and commit before
writing anything new. Their first chunks forward-link to their own later chunks, so a link check
will show dangling `12x`/`13x` hrefs until they finish — that is expected mid-run, and a defect
at close.

### Still owed to close ch16, in order

1. **The topic-12/13 placeholders** — `11-ownership-on-the-api-surface.md` (footer),
   `10b-never-leak-a-driver-error.md` (footer), and `01-explanation.md`. Nothing else references them.
2. **`01-explanation.md`** — its chunk table still carries **13** bold *(not written yet)* rows and
   a `Start → **The resource contract** *(not written yet)*` footer, while topics 01–11 are all on disk.
3. **The gap-free renumber**, 0–N in reading order. Current positions are 0 and 10–72 plus the forks' 73+.
4. **Footer arity.** Forks C/D/E flagged it and they are right: ~40 pre-existing footers are the
   two-link form (`← prev · Next → next`); `11`, `10b` and the 7 replaced ones are three-link with
   `[Chapter index]` / `[Chapter 16 overview]`. **Pick one for the chapter and normalise.**
5. `src/data/progress.js` row for ch16, then watch the build.


User order: *"Please finish next js"*. **ch16 is the only open chapter in the track** — every
other chapter measured green on disk (all 20 directories, 0 files missing a `> Verified:` line).
So finishing Next.js == closing ch16.

**Claimed BEFORE dispatching**, per the ch7 three-session collision precedent.

`docs/nextjs/pages/16-building-a-crud-api-with-postgres/` — 56 files, positions 0 and 10–72.

**FIVE forks**, on the user's own instruction *"You can dispatch max 3 more agents and split the
work please"* — two authoring, three wiring. Disjoint file sets, disjoint position blocks.

| Lane | Owns | Files |
|---|---|---|
| fork A | **writes topic 12 · Testing the API** | new `12*.md`, positions **73–89** |
| fork B | **writes topic 13 · Project milestone** (chapter close) | new `13*.md`, positions **90–99** |
| fork C | footers + placeholder repointing, topics 01–04 | `01-the-resource-contract` … `04e` (18 files) |
| fork D | footers + placeholders, topics 05–06, **owns the READ side of both overlaps** | `05*` `06*` (15 files) |
| fork E | footers + placeholders, topics 07–11, **owns the WRITE side of both overlaps** | `07*` `08*` `09*` `10*` `11*` (22 files) |
| coordinator | `01-explanation.md`, the topic-12/13 placeholders, the gap-free renumber, `progress.js`, every commit | — |

🔴 **The two overlaps were DECIDED by the coordinator before dispatch, so no fork negotiates
with another mid-run.** `cardETag` is canonical in **`06g`** (read side) and `07e` links it.
The `position` sparse-double scheme is canonical in **`05ea`** (create side, where the value is
minted) and `07g` links it. Each fork edits only its own half and reports rather than acting if
it disagrees.

🔴 **Every fork was told: leave references to topics 12 and 13 as `*(not written yet)*`.** Those
files do not exist while forks C/D/E run, and a fork linking them breaks the build for all five.
The coordinator repoints them once A and B land.


## ⏹️ 2026-09-05 · session `ae47a09e` — WORKTREES CONSOLIDATED, `main` is the only checkout

On *"merge all worktrees to main and delete them"*. **All four worktrees and all four
`claude/*` branches are gone; there is only `main`** at `/mnt/Storage/Backup/Knowledge/devbible`.

| Worktree | Unique commits vs `main` | Outcome |
|---|---|---|
| `confident-bell-27c017` | **8** (the link fixes) | merged `--no-ff` as `ee04f029`, then deleted |
| `agitated-kare-23d41a` | 0 | deleted (its 6 commits ahead of its own remote were all in `main`) |
| `interesting-herschel-3fd9c3` | 0 | deleted |
| `jolly-diffie-4abc33` | 0 | deleted |

🔴 **`git branch -d` refused `agitated-kare` and it was RIGHT to** — that branch was merged to
`HEAD` but 6 ahead of `origin/claude/agitated-kare-23d41a`, so git's check is about the *remote*,
not about `main`. **Do not reach for `-D` on that message alone.** Verify each commit with
`git merge-base --is-ancestor <sha> main` first — all six were in `main`, which is what made `-D`
safe. ⚠️ **`origin/claude/agitated-kare-23d41a` still exists on the remote** and is now redundant.


## ⏹️ 2026-09-05 · session `ae9a805f` — wound down at 92%. READ THIS BLOCK FIRST.

**Everything is committed and PUSHED.** `origin/main` = `c86fd705`. `docs/` and `src/` clean.
Memory store pushed too. The site build was watched to completion each time.

**This session closed CHAPTER 19 and opened CHAPTER 16.**

- **ch19 · Capstone — CLOSED.** 19 pages · 3,613 lines · 304 ★ · positions 0–18 gap-free.
  Details: [[progress-nextjs-ch19-capstone]].
- **ch16 · CRUD API with Postgres — OPEN at 56 files / 12,499 lines / 888 ★.**
  🔴 Details and the three owed jobs: [[progress-nextjs-ch16-crud]].

### 🔴 START HERE → `docs/nextjs/pages/16-building-a-crud-api-with-postgres/`

Read [[progress-nextjs-ch16-crud]] **before writing a page** — the resource, the HTTP surface,
the `cards` schema and the ownership predicate are all FIXED and were given identically to
three forks. Then, in this order:

**1 · Write topic 12 (Testing the API) and topic 13 (Project milestone).** Coordinator's lane,
positions **73 onward**. ⚠️ ch13 owns test runners and CI, so topic 12 must not re-teach them —
the same constraint that reshaped topic 10 once ch7 was found to own the error envelope.

**2 · Replace the 7 remaining `{/* FOOTER */}` markers** — `01-the-resource-contract` ·
`04e-function-per-use-case` · `05-create` · `06g-conditional-requests-and-etag` · `07-update` ·
`09g-the-one-genuine-superpower` · `10-errors-and-one-response-shape`.

**3 · Renumber gap-free 0–N, then rewrite `01-explanation.md`** — its chunk table still carries
13 bold *(not written yet)* placeholders.

⚠️ Also reconcile two overlaps: `ETag` generation is defined in both `06g` (read side, 304) and
`07e` (write side, 412); the `position` float scheme is explained in both `05ea` and `07g`.

### 🔴 Two findings from this session that change how you work

**A brief is not evidence.** All three ch16 forks contradicted either my brief or their own
draft against a primary source, and each was right. Put this in every fork brief:
*"if a source contradicts this brief, the source wins — say so explicitly."*

**`WebFetch`'s summariser PARAPHRASES specification text.** It rendered RFC 9110's *"its current
functionality"* as *"its current representation"* and returned RFC 7231 wording for a 9110
request. **Fetch the raw `.txt` from rfc-editor.org for any RFC quote.**

⚠️ **Do not run `graphify update`** — Gemini was rebuilding `graphify-out/` in parallel and it is
dirty in the shared checkout. **Never `git add` it.**

### Found, not fixed

- ✅ **The 17 unresolved link warnings are FIXED** — 2026-09-05, session `ae47a09e`, merged
  as `ee04f029`. 🔴 **They were ONE defect, not two.** All 20 Next.js links sat inside verbatim
  `> *"…"*` quotes and carried the SOURCE page's hrefs — so the "dead anchors" (`#setting-headers`,
  `#using-cookies`, `#negative-matching`, `#optimistic-checks-with-proxy-optional`,
  `#data-access-layer`) are headings on nextjs.org, **not** on our pages, and repointing them at a
  local heading would have been wrong. Same fix for both halves: make the href absolute. Only the
  Java `17b` anchor was genuinely intra-site (`## The correction` is in the sibling
  `17-the-god-service.md`). Method and the detector: [[progress-build-warnings-20260903]] class 3.
  Build after: **0 broken links, 0 broken anchors.**
- **`DATABASE_URL_DIRECT` vs `DIRECT_URL`** — ch15 `01b-the-three-kinds-of-pool.md` is the odd
  one out; `01ga`, `01ia`, the ch15 milestone and all of ch16 use `DIRECT_URL`.
- **PostgreSQL 18.6 shipped 2026-08-13**; the corpus pins **18.4**. Currency lane's call.

## ⏹️ 2026-09-05 · session `0e3567ed` — wound down at 93% usage. READ THIS BLOCK FIRST.

**Working tree clean, everything committed.** Four commits, in order:
`dd3ec9bd` pins · `c9b44fbc` ch15 salvage · `8405bc74` the deploy fix · `0bdf4e87` the renumber.

## ✅ 2026-09-05 · session `df2722c8` — 🔴 **CHAPTER 15 IS CLOSED.** 15 commits.

**Working tree clean. Everything committed. `main` is AHEAD of `origin/main` — push when you
have network.**

### 🔴 START HERE → `docs/nextjs/pages/19-capstone-decision-trees-and-outlook/01-explanation.md`

That is the **order of work the user set: ch15 → ch19 (capstone) → ch16 (the CRUD API build).**
ch15 is now done, so the capstone is next. It is **0 of 5** — the chapter index plus four
generated stubs, none badged, none carrying a `> Verified:` line:

| File | State |
|---|---|
| `01-explanation.md` | generated chapter index |
| `01-sprintdesk-retrospective-the-finished-multi-tenant-saas-revi.md` | stub |
| `02-case-study-2-contrast-a-ppr-driven-e-commerce-storefront.md` | stub |
| `03-architecture-decision-trees-rendering-strategy.md` | stub |
| `04-outlook-deeper-ai-runtimes.md` | stub |

⚠️ **The capstone is a SYNTHESIS chapter and should introduce almost no new claims.** Nineteen
chapters are closed; its job is to make the reader choose between things they have already been
taught. `ch15`'s milestone (`06-project-milestone-…`) is the model to copy — three features, six
named seams, and six acceptance questions the reader must answer without opening anything.
There is banked research at `research_nextjs_ch19_appendices.md`.

**After ch19: ch16 · Building a CRUD API with Postgres is 1 of 13** — only the index exists and
it carries **14** bold *(not written yet)* placeholders. Plan: [[plan-nextjs-ch15b-crud-api-postgres]].
Its thesis, already written into its index and worth keeping: **ch15 answers WHICH, ch16 answers
HOW and what breaks — CRUD is easy until two requests overlap.**

---

## What ch15 closed at, measured on disk

**68 pages · 15,539 lines · 832 ★ · 7 topics · positions 0–67 gap-free.** Every page badged and
carrying a `> Verified:` line. 0 over cap · 0 duplicate positions · 0 bare `{/* FOOTER */}` ·
0 dangling links · 0 control bytes · 0 MDX hazards · `grep -rn 'not written yet'` returns
nothing but genuinely-future work.

| Topic | Pages | Written by |
|---|---:|---|
| 01 · Database integrations | 14 | this session (01h/01ha/01hb/01hc, 01i/01ia) + prior |
| 02 · Hybrid API design | 14 | fork B, from a 30-line stub |
| 03 · Real-time: SSE and WebSockets | 13 | fork A completed it |
| 04 · Background jobs and queues | 13 | fork C, from a 67-line stub |
| 05 · Edge and custom cache structures | 7 | this session, from a 67-line stub |
| 06 · Milestone: SprintDesk | 1 | this session, from a 21-line stub |
| 10 · Multi-tenancy | 5 | prior |

**Three `devbible-author` forks ran in parallel on disjoint lanes and disjoint position ranges,
and it worked.** What made it work: each fork got exact filenames it must honour, a position
range nobody else could touch, an explicit ban on committing, and the instruction that the
coordinator commits. What went wrong twice and needed a mid-run message: **forks forward-link to
their own later chunks**, which the authoring contract forbids and which breaks the build for
every session in the checkout. **Tell a fork this up front and re-check it before committing.**

---

## 🔴 TWO INVISIBLE-DEFECT CLASSES — both live, neither caught by any check here

**1 · A raw control byte makes a file invisible to EVERY grep-based check at once.**
`03c` contained two literal **NUL bytes** (the author meant a regex escape and emitted the byte).
grep and ripgrep classify such a file as binary and skip it, so the tier-badge check, the
`> Verified:` check, the `## Gotchas` check, the duplicate-position check, the FOOTER check, the
escaped-backtick check and the link resolver **all silently passed a file they never read**.
It is how a page ships completely unchecked while every gate is green. Fixed; chapter swept.

```bash
python3 -c "import glob;[print(f,open(f,'rb').read().count(b'\x00'),open(f,'rb').read().count(b'\x7f')) for f in glob.glob('*.md') if open(f,'rb').read().count(b'\x00') or open(f,'rb').read().count(b'\x7f')]"
```

⚠️ This also **corrected my own earlier claim** that `03c` was missing a `sidebar_position`.
It never was — grep simply could not see the file. **A grep that returns nothing is not proof.**

**2 · The escaped backtick inside a code span**, already on record from `8405bc74`, is still
live: a new instance was caught in `01hb` before commit. A backslash does **not** escape a
code-span delimiter in CommonMark. `grep -n '\\`' <dir>` by hand, every page, every time.

---

## 🔴 VERSION FINDINGS — worth a `devbible-currency` pass of their own

**Next.js: the Edge Runtime is DEPRECATED in 16.3.4.** `runtime = 'edge'` is marked deprecated
and the migration is a deletion — *"The Node.js runtime is the default, so no replacement is
needed."* ⚠️ The docs name **no removal version** and do **not** say the build fails; do not let
anyone add a deadline that is not in the docs. Proxy **throws** on the option rather than warning.
This killed the premise of ch15 topic 05's generated stub, which is why that topic was reframed.

**Prisma: the published Migrate docs now describe PRISMA 8**, not 7 — `contract.json`,
`migration.ts` + `ops.json`, `migration plan`, `db migrate`. We target **7.10.0**, so `01i`/`01ia`
cite the versioned `/docs/orm/v7/` paths. The `prisma` CLI's npm `latest` tag points at
**`8.0.0-rc.13`** while `prev` is `7.10.0` — pin the CLI, never follow the tag. ⚠️ Prisma 8's own
docs list the shadow-database rehearsal as *"Not built yet"*, so the differentiator `01i`
identifies has not carried over.

**Drizzle: the published docs describe the 1.0 RELEASE CANDIDATE**, npm `latest` is **0.45.2**,
and they disagree on the relations API — the rc shows `defineRelations`, which does **not exist**
in the 0.45.2 typings (read from unpkg). **Bumping to 1.0 is an API migration across every page
that declares a relation, not a version bump.** Recorded on the pin note.

---

## ✅ Pins are settled for ch15

`drizzle-orm` **0.45.2** · `drizzle-kit` **0.31.10** · `bullmq` **6.3.4** all added to the
`nextjs` track (`dad44990`, `421c9682`), each with the operational trap on its note. `prisma`
was already correct at 7.10.0. **Nothing is owed.** `ws`, `@vercel/functions` and `@vercel/queue`
are referenced by name only with no version claim, so no pin is required — reported, not added.

## ✅ Research is banked — spend it, do not re-fetch

`research_nextjs_ch15_databases_and_api_design.md` gained **§ O** (Server Actions, Data Security,
BFF, and React's Server Functions reference). `research_nextjs_ch15_realtime_jobs_edge.md` gained
**§ 11** (PostgreSQL 18 `INSERT`, Stripe idempotency, BullMQ operations, Vercel cron). Both
sections record what could **not** be settled so nobody quietly fills the gap from memory.

---

## The old blocks, kept for their precedents

## ▶️ 2026-09-05 · session `df2722c8` — topic 01 CLOSED, topic 05 opened, 3 forks ran.

**Seven commits this session**, newest first: `7ed3385f` 05d · `b1268f18` 05c ·
`79004118` fork-safety commit · `4e49574e` topic 05 opened · `dad44990` drizzle pins ·
`9fe574d9` 01i+01ia · `c26a7b82` 01h four-way split.

### 🔴 START HERE → **QC and commit the three forks' uncommitted output**, THEN write
`docs/nextjs/pages/15-databases-apis-and-full-stack-patterns/05e-writing-a-custom-cache-handler.md`
at `sidebar_position: 303`.

🔴 **Do the QC first — 25 fork files were uncommitted when this session wound down and
they are the at-risk work.** Run, from inside the chapter directory:

```bash
wc -l *.md | awk '$1>300 && $2!="total"{print}'                 # cap
grep -L '^<span className="db-tier' *.md                        # badge
grep -L '^> Verified:' *.md                                     # provenance
grep -ln '^{/\* FOOTER \*/}$' *.md                              # bare footers
grep -h '^sidebar_position:' *.md | sort -n | uniq -d           # duplicates
grep -rn 'not written yet' *.md                                 # stale placeholders
grep -n '\\`' *.md                                              # 🔴 the deploy killer
grep -oh '](\([^)#h][^)#]*\.md\)' *.md | sed 's/](//' | sort -u \
  | while read f; do [ -e "$f" ] || echo "MISSING $f"; done     # 🔴 dangling links
```

⚠️ **Dangling links were the forks' recurring defect** — they forward-link to their own
later chunks, which the authoring contract forbids. Both forks were messaged mid-run with
the specifics. A dangling relative link breaks the production build for **every** session
in this shared checkout, so nothing lands until that grep is empty. Fix by either writing
the promised file or converting the link to bold text plus *(not written yet)*.

### ✅ TOPIC 01 IS CLOSED — 15 pages, and `grep -rn 'not written yet'` over `01*` is empty

Every file topic 01 promised by name now exists and is linked. `01h` drafted at 380 lines
and split FOUR ways (**380→897 lines, 23→60 ★**); `01i` was written as `01i`+`01ia` up front.

| File | Pos | Owns |
|---|---:|---|
| `01h` | 108 | schema-as-DSL vs schema-as-TypeScript; opposite nullability defaults; the `export const` rule that hides a table from drizzle-kit |
| `01ha` | 109 | 🔴 a Drizzle `relations()` block creates **no foreign key**; `defineRelations` is in the docs and **not** in npm `latest` |
| `01hb` | 110 | `$inferSelect`/`$inferInsert` vs the generated model type; the ceiling both share |
| `01hc` | 111 | criteria object vs query builder; bundle size reframed as a boundary question |
| `01i` | 112 | generate-then-apply; codebase-first vs database-first; **the shadow database** |
| `01ia` | 113 | `push` as the route to an unreproducible schema; the pooler; proving the migration ran |

🔴 **Naming scheme now goes two deep: `01ha`, `01hb`, `01hc`, `01ia` — never a fresh single
letter for an overrun**, because single letters are promised names.

### ▶️ TOPIC 05 IS OPEN AT 5 of 7, and it was REFRAMED — read this before writing 05e

🔴 **The Edge Runtime is deprecated in 16.3.4.** The `runtime` segment config lists `'edge'`
as deprecated and the message page says *"The Node.js runtime is the default, so no
replacement is needed."* The stub's premise — that "edge functions" are a runtime you opt a
route into — is dead, and the topic is rebuilt around what makes an app global once there is
one runtime: a CDN in front, a cache handler behind. ⚠️ The docs name **no removal version**
and do **not** say the build fails; do not let anyone add a deadline that is not in the docs.

Written: `05` hub (5) · `05b` (300) deprecation · `05c` (301) `Cache-Control` per strategy ·
`05d` (302) `Vary`/`_rsc` · `05h` (306) shared cache across instances — the file `03e`
promised by name. **Owed: `05e` (303) the `cacheHandlers` interface, `05f` (304) streams and
failure semantics.** All of it is in the bank already — `research_nextjs_ch15_realtime_jobs_edge.md`
§8 has the full `get`/`set`/`refreshTags`/`getExpiration`/`updateTags` interface, the
`CacheEntry` shape, soft tags, `.tee()`, and the asymmetric failure rules. **Zero fetches
needed.** ⚠️ Scope boundary: **ch05 owns the caching MODEL**, this topic owns the
infrastructure — link ch05, never restate it.

### 🔴 A NEW deploy-breaking defect was found and fixed, and the class is confirmed live

`01hb` carried an escaped backtick inside a code span before commit. **A backslash does not
escape a code-span delimiter in CommonMark** — this is exactly what failed the deploy in
`8405bc74`, and **no check in this project catches it**: not the cap check, not the link
check, not `mdxcheck.py`. `grep -n '\\`' <dir>` by hand on every page, every time.

### 🔴 VERSION FINDING — Prisma 8 is already the published documentation

`prisma.io/docs/orm/prisma-migrate` now documents **Prisma 8**, not 7: a `contract.json`
artifact, migrations as `migration.ts` + `ops.json` + `migration.json`, and renamed commands
(`migration plan`, `db migrate`, `contract emit`). This corpus targets **7.10.0**, so `01i`
and `01ia` cite the **versioned `/docs/orm/v7/` paths** and mark the 8 material forward-looking.
It corroborates the npm reading already in `01h`: the `prisma` CLI's `latest` dist-tag points
at **`8.0.0-rc.13`** while `prev` is `7.10.0`. ⚠️ Prisma 8's own docs list the shadow-database
rehearsal as *"Not built yet"* — so the differentiator `01i` identifies has not carried over.
**This is worth a `devbible-currency` pass on its own.**

### ✅ Pins settled — `dad44990`

`drizzle-orm` **0.45.2** and `drizzle-kit` **0.31.10** added to the `nextjs` track, with the
trap recorded on the note: the published docs describe the **1.0 release candidate**, and the
rc's `defineRelations` does not exist in 0.45.2. **Bumping to 1.0 is an API migration across
every page that declares a relation, not a version bump.** Still open: `bullmq` 6.3.4, due only
if fork C taught it with real code.

### ⏳ The three forks, and their disjoint lanes

| Fork | Lane | Positions | Produced by wind-down |
|---|---|---|---|
| A | topic 03 remainder | 165+ | `03f`, `03fa`, `03g`, `03ga`, `03h`, `03ha` — and it **fixed `03c`'s missing `sidebar_position: 162`**, which was a silent sidebar reordering |
| B | topic 02 from stub | 200+ | `02b`–`02l`. ⚠️ **the `02` hub was still the generated stub** — no badge, no `> Verified:` |
| C | topic 04 from stub | 230+ | `04` hub, `04b`, `04c`, `04d`+`04da`+`04db`, `04e`+`04ea`, `04f`+`04fa` — `04d` landed on the promised SKIP LOCKED name |

### What ch15 still owes after the forks land

Topic 05 chunks `05e` and `05f` · topic 06 (the SprintDesk milestone, still a 21-line stub) ·
the chapter index `01-explanation.md` (still a generated stub, no badge, no `> Verified:`) ·
then **renumber the whole chapter gap-free** and wire every footer seam. ⚠️ Positions are
deliberately non-contiguous — 0–6, 10–14, 100–113, 160–168, 200+, 230+, 300–306 — because the
forks got disjoint ranges. **The coordinator renumbers at the close; do not renumber early.**

### 🔴 The OLD start-here block, kept for its naming precedent



`01i` is **promised by name in prose three times** and each is a bold *(not written yet)*
placeholder waiting to become a link — `01b` (line ~221, "the per-tool migration mechanics"),
`01ga` (line ~136, "which schema changes need that direct route, what a shadow database is for"),
`01h` and `01hb` (the type-safety ceiling: types describe the schema FILE, a migration is what
makes the database agree). Honour the name. It takes **`sidebar_position: 112`**.

⚠️ **Scope boundary for `01i`:** the two-URL wiring, `prisma.config.ts` and the Schema Engine's
single-connection requirement are DONE in `01ga` — link, do not restate. `01i` owns: `prisma
migrate dev` vs `deploy`, the shadow database and why it needs the direct URL, drizzle-kit's
`generate`/`migrate`/`push`/`pull`/`export` and the codebase-first vs database-first framing
(both quoted verbatim in the research bank, § I), `push` as prototyping-only, the migrations
table each tool keeps, and how you assert at deploy time that the migration actually ran.

**What `01h` did — a FOUR-file split, and the naming scheme now goes two deep.** Drafted at
380 lines / 23 ★ and split on three real concept boundaries, proven **380→897 lines, 23→60 ★**:

| File | Pos | Owns |
|---|---:|---|
| `01h-prisma-and-drizzle-as-models.md` | 108 | schema as DSL vs schema as TypeScript; the same two tables twice; opposite nullability defaults; the `export const` rule that hides a table from drizzle-kit |
| `01ha-relations-mean-different-things.md` | 109 | 🔴 a Drizzle `relations()` block creates **no foreign key** — `.references()` does; `defineRelations` is in the docs and **not** in npm `latest` |
| `01hb-generated-types-and-inferred-types.md` | 110 | `$inferSelect`/`$inferInsert` vs the generated model type; the ceiling both share |
| `01hc-ergonomics-size-and-when-each-is-wrong.md` | 111 | criteria object vs query builder; bundle size reframed; when each is wrong |

🔴 **The two-letter scheme held and extended: `01ha`, `01hb`, `01hc` — never `01i` for an
overrun**, because `01i` is a promised name. If `01i` overruns, it becomes `01ia`.

🔴 **A NEW instance of the deploy-breaking defect class was found and fixed in `01hb` before
commit** — an escaped backtick inside a code span. A backslash does **not** escape a code-span
delimiter in CommonMark; this is exactly what failed the deploy in `8405bc74`, and **no check in
this project catches it** (not the cap check, not the link check, not `mdxcheck.py`). Grep
`grep -rn '\\`' <dir>` on every page you write, by hand, before committing.

### ⏳ THREE FORKS WERE RUNNING IN PARALLEL when this block was written

Launched by session `df2722c8` as `devbible-author` subagents on disjoint lanes and disjoint
position ranges, so their files cannot collide:

| Fork | Lane | Positions | Files |
|---|---|---|---|
| A | topic 03 remainder | 165+ | `03f`, `03g`, `03h`, `03i` — plus adding the **missing `sidebar_position: 162`** to `03c` |
| B | topic 02 from stub | 200+ | the `02` hub rewritten, then `02b`, `02c`, `02d`, … |
| C | topic 04 from stub | 230+ | the `04` hub rewritten, then `04b`, `04c`, and the promised **`04d-postgres-as-a-queue-skip-locked.md`** |

⚠️ **Verify their work before trusting it.** Two were already over the cap while running
(`02d` at 400 lines, `03f` at 339) and were told to split. A next session MUST re-run the QC
block on the whole chapter: `wc -l`, `grep -c '^\*\*★'`, tier badge, `> Verified:`,
`{/* FOOTER */}`, duplicate `sidebar_position`, `grep -rn 'not written yet'`, and the escaped-
backtick grep above.

⚠️ **Pins still owed** — versions checked against the npm registry 2026-09-05, **do not
re-fetch**: `drizzle-orm` **0.45.2** · `drizzle-kit` **0.31.10**. Topic 01 now teaches Drizzle
with real code across `01h`/`01ha`/`01hb`/`01hc`, so **these two pins are now due** in
`src/data/pins.js` (the `prisma` entry there is already correct at 7.10.0). Add `bullmq` 6.3.4
only if fork C taught it with real code — its report says which.

### 🔴 The OLD start-here block, kept for its naming precedent



That exact filename is already **promised in prose** by the `01` hub (line ~146, the
"ORM choice" aside — it used to name `01f` by mistake and was repointed at `01h` in `e77b0276`),
so honour it rather than inventing a name. Chapter 15 topics 01 and 03 are **part-written and
committed**; topics 02, 04, 05 and 06 are still untouched generated stubs.

**What `01g` did, and the naming precedent it set.** It drafted at 318 lines / 25 ★ — 18 over cap
— and was **split on the concept boundary** into `01g` (what Prisma generates, what a driver
adapter is, where the v6 pool knobs went) and **`01ga-where-the-prisma-instance-lives.md`** (the
`globalThis` singleton, serverless instance-per-function arithmetic, `$disconnect`,
`prisma.config.ts`, the two URLs). Proof: **318→430 lines, 25→38 ★**, gotchas 14→22, questions
11→16. 🔴 The sibling is `01ga`, **not** `01h` — the two-letter form follows the `07ca-` precedent
in `java/pages/phase-12-jvm-production/11-graalvm-native-image/`, and it exists precisely so the
promised `01h` and `01i` names stay free. **Do the same if `01h` overruns: `01ha`, never `01i`.**
`01g` = position 106, `01ga` = 107, so `01h` takes **108**.

⚠️ **Scope boundary for `01h`, so it does not repeat `01g`/`01ga`:** connection lifecycle, pool
config and client instantiation are DONE and should be linked, not restated. `01h` is the
*modelling* comparison — schema definition, generated types vs inferred types, relations, the
query-builder-vs-client ergonomics, bundle size, and when each is the wrong choice. The banked
research already holds Drizzle's verbatim quotes (section I) including the ⚠️ that the published
Drizzle docs describe the **1.0 release-candidate** while npm `latest` is **0.45.2**.

**The eight files the corpus already promises by name** (each is a bold *(not written yet)*
placeholder right now — writing one means turning that placeholder back into a link):

| Owed file | Promised by |
|---|---|
| `01h-prisma-and-drizzle-as-models.md` | `01` |
| `01i-migrations-in-each.md` | `01b` |
| `03f-eventsource-reconnection-and-last-event-id.md` | `03`, `03b`, `03e` |
| `03g-fetch-and-readablestream-when-you-need-headers.md` | `03` |
| `03h-what-silently-breaks-sse-in-production.md` | `03`, `03b`, `03c`, `03d` |
| `03i-websockets-and-the-serverless-request-model.md` | `03` |
| `04d-postgres-as-a-queue-skip-locked.md` · `05h-a-shared-cache-across-instances.md` | `03e` |

⚠️ **Positions in ch15 are NOT gap-free yet** — topic 01 holds 100–107, topic 03 holds 160, 161,
163, 164 (**162 is a gap**), the old stubs hold 1–6 and multi-tenancy holds 10–14. That is by
design: forks got disjoint ranges and **the coordinator renumbers the whole chapter gap-free at
the close.** Do not renumber early.

### 🔴 THE TRACK IS NOW 20 CHAPTERS — the renumber landed

On the user's instruction the new CRUD-API chapter became a **full chapter 16**, not the
`15b`/position-15.5 form first proposed. Chapters **16→17, 17→18, 18→19, 19→20**.

**Chapter 16 · Building a CRUD API with Postgres is OPEN at 1 of 13** — only the index
(`16-building-a-crud-api-with-postgres/01-explanation.md`, 65 lines) exists, and every topic in its
table is a bold *(not written yet)* placeholder. The 13-topic plan and the boundary against ch15
are in [[plan-nextjs-ch15b-crud-api-postgres]]. Its thesis, already written into the index and
worth keeping: **ch15 answers WHICH, ch16 answers HOW and what breaks — CRUD is easy until two
requests overlap.**

🔴 **Two renumber traps, for whoever does the next one:**
1. Guarding a version like `16.3` by refusing a match followed by a period **also silently skips
   every sentence-final "chapter 18."** Two references were missed that way and only a second,
   differently-shaped scan found them. **Guard on a following digit, not a following dot.**
2. Inside a chapter, `[17 · Deploying beyond Vercel](17-…md)` is a **page** number. Only
   chapter-prefixed references and the chapter index's own title may be bumped.

### ✅ THE DEPLOY FAILURE IS FIXED — and the defect class is new

Run `33930940367`, step Build, exit 1: *"Docusaurus static site generation failed for 2 paths"*,
`ReferenceError: boardId is not defined` / `level is not defined`. Cause: **a backslash does not
escape a code-span delimiter in CommonMark.** Two pages wrote `` `…\`…\`…` ``; the span closed
early, the rest fell back to MDX text, and `${boardId}` / `${level}` were evaluated at SSG time
against no binding. Fixed with double-backtick spans (`8405bc74`).

🔴 **This class is invisible to every check this project runs — tier, `> Verified:`, footer, cap,
link, AND `mdxcheck.py`.** It only appears when SSG renders the page, i.e. in CI after the commit
that introduced it. All 6,676 files under `docs/` were swept; none remain.
⚠️ `gh run view --log-failed` returns EMPTY for these runs — the logs are only reachable via
`gh api repos/sairamg8/devbible/actions/jobs/<job_id>/logs`.
⚠️ **Found not fixed:** `10-…/06j-milestone-what-a-sign-in-endpoint-gives-away.md` line 168 has a
literal `0x7F` DEL byte in a code span (non-fatal minifier warning). The intended regex is
ambiguous — probably an `/[\x00-\x1f\x7f]/` that lost its range start. Ask before guessing.

### Pins
`dd3ec9bd`: **`bcrypt` was defined TWICE in `pins.js`** — a duplicate object key is silent, the
later wins, so the first entry's tracks and its NUL-byte note had been dead since ch10. Merged.
`postgresql` gained the `nextjs` track. **Still owed, versions already checked against the npm
registry 2026-09-05 — do not re-fetch:** `drizzle-orm` **0.45.2** · `drizzle-kit` **0.31.10** ·
`@neondatabase/serverless` **1.1.0** · `pg` **8.23.0** (`@types/pg` 8.23.1). Add them when the
chapter that teaches them lands. `bullmq` 6.3.4 only if ch15 topic 04 teaches it.

### Order of work the user set
**ch15 → ch18-as-now-ch19 (capstone) → ch16 (the CRUD API build).**
⚠️ The capstone is **chapter 19 now**, at `19-capstone-decision-trees-and-outlook/`, still 0 of 5
with four generated stubs.

### What still needs doing in ch15 before it can close
Topics 02, 04, 05, 06 from stubs · the eight promised files above · the chapter index
(`01-explanation.md`, still a generated stub with no badge and no `> Verified:`) · topic 05's stub
likewise · then renumber gap-free and wire every footer seam.
⚠️ The syllabus also flags **Custom Server** and **Environment Variables** as missing from ch15;
positions 7–9 are free for them.

---

**Rewritten 2026-09-04, then updated at the wind-down of session `10aadd98`.** This is the one file a cold-start
Next.js session opens. Everything below was **measured on disk**, not recalled.

Working tree: **`main`, clean.** Nothing uncommitted in `docs/` or `src/`. 🔴 **Not pushed** —
`main` is ahead of `origin/main`; push when you have network.

---

## ✅ STEP 1 IS DONE — chapter 5 is on `main`

The previous cursor's first instruction was to recover chapter 5 from
`claude/interesting-herschel-3fd9c3`, where ten commits had been stranded. **That merge landed
2026-09-04** (`24f5346c`, a `--no-ff` merge; one conflict in `src/data/progress.js`, resolved
by taking ch5's `21/21` from the branch and ch6's `26/26` from `main`). Chapter 5 measures
**21/21 verified, 0 over cap, no duplicate positions.**

✅ **All three were DELETED 2026-09-05** (session `ae47a09e`), together with the worktrees
that held them — see the consolidation block at the top of this file. Every commit was
confirmed contained in `main` by `git merge-base --is-ancestor` before deletion.

🔴 **Keep the lesson, the trap has fired twice: a memory can outrun its content.**
`git branch -a --contains <sha>` before trusting a "CLOSED" claim.

---

## STEP 2 — the measured position

**317 pages · 247 carried `> Verified:` at the 2026-09-04 measurement · 70 pending then.**
🔴 **RE-MEASURED OFF DISK 2026-09-04 at the end of session `9348b38e`: 337 pages · 68,425 lines ·
3,202 ★ · 285 verified · 52 stubs · TWELVE of nineteen chapters closed** (1, 3, 4, 5, 6, 9, 12,
13, 14, 16, 17, 19). The table below is that measurement, not the older one.

The seven open chapters and their pending **topics** (stub count minus the chapter index):
**ch02 8** · **ch07 7** · **ch08 7** · **ch10 6** · **ch11 7 ⛔ CLAIMED** · **ch15 6** ·
**ch18 4**. That is 45 topic pages + 7 indexes = 52.

| Chapter | Verified | Pending | |
|---|---:|---:|---|
| 01 · Introduction | 9/9 | 0 | ✅ |
| 02 · Routing and navigation | 51/51 | 0 | ✅ **CLOSED 2026-09-04** |
| 03 · Server vs Client Components | 10/10 | 0 | ✅ |
| 04 · Data fetching | 39/39 | 0 | ✅ **a model to copy** |
| 05 · Caching, PPR, Cache Components | 21/21 | 0 | ✅ **recovered 2026-09-04** |
| 06 · SSG, ISR, SSR | 26/26 | 0 | ✅ **a model to copy** |
| 07 · Error handling, loading, resilience | 35/35 | 0 | ✅ **CLOSED 2026-09-04** |
| 08 · State management in an RSC world | 57/57 | 0 | ✅ **CLOSED 2026-09-05** |
| 09 · Styling and UI | 20/20 | 0 | ✅ **a model to copy** |
| 10 · Forms, auth, security hardening | 46/46 | 0 | ✅ **CLOSED 2026-09-05** |
| 11 · Performance and Turbopack | 30/30 | 0 | ✅ **CLOSED 2026-09-04** |
| 12 · SEO, metadata, accessibility | 59/59 | 0 | ✅ **closed 2026-09-04** — the biggest chapter in the track |
| 13 · Testing and DX | 20/20 | 0 | ✅ **closed 2026-09-04** |
| 14 · Agent-driven development | 10/10 | 0 | ✅ **closed 2026-09-04** |
| 15 · Databases, APIs, full-stack | 5/12 | **7** | |
| 16 · Deployment, scaling, observability | 20/20 | 0 | ✅ **closed 2026-09-04** |
| 17 · Advanced ecosystem topics | 18/18 | 0 | ✅ **a model to copy** |
| 18 · Capstone and outlook | 0/5 | **5** | |
| 19 · Appendices | 14/14 | 0 | ✅ **closed 2026-09-04** |

## ✅ STEP 3 IS DONE — CHAPTER 14 IS CLOSED

**Closed 2026-09-04, session `9348b38e`, commit `4f3d3754`. 10 of 10 pages, renumbered gap-free
0–9.** Ten, not the planned eight: **two** pages drafted over the cap and were split, each proven
UP — `05`→`05b` (302→412 lines, 10→14 ★) and `06`→`06b` (308→387 lines, 8→10 ★).

Written this session at **zero fetches**, entirely off [[research-nextjs-ch19-appendices]]:
`06-honest-limits-…` (181L/4 ★, from a 30-line **empty-bodied** stub), `06b-what-an-agent-cannot-decide-…`
(206L/6 ★), `07-project-milestone-sprintdesk-gets-an-agentsmd.md` (217L/4 ★) and the chapter
index `01-explanation.md` (58L). `src/data/progress.js` line 492 is now `topics: 10, pages: 10`.

Whole-chapter QC: 0 over cap · 0 duplicate positions · 0 gaps · every page badged and sourced ·
**0 bare `{/* FOOTER */}` markers** · 0 MDX hazards · 0 dangling links · footer chain unbroken 0→9.

🔴 **Lesson from the close, and it is new:** three `*(not written yet)*` footers on pages 03, 04
and 05b each promised a page that had **since been written**. They passed every mechanical check
the whole time, because a plain-bold placeholder is not a dangling link and nothing flags it.
**A chapter close must `grep -rn 'not written yet'` its own directory.** Record: [[progress-nextjs-ch14]].

---

## ✅ CHAPTER 13 IS ALSO CLOSED

**Closed 2026-09-04, session `9348b38e`, commit `3240a1b2`. 20 of 20 pages, gap-free 0–19,
4,557 lines, 336 ★.** Fork B turned three stubs into 11 pages (146 → 2,730 lines, 0 → 189 ★).
🔴 **15 bare `{/* FOOTER */}` markers were resolved at the close** — 11 from fork B, 4 from the
salvage. `progress.js` ch13 is `topics: 20, pages: 20`.

🔴 **Two pins this forced, and the lesson generalises:** `turbo` **2.10.12** added, and **`zod`
gained the `nextjs` track** — it listed `nodejs/expressjs/real-world` while 18+ Next.js pages
name it and five bold `4.4.3`, so the currency scan saw none of them. **When a track starts
teaching a pinned library, the pin's `tracks` array is part of the change.** Nothing detects the
omission; the scan just reports nothing. Record: [[progress-nextjs-ch13]].

⚠️ **`turborepo.com` now 301s to `turborepo.dev`** — the ch13 research bank still cites `.com`
paths throughout. Fix on the next pass.

## ✅ CHAPTER 12 IS ALSO CLOSED — the biggest chapter in the track

**Closed 2026-09-04, session `9348b38e`, commit `38b26eab`. 59 of 59 pages, gap-free 0–58,
13,818 lines, 521 ★.** Fork A turned five stubs into 24 pages (287 → 5,378 lines, 0 → 367 ★) with
four splits, each proven UP. **Accessibility went from zero pages to seven.** 30 bare
`{/* FOOTER */}` markers and all four `*(not written yet)*` placeholders resolved at the close.

🔴 **Two findings from primary source, worth spending rather than re-deriving:**
- The default **`htmlLimitedBots` list is SETTLED** from framework source at tag `v16.3.4` — it
  contains `facebookexternalhit`, `Twitterbot`, `Slackbot`, `Discordbot`, `LinkedInBot`,
  `WhatsApp` **and `Chrome-Lighthouse`**. So **a Lighthouse run can never reproduce a
  streaming-metadata problem.** The bank's §11.4 open question is closed.
- 🔴 **A documentation bug:** the `generateSitemaps` reference's own example does
  `id * 50000` after `const id = await props.id`, while 16.0's version history calls `id` *"a
  promise that resolves to a `string`"*. **The documented example does not typecheck.**

🔴 **The forward-reference pattern that worked, and should be reused:** the salvage left four
plain-bold `*(not written yet)*` placeholders naming three files that did not exist. **The exact
filenames went into the fork's brief**, it wrote them under those names, and the close repointed
all four mechanically. A plain-bold placeholder keeps the build green; the filename in the brief
is what makes the repoint trivial instead of archaeological.

⚠️ The ch12 research bank **had never been committed** — it was untracked on disk and would have
died with the checkout. Record: [[progress-nextjs-ch12]].

---

## ✅ CHAPTER 07 IS CLOSED — 2026-09-04, session `c08ab631`

**`768ec850`: 35 of 35 pages, renumbered gap-free 0–34.** From 9 written pages + 8 stubs (six
byte-identical `81c2adfc`, one empty-bodied `d41d8cd9`, plus the generated index) to **4,636 new
lines and 146 ★** across 22 new pages. `progress.js` line 487 is now `topics: 35, pages: 35`.

Per-topic commits: `5fb470a5` (01, 5pp) · `f642babc` (02, 3pp) · `319882e3` (03, 4pp) ·
`552cc03b` (04, 2pp) · `326dc2ce` (05, 3pp) · `762fa867` (06, 3pp) · `1d918a95` (07, 5pp).

🔴 **Topic 01 was drafted as ONE file at 460 lines / 9 ★ and split THREE times → 1,050 lines /
24 ★.** Six further splits, all proven UP.

🔴 **NEW DEFECT CLASS, and it should be swept corpus-wide: FIVE of the nine pre-existing pages
had HALF a footer** — `10`, `11`, `11b`, `12`, `12b` each carried a `Previous:` or a `Next:` but
not both. **A one-directional footer is a valid link, so every mechanical check passes it**, and
the `{/* FOOTER */}` grep does not see it either. Fixed at close; nothing detects the rest.

🔴 **Research is BANKED for the whole chapter — [[research-nextjs-ch7-error-handling]], seven
fetches, do not re-fetch.** Record: [[progress-nextjs-ch7]], which carries ten findings worth
spending in ch05, ch06, ch08, ch09, ch10, ch11, ch12 and ch16 rather than re-deriving —
including 🔴 **`notFound()` returns 200 for streamed responses and 404 for non-streamed ones**,
🔴 **a `loading.js` high in the tree turns a blocking-prerender build error into a silent
full-page skeleton**, and 🔴 **`revalidateTag` with a stale-while-revalidate profile ships no
re-render in the action's response**.

⚠️ **Trap that fired here:** a mid-split rename fixes the href and leaves the **link text**
stale. Grep the visible label, not just the path. ⚠️ Use a **Python** link checker, not a shell
one-liner — a nested capture group errors out under `ugrep` and prints nothing.

---

## ✅ CHAPTER 10 IS CLOSED — 2026-09-05, session `989fb824`

**`fc4ff758`: 46 files, 10,804 lines, 631 ★, positions gap-free 0–45**, from 6 written pages +
6 stubs (one **empty-bodied**). Second chapter closed by this session, four forks again, zero
collisions. QC: 0 over cap · 0 dup positions · 0 gaps · 0 dangling · **0 bare `{/* FOOTER */}` ·
0 half footers** · 0 MDX hazards with raw-tag ON. `progress.js` n:10 = `topics: 46, pages: 46`.

🔴 **Seven pins landed, closing the corpus's oldest gap: `bcrypt` 6.0.0**, taught across 32 pages
with no pin at all. ⚠️ **helmet (23), multer (14), passport (12) are still unpinned.**
🔴 **`next-auth` is `policy: 'major', cycle: '5'` on purpose** — npm `latest` is v4 while the
chapter teaches v5-beta, so `latest` would have called nine pages stale forever. **A pre-stable
library changes the pin's POLICY, not just its version.**
⚠️ **For the currency lane: the zod pin has drifted** — corpus 4.4.3, npm latest 4.5.4.

🔴 **New from primary source, worth spending in ch15 and ch18:** *"Server Functions are not separate
routes in this chain… a Proxy matcher that excludes a path will also skip Server Function calls on
that path."* · *"a layout that hides or swaps them does not stop them from running or from appearing
in the RSC Payload."* · *"The majority of security checks should be performed as close as possible
to your data source."*

🔴 **A defect in a snippet propagates wherever the snippet was copied.** The docs' own optimistic-proxy
example uses `protectedRoutes.includes(path)` — exact equality, so `/dashboard/billing` is
unprotected. It had been copied into **ch02's closed page `07b`** and was fixed there too. **Grep the
corpus for the CODE, not for the topic.**

Record: [[progress-nextjs-ch10]]. Banks: [[research-nextjs-ch10-actions-and-validation]] ·
[[research-nextjs-ch10-proxy-and-rsc-serialization]].

---

## ✅ CHAPTER 08 IS CLOSED — 2026-09-05, session `989fb824`

**`1d8259a0`: 57 files, 13,373 lines, 704 ★, positions renumbered gap-free 0–56.** From
**2 written pages + 7 stubs + 1 generated index** in a single session, with a coordinator and
**four** parallel `devbible-author` forks. `progress.js` n:8 is now `topics: 57, pages: 57`.

Per-topic: 01 (5pp) · 02 (5pp) · 03 (12pp) · 04 (7pp) · 05 (6pp) · 06 (7pp) · 07 milestone (12pp).
**Twenty-two splits, every one proven UP.** Whole-chapter QC at close: 0 over cap · 0 duplicate
positions · 0 gaps · 0 dangling links · 0 bare `{/* FOOTER */}` · **0 MDX hazards with raw-tag
detection ON** · every page badged and sourced.

🔴 **Four forks worked cleanly** on disjoint files and disjoint `sidebar_position` ranges
(1–2/100–119 · 3–4/120–139 · 5–6/140–159 · 7/160–179) — zero collisions, and the first chapter in
this track where the coordinator had **no footer markers to resolve**, because every fork was told
a `{/* FOOTER */}` is not an acceptable hand-off.

🔴 **The half-footer defect fired again at the fork seams** — `02e` had no `Next →`, `07` had no
`←`, because the neighbouring fork's files did not exist at write time. Every mechanical check
passes a one-directional footer. **The close must diff each seam**; the three-line detector is in
[[progress-nextjs-ch8]].

🔴 **Five pins landed with this chapter** — `zustand` 5.0.15, `jotai` 2.20.3 and `nuqs` 2.10.1 had
**no pin at all**; `@tanstack/react-query` 5.102.8 and `@reduxjs/toolkit` 2.12.0 had `pin: null`
and no `nextjs` track.

🔴 **Research is BANKED for the whole chapter — [[research-nextjs-ch8-state-management]]**, ~25
fetches, do not re-fetch. Record: [[progress-nextjs-ch8]]. Findings to spend rather than re-derive,
**ch10 especially**: `/docs/app/guides/interactive-apps` (`lastUpdated: 2026-08-25`) is a guide this
track had never used and is the best source for the mutation-UX patterns · `revalidateTag` under a
stale-while-revalidate profile ships **no re-render in the action response** · `revalidateTag`
**silently no-ops above 256 characters** · react.dev renamed `useActionState`'s first parameter to
`reducerAction` · `useSearchParams` **works in dev and fails in prod** without a Suspense boundary ·
reading published `.d.ts` from a CDN is a legitimate T1 probe for a package that is not installed.

---

## 🔴 STEP 4 — WHAT THIS LANE DOES NEXT

**The 2026-09-04 salvage is DONE.** Both forks from session `833778c4` had written to disk and
never committed; both were recovered, QC'd and committed by session `9348b38e`:

| | commit | what landed |
|---|---|---|
| **ch12** | `f6c8e047` | stub `01` → `01` + `01b`–`01f`, positions 1 and 100–104. **1,484 lines, 70 ★** |
| **ch13** | `30f5d5d1` | stubs `01`/`02` → `01` + `01b` (1, 100) and `02` + `02b` (2, 101). **980 lines, 84 ★** |

⚠️ **The previous cursor said ch13 was clean at wind-down and that fork had "written NOTHING".
That was true of the snapshot and false by the time the session ended** — the fork wrote after
the measurement. 🔴 **Never record a fork as having produced nothing without re-checking disk at
the moment you write the cursor**; that claim nearly discarded 980 lines.

🔴 **Three forward references in the salvaged ch12 prose named files that do not exist yet.** They
were converted to plain-bold `*(not written yet)*` placeholders so the build stays green, and the
exact filenames were handed to the ch12 fork to write:
`01g-file-metadata-the-404-route-and-debugging-the-insight.md` (pos 105),
`02c-json-ld-and-structured-data.md`, `03b-robotsts-and-the-crawl-directives.md`.
**When those land, repoint the placeholders in `01c`, `01d` and `01f`.**

### Two `devbible-author` forks were live in session `9348b38e`

Under the three-agent ceiling, coordinator + 2. **Both were told never to commit.**
🔴 **Run `git status --porcelain docs/nextjs/` FIRST and salvage before writing anything new.**

- **Fork A — `docs/nextjs/pages/12-seo-metadata-and-accessibility/`.** Rewrite the five stubs at
  positions **2–6** (Open Graph/Twitter/JSON-LD · `sitemap.ts`/`robots.ts`/i18n · **accessibility,
  which the chapter has none of yet** · RSC/streaming SEO pitfalls and auditing · the milestone),
  plus the three promised filenames above. Overflow parked in **105–139**. Bank:
  `research_nextjs_ch12_seo_metadata_a11y.md`.
- **Fork B — `docs/nextjs/pages/13-testing-and-developer-experience/`.** Rewrite the three stubs at
  positions **3–5** (type-safety as testing · Turborepo · the milestone). Overflow parked in
  **102–139**. Told to **cross-link, not re-teach**, the four written pages at positions 10–13.
  Bank: `research_nextjs_ch13_testing_dx.md`.

🔴 **The coordinator owns each chapter's `01-explanation.md` index, the footer wiring, the
`*(not written yet)*` sweep, the gap-free renumber and the `progress.js` row. Neither fork was
asked for any of them.** This is the working split-the-work pattern and it has now closed ch16,
ch19 and ch14: one agent per chapter directory, agent never commits, coordinator QCs and commits.

### After ch12 and ch13

✅ **ch11 is CLOSED (30/30, `e48cb375`).** It is no longer a candidate; see the block below.

~~ch02~~ ✅ · ~~ch07~~ ✅ · ~~ch08~~ ✅ · ~~ch10~~ ✅ · 🔴 **START HERE → `docs/nextjs/pages/15-databases-apis-and-full-stack-patterns/`** (5 of 12 written, 7 pending) · then **ch18 (5, genuinely last — it is the capstone and depends on the rest)**.

🔴 **FIFTEEN of nineteen chapters closed.** Two open: **ch15 (7 pending)** and **ch18 (5, the capstone, genuinely last)**.

🔴 **ch10 inherits a lot from ch08 and must not re-teach it:** ch08 owns `useActionState`,
`useOptimistic`, `useFormStatus`, action queuing, the SWR no-re-render trap and zod-validating
`searchParams` across 19 pages. ch10's angle is **auth, sessions, cookies and hardening** —
cross-link the hook mechanics, do not repeat them. Bank: [[research-nextjs-ch8-state-management]].

⚠️ **ch02's board row is the worst-drifted in the track:** `progress.js` claims `pages: 11` and
disk has **4** real pages against **9** stubs (46–82 lines, no tier badge, no `> Verified:`). The
four written ones are the root-params and prefetch pairs, written out of order. Fix the row when
the chapter is actually worked, not before.

⚠️ **Always body-hash a chapter before planning it** — several chapters' stubs are byte-identical:

```bash
for f in *.md; do echo "$(sed -n '/^## /,$p' "$f" | md5sum | cut -c1-8)  $f"; done | sort
```

---

---

## ✅ CHAPTERS 11 AND 02 ARE BOTH CLOSED — 2026-09-04

**ch02 closed `83ff4cb0`: 51/51 pages, 11,463 lines, 474 ★**, from 8 generated stubs. Four forks,
per-fork position ranges, **60 per-file commits**. ✅ **The corpus's one live MDX raw-tag hazard
is gone** (it was ch02's stub `01`) — but 🔴 **check this chapter with raw-tag detection ON;
`--no-rawtag` hides that class.** Record: [[progress-nextjs-ch02]].
⚠️ **One editing pass owed**: `notFound()` was briefed to two forks, so `01f`/`04i` overlap. Nothing
broken; needs one distinct angle each. 🔴 **Handed to the currency lane: no `viewTransition` config
option exists in the current sitemap — any page teaching `experimental.viewTransition` is stale.**

## ✅ CHAPTER 11 IS CLOSED (was: claimed by another session)

**Assigned by the user on 2026-09-04, during session `9348b38e`.**

✅ **THAT SESSION FINISHED: ch11 CLOSED 2026-09-04 at 30/30 pages, 7,020 lines, 211 ★
(`e48cb375`).** Built by a coordinator plus three `devbible-author` forks, each with its own
files and its own `sidebar_position` range — zero collisions. Full record, corrections and
found-not-fixed items: **[[progress-nextjs-ch11]]**.

⏪ (earlier) ▶️ **THAT SESSION IS LIVE AND HAS STARTED, 2026-09-04.** Position, corrections and the exact
next file live in **[[progress-nextjs-ch11]]** — read that, not this block, for ch11 state.
Bank: **[[research-nextjs-ch11-performance-turbopack]]** (5 fetches, whole chapter, do not
re-fetch). First commit `93c1097e`: the Turbopack stub became `01` + `01b` + `01c`
(391 → 724 lines, 11 → 19 ★). 🔴 **Correction that reaches beyond ch11: `runtime = 'edge'` is
DEPRECATED in 16.3** — only the `'edge'` *value*, not the `runtime` option — so any page in this
track still teaching Edge-vs-Node as a live per-route choice is wrong, including ch11's own
generated `01-explanation.md`.
`docs/nextjs/pages/11-performance-optimization-turbopack/` belongs to a **different session**.
A Next.js session that is not that one **reports anything wrong there and edits nothing** — this
checkout is shared and two sessions in one directory is how work gets lost.

### The brief, measured on disk 2026-09-04, so the incoming session need not re-derive it

**10 pages. 2 written, 8 pending** (7 topic stubs + the chapter index).

| pos | file | lines | state |
|---:|---|---:|---|
| 0 | `01-explanation.md` | 114 | 📋 generated index stub — the coordinator's job at close |
| 1 | `01-turbopack-in-dev-and-production-fast-refresh.md` | 70 | 📋 stub |
| 2 | `02-react-compiler-retiring-manual-usememo-usecallback.md` | 76 | 📋 stub |
| 3 | `03-bundle-analysis-dynamic-imports-lazy-loading.md` | 46 | 📋 stub ⚠️ |
| 4 | `04-nodejs-runtime-vs-edge-runtime-capabilities-cold-starts-choo.md` | 62 | 📋 stub ⚠️ |
| 5 | `05-core-web-vitals-tuning-lcp-inp-cls-auditing-workflows.md` | 58 | 📋 stub |
| 6 | `06-instrumentationts-for-opentelemetry-and-application-monitori.md` | 58 | 📋 stub 🔴 **collision, see below** |
| 7 | `07-project-milestone-sprintdesk-performance-audit.md` | 58 | 📋 stub |
| 10 | `10-glob-imports-with-import-meta-glob.md` | 290 | ✅ written |
| 11 | `11-native-nodejs-streams-in-ssr.md` | 170 | ✅ written |

⚠️ **Stubs 03 and 04 are byte-identical in the body** (`42625fa7`) — generated boilerplate. Do
not mine either for content; rewrite both. Body-hash the whole directory before planning:

```bash
for f in *.md; do echo "$(sed -n '/^## /,$p' "$f" | md5sum | cut -c1-8)  $f"; done | sort
```

🔴 **The one decision to make before writing page 06.** `06-instrumentationts-…` duplicates
chapter 16's already-closed pages
`04-telemetry-sentry-logtail-datadog-integration-via-instrumenta.md` and
`04b-opentelemetry-the-span-catalogue-and-trace-volume.md`. **Merge or cross-link — do not
re-teach.** Chapter 16 owns `register()` blocking readiness, `onRequestError` and the `digest`
trap, `instrumentation-client`, the full span catalogue and `NEXT_OTEL_VERBOSE`. If ch11 keeps a
page here at all, it should be the *performance* angle only (instrumentation's own cost) and hand
everything else across. Bank: [[research-nextjs-ch16-deployment]].

🔴 **Positions 10 and 11 are taken by written pages.** Park overflow siblings in **100–139** and
renumber gap-free at close, the way ch13, ch14, ch16 and ch19 were closed.

**Facts to spend, already verified elsewhere in this track — do not re-fetch:** Turbopack is the
**default bundler since 16.0**, so a `webpack()` function **fails the build** and webpack
*plugins* are silently unsupported while loaders are fine · **16.0 removed `size` and `First Load
JS` from `next build` output** as *"inaccurate in server-driven architectures"*, so any CI gate
parsing them passes vacuously and `@next/bundle-analyzer`'s own doc anchor still says
"for-webpack" · **React Compiler is stable via top-level `reactCompiler: true`**, not default,
needs `babel-plugin-react-compiler`, and *"Expect compile times… to be higher"* · **`next
experimental-analyze` exists as a first-party command since 16.1** · the `edge` runtime is **not**
supported in `proxy` · `11-native-nodejs-streams-in-ssr.md` is the **16.3 change that invalidates
pre-16.3 capacity models**, and ch16 links to it.

`src/data/progress.js` line 491 currently reads `topics: 10, pages: 2, pagesPlanned: 10`.
🔴 **That row is the ch11 session's to change. No other session touches it.**

## Standing method (proven across ch4, ch5, ch6, ch9, ch16, ch17, ch19)

- Read `.agents/skills/devbible-topic/SKILL.md` and its three references **before the first page**.
- 🔴 **`nextjs.org/docs` serves Markdown.** Append `.md` to any URL, or send
  `Accept: text/markdown`. The frontmatter comes with it — and **`version:` is the docs build,
  identical on every page, while `lastUpdated:` is the page's own review date.** Resolve paths
  through `https://nextjs.org/docs/sitemap.md` **before guessing a URL**: a wrong path returns a
  readable "Page Not Found" body that summarises like content.
- **Spend the banks.** `grep -rh '^> \*"' --include='*.md' docs/nextjs/pages` returns ~490
  already-sourced verbatim quotes. Check there before fetching.
- **Widen `sidebar_position` ranges while writing, renumber gap-free at close** — and allocate
  *more* interstitial slots than you think you need. ch16 ran out and had to park a chunk at 19.
- 🔴 **`cd` slips are real.** A heredoc in a batch whose earlier `cd` moved you writes the page
  to the repo root. Prefix each write batch with its own `cd`, and `git status` before committing.
- **Commit per file, never `git add -A`** — several sessions share this checkout.
- 🔴 **A local `yarn build` OOMs at the default heap.** Use
  `NODE_OPTIONS=--max-old-space-size=8192 yarn build`, never trust a piped build's exit code,
  and start it early — it takes many minutes on 6,000+ files. **Not run this session.**
- A fresh worktree has **no `node_modules`**; run `yarn install` first.

## Still owed, track-wide

- 🔴 **`docs/nextjs/pages/11-performance-optimization-turbopack/06-instrumentationts-…md`** is a
  58-line stub duplicating ch16's `04`/`04b` telemetry pages. Decide merge vs cross-link when
  ch11 comes up.
- **ch12's server-side idempotency contract page** — drafted, unshipped; every write-queue page
  assumes it.
- **A live MDX raw-tag hazard** at `02-routing-and-navigation/01-file-system-routing-pagetsx.md:7`.
- **`reset` is version-stale in 8 ch7 files** — `devbible-currency` work, not `devbible-topic`.
- ⚠️ **`_category_.json` labels read `"N. Label"` across ALL 19 chapters**, not the house
  `"NN · Label"`. Track-wide; fixing one chapter makes it the odd one out. **Left alone twice now.**
- ⚠️ Found in another lane, not fixed: dangling link at
  `docs/java/pages/phase-12-jvm-production/09-distributed-tracing/02b-span-kind-and-the-shape-of-a-trace.md:202`.

## Facts to spend, never re-derive

`next` is **NOT installed** here, so **no T1 probe of it exists** (react probes 19.2.8, node
v24.20.0) · **16.3.4** is the current docs version, 16.3 GA **2026-08-03**, 16.3 Active LTS /
15.5 Maintenance LTS · **Turbopack default since 16.0**, so a `webpack()` function **fails the
build** and webpack *plugins* are silently unsupported (loaders are fine) · **Tailwind v4 is
CSS-first** — no `tailwind.config.js` on the documented path · **`priority` deprecated in 16 for
`preload`** · **`beforeInteractive` does NOT block hydration** (docs, verbatim) · **crawlers get
a full dynamic render**, retiring most "SSR for SEO" reasoning · **`remotePatterns` omitted
fields imply `**`, and a redirect is not re-validated** · **the ISR stampede question is OPEN and
must stay open** ([[research-nextjs-ch6-isr-and-params]] §4) · **the AVIF conflict between the
August 2026 security release and the Image API reference is banked UNRESOLVED** · **`next
upgrade` and `next experimental-analyze` exist as first-party commands since 16.1** · **16.0
removed `size` and `First Load JS` from `next build` output**, so any CI gate parsing them
passes vacuously · **the official production checklist body is dated 2026-03-10 and is stale** ·
**first-party Skills were repositioned, not withdrawn.**

Research banks: [[research-nextjs-ch19-appendices]] · [[research-nextjs-ch16-deployment]] ·
[[research-nextjs-ch6-isr-and-params]] · [[research-nextjs-ch9-font-and-script]] ·
[[research-nextjs-ch9-image]] · [[research-nextjs-ch9-css]] · [[research-nextjs-ch5-cache-model-ppr-turbopack]].
Chapter records: [[progress-nextjs-ch19-capstone]] · [[progress-nextjs-ch16]] · [[progress-nextjs-ch9]] ·
[[progress-nextjs-ch5]]. Live locks: [[devbible-locks]].

Superseded blocks from [CURSOR-NEXTJS.md](CURSOR-NEXTJS.md), verbatim, newest first. Nothing here was dropped;
it was moved so the live file stays inside its 160-line budget.

Search rather than read: `shared/scripts/recall.sh --cold <terms>`

