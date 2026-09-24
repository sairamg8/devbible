---
name: progress-nextjs-ch11
description: Next.js chapter 11 (Performance Optimization & Turbopack) — CLOSED 2026-09-04 at 30/30 pages. The corrections it forced, the split proofs, and the two defect classes found at close.
metadata:
  type: project
---

# ✅ Next.js ch11 · Performance Optimization & Turbopack — CLOSED

**Closed 2026-09-04, commit `e48cb375`. 30 of 30 pages, gap-free 0–29, 7,020 lines, 211 ★.**
Started from 10 pages: 2 written, 7 generated stubs, 1 generated index. Bank:
[[research-nextjs-ch11-performance-turbopack]] — **7 fetches total for the whole chapter**
(5 by the coordinator, 2 by a fork). 🔴 **Do not re-derive it.**

Chapter assigned by the user; the ch12 session recorded the claim and fenced itself off.
`src/data/progress.js` line 489 is now `topics: 30, pages: 30`.

## How it was built

| | Files | From → to |
|---|---|---|
| **Coordinator** — Turbopack topic | `01`, `01b`, `01c`, `01d`, `01e` | 70 L / 0 ★ → **1,180 L / 33 ★** |
| **Fork A** — React Compiler + bundle analysis | `02`–`02e`, `03`–`03g` | 122 L / 0 ★ → **2,803 L / 72 ★** |
| **Fork B** — the edge withdrawal + Web Vitals | `04`, `04b`, `05`, `05b`, `05c` | 120 L / 0 ★ → **1,171 L / 36 ★** |
| **Fork C** — instrumentation cost + milestone | `06`, `06b`, `07`, `07b`, `07c` | 116 L / 0 ★ → **1,284 L / 52 ★** |

🔴 **Every fork got its own files AND its own `sidebar_position` range** (110–119 / 120–129 /
130–139). Zero collisions — the Python lane lost six positions to two forks numbering from the
same base, and handing out ranges explicitly is what prevented a repeat. All three were barred
from committing; the coordinator QC'd and committed each.

**Ten splits, every one proven UP.** Notable: `01b` drafted at **304** — four lines over — and was
**split again rather than reworded under the cap**. Fork A split six times in sequence (307, 351,
308, 345, 316, 353).

## 🔴 The corrections this chapter forced

1. **`runtime = 'edge'` is DEPRECATED.** Only the **value**; the `runtime` option still exists and
   still defaults to `'nodejs'`. The documented migration is to **remove the export**, not switch
   it. ⚠️ **It is only a *warning*** — the message page's heading is "Why This Warning Occurred",
   so no build fails and nothing forces the migration. **No rationale is published anywhere**;
   settled as unsettled, do not re-fetch hoping for one. The one named path forward:
   *"If you want to continue using the `edge` runtime, keep using `middleware`."*
2. **Proxy is NOT an Edge-constrained environment** — it has defaulted to **Node.js since v16.0**
   and `runtime` throws there even for `'nodejs'`. 🔴 **This corrected the coordinator's own
   dispatch**, which had told fork B the opposite. What survives is a *deployment* constraint:
   proxy may run outside the app's main runtime, so module-level globals work in dev and
   **silently do nothing in production**.
3. **The compile-cost dating was BACKWARDS in this bank, and a fork caught it.** The harsh
   *"Expect compile times… to be higher"* is on the version-16 upgrade guide
   (`lastUpdated: 2026-08-25`); the reassuring *"small and localized"* is on the `reactCompiler`
   reference (`lastUpdated: 2026-02-11`). **The harsher line is six months NEWER.** 🔴 **Lesson:
   which statement is newer is a fact to CHECK, not to infer from which sounds more like current
   engineering.** A tidy narrative ("they fixed it, so the warning is stale") produced the error.
4. **A ch11 page asserted "the documentation describes no local reader" for the Turbopack trace.**
   Wrong — `npx next internal trace .next-profiles/trace-turbopack.bin` is documented in the
   upgrade guide. Corrected in `01c` (`da1daca1`). 🔴 **Found while verifying correction 3: the
   fetch that settled one claim disproved another on a page already committed.**
5. **16.0 removed `size` and `First Load JS` from build output**, so a CI gate parsing it **passes
   vacuously**. The docs themselves endorse Lighthouse/analytics as the replacement.
6. **The analytics guide is stale** — `lastUpdated: 2025-05-13`, still lists FID. Thresholds are
   web.dev's and are attributed as such, never presented as Next.js documentation.

## 🔴 Two defect classes found at close — neither is mechanically detectable

1. **A footer chain that SKIPS pages.** `01c` pointed straight at `02`, because its footer was
   written before `01d`/`01e` existed and only `01`'s table was updated afterwards. Every check
   passed: the link resolved, nothing dangled, no marker remained. **Add "walk the Next → chain
   end to end" to a chapter close** — `wc -l`, mdxcheck and the link resolver cannot see it.
2. **Pages with no footer at all** (the index, `10-glob`, `11-streams`) — distinct from a bare
   `{/* FOOTER */}`, and equally invisible. The chain now runs unbroken 0 → 29 and ends with an
   explicit **End of chapter 11** marker.

Also caught pre-commit: a dangling cross-chapter link — ch03's directory is
`03-server-components-vs-client-components`, **not** `03-server-vs-client-components`.

## Verified sweep — do not re-derive

**13 pages across `docs/nextjs/pages/` mention `runtime = 'edge'`. After this chapter, ZERO are
stale.** The only one that was is ch11's own index, now rewritten.

⚠️ **One false positive, recorded so it is not re-flagged:**
`15-…/10b-tenant-routing-with-proxy-and-root-params.md` never says "deprecated" but **is
correct** — it states proxy defaults to Node.js in 16 and cites `runtime = 'edge'` only as a v13
leftover *not* to paste. 🔴 **Absence of the word "deprecated" is not evidence of staleness.**

## Found outside ch11 — NOT fixed, for whoever owns these lanes

- 🔴 **`02-routing-and-navigation/07-the-proxyts-layer-…md` is a 46-line generated stub whose body
  is about error boundaries and `error.tsx`** — a content/title mismatch, and it is the track's
  designated Proxy page. Given correction 2 above, it is now also the natural home for the
  Node.js-by-default and globals-are-unreliable material. **ch02 has 9 pending; this is one.**
- **The chapter has no `README.md`** — `01-explanation.md` carries `sidebar_position: 0` and
  `sidebar_label: "Overview"` instead. Consistent with every neighbouring Next.js chapter but a
  **corpus-wide** deviation from house style, which expects a topic `README.md`. Left alone
  deliberately: fixing one chapter makes it the odd one out. Same shape as the
  `_category_.json` `"N. Label"` drift already recorded twice.

## Still open in the track

Nothing in ch11. The next unclaimed blocks, from the cursor's own queue:
**ch02 (9)** · **ch07 (8)** · **ch08 (8)** · **ch15 (7)** · **ch10 (7)** · **ch18 (5)**.
