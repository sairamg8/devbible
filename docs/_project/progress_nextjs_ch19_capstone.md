---
name: progress-nextjs-ch19-capstone
description: Chapter 19 (Next.js capstone, decision trees and outlook) — the four-lane build, the position-block scheme that let three forks run without colliding, and what each topic argues. Read with cursor-nextjs.
metadata:
  type: project
---

# Next.js chapter 19 — the capstone, **CLOSED 2026-09-05**

**19 pages · 3,613 lines · 304 ★ · 4 topics · positions 0–18 gap-free.** Nine commits, closing
at `fa6ab526`. QC clean: 0 over cap · 0 missing tier badge or `> Verified:` · 0 missing
`## Gotchas` or `## Interview questions` · 0 `{/* FOOTER */}` · 0 ` ```console ` · 0 stub
boilerplate · 0 control bytes · 0 escaped backticks · **367 relative links, 0 dangling** ·
0 MDX hazards **with the raw-tag check on as well as off**. 3 inbound links from other
chapters all resolve.

| Topic | Pages | Written by |
|---|---:|---|
| 01 · SprintDesk retrospective | 6 | coordinator (`01`) + fork A (`01b`, `01ba`, `01c`, `01d`, `01e`) |
| 02 · The PPR storefront contrast | 4 | fork B |
| 03 · The five decision trees | 5 | fork C |
| 04 · Outlook | 3 | coordinator |
| — · chapter index | 1 | coordinator, last, from the generated stub |

**Session `ae9a805f`.** The user's order of work was ch15 → **ch19** → ch16. ch15 closed the
previous session; this session opened ch19 from five generated stubs, none badged, none
carrying a `> Verified:` line, and two of them carrying **content pasted in from ch18**
(the Pages-Router migration material appeared verbatim in both `01-explanation.md` and the
`02-case-study` stub). Every stub is overwritten, not extended.

## 🔴 What makes ch19 different from every other chapter here

It is a **synthesis** chapter. Nineteen chapters are closed; ch19's job is to make the reader
*choose* between things already taught, so **it introduces almost no new framework claims.**
Every load-bearing sentence either cites a page of this book that already verified it, or is a
verbatim quote from the banked research. The `> Verified:` lines say so explicitly:

> Verified: 2026-09-05 — this page composes material already verified across chapters 4
> through 17 … It introduces no new framework claims of its own.

That form is worth reusing for any future capstone. It makes the page's provenance honest
without pretending a fresh documentation pass happened.

## The four lanes, and the position-block scheme that made parallelism safe

Three `devbible-author` forks ran concurrently on disjoint lanes plus the coordinator's own
lane — the ch15 precedent, repeated. 🔴 **The thing that made it collision-free was giving each
lane a NON-CONTIGUOUS block of `sidebar_position` values it owned alone**, then renumbering the
whole chapter gap-free at the close:

| Lane | Topic | Position block |
|---|---|---|
| coordinator | 01 · the retrospective opener | 1 |
| fork A | 01b–01e · the retrospective's chunks | **10–19** |
| fork B | 02 · the PPR storefront contrast | **20–29** |
| fork C | 03 · the five decision trees | **40–49** |
| coordinator | 04 · the outlook | **60–69** |

Blocks, not adjacent ranges. A fork that needs to split (fork A did, `01b` → `01b` + `01ba`)
takes the next free number in its own block and nobody has to be told.

**The other four fork rules, all carried from ch15 and all still necessary:**
exact filenames handed to the fork · an explicit ban on `git` of any kind, the coordinator
commits · `ls` every link target before writing it · and **the first and last file of each lane
carries `{/* FOOTER */}`** instead of a real footer, because those are the two links that cross
a lane boundary. The coordinator replaces them at close. This is exactly what the marker is for
and it is the clean answer to the ch15 problem where forks forward-linked into files that did
not exist yet and broke the build for the whole checkout.

⚠️ **Also added this run:** forks were told not to run `graphify update` — the user had Gemini
rebuilding the knowledge graph in parallel. Worth repeating whenever another tool holds
`graphify-out/`.

## What each topic argues

- **01 · SprintDesk retrospective.** A retrospective is not a demo. It sorts every decision
  into **free** (reversible in an afternoon) / **load-bearing** (reversing it touches N files —
  and "load-bearing" is defined as a *count*, not an opinion) / **inherited** (never decided;
  a default nobody chose). Its spine is the thirteen milestones as a table of *commitments*
  rather than capabilities. The argument that carries the chapter: **a working application is
  the weakest evidence available**, because every failure this book names is silent — an
  unprotected Server Action serves legitimate users perfectly, a route that fell out of
  prerendering still renders correct HTML, a per-instance invalidation is correct for whoever
  is routed to that instance.
- **02 · the PPR storefront (contrast).** SprintDesk is multi-tenant, authenticated,
  write-heavy; a storefront is anonymous, read-heavy, SEO-critical. The inversion that drives
  every difference: **on a storefront the personal parts are small holes inside large shared
  pages; on SprintDesk the shared parts are small holes inside large personal pages.**
- **03 · five decision trees.** Rendering · caching (what invalidates this and who sees it) ·
  **the cache directive** (the fourth tree the syllabus explicitly added) · state placement ·
  runtime and deployment target. 🔴 The constraint that keeps them from being dead weight: a
  chapter already contains a rendering tree and a directive tree, so a capstone tree must add
  the four things a chapter tree cannot — it **crosses chapters**, it names the question that
  actually *settles* the branch (not the one people ask), it records what each branch **costs
  later**, and it marks the **one-way doors**.
- **04 · the outlook.** Written to a rule: claims only about what has shipped or been publicly
  stated, saying which is which, and naming what would **falsify** the direction. The headline
  is the verifiable inversion — framework knowledge moved out of training data into
  `node_modules`, version-matched to the lockfile. `04b` puts the three compilers on three
  rungs of one ladder and makes the **config key the maturity signal** (top-level = stable,
  `experimental.` = not). `04c` prices a preview feature with four questions, of which the
  deciding one is **how many files name the API** — the only term you control at adoption time.

## 🔴 Two corrections the forks forced on the coordinator — the pattern is the finding

Both times a fork refused a claim **the coordinator had written into its own brief**, and both
times the fork was right. A brief is not evidence, and a fork that treats it as evidence
launders the coordinator's assumption into a sourced-looking page.

1. **"Reversing `cacheComponents` does not restore the old model" — too strong.** Fork A found
   the corpus states the removal *conditionally*: v16.0.0 removes `dynamic`, `dynamicParams`,
   `revalidate` and `fetchCache` **when Cache Components is enabled**. Switching the flag off
   re-legalises all four, so the *configuration* is reversible. Fixed in `04c` (`1464dc2f`).
   🔴 **The corrected argument is stronger than the wrong one:** `use cache`, `cacheLife` and
   `cacheTag` exist only under the flag, so every cached scope becomes invalid the moment it is
   off, and an app written under the new model from its first caching milestone has no old-style
   exports to fall back to — **the reversal is a rewrite, not a revert.**
2. **"The edge runtime is NOT supported in `proxy` — keep `middleware`" — unsourceable.** Fork C
   could not settle it and refused to assert it, writing a `## What I could not confirm` section
   instead. What the reference *does* say: Proxy defaults to Node.js, the `runtime` option
   *"is not available in Proxy files"*, setting it *"will throw an error"* — and Middleware is
   itself deprecated, so recommending it as a supported fallback is advice the source does not
   give. Fork A independently reached the same narrower phrasing.

⚠️ **Also worth keeping:** fork C declined to invent a one-way door on `03c` to satisfy the
four-things rule, stating the tree has none and naming the real sticky thing instead. A page
that admits its own framework does not apply is more trustworthy than one that fabricates a
fit.

## Facts this chapter re-spent (all previously banked — do not re-fetch)

From `research_nextjs_ch19_appendices.md` (bundled docs, MCP, the 16 upgrade guide, the stale
production checklist) and from the corpus's own 484 already-sourced verbatim quotes. The ones
that did the most work:

- The production checklist reports `version: 16.3.4` and `lastUpdated: **2026-03-10**` in the
  same frontmatter block, and its **body follows the second date**. 🔴 `version:` is the docs
  build, stamped identically on every page; `lastUpdated:` is the only freshness signal. This
  single page is the corpus's cheapest proof of it.
- *"Enabling `cacheComponents` is not a rename-only change"* — and it **removed** `dynamic`,
  `dynamicParams`, `revalidate` and `fetchCache` as of v16.0.0. So the flag is not reversible:
  turning it off does not restore the vocabulary the code was rewritten out of.
- *"If you are using PPR today, stay in the current Next.js 15 canary you are using."* One of
  very few places the docs tell a named population **not** to upgrade.
- The Edge Runtime is deprecated in 16.3.4 with **no removal version named**, and the docs do
  **not** say the build fails. `preferredRegion` is deprecated with **no framework-level
  successor named**. 🔴 Neither may be given a deadline the documentation does not publish.
- **Skills were repositioned, not withdrawn** — the correction this book had to make on
  2026-09-04, and `04c` uses it as its worked example of the two symmetric errors: announcing a
  death that did not happen, and inferring a history the source does not contain.

## ⚠️ A naming trap this session fell into

`progress_nextjs_ch19.md` **already exists and is about a different chapter** — it records the
**Appendices**, which were chapter 19 before the ch16 insertion renumbered them to **chapter 20**.
Writing this file at that path silently destroyed it; it was recovered with `git checkout` and
this file took the `_capstone` suffix instead. 🔴 **A renumbered chapter leaves its old number
behind in every memory filename**, and `Write` does not warn. `ls`-check a memory path before
writing it, exactly as the authoring contract requires for a link target.

## Where this connects

- [[cursor-nextjs]] — the live resume cursor; its START HERE block is repointed per file
- [[research-nextjs-ch19-appendices]] — the banked primary sources, `do not re-derive`
- [[devbible-locks]] — the per-language lane board
