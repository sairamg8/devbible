---
name: progress-homepage-board-sync-20260817
description: Session e86a1703 (2026-08-17) — audited the homepage against disk, fixed the stale hero, three missing Complete flags and the hidden Storybook card, corrected six file counts in docs/README.md, and ran the first green whole-site build of the day.
metadata:
  type: project
---

# devbible homepage / board sync — session `e86a1703`, 2026-08-17

**The ask:** *"I feel like home page is outdated not synced with existing completion of
languages can you check once ?"* → then *"Ok"* to the proposed fix set → then *"another
session freed please check the build"*.

## What the audit actually found

🔴 **`src/data/progress.js` was NOT the problem.** Every phase was compared against the
files on disk, per language, and it matched almost everywhere. **`src/pages/index.js` was
the stale file.**

⚠️ **The trap that nearly produced a false report.** Counting topic units on disk
(`direct .md files + subdirectories`) and diffing against `progress.js` throws false
positives, because **several phases deliberately merge syllabus topics into fewer pages**
and the phase `README.md` says so:

| Phase | Reads as | Actually |
|---|---|---|
| nginx 0 | 10 files vs 14 topics | *"The syllabus lists fourteen topics. Four pairs are merged"* |
| react 0 | 14 files vs 17 topics | *"17 topics … become 14 pages. Three pairs are merged"* |
| storybook 0 | 5 files vs 6 topics | *"6 syllabus topics · 5 pages"* |
| express, all | 86 units vs 115 topics | `pages` counts topics brought to standard, per the comment in `progress.js` |

**Always open the phase `README.md` before calling a count wrong.** A file count below the
topic count is usually correct and documented.

## What changed

**`src/pages/index.js`**

- **Hero rewritten.** "Just finished" still said *JavaScript* (closed 2026-08-15) after
  Docker & Podman closed 2026-08-16 and React Patterns closed 2026-08-17. Now leads with
  Docker + the patterns layer; the three compact `<Progress>` bars switched to
  `docker` / `react` / `javascript`.
- **`done: true` added to CSS, Git, Docker.** All three compute 100% and `docs/README.md`
  already called them COMPLETE, but the card rendered the *In progress* pill because the
  flag is set by hand (deliberately — see the comment above `LAYERS`).
- **Storybook promoted.** It was in the *Imported corpus* group with **no stats and no
  bar**, even though `progress.js` has a full Storybook entry and phases 0–3 are written
  to full depth. `index.js` never called `summarise('storybook')`. Now renders
  **58 topics · 11 phases · 4 explained · 23 pages, 40%**, and the layer note names it as
  the exception.
- ✅ **React marked `done: true` (`e56822f7`)** — the user confirmed the drop was theirs:
  *"yes i think for the react i guess i told to drop no issues"*. 🔴 **React phases 12
  (Data and state) and 13 (Routing) are DROPPED BY DECISION, not missing.** Do not
  "restore" them to `progress.js` as `parked` and do not treat their absence as a defect.
  Verified before flipping the flag: `grep -rn 'phase-12-data\|phase-13-routing\|
  react/pages/phase-1[23]' docs/` returns **nothing**, and the whole-site build reported
  **zero** broken links in `docs/react/`. `docs/README.md`'s React row went
  **Pending → ✅ COMPLETE**.

**`docs/README.md`** — six counts re-derived from disk: TypeScript **75→79** topics /
**127→137** files · CSS *"81 pages"* → **80 leaf / 97 files** · Docker **271→266** files ·
Nginx **41→42** files · Git **62→65** files and status **🔴 In progress → ✅ COMPLETE** ·
Real World **79→83** files.

## The build — rule 12 done properly

Registry row claimed and **committed** before the run, cleared and committed after,
artefacts deleted. Checked first that no node/docusaurus process was alive (10 GB free).

```
[SUCCESS] Generated static files in "build-home".
Elapsed (wall clock): 4:56.69      Maximum RSS: 7,752,276 KB (7.75 GB)
```

Isolated with `DOCUSAURUS_GENERATED_FILES_DIR_NAME=.docusaurus-home --out-dir build-home`.
**4 broken links, all in other sessions' mid-write files** — 3 in
`docs/real-world/pages/phase-7-css-recipes/`, 1 in
`docs/typescript/pages/phase-4-classes-declarations/14-mixins/README.md`. Left alone.

✅ Verified in the emitted `build-home/index.html` that the hero, the Complete pills and
the Storybook stats line actually rendered — not just that the build passed.

## Two live sessions were writing in this checkout the whole time

- **TypeScript** — bumped `progress.js` phase 10 `pages: 4 → 5` between two of my own
  measurements. Not staged, not touched.
- **Real World phase 7 · CSS recipes** — the directory has real content while
  `progress.js` still has that phase at `pages: 0`, so **the Real World card understates
  itself and will drift again the moment they finish.** Theirs to update.

⚠️ **This is why a shared-checkout audit must re-measure at the end**, not trust numbers
taken at the start of the turn.

## Method worth reusing

- Parse-check edited JSX without a build:
  `require('@babel/parser').parse(src, {sourceType:'module', plugins:['jsx']})` —
  `node_modules/.bin/esbuild` does **not** exist in this repo, but `@babel/parser` does.
- Render every card's numbers without a build:
  `node --input-type=module -e "import('./src/data/progress.js').then(m => …summarise(k))"`.

Related: [[feedback-simple-final-replies]] · [[progress-react-patterns-chunk-a]] ·
[[progress-search-chunk-b]] · [[session-build-devserver-registry]]
