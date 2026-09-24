---
name: progress-nextjs-ch19
description: Next.js chapter 19 (Appendices) CLOSED 2026-09-04 — 6 stubs to 14 pages, the four documentation corrections it is built on, and the split proofs.
metadata:
  type: project
---

# Next.js ch19 · Appendices — CLOSED 2026-09-04

Session `10aadd98`, user named *"Continue with next js deploy one agent split work both of you
and use dev bible skill"*. Commit `094d85e1` closes it.

**6 stubs / 182 lines / 0 ★ → 14 pages / 2,943 lines / 241 ★.** Positions and `sidebar_label`
numbers renumbered gap-free 0–13 at close. QC clean: 0 over cap · 0 missing tier badge or
`> Verified:` · 0 `{/* FOOTER */}` · 0 ` ```console ` · 0 stub boilerplate · 0 duplicate
positions · 0 MDX hazards · every relative link resolves.

## The four corrections the chapter is built on

An appendix that restates the docs is worth nothing. These changed the answer:

1. 🔴 **The official production checklist is months stale.** `/docs/app/guides/production-checklist`
   fetched as Markdown reports `version: 16.3.4` **and `lastUpdated: 2026-03-10`** in the same
   frontmatter, and the body follows the second. It still calls PPR experimental (linking a
   Next.js **14** blog post), still says `eslint-plugin-jsx-a11y` is built in (`next lint` was
   removed and `next build` no longer lints), and still links a bundle-analyzer anchor reading
   `…#nextbundle-analyzer-**for-webpack**`. Six drift points tabulated in Appendix D part 1.
2. 🔴 **First-party Skills were repositioned, not withdrawn — this corpus had it wrong.**
   `05-appendix-e-version-watchlist.md` asserted *"Withdrawn — the earlier first-party Skills,
   superseded by version-matched bundled docs"*. The AI agents guide says framework **knowledge**
   moved to the bundled docs while Skills kept **workflows**, and names four shipping today.
   ⚠️ Deliberately not over-corrected: the docs do not say whether an earlier Skills generation
   existed and was removed, so that stays unsettled on the page.
3. 🔴 **The official glossary has no entry for `MCP` or `Instant Navigations`** — both current,
   shipped, documented. Six terms this book uses are absent from it (also `AGENTS.md`, `Adapter`,
   `Skill`, `deploymentId`). Each sourced from the guide that owns it, gap stated on the page.
4. 🔴 **`next upgrade` and `next experimental-analyze` exist** as first-party commands added in
   **16.1**. The second is the real successor to the `size` / `First Load JS` metrics **16.0
   removed** — so **any CI gate parsing build output for sizes now passes vacuously**, which is
   the worst failure a quality gate has.

## Split proofs (both UP, per the contract)

| Appendix | Drafted | After split |
|---|---|---|
| A · glossary | 366 lines / 20 ★ (one file) | **593 / 42** across `01`, `01b` |
| B · migration | 312 / 20 (`02b`) | **428 / 42** across `02b`, `02c`, after exhausting each half |

A's boundary is rendering vocabulary vs build-and-tooling vocabulary; B's is **whether the build
catches the change or it ships to a user** — the page's own organising principle, and a better
axis than feature area.

## The pages

`01-explanation` (index, 65) · `01`/`01b`/`01c` Appendix A glossary (300/293/255) ·
`02`/`02b`/`02c` Appendix B React upgrade (210/230/198) · `03`/`03b`/`03c` Appendix C tooling
(200/219/241) · `04`/`04b`/`04c` Appendix D checklist (192/215/201) · `05` Appendix E (124).

## Method notes worth keeping

- **Zero re-fetching of what the corpus already holds.** `grep -rh '^> \*"' --include='*.md'
  docs/nextjs/pages` returned **484** already-sourced verbatim quotes; the glossary pages were
  largely written from those. Only **6 fetches** total, all banked in
  [[research-nextjs-ch19-appendices]].
- 🔴 **`nextjs.org/docs` serves Markdown** — append `.md` or send `Accept: text/markdown`.
  `/docs/sitemap.md` resolves paths; **a wrong path returns a readable "Page Not Found" body that
  summarises like content**, which is how an agent invents a doc page.
- 🔴 **Two defects I shipped and had to repair mid-chapter, both worth guarding against:**
  a **dangling link** (`../05-…/README.md` — ch5's index is `01-explanation.md`, it has no
  README) committed and fixed one commit later; and a **`cd` slip** that wrote a 210-line page to
  the **repo root** because an earlier `cd` in the same batch had moved the shell. Prefix each
  write batch with its own `cd`, and `git status` before committing.

## Found, not fixed

- `11-performance-optimization-turbopack/06-instrumentationts-…md` is a 58-line stub duplicating
  ch16's telemetry pages. All of ch11's `01`–`07` are 46–76-line stubs.
- `_category_.json` labels still read `"N. Label"` across all 19 chapters vs the house
  `"NN · Label"` — track-wide, left alone for the second session running.
