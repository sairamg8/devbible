---
name: progress-python-pages-history
description: Cold history rotated out of progress_python_pages.md — superseded session blocks, verbatim. Opened by name or by recall.sh, never on the hot path
metadata:
  type: progress
---

# progress_python_pages.md — history

---

<!-- rotated out of progress_python_pages.md on 2026-09-10 -->

> # ⏹️ WOUND DOWN 2026-09-08 — 06h SPLIT AND COMMITTED. **THREE OVER-CAP FILES LEFT.**
>
> **START HERE → split `06l-the-else-you-cannot-write.md` (321 lines) in
> `docs/python/pages/phase-1-language-core/12-eafp-vs-lbyl/`.** Then `06m` (320), then
> `06j` (305). When those three are under the cap, phase 1 is 16/16 and topic 12 closes.
> 🔴 The boundaries below were measured on 2026-09-04 and re-confirmed on disk 2026-09-08 —
> **do not re-derive them**:
>
> | File | Lines | Cut at | Keeps | New file takes |
> |---|---:|---|---|---|
> | `06l-the-else-you-cannot-write.md` | **321** | `## except and except* do not mix` | grammar + clause-order table + loop `else` (~252) | `except*` (~118 — thin, and the half with the most room to grow) |
> | `06m-the-guard-the-platform-deletes.md` | **320** | `## And the check can lie` | `-O`/`-OO`/`PYTHONOPTIMIZE` and the deleted `assert` (~160) | `os.access` + `os.path.exists` + `## The three questions to ask of any guard` (~218) |
> | `06j-ambient-state-the-guard-cannot-see.md` | **305** | `## Warning filters` | `decimal` contexts, traps, per-thread, the readable flag (~188) | warning filters: the `"error"` action, the default filter list, the spec format, `catch_warnings` (~175) |
>
> **Next free letters and positions.** Chunks now run **120–139, [140 = the chapter dir],
> 141–163**, gap-free. Letters `06a`–`06p` are taken; the next three new siblings are
> **`06q`, `06r`, `06s`**. 🔴 **Seat each one directly after its parent and renumber the
> tail** — `sidebar_position` is the reading order and the letters do **not** run in
> sequence (the order is `06 06b 06c 06d 06e 06f 06g 06h 06n 06o 06p 06k 06i 06l 06j 06m`).
> Renumbering `sidebar_position` is safe; **renaming a file is not**, because inbound links
> use filenames.
>
> ## What 06h became — and why it was three splits, not one
> 06h was 351 lines carrying three separable arguments. Commit **`48e54198d`**:
>
> | File | Lines | ★ | Owns |
> |---|---:|---:|---|
> | `06h-finally-and-the-widest-handler.md` | 277 | 4 | clause order; `else` has three conditions, `finally` none |
> | `06n-what-belongs-in-a-finally.md` | 269 | 5 | the three questions; what "temporarily saved" costs an outer handler |
> | `06o-with-is-the-sanctioned-form.md` | 257 | 6 | the seven steps; step 7 consults the return value only on the exception path |
> | `06p-the-guarantee-and-the-nesting.md` | 288 | 5 | the guarantee is conditional on `__enter__`; multi-item nesting |
>
> **BEFORE 351L / 6★ → AFTER 1,091L / 20★.** Both up. Nothing dropped.
>
> ## 🔴 OWED: `06q-contextlib-when-the-object-does-not-cooperate.md`
> `06o` and `06p` each carry a **de-linked** forward reference to it — bold plus
> *(not written yet)*, per the class-1 rule — and `06p`'s footer `Next` currently points at
> `06k` instead. **All three must be repointed when 06q lands.** Its material is already
> banked and needs no fetching: research §21.2 has `@contextmanager`'s *"the generator must
> reraise that exception"*, `closing`'s own equivalent implementation, `ExitStack`'s
> reverse-order sentence, and `suppress`. Seat it at the position after `06p` and renumber
> the tail.
>
> ## Research bank now runs to §21 — 1,191 lines
> `research_python_p01_t12_eafp_vs_lbyl.md` §21 was appended this session: the seven `with`
> steps verbatim, the step-5 guarantee note, **all three paragraphs of step 7**, the
> multi-item equivalence, and the four `contextlib` entries. Its `What §21 could NOT settle`
> list has two entries — **the `object.__enter__`/`__exit__` datamodel section was never
> retrieved** (the page truncated), so the often-quoted *"should not reraise the passed-in
> exception"* line is **not banked and must not be quoted** until someone fetches it.
>
> ## 🔴 Three facts this session paid for
> 1. **Steps 2 and 3 of `with` are LOOKUPS and precede the step-4 call.** A manager missing
>    `__exit__` therefore fails having acquired nothing, and an `__exit__` swapped during the
>    suite is not the one that runs. Neither fact is in prose anywhere — only in the numbered
>    order.
> 2. **A truthy `__exit__` is NOT the same defect as a `return` in a `finally`.** Step 7's
>    third paragraph — *"If the suite was exited for any reason other than an exception, the
>    return value from `__exit__()` is ignored"* — means it cannot discard a `return`,
>    `break` or `continue`. The old 06h asserted the two were equivalent. Corrected.
> 3. **The cap hook is the split trigger, and it fires mid-write.** Two drafts came back over
>    cap (342 and 334) and each split again on a boundary it already had. That is the rule
>    working, not a mistake — write it all, then split, and expect the count of chunks to
>    exceed the plan.
>
> **STATE: 55 files, 13,663 lines in the topic dir.** 0 MDX hazards (44 files scanned),
> `yarn linkcheck` 55 files / 0 problems, every page badged and `> Verified:`, no
> `{/* FOOTER */}`, no duplicate `sidebar_position`. `src/data/progress.js` is still
> **untouched at `pages: 15`** and the phase README still says 15 of 16 — correct, because
> three over-cap files remain and a topic with a cap breach is not closed.
>
> ⚠️ **Still owed by this lane, unchanged:** the 38 Python topic READMEs that violate
> `house-style.md` line 64 (`sidebar_position: 0`, `sidebar_label: "Overview"`). Topic 12's
> README is one of them — it carries `12` and `"12 · EAFP vs LBYL"`. Found, not fixed; the
> per-file list is `devbible/README-FRONTMATTER-DRIFT.md`.



---

> 🗄️ **1570 lines of superseded history moved to [progress_python_pages-HISTORY.md](progress_python_pages-HISTORY.md) on 2026-09-08**, verbatim —
> earlier session blocks, the wind-downs they came from, and the reasoning behind decisions
> already applied above. Nothing was dropped. Reach for it when you need *why*, or when
> something here refers to a session you have no record of:
> ```bash
> grep -n -i '<term>' devbible/progress_python_pages-HISTORY.md
> shared/scripts/recall.sh --cold <terms>
> ```

---

<!-- rotated out of progress_python_pages.md on 2026-09-08 -->

> # ⏹️ WOUND DOWN 2026-09-04 — TOPIC 12 WRITTEN, **NOT CLOSED** (session `57732ef2`)
>
> **START HERE → split the FOUR over-cap files in
> `docs/python/pages/phase-1-language-core/12-eafp-vs-lbyl/`. That is the only thing
> standing between phase 1 and 16/16.** The boundaries are already measured — do not
> re-derive them:
>
> | File | Lines | Cut at | Keeps | New file takes |
> |---|---:|---|---|---|
> | `06h-finally-and-the-widest-handler.md` | **351** | `## with is the sanctioned form` | clause order (~170) | the `with` material: the seven steps, the **conditional** `__enter__` guarantee, multi-item nesting (~239) |
> | `06l-the-else-you-cannot-write.md` | **321** | `## except and except* do not mix` | grammar + clause-order table + loop `else` (~252) | `except*` (~118 — thin, and the half with the most room to grow) |
> | `06j-ambient-state-the-guard-cannot-see.md` | **305** | `## Warning filters` | `decimal` contexts, traps, per-thread, the readable flag (~188) | warning filters: the `"error"` action, the default filter list, the spec format, `catch_warnings` (~175) |
> | `06m-the-guard-the-platform-deletes.md` | **320** | `## And the check can lie` | `-O`/`-OO`/`PYTHONOPTIMIZE` and the deleted `assert` (~160) | `os.access` + `os.path.exists` + `## The three questions to ask of any guard` (~218) |
>
> Free `sidebar_position`s: the topic runs **120–139, [140 = the chapter dir], 141–160**
> with no gaps, so the four new files need **161–164** *or* a renumber. Reading order in
> chapter 06 is **06 06b 06c 06d 06e 06f 06g 06h 06k 06i 06l 06j 06m** — the letters do
> **not** run in sequence and `sidebar_position` is the truth.
>
> **STATE: 52 files, 12,923 lines, 277 ★.** 0 dangling links across all of `docs/python`,
> 0 MDX hazards, every page badged and `> Verified:`, no `{/* FOOTER */}`, no duplicate or
> gapped `sidebar_position`, zero `*(not written yet)*` placeholders. `progress.js` is
> **untouched at `pages: 15`** and the phase README says 15 of 16 in as many words — a
> topic with a cap breach is not closed and must not be rounded up.
>
> ## 🔴 The first nested chapter directory in the corpus
>
> `12-eafp-vs-lbyl/05j-designing-the-failure-channel/` — `_category_.json` + `README.md` +
> ten chunks numbered `01`–`10`. Chunk 05j was dispatched as ONE chunk, came back as ten
> (2,395 lines), and the user ordered the promotion. `sidebars.js` autogenerates from
> `dirName`, so a nested directory renders as a nested collapsible category with **no config
> change**; `_category_.json` `"position": 140` seats it between `05i` (139) and `06` (141).
> Nothing else in devbible nests a chapter inside a topic — this is the pattern to copy.
>
> ## 🔴 Four lessons this session paid for
>
> 1. **Parallel forks each number `sidebar_position` from the topic base.** Six collisions.
>    **Hand every fork its position RANGE in the dispatch.**
> 2. **A link checker that only matches `./`, `../` and `/` silently passes every
>    bare-filename link** — which is nearly all of them here. Four dangling links sat in
>    files I had already committed as "0 dangling". Match `](name.md)` too.
> 3. **Renaming files fixes hrefs and leaves the link TEXT stale.** 28 links read
>    "as 05m argued" while pointing at `04-the-bill-every-caller-pays.md`. **No mechanical
>    check tests whether a link's text still matches its target** — it took a human-ish read
>    of all ten chunks to find. When you rename, sweep the text as a separate pass.
> 4. ⚠️ **Reflowing prose to hit exactly 300 is sizing to the cap.** An author closed 3–51
>    line gaps by rewrapping paragraphs at 93 columns, taking one file 303 → exactly 300. No
>    words were lost, but "just under the cap" is the documented tell of a budgeted page.
>    Prefer the split.
>
> ## Owed by the PYTHON lane specifically
>
> 🔴 **38 Python topic READMEs violate `house-style.md` line 64** (`sidebar_position: 0`,
> `sidebar_label: "Overview"`); they carry the topic number and a numbered label. A
> corpus-wide audit on 2026-09-04 (commit `5a8e67d7`) ruled **the rule correct and the corpus
> drifted** — 473 of 608 READMEs already conform — and deliberately **skipped Python because
> this lane was lock-held**. Per-file list:
> `my-learning/claude/devbible/README-FRONTMATTER-DRIFT.md`. Python does not have the
> sort-order bug java/js/ts have (chunks here number 120+, READMEs 1–16) so it is cosmetic,
> but it is now this lane's debt. The two indexes written this session
> (`12-eafp-vs-lbyl/README.md` at 12, matching its 15 siblings) are part of it; the new
> chapter index correctly uses `0`/`"Overview"`.
>
> **Research bank**: `research_python_p01_t12_eafp_vs_lbyl.md`, now **19 sections**, includes
> a `## What is NOT settled by any source above` list. Two claims must STAY unsettled:
> whether bytecode caching suppresses a repeat `SyntaxWarning`, and whether `sys.exception()`
> reports the saved exception inside a `finally` clause.

> # 🚧 IN FLIGHT 2026-09-03 — TOPIC 12 · EAFP vs LBYL (the last topic of phase 1)
>
> **START HERE → `docs/python/pages/phase-1-language-core/12-eafp-vs-lbyl/`.** Eight
> chunks are written, committed and QC-clean; the topic is **not** closed. Research is
> banked at `devbible/research_python_p01_t12_eafp_vs_lbyl.md` — **11 sections of verbatim
> quotes, do not re-derive**, and add to it rather than re-fetching.
>
> **On disk and committed** (`6750d0ce`, `a5d9bf9c`, `dc805f99`):
> `01-the-two-names` · `01b-why-python-leans-eafp` · `02-the-race-between-look-and-leap`
> · `02b-the-filesystem-and-the-atomic-flag` · `02c-databases-queues-and-when-lbyl-clears`
> · `03-mappings-the-decision-table` · `03b-writing-on-a-miss`
> · `03c-sequences-sets-and-nested-lookups`. Every one drafted over the cap and split on a
> concept boundary, each split proven UP (332→477/6→9★, 424→736/7→17★, 442→687/8→20★).
>
> **Still owed:** `04` attributes and duck typing (`hasattr`/`getattr`/`getattr_static`,
> `iter()` as the only reliable iterable test, the `collections.abc` caveat) · `05` where
> LBYL is right (trust boundaries, irreversible leaps, type-checker narrowing) · `06`
> narrowing the `try` (one assumption per handler, the `else` clause, translation at
> boundaries) · `07` the cost argument (the two 3.11 quotes and nothing more) · then
> `README.md` + a final pass turning every `*(not written yet)*` placeholder into a link.
>
> 🔴 **The placeholder debt is deliberate and must be paid at close.**
> `grep -rn 'not written yet' docs/python/pages/phase-1-language-core/12-eafp-vs-lbyl/`
> lists every forward reference to repoint; the topic is not closed while one names a file
> that now exists. **Inbound pointers to go live at close:** `11-exceptions/README.md`
> (lines ~106, ~125), `11-exceptions/11-suppress-and-the-explicit-ignore.md` (~107, ~185),
> `11-exceptions/13b-losing-it-across-a-boundary.md` footer, `13-unpacking/README.md`
> footer, `13-unpacking/01-tuple-assignment.md` footer, `03-strings/02b-replacing-case-and-classification.md`
> (~114), plus the phase README row 12, `docs/python/pages/README.md` and `src/data/progress.js`.

> # 📋 CONTENT REVIEW OF PHASE 2, 2026-09-03 — and what it found
>
> **Position is unchanged: START HERE → `docs/python/pages/phase-1-language-core/12-eafp-vs-lbyl/`.**
> Phase 1 is 15 of 16; phase 2 is closed 10/10 by the second session. This block
> records a *review*, not new content.
>
> ## 🔴 THE MECHANICAL PASS IS NOT A REVIEW — say which one you did
> Phase 2 passed every mechanical check on the first look: 0 over cap, 0 dangling
> of every link resolved, 0 MDX hazards, 0 duplicate positions, 0 footer markers,
> every chunk badged and sourced. **It still had four factual errors in one topic,
> two of them making the code non-runnable.** When asked "did you review it", the
> honest answer was no — structure had been checked, claims had not. Do not report
> a mechanical pass in language that implies a content review.
>
> ## The depth signature that flagged phase 2 as a template
> 10 topics, 38 files, **5,262 lines, 81 ★, 134 questions** — and *every*
> Understand/Know topic came in at exactly 2 chunks / 6 ★ / 10 Q, *every* Master
> topic at exactly 4 / 12 / 19-20. That is 3 gotchas and 5 questions per page
> across all 38 files, **no page ever crossing the cap, and therefore no splits
> at all**. Compare phase 1: topic 11 alone is 6,870 lines / 202 ★, and
> substantive section counts run 152 (topic 11) and 84 (topic 09) against phase
> 2's 18-19 for a *Master* topic. Uniformity is the tell the rules name.
> **Phase 2 is accurate and correctly wired, and it is sized to a target rather
> than exhausted. It is worth re-opening for extension, Master rows first (02
> parameters, 03 closures, 05 decorators).**
>
> ## What the content review found (4 topics read, claims checked against source)
> Reviewed 09 · annotations, 02 · parameters, 03 · closures, 05 · decorators.
> **02 and 03 are correct** — the reference quote on definition-time defaults,
> `__defaults__` mutation, the `None` idiom, the `object()` sentinel, cell
> objects, `types.CellType` and all three late-binding fixes all check out.
>
> **Topic 09 had four defects**, fixed by the other session in `eef608ad`:
> `Format.SOURCE` does not exist (PEP 749: *"The `SOURCE` format is renamed to
> `STRING`"*) and was in runnable code; the format integers were wrong (the real values
> are VALUE=1, VALUE_WITH_FAKE_GLOBALS=2, FORWARDREF=3, STRING=4, so its
> `__annotate__(3)` captioned as strings actually asks for FORWARDREF); it
> claimed three formats when there are four; and it advised removing
> `from __future__ import annotations` as "obsolete" when PEP 749 says it
> *"will continue to work as it did before"* in 3.14 and removal **changes
> behaviour**.
> **Topic 05 had three**, also fixed: the phase gate was not met literally
> (`retry(max_attempts, delay)` with a constant sleep, never shown on a method →
> now `retry(times=3, backoff=0.1)` with `current_delay *= 2.0`, demonstrated on
> a function *and* a method); `__type_params__` was missing from the
> `WRAPPER_ASSIGNMENTS` list; and `__wrapped__` was credited with what
> `ParamSpec` does for type checkers.
>
> ## 🔴 A FIX CAN INTRODUCE A DEFECT — re-check the fix, not the commit message
> `eef608ad` filled in the previously-missing `VALUE_WITH_FAKE_GLOBALS` with an
> inverted description: *"used by static and cross-module inspection tools"*,
> producing ForwardRef proxies. The reference says it *"is only used internally
> and should not be passed to the functions in this module"*, and that an
> annotate function receiving it should return the `VALUE` result or raise
> `NotImplementedError`. Corrected in **`d8124d26`** (pushed) with the quote
> inline, plus the interview answer and the topic README row.
> **Lesson: verify a fix against the source, not against its commit message.**
>
> ## Style deviations in phase 2, noted not "fixed"
> Its `> Verified:` lines cite sections by number where the rest of the Python
> track links URLs (the 09 chunks were later given links), and it asserts program
> output in `#` comments (`# ([1, 2],)`, `# (<cell at 0x...>)`) from a session
> with no sandbox. Its footers use the corpus's **dominant** form
> (`← [Topic index] · Next →`), which is correct house style — phase 1's Python
> topics use the `← Prev: … · Index: … · Next →` variant. Neither is a defect.


> # ✅ TOPIC 11 · EXCEPTIONS CLOSED 2026-09-03. PHASE 1 IS 15 OF 16.
>
> ## START HERE → `docs/python/pages/phase-1-language-core/12-eafp-vs-lbyl/`
> **It is the last topic in phase 1, and it is no longer HELD** — it was
> deliberately deferred so its boundary could be drawn against what topic 11
> actually says, and topic 11 has now closed. The directory does not exist yet;
> its syllabus row is in `docs/python/syllabus/01-foundations.md`. Topic 11
> hands it three specific set-ups to answer rather than re-derive:
> `11-suppress-and-the-explicit-ignore.md` calls `with suppress(KeyError): del
> d[k]` "the EAFP form" and defers the argument forward (two plain-bold
> pointers, lines ~107 and ~185); `02-the-else-clause.md` owns shrinking the
> `try`; and `05b-choosing-the-exception-type.md` owns catching what the callee
> documents. 🔴 **Those two plain-bold `**EAFP vs LBYL** *(not written yet)*`
> pointers in chunk 11 must become live links when 12 closes**, along with
> `13b`'s footer `Next` and the topic README's footer `Next`.
>
> ## Topic 11 final: 27 chunks + index, 6,870 lines, 202 ★, 128 questions
> Commit `7df71a3a`. 0 over cap · 0 MDX hazards · 0 dangling links · no
> duplicate `sidebar_position` · no `{/* FOOTER */}` markers · footer chain
> unbroken **110 → 136** across all 27 chunks. It is the second-largest topic in
> phase 1 after Numbers.
>
> Written 2026-09-03 by the coordinator: `06b` chaining · `07` custom exceptions
> · `08`/`08b`/`08c` groups and `except*` · `09` traceback objects · `10` assert
> · `11`/`11b` suppress and warnings · `12` logging exceptions · `13`/`13b`
> losing the traceback · the README. Chunks `01`–`06` were a fork's, salvaged
> from snapshot `c4b7b94f`.
>
> ## 🔴 THREE RENUMBERINGS AND ONE RENAME — inbound prose was repointed
> - The planned `08b-except-star-semantics.md` **does not exist**. `08` split
>   and took that slot, so `except*` is **`08c`**. `03f`'s prose pointer was
>   repointed.
> - `11-suppress-and-warnings.md` **does not exist** either. It split into
>   `11-suppress-and-the-explicit-ignore.md` (132) and `11b-warnings.md` (133);
>   `03b`, `03d`, `04`, `04b` and `13` were repointed.
> - `13`/`13b` were renumbered **135/136** so `12-logging-exceptions.md` could
>   take 134.
>
> ## Three splits, every one proven UP, none a trim
> `08` 311L/12★ → 449L/20★ · `11` 335L/13★ → 417L/17★ · `13` 343L/14★ →
> 420L/18★. Each drafted as one file, split on a concept boundary, gotchas and
> questions distributed to the half each belongs to, and new entries added to
> both halves.
>
> ## 🔴 A FORK DIED TWICE ON API 529 — THE COORDINATOR WROTE ITS FILES
> `devbible-author` was dispatched for chunks 11 and 12 and terminated early
> both times (`Overloaded`, HTTP 529), having written **nothing** on disk —
> verified with `git status` and `ls` before rewriting. Lesson worth keeping:
> **check the disk before assuming a dead fork left salvage, and before
> re-dispatching.** The research bank made the rewrite cheap, because the
> primary sources had already been read once.
>
> ## ⚠️ THE PHASE-2 SESSION SWEPT MY BOARD EDITS INTO ITS OWN COMMIT
> My phase board update (14→15 of 16), the nine-file placeholder sweep and my
> `src/data/progress.js` row all landed in **`dfffd68d`** ("python phase 2:
> close topic 09"), not in a phase-1 commit — that session stages more than its
> own paths. The content is correct and in `main`; only the attribution is
> wrong. **Do not re-apply it.** If a future session needs the phase-1 history,
> `7df71a3a` is the content commit and `dfffd68d` carries the boards.
>
> Phase 2 stands at **9 of 10 closed** (through `09-annotations-at-runtime`).


> # 🚧 TOPIC 11 · EXCEPTIONS — 7 of 9 owed chunks written, 2026-09-03
>
> ## START HERE → finish `11-exceptions/`, then write its `README.md`, then `12-eafp-vs-lbyl/`
> **Written and committed today** (research banked once at
> `research_python_11-exceptions.md`, every chunk written from it):
> `06b` chaining (287L) · `07` custom exceptions (286L) · `08`+`08b`+`08c`
> groups and `except*` (741L, a split) · `09` traceback objects (277L) ·
> `10` assert (254L) · `13`+`13b` losing the traceback (420L, a split).
> **Topic 11 stands at 24 files, 6,030 lines, 170 ★** — 0 over cap, 0 MDX
> hazards, no duplicate positions, no footer markers.
>
> **Still owed:** `11-suppress-and-warnings.md` (pos 132) and
> `12-logging-exceptions.md` (pos 133) — dispatched to a `devbible-author` fork
> (its first attempt died on a transient API 529 having written nothing; it was
> re-dispatched). Then the topic `README.md`, which must list every chunk that
> exists. **Forward links to 11 and 12 are currently plain bold
> `*(not written yet)*` in `10-assert.md`, `13` and `13b`** — convert them to
> live links at close.
>
> ## Two splits today, both proven UP, neither a trim
> - `08` drafted at **311L/12★** → **449L/20★** across `08` (why groups exist,
>   the two classes, raising, nesting, plain `except`) and `08b` (split/subgroup
>   and the fields they preserve, `derive` + the `__new__` rule, `TaskGroup`,
>   handling a group by hand, walking a nested one). `08c` then took `except*`.
>   🔴 **The planned name `08b-except-star-semantics.md` was NOT used** — the
>   split needed that slot, so `except*` is `08c`. The prose pointer in `03f`
>   was repointed accordingly.
> - `13` drafted at **343L/14★** → **420L/18★** across `13` (six ways your own
>   code drops it) and `13b` (the boundaries that drop it for you).
>
> ## Facts banked from this topic that are worth keeping
> - `raise … from None` sets `__suppress_context__`; the docs say the original
>   stays *"available in `__context__` for introspection"*. **It hides, it does
>   not delete.**
> - A custom exception `__init__` whose parameters are not reproduced by `args`
>   breaks `pickle`/`multiprocessing`/`concurrent.futures` reconstruction — and
>   **never fires in single-process tests.**
> - `except*`: every matching clause runs, at most once each; the `as` target is
>   **always a group**, even for a naked exception (wrapped with an empty
>   message); `break`/`continue`/`return` are a `SyntaxError` inside it; a bare
>   `except*:` does not exist; `except*` cannot catch the group types.
> - `assert`: the code generator **emits no code** under `-O`, and `__debug__`
>   cannot be assigned — which is the whole argument against asserting anything
>   security- or validation-shaped.
> - `concurrent.futures` docs say only picklable objects cross, and **do not
>   state whether the traceback object survives** — written as explicitly
>   uncertain, with "capture `format_exc()` in the worker" as the advice.
> - asyncio: an exception on a future nobody awaits is reported only *"when the
>   Future object is garbage collected"*.
>
> ## ⚠️ Phase 2 is a second session and it is closing fast
> `agy` has closed phase-2 topics **01–05** (`e7edd24c`, `7c9bca7c`,
> `c0615c3c`, `961c1243`, `c24a6343`) and is banking its own research files.
> Everything is pushed: `origin/main` == `main` at `2b2f8a62`. It also writes
> its **own** `Python (Phase 2)` row in `LOCKS.md` — that was authorised in its
> dispatch prompt and it has not touched the phase-1 block.


> # ✅ TOPIC 09 · COMPREHENSIONS CLOSED 2026-09-03. PHASE 1 IS 14 OF 16.
>
> ## START HERE → `docs/python/pages/phase-1-language-core/11-exceptions/`
> **Finish it, then close it.** 15 chunks are on disk and committed (snapshot
> `c4b7b94f`); there is **no `README.md`**, and the fork was killed **mid-split
> at 309 lines**, so `06-the-raise-statement.md` and `05b` may be half-splits —
> check both before trusting them. Planned, referenced by existing chunks and
> **not written**: `06b-exception-chaining.md`, `07-custom-exceptions.md`,
> `08-exception-groups.md`, `08b-except-star-semantics.md`, `10-assert.md`,
> `11-suppress-and-warnings.md`, `13-losing-the-traceback.md`. Then, and only
> then, `12-eafp-vs-lbyl/` — still deliberately HELD until 11 closes.
>
> ## What 09 took to close, and the decision inside it
> Commits `d6908d1b` (content) and `b5827818` (boards). It closed at **19 chunks
> + index, 4,739 lines, 113 gotchas, 92 interview questions** — 0 over cap, 0
> MDX hazards, 0 dangling links, no duplicate `sidebar_position`, no
> `{/* FOOTER */}` markers, footer chain unbroken 90 → 108.
>
> 🔴 **The fork had left `08b`'s footer pointing at a chunk it never wrote**
> (`Next → **When the comprehension is right** *(not written yet)*`). Two ways
> to close that: repoint 08b at topic 10 and drop the promise, or write the
> chunk. **The chunk was written** (`09-when-the-comprehension-is-right.md`,
> 271 lines) — 08/08b are six tests for *no* and nothing carried the positive
> case, so dropping it would have been a trim disguised as a close. Its spine:
> PEP 202's rationale is *creating a container*; the expression property is the
> one thing a loop cannot do (there is nowhere in a dict display to put a `for`
> statement); and the all-or-nothing binding — a comprehension that raises
> leaves the name **untouched** where a loop leaves a half-populated list — is a
> **correctness** argument for the comprehension, which the corpus did not have.
>
> ## Placeholder sweep found six, including two dead footer links
> `**Comprehensions** *(not written yet)*` was still in topics 07, 08, 10 and 15
> — two of them `Prev`/`Next` footer links with **no destination at all**. All
> six repointed at `../09-comprehensions/README.md`. The sweep is per-close and
> nothing prompts it.
>
> ## ⚠️ PHASE 2 IS LIVE IN ANOTHER SESSION — it is not yours
> A second agent ("agy") was dispatched 2026-09-03 with a written prompt and
> owns **`docs/python/pages/phase-2-functions/` only**. It closed **01 · def and
> return** (`e7edd24c`) and **02 · Parameters in full** (`7c9bca7c`) and was
> mid-`03-scope-and-closures/` at the time of writing. Both were QC'd and
> **pushed to `origin/main`** from this session. Consequences:
> - `src/data/progress.js`, `docs/README.md` and `docs/python/pages/README.md`
>   are being edited by **both** sessions. Change **only your own row**, verify
>   with `git diff <file>` before staging, and never `git add -A`.
> - A cap or link warning inside `phase-2-functions/` is **not yours to fix**.
> - There were **no worktrees** — `git worktree list` shows one entry. The
>   "merge the worktrees" instruction resolved to pushing two unpushed commits.


> # ✅ PHASE 2 COMPLETE — 2026-09-03 (session c1a63ca9)
>
> ## ALL 10 TOPICS CLOSED · 37 files (27 chunks + 10 indexes), 5,197 lines, 0 over cap, 0 MDX hazards, 0 dangling links
> **Topic 01 · `def` and `return` CLOSED** at 2 chunks + index, 463 lines, 6 ★.
> **Topic 02 · Parameters in full CLOSED** at 4 chunks + index, 897 lines, 12 ★.
> **Topic 03 · Scope and closures CLOSED** at 4 chunks + index, 806 lines, 12 ★.
> **Topic 04 · `lambda` CLOSED** at 2 chunks + index, 357 lines, 6 ★.
> **Topic 05 · Decorators CLOSED** at 4 chunks + index, 770 lines, 12 ★.
> **Topic 06 · `functools` CLOSED** at 3 chunks + index, 590 lines, 9 ★.
> **Topic 07 · Callables beyond functions CLOSED** at 2 chunks + index, 375 lines, 6 ★.
> **Topic 08 · Docstrings CLOSED** at 2 chunks + index, 359 lines, 6 ★.
> **Topic 09 · Annotations at runtime CLOSED** at 2 chunks + index, 289 lines, 6 ★.
> **Topic 10 · Recursion and the limit CLOSED** at 2 chunks + index, 291 lines, 6 ★.
>
> | Topic | State | Chunks | Lines | ★ | Gotchas | Q |
> |---|---|---|---|---|---|---|
> | 01 · `def` and `return` | ✅ CLOSED | 2 + index | 463 | 6 | 8 | 10 |
> | 02 · Parameters in full | ✅ CLOSED | 4 + index | 897 | 12 | 15 | 18 |
> | 03 · Scope and closures | ✅ CLOSED | 4 + index | 806 | 12 | 11 | 15 |
> | 04 · `lambda` | ✅ CLOSED | 2 + index | 357 | 6 | 5 | 10 |
> | 05 · Decorators | ✅ CLOSED | 4 + index | 770 | 12 | 10 | 15 |
> | 06 · `functools` | ✅ CLOSED | 3 + index | 590 | 9 | 7 | 11 |
> | 07 · Callables beyond functions | ✅ CLOSED | 2 + index | 375 | 6 | 6 | 10 |
> | 08 · Docstrings | ✅ CLOSED | 2 + index | 359 | 6 | 5 | 10 |
> | 09 · Annotations at runtime | ✅ CLOSED | 2 + index | 289 | 6 | 5 | 10 |
> | 10 · Recursion and the limit | ✅ CLOSED | 2 + index | 291 | 6 | 4 | 10 |
>
> 🏁 **PHASE 2 IS FINISHED.** Next Phase in syllabus: Phase 3 · Collections in depth.
>

> # 🔴🔴 COLD START — READ THIS BLOCK FIRST, 2026-09-02, wound down at 100% usage
>
> ## START HERE → `docs/python/pages/phase-1-language-core/09-comprehensions/README.md`
> **That index does not exist yet. Writing it is the single next action.** Then
> the same for `11-exceptions/README.md`. Both topics are part-written on disk
> and **UNCOMMITTED** — see the salvage list below before doing anything else.
>
> ## ⚠️ THERE IS UNCOMMITTED WORK ON DISK. IT IS SALVAGE, NOT SCRAP.
> The user declined the snapshot commit three times and then ended the session,
> so **21 paths are uncommitted in `docs/python/`**. Nothing is over the 300-line
> cap. Run `git status --porcelain docs/python/` first and expect:
>
> | State | Paths |
> |---|---|
> | Modified | `09-comprehensions/03-scope-and-the-target.md`, `09-comprehensions/05-generator-expressions.md`, `11-exceptions/03-finally-and-its-guarantees.md` |
> | New (untracked) | `09`: `05b`, `05c`, `06`, `06b`, `07`, `07b`, `08`, `08b` · `11`: `03f`, `03g`, `04`, `04b`, `05`, `05b`, `05c`, `06` |
> | Deleted | `11-exceptions/.moved.txt` (a fork's scratch file — the deletion is correct) |
> | Untracked dir | `docs/python/pages/phase-2-functions/` — **scaffolding only**: `_category_.json` + a 65-line phase `README.md`. No topic content. **The user interrupted the first phase-2 topic write, so treat starting phase 2 as UNAPPROVED until they say otherwise.** |
>
> 🔴 **Decide deliberately: commit as a labelled snapshot, or delete.** Do not
> leave it a third session running. If committing, use explicit paths, label it
> "SNAPSHOT OF WORK IN FLIGHT", and put **no line counts** in the message (a
> pathspec commit re-reads the worktree).
>
> ## Where phase 1 actually stands: **13 of 16 CLOSED**
> Closed and committed: **01, 02, 03, 04, 05, 06, 07, 08, 10, 13, 14, 15, 16.**
>
> **Not closed:**
> - **09 · Comprehensions** — 18 chunks on disk (`01` … `08b`), **no `README.md`**.
>   Fork killed while writing `05c`. Has dangling links to `08-when-it-should-have-been-a-loop.md`
>   (which now exists) and to its own missing `README.md`.
> - **11 · Exceptions** — 15 chunks on disk (`01` … `06`), **no `README.md`**.
>   Fork killed **mid-split at 309 lines**, so its last file may be a half-split;
>   check `06-the-raise-statement.md` and `05b` before trusting them. Planned but
>   never written, and referenced by existing chunks: `06b-exception-chaining.md`,
>   `07-custom-exceptions.md`, `08-exception-groups.md`, `08b-except-star-semantics.md`,
>   `10-assert.md`, `11-suppress-and-warnings.md`, `13-losing-the-traceback.md`.
> - **12 · EAFP vs LBYL** — 🔴 **deliberately HELD**, not merely unwritten. It
>   overlaps 11's try/except-cost material and fork B was told to refer to EAFP
>   forward in plain bold. **Write 12 only after 11 closes.**
>
> ## The close checklist for 09 and 11 (nothing prompts you)
> 1. Write the `README.md` index listing **every chunk that exists**.
> 2. Fix the footer `Next` chain end-to-end in `sidebar_position` order.
> 3. Demote every link to a never-written chunk to plain bold `*(not written yet)*`.
> 4. `grep -h '^sidebar_position:' *.md | sort -n -k2 | uniq -c | awk '$1>1'`
> 5. Resolve every relative link with `test -e` — `fixlinks.py` passes this class silently.
> 6. `mdxcheck` with `&&` **before** the commit.
> 7. Placeholder sweep across the phase, then boards: phase README, `src/data/progress.js`.
>
> ## Session result, 2026-09-02 — nine topics closed
> 05 (12 chunks/3,261L) · 06 (23/5,531, fork) · 07 (25/6,662, fork) · 08 (6/1,692) ·
> 10 (4/1,101) · 13 (3/802) · 14 (2/609) · 15 (2/546) · 16 (2/507).
> **20,711 lines, 609 gotchas, 566 interview questions.** All at 0 over cap,
> 0 MDX hazards, 0 dangling, unbroken footer chains, no duplicate positions.
> Ten drafts went over cap and were **split, never trimmed**, each proven UP.
>
> ## ⚠️ `main` is shared — HEAD is not yours
> At wind-down `HEAD` was `95686ce0`, a **real-world** track commit from another
> live session. Your python commits are below it. **Never `git add -A`.**


> ## ✅ TOPICS 14, 15, 16 CLOSED 2026-09-02. PHASE 1 IS 13 OF 16.
> **START HERE → whichever of `09-comprehensions/` or `11-exceptions/` a fork
> left unfinished — CHECK DISK FIRST — then `12-eafp-vs-lbyl/`.**
>
> Closed today by the coordinator: **05** (12 chunks), **08** (6), **10** (4),
> **13** (3), **14** (2), **15** (2), **16** (2). By forks: **06** (23), **07**
> (25). **Nine topics, 20,711 lines, 609 gotchas, 566 interview questions**, all
> at 0 over cap / 0 MDX hazards / 0 dangling / unbroken footer chains.
>
> **Only three topics remain in phase 1:**
> - **09 · Comprehensions** — fork A, in flight, snapshotted not closed
> - **11 · Exceptions** — fork B, in flight, snapshotted not closed
> - **12 · EAFP vs LBYL** — 🔴 **deliberately HELD.** It overlaps topic 11's
>   try/except-cost material and fork B was told to refer to EAFP forward in
>   plain bold. Write it only after 11 closes, so the boundary is drawn against
>   what 11 actually says rather than against a guess.
>
> ⚠️ **A phase-wide link resolve currently reports ~48 dangling — ALL inside the
> two live fork directories**, pointing at their own not-yet-written chunks and
> indexes. **That is normal mid-work and is NOT a defect to fix.** Do not touch
> a fork's directory to "repair" it; the fork's own close-pass QC covers it. The
> coordinator's directories resolve clean.
>
> ⚠️ **The file-size hook is GLOBAL and will flag a fork's mid-split drafts.**
> Two forks wasted a report section on this today, and a third flag fired for
> `09-comprehensions/06-dict-and-set-comprehensions.md` at 335 lines while its
> fork was still working. **Never act on a cap warning for a path you do not
> own.** Verify with `find docs/python -name '*.md' -exec wc -l {} + | awk '$1>300'`
> and only act on your own rows.
>
> **Placeholder sweeps done at each close.** Running total this session: 4 after
> 05, 7 after 06, 16 after 07, 1 after 10, 1 after 13, 2 after 15/16. The sweep
> is per-close and nothing prompts it:
> ```bash
> grep -rn '\*\*<TopicName>\*\* \*(not written yet)\*' docs/python/pages/
> ```
> **Exclude any directory a fork still owns.**
>
> **Facts banked from 14/15/16:**
> - Mutating methods return `None` as **command–query separation**; the five
>   deliberate exceptions are `list.pop`, `dict.pop`, `dict.popitem`, `set.pop`,
>   `dict.setdefault`.
> - `is None` beats `== None` for three escalating reasons, and the third is
>   correctness: `arr == None` on numpy returns an **array** and then raises.
> - SQL's `NULL = NULL` is *unknown* while Python's `None == None` is `True`, so
>   a parameterised `WHERE col = ?` bound to `None` matches **no** rows.
> - `__name` is name **mangling**, not privacy — `obj._Class__name` reaches it.
>   Its job is subclass collision avoidance.
> - `tuple[int]` is a **one-element** tuple; `tuple[int, ...]` is the
>   variable-length form. The most common real `Ellipsis` bug.
> - `Ellipsis` is a builtin **name**, not a keyword: `Ellipsis = 5` is legal,
>   `... = 5` is a `SyntaxError`.
> - PEP 20's line is *"one — and preferably only one — **obvious** way"*, not
>   "only one way"; it is routinely misquoted to reject reasonable code.
>
> **Boards wired:** phase README 11/16 → 13/16; `src/data/progress.js` → 13.


> ## ✅ TOPICS 10 + 13 CLOSED 2026-09-02. START HERE → `phase-1-language-core/14-none-and-no-result/`
> **Phase 1 is 10 of 16** (01–08, 10, 13). **09 · Comprehensions and 11 ·
> Exceptions are IN FLIGHT with forks** — check disk, do not assume. Unclaimed:
> **12 · EAFP vs LBYL**, **14 · `None` and the no-result contract**, **15 · PEP 8
> and idiom**, **16 · `del`, `pass`, `Ellipsis`**.
>
> ⚠️ **12 is deliberately NOT next for the coordinator**: it overlaps topic 11's
> try/except-cost material, and fork B's brief told it to treat EAFP as topic 12
> and refer forward in plain bold. Write 12 only after 11 closes, so the boundary
> is drawn against what 11 actually says.
>
> | Topic | Chunks | Lines | ★ | Gotchas | Q |
> |---|---|---|---|---|---|
> | 10 · `match` | 4 + index | 1,101 | 12 | 35 | 29 |
> | 13 · Unpacking | 3 + index | 802 | 9 | 26 | 22 |
>
> **Facts banked while writing, all verified at the source:**
> - **`match`:** a bare name is a CAPTURE pattern — `case OK:` matches every
>   subject and rebinds `OK`. Only a **dotted** name is a value pattern compared
>   with `==`. This is the single most important fact in that topic and it is a
>   real argument for `Enum` over bare module constants.
> - `str`, `bytes` and `bytearray` are **excluded from sequence patterns** by
>   PEP 634, deliberately, so token patterns cannot decompose a string.
> - Mapping patterns are **partial** and use the two-argument `get()`, so a
>   `defaultdict`'s `__missing__` never fires. `**_` is disallowed outright.
> - `case Shape:` without parentheses is a **value** pattern that never matches
>   an instance; `case Shape():` is the isinstance test.
> - `None`/`True`/`False` in patterns compare with **`is`**, not `==`, so a
>   subject of `1` does not match `case True:`.
> - **Unpacking:** the reference's own example — `x = [0,1]; i = 0;
>   i, x[i] = 1, 2` prints **`[0, 2]`**, because targets are assigned left to
>   right even though the RHS is evaluated first.
> - A starred target **always** yields a `list`, from a tuple or a string alike,
>   and `first, *rest = [1]` succeeds with `rest == []`.
> - PEP 448 asymmetry worth its own gotcha: **`{**a, **b}` resolves a duplicate
>   key later-wins; `f(**a, **b)` raises `TypeError`** for the same input.
> - `{**a, **b}` is a **shallow** merge — the config-layering bug where a nested
>   override drops its siblings. No deep-merge in the stdlib.
>
> **Boards wired:** phase README 9/16 → 10/16; `src/data/progress.js` pages → 10.


> ## ✅ TOPICS 06 + 08 CLOSED 2026-09-02. START HERE → `phase-1-language-core/10-match-pattern-matching/`
> **Phase 1 is 7 of 16** (01, 02, 03, 04, 05, 06, 08). **Topic 07 · Assignment
> and aliasing is IN FLIGHT with a fork** and is committed only as a snapshot —
> check disk, do not assume it closed. **Topic 09 · Comprehensions was dispatched
> to a fresh fork** the moment topic 06 reported. The coordinator took **10 ·
> `match`** next. Unclaimed after that: 11–16.
>
> | Topic | Chunks | Lines | Gotchas | Q | Who |
> |---|---|---|---|---|---|
> | 05 · Truthiness | 12 + index | 3,261 | 101 | 87 | coordinator |
> | 06 · Comparisons | 23 + index | 5,531 | 193 | 161 | fork A |
> | 08 · Control flow | 6 + index | 1,692 | 54 | 45 | coordinator |
>
> **All three verified at close**: 0 over the 300-line cap · 0 MDX hazards · 0
> dangling links resolved against the filesystem (a phase-wide resolve over all
> of `docs/python/pages` reports **0**) · 0 duplicate `sidebar_position` ·
> unbroken footer `Next` chains.
>
> 🔴 **THE FORK-REPORT RULE FIRED AGAIN, AND IN THE HARMLESS DIRECTION THIS
> TIME.** Fork A's final report listed **five over-cap files**, four of them
> mine in `05-truthiness/` and `08-control-flow/`. They were **pre-split drafts**
> the shared file-size hook had flagged while the fork worked — all had already
> been split. A `find docs/python -name '*.md' -exec wc -l {} +` confirmed **0
> files over 300**. Same lesson as the 2026-08 incident where a fork attributed a
> Java page's line count to Python: **the hook's output is global and a fork sees
> other lanes' files. Verify every fork claim against the filesystem before
> acting on it — including a claim that something is BROKEN.**
>
> 🔴 **`git commit` with a pathspec re-reads the worktree — so the in-flight
> snapshot commit for topics 06+07 carries NO line counts, deliberately.** That
> is now the standard shape for committing a live fork's directory: label it
> "SNAPSHOT OF WORK IN FLIGHT", say what was true at staging, and leave the
> numbers to the close pass. Three commit messages on this repo carry counts that
> are permanently wrong for exactly this reason.
>
> ⚠️ **Run `mdxcheck` joined with `&&` BEFORE `git commit`, never after it in the
> same `;`-joined call.** Doing it the wrong way round shipped 3 RAW-TAG hazards
> in `130aea96`, fixed in `560cc02c`. The hazard was a precedence chain written
> as `` `or` < `and` < `not` < comparisons `` — **a bare `<` before a word is a
> JSX tag; write such chains in words.** A second fork independently hit an
> OPEN-SPAN hazard from a line ending in an inline code span when the next line
> began with `{n}`. Both are in the standing fork brief now.
>
> 🔴 **A CLOSE IS NOT DONE UNTIL THE PLACEHOLDER SWEEP RUNS.** Closing 05 made
> 4 placeholders repointable; closing 06 made **7 more** — across topics 02, 03,
> 05 and the phase README, plus 06's own chunk 01 `Prev` and a `README` `Prev`
> the fork had pointed at topic **04** instead of **05**. Nothing prompts you:
> ```bash
> grep -rn '\*\*<TopicName>\*\* \*(not written yet)\*' docs/python/pages/
> ```
> **Exclude any directory a fork still owns** — two Truthiness placeholders sat
> inside `07-assignment-and-aliasing/` and were deliberately left for its close.
>
> **Boards wired:** phase README 4/16 → 7/16 with a close paragraph naming all
> three topics; `src/data/progress.js` phase 1 `pages: 4` → `7`.


> ## ✅ TOPIC 05 · TRUTHINESS CLOSED 2026-09-02. START HERE → `phase-1-language-core/08-control-flow/`
> **Phase 1 is 5 of 16.** Topics **06 · Comparisons** and **07 · Assignment and
> aliasing** were dispatched to two `devbible-author` forks in the same session
> and are IN FLIGHT — check them on disk before assuming anything about them.
> The next UNCLAIMED topic is **08 · Control flow** (`for`/`else`, `while`/`else`,
> `break`/`continue`, `range`, `enumerate`/`zip`), syllabus line 57 of
> `docs/python/syllabus/01-foundations.md`, tier Understand.
>
> ### Topic 05 final: 12 chunks + index, 3,261 lines
>
> | Chunk set | Files | Covers |
> |---|---|---|
> | `01`, `01b`, `01c` | 3 | the falsy rule and list · the `__bool__`/`__len__` protocol · what `if x:` costs |
> | `02`, `02b`, `02c` | 3 | empty-vs-missing · the code shapes + sentinels · tri-states and the API boundary |
> | `03`, `03b` | 2 | `and`/`or` return operands · precedence and negation |
> | `04`, `04b` | 2 | `any`/`all` and `all([])` · finding the element, `next`, itertools |
> | `05`, `05b` | 2 | the walrus · its rules, bans and comprehension scoping |
>
> **Verified at close** (commits `e3a5e3fd`, `68590cc4`, `130aea96`, `560cc02c`,
> `1c344cb9`, `97a90b33`, `4e8bee0e`, `ef07231c`): 0 over the 300-line cap
> (largest 294) · 0 MDX hazards · 0 dangling links resolved against the
> filesystem · 0 duplicate `sidebar_position` · unbroken footer `Next` chain
> from position 50 to 61 · **28 ★, 101 gotchas, 87 interview questions.**
>
> 🔴 **FIVE SPLITS, EVERY ONE PROVEN UP.** Not one chunk was drafted to fit.
> `01` went 404 → 600 (3★→4, 9 gotchas→16), then its `01b` half went 332 → 530
> (10 gotchas→16, 7 Q→14). `02` went 360 → 570 (3★→5, 10→18 gotchas), then `02b`
> went 336 → 565. `03` went 345 → 571 (3★→6). `04` went 313 → 480 (3★→5).
> **The before/after numbers are the proof a split was a split and not a trim** —
> record them in the commit message every time.
>
> ⚠️ **mdxcheck ran AFTER the commit in one `;`-joined call and 3 RAW-TAG hazards
> shipped in `130aea96`**, fixed in `560cc02c`. The hazard was a bare precedence
> chain `` `or` < `and` < `not` < comparisons `` outside a code fence — a bare
> `<` before a word is a JSX tag. **Run mdxcheck with `&&` BEFORE `git commit`,
> never after it in the same call.** And a precedence chain written with `<`
> needs the operators spelled in words, not backticked-and-angled.
>
> ⚠️ **`mdxcheck.py`'s clean output is `0 MDX hazard(s) in 0 file(s)` — the
> second number counts files WITH hazards, not files scanned**, so it is
> identical to the nonexistent-path false clean this file warns about. Positively
> control it once per session: a scratch file containing a bare `<module>`
> must report `1 MDX hazard(s) in 1 file(s)`. Done this session; it works.
>
> 🔴 **`sidebar_position` for topic 05 is 50–61** under the topic × 10 scheme,
> with the README keeping `5`. Topic 05 used **twelve** chunks, so it ran past
> the ten slots the scheme nominally affords and into 60–61, which is also where
> topic 06 starts. **This is harmless: `sidebar_position` orders items only
> within their own category, and every topic is its own directory with its own
> `_category_.json`**, so 05's 60 and 06's 60 are never compared. Verified
> against the topic-02 precedent, which ran to 14x and had the same overlap.
> The thing to carry forward is only that **the ×10 scheme is a convenience,
> not a constraint — a topic may exceed ten chunks and should just keep
> counting.** Do not renumber committed files to 'fix' it.
>
> **Placeholders left deliberately:** `05b`'s footer Next, and the README's
> 'Where this connects', name **Comparisons**, **Assignment and aliasing**,
> **Exceptions** and **`None` and the no-result contract** as plain bold. The
> first two repoint the moment the forks' READMEs land — the fork-owned files
> `06-comparisons/01-the-six-operators.md` and
> `07-assignment-and-aliasing/06b-fixing-mutable-defaults.md` each carry a
> **Truthiness** placeholder that is now repointable and was NOT touched because
> a live fork owned the directory.
>
> **Boards wired at close:** phase README (4/16 → 5/16 plus a close paragraph),
> `src/data/progress.js` (phase 1 `pages: 4` → `5`, `updated` bumped), and four
> placeholders repointed in topics 02 and 04.


**Lock:** session `f985178b`, claimed **2026-08-27** on *"I want you to pick python"*.
**Scope:** `docs/python/` only, on `main` in the shared checkout. **No worktree.**
Java is a **different lock in the same checkout and it is live** — never stage a Java path,
never `git add -A`.

> ## ✅ PHASE 0 CLOSED 12/12 (2026-08-28 18:16). START HERE → PHASE 1 · LANGUAGE CORE.
> **`docs/python/pages/phase-1-language-core/`** — the directory does not exist yet.
> The topic list is the Phase 1 table in `docs/python/syllabus/01-foundations.md`
> (16 topics), and topic 01 is **Syntax: indentation as structure**.
>
> **Phase 0 final:** 134 files, 31,030 lines. 0 over the 300-line cap, **0 dangling of
> 877 links** resolved against the filesystem, 0 MDX hazards, every topic with a
> `_category_.json` and an index listing every chunk that exists.
>
> | Topic | Chunks | | Topic | Chunks |
> |---|---|---|---|---|
> | 01 · What Python is | 6 | | 07 · Everything is an object | 8 |
> | 02 · The GIL | 8 | | 08 · Imports | 18 |
> | 03 · The release model | 6 | | 09 · `__main__` | 11 |
> | 04 · Installing and versions | 14 | | 10 · Python vs Node | 13 |
> | 05 · Virtual environments | 11 | | 11 · Startup and import cost | 3 |
> | 06 · Running code | **21** | | 12 · `dis` | 2 |
>
> 🔴 **THE CURSOR'S CHUNK ESTIMATES WERE WRONG BY 4x AND THAT IS THE NORMAL CASE.**
> Topic 06 was recorded as needing "three more chunks". Those three exhausted their
> material and became **sixteen** (positions 6–21) — the REPL alone became seven. Never
> size a dispatch to a remembered estimate, and never let a fork treat one as a budget.
>
> 🔴 **RUN THIS AFTER EVERY TOPIC CLOSES** — each close turns placeholders elsewhere into
> repointable links, and nothing prompts you. 24 were repointed across phase 0:
> ```bash
> grep -rn "not written yet" docs/python/pages/<phase> --include=*.md
> ```
> One of them named **`../09-name-main.md`** — the single-FILE path for what is now a
> directory. That is the link resolver's documented blind spot; it reports clean.
>
> **Phase 0's remaining 6 placeholders are correct:** Phase 1 Language core, Phase 2
> Parameters, Phase 7 Packaging, Phase 8 Concurrency, Phase 13 Production.
>
> **Topic 10's shape, so it is never re-derived:** 01 the real question · 02 + 02b Node's
> loop, libuv's four threads, `worker_threads`/`cluster` · 03 + 03b + 03c Python's four
> models, the sync-in-`async def` seam, catching it in CI · 04 + 04b both languages erase,
> checkers and Pydantic-vs-zod · 05 ecosystems · 06 packaging and deployment · 07
> performance · 08 PyPy/GraalPy/Deno/Bun · 09 twelve scenarios.
>
> 🔴 **EVERY COMPARATIVE NUMBER IN TOPIC 10 IS AN ATTRIBUTED PUBLISHED CLAIM, NEVER A
> MEASUREMENT.** PyPy's *"about 3 times faster than CPython 3.11"*, GraalPy's *"geomean ~4x
> faster … on the official Python Performance Benchmark Suite"* and 3.14's 3–5% tail-call /
> 5–10% free-threading figures are quoted with their source named in the same sentence.
> The topic also carries a section telling the reader not to repeat a number they did not
> measure. **Keep that discipline if it is ever extended.**
>
> ⚠️ **A FORK'S REPORT IS NOT EVIDENCE.** This topic's fork reported
> `10-python-vs-node/03-python-model.md` as 306 lines and over cap. It is 257. The 306-line
> file was a **Java** page the shared cap hook had flagged while the fork worked, and the
> fork attributed it to Python. Check every claim a fork makes against the filesystem
> before acting on it — including its QC numbers.
>
> ⚠️ **`mdxcheck.py` prints `0 MDX hazard(s) in 0 file(s)` for a path that does not
> exist** — identical to its clean output. A `cd` that silently failed earlier in the same
> `&&` chain therefore produces a *false clean*. Confirm the path resolved (a `wc -l` in
> the same call) before trusting a clean result.
>
> ⚠️ **A topic README's `sidebar_position` deliberately duplicates one chunk's number** in
> this phase — the README carries the topic's position within the phase while chunks run
> 1..N. Confirmed across topics 05, 06, 08 and 09. Do not "fix" it.
>

> 🔴 **`git commit -- <pathspec>` IGNORES THE INDEX AND COMMITS THE WORKING TREE, 2026-08-28.**
> This is documented git behaviour and it matters here because the pathspec form is the
> **mandated** one in this checkout (it avoids the shared-index race with the concurrent
> Java session). The consequence: **anything you measure or QC before committing can be
> stale by the time the commit runs**, if a fork is still editing the file.
>
> Observed three times in one hour on topic 06, each time on a file a live fork owned:
> - `08b`: measured 304 on disk → commit `4c0413f4` contains **257**.
> - `08c`: hook reported 305 on disk → commit contains **224**.
> - `08d`: `git show :<path>` after `git add` reported **303** → commit `24703d9e`
>   contains **218**, because the fork split it into `08e` in between. Staging did not
>   protect the measurement: the pathspec commit re-read the worktree.
>
> **So the staged-blob trick does NOT work with the pathspec commit form.** The only
> reliable measurement is taken *after* the commit, from the commit itself:
> ```bash
> git commit -m "..." -- <path> && git show HEAD:<path> | wc -l
> ```
> Better still, for a file a fork still owns: **do not put line counts in the message at
> all** — say "snapshot of work in flight" and let a later verification pass state the
> numbers once the file has an owner who has stopped writing. Three commit messages on
> this topic (`4c0413f4`, the `08c` one, `24703d9e`) carry counts and cap claims that are
> wrong on the permanent record for exactly this reason. Nothing was lost — every one of
> those shrinks was a genuine split whose sibling landed — but the descriptions are false.
>
> 🔴 **TWO DEFECT CLASSES FOUND BY A PHASE-WIDE AUDIT, 2026-08-28.** Both pass
> `fixlinks.py`, `mdxcheck.py` and `wc -l` silently, so only an explicit audit finds them.
>
> 1. **27 stale `*(not written yet)*` placeholders** written when the target topic did not
>    exist; 21 of them now resolved to live topics and were repointed. **Re-run this after
>    every topic closes** — each close turns some placeholders elsewhere into repointable
>    links, and nothing prompts you:
>    ```bash
>    grep -rn "not written yet" docs/python/pages/phase-0-runtime --include=*.md
>    ```
> 2. **Literal two-character `\n` sequences** in `08-imports/02d-diagnosing-import-failures.md`
>    — five of them, where paragraph breaks belonged. Two collapsed the file's own
>    `## Gotchas` and `## Interview questions` headings into prose lines so neither
>    rendered as a heading; three glued a gotcha's Symptom onto the previous gotcha's Fix.
>    A writer emitted escaped newlines instead of real ones. Check with
>    `grep -rn '\\n' <dir> --include=*.md` and discount hits inside code strings.
>
> **Phase 0 after the repair: 0 dangling of 786 local links, 0 MDX hazards, 0 files over
> the cap outside the topic still in flight.**
>
> ⚠️ **A topic README's `sidebar_position` deliberately duplicates one chunk's number** in
> this phase — the README carries the topic's position within the phase (10) while chunks
> run 1..N. Confirmed against topics 05, 08 and 09. Do not "fix" it.
>

> 🔴 **VERIFY BEFORE TRUSTING ANY OF THE ABOVE.** These counts were taken at a
> wind-down while two forks were still finishing a file each. Run this first:
> ```bash
> cd docs/python/pages/phase-0-runtime
> for d in */; do echo "$d idx=$([ -f $d/README.md ] && echo Y || echo N) chunks=$(ls $d*.md 2>/dev/null | grep -vc README)"; done
> ```
>
> 🔴 **A WRONG PEP NUMBER WAS IN THIS FILE AND IN THE LOCKS ROW.** Lazy imports
> was recorded here as **PEP 790**. It is **PEP 810 – Explicit lazy imports**
> (Final, targets 3.15); **PEP 790 is the 3.15 release *schedule***. Both verified
> against peps.python.org on 2026-08-28 while writing T11. A PEP number copied
> from memory into a cursor is exactly the kind of fact that then gets copied into
> a page — check it at the source.
>
> ⚠️ **Bash cwd persists between tool calls.** A relative `mkdir -p docs/python/...`
> issued while the shell was still inside `phase-0-runtime` built a whole parallel
> tree at `phase-0-runtime/docs/python/pages/...` and silently swallowed T11's
> `_category_.json`, so the topic had no sidebar label. It "succeeded" — nothing
> errored. **Use absolute paths, or `cd` explicitly in the same command.**

> 🔴 **TOPIC 02 · THE GIL WAS RECORDED AS CLOSED AND WAS NOT, 2026-08-28.** A
> filesystem-resolved link audit of phase 0 (not `fixlinks.py` — it passes this
> silently) found the topic's own index listing 3 chunks and naming **two files
> that have never existed**, plus four more non-existent names in cross-chunk
> links, each guessing a different number for the same two missing chunks. The
> missing material was the answer to the phase's own gate question and the
> track's flagship 3.14 fact. Written here as 4 chunks (05, 05b, 06, 06b), so
> the topic is **8 chunks, not 4**. **The lesson: a topic README that lists
> chunks is not evidence the chunks exist.** Audit every topic marked closed by
> resolving its index links against the filesystem before trusting the count —
> the same failure has now hit three Java phases and one Python topic.
>
> **A correctness fix, not just a gap:** the topic taught "100 HTTP calls speed
> up and 100 checksums do not". False for the checksum anyone would actually
> use — `hashlib` releases the GIL above 2047 bytes per call, so threaded
> `sha256` scales; only a Python byte loop does not. Same for `zlib` and NumPy.
>
> 🔴 **`git commit -m ... -- <paths>` COMMITS ONLY TRACKED PATHS.** New files are
> silently skipped — the first GIL commit carried the index rewrite and none of
> the four new chunks, and the message described files that were not in it.
> `git add <explicit paths>` first, then the pathspec commit. Verify with
> `git show --name-only` every time, because the commit succeeds either way.

> **03 + 04 were salvaged, not written here.** The prior session's fork wrote all 20 pages
> and died before committing; the 05 + 06 fork of that same batch wrote *nothing*, so that
> pair was re-dispatched. QC before staging: 0 files over 300, 0 MDX hazards, 0 unresolved
> links.
>
> 🔴 **A SHARED-INDEX RACE COST THIS TRACK ITS COMMIT, 2026-08-28.** The 24 salvaged
> Python files were `git add`-ed, and before this session's `git commit` ran, the
> concurrent **Java** session committed with **no pathspec** — sweeping all 24 Python files
> into `8b3d66ee`, a commit whose message describes only Java salvage. Nothing was lost and
> history was **not** rewritten (that session is live on `main`). **The fix, adopted here:
> never `git add` then `git commit` as two steps in this checkout — use
> `git commit -m ... -- <explicit paths>`, which commits those paths directly and never
> touches the shared index.** "Never `git add -A`" was already the rule and was followed;
> it is not sufficient on its own, because the *other* session's pathless commit is what
> picks up your staged files.
>
> 🔴 **CEILING: three agents including the coordinator.** User instruction 2026-08-28:
> *"You supposed to deploy max 3 agents including you so maintain like that"*. This
> session dispatched five and killed three within the minute; they were still researching
> and had written no files, so nothing was lost. **Two forks at a time is the rule** — it
> supersedes the six-fork pattern the Java track used before its 95% kill switch.
>
> 🔴 **Forks read `devbible/AUTHOR-BRIEF.md` — do not inline the rules in a prompt and do
> not send a fork to read a template page.** User instruction 2026-08-28: *"When new
> session starts they should use less tokens possible not with 20k + lines … new agents I
> mean"*. The brief is ~90 lines and carries the hard rules **and** the page skeleton, so
> a fork's startup read drops from ~370 lines (274-line template + 90-line topic README)
> to one file. A fork prompt is now ~12 lines: point at the brief, name the slug,
> `sidebar_position`, tier, footer neighbours, and the scope bullets.
>
> **What is NOT controllable from here:** each agent still auto-loads `~/.claude/CLAUDE.md`
> (141 lines) + the project `CLAUDE.md` (57) + the session-start hook (~1.5 KB, measured).
> The genuinely large injection is **claude-mem's observation dump** — the block that
> reported *"50 obs (34,187t read)"* in this session's preamble. `~/.claude-mem/settings.json`
> holds only `CLAUDE_MEM_RUNTIME` and `CLAUDE_MEM_MODEL`; **there is no size knob there**.
> If startup cost must come down further, that plugin's hook is the thing to look at, not
> the brief.

## The syllabus change of 2026-08-27 — why Python is 14 phases, not 13

The user asked, before any page was written:

> *"i want to master language in fullstack project perspective as per industry standard
> does the existing syllabus make sense ? I need a dedicated phase or chapters to explain
> REST apis in order to build a fullstack app CRUD operations to be explained"*

**The audit's answer: it held up as a *language* syllabus and did not hold up as a
fullstack one.** Current and correct on 3.14, free-threading, `uv`/`ruff`, Pydantic v2,
SQLAlchemy 2.0, pytest-first. But the gap was structural, not cosmetic:

- **Phase 9 taught FastAPI mechanics.** Routing, `Depends`, `HTTPException`, uvicorn.
- **Phase 10 taught database drivers.** psycopg, SQLAlchemy, Alembic.
- **Nothing joined them.** No REST design at all — no verb semantics, no status-code map,
  no PUT vs PATCH, no error-body standard, no pagination/filter/sort contract, no
  versioning, no ETags, no idempotency keys. No single resource carried through C/R/U/D.
  No layering (router/service/repository). No transaction boundary — "session via
  `Depends`" was one row and *who commits* was never asked. No frontend contract beyond
  a CORS mention. **DRF absent entirely**, with Django as a single Know row.

**The fix, approved by the user from a 3-option choice:** a new **Phase 11 · REST APIs
and CRUD, end to end — 17 topics**, placed **after** the data phase (you cannot build a
CRUD resource before you have both FastAPI *and* SQLAlchemy — this is why it is not an
expansion of Phase 9). Testing and Production renumbered **11/12 → 12/13**. The renumber
was free: zero pages existed, so it cost four board edits and no page churn. **Do this
kind of restructuring before writing, never after.**

**The link-don't-reteach decision.** Protocol-level REST is already written in this bible
from the Node side — `docs/expressjs/pages/phase-6-rest-surface/` (11 topics: resources,
status mapping, pagination, filter/sort/search, versioning, idempotency keys, ETag and
Cache-Control, OpenAPI, webhooks, PATCH and bulk, hypermedia) and
`docs/expressjs/pages/phase-7-layering/` (controller-service-repository, domain vs
transport, fat controllers, DI without a framework, folders and DTOs, transaction
middleware). Phase 11's pages **cite those** rather than re-deriving HTTP, per the Python
README's own rule. What Phase 11 owns is the half that is genuinely Python's: the
Pydantic schema/model split, router→service→repository in FastAPI, session and commit
ownership, keyset pagination in SQLAlchemy 2.0, `exclude_unset` for PATCH, RFC 9457
problem details, OpenAPI→typed TS client, SPA auth. **DRF landed as a 3-topic
recognition cluster**, the user's choice over both "skip it" and "full coverage".

## Where the numbers come from

Counted from the badges with `grep`, never estimated — the four part files under
`docs/python/syllabus/`:

```
for t in master understand know when; do grep -o "t-$t\"" *.md | wc -l; done
```

**180 topics · Master 60 (33%) · Understand 82 (46%) · Know 31 (17%) · When Needed 7 (4%)**
By part: Foundations 38 · Data model 49 · **Application 69** · Production 24.

## The 14 phases and their directory slugs

The slugs live in `src/data/progress.js` and the Progress component links to them —
**use these exact strings** or a phase renders as a dead link.

| # | Slug | Phase | Topics | State |
|---|---|---|---|---|
| 0 | `phase-0-runtime` | The runtime | 12 | ✅ CLOSED 12/12 (2026-08-28) |
| 1 | `phase-1-language-core` | Language core | 16 | 🚧 **IN FLIGHT 1/16** — 03 closed |
| 2 | `phase-2-functions` | Functions, closures and decorators | 10 | planned |
| 3 | `phase-3-collections` | Collections in depth | 12 | planned |
| 4 | `phase-4-classes-data-model` | Classes and the data model | 15 | planned |
| 5 | `phase-5-iterators-generators` | Iterators, generators, context managers | 10 | planned |
| 6 | `phase-6-typing` | Typing | 12 | planned |
| 7 | `phase-7-packaging-tooling` | Packaging, projects and tooling | 12 | planned |
| 8 | `phase-8-concurrency-async` | Concurrency and async | 13 | planned |
| 9 | `phase-9-web-service` | The web service | 14 | planned |
| 10 | `phase-10-data-files` | Data, files and integrations | 13 | planned |
| **11** | `phase-11-rest-crud` | **REST APIs and CRUD, end to end** | **17** | planned — the payoff phase |
| 12 | `phase-12-testing` | Testing with pytest | 12 | planned |
| 13 | `phase-13-production` | Production and performance | 12 | planned |

## Phase 0 filename contract — hold the forks to it

`01-what-python-is` · `02-the-gil` · `03-release-model` · `04-installing-and-versions` ·
`05-virtual-environments` · `06-running-code` · `07-everything-is-an-object` ·
`08-imports` · `09-name-main` · `10-python-vs-node` · `11-startup-and-import-cost` ·
`12-dis-bytecode`. A topic over 300 lines becomes `NN-slug/` with `_category_.json`,
`README.md` and numbered chunks — **same slug**, so inbound links keep resolving.
The coordinator owns `phase-0-runtime/README.md`; forks never touch it.

## Phase 1 filename contract — hold the forks to it

`01-syntax-and-indentation` · `02-numbers` · `03-strings` · `04-bytes-and-encoding` ·
`05-truthiness` · `06-comparisons` · `07-assignment-and-aliasing` · `08-control-flow` ·
`09-comprehensions` · `10-match-pattern-matching` · `11-exceptions` · `12-eafp-vs-lbyl` ·
`13-unpacking` · `14-none-and-no-result` · `15-pep8-and-idiom` · `16-del-pass-ellipsis`.
Same rule as Phase 0: a topic over 300 lines becomes `NN-slug/` with `_category_.json`,
`README.md` and numbered chunks, **same slug**, so inbound links keep resolving.
The coordinator owns `phase-1-language-core/README.md`; forks never touch it.

> 🔴 **SESSION OF 2026-08-31 — PYTHON RESUMED, AND IT HAS ITS OWN WORKTREE.**
> On the user's instruction (*"Pick python where we left off"*, then *"create new
> work tree for it"*), the Python lock was taken **over** the parked "blocked behind
> Java" row, and a worktree was created:
>
> ⛔ **THAT WORKTREE IS GONE. Work on `main` in
> `/mnt/Storage/Backup/Knowledge/devbible`.** It existed for one session:
>
> | | |
> |---|---|
> | Worktree | `/mnt/Storage/Backup/Knowledge/devbible-python` — **deleted 2026-08-31** |
> | Branch | `python-phase-1`, branched at `1ae8f47e` — **merged as `008d95c9`, then deleted** |
> | Verified before removal | 0 unique commits vs `main`, 0 uncommitted files |
>
> Per [[devbible-feedback-worktrees-are-temporary]], it was merged and removed on
> the user's instruction (*"Please merge everything to main"*) the same day it was
> created, and the store was grepped for its path — which is why this row now says
> so instead of naming a directory that no longer exists.
>
> ✅ **The two-checkout problem is RESOLVED — nothing to check.** Two author forks
> were already writing into the main checkout when the worktree was created, so
> their files were **copied** across (never moved, while a fork is live), committed,
> diffed, and the originals deleted. The worktree was then merged and removed.
> Everything is on `main`. The lesson worth keeping: **if you create a worktree
> while forks are already writing elsewhere, copy their output rather than moving
> it, and label that commit a snapshot with no line counts in the message** — a
> pathspec commit re-reads the worktree, so any count measured beforehand is a
> guess.
>
> ✅ **Topic 02 chunk 04 CLOSED 2026-08-31 — `bool` is an `int`, in SIX chunks.**
> Drafted as one page at **547 lines** and split three times on concept boundaries,
> never trimmed. 1,263 lines total, 0 over cap, 0 MDX hazards, 62/62 links resolving.
>
> | File | Lines | Pos | Covers |
> |---|---|---|---|
> | `04-bool-is-an-int.md` | 284 | 40 | the promise, the idioms it buys, `&`/`\|`/`^` staying `bool`, `~` deprecated → error in **3.16**, formatting |
> | `04b-bool-identity-traps.md` | 250 | 41 | the dict key, `isinstance`, `match`/`case` ordering, `singledispatch` MRO, the `type()` table |
> | `04c-is-true-and-the-type-system.md` | 160 | 42 | `if x:` vs `is True` vs `== True`, tri-state, `assertTrue` vs `assertIs`, E712 |
> | `04d-booleans-and-the-type-system.md` | 209 | 43 | assignability, `-> bool` that returns `int`/`None`, `Literal` overloads, **`TypeGuard` (3.10, PEP 647) vs `TypeIs` (3.13, PEP 742)** |
> | `04e-booleans-at-a-boundary.md` | 171 | 44 | `json` keeps values, coerces keys; `sqlite3` has **no boolean storage class** |
> | `04f-reading-a-bool-in.md` | 189 | 45 | `argparse` `type=bool` warning, `os.environ`, parse-don't-truth-test |
>
> 🔴 **`sidebar_position` scheme changed for chunk 04 onward: topic number × 10.**
> The written chunks 01–03b hold 1–7; `04` is **40**, split siblings take 41, 42, …
> so `05` is **50**, `06` **60** and so on. This is what leaves room for a split
> without renumbering anything already committed. Docusaurus orders numerically, so
> 1…7 then 40…140 is fine.
>
> **Facts banked while writing 04, verified at the source:**
> - `bool()` docs: *"It cannot be subclassed further. Its only instances are `False`
>   and `True`."* — this singleton guarantee is what makes `x is True` sound where
>   `x is 1` is a bet on the small-integer cache.
> - stdtypes: `&`, `\|`, `^` return a **`bool` only when BOTH operands are booleans**;
>   `True & 1` is `1`. And *"the bitwise inversion operator `~` is deprecated and will
>   raise an error in Python 3.16."*
> - `json` docs: *"`loads(dumps(x)) != x` if x has non-string keys."* Boolean
>   **values** round-trip fine; only keys are coerced. So the bug is exclusive to
>   code that groups/buckets by a predicate.
> - `sqlite3`'s adapter table has **no `bool` row** — it does not need one, because a
>   `bool` *is* an `int`. A converter registered for a `BOOLEAN` declared column
>   receives **`bytes`**, not an `int`.
> - `argparse` docs carry an explicit warning against `type=bool` and point to
>   `BooleanOptionalAction` / `action='store_true'`.
> - `TypeIs` narrows on **both** branches, `TypeGuard` only on `True`; `TypeIs`
>   requires the narrowed type to be a subtype of the input type, `TypeGuard` does
>   not — which is why `TypeGuard` is still the tool for `object` → `TypedDict`.
>
> ⚠️ **A section-moving split script needs a `\n## ` stop, not just `\n### `.** The
> first attempt cut the LAST gotcha with only `###` as its terminator, fell back to
> the footer `---`, and would have deleted every interview question after it. Caught
> because the next `.index()` raised; it would otherwise have been a silent trim.
>
> ⚠️ **`mdxcheck.py` was re-verified to actually work here** — a scratch file with a
> bare `<!-- -->` and a bare `<module>` returns `1 MDX hazard(s) in 1 file(s)`, so
> `0 MDX hazard(s) in 0 file(s)` on an explicit file list is a **real** clean, not
> the nonexistent-path false clean this file warns about.
>
> ## ✅ TOPIC 02 · NUMBERS CLOSED 2026-09-01. START HERE → `phase-1-language-core/05-truthiness/`
> The directory does not exist yet. Its syllabus row is line 53 of
> `docs/python/syllabus/01-foundations.md`, tier **Master**: empty things are falsy,
> the `if items:` bug that conflates "no results yet" with "empty results",
> `and`/`or` returning operands, and the walrus `:=`.
>
> ### Topic 02 final: 69 chunks + index, 17,166 lines
>
> | Chunk set | Files | Who |
> |---|---|---|
> | `01`–`03b` integers, literals | 7 | earlier session |
> | `04`–`04f` bool is an int | 6 | 2026-08-31 coordinator |
> | `05`–`05d`, `06`, `06b` float, NaN | 6 | 2026-08-31 fork A |
> | `06c`–`06h` signed zero | 6 | 2026-09-01 fork A |
> | `07`–`07e` comparing floats | 5 | 2026-09-01 coordinator |
> | `08`–`08e`, `09`–`09c` division, rounding | 8 | 2026-08-31 fork B |
> | `10`–`10m` Decimal for money | **13** | 2026-09-01 fork B |
> | `11`–`11d` Fraction | 4 | 2026-09-01 coordinator |
> | `12`–`12d` conversions | 4 | 2026-09-01 coordinator |
> | `13`–`13c` complex, the tower | 3 | 2026-08-31 coordinator |
> | `14`–`14g` math vs the operators | 7 | 2026-09-01 fork A |
>
> **Verified at close** (commits `46001b2b`, `332ec718`, `3af042b2`, `b9bf7193`,
> `a19dc18b`, `c4b6f4f4`): 0 over the 300-line cap · 0 MDX hazards · **0 dangling of
> 489 local links** · every chunk listed in the index and every index row backed by a
> file · **unbroken footer `Next` chain from `01` to `14g`** · no duplicate
> `sidebar_position` beyond the deliberate README-vs-chunk one.
>
> 🔴 **EVERY DISPATCH ESTIMATED ONE FILE AND EVERY ONE WAS WRONG BY 4–13×.** Decimal
> was one file and became thirteen; `math` vs the operators seven; signed zero six;
> comparing floats five. **Stop putting an estimate in a dispatch at all** — give a
> position range and the scope bullets, and let the writer split.
>
> ### Three close-pass checks that nothing else catches — RUN ALL THREE
>
> ```bash
> cd docs/python/pages/<phase>/<topic>
> # 1. duplicate sidebar_position — a SILENT reordering, passes every other check
> grep -h '^sidebar_position:' *.md | sort -n -k2 | uniq -c | awk '$1>1'
> # 2. stale placeholders whose target now exists
> grep -rn "not written yet" *.md
> # 3. footer Next-chain continuity in sidebar_position order (script in the session log)
> ```
> All three fired this time: 3 duplicate positions, 11 stale placeholders, 1 footer
> break (`03b` still pointed Next at the *next topic*, because it was the last chunk
> when it was written — every topic that gains a later chunk has this).
>
> ### Corrections to the banked research — fork A verified rather than complied
>
> - ⛔ **"`round(-0.4)` yields `-0.0`" was WRONG.** `round()` without `ndigits` returns
>   an `int`, which has no sign bit, so `round(-0.4)` is `0`. It is `round(-0.4, 0)`
>   and `round(-0.004, 2)` that give `-0.0`.
> - The banked format-spec sentence about `-0` belongs to the **`'g'` presentation
>   type**, not the mini-language generally — which is why `:g` prints `-0` and
>   `:.1f` prints `-0.0`.
>
> Nine claims the docs could not settle are marked uncertain in the pages rather than
> asserted, including `JSON.stringify(-0)`, PostgreSQL's silence on signed zero, and
> whether `x ** 0.5` is bit-identical to `math.sqrt`. **Keep that discipline.**
>
> Original note follows.
>
> **START HERE (superseded) → `02-numbers/04-bool-is-an-int.md`** — finish topic 02's float half FIRST,
> then 05–16 in order. As of **2026-08-28 23:11**, wound down at 97% weekly usage on the
> user's instruction (*"you can other agenets to stop and retport back after completing
> current files"*). Both forks were told to finish only the file in hand and to spend their
> LAST action on the topic index rather than another chunk — **that instruction is what kept
> 15 chunks from landing unreachable, and it should be the standard wind-down order.**
>
> **CLOSED:** 01 · Syntax and indentation (8 chunks + index, 1,900 lines) ·
> 03 · Strings (9 + index, ~2,150) · 04 · `bytes` vs `str` (4 + index, ~1,100).
> **PARTIAL:** 02 · Numbers (7 + index, 1,779) — the integer half only.
> **UNWRITTEN:** 05–16.
>
> 🔴 **Topic 02's remaining chunks, in the order its index promises them:**
> `04-bool-is-an-int` · `05-float-and-ieee-754` · `06-nan-inf-and-signed-zero` ·
> `07-comparing-floats` · `08-floor-division-and-modulo` · `09-round-and-bankers-rounding` ·
> `10-decimal-for-money` · `11-fraction` · `12-conversions-and-precision-loss` ·
> `13-complex-and-the-numeric-tower` · `14-math-vs-the-operators`. **Use these exact
> filenames** — the written chunks name several of them in plain bold *(not written yet)*
> text, and those become links when the chunk lands.
>
> ⚠️ **Topic 04 is short one planned chunk** — a worked end-to-end walk through the CSV,
> subprocess, HTTP and database boundaries. Its index says so in place rather than linking
> to a page that does not exist. Write it when the phase is revisited; do not treat the
> topic as defective.

🔴 **Repointable placeholders left by topic 03.** Its chunks link forward to sibling
topics that do not exist yet: `../02-numbers.md`, `../04-bytes-and-encoding.md`,
`../05-truthiness.md`, `../06-comparisons.md`, `../07-assignment-and-aliasing.md`,
`../12-eafp-vs-lbyl.md`, plus the phase README's 15 rows. **Every one of those must be
repointed to `NN-slug/README.md` if that topic lands as a directory** — `fixlinks.py`
reports a dangling `NN-topic.md` as clean when a directory `NN-topic/` exists, so this
never surfaces as a build warning. Resolve with `ls`, never bulk-`sed`.

## Phase 1 · topic 03 · Strings — what closed, and what it cost

Nine chunks, because **every single draft crossed the cap and was split on a concept
boundary rather than trimmed**: 434→258+208, 447→272+207, 354→228+160, 312→241+103.
The last of those splits is the one worth remembering: pulling `__format__` out of the
format-spec chunk exposed that the topic had **no coverage of `str.format`'s own field
syntax** — positional vs named vs attribute vs index access, `format_map`, `__missing__`,
`Enum.__format__` — which took the new chunk from 103 to 245 lines. *A split is a
re-read of the concept, and it finds gaps a first draft hides.*

Facts fetched and worth not re-deriving:

- **t-strings are real in 3.14** (PEP 750). `t"..."` evaluates to
  `string.templatelib.Template`; each `Interpolation` carries `value`, `expression`,
  `conversion`, `format_spec`. The PEP's motivation is explicit that f-strings *"provide
  no way to intercept and transform interpolated values before they are combined"*, and
  names SQL injection and XSS. ⚠️ **The stdtypes.html t-strings anchor did not render**
  when fetched — PEP 750 is the source that works. Phase 9 and Phase 11 both turn on this.
- **PEP 701 (3.12)** legalised nested same-type quotes, backslashes and comments inside
  f-string replacement fields. A `#` inside a field now comments out *"even closing braces
  and quotes"*. Anything supporting 3.11 must still swap the inner quotes.
- **3.14 extended the format-spec grouping option to the fractional part** — before 3.14
  `,`/`_` applied only to the integral part.
- **The `z` option (PEP 682, 3.11)** *"coerces negative zero floating-point values to
  positive zero after rounding to the format precision"*. This is the `-0.00`-in-a-report
  fix and belongs in Phase 11's money material too.
- **`str.strip(chars)` is a character SET** — *"not a prefix or suffix; rather, all
  combinations of its values are stripped"*. `removeprefix`/`removesuffix` (3.9) are the
  correct tools, and are no-ops when the affix is absent.
- **`split()` with no argument is a different algorithm** from `split(sep)` — the docs say
  so in those words. `"".split()` is `[]`; `"".split(",")` is `[""]`.
- **`isdigit()` accepts characters `int()` rejects** (superscripts); only `isdecimal()` is
  close, and it is still wrong for `"-1"` and `" 42 "`.
- **`str.format` on an untrusted template is an information leak** — the format grammar
  supports attribute access, so `"{0.__class__.__init__.__globals__}"` reaches module
  globals. `string.Template.safe_substitute` is the safe form. Phase 9 and 11 need this.

🔴 **The link-audit class this topic added.** `fixlinks.py` reported **0 unresolved** on a
directory that had **two genuinely broken links**: `../phase-0-runtime/...` written from
inside a chunk directory (needs `../../`), and sibling-topic links that lost their `../`
when a section moved during a split. **A split moves relative links, and nothing checks
them.** The audit that works is a filesystem resolve of every `](...)` target — the same
one that closed Phase 0.

## Phase 1 · topics 01 and 04 — what closed at the wind-down

**01 · Syntax and indentation** (fork, 8 chunks + index, 1,900 lines). Drafted as a single
file, hit 385 lines, became a directory. Worth banking from its research:

- **CPython's parser limits are in `Parser/lexer/state.h`**: `MAXINDENT 100`,
  `MAXLEVEL 200`, `MAXFSTRINGLEVEL 150`. The language reference states **no** limit, so
  these are labelled implementation limits in the page, not language rules.
- **The removal of `-t`/`-tt` is not recorded on any doc page.** The page says only that
  the 3.14 command-line reference lists no such option — the honest form of a claim the
  docs cannot settle.
- **PEP 263's "identifiers are restricted to the ASCII subset" is Python-2-era** and false
  for Python 3. It is corrected in the page rather than quoted as current — expect to meet
  it repeated elsewhere.
- Ruff `E114`/`E116` are **preview** rules; `W191`, `E101`, `ISC001`, `ISC002`, `A001`,
  `A002` are stable.
- Reusable quotes the fork sourced: the suite grammar's *"Only the latter form of a suite
  can contain nested compound statements"* and *"The semicolon binds tighter than the
  colon in this context"* (→ topic 08); `_` is *"a soft keyword within any pattern, but
  only within patterns"* (→ topic 10); PEP 572's *"Unparenthesized assignment expressions
  are prohibited at the top level of an expression statement"* (→ topic 05); PEP 758 on
  why `except ... as` keeps its parentheses (→ topic 11).

**04 · `bytes` vs `str`** (coordinator, 4 chunks + index, ~1,100 lines). The finding that
reframes the whole topic, and the reason not to trust older material:

- 🔴 **`open()` in text mode does NOT default to UTF-8.** The reference: *"In text mode,
  if encoding is not specified the encoding used is platform-dependent:
  `locale.getencoding()` is called to get the current locale encoding."* Meanwhile
  `str.encode()`/`bytes.decode()` **and** `sys.getdefaultencoding()` are always UTF-8.
  That asymmetry is the bug generator, and checking `sys.getdefaultencoding()` while
  debugging an `open()` problem is a documented dead end.
- 🔴 **PEP 686 is `Status: Final`, `Python-Version: 3.15`** — UTF-8 becomes the default
  text encoding for files, streams and pipes; `PYTHONUTF8=0` / `-X utf8=0` opts out.
  **This is the encoding equivalent of free-threading-in-3.14**: the single most
  out-of-date fact in older material. Phases 7, 9, 10 and 13 all turn on it.
- `encoding="locale"` is honoured **even in UTF-8 Mode** since 3.11 — corrected
  specifically so this migration has a way to say "I really do mean the locale".
- `EncodingWarning` (PEP 597) via `-X warn_default_encoding` /
  `PYTHONWARNDEFAULTENCODING=1`, run as `-W error::EncodingWarning` under pytest, is the
  way to clear a codebase **before** 3.15 rather than after.
- `surrogateescape` (PEP 383) is the *reversible* handler and is how Python handles POSIX
  filenames — and its cost is a `UnicodeEncodeError: surrogates not allowed` raised far
  from the source, at JSON/log/HTTP boundaries. Sanitise with
  `s.encode("utf-8","surrogateescape").decode("utf-8","replace")`.
- ⚠️ **`docs.python.org/3.14/library/stdtypes.html` t-strings section did not render**
  when fetched (the page truncates before it). PEP 750 is the source that works.

## Phase 1 · topic 02 · Numbers — the research banked when the fork was wound down

The fork gathered and **verified** these before it ran out of runway. They belong to the
unwritten chunks; do not re-derive them.

- 🔴 **The highest-value one: `Decimal`'s `//` truncates towards zero where `int`'s floors.**
  *"The integer division operator `//` behaves analogously, returning the integer part of the
  true quotient (truncating towards zero) rather than its floor, so as to preserve the usual
  identity `x == (x // y) * y + x % y`"* — `library/decimal.html`. So `Decimal(-7) // Decimal(4)`
  is `Decimal('-1')` while `-7 // 4` is `-2`. Chunks 08 and 10 both turn on this.
- **The floor/modulo invariant**, `reference/expressions.html`: *"The modulo operator always
  yields a result with the same sign as its second operand (or zero)"* and *"`x == (x//y)*y + (x%y)`"*.
- **Float modulo roundoff**, footnote [1] on the same page: *"in order that `-1e-100 % 1e100`
  have the same sign as `1e100`, the computed result is `-1e-100 + 1e100`, which is numerically
  exactly equal to `1e100`. The function `math.fmod()` returns a result whose sign matches the
  sign of the first argument instead."* And `math.fmod` *"is generally preferred when working
  with floats, while Python's `x % y` is preferred when working with integers."*
- **`round()`**, `library/functions.html`: *"The behavior of `round()` for floats can be
  surprising: for example, `round(2.675, 2)` gives `2.67` instead of the expected `2.68`. This
  is not a bug."*
- **Default decimal context**: `prec=28, rounding=ROUND_HALF_EVEN, Emin=-999999, Emax=999999,
  traps=[Overflow, DivisionByZero, InvalidOperation]`, and *"The significance of a new Decimal
  is determined solely by the number of digits input. Context precision and rounding only come
  into play during arithmetic operations."*
- **`Decimal.from_float(0.1)` is not `Decimal('0.1')`** — the exact expansion is
  `0.1000000000000000055511151231257827021181583404541015625`; `Decimal(3.14)` is
  `Decimal('3.140000000000000124344978758017532527446746826171875')`.
- **NaN**, `reference/expressions.html`: *"Any ordered comparison of a number to a
  not-a-number value is false. A counter-intuitive implication is that not-a-number values are
  not equal to themselves."*
- **`repr` round-trip**, `library/sys.html`: *"for a finite float `x`, `repr(x)` aims to produce
  a short string with the property that `float(repr(x)) == x`."*
- **`sum()` changed in 3.12**: *"Summation of floats switched to an algorithm that gives higher
  accuracy and better commutativity on most builds"* — so `sum([0.1] * 10) == 1.0` is `True`
  while the ten-term `+` chain is `False`. Both forms are in the tutorial appendix.
- **PEP 3141**: *"the `Decimal` type should not at this time be made part of the numeric tower."*
- **Typing shortcut** (typing spec): an `int` argument is acceptable where `float` is annotated,
  and `int`/`float` where `complex` is. → Phase 6.
- **3.14-specific:** `float.from_number()` and `complex.from_number()` added in 3.14; `math.fma`
  added in 3.13; `sum()` gained a complex specialisation in 3.14; and *"Changed in version 3.14:
  If only one operand is a complex number, the other operand is converted to a floating-point
  number."*

🔴 **Two evidence decisions that set the standard for this phase:**

1. **The fork refused to print `0.1 + 0.2`'s digits**, because docs.python.org never prints that
   literal. It used only documented digit strings instead — `1.1 + 2.2` showing as
   `3.3000000000000003`, `3602879701896397 / 2 ** 55`, `5.5511151231257827e-017` — and stated the
   `0.1` case without asserting its expansion. **This is the `dis`-output hazard in a different
   costume**: a number that *looks* like documentation.
2. **It sourced the small-integer cache bounds from CPython's
   `Include/internal/pycore_runtime_structs.h`** (`_PY_NSMALLPOSINTS 257`, `_PY_NSMALLNEGINTS 5`)
   and labelled them an implementation detail, because the language reference only says identity
   *"should not be relied upon"*. Same treatment as topic 01's `MAXINDENT`.

Left out rather than guessed: **`math.isnormal` / `math.issubnormal` are not in the 3.14 `math`
docs** (a grep of the page returns nothing), and `sys.int_info.bits_per_digit`'s value is
platform-dependent, so only its definition was quoted.

## 🔴 The wind-down repair class — new 2026-08-28, and it will recur

A fork stopped mid-topic leaves **forward links to chunks it never wrote**. Topic 02 had five,
plus two footer `Next →` arrows. **Neither `fixlinks.py` nor `mdxcheck.py` catches them.**

The repair: convert each to plain bold ***(not written yet)*** text and repoint the footers to
the next *topic*, so the phase carries 0 dangling links instead of five 404s. Then say so in the
topic index — an honest "this topic is incomplete, here is exactly what is missing" beats an
index that implies completeness.

**Ask a winding-down fork to name its own unwritten link targets in its report.** Both forks did,
and it turned a hunt into a list. Put it in the wind-down message alongside "spend your last
action on the topic index".

## 🔴 The blind spot caught the session that documented it — 2026-08-28

This file already warned that `fixlinks.py` resolves `NN-topic.md` against a directory
`NN-topic/` and reports it clean. **The Phase 1 coordinator wrote that warning, then
shipped six links with exactly that defect and claimed "0 dangling links phase-wide" in a
commit message.** A closing filesystem-resolved audit found **28 of 166 dangling**.

Two classes, and both recur:

1. **Six links written *before* the target topic became a directory** — `../02-numbers.md`,
   `../04-bytes-and-encoding.md`, `01-syntax-and-indentation.md`. Every one passes
   `fixlinks.py`. Repointed to `NN-slug/README.md`.
2. **Twenty-two links to topics that are simply unwritten** (05–16 in the phase index and
   in chunk prose). Converted to plain bold ***(not written yet)*** text.

Then the substitution itself introduced a defect: the phase-index cells were already
`**[Title](link)**`, so replacing the link produced nested `****Title** *(not written
yet)***`. **Check the render of a bulk substitution, not just its exit status.**

**The rule that falls out: at every phase close, and after every batch of splits, resolve
every `](...)` target against the filesystem.** Fifteen lines of Python, and it is the only
check that catches any of this:

```python
import re, pathlib
for f in pathlib.Path(DIR).rglob('*.md'):
    for m in re.finditer(r'\]\((?!https?:|#)([^)#]+)\)', f.read_text()):
        if not (f.parent / m.group(1)).resolve().is_file():
            print("DANGLING:", f, "->", m.group(1))
```

**Phase 1 final state (2026-08-28 23:14): 32 files, 6,944 lines, 0 over the 300-line cap,
0 MDX hazards, 145 of 145 links resolving.**

## Standing decisions for this track

- **Target 3.14** (3.14.7, 5 Aug 2026). 3.13 in bugfix. **3.15 GA 1 Oct 2026** (PEP 790).
  **Free-threaded CPython officially supported since 3.14 (PEP 779)** — the single most
  out-of-date fact in older Python material, and Phase 0 topic 02 turns on it.
- **NO sandbox, NO console blocks.** Documentation-validated only (rule 3). Python *code*
  examples yes; program *output* never. The trap specific to this language: `dis` output
  and `-X importtime` numbers are exactly the kind of thing a fork will fabricate because
  it looks like documentation. It is not.
  🔴 **It happened, 2026-08-28.** The topic 08 fork created
  `08-imports/_scratch/` with `a.py`, `b.py`, `app.py` and friends and began running them
  to observe import behaviour. Caught by a `git status` showing the untracked directory,
  not by a hook — **hooks never see a file you did not Write or Edit**, and a fork's
  `python` runs are invisible to them. The fork was messaged to delete it and told the
  exact boundary: a real error string may be quoted **inline, backticked, sourced**; never
  as a fenced block with a fabricated path, line number and frame stack. **Check
  `git status` for a scratch directory every time a fork touches a topic**, and prefer
  topics where the temptation is lowest when running unattended.
- **Cadence is per file** — write, wire all four boards, commit explicit paths, memory.
- **Registered in the build/dev-server registry as running neither** (2026-08-27).
  Verification is `wc -l`, `mdxcheck.py` and filesystem-resolved links.
- ⚠️ **`fixlinks.py` has a known blind spot**: it resolves `NN-topic.md` against a
  directory `NN-topic/` and reports 0 unresolved on a genuinely dangling link. After any
  file→directory conversion, **grep for the old path too**.

## Banked from the topic 08 research — facts that belong to later phases

Sourced and quoted by the imports fork, worth not re-deriving:

- 🔴 **`__package__` and `__cached__` are removed in 3.15.** *"Deprecated since version
  3.13, will be removed in version 3.15: `__package__` will cease to be set or taken into
  consideration by the import system or standard library."* —
  https://docs.python.org/3.14/reference/datamodel.html. A hard deadline, and it lands
  **before** most readers upgrade. Phases 6 and 7 must not teach `__package__` as current.
- **PEP 3147 contradicts the `__pycache__` folklore.** *"If the py source file is missing,
  the pyc file inside `__pycache__` will be ignored… a pyc file outside of `__pycache__`
  will only be imported if the py source file is missing."* — the "delete `__pycache__`,
  it's stale" advice is mostly cargo cult; the real hazard is a legacy `.pyc` *beside* the
  source. Used in chunk 03b.
- **Annotations are lazy by default on 3.14** (PEP 649/749) *"except if
  `from __future__ import annotations` is used"* — https://docs.python.org/3.14/whatsnew/3.14.html.
  Phase 6 · Typing and Phase 2's annotations row both turn on this.
- **`get_type_hints` and `if TYPE_CHECKING` interact badly:** with `Format.VALUE`, an
  unresolvable forward reference raises `NameError`, *"for example… with names imported
  under `if TYPE_CHECKING`"* — https://docs.python.org/3.14/library/typing.html. Phase 6.
- **`.pth` files run at every startup** *"regardless of whether a particular module is
  actually going to be used"* — https://docs.python.org/3.14/library/site.html. This is
  Phase 0 topic 11's startup-cost story and a Phase 7 packaging concern.
- **3.14 moved venv path setup:** `sys.prefix`/`sys.exec_prefix` are now set from
  `pyvenv.cfg` during path initialisation rather than by `site`, so they are no longer
  affected by `-S`. Topic 05 must cover this; older venv material is wrong here.

## The repair classes a killed fork leaves — check all three, every time

Learned the hard way on the Java track, and they apply here unchanged:

1. **A missing `README.md`** in a chunked topic — the chunks link it and the build breaks.
2. **Stale forward links** — the fork linked a chunk, then renamed it during a split.
3. **Duplicated body sections** — detect with `grep '^## ' f | sort | uniq -d`.

A dead fork's link graph is the last thing it wrote and the least trustworthy part of
its output.

See also [[devbible-author-brief]] for the compact brief every fork reads,
[[devbible-locks]] §11j, and [[progress-java-python-syllabus]] for the
2026-08-17 syllabus-authoring history the two languages share.

## 🔴 Banked research from the 2026-08-31 forks — DO NOT RE-DERIVE

Both forks verified all of this at the source before they ran out of runway. It
belongs to the six unwritten chunks.

### For `07-comparing-floats.md`

- `math.isclose(a, b, *, rel_tol=1e-09, abs_tol=0.0)`, added 3.5. The documented
  formula: *"the result will be: `abs(a-b) <= max(rel_tol * max(abs(a), abs(b)), abs_tol)`"*.
- 🔴 The zero case, in the docs' own words: *"When comparing x to 0.0,
  `isclose(x, 0)` is computed as `abs(x) <= rel_tol * abs(x)`, which is False for
  any nonzero x and rel_tol less than 1.0. So add an appropriate positive abs_tol
  argument to the call."*
- *"NaN is not considered close to any other value, including NaN. inf and -inf
  are only considered close to themselves."*
- PEP 485: the symmetric **weak** test was chosen; `rel_tol=1e-09` is
  *"approximately half of Python float precision"*; `abs_tol=0.0` because
  *"refuse the temptation to guess"*; *"By definition, no value is small relative
  to zero."*
- **The contrast that makes the chunk:** `unittest.assertAlmostEqual` is
  **absolute and decimal-places based** — *"computing the difference, rounding to
  the given number of decimal places (default 7), and comparing to zero. Note
  that these methods round the values to the given number of decimal places (i.e.
  like the `round()` function) and not significant digits"*.
- `isclose` is **not an equivalence relation** — not transitive — so it cannot key
  a dict, dedupe a list, or drive a sort.
- `==` is **not** always wrong: exact for integers below 2**53, for dyadic values,
  and for two values produced by the identical computation.

### For `06c-signed-zero-and-serialisation.md`

- `math.copysign`: *"Return a float with the magnitude (absolute value) of x but
  the sign of y. On platforms that support signed zeros, `copysign(1.0, -0.0)`
  returns -1.0."* This is the test — you **cannot** detect the sign by dividing,
  because Python raises `ZeroDivisionError` where C returns an infinity.
- Format spec: *"Positive and negative infinity, positive and negative zero, and
  nans, are formatted as `inf`, `-inf`, `0`, `-0` and `nan` respectively,
  regardless of the precision."*
- `-0.0 == 0.0` is `True` and they hash identically, so they collapse to one dict
  key. `round(-0.4)` yields `-0.0`. `:.1f` prints `-0.0`; `:g` prints `-0`.
- `json`: *"allow_nan (bool) – If False, serialization of out-of-range float
  values (nan, inf, -inf) will result in a ValueError, in strict compliance with
  the JSON specification. If True (the default), their JavaScript equivalents
  (NaN, Infinity, -Infinity) are used."* and *"The RFC does not permit the
  representation of infinite or NaN number values. Despite that, by default, this
  module accepts and outputs Infinity, -Infinity, and NaN as if they were valid
  JSON number literal values."* Plus `parse_constant`, *"called with one of the
  following strings: '-Infinity', 'Infinity', or 'NaN'"*.

### For `10-decimal-for-money.md`

- Default context: `Context(prec=28, rounding=ROUND_HALF_EVEN, Emin=-999999,
  Emax=999999, capitals=1, clamp=0, flags=[], traps=[Overflow, DivisionByZero,
  InvalidOperation])`.
- 🔴 **Precision is significant digits and applies to RESULTS, not inputs.** *"The
  significance of a new Decimal is determined solely by the number of digits
  input. Context precision and rounding only come into play during arithmetic
  operations."* FAQ: *"It occurs after the computation."* The worked trap: with
  `prec = 3`, `Decimal('3.104') + Decimal('2.104')` is `Decimal('5.21')` but
  `Decimal('3.104') + Decimal('0.000') + Decimal('2.104')` is `Decimal('5.20')`.
  The fix is unary plus (`+Decimal('1.23456789')` → `Decimal('1.23')`) or
  `Context.create_decimal`.
- Constructor: *"If value is a float, the binary floating-point value is
  losslessly converted to its exact decimal equivalent… `Decimal(float('1.1'))`
  converts to `Decimal('1.100000000000000088817841970012523233890533447265625')`."*
  And *"`Decimal('3.00000')` records all five zeros even if the context precision
  is only three."* `Decimal.from_number` and `IEEEContext(bits)` are **new in 3.14**.
- `FloatOperation` trap, off by default: when set, `Decimal(3.14)` and
  `Decimal('3.5') < 3.7` raise, but `Decimal('3.5') == 3.5` stays `True`.
  *"Explicit conversions with `from_float()` or `create_decimal_from_float()` do
  not set the flag."*
- `quantize`: *"Unlike other operations, if the length of the coefficient after
  the quantize operation would be greater than precision, then an
  `InvalidOperation` is signaled."* / *"quantize never signals Underflow."*
  Validation idiom from the FAQ:
  `Decimal('3.214').quantize(TWOPLACES, context=Context(traps=[Inexact]))` raises
  `Inexact`. Addition, subtraction and integer multiplication preserve fixed
  point; division and non-integer multiplication need a `quantize` follow-up.
- The **eight rounding modes**, verbatim: `ROUND_CEILING` "Round towards
  Infinity", `ROUND_DOWN` "Round towards zero", `ROUND_FLOOR` "Round towards
  -Infinity", `ROUND_HALF_DOWN` "ties going towards zero", `ROUND_HALF_EVEN`
  "ties going to nearest even integer", `ROUND_HALF_UP` "ties going away from
  zero", `ROUND_UP` "Round away from zero", `ROUND_05UP` "Round away from zero if
  last digit after rounding towards zero would have been 0 or 5; otherwise round
  towards zero".
- **Nine signals** with the hierarchy: `FloatOperation` subclasses both
  `DecimalException` and `TypeError`; `DivisionByZero` subclasses
  `ZeroDivisionError`. `InvalidOperation` causes: `Infinity - Infinity`,
  `0 * Infinity`, `Infinity / Infinity`, `x % 0`, `Infinity % x`, `sqrt(-x)`,
  `0 ** 0`, `x ** (non-integer)`, `x ** Infinity`. Flags are **sticky** —
  `clear_flags()` before each monitored block.
- NaN: *"A test for equality where one of the operands is a quiet or signaling NaN
  always returns `False` (even when doing `Decimal('NaN')==Decimal('NaN')`)"*;
  ordering comparisons signal `InvalidOperation`. Use `compare()` /
  `compare_signal()`. 🔴 **Cross-boundary gotcha worth its own entry: PostgreSQL
  disagrees** — *"PostgreSQL treats `NaN` values as equal, and greater than all
  non-`NaN` values"*.
- Threads: `getcontext()` is per-thread; `sys.flags.thread_inherit_context`
  decides whether a new thread copies the caller's context. Set `DefaultContext`
  before threads start. `localcontext(ctx=None, **kwargs)` accepts keyword
  attributes since **3.11**.
- JSON: `json.loads('1.1', parse_float=decimal.Decimal)` → `Decimal('1.1')` is a
  documented example. `json.dumps` has **no** `Decimal` support — needs `default=`.
- SQL: SQLite *"natively supports the following types: NULL, INTEGER, REAL, TEXT,
  BLOB"*, so a `Decimal` needs `sqlite3.register_adapter`; **default adapters are
  deprecated since 3.12**. PostgreSQL `numeric`: *"especially recommended for
  storing monetary amounts and other quantities where exactness is required"*;
  scale overflow rounds, precision overflow raises.
- ⛔ **psycopg3's adaptation docs could NOT be fetched (403).** The
  Python↔PostgreSQL driver mapping is **unverified — do not assert it.**
- Unused but banked: `math.remainder` special cases; the Knuth
  associativity/distributivity examples from decimal's "Mitigating round-off
  error" (`prec=8` vs `prec=20`); `1 / Decimal('Infinity')` →
  `Decimal('0E-1000026')`; the `MAX_PREC`/`MAX_EMAX` bignum recipe and its
  `MemoryError` for `Decimal(1)/3`.

### For `11-fraction.md`

- Documented examples: `Fraction(1.1)` → `Fraction(2476979795053773, 2251799813685248)`;
  `Fraction(Decimal('1.1'))` → `Fraction(11, 10)`; `Fraction('3/7')`;
  `Fraction('7e-6')` → `Fraction(7, 1000000)`.
- `limit_denominator`: `Fraction('3.1415926535897932').limit_denominator(1000)` →
  `Fraction(355, 113)`; `Fraction(1.1).limit_denominator()` → `Fraction(11, 10)`.
- **3.14:** *"The `Fraction` constructor now accepts any objects with the
  `as_integer_ratio()` method"*; `Fraction.from_number` added. `is_integer()`
  added 3.12; space around the slash allowed since 3.12.
- `statistics` supports `Fraction` and `Decimal` —
  `mean([F(3,7), F(1,21), F(5,3), F(1,3)])` → `Fraction(13, 21)`.
- PEP 3141: *"After consultation with its authors it has been decided that the
  `Decimal` type should not at this time be made part of the numeric tower."*
  (Already used in chunk `13c`.)

### For `12-conversions-and-precision-loss.md`

- `int()` truncates toward zero, and **new in 3.14**: *"int() no longer delegates
  to the `__trunc__()` method"*.
- `round()`: *"if two multiples are equally close, rounding is done toward the
  even choice (so, for example, both `round(0.5)` and `round(-0.5)` are `0`, and
  `round(1.5)` is `2`)"*, plus *"`round(2.675, 2)` gives `2.67` instead of the
  expected `2.68`. This is not a bug"*.
- `float()` raises `OverflowError` only on **range**, never on precision loss.
- `Decimal(3.14)` → `Decimal('3.140000000000000124344978758017532527446746826171875')`;
  `Decimal.from_float(0.1)` →
  `Decimal('0.1000000000000000055511151231257827021181583404541015625')`.
- Decimal↔float: *"an attempt to add a Decimal to a float […] will raise a
  TypeError"*, but *"Changed in version 3.2: Mixed-type comparisons between
  Decimal instances and other numeric types are now fully supported."*
- The load-bearing sentence for the whole chunk: *"A comparison between numbers of
  different types behaves as though the exact values of those numbers were being
  compared."*
- The typing-spec shortcut (an `int` is acceptable where `float` is annotated,
  `int`/`float` where `complex` is) → cross-reference Phase 6.

## 🔴 Process findings from 2026-08-31 — they will recur

1. **A 547-line draft split into SIX chunks, and every split found gaps.** Chunk
   04 (`bool` is an `int`) was drafted as one page, then split three times on
   concept boundaries: in-language semantics → identity traps → the three checks →
   the type system → writing a bool out → reading a bool in. Same story on the
   forks' side: fork A's chunk 05 went 387 → four chunks, fork B's chunk 08 went
   376 → three, then its float half went 353 → two more. **A first estimate of
   "one file" was wrong by 4–6× in every single case**, which is the same finding
   phase 0's topic 06 recorded. Stop estimating; write and split.
2. 🔴 **A section-moving split script needs `\n## ` in its stop list, not just
   `\n### `.** Cutting the LAST gotcha with only `###` as a terminator falls back
   to the footer `---` and silently deletes every interview question after it.
   Caught only because the next `.index()` raised.
3. **`mdxcheck.py` was positively re-verified**: a scratch file with a bare
   `<!-- -->` and a bare `<module>` returns `1 MDX hazard(s) in 1 file(s)`. So
   `0 MDX hazard(s) in 0 file(s)` on an **explicit file list** is a real clean, not
   the nonexistent-path false clean this file warns about. Pass explicit files.
4. **COPY a live fork's files, never move them.** At the wind-down all 14 fork
   files were copied into the worktree and committed as an explicitly-labelled
   "snapshot of work in flight" with **no line counts in the message** — because a
   pathspec commit re-reads the worktree and any number measured beforehand can be
   stale. Both forks then reported and their counts matched. Nothing was lost and
   nothing was blocked.
5. **The wind-down message that works**, sent to both forks verbatim: finish only
   the file in hand · split it if it is over cap · spend your LAST action
   reporting · list every link target you named that does not exist · list what
   you researched but did not write. Both forks complied and fork B repaired its
   own dangling links before stopping. **This is the standard wind-down order.**
6. **Nine dangling forward links were repaired by a filesystem resolve**, not by
   `fixlinks.py`, which reports this class clean. Run the 15-line resolver at every
   topic close and after every batch of splits.

Superseded blocks from [progress_python_pages.md](progress_python_pages.md), verbatim, newest first. Nothing here was dropped;
it was moved so the live file stays inside its 160-line budget.

Search rather than read: `shared/scripts/recall.sh --cold <terms>`

