---
name: progress-redux-toolkit-validation-20260906
description: redux-toolkit VALIDATED IN FULL 2026-09-06 — 16 imported pages to 21 contract pages, ten doc-verified accuracy defects fixed, dashboard reads 100%. The RTK 1.x-vs-2.x defect class this exposed applies to every imported frontend track.
metadata:
  type: project
---

# redux-toolkit — validated in full (2026-09-06, session `3a6945a3`)

✅ **DONE. `yarn validate --queue --track redux-toolkit` reports 0 units pending.** Dashboard reads
**validated · 100% · 21 pages · 21 validated · 13/13 phases**, `--drift` clean, `yarn linkcheck
docs/redux-toolkit` 23 files / 0 problems, mdxcheck clean, nothing over the 300-line cap.

**Asked as:** *"verify the content and review the explanation and identify any missing topics"* →
*"fix the 8 confirmed defects"* → *"update the language as validated in dashboard"*, which turned into
*"full validation pass on all 16 first"* when the dashboard's own definition of `verified` made a
partial mark impossible to state honestly.

**Research is BANKED — [research_redux_toolkit_track.md](research_redux_toolkit_track.md). Do NOT
re-fetch.** Every load-bearing claim quoted verbatim with its URL.

| | |
|---|---|
| Pages | **16 → 21** · 2,046 → ~5,200 lines |
| Splits | 5, all on concept boundaries, all proven (lines and ★ both UP) |
| New chunks | 2 — RTK Query `queryFn`/transforms/infinite-queries, and optimistic/manual cache updates |
| Defects fixed | **10**, every one doc-verified |
| Commits | `40cb06fa` (the 8) … `dcbbad3b` (dashboard) |
| Version spine | `@reduxjs/toolkit` **2.12.0** · react-redux 9.3.0 · Reselect 5 · Immer 10 · redux-thunk 3 |

---

## 🔴 The defect class, and why it will repeat on every imported frontend track

**Every page was written against RTK 1.x and never re-dated.** The track had *no version pin anywhere* —
not one page named a version — so nothing on the page told a reader which era they were in, and three of
the most-quoted mechanics in the whole library had silently become wrong:

| Was taught | Actually true on 2.12.0 |
|---|---|
| `store.inject(slice)` | **No such API.** `rootReducer.inject(slice)` / `slice.injectInto(rootReducer)`, and it does **not** call `replaceReducer` |
| middleware `[thunk, immutableCheck, serializableCheck]` | `actionCreatorInvariant, immutableStateInvariant, thunk, serializableStateInvariant` — thunk is **third**, and one member was missing entirely |
| immutability check "deep-freezes" state | it deeply **compares**; the freezing people see is Immer's `autoFreeze`, a different mechanism |
| `createSelector` "cache size of 1" | Reselect 5 defaults to `weakMapMemoize`, effectively **unlimited** — this retired the whole selector-factory-per-component rationale |
| `fetchUser.abort()` | `abort()` is on the promise `dispatch()` returns |
| `extraReducers` object form "legacy" | **removed** in RTK 2.0 — an object there fails to build |
| `middleware: [array]` a silent footgun | RTK 2.0 requires a callback; now a compile error |
| `import thunk from 'redux-thunk'` | named export in 3.x |
| RTK Query list query "serves" a detail view once tags align | entries are keyed `(endpointName, serializedArg)`; **tags trigger refetching, never filling** |
| testing: mock the generated hooks; a real store is "OVERKILL" | 🔴 **inverts Redux's own guide** — *"Do not try to mock selector functions or the React-Redux hooks!"* and *"Prefer writing integration tests with everything working together"* |

🔴 **The last one is the most dangerous kind of defect in this corpus**, and no existing check would ever
find it: the page was internally coherent, well written, and confidently recommending the opposite of the
primary source. Only reading the page *against* the doc catches that.

🔴 **Apply this to the sibling imported tracks.** tanstack-query, framer-motion, vite, webpack, babel,
playwright, eslint-oxlint, web-vitals-performance and frontend-architecture came from the same
2026-08-14 import with the same properties (0 pins, 0 badges, 0 Verified lines). framer-motion's 13
wrong imports were already proven. **Assume each one teaches a superseded major and check the three
highest-traffic mechanics first** — that is where the RTK defects clustered.

## What "to contract" cost per page

Roughly **+120 lines**: tier badge, a `> Verified:` line naming the sources with the pin **bolded**, a
`> Validated:` stamp, the `## 4. Senior Engineer Edge Cases & Pitfalls` section converted to `## Gotchas`
in Symptom/Cause/Fix form and *exhausted* (6–8 per page, up from 3), a `## Interview questions` section
(5–8, `★` on the frequently-asked), and a footer. Five pages crossed 300 doing it and were split.

⚠️ **A tail-replacement patch can silently delete a fix you already made.** Rewriting from
`## 4. Senior Engineer…` to end-of-file removed the `fetchUser.abort()` correction committed hours
earlier, because that correction lived inside the pitfalls section. Caught by grepping for the fix's own
text before committing. **After any whole-section replacement, grep for the earlier fixes.**

## Tiers assigned (5 Master of 21 = 24%)

Master: `configureStore` · `createSlice` · `createAsyncThunk` · RTK Query · React-Redux hooks.
Know: DevTools, migration. When Needed: code splitting. Everything else Understand.

## Still open — NOT defects, deliberately not done

- **`useSelector`'s internals are not documented.** The page claimed it "calls `store.subscribe()`
  directly, bypassing React Context entirely". The react-redux hooks page does not say that, so the claim
  was **withdrawn** rather than restated, with an explicit note on the page. If a primary source is ever
  found for `useSyncExternalStore` usage, that section can be strengthened.
- **Immer publishes no verbatim error string** for mutate-and-return. The page used to quote one; it now
  describes the failure instead.
- **`builder.infiniteQuery`'s introducing version is not stated in the docs** — asserted nowhere.
- The **missing-topics list** the user asked for early on was superseded: everything actionable from it
  was written into the track during this pass.

## Housekeeping observed, not touched

`static/currency.json` carries **578 uncommitted insertions** from another lane's currency sweep
(mtime 16:12, 2026-09-06) — deliberately never staged. The angular lane was writing files over the
300-line cap throughout this session; also left alone.
