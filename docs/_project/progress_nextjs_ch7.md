---
name: progress-nextjs-ch7
description: Next.js chapter 7 (error handling, loading states, resilience) CLOSED 2026-09-04 at 35/35 pages — what was written, the seven splits and their proofs, the five half-footers found in the written half, and the findings worth spending elsewhere. Open on ch7, error boundaries, streaming failures, Server Action contracts or Route Handler errors.
metadata:
  type: project
---

# Next.js ch7 — CLOSED 2026-09-04, session `c08ab631`

Cursor: [[cursor-nextjs]]. Research bank: [[research-nextjs-ch7-error-handling]] — **seven
fetches, whole chapter, do not re-fetch.** Sibling records from earlier ch7 work, neither
superseded: [[progress-nextjs-ch7-boundary-hierarchy]] · [[progress-nextjs-ch7-retry-reset-collision]].

## Result

**9 written pages + 8 stubs → 35 pages.** Renumbered gap-free **0–34**; the 100–139 overflow
range is empty again and the pre-existing gap at position 8 is gone. `progress.js` line 487:
`17/9/17` → **35 topics, 35 pages**.

| topic | pages | lines | ★ | commit |
|---|---:|---:|---:|---|
| 01 · The unified error model | 5 | 1,050 | 24 | `5fb470a5` |
| 02 · Errors in streaming | 3 | 802 | 20 | `f642babc` |
| 03 · Server Action error contracts | 4 | 776 | 21 | `319882e3` |
| 04 · Route Handler error responses | 2 | 487 | 12 | `552cc03b` |
| 05 · `loading.tsx` vs inline Suspense | 3 | 756 | 22 | `326dc2ce` |
| 06 · Retry, fallback, degradation | 3 | 688 | 19 | `762fa867` |
| 07 · SprintDesk milestone | 5 | 1,077 | 28 | `1d918a95` |
| **close** | index + renumber + footers | — | — | `768ec850` |

**4,636 new lines, 146 ★.** Whole-chapter QC at close: 0 over cap · 0 duplicate positions ·
0 gaps · 0 MDX hazards · 0 bare `{/* FOOTER */}` · 0 `*(not written yet)*` · **198/198 internal
links resolving** · every page badged and sourced.

## The splits, every one proven UP

Seven files were drafted over the cap and split on the argument's own boundaries. The big one:

🔴 **Topic 01 was drafted as ONE file at 460 lines / 9 ★ and split THREE times → 1,050 lines /
24 ★.** Boundaries: the model · expected-errors-are-return-values · the typed action result ·
the control-flow seam · `unstable_rethrow`. Every other split (02→02b/02c, 03→03b + 03c→03d,
04→04b, 05→05b/05c, 06b→06c, 07→07b + 07c→07d + 07e) redistributed existing gotchas and
questions and added the sibling's own — no total fell.

## 🔴 Defects found in the EXISTING written half, and fixed at close

**FIVE pages had half a footer.** `10`, `11`, `11b`, `12` and `12b` each carried a `Previous:`
or a `Next:` but not both, so the chain was broken in five places while every mechanical check
passed — **a one-directional footer is a valid link, and nothing looks for the missing
direction.** The `{/* FOOTER */}` grep does not catch it either; that marker was already absent.
This is a new class alongside the bare-marker defect in `project_footer_cleanup_scope.md` and is
worth sweeping corpus-wide.

`09`'s `Previous:` still pointed at the old topic-07 filename and was repointed to `07e`.

## Traps that fired in this session

- 🔴 **A mid-split rename fixes the href and leaves the link TEXT stale.** One link read
  `[01c · Control-flow throws](01d-…)`. Same lesson the Python lane banked; it fires whenever a
  chunk is renumbered mid-write. **Grep the visible label, not just the path.**
- ⚠️ **`/docs/app/getting-started/updating-data` does not exist** — the page is `mutating-data`.
  A wrong path returns a readable "Page Not Found" body that summarises like content. Resolve
  through `/docs/sitemap.md` first. (Banked in the research file too.)
- ⚠️ A `grep -o` with a nested capture group errored out under `ugrep` and printed nothing
  useful 35 times. **Use a Python link checker for link QC**, not a shell one-liner:

  ```python
  re.finditer(r'\]\((?!https?:)([^)#]+\.md)(?:#[^)]*)?\)', text)
  ```

## Findings worth spending elsewhere — do not re-derive

All quoted verbatim with sources in [[research-nextjs-ch7-error-handling]].

- 🔴 **`notFound()` returns `200` for streamed responses and `404` for non-streamed ones.** Which
  one you get is decided by whether a `loading.tsx` fallback rendered or anything suspended
  before the call. **Adding a `loading.tsx` silently converts a route's 404s into 200s.** Next.js
  injects `<meta name="robots" content="noindex">` instead; crawlers may still label it a soft
  404. Relevant to **ch12 (SEO)** and **ch06**.
- 🔴 **A `loading.js` high in the tree SATISFIES the prerenderer's boundary search**, so it turns
  a blocking-route build error into a silent full-page skeleton. The build error was the better
  diagnostic. Relevant to **ch05** and **ch11**.
- 🔴 **`loading.js` does not show a fallback for the layout in its own segment.** A layout that
  awaits `cookies()`/`headers()`/an uncached fetch blocks navigation with **no error at all**;
  Cache Components turns the identical defect into a **build-time error**. This is the most
  common "streaming does not work" report.
- 🔴 **`revalidateTag` with a stale-while-revalidate profile does NOT include a re-render in the
  action's response**, unlike `updateTag`, `revalidatePath`, `refresh`, a cookie mutation or
  `redirect`. This is the "change appears one action late" bug. Relevant to **ch05**, **ch08**.
- 🔴 **Server Actions are dispatched one at a time per client**, so `Promise.all` cannot
  parallelise them from the client — a queued action is indistinguishable from a failed one.
  Relevant to **ch08**, **ch10**.
- 🔴 **Action IDs are build artifacts rotated at most every 14 days even when the source is
  unchanged** → "Failed to find Server Action" on an open tab after a deploy. The documented
  remedy is a **UI decision** (offer a reload), not an ops one. Relevant to **ch16**.
- 🔴 **`preload` on `next/image` controls when an image is FETCHED, not when it PAINTS** — it
  cannot rescue an LCP element inside a Suspense boundary. Relevant to **ch09**, **ch11**, **ch12**.
- ⚠️ **React may fall back to any Suspense boundary** under a slow network or busy CPU — *"don't
  add one you don't need"*. An unused boundary is a liability, not a no-op.
- ⚠️ **`unstable_rethrow` is still unstable at 16.3.4** and its list of framework-throwing APIs
  includes `cookies`, `headers`, `searchParams` and no-store `fetch` under a static segment, not
  just `notFound`/`redirect`/`permanentRedirect`. PPR affects the behaviour.
- ⚠️ **The `route.js` reference prescribes NO error-envelope format.** Its only error example is
  a webhook `try`/`catch` that returns 400 for every failure, puts `error.message` in the body,
  and **does not compile under `strict`** (`error` is `unknown`). Page `04b` is labelled *this
  book's recommendation* on its `> Verified:` line for exactly this reason.

## Found, NOT fixed

1. ⚠️ **The half-footer class should be swept corpus-wide** — five instances in one chapter's
   nine pre-existing pages suggests it is not rare. No existing check detects it.
2. ⚠️ `_category_.json` still reads `"7. Error Handling, Loading States, and Resilience"`, not the
   house `"NN · Label"`. **Track-wide across all 19 chapters; left alone for the third time**, per
   the standing note in [[cursor-nextjs]].
3. ⚠️ The chapter's `_category_.json` also carries a `generated-index` link block, now redundant
   because `01-explanation.md` is a real index at position 0. Cosmetic; not touched under a
   content lock.

## Resume

**ch7 is closed.** Remaining open Next.js chapters: **ch08 (8 pending) · ch10 (7) · ch15 (7) ·
ch18 (5, genuinely last — it is the capstone and depends on the rest)**. Thirteen of nineteen
chapters now closed.
