---
name: devbible-typescript-history
description: TypeScript session history — what phases 0, 1 and 2 contain, the sandbox runs behind them, and the superseded Part A session; open only when auditing finished work, not to resume
metadata:
  type: progress
---

# TypeScript — finished phases and superseded sessions

Split out of [[devbible-typescript-build-progress]] on 2026-08-15 when that file
passed the 300-line memory cap ([[devbible-memory-file-cap]]).

**Do not open this to resume.** The live cursor is in the parent. Open this when
auditing a finished phase, tracing where a phase-0/1/2 claim came from, or making
sense of a branch's origin in the reflog.

## Phase 0 — How TypeScript runs ✅ 13/13

All single files, **154–262 lines**, none over cap, genuine spread.

01 checker-not-runtime 217 · 02 erasure 262 · 03 three-ways-to-run 208 ·
04 strip-only-and-erasable 207 · 05 strict 230 · 06 tsconfig-anatomy 199 ·
07 typescript-7 231 · 08 where-types-come-from 206 · 09 editor-vs-build 176 ·
10 checking-vs-transpiling 190 · 11 project-layout 230 · 12 release-cadence 154 ·
13 playground-and-ts-check 173 · README 85

Dataset and the four contradicted-expectation findings:
[[devbible-typescript-phase0]].

## Phase 1 — The type vocabulary ✅ 17/17

Sandbox `sandbox/ts-p1/`. Technique established in `ex1`: **emit `.d.ts` with
`--declaration --emitDeclarationOnly` and read the inferred types out of it** —
the only way to show inference without trusting a hover tooltip.

01 primitives-and-inference (216) · 02 literal-types-and-as-const (228) ·
03 arrays-and-tuples (208) · 04 object-types (228) · 05 union-types (196) ·
06 any-unknown-never-void (216) · 07 type-vs-interface (~210) ·
08 function-types (~230) · 09 structural-typing (~215) ·
10 null-and-undefined (~225) · 11 intersection-types (~180) ·
12 call-and-construct-signatures (~190) · 13 enum-vs-union (~200) ·
14 readonly-and-immutability (~205) · 15 recursive-types (~215) ·
16 object-Object-braces · 17 symbols

🔴 **`ex6` caught TWO invented claims before they shipped** — the `reduce`
example did not compile (accumulator inferred from the elements; needs
`reduce<number>`), and `TS2589` did **not** fire at depth 50 or 500, only 5000.
Folklore "interfaces give better errors" did **not** reproduce for a plain object
alias — identical `TS2741` naming both. Weak-type detection (`TS2559`) was found
by measurement, and it stops applying once one property is required.
`noUncheckedIndexedAccess` flips `first<T>` to `T | undefined`.

Full dataset: [[devbible-typescript-phase1]].

## Phase 2 — Narrowing ✅ 13/13

**22 files · 4,261 lines · 0 over the 300-line cap.** Sandbox `sandbox/ts-p2/`,
TS 7.0.2 — `ex1-narrowing-basics.sh` and `ex2-guards-and-loss.sh`.

**Technique that carries the phase: reveal a narrowed type by assigning it to
`1`** and reading the compiler's error — it prints the exact type the checker
holds at that point. Every narrowing claim in phases 1–2 is backed that way.

Measured in `ex1` (all from one file): `typeof v === 'string'` → `string` ·
`'number'` → `number` · **`'object'` → `string[] | null`** (the `typeof null`
trap) · `if (v)` → `string | number | string[]` · `v != null` → **the same
type** · `Array.isArray(v)` → `string[]`.

🔴 **The finding worth keeping: truthiness and `!= null` produce IDENTICAL
types**, so the `''`/`0` falsy bug is invisible to the compiler — the type is
right and the logic is wrong. That is page 01's centrepiece.

`ex2` measured guards and narrowing loss: `in` → Cat/Dog both directions ·
`instanceof` → ApiError/Error · predicate `p is Cat` → Cat ·
`asserts v is string` → string after the call. **Narrowing SURVIVES `await`, is
LOST in a callback** (one `TS18047` on the `forEach` line) — which falsified a
claim already shipped on phase-1 page 10 and was corrected there.

⚠️ **`sandbox/ts-p2/` has NO saved output files** — only the scripts and
`src-ex*`. So pages 01–07 keep their console blocks (written while the run was
live); **08–13 carry none**, and their findings are stated in prose marked
sandbox-measured. Nothing was reconstructed from memory.

Claims record: [[devbible-typescript-phase2]].

### Phase 2's own topic breakdown

01 typeof (~200) · 02 truthiness-and-equality (~185) · 03 in-operator (~170) ·
04 instanceof (~190) · 05 discriminated-unions (~215) · 06 exhaustiveness (~200) ·
07 type-guards (~200) · 08 `as` assertions (chunked, 3 files) ·
09 assertion functions (3 files: 63 · 240 · ~230 — ran to **302 lines flat and
was SPLIT on a concept boundary**, not trimmed) · 10 `satisfies` (3 files:
55 · 246 · 255 — chunked from the start) · 11 narrowing you lose (3 files:
71 · 244 · 252 — split follows the **measured seam**: callback = false positive,
`await` = false negative) · 12 `unknown` in `catch` (1 file, 291) ·
13 non-null `!` (1 file, 245).

## Superseded: Part A session `3bbe364c`, 2026-08-14

Picked up on *"pick ts part a"*, made **exactly one commit** (`b3944d54`, 18:30
on 2026-08-14 — the phase-2 index plus topic 08) and went quiet. What it did:

1. ✅ **Fixed a real defect** — `pages/phase-2-narrowing/README.md` did not exist
   (114 lines now). It was the source of every TypeScript broken link in the
   builds of that week: seven leaf pages linking `./README.md` at a file that was
   never written. **The link forms were correct and were not changed** — this is
   the canonical example of not "fixing" a warning by rewriting a link.
2. ✅ **Topic 08 · `as` assertions** — ran to **307 lines**, split on a concept
   boundary rather than trimmed.

## Superseded: whole-ownership session `713ec3db`, 2026-08-14 → 2026-08-15

Took TypeScript **whole** after CSS was confirmed complete (*"If css completed
next pick you typescript please"*), on the grounds that Part A had gone quiet and
Part B was never picked up. Closed phase 2 (13/13) and wrote phase 3 topics 01–11.
Paused 2026-08-15 on *"save current session progress to memory and enough"* with
everything committed and boards current.

⚠️ Note for anyone reading old text: that session's worktree
`devbible-typescript` / branch `typescript-pages` was **merged into `main` as
`17ef13e4` and deleted** in the 2026-08-15 consolidation. It had first been
created as `devbible-css` / `css-pages` while CSS was still the subject, then
moved with `git worktree move` + `git branch -m` — which is why the branch's
origin in the reflog looks odd. Nothing was lost.

The merge had **one conflict**, in `docs/README.md`'s claims table, resolved by
keeping `main`'s two JavaScript lane rows **and** the branch's TypeScript row —
the standard board-conflict shape, never pick a side.

## The A/B split, as history

[[devbible-typescript-split-parts-ab]] defines Part A as phases 2–6 (73 topics)
and Part B as phases 7–12 (84). Session `713ec3db` declared the split closed and
held both; **it was reopened 2026-08-15** when the user said *"Pick typescript
a"*, so Part A's boundary is live again and Part B is unclaimed. Read that file
for the boundary and the shared-board ownership rules, not for its "another
session is writing Part B at the same time" framing — nobody is.

Related: [[devbible-typescript-build-progress]] · [[devbible-typescript-phase3]] ·
[[devbible-worktree-consolidation-20260815]]
