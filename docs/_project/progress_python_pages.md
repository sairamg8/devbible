---
name: progress-python-pages
description: LIVE cursor for the devbible Python track — the lock, the syllabus extension that added Phase 11 (REST/CRUD), the per-phase worklist and the exact file to resume at. Open this whenever a session says "python".
metadata:
  type: project
---

# devbible · Python — the live cursor

> # ⏸️ STOPPED 2026-09-21 ~18:15 by the user (session `d750a152`) — 0 agents running, nothing dispatching
> User: *"Once current agents complete do not deploy new ones and enough please save session progress."* A running Workflow cannot be drained (it starts the next job the instant a slot frees), so `TaskStop` was the only way to guarantee nothing new deployed — it **aborted the 3 in-flight authors** (08, 09, p7-07). Everything they had finished is committed: `git status docs/python` clean, `node scripts/linkcheck.mjs docs/python` = 840 files / 0 problems, no file over 300 lines. **Nothing pushed.**
> ✅ **Landed 2026-09-21 — the 4 owed defects below are FIXED:** `6e666d48f` UserList write path (+ new chunk `05-slicing/10e`; gate 27 chunks · 6,035 lines · 106 ★, both up) · `a9b605163` `next(iter(d))` is not O(1) · `8b121837a` `sorted_stream` memory · `eae2ae50a` the dangling 14b · `61f932469` pins `sortedcontainers` 2.4.0. Ignore all four in the SUPERSEDED block underneath.
> 🟡 **PARTIAL `08-copy-and-deepcopy/`** (Understand) — 12 chunks · 3,060 lines · 67 ★, gate PASS, all committed. Bank `research_python_p03_t08_copy_and_deepcopy.md` (461 lines; §12 holds the ~30-chunk plan). Written: 01 01b 02 02b 03 03b 04 04b 04c 05 05b 06. **Still owed (the plan is a floor):** 06b 06c 07 07b 07c 08 08b 09 10 10b 11 11b 11c 12 12b 13 13b 14 15 16. **Not wired:** phase row still *(not written yet)*; `progress.js` phase 3 still `pages: 7`.
> 🟡 **PARTIAL `09-iteration-idioms/`** (Master) — 2 chunks · 507 lines · 14 ★. Bank `research_python_p03_t09_iteration_idioms.md` (279 lines). ⚠️ The README has **no row for chunk 02** (the author was aborted first) and 02's footer forwards to **02b** *(not written yet)*.
> ▶️ **RESUME (when the user says go):** ONE Workflow, **at most 3 topics** (see the lesson), `devbible-author` in *resume* mode — prompt shape is `authorPrompt(t,'resume',…)` in `devbible/python-workflow/python-complete-lanes.js` (read README + bank + every chunk's headings, EXTEND never rewrite). Per topic afterwards: `bash shared/scripts/topic-gate.sh <dir>` → wire (phase README row + count, re-link sweep, `progress.js`, pins, this cursor, LOCKS). Order: finish 08 and 09, then 10 → 11 → 12.
> 🔴 **Dashboard bug, owed:** the phase-3 `progress.js` row has no `pagesPlanned: 12`, so `phaseStatus()` reads it as *written* and credits Python for all 12 phase-3 topics while 7 exist. Add it in the next wiring pass.
> 🔴 **Owed, surfaced by the defect fixes and not fixed:** `05-slicing/10e` has `sidebar_position: 27` but sits between 10d and 11 in the footer chain (sidebar order ≠ reading order: renumber 10e=23, 11–11d=24–27) · `06-collections-module/08-userlist-and-userdict.md` ~line 43 says "five methods is the minimum" but its example overrides six, and line 23 should link `10e`, not `10c` · `03-dict/08-removing-entries.md` ~line 199 recommends the `next(iter(pending))` FIFO with no cost caveat (point at `02b`) · `04-set-and-frozenset/02` gotcha ~line 190 normalises IDs with a bare `int()` (`09-diffing-id-sets` calls that too forgiving) · `next(iter(s))` on a set after many removals — `Objects/setobject.c` not read.
> 🔴 **Lesson — [[feedback-workflow-cannot-drain]]:** never put an open-ended queue in one Workflow; bound it to the batch the user approved.
> **Tools** (`shared/scripts/`): `topic-gate.sh <dir>` · `py-commit.sh "<msg>" <paths>` · `store-commit.sh` · `py-autocommit.sh` (per-file committer — ⚠️ fixed 2026-09-21: its MDX gate compiled `_category_.json` as MDX and rejected every one, so a new topic's `_category_.json` was never auto-committed; never edit it while it runs). **Machine:** `~/.gitconfig` is gone (helpers borrow `shared/claude-home-backup/dotfiles/.gitconfig` via `GIT_CONFIG_GLOBAL`); `yarn` was not on this shell's PATH — use `node scripts/linkcheck.mjs`.
>
> # ⏸️ (SUPERSEDED by the 2026-09-21 STOPPED block above) PAUSED 2026-09-10 ~23:15 (session 48474032) — phase 3 at a CLEAN boundary, 0 agents. User: *enough for the day.*
> 🔴 **CI broke after this pause and was fixed (`344258012`):** bare `<=` / `<"` in three quoted lines. In every dispatch
> and every per-file gate use `node …/shared/scripts/mdx-compile-check.mjs <dir>` (run from the devbible root) — **not**
> `mdxcheck.py --no-rawtag`, which passed all three. Then read its EXPRESSION lines: any `{…}` that is not `{/* … */}` is a bug
> (`0fb91098b`: bare `{name}` in quoted error strings failed SSG). See `feedback_mdxcheck_no_rawtag_hides_a_build_breaker.md`.
>
>
> ▶️ **COLD START → dispatch `08-copy-and-deepcopy/` (Understand)** — one `devbible-author` agent, name
> `.agents/skills/devbible-topic/SKILL.md` in the prompt, bank `research_python_p03_t08_copy_and_deepcopy.md` first, README
> first, real footers, `_category_.json` = `{"label":"08 · copy vs deepcopy","position":8,"collapsed":true}`. Copy the
> dispatch shape used for 07 (it worked): *only add a Next → link / README row after the new chunk is complete on disk*.
>
> ✅ **CLOSED 2026-09-10:** `04-set-and-frozenset/` 26 chunks · 5,864 lines · 118 ★ · `05-slicing/` 26 · 5,910 · 105 ★ ·
> `06-collections-module/` 17 · 4,153 · 109 ★ (`9b784661f`) · `07-heapq-and-bisect/` 18 · 4,276 · 51 ★ (uses the
> `### Symptom/Cause/Fix` gotcha form, also house style, so ★ runs low) — wiring `539a967b7`: phase row, *7 of 12*,
> `progress.js` phase 3 → 7, 8 heapq mentions re-linked, `05-slicing/_scratch/` removed.
>
> Remaining slugs, fixed: `08-copy-and-deepcopy` `09-iteration-idioms` `10-sorting-compound-data` `11-choosing-a-structure`
> `12-array-and-memoryview`.
>
> ⚙️ **Coordinator tooling that worked this session** (scratchpad, recreate if needed): commit every `.md`/`_category_.json`
> untouched ≥90 s after cap/dup-position/mdxcheck/linkcheck **on those files only**; push only after `git archive HEAD` +
> `node scripts/linkcheck.mjs docs/python` on the committed tree is 0 — agents write Next → links a minute before the target
> lands, so the committed tree dangles briefly. Agents leave helper scripts (`.h2t.py`, `.relink.py`) — never commit them.
>
> 🔴 **Two factual defects reported by the 06 agent, NOT yet fixed — verify against v3.14.7 source, then fix:**
> 1. `05-slicing/10c-setitem-delitem-and-the-abcs.md` implies `UserList` routes every write through `__setitem__`; in
>    3.14.7 `append`/`extend`/`insert`/`+=`/constructor write `self.data` directly (06's chunk `08` has it right — link it).
> 2. `03-dict/02b-working-with-the-order.md` ~line 230 says `next(iter(d))` is O(1); after many front deletions the
>    iterator skips dead entries until the next resize (`dictiter_iternextkey_lock_held`).
> 3. `01-list-internals/07b-merging-and-galloping.md` — the `sorted_stream` fix keeps every sorted run in memory,
>    defeating the memory argument it makes (reported by the 07 agent).
> 4. `sortedcontainers` 2.4.0 is named in heapq `08`/`10` but has no pin in `src/data/pins.js`.
> Leftovers (not blockers): set `02` line 123 promises an unclear **14b** *(not written yet)*; unbanked sources from the set/slicing
> close (uuid, datetime, sqlite3 rst, `_sqlite/cursor.c`, `_struct.c`, sqlite.org limits / lang_expr / lang_select /
> datatype3, RFC 3629).
>
> Banks, committed, DO NOT RE-DERIVE: `research_python_p03_t04_set_and_frozenset.md` (950
> lines) · `research_python_p03_t05_slicing.md` (747).
> **How:** one `devbible-author` agent per topic, RESUME prompt — extend, never rewrite; as each
> planned chunk lands, re-link its de-linked mentions and move it from *Still to come* into the
> table; at close drop the caution box. QC (`yarn linkcheck <dir>` = 0, mdxcheck, cap, positions)
> → commit → re-link pass → bump `progress.js` phase 3 `pages` → repoint this block.
> **Then 06 `collections-module`.**
>
> 🔴 **Lesson of 2026-09-10 — two kills in one day, both salvaged by hand.** A running agent
> cannot be messaged here (no SendMessage) — only stopped. So every dispatch must keep its
> topic **committable after every file**: README written FIRST and updated per chunk, footers
> written with each chunk, and **no link to a chunk that is not on disk yet** (bold + *(not
> written yet)*, re-linked when it lands). Every salvage today was forward links to planned
> chunks plus a missing README.
>
> 🔴 **USER ORDER 2026-09-10: max 3 agents IN TOTAL across both python lanes**, and every
> dispatch names `.agents/skills/devbible-topic/SKILL.md`. Rolling: QC + commit the moment
> one reports, start the next in the freed slot.
>
> Closed 2026-09-10 (all salvaged after the 10:05 death): `01-list-internals/` `84df3809a` ·
> `02-tuple/` `6419538ef` · `03-dict/` `a86f238f6` · wiring `1c5ed175f`. Remaining slugs, fixed:
> `06-collections-module` `07-heapq-and-bisect` `08-copy-and-deepcopy` `09-iteration-idioms`
> `10-sorting-compound-data` `11-choosing-a-structure` `12-array-and-memoryview`.
>
> ✅ **Re-link recipe — run after every landing:** replace `**NN · Title** *(not written yet)*`
> with a link to `../NN-slug/README.md` in every closed topic + the phase README, then
> `yarn linkcheck` each topic. Last run `1c5ed175f`.
> ⚠️ `01-list-internals` chunks 01–07 carry exactly two `★` each (the template tell; worth a
> depth look, not a blocker).
>
> Phase 7 is its own lane: [CURSOR-PYTHON-PHASE7.md](CURSOR-PYTHON-PHASE7.md) — same state, one
> partial topic (`05-ruff/`). Keep the two cursors separate.
>
> ## Where the track actually stands — 2026-09-10
>
> **45 of 180 topics, 25%.** Phases 0 (12), 1 (16), 2 (10) done; phase 3 at 3/12; phase 7 at
> 4/12. Phase 1 alone ran to ~52,000 lines, so the unwritten part is the large majority.
>
> | Part | Phases | Topics | State |
> |---|---|---:|---|
> | Foundations | 0 runtime · 1 language core · 2 functions | 38 | ✅ done |
> | Data model | 3 collections · 4 classes · 5 iterators · 6 typing | 49 | **3 written** (phase 3) |
> | Application | 7 packaging · 8 concurrency · 9 web · 10 data · 11 REST/CRUD | 69 | **4 written** (phase 7) |
> | Production | 12 pytest · 13 production/perf | 24 | 0 written |
>
> ## Topic 12 — ✅ CLOSED 2026-09-10. Phase 1 is 16/16.
>
> **65 files, 16,777 lines, 377 ★.** Commits `ffa9adac3` (slots) · `ea57b7352` (splits) ·
> `5af1bef17` (trim restored) · `f817cbdc6` (close).
>
> ```
> 06l 321 -> 06l 06r 06y            06m 320 -> 06m 06s + 06zd 06zf 06zp 06zq 06zr
> 06j 305 -> 06j 06t 06u            06q new -> 06q 06v 06w 06x 06z 06za 06zb 06zc
>                                   06ze 06zg 06zh  (the restored trim)
> ```
>
> **SPLIT PROOF: 44 files / 11,140 lines / 244 ★ → 65 / 16,777 / 377.** Both up.
> Gates at close, run over the whole track: **485 files, 0 link problems, 0 MDX hazards**,
> nothing over 300 lines in `docs/python`; positions gap-free 141–184, footer chain unbroken
> across all 64 chunks, no `{/* FOOTER */}`, every chunk present in the README table.
> `progress.js` phase 1 → `pages: 16`; the phase README's line 23 rewritten to the close.
>
> ⚠️ **One thing is deliberately left undone.** `06zh` and `06ze` carry a de-linked
> **the caches you did not write** *(not written yet)* — the chunk on caches you inherit
> (DNS, stat, permission) and the cases where caching a check is genuinely right. Two agents
> were mid-way into it when I stopped them for scope runaway, and they had promised **two
> different filenames** for it. It is optional, not owed: nothing links to it and the topic
> closed clean. Write it only if someone asks for it.
>
> ## 🔴 Four things this session paid for — do not re-learn them
>
> 1. **Reserve the sidebar positions centrally BEFORE spawning parallel agents.** Three
>    agents independently hit "my reserved integer is taken" and each invented a *fractional*
>    position (156.5, 158.5, 158.75). All four then raced on letters and produced two `06u-`
>    and two `06y-` files. Renumbering is safe and renaming is not, so the coordinator must
>    own the number line and hand each agent a fixed slot — and reserve **more slots than the
>    plan needs**, because every split splits again.
> 2. **Letters here are IDs, not order.** The series already ran `06 06b…06h 06n 06o 06p 06k
>    06i 06l 06j 06m` before this session. Letters only need to be unique; `sidebar_position`
>    carries the reading order. That turns a scary mass rename into a two-file fix.
> 3. **An agent at exactly 300 lines will TRIM rather than ask.** One deleted six
>    doc-verified items to make two halves fit, and reported it honestly — the report is the
>    only reason it was caught. `06zd`/`06ze` exist to put that material back. **Tell agents
>    explicitly which spare slot to split into**, or they will treat the cap as a budget.
> 4. **Give an agent the tier badge as a fact, not a rationale.** A dispatch said `t-master`
>    while its parenthetical said "matching 06o/06p", and 06o/06p are `t-understand`. The
>    agent followed the literal instruction, flagged the contradiction, and did not guess —
>    which is right. All 57 pages in this topic are `t-understand`.
>
> ## Owed by this lane, unchanged
>
> The **38 Python topic READMEs** violating `house-style.md` line 64 (`sidebar_position: 0`,
> `sidebar_label: "Overview"`). Per-file list: `devbible/README-FRONTMATTER-DRIFT.md`.
> 🔴 Confirmed 2026-09-10 that **all 16 phase-1 READMEs drift the same way**, so this is a
> track-wide pass — fixing topic 12's alone would make it the odd one out. Not a close item.
>
> Research bank: `research_python_p01_t12_eafp_vs_lbyl.md`, now **1,278 lines** — §22 was
> appended 2026-09-10 with contextlib's unbanked members, PEP 488/`-O`, warning filters and
> decimal. Its **"could NOT settle" list is 10 entries**, two of them genuine contradictions
> between two official pages (`-W`'s `message` field; `PYTHONOPTIMIZE=0`). Those are written
> into the corpus as open questions on purpose — **do not "fix" a page by picking a side.**


---

> 🗄️ **88 lines of superseded history moved to [progress_python_pages-HISTORY.md](progress_python_pages-HISTORY.md) on 2026-09-10**, verbatim —
> earlier session blocks, the wind-downs they came from, and the reasoning behind decisions
> already applied above. Nothing was dropped. Reach for it when you need *why*, or when
> something here refers to a session you have no record of:
> ```bash
> grep -n -i '<term>' devbible/progress_python_pages-HISTORY.md
> shared/scripts/recall.sh --cold <terms>
> ```
