---
title: "What React is"
sidebar_label: "01 · What React is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> 🧪 **Sandbox-proven** — every console block on this page came from a script that was
> actually run. Verified: 2026-08 against **react 19.2.8** and **react-dom 19.2.8** on Node
> 24.19.0. Every number below is printed by
> `sandbox/react-p0/ex01-two-packages.mjs`.

**React is not a framework and it does not touch your screen. It is a library
that computes a description of the UI. A separate package — a *renderer* —
takes that description and makes it real.**

That split is the reason `react` and `react-dom` are two installs, and almost
every "why does React do that?" answer starts here.

## Why it exists: describing instead of instructing

Without React you tell the browser what to *do*, step by step. You own every
transition between one screen state and the next.

```js
// imperative.js — the badge on a shopping cart, by hand
const badge = document.querySelector('#cart-badge');

function setCount(n) {
  badge.textContent = String(n);
  if (n === 0) {
    badge.hidden = true;
    badge.classList.remove('cart-badge--full');
  } else {
    badge.hidden = false;
    badge.classList.toggle('cart-badge--full', n >= 10);
  }
}
```

Every branch is a transition you had to think of. Forget the
`classList.remove` and the badge stays red after the cart empties — the classic
bug where the UI reflects a state the data left three clicks ago.

React inverts it. You write what the UI *is* for a given value, and never write
a transition at all:

```jsx
// Declarative.jsx — the same badge
function CartBadge({count}) {
  if (count === 0) return null;
  return (
    <span className={count >= 10 ? 'cart-badge cart-badge--full' : 'cart-badge'}>
      {count}
    </span>
  );
}
```

There is no "remove the class" step because there is no step. `count` changes,
React computes the new description, compares it with the old one, and performs
whatever DOM operations that difference implies.

**The trade-off, stated plainly:** you give up direct control of the DOM and you
pay for a diff on every update. You get code where the number of states you must
reason about is the number of values, not the number of paths between them.

## The two packages

`react` is the part that knows about components, elements, state and hooks. It
does not know what a DOM is.

```console
$ node ex01-two-packages.mjs

=== versions ===
  react      19.2.8
  react-dom  19.2.8
  node       v24.19.0

=== react exports — the whole public surface ===
  Activity Children Component Fragment Profiler PureComponent StrictMode Suspense
  act cache cacheSignal captureOwnerStack cloneElement createContext createElement
  createRef forwardRef isValidElement lazy memo startTransition
  unstable_useCacheRefresh use useActionState useCallback useContext useDebugValue
  useDeferredValue useEffect useEffectEvent useId useImperativeHandle
  useInsertionEffect useLayoutEffect useMemo useOptimistic useReducer useRef
  useState useSyncExternalStore useTransition version
  (42 public exports)

=== does `react` know how to put anything on screen? ===
  typeof React.render                                  undefined
  typeof React.createRoot                              undefined
  typeof React.createElement                           function
  'document.createElement' anywhere in react's source  false
```

That last line is the whole point, and it is a substring search over React's
own source rather than an opinion: **the string `document.createElement` does
not occur in the `react` package.** React cannot create a DOM node. It has no
code for it.

`react-dom` is the renderer that can, and it is split by where you are running:

```console
=== react-dom entry points ===
  react-dom          createPortal flushSync preconnect prefetchDNS preinit
                     preinitModule preload preloadModule requestFormReset
                     unstable_batchedUpdates useFormState useFormStatus version
  react-dom/client   createRoot hydrateRoot version
  react-dom/server   renderToPipeableStream renderToReadableStream
                     renderToStaticMarkup renderToString resume
                     resumeToPipeableStream version
  react-dom/static   prerender prerenderToNodeStream resumeAndPrerender
                     resumeAndPrerenderToNodeStream version
```

`react-dom/client` has exactly two functions worth knowing —
[`createRoot` and `hydrateRoot`](06-createroot.md). Everything about the server
entry points is [Phase 11](../../syllabus/03-concurrent-and-server.md).

The size difference says which package is doing the hard work:

```console
=== installed size on disk ===
  react/      168 KB
  react-dom/  7148 KB
  ratio       42.7×
```

React's own model is small. Making it real in a browser — events, hydration,
streaming, the DOM property tables — is forty times larger.

## Renderer, not "the DOM part"

`react-dom` is one renderer among several. The same `react` package drives:

| Renderer | Renders to |
|---|---|
| `react-dom` | The browser DOM, and HTML on the server |
| `react-native` | Native iOS and Android views |
| `@react-three/fiber` | A WebGL scene graph |
| `ink` | A terminal |

None of these are "React with extra steps" — they are the *same* React, with a
different thing playing the part `react-dom` usually plays. That is only
possible because `react` never assumed a DOM in the first place.
[Page 13](./13-other-renderers.md) covers this properly.

## The version-match rule

```console
=== the version-match rule ===
  react-dom peerDependencies.react  ^19.2.8
  react-dom version                 19.2.8
```

`react-dom` declares a peer dependency on a matching `react`. The two packages
share private internals that are **not** a stable API between versions, so a
mismatch is not "mostly fine" — it is undefined behaviour that usually surfaces
as an incomprehensible error deep inside the renderer.

**Upgrade them together, always, and pin them to the same version.**

## Gotchas

**Symptom:** `TypeError: Cannot read properties of null (reading 'useState')`, or
`Invalid hook call. Hooks can only be called inside of the body of a function
component.`
**Cause:** two copies of `react` in the tree — commonly a linked local package,
or a dependency that put `react` in `dependencies` instead of `peerDependencies`.
Hook state lives in module-level internals, so a component from copy A calling
hooks resolved from copy B finds nothing.
**Fix:** `npm ls react` and confirm exactly one version. For a linked package,
add `react` to its `peerDependencies` and dedupe.

**Symptom:** `Module not found: Can't resolve 'react-dom/client'` after
following a tutorial.
**Cause:** the tutorial targets React 17 or earlier, where the entry point was
`react-dom` itself.
**Fix:** import `createRoot` from `react-dom/client`. `ReactDOM.render` was
removed in React 19 — see [page 06](06-createroot.md).

**Symptom:** you upgraded `react` but the app behaves as if you did not.
**Cause:** `react-dom` is still on the old version and it is `react-dom` that
implements almost all runtime behaviour.
**Fix:** upgrade both, then check `require('react-dom').version` at runtime
rather than trusting `package.json`.

## Interview questions

**★ Why are `react` and `react-dom` separate packages?**
Because `react` describes UI and knows nothing about where it will be shown.
Keeping the renderer separate is what lets React Native, `react-three-fiber` and
the server renderers exist without forking React. The concrete evidence is that
`document.createElement` appears nowhere in the `react` package.

**★ What does it mean that React is "declarative"?**
You write what the UI should be for the current data, not the operations that
move it from the previous UI to the next one. You never write "remove that
class" — you describe the state where the class is absent, and React derives the
operations by comparing descriptions.

**What is the cost of the declarative model?**
A diff on every update, and losing direct control of the DOM. You trade CPU and
some escape-hatch friction (refs, portals, imperative third-party widgets) for
not having to enumerate transitions between states.

**Can you use React without `react-dom`?**
Yes — with any other renderer. What you cannot do is use `react` alone and see
anything, because `react` has no `render` function at all: `typeof React.render`
is `undefined`.

**★ What happens if `react` and `react-dom` versions do not match?**
Undefined behaviour. They share private internals that are not a versioned API.
`react-dom` declares `peerDependencies.react: "^19.2.8"` precisely so the package
manager warns you. In practice it shows up as a confusing crash inside the
renderer, or as duplicate-React hook errors.

**Why is `react-dom` forty times bigger than `react` on disk?**
Because everything hard about the browser lives there: the synthetic event
system, DOM property and attribute tables, hydration, and four separate server
rendering entry points. React's own model — elements, hooks, reconciliation
policy — is genuinely small.

---

Index: [Phase 0 — How React runs](README.md) · Next → [The element](02-the-element.md)
