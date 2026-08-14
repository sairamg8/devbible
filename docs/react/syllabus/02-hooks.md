---
title: "Part 2 — Hooks, completely"
sidebar_label: "2 · Hooks, completely"
sidebar_position: 2
---

> Phases 4–7 · 63 topics · Effects, refs, context, reducers, performance, the
> Compiler, and the rules underneath all of it

**Every hook React 19.2.8 ships is covered here or in Part 3.** The eighteen in
`react`, plus `useFormStatus` and `useFormState` in `react-dom`, plus `use` —
which is not technically a hook and is the only one allowed inside an `if`.

The four hooks that belong to concurrent rendering and Actions —
`useTransition`, `useDeferredValue`, `useActionState`, `useOptimistic` — are in
[Part 3](03-concurrent-and-server.md), because they are unlearnable without
Suspense and Actions around them.

---

## Phase 4 — Effects and synchronization

*18 topics.* The most misused hook in React, almost always because it is
understood as "run code after render" instead of "synchronize with something
outside React". Budget real time here.

| Topic | Tier |
|---|---|
| **What an effect is for** — synchronizing a React component with an external system. Not a lifecycle callback, not "componentDidMount", not the place to respond to a click | <span className="db-tier t-master">Master</span> |
| **`useEffect` anatomy** — setup function, optional cleanup return, dependency array; the three forms (no array, empty array, populated array) and exactly when each re-runs | <span className="db-tier t-master">Master</span> |
| **The dependency array is not a preference** — every reactive value the setup reads belongs in it. What "lying to the linter" actually produces: an effect reading last render's values forever | <span className="db-tier t-master">Master</span> |
| **Cleanup** — React runs setup and cleanup as many times as needed, not once each. Writing every effect so that setup→cleanup→setup is a no-op | <span className="db-tier t-master">Master</span> |
| **`StrictMode` double-invocation** — why your effect runs, cleans up and runs again in development, what that is testing, and the class of bugs it catches (duplicate connections, doubled analytics, unremoved listeners) | <span className="db-tier t-master">Master</span> |
| **You might not need an effect** — the eight cases with their fixes: derived data, expensive derived data, resetting on prop change, adjusting on prop change, event-specific logic, chains of effects, application initialization, and passing data to the parent | <span className="db-tier t-master">Master</span> |
| **Fetching data in an effect** — why it is everyone's first answer and why it is a poor one: request waterfalls, no caching, no deduplication, race conditions, and nothing to render on the server | <span className="db-tier t-master">Master</span> |
| **Race conditions** — the out-of-order response that renders stale data; the `ignore` boolean in cleanup and the `AbortController` version, and which one you actually need | <span className="db-tier t-understand">Understand</span> |
| **An effect has its own lifecycle** — it starts and stops synchronizing, independent of the component mounting; splitting one effect into two by concern rather than by timing | <span className="db-tier t-understand">Understand</span> |
| **`useEffectEvent`** — stable in **19.2**. Reading the latest props and state from inside an effect *without* making them dependencies; the rules (call only from effects in the same component, never pass it around) | <span className="db-tier t-understand">Understand</span> |
| **Removing dependencies legitimately** — move the value out of the component, use the updater form, extract an effect event, depend on a primitive instead of an object. And the illegitimate ones: an eslint-disable comment, a ref used to hide a dependency | <span className="db-tier t-understand">Understand</span> |
| **`useLayoutEffect`** — runs after DOM mutation but **before the browser paints**; measuring a node and adjusting before the user sees it; the SSR warning and the performance cost of blocking paint | <span className="db-tier t-understand">Understand</span> |
| **Effect ordering** — children before parents, cleanups before setups, and how layout effects interleave with passive effects in one commit | <span className="db-tier t-understand">Understand</span> |
| **Timers, listeners and observers** — `setInterval` with a changing delay, `addEventListener` with a stable handler, `IntersectionObserver` and `ResizeObserver` — each with correct cleanup and the leak you get without it | <span className="db-tier t-understand">Understand</span> |
| **Effects and refs together** — measuring or focusing a DOM node, the ref-callback alternative, and **ref cleanup functions** added in React 19 | <span className="db-tier t-understand">Understand</span> |
| **Subscribing to an external store from an effect** — the pattern, the tearing problem it has under concurrent rendering, and why `useSyncExternalStore` (Phase 5) exists to replace it | <span className="db-tier t-understand">Understand</span> |
| `useInsertionEffect` — for CSS-in-JS libraries injecting `<style>` before layout is read; explicitly not for application code | <span className="db-tier t-know">Know</span> |
| Skipping the first run — the `useRef` guard pattern, why it usually means the logic belonged in an event handler, and the rare legitimate case | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can take a component that fetches on every keystroke
with a `useEffect` and rewrite it so that it debounces, cancels superseded
requests, never renders a response for an old query, and survives `StrictMode`
without firing twice in production.

---

## Phase 5 — Refs, context and reducers

*16 topics.* The three escape hatches from pure top-down state, and the two
hooks that connect React to the world outside it.

| Topic | Tier |
|---|---|
| **`useRef`** — a mutable box that survives renders and never triggers one. The two legitimate uses: a handle to a DOM node, and an instance variable React does not need to know about | <span className="db-tier t-master">Master</span> |
| **DOM refs** — attaching with `ref={inputRef}`, why `.current` is `null` during render, measuring, focusing, scrolling, and integrating a non-React widget | <span className="db-tier t-master">Master</span> |
| **`useReducer`** — state transitions as data. The reducer contract (pure, takes state and action, returns the next state) and why that makes complex state testable | <span className="db-tier t-master">Master</span> |
| **`createContext` and `useContext`** — the provider/consumer model, `<Context>` usable directly as a provider in React 19, and reading a value from anywhere below | <span className="db-tier t-master">Master</span> |
| **The context re-render problem** — every consumer re-renders when the provider's `value` *identity* changes. Memoizing the value, splitting state from dispatch, splitting one context into several, and why `useContext` has no selector | <span className="db-tier t-master">Master</span> |
| **Ref callbacks** — `ref={node => …}`, why they run on mount and unmount, and the **cleanup function** they can now return (React 19) instead of being called with `null` | <span className="db-tier t-understand">Understand</span> |
| **`useImperativeHandle`** — exposing a deliberately narrow imperative API (`focus`, `scrollIntoView`, `play`) instead of the raw node; when a library needs it and an application does not | <span className="db-tier t-understand">Understand</span> |
| **When a ref is the wrong tool** — reading a value in an event handler that should have been rendered; the "it works but the UI is stale" bug | <span className="db-tier t-understand">Understand</span> |
| **`useState` vs `useReducer`** — the honest decision rule: how many pieces of state move together, and how many places update them | <span className="db-tier t-understand">Understand</span> |
| **Reducer patterns** — action shape, discriminated-union actions, the lazy `init` argument, and the fact that `dispatch` is stable so it never needs to be a dependency | <span className="db-tier t-understand">Understand</span> |
| **What context is and is not** — dependency injection for a subtree. It is not a state manager, it does not prevent re-renders, and it does not make data global — theming, locale, auth identity and the current user are the right shape | <span className="db-tier t-understand">Understand</span> |
| **Context plus reducer** — React's own built-in "app state" pattern, with separate `StateContext` and `DispatchContext` so that dispatchers do not re-render | <span className="db-tier t-understand">Understand</span> |
| **The default context value** — when it is actually used, the missing-provider bug it silently hides, and the custom-hook guard that turns it into a clear error | <span className="db-tier t-understand">Understand</span> |
| **`useId`** — generating ids that match between server and client render; wiring `<label htmlFor>` and `aria-describedby`; never for list keys. The generated prefix changed in 19.2 | <span className="db-tier t-understand">Understand</span> |
| **`useSyncExternalStore`** — subscribing to an external mutable store without tearing under concurrent rendering: `subscribe`, `getSnapshot`, `getServerSnapshot`, and the "getSnapshot should be cached" error | <span className="db-tier t-understand">Understand</span> |
| `useDebugValue` — labelling a custom hook in DevTools, and the lazy-format second argument | <span className="db-tier t-when">When Needed</span> |

**Gate — deliverable:** an auth context that a consumer can read without
re-rendering when unrelated context state changes, throws a clear error when its
provider is missing, and exposes `logout()` through a dispatch context that never
changes identity.

---

## Phase 6 — Rendering performance and the React Compiler

*17 topics.* Memoization is the most cargo-culted area of React. This phase is
ordered deliberately: measure, understand *why* something re-rendered, and only
then reach for `memo`. The Compiler changes the ending, not the reasoning.

| Topic | Tier |
|---|---|
| **Why did this component re-render?** — the four causes, and how to tell them apart in DevTools instead of guessing | <span className="db-tier t-master">Master</span> |
| **`memo`** — a shallow prop comparison before re-rendering; the custom comparator; and the reason it does nothing at all when the parent passes a fresh object, array or arrow function every render | <span className="db-tier t-master">Master</span> |
| **`useMemo`** — caching a computed value between renders. The two distinct reasons to use it: a genuinely expensive computation, and referential identity feeding `memo` or a dependency array | <span className="db-tier t-master">Master</span> |
| **`useCallback`** — the same thing for functions, and the honest test for whether a given `useCallback` is doing anything at all | <span className="db-tier t-master">Master</span> |
| **Measure before you optimise** — the DevTools Profiler, the `<Profiler>` component and its `onRender` arguments, and **Performance Tracks** (19.2) in the browser performance panel | <span className="db-tier t-understand">Understand</span> |
| **The memoization trap** — `memo` defeated by inline props; the fix by *composition* (accept `children`) rather than by adding more `useMemo` | <span className="db-tier t-understand">Understand</span> |
| **The React Compiler v1.0** — build-time automatic memoization. What it actually emits, what it means for the `useMemo`/`useCallback` you already wrote, and that it is stable as of Oct 2025 | <span className="db-tier t-understand">Understand</span> |
| **Installing and configuring the Compiler** — `babel-plugin-react-compiler`, wiring it into Vite/Next, the `target` option, and `react-compiler-runtime` when you are still on React 17 or 18 | <span className="db-tier t-understand">Understand</span> |
| **How the Compiler bails out** — the Rules of React it must be able to prove; what makes it skip a component; and how to see which components were compiled | <span className="db-tier t-understand">Understand</span> |
| **`eslint-plugin-react-hooks` v7** — the compiler-powered rules now in the `recommended` preset, running them without installing the compiler, and reading the diagnostics | <span className="db-tier t-understand">Understand</span> |
| **Do you still write `useMemo` with the Compiler on?** — the honest answer, what to delete, what to keep, and the migration order for an existing codebase | <span className="db-tier t-understand">Understand</span> |
| **Lazy loading components** — `lazy(() => import(…))` with a Suspense boundary, route-level splitting, preloading on hover/intent, and designing the loading state so it does not flash | <span className="db-tier t-understand">Understand</span> |
| **Moving state down and lifting content up** — the two architectural fixes that beat any amount of memoization, with the before/after render counts | <span className="db-tier t-understand">Understand</span> |
| **List virtualization** — the point where no memoization helps because the cost is 10,000 DOM nodes; what a windowing library does and what it costs you (scroll restoration, find-in-page, accessibility) | <span className="db-tier t-understand">Understand</span> |
| **Expensive initial mount** — hydration cost, deferring below-the-fold work, and `<Activity>` for pre-rendering a screen the user has not opened yet | <span className="db-tier t-understand">Understand</span> |
| Bundle size — what actually reaches the browser, reading a bundle analysis, tree-shaking failures, and the cost of one heavy dependency imported in a leaf component | <span className="db-tier t-know">Know</span> |
| `useDeferredValue` for a laggy list — named here, taught in Phase 8 with the rest of concurrent rendering | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can take a slow list page, produce a profile that
names the actual cause, fix it with the smallest correct change, and produce a
second profile that proves it — and say whether the Compiler would have fixed it
for you.

---

## Phase 7 — Custom hooks and the Rules of React

*12 topics.* Short, and the highest ratio of understanding to material in the
syllabus. The rules are what make everything above work.

| Topic | Tier |
|---|---|
| **The Rules of Hooks** — call them at the top level only, and only from a component or another hook. No conditions, no loops, no nested functions, no `try`/`catch` around them | <span className="db-tier t-master">Master</span> |
| **Writing a custom hook** — extracting stateful logic into a `use`-prefixed function; what the prefix buys you (the linter) and what it does not | <span className="db-tier t-master">Master</span> |
| **Custom hooks share logic, not state** — two components calling the same hook get two independent states. The single most common misunderstanding, and the fix when you actually wanted shared state | <span className="db-tier t-master">Master</span> |
| **The Rules of React beyond hooks** — components and hooks must be pure; never mutate anything after passing it to React; props, state, context values, arguments and return values are all immutable; render must not read or write the DOM | <span className="db-tier t-master">Master</span> |
| **Why the rules exist** — hooks are stored positionally per component instance; a conditional hook shifts the whole list and hands you someone else's state. The "Rendered fewer hooks than expected" error explained by the implementation | <span className="db-tier t-understand">Understand</span> |
| **Designing a hook's API** — arguments in, tuple versus object return, keeping one hook to one job, and naming that says what it synchronizes with | <span className="db-tier t-understand">Understand</span> |
| **The standard set, written out and runnable** — `useToggle`, `usePrevious`, `useDebounce`, `useLocalStorage`, `useMediaQuery`, `useEventListener`, `useOnClickOutside`, `useIntersectionObserver`, `useIsMounted`, `useInterval` — each with the gotcha that makes the naive version wrong | <span className="db-tier t-understand">Understand</span> |
| **Hooks that wrap effects** — keeping dependencies honest across the boundary, taking an effect event as an argument, and not accidentally re-subscribing on every render | <span className="db-tier t-understand">Understand</span> |
| **Conditional hooks and the correct restructure** — the early return before a hook, the hook in a loop, and splitting the component instead of skipping the hook | <span className="db-tier t-understand">Understand</span> |
| **`use` breaks the rule on purpose** — it may be called inside a condition or a loop, why that is safe when `useState` is not, and the rules it still obeys | <span className="db-tier t-understand">Understand</span> |
| **Testing a custom hook** — rendering it in a throwaway component versus `renderHook`, and testing behaviour rather than the return value | <span className="db-tier t-understand">Understand</span> |
| Extracting too early — a "custom hook" used exactly once that hides control flow instead of sharing it | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain, from the implementation, why calling a
hook inside `if (loading)` corrupts state — and write `useDebouncedValue` and
`useLocalStorage` from an empty file, both `StrictMode`-safe and both SSR-safe.

---

## Where this connects

- **Phase 4 → nowhere, now** — "fetching in an effect is a poor default" is
  stated here, and Phase 12 was going to answer it with a query cache or a
  framework loader. **Phase 12 was dropped**; the server-side answer is in
  Phase 10, and the client-side one is not covered.
- **Phase 5 → Phase 8** — `useSyncExternalStore` exists because of tearing, and
  tearing only exists because rendering is concurrent.
- **Phase 5 → nowhere, now** — context was going to be compared against real
  state managers in Phase 12, which was **dropped**. The comparison is not
  covered.
- **Phase 6 → Phase 11** — the other half of performance is what happens before
  JavaScript runs at all: server rendering, streaming and hydration cost.
- **Phase 7 → Phase 6** — the Compiler can only optimise code that obeys the
  Rules of React, which is the strongest practical argument for them.
- **Deliberately not here:** `useTransition`, `useDeferredValue`,
  `useActionState`, `useOptimistic`, `use`, `cache` and `cacheSignal` — all in
  Part 3, with the machinery that explains them.

---

← Prev: [Part 1 — The React model](01-the-react-model.md) · Next → [Part 3 — Concurrent React and the server](03-concurrent-and-server.md)
