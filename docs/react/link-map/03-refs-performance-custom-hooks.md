---
title: "Link map · React · Part 3 (phases 5–6–7)"
sidebar_label: "03 · refs performance custom hooks"
sidebar_position: 3
---

# Link map · React · Part 3 (phases 5–6–7)

Covers every topic row of `docs/react/syllabus/02-hooks.md` in phase 5 (T05-01 to T05-16, refs, context and reducers), phase 6 (T06-01 to T06-17, rendering performance and the React Compiler) and phase 7 (T07-01 to T07-12, custom hooks and the Rules of React). That is 45 rows, and all 45 have a written page of ours.
*read* = I read the passage that supports the claim; *headings only* = fetched, headings, size and keywords checked, passage not read. Third-party links carry a date only where the page shows one. No `#anchors` are given. Every URL was re-fetched on 2026-10-13 and returned 200 at its canonical address. Blocks with no Beyond-the-docs line had no good non-official page found; the verification pass could not run further web searches, so picks added or swapped in it came from fetching known canonical URLs directly.

🔴 **Version note.** Our syllabus targets **React 19.2.8** (`docs/react/README.md`), the React Compiler at **1.0**, and `eslint-plugin-react-hooks` v7. react.dev on 2026-10-13 shows **React 19.3** in its version switcher, so the official pages may be a minor version ahead of our pin. Many of the best third-party explanations are older than React 19 and say so below: Dan Abramov's posts (2018 to 2021) and Kent C. Dodds's posts (2019 to 2021) predate `ref` as a prop, context rendered directly as a provider, ref cleanup functions, `use`, `useEffectEvent`, `Activity` and the Compiler. The mechanisms they explain (call order, shallow comparison, reference identity) have not changed. The web.dev virtualization article is from 2019 and covers react-window only.

---

## Phase 5 — Refs, context and reducers

### T05-01 · `useRef` — Master · ✅ written `docs/react/pages/phase-5-refs-context-reducers/01-useref.md`
- **Read this:** [useRef](https://react.dev/reference/react/useRef) · react.dev · the reference page: a ref holds a value that is not needed for rendering, and changing it does not trigger a re-render (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Referencing Values with Refs](https://react.dev/learn/referencing-values-with-refs) · react.dev · the learn page, with a "Best practices for refs" section: treat refs as an escape hatch, use them for values that do not impact the rendering logic (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Don't Misuse useRef in React](https://dev.to/a1guy/dont-misuse-useref-in-react-the-practical-guide-you-actually-need-5aj6) · Ali Aslam (a1guy), DEV Community, 2025-08-17 · calls it a little mutable box kept between renders, and builds a mental model for when to reach for it, which is the instance-variable half the reference page states briefly · fetched 2026-10-13 (*read*)
- **Our delta:** the two legitimate uses side by side, and where the reference page stops.

### T05-02 · DOM refs — Master · ✅ written `docs/react/pages/phase-5-refs-context-reducers/02-dom-refs/01-attaching-and-using.md`
- **Read this:** [Manipulating the DOM with Refs](https://react.dev/learn/manipulating-the-dom-with-refs) · react.dev · attaching a ref, focusing, scrolling, measuring, and when React lets you touch the DOM; `myRef.current` is `null` until React puts the node there (*read*) · covers our angle: **partial** — the non-React widget integration case is thin · fetched 2026-10-13
- **Also good:** [useRef](https://react.dev/reference/react/useRef) · react.dev · the reference page: changing `ref.current` does not re-render the component (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Avoiding useEffect with callback refs](https://tkdodo.eu/blog/avoiding-use-effect-with-callback-refs) · Dominik Dorfmeister (TkDodo), 2022-08-14 (last update 2024-12-08) · shows focusing an input after render through an effect and then a callback ref as the alternative; leans on callback refs, which is the T05-06 topic (*read*) · fetched 2026-10-13
- **Our delta:** why `.current` is `null` during render, plus the widget-integration recipe.

### T05-03 · `useReducer` — Master · ✅ written `docs/react/pages/phase-5-refs-context-reducers/03-usereducer.md`
- **Read this:** [Extracting State Logic into a Reducer](https://react.dev/learn/extracting-state-logic-into-a-reducer) · react.dev · the step-by-step conversion from `useState` to a reducer, with a testing note that a reducer is a pure function independent of the component (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [useReducer](https://react.dev/reference/react/useReducer) · react.dev · the reference page: signature, `dispatch`, and the note that `dispatch` has a stable identity (*read*) · fetched 2026-10-13
- **Beyond the docs:** [useState vs useReducer](https://tkdodo.eu/use-state-vs-use-reducer) · Dominik Dorfmeister (TkDodo), 2021-09-26 (last update 2022-04-23) · the reducer as event-driven: the UI dispatches events and the transition logic lives in the reducer, with a multi-step wizard as the example (*read*) · fetched 2026-10-13
- **Our delta:** the testability argument: a pure reducer needs no component to test.

### T05-04 · `createContext` and `useContext` — Master · ✅ written `docs/react/pages/phase-5-refs-context-reducers/04-createcontext-usecontext.md`
- **Read this:** [useContext](https://react.dev/reference/react/useContext) · react.dev · reading a context and the provider/consumer model, with a section on optimizing re-renders when passing objects and functions (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [createContext](https://react.dev/reference/react/createContext) · react.dev · the context object, the default value, and the provider (*read*) · [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context) · react.dev · the learn page (*read*) · fetched 2026-10-13
- **Beyond the docs:** [How to use React Context effectively](https://kentcdodds.com/blog/how-to-use-react-context-effectively) · Kent C. Dodds, 2021-06-05 · builds a provider and a consumer hook from scratch around a reducer, and says an app should have multiple logically separated contexts; written before React 19, so it uses the explicit Provider element · fetched 2026-10-13 (*read*)
- **Our delta:** `<Context>` used directly as a provider in React 19.

### T05-05 · The context re-render problem — Master · ✅ written `docs/react/pages/phase-5-refs-context-reducers/05-context-re-render-problem.md`
- **Read this:** [useContext](https://react.dev/reference/react/useContext) · react.dev · the section on optimizing re-renders when passing objects and functions through a provider (*read*) · covers our angle: **partial** — does not say outright that `useContext` has no selector · fetched 2026-10-13
- **Also good:** [A (Mostly) Complete Guide to React Rendering Behavior](https://blog.isquaredsoftware.com/2020/05/blogged-answers-a-mostly-complete-guide-to-react-rendering-behavior/) · Mark Erikson, 2020-05-17 · has a "Context and Rendering Behavior" section with a "Context Updates and Render Optimizations" example next to the general rules of what re-renders; written for React 16 to 18, before the Compiler (*read*) · fetched 2026-10-13
- **Beyond the docs:** [How to write performant React apps with Context](https://www.developerway.com/posts/how-to-write-performant-react-apps-with-context) · Nadia Makarevich, Developer Way, 2022-02-07 · starts from a form that re-renders everything through one provider, then splits state from the API and splits the state further so consumers stop re-rendering; written before React 19 and the Compiler (*read*) · covers our angle: **partial** — the splitting fixes, not a statement that there is no selector · fetched 2026-10-13
- **Our delta:** the four fixes in order, and why there is no selector.

### T05-06 · Ref callbacks — Understand · ✅ written `docs/react/pages/phase-5-refs-context-reducers/06-ref-callbacks.md`
- **Read this:** [Common components (ref callback)](https://react.dev/reference/react-dom/components/common) · react.dev · React calls the callback with the node, and calls the cleanup function the callback returns when the node is removed; an inline callback is a new function every render, so React cleans up and re-creates it (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [React v19](https://react.dev/blog/2024/12/05/react-19) · react.dev · the release post that introduced cleanup functions for refs; React no longer calls the ref with `null` on unmount when a cleanup is returned (*read*) · [So you think you know everything about React refs](https://dev.to/thoughtspile/so-you-think-you-know-everything-about-react-refs-48h2) · Vladimir Klepov (thoughtspile), DEV Community, 2021-05-18 (first published 2021-05-17 on his own blog) · refs are set to the node on mount and to `null` on removal, and a changed key unsets then re-sets the ref; predates the React 19 cleanup form (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Ref Callbacks, React 19 and the Compiler](https://tkdodo.eu/blog/ref-callbacks-react-19-and-the-compiler) · Dominik Dorfmeister (TkDodo), 2024-12-08 · covers the React 19 cleanup function directly, works a measuring example, and gives rules of thumb for a ref callback versus `useEffect`; written for React 19, which the older refs posts are not (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Our delta:** the cleanup return value replacing the call with `null`.

### T05-07 · `useImperativeHandle` — Understand · ✅ written `docs/react/pages/phase-5-refs-context-reducers/07-useimperativehandle.md`
- **Read this:** [useImperativeHandle](https://react.dev/reference/react/useImperativeHandle) · react.dev · exposing a custom object through a ref instead of the raw node, with a note that props such as an open flag are usually better than an imperative handle (*read*) · covers our angle: **partial** — does not separate the library case from the application case · fetched 2026-10-13
- **Our delta:** when a library needs it and an application does not.

### T05-08 · When a ref is the wrong tool — Understand · ✅ written `docs/react/pages/phase-5-refs-context-reducers/08-when-a-ref-is-wrong.md`
- **Read this:** [Referencing Values with Refs](https://react.dev/learn/referencing-values-with-refs) · react.dev · if a value does not affect rendering choose a ref, otherwise state; refs are an escape hatch (*read*) · covers our angle: **partial** — no "it works but the UI is stale" bug walk-through · fetched 2026-10-13
- **Beyond the docs:** [Don't Misuse useRef in React](https://dev.to/a1guy/dont-misuse-useref-in-react-the-practical-guide-you-actually-need-5aj6) · a1guy, DEV Community, 2025-08-17 · a whole article on misuse: mutating the box does not tell React to re-render (*read*) · fetched 2026-10-13
- **Our delta:** the stale-UI symptom and its fix.

### T05-09 · `useState` vs `useReducer` — Understand · ✅ written `docs/react/pages/phase-5-refs-context-reducers/09-usestate-vs-usereducer.md`
- **Read this:** [Extracting State Logic into a Reducer](https://react.dev/learn/extracting-state-logic-into-a-reducer) · react.dev · has a "Comparing useState and useReducer" section: code size, readability, debugging, testing (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Should I useState or useReducer?](https://kentcdodds.com/blog/should-i-usestate-or-usereducer) · Kent C. Dodds, 2020-03-09 · opens on why there are two ways to do the same thing and which trade-offs decide between them, then works one example for each; I read the opening and the start of the examples (*read*) · fetched 2026-10-13
- **Beyond the docs:** [useState vs useReducer](https://tkdodo.eu/use-state-vs-use-reducer) · Dominik Dorfmeister (TkDodo), 2021-09-26 (last update 2022-04-23) · reducers shine when several parts of state update from different actions, as in a wizard where step two depends on step one (*read*) · fetched 2026-10-13
- **Our delta:** the decision rule as a count of pieces of state and of places that update them.

### T05-10 · Reducer patterns — Understand · ✅ written `docs/react/pages/phase-5-refs-context-reducers/10-reducer-patterns.md`
- **Read this:** [useReducer](https://react.dev/reference/react/useReducer) · react.dev · the lazy `init` argument and the stability of `dispatch` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [The bullet proof useReducer, Typescript (2/2)](https://dev.to/pffigueiredo/the-bullet-proof-usereducer-typescript-22-2kcj) · Pedro Figueiredo, DEV Community, 2022-04-06 · types the states as a discriminated union on a `status` property so TypeScript narrows them; says nothing on the lazy `init` argument or `dispatch` stability (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Our delta:** `dispatch` never being a dependency.

### T05-11 · What context is and is not — Understand · ✅ written `docs/react/pages/phase-5-refs-context-reducers/11-what-context-is-and-is-not.md`
- **Read this:** [Why React Context is Not a "State Management" Tool](https://blog.isquaredsoftware.com/2021/01/context-redux-differences/) · Mark Erikson, 2021-01-18 · Context is a form of dependency injection, a transport mechanism that does not manage anything; the state management is your own `useState` or `useReducer` (*read*) · covers our angle: **full** on the "not a state manager" half; the Redux comparison is not ours · fetched 2026-10-13
- **Also good:** [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context) · react.dev · the use cases the docs name: the current theme, the logged-in user (*read*) · fetched 2026-10-13
- **Our delta:** the right-shape list: theming, locale, auth identity, current user.

### T05-12 · Context plus reducer — Understand · ✅ written `docs/react/pages/phase-5-refs-context-reducers/12-context-plus-reducer.md`
- **Read this:** [Scaling Up with Reducer and Context](https://react.dev/learn/scaling-up-with-reducer-and-context) · react.dev · two separate contexts, one for the current tasks and one for the dispatch function (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [How to use React Context effectively](https://kentcdodds.com/blog/how-to-use-react-context-effectively) · Kent C. Dodds, 2021-06-05 · the same reducer-plus-provider shape, but with state and dispatch in one value object and a code comment that you might need to memoize it, so it does not show the split (*read*) · fetched 2026-10-13
- **Beyond the docs:** [How to write performant React apps with Context](https://www.developerway.com/posts/how-to-write-performant-react-apps-with-context) · Nadia Makarevich, Developer Way, 2022-02-07 · splits one provider into a state context and an API context, makes the API stable, and then moves the state to `useReducer` with the API calling `dispatch`, with render logs showing which consumers stop re-rendering; written before React 19 (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Our delta:** why the split keeps dispatch-only components from re-rendering.

### T05-13 · The default context value — Understand · ✅ written `docs/react/pages/phase-5-refs-context-reducers/13-default-context-value.md`
- **Read this:** [createContext](https://react.dev/reference/react/createContext) · react.dev · the default value is used only when there is no matching provider above, and is a last-resort fallback (*read*) · covers our angle: **partial** — no guard hook · fetched 2026-10-13
- **Beyond the docs:** [How to use React Context effectively](https://kentcdodds.com/blog/how-to-use-react-context-effectively) · Kent C. Dodds, 2021-06-05 · creates the context with no initial value and has the `useCount` hook throw "must be used within a CountProvider" when the value is undefined (*read*) · fetched 2026-10-13
- **Our delta:** the missing-provider bug a default value silently hides.

### T05-14 · `useId` — Understand · ✅ written `docs/react/pages/phase-5-refs-context-reducers/14-useid.md`
- **Read this:** [useId](https://react.dev/reference/react/useId) · react.dev · ids for accessibility attributes, and not for list keys (*headings only*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [The Definitive React 19 useId Guide](https://dev.to/a1guy/the-definitive-react-19-useid-guide-patterns-pitfalls-and-pro-tips-40ia) · Ali Aslam (a1guy), DEV Community, 2025-08-18 · shows duplicate ids when the same form is rendered twice, and why a random id mismatches between server and client at hydration; its `:r0:` examples predate the 19.2 prefix change (*read*) · fetched 2026-10-13
- **Our delta:** the changed generated prefix in 19.2.

### T05-15 · `useSyncExternalStore` — Understand · ✅ written `docs/react/pages/phase-5-refs-context-reducers/15-usesyncexternalstore.md`
- **Read this:** [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore) · react.dev · `subscribe`, `getSnapshot`, `getServerSnapshot` and the "result of getSnapshot should be cached" troubleshooting entry (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [useSyncExternalStore: Demystified](https://www.epicreact.dev/use-sync-external-store-demystified-for-practical-react-development-w5ac0) · Epic React (Kent C. Dodds), 2025-05-28 · starts from the tearing problem and then explains each argument of the hook (*read*) · fetched 2026-10-13
- **Our delta:** the "getSnapshot should be cached" error, and tearing's link to Phase 8.

### T05-16 · `useDebugValue` — When Needed · ✅ written `docs/react/pages/phase-5-refs-context-reducers/16-usedebugvalue.md`
- **Read this:** [useDebugValue](https://react.dev/reference/react/useDebugValue) · react.dev · adds a label to a custom hook in React DevTools, with an optional format function (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Our delta:** none needed; the official page is enough.

---

## Phase 6 — Rendering performance and the React Compiler

### T06-01 · Why did this component re-render? — Master · ✅ written `docs/react/pages/phase-6-performance/01-why-did-this-re-render.md`
- **Read this:** [Why React Re-Renders](https://www.joshwcomeau.com/react/why-react-re-renders/) · Josh W. Comeau, 2022-08-16 (updated 2025-12-03) · every re-render starts with a state change, then the parent-renders-children rule, pure components, context, and profiling with the DevTools (*read*) · covers our angle: **partial** — frames the trigger as state only; our page gives four causes · fetched 2026-10-13
- **Also good:** [Render and Commit](https://react.dev/learn/render-and-commit) · react.dev · what a render is and when React does one: the initial render, or a state update in the component or an ancestor (*read*) · [React Developer Tools](https://react.dev/learn/react-developer-tools) · react.dev · the DevTools install page (*read*) · fetched 2026-10-13
- **Beyond the docs:** [A (Mostly) Complete Guide to React Rendering Behavior](https://blog.isquaredsoftware.com/2020/05/blogged-answers-a-mostly-complete-guide-to-react-rendering-behavior/) · Mark Erikson, 2020-05-17 · a long reference on rendering, with context and React-Redux effects; written before React 18 and the Compiler (*read*) · fetched 2026-10-13
- **Our delta:** telling the four causes apart in DevTools instead of guessing.

### T06-02 · `memo` — Master · ✅ written `docs/react/pages/phase-6-performance/02-memo.md`
- **Read this:** [memo](https://react.dev/reference/react/memo) · react.dev · skipping re-renders when props are unchanged, the comparator argument, and minimizing prop changes; a note says the Compiler applies the equivalent automatically (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Why React Re-Renders](https://www.joshwcomeau.com/react/why-react-re-renders/) · Josh W. Comeau, 2022-08-16 (updated 2025-12-03) · has a "Creating pure components" section that works through `memo` in the context of the re-render rule (*headings only*) · fetched 2026-10-13
- **Our delta:** the fresh object, array or arrow function that makes `memo` do nothing.

### T06-03 · `useMemo` — Master · ✅ written `docs/react/pages/phase-6-performance/03-usememo.md`
- **Read this:** [useMemo](https://react.dev/reference/react/useMemo) · react.dev · caching a calculation between re-renders; a note says the Compiler memoizes values and functions automatically (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Understanding useMemo and useCallback](https://www.joshwcomeau.com/react/usememo-and-usecallback/) · Josh W. Comeau, 2022-08-30 (updated 2025-12-03) · splits the topic into "Heavy computations" and "Preserved references", which are the two reasons our row names (*read*) · fetched 2026-10-13
- **Our delta:** the two reasons kept apart, then the Compiler's effect on both.

### T06-04 · `useCallback` — Master · ✅ written `docs/react/pages/phase-6-performance/04-usecallback.md`
- **Read this:** [useCallback](https://react.dev/reference/react/useCallback) · react.dev · caching a function definition between re-renders (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [How to useMemo and useCallback: you can remove most of them](https://www.developerway.com/posts/how-to-use-memo-use-callback) · Nadia Makarevich, Developer Way, 2022-06-13 · memoizing props to prevent re-renders only works if every prop and the component are memoized, which is the honest test for a given `useCallback`; pre-Compiler (*read*) · fetched 2026-10-13
- **Beyond the docs:** [When to useMemo and useCallback](https://kentcdodds.com/blog/usememo-and-usecallback) · Kent C. Dodds, 2019-06-04 · works through a candy-dispenser example and argues that every line of code executed has a cost, so a memoization that saves almost nothing is not worth the complexity; pre-Compiler (*read*) · fetched 2026-10-13
- **Our delta:** the test for whether a given `useCallback` does anything.

### T06-05 · Measure before you optimise — Understand · ✅ written `docs/react/pages/phase-6-performance/05-measure-before-you-optimise.md`
- **Read this:** [Profiler](https://react.dev/reference/react/Profiler) · react.dev · the `Profiler` component and its `onRender` callback (*read*) · covers our angle: **partial** — the DevTools Profiler panel is not here · fetched 2026-10-13
- **Also good:** [React Performance tracks](https://react.dev/reference/dev-tools/react-performance-tracks) · react.dev · the 19.2 tracks in the browser performance panel (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Fix the slow render before you fix the re-render](https://kentcdodds.com/blog/fix-the-slow-render-before-you-fix-the-re-render) · Kent C. Dodds, 2019-09-09 · separates render, reconciliation and commit, then argues that a slow render is a likelier culprit than an unnecessary re-render and says to profile and fix it first; predates the Compiler (*read*) · fetched 2026-10-13
- **Our delta:** one profile before and one after the fix.

### T06-06 · The memoization trap — Understand · ✅ written `docs/react/pages/phase-6-performance/06-the-memoization-trap.md`
- **Read this:** [memo](https://react.dev/reference/react/memo) · react.dev · the "Minimizing props changes" guidance (*headings only*) · covers our angle: **partial** — does not give the `children` composition fix · fetched 2026-10-13
- **Also good:** [How to useMemo and useCallback: you can remove most of them](https://www.developerway.com/posts/how-to-use-memo-use-callback) · Nadia Makarevich, Developer Way, 2022-06-13 · shows a memoized component that still re-renders because one prop is not memoized (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Before You memo()](https://overreacted.io/before-you-memo/) · Dan Abramov, 2021-02-23 · two fixes that need no memoization: move state down, and lift content up by passing it as `children` (*read*) · fetched 2026-10-13
- **Our delta:** the fix by composition rather than more `useMemo`.

### T06-07 · The React Compiler v1.0 — Understand · ✅ written `docs/react/pages/phase-6-performance/07-the-react-compiler.md`
- **Read this:** [React Compiler v1.0](https://react.dev/blog/2025/10/07/react-compiler-1) · react.dev · the stable release post: a build-time tool that optimizes through automatic memoization (*read*) · covers our angle: **partial** — does not show emitted code · fetched 2026-10-13
- **Also good:** [React Compiler Introduction](https://react.dev/learn/react-compiler/introduction) · react.dev · what it does and how it replaces manual memoization (*read*) · fetched 2026-10-13
- **Beyond the docs:** [React Compiler: An Introduction, Pros, Cons & When to Use It](https://www.debugbear.com/blog/react-compiler) · Anna Monus, DebugBear, 2026-01-28 (updated 2026-04-15) · prints the compiled output of a small component, with a cache array and each JSX element memoized on its own, then lists pros and cons, including that the DevTools badge only says the compiler processed a component (*read*) · covers our angle: **full** on what it emits · fetched 2026-10-13
- **Our delta:** what the Compiler emits, and what that means for existing `useMemo` calls.

### T06-08 · Installing and configuring the Compiler — Understand · ✅ written `docs/react/pages/phase-6-performance/08-installing-the-compiler.md`
- **Read this:** [Installation](https://react.dev/learn/react-compiler/installation) · react.dev · `babel-plugin-react-compiler` as a dev dependency, a pointer to the options reference for targeting React versions below 19, and per-build-tool setup (*read*) · covers our angle: **partial** — `react-compiler-runtime` is not named on this page · fetched 2026-10-13
- **Also good:** [Incremental Adoption](https://react.dev/learn/react-compiler/incremental-adoption) · react.dev · adopting file by file (*headings only*) · fetched 2026-10-13
- **Our delta:** `react-compiler-runtime` for React 17 and 18.

### T06-09 · How the Compiler bails out — Understand · ✅ written `docs/react/pages/phase-6-performance/09-how-the-compiler-bails-out.md`
- **Read this:** [Debugging and Troubleshooting](https://react.dev/learn/react-compiler/debugging) · react.dev · the compiler skips code that might break the Rules of React rather than risk changing behavior, and how to tell compiler errors from runtime issues (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Our delta:** the Rules of React as the thing the Compiler must be able to prove.

### T06-10 · `eslint-plugin-react-hooks` v7 — Understand · ✅ written `docs/react/pages/phase-6-performance/10-eslint-plugin-react-hooks.md`
- **Read this:** [eslint-plugin-react-hooks](https://react.dev/reference/eslint-plugin-react-hooks) · react.dev · lists the rules in the `recommended` preset, including `exhaustive-deps` and `rules-of-hooks` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Our delta:** running the compiler-powered rules without installing the Compiler; the page says its diagnostics can be used even if the app has not adopted the compiler. The page lists the compiler rules under the `recommended` preset, so check the installed plugin's own configs if the preset names differ.

### T06-11 · Do you still write `useMemo` with the Compiler on? — Understand · ✅ written `docs/react/pages/phase-6-performance/11-do-you-still-write-usememo.md`
- **Read this:** [React Compiler Introduction](https://react.dev/learn/react-compiler/introduction) · react.dev · how the Compiler relates to manual memoization (*read*) · covers our angle: **partial** — no deletion order · fetched 2026-10-13
- **Beyond the docs:** [I let React Compiler handle memoization: Here's what actually broke](https://blog.logrocket.com/react-compiler-memoization-what-actually-broke) · Isaac Okoro, LogRocket Blog, 2026-06-29 · a migration report where removing a `useCallback` that fed a Chart.js click handler exposed a timing bug it had hidden (*read*) · fetched 2026-10-13
- **Our delta:** what to delete, what to keep, and the migration order.

### T06-12 · Lazy loading components — Understand · ✅ written `docs/react/pages/phase-6-performance/12-lazy-loading.md`
- **Read this:** [lazy](https://react.dev/reference/react/lazy) · react.dev · `lazy(() => import(…))` with a Suspense boundary and a troubleshooting entry for a lazy component's state resetting (*read*) · covers our angle: **partial** — preload-on-intent is not here · fetched 2026-10-13
- **Also good:** [Suspense](https://react.dev/reference/react/Suspense) · react.dev · the fallback and what activates a Suspense boundary (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Code splitting with React.lazy and Suspense](https://web.dev/articles/code-splitting-suspense) · web.dev (Google), last updated 2019-04-29 · says to begin code splitting at the route level, then split large components that render only on interaction; written for an older React and a Create React App setup (*read*) · fetched 2026-10-13
- **Our delta:** preloading on hover or intent, and a loading state that does not flash.

### T06-13 · Moving state down and lifting content up — Understand · ✅ written `docs/react/pages/phase-6-performance/13-moving-state-down.md`
- **Read this:** [Before You memo()](https://overreacted.io/before-you-memo/) · Dan Abramov, 2021-02-23 · "Move State Down" then lifting content up, on a worked colour-picker example (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [State Colocation will make your React app faster](https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster) · Kent C. Dodds, 2019-09-23 · opens on global state as a leading cause of slow apps and moves state closer to where it is used (*read*) · fetched 2026-10-13
- **Our delta:** before and after render counts.

### T06-14 · List virtualization — Understand · ✅ written `docs/react/pages/phase-6-performance/14-list-virtualization.md`
- **Read this:** [TanStack Virtual: Introduction](https://tanstack.com/virtual/latest/docs/introduction) · TanStack · a headless UI utility for virtualizing long lists in React and other frameworks, with a ten-thousand-row example (*read*) · covers our angle: **partial** — the cost side (scroll restoration, find-in-page, accessibility) is thin · fetched 2026-10-13
- **Also good:** [Virtualize large lists with react-window](https://web.dev/articles/virtualize-long-lists-react-window) · Jason Miller and Houssein Djirdeh, web.dev (Google), last updated 2019-04-29 · defines list virtualization, or windowing, as rendering only what is visible; covers react-window only and is old (*read*) · fetched 2026-10-13
- **Our delta:** what windowing costs you.

### T06-15 · Expensive initial mount — Understand · ✅ written `docs/react/pages/phase-6-performance/15-expensive-initial-mount.md`
- **Read this:** [Activity](https://react.dev/reference/react/Activity) · react.dev · has a usage section on pre-rendering content that is likely to become visible (*read*) · covers our angle: **partial** — hydration cost is on the `hydrateRoot` page · fetched 2026-10-13
- **Also good:** [hydrateRoot](https://react.dev/reference/react-dom/client/hydrateRoot) · react.dev · hydrating server HTML (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [React 19.2. Further Advances INP Optimization](https://calendar.perfplanet.com/2025/react-19-2-further-advances-inp-optimization/) · Michal Matuška, Web Performance Calendar, 2025-12-10 · ties a larger DOM and more components to hydration work and a slower UI, then introduces `Activity` (*read*) · fetched 2026-10-13
- **Our delta:** deferring below-the-fold work.

### T06-16 · Bundle size — Know · ✅ written `docs/react/pages/phase-6-performance/16-bundle-size.md`
- **Read this:** [Tree Shaking](https://webpack.js.org/guides/tree-shaking/) · webpack · tree shaking relies on the static structure of ES2015 module syntax, and side-effect marking decides what stays (*read*) · covers our angle: **partial** — not React-specific · fetched 2026-10-13
- **Beyond the docs:** [Bundle Size Investigation](https://www.developerway.com/posts/bundle-size-investigation) · Nadia Makarevich, Developer Way, 2025-12-04 · a React-app walk-through of bundle analysis, tree-shaking fixes and duplicate libraries, with a step-by-step process for picking a package to eliminate (*read*) · fetched 2026-10-13
- **Our delta:** one heavy dependency in a leaf component.

### T06-17 · `useDeferredValue` for a laggy list — Know · ✅ written `docs/react/pages/phase-6-performance/17-usedeferredvalue.md`
- **Read this:** [useDeferredValue](https://react.dev/reference/react/useDeferredValue) · react.dev · deferring a value so a search box stays responsive while a list catches up (*headings only*) · covers our angle: **full** for a Know row; taught in Phase 8 · fetched 2026-10-13
- **Our delta:** named here only; the full treatment is Phase 8.

---

## Phase 7 — Custom hooks and the Rules of React

### T07-01 · The Rules of Hooks — Master · ✅ written `docs/react/pages/phase-7-custom-hooks/01-the-rules-of-hooks.md`
- **Read this:** [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks) · react.dev · do not call Hooks inside loops, conditions, nested functions, or try/catch/finally blocks (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Why Do React Hooks Rely on Call Order?](https://overreacted.io/why-do-hooks-rely-on-call-order/) · Dan Abramov, 2018-12-13 · the design discussion of the order rule and its trade-offs (*read*) · fetched 2026-10-13
- **Our delta:** none needed beyond the official page.

### T07-02 · Writing a custom hook — Master · ✅ written `docs/react/pages/phase-7-custom-hooks/02-writing-a-custom-hook.md`
- **Read this:** [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) · react.dev · extracting stateful logic into a function whose name starts with `use` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Custom React Hooks and When to Use Them](https://thoughtbot.com/blog/custom-react-hooks) · Stephen Hanson, thoughtbot, 2023-01-31 · a custom hook is any function that starts with `use` and calls other hooks; the post then weighs when it is worth extracting (*read*) · fetched 2026-10-13
- **Our delta:** what the prefix buys (the linter) and what it does not.

### T07-03 · Custom hooks share logic, not state — Master · ✅ written `docs/react/pages/phase-7-custom-hooks/03-share-logic-not-state/01-two-callers-two-states.md`
- **Read this:** [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) · react.dev · "Custom Hooks let you share stateful logic, not state itself", and it is wrong to think one `isOnline` variable is shared between callers (*read*) · covers our angle: **partial** — the fix when you wanted shared state is on the context pages · fetched 2026-10-13
- **Our delta:** the `useLocalStorage` trap and the move to context.

### T07-04 · The Rules of React beyond hooks — Master · ✅ written `docs/react/pages/phase-7-custom-hooks/04-rules-of-react-beyond-hooks/01-purity-and-idempotence.md`
- **Read this:** [Rules of React](https://react.dev/reference/rules) · react.dev · the index of the rules (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure) · react.dev · idempotence, side effects outside render, and a section on when mutation is okay (*read*) · fetched 2026-10-13
- **Our delta:** none needed beyond the official pages.

### T07-05 · Why the rules exist — Understand · ✅ written `docs/react/pages/phase-7-custom-hooks/05-why-the-rules-exist/01-the-array-and-the-index.md`
- **Read this:** [Why Do React Hooks Rely on Call Order?](https://overreacted.io/why-do-hooks-rely-on-call-order/) · Dan Abramov, 2018-12-13 · why Hooks are matched by call order; written at the proposal stage, so it argues a design choice and does not walk the implementation (*headings only*) · covers our angle: **partial** — no "Rendered fewer hooks than expected" walk-through · fetched 2026-10-13
- **Also good:** [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks) · react.dev · the official statement of the rules (*read*) · fetched 2026-10-13
- **Beyond the docs:** [You Can't Use Hooks Conditionally… or Can You?](https://gitnation.com/contents/you-cant-use-hooks-conditionally-or-can-you) · Charlotte Isambert, React Summit 2023 (page dated 2023-06-02) · a talk page whose abstract builds a mental model of how React keeps track of props, state, refs and context at runtime to explain why the rule exists; the video itself I did not watch, so I judge it from the abstract and FAQ (*headings only*) · fetched 2026-10-13
- **Our delta:** the error explained from the implementation. A well-known "hooks are just arrays" post on Medium returned 403 to my fetch and is not linked.

### T07-06 · Designing a hook's API — Understand · ✅ written `docs/react/pages/phase-7-custom-hooks/06-designing-a-hooks-api/01-the-name-and-the-arguments.md`
- **Read this:** [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) · react.dev · a Deep Dive on keeping custom hooks focused on concrete high-level use cases, with `useMediaQuery` and `useSocket` as good names and `useMount` as a bad one (*read*) · covers our angle: **partial** — nothing on tuple versus object return · fetched 2026-10-13
- **Our delta:** tuple versus object return, and naming by what the hook synchronizes with. Searches found only thin lists and one forum-style debate on tuples, so this one is ours to own.

### T07-07 · The standard set, written out and runnable — Understand · ✅ written `docs/react/pages/phase-7-custom-hooks/07-the-standard-set/01-value-helpers.md`
- **Read this:** [useLocalStorage](https://usehooks-ts.com/react-hook/use-local-storage) · usehooks-ts · library docs for one of the ten hooks: `initializeWithValue` should be false in SSR so the initial value is returned first (*read*) · covers our angle: **partial** — one hook of ten; the library has its own `useDebounceValue` page · fetched 2026-10-13
- **Also good:** [useDebounceValue](https://usehooks-ts.com/react-hook/use-debounce-value) · usehooks-ts · the debounce hook from the same library (*headings only*) · [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) · react.dev · when logic should not be an effect at all (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Making setInterval Declarative with React Hooks](https://overreacted.io/making-setinterval-declarative-with-react-hooks/) · Dan Abramov, 2019-02-04 · the canonical `useInterval`: the latest callback is kept in a ref so the interval is not reset (*read*) · fetched 2026-10-13
- **Our delta:** the gotcha that makes each naive version wrong.

### T07-08 · Hooks that wrap effects — Understand · ✅ written `docs/react/pages/phase-7-custom-hooks/08-hooks-that-wrap-effects/01-dependencies-across-the-boundary.md`
- **Read this:** [useEffectEvent](https://react.dev/reference/react/useEffectEvent) · react.dev · Effect Events read the latest values without re-synchronizing the Effect, with a section on using Effect Events in custom Hooks (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Separating Events from Effects](https://react.dev/learn/separating-events-from-effects) · react.dev · the learn page behind it (*read*) · fetched 2026-10-13
- **Beyond the docs:** [A Complete Guide to useEffect](https://overreacted.io/a-complete-guide-to-useeffect/) · Dan Abramov, 2019-03-09 · its "Don't Lie to React About Dependencies" section shows what goes wrong when an effect reads a value that is left out of the array; written before `useEffectEvent`, so it offers other fixes (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Our delta:** taking an effect event as an argument without re-subscribing.

### T07-09 · Conditional hooks and the correct restructure — Understand · ✅ written `docs/react/pages/phase-7-custom-hooks/09-conditional-hooks.md`
- **Read this:** [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks) · react.dev · conditions, loops and early returns before a hook (*read*) · covers our angle: **partial** — little on splitting the component · fetched 2026-10-13
- **Beyond the docs:** [Conditional Hooks in React](https://www.robinwieruch.de/react-conditional-hooks/) · Robin Wieruch, 2021-07-18 · works a list example and moves the conditional hook down into a child component (*headings only*) · fetched 2026-10-13
- **Our delta:** splitting the component instead of skipping the hook.

### T07-10 · `use` breaks the rule on purpose — Understand · ✅ written `docs/react/pages/phase-7-custom-hooks/10-use-breaks-the-rule.md`
- **Read this:** [use](https://react.dev/reference/react/use) · react.dev · reading a promise or context, callable in a condition or loop (*headings only*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [You Can't Use Hooks Conditionally… or Can You?](https://gitnation.com/contents/you-cant-use-hooks-conditionally-or-can-you) · Charlotte Isambert, React Summit 2023 (page dated 2023-06-02) · a conference talk, so a video page; its abstract explains why `useContext` is exempt from the top-level rule, and the page's FAQ discusses the proposed `use` hook, which was not stable in 2023 (*headings only*) · fetched 2026-10-13
- **Our delta:** the rules `use` still obeys.

### T07-11 · Testing a custom hook — Understand · ✅ written `docs/react/pages/phase-7-custom-hooks/11-testing-a-custom-hook.md`
- **Read this:** [React Testing Library: API](https://testing-library.com/docs/react-testing-library/api/) · Testing Library · documents `renderHook` and says it is mostly interesting for libraries publishing hooks, and that you should prefer `render` with a custom test component otherwise (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [How to test custom React hooks](https://kentcdodds.com/blog/how-to-test-custom-react-hooks) · Kent C. Dodds, 2020-03-22 · starts from a throwaway test component and then shows `renderHook` from `@testing-library/react` as the shorter route (*read*) · fetched 2026-10-13
- **Our delta:** testing behaviour rather than the return value.

### T07-12 · Extracting too early — Know · ✅ written `docs/react/pages/phase-7-custom-hooks/12-extracting-too-early.md`
- **Read this:** [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks) · react.dev · the guidance on when a function should and should not be a hook (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Custom React Hooks and When to Use Them](https://thoughtbot.com/blog/custom-react-hooks) · Stephen Hanson, thoughtbot, 2023-01-31 · extract either for reuse or to keep the component simpler, then asks whether the parent is more understandable with the abstraction and whether it is isolated enough, and says to inline it back if not (*read*) · fetched 2026-10-13
- **Our delta:** a hook used once that hides control flow.
