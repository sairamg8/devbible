---
name: progress-nextjs-ch5
description: Record for Next.js chapter 5 (Caching, PPR, Cache Components) — CLOSED 2026-09-04. The six-stub defect and how it was fixed, the two scope decisions (page 02 and page 04) and the evidence behind them, and the Turbopack syllabus error found-not-fixed. Open before touching docs/nextjs/pages/05-caching-ppr-and-cache-components/.
metadata:
  type: project
  track: nextjs
  chapter: 5
  closed: 2026-09-04
---

# Next.js ch5 — Caching, PPR and Cache Components ✅ CLOSED

**Session `a8564536`, 2026-09-04.** User named the chapter explicitly; the Next.js lane was
**wound down and free** (session `4aa2d031` closed it the same day after ch17).

## 🔴 START HERE — ch5 is done; pick the next chapter

Chapter 5 is complete: **21 files, all 21 carrying a `> Verified:` line**, nothing over the
300-line cap, 0 MDX hazards, 0 dangling links, 0 `{/* FOOTER */}` markers, `sidebar_position`
gap-free 0–12.

**Still un-backfilled across the track: chapters 9, 14, 18, 19.** Nearest to done: **ch12
(28/35)**, **ch2 (11/20)**, **ch16 (9/16)**. ⚠️ Always body-hash a chapter before planning it:

```bash
for f in *.md; do echo "$(sed -n '/^## /,$p' "$f" | md5sum | cut -c1-8)  $f"; done | sort
```

`d41d8cd9` is the md5 of the **empty string** — a page with no body at all.

## What was wrong

All six top-level concept pages were generated stubs. Three (`01`, `03`, `05`) were
**byte-identical to each other**; two (`02`, `06`) had **no body at all**; `04` opened on
"## 4. Senior Engineer Edge Cases" with no sections 1–3. None carried a `> Verified:` line or a
tier badge; all carried the import's `# ▲` H1 and a "Priority Badges Legend" block.

This mattered more than a normal stub because other chapters cited these pages as the authority
for cache mechanics they deliberately do not restate — ch6 had to have three deferrals
repointed away from them in `f7a86e19`.

**Baseline → final:**

| | Before | After |
|---|---:|---:|
| Top-level lines | 381 | **2,604** |
| ★ entries | 0 | **125** |
| Tier badges | 0 | 12 |
| `> Verified:` lines | 0 | 12 |
| Gotchas / Interview sections | 0 | 11 each |

Plus the untouched `10-the-three-cache-directives/` subdirectory (9 files, 2,267 lines), giving
the chapter **21 files / 4,871 lines**.

## The chunk map

| Concept | Files | Lines |
|---|---|---:|
| 01 · explicit caching model | `01`, `01b`, `01c`, `01d` | 850 |
| 02 · custom `cacheLife` profiles | `02` | 288 |
| — · the three directives | `10-the-three-cache-directives/` (untouched) | 2,267 |
| 03 · Partial Prerendering | `03`, `03b`, `03c` | 693 |
| 04 · revalidation inventory | `04` | 212 |
| 05 · Turbopack build caches | `05` | 204 |
| 06 · SprintDesk milestone | `06` | 297 |
| — · chapter index | `01-explanation.md` (rewritten) | 60 |

Commits: `e0c2e009` · `15499001` · `a4d46f39` · `a4512a11` · `72b1dfea` · `081cae6b` ·
`ae5e306c` · `dfb7a449` · `db0eca65` · `84736fde`.

## 🔴 Two scope decisions, both made on evidence and both flagged

### Page 02 — do NOT promote the subdirectory, do NOT write a pointer

The user asked whether `02` should be a pointer page or whether
`10-the-three-cache-directives/` should be **promoted to replace it**. Both rejected:

1. **Promotion is out.** `grep -rl "10-the-three-cache-directives" docs/` returns **14 files**
   across ch6, 8, 11, 15 and 16. Renaming the directory breaks every one.
2. **A pointer page is out**, because the subdirectory does not cover the syllabus concept.
   `grep -rn "cacheLife:" 10-the-three-cache-directives/*.md` returns **nothing**. It teaches
   the `cacheLife` **function**; upstream has a separate `config/next-config-js/cacheLife` page
   for **custom profiles**, which nothing in the corpus covered.

`02` was therefore authored as the complement: custom named profiles, redefining built-ins
including `default`, the generated type signature, and 🔴 **the three prerendering thresholds
the config page never mentions** — the page's spine, because inventing a profile from the
config docs alone silently excludes content from the static shell with a passing build.

### Page 04 — the concept was already owned; authored as an inventory instead

Measured before writing: **ch6 `03`/`03b`/`03c`/`03d`** own SWR tuning, the stampede, revalidate
budgets, the cache layers and the `cacheHandler` singular-vs-plural split; **`10/05b`** owns the
`revalidateTag`/`updateTag` API surface; **ch8 `10b`** owns the five-way decision tree. Writing
another ISR page would have duplicated four good pages.

Authored instead as the one thing no page held: **the complete inventory of 15 events that end
a cached value's life**, with explicit routing to each owner. Two findings justified it —
nothing anywhere stated that `refresh()` and `router.refresh()` **re-render without
invalidating** (the bug that looks exactly like its own fix), and nothing enumerated the four
environmental endings nobody triggers.

⚠️ **The general lesson for this track: grep for ownership before authoring a syllabus concept.**
ch6 in particular has grown into ch5's nominal territory, and the syllabus does not reflect it.

## 🔴 Found not fixed — outside the topic directory

**`docs/nextjs/syllabus/02-data-rendering-resilience.md` line 29 is wrong about Turbopack.** It
claims *"Now named flags, both on by default: `turbopackFileSystemCache` … and
`turbopackMemoryEviction`"* with **"up to 5.5× faster CI builds"** and **"up to 90% less dev
RAM"**. Against the 16.3.4 API reference:

- **There is no `turbopackFileSystemCache` config key.** That is the doc page's *title*. The
  keys are two, both under `experimental`: `turbopackFileSystemCacheForDev` (default `true`
  since **16.1.0**) and `turbopackFileSystemCacheForBuild` (default `true` since **16.3.0**).
- **`turbopackMemoryEviction` is not a boolean.** Tri-state `false` | `'auto'` | `'full'`,
  default `'auto'`, experimental, and it **only has an effect in `next dev`**.
- 🔴 **Neither figure appears in either API reference page.** Page `05` says so explicitly and
  declines to repeat them.

Syllabus files are outside the topic directory, so this is reported, not edited.

Also noted, not fixed: **`docs/nextjs/pages/11-performance-optimization-turbopack/01-turbopack-in-dev-and-production-fast-refresh.md` is itself a stub** (its only heading is
"## 3. Production-Grade Code Example"), and ch11's whole directory looks un-backfilled.

## Facts to reuse, not re-derive

- `next` is **NOT installed** in the main checkout (`MODULE_NOT_FOUND`) — no T1 probe of the
  package is possible. `react` probes at **19.2.8**.
- 🔴 **This worktree had no `node_modules` at all**, so `yarn build` failed with
  *"Couldn't find the node_modules state file"* — and **exited 0 through a pipe**, which reads
  as a passing build. Run `yarn install` in a fresh worktree first, and never trust a piped
  build's exit code.
- 🔴 `/docs/app/getting-started/partial-prerendering.md` **404s**. PPR is documented inside
  `/docs/app/getting-started/caching`. Page `03` is the corpus's only PPR page.
- The stampede/dedup question remains **unsettled by the docs** — see
  [[research-nextjs-ch6-isr-and-params]] §4. Never assert a lock.
- The subdirectory's `_category_.json` was relabelled `10 ·` → `06 ·` to match its new
  `position: 6`. **The directory name is unchanged**, so all 14 inbound links still resolve, and
  the built route drops the numeric prefix anyway — readers never saw either number.

Research banked and **not to be re-fetched**:
[[research-nextjs-ch5-cache-model-ppr-turbopack]] (six primary sources, this chapter's own
pass), [[research-nextjs-ch6-isr-and-params]], [[research-nextjs-ch6-rendering-choice]],
[[research-nextjs-multitenant-and-refresh]].

Related: [[devbible-locks]].
