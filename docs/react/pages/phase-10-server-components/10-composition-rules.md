---
title: "Composition rules"
sidebar_label: "10 · Composition rules"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`'use client'`](https://react.dev/reference/rsc/use-client) (the transitive-dependency
> caveat, the restriction on values imported from a client module, and the serializable-props
> list), [Server Components](https://react.dev/reference/rsc/server-components) (composing
> with Client Components, and what Client Components see) and
> [`'use server'`](https://react.dev/reference/rsc/use-server) (Server Functions passed to
> Client Components through props).
> No sandbox script backs this page; claims are cited, not measured.

**Four rules, and they are all consequences of the module graph.** Nothing here is a special
case invented for RSC — each one falls out of "the boundary lives in the import graph"
([topic 02](02-two-module-graphs.md)) plus "only serializable values cross"
([topic 05](05-what-crosses-the-boundary.md)).

## The four rules

| | Legal? | Why |
|---|---|---|
| Server Component **renders** a Client Component | ✅ | the framework records a reference plus props |
| Client Component **imports** a Server Component | ✖ | the import moves the module into the client graph |
| Client Component **receives** a Server Component's output as a prop | ✅ | elements are serializable |
| Server Function **crosses inward** into a Client Component | ✅ | a *reference* crosses, not the function |

Read the middle two together: **the same component is legal as a prop and illegal as an
import.** That is not a contradiction — they are different mechanisms transferring different
things.

## Rule 1 — server renders client, downward

> **Server Components are not sent to the browser, so they cannot use interactive APIs like
> `useState`. To add interactivity to Server Components, you can compose them with Client
> Component using the `"use client"` directive.**

The Server Component imports the Client Component and renders it normally. During the render
walk React does not evaluate the client module; it records a reference and the props
([topic 02](02-two-module-graphs.md)). The props must be serializable, which is why the
container/leaf shape from [topic 03](03-use-client.md) works — data in, interactivity below.

## Rule 2 — a Client Component cannot import a Server Component

There is no error message for "you imported a Server Component". There cannot be, because
from the bundler's point of view nothing exceptional happened: the module was imported by a
client module, so it *is* client code now.

> **A component usage is considered a Client Component if it is defined in module with
> `'use client'` directive or when it is a transitive dependency of a module that contains a
> `'use client'` directive.**

What you actually see is the *consequence* — `fs` or a database driver failing to resolve in
a browser build, `process.env` being undefined, or a secret quietly appearing in the bundle.
🔴 **The dangerous outcome is the one that does not fail**: a Server Component that happens
to use no server-only API is silently converted into client code, and everything it imports
ships.

## Rule 3 — but it can receive one as a prop

The inversion from [topic 07](07-server-components-as-children.md): compose in the Server
Component and pass the element down.

> **In the browser, the Client Components will see output of the Server Components passed as
> props.**

```jsx
// ✖ import                              // ✅ prop
'use client';                            // Server Component
import Note from './Note';               <Expandable><Note /></Expandable>
```

Same component, same screen, entirely different consequence for the bundle. The rule to
remember is **imports move modules; props move values** — and a rendered element is a value.

## Rule 4 — Server Functions cross inward

The one thing that goes from server to client and is still *callable*:

> **`'use server'` can only be used in server-side files. The resulting Server Functions can
> be passed to Client Components through props.**

Because what crosses is a reference the framework creates
([topic 04](04-use-server.md)), and Server Function references are explicitly on the
serializable-props list. Calling the reference performs a network request; the body never
left the server.

Two ways it reaches a Client Component, and they are not interchangeable:

- **As a prop**, defined inline inside a Server Component — the closure form, which brings
  the captured-variable caveat with it
  ([topic 06 · 02](06-server-function-security/02-what-the-framework-does.md)).
- **By import**, which requires the **module-level** `'use server'` and marks every export in
  that file as an endpoint ([topic 04](04-use-server.md)).

## The one-way street in the other direction

> **When a server evaluated module imports values from a `'use client'` module, the values
> must either be a React component or supported serializable prop values to be passed to a
> Client Component. Any other use case will throw an exception.**

So server code may reach into a client module for a **component to render** or a
**serializable constant**, and nothing else. A helper function, a class, a live object — all
rejected. Put shared utilities in a neutral module that neither graph owns.

## Context does not cross

The composition question people hit soonest after the four rules. A provider is a live
client-side value, and context is not a prop — nothing about it is serialized.

- A Server Component **cannot** read a client-side context; it gets the default.
- A Client Component **can** read a context whose provider is also in the client graph, even
  when Server Component output sits between them in the render tree — because the render tree
  and the module graph are different trees ([topic 02](02-two-module-graphs.md)).

The practical arrangement: a thin `'use client'` provider near the root, rendered by a Server
Component with server-fetched data passed in as serializable props, and Server Component
content passed *through* it as `children`. The provider stays small, and the tree below it
stays on the server.

## A worked shape

```jsx
// app/page.js — Server Component
import { ThemeProvider } from './ThemeProvider';   // 'use client'
import Sidebar from './Sidebar';                   // Server Component
import Article from './Article';                   // Server Component
import { publish } from './actions';               // 'use server' module

export default async function Page({ id }) {
  const settings = await db.settings.get();        // server-only
  return (
    <ThemeProvider initial={settings.theme}>       {/* rule 1: server renders client */}
      <Sidebar />                                  {/* rule 3: passed as children */}
      <Article id={id} publish={publish} />        {/* rule 4: function reference crosses */}
    </ThemeProvider>
  );
}
```

Every rule appears once, and nothing in `Sidebar` or `Article`'s server half enters the
client graph.

## Gotchas

**Symptom:** a Server Component "became" a Client Component with no error anywhere.
**Cause:** something in the client graph imported it. The transitive rule is silent when the
component happens to use no server-only API.
**Fix:** trace importers and check the built bundle ([topic 02](02-two-module-graphs.md)).

**Symptom:** `fs`, a database driver or `process.env` fails only in the browser build.
**Cause:** rule 2 — a client module imported the server module.
**Fix:** invert to the `children` form.

**Symptom:** a Server Component reads context and always gets the default.
**Cause:** context does not cross the boundary.
**Fix:** pass the value as a serializable prop, or move the consumer into the client graph.

**Symptom:** a Client Component deep under Server Component output cannot see its provider.
**Cause:** the provider is not an ancestor **in the module/render arrangement you think** —
check that the provider is itself in the client graph and above it in the render tree.
**Fix:** hoist the provider into a thin client wrapper rendered by a Server Component.

**Symptom:** importing a helper from a `'use client'` file into server code throws.
**Cause:** only React components and serializable values may be imported that way.
**Fix:** move the helper to a neutral module.

**Symptom:** a Server Function passed inline as a prop leaks a captured value.
**Cause:** closed-over variables travel to the client and back.
**Fix:** read secrets inside the function body
([topic 06 · 02](06-server-function-security/02-what-the-framework-does.md)).

## Interview questions

**★ State the composition rules.**
A Server Component can render a Client Component. A Client Component cannot import a Server
Component — the import moves the module into the client graph — but it can receive a Server
Component's rendered output as a prop, because elements are serializable. And a Server
Function crosses inward, because what travels is a reference rather than the function body.

**★ Why is importing illegal but passing legal, for the same component?**
Because they transfer different things. An import moves a **module**, and the transitive rule
then makes that module client code. A prop moves a **value**, and a rendered element is data —
a type reference plus props. Imports move modules; props move values.

**★ What happens if a Client Component imports a Server Component that uses no server-only
API?**
Nothing visible, which is the danger. There is no "you imported a Server Component" error;
the module simply becomes client code and everything it imports ships to the browser. You
only notice through bundle size, or a leaked secret. The failures that *are* loud — `fs`
failing to resolve, `process.env` undefined — are the lucky cases.

**★ Why does context not cross the boundary?**
Because a provider is a live client-side value and only serializable data crosses. A Server
Component reading a client context gets the default. The working arrangement is a thin
`'use client'` provider near the root, given server-fetched data as props, with Server
Component content passed through it as `children`.

**How does a Server Function get to a Client Component?**
Either as a prop from a Server Component — the inline form, which closes over the render
scope and brings the captured-variable caveat — or by direct import, which requires the
module-level directive and turns every export in the file into an endpoint. The choice has
security consequences, not just ergonomics.

**What may server code import from a `'use client'` module?**
A React component, or a serializable value to pass as a prop. Anything else throws. Shared
helpers belong in a neutral module that neither graph claims.

---

← Prev: [Calling Server Functions from the client](09-calling-server-functions.md) ·
Index: [Phase 10](README.md) ·
Next → [Where interactivity goes](11-where-interactivity-goes.md)
