---
title: "Where interactivity goes"
sidebar_label: "11 · Where interactivity goes"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`'use client'`](https://react.dev/reference/rsc/use-client) (the transitive rule, the
> "output rather than source code" note, the container example, and the list of React APIs
> that force client evaluation) and
> [Server Components](https://react.dev/reference/rsc/server-components) (composing with
> Client Components).
> No sandbox script backs this page; claims are cited, not measured.

**The design skill of this phase, and it is one rule applied repeatedly: push `'use client'`
down to the leaves that genuinely need state.** Not because fewer client components is a
virtue, but because the cost of a directive is the size of the subtree beneath it
([topic 02](02-two-module-graphs.md)).

## Why height is the cost driver

A `'use client'` file is an entry point, and the bundler ships its transitive closure:

> **Code that is marked for client evaluation is not limited to components. All code that is
> a part of the Client module sub-tree is sent to and run by the client.**

So two files with identical contents cost wildly different amounts depending on where they
sit:

```
app/page.js  'use client'          ← everything below ships
 ├── Header  → Nav → icon library
 ├── Article → markdown renderer → syntax highlighter
 └── Toolbar → Button (needs useState)   ← the only thing that needed it
```

versus

```
app/page.js                        ← server
 ├── Header  → Nav → icon library  ← server
 ├── Article → markdown renderer   ← server
 └── Toolbar
      └── Button  'use client'     ← only this ships
```

Same UI. In the first, the markdown renderer and the syntax highlighter are in the browser's
bundle; in the second the browser receives their **output**
([topic 03](03-use-client.md)). Nothing about the components changed — only the height of the
directive.

⚠️ **"Fewer client components" is the wrong goal.** Many small entry points are usually
cheaper than one high one: each closure is small, and shared dependencies deduplicate. Aim
lower, not fewer.

## The moves that lower a boundary

### 1. Extract the stateful part

The most common fix, and usually a one-file change.

```jsx
// Before: the whole page is client because of one toggle
'use client';
export default function Page({ data }) {
  const [open, setOpen] = useState(false);
  return <><Report data={data} /><button onClick={() => setOpen(!open)}>…</button></>;
}
```

```jsx
// After: only the toggle is client
export default function Page({ data }) {          // server
  return <><Report data={data} /><Toggle /></>;
}
```

### 2. Pass content through as `children`

When the interactive thing must *wrap* server content, invert the composition
([topic 07](07-server-components-as-children.md)) instead of pulling the content client-side.
This is what makes the extraction possible in the awkward cases — tabs, accordions, modals,
resizable panes.

### 3. Push data access up

> **`CounterContainer` does not require `'use client'` as it is not interactive and does not
> use state. In addition, `CounterContainer` must be a Server Component as it reads from the
> local file system on the server.**

The documented shape: read on the server, hand a serializable prop to the interactive leaf.
Data access above, interactivity below, boundary at the join.

### 4. Move the handler, not the component

A third-party component that only needs an `onClick` does not require its consumer to become
client code — a one-file wrapper defines the handler where it can legally exist
([topic 03](03-use-client.md)).

## Where the boundary genuinely belongs high

Lowering is a default, not a dogma. Some things are legitimately near the root:

- **Providers.** A theme, a store or a router provider is a `'use client'` file that wraps
  the tree — but it should be **thin**, and the tree below it passes through as `children`,
  which keeps that content on the server ([topic 10](10-composition-rules.md)).
- **Genuinely app-wide interaction** — a drag-and-drop surface, a canvas, a live editor. If
  the interaction spans the page, the client boundary spans the page. That is a real answer,
  and [topic 17](17-when-rsc-is-wrong.md) is about recognising when it is the *whole* answer.
- **A component that already had to be client** for one of the documented reasons —
  `createContext`, hooks other than `use` and `useId`, `forwardRef`, `memo`,
  `startTransition`, or a browser API ([topic 03](03-use-client.md)). Fighting that list
  wastes effort.

## How to find the boundaries you have

In order of how much they tell you:

1. **Grep for the directive.** `grep -rl "use client" src/` gives you every entry point. If
   the list is short and the files are large, the boundaries are probably too high.
2. **Look at what each one imports**, transitively. That is the actual cost.
3. **Read the bundle analyzer.** A library you believed was server-only appearing in the
   client build is a boundary in the wrong place.
4. **Search the built bundle for a distinctive string** from a file you expect to be
   server-only. This is the check that settles it ([topic 02](02-two-module-graphs.md)).

⚠️ **Measure before and after.** "Moving the directive down saved 200 KB" is a claim you can
verify in a bundle report in minutes, and it is the only form of this argument worth making
in a code review.

## The shape a well-arranged page has

```
Page                     server   — awaits data
├── Header               server   — static
├── ArticleBody          server   — heavy rendering, zero client cost
├── Comments             server   — awaits its own data, own Suspense boundary
│   └── LikeButton       CLIENT   — useState + a Server Function
└── SettingsPanel        CLIENT   — genuinely interactive
    └── {children}       server   — passed through
```

**Interactive leaves, server everything else, data fetched where it is used.** Every rule in
this phase is visible in that tree, which is why it is the shape to aim for before reaching
for anything cleverer.

## Gotchas

**Symptom:** the bundle grew far more than the feature justified.
**Cause:** the directive went on a file whose import subtree is large.
**Fix:** extract the stateful part into a leaf, and pass the rest through as `children`.

**Symptom:** an effort to "reduce the number of client components" made the bundle bigger.
**Cause:** merging entry points raises them. Cost is the closure, not the count.
**Fix:** aim lower, not fewer.

**Symptom:** the whole page had to become client because a wrapper needed state.
**Cause:** the content was imported by the wrapper instead of passed to it.
**Fix:** invert the composition ([topic 07](07-server-components-as-children.md)).

**Symptom:** a provider near the root pulled everything client-side.
**Cause:** the provider file imports more than the provider, or the tree is nested inside it
by import rather than passed as `children`.
**Fix:** make the provider file thin and pass the tree through.

**Symptom:** a component was refactored to remove `memo` so it could stay on the server, and
nothing improved.
**Cause:** `memo` is a client-forcing API, but if the component was already in the client
graph transitively, removing it changes nothing.
**Fix:** find the real importer first.

**Symptom:** a claimed saving cannot be reproduced.
**Cause:** the change was reasoned about rather than measured.
**Fix:** bundle report before and after; grep the built output for a distinctive string.

## Interview questions

**★ What is the actual cost of a `'use client'` directive?**
The transitive closure of the file it is on — all code in that client module subtree is sent
to and run by the client, components or not. So the same directive costs almost nothing on a
button and a great deal on a page. Height in the tree is the cost driver, not the number of
directives.

**★ Is it better to have fewer client components?**
No. Many small entry points are usually cheaper than one high one, because each closure is
small and shared dependencies deduplicate. Consolidating client components tends to raise the
boundary, which is the thing that actually costs.

**★ How do you lower a boundary that seems stuck?**
Extract the stateful part into a leaf; pass server-rendered content through as `children`
rather than importing it; move data access up into a Server Component that hands down a
serializable prop; and for third-party components that only need a handler, wrap them in a
one-file Client Component instead of converting the consumer.

**★ When should a client boundary be high?**
For a thin provider that wraps the tree — with the tree passed through as `children` so it
stays on the server; for interaction that genuinely spans the page, like a canvas or an
editor; and for components already forced client-side by `createContext`, hooks other than
`use` and `useId`, `forwardRef`, `memo`, `startTransition`, or a browser API.

**How would you audit an app's boundaries?**
Grep for the directive to list every entry point, look at what each imports transitively,
read the bundle analyzer for libraries that should not be there, and grep the built bundle
for a string from a file you expect to be server-only. The first three are inference; the
last is evidence.

**What does a well-arranged RSC page look like?**
Data fetched in Server Components where it is used, each independent region behind its own
Suspense boundary, heavy rendering on the server, and small client leaves for the parts that
own state — with server content passed through any interactive wrapper as `children`.

---

← Prev: [Composition rules](10-composition-rules.md) ·
Index: [Phase 10](README.md) ·
Next → [The December 2025 advisories](12-december-2025-advisories.md)
