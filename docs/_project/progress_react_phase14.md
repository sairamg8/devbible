---
name: devbible-react-phase14
description: React Part B — Phase 14 "Testing React" is COMPLETE (14/14, merged into main). What was written, the sources used, and the traps found.
metadata:
  type: project
---

:::danger CONSOLIDATED 2026-08-15 — THE WORKTREE IN THIS FILE NO LONGER EXISTS
Every devbible worktree and branch was **merged into `main` and DELETED** on 2026-08-15
(*"commit every uncommitted branch to main and delete everything"*). **All the content
described below is on `main`** at `/run/media/sairam/Storage/Backup/Knowledge/devbible`
— nothing was lost, every branch was verified at 0 unique commits first. Ignore any
"worktree", "branch", "not merged" or "merge at the phase close" instruction below and
**work on `main`**. `main` builds 0 warnings / 0 broken links, so a break there is yours.
Full record: `progress_worktree_consolidation_20260815.md`.
:::

# ✅ REACT PART B — Phase 14 · Testing React is COMPLETE

**Session `05921047`, 2026-08-14.** Started on *"pick react b"*, finished autonomously
overnight on the user's instruction (*"complete the assigned task … do not wait for me …
take recommended action to finish the job"*).

## Final state — done and merged

| | |
|---|---|
| Topics | **14 of 14** |
| Files | **28 markdown** (21 leaf pages + 7 index READMEs) + 7 `_category_.json` |
| Lines | **4,986** |
| Over the 300-line cap | **0** — longest file 285 |
| Build | ✅ clean isolated build, **0 broken links in `docs/react/`** (6 remain in `javascript` and `typescript`, other sessions', left alone) |
| Branch | `react-phase-14` in worktree `devbible-react-p14` — ✅ **MERGED into `main`** (fast-forward, `f7691753`) |
| Boards | ✅ all four mark the phase complete; `pagesPlanned` dropped from the `progress.js` row |

**Shape:** the six Master topics (01–06) are chunked directories of 2–3 chunks each; the
five Understand (07–11) and three Know (12–14) topics are single files of 176–251 lines.
Every page carries a tier badge, a `> Verified:` line naming the docs it was validated
against, Gotchas in symptom/cause/fix form, and Interview questions. **No sandbox, no
console blocks** — rule 8 throughout.

⚠️ **React Part A finished in parallel** (Phase 11, 17/17) and is also on `main`. React is
now phases 0–11 + 14, **255 leaf pages**.

## Traps found, worth keeping

🔴 **Every chunked topic broke its inbound links.** Converting `NN-name.md` to `NN-name/`
orphaned 4–8 links each time, in sibling page bodies and footers as well as the phase
README. Automated with `close-topic.py` (see below).

🔴 **`git commit --only <paths>` silently skips untracked files.** It committed 5 of 6
files that way once — `git add` first.

🔴 **The isolated build failed on a file belonging to Part A**, not mine. The right move was
**not** to fix it (their directory) but to merge `main`, which already carried their fix.
A build failure in a shared corpus is a merge question before it is a debugging question.

🔴 **The merge conflicted in exactly the three predicted board files** — `docs/README.md`,
`docs/react/pages/README.md`, `src/data/progress.js` — and each was resolved by keeping
**both** sides' rows. Nothing else conflicted, because the two parts' page directories are
disjoint.

⚠️ **Cite only pages actually fetched.** Topic 12 was first written citing the Jest snapshot
page from memory; fetching it confirmed most claims but not the "--ci reports obsolete
snapshots" one, which was replaced with the documented behaviour.

**Tooling:** `close-topic.py` (session scratchpad) repoints inbound links after a directory
conversion, updates all six board spots with asserted regex replaces, checks the 300-line
cap, and stages the paths. Worth recreating for any phase written this way.

## Committed state

| | |
|---|---|
| Where | worktree `devbible-react-p14`, branch `react-phase-14` (see above) |
| Topics done | **12 of 14** — 01–12 |
| Files | **28** — phase README + `_category_.json`, then 6 Master topic dirs (README + chunks + `_category_.json` each) and 6 single-file Understand/Know topics |
| Lines | topic 01 **717** · 02 **551** · 03 **574** · 04 **472** · 05 **~470** · 06 **469** · 07 **204** · 08 **251** · 09 **213** · 10 **209** · 11 **189** · 12 **176** |
| Over the 300 cap | **0** — longest is 285 |
| Boards | ✅ all four at **12/14** after every topic (`progress.js` slug-anchored, phase README, `docs/react/pages/README.md` two rows, `docs/README.md` two rows) |
| Build | ⚠️ **still not run.** `node_modules` is installed in the worktree; run the isolated build at the phase close |

🔴 **Every topic so far chunked into a directory, and each conversion broke inbound links**
— 4 for topic 02, 6 for topic 03, 5 for topic 04, all from sibling pages and the phase
README that link `NN-name.md`. **Before creating a topic directory, `grep -rln
"NN-name\.md" --include=*.md .` from `docs/react/pages` and repoint every hit** to
`NN-name/README.md`. Bodies as well as footers; the phase README always has one.

🔴 **A file went missing from disk mid-session (on `main`, before the worktree):**
`02-the-rtl-model/_category_.json` disappeared between being written and committed during
other sessions' commit churn. Restored in `fd3ae85`. **Check `git ls-files` on the phase
directory after each commit** — a missing `_category_.json` is silent and only shows as a
wrong sidebar label.

⚠️ `git commit --only <paths>` **skips a file that is still untracked** — it silently
committed 5 of 6 files that way once. `git add` the new file first, or use `git add` +
plain `git commit` now that the worktree is not shared with other sessions.

Directory: `docs/react/pages/phase-14-correctness/` in the worktree.

| # | Topic | Tier | File | State |
|---|---|---|---|---|
| 01 | What to test, and what not to | Master | `01-what-to-test/` (3 chunks) | ✅ **done** — 238 / 217 / 207 lines |
| 02 | RTL's model | Master | `02-the-rtl-model/` (2 chunks) | ✅ **done** — 246 / 250 lines |
| 03 | The query families | Master | `03-the-query-families/` (2 chunks) | ✅ **done** — 285 / 237 lines |
| 04 | `user-event` over `fireEvent` | Master | `04-user-event-over-fireevent/` (2 chunks) | ✅ **done** — 208 / 211 lines |
| 05 | Async testing and `act()` | Master | `05-async-testing-and-act/` (2 chunks) | ✅ **done** — 204 / 213 lines |
| 06 | Mocking the API with MSW | Master | `06-mocking-the-api/` (2 chunks) | ✅ **done** — 184 / 232 lines |
| 07 | Jest or Vitest | Understand | `07-jest-or-vitest.md` | ✅ **done** — 204 lines |
| 08 | Testing forms and Actions | Understand | `08-testing-forms-and-actions.md` | ✅ **done** — 251 lines |
| 09 | Testing hooks | Understand | `09-testing-hooks.md` | ✅ **done** — 213 lines |
| 10 | Wrappers — context, providers, router | Understand | `10-wrappers-and-providers.md` | ✅ **done** — 209 lines |
| 11 | Roles are the query surface | Understand | `11-roles-as-the-query-surface.md` | ✅ **done** — 189 lines |
| 12 | Snapshot tests | Know | `12-snapshot-tests.md` | ✅ **done** — 176 lines |
| 13 | Testing Server Components | Know | `13-testing-server-components.md` | ⬜ |
| 14 | Flaky tests, fake timers and CI | Know | `14-flaky-tests-and-ci.md` | ⬜ |

⚠️ **The phase README already links every one of those filenames.** Forward links to
files that do not exist yet warn at build time and resolve themselves as the files land —
this is the documented mid-phase forward-link behaviour, **not** the rule-1 slug bug. Do
not "fix" the link form. If a topic chunks, `grep -rn "NN-name.md" --include=*.md .` from
`docs/react/pages` **before** creating the directory and repoint every hit (bodies as well
as footers).

## Sources fetched so far — do not re-fetch

- **testing-library.com/docs/guiding-principles** — *"The more your tests resemble the way
  your software is used, the more confidence they can give you."* Plus the three
  principles: DOM nodes not instances; utilities that encourage using components as
  intended; simple and flexible APIs.
- **testing-library.com/docs/react-testing-library/intro** — *"a very light-weight solution
  for testing React components"*, *"light utility functions on top of `react-dom` and
  `react-dom/test-utils`"*, the accessibility paragraph, and that it is **not** a test
  runner or framework and does **not** deal with instances of rendered React components.
- **testing-library.com/docs/react-testing-library/faq** — **no shallow rendering** and the
  reason; mocking a module with `jest.mock` as the replacement; the snapshot-diff
  `cloneNode(true)` caveat (**the DOM is mutable, so snapshot-diff will not see changes
  unless you clone first**); and why Enzyme is rejected (shallow rendering, constructor
  selection, instance/state access).
- **testing-library.com/docs/queries/about** — the full 6-row query-type table (0 / 1 / >1
  matches, retry column) and the **priority order** with each rationale: `getByRole`
  (*"can be used to query every element that is exposed in the accessibility tree"*),
  `getByLabelText`, `getByPlaceholderText` (*"a placeholder is not a substitute for a
  label"*), `getByText`, `getByDisplayValue` → `getByAltText`, `getByTitle` (*"not
  consistently read by screenreaders, and is not visible by default"*) → `getByTestId`
  (*"the user cannot see (or hear) these"*). Plus `screen` pre-bound to `document.body`,
  TextMatch (string / regex / function) and whitespace normalisation.
- **kentcdodds.com/blog/testing-implementation-details** (17 Aug 2020) — *"Implementation
  details are things which users of your code will not typically use, see, or even know
  about."*, the false-negative-on-refactor / false-positive-when-broken pair, and the two
  users (end user via the DOM, developer user via props). ⚠️ **Cite it as the RTL author's
  rationale, a blog post — not as reference documentation.**

- **testing-library.com/docs/react-testing-library/api** — `render` creates a **`div`
  appended to `document.body`**; options `container` (**not appended automatically**),
  `baseElement` (defaults to container, else `document.body`), `hydrate`, `wrapper`,
  `queries`, `reactStrictMode`, `legacyRoot` (React ≤18 only); the return value
  (`...queries`, `container`, `baseElement`, `debug`, `rerender`, `unmount`,
  `asFragment`); `rerender`'s own caveat *"It'd probably be better if you test the
  component that's doing the prop updating"*; `cleanup` — *"called automatically if your
  testing framework … injects a global `afterEach()`"*; `act` re-exported from RTL; and
  `renderHook` (`initialProps`, `wrapper`, `result.current`, `rerender`, `unmount`) with
  🔴 *"You should prefer `render` since a custom test component results in more readable
  and robust tests since the thing you want to test is not hidden behind an abstraction."*
  — **that quote is the spine of topic 09.**
- **testing-library.com/docs/react-testing-library/setup** — the `AllTheProviders` +
  `customRender` pattern, `export * from '@testing-library/react'` then
  `export {customRender as render}`, automatic cleanup wording, and the custom-queries
  caution (*"Generally you should not need to create custom queries…"*).

**Still to fetch:** `user-event` v14 intro + setup + the pointer/keyboard API (topic 04);
dom-testing-library async API — `waitFor`, `waitForElementToBeRemoved`, `findBy` timeouts
(topic 05); react.dev [`act`](https://react.dev/reference/react/act) (topic 05); MSW 2.x
docs — `http`/`HttpResponse`, `setupServer`, `onUnhandledRequest` (topic 06); Vitest and
Jest docs (topic 07); RTL `renderHook` and the `wrapper` option (topics 09, 10);
`jest.useFakeTimers` + `user-event`'s `advanceTimers` (topic 14).

## Chunking decisions

| Topic | Shape | Why |
|---|---|---|
| 01 | **3 chunks** — implementation details / what earns a test / the cases worth writing | Diagnosis, procedure, worked output. One file would have forced all three shorter than they deserve |
| 02 | **2 chunks** — `render`/`screen`/the document / what RTL refuses + where jsdom stops | The API you use daily vs the boundary of the tool and the environment. They fail differently |

## Traps carried in from Part A / earlier React sessions

- 🔴 **`src/data/progress.js` edits MUST be anchored on the row's `slug`.** The numeric
  fields are not unique — a first-match replace on `topics: 14, pages: N` can hit
  **JavaScript's** rows, which sit earlier in the file. This caused a real regression
  already (3 commits).
- **Shared checkout, many live sessions: never `git add -A`.** Stage
  `docs/react/pages/phase-14-correctness/`, `src/data/progress.js`,
  `docs/react/pages/README.md`, `docs/README.md` — nothing else.
- **`docs/README.md` has ONE shared React row** that Part A also edits. Re-read it
  immediately before editing and preserve their half.
- 🔴 **`git add <paths>` + `git commit` sweeps up whatever ANOTHER session already
  staged.** It happened on the first topic-01 commit — Part A had a `phase-11` rename in
  the index and it rode along in `d459da1`; then Part A's `6030a1f` swept my working-tree
  edit to `docs/react/pages/README.md` in return. Harmless both times, but **use
  `git commit --only <paths> -F -`**, which commits exactly those paths regardless of the
  shared index.
- **Commit with `git commit -F -` and a quoted heredoc** — backticks in `-m` are
  command-substituted by bash and silently delete the word.
- **Build in isolation:** `yarn build --out-dir build-react-p14`, and do **not**
  `rm -rf .docusaurus` while Part A may be building. Tally warnings by language; React must
  be 0, other languages' warnings are theirs.

## The per-file loop

Write a file → update the four UI places (only after a *topic* completes) → commit →
update this memory → start the next file **in the same turn**. Do not stop to report.

Related: [[devbible-react-split-parts-ab]] · [[devbible-react-phase7]] ·
[[devbible-react-syllabus]] · [[devbible-never-compress-to-fit-cap]] ·
[[devbible-feedback-ui-progress-and-build-cadence]]
