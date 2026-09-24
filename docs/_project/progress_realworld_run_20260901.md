---
name: progress-realworld-run-20260901
description: THE RESUME POINT for Real World after the 2026-09-01 three-agent run. Phase 7 closed; phases 6 and 8 part-written by two forks and salvaged at the 92% wind-down. Carries the complete pending-task list, the settled Mongo document model, and the defects found outside the track. Open this before any further Real World work.
metadata:
  type: project
---

# Real World — the 2026-09-01 run, and what is left

**Session `446b57b3`.** User's order: prioritise PERN/MERN and fullstack project
scenarios, *"deploy max 3 agents including you split the work and focus on it to
complete … do not wait for me"*. Wound down at **92% usage** on the user's
instruction to signal the agents, save, and list what is pending.

**Three agents, no shared file.** Coordinator took phase 7; two
`devbible-author` forks took phases 6 and 8, each owning a whole phase directory
including its `README.md`. The coordinator kept `docs/README.md`,
`src/data/progress.js` and `docs/real-world/pages/README.md`. **No collisions.**

## 🔴 2026-09-02 (later) — session `2669ea73` — CHAPTER 03 CLOSED, two forks running — READ THIS BLOCK FIRST

**User's order:** *"Please complete MERN and PERN pending tasks"*, then `Hold`,
then *"Continue and redeploy agents"*. Same arrangement as before: coordinator +
two `devbible-author` forks, whole-phase ownership, no shared file.

⚠️ **The first pair of forks was lost when the Claude Code process exited** —
they had written **nothing** to disk (`git status` was clean apart from the
coordinator's own file), so no salvage was owed. They were redeployed from
scratch with the same prompts.

### ✅ Phase 8 · chapter 03 · Checkout with transactions — CLOSED
**8 chunks + index, 1,821 lines, 51 ★, 0 over cap, 0 MDX hazards.** Commits
`36a4f33f`, `b755e76d`, `43137dab`, `b0b049a1`.

| pos | file | lines | ★ |
|---|---|---|---|
| 1 | `01-the-stock-decrement.md` | 281 | (pre-existing) |
| 2 | `02-the-transaction.md` | 265 | (pre-existing) |
| 3 | `02b-what-each-part-is-doing.md` | 176 | (pre-existing) |
| 4 | `03-failure-retries-and-the-callback.md` | 188 | 5 |
| 5 | `03b-the-three-clocks.md` | 185 | 5 |
| 6 | `03c-a-callback-that-can-run-twice.md` | 212 | 10 |
| 7 | `04-write-concern-and-deployment.md` | 219 | 8 |
| 8 | `04b-the-deployment-requirement.md` | 210 | 9 |
| 0 | `README.md` | 85 | — |

🔴 **Two splits, both proven UP, nothing trimmed.** Chunk 3 drafted at **425
lines / 18 ★** → three files at **584 / 20**. Chunk 4 drafted at **363 / 15** →
two files at **429 / 17**. Boundaries were the ones the argument already had:
the retry *machinery* (two loops, two labels) · the *budget* those loops run
against (three clocks + the completed catch) · what re-running does to the
*callback* · the four `TXN_OPTIONS` *choices* · the deployment *requirement*
that is not a choice.

**All 13 chapter-03 markers in chapters 01–02 and the phase README now link.**
Two needed re-aiming rather than linking: `03·02` (the checkout read) is
`02-the-transaction.md`, and `03·03` (the callback running twice) is
`03c-a-callback-that-can-run-twice.md` after the split. The phase README's
`03·04` replica-set reference points at `04b-the-deployment-requirement.md`.

**Boards wired and committed:** `pages/README.md` phase-8 row 3/6 ·
`progress.js` phase 8 pages 3 + stamp · `docs/README.md` corpus row **71/77**.

### ✅ Phase 6 · chapter 06 · Typing the custom hooks — CLOSED (fork A)
**16 chunks + index, 4,059 lines, 205 ★**, 0 over cap, positions contiguous 0–16,
0 MDX hazards, 133/133 links. Commits `71840d9e`, `16781f9a`. **Track 72/77.**

🔴 **Coordinator repair the fork will repeat if not told:** it wrote **15 hard
links into chapters 07 and 08 before writing them** — a build breaker for every
session in this shared checkout, and the same defect that cost the previous run
44 dangling links. All 15 were converted to bold `*(not written yet)*` and the
`****` artifacts swept before commit. **Fork A has been messaged with the rule:
link only to a file that exists on disk right now; `ls` it first.** The recorded
targets to repoint once 07/08 land — ch 07 `01-the-fetch-hole`,
`02-parsing-the-response`, `03-the-route-map`, `04-errors-as-a-result`,
`05-signals-timeouts-and-retries`; ch 08 `01-derive-never-redeclare`,
`02-pick-omit-partial-required`, `05-exclude-extract-and-distributivity`,
`06-satisfies-versus-annotation`.

### ✅ Phase 8 · chapter 04 · The dashboard on the aggregation pipeline — CLOSED (fork B)
**21 chunks + index, 5,238 lines, 235 ★**, largest file 299, positions contiguous
0–21, 0 MDX hazards, real footers throughout, 506/506 links across the phase.
Commits `85a57b21` + boards. **Track 73/77.**

🔴 **The lesson that generalises: message the fork, do not repair after it.**
Fork B hit the identical forward-link defect as fork A — 12 hard links to files it
had not written (11 into chapter 05, one to a sibling `08c`). Instead of
converting them myself as I had to for fork A, I sent the fork the rule (*link
only to a file that exists on disk right now; `ls` it first*) and **it fixed all
12 in its own directory** — wrote `08c-cursors-and-the-route.md` and converted the
chapter-05 references. Zero coordinator surgery, and the chapter-05 filenames for
the closing repoint now come from the fork rather than a guess. **Put this rule in
the fork brief itself next time; both forks broke it independently, which makes it
a brief defect, not a fork defect.**

### ✅ Coordinator sweep of the CLOSED phases — 50 dead placeholders repaired
Found while assembling the closing repoint list, all **outside** the forks' scope:
- **44 dead `Next → … (not written yet)` footers** across phases 0–5 and 7, every
  one naming a page that already existed. Seven finished phases were reading as
  unfinished with no way forward from 44 pages. Commit `ff44f56f`.
- **6 stale markers in phase 6** naming chapters 02/03/04 as unwritten when all
  three are closed, plus the `05·02` footer that never learned about
  `03-typed-middleware.md` from that chapter's five-way split. Commit `a2a2c9e9`.

⚠️ **Method that worked:** resolve each footer's bold title against its siblings'
`title`/`sidebar_label`, then **verify the target exists on disk before
rewriting**. Two the matcher got wrong or could not settle needed hand work —
`"Auth"` substring-matched `04-authorization.md` when it meant the `03-auth/`
chapter, and a directory-shaped topic (`06-money-and-dates/`) was not in the
flat-file candidate pool. **Always print the proposal list and read it before
applying a bulk link rewrite.**

### 🚧 Two forks running — phases 6 and 8, three topics each
- **Fork A** owns `phase-6-typescript/{06-typing-the-custom-hooks,
  07-the-typed-api-client,08-utility-types-in-app-code}/` — creates all three
  directories, `_category_.json` positions 6/7/8, real footers, closes them.
- **Fork B** owns `phase-8-mongodb-mirror/{04-the-dashboard,
  05-indexes-and-explain,06-change-streams}/` — same, positions 4/5/6.
- **Coordinator keeps** both phase `README.md`s, `src/data/progress.js`,
  `docs/README.md`, `pages/README.md`, and **all marker repointing outside the
  forks' own directories**. No shared file.

### ✅ 2026-09-02 20:45 — WOUND DOWN at the user's instruction (100% usage) — TRACK AT 76/77

**Everything is committed and pushed. 0 files over cap, 0 MDX hazards,
2324/2324 links resolving across the whole track.**

Closed this session, after chapter 03: **p6 t06** custom hooks (16 chunks, 4,059 L,
205 ★) · **p6 t07** typed API client (12 chunks, 2,912 L, 147 ★) · **p6 t08**
utility types (9 chunks, 2,334 L, 132 ★, tier `t-know`) · **p8 t04** the dashboard
(21 chunks, 5,238 L, 235 ★) · **p8 t05** indexes and explain (17 chunks, 4,441 L,
220 ★). **Phase 6 is COMPLETE 8/8. Phase 8 is 5/6.**

## 🔴🔴 THE ONLY THING LEFT IN THE ENTIRE TRACK — ONE TOPIC

**`docs/real-world/pages/phase-8-mongodb-mirror/06-change-streams/`** — fork B was
killed before starting it. The directory exists with **only `_category_.json`, and
that file is UNTRACKED on purpose** (an empty Docusaurus category can break the
build). Write the chunks, then `git add` the directory including the category file.

`_category_.json` content:
`{"label":"06 · Change streams where LISTEN/NOTIFY was","position":6,"collapsed":true}`

**The full spec, already scoped — do not re-derive it.** Tier `t-know`. Cover: what
a change stream is (oplog-backed, **majority-committed**, resumable) and how each
property is strictly more than `NOTIFY` gave — `NOTIFY` is fire-and-forget, lost if
nobody listens, capped at 8000 bytes, no replay; resume tokens, `resumeAfter` vs
`startAfter` vs `startAtOperationTime`, storing the token durably so a restart
neither re-emits nor skips; `fullDocument: 'updateLookup'` and its race (the lookup
reads the *current* document, not the one at the event); `fullDocumentBeforeChange`
and pre/post-images enabled per collection; watching a collection vs database vs
deployment; `$match`/`$project` inside the stream pipeline; invalidate events
(drop/rename) ending the stream; the replica-set requirement and oplog-window
expiry making a token unresumable; and 🔴 **the verdict: a change stream is NOT a
replacement for the transactional `outbox`** — the stream says a write happened,
the outbox is what makes *your* side effect exactly-once. **This app keeps the
outbox**; the change stream is for read-model/cache invalidation, never payments
or email.

Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.
🔴 `mongodb` is **NOT installed** in this repo — say so on the `> Verified:` line
exactly as `03-checkout-with-transactions/02b-what-each-part-is-doing.md` does.

**On close:** repoint the two markers naming chapter 06 —
`01-modeling-the-store/06b-no-equivalent.md:207` and
`01-modeling-the-store/README.md:21` — plus the phase README row 06 and
`03-checkout-with-transactions/04b-the-deployment-requirement.md:43`
(`**chapter 06**, *not written yet*`). Then boards → **77/77, track COMPLETE**.

## 🔴 Fork A corrected three things the coordinator's brief got wrong
Verified against what is actually on disk. **Trust these over the brief:**
1. **`useRef<T>(null)` and `useRef<T | null>(null)` produce the SAME type** in
   `@types/react` 19.2.18 — `RefObject<T>` is `{current: T}`, mutable, and
   `MutableRefObject` survives only as `@deprecated`. The brief asserted they
   differ; that was true of *older* React types. `06·05` documents the truth and
   the historical residue.
2. **TypeScript spine is 7.0.2, not 5.9** — all four pre-existing phase-6 chunks
   say 7.0.2, so the corpus wins. TS is **not installed in this checkout**; the
   `lib.es5.d.ts` quotes come from `typescript@6.0.3` at
   `/mnt/Storage/graveyard/devbible/node_modules/typescript/lib/` and every
   `> Verified:` line says so.
3. **Node is 24.20.0** here (`node -v`), not the 24.19.0 older chunks claim.

**Flagged as uncertain rather than invented** (leave them that way): excess-property
checking against a *union* target (not in the handbook); zod's `unrepresentable`
function form (zod.dev shows a callback, installed 4.4.3 declares only
`"throw" | "any"`); what zod does at run time with an unrecognised `target`.

## 🔴 The fork-brief defect, now FIXED at source
**Both forks independently wrote hard links to files they had not written yet** —
15 in one topic, 12 in the other. A dangling relative link breaks the production
build for every session in this shared checkout and blocks the commit.
`AUTHOR-BRIEF.md` **rule 5 now carries the fix**: link only to a file that exists
on disk right now, `ls` it first, and the rule covers the fork's *own* later chunks
and topics. Also learned: **messaging the running fork is far cheaper than
repairing after it** — fork B fixed all 12 of its own; fork A's 15 cost coordinator
surgery.

## ✅ Coordinator sweep — 50 dead placeholders in the CLOSED phases
44 dead `Next → … (not written yet)` footers across phases 0–5 and 7, plus 6 stale
markers in phase 6, every one naming a page that already existed. Commits
`ff44f56f`, `a2a2c9e9`. **Method:** resolve the bold title against siblings'
`title`/`sidebar_label`, **verify the target exists on disk, and print the proposal
list before applying** — that dry run caught `"Auth"` substring-matching
`04-authorization.md` when it meant the `03-auth/` chapter, and caught a generic
resolver about to flatten seven precise `chapter 07·NN` references to a chapter
README. A reusable dry-run-by-default script is at
`scratchpad/repoint.py` in the session dir (recreate it, it is 40 lines).

### 🔴 START HERE for the next session
**Write `docs/real-world/pages/phase-8-mongodb-mirror/06-change-streams/` — the
spec is above, complete. It is the last topic in the track.** Then repoint its four
markers, wire the four boards, and the Real World track is 77/77 and CLOSED.

⚠️ A Python session (`devbible-f3`) writes `docs/python/` in this same checkout.
Commit explicit paths, **never `git add -A`**.

**Remaining after the forks:** nothing. Phase 6 → 8/8 and phase 8 → 6/6 closes
the track at **77/77**. The MERN dependency below still stands as a *concept*
gap (`docs/mongodb/` phases 7+ are at zero), not a Real World one.

## 🔴 2026-09-02 — session `7b1cda34` — WOUND DOWN at the user's instruction (usage limit) — READ THIS BLOCK FIRST

**User's order:** *"complete PERN and MERN pending tasks, deploy max 3 agents,
follow the hard rules"*, then *"we are approaching limit, wind up"*. Three
agents, whole-phase ownership, no shared file: fork A owned
`phase-6-typescript/{05,06,07,08}-*/`, fork B `phase-8-mongodb-mirror/{03,04,05,06}-*/`.
Both were killed at the wind-down; what they had on disk was QC'd, split where
over cap, and committed. **Everything is committed AND pushed** (`083a1db4`,
`origin/main` == `main`). Track: **70 of 77 topics**, 0 over cap, 0 MDX
hazards, 1494/1494 links — link-checked, NOT built.

### Done this session
- ✅ **Phase 6 · 05 · Typed Express handlers CLOSED** — 7 chunks + index,
  2,117 lines. Chunk 03 was drafted at 674 lines / 23 ★ and split five ways
  (03, 03b, 03c, 03d, 03e) to 1,172 lines / 54 ★ — proven UP, nothing trimmed.
  The five markers naming chapter 05 in chapters 02 and 04 now link.
- 🚧 **Phase 8 · 03 · Checkout with transactions at 3 chunks**: `01-the-stock-decrement.md`
  (280, real footer now), `02-the-transaction.md` (265), `02b-what-each-part-is-doing.md`
  (173). Chunk 02 was drafted at 394 by the fork and **split by the coordinator**
  at the "What each part is doing" boundary: 394 → 438 lines, all 14 ★ kept and
  distributed (gotchas 4/4, questions 4/2). `sidebar_position` is 1, 2, 3 — the
  next chunk takes **4**.
- ✅ The 17 `{/* FOOTER */}` placeholders in phase 8 chapters 01–02 are real
  footers; both chapter indexes have their phase/prev/next line.
- ✅ Both phase-3 defects fixed (`12-openapi.md` targets `draft-2020-12`; the two
  "Phase 6" links point into `phase-6-typescript/README.md`).
- ✅ Boards wired: phase-6 README, phase-8 README (chapter 03 row now says
  part-written with the real chunk count), `pages/README.md` 5/8,
  `progress.js` pages 5 + stamp, `docs/README.md` corpus row + claim row.

### 🔴 START HERE → `docs/real-world/pages/phase-8-mongodb-mirror/03-checkout-with-transactions/03-failure-retries-and-the-callback.md`, `sidebar_position: 4`
Chunk 01 line 170 and chunk 02b both promise it as **chunk 3** *(not written yet)*.
The central trap, already scoped: **the `withTransaction` callback may run more
than once** (TransientTransactionError / UnknownTransactionCommitResult, retryable
writes, what that does to side effects and closure state inside the callback).
`mongodb` is NOT installed in this repo's `node_modules` — driver claims come
from the published docs and `src/sessions.ts` on GitHub; say so on the Verified
line as chunk 02 does. Then `04-write-concern-and-deployment.md` (position 5),
then the topic `README.md`, then repoint every `**chapter 03** / **03·02** /
**03·03** / **checkout transaction** *(not written yet)*` marker in phase 8
chapters 01–02 (grep `not written yet` — 12 of them name chapter 03).

### The pending list after that — 6 topics
| Phase | Topic | State |
|---|---|---|
| 6 | `06-typing-the-custom-hooks/` | not started — hooks from phase 4 (01, 02, 04, 05); `AsyncState` as a discriminated union is promised by chapter 04 |
| 6 | `07-the-typed-api-client/` | not started — `z.toJSONSchema(s, {target: 'draft-2020-12'})`; chapter 05·03c names it as **chapter 07** *(not written yet)* |
| 6 | `08-utility-types-in-app-code/` | not started — three chunks in chapters 02 and 03 promise specific content (grep `chapter 08`) |
| 8 | `04-the-dashboard/` | not started — link `docs/mongodb/pages/phase-6-aggregation/` (exists now, 01–05) |
| 8 | `05-indexes-and-explain/` | not started — 12 markers across chapters 01–02 promise it; never fabricate `explain()` output |
| 8 | `06-change-streams/` | not started |

**Fork brief that worked** (reuse it): the two Agent prompts of this session
told each fork to write REAL footers, to repoint placeholders only inside its
own directories, and to write each file complete in one Write so the
coordinator could commit from disk as files landed. It did — a Monitor on
`git status --porcelain` of the two phase directories woke the coordinator per
file. ⚠️ A fork writes the whole topic first and splits after, so a 674-line
file on disk mid-run is normal; do not commit it, wait for the siblings.

## State at wind-down — track is GREEN

**166 files, 31,824 lines, 1359/1359 links resolving, 0 MDX hazards, 0 files
over the 300-line cap, working tree clean.** 24 commits ahead of `origin/main`
— **not pushed.**

| Phase | State |
|---|---|
| 0–5 | ✅ complete (59 topics) |
| **7 · CSS recipes** | 🏁 **COMPLETE 4/4** — see [[progress-realworld-p7-close]] |
| **6 · TypeScript** | 🚧 **4/8** — 02, 03, 04 closed; **05 part-written**; 06, 07, 08 not started |
| **8 · MongoDB mirror** | 🚧 **2/6** — 01, 02 closed; **03 part-written**; 04, 05, 06 not started |

**69 of 77 topics.**

## 🔴 THE PENDING LIST — start here

### Phase 6 · TypeScript across the stack (4 topics left)
1. **`05-typed-express-handlers/` — FINISH IT FIRST.** 2 chunks on disk
   (`01-declaration-merging-not-casts.md`, `02-the-five-generics-in-practice.md`).
   Owes **`README.md`** (does not exist — three placeholder markers become links
   the moment it does) and **`03-middleware-locals-and-errors.md`**.
2. `06-typing-the-custom-hooks/` — not started.
3. `07-the-typed-api-client/` — not started. 🔴 Write it with
   `z.toJSONSchema(s, {target: 'draft-2020-12'})`, **not** `'openapi-3.1'` — see
   the defect below.
4. `08-utility-types-in-app-code/` — not started.

### Phase 8 · The MongoDB mirror (4 topics left)
1. **`03-checkout-with-transactions/` — FINISH IT FIRST.** 1 chunk on disk
   (`01-the-stock-decrement.md`). Owes `02-the-transaction.md`,
   `03-failure-retries-and-the-callback.md`,
   `04-write-concern-and-deployment.md`, and `README.md`.
   The chapter's central trap, already scoped: **the `withTransaction` callback
   may run more than once.**
2. `04-the-dashboard/` · 3. `05-indexes-and-explain/` · 4. `06-change-streams/`
   — not started.

### Owed housekeeping
- 🔴 **Phase 8 chunks end with a literal `{/* FOOTER */}` placeholder**, not a
  real `← Prev · Index · Next →` footer. Fork B left them for topic close; fork A
  wrote real footers. **17 files** need wiring. Harmless MDX, but visibly
  unfinished.
- **Phase 8 `README.md` chapter rows for 03–06 carry chunk counts that are
  aspirational**, not counts of files on disk.
- `git push origin main` — 24 commits unpushed. **The push is the deploy**
  ([[feedback-merge-to-main-includes-push]]).

### 🔴 Two defects found OUTSIDE the track, not fixed
- **`docs/real-world/pages/phase-3-express-api/12-openapi.md`** uses
  `z.toJSONSchema(s, {target: 'openapi-3.1'})`. zod 4.4.3's declared targets are
  `draft-04 | draft-07 | draft-2020-12 | openapi-3.0` (plus `({} & string)`,
  which is why it compiles silently). **OpenAPI 3.1 *is* JSON Schema 2020-12, so
  `draft-2020-12` is correct.**
- **`phase-3-express-api/02-the-validation-boundary.md` and `12-openapi.md`**
  both link `../../syllabus/02-frontend.md` for "Phase 6"; those should point
  into `phase-6-typescript/`.

## 🔴 The Mongo document model — settled, do not re-derive

**Eight collections:** `users`, `sessions`, `categories`, `products`, `carts`,
`orders`, `reviews`, `outbox`.

**Embedded (the four tables that vanish):** `product_images` →
`products.images[]` · `cart_items` → `carts.items[]` · `order_items` →
`orders.items[]` · `review_images` → `reviews.images[]`. All pure child tables:
read only with the parent, written only by the parent's code path, bounded.

**Stay collections, and why:** `reviews` (unbounded per product; moderation reads
*across* products) · `sessions` (high cardinality, TTL index on `expiresAt`
**replaces the Phase 2 sweep job**) · `outbox` (a queue whose documents leave;
`findOneAndUpdate` lease replaces `FOR UPDATE SKIP LOCKED`) · `categories`
(small, referenced everywhere) · `users`, `products` (roots).

**Denormalisation:** `products.category = {_id, slug, name}` extended reference,
so the catalog filter is an indexed equality predicate rather than a `$lookup` ·
`products.rating = {avg, count}` recomputed, **never `$inc`'d** ·
`orders.items[]` snapshots name/slug/coverKey/qty/unitPriceCents — a copy that
**must never be repaired**, so order history needs no hydration.

**Identity:** `_id` is an ObjectId everywhere; `slug` stays the public id.

## Coordinator lessons from running two forks

🔴 **Salvage QC is not optional and the forks will not do it.** Between them the
two forks left **44 dangling links** and **1 build-breaking MDX hazard** (an
inline code span left open before a line starting with `{`). Both break the
production build *for every other session in the shared checkout*. The
coordinator converted the links to bold `*(not written yet)*` text and fixed the
span before committing.

⚠️ **The dangling-link sweep produced `****text** *(not written yet)***`** where
a link already sat inside bold. Regex-repair leaves artifacts — **grep for
`****` after any such sweep.**

⚠️ **Tell a fork explicitly whether it writes footers.** Fork A wrote real ones
(correctly, since it was told to close its topics); fork B wrote
`{/* FOOTER */}` placeholders. Both defensible, and the inconsistency is now
17 files of work.

✅ **Whole-phase ownership worked perfectly.** No shared file between the three
agents, so zero collisions across ~10,000 lines committed from two concurrent
writers.

🔴 **A fork that verifies rather than complies is right.** Fork A caught that the
shared-types example listed a six-value order-status enum while
`phase-1-database/01-the-schema` declares **five**
(`pending|paid|shipped|delivered|cancelled`), and corrected it.

## The MERN dependency that still stands

Real-world phase 8 is being written against the MongoDB manual directly, because
**`docs/mongodb/` phases 6–14 are at zero** — aggregation, indexes, the Node
driver, Mongoose, transactions. Its references to those concept pages are plain
text, not links. **MongoDB 6–10 is still the real unblock for the MERN half.**
Coverage map: [[progress-stack-coverage-map-20260901]].

See also [[progress-realworld-build]], [[progress-realworld-chunk-b-css]],
[[devbible-locks]], [[progress-mongodb-pages]].
