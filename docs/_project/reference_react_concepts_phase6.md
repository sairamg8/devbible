---
name: devbible-react-concepts-phase6
description: React Phase 6 (Rendering performance and the React Compiler) — load-bearing claims per topic with primary sources
metadata:
  type: reference
---

Phase 6 = **17 topics, 18 files**, documentation-validated, no console blocks.
Progress: [[devbible-react-phase6]]. Phase 5: [[devbible-react-concepts-phase5]].

## Sources

react.dev `memo` · `useMemo` · `useCallback` · `<Profiler>` · `lazy` · `<Activity>` ·
`useDeferredValue` · React Compiler Introduction + Installation + Configuration ·
`eslint-plugin-react-hooks` · **React 19.2 release post** (1 Oct 2025) · npm for the
plugin version. Measured Compiler/bundle data is **Phase 0 · 07 and · 11**.

## The spine

**"Memoization is a performance optimization, not a guarantee."** Everything else
follows.

## Per topic

**01 Why did this re-render** — four causes; **`memo` addresses only one** (parent
re-rendered, with stable props). Documented: memoized components still re-render on
**own state** and on **context**. Signature for context-driven: re-rendered while the
parent did not, props identical. A custom hook calling `useContext` is cause 3 in
disguise (very common: `useAuth()` in a leaf). 🔴 **First profile question = how many
COMMITS per interaction**, because react.dev says most perf problems are effect
chains. **Counting re-renders is not a metric; milliseconds are.**

**02 `memo`** — *"completely useless if the props … are always different."*
Minimising prop changes, best→worst: **project to a value that changes less**
(`hasGroups` not `person`) > primitives > `useMemo` the object. ⚠️ Custom
`arePropsEqual`: **must compare every prop including functions** (else the handler
keeps a previous render's closure, silently) and **deep equality can freeze the app
for seconds**. Heuristic: **coarse vs granular** interactions.

**03 `useMemo`** — **three reasons, two are IDENTITY not cost**. Measurement method:
`console.time`, bar ≈ **1ms**. **Never helps the first render.** ⚠️ Cache discarded
on file edit in dev and **if the component suspends during initial mount**.
🔴 *"a single value that's 'always new' is enough to break memoization for an entire
component."*

**04 `useCallback`** — 🔴 **does NOT prevent creating the function**; buys
referential stability only. Debug recipe: log deps → **"Store as a global variable"**
→ `Object.is(temp1[i], temp2[i])`. Omitting the array returns a new fn every render,
silently. **One `memo` at the right boundary beats N `useCallback`s at the wrong one.**

**05 Measure** — 🔴 **`actualDuration` ÷ `baseDuration` is a memoization score**; the
only way to distinguish a working `memo` from a defeated one. `phase:
"nested-update"` = effect-chain fingerprint. `<Profiler>` **disabled in production
builds by default**. **Performance Tracks (19.2, Chrome DevTools)** add **priority and
blocking** — Scheduler ⚛ and Components ⚛ — which the React Profiler cannot show.

**06 The memoization trap** — memoization is a **chain**, broken silently. Fix is
**composition**, enforced by structure. **The Compiler automates the memoization
column, not the composition column.**

**07 Compiler v1.0** — stable. Automates (a) cascading re-renders (b) expensive
calculations. 🔴 Limits: **only components and hooks**, and **memoization is NOT
shared across components** — a shared expensive fn runs once per component. Not a
correctness tool.

**08 Installing** — 🔴 **must run FIRST** in the Babel pipeline; misconfiguration has
**no error**, tell is the missing **"Memo ✨" badge**. **`target: '17' | '18' | '19'`**;
below 19 needs **`react-compiler-runtime`** — so it does **not** require React 19.
Adoption: `compilationMode: 'annotation'`, `panicThreshold: 'none'`, `gating`,
`logger`.

**09 Bail-outs** — **silent and per-function**. 🔴 Asymmetry: **skips what it cannot
analyse, compiles rule-violating code it can** (Phase 0 measured a prop-mutating
component compiled into 4 slots, nothing reported). The linter's compiler rule names
are the clearest published list of what it must prove.

**10 `eslint-plugin-react-hooks`** — 🔴 **compiler diagnostics work WITHOUT adopting
the Compiler**; inverts the adoption order. **v6 shipped with 19.2; npm shows 7.1.1
now** — not a contradiction. `flat.recommended` vs experimental
`flat['recommended-latest']`.

**11 Still write `useMemo`?** — different answers for **existing** (leave it —
*"removing it can change compilation output"*, guarded by
`preserve-manual-memoization`) and **new** (rely on the Compiler) code. 🔴 The one
surviving hand-written case: **a value used as an effect dependency**, because that is
**correctness**, not performance.

**12 `lazy`** — 🔴 **inside a component it resets ALL state below**, because it
returns a new component *type*. Promise and value both cached. Rejected chunk →
**nearest error boundary** (post-deploy stale hash). Preload on intent
(`onMouseEnter` + **`onFocus`**) is a **community pattern on documented behaviour**.

**13 Moving state down / `children`** — 🔴 **why `children` works**: React skips a
child when the element is *identical*, and `children` from a non-re-rendering parent
**is** the same object. Decisive rows: structure **helps the first render**, and the
**Compiler does not automate it**. Only **2 of the 5** "make memoization unnecessary"
principles are about memoization.

**14 Virtualization** — ⚠️ **React ships none**; only citation is the `useMemo`
caveat calling it hypothetical future work. Costs: **find-in-page cannot be
restored**, `aria-setsize`/`aria-posinset` needed, scroll restoration with variable
heights is the main bug source. Try first: don't show 10,000 rows · server-side
filter · simplify the row · `content-visibility: auto`.

**15 Expensive initial mount** — the cost nothing else touches. 🔴 **`<Activity>`
(19.2)**: `hidden` = `display: none` + **effects unmounted** + updates deferred at
**lower priority**, **state and DOM preserved**. ⚠️ **DOM preserved means `<video>`
keeps playing** → pause in the **cleanup**. ⚠️ Pre-render **does not fetch from
effects**, only Suspense-activating sources.

**16 Bundle size** — 🔴 **dev vs prod ≈ 6×** (1,125,752 vs 194,799 bytes, Phase 0
measured); selected by `process.env.NODE_ENV`, detected by
`grep -c "Warning: " dist/…`. Tree-shaking fails on: namespace imports, CJS, missing
`"sideEffects": false`, barrel files. **One static import in a leaf ships to
everyone.**

**17 `useDeferredValue`** — deliberately short, taught in Phase 8. It **does not make
anything faster** — same work, lower priority. Needs `memo` to be worth anything.

## 🔴🔴 Build traps — the full-clean command is not optional

`rm -rf .docusaurus` **is not enough.** At this phase close the build reported **2
broken React links to files that existed**, and clearing `.docusaurus` alone did not
fix it. The rule-4 command is the real one:

```bash
rm -rf .docusaurus build node_modules/.cache && yarn build --out-dir build-react-p<N>
```

After the **full** clean: **0 React broken links**. Also: the Python link walker
passes on links Docusaurus rejects — **always run the build at phase close**.
