---
title: "What changed in React 19 and 19.2"
sidebar_label: "09 · What changed in 19"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 by installing **react 18.3.1, 19.0.8 and 19.2.8** side by
> side and diffing `Object.keys()` on each entry point.
> `sandbox/react-p0/ex09-what-changed.mjs`.
>
> Export lists are as resolved **under Node 24**. Conditional exports mean the
> browser build of `react-dom/server` differs; the additions and removals below
> are the same either way.

**This page is the diff, not a summary of a blog post.** Everything listed was
derived by comparing installed packages.

## The surface, three versions side by side

```console
$ node ex09-what-changed.mjs
=== surface size per entry point ===
  react              18.3.1: 35   19.0.8: 38   19.2.8: 42
  react-dom          18.3.1: 11   19.0.8: 13   19.2.8: 13
  react-dom/client   18.3.1: 2    19.0.8: 3    19.2.8: 3
  react-dom/server   18.3.1: 6    19.0.8: 4    19.2.8: 7
  react-dom/static   18.3.1: —    19.0.8: 3    19.2.8: 5
```

`react` grew by seven exports across two releases. `react-dom/static` did not
exist in 18 at all.

## React 18 → 19

```console
=== React 18.3.1 -> 19.0.8 ===
  react  + cache unstable_useCacheRefresh use useActionState useOptimistic
  react  - createFactory unstable_act
  react-dom  + preconnect prefetchDNS preinit preinitModule preload preloadModule
             requestFormReset useFormState useFormStatus
  react-dom  - createRoot findDOMNode hydrate hydrateRoot render
             unmountComponentAtNode unstable_renderSubtreeIntoContainer
  react-dom/server  - renderToNodeStream renderToStaticNodeStream
  react-dom/static: did not exist in 18
```

### What arrived

| Export | What it is |
|---|---|
| **`use`** | Read a promise or a context during render. The only API callable conditionally |
| **`useActionState`** | State + action + pending, in one hook — the backbone of Actions |
| **`useOptimistic`** | Show the expected result before the server confirms |
| **`cache`** | Deduplicate an async call across one server render |
| `preload`, `preinit`, `preconnect`, `prefetchDNS`, … | Resource hints callable from a component |
| `useFormStatus` | A child reading its parent `<form>`'s pending state |
| `requestFormReset` | Reset a form after an action |

### What left

`createFactory` is gone. So is `findDOMNode` — use a ref.

**Read the `react-dom` removals carefully.** `createRoot` and `hydrateRoot`
appear under `-`, but they were not deleted: they **moved** to
`react-dom/client`, which is why that entry point grew from 2 to 3. What was
genuinely removed is `render`, `hydrate`, `unmountComponentAtNode`,
`findDOMNode` and `unstable_renderSubtreeIntoContainer` — see
[page 06](06-createroot.md) for the migration table.

`renderToNodeStream` and `renderToStaticNodeStream` are gone from the server
entry point; `renderToPipeableStream` replaced them.

### Not visible in a diff

Three React 19 changes do not show up as exports, and they are the ones you feel
first:

- **`ref` is an ordinary prop.** `forwardRef` is no longer needed for function
  components.
- **`<title>`, `<meta>` and `<link>` hoist to `<head>`** from anywhere in the
  tree.
- **`propTypes` and `defaultProps` are ignored on function components.** Use
  default parameters and TypeScript.

## React 19.0 → 19.2

```console
=== React 19.0.8 -> 19.2.8 ===
  react  + Activity cacheSignal captureOwnerStack useEffectEvent
  react-dom/server  + renderToReadableStream resume resumeToPipeableStream
  react-dom/static  + prerender resumeAndPrerender
```

Four additions to `react`, and they are individually significant:

| Export | What it solves |
|---|---|
| **`useEffectEvent`** | Read the latest props/state inside an effect without adding them as dependencies — the long-standing "stale value versus over-firing effect" dilemma |
| **`<Activity>`** | Hide a subtree, **keep its state**, unmount its effects. Pre-render the next screen without showing it |
| **`cacheSignal`** | An `AbortSignal` that fires when React discards the render, so `cache()`d work can be cancelled |
| **`captureOwnerStack`** | The component *owner* stack in development, for error reports that name components |

The server additions are **Partial Pre-rendering**: `prerender` a static shell at
build time, then `resume` it per request to fill in the dynamic parts. That is a
different shape from both SSG and SSR, and it is Phase 11 material.

## Still exported, still deprecated

```console
=== still exported in 19.2.8 but deprecated ===
  react-dom useFormState  present — renamed to useActionState, which lives in `react`
  react useActionState    true
```

`useFormState` remains in `react-dom` and works. It is the old name; the API
moved to `react` as `useActionState`. Any tutorial using `useFormState` predates
19.0 — check the rest of it too.

## And what did *not* arrive

`ViewTransition`, `addTransitionType`, `unstable_startGestureTransition` and
`unstable_SuspenseList` are **not in 19.2.8**. They exist only in the
experimental channel, verified by diffing `latest` against `experimental` (see
the [syllabus README](../../README.md)). React Labs posts and conference talks
from 2025–26 demonstrate them freely; the stable package does not have them.

## Upgrading 18 → 19

The order that causes the least pain:

1. Upgrade to **18.3.1** first. It is 18.2 plus deprecation warnings — fix
   everything it complains about while still on 18.
2. Run the codemods: `npx codemod@latest react/19/migration-recipe`.
3. Replace `ReactDOM.render` with `createRoot`, and `hydrate` with
   `hydrateRoot`.
4. Remove `propTypes` and function-component `defaultProps`.
5. Upgrade `react` and `react-dom` together, to the same exact version.
6. Expect peer-dependency noise from libraries that have not widened their
   ranges.

## Gotchas

**Symptom:** `TypeError: ReactDOM.render is not a function` after upgrading.
**Cause:** removed in 19.
**Fix:** `createRoot(container).render(el)` from `react-dom/client`.

**Symptom:** `defaultProps` silently stops applying.
**Cause:** ignored on function components in 19.
**Fix:** default parameter values in the destructuring.

**Symptom:** `useFormState is not a function` when importing from `react`.
**Cause:** the old name lives in `react-dom`, the new one in `react`.
**Fix:** `import {useActionState} from 'react'`.

**Symptom:** `ViewTransition` is `undefined`.
**Cause:** experimental-only, despite appearing in official blog posts.
**Fix:** do not ship it. Use `document.startViewTransition` with `flushSync` if
you need the effect today.

**Symptom:** a library warns about peer dependencies on React 19.
**Cause:** its range predates 19.
**Fix:** check the library actually works before overriding the range — the
removals (string refs, legacy context, `findDOMNode`) break real libraries.

## Interview questions

**★ What are the headline features of React 19?**
Actions and the hooks around them (`useActionState`, `useOptimistic`,
`useFormStatus`), the `use` API for reading promises and context during render,
`ref` as an ordinary prop, document metadata hoisting, and resource preloading.
Server Components became stable API surface in the same cycle.

**★ What was removed in React 19?**
`ReactDOM.render`, `hydrate`, `unmountComponentAtNode`, `findDOMNode`,
`createFactory`, `renderToNodeStream`, string refs, legacy context, and
`propTypes`/`defaultProps` on function components.

**★ What did 19.2 add?**
`useEffectEvent`, `<Activity>`, `cacheSignal`, `captureOwnerStack`, and Partial
Pre-rendering (`prerender`/`resume`) — plus Performance Tracks in the browser
profiler.

**Is `useFormState` the same as `useActionState`?**
Same idea, old name. `useFormState` is still exported from `react-dom` in 19.2.8
and deprecated; `useActionState` in `react` is the current API.

**Did `createRoot` get removed from `react-dom` in 19?**
It was removed from the `react-dom` root export and now lives only in
`react-dom/client`. That is a move, not a deletion — unlike `render`, which is
genuinely gone.

---

← Prev: [Versions and channels](08-versions-and-channels.md) · Index: [Phase 0](README.md) · Next → [Starting a project](10-starting-a-project.md)
