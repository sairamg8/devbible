---
title: "createRoot and root.render"
sidebar_label: "06 · createRoot"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> 🧪 **Sandbox-proven** — every console block on this page came from a script that was
> actually run. Verified: 2026-08 against **react-dom 19.2.8** in **Firefox 153.0**, development
> build. Every error string is captured from the page by
> `sandbox/react-p0/ex06-createroot.mjs`.

**`createRoot` connects a React tree to one DOM element. It is the only way in
for a client-rendered app, and the React 17 entry point it replaced was removed
outright in React 19.**

## The whole API

```jsx
// main.jsx — a complete client entry point
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Three things: get a container, make a root, render into it. The root has exactly
two methods.

```console
$ node ex06-createroot.mjs
=== the normal path ===
  createRoot returned an object with: _internalRoot
  typeof root.render   = function
  typeof root.unmount  = function
  after render, DOM = "<h1>hello Ada</h1>"
```

`_internalRoot` is private. `render` and `unmount` are the API.

## The React 19 removals

This is the most common upgrade failure, because every tutorial written before
2022 uses the old call:

```console
=== what react-dom still exports (19.2.8) ===
  typeof ReactDOM.render        = undefined
  typeof ReactDOM.hydrate       = undefined
  typeof ReactDOM.findDOMNode   = undefined
  typeof ReactDOM.unmountComponentAtNode = undefined

=== calling the React 17 API on React 19 ===
  ReactDOM.render(<App/>, root) -> TypeError: ReactDOM.render is not a function
```

They are not deprecated-with-a-warning. They are gone.

| React ≤ 17 | React 19 |
|---|---|
| `ReactDOM.render(el, container)` | `createRoot(container).render(el)` |
| `ReactDOM.hydrate(el, container)` | `hydrateRoot(container, el)` |
| `ReactDOM.unmountComponentAtNode(c)` | `root.unmount()` |
| `ReactDOM.findDOMNode(inst)` | a `ref` |

Note the **argument order flipped** for hydration: `render` takes the element
first, `hydrateRoot` takes the container first.

## `render` updates; it does not remount

Calling `root.render()` again on the same root is an ordinary update — the tree
is reconciled, and state is preserved wherever
[reconciliation](04-reconciliation.md) says it should be.

```console
=== rendering again on the SAME root updates, not remounts ===
  after second render, DOM = "<h1>hello Grace</h1>"
```

You rarely call it twice. It is state inside `App` that drives updates, not
repeated `root.render` calls.

## One root per container

```console
=== calling createRoot twice on the same container ===
  [error] You are calling ReactDOMClient.createRoot() on a container that has
  already been passed to createRoot() before. Instead, call root.render() on the
  existing root instead if you want to update it.
```

Ignore that warning and two roots each believe they own the same DOM element.
When they tear down, they try to remove nodes the other already removed:

```console
=== unmount ===
  after unmount, DOM = ""
  [pageerror] Error: NotFoundError: Node.removeChild: The node to be removed is
  not a child of this node
```

That `NotFoundError` is what the warning is protecting you from. It is a common
symptom in apps that hot-reload their entry module, or that mount React inside a
non-React page more than once.

**Fix:** keep the root in a module-level variable and reuse it.

```jsx
// Safe to re-execute — a hot reload will not create a second root.
const container = document.getElementById('root');
const root = (container._reactRoot ??= createRoot(container));
root.render(<App />);
```

## The container must exist

```console
=== the container has to exist ===
  createRoot(document.getElementById('nope')) -> Error: Target container is not
  a DOM element.
```

`getElementById` returns `null` when the element is missing, and `createRoot`
rejects it. This is almost always one of: a typo in the id, a `<script>` in
`<head>` without `defer`, or an `index.html` whose `<div id="root">` was renamed.

## After unmount, the root is dead

```console
  after unmount, DOM = ""
  root.render(<App/>) after unmount -> Error: Cannot update an unmounted root.
```

`unmount()` runs every cleanup function and empties the container. The root
object cannot be reused — create a new one.

You need this when React is one widget inside a larger non-React page, and
whatever owns that page is disposing of your section.

## Error handling options

`createRoot` takes a second argument, and this is where you wire up error
reporting for the whole tree (React 19):

```jsx
const root = createRoot(container, {
  onUncaughtError: (error, errorInfo) => {
    reportToSentry(error, {componentStack: errorInfo.componentStack, handled: false});
  },
  onCaughtError: (error, errorInfo) => {
    reportToSentry(error, {componentStack: errorInfo.componentStack, handled: true});
  },
  onRecoverableError: (error) => {
    reportToSentry(error, {recoverable: true});
  },
});
```

| Option | Fires when |
|---|---|
| `onUncaughtError` | An error reached the root with no error boundary catching it |
| `onCaughtError` | An error boundary caught it |
| `onRecoverableError` | React recovered by itself — most often a hydration mismatch |

Covered properly in Phase 14; the point here is that the hook for it is on
`createRoot`, which is easy to miss.

## Gotchas

**Symptom:** `TypeError: ReactDOM.render is not a function`.
**Cause:** React 19 removed it; you are following pre-2022 material.
**Fix:** `createRoot(container).render(el)` from `react-dom/client`.

**Symptom:** `Error: Target container is not a DOM element.`
**Cause:** the container is `null` — wrong id, or the script ran before the
element existed.
**Fix:** check the id; load the script with `defer` or from the end of `<body>`.

**Symptom:** `NotFoundError: Node.removeChild: The node to be removed is not a
child of this node`, usually after a hot reload.
**Cause:** two roots on one container, each trying to clean up the same nodes.
**Fix:** create the root once and cache it.

**Symptom:** `Error: Cannot update an unmounted root.`
**Cause:** reusing a root after `unmount()`.
**Fix:** call `createRoot` again for a fresh one.

**Symptom:** effects run twice on startup and you are told to "remove
StrictMode".
**Cause:** that is StrictMode doing its job, not a bug in `createRoot`.
**Fix:** see [page 07](07-strictmode.md) — fix the effect, keep StrictMode.

## Interview questions

**★ How do you mount a React app in React 19?**
`createRoot(container)` from `react-dom/client`, then `root.render(<App/>)`.
`ReactDOM.render` was removed in 19 and throws `TypeError: ReactDOM.render is
not a function`.

**★ What is the difference between `createRoot` and `hydrateRoot`?**
`createRoot` builds the DOM from scratch and ignores whatever is in the
container. `hydrateRoot` expects server-rendered HTML already there and attaches
event handlers and state to the existing nodes instead of recreating them. Note
the argument order differs.

**What happens if you call `createRoot` twice on the same element?**
React logs an error telling you to call `render` on the existing root. If you
proceed, two roots own the same DOM and unmounting produces
`NotFoundError: Node.removeChild`.

**What does `root.unmount()` do?**
Runs all cleanup functions, unmounts the tree and empties the container. The
root is then unusable — rendering into it throws `Cannot update an unmounted
root.`

**Where do you catch errors for a whole React app?**
The `createRoot` options: `onUncaughtError`, `onCaughtError` and
`onRecoverableError`. Error boundaries handle recovery in the UI; these three
are how you get the report out.

---

← Prev: [Fiber](05-fiber.md) · Index: [Phase 0](README.md) · Next → [StrictMode](07-strictmode.md)
