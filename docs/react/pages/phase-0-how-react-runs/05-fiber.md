---
title: "Fiber"
sidebar_label: "05 · Fiber"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> 🧪 **Sandbox-proven** — every console block on this page came from a script that was
> actually run. Verified: 2026-08 against **react-dom 19.2.8** in **Firefox 153.0**, development
> build. The log is printed by `sandbox/react-p0/ex05-fiber.mjs`.
>
> **Nothing on this page is a public API.** `__reactFiber$…` is an internal
> implementation detail that can change in any release. It is shown because
> seeing the structure once makes React's behaviour concrete — not because you
> should reach for it.

**A fiber is React's internal record of one node in your tree: what it is, what
it rendered, what work it still owes. Fibers form a linked list, which is what
made rendering interruptible.**

## Why fibers exist

Before React 16, rendering was a recursive walk of the component tree. Recursion
uses the JavaScript call stack, and you cannot pause a call stack, save it, and
come back to it later. Once a render started, it ran to completion — a 50 ms
render meant 50 ms during which the browser could not respond to typing.

Fiber replaces the call stack with a data structure React owns. Each fiber links
to its child, its next sibling, and its parent, so React can walk the tree with
a loop rather than recursion — and a loop can stop after any step, hand control
back to the browser, and resume where it left off.

That capability is the foundation of everything in
[Phase 8](../../syllabus/03-concurrent-and-server.md): transitions, Suspense, and
time slicing all depend on "React can stop halfway through a render".

## The structure, read off a real page

React stores a pointer to the fiber on every DOM node it creates:

```console
$ node ex05-fiber.mjs
=== fiber, read off a real DOM node (development build) ===
  keys React adds to a DOM node:
    __reactFiber$rqg5ukh9ecd
    __reactProps$rqg5ukh9ecd
```

The random suffix is per-page, which is how two copies of React on one page
avoid colliding. Following `fiber.return` upwards reproduces your component tree
exactly:

```console
  walking UP from the first <li> via fiber.return:
    HostComponent  type="li"
      FunctionComponent  type=Row
        HostComponent  type="ul"
          FunctionComponent  type=List
            HostComponent  type="main"
              FunctionComponent  type=App
                HostRoot  type=null
```

Two fiber kinds appear there, and the distinction matters:

| `tag` | Name | `type` holds |
|---|---|---|
| `0` | `FunctionComponent` | your function — `Row`, `List`, `App` |
| `5` | `HostComponent` | a string — `"li"`, `"ul"`, `"main"` |
| `6` | `HostText` | a raw text node |
| `3` | `HostRoot` | the root created by `createRoot` |

"Host" means "belongs to the renderer". `react-dom` knows what `"li"` means;
`react` does not — the same tree under React Native would have host components
called `"View"`.

Children are a **linked list**, not an array:

```console
  children of <ul> via child/sibling (a linked list, not an array):
    [0] FunctionComponent type=Row
    [1] FunctionComponent type=Row
```

A fiber points to its *first* child only; the rest are reached through
`sibling`. That is what lets React remember "I was here" with a single pointer
when it pauses.

## Double buffering

React keeps up to **two** fiber trees: the one on screen, and the one being
built. They point at each other through `alternate`.

```console
  double buffering — before any update:
    ul.alternate = null

  after one update (list went from 2 items to 3):
    ul.alternate = a second fiber
    alternate.alternate === itself ? true
    <li> elements actually in the DOM = 3
    children on the fiber the DOM node points at = 2
    children on its alternate                    = 3
    => the DOM node's __reactFiber$ pointer is NOT re-pointed each render;
       one of the two alternates is the current tree, the other is last render.
```

Before the first update there is one tree, so `alternate` is `null`. After an
update there are two, and they reference each other — `a.alternate.alternate === a`.

The last three lines are the useful part. The DOM says three `<li>` elements
exist. The fiber the DOM node points at still describes **two**; its alternate
describes three. React reuses the two fiber objects alternately rather than
allocating a fresh tree each render, and the DOM node's pointer is not
re-targeted every time.

This is why "read the fiber to find out what's rendered" is a bad idea: you have
a 50 % chance of reading last render's tree. Use the DevTools, which know how to
find the current one.

## What this buys you in practice

You will never write `fiber.child`. What you take from this page is why certain
React behaviours are the way they are:

- **A render can be paused and resumed**, so a long render does not necessarily
  block typing — the basis of `startTransition` and `useDeferredValue`.
- **A render can be abandoned entirely.** React can build a work-in-progress
  tree, decide a more urgent update arrived, and throw it away. That is the
  mechanical reason your components must be
  [pure](03-render-reconcile-commit.md) — the work may happen more than once and
  produce nothing.
- **Commit is separate and synchronous.** Once React starts applying the finished
  tree, it does not stop; a half-applied DOM would be visible to the user.
- **State lives on the fiber, not in your function.** A function component has no
  instance, so "where does `useState` keep the value?" is answered here: in a
  linked list of hook records hanging off the fiber at that position in the tree.
  This is also why [hooks must be called in the same order every render](../../syllabus/02-hooks.md).

## Gotchas

**Symptom:** code reads `node.__reactFiber$…` and breaks after a React upgrade.
**Cause:** it is a private field with a per-page random suffix, no stability
guarantee, and no presence guarantee in future versions.
**Fix:** use a `ref` for the node, DevTools for inspection, and the public API
for everything else.

**Symptom:** a fiber walk reports stale children — the DOM has three items and
the fiber says two.
**Cause:** double buffering. The DOM node's fiber pointer may reference the
alternate rather than the current tree.
**Fix:** measured above; there is no correct fix from user code, which is the
point.

**Symptom:** "React is slow" when a single render takes 300 ms.
**Cause:** fibers make rendering *interruptible*, not *fast*. Splitting work
does not reduce it.
**Fix:** reduce the work — memoization, virtualization, or moving it off the
render path. See Phase 6.

## Interview questions

**★ What is Fiber?**
React's reimplementation of the reconciler, where each node of the tree is a
plain object (a fiber) holding its type, props, state and links to child,
sibling and parent. Replacing recursion with a data structure React owns is what
made rendering interruptible.

**★ Why did React need it?**
The old reconciler recursed, and a call stack cannot be paused. A long render
blocked the main thread until it finished. Fibers let React do a unit of work,
check whether something more urgent arrived, and either continue or abandon.

**What are the two fiber trees?**
`current` — what is on screen — and the work-in-progress tree being built. They
reference each other through `alternate`. React alternates between two sets of
fiber objects rather than allocating a new tree each render.

**Does Fiber make React faster?**
Not in total work. It makes rendering *schedulable*: high-priority updates can
interrupt low-priority ones, so the app stays responsive. A slow render is still
slow.

**Where does a function component's state actually live?**
On its fiber, as a linked list of hook records, keyed by call order — which is
exactly why hooks cannot be called conditionally.

---

← Prev: [Reconciliation](04-reconciliation.md) · Index: [Phase 0](README.md) · Next → [createRoot](06-createroot.md)
