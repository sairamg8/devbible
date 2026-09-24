---
name: cursor-python-phase7
description: LIVE cursor for devbible Python PHASE 7 ONLY (packaging, projects and tooling) — the separate lane the user carved out on 2026-09-10 so phase 7 could run while another session writes phase 3 and topic 12. Holds the version spine, the 12-topic worklist, the wave plan and the exact next topic.
metadata:
  type: project
---

# devbible · Python **phase 7 only** — the live cursor

> # ⏸️ STOPPED 2026-09-21 ~18:15 by the user (session `d750a152`) — 0 agents running, nothing dispatching
> User: *"Once current agents complete do not deploy new ones and enough please save session progress."* A running Workflow cannot be drained, so `TaskStop` was the only way to guarantee nothing new deployed; it aborted the 3 in-flight authors (p3-08, p3-09, p7-07). Everything finished is committed: `git status docs/python` clean, `node scripts/linkcheck.mjs docs/python` = 840 files / 0 problems. **Nothing pushed.**
> ✅ **Landed 2026-09-21 — ALL phase-7 owed items below are FIXED** (defect job, each topic passed `topic-gate.sh`): `6c7b37145` dot-for-colon is refused at *install* time, a PEP 517 backend and Flask are not entry-point plugins (`01-pyproject-toml/10`) · `58c51454c` uv re-syncs after a `[project.scripts]` edit, "unconfirmed" caveat dropped (`02-uv/02c`) · `40864b49e` topic 04 re-linked (`02-uv/09b`) · CI action pins bumped after checking releases the same day — `e5e973b9d` `18ab0b470` `01c40b926` (checkout `@v4`→`@v7`, cache `@v4`→`@v6`, setup-uv `@v5`→`@v10.0.1`, create-pull-request `@v7`→`@v8`; `ruff-action@v4.1.0`, `upload-sarif@v4`, `checkout@v7`, `setup-uv@v10.0.1` were already right) · `b6c24a0c3` uv_build `metadata.rs` line citations off by 4 (`06-entry-points/01`, `01b`). Ignore the SUPERSEDED block's defect and currency lists.
> 🟡 **`07-wheels-and-sdists/` — NOT STARTED as pages.** The directory does not exist. The research bank IS complete: `research_python_p07_t07_wheels_and_sdists.md` (236 lines, 87 KB, written 18:14; §"Chunk plan" at the end = **19+ chunks:** 01 what a wheel is · 01b RECORD · 02 filename · 03 tags your interpreter accepts · 04 python/ABI tags · 05 platform tags · 06 sdist · 06b sdist contents · 07 which hook builds what · 08 why pip compiles · 09/09b what a missing wheel looks like (pip/uv) · 10 toolchain you inherit · 11 build isolation · 12/12b format flags · 13 caches · 14/14b pip wheel/download/build/uv build/PEP 658 · 15 native extensions · 16/16b Alpine/ARM/Docker · 17 security · 18 maker tools · 19 runbook + CI). Its "Could NOT settle" section lists what to write as uncertain.
> ▶️ **RESUME (when the user says go):** dispatch `07-wheels-and-sdists/` **fresh** — same prompt shape as `authorPrompt(t,'fresh')` in `devbible/python-workflow/python-complete-lanes.js` (bank exists, so the agent skips research and writes README first). Then 08 → 12. ONE Workflow, **at most 3 topics**. After each topic: `bash shared/scripts/topic-gate.sh <dir>` → wire (phase README row + count, re-link sweep, `progress.js` phase 7, pins, this cursor, LOCKS). Topic 08 must also report `pydantic-settings` and `python-dotenv` in pins.
> 🔴 **Still owed (currency / nits, not blockers):** `astral-sh/setup-uv` v10.1.0 shipped 2026-09-10 — the phase pins the valid immutable `v10.0.1` · **uv is 0.12.17 now, the pages say 0.12.12** (a devbible-currency sweep, `pins.js` still 0.12.12) · `01-pyproject-toml/10`: whether hatchling/setuptools/flit validate a colon-less `[project.scripts]` value at build time is unsettled and the page says exactly that · two spec quotes on that page end with a period inside the quote marks though the source sentence continues.
> 🔴 **Lesson — [[feedback-workflow-cannot-drain]]:** never put an open-ended queue in one Workflow; bound it to the batch the user approved. **Tools / machine:** see the phase-3 cursor's last block (`progress_python_pages.md`).
>
> # ⏸️ (SUPERSEDED by the 2026-09-21 STOPPED block above) PAUSED 2026-09-10 ~23:55 (session 48474032) — phase 7 at a CLEAN boundary, 0 agents. User: *enough for the day.*
> 🔴 **CI broke after this pause and was fixed (`344258012`):** bare `<=` / `<"` in three quoted lines. In every dispatch
> and every per-file gate use `node …/shared/scripts/mdx-compile-check.mjs <dir>` (run from the devbible root) — **not**
> `mdxcheck.py --no-rawtag`, which passed all three. Then read its EXPRESSION lines: any `{…}` that is not `{/* … */}` is a bug
> (`0fb91098b`: bare `{name}` in quoted error strings failed SSG). See `feedback_mdxcheck_no_rawtag_hides_a_build_breaker.md`.
>
>
> ▶️ **COLD START → dispatch `07-wheels-and-sdists/` (Understand)** — one `devbible-author` agent, name
> `.agents/skills/devbible-topic/SKILL.md` in the prompt, bank `research_python_p07_t07_wheels_and_sdists.md` first, README
> first, real footers, `_category_.json` = `{"label":"07 · Wheels vs sdists","position":7,"collapsed":true}`, *only add a
> Next → link / README row after the new chunk is complete on disk*. Reusable quotes for 07/10/12 are banked in
> `research_python_p07_t06_entry_points.md` (pip `MissingCallableSuffix`, pyproject `dynamic` scripts rule, setuptools
> editable re-install sentence, uv 0.12.0 reserved names).
>
> ✅ **CLOSED 2026-09-10:** `05-ruff/` 39 chunks · 9,112 lines · 169 ★ (wiring `9573e5f9b`) · `06-entry-points/` 14 chunks ·
> 3,194 lines · 90 ★ (`359dea3a9`, wiring `4be13ed50`: phase row, *6 of 12*, `progress.js` phase 7 → 6, 3 mentions re-linked).
>
> 🔴 **Defects in CLOSED phase-7 topics, reported by the 06 agent, NOT yet fixed:**
> 1. `01-pyproject-toml/10-entry-points-and-console-scripts.md` — says a dot-for-colon value fails at run time with
>    `ModuleNotFoundError`; pip 26.2.1, installer 1.0.1 and uv 0.12.12 reject it at **install** time. Same file: entry points
>    are *not* how pip finds a PEP 517 backend (`build-backend` string is imported), and the Packaging guide uses Flask as a
>    **naming-convention** example, not an entry-point one.
> 2. `02-uv/02c-uv-sync-makes-the-environment-match.md` — drop the "unconfirmed" caveat on re-sync after editing
>    `[project.scripts]`; uv's cache docs settle it (06 chunk `07` quotes it).
> 3. `02-uv/09b-uv-build-and-uv-publish.md` ~line 92 — still says **04 · Project layout** *(not written yet)*; re-link.
> 4. `02-uv/03b-upgrading-the-lockfile.md` line 80 pins `actions/checkout@v4` — add to the currency list below.
>
> 🔴 **CORRECTION to the currency note below:** `astral-sh/setup-uv` has published **no floating major tag since v8**
> (*"You won't be able to use `@v8` or `@v8.0` any longer."* — v8.0.0 release notes), and `astral-sh/ruff-action` has no
> `v4` tag. A snippet bumped to `@v10` breaks — pin `@v10.0.1` or a SHA. `actions/checkout@v7` exists. Still on the old
> pins: `03-dependencies/20-the-ci-flags-that-refuse-to-re-resolve.md`, `02-uv/05c-interpreter-upgrades-and-ci-matrices.md`,
> `02-uv/03b-upgrading-the-lockfile.md`.
>
> Bank, committed, DO NOT RE-DERIVE: `research_python_p07_t05_ruff.md` (533 lines). **How:** as
> in [progress_python_pages.md](progress_python_pages.md). Then bump `progress.js` phase 7.
>
> Closed: `01-pyproject-toml/` `19caf2558` · `02-uv/` `d4c071c4e` · `03-dependencies/`
> `9df094650` · `04-project-layout/` `0a0e54799` · wiring `1c5ed175f`, `7b9fb801c`.
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
> ⚠️ **Owed — currency drift, not content:** CI snippets pin `astral-sh/setup-uv@v5` (latest
> major **v10**), `peter-evans/create-pull-request@v7` (latest **v8**), `actions/checkout@v4` —
> checked 2026-09-10 on the GitHub releases pages; a devbible-currency pass must verify the
> inputs before bumping.
>
> 🔴 **Dispatch is ROLLING, not batched in waves of three.** Three agents is the ceiling,
> so the moment one reports, QC + commit it and start the next topic in the freed slot.
> Waiting for all three to land idles two agents for as long as the slowest one takes —
> topic 01 alone ran 35 minutes.
>
> 🔴 **THIS LANE IS PHASE 7 AND NOTHING ELSE.** Phase 3 is tracked in
> [progress_python_pages.md](progress_python_pages.md) — that file's `NEXT` line is its
> own. (Since 14:10 on 2026-09-10 one session holds both files; keep them separate anyway,
> so the lanes can be split across two sessions again.) Do not touch
> `docs/python/pages/phase-1-language-core/`; it was being written live on 2026-09-10.

## The version spine — fetched 2026-09-10, do not re-derive

| Thing | Pin | Released | Where it went |
|---|---|---|---|
| **Python** | **3.14.7** | 2026-08-05 | already in `src/data/pins.js` |
| **uv** | **0.12.12** | 2026-09-09 | 🆕 added to `pins.js` in `a5127c270` |
| **ruff** | **0.16.6** | 2026-09-03 | 🆕 added to `pins.js` in `a5127c270` |
| **pre-commit** | **4.6.2** | 2026-08-10 | 🆕 added to `pins.js` in `a5127c270` |

Sources: `endoflife.date/api/python.json`, and the GitHub `releases/latest` API for
`astral-sh/uv`, `astral-sh/ruff`, `pre-commit/pre-commit`.

🔴 **uv is pre-1.0 and ships weekly.** Any uv page must name the version a recent flag
landed in, and say where a behaviour may not survive. A uv page written as if uv were
stable is a page that goes quietly wrong.

## The 12 topics, and the wave they run in

| # | Directory | Tier | State |
|---|---|---|---|
| 01 | `01-pyproject-toml/` | Master | ✅ **15 files, 3,370 lines, 234 ★** · `19caf2558` |
| 02 | `02-uv/` | Master | ✅ **37 files, 9,105 lines, 314 ★** · `d4c071c4e` |
| 03 | `03-dependencies/` | Master | ✅ **34 files, 8,235 lines, 300 ★** · `9df094650` |
| 04 | `04-project-layout/` | Understand | ✅ **17 files, 3,707 lines, 84 ★** · `0a0e54799` |
| 05 | `05-ruff/` | Understand | ✅ **39 chunks, 9,112 lines, 169 ★** · `33a3ee319` |
| 06 | `06-entry-points/` | Understand | ✅ **14 chunks, 3,194 lines, 90 ★** · `359dea3a9` |
| 07 | `07-wheels-and-sdists/` | Understand | **next to dispatch** |
| 08 | `08-config-and-secrets/` | Understand | queued |
| 09 | `09-inline-script-metadata/` | Know | queued |
| 10 | `10-editable-installs/` | Know | queued |
| 11 | `11-pre-commit/` | Know | queued |
| 12 | `12-publishing-to-pypi/` | Know | queued |

🔴 **Topic 01 went 5 planned chunks → 14 written, and that is the yardstick for the rest.**
It covers `pyproject.toml` field by field, so every later topic must be dispatched with an
explicit *do not repeat topic 01* scope note and told to **link** its chunks instead. Two
real overlaps already exist and were deliberately left as field-vs-practice splits: topic 01
chunk 07 covers extras and dependency groups **as fields** (topic 03 owns them as practice),
and chunk 10 covers `[project.scripts]` **as a field** (topic 06 owns the installed command).
Check both for duplication when 03 and 06 land.

**Once a topic is committed, later agents may LINK it** — that is the de-linking rule
lifting, and it is worth telling each agent explicitly which sibling files are on disk.

3 Master of 12 is 25% — deliberately at the bottom of house-style's 25–30% band, because
the three Master rows are the ones that decide whether a stranger can reproduce the
project.

## 🔴 How this lane dispatches agents — the rules that were paid for

The four lessons in [progress_python_pages.md](progress_python_pages.md) came out of a
four-agent parallel run on topic 12. They are applied here as follows, and re-applied
in every wave:

1. **One agent owns one whole topic directory.** That is what removes the
   `sidebar_position` race entirely: positions only have to be unique *within* a
   directory, so agents in different directories cannot collide. The topic-12 run
   collided because four agents shared one directory's number line.
2. **The agent writes its own `_category_.json`**, and the exact one-line content is
   handed to it in the dispatch. Deterministic, and no two agents touch one file.
3. **`README.md` is `sidebar_position: 0`.** Handed to every agent as an instruction,
   because 38 existing Python topic READMEs drift to the topic's own number and an
   agent that copies a neighbour copies the drift.
4. **Tell the agent the tier as a bare fact with no rationale**, and tell it to write
   that badge even if it disagrees, flagging the disagreement in its report. A dispatch
   whose parenthetical contradicts its instruction gets a (correct) refusal to guess.
5. **Tell the agent explicitly: past 300 lines you split into a lettered sibling taking
   the next free integer position — you never trim, and both `wc -l` and
   `grep -c '^\*\*★'` must go UP.** An agent at exactly 300 lines will otherwise delete
   verified material to make the halves fit. It happened, and only the agent's honest
   report caught it.
6. 🔴 **Every link OUT of an agent's topic directory is de-linked** — bold +
   `*(not written yet)*` — for the whole wave, the phase index `../README.md` excepted.
   Sibling agents finish at different times, so a cross-topic link is dangling *at the
   moment it is committed*, and `onBrokenLinks: 'throw'` turns that into a skipped
   deploy for every other track in the checkout. **The coordinator re-links the chain in
   one wiring pass after the wave**, which is also when the phase README's rows get
   their links.

## Wiring pass — after every wave

```bash
cd /mnt/Storage/Backup/Knowledge/devbible
P=docs/python/pages/phase-7-packaging-tooling
wc -l $P/*/*.md | awk '$1>300'                              # must be empty
grep -rln '^{/\* FOOTER \*/}$' $P                           # must be empty
grep -h '^sidebar_position:' $P/<topic>/*.md | sort -n | uniq -d   # per topic, empty
grep -H '^sidebar_\(position\|label\):' $P/*/README.md      # every one 0 / "Overview"
node /mnt/Storage/my-learning/claude/shared/scripts/mdx-compile-check.mjs $P   # 0 failed — the REAL gate; mdxcheck --no-rawtag missed `<=` 2026-09-10
yarn linkcheck $P                                           # 0 problems
```

Then: re-link the landed rows in `$P/README.md`, flip the `🚧 In flight — n of 12`
count, bump `pages:` on the phase-7 row of `src/data/progress.js` (line ~961 — the
phase-1 row on line ~955 belongs to the other lane, leave it alone), and repoint the
`▶️ NEXT` line at the top of this file.

`shared/scripts/wire-footers.py` and `wire-topic.py` exist and are the right tools for
the chain; check what they expect before hand-editing footers.

## Research banks this lane creates

One per topic, `research_python_p07_t<NN>_<slug>.md`, banked **before** the topic's
first chunk and marked `do not re-derive`. A topic that re-fetches per chunk pays the
research cost once per chunk instead of once per topic — that, not the writing, is
where usage goes.

## Owed, inherited, not this lane's to fix

The **38 Python topic READMEs** with `sidebar_position: <topic number>` instead of `0`
(list: `README-FRONTMATTER-DRIFT.md`). Phase 7's own READMEs are written correct from
the start, which widens the gap rather than closing it — that is the right trade, and
it is a track-wide pass, not a phase-7 close item.
