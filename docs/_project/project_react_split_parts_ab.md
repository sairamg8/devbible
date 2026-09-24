---
name: devbible-react-split-parts-ab
description: The A/B split of the remaining React work across two parallel sessions — who owns which files, and the three shared board files that need care
metadata:
  type: project
---

# React — the Part A / Part B split (2026-08-14)

Set on the user's instruction: *"split pending tasks of react two parts i will open new
sessions i just to tell pick part a to one session and part b to another one"*.

**Baseline at the split:** `main` at `add46a3`. React phases 0–10 complete and merged;
Phase 11 at **7 of 17**; Phase 14 approved and unwritten. **217 React leaf pages.**
Full state: [[devbible-react-phase7]].

## The two parts

| | **Part A** | **Part B** |
|---|---|---|
| Work | **Phase 11 topics 08–17** + phase close — ✅ **DONE 2026-08-14** (session `bfcb390b`, merge `a583dae2`) | **Phase 14 · Testing React** — scaffold + all 14 topics + close |
| Directory | `docs/react/pages/phase-11-ssr-hydration/` | `docs/react/pages/phase-14-correctness/` |
| Topics | 10 | 14 |
| Sources | **6 of 10 already fetched** (see [[devbible-react-phase7]]) | **none fetched** — RTL, `user-event`, MSW, Jest/Vitest are new territory, not react.dev |
| Est. | 45 min–1 hr incl. build | 1–1.5 hr incl. build |

**Their page directories are disjoint.** Neither should ever create or edit a file in the
other's phase directory.

✅ **Part A finished 2026-08-14** — Phase 11 is 17/17, 24 leaf pages, 5,495 lines, 0 over 300,
merged into `main`. From topic 11 onward it was written in the worktree **`devbible-react-p11`
(branch `react-p11-part-a`)** on the user's instruction, and **merged after every topic**, so
nothing is stranded. Its estimate here (45 min–1 hr) was wrong by a lot — the ten topics took
five chunked directories and ~4,000 new lines. State: [[devbible-react-part-a-phase11]].
**Part B is still live.**

## 🔴 The three shared board files — the only real collision risk

Both parts must update all four UI places (rule 9), and three of them are shared with each
other *and* with the JavaScript, Git and Express sessions.

| File | Rule |
|---|---|
| `src/data/progress.js` | **Anchor every edit on the row's `slug`**, never on `topics:`/`pages:` numbers. A/B touch different rows (`phase-11-ssr-hydration` vs `phase-14-correctness`), so anchored edits cannot collide |
| `docs/react/pages/README.md` | Each owns **its own phase row and its own claim-table row**. Re-read the file immediately before editing |
| `docs/README.md` | ⚠️ **One shared React row.** Re-read it, then edit it to reflect **both** phases — do not overwrite the other part's half |

🔴 **The `progress.js` first-match trap is on record and cost a real regression this
session:** a replace anchored on `topics: 19, pages: N, pagesPlanned: 19` matched
**JavaScript's** phase 9 row, which sits earlier in the file. Three commits silently edited
another language's row. **Anchor on the slug. Always.**

**Never `git add -A`.** Stage explicit paths only: your phase directory, plus the three board
files.

## Builds

Both parts finish with a clean rebuild. Two concurrent builds in one checkout fight over
`.docusaurus`:

- Use a **distinct `--out-dir`** — `build-react-p11` for A, `build-react-p14` for B.
- **Do not `rm -rf .docusaurus`** while the other part may be building.
- Tally warnings **by language** before reacting; other sessions' warnings are theirs:
  ```bash
  yarn build --out-dir <yours> 2>&1 | grep -iE 'warning|broken' | grep -o 'docs/[a-z]*/' | sort | uniq -c
  ```
  React must be **0**. Known and not yours: typescript, git.
- A failure you did not cause (a duplicate doc id from a session mid-write) is something to
  **wait out and retry**, not investigate.

## Standing rules both parts inherit

- **300 lines is a file-size rule, never a content budget.** Write the explanation the topic
  deserves, then split on a concept boundary into `NN-topic/` with `_category_.json`, a
  `README.md` index and `NN-chunk.md` parts. [[devbible-never-compress-to-fit-cap]]
- **Links always end in `.md` and keep every numeric prefix.** `../01-x/README.md` for a
  directory index. Never the slug form.
- **No sandboxes, no console blocks.** Validate against primary documentation and name the
  sources in each page's `> Verified:` line. **No run means no output block.**
- **A claim the docs cannot settle is stated as uncertain or left out.** Precedents from
  this phase: Phase 10 topic 12 declines to give a root cause for CVE-2025-55182; Phase 11
  topic 07 declines to describe selective hydration's scheduling policy.
- **Update the UI after every topic; write and commit memory every 2–3 files.**
- Commit with `git commit -F -` and a quoted heredoc — backticks in `-m` get
  command-substituted away.

## Handoff

Each part updates [[devbible-react-phase7]] as it goes — **its own section only**, to avoid
two sessions rewriting the same lines. When both finish, React is complete at **210 topics**
and the file can be repointed or retired.

Related: [[devbible-react-phase7]] · [[devbible-react-syllabus]] ·
[[devbible-feedback-ui-progress-and-build-cadence]] · [[devbible-feedback-parallel-sessions]]

---

## The two prompts, verbatim

Kept here so they can be reissued if a session dies. Each must **explicitly override**
`~/.claude/CLAUDE.md` rule 11, which currently reads "JavaScript only" — a session that
loads it without the override will work the wrong technology.

### Part A

> Work **React Part A** and nothing else. This overrides rule 11 in `~/.claude/CLAUDE.md`
> — that rule says JavaScript; it is superseded for this session.
>
> Read these first, in order: `/mnt/Storage/my-learning/claude/devbible/project_react_split_parts_ab.md`,
> then `devbible/progress_react_phase7.md` in the same store.
>
> **Your job: finish React Phase 11 — topics 08 through 17 — then close the phase.**
> Work in `/mnt/Storage/Backup/Knowledge/devbible` on `main`. Your directory is
> `docs/react/pages/phase-11-ssr-hydration/`. The 17-topic table with the intended
> filenames is already in that directory's `README.md`; topics 01–07 are written.
>
> Another session is writing **Part B** (Phase 14) in
> `docs/react/pages/phase-14-correctness/` at the same time. **Never create or edit a file
> in that directory.** You share three board files with it — read the split memory for the
> ownership rules, and anchor every `src/data/progress.js` edit on the row's **slug**,
> never on the numbers.
>
> Close the phase with a clean rebuild using `--out-dir build-react-p11`, and tally
> warnings by language — React must be 0; typescript and git warnings are other sessions'.
>
> Do not wait for me. Pick the recommended next action and take it, all the way to the
> phase close.

### Part B

> Work **React Part B** and nothing else. This overrides rule 11 in `~/.claude/CLAUDE.md`
> — that rule says JavaScript; it is superseded for this session.
>
> Read these first, in order: `/mnt/Storage/my-learning/claude/devbible/project_react_split_parts_ab.md`,
> then `devbible/progress_react_phase7.md` in the same store.
>
> **Your job: write React Phase 14 — "Testing React" — from scratch.** 14 topics, syllabus
> already approved by the user, in `docs/react/syllabus/04-building-an-app.md`. Scaffold
> `docs/react/pages/phase-14-correctness/` with `_category_.json`
> (`{"label":"Phase 14 · Testing React","position":14,"collapsed":true}`) and a `README.md`
> carrying the full 14-topic table, then write every topic, then close the phase.
> Work in `/mnt/Storage/Backup/Knowledge/devbible` on `main`.
>
> **Nothing is fetched for this phase.** React Testing Library, `user-event`, MSW and
> Jest/Vitest are not react.dev — get the primary docs and name them in each page's
> `> Verified:` line. No sandboxes and no console blocks: no run means no output block.
>
> Another session is writing **Part A** (Phase 11) in
> `docs/react/pages/phase-11-ssr-hydration/` at the same time. **Never create or edit a
> file in that directory.** You share three board files with it — read the split memory for
> the ownership rules, and anchor every `src/data/progress.js` edit on the row's **slug**,
> never on the numbers.
>
> Close the phase with a clean rebuild using `--out-dir build-react-p14`, and tally
> warnings by language — React must be 0.
>
> Do not wait for me. Pick the recommended next action and take it, all the way to the
> phase close.
