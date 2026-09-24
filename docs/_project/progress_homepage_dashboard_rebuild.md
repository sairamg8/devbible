---
name: devbible-homepage-dashboard-rebuild
description: 2026-08-31 — the homepage dashboard was rebuilt around derived data after the user said they did not like it. The rule that came out of it - nothing on the homepage states project state in hand-written prose.
metadata:
  type: project
---

**2026-08-31.** The user opened the session with:

> *"I do not like the UI dahboard need to improve it and i need to add angular syllabus as well"*

No further steer was given, so the diagnosis was made from the page itself. Four
problems, all the same problem: **the page was hand-written where it should have been
derived.**

## What was wrong, and what replaced it

| Was | Is |
|---|---|
| A hand-written **"Just finished"** panel naming Docker and the React patterns layer. Written 15 Aug, wrong by the 17th — Java had been the thing moving for two weeks | A **"Moved most recently"** rail built from the three freshest `updated` stamps in `progress.js`, which every session already refreshes as part of its cadence. It cannot drift |
| **No total anywhere** — you could not tell from the page whether the bible was a weekend of notes or twenty thousand pages | A roll-up strip: coverage %, technologies tracked and complete, topics and topics explained, pages written — all summed from the same source as the cards |
| **31 cards, no way through them** | A client-side filter over name and one-line summary, plus status chips (complete / in progress / imported). Layers that match nothing disappear rather than leaving empty headings |
| **Every live card** accent-bordered on an accent-soft ground — 26 cards shouting at one volume | State on a single 3px left edge: accent = complete, **amber = in flight**, neutral = imported, dashed = planned. The approved palette has had amber since day one and the homepage had never used it |

Also: the tier legend moved **below** the map (it is a legend, not an entry point, and at
the top it pushed the map below the fold), the page widened 980 → 1180px, and each card is
handed its `summarise()` object and lays the numbers out itself instead of receiving a
pre-formatted `stats` string — so a new language cannot invent its own stats format.

## 🔴 The rule this leaves behind

**Nothing on the homepage states project state in hand-written prose.** If the page wants to
say what changed, what is in flight or how much is done, it derives it from
`src/data/progress.js`. A sentence a human has to remember to update is a sentence that will
be wrong within a fortnight — this one was wrong for two weeks and nobody noticed, because
the person who would notice was the person who wrote it.

**Why:** see [[devbible-ui-progress-and-build-cadence]] — the user is often away while pages
are being written and opens the site to see how far it got. A stale headline defeats the
entire point of that arrangement.

**How to apply:** new homepage sections take a `progress.js` selector, not a paragraph. Two
helpers exist for this: `lastUpdated()` and **`recentlyUpdated(count)`**, added the same day.

## One trap, found and fixed the same hour

`recentlyUpdated()` initially surfaced **"Jest & RTL — 100% — every scheduled phase
written"** as the newest work. True of the counter, false of the pages: the twelve imported
frontend-toolchain corpora carry the stamp of the day they were *moved in*, not of anyone
writing them. The filter is `lang.phases.some(p => p.part !== 'Imported corpus')` — which
correctly keeps Storybook, whose imported phases sit alongside phases written here.

## Verifying a homepage change

`yarn start` in the project root (port 3000 by default). In a **worktree** the search-index
files are missing and the dev server will start a full ~8GB production build to generate
them — symlink them from the main checkout first:

```bash
cp -s /mnt/Storage/Backup/Knowledge/devbible/static/search-index*.json static/
```

🔴 After any change to `progress.js`, run **`yarn status`**: `static/status.json` is generated
from it and `yarn status --check` exits 1 when stale.

Delivered on branch `worktree-angular-dashboard`, merged to `main` 2026-08-31 alongside
[[cursor-angular]]. **That worktree and branch were deleted the same day** — see the
consolidation banner in [[devbible-locks]] and the rule in
[[devbible-feedback-worktrees-are-temporary]]. The work is on `main`; the directory is not
there any more.

✅ **Shipped 2026-08-31** via [PR #1](https://github.com/sairamg8/devbible/pull/1) (merge
`9214a5ad`), and **live** — the Pages workflow deploys on any push to `main`, so the merge
published it: **https://sairamg8.github.io/devbible/**
