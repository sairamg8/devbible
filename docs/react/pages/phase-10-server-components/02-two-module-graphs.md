---
title: "The two module graphs"
sidebar_label: "02 · The two module graphs"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`'use client'`](https://react.dev/reference/rsc/use-client) (the boundary in the module
> dependency tree, the render walk, all six caveats, and "all code that is a part of the
> Client module sub-tree") and
> [Server Components](https://react.dev/reference/rsc/server-components).
> No sandbox script backs this page; claims are cited, not measured.

**Almost every confusing RSC error is really a question about which graph a file is in.**
Not "is this a Server Component or a Client Component" as a property of the component, but
*which module subtree does this file belong to* — because that is what React and the
bundler actually compute.

## Two trees, and they are not the same tree

React's own vocabulary distinguishes them, and you have to as well.

| | **Module dependency tree** | **Render tree** |
|---|---|---|
| Nodes are | files | component instances |
| Edges are | `import` statements | a component rendering another |
| Fixed at | build time | run time, and it changes |
| Decides | **which graph a file is in** | what the user sees |

> **`'use client'` introduces a server-client boundary in the module dependency tree,
> effectively creating a subtree of Client modules.**

**The boundary lives in the import graph, not in the render tree.** That one sentence
resolves most of the confusion, because the two trees disagree constantly: a Server
Component can render a Client Component that renders a Server Component passed to it as
`children` ([topic 07](07-server-components-as-children.md)), which looks like the boundary
being crossed twice — and in the module graph nothing of the sort happened.

## The rule, and it is transitive

> **A component usage is considered a Client Component if it is defined in module with
> `'use client'` directive or when it is a transitive dependency of a module that contains a
> `'use client'` directive. Otherwise, it is a Server Component.**

Two halves, and the second is the expensive one.

```
app/page.js                 ← no directive → server graph
 ├── lib/db.js              ← imported only from server → server graph
 ├── ui/Chart.js  'use client'   ← THE DOOR
 │    ├── lib/format.js     ← client graph (pulled in transitively)
 │    └── node_modules/d3   ← client graph (pulled in transitively)
 └── ui/Header.js           ← no directive → server graph
```

`lib/format.js` never asked to be client code. It has no directive, its author may never
have thought about RSC, and it is in the client graph anyway — because `Chart.js` imports
it. **You place one directive; the bundler computes the closure.**

And the closure is not limited to components:

> **Code that is marked for client evaluation is not limited to components. All code that
> is a part of the Client module sub-tree is sent to and run by the client.**

Helpers, constants, validation schemas, a date library, an entire SDK — if it is reachable
by import from a `'use client'` module, it ships. This is the mechanism behind "one careless
directive doubled our bundle", and it is why [topic 11](11-where-interactivity-goes.md)
argues for pushing the directive **down** to leaves rather than up to pages.

## What the render walk actually does

> **During render, the framework will server-render the root component and continue through
> the render tree, opting-out of evaluating any code imported from client-marked code. The
> server-rendered portion of the render tree is then sent to the client. The client, with
> its client code downloaded, then completes rendering the rest of the tree.**

Read it as three steps:

1. **Walk from the root**, evaluating server-graph components normally.
2. **Stop at every client-marked import.** React does not evaluate it — it records a
   *reference* to it, plus the props it was given.
3. **Ship the walked part.** The browser downloads the client modules, and finishes the
   tree from those reference points.

So a Client Component's *placement* is decided on the server and its *body* is decided in
the browser. That split is exactly why props must be serializable
([topic 05](05-what-crosses-the-boundary.md)) — the props were computed on one side of a
network hop and the function that consumes them runs on the other.

## Four caveats that only make sense once you see the graph

### `'use client'` inside the client graph does nothing

> **When a `'use client'` module is imported from another client-rendered module, the
> directive has no effect.**

It is a **boundary marker**, not a mode switch. A file already inside the client subtree is
already client code; repeating the directive changes nothing. Harmless — but if you are
adding directives to files hoping to fix an error, this tells you why nothing happened.

### The guarantee runs one way only

> **When a component module contains a `'use client'` directive, any usage of that component
> is guaranteed to be a Client Component. However, a component can still be evaluated on the
> client even if it does not have a `'use client'` directive.**

The directive **guarantees** client evaluation; its absence guarantees nothing. A file with
no directive is a Server Component *unless something in the client graph imports it*. So
"this file has no `'use client'`, therefore it stays on the server" is **false**, and it is
the reasoning behind most accidental bundle growth and most leaked-secret incidents
([topic 19](19-taint-apis.md)).

### The directive must be genuinely first

> **`'use client'` must be at the very beginning of a file, above any imports or other code
> (comments are OK). They must be written with single or double quotes, but not backticks.**

Three ways to get this wrong that all fail silently-ish: putting it after an import, using
backticks, or letting a formatter or a license-header tool insert code above it. The file
then quietly stays in the server graph and you get a hooks error somewhere far away.

### Importing from a client module has a type restriction

> **When a server evaluated module imports values from a `'use client'` module, the values
> must either be a React component or supported serializable prop values to be passed to a
> Client Component. Any other use case will throw an exception.**

Server code may reach *into* the client module for a component to render or a serializable
constant. It may not import a class, a helper function, or a live object out of it and use
it server-side. The boundary is a wire, and only wire-shaped things travel.

## Shared modules are evaluated twice

A module imported from **both** graphs is not a bridge between them — it is compiled into
both, and it runs in each independently.

This matters more than it sounds:

- **Module-level state is not shared.** A cache, a counter, or a `Map` at module scope in a
  shared file has two separate instances, one per environment. There is no messaging between
  them.
- **A singleton is not a singleton.** The classic victim is a database client or an
  analytics SDK initialised at module scope in a file that both graphs happen to import.
- **Environment access decides whether it even loads.** A shared module that touches
  `process.env` at the top level breaks in the browser; one that touches `window` breaks on
  the server.

The fix is not clever — **split the file**. Server-only helpers in one module, isomorphic
values in another. Frameworks ship `server-only` and `client-only` packages that turn a
wrong import into a build error rather than a runtime surprise; those are **framework/npm
conventions, not part of React itself**, so check what your framework provides rather than
assuming.

## How to tell which graph a file is in

Four checks, cheapest first:

1. **Read the file.** `'use client'` at the very top, before imports → client graph, done.
2. **Trace who imports it.** Any importer in the client graph puts it there too. This is
   the check people skip, and it is the only one that catches transitive inclusion.
3. **`console.log` in it and see where the line lands** — your terminal or CI log means
   server graph, the browser console means client graph. Crude and completely reliable.
4. **Search the built client bundle** for a distinctive string from the file. If it is
   there, so is the file. This is the check that settles arguments, and the one to run
   before shipping anything with a secret in it.

## Gotchas

**Symptom:** the bundle grew by hundreds of kilobytes after adding one small interactive
widget.
**Cause:** the directive went on a file that imports far more than the widget needs — the
whole transitive subtree came with it.
**Fix:** move `'use client'` to the smallest leaf that needs state, and pass everything else
in as props or `children` ([topic 07](07-server-components-as-children.md)).

**Symptom:** adding `'use client'` to a file changed nothing.
**Cause:** it was already in the client graph, where the directive has no effect; or it is
not at the very beginning of the file; or it is written with backticks.
**Fix:** check position and quotes first, then check whether the file was already client
code.

**Symptom:** "this file has no `'use client'`, so my API key is safe."
**Cause:** the absence of the directive guarantees nothing — a client-graph importer pulls
the file in.
**Fix:** trace importers, then grep the built bundle. The taint APIs
([topic 19](19-taint-apis.md)) exist to make this a runtime error.

**Symptom:** a module-level cache seems to be ignored — writes on one side are invisible on
the other.
**Cause:** the module is in both graphs and has two independent instances.
**Fix:** split it, and keep shared state in one environment on purpose.

**Symptom:** importing a helper function from a `'use client'` file into a Server Component
throws.
**Cause:** only React components and serializable values may be imported across that
direction.
**Fix:** move the helper to a neutral module that the server file can import directly.

**Symptom:** `process.env.X` is `undefined` in the browser, or `window is not defined` on
the server, in the *same* file.
**Cause:** it is a shared module and runs in both environments.
**Fix:** split by environment rather than guarding with `typeof window`.

## Interview questions

**★ What does `'use client'` actually do?**
It introduces a server-client boundary **in the module dependency tree**, creating a subtree
of client modules. It is a boundary marker on the import graph, not a per-component mode
switch — which is why it has no effect inside a module that is already client code, and why
its consequences reach every file that subtree imports.

**★ Why does one directive change the bundle so much?**
Because it is transitive and not limited to components: all code that is part of the client
module subtree is sent to and run by the client. A component is a Client Component if its
module has the directive *or is a transitive dependency of a module that does* — so the
directive places a door, and the bundler computes everything behind it.

**★ Does the absence of `'use client'` mean a file stays on the server?**
No, and this is the asymmetry worth knowing. The directive **guarantees** a component is a
Client Component; its absence guarantees nothing, because a component can still be evaluated
on the client without it — any client-graph importer is enough. That asymmetry is behind
most accidental bundle growth and most leaked secrets.

**★ What happens during render at a client boundary?**
The framework server-renders from the root through the render tree, **opting out of
evaluating any code imported from client-marked code** — it records a reference plus the
props instead. The server-rendered portion is sent to the client, which downloads its client
code and finishes the tree. So placement is decided on the server and the body runs in the
browser, which is precisely why props must be serializable.

**What happens to a module imported from both graphs?**
It is compiled into both and evaluated independently in each. Module-level state therefore
exists twice with no link between the copies, so a "singleton" database client or cache is
nothing of the kind. The fix is to split the file rather than to guard it with
`typeof window`.

**How do you prove which graph a file is in?**
Read it for the directive, trace its importers, `console.log` and see whether the line
appears in the terminal or the browser console, and — the one that settles it — grep the
built client bundle for a distinctive string from the file. Only the last one is evidence;
the rest are inference.

---

← Prev: [What a Server Component is](01-what-a-server-component-is/README.md) ·
Index: [Phase 10](README.md) ·
Next → [`'use client'`](03-use-client.md)
