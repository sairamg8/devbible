---
name: progress-nextjs-ch9
description: devbible Next.js chapter 9 (Styling and UI) CLOSED 2026-09-04 — 20 pages, 4,477 lines, 155 star, positions gap-free 0-19. The chapter record plus what was found and not fixed.
metadata:
  type: project
---

# Next.js ch9 · Styling and UI — **CLOSED 2026-09-04**

Session `eda91ee9`. The user said *"Continue with next js finish it"*; the cursor named
`05-next-script-loading-strategies-…`, and the chapter was taken to close from there.

## The numbers

| | At session start | At close |
|---|---:|---:|
| Files | 16 | **20** |
| Lines | 3,195 | **4,477** |
| `★` entries | 95 | **155** |
| `> Verified:` lines | 13 | **20 / 20** |
| `sidebar_position` | `0,1,2,3,5,6,8,9,15–18,29–32` (reserved agent ranges) | **gap-free 0–19** |

QC at close: **0 over the 300-line cap · 0 missing tier badge · 0 missing `> Verified:` ·
0 `{/* FOOTER */}` markers · 0 ` ```console ` blocks · 0 duplicate positions · 0 MDX
hazards · every link resolves on disk.**

Commits: `e945eea4` (the four `next/script` chunks) · `c8ad3a12` (the two milestone
chunks) · `70809aa3` (chapter index rewrite + renumber + `progress.js`).

## What was written

**`next/script`, 43-line stub → 4 chunks / 913 lines / 39 ★.** Detail, and the six things
written as explicitly uncertain, are in [[progress-nextjs-ch9-script]]. **Zero fetches** —
it all came off [[research-nextjs-ch9-font-and-script]].

**The milestone, 58-line generated stub → 2 chunks / 553 lines / 21 ★.** Split on the
concept boundary: `06` is theming + the font pipeline, `06b` is avatars/attachments + the
scripts pass + acceptance criteria + the phase gate. Sources: the font bank above and
[[research-nextjs-ch9-image]].

**`01-explanation.md` rewritten as a chapter index** (149 → 108 lines). The old page was an
overview that contained two claims this chapter now disproves — 🔴 it asserted
*"beforeInteractive blocks hydration"* (the docs say the opposite, verbatim) and taught
`priority` as current (deprecated in Next.js 16 for `preload`). The new index opens with a
**"What this chapter corrects"** table naming those two plus the Tailwind v4 and
`remotePatterns` corrections, each pointing at the chunk that owns it.

## 🔴 Load-bearing decisions worth not re-litigating

- **The milestone's theme tokens are plain CSS custom properties, not Tailwind `@theme`
  tokens** — because ch9's `01c` explicitly did **not** verify `@theme`'s semantics. Written
  as a deferral with a pointer, not as a guess.
- **The theme initialiser is one of the few genuine `beforeInteractive` uses** and it is
  inline, constant-bodied, `id`-carrying, and wrapped in `try/catch` because `localStorage`
  throws outright in some privacy configurations.
- **`suppressHydrationWarning` is on `<html>` only**, and the page says why applying it
  further down hides real bugs.
- **The optimizer does not forward headers**, so protected attachments break *after*
  ch10 adds auth — 06b forces the signed-URL-vs-`unoptimized` decision now, because it
  changes the `remotePatterns` entry.

## Found, not fixed

- ⚠️ **`_category_.json` labels across the whole Next.js track use `"N. Label"`, not the
  house `"NN · Label"`.** All **19** chapters do it, uniformly. Fixing ch9 alone would make
  it the odd one out in its own sidebar, so it was **left alone and is a track-wide item**,
  the same call the ch17 session made about `generated-index`.
- ✅ The cross-track link the previous wind-down flagged as unverified —
  `../../../web-vitals-performance/pages/06-cls-optimization/01-preventing-cls.md` —
  **resolves on disk.** Not a defect.
- ✅ The `title:`-contains-raw-markdown defect the previous wind-down flagged was in `05`
  and `06`; both were rewritten, so **it is gone from ch9**. Worth a corpus-wide grep
  elsewhere.
- ⚠️ **Three `*(not written yet)*` pointers remain and are correct, not defects** —
  `02c` (choosing between the three CSS-in-JS roads), `04e` (format negotiation /
  `maximumDiskCacheSize`), `04f` (when not to use the optimizer). They are bold text, not
  links, so nothing dangles. A later session may write them as `02c`/`04e`/`04f`; positions
  would need re-running, since 0–19 is now full.

## Track position after this close

**Seven of nineteen chapters fully authored: 1, 3, 4, 5, 6, 9, 17.** Wholly
un-backfilled: **14, 18, 19**. Nearest to done: **ch12 (28/35)**, **ch2 (11/20)**,
**ch16 (9/16)**, **ch7 (9/17)**. **ch19 is the cheapest close on the track** (6
byte-identical stubs, 182 lines); **ch14 has two EMPTY-bodied pages.** Still owed
track-wide: ch12's **server-side idempotency contract** page (drafted, unshipped).
