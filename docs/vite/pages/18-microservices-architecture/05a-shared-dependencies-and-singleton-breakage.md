---
title: "The shared key is where Module Federation stops being a bundler feature and becomes a distributed-systems problem, because two copies of React loaded in one page is a correctness bug, not a size regression"
sidebar_label: "05a · Shared deps and singletons"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against [Module Federation — Vite integration](https://module-federation.io/integrations/build-tool/vite.html) and package facts from **registry.npmjs.org**, fetched 2026-09-08. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+ · `@module-federation/vite` 1.21.5**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**Continues [05](05-module-federation-on-vite.md), which named `shared` as the deepest and
most failure-prone of the federation config keys. Here is why: `shared` is not a bundle-size
optimisation, even though it looks like one and is usually introduced as one. It is the
mechanism that decides whether the host and a remote — two independently built, independently
deployed JavaScript bundles — end up running the *same instance* of React, the same router,
the same context object, or two silently divergent ones. Get it wrong and nothing throws a
config error; the app renders, and then behaves as if two unrelated apps happen to share a
browser tab.**

## The failure catalogue — symptom first

Every entry here has the same root cause, covered in the next section. They're listed
separately because each one arrives at a different layer of the stack and does **not** look
like a shared-dependency bug when you're staring at it.

**Hooks throw `Invalid hook call`.** A component rendered by the remote calls
`useState` or `useContext`, and React's own internal invariant check fails — even though the
component runs correctly when the remote is loaded standalone, outside the host. Nothing in
the component changed between those two cases.

**A context `Provider` set up in the host is invisible to the remote's `useContext`.** The
remote is definitely wrapped inside the host's `<ThemeProvider>` in the React tree — you can
see it in the DevTools component tree — and the remote's `useContext(ThemeContext)` still
returns the default value as if no provider existed above it.

**A router's navigation in the remote doesn't update the host's URL bar or vice versa.**
Both host and remote appear to be using `react-router-dom`, both render correctly in
isolation, but navigating inside the federated remote leaves the host's own route state
(and often the browser's address bar) unchanged, as though the two are driving separate
histories.

**A CSS-in-JS library's styles render inconsistently or duplicate.** A library like
`styled-components` or `emotion` that keeps an internal style-injection cache produces
either missing styles, duplicated `<style>` tags, or specificity fights that look like a CSS
bug, not a JavaScript one.

**A state store silently forks.** A Redux store, a Zustand store, or any singleton created
by calling a factory function once at module scope — the host reads one set of values, the
remote reads and writes a completely different set, and nothing anywhere throws; the two
halves of the app simply stop agreeing about application state.

## The mechanism — module identity is per-instance, and federation makes two instances by default

Every one of those symptoms has the same cause: **without `shared`, `checkout` bundles its
own private copy of `react`, `react-dom`, `react-router-dom`, whatever CSS-in-JS library it
imports, and whatever module holds its state store — exactly as if `checkout` were a
standalone app, because as far as its own build is concerned, it is one.** `shell` does the
same, independently. When the host loads the remote's chunk into the same page, the browser
now has two separate module instances of the same package coexisting in one JavaScript
realm.

That matters because none of the symptoms above are about *values* being different — they're
about **identity**. A React `Context` object created by `createContext()` is a specific
object; `useContext` walks the fibre tree looking for a `Provider` whose `context` reference
is `===` the one the calling `useContext` closed over. If the host's `ThemeProvider` was
created from the host's own copy of the `react` module, and the remote's `useContext` call
was compiled against the remote's own separate copy of `react`, the two `Context` objects are
different objects with the same shape and the same name — and `===` fails. The provider is
"in the tree" by DOM inspection and invisible by identity check.

`Invalid hook call` follows the same shape one layer lower: React's hooks are backed by a
dispatcher React attaches to its own internal renderer instance. A component evaluated by
one copy of `react-dom`, calling `useState` from a *different* copy of `react`, is asking a
renderer that never mounted it for hook state it doesn't have a record of — which is exactly
the situation React's own invariant is designed to catch and reject.

Router history duplication, CSS-in-JS double caches, and forked stores are the same story
with different singletons: each of those libraries relies on exactly one module-scope
instance existing per page, and unshared federation silently hands them two.

## The controls — `singleton`, `requiredVersion` / `strictVersion`, `eager`

`shared` config per package looks like this:

```ts
shared: {
  react: {
    singleton: true,
    requiredVersion: '^18.2.0',
    strictVersion: true,
    eager: false,
  },
  'react-dom': {
    singleton: true,
    requiredVersion: '^18.2.0',
    strictVersion: true,
    eager: false,
  },
},
```

- **`singleton: true`** — the fix for every symptom above. It tells the federation runtime
  that only one instance of this package may exist across the host and every remote loaded
  into the same page; when a second consumer tries to load its own copy, the runtime hands it
  the already-loaded instance instead. This is what makes the `Context` object, the React
  dispatcher, the router's history, and the store all become the single shared object the
  symptom catalogue depends on not existing in duplicate.

- **`requiredVersion`** — the semver range this build declares it needs. It's the input to
  the runtime's version negotiation: when host and remote both declare `react` as shared,
  the runtime picks an instance that satisfies both declared ranges (in practice, usually
  whichever side loaded first and satisfies the range, or the highest version that satisfies
  every declared range — the negotiation exists specifically because host and remote were
  built separately and may declare different ranges).

- **`strictVersion`** — what happens when negotiation *can't* find a version satisfying every
  side's `requiredVersion`. Without it, a mismatch is a warning and the runtime loads
  something anyway — which is precisely how you get a component silently rendered against a
  React minor it wasn't tested with, with no error anywhere in the console a CI pipeline
  would fail on. With `strictVersion: true`, an unsatisfiable range is a **hard failure that
  stops the module from loading** instead. That trade is almost always worth making
  deliberately: a loud failure that blocks a broken deploy from rendering at all is cheaper
  to diagnose than a silent wrong render that only shows up as a vague bug report days later.

- **`eager: false`** (the default) — the shared module is fetched and resolved as part of
  the federation runtime's async negotiation, which is exactly the mechanism behind the
  `build.target: 'chrome89'` top-level-await requirement covered on
  [05](05-module-federation-on-vite.md). **`eager: true`** bundles the dependency directly
  into this build synchronously instead of negotiating it at runtime — necessary when the
  package is needed before the async negotiation can resolve (typically the host's own entry
  point, which has nothing to negotiate against yet). Setting `eager: true` on *every*
  consumer of a shared package defeats the point of sharing it at all: each eager consumer
  ships and evaluates its own bundled copy, which is precisely the duplicate-instance
  situation `singleton` exists to prevent. Eager is for the one side that genuinely runs
  before negotiation is possible, not a default.

The versioning problem `shared` creates once host and remote actually diverge — and what
the integration page leaves unspecified about Vite's own pre-bundling — continues on
[05a2](05a2-shared-dependency-versioning-and-the-optimizedeps-gap.md).

## Gotchas

**★ Symptom: `Invalid hook call` thrown by a component that works fine when the remote is
loaded standalone.** Cause: `react` and/or `react-dom` aren't declared `shared`, so the host
and the remote each bundle a private copy; the component's hooks run against a dispatcher
from a `react-dom` instance that never mounted it. Fix: add both `react` and `react-dom` to
`shared` with `singleton: true` on every app in the federation graph — host and every remote
— not just the one that threw.

**★ Symptom: a `Provider` set up in the host is visibly an ancestor in the React DevTools
tree, but the remote's matching `useContext` call returns the default value anyway.**
Cause: the `Context` object itself was created by a different module instance in the host
than the one the remote's `useContext` closed over — two objects, same shape, different
identity, and React's context lookup is an identity comparison, not a structural one. Fix:
whatever package defines the context (React itself, or a design-system package that exports
its own context) needs `singleton: true` in `shared` on both sides, not just the packages
that obviously look like "dependencies."

**Symptom: navigating inside the federated remote doesn't update the host's address bar,
or vice versa.** Cause: the router package (commonly `react-router-dom`) wasn't shared, so
host and remote hold two separate `history` instances, each unaware of the other's
navigation. Fix: add the router package to `shared` with `singleton: true`; if the two apps
intentionally run independent navigation (a remote that's meant to be navigable on its own,
outside the host), this may be the correct behaviour and not a bug — decide deliberately
rather than by default.

**Symptom: a CSS-in-JS library renders duplicated `<style>` tags or produces specificity
conflicts only when the remote is loaded inside the host.** Cause: the styling library keeps
an internal singleton cache (a style sheet, an insertion point) per module instance; two
unshared copies mean two caches independently inserting styles into the same document. Fix:
share the CSS-in-JS package itself with `singleton: true`; if the library exposes an
explicit "eager" or synchronous initialisation requirement (common for style-insertion
libraries that need to run before first paint), this is one of the legitimate cases for
`eager: true` on that specific package rather than the default async negotiation.

**Symptom: a Redux or Zustand store silently reads and writes different data depending on
which "half" of the app touched it.** Cause: the module that calls `createStore()` /
`create()` ran twice — once per unshared module instance — producing two independent store
objects instead of one. Fix: share the module that constructs the store (not just the
library the store is built from) with `singleton: true`, so both host and remote resolve to
the same constructed instance, not just the same library code.

**Symptom: bundle size for a "shared" dependency doesn't actually shrink, and duplicate
code still ships to every remote.** Cause: `eager: true` was set on every consumer instead
of only the one side that genuinely needs synchronous access before negotiation can run
(typically the host's own bootstrap). Eager consumers bundle their own copy rather than
negotiating a shared one; setting it everywhere reproduces the exact duplicate-instance
problem `shared` exists to prevent. Fix: default to `eager: false` (async negotiation) on
every consumer and reserve `eager: true` for the one side that has a real synchronous
ordering requirement.

## Interview questions

**★ Why does loading a federated remote without `shared: { react: { singleton: true } }`
produce an `Invalid hook call` error specifically, rather than some more generic failure?**
Because React hooks are backed by a dispatcher attached to a specific `react-dom` renderer
instance, and without sharing, the remote bundles its own private copy of `react-dom`
independent of the host's. A component compiled against one copy of `react` calling hooks
that get routed to a *different* copy's dispatcher is exactly the situation React's internal
invariant checks are built to reject — it isn't that hooks "don't work" across federation, it's
that two separate React installations exist in one page and each only knows about its own
component tree.

**★ Why can a context `Provider` be a visible ancestor in the DOM/component tree and still
be invisible to a `useContext` call in the same tree?**
Because `useContext` matches a `Provider` by object identity on the `Context` object, not by
name or shape. If the `Context` was created by a module instance the host loaded privately,
and the consuming component's `react` import resolved to the remote's own separate instance,
the two `createContext()` calls produced two different objects that happen to look
identical. The DOM tree shows nesting; the identity check that actually matters fails
silently, returning the context's default value with no error.

**What's the practical difference between `requiredVersion` and `strictVersion`, and why
would a production config want `strictVersion: true` even though it makes deploys *more*
likely to fail loudly?**
`requiredVersion` is the semver range this build declares it needs; on its own, if that
range can't be satisfied by what negotiation resolves, the runtime warns and loads something
anyway — a silent, hard-to-trace wrong-version render. `strictVersion: true` turns that same
unsatisfiable-range case into a hard failure that blocks the module from loading. Preferring
the loud failure is deliberate: a broken federation pairing that refuses to render is
immediately attributable to a named package and version range, while a silent wrong render
surfaces later as a vague, hard-to-reproduce bug report with no error to search for.

**When is `eager: true` the correct setting, and what does applying it everywhere cost?**
It's correct for the one consumer that needs the shared package synchronously before the
federation runtime's async negotiation can resolve anything — typically the host's own entry
point, before any remote has been fetched. Applying it to every consumer defeats sharing
entirely: each eager consumer bundles its own private copy instead of negotiating a shared
instance, reproducing exactly the multiple-instance problem `singleton` exists to prevent,
while also giving up the async-loading benefit `shared` is usually adopted for in the first
place.

---

{/* FOOTER */}
