---
name: devbible-typescript-part-b
description: THE resume point for TypeScript Part B — phases 7–12, TypeScript in the stack. Who holds it, what is written, the exact next action, and the traps that are specific to this half
metadata:
  type: progress
---

:::danger THERE ARE NO WORKTREES — WORK ON `main`
Every devbible worktree and branch was merged into `main` and **deleted** on
2026-08-15. All TypeScript content is on `main` at
`/mnt/Storage/Backup/Knowledge/devbible`. Ignore any "worktree", "branch" or
"merge at the phase close" instruction in older TypeScript text — including the
Part A/B split memo, which was written while worktrees existed. `main` builds
0 warnings / 0 broken links, so **a break there is yours**.
:::

## 🏁 COMPLETE — TypeScript **Part B**, closed by session `c01e37bb`, 2026-08-17

🏁 **PART B IS COMPLETE — phases 10 and 12 both closed, and TypeScript stands at
136 of 136 in-scope topics.** **Nothing remains in this lane.**

⛔ **DO NOT START WORK HERE.** If a session is told *"pick typescript b"* or given a
phase number (10 or 12), **the correct response is to say the lane is finished and
let the user choose** — not to open the resume point below, and not to invent work
in a closed phase. ⚠️ **Everything after this banner is a RECORD of completed work,
not a queue.** The old "take the lane over and start writing" instruction that stood
here is **void**; it was correct only while topics remained.

**Session `c01e37bb` took it over from `ede9cd9f`** (which took it from `ea9f43fb`,
which took it from `27931e79`) on *"pick ts b"*.

**What session `c01e37bb` delivered — 🏁 PHASE 10 CLOSED and phase 12 opened:**

| | |
|---|---|
| ✅ **topic 11** · typescript-eslint type-aware rules | finished from 4/7 → **10 chunks + README, 2,509 lines** |
| ✅ **topic 12** · Assertion discipline | **5 chunks + README, 1,172 lines** |
| ✅ **topic 13** · Designing APIs `unknown`-first | 223 lines — **closes phase 10 at 13/13** |
| ✅ **phase 12 scaffolded** + **topic 01** · Type checking in CI (Master) | **5 chunks + README, 1,048 lines** |

**24 files, ~4,950 lines, 0 over the 300-line cap** (spread 183–294), boards updated
after every topic and the memory committed after every file. **TypeScript overall
moved 102 → 116 of 136 topics** while three other lanes wrote in parallel.

🔴 **Rule 1 was exercised in the open and the measurement is the point:** topic 11
was planned as **7 chunks and finished at 10**, because two syllabus items were
several arguments each. Chunk 06's draft hit **329 lines and was SPLIT, not
trimmed — and the two halves then came to 459 together.** The **130 lines the split
added** were the most useful material on the page. 📌 **Never size a page to the
cap; the chunk count is an output.**

⚠️ **Two duplication traps caught by checking other phases BEFORE writing** — see
the topic-12 and topic-13 sections. **Do this every time; it is now standard for
this lane.**

🔴🔴 **THE RULE THE USER RESTATED ON HANDOVER, twice, verbatim:**

> *"every i still have repeat a critical rule about file size, it should be 300
> lines but it was never a content budget you can explain upto 1000 lines or
> more just split them into multiple chunks to bring 300 lines filesize so it
> would be easy to read and rest of the chunks import them into main file."*

and then, checking it had landed: *"Did you get the critical rule i am talking
about ?"*

⚠️ **This file was part of the problem.** Its resume line read
*"`05-exactoptionalpropertytypes.md` (Understand, **one file**)"* — a file count
decided **before the topic was written**, which is a content budget with no
trace in the diff. It is exactly the failure
[[devbible-typescript-part-a-session-20260815]] caught Part A committing. Topic
05 was written out in full first and came to **1,178 lines / 5 files**.

🔴 **Never write a file-count prediction into a resume point again.** Write the
topic name and its tier; the chunk count is an *output* of writing it, never an
input.

### The old header, kept for the record — session `27931e79`, 2026-08-15

Taken on the user's instruction **"pick typescript b"**, which reopens the
[[devbible-typescript-split-parts-ab]] boundary for the *second* half. Part A had
already been reopened the same day by session `3af83cbb`
([[devbible-typescript-build-progress]]), so **both halves are now live in
parallel** and the directory boundary is load-bearing.

## 🔴🔴 RE-SCOPED 2026-08-15 — PHASES 10 AND 12 ONLY

> *"I just need phase 10 and phase 12 apart from rest drop, if they are already
> written let it be and if not written yet drop those"*

**Read this before anything below it.** Part B was 84 topics; it is now **28**.

| | Phase | Topics | Fate |
|---|---|---|---|
| ✅ | **7 · TypeScript on the server** | **5** kept, 10 dropped | **COMPLETE at 5/5** — the five Master rows are written and stay |
| ⛔ | 8 · TypeScript in React | 14 | **dropped**, nothing was written |
| ⛔ | 9 · Types at the boundary | 15 | **dropped**, nothing was written |
| 🎯 | **10 · Strictness and correctness** | **13** | **IN SCOPE — next** |
| ⛔ | 11 · Migration and legacy | 12 | **dropped**, nothing was written |
| 🎯 | **12 · Tooling, performance and testing** | **15** | **IN SCOPE** |

🔴 **Nothing written was deleted, and that is the rule going forward too** — a
dropped phase that still has pages is correct. Phase 7's 22 files stay on the
reading path. **Syllabus rows for every dropped phase are kept under banners**
in `docs/typescript/syllabus/03-in-the-stack.md` and `04-rigour-and-tooling.md`;
reopening one needs a new instruction.

⚠️ **The cut is Part B's only.** Phases 2–6 are Part A's and were not touched.

📌 TypeScript's in-scope total moved **187 → 136** (recomputed from
`progress.js`, not by hand). The `phase-8-react`, `phase-9-boundary` and
`phase-11-migration` **rows were removed from `progress.js`** — the React
precedent for a dropped phase — so do not expect to find them there.

| | |
|---|---|
| **Scope** | **Phases 10 and 12 only** — `docs/typescript/pages/phase-{10,12}-*/`. Phase 7 is closed |
| **Not mine** | Phases 2–6 (Part A, session `3af83cbb`) — never create or edit a file there. Also 8, 9, 11: dropped, not deferred |
| **Where** | `/mnt/Storage/Backup/Knowledge/devbible`, `main` |
| **Size** | **28 topics left** (13 + 15) |
| **Cadence** | 🔴 **PER FILE, no exceptions** — write one file → boards → commit → memory. Re-affirmed 2026-08-15 by the user: *"We are almost already reached almost 90% so make sure your saving session progress now onwards perfile completion"*. Usage is near the cap, so a session that dies mid-topic must lose at most one file |

### Standing authorisation

Inherited from the TypeScript lock, user 2026-08-13: *"go ahead with phase 0 and
do not wait for me till the typescript finishes"*. Run the phases **without
pausing for approval**; [[devbible-incremental-scope]] is suspended for
TypeScript.

Also standing: build warnings from other sessions' languages are not mine. Check
only that no warning names `typescript`.

## State

| | |
|---|---|
| **Phase 7 · TypeScript on the server** | ✅ **COMPLETE, 5 of 5** (cut from 15) |
| **Phase 10 · Strictness and correctness** | 🏁 **COMPLETE, 13 of 13** — 68 files, 0 over the cap. 01 (3 chunks, 880) · 02 (234) · 03 (240) · 04 (225) · 05 (4 chunks, 1,178) · 06 (5 chunks, 1,204) · 07 (5 chunks, 1,181) · 08 (4 chunks, 862) · 09 (4 chunks, 923) · **10 (14 chunks, 3,808)** · **11 (10 chunks, 2,509)** · **12 (5 chunks, 1,172)** · **13 (223)** |
| **Phase 12 · Tooling, performance and testing** | 🎯 **0 of 15**, directory does not exist |
| Phases 8, 9, 11 | ⛔ dropped — not work, not deferred |
| TypeScript overall | **82 of 136 topics in scope** · **160 files** (`find docs/typescript/pages -name '*.md'`, 2026-08-17). ⚠️ Part A closed phase 4 at 14/14 and is mid-write in **phase 5**, so both numbers move under you — **re-measure before editing the shared row in `docs/README.md`, and merge onto their edit rather than overwriting it** |
| Part B remaining | 🎯 **15 topics — all of phase 12.** Phase 10 is closed |

### Phase 7 — COMPLETE at 5/5, all five Master rows

| # | Topic | Tier | Files | Commit |
|---|---|---|---|---|
| 01 | `tsconfig.json` for a Node 24 service | Master | **6** — `README` 74 · `01-who-compiles` 239 · `02-the-module-format` 222 · `03-target-lib-and-types` 283 · `04-the-annotated-configs` 241 · `05-emit-layout-and-programs` 231 = **1,290** | `ab9b0984` + `eff03a6d` |
| 02 | Shipping TypeScript to production | Master | **3** — `README` 63 · `01-what-actually-ships` 239 · `02-source-maps-and-stack-traces` 281 = **583** | `db076b82` |
| 03 | Typing `process.env` | Master | **4** — `README` 73 · `01-what-process-env-actually-is` 249 · `02-augmenting-processenv` 279 · `03-why-parsing-wins` 219 = **820** | `4e7fbd83` |
| 04 | `catch (e: unknown)` | Master | **5** — `README` 72 · `01-proving-it-on-a-server` 244 · `02-making-an-error-recognisable` 226 · `03-what-belongs-on-an-error` 239 · `04-what-you-do-with-it` 264 = **1,045** | `787d1a28` |
| 05 | Typed Express handlers | Master | **3** — `README` 77 · `01-the-five-generics` 294 · `02-a-promise-the-compiler-cannot-keep` 244 = **615** | `6dcb9e62` |

✅ **Topics 01 and 02 are BUILD-VERIFIED.** Clean isolated rebuild
(`rm -rf .docusaurus-tsb build-ts-b && DOCUSAURUS_GENERATED_FILES_DIR_NAME=.docusaurus-tsb yarn build --out-dir build-ts-b`)
→ **`[SUCCESS]` and `grep -iE 'warning|broken'` returned ZERO across the entire
site.** Confirmed independently by Part A, who ran the same check. Topic 03 is
link-checked (714 links, 0 broken) but landed after that build.

⚠️ **Two earlier builds failed and NEITHER was mine** — the lesson is to
attribute before investigating. (1) The Docker session committed a
`_category_.json` written through a heredoc with **literal `\n` escapes**, so it
was one physical line of invalid JSON and took the whole site's sidebar down;
they fixed it in `f3a46449`. (2) Part A was converting flat phase-3 topic files
into chunk directories and left the **flat `.md` and the new directory both
present** across several minutes of writing — two routes on one URL plus a stale
`@site` import, which walked from topic 12 to topic 13 between two of my runs.
🔴 **On a shared checkout the WORKING TREE is the shared surface, not the commit
graph** — a rename must delete the flat file, add the directory and repoint every
inbound link in one go. Part A has adopted that and logged it in
`shared/session_build_devserver_registry.md`.

⚠️ **Rule 1 has now bitten twice, and both times the answer was to SPLIT.**
Topic 01's first draft was three chunks with two at **318 and 319**; topic 04's
was three chunks with one at **301**. Split on the concept boundary every time —
01 broke at "who compiles" / "what module format", 04 broke at "recognising an
error" / "what it carries". **The split ADDS material** (topic 01 gained a
choose-a-path table, `noImplicitOverride`, `isolatedModules`; topic 04 gained the
discriminant-widening gotcha and the log-grouping argument), which is the tell
that trimming would have cost real content. Each new chunk gets its own tier
badge, `> Verified:` line, Gotchas and Interview questions.
📌 **301 counts.** Do not shave one line.

## 🔴 EXACT RESUME POINT — 2026-08-17, session `c01e37bb` (took the lane on *"pick ts b"*)

✅ **TOPIC 11 IS COMPLETE — phase 10 · 11 · typescript-eslint type-aware rules**
(Understand). **10 chunks + README = 11 files, 2,509 lines, spread 202–293, 0 over
the 300-line cap.** Commits `bd78ca63` (05), `7ba77b74` (06 + 07), `f7013a4a`
(08 + 09), `18d673ff` (10 + all four boards).

🏁🏁 **PHASE 10 IS COMPLETE — 13 of 13.** 68 files, **0 over the 300-line cap**,
and at the close **2,792 links across `docs/typescript` with 0 broken ANYWHERE in
the tree** (not just in Part B scope). Commit `0de3f9e4`.

🚧 **IN PROGRESS: phase 12 · Tooling, performance and testing — the LAST thing Part
B owes, 15 topics.** ✅ **Directory created and the phase is open** (`89afacae`):
`docs/typescript/pages/phase-12-tooling/` with a full 15-row README, **no
`_category_.json` on the phase dir** (README frontmatter + autogeneration — only
the chunked topic inside has one), and `progress.js` given `pagesPlanned: 15` so it
reads *writing* rather than complete.

✅ **TOPIC 01 · Type checking in CI (MASTER) IS COMPLETE — 5 chunks + README = 6
files, 1,048 lines, spread 183–214, 0 over the cap.** Commits `949fce3d` (02),
`7efef003` (03), `28215564` (04), `e12679d7` (05 + all four boards).

✅ **TOPIC 02 · What TypeScript 7 changed for tooling — COMPLETE.** 3 chunks +
README = 4 files, **553 lines**, spread 151–177, 0 over the cap. Commits
`948bb68a`, `025073b5`, `d215970c`.

✅ **TOPIC 03 · Build pipelines — COMPLETE.** 3 chunks + README = 4 files,
**565 lines**, spread 162–177, 0 over the cap. Commits `053a2c90`, `69b05380`,
`dc4aac67`.

✅ **TOPIC 04 · Testing types — COMPLETE.** 2 chunks + README = 3 files,
**417 lines**, 0 over the cap. Commits `3c1aa182`, `52870d89`.

✅ **TOPIC 05 · Typing tests — COMPLETE.** 2 chunks + README = 3 files,
**460 lines**, 0 over the cap. Commits `2095cfbc`, `68fd73e8`.

✅ **TOPIC 06 · Diagnosing a slow compile — COMPLETE.** 2 chunks + README = 3
files, **429 lines**, 0 over the cap. Commits `c84b5d9a`, `4a32fb04`.

✅ **TOPIC 07 · Editor performance — COMPLETE.** 202 lines, one file, 0 over the
cap. Boards commit `40a18f9f`.

⚠️🔴 **INCIDENT, and it is the known shared-checkout hazard recurring: ANOTHER LANE
SWEPT MY FILE INTO THEIR COMMIT.** `07-editor-performance.md` was committed by
**`1a94dfd4` ("TS PHASE 5 COMPLETE")** — lane A — almost certainly via a forbidden
`git add -A`. **Nothing was lost**: `git show HEAD:<path>` diffs **identical** to
disk, so the content is intact and correct; only the attribution is wrong, and my
own commit `40a18f9f` therefore carries just the four board files. 📌 **Detect it
the way it was detected here: a commit that reports fewer files than you staged.**
**Do not try to re-commit the file** — it is already in history. This is the fourth
recorded instance of a cross-lane staging collision on `main`.

✅ **TOPIC 08 · `skipLibCheck` as a performance lever — COMPLETE.** 205 lines, one
file. Commit `d8165148`.

✅ **TOPIC 09 · Caching TypeScript in CI and Docker — COMPLETE.** 205 lines, one
file. Commit `f483ab76`.

✅ **TOPICS 10 and 11 COMPLETE.** 10 · Monorepo orchestration (Know, 169) —
`1e7d16b5`. 11 · Declaration emit (Know, 156) — `34de7bfc`.

🏁🏁 **PHASE 12 IS COMPLETE AT 15/15 — AND WITH IT PART B, AND WITH IT
TYPESCRIPT: 136 of 136 IN-SCOPE TOPICS, 419 files.**

**There is nothing left in Part B's scope.** Phases 10 and 12 are both closed;
phase 7 was closed earlier at 5/5; phases 8, 9 and 11 were dropped by the
2026-08-15 cut and are **not** work. ⚠️ **Do not silently pick up another
language** — the one-language-per-session lock overrides rule 9's "pick up the next
idle language". **Say Part B is done and let the user choose.**

**Verified at the close, measured not assumed:**

| Check | Result |
|---|---|
| `.md` links across `docs/typescript` | 🔴 **3,467 links, 0 broken ANYWHERE** (not just Part B scope) |
| 300-line cap, whole technology | 🔴 **0 files over** |
| every `_category_.json` | parses |
| `progress.js` | loads; **no phase left with `pagesPlanned`**, i.e. nothing reads as mid-write |
| ⚠️ build | **not run** — rule 12, registry not claimed. Link-checked against the filesystem, as every Part B close has been |

### ✅ Topics 12–15, the close of phase 12

**12 · Validating published types (176).** 🔴 **Every check in this phase ran against
the SOURCE TREE; what breaks a consumer is the published ARTEFACT** — different
objects, and nothing compared them. 🔴 **And what goes wrong is RESOLUTION, not
types** (declarations missing from the tarball, `types`/`exports` pointing at an
unpublished path, correct under one `moduleResolution` and broken under another) —
**none of it a type error**, so no amount of checking surfaces it. 🔴 **The cheapest
check needs no tools: pack, install into an empty project, import, hover** — with
the **packed artefact**, never a link, since a link resolves your source and
reproduces the false confidence. 📌 *"It works in our monorepo"* is evidence about a
different thing. 📌 **It belongs on the RELEASE path and is the honest exception to
"do not re-check on deploy"** — that rule forbids *repeating* a check; this one
could not have run earlier because its subject did not exist.

**13 · Measuring type coverage (157).** Counts **expressions** not `any`. 🔴 **But an
`as` produces a COVERED expression**, so the cheapest way to raise it is the move
topic 12 calls the worst available outcome — ⚠️ **a coverage target set alone pays
people to make the codebase worse in a way the metric cannot see.** 🔴 **Fix: never
report it without the assertion count beside it.** 📌 **The general lesson, now seen
twice: any single metric over a type system is satisfiable by moving the problem to
whatever is not counted.** Use it as a **direction, per directory, as a ratchet**;
⚠️ **never compare two projects** — it is largely a function of your dependencies.

**14 · AST tooling after TS 7 (155).** 🔴 **Re-shaped, not re-exported — a port is a
rewrite**, which is how it gets mis-planned. 🔴 **Ask whether the tool needs to
exist**: a finished codemod → delete; a rule → a lint rule, where the maintainers
absorb the churn; codegen → read the `.d.ts`, which is stable output. ⚠️ **The
custom transformer is the expensive case and belongs in the AUDIT** — old,
undocumented, load-bearing, unowned; **finding it is more of the work than porting
it.**

**15 · Contributing to DefinitelyTyped (167).** 🔴 **Two upstreams** — one look saves
the round trip. 🔴 **Ship the shim AND send the PR the same day; they are sequential
and the shim is what kills the incentive.** A contribution needs **a test that fails
before the change** (topic 04's argument upstream). 🔴 **An `any` left in a
contributed `.d.ts` is INHERITED `any` in every consumer's program** — the kind the
compiler structurally cannot report. 📌 **Better than a good `@types` contribution:
helping the library ship its own**, so declarations change with the implementation.

### ✅ Topic 10 — monorepo orchestration (Know)

🔴 **TWO orchestrators both think they own build order** — `tsc -b` walks the
**project reference** graph, the task runner walks the **task** graph, **nothing
keeps them in sync.** Decide which is authoritative; **per-package tasks usually win
because they are what makes caching possible at all** (a single root `tsc -b` is one
enormous task invalidated by every commit).

🔴 **THE STALE-GREEN BUG — topic 09's key problem one level up: a cached task is
only sound if it is deterministic given its DECLARED inputs.** A `typecheck`
depending on a sibling's types while declaring only an *ordering* edge **hits the
cache after the sibling changed and reports success for a check it never ran.**
📌 ***"Run after" is not "invalidate when"*** — the inputs must include the
dependencies' **outputs**.

⚠️ **The trade nobody states: per-package checking is SLOWER COLD, much faster
warm** — so **the arrangement depends on the cache actually hitting**; a
misconfigured cache means you took the cost and none of the benefit. **Remote
caching multiplies whatever correctness you already had.**

### ✅ Topic 11 — declaration emit (Know)

🔴🔴 **THE FIND: the 4xxx range exists ONLY in the declaration-emit path**, so **a
green `--noEmit` gate and a failing declaration build are not a contradiction** —
the question *"can this type be written down?"* is never asked when nothing is
emitted.

🔴 **And all of them are ONE problem in three phrasings** — *private name* ·
*from private module* · *cannot be named*. **Grep-measured: 46 say "private name",
15 say "cannot be named".** To emit a `.d.ts` the compiler must produce a **name**
for every type in the public surface; **inside your own source an inferred type
never needs one.**

🔴 **Consequence, and it sharpens topic 03 chunk 02: for a library the declaration
build is not merely overlapping with `--noEmit`, it checks STRICTLY MORE — so it IS
the gate**, and a library gating on `--noEmit` is not checking the thing it ships.

📌 *"Has or is using private name"* is a **design finding** (the type is part of your
API whether you meant it or not); *"cannot be named"* is **the case where an explicit
annotation IS the fix**, the same lever topic 06 gives for speed from the opposite
direction.

⚠️ **NUMBER TO RECONCILE ONE DAY, deliberately not shipped:** my grep counted **111**
unique 4xxx codes; the shipped census on
`phase-10-strictness/10-the-error-codes/01-what-a-code-is.md` says **110**. **Topic
11 therefore links that page for the total instead of restating it**, and uses only
the two sub-counts I measured myself. **Do not "fix" either page to match the other
without re-counting both by the same method.**

### ✅ Topic 09 — caching (one file)

🔴 **THE CACHE-KEY TRAP AND ITS RESOLUTION:** a key hashing the sources is correct
and **never hits**; the working shape is a **hierarchy with a prefix fallback** —
because **the cache needs to be RECENT, not CURRENT.** A `.tsbuildinfo` is a
**starting point**, not an answer.

🔴 **And a stale entry is SAFE, not dangerous: the compiler validates it against the
current sources rather than trusting it**, so the worst case is *less work saved*,
never a wrong result. ⚠️ **That property is precisely what licenses the fallback
strategy** — without it you would have to key exactly and never hit. **Key on what
makes the file unusable rather than out of date:** compiler version · `tsconfig` ·
lockfile.

📌 **`TS5074`** *"Option `'--incremental'` can only be specified using tsconfig,
emitting to single file or when option `'--tsBuildInfoFile'` is specified."* — **and
the explicit path is what the cache step needed anyway.** (Descriptions also banked:
`incremental` = *"Save `.tsbuildinfo` files to allow for incremental compilation of
projects."*, `tsBuildInfoFile` = *"Specify the path to `.tsbuildinfo` incremental
compilation file."*)

🔴 **Docker: the order of the `COPY` lines is the whole game** — manifest + lockfile
→ install → source → build, because Docker invalidates **every layer from the first
changed one**, so an install after `COPY . .` reruns on every source edit. **The
naive Dockerfile is shorter and completely wrong for caching.** ⚠️ **A local
`.tsbuildinfo` swept into the build context is WORSE than none** — it describes
another machine's paths. Build-only state belongs in a **BuildKit cache mount**,
which is not part of the image.

⚠️ **Re-test the gate after introducing caching** — *a run that reused everything
looks exactly like one that checked everything.* Same discipline a compiler upgrade
needs.

### ✅ Topic 08 — `skipLibCheck` (one file)

🔴🔴 **THE FIND — the skip predicate, read from `typescript.js` ~22820:**

```js
return options.skipLibCheck && sourceFile.isDeclarationFile
  || options.skipDefaultLibCheck && sourceFile.hasNoDefaultLib
  || !ignoreNoCheck && options.noCheck
  || host.isSourceOfProjectReferenceRedirect(sourceFile.fileName)
  || !canIncludeBindAndCheckDiagnostics(sourceFile, options);
```

1. 🔴 **`skipLibCheck` is gated on NOTHING BUT `isDeclarationFile`** — no path check,
   no `node_modules` special case — **so it skips your own declaration files too.**
   That is what the description's *"Skip type checking **all** `.d.ts` files"* means,
   stated as code.
2. 🔴 **It is one branch of an OR chain with four other skip reasons, including
   `isSourceOfProjectReferenceRedirect`** — **so project references skip through the
   SAME predicate**, and the two are entries in one list rather than independent
   levers whose savings stack. `noCheck` is in the chain too, making *"skip
   checking"* a **family**.

🔴 **`skipDefaultLibCheck` is the narrow one** — *"Skip type checking `.d.ts` files
that are included with TypeScript."* (both descriptions verbatim from the table).

🔴 **What it saves is a property of your DEPENDENCIES, not your code** — `node_modules`
declarations are frequently larger than the source tree, so a **small app with heavy
typed deps saves a lot** and a **large app with few saves little**. ⚠️ **A figure
from another project predicts nothing.** It is one boolean, so it is among the
easiest levers to measure honestly.

🔴 **It is ALREADY ON: the `tsc --init` defaults object has exactly four settings** —
`strict`, `esModuleInterop`, `forceConsistentCasingInFileNames`, `skipLibCheck`
(read from the source). 📌 **So the live question is usually whether to turn it
OFF** — a change that needs defending, unlike leaving a default.

📌 **The boundary, as narrow as it goes: it helps when *their* `.d.ts` fails to
compile internally; it does nothing when their types are wrong *about* the API.**
⚠️ **It cannot silence an error at your call site** — the thing it is most often
proposed to fix.

### ✅ Topic 07 — editor performance (one file)

🔴 **The language server is a DIFFERENT PROCESS doing a different job** — the build
checks once and exits; the server answers **a query per keystroke** and **holds the
program for days**. Two consequences generate almost every complaint: **a cost the
build amortises to nothing is paid repeatedly** (one expensive type in the file you
are editing has a *completely different price* in the two places), and **a merely
large program becomes a permanent resident cost**. 📌 **So the editor can be slow on
a project whose build is fine** — expected, not a contradiction.

🔴 **The most commonly missed cause: a SECOND PROGRAM.** In-editor type-aware
linting builds its own, so the window holds two — **uncounted because the plugin is
configured as a linter rather than as a compiler consumer**, the same blind spot
topic 02 found in the toolchain audit. **Moving it to CI-only costs nothing in
coverage, only latency.**

📌 **Restarting the server is a DIAGNOSTIC, not a fix:** if a restart makes it fast,
the problem is **accumulated state**, not project size (a too-large project is slow
again immediately) — a bug to report with a log, and **the wrong reason to spend a
week narrowing `include` globs.**

📌 **The cheapest measurement needs no editor tooling:** run `--extendedDiagnostics`
on the same project. An enormous program answers it without touching the editor; a
small clean one means the cause is editor-only.

### ✅ Topic 06 — diagnosing a slow compile (2 chunks)

🔴 **READ THE PHASE SPLIT FIRST.** Time in **parse/program construction** = *too
many files*; time in **check** = *types too complex*. **They present identically and
have OPPOSITE fixes** — which is how these investigations get lost. ⚠️ **An
oversized program is simultaneously a COVERAGE finding**: the gate has been checking
things nobody intended.

📌 **Four flags, read from the 5.9.3 option table with verbatim descriptions (do not
re-grep):** `--diagnostics` · **`--extendedDiagnostics`** *"Output more detailed
compiler performance information after building."* · 🔴 **`--generateTrace`**
*"Generates an event trace **and a list of types**."* — **the type list is the half
that names the culprit** · 🔴 **`--generateCpuProfile`** *"Emit a v8 CPU profile of
the compiler run for debugging."* — **not in the syllabus**, and the right tool when
you suspect the compiler rather than your types.

🔴 **Chunk 02's organising move: rank slow shapes by WHICH BUDGET they consume** —
instantiation depth · instantiation count · union cross-product · comparison count —
**not by how clever they look**. `DeepPartial` is canonical because it eats two.

🔴 **Annotating is the highest-leverage change and the least fashionable**: an
annotation turns **inference into VERIFICATION**, and inference is the expensive
half. **On an exported return type it pays twice** — cheaper checking *and* cheaper
declaration emit, which is exactly what `isolatedDeclarations` codifies.

⚠️ **Silencing `TS2589` does not make a type cheap — only cheap enough to FINISH.**
The work still runs on every build. **Fixing the error and fixing the cost are
different jobs.** (And it is one message covering two limits, so the reflexive depth
cap is a coin flip.) 📌 **Barrels cost twice** — program size *and* checking surface
— which is why removing one over-delivers relative to any single explanation.

📌 **The palatable part, worth reusing in an argument: three of the four fixes are
ordinary design advice**, so the fast types are mostly the readable ones — not true
of most performance work.

### ✅ Topic 05 — typing tests (2 chunks)

⚠️ **The name collides with topic 04 and the READMEs of both now say so: 04 tests
YOUR TYPES, 05 keeps TEST CODE honestly typed.**

🔴 **A mistyped fixture makes a test pass for the WRONG REASON** — strictly worse
than a failing test, because a failing test tells you something. **And the failure
has no symptom:** `{ id: '1' } as User` stops matching `User` the moment it gains a
required field; production code fails to compile everywhere and **the fixture does
not**, so the test keeps exercising a contract that no longer exists.

🔴 **The fix is one word of design:** `(overrides: Partial<User> = {}) => User`
**concentrates the breakage into ONE compile error**, in the place that knows what a
valid value looks like — versus zero errors and an unknown number of stale tests.
⚠️ **Annotating the parameter as `User` instead of `Partial<User>` destroys the
entire value of the pattern.**

📌 **`as const satisfies` for test tables** — `satisfies` catches a typo'd key an
unannotated array accepts as a new property; `as const` keeps the case names a
**literal union** rather than `string`, which is what makes an exhaustiveness check
work. **An annotation gives the check and destroys the literals.** And
**`Partial<T>` stops being honest** the moment the code reads an omitted field — at
which point a *fixture* problem is reported as `Cannot read properties of
undefined`.

🔴 **An untyped mock does not merely fail to help — it CERTIFIES a call signature
the codebase does not have.** `toHaveBeenCalledWith` passes for a call that could
never happen, and because it *passes*, nothing surfaces it. **Derive, do not
restate** — `typeof realFn` + `Parameters`/`ReturnType`; ⚠️ `Parameters` **sees only
the last overload and drops `this`**. ⚠️ Do **not** write `Promise<ReturnType<F>>`
when the return type is already a promise (errors surface at the *call sites*, not
the mock); `Awaited<ReturnType<F>>` is the resolved type.

⚠️ **The precondition for the whole topic: if the test directory is not in the
checked program, none of it is enforced** — an unchecked directory hides the type
errors, the `as any` population that accumulates there fastest, **and** any type
tests. 📌 **Counting the test directory separately is not the same as arguing about
test assertions in review** — phase 10 topic 12 warns against the second, not the
first.

### ✅ Topic 04 — testing types (2 chunks)

🔴 **A type test's runner is `tsc`** — assertions are evaluated at *check* time and
the runtime call is inert. **So a type test outside the checked program CANNOT
FAIL**, and ⚠️ **the most common config in the world puts them there**, since tests
are exactly what gets excluded from the build `tsconfig`. **The first thing to
verify is not that the suite passes but that it is being CHECKED** — break one on
purpose.

🔴 **Only one direction is load-bearing.** Positive assertions are largely
redundant — **your application is already a type test for the types it uses**.
**Rejection** is irreplaceable: **a signature that quietly widens breaks nothing**,
every existing call still compiles, every test stays green. `@ts-expect-error`
closes it via `TS2578` — **the property that makes it awkward as a suppression is
exactly what makes it a test** — ⚠️ but it **absorbs whatever error is on the next
line**, so the written description is the only defence, doing more work here than
in a suppression.

🔴🔴 **THE FIND — `any` defeats a naive type-test suite.** `any` is assignable to
everything **and** everything is assignable to `any`, so a check implemented as
*"assignable in both directions"* concludes **`any` equals every type**. Such a
suite **passes completely when your types degrade to `any`** — the one regression
that produces no other symptom. ⚠️ **This is the concrete reason not to hand-roll a
five-line `assertAssignable` helper.** 📌 **The test for any inherited suite: assert
`any` is `string`. If it passes, the suite is decorative.**

**Also:** equal vs assignable (assignability is one-directional, so *matches* is far
weaker than it reads) · the `{ a?: string }` vs `{ a: string | undefined }` blind
spot · **do not pin computed types** — those tests break on refactors that changed
nothing and then get deleted · and **`tsd` is a different tool, not a preference**:
it runs against the **declarations consumers receive**, the same source-vs-package
gap that makes a wrong `rootDir` produce a green build.

### ✅ Topic 03 — build pipelines (3 chunks)

🔴 **"Building TypeScript" is FOUR jobs — check · transform · bundle · emit
declarations — and every tool does a different subset.** Naming them dissolves most
tooling arguments, because esbuild and `tsc` are not competing for the same job.
🔴 **One column has a single entry: ONLY `tsc` emits `.d.ts`** (bundler plugins
orchestrate the compiler, so their failure modes are *its* failure modes) — **so if
you publish types, `tsc` is in your build whatever bundler you chose.**

🔴 **Declaration emit CANNOT be fast, structurally:** writing a `.d.ts` for an
exported function needs its return type, and unannotated means *inferring*, which is
type checking. So **`emitDeclarationOnly` costs about what a check costs** — and
that is precisely what `isolatedDeclarations` exists to remove.

🔴 **Two shapes, chosen by one question — *does anything outside this directory
import from it?*** **App:** bundler builds, `tsc --noEmit` checks, neither consumes
the other's output. **Library:** 🔴 **the declaration build has ALREADY
type-checked**, so a separate `--noEmit` is usually a second payment for the same
work — conditions being that it covers the same program and that **its exit code
fails the pipeline**. ⚠️ **An internal monorepo package is a LIBRARY**; the only
thing it skips is publishing.

📌 **`noEmit` in an app is about ownership of the output directory, not speed** —
the checking is the expensive part and `noEmit` does not reduce it.

⚠️ **The `rootDir` trap, with the worst possible signature:** it is **inferred from
the common root of the inputs**, so adding one file outside `src/` **silently
re-roots the whole output tree**, moving declarations relative to the JavaScript.
**The build stays green and the package is wrong.**

🔴 **Only settings that change MEANING must agree between compiler and bundler** —
`paths`, `jsx`, `experimentalDecorators`, `useDefineForClassFields` — not the output
settings the bundler owns (*"make the configs identical"* is bad advice). **None of
the four fails loudly.** `useDefineForClassFields` earns its place because it
decides assignment vs `defineProperty` — **semantics, not syntax** — and is *implied
by `target`*. 📌 `declarationMap` is the flag libraries forget because **only
consumers notice it**.

**Two diagnostics read from the 5.9.3 table (do not re-grep):** `TS5069` *"Option
'{0}' cannot be specified without specifying option '{1}' or option '{2}'."* — ⚠️
**its placeholders carry all the information**, so read them rather than guessing —
and 🔴 **`TS6304` *"Composite projects may not disable declaration emit."***, which
reveals that **project references and declaration emit are ONE FEATURE wearing two
names**, since a composite project is consumed *through* its declarations.

### ✅ Topic 02 — the toolchain audit (3 chunks)

🔴 **THE DISTINCTION THAT SORTS A WHOLE TOOLCHAIN, and it makes the upgrade much
smaller than it sounds: tools that RUN the compiler are unaffected — the CLI is the
stable interface — and only tools that IMPORT it are exposed.** So the audit
question is **not** *"what uses TypeScript"* (nearly everything) but *"what imports
it"* (three or four packages). ⚠️ **The entry people miss is the type-aware
linter**: building a `Program` is what makes it a compiler-API consumer, so the
rules that cost a second type-check are the rules that put your linter at risk.

**The ten-minute audit:** `package.json` for a `typescript` **peer dependency**
(the strongest single signal — the package is stating it will load your copy) →
the package manager's dependents list → each candidate's stated version range.
⚠️ **Silence about TS 7 is a finding, not reassurance.** 📌 The only entry with **no
upstream to wait for** is a transformer your own team wrote — **the one whose
schedule is yours.** And **an API consumer that starts is not one that works** —
they fail on *input*, not on load.

🔴 **`unstable/` IS A VERSIONING CONTRACT, NOT A MATURITY LABEL:** the surface may
change **without a major bump**, so a caret range on it is a promise nobody made.
📌 **This is the corpus's SECOND semver exemption** — typescript-eslint's `strict`
config is the first (phase 10 topic 11 chunk 01) — which generalises to a habit
worth reusing: **check whether what you are pinning considers itself bound by semver
at all.** ⚠️ Waiting for a "stable" API is a plan with **no completion condition**.
**What is NOT unstable:** the language, the CLI and its flags, `tsconfig.json`, the
diagnostics.

🔴 **The gate can move before the tools do** — a `tsc` invocation and an API import
are different consumers. Order: **gate → dependencies as they publish → your own AST
code last**, in **separate commits**, because a version bump rolls back cleanly and
an API port does not. ⚠️ **Two compilers via aliasing works but fails *confusingly*
rather than loudly** — temporary state, owner, end date.

🔴 **The editor is a THIRD consumer and it is on nobody's list** — it runs its own
compiler, so a half-finished upgrade produces phase 0 · 09's disagreements with a
version gap as the cause, and **the first symptom is a developer insisting CI is
wrong.** 📌 **Re-test the gate after a compiler swap** (compare error *and* file
counts on the same commit; break something deliberately) — a green run over a
*smaller* program looks exactly like a green run. 📌 **New errors after an upgrade
are usually findings, not regressions.**

### ✅ Topic 01 chunks 04 + 05 — `28215564`, `e12679d7`

**04 · Making it fast enough to be required (183).** 🔴 **Speed is a CORRECTNESS
concern: a gate that takes too long does not stay a gate** — it gets moved off the
PR, made advisory, scoped, or skipped, and each is a decision to check less taken
for reasons unrelated to types. Levers split into **free** (`incremental` **with a
cached** `.tsbuildinfo`, project references + `tsc -b`, excluding build output, the
native compiler, more memory) and **costs coverage** (`skipLibCheck`, a narrower
`include`, changed-projects-only, nightly). ⚠️ **Every "make it faster by checking
less" change is a coverage change**, and they arrive in a PR titled *speed up CI*
where **excluding `dist/` and excluding `src/legacy/` look identical in the diff**.

🔴 **`incremental: true` is the most commonly configured performance setting that
does nothing in the environment it was configured for** — CI starts from a clean
checkout, so there is no `.tsbuildinfo` to reuse.

🔴 **Diagnose before optimising, and phase 5 topic 09 says where to look:** the
expensive work is **per-expression** (`instantiationCount` resets per expression,
per source element, per deferred node), and the comparison budget **shrinks as the
relation cache fills** — which is why a slow build arrives *gradually* with no
commit responsible. **Find the expression, not the setting.**

**05 · When the gate fails (197).** 🔴🔴 **ADVISORY IS NOT A HALFWAY HOUSE, IT IS
THE FAILURE MODE.** A non-blocking red is indistinguishable from a green after ~2
weeks — and it **has no failure indicator**, because the check still runs and still
produces output, so nothing announces that it stopped being a control. **The two
approaches that work share one property: the check can fail something on day one.**
Either **block against a baseline** (a ratchet — ⚠️ **one regenerated on every run
is a record of defeat**, and one keyed on file+line **rots on the first refactor**;
a count per directory survives) or **run at full strength over the clean part**,
which is the honest version of chunk 04's narrow-the-`include` lever.

🔴 **The topic's closing synthesis — five ways a pipeline ends up green with types
unenforced:** absent (a transpiler builds) · empty (the program excludes the
interesting files) · misplaced (a skippable hook, or nothing checks the merged
result) · narrowed (for CI speed) · advisory. **Which is why *"do you type-check in
CI?"* is a much weaker question than *"show me the step, and tell me what it
covers."***

### ✅ Topic 01 chunk 03 · where the gate goes (205)

🔴 **THE CHUNK'S OWN CONTRIBUTION — the merge-queue case, which teams skip and then
need.** PR #1 renames `User.name` → `User.fullName`; PR #2 adds `user.name` in a
**new file**. Both green, **no textual conflict**, `main` breaks — and **neither
branch was ever wrong**, because each PR check validated a base commit that no
longer exists. 🔴 **A type error is the classic SEMANTIC merge conflict**, exactly
the class textual merging cannot see. **Symptom: `main` breaks a few times a week
with no individual PR at fault — and it gets diagnosed as CI flakiness.** Fix:
require up-to-date branches (simple, gets disabled on busy repos because it forces
serial merges) or a merge queue (what busy repos end up needing).

🔴 **Pre-commit is the WRONG place, mechanically:** a whole-program check **cannot
be scoped to the staged files** (same limitation as type-aware lint, same reason —
the program must be built first), it runs on every WIP commit, and **`--no-verify`
makes it optional for exactly the person it checks**. Fast checks in the hook,
whole-program check in CI. 📌 *The hook stops noise entering review; the gate stops
errors entering the branch.*

**Also settled:** type-check **before** the tests, because a type error makes test
failures **uninterpretable** — one cause wearing many costumes · the gate blocks the
**merge, not the deploy**, so a deploy pipeline that re-checks does the work twice at
the worst moment (⚠️ honest exception: a release from a long-lived branch the gate
never saw) · and it must be **one package script** both CI and developers run, since
a gate living only in YAML cannot be reproduced and its flags are invisible.

✅ **The two-type-check arithmetic was LINKED, not restated** — phase 10 topic 11
chunk 10 owns it. Keep doing this; it is why phase 12 has a no-repeat table.

### ✅ Topic 01 chunk 02 · what the gate guarantees (214)

🔴 **The claim a green run makes, exactly: *every file in the program is internally
consistent under this configuration* — and a green run is compatible with AN ENTIRE
DIRECTORY NEVER HAVING BEEN LOOKED AT.** The four things it does not claim:
correctness, that runtime data matches, that files outside the program are fine,
that another config would pass.

🔴 **THE TRAP WORTH THE PAGE: `exclude` is NOT a firewall.** It filters what
`include` **finds**; a file excluded by glob is **still compiled if anything
reachable imports it**. So `exclude` is unreliable for reasoning about coverage in
*either* direction.

🔴 **The multi-config hole:** `tsc --noEmit` runs **one** configuration, so pointed
at a root config that only *references* other projects it can check almost nothing
while exiting zero. **A suspiciously fast gate is the tell** — `tsc -b` walks the
references.

🔴 **Four introspection flags, read from the 5.9.3 option table with their own
descriptions quoted verbatim** (do not re-grep):

| Flag | Its own description |
|---|---|
| **`--explainFiles`** | *"Print names of files and the reason they are part of the compilation."* — 🔴 **the REASON is the answer you need**: it separates `include` from *imported by* from `types`, which is exactly the `exclude` distinction |
| `--listFiles` | *"Print all of the files read during the compilation."* |
| `--listFilesOnly` | list and stop |
| **`--showConfig`** | *"Print the final configuration instead of building."* — ends any argument about what an `extends` chain resolved to |

🔴 **And the step that gets skipped: break something on purpose and confirm CI goes
red.** An untested gate is indistinguishable from one that runs nothing — a wrong
path, a config resolving to zero files, an exit code lost through a shell pipe, a
`|| true` added during an incident. **Re-test whenever the config layout moves**,
because splitting or referencing configs shrinks the program silently.

**Unchecked regions the page names:** root `*.config.ts` and `scripts/` (⚠️
disproportionately the files doing untyped work) · tests excluded to keep the build
config clean (⚠️ which also hides their `as any` population) · `.js` without
`allowJs` **and** `checkJs` · files reachable only by dynamic import.

**The worklist for the phase is its syllabus table** in
`docs/typescript/syllabus/04-rigour-and-tooling.md`, in row order — 1 Master,
8 Understand, 4 Know, 2 When Needed.

### ✅ Phase 12 topic 01 chunk 01 · the green build that proves nothing (184)

🔴 **The load-bearing argument, and it is not a tooling preference: a transpiler
CANNOT type-check, and not because the feature is missing.** It processes one file
at a time; checking needs the whole program, because `save`'s declaration is in
another file importing from a third, possibly from a `.d.ts` in `node_modules`.
**The speed and the blindness are the same design decision** — so replacing `tsc`
with a faster tool is not the same check faster, it is *a different and smaller
job*. 📌 **`isolatedModules` is TypeScript agreeing to the transpiler's terms: it
makes the fast tool SAFE, not THOROUGH** — and reading it as a substitute for
checking is the expensive mistake.

**The page's spine is a seven-step sequence in which every tool works correctly and
nothing type-checks** — Prettier formats, ESLint reads one file's AST, esbuild
strips the types without reading them, the tests run against a build that never
checked anything, it deploys, `TypeError` in production.

🔴 **The two steps teams most often believe cover them, and do not:** a test suite
transpiled by esbuild/swc **will happily run files containing type errors**, so *"the
tests pass"* is not evidence about types; and the editor checks a **different
program** and **cannot fail a pull request**.

⚠️ **Boundary check was run first, again** — phase 0 owns the mechanism
(`10-checking-vs-transpiling`, `09-language-server-vs-build`,
`04-strip-only-and-erasable-syntax`, `07-typescript-7-native-compiler`), and
**phase 12's own topic 03 owns the tool-by-tool comparison**. Topic 01 owns only
*the gate must exist*. The phase README carries the no-repeat table.

🔴 **Phase 12 arrives owed a lot — collect, do not re-derive.** Its `skipLibCheck`
*performance* framing is promised by phase 6 topic 10 (lane D) and by phase 7;
**type-aware lint's CI cost is already fully argued in phase 10 topic 11 chunk 10**
(the two-type-checks arithmetic, why changed-files filtering does not help, flags
before rules) — **link it, do not restate it**; and **phase 5 topic 09 hands phase
12 the attribution tooling** for type-checking performance, with 5.9.3's checker
constants (`instantiationDepth === 100`, `instantiationCount >= 5e6`,
`relationCount = (16e6 − relation.size) >> 3`) already measured and **explicitly
not claimed for the 7.0.2 Go port**.

### ✅ Topic 13 · Designing APIs `unknown`-first — Know, 223 lines, one file

**It is the answer to topic 12**, which is why it closes the phase well. 🔴 **A
parameter type is a promise the compiler cannot keep at a boundary** — inside the
program `body: RegisterRequest` is enforced on every caller; at the edge the value's
type came from an assertion upstream, so **the annotation documents an assumption
rather than checking one**. The move: **take `unknown`, return the type**, making
the type an **output of validation rather than an asserted input** — and *a type
produced by validation cannot be wrong in the way an asserted one can.*

🔴 **The mistake it is confused with, worth keeping: `f<T>(x: T)` checks NOTHING.**
An unconstrained generic is inferred **from the argument**, so it accepts anything
and carries the caller's type through. **It is more misleading than `unknown`
because it looks typed.** Rule: **a generic PROPAGATES a type the caller already
has; `unknown` ESTABLISHES one.**

**Four shapes costed:** parse (failure exceptional) · **the result union** (failure
*expected* — forces the caller to handle both branches **structurally rather than by
remembering**) · predicate · assertion signature. ⚠️ The last two **relocate trust
rather than removing it** — the compiler does not check a predicate's body against
its claim — though **5.5's inferred predicates cannot disagree with their own body**.

📌 **The discipline is a RING, not a house style:** `unknown` at the boundary, real
types inside. 🔴 **Validating the same value twice in one request is a design smell,
not extra safety** — it means the boundary is in the wrong place.

⚠️ **The duplication check was run first this time** (topic 12's lesson applied):
phase 1 · 06 owns the `any`/`unknown`/`never`/`void` vocabulary, phase 2 · 12 owns
narrowing a caught `unknown`, phase 7 · 04 owns the applied server case. **Topic 13
owns only the signature-design argument**, and says so in its Verified line.

### ✅ TOPIC 12 — Assertion discipline, complete

**5 chunks + README = 6 files, 1,172 lines, spread 194–255, 0 over the cap.**
Commits `f28b1534` (01 + README), `2ceab2d4` (02), `8e5d8114` (03), `65148273`
(04), `792ec87a` (05 + all four boards).

### ✅ Chunks 04 + 05 — commits `65148273`, `792ec87a`

**04 · `as any` is an exit (194).** 🔴 **`as any` is not the top of the assertion
scale, it is a different operation.** `as T` makes a specific, falsifiable claim you
can argue about; `as any` makes **no claim at all**. **An assertion that cannot be
wrong is not safer — it is the absence of a type**, and everything derived from it
is `any` too.

🔴🔴 **THE INVERSION WORTH KEEPING — a bare `as any` is the LOUD spelling:**

| Spelling | Compiler | The `any`-tracking rules |
|---|---|---|
| `x as any` | accepts | ✅ **report it** — the expression *is* `any` |
| `x as unknown as T` | accepts (its own `TS2352` suggestion) | ⚪ silent — result is `T` |
| 🔴 `x as any as T` | accepts | ⚪ **silent — result is `T`** |

**So banning `as any` alone converts it into the two spellings the tooling cannot
see.** Topic 08's escalation pattern, arriving with a mechanism. 📌 **Review
heuristic: a bare `as any` is someone taking a shortcut in the open; a double
assertion is someone who has already been told no. Grep for the double first.**
📌 And the `unknown` line stated precisely: **`unknown` and `any` say the same thing
about what you know and opposite things about your obligations.**

**05 · A policy that works (211).** The five tiers to count (`as T` · `!` ·
`as any` · 🔴 **the doubles, the only tier with no tool behind it** · the
suppression comments), 🔴 **`as const` excluded** from the count and from the
written rule, and the metric the phase has been building toward since topic 07:
🔴 **assertions added per error fixed, measured when a strictness flag is enabled —
not the raw count**, because the raw count is a property of the codebase's age and
its dependencies while the ratio is a property of how the migration was done. **A
ratio near 1.0 means the flag bought nothing.** And **the ratchet, not the
cleanup** — assertions never self-clean, so the population only grows unless
something watches; a one-off cleanup is undone within a quarter.

⚠️ **Commit-message slip, for the record:** `65148273` says chunk 04 is 215 lines;
it is **194**. The file and the boards are right; only that message is wrong.

### ✅ Chunk 03 · `!`, the one-character claim — commit `8e5d8114`

**219 lines.** The consequence of chunk 01's measurement.

🔴 **The sharpest reason `!` goes uncounted: it CANNOT BE GREPPED FOR.** `!` is also
logical negation, `!=`, `!==` and `!!`, so no regular expression finds non-null
assertions and nothing else. **Every "count the assertions" script greps for ` as `
and is blind to the larger population.** A type-aware lint rule is the only way to
get the number. (The other five reasons: one character · invisible to an `as` audit
· hides inside `a!.b.c!.d` · arrives by editor quick-fix on `TS18048` · never
expires.)

🔴 **The two shapes that contain their own refutation** — worth more than an
ordinary report because they need no judgement:
`user?.profile!.email` (*"might be absent"* then *"definitely present"* —
`no-non-null-asserted-optional-chain`) and `x! ?? fallback` (*"definitely present"*
then a default for its absence — `no-non-null-asserted-nullish-coalescing`). Plus
`a!!` (`no-extra-non-null-assertion`).

🔴 **`TS1255` / `TS1263` / `TS1264` are every rule the compiler enforces around
`!:`, and ALL THREE ARE ABOUT FORM** — where it may appear, that it cannot have an
initialiser, that it must have a type annotation. **The compiler is meticulous about
the syntax of the claim and silent on whether the claim holds.** That asymmetry is
the whole topic in three diagnostics. 📌 `TS1264`'s practical edge: a `!:`
declaration **cannot be inferred**, so it always costs an explicit type — the only
pressure the language applies.

🔴 **Completes a claim topic 08 left open.** Topic 08 said assertions have no
`TS2578` equivalent. Precisely: they have no **compiler** equivalent —
**`no-unnecessary-type-assertion` fills it from the lint side** for an `as` *or* a
`!` that does not change the type. ⚠️ It still cannot report an assertion that is
merely **wrong**; nothing can.

📌 **`arr.find(…)!` is named as the single `!` most likely to become false** — it is
usually true when written because the author knows the value is in the list, but
that is a fact about **data**, not types.

### 🔴🔴 TRAP CAUGHT ON ARRIVAL — phase 2 ALREADY OWNS THE MECHANICS

⚠️ **This nearly became a duplicate topic.** `docs/typescript/pages/phase-2-narrowing/`
has **four** assertion topics, all written and deep:

| Phase 2 topic | Already covers |
|---|---|
| `08-as-assertions/` | what an assertion is · the angle-bracket form · **`as unknown as T`** · **`as const` is a different feature** · the excess-property escape · **the legitimate uses** |
| `09-assertion-functions/` | the two forms · the explicit-annotation requirement · **"the compiler does not check the body"** |
| `10-satisfies/` | `satisfies` in full · `as const satisfies` · the `isolatedDeclarations` interaction |
| `13-non-null-assertion.md` | `!` · **the other `!`, definite assignment** · the honest alternatives · where it silently does nothing |

🔴 **The boundary now written into topic 12's README as a "what this topic
deliberately does not repeat" table: PHASE 2 OWNS THE MECHANISM, PHASE 10 OWNS THE
DISCIPLINE.** The rule stated on the page: *if a chunk here starts explaining how an
assertion works, it is in the wrong phase.* The question topic 12 answers is **what
is this particular `as` standing in for, and what would have to be true for it to be
deleted.**

📌 **Check the other phases before writing the remaining chunks** — chunk 03 must
link `13-non-null-assertion.md` and phase 4's `08-readonly-and-definite-assignment.md`
rather than re-derive `!:`, and chunk 04 must not re-teach `any` (topic 03 owns it).

### ✅ Chunk 02 · the six substitutions — commit `2ceab2d4`

**255 lines.** The taxonomy phase 2 does *not* do. Every `as` stands in for one of
six things, each with a different fix: an automatic guard (discriminate the union) ·
🔴 **boundary validation — the only one that is a claim about the outside world, and
the one that fails in production rather than CI** · a type predicate · a better
upstream signature (**the third occurrence is the signal to fix the function, not
the call**) · `satisfies` (pure loss, one keyword to fix) · and **`as const`, which
is not this family at all**.

🔴 **The find worth reusing: TypeScript 5.5's inferred type predicates are the ONE
place in the language where a claim previously taken on trust became one the
compiler works out itself.** An unannotated simple guard gets `v is T` **inferred**
— so this is an argument for **removing** explicit `v is T` annotations from simple
guards: an inferred predicate cannot disagree with its own body, a written one can.

🔴 **And the policy consequence: `as const` must be EXCLUDED from any assertion
metric.** It requests *more* precise inference rather than asserting something
doubtful, and `TS1355` restricts it to literals so it cannot be aimed at anything it
could be wrong about. **A metric that greps for `as ` penalises the safest construct
in the language.**

📌 **The review question the whole topic turns on:** *what would have to be true for
this assertion to be deleted?* — "nothing" means it is a design decision written in
the wrong place, which is deliberately **the same verdict topic 08 reaches about a
permanent `@ts-ignore`**.

🔴🔴 **THE FIND THIS TOPIC IS BUILT ON — disk-measured, do not re-derive.**
Grepping 5.9.3's message table for non-null assertions returns **exactly one
code**, and it is not a check:

> `TS8013` · *"Non-null assertions can only be used in TypeScript files."*

**A statement about file extensions.** Its neighbours are `TS8016` (type
assertions) and `TS8037` (satisfies expressions) — same shape. **So there is no
diagnostic anywhere that questions whether a `!` is justified**, and there cannot
be: `!` means *stop applying strict null checking here*. That gives the three-way
ranking the topic rests on:

| Form | Compiler's stance | Diagnostic |
|---|---|---|
| `x satisfies T` | **verifies** it, and does **not** widen | `TS1360` *"Type '{0}' does not satisfy the expected type '{1}'."* |
| `x as T` | **accepts** unless the types barely overlap | `TS2352` |
| `x!` | 🔴 **never questioned** | **none** |

⚠️ **The ordering is the reverse of the effort to type them** — `!` is one
character and has no oversight; `satisfies` is a word and has the most. That is why
assertion discipline must be a *policy*, not a preference, and why `!` is the count
teams underestimate.

**Two more things `TS2352`'s verbatim text settles** (message already banked in the
topic-10 finds below):
1. 🔴 Its floor is **"sufficient overlap", not correctness** — so an accepted `as`
   means *the compiler declined to argue*, and **most wrong assertions are between
   related types, which is exactly the region it does not police.**
2. 🔴 **The message quotes its own escape hatch** (*"convert the expression to
   'unknown' first"*), so **`x as unknown as T` in a diff means someone was told
   the types are unrelated and proceeded anyway** — the single most informative
   pattern to grep for.

📌 **Also banked: `TS9035`'s quick-fix text recommends the composite** — *"Add
satisfies and a type assertion to this expression (satisfies T as T) to make the
type explicit."* So `x satisfies T as T` is a **checked claim followed by a
deliberate widening**, and it is compiler-sanctioned.

📌 **Diagnostics gathered for the later chunks, already read — do not re-grep:**
`TS1255` (a definite assignment assertion is not permitted in this context) ·
`TS1263` (declarations with initializers cannot also have definite assignment
assertions) · 🔴 `TS1264` (**declarations with definite assignment assertions must
also have type annotations** — so `!:` cannot be inferred) · `TS1355` (`as const`
is restricted to enum members and literals) · `TS17007` (a type assertion is not
allowed on the left of `**`) · `TS8013`/`TS8016`/`TS8037` (the TS-files-only trio) ·
`TS90068`/`TS90070`/`TS95020`/`TS95028` (quick-fix **menu labels**, not
diagnostics — per topic 10's find that 90xxx/95xxx are labels).

**Material three chunks already owe this topic — collect, do not re-derive:**
`no-unsafe-type-assertion` is named-but-not-explained in topic 11 chunk 09; topic
11 chunk 08's gotcha calls silencing a `no-unsafe-*` report with `as` **the worst
available outcome** (it converts a *detected* unknown into an *undetected* wrong
assumption); topic 07 established `as` as one of the three holes you **write**,
which is why the phase's metric is **assertions per error fixed**; topic 09 has `as`
as the most misleading of the seven ways freshness is lost; and topic 08 places
`as`/`!` at **tier 2** of the ladder — ⚠️ **with no self-cleaning property, since
there is no `TS2578` equivalent for an assertion that became unnecessary.**

**After 12: topic 13 (Know), which CLOSES phase 10.** Then phase 12, 15 topics,
directory does not exist — slug **must** be `phase-12-tooling`.

### ✅ Chunk 10 · Adoption and the CI cost — closes the topic

- 🔴 **The two type-checks CANNOT be merged.** ESLint and `tsc` build separate
  programs and neither can consume the other's work, so the levers are only
  **scope** and **parallelism** — parallel jobs recover wall-clock but not
  machine-time. ⛔ **Dropping `tsc --noEmit` is not a lever**: a type-aware lint run
  *builds* the program, so a type error surfaces as a lint crash or a cascade of
  `no-unsafe-*` reports rather than as a diagnostic on the right line.
- 🔴 **THE PRACTICAL FIND: "lint only the changed files" does not work here.** The
  documented penalty is a build of the **project**, not of the file, because a
  type-aware rule must resolve types that live elsewhere. A changed-files filter
  saves the *lint* pass (the cheap half) and pays the *build* in full. **ESLint's
  `--cache` has the same limitation** — it can skip re-linting a file, not the
  program build.
- 🔴 **The ordering principle the whole topic converges on: FLAGS BEFORE RULES.**
  Every compiler flag enabled first *reduces* the lint work — `strictNullChecks`
  makes `no-unnecessary-condition` functional at all, `noUncheckedIndexedAccess`
  removes its largest false-positive class, typed boundaries collapse the
  `no-unsafe-*` counts. **A team that turns the rules on first meets the worst
  version of each and disables what was about to be most valuable.** Flags are also
  cheaper: configuration, not a diff.
- **Full order:** `strict` → `noUncheckedIndexedAccess` → `recommended-type-checked`
  → chunk 09's quiet five → `no-unnecessary-condition` → `strict-boolean-expressions`
  in its three passes. One step per commit; never a flag and a rule together.
- ⚠️ **No multiplier was invented** — the docs give none beyond parity with build
  times, and the page says so explicitly.

### ✅ Boards at the close — all four, verified not assumed

| Surface | State |
|---|---|
| `src/data/progress.js` | phase-10 `pages: 11, pagesPlanned: 13` — still reads **writing** |
| `phase-10-strictness/README.md` | topic 11 row linked, 🚧 chunk count **removed** |
| `docs/typescript/pages/README.md` | phase row **11 / 13**; lane B claim → session `c01e37bb`, left **17** |
| `docs/README.md` | technology row **recomputed** (105/136, 319 files, phase 6 at 8/16) and **merged forward onto another lane's edit**; Part B row rewritten |

| Check | Result |
|---|---|
| `.md` links in `docs/typescript` | **2,488 links, 3 broken — 0 in Part B scope** (all in `phase-6-modules-build`, lanes C/D mid-write) |
| 300-line cap, whole phase 10 | **0 files over** |
| `_category_.json` | parses |
| `progress.js` | loads as a module |
| frontmatter | all 11 files carry `title` + `sidebar_position` |

⚠️ **Not built** — rule 12, the registry was not claimed. Link-checked against the
filesystem, which is what every Part B close has used.

⚠️ **The shared technology row moved under me again**, exactly as this file warns:
it read 104/316 with phase 6 at 7/16 when I came to edit it. **Recomputed from
`progress.js` and `find` and merged forward** rather than incremented. Keep doing
that — it is the third session in a row to catch a drift there.

### 🔴 The chunk plan changed THREE times — 7 → 8 → 9 → 10

The previous cursor called the 7-chunk layout **"final"**. It was not, three times
over, and every time the cause was rule 1 and rule 13 working correctly.

| Chunk | Lines | State |
|---|---|---|
| 05 · `strict-boolean-expressions` — the rule and the option matrix | 293 | ✅ |
| 06 · The conditions you get wrong — six worked bugs | 248 | ✅ |
| 07 · Fixing them without breaking them — the migration | 211 | ✅ |
| 08 · The rules that track `any` — five rules, one flow | 202 | ✅ |
| 09 · The five that only share a prefix | 208 | ✅ |
| 10 · Adoption and the CI cost | — | 🎯 **next, and it closes the topic** |

**Two syllabus items each became several chunks.** `strict-boolean-expressions`
became three; the `no-unsafe-*` rules became two once the count turned out to be
ten rather than nine and the ten split into two unrelated groups.

🔴 **The measurement worth keeping: 06's draft came to 329 lines and was SPLIT, not
trimmed — and the two halves then came to 248 + 211 = 459.** The split *added* 130
lines of real content (the `Number.isFinite` vs global `isFinite` trap, the
codemod/green-suite gotcha, the two-rules-conflict gotcha, four extra interview
questions). **Trimming 329 down to 300 would have cost the most useful material on
the page.** That is the standing evidence for the rule and it is worth quoting the
next time the cap is mistaken for a budget.

📌 **A "final" chunk list in a resume point is the same defect as a file-count
prediction** — this file already carries that lesson at the top for
`05-exactoptionalpropertytypes`, and it recurred one topic later in a different
disguise. **Write the list as provisional or do not write it.**

⚠️ **A renumber touches four places**, all done each time: the plain-text "chunk NN"
references in `01-what-type-aware-means.md`, the topic `README.md` (chunk table +
`:::info` notice + the "Chunk NN owes/pays" lines), the previous chunk's footer
link, and the two boards' "🚧 N of M chunks".

📌 **A "final" chunk list in a resume point is the same defect as a file-count
prediction** — this file already carries that lesson at the top for
`05-exactoptionalpropertytypes`, and it recurred one topic later in a different
disguise. **The chunk count is an output of the material. Write the list as
provisional or do not write it.** The renumber cost four sed edits; trimming to
fit the list would have cost the JSX-renders-zero bug and the `||` vs `??`
argument.

⚠️ **When you renumber, four places need it** (all done for this one):
`01-what-type-aware-means.md` ×3 plain-text "chunk 07" references, the topic
`README.md` chunk table + the `:::info` mid-write notice + two "Chunk 06 owes"
lines, the previous chunk's footer link, and the two boards' "🚧 N of M chunks".

### ✅ Chunk 05 · `strict-boolean-expressions` — 293 lines, commit `bd78ca63`

🔴 **The organising claim, and it is the page's whole value: truthiness is safe
exactly when the non-nullish part of the type contains none of `ToBoolean`'s falsy
values** — `false`, `0`, `-0`, `NaN`, `0n`, `""`, `null`, `undefined`. That single
test **explains the entire option matrix**, which otherwise looks arbitrary:

| Option | Default | Why |
|---|---|---|
| `allowNullableObject` | 🔴 **`true`** | objects have **no** falsy members, so `if (user)` is *exactly* `user != null`. Forbidding it would be pure noise |
| `allowNullableBoolean` / `Enum` / `Number` / `String` | `false` | each of those types **does** have a falsy member, so the test is ambiguous |
| **`allowNumber`** / **`allowString`** | 🔴 **`true`** | **carve-outs made AGAINST the principle**, for ergonomics |
| `allowAny` | `false` | nothing is known — links to topic 03 |

🔴 **THE FIND: the defaults draw the line at NULLABILITY, not at falsiness.** With
the default config, `if (maybeName)` on `string | undefined` is reported and
`if (name)` on `string` is **allowed** — so **every famous bug this rule is
associated with (the empty username, the zero-valued config, the `0` rendered in
JSX) sits in the permitted half.** You only buy that protection by explicitly
writing `allowString: false, allowNumber: false`. **The default configuration is
not the strict configuration**, and that is the most common misunderstanding of
the rule.

**Also settled on the page:**
- **Compiler overlap: zero.** Same category as `no-floating-promises`. No flag
  anywhere makes `if (str)` an error, because it is not an error — it is legal
  coercion. `TS2872`/`TS2873` are about expression *kind*, so they never touch it.
- 🔴 **The two rules are complements, and stating it kills the "do we need both?"
  argument**: `no-unnecessary-condition` = *the check does nothing*;
  `strict-boolean-expressions` = *the check does something, but maybe not what you
  meant*. The fixes point in **opposite directions** (delete it / make it explicit).
- **`document.all`** is the one falsy object, `[[IsHTMLDDA]]` from Annex B — kept
  as an honest qualification of "objects are never falsy".
- **Interaction to predict:** `noUncheckedIndexedAccess` retypes `arr[i]` as
  `T | undefined`, so it **raises this rule's report count**. Sequence the two
  changes or you cannot attribute the reports.
- **`if (arr.length)`** is the clearest stylistic-alone / valuable-as-policy case.

### ✅ Chunks 08 + 09 · the `no-unsafe-*` rules — commit `f7013a4a`

🔴🔴 **THE FIND, and it corrects the syllabus and this file's own table: there are
TEN `no-unsafe-*` rules, not nine, and THE PREFIX IS NOT A FAMILY.** They are two
unrelated groups sharing a naming convention:

| Group | Rules | Shared property |
|---|---|---|
| **chunk 08 — five** | `no-unsafe-assignment` · `-argument` · `-call` · `-member-access` · `-return` | they track **`any`**, and only work as a set |
| **chunk 09 — five** | `no-unsafe-enum-comparison` · `-declaration-merging` · `-function-type` · `-unary-minus` · `-type-assertion` | **nothing** — five independent checks |

⚠️ **This matters practically:** teams enable or disable "the `no-unsafe` rules" as
a block. The first five are noisy *because they measure inherited `any`*; the
second five are quiet and mostly true positives. **Disabling them together throws
away the cheap half to silence the expensive half.**

**Chunk 08 (202) — five rules, one flow.** The five are the five places an `any`
can cross a boundary: it **enters** (assignment) → you **read** from it
(member-access) → you **call** it → it **moves on** (argument) → it **escapes**
(return). 🔴 **Disabling any one relocates the leak rather than removing it** — the
report just reappears later, in someone else's file, with no trace of the origin.
The assignment rule is the one to keep because it fires where the fix is cheapest.

🔴 **Topic 03's debt paid, with the mechanism:** the compiler has **no** diagnostic
for "this expression is `any`" and **cannot** have one, because using an `any` is
the type's documented meaning. `noImplicitAny` fires only where an `any` is
*created without being asked for*. 📌 **The exception proves it — TypeScript closed
exactly one `any` source (`catch` → `unknown`, `useUnknownInCatchVariables`, 4.4)
and needed a DEDICATED FLAG to do it**, which is the evidence there was no general
mechanism to extend. Also: `any` is contagious, so **the count of affected lines is
unrelated to the count of `any`s** — which is why counting `any`s is a bad metric
and a per-boundary rule is a good one.

**Chunk 09 (208) — two diagnostics read from the 5.9.3 table, not recalled:**

1. 🔴 **`TS2395`** *"Individual declarations in merged declaration '{0}' must be all
   exported or all local."* — grepping the message table for merged declarations
   returns **exactly this one code, and it is about export consistency.** So the
   class↔interface merge that adds a member nothing implements — type-checks,
   throws at runtime — has **no compiler check at all.** That is why
   `no-unsafe-declaration-merging` exists, and it puts that rule in
   [[devbible-typescript-concepts-phase10]]'s topic-07 unsoundness category rather
   than with the other lint rules.
2. 🔴 **`TS2356`** *"An arithmetic operand must be of type `'any'`, `'number'`,
   `'bigint'` or an enum type."* — **`'any'` is FIRST in the compiler's own list of
   what it accepts.** So `-someString` is an error and `-someAny` is silently
   permitted and yields `NaN`. `no-unsafe-unary-minus` closes exactly the gap the
   diagnostic advertises. 📌 **Generalise it: a diagnostic that lists `any` among
   its accepted types is describing a hole** — worth grepping for elsewhere.

**Also settled:** `no-unsafe-enum-comparison` is really about **a duplicated
fact** (the numbering lives in the declaration; a bare literal copies it somewhere
nothing keeps in sync); `Function` accepts any function and its call returns `any`,
with `(...args: never[]) => unknown` as the bound and `(...args: any[]) => unknown`
as the callable signature — the same contravariance decision phase 5 topic 10 and
phase 4's mixins both made. ⚠️ `no-unsafe-type-assertion` is **named for inventory
completeness only** and left to topic 12.

⚠️ **Preset placement was NOT asserted for the second five** — the banked doc table
only covers `recommended-type-checked` for the `any` group, so the pages argue what
each rule catches instead of claiming a preset. Keep that discipline.

### ✅ Chunks 06 + 07 · the bugs and the migration — commit `7ba77b74`

**06 · The conditions you get wrong (248).** Six bugs: the empty-string username ·
the zero-valued option (`opts.attempts || 3` gives 3 to the caller who asked for
0) · `NaN` · the numeric enum's **first** member · 🔴 `{count && <Badge/>}`
rendering a literal `0` · the optional boolean's third state.

🔴 **The organising claim, and it is what lifts the page above a list: four of the
six land on the MOST-TRAVELLED path** — the default enum member, the empty list,
the blank optional field, zero as a legitimate setting. They are not rare inputs,
they are the ordinary ones, and every one reads as idiomatic in review. That is
the answer to *"these are beginner mistakes"*.

**07 · Fixing them without breaking them (211).** 🔴 **Four of the eight fixes
change runtime behaviour**, and one makes things **worse**: `n !== 0` is `true`
for `NaN`, so the mechanical rewrite *admits* the parse failure that truthiness
happened to reject. **The only case in the language where the explicit spelling is
less safe than the truthiness it replaced.** Also banked:

- 📌 **`-0` is NOT a second case** — falsy, but `-0 !== 0` is `false`, so it
  behaves identically under both spellings. `NaN` is the sole divergence.
- ⚠️ **`Number.isFinite`, never the global `isFinite`** — the global coerces, so
  `isFinite('42')` is `true` and accepts the string you were detecting.
- 🔴 **Why no fixer can do this:** `if (str)` may mean "not empty" or "was
  supplied", which are *different programs* for `''`. The information was never
  written down — **the rule asks you to record a decision, not change a spelling.**
- 🔴 **A green test suite proves little here** — these bugs live on inputs suites
  lack (the empty string, the zero, the failed parse, the first enum member), which
  is why a linter found them and a test did not.
- **Rollout: defaults → `allowNumber: false` → `allowString: false`**, never in the
  same commit as `noUncheckedIndexedAccess` or nothing can be attributed. `??` via
  `prefer-nullish-coalescing` as its own pass.
- ⚠️ **Fixer metadata was deliberately NOT claimed** — typescript-eslint is not
  installed, so the page argues what a fixer *could* know rather than asserting
  what this one does. Keep that discipline for chunks 08 and 09.

🔴🔴 **SESSION STOPPED CLEANLY HERE 2026-08-17** on the user's word (*"We are
reached 95% above please save session progress and enough"* / *"Please make sure
stop cleanly without the bugs or failures"*). **The tree is green — verified, not
assumed:**

| Check | Result |
|---|---|
| `.md` links in `docs/typescript` | **2,238 links, 0 broken**, 0 in Part B scope |
| 300-line cap in `phase-10-strictness` | **0 files over** |
| both `_category_.json` files | parse as valid JSON |
| `progress.js` | loads as a module; phase-10 at `pages: 10, pagesPlanned: 13` so it still reads **writing**, not complete |

⚠️ **Not built** — rule 12, the registry was not claimed. Link-checked against the
filesystem instead, which is what every Part B close has used.

### ✅ UI wiring — audited 2026-08-17 at the stop, all four surfaces confirmed

| Surface | State |
|---|---|
| `src/data/progress.js` | phase-10 `pages: 10, pagesPlanned: 13` — reads **writing** |
| `phase-10-strictness/README.md` | topics 10 **and** 11 linked, 11 marked 🚧 4 of 7 |
| `docs/typescript/pages/README.md` | phase row **10 / 13 · 🚧 writing**; Part B claim = `ede9cd9f`, 18 left |
| `docs/README.md` | Part B row records topic 10 in full; technology row corrected |
| sidebar | `sidebars.js:19` is `{type:'autogenerated', dirName:'typescript'}`, so **reachability is automatic** — all 20 new files verified to carry `title` + `sidebar_position`, and both chunk dirs have valid `_category_.json` |

🔴 **A DEFECT WAS FOUND AND FIXED IN THIS AUDIT — expect it again.** Another lane
had rewritten the shared technology row in `docs/README.md` to **"phase 10 at
11/13"**, counting topic 11 as complete when it is 4 of 7 chunks. Phase 10 is Part
B's, so it was Part B's to correct (`013ba506`). Every figure was **recomputed from
`progress.js` and `find`** rather than adjusted, which also fixed the total
(104 → **102**) and the file count (286 → **291**, drifting the other way).

⚠️ **The row moved under me THREE times on 2026-08-17.** Do not increment it. Run
this before touching it, and merge forward:

```bash
node --input-type=module -e "import('./src/data/progress.js').then(m=>{const p=m.LANGUAGES.typescript.phases;let t=0,d=0;for(const x of p){t+=x.topics;d+=x.pages}console.log(d+'/'+t)})"
find docs/typescript/pages -name '*.md' | wc -l
```

📌 **The lesson is general: a lane that finishes a topic may round its neighbours
up.** Auditing your own phase's number in the shared row is part of closing a
topic, not an optional extra.

#### ⚠️ `phase-12-tooling` has a registered row and NO directory — this is NORMAL, do not "fix" it

`Progress/index.js:91` renders `<Link to={`${s.pagesPath}/${p.slug}/`}>` for **every**
registered phase, including ones with `pages: 0`. So the phase-12 row currently
points at a directory that does not exist. ⚠️ **This is the one UI link the `.md`
link-checker structurally cannot see**, so it will never show up in the usual check.

🔴 **It is not a defect and not Part B's to patch.** Measured 2026-08-17: **45
registered phases across the site have no directory** — every unstarted phase in
MongoDB (9), Redis (10), Nginx (9) and Storybook (7) is in the same state. **A
directory is created when its first page is written**, and phase 12's row resolves
the moment `phase-12-tooling/README.md` lands.

⛔ **Do NOT remove the row to make the link resolve** — that would drop 15 topics
from the denominator and contradict the recorded scope of 136. The fix is to write
phase 12.

📌 The scan that establishes this, if it is ever queried again:

```bash
node --input-type=module -e "import('./src/data/progress.js').then(async m=>{const fs=await import('fs');for(const [l,c] of Object.entries(m.LANGUAGES))for(const p of c.phases){const d='docs/'+l+'/pages/'+p.slug;if(!fs.existsSync(d))console.log(l,p.slug,p.pages)}})"
```

⚠️ That scan also reports every `realworld` phase, including ones with pages — its
path convention differs (`docs/real-world/`, hyphenated), so those are **false
positives of the scan, and another lane's language regardless.**

🔴 **The three unwritten chunks are referenced as BOLD PLAIN TEXT with *(not written
yet)*, not links** — that is why the tree is green mid-topic. **When you write 05,
06 and 07, repoint those references**; they are in `01-what-type-aware-means.md`
(three of them: two to chunk 07, one to 06, one to 05) and
`04-no-unnecessary-condition.md` (one to 05), plus the chunk table in the topic
`README.md`. The README also carries a visible `:::info` mid-write admonition —
**delete it when the topic closes.**

**NEXT FILE: `05-strict-boolean-expressions.md`.** Its option defaults are in the
table above — note the three that default to *permissive*: `allowNumber: true`,
`allowString: true`, `allowNullableObject: true`. ⚠️ **Its rule page names no
preset**, so write that as an observation ("its page names no config") rather than
asserting it is in none.

**Then `06-the-no-unsafe-family.md`** — 🔴 it owes [[devbible-typescript-concepts-phase10]]'s
debt from topic 03: the `no-unsafe-*` rules are **the only way to catch `any` that
arrives *inherited* rather than written**. Nine rules, listed in the table above.
⚠️ `no-unsafe-type-assertion` belongs to **topic 12 · Assertion discipline** — link,
do not restate.

**Then `07-adoption-and-ci-cost.md`** — built on the three verbatim cost quotes
above. The argument to make: the honest complaint is not *"lint got slower"* but
*"we now run two type-checks per CI job"*, and the `-only` config variants plus
per-directory scoping are the levers. ⚠️ **Do not invent a multiplier** — the docs
give none beyond *"roughly the same as your build times"*.

**Then the boards** — `progress.js` phase-10 `pages` 10 → 11, the phase README row
(drop the 🚧 chunk count), `pages/README.md` (10/13 → 11/13, and Part B left 18 →
17), and `docs/README.md`'s Part B row. ⚠️ **Re-read every shared file immediately
before editing — three other lanes move them.** The shared TypeScript technology row
moved under me twice during topic 10; **merge forward, never overwrite**.

🔴 **DOCUMENTATION IS ALREADY FETCHED — do not re-fetch.** ⚠️ **typescript-eslint
is NOT installed anywhere in this repo** (checked `node_modules/` and `sandbox/`),
so unlike the rest of this phase there is no source to read; every claim is
attributed to a typescript-eslint doc page, and the pages say so. What was
gathered from typescript-eslint.io:

| Rule | Preset (from its OWN page) | Options and defaults |
|---|---|---|
| `no-floating-promises` | `recommended-type-checked` | `ignoreVoid: true` · `ignoreIIFE: false` · `checkThenables: false` · `allowForKnownSafePromises: []` · `allowForKnownSafeCalls: []` |
| `no-misused-promises` | `recommended-type-checked` | `checksConditionals: true` · `checksSpreads: true` · `checksVoidReturn: true`, whose sub-options are `arguments` `attributes` `inheritedMethods` `properties` `returns` `variables` |
| `no-unnecessary-condition` | 🔴 `strict-type-checked` | `allowConstantLoopConditions: 'never'` (also `'always'`, `'only-allowed-literals'`) · `checkTypePredicates: false` · `allowRuleToRunWithoutStrictNullChecksIKnowWhatIAmDoing: false` (**deprecated, removed next major**) |
| `strict-boolean-expressions` | ⚠️ **its page names NO preset** — treat as opt-in, and say so as an observation rather than asserting it is in none | `allowAny: false` · `allowNullableBoolean: false` · `allowNullableEnum: false` · `allowNullableNumber: false` · **`allowNullableObject: true`** · `allowNullableString: false` · **`allowNumber: true`** · **`allowString: true`** |
| `no-unsafe-assignment` + family | `recommended-type-checked` | family is `no-unsafe-argument` `no-unsafe-call` `no-unsafe-member-access` `no-unsafe-return` `no-unsafe-declaration-merging` `no-unsafe-enum-comparison` `no-unsafe-function-type` `no-unsafe-type-assertion` `no-unsafe-unary-minus` |

🔴 **The three cost quotes, verbatim — these carry chunk 07:**
1. *"Typed rules come with a catch. By using typed linting in your config, you
   incur the performance penalty of asking TypeScript to do a build of your project
   before ESLint can do its linting."*
2. *"Running typed linting on a project is generally as slow as type checking that
   same project."*
3. *"if you're using type-aware linting, your lint times should be roughly the same
   as your build times."*

⚠️ **The docs give NO multiplier or timing figures beyond that** — do not invent one.
Other quotes gathered: wide `include` globs (*"such as `**/*`"*) pull in build
artifacts and *"can heavily impact performance"*, while `projectService`
*"requires no additional configuration for wide TSConfig includes"*; on the old
`project` option prefer *"paths that use a single `*` at a time"*; differing
`extraFileExtensions` forces full TypeScript-server reloads. And 🔴 **`strict` /
`strict-type-checked` are NOT semver-stable**: *"Its enabled rules and/or their
options may change outside of major version updates."* ⚠️ The **Configs page does
not list rule names**, only links to source — so preset membership above comes from
each rule's own page, which is the correct source.

**Planned chunks** — settle links against this list, it is final:
`01-what-type-aware-means` ✅ 261 · `02-no-floating-promises` ✅ 227 ·
`03-no-misused-promises` ✅ 228 · `04-no-unnecessary-condition` ✅ 252 ·
`05-strict-boolean-expressions` · `06-the-no-unsafe-family` ·
`07-adoption-and-ci-cost` · `README`. ⚠️ **It inherits a constraint — see find 17: the
compiler now natively does a slice of `no-unnecessary-condition`
(`TS2872`/`TS2873`, plus `TS2774`/`TS2801`/`TS2839`/`TS2845`), so the page must
NOT claim "the compiler will not do this". Claim the leftover, which is named
precisely in `10-the-error-codes/11-the-condition-is-decided.md`: the compiler
reasons about expression *kind* and about types with *zero overlap*; the lint rule
additionally reasons about narrowing you already performed.** It also owes the
`no-unsafe-*` family and its CI cost (topic 03 names them as the only way to catch
*inherited* `any`).

📌 **Phase 10 is 10 of 13. Remaining: 11, 12, 13** (13 is Know). Then phase 12,
15 topics, directory does not exist — slug **must** be `phase-12-tooling`.

🔴 **CADENCE IS PER FILE, tightened again 2026-08-17 mid-topic** on the user's
instruction: *"We are nearing 80% of usage so make sure you switch saving progress
to per file."* Commit the doc **and** move this cursor after **every single
file**.

### The chunk layout that shipped, for reference

`01-what-a-code-is` 251 · `02-the-shape-is-wrong` 244 ·
`03-two-types-with-one-name` 275 · `04-the-call-site-family` 257 ·
`05-callable-or-not` 244 · `06-the-name-is-wrong` 275 · `07-cannot-find-name` 281 ·
`08-the-spelling-budget` 260 · `09-the-index-codes` 279 ·
`10-you-have-not-proved-it` 250 · `11-the-condition-is-decided` 265 ·
`12-out-of-room` 294 · `13-the-suppress-codes-are-gone` 260 ·
`14-a-lookup-routine` 248 · `README` 125.

⚠️ **Rule 1 was exercised twice and the layout was resettled once.** Chunk 02's
first draft hit **309 lines and was SPLIT** into 02 and 03 — and both halves then
*gained* material, which is the tell that trimming would have cost real content.
The layout was also renumbered once, from 13 chunks to 14, when the
property-lookup and name-lookup ladders each turned out to need a whole chunk.
🔴 **Lesson for the next topic: settle the chunk numbering BEFORE writing forward
links**, or accept one renumbering pass. Do **not** settle it before gathering the
evidence — the chunk count is an output of the evidence, per the rule at the top
of this file.

✅ **The topics 03/08/09 correction is DISCHARGED** (`85c25e68`) — all three pages
carry an admonition pointing at chunk 13. Nothing outstanding.

✅ **Link-checked against the filesystem: 1,996 links in `docs/typescript`, 0
broken in this topic.** ⚠️ 12 breaks exist in the tree, **all in
`phase-5-type-level` (lane A) and `phase-6-modules-build` (lanes C/D)** mid-write.
Attributed, not investigated — per the one-lane rule. **Not built** (rule 12; the
registry was not claimed).

### 🔴 The finds for topic 10 — all disk-measured, do not re-derive

Read from `sandbox/ts-p0/node_modules/typescript5/lib/typescript.js` (the 5.9.3
numbered table + checker source) and cross-checked against the 7.0.2 Go binary.

1. 🔴 **The whole code space, counted: 2,073 diagnostics in 13 ranges.**
   1xxx=449 parser · 2xxx=530 checker · 4xxx=110 declaration emit · 5xxx=64
   options · 6xxx=474 (431 are `--help` text, 43 real errors) · 7xxx=53
   `noImplicitAny` · 8xxx=35 TS-syntax-in-JS · 9xxx=34 `isolatedDeclarations` ·
   17xxx=20 JSX · 18xxx=51 **no theme, an overflow range** · 69xxx=1 · 80xxx=10 ·
   90xxx=50 · 95xxx=192. **242 entries (90xxx+95xxx) are quick-fix MENU LABELS,
   not diagnostics.**
2. 🔴 **Category enum: `0 Warning · 1 Error · 2 Suggestion · 3 Message`, and
   `Warning` is used by NOTHING.** TypeScript has no warning level — that is why
   suppression directives carry the weight a warning level would.
3. 🔴 **Eight 7xxx errors have Suggestion twins at 7043–7050**, each adding *"but
   a better type may be inferred from usage"*: 7005→7043, 7006→7044, 7008→7045,
   7034→7046, 7019→7047, get→7048, set→7049, 7010/7011→7050. **So
   `noImplicitAny: false` DEMOTES the finding to grey rather than removing it.**
   ⚠️ Second independent instance of the three-state mechanism topic 06 found on
   `allowUnreachableCode`.
4. 🔴 **`reportNonexistentProperty` is a seven-step priority ladder** (checker
   `~79902`), so **bare `TS2339` is the LAST resort** — by the time you see it the
   compiler has ruled out: a union member (it names the *first failing member*,
   not the union), `TS2576` static access, a **missing `await`** (plain `TS2339` +
   `TS2773` related), `TS2550` lib-too-old, `TS2551` spelling (+ `TS2728`
   *"declared here"*), and `TS2812` missing `dom` lib (matched by a **regex on the
   type name**, `/^(?:EventTarget|Node|(?:HTML[a-zA-Z]*)?Element)$/`). Results are
   **cached per (node, typeId, isUncheckedJS)**. In JS files it becomes `TS2568`
   and is reported as a **Suggestion**.
5. 🔴 **The spelling budget is exact** (`getSpellingSuggestion`, ~3489):
   `maximumLengthDifference = max(2, floor(len*0.34))` filters candidates;
   `bestDistance = floor(len*0.4) + 1` and the distance must be **strictly below**
   it; candidates under 3 chars are skipped unless a case-insensitive match. Same
   machinery feeds `TS2551`, `TS2552`, `TS2724`, `TS2820` **and `TS2561`**.
   ⚠️ **See find 20 — the distance is NOT standard Levenshtein**, which changes
   every conclusion drawn from this formula.
6. 🔴 **The element-access ladder (`~66820`) is gated entirely on
   `noImplicitAny`** — `TS7053` and everything under it *vanish* with the flag
   off, silently yielding `any`. `TS7053` is the **outer wrapper**; the inner
   elaboration is `TS2339` (enum/symbol/string/number literal keys), `TS7054`
   (plain `string`/`number` index), `TS7015` (numeric index signature exists but
   your key is not a number), `TS7052` (*"Did you mean to call"*), or `TS2551`
   (**spelling works on bracket access too**).
7. 🔴 **`TS18046`/`TS18048` vs `TS2571`/`TS2532` is ONE check reported two ways.**
   Selector (`checkNonNullTypeWithReporter`, `reportObjectPossiblyNullOrUndefined`,
   ~79472): `isEntityNameExpression(node)` **and** `nodeText.length < 100` → the
   *named* 18xxx form; otherwise the anonymous 2xxx form. Full pairs:
   18046/2571 (unknown), 18047/2531 (null), 18048/2532 (undefined), 18049/2533
   (both). `null`/`undefined` written literally get `TS18050` instead. Calls get
   `TS2722`/`TS2723`. ⚠️ **The anonymous form is diagnostic in itself**: it means
   the expression has no name, i.e. a call result or index access — so it cannot be
   narrowed in place and must be bound to a variable first.
8. 🔴 **`TS2367` is `tryGiveBetterPrimaryError` for exactly four operators** —
   `===`, `==`, `!==`, `!=` (checker ~84889). Any other operator reports `TS2365`
   instead. 🔴 **And it carries an `await` path**: `errorAndMaybeSuggestAwait`
   attaches `TS2773` *"Did you forget to use 'await'?"* as **related information**
   when awaiting both sides would make them related. **A forgotten `await` is a
   top cause of `TS2367`.** Truthiness sibling: `TS2801`; forgot-parens sibling:
   `TS2774`.
9. 🔴 **`TS2589`'s limit is exact: `instantiationDepth === 100 || instantiationCount
   >= 5_000_000`** (~68205), and `instantiationCount` is **reset per expression**
   (`checkExpression` 85456), **per source element** (90957) and **per deferred
   node** (91264). **So it is one expression's fault, never "the file is too
   big"** — and it is why the same type compiles in a playground and fails in situ.
   `TS2590` has **two** thresholds: cross-product union size `>= 100_000`
   (`checkCrossProductUnion`) and subtype-reduction count at `100_000` with an
   estimate over `1_000_000` (`removeSubtypes`). `TS2321` is the comparison-depth
   twin.
10. 🔴🔴 **THE CORRECTION — `suppressExcessPropertyErrors` and
    `suppressImplicitAnyIndexErrors` DO NOT WORK in 5.5+.** The checker reads
    **neither**; their only remaining appearance is
    `checkDeprecations("5.0", "5.5", …)`. Exact behaviour, from `checkDeprecations`
    (~129373): `mustBeRemoved = removedIn <= currentVersion`, and when true it
    emits **`TS5102`** *"Option '{0}' has been removed. Please remove it from your
    configuration."* — and **`ignoreDeprecations` CANNOT silence it**, because
    `canBeSilenced` is only computed when `!mustBeRemoved`. Before removal it is
    **`TS5101`** (silenceable). **In 7.0.2 the option names are not in the binary
    at all** → `TS5023` *"Unknown compiler option '{0}'."* Verified with a control:
    `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess` and
    `ignoreDeprecations` **are** present in 7.0.2; `suppressExcessPropertyErrors`,
    `suppressImplicitAnyIndexErrors`, `keyofStringsOnly` and `noStrictGenericChecks`
    are **absent**.
    ⚠️ **The methodological lesson, and it is important for the rest of this
    corpus: the option record LIED.** Both records still carry
    `affectsSemanticDiagnostics: true`, `category: Backwards_Compatibility` and
    their original descriptions in 5.9.3 — a stale declaration that outlived the
    feature. **The option table is authoritative about defaults and categories but
    NOT about whether a flag still functions.** Cross-check by grepping for the
    option's *consumers*, not its declaration.
    🔴 **This contradicts two pages already shipped** —
    `08-suppression-directives/03-the-suppression-tiers.md` (tier 6) and
    `09-excess-property-checks/04-designing-for-it.md` + its README claim
    *"turns the whole topic off project-wide"*. **Chunk 11 states the correction and
    those two pages must be repointed at it.** Both are in Part B's lane, so this
    is mine to fix — do not leave it.
11. 🔴 **Assignability elaboration is 15 codes, not 2.** `TS2326` property ·
    `TS2200` nested path · `TS2201` **return type** · `TS2328` **parameters
    (contravariance — the only place the compiler says it out loud)** · `TS2330`
    two index signatures · `TS2634` one · `TS2411` property-vs-index-signature ·
    `TS2413` numeric-vs-string index · `TS2419` construct signatures · `TS2685`
    `this` signatures · `TS2684` **detached method** · `TS2416` override ·
    `TS2603`/`TS2606` JSX · `TS2636` variance annotation.
12. 🔴 **`TS2719`** *"Two different types with this name exist, but they are
    unrelated."* — the second line that makes `Type 'X' is not assignable to type
    'X'` readable. **It is a lockfile problem, not a type problem.**
13. **`TS2352` quotes its own workaround** (*"convert the expression to 'unknown'
    first"*) — and ⚠️ **it only fires when the types barely overlap**, so a plain
    `as` being accepted is NOT evidence it is safe.
14. **Forgot-the-parens is a whole cluster:** `TS2560` (*"Did you mean to call
    it?"* on no-properties-in-common), `TS2774` (*"This condition will always
    return true since this function is always defined. Did you mean to call it
    instead?"*), `TS1209` (optional chain from `new`), `TS7052` (index access).
15. **Arity has its own specialised codes:** `TS2554`/`TS2555` counts,
    `TS2556` spread-not-a-tuple, `TS2558` **type** arguments, `TS2849` target
    signature too few, and two Promise specials — `TS2794` *"Did you forget to
    include 'void' in your type argument to 'Promise'?"* and `TS2810`.
17. 🔴 **The always-constant condition family is SEVEN codes, and two of them are
    new enough to matter.** `TS2367` (comparison, no overlap) · `TS2774` (always
    true — **a function you forgot to call**) · `TS2801` (always true — *"this
    '{0}' is always defined"*, the forgotten-`await` case) · 🔴 **`TS2839`** *"This
    condition will always return '{0}' since **JavaScript compares objects by
    reference, not value**"* — a teaching diagnostic · `TS2845` (the general
    always-`{0}` case) · 🔴 **`TS2872`** *"This kind of expression is always
    truthy."* · 🔴 **`TS2873`** *"This kind of expression is always falsy."* All
    confirmed present in **7.0.2** as well as 5.9.3.
    ⚠️ **The consequence for topic 11:** `TS2872`/`TS2873` mean the compiler now
    natively does a slice of what typescript-eslint's `no-unnecessary-condition`
    does. **Topic 11 must not claim the compiler does none of this** — it does
    part of it, and the page's job is to say which part is left over.
18. **The name-lookup ladder is a full parallel to find 4**, and its most
    remarkable rung prints a shell command: `TS2580`/`TS2591` *"Do you need to
    install type definitions for node? Try `npm i --save-dev @types/node`…"*.
    Others: `TS2552` typo · `TS2583` lib too old · `TS2584` lib missing `dom` ·
    `TS2585` a type used as a value **and** lib too old · `TS2662` did you mean the
    **static** member · `TS2663` did you mean **`this.`** · `TS2686` a **UMD
    global** in a module file · `TS2693` type used as a value · `TS2749` value used
    as a type, *"Did you mean 'typeof {0}'?"* · `TS2503` namespace not found ·
    **`TS2304` last**.
20. 🔴🔴 **`levenshteinWithMax` (~3513) is a WEIGHTED distance, not standard
    Levenshtein**, and this is the best find of the topic because every intuition
    about the suggestion budget is wrong without it. Cost table, read from lines
    3530–3538: identical char **0** · **case-only substitution 0.1** · insert **1**
    · delete **1** · 🔴 **any other substitution 2**.
    **So a mistyped letter costs the same as delete+insert, and a case error is
    effectively free.** Combined with `bestDistance = floor(len*0.4)+1`, the cliff
    is exact and undocumented anywhere:

    | Typo | Cost | Shortest name that still gets a suggestion |
    |---|---|---|
    | wrong case, any number of letters | 0.1 each | **1** — always |
    | one letter missing or extra | 1 | **3** |
    | 🔴 two letters transposed | 2 | **5** |
    | 🔴 one letter wrong | 2 | **5** |
    | three letters missing | 3 | **8** |
    | two letters wrong | 4 | **10** |

    ⚠️ **`obj.nmae` for `name` gets NO suggestion** — 4 chars, swap costs 2, budget
    is under 2. But `lenght`→`length`, `recieve`→`receive`, `chidlren`→`children`
    and `widht`→`width` all do, because they are 5+.
    **Only ONE candidate is ever returned, and ties break on DECLARATION ORDER** —
    after a hit at distance *d* the next candidate is measured against `d - 0.1`,
    so an equally close alternative is rejected. That is why a suggestion is
    sometimes confidently wrong.
    📌 **This yields the corpus's only quantified argument for longer identifiers:**
    `id` (2) can be matched on a case error and nothing else, ever; `name` (4)
    cannot be matched through a swap; `currentUserId` (13) tolerates two wrong
    letters plus a case change.
    ⚠️ **How the worked table on the page was produced, and the precedent it
    sets:** the two functions were **evaluated as quoted** — arithmetic on a pure
    function read off disk — and the page says so explicitly and carries **no
    console block**. That is within rule 8 and is a reusable technique for any
    self-contained compiler helper; it is **not** a licence to reconstruct `tsc`
    output.
21. **Overload reporting machinery:** `TS2769` *"No overload matches this call."* +
    `TS2772` *"Overload {0} of {1}, '{2}', gave the following error."* + `TS2771`
    *"The last overload is declared here."* + `TS2793` *"The call would have
    succeeded against this implementation, but implementation signatures of
    overloads are not externally visible."* + `TS2750`. 📌 **This mechanically
    justifies topic 04's advice to read the last overload** — `TS2771` points at it
    by design.

🔴 **The syllabus names nine codes for topic 10** — `2322` `2345` `2339` `2367`
`2551` `7053` `18046` `18048` `2589` — **and the phase has already covered
several others in depth.** Do not re-explain `TS2353`/`TS2561` (topic 09),
`TS4111`–`TS4116` / `TS7029` / `TS7030` (topic 06), `TS2375`/`TS2379`/`TS2412`
(topic 05) or `TS2578` (topic 08). **Link to them and own the nine.**

⚠️ **A code list is the single most likely topic in this phase to become a flat
table of nine rows.** That is the rule-13 failure. Each code needs the shape
topic 04 established: what it actually means (often not what it says), the
common *wrong* fix, and the right one. Group them by cause, not by number.

📌 Phase 10 is **9 of 13**. Remaining: 10, 11, 12, 13 (13 is Know).

### ✅ Topic 09 · Excess property checks — done 2026-08-17

**4 chunks + index, 923 lines, 0 over the cap.** Commit `131d830f`.
`01-freshness` 200 · `02-where-freshness-is-lost` 219 ·
`03-the-second-and-third-rules` 201 · `04-designing-for-it` 219 · `README` 84.

🔴 **TWO excess-property codes, not one** — the same shape of find as topic 05's
three:

| Code | Fires when |
|---|---|
| `TS2353` | *"…and `'{0}'` does not exist in type `'{1}'`."* — the key resembles nothing in the target |
| **`TS2561`** | *"…but `'{0}'` does not exist… **Did you mean to write `'{2}'`?**"* — the compiler ran a **similarity check and found your intended property** |

**Which code you get is diagnostic:** `TS2561` is almost always a typo; `TS2353`
usually means you are passing to the wrong function or reading the wrong
interface.

**The claims:**
1. **Excess property checking is NOT part of assignability** — a separate
   heuristic on **fresh object literals** only. The justification: a literal
   written inline for this call was written *for* this call; a variable may
   legitimately carry more. **So the "inconsistency" is the rule working.**
2. **Freshness applies to nested literals and to each array element**, at every
   depth — which is where it earns most (config objects, fixture rows).
3. 🔴 **Seven ways freshness is lost:** unannotated variable · `as` · wider
   annotation · inferred return type · spread · staged building · union target.
   **The most common is extracting a literal into a variable** — a routine
   refactor that silently removes a typo guard. **The most misleading is `as`**,
   which *looks like added safety* and is precisely what stops the check.
4. **`satisfies` restores it without widening**; an annotation restores it *and*
   widens. **For config objects the narrow type is what you want**, so `satisfies`
   is the correct default. Annotate factory **return types** for the same reason.
5. 🔴 **Three overlapping rules, on an extra / nothing / missing axis:**
   `TS2353`/`TS2561` = extra (literals only) · `TS2559` = weak type, nothing in
   common (applies to variables) · `TS2741`/`TS2739` = missing required (applies
   to variables, and `TS2739` **lists the names**).
6. 🔴 **The gap all three leave, and it is reachable:** *a typo in an optional
   property, on a target with at least one required property, passed through a
   variable, is caught by nothing.* Defence: `satisfies` at the declaration, or
   move the required field out of the options bag (better API design anyway).
7. **`suppressExcessPropertyErrors` turns the whole topic off project-wide** and
   is `category: Backwards_Compatibility`.

⚠️ **Weak-type detection was NOT re-derived here** — phase 1 topic 04 measured it
and is sandbox-proven, so topic 09 cites that page and carries **no console
block**. Keep doing this: when an earlier phase has recorded evidence, link it.

**Banked in** [[devbible-typescript-concepts-phase10]].

### ✅ Topic 08 · Suppression directives — done 2026-08-17

**4 chunks + index, 862 lines, 0 over the cap.** Commit `9fa564cb`.
`01-the-three-directives` 216 · `02-why-expect-error-wins` 206 ·
`03-the-suppression-tiers` 185 · `04-a-policy-that-works` 179 · `README` 76.

🔴 **`TS2578` — *"Unused '@ts-expect-error' directive."*** is the **only
diagnostic in TypeScript that reports a problem which has STOPPED existing.**
That makes it the one check that moves the codebase toward correct with nobody
deciding to work on it. **The usual objection ("it will break the build later")
IS the feature being purchased.**

🔴 **The find: there is a whole suppression tier nobody greps for.**
`suppressExcessPropertyErrors` and `suppressImplicitAnyIndexErrors` do
**project-wide** what `@ts-ignore` does per line, and both sit in
**`category: Backwards_Compatibility`** — the only category name in the option
table that doubles as a warning label. ⚠️ **Grep `tsconfig.json` BEFORE grepping
for directives**: one config line outranks every directive in the codebase and is
invisible from any affected line.

**The seven-tier ladder, ordered by blast radius (not virtue):** fix → `as`/`!`
→ `@ts-expect-error` → `@ts-ignore` → `@ts-nocheck` → `suppress*` options →
flag off. 📌 **Turning a flag off is arguably MORE honest than `@ts-nocheck`** —
its scope is visible in one well-known place and creates no illusion of local
consideration.

**Other claims worth keeping:**
- **`@ts-expect-error` is also a type-level TESTING tool** — put it above a call
  that *should* fail and a refactor that widens the signature breaks the test.
- ⚠️ **Its weakness: it absorbs whatever error is on the next line**, so if the
  error *changes* it keeps working silently and `TS2578` never fires. **A written
  description is what makes the mismatch noticeable** — that is the real reason
  for the convention, not documentation.
- **The one legitimate `@ts-ignore`:** version-conditional errors in a library
  building against several TypeScript versions, where `TS2578` would fire on
  whichever version lacks the error.
- **`@ts-nocheck` in a `.ts` file is almost always wrong** — a file that cannot be
  checked should be `.js` under `allowJs`, so its status is in its **name**.
  `@ts-check` (the inverse, per-file opt-in) is the genuinely useful one.
- **Count, do not ban.** A ban is honoured and produces a worse workaround, or is
  suspended and never reinstated. ⚠️ **The count is gameable by moving to a wider
  tier** unless the config is audited in the same CI step.
- **The review question:** *what has to become true for this line to be deleted?*
  "Nothing" means it is a design decision written in the wrong place.
- **The migration:** replace every `@ts-ignore` with `@ts-expect-error` and build
  — every `TS2578` was **already unnecessary**. Deletes a meaningful fraction on
  any codebase over a year old, for the cost of one build.

**Banked in** [[devbible-typescript-concepts-phase10]].

### ✅ Topic 07 · Where TypeScript is unsound by design — done 2026-08-17

**5 chunks + index, 1,181 lines, 0 over the cap.** Commit `6e3645c1`.
`01-what-unsound-means` 194 · `02-the-holes-you-opt-into` 221 ·
`03-the-holes-in-your-data` 237 · `04-mutation-and-variance` 235 ·
`05-working-with-the-holes` 207 · `README` 87.

✅ **All three inherited debts paid, and every stale forward reference repointed**
(5 of them, across topics 01, 02 and 05).

🔴 **The reframe that makes this topic worth more than the usual list.** Most
sources give six holes as a flat list. Sorted by *what you can do about it* they
are seven and the shape changes completely:

| Kind | Holes | Why it matters |
|---|---|---|
| **You write them** | `any`, `as`, `!` | the **only** ones visible in a diff → greppable, countable, fixable by policy. **This is why the whole phase's metric is assertions-per-error-fixed** — not because they are worst, but because they are the only manageable ones |
| **Closable by a flag** | index access, object spread over optionals | `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| **Honest consequence** | `Object.keys` → `string[]` | see below |
| 🔴 **Neither** | **mutation through an alias**, **method bivariance** | nobody opts in, no flag removes them, both crash on a line where every type is right |

**The claims worth keeping:**

1. 🔴 **`Object.keys` returning `string[]` is the HONEST answer, not an
   oversight.** Structural typing lets a value carry properties its type never
   declared (`{x,y,z}` is assignable to `{x,y}`), so a `keyof T` return would
   claim two keys where three exist — **a larger unsoundness than the one it
   removes.** Read from `lib.es5.d.ts` (`keys(o: object): string[]`) and
   `lib.es2017.object.d.ts` (`entries<T>(…): [string, T][]`). ⚠️ `Object.entries`
   has a second problem: its heterogeneous overload `entries(o: {}): [string,
   any][]` **injects `any` without anyone writing it.**
2. 🔴 **Both flag-fixes work by removing a possible INPUT, not by adding a
   check.** `exactOptionalPropertyTypes` forbids the explicit `undefined` so the
   spread's inferred type becomes true. *Make the wrong state unrepresentable
   rather than detected* — a recurring shape worth naming on future pages.
3. **Method bivariance exists *for* array covariance** — `Array<Dog>` assignable
   to `Array<Animal>` requires `push(item: Dog)` assignable to
   `push(item: Animal)`, which contravariance forbids. **Making methods strict
   would break the standard library.** Mitigation is one line and free: declare
   callbacks as **properties**, not methods.
4. **`readonly` on a property is aliasable** — two types differing only in
   `readonly` are mutually assignable, so passing the object somewhere that omits
   the modifier makes it writable *through the original reference*. ⚠️ **But
   `readonly T[]` is NOT assignable to `T[]`** — arrays got the stricter rule.
   That asymmetry is the practical mitigation for array covariance: take
   `readonly T[]` in parameters, since the bug requires a **write**.
5. **The three holes boundary validation does NOT cover** — mutation through an
   alias, method bivariance, index access — all live inside already-validated
   code. Conveniently all three have free mitigations, so the expensive defence
   covers the boundary and the cheap ones cover the interior.
6. **The Design Goals quote is the anchor**: *"Apply a sound or 'provably
   correct' type system"* is listed under **Non-goals**, with *"strike a balance
   between correctness and productivity"*. Cite it whenever "TypeScript is
   unsound" is offered as a criticism.

**Banked in** [[devbible-typescript-concepts-phase10]].

### ✅ Topic 06 · The other correctness flags — done 2026-08-17

**5 chunks + index, 1,204 lines, 0 over the cap.** Commit `12a20036`.

🔴 **The shape decision worth reusing: a "grouped" syllabus row is NOT permission
to write one paragraph per item.** The row named five flags; the topic became
`01-noimplicitoverride` (217) · `02-index-signature-access` (220) ·
`03-control-flow-flags` (241) · `04-unused-code-flags` (247) ·
`05-choosing-and-adopting` (190) · `README` (89). **`noImplicitOverride` earned a
whole chunk on its own.** The tell that it had gone wrong would have been six
paragraphs of even length — the rule-13 signature.

**Three finds from the option records that are not in the prose docs:**

1. 🔴 **`noFallthroughCasesInSwitch` is a BINDER diagnostic** —
   `affectsBindDiagnostics: true`, alone in the group. So the check runs while
   the control-flow graph is built, is **purely syntactic**, needs no type
   information, works on `.js` under `checkJs` and on files full of `any` — and
   **cannot recognise an intentional fallthrough**, because there is no compiler
   equivalent of ESLint's `// falls through`.
2. 🔴 **`allowUnreachableCode` and `allowUnusedLabels` carry
   `defaultValueDescription: void 0`** — `undefined`, **not `false`**. That is a
   real third state: `undefined` = **suggestion** (editor greys it out, build
   passes), `true` = silent, `false` = error. **So every editor is already
   reporting unreachable code today and CI is not.** Note the **inverted
   polarity** — `allow*` flags are strict at `false`.
3. **`noPropertyAccessFromIndexSignature` alone carries
   `showInSimplifiedHelpView: false`**, so it is absent from plain `tsc --help`.
   ⚠️ Written on the page as an **observation about presentation**, explicitly
   *not* as evidence the flag is discouraged — no documentation says that.

**Diagnostics used:** `TS4111` (index-signature access, and its message contains
its own fix) · `TS4112`–`TS4116` (the five `override` errors) · `TS7027`
(unreachable) · `TS7028` (unused label) · `TS7029` (fallthrough) · `TS7030` (not
all code paths return) · and **seven** unused-code codes: `6133` `6138` `6192`
`6196` `6198` `6199` `6205`.

**The claim the page is built around, worth keeping:** without `override`,
*"I am replacing the base implementation"* and *"I am adding a new method"* are
**written identically** — so renaming a base member converts one into the other,
in a different file, with **no error anywhere**. `TS4114` is the migration cost;
`TS4113` is the payoff and only fires when something is genuinely broken.

**Also settled here:** `noImplicitReturns` is not redundant with
`strictNullChecks`, because on an **unannotated** function the missing return is
folded into an inferred `T | undefined` instead of erroring — the bug becomes a
wider type, which is exactly what does not look wrong in review.

**Banked in** [[devbible-typescript-concepts-phase10]].

### ✅ Topic 05 · `exactOptionalPropertyTypes` — done 2026-08-17

**4 chunks + index, 1,178 lines, 0 over the cap.** Commit `bde8cb46`.

| File | Lines | Covers |
|---|---|---|
| `README.md` | 85 | tier, Verified, four claims, chunk table, phase gate, connections |
| `01-absent-versus-undefined.md` | 288 | the ten runtime ops that distinguish the states; **writes not reads**; the three diagnostics; `?: T \| undefined`; where it does nothing; why not in `strict` |
| `02-the-json-boundary.md` | 256 | `JSON.stringify` drops the key / `JSON.parse` cannot produce `undefined`; the `?: T \| null` three-state model; `in` vs `!== undefined`; the response side; `null`-vs-`undefined` as enforceable policy |
| `03-spread-defaults-and-construction.md` | 292 | the defaults bug; **the soundness argument**; four erroring patterns + fixes; conditional spread; `Partial<T>` as the big bucket; the `if (x)` regression |
| `04-living-with-it.md` | 257 | utility types under the flag; `delete`/`TS2790`; third-party `.d.ts` and why `skipLibCheck` is not the fix; adoption order; when **not** to enable; the assertion-ratio metric |

🔴 **The find worth reusing — there are THREE diagnostics for this flag, not
one**, and the docs give the impression of one:

| Code | Shape it reports |
|---|---|
| `TS2375` | object → variable; *"…the target's **properties**"* (plural) |
| `TS2379` | object → **parameter**; *"**Argument** of type…"*, also plural |
| `TS2412` | `o.k = undefined`; *"…the type of the **target**"* (singular) |

**The singular/plural split is a diagnostic technique**: plural means a whole
object failed and you must read the property path; singular means the error is
already on the line you need. ⚠️ That mapping is read off the **message wording**,
not proved from the checker — 7.0.2 is the Go port, so the string table is
readable and the control flow is not. All three strings are verbatim identical in
5.9.3 and 7.0.2 under the same numbers.

🔴 **The other reusable find: the option record has no `strictFlag`.** Reading
`sandbox/ts-p0/node_modules/typescript5/lib/typescript.js` around
`name: "exactOptionalPropertyTypes"` gives `defaultValueDescription: false`,
`category: Type_Checking`, and description
*"Interpret optional property types as written, rather than adding
`'undefined'`."* — **which settles "is it in `strict`" from the compiler rather
than from a blog.** Use `grep -n -A14 'name: "<option>"'` for any flag in topic
06.

⚠️ **`strings | grep` on the 7.0.2 binary needs care.** The binary's string table
has no newlines, so `grep -F` returns a 125 KB blob and a `[^"]\{0,180\}` pattern
blows ugrep's complexity limit. **What works:**
`timeout 110 strings -n 20 <tsc> | grep -oE ".{0,60}<needle>.{0,190}" | sort -u`.

**The load-bearing claims are banked** in
[[devbible-typescript-concepts-phase10]].

### Phase 10 — what is written

| # | Topic | Tier | Files | Commit |
|---|---|---|---|---|
| 01 | `strict` flag by flag | Master | **4** — `README` 70 · 194 · 244 · 273 = **880** | `df9ccf2f` `b9dc7928` `b800b995` `6597b1bf` |
| 02 | `noUncheckedIndexedAccess` | Master | 1 — **234** | `d1a4…` (see log) |
| 03 | Containing `any` | Master | 1 — **240** | see log |
| 04 | Reading a TypeScript error | Master | 1 — **225** | `efd75ac8` |

### Phase 10 — the nine left, in order

05 `exactOptionalPropertyTypes` · 06 The other correctness flags (grouped) ·
07 Where TypeScript is unsound by design · 08 `@ts-expect-error` vs `@ts-ignore`
vs `@ts-nocheck` · 09 Excess property checks vs assignability · 10 The error
codes you will actually meet · 11 typescript-eslint type-aware rules ·
12 Assertion discipline · 13 Designing APIs `unknown`-first (Know).

🔴 **Debts the written topics created — these are commitments, honour them:**
- **07** owes **method bivariance** as one of the deliberate soundness holes
  (topic 01 chunk 03 introduces it and defers), and topic 02 explicitly hands it
  *"the flag narrows the soundness gap rather than closing it"*.
- **09** owes **why `TS2353` fires for object literals only** — topic 04 defers
  it by name.
- **12** owes **the `!` count as the real measure of a strictness migration** —
  topics 01 chunk 02, 02 and 03 all point at it.
- **11** owes the **`no-unsafe-*` family and its CI cost** — topic 03 names them
  as the only way to catch *inherited* `any`.
- **05** should link to
  `phase-7-server/01-tsconfig-for-a-node-service/04-the-annotated-configs.md`,
  which already argues `exactOptionalPropertyTypes` on a server (the
  `PATCH`-clears-a-field data-loss bug, and `JSON.stringify` erasing the
  absent-vs-undefined distinction). **Own the general rule; link the applied
  case.** `TS2412` is its diagnostic — *"Type '{0}' is not assignable to type
  '{1}' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to
  the type of the target."* — already read from the table.

### Then phase 12 (15 topics) — not started, directory does not exist

Slug **must** be `phase-12-tooling`. ⚠️ Two of its rows are already partly
argued and must link rather than restate: *"Type checking in CI"* (phase 7 topic
02 chunk 01, the Path B gate) and *"`skipLibCheck` as a performance lever"*
(phase 7 topic 01 chunk 03 covers the *correctness* trade — phase 12 owns the
*performance* framing).

## 🔴 Traps — Part B specific, read before writing

- 🔴 **A phase directory's name MUST equal the `slug` already registered in
  `src/data/progress.js`.** `Progress/index.js:91` links
  `` `${s.pagesPath}/${p.slug}/` ``, so a mismatch is a dead link the `.md` link
  checker will never see. Phase 7 was first created as
  `phase-7-typescript-on-the-server` and had to be renamed to **`phase-7-server`**.
  The registered slugs for the rest of Part B: **`phase-8-react`**,
  **`phase-9-boundary`**, **`phase-10-strictness`**, **`phase-11-migration`**,
  **`phase-12-tooling`**. Read the row before creating the directory.
- 📌 **Phase directories take NO `_category_.json`** — README frontmatter plus
  autogeneration, matching phases 1–3. (Phase 0 has one; it is the outlier.) Only
  a *chunk* directory inside a topic gets one. A stray phase-level
  `_category_.json` was created here and removed.
- 🔴 **`git commit` needs `GIT_AUTHOR_*` / `GIT_COMMITTER_*` env vars** — there is
  no readable `user.*` config. Use `git commit -F -` with a quoted heredoc
  (backticks in `-m` get command-substituted).
- 🔴 **The shared index already contains other sessions' staged work.** At this
  commit the Docker session had five staged renames sitting in the index. **Never
  `git add -A`, and never `git reset` their paths** — commit with an explicit
  pathspec, `git commit -F - -- <my paths>`, which makes a partial commit and
  leaves their index entries untouched.
- ⚠️ **Phase 8 types React but edits nothing under `docs/react/`.** React is
  complete and owned elsewhere; write the TypeScript side and link out.
- **Forward references to unwritten topics are bold plain text with *(not written
  yet)*, never a link.** Repoint them as each topic lands.

## Evidence — where Part B's claims come from

🔴 **No new sandboxes.** Validated against the **TypeScript handbook** (*Modules →
Reference* is the load-bearing one for phase 7), the **`tsconfig` reference**, the
**Node.js API docs** (*Modules: TypeScript*), the **Express 5 docs**, and
**DefinitelyTyped** sources — each named in the page's `> Verified:` line.

🔴 **The technique that carries this half — read the compiler's own diagnostic
table, do not recall error text.** Two readable sources, both already on disk in
`sandbox/ts-p0/node_modules/`, and **reading them is not a sandbox run**:

```bash
# exact message text, TypeScript 7.0.2 (the Go binary; codes are not in it)
strings -n 20 sandbox/ts-p0/node_modules/@typescript/typescript-linux-x64/lib/tsc \
  | grep -o "Relative import paths need explicit[^\"]\{0,200\}"

# code -> message, TypeScript 5.9.3 (the JS build has the numbered table)
grep -o "_2835\", \"[^\"]*\"" sandbox/ts-p0/node_modules/typescript5/lib/typescript.js
```

🔴 **The read-the-compiler technique paid off again on topic 04**, and this one
is a live trap for the rest of Part B: **`Error.isError` is declared in
`lib.esnext.error.d.ts` and reachable only from `lib.esnext.d.ts`.** So the
`lib: ["es2024"]` that this phase's own topic 01 recommends **excludes it** —
the runtime has the function (confirmed with a `typeof` probe on Node 24.19.0)
and the compiler refuses it. The fix is to name the slice: `"lib": ["es2024",
"esnext.error"]`. Expect more of these: a pinned `lib` is *conservative*, and
every new standard-library method lands in an `esnext.*` slice first.

Codes confirmed and used on topic 01: `TS1294` `TS1309` `TS1471` `TS1479`
`TS2307` `TS2580` `TS2591` `TS2688` `TS2792` `TS2834` `TS2835` `TS5055` `TS5056`
`TS5096` `TS5097` `TS6059` `TS6278` `TS6280` `TS18003`.

🔴 **A real 5.9 → 7.0 difference found this way, worth reusing:** `TS5096` reads
*"…when either 'noEmit' or 'emitDeclarationOnly' is set"* in 5.9.3 and *"…when
one of 'noEmit', 'emitDeclarationOnly', or 'rewriteRelativeImportExtensions' is
set"* in 7.0.2 — the 5.9 wording is **absent** from the 7.0.2 binary. Two more
strings exist in 7.0.2 and not in 5.9.3's numbered table: the *"The common source
directory of '{0}' is '{1}'…"* `rootDir` advice, and *"This import uses a '{0}'
extension to resolve to an input TypeScript file, but will not be rewritten
during emit because it is not a relative path."*

**No run means no console block.** Where a measurement was needed, topic 01 cites
phase 0's sandbox-proven `strict`-defaults-to-`true` page rather than
re-deriving it.

## Per-topic checklist

1. Write it. If it passes 300 lines, **split on a concept boundary** — never trim.
   Every chunk repeats the tier badge, the `> Verified:` line, Gotchas and
   Interview questions.
2. Phase `README.md` → link the topic row, note the chunk count.
3. `src/data/progress.js` → bump `pages`, keep `pagesPlanned` while mid-phase
   (**anchor the edit on the `slug` and assert `count(old)==1`** — a numeric
   pattern once matched a JavaScript row too).
4. `docs/typescript/pages/README.md` phase row and `docs/README.md` technology +
   claims rows.
5. Link check (below), commit with an explicit pathspec, update this file.

## Cheap link check — run after every topic

```bash
cd /mnt/Storage/Backup/Knowledge/devbible && python3 - <<'EOF'
import os,re,glob
bad=0; tot=0
for p in glob.glob('docs/typescript/**/*.md', recursive=True):
    d=os.path.dirname(p)
    for m in re.finditer(r'\]\(([^)]+\.md)\)', open(p,encoding='utf-8').read()):
        t=m.group(1)
        if t.startswith(('http','#')): continue
        tot+=1
        if not os.path.isfile(os.path.normpath(os.path.join(d,t.split('#')[0]))):
            print('BROKEN',p,'->',t); bad+=1
print(tot,'links,',bad,'broken')
EOF
```

**811 links, 0 broken** after topic 05. Earlier runs showed 3 broken, **all Part
A's** mid-write phase-3 topic 13 — always attribute a break before assuming it is
yours. Keep the full clean rebuild for the phase
close, and confirm `[SUCCESS]` **before** interpreting any grep.

Related: [[devbible-typescript-split-parts-ab]] ·
[[devbible-typescript-build-progress]] (Part A's live cursor) ·
[[devbible-typescript-syllabus]] · [[devbible-never-compress-to-fit-cap]] ·
[[devbible-worktree-consolidation-20260815]]
