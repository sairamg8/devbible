---
name: devbible-homepage-imported-track-status
description: 2026-09-05 — the 11 imported frontend-toolchain tracks now carry a real status on the homepage, scored on pages VALIDATED (tier badge + dated Verified line) rather than pages present. The `imported`/`verified` fields in progress.js, what each surface renders, and how to move a number.
metadata:
  type: project
---

# The imported toolchain tracks have an honest number now (2026-09-05)

**Session `3936de7d`, commit `46f68b97`.** User: *"In Home page of devbible there are
frontend tool chain languages we need to update the status of each topics and how
completed just like other languages."*

## 1 · The problem the request exposed

The Frontend toolchain cards rendered a bare **`IMPORTED`** tag and **no numbers at all** —
no percentage, no bar, no counters — while every other card on the page carried them.

But the naive fix was a trap. These tracks came in **complete** from the `frontend-bible`
repo on 2026-08-14, so `progress.js` had `topics: 1, pages: 1` per chapter and
`summarise()` scored all eleven at **100% · complete**. `static/status.json` had been
saying `"vite": "complete", 100%` since the import. **Wiring `data` into the cards without
changing what is counted would have shipped eleven 100% bars over 180 pages that nobody
has ever checked.**

## 2 · What "complete" means for an imported track

Pages present is not the axis that moves. **Validation is.** So a page counts when it
carries **BOTH** a tier badge (`db-tier t-`) **and** a dated `> Verified:` line — the two
marks pass F2 of [[devbible-frontend-toolchain-currency-plan]] adds, and the two marks
**nothing in the raw import has**. Measured on disk 2026-09-05:

| track | chapters | pages | validated |
|---|---|---|---|
| jest-rtl | 16 | 16 | **16** (plus a 14-page `configs/` reference, also validated) |
| vite · babel · playwright · tanstack-query · framer-motion | 16 | 16 | 0 |
| webpack | 16 | 21 | 0 |
| eslint-oxlint | 21 | 21 | 0 |
| redux-toolkit | 13 | 16 | 0 |
| frontend-architecture | 15 | 15 | 0 |
| web-vitals-performance | 11 | 11 | 0 |

**180 imported pages, 16 validated, 9%.** Storybook is not in this table — its native
`phase-N-*` pages were written here and it already had a real row.

## 3 · The shape in `src/data/progress.js`

- `imported: true` on the **language** — provenance, and the switch every surface reads.
- `verified: N` on each **phase** — validated pages in that chapter.
- `phaseStatus()` gained **`imported`** (verified 0) and **`validating`** (0 < verified <
  topics); `verified >= topics` returns the existing `written`.
- `summarise()` scores those phases on `verified`, adds **`pagesValidated`**, and leaves
  **`pagesWritten` counting every page that exists**. 🔴 **Those two are meant to
  disagree** — Vite reads *"0% · 16 chapters · 16 pages · 0/16 validated"*, which is the
  honest description of a complete draft nobody has checked.

**To move a number: re-measure, do not estimate.** Count leaf pages (README excluded) under
`docs/<track>/pages/<chapter>/` matching both `db-tier t-` and `^> Verified:`, and write
that into `verified`. The homepage, the `<Progress>` block in the track's README and
`status.json` all follow — nothing else is hand-maintained.

## 4 · What each surface says now

- **Homepage card** — keeps the `IMPORTED` tag *next to* the percentage (the percentage
  alone reads as "0% written", the one thing it does not mean), and its meta line counts
  different things: `16 chapters · 16 pages · 0/16 validated`, plus a muted
  *"Draft · validation not started"* (`.cardNote`, deliberately **not** the amber
  `.cardNow` — amber claims someone is on it).
- **`<Progress>`** — header reads **"Pages validated"**, counters become
  **Chapters / Validated / Pages**, phase rows read *"1 page · not yet validated"* with
  state **Draft** / **Validating**.
- **`status.json` v3** — new statuses `imported` / `validating` / `validated`, an
  `imported: true` flag per row, and 🔴 **`totals` and `importedTotals` are summed apart**:
  syllabus topics explained and imported pages validated are different units, and adding
  them produces one meaningless number (the same reason the homepage roll-up strip was
  removed on 2026-08-31).
- **Card descriptions** name each track's known drift, **re-measured against the corpus the
  same day**, not copied: 0 mentions of Rolldown or the Environment API in Vite · 0 of
  Rspack in Webpack · 0 of "Babel 8" · 3 eslint pages still referencing `.eslintrc`, 0
  naming ESLint 10 · **13 framer-motion files importing the renamed package**, 0 using
  `motion/react` · 2 web-vitals pages still teaching FID · 0 Playwright version anchors ·
  11 jest-rtl files pinned to Jest 29.

## 5 · Two things worth copying

- **Prove a scripted edit to `progress.js` did not eat anything.** It was spliced once
  before. Check: **407 phase rows and 29 language keys before and after**, plus
  `summarise()` diffed across **all 29 languages** — identical except the new field for
  every track outside the eleven. Do this every time; the file is the site's whole spine.
- **Verified without `yarn build`.** The build slot is registry-gated and OOMed at ~448s on
  2026-09-02, so the real homepage and `<Progress>` were **server-rendered with stubbed
  Docusaurus internals** (a `@babel/core` + `react-dom/server` harness with `@theme/Layout`,
  `@docusaurus/Link` and `*.module.css` stubbed; harness in the session scratchpad). That
  catches JSX errors and every rendered string — do this rather than guessing when the
  build is unavailable. It does **not** replace CI: see
  [[devbible-verify-in-ci-not-locally]].

## 6 · Left undone, deliberately

- **jest-rtl's `configs/` section (14 validated pages) is not in `progress.js`.** Every
  phase there points inside `pagesPath`, and that section sits outside it; adding it needs
  a per-phase path override. Its card description names the section instead.
- **jest-rtl is not `done: true`.** It is validated but its content is pinned to Jest 29
  against upstream 30.5 — the F2 currency half is still owed, so the `done` pill (set by
  hand, never derived from `percent === 100`) stays off.
- **Nothing in `docs/` was touched.** The `:::caution Imported corpus` banners and
  `docs/README.md`'s per-track table were already accurate and agree with these numbers.

Related: [[devbible-frontend-toolchain-currency-plan]] · [[devbible-ui-progress-and-build-cadence]] ·
[[devbible-shared-file-staging]] · [[devbible-verify-in-ci-not-locally]] ·
[[progress-frontend-import-bucket-a]]
