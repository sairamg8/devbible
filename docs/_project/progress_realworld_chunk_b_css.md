---
name: devbible-realworld-chunk-b-css
description: Live cursor for Real World chunk B — phase 7 CSS recipes (6 topics) — what is written, the chunk layout, and the decisions taken
metadata:
  type: progress
---

# Real World · chunk B — Phase 7 · CSS recipes

**Session `36c19088`, started 2026-08-17.** Picked up on the user's question
*"can you pick what was pending with css?"* — the CSS **track** is complete
(74/74, 81 pages), so the only unwritten CSS work is this phase. The user chose
it over a rule-13 depth pass on `docs/css/` when offered both.

Governing brief: [[devbible-realworld-split-3way]] (chunk B prompt).
Track state: [[devbible-realworld-build]].

🔴 **The user restated rule 1 verbatim while this session was running:**
*"it should be 300 lines but it was never a content budget you can explain upto
1000 lines or more just split them into multiple chunks to bring 300 lines
filesize so it would be easy to read and rest of the chunks import them into
main file."* Write in full → split on concept boundaries → index from the topic
`README.md`. That is the shape every topic here takes.

## 🔴 SCOPE CUT 2026-08-17 — the phase is FOUR topics, not six

The user dropped two topics mid-session, verbatim:

> *"Wait i do not need that checkout form in css / that header and navigation as
> well"* · *"it was css i know how to build those, they are not worth for writing
> topics"*

| Dropped | Why it was a fair cut |
|---|---|
| **02 · The header and navigation** | a bar shell is [[devbible-css-pages-progress]]'s CSS 4·06; the mechanisms already have a home |
| **03 · The checkout form** | form-state styling is CSS 1·09; layout is ordinary grid |

⛔ **Do not reinstate either without a new instruction.** Their syllabus rows are
**struck through with a `:::warning` banner, not deleted** — same convention as
the JavaScript scope cut. Chapter numbers keep their gaps (**01, 04, 05, 06**) so
the syllabus rows still line up; do not renumber.

**Track totals moved 79 → 77 topics**, tier table **37/28/14 → 36/27/14**.
Committed `4e5ebab8`.

⚠️ **One uncommitted partial file was deleted** — `02-the-header-and-navigation/
01-the-header-shell.md`, 258 lines, the only chunk written of that topic. It was
an unfinished fragment whose `Next →` pointed at a file that would never exist,
so leaving it would have broken the build. **Nothing committed was deleted**, and
the user was told before it happened. It is not recoverable from git.

## Cursor

🏁 **PHASE 7 IS COMPLETE — 4 of 4, closed 2026-09-01 by session `446b57b3`.**
**There is nothing left in chunk B.** If the user says "Real World B" or
"phase 7", say it is finished and let them choose; do not invent work here.

| # | Topic | State |
|---|---|---|
| 01 | The product grid | ✅ **DONE — 12 chunks + index, 3,110 lines, largest 299** (`f13e76c4`) |
| ~~02~~ | ~~The header and navigation~~ | 🚫 **dropped 2026-08-17** |
| ~~03~~ | ~~The checkout form~~ | 🚫 **dropped 2026-08-17** |
| 04 | Skeleton loaders and spinners | ✅ **DONE — 5 chunks + index, 1,301 lines, largest 268** (`b0872421`) |
| 05 | Dark mode | ✅ **DONE — 10 chunks + index, 2,639 lines, largest 279** (2026-09-01) |
| 06 | The overlay layer | ✅ **DONE — 5 chunks + index, 1,362 lines, largest 286** (2026-09-01) |

**Phase 7 final: 37 files, 8,481 lines, 0 over the 300-line cap, 0 MDX hazards,
339/339 links resolving, 0 `(not written yet)` placeholders left.**

🔴 **The 2026-09-01 run — chunk layouts, the four proven splits, and the
findings that contradict common advice — is [[progress-realworld-p7-close]].**
Read that before touching either new chapter.

### 🔴 What topic 05 owes the two written chapters

Both existing chapters define **no colours at all** and refer to tokens that do
not exist yet. Topic 05 is where they get defined, so it is not a free-standing
chapter — it has a contract to satisfy:

| Token | First used by | Must be |
|---|---|---|
| `--surface-1` | 7·04 chunk 03 (the shimmer highlight, via `color-mix`) | the page/base surface |
| `--surface-2` | 7·01 chunk 05 (the media placeholder) | one step raised |
| `--surface-3` | 7·04 chunk 02 (skeleton placeholder fill) | one step further |
| `--text-muted` | 7·01 chunk 08 (compare-at price), chunk 10 (end state) | de-emphasised text |
| `--radius-1`, `--radius-2` | both chapters | the shape scale |
| `--space-2` … `--space-8` | both chapters | the spacing scale |

⚠️ **The three viewer states are mandatory** and were called out in the chunk-B
brief: explicit light (`data-theme="light"`), explicit dark
(`data-theme="dark"`), and **system default with nothing stamped** — where only
`prefers-color-scheme` separates them. The guard shape is
`:root:not([data-theme="light"])` inside the media query, so the toggle wins in
both directions.

### 🔴 What topic 06 owes topic 01

[[devbible-realworld-chunk-b-css]] topic 01 chunk 04 proved that
`container-type: inline-size` on `.product-card` applies **layout containment**,
which makes the card a **containing block for fixed/absolute descendants** and a
**stacking context**. So an overlay rendered inside a card cannot escape it —
no CSS from inside undoes that. Topic 06 must therefore:

- justify the portal to `document.body` that
  `phase-4-react-ui/07-modal-portal-focus.md` already does;
- own the **`z-index` scale**, because topic 01 chunk 01's gotcha says a
  header's `z-index: 10` "only means anything relative to a scale someone wrote
  down" — nobody has written it down yet;
- cover `<dialog>` + the top layer + `::backdrop`, which sidestep `z-index`
  entirely.

### Topic 01 chunk layout (as built)

```
01-the-product-grid/                          3,025 lines total
├── _category_.json
├── README.md                                  74
├── 01-the-track-sizing-decision.md           257
├── 02-autofill-grid-and-the-list-reset.md    269
├── 03-the-card-adapts-to-its-column.md       253
├── 04-container-units-and-containment.md     240
├── 05-images-without-layout-shift.md         230
├── 06-image-delivery-and-long-grids.md       246
├── 07-the-text-squeeze-and-clamping.md       229
├── 08-the-price-row-and-row-alignment.md     258
├── 09-the-loading-state-and-announcements.md 257
├── 10-empty-end-and-error-states.md          265
├── 11-the-complete-stylesheet.md             299
└── 12-tokens-layers-and-the-contract.md      224
```

🔴 **THREE splits happened *because of* the rule rather than in spite of it, and
none lost a word:**

| First draft | Landed at | Split on |
|---|---|---|
| `01-the-track-sizing-decision` | 335 | the `auto-fill` / grid-vs-flex / list-reset boundary → chunk 02 |
| `03-the-card-adapts-to-its-column` | 301 | units + containment side effects → chunk 04 |
| `05-images-without-layout-shift` | 302 | reservation vs delivery → chunk 06 |
| `07-the-price-row-and-long-text` | 326 | the text squeeze vs the price row → chunks 07/08 |
| `09-loading-empty-and-error-states` | 324 | loading vs terminal states → chunks 09/10 |
| `11-the-complete-stylesheet` | 331 | the file vs its dependency contract → chunk 12 |

**Six splits in one topic.** The pattern that keeps recurring: a chunk that
covers *a mechanism and its consequences* is two chunks, and the consequences
half is always the one with the traps worth having.

⚠️ **Every split leaves stale `Next →` footers and cross-references.** Three
were caught by the link check (`02:150`, `06:246`, `08:258`) — **run the link
resolver after every split**, not just at the end.

### Section counts (rule 13 evidence)

Gotchas run **6–13** per chunk, Q&A **6–11**. Deliberately not uniform — the
containment chunk has more traps than the price row, and the page counts say so.

## Decisions taken

- ✅ **Topics 01 and 03 are tiered Master**, following the split brief, which
  bolded them Master even though `syllabus/03-completion.md` listed all six as
  Understand. They are build-from-it topics and rule 13 says tier decides shape.
  **Done:** both syllabus rows promoted and the `docs/real-world/README.md` tier
  table moved 35/30/14 → **37/28/14**.
- **The phase declares a layer order once** — `@layer reset, tokens, base,
  layout, components, utilities` — in the phase `README.md`, and every chapter
  writes into `components`. This is what lets rules stay at single-class
  specificity.
- **Every selector targets markup that already exists in Phase 4.** The grid is
  `<ul className="product-grid">` from `4·03`; the modal is
  `<dialog className="modal">` portalled to `document.body` from `4·07`; the
  checkout is the `Field`-wrapped form from `4·04`. One exception noted in the
  page itself: the card gains a `__inner` wrapper, because a container cannot
  query itself.
- **No sandbox, no console blocks** (rule 8). Everything validated against MDN
  and the CSS specs, named on each chunk's `> Verified:` line.

## Traps found while writing

- **`container-type` is a stacking context and a containing block.** A `fixed`
  tooltip inside a card positions against the card; a hover-lift `z-index` on a
  child cannot escape. This is why chapter 06 (overlays) must portal — and it is
  the same shape as the clipped-dropdown problem with a new cause.
- **`cqi` with no container ancestor falls back to the small viewport**,
  silently. Symptom (huge text) looks nothing like the cause.
- **Safari drops the `list` role** when `list-style: none` is applied, so the
  grid `<ul>` needs `role="list"` in the Phase 4 markup.
- **A container cannot query itself** — the single most common container-query
  mistake, and it costs one wrapper div that `display: contents` cannot avoid.

## Session log

| When | What |
|---|---|
| 2026-08-17 | Picked up from *"can you pick what was pending with css?"*; offered the two candidates, user chose Real World phase 7 over a rule-13 depth pass on `docs/css/` |
| | ✅ **7·01 · The product grid** — 12 chunks + index, `f13e76c4` |
| | 🔴 **Scope cut** — topics 02 and 03 dropped, `4e5ebab8` |
| | ✅ **7·04 · Skeletons and spinners** — 5 chunks + index, `b0872421` |
| | ⏸ **Halted on the user's instruction**, cleanly, at topic 05 |

## Verification — the three checks, all green at topic 01's close

```bash
# 1. links resolve (a python walk of every ](...md) against the filesystem)
#    → checked 120 links, ALL RESOLVE
# 2. MDX compiles (await the compile, strip frontmatter) → 14 files, ALL CLEAN
# 3. AST scan for render bombs                           → NO RENDER BOMBS
```

🔴 **NOT BUILT.** No `yarn build` and no dev server were run — the rule-12
registry row was never claimed, and it was free the whole time. Report it as
*link-checked, not built*, never as "the build passed".

## Boards — all four updated at topic 01's close ✅

1. `src/data/progress.js` — phase 7 now `pages: 1, pagesPlanned: 6`.
2. `docs/real-world/pages/phase-7-css-recipes/README.md` — created, topic 01 row
   linked and marked *(12 chunks)*.
3. `docs/real-world/pages/README.md` — phase 7 row now links and reads 🚧 1 / 6.
4. `docs/README.md` — **new chunk-B claim row** for session `36c19088`, plus the
   Real World technology row moved to 61/79 and 97 files.

⚠️ **`docs/README.md` moved under me mid-edit** — the file count in the
technology row went 79 → 83 between reading and editing it, because another
session was writing. **Re-read a shared row immediately before editing it**, and
take the higher number if it moved. Committed as `f13e76c4`, explicit paths only.

## Topic 04 chunk layout (as built)

```
04-skeletons-and-spinners/                     1,301 lines total
├── _category_.json
├── README.md                                    83
├── 01-skeleton-spinner-or-nothing.md           226
├── 02-building-the-skeleton.md                 240
├── 03-the-shimmer-and-its-cost.md              268
├── 04-the-spinner-and-busy-button.md           263
└── 05-the-complete-stylesheet.md               221
```

**No splits were needed** — unlike topic 01, every chunk came in under the cap
on the first draft. Gotchas run **9–12**, Q&A **6–9**, varying by chunk.

### The four findings worth reusing

1. 🔴 **A CSS-only delay beats a `setTimeout`.** `opacity: 0` plus
   `animation: <name> 1ms 400ms forwards` — a fast response never reaches the
   animation's first frame, so there is no flash, no timer to clear, no
   re-render, and no state-update-after-unmount warning.
   ⚠️ **In the `animation` shorthand the FIRST time is duration and the SECOND
   is delay.** Swapped, it looks like the delay is simply not working.
2. 🔴 **Skeletons stop under `prefers-reduced-motion`; spinners must SLOW.**
   A skeleton still reserves space without its sheen, but a *stopped* spinner is
   indistinguishable from a hung app — the motion **is** the signal. This is the
   one indicator where the reflexive `animation: none` is wrong.
3. **The skeleton IS the component with its content removed**, never a picture
   of it. Geometry is then inherited and cannot drift; a standalone
   `.skeleton-grid` is correct the day it ships and silently wrong later, with
   no test comparing the two stylesheets.
4. **`disabled` throws focus to the document body**, so a keyboard user who
   pressed Enter loses their place. `aria-disabled` keeps focus and announces
   the state but **blocks nothing** — the handler must return early itself.

## Traps found while writing (continued)

- **A stale `Next →` footer survives every split.** Six splits produced three
  broken forward links that only the filesystem resolver caught. Run it after
  each split.
- **`content-visibility` and `subgrid` conflict on the same element** — subgrid
  needs the card's rows to contribute to shared parent tracks, and
  `content-visibility` exists to avoid laying those cards out. Topic 01 chooses
  alignment and says so in chunk 11 rather than shipping both.
