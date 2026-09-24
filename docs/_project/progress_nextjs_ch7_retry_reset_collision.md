---
name: progress-nextjs-ch7-retry-reset-collision
description: Next.js ch7 2026-09-04 — THREE sessions worked the same error-boundary defect at once in three worktrees; records the duplicated work, what is unique to each branch, and the lock-protocol hole that allowed it. Open before starting any ch7 or error-boundary work, and before merging claude/agitated-kare-23d41a.
metadata:
  type: project
---

# Next.js ch7 — three sessions, one defect, 2026-09-04 (session `640d1812`)

Child of [[progress-nextjs-import]]. Sibling of
[[progress-nextjs-ch7-boundary-hierarchy]] (session `bf92d5b6`'s record of the same work).
**Neither session moved the ch17 track cursor; that START HERE still stands.**

## 🔴🔴 THE HEADLINE: THE LOCK PROTOCOL DID NOT CATCH THIS

Three sessions were live on the Next.js lane simultaneously, in three separate worktrees:

| Session | Worktree / branch | Doing |
|---|---|---|
| `4aa2d031` | `main`, shared checkout | **ch17** — 3 `devbible-author` agents. FOUND this ch7 defect and spawned it as a task |
| `bf92d5b6` | `jolly-diffie-4abc33` | **ch7** — hierarchy rule, split `10b` → `10c` + `10d`, S1 fix on page 10 |
| `640d1812` (me) | `agitated-kare-23d41a` | **ch7** — the same S1 fix, split `10` → `08` + `09`, ch2/ch4 propagation |

🔴 **I checked `LOCKS.md` before writing and it said the lane was FREE** — correctly, as of
14:52: the previous holder `21a54205` had stamped its wind-down at 14:44. **Both `4aa2d031`
and `bf92d5b6` started after that and neither had stamped `LOCKS.md`.** The lane was occupied
by two sessions and the lock file said nobody.

**The hole: a session stamps `LOCKS.md` at WIND-DOWN, not at pick-up.** Every recorded stamp
in the Next.js row is a `⏹️ WOUND DOWN` or a mid-run update. So a lane reads free for the
entire window between one session closing and the next remembering to write — and in a
three-worktree day that window is where all the duplicated work happens.

**Fix to adopt: claim the lane in `LOCKS.md` as the FIRST write of the session, before the
first page.** A claim costs one line and is cheap to revert; this cost two overlapping
authoring runs on one chapter. ⚠️ Checking `git worktree list` and `git log --all` would have
caught it too — **`main` alone is not the lane.** Both sibling branches were invisible from a
`git log` of `main`, and `git status` in my own worktree was clean the whole time.

## 🔴 PUSHED TO `origin/main` 2026-09-04 15:18 — LOCAL `main` IS NOW BEHIND

`e01177a5..85a2ad43`, a clean fast-forward carrying **16 commits**: my ch7/ch2/ch4 work,
`bf92d5b6`'s ch7 work, **and `4aa2d031`'s ch17 commits plus the java lane's**, because my
branch had merged local `main` up to `5ec4a78f` first.

⚠️ **The local `main` ref was NOT moved, deliberately.** The main checkout had **9 uncommitted
files** and a session committing every few minutes. A local `git push . HEAD:main` was
*offered* by git (this version does **not** apply `receive.denyCurrentBranch` to a linked
worktree, so the dry-run passed) — but it moves the ref **without touching that worktree's
files**, so the live session would see the incoming work as *uncommitted deletions of files it
never had*, and its next `git add` could commit a revert of all of it. That is the
"my change was clobbered / someone else committed my change" confusion in
[[feedback-shared-file-staging]], with a much bigger blast radius.

🔴 **The safe move, worth reusing: push `HEAD:main` to the REMOTE, never to the local ref.**
`git push origin HEAD:main` fast-forwards `origin/main` and leaves every local worktree byte-
identical. Whoever is next in the main checkout runs `git pull --ff-only` when their session
is clean; their own commits are already upstream, so it fast-forwards.

**Deploy: ✅ GREEN.** `deploy.yml` run `33860156996` **completed `success`** — the corpus
builds and deployed with all 16 commits, so the ch7 split, the ch2/ch4 propagation and the
`progress.js` row are verified in CI, not just by the local checks.

---

## ✅ RESOLVED — merged 2026-09-04, commit `a108c934`

**User's decision: *"Drop my 08, keep the rest."*** `claude/jolly-diffie-4abc33` merged into
`claude/agitated-kare-23d41a`; only page `10` conflicted. Outcome:

| | |
|---|---|
| **Dropped** | my `08` (280 lines) — theirs is better developed and lands `template.js` explicitly |
| **Took whole** | their page `10` (267 lines), S1 fixed in place under a scoped `> Validated:` stamp; gained pointers to `09`/`10c`/`10d` |
| **Kept** | my `09` props page (269 lines, 8 ★) and the ch2/ch4 propagation (13 files) |
| **ch7 now** | **17 files, 9 verified** — `progress.js` row `17/9/17` |
| **Positions** | 0–7, 9–17; one gap at **8** (their branch had 8 *and* 9). Left rather than renumbered — renumbering moves inbound links for no gain |

🔴 **`progress.js` AUTO-MERGED TO A WRONG NUMBER WITHOUT CONFLICTING.** Both branches had
independently written the ch7 row `16/8/16`, so git saw an identical change and took it
silently — but the merged tree has **17 files / 9 verified**. **A shared counter row is
correct on each branch and wrong on the merge, and git will never flag it.** Recount a
measured row on disk after any merge; never carry either side's number across.

**Their framing beat mine and is the one that shipped:** a copied pre-16.3 boundary does not
give a *dead* button (my wording), it gives a **working button that re-renders the same failed
server output** — worse, because it looks like it functions. Keep that phrasing.

---

## What was DUPLICATED (the pre-merge assessment)

| Mine | Theirs | Verdict |
|---|---|---|
| `08-errorjs-boundary-scope-and-global-error.md` (280 lines, 9 ★) | `10c-where-boundaries-sit-in-the-hierarchy.md` (231) + `10d-global-error-and-what-it-does-not-inherit.md` (245) | **Same two facts, theirs is better developed** — 476 lines across two pages vs my 280 on one, and theirs lands the `template.js` omission explicitly. **Drop my `08`.** |
| The S1 fix on page `10` | The S1 fix on page `10` | **Same correction, both correct.** Theirs edits in place and stamps `> Validated:`; mine moves the material out to `09`. Conflicting diffs on the same file. |
| `progress.js` ch7 row → `16/8/16` | `progress.js` ch7 row → `16/8/16` | **Same value, arrived at differently** (they added 10c+10d, I added 08+09). Merging both branches makes it **18 files / 10 verified** — recount, do not take either number. |

## What is UNIQUE to my branch `claude/agitated-kare-23d41a`

1. 🔴 **`09-errorjs-props-retry-and-reset.md` (269 lines, 8 ★)** — nobody else wrote a props
   page. The `retry()`/`reset()` table, the verbatim *"In most cases, you should use retry()"*
   quote, the full Version History table, and **`error.message` dev-vs-production plus
   `error.digest`**, which is on no page in the track: in production, Client Component errors
   keep their message and Server Component errors are replaced by a generic message plus the
   digest hash. `bf92d5b6` patched page 10's prop claim in place and wrote no props page.
2. 🔴 **The propagation across ch2 and ch4 — 13 files.** `bf92d5b6` fixed page `10` only. Every
   other stale `error.tsx` example in the track was still destructuring `reset`.
3. **`sidebar_position` 8 and 9 filled**, closing a pre-existing gap (the dir ran 0–7 then
   10–15). Positions do **not** collide with theirs: they took 12/13 and shifted 11/11b/12/12b
   to 14–17; I took 8/9.

## 🔴 THE GREP LESSON — the reported blast radius was 2 files short

The brief's radius came from `grep -rln 'reset()'`. That misses every **call-free** form:

| Form | Caught by `reset()`? |
|---|---|
| `onClick={() => reset()}` | yes |
| `reset: () => void` (the type annotation) | **no** |
| `onClick={reset}` (bare handler reference) | **no** |

The sweep that found the rest:

```bash
grep -rln 'reset: () => void\|onClick={reset}\|a `reset()` function' docs/nextjs/pages/
```

Two files were missed by the original grep, one of them **authored**:
`04-data-fetching-in-the-app-router/02c-streaming-after-the-shell-…` (two examples) and
`17-advanced-ecosystem-topics/01-explanation.md`. **Grep an API name in all of its call-free
forms, or the radius is short by exactly the pages that annotate types.**

## The ch2 uncertainty in the brief, resolved

The brief flagged ch2's 6 `reset()` hits as *"MAY BE UNRELATED (scroll reset, form reset) —
CHECK each"*. They are **all error-boundary `reset`**, not scroll or form. But they are not six
independent claims: **five carry one verbatim-duplicated prose sentence** and two carry a
duplicated `DashboardError` code block. Same copy-paste defect as ch1, ch4 and ch17.

## ⚠️ ch7 is 6-of-16 byte-identical stubs — recorded, NOT fixed

Body-hash of ch7 (`for f in *.md; do echo "$(sed -n '/^## /,$p' "$f" | md5sum | cut -c1-8)  $f"; done | sort`):

**Hash `089afc83` covers SIX files** — `01-the-unified-error-model`, `02-errors-in-streaming`,
`03-server-action-error-contracts`, `05-loadingtsx-vs-inline-suspense`,
`06-retry-fallback`, `07-project-milestone-sprintdesk` — all 77 lines, 0 ★, no tier badge, no
`> Verified:`, and all fragments of `01-explanation.md`. They teach nothing about their own
titles. **Authoring them is a `devbible-topic` job, not a currency job**, so this pass corrected
their factual claim and left them stubs.

## ✅ CLOSED — the ch17 item resolved itself, which is the protocol working

`17-advanced-ecosystem-topics/01-explanation.md` carried a stale `global-error` example. I
fixed it, then **reverted** (`806981be`) on finding `4aa2d031`'s dispatch table assigned that
file to its coordinator. **Twenty minutes later its rewrite (`9c1e53cf`) turned the file into
the chapter index, 143 → 63 lines, and took the stale example with it.** Reporting beat fixing:
had I kept my edit it would have been a merge conflict against a file that no longer contains
the thing I changed. 🔴 **This is the concrete payoff for "a locked lane is reported, not
fixed" — bank it against the next time the rule feels like it is costing something.**

**Track-wide sweep, 2026-09-04 15:40, on `origin/main`:** every remaining `reset` in
`docs/nextjs/` is correct (stock-React-boundary references in ch1 + the syllabus, the corrected
ch2/ch7 sentences, the `09` props page) or unrelated (Suspense state resets, iOS storage, eslint
presets). **The corpus is clean.**

⚠️ **One residue found by that sweep and fixed (`03ec14b2`): page 10's frontmatter `description`
still said `reset()` was "superseded"** — contradicting the same page's body four lines down.
🔴 **A frontmatter description is not prose and no prose check reads it**, yet it is what the
sidebar and search surface. **When correcting a claim, grep the frontmatter for it too.**

## Verified at source

[`error.js` file-convention reference](https://nextjs.org/docs/app/api-reference/file-conventions/error)
— page metadata **`version: 16.3.4`, `lastUpdated: 2026-07-10`**, matching the corpus pin, so
no version bump was needed and `pins.js` was not touched. One fetch; no sandbox.
