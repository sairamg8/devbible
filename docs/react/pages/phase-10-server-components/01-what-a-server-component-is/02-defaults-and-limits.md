---
title: "The default, the limits, and the stability line"
sidebar_label: "02 · The default and the limits"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Server Components](https://react.dev/reference/rsc/server-components) (the interactivity
> note, the async-components note, the directive note, and the stability note) and
> [`'use client'`](https://react.dev/reference/rsc/use-client) (the caveat that defines
> which components are Server Components).
> No sandbox script backs this page; claims are cited, not measured.

**Now that the environment is settled, the question is what you may write inside one.** The
restrictions are not a list to memorise — they are all the same restriction, stated once by
react.dev and then applied.

## What a Server Component cannot do

> **Server Components are not sent to the browser, so they cannot use interactive APIs like
> `useState`.**

That single reason covers the whole list. Nothing that depends on *being present in the
browser over time* is available:

| Not available | Because |
|---|---|
| `useState`, `useReducer` | state exists across renders in a live browser; there are none |
| `useEffect`, `useLayoutEffect` | effects run after commit to the DOM; there is no DOM |
| `onClick` and every event handler | a function cannot be serialized to the client ([topic 05](../05-what-crosses-the-boundary.md)) |
| `useRef` pointing at a DOM node | there is no node |
| `useContext` from a client-side provider | the provider lives in the other graph |
| `window`, `document`, `localStorage` | browser globals; the environment is not a browser |
| A custom hook using any of the above | the restriction is transitive, exactly like the graph itself |

🔴 **The error you get is often not the one you expect.** Passing `onClick={handleClick}`
from a Server Component to a DOM element fails as a **serialization** error, not as "hooks
are not allowed" — because the rule actually being broken is that functions cannot cross the
boundary. Recognising which of the two rules a message belongs to is
[topic 05](../05-what-crosses-the-boundary.md)'s job, and it is why that topic is Master
tier rather than a footnote.

The fix is never "make the Server Component interactive". It is to move the interactive leaf
into the client graph and keep everything above it on the server
([topic 11](../11-where-interactivity-goes.md)).

## What it can do that a Client Component cannot

The trade is not one-sided.

- **`await` directly in render.** *"Async Components are a new feature of Server Components
  that allow you to `await` in render."* No `useEffect`, no loading flag, no fetch-on-mount
  waterfall — [topic 08](../08-async-components.md).
- **Touch the filesystem and the database.** `fs.readFile`, `db.query` — ordinary
  server-side code, because it *is* ordinary server-side code.
- **Hold secrets.** An API key used inside a Server Component is not in the bundle. That is
  a real property of the build, not a convention — with the caveat that a secret **passed as
  a prop** to a Client Component does cross, which is exactly what the taint APIs in
  [topic 19](../19-taint-apis.md) exist to catch.
- **Import arbitrarily heavy libraries at zero client cost**, which is the 75K example from
  [chunk 01](01-the-definition.md).

Read the two lists together and the design intent is clear: **Server Components own data and
weight; Client Components own time and interaction.**

## 🔴 There is no `'use server'` on a Server Component

This is the most common mistake in the phase, and react.dev calls it out by name:

> **A common misunderstanding is that Server Components are denoted by `"use server"`, but
> there is no directive for Server Components. The `"use server"` directive is used for
> Server Functions.**

Put that beside the rule from the `'use client'` reference:

> **A component usage is considered a Client Component if it is defined in module with
> `'use client'` directive or when it is a transitive dependency of a module that contains a
> `'use client'` directive. Otherwise, it is a Server Component.**

**"Otherwise" is the whole answer: Server Components are the default.** You never opt in.
You opt *out*, by putting `'use client'` at the top of a file — and that opt-out is
inherited by everything that file imports, transitively. [Topic 03](../03-use-client.md) is
entirely about how far that inheritance reaches.

So the checklist for any file in an RSC app is three lines long:

1. Does this file have `'use client'`? → **client graph**.
2. Is it a transitive dependency of something that does? → **client graph**.
3. Otherwise → **server graph**. It is a Server Component.

There is no third directive to look for, because there is no third answer.

⚠️ **Getting this wrong is not harmless.** `'use server'` at the top of a *module* marks
**every export in it** as a Server Function — a callable network endpoint
([topic 04](../04-use-server.md)). Adding it to a component file to "make it a Server
Component" does not merely fail to do that; it exposes functions.

## Stability — what is stable, and for whom

> **While React Server Components in React 19 are stable and will not break between minor
> versions, the underlying APIs used to implement a React Server Components bundler or
> framework do not follow semver and may break between minors in React 19.x.**
>
> **To support React Server Components as a bundler or framework, we recommend pinning to a
> specific React version, or using the Canary release.**

Read it as a split by audience, because the two halves say opposite-sounding things:

| You are | Stability | What to do |
|---|---|---|
| Writing an app | **Stable.** `'use client'`, `'use server'`, async components and the serialization rules will not break in a 19.x minor | use it normally |
| Writing a bundler, plugin or framework | **Explicitly not semver.** May break between 19.x minors | pin an exact React version, or track Canary |

⚠️ **The December 2025 advisories turned that pinning advice into a two-sided version
problem.** Pinning protects you from a breaking minor and simultaneously keeps you on an
unpatched version if you never move — the affected RSC renderer packages needed **19.0.1,
19.1.2 or 19.2.1**. [Topic 12](../12-december-2025-advisories.md) has the detail; the short
version is **pin deliberately and review it**, rather than pinning once and forgetting.

## Gotchas

**Symptom:** "Hooks can only be called inside a Client Component" in a file that never
mentioned the server.
**Cause:** Server Components are the **default**. A file without `'use client'`, not
imported by anything that has it, is a Server Component.
**Fix:** add `'use client'` — preferably to the small leaf that actually needs state, not
to the page ([topic 11](../11-where-interactivity-goes.md)).

**Symptom:** adding `'use server'` at the top of a component file to "make it a Server
Component".
**Cause:** the misunderstanding react.dev names explicitly.
**Fix:** delete it. Server Components need no directive, and a module-level `'use server'`
marks every export as a public endpoint.

**Symptom:** a custom hook works in one component and throws in another.
**Cause:** the restriction is transitive. The hook is fine wherever it is reached from the
client graph and illegal where it is not.
**Fix:** decide which graph the hook belongs to and be explicit; do not let it be decided by
whichever file imported it first.

**Symptom:** an environment variable holding a secret appears in the client bundle.
**Cause:** the file reading it is in the client graph — directly, or transitively via an
import.
**Fix:** trace the import chain ([topic 02](../02-two-module-graphs.md)). The taint APIs in
[topic 19](../19-taint-apis.md) turn this into a runtime error rather than a silent leak.

**Symptom:** a Server Component reads context and always gets the default value.
**Cause:** the provider is in the client graph. Context does not cross the boundary.
**Fix:** pass the value as a prop, or move the consumer into the client graph
([topic 10](../10-composition-rules.md)).

**Symptom:** an RSC app broke after a patch-level React upgrade of a bundler plugin.
**Cause:** the bundler-facing APIs explicitly do not follow semver within 19.x.
**Fix:** pin the exact React version the plugin expects — and put a reminder on it, because
pinning is also how you end up unpatched.

## Interview questions

**★ Which directive marks a Server Component?**
None. There is no directive for Server Components — react.dev names this as a common
misunderstanding. `'use server'` marks Server Functions, which are a different feature
entirely. Server Components are the **default**: a component is a Client Component if its
module has `'use client'` or is a transitive dependency of one, and "otherwise, it is a
Server Component".

**★ Why can't a Server Component use `useState` or `onClick`?**
Because it is not sent to the browser. State only means something across renders in a live
browser, and an event handler is a function — which cannot be serialized across the
boundary. The `onClick` case is worth knowing precisely, because the error React gives is a
serialization error, not a hooks error, and people spend a long time looking for the wrong
problem.

**★ What is the transitive rule, and why does it matter more than the directive itself?**
A module is client code if it has `'use client'` **or is a transitive dependency of a module
that does**. It matters more because the directive is a decision you make once and the
transitivity is what actually determines your bundle — one careless `'use client'` near the
root pulls its entire import subtree into the browser.

**★ Is RSC stable?**
For application code, yes — stable in React 19, and it will not break between minor
versions. For bundler and framework authors, no: the underlying implementation APIs
explicitly do not follow semver and may break between 19.x minors, which is why the docs
recommend pinning an exact version or using Canary. After December 2025 that pinning is also
a security decision, since the patched RSC packages were 19.0.1, 19.1.2 and 19.2.1.

**What can a Server Component do that a Client Component cannot?**
`await` in render, with no effect and no loading flag; read the filesystem or query the
database directly; hold secrets that never enter the bundle; and import heavy libraries at
zero client cost. The clean way to say it: Server Components own data and weight, Client
Components own time and interaction.

**Why does context not work across the boundary?**
Because a provider is a live client-side value and the boundary only carries serializable
data. A Server Component reading a client-side context gets the default. The answer is to
pass the value down as a prop from the server side, or to put the consumer in the client
graph deliberately.

---

← Prev: [The definition, clause by clause](01-the-definition.md) ·
Index: [What a Server Component is](README.md) ·
Next → [The two module graphs](../02-two-module-graphs.md)
