---
name: devbible-css-syllabus
description: The CSS syllabus — RE-SCOPED 2026-08-13 to advanced-only + SCSS, 12 phases and 119 topics (was 15/230); and the Firefox+puppeteer harness that resolves how browser-rendered pages get verified
metadata:
  type: project
---

> ⚠️ **Superseded in part.** The 230-topic structure below was **cut to 119 topics on
> 2026-08-13**, mid-session, on the user's instruction to cover *advanced concepts only*
> and to add SCSS. The re-scope — what was dropped, what was kept, the new phase list,
> and why Master is now 42 % — is in **[[devbible-css-pages-progress]]**. Everything
> below about the **harness, Baseline data and the single-engine limitation still
> stands unchanged**.

Written **2026-08-13**, after the JavaScript and TypeScript syllabi. The user's ask was
*"pick and work on CSS, make sure not to touch other languages"* — so nothing outside
`docs/css/` was touched except the wiring `instructions.md` mandates for adding a
language, and one CSS-only row in `docs/README.md`.

## What exists

`docs/css/` — `_category_.json` (position **6**), `README.md`, and `syllabus/` with four
parts. **Zero pages written.**

| Part | File | Phases | Topics | Master | Lines |
|---|---|---|---|---|---|
| 1 How CSS works | `01-how-css-works.md` | 0–3 | 56 | 20 | 154 |
| 2 Layout | `02-layout.md` | 4–7 | 62 | 23 | 159 |
| 3 Adaptive and visual | `03-adaptive-and-visual.md` | 8–11 | 63 | 14 | 160 |
| 4 CSS in a real application | `04-at-scale.md` | 12–14 | 49 | 10 | 129 |

**230 topics · 67 Master (29%) · 126 Understand · 36 Know · 1 When Needed.** Counted with
a script before the distribution table was written — the lesson from
[[devbible-javascript-syllabus]] held, two of the four drafted per-part Master counts
were wrong.

Phases: 0 how CSS runs · 1 selectors · 2 cascade · 3 values/units/custom properties ·
4 box model · **5 flexbox** · **6 grid** · 7 positioning/stacking · 8 responsive and
container queries · 9 typography · 10 color/effects · 11 motion · 12 interaction and
native UI · 13 architecture/tokens/the stack · 14 performance and accessibility.

## 🔴 The verification harness — this is the reusable part

**`puppeteer-core` 25.6.0 driving the system Firefox over WebDriver BiDi works, and it
answers the question the JavaScript syllabus left open.**

```js
puppeteer.launch({browser:'firefox', executablePath:'/usr/bin/firefox',
                  headless:true, userDataDir:'./ffprof'})
```

Verified working on this machine: `getComputedStyle`, `getBoundingClientRect()`,
`CSS.supports()` and full-page screenshots, all from a real render. A probe of
`repeat(auto-fit, minmax(120px,1fr))` in a 500 px container with a 10 px gap read back
`'160px 160px 160px'` — a real measured number of the kind CSS pages need.

**[[devbible-javascript-syllabus]] open question 1 ("how does Part 3 get verified") is
therefore answerable** — the same harness covers DOM, events and CORS-failure output.
Update that memory when JS Part 3 starts.

Two traps hit setting it up:

1. **Bare `firefox --headless` fails** if a Firefox is already running —
   *"Firefox is already running, but is not responding."* Pass `-profile ./ffprof` (or
   `userDataDir`) for an isolated profile. Costs 10 minutes if you don't know it.
2. `require('web-features/package.json')` throws `ERR_PACKAGE_PATH_NOT_EXPORTED`; read
   the file with `fs` instead. `require('web-features')` itself is fine.

## Feature data comes from `web-features`, never from memory

`web-features` **3.34.3**, 1 186 features, is the package behind Baseline. Also on the
registry: `caniuse-db` 1.0.30001809.

Measured Baseline states worth carrying (2026-08-13):

| Feature | Baseline | Since |
|---|---|---|
| `:has()` · container queries · subgrid · nesting · cascade layers · `color-mix()` · Oklab/OkLCh | **high** (widely) | 2023-12-19 · 2023-02-14 · 2023-09-15 · 2023-12-11 · 2022-03-14 · 2023-05-09 · 2023-05-09 |
| View transitions · `@scope` · `content-visibility` · popover · `@starting-style` · `light-dark()` · relative colors | **low** (newly) | 2025-10-14 · 2025-12-12 · 2025-09-15 · 2025-01-27 · 2024-08-06 · 2024-05-13 · 2024-09-16 |
| **`field-sizing`** | **low** | **2026-06-16** |
| Anchor positioning · scroll-driven animations · masonry · `calc-size()` · `interpolate-size` · `line-clamp` · `text-wrap: pretty` · `accent-color` · `::marker` | **false** (limited) | — |

**`field-sizing` reaching Baseline in June 2026 is the argument for the whole approach** —
no recollection would have produced that date. `accent-color` and `::marker` reporting
`false` is genuinely surprising and worth re-checking before a page asserts it.

## The single-engine limitation, stated not hidden

**Only Firefox 153.0.3 exists on this machine. No Chromium, no WebKit.** So the pages
keep two claims apart: *measured behaviour* comes from the local render and is labelled
with the engine; *cross-browser availability* comes from `web-features`. Where a topic's
point is an engine difference, the page says it could not be verified here.

Recorded as open question 1 in the README — **ask the user whether to install Chromium**
before Part 2 or Part 3 pages are written.

## The two boundaries drawn

1. **Against JavaScript** — CSS owns declarative motion and the cost model of what is
   cheap to animate; JS owns `classList`, inline `style`, `requestAnimationFrame` and the
   Web Animations API. The JS syllabus already points here (its Phase 12 names
   `prefers-reduced-motion` and container queries).
2. **Against React** — React owns component design and re-rendering; CSS Phase 13 owns
   *how styles reach a component* (CSS Modules, Tailwind, tokens, `className`). They meet
   at the `className` prop. This is the same shape as the PG/Node boundary exception in
   [[devbible-scope-boundaries]].

## Master tier: Parts 1–2 carry it

20 + 23 in Parts 1–2 versus 14 + 10 in Parts 3–4. Deliberate and stated in Part 3's
header: `oklch()`, OpenType features and scroll-driven animation are look-up topics, and
marking them Master would make the badge mean "appears in CSS".

## Wiring done

`sidebars.js` (`cssSidebar`) · `src/data/progress.js` (a `css` entry, 15 phases,
`pages: 0`) · `docs/README.md` CSS row → *Syllabus complete* · `src/pages/index.js` card
activated with `to: '/docs/css'` (same convention TypeScript already used with zero
pages).

## Session conditions worth knowing

**A co-session was building and committing in the same repo throughout.** It deleted
`.docusaurus`/`build` mid-run twice, killed the dev server, and `git add`ed my files.
The user's instruction: *"do not focus much on build issues… always pick next one, check
later, do not waste more time."*

- My clean `yarn build` grepped **clean** (`warning|broken` exit 1); the `build/` dir was
  then wiped by the other session before it could be counted. Left alone.
- **The dev server does not hot-reload `sidebars.js`.** The running server predated the
  `cssSidebar` edit, which is why the user saw nothing in the UI. Kill it, `rm -rf
  .docusaurus`, restart — the known trap in [[devbible-progress]], hit again.
- It listens on **`[::1]:3000` only** — `curl 127.0.0.1:3000` returns `000`, `localhost`
  returns 200. Same IPv6 trap as the PG sandbox.
- A dev-server error overlay covered the whole page and was from **`docs/react/README.md`**
  (the co-session's MDX error at line 183), not from CSS. It cleared on its own.

Render-verified in Firefox after the restart: `/docs/css/` → `<h1>CSS — Syllabus</h1>`;
`/docs/css/syllabus/layout` → 62 `.db-tier` badges, matching the 62 topics exactly.

## Not done, deliberately

- **No pages.** Syllabus first, approved, then content — [[devbible-incremental-scope]].
- Not committed by me; devbible commits need an explicit instruction.
- The three open questions in the README (Chromium, screenshots-in-repo, Phase 13 depth)
  are recorded rather than silently decided.

Related: [[devbible-brief]] · [[devbible-scope-boundaries]] ·
[[devbible-never-compress-to-fit-cap]] · [[devbible-javascript-syllabus]] ·
[[devbible-progress]]
