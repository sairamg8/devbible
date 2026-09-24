---
name: devbible-typescript-split-parts-ab
description: The A/B split of the remaining TypeScript work across two parallel sessions — phases 2–6 vs 7–12, who owns which files, and the phase-2 README that is missing and causing broken links
metadata:
  type: project
---

# TypeScript — the Part A / Part B split (2026-08-14)

Set on the user's instruction, immediately after the same split was made for React:
*"i need split of typescript"*. Modelled on
[[devbible-react-split-parts-ab]] — read that one too if anything here is ambiguous.

**Baseline at the split:** `main` at `eee63d6`. TypeScript is **30 of 187 topics · 16%**,
with phases 0 and 1 complete and phase 2 partly written. **157 topics pending.**
The claim in `docs/README.md` was last held by a session that is gone — **TypeScript is
free to pick up**, and both parts should add their own claim row.

## The two parts

| | **Part A — the type system** | **Part B — TypeScript in the stack** |
|---|---|---|
| Phases | **2–6** | **7–12** |
| | 2 Narrowing and control flow (13) | 7 TypeScript on the server (15) |
| | 3 Generics (14) | 8 TypeScript in React (14) |
| | 4 Classes, objects, declaration merging (14) | 9 Types at the boundary (15) |
| | 5 Type-level programming (16) | 10 Strictness and correctness (13) |
| | 6 Modules, declarations and the build (16) | 11 Migration and legacy (12) |
| | | 12 Tooling, performance and testing (15) |
| **Topics** | **73** | **84** |
| Directories | `docs/typescript/pages/phase-{2,3,4,5,6}-*/` | `docs/typescript/pages/phase-{7,8,9,10,11,12}-*/` |
| Est. | 2–2.5 hr incl. builds | 2.5–3 hr incl. builds |

**The boundary is conceptual, not just arithmetic.** Part A is the type system as a
language: how types narrow, how they generalise, how they compose, and how the compiler is
fed. Part B is TypeScript meeting other people's code — Node, React, the network boundary,
a legacy codebase, and the toolchain. Part A's phases are prerequisites for reading Part B's
pages, but not for *writing* them.

## 🔴 Part A starts by fixing a real defect

**`docs/typescript/pages/phase-2-narrowing/` has seven topic files and NO `README.md`.**
That single omission is the source of the TypeScript broken links that have shown up in
every build this session (`./README.md` unresolved from each leaf page, plus forward links
to unwritten topics 08 and 12).

Part A's **first task** is to write that `README.md` — phase index, tier badges, the
13-topic table — and then finish topics 08–13. The build warnings disappear on their own
once the file exists and the topics are written; **do not "fix" them by rewriting the link
form.** A `.md` link that resolves file-relative is correct; it warns only because the
target does not exist yet.

Written so far in phase 2: `01-typeof-narrowing` · `02-truthiness-and-equality` ·
`03-in-operator-narrowing` · `04-instanceof-narrowing` · `05-discriminated-unions` ·
`06-exhaustiveness` · `07-type-guards`.

## The shared board files

Identical rules to the React split, and they now matter more because **four** parallel
sessions touch these files (React A, React B, TS A, TS B, plus JavaScript's two lanes).

| File | Rule |
|---|---|
| `src/data/progress.js` | 🔴 **Anchor every edit on the row's `slug`**, never on `topics:`/`pages:` numbers. A slug is unique; a numeric pattern is not, and matching the wrong row silently edits another language |
| `docs/typescript/pages/README.md` | Each owns its own phase rows. Re-read immediately before editing |
| `docs/README.md` | ⚠️ **One shared TypeScript row plus one claims row.** Re-read, then edit to reflect **both** parts — do not overwrite the other's half |

**Never `git add -A`.** Stage explicit paths only.

## Builds

- Distinct out-dirs: `build-ts-a` and `build-ts-b`.
- **Do not `rm -rf .docusaurus`** while another session may be building. But note the CSS
  session's hard-won lesson ([[devbible-css-pages-progress]]): **a warm build's link report
  is not evidence.** Run one true clean rebuild before claiming a phase is link-clean, and
  coordinate so only one part does it at a time.
- **Check for `[SUCCESS]` before interpreting any grep.** An aborted build proves nothing,
  and a grep against an aborted log returns nothing — which reads as "clean".
- Tally by language; TypeScript must reach **0**:
  ```bash
  yarn build --out-dir <yours> 2>&1 | grep -iE 'warning|broken' | grep -o 'docs/[a-z]*/' | sort | uniq -c
  ```

## Standing rules both parts inherit

- **300 lines is a file-size rule, never a content budget.** Write the explanation the topic
  deserves, then split on a concept boundary into `NN-topic/` with `_category_.json`, a
  `README.md` index and `NN-chunk.md` parts. [[devbible-never-compress-to-fit-cap]]
- **Links always end in `.md` and keep every numeric prefix.** Never the slug form.
- **No sandboxes, no console blocks.** Validate against the TypeScript handbook, the release
  notes and MDN, and name the sources in each page's `> Verified:` line. **No run means no
  output block** — and TypeScript is a language where it is very tempting to paste a
  plausible `tsc` error. Do not.
- **A claim the docs cannot settle is stated as uncertain or left out.**
- **Update the UI after every topic; write and commit memory every 2–3 files.**
- Commit with `git commit -F -` and a quoted heredoc.

## Handoff

Each part keeps its own section in a progress memory
(`progress_typescript_build.md` already exists — extend it, do not rewrite the other
part's lines). When both finish, TypeScript is complete at **187 topics**.

Related: [[devbible-react-split-parts-ab]] · [[devbible-typescript-build]] ·
[[devbible-typescript-syllabus]] · [[devbible-css-pages-progress]] (the build-verification
failure worth not repeating)

---

## The two prompts, verbatim

Each must **explicitly override** `~/.claude/CLAUDE.md` rule 11, which currently reads
"JavaScript only" — a session that loads it without the override will work the wrong
technology.

### Part A

> Work **TypeScript Part A** and nothing else. This overrides rule 11 in
> `~/.claude/CLAUDE.md` — that rule says JavaScript; it is superseded for this session.
>
> Read these first, in order:
> `/mnt/Storage/my-learning/claude/devbible/project_typescript_split_parts_ab.md`, then
> `devbible/progress_typescript_build.md` and `devbible/project_typescript_syllabus.md` in
> the same store.
>
> **Your job: write TypeScript phases 2, 3, 4, 5 and 6 — 73 topics — then close each phase
> as you finish it.** Work in `/mnt/Storage/Backup/Knowledge/devbible` on `main`.
> Add your claim row to the claims table in `docs/README.md` before you start; TypeScript
> is currently unclaimed.
>
> 🔴 **Start with a real defect:** `docs/typescript/pages/phase-2-narrowing/` has seven
> topic files and **no `README.md`**, which is why TypeScript broken links appear in every
> build. Write that phase index first, then finish phase 2's topics 08–13. Do not "fix" the
> warnings by changing the link form — the links are correct and warn only because their
> targets do not exist yet.
>
> Another session is writing **Part B** (phases 7–12) at the same time. **Never create or
> edit a file under `docs/typescript/pages/phase-{7,8,9,10,11,12}-*/`.** You share three
> board files with it — read the split memory for the ownership rules, and anchor every
> `src/data/progress.js` edit on the row's **slug**, never on the numbers.
>
> Build with `--out-dir build-ts-a`. Check for `[SUCCESS]` before interpreting any grep — an
> aborted build proves nothing. TypeScript must reach 0 warnings.
>
> Do not wait for me. Pick the recommended next action and take it.

### Part B

> Work **TypeScript Part B** and nothing else. This overrides rule 11 in
> `~/.claude/CLAUDE.md` — that rule says JavaScript; it is superseded for this session.
>
> Read these first, in order:
> `/mnt/Storage/my-learning/claude/devbible/project_typescript_split_parts_ab.md`, then
> `devbible/progress_typescript_build.md` and `devbible/project_typescript_syllabus.md` in
> the same store.
>
> **Your job: write TypeScript phases 7, 8, 9, 10, 11 and 12 — 84 topics — then close each
> phase as you finish it.** These are TypeScript meeting other people's code: on the server,
> in React, at the network boundary, strictness, migrating a legacy codebase, and the
> toolchain. Work in `/mnt/Storage/Backup/Knowledge/devbible` on `main`. Add your claim row
> to the claims table in `docs/README.md` before you start.
>
> Scaffold each phase directory as you reach it — `_category_.json` plus a `README.md`
> carrying the full topic table — before writing topics into it.
>
> Another session is writing **Part A** (phases 2–6) at the same time. **Never create or
> edit a file under `docs/typescript/pages/phase-{2,3,4,5,6}-*/`.** You share three board
> files with it — read the split memory for the ownership rules, and anchor every
> `src/data/progress.js` edit on the row's **slug**, never on the numbers.
>
> ⚠️ Phase 8 is **TypeScript in React**, and React's own pages are owned by other sessions.
> Write the TypeScript side and link out; do not edit anything under `docs/react/`.
>
> Build with `--out-dir build-ts-b`. Check for `[SUCCESS]` before interpreting any grep — an
> aborted build proves nothing. TypeScript must reach 0 warnings.
>
> Do not wait for me. Pick the recommended next action and take it.
