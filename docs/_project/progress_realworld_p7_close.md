---
name: progress-realworld-p7-close
description: The 2026-09-01 run that CLOSED Real World phase 7 — chapters 05 Dark mode and 06 The overlay layer. Chunk layouts, the four proven splits, and the documented findings that contradict common advice. Open before touching either chapter, or before writing any theming or overlay page anywhere in the corpus.
metadata:
  type: project
---

# Real World · Phase 7 CLOSED — the 2026-09-01 run

**Session `446b57b3`, took chunk B over from `36c19088`.** The user's
instruction was to prioritise PERN/MERN and fullstack project scenarios,
*"deploy max 3 agents including you split the work and focus on it to complete
… do not wait for me"*. Three agents: two `devbible-author` forks on phases 6
and 8, the coordinator on phase 7. Cursor: [[progress-realworld-chunk-b-css]].

**Phase 7 final: 37 files, 8,481 lines, 0 over the 300-line cap, 0 MDX hazards,
339/339 links resolving, 0 placeholders.**

## The two chapters, as built

**05 · Dark mode — 10 chunks + index, 2,639 lines, largest 279**
01 three viewer states · 02 the token layer · 02b deriving and deduplicating ·
03 the flash and the boot · 04 images and media · 04b controls and canvas ·
05 persisting and syncing · 05b React, motion and bfcache · 06 the complete
theme layer · 06b the runtime and the checklist.

**06 · The overlay layer — 5 chunks + index, 1,362 lines, largest 286**
01 the inventory · 02 top layer and popover · 03 the toast region · 04 scroll
lock and the sticky header · 05 the complete stylesheet.

## 🔴 The four proven splits — nothing was trimmed

Recorded before and after, per the hard rule. **Both totals up every time.**

| Draft | Before | After | Split on |
|---|---|---|---|
| 02 the token layer | 304 L · 6 gotchas · 6 Qs | **511 · 14 · 13** | roles ‖ mechanics |
| 04 images and controls | 333 L · 8 · 7 | **535 · 16 · 15** | media ‖ browser-drawn controls |
| 05 persisting | 324 L · 8 · 9 | **515 · 16 · 16** | sources of change ‖ consuming in React |
| 06 complete stylesheet | 352 L · 4 · 5 | **511 · 13 · 12** | artifacts ‖ runtime + checklist |

**The lesson repeated:** the split is where the *concept* divides, and both
halves then grow, because each gets the gotchas and questions the merged draft
had no room to state.

## 🔴 Findings worth not re-deriving — several contradict common advice

**The spec dropped `no-preference` from `prefers-color-scheme`.** It resolves to
`light` or `dark` for *everyone*, so CSS cannot distinguish a user who chose
from one who did not. That single gap is why a theme toggle needs three states
and an attribute. **The system state is the ABSENCE of `data-theme`** — which is
what lets CSS follow the OS live with no listener. A React effect that stamps
the attribute "to keep state in sync" silently pins every system-state visitor.

**Three blocks, not two**, and the guard is load-bearing:
`:root` (light, the schema) · `@media (prefers-color-scheme: dark) {
:root:not([data-theme="light"]) }` · `:root[data-theme="dark"]`. Six
system/stored combinations, all covered.

**`color-mix()` must target a themed token, never `white`/`black`** — otherwise
hover *lightens* in dark mode, reading as disabled. The general rule: the mix
target is whatever the element sits on. And mix `in oklab`, not `srgb`, or the
ramp greys at its midpoint.

**Product photography is NEVER filtered.** `invert()`/`hue-rotate()` makes a red
dress cyan — a returns and commercial problem, not an aesthetic one. So
`--media-plate` is the one deliberately un-themed role, *dulled* rather than
darkened (darkening it puts a visible seam around every product).

**`<picture>` with `media="(prefers-color-scheme: dark)"` cannot see
`data-theme`.** It gives the wrong logo to exactly the users who set an explicit
theme, and flipping the OS theme never reproduces it. The logo becomes a themed
custom property holding a `url()`.

**`::placeholder` needs `opacity: 1` alongside its colour** — engines apply a
default opacity, so the value that was contrast-checked is not the value that
ships. This is how a palette passes review and fails an audit.

**`color-scheme` misses four surfaces**: the control accent (`accent-color`),
scrollbar colours, `::selection`, and `::placeholder`. Autofill ignores the
token layer entirely and needs the inset-`box-shadow` +
`-webkit-text-fill-color` remediation — which must degrade legibly, so never
escalate it with `!important`.

**The `storage` event fires in every same-origin document EXCEPT the one that
changed it** — exactly the no-echo semantics wanted. `newValue === null` means
*removed*, i.e. the system state; treating it as "no change" leaves other tabs
pinned. **A handler for an external change must not re-emit that change**, which
is why there are two near-identical apply functions.

**Top layer and modal are separate properties.** Conflating them is the classic
overlay bug. The toast region is `popover="manual"` precisely so it promotes
without focus management or light-dismiss — `popover` alone defaults to `auto`
and would close the open dialog every time an item was added.

**`overlay` must be in the transition list with `allow-discrete`**, or an
exiting dialog leaves the top layer immediately and animates *behind* the page
it was covering. `@starting-style` is separately required or the entry animation
is skipped entirely.

**`scrollbar-gutter: stable`, declared unconditionally**, is what removes the
sideways jump when `overflow: hidden` locks the page — it replaces the old
measure-the-scrollbar-and-pad-the-body workaround. The lock itself is
`body:has(dialog[open])`, so it cannot get stuck.

**`::backdrop` is not a descendant of its element** and custom-property
inheritance into it has been inconsistent across engines — define scrim tokens
on `:root`. The failure is a fully transparent scrim, not a subtle one. The dark
scrim is *stronger*, not weaker.

**The z-index escalation is a classification failure.** Two questions — is it
modal, does it need to escape an ancestor — put seven of eleven overlays in the
top layer and leave three named values, nothing above 30. A fourth value
appearing in the scale means a classification was skipped.

## Method notes

🔴 **Repoint placeholders at every topic close** — closing these two chapters
turned **12** `(not written yet)` markers across chapters 01, 04, 05 and the
phase index into real links. Nothing prompts you; run
`grep -rn "not written yet" <phase>` as the last step.

⚠️ **`sed '1d'` on a split tail silently drops the first heading.** It happened
here and was caught only by a `grep '^## '` structural check. **Diff section
headers after any mechanical split**, not just line counts.

The three-agent split had **no shared file** between the coordinator and either
fork: each owned a whole phase directory including its `README.md`. The
coordinator kept `docs/README.md`, `src/data/progress.js` and
`docs/real-world/pages/README.md` to itself. No collisions.

See also [[progress-realworld-build]], [[progress-realworld-split-3way]],
[[devbible-locks]], [[progress-stack-coverage-map-20260901]].
