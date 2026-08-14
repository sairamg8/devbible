---
title: "Server Components without a framework"
sidebar_label: "18 · Without a framework"
sidebar_position: 18
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — reactjs/rfcs
> [RFC 0227 · Server Module Conventions](https://github.com/reactjs/rfcs/blob/main/text/0227-server-module-conventions.md)
> (the `"react-server"` condition and the duplicated-resolution consequence), react.dev
> [Server Components](https://react.dev/reference/rsc/server-components) (the stability note)
> and [React Router · React Server Components](https://reactrouter.com/how-to/react-server-components)
> (the three entry points and what each is responsible for).
> No sandbox script backs this page; claims are cited, not measured.

**Know tier, and the reason is the conclusion:** you can see exactly what an RSC setup
requires, and having seen it, you will use a framework. The value of this topic is not the
recipe — it is understanding what the framework is doing on your behalf, so its errors stop
being magic.

## What you would have to build

Five pieces, each established elsewhere in this phase.

### 1. Bundler integration

Not a library you install — a change to how modules resolve.

> **Because of the `"react-server"` export condition, the correct way to implement a module
> graph requires duplicating module resolution on the server.**
>
> **If module A imports module B which is forked based on `"react-server"`, then there has to
> be two copies of module A.**

So you need two resolution passes — one with the `react-server` condition for the server
graph, one without it for client and SSR — and the duplication propagates upward to every
importer ([topic 14](14-renderer-packages.md)). **This alone is why RSC support cannot live
in userland.**

### 2. Directive handling

The bundler has to treat `'use client'` as a boundary: stop following the import into the
server graph, create a client entry point, and mint a stable module reference the payload can
carry. And `'use server'` has to become a callable reference with request routing behind it
([topics 03](03-use-client.md), [04](04-use-server.md)).

It also has to **survive the pipeline** — a transform that strips a leading string literal
silently removes the boundary.

### 3. The Flight endpoint

Wire up the `react-server-dom-*` package for your bundler
([topic 14](14-renderer-packages.md)) to render the tree to a payload
([topic 13](13-the-rsc-payload.md)) and stream it, plus a handler that accepts Server
Function calls and dispatches them.

### 4. Routing

React has no opinion. Mapping a URL to a component tree, and deciding what to re-render on
navigation, is entirely yours.

### 5. The three entries

React Router's own setup is the clearest inventory of what a framework wires together:

| Entry | Responsibility |
|---|---|
| RSC server | *"matching the request to a route and generating RSC payloads"* |
| SSR server | *"calling the RSC server, and converting the RSC payload into HTML on document requests"* |
| Client | *"hydrating the generated HTML and setting the `callServer` function to support post-hydration server actions"* |

**Three entry points because there are three environments**
([topic 01](01-what-a-server-component-is/01-the-definition.md)). The model you learned in
topic 01 turns out to be literally the file layout.

## And then the part that does not end

Even with all five working, you have taken on a **standing maintenance commitment**:

> **While React Server Components in React 19 are stable and will not break between minor
> versions, the underlying APIs used to implement a React Server Components bundler or
> framework do not follow semver and may break between minors in React 19.x.**
>
> **To support React Server Components as a bundler or framework, we recommend pinning to a
> specific React version, or using the Canary release.**

That advice is addressed to exactly the person doing this. A framework absorbs those breaks
for you; without one, each 19.x minor is your problem — and, after December 2025, so is every
RSC advisory ([topic 12](12-december-2025-advisories.md)).

## What it is worth doing anyway

Not building it — **reading one**. A minimal RSC implementation makes the whole phase
concrete in a way documentation cannot: you see the two resolution passes, watch a payload
being written, and find the exact line where `'use client'` becomes a module reference.

The payoff is diagnostic. After that, "Functions cannot be passed directly to Client
Components" is not a framework being difficult — it is a serializer refusing a value, and you
know why ([topic 05](05-what-crosses-the-boundary.md)).

⚠️ **Do not put a hand-rolled RSC setup into production.** The security surface is real, it
was exercised in December 2025, and the fixes arrived through those packages and the
frameworks that track them.

## Gotchas

**Symptom:** an attempt to add RSC to an unsupported bundler stalls immediately.
**Cause:** it needs the `react-server` condition, a second resolution pass, directive
handling and a matching renderer package.
**Fix:** use a supported bundler. This is not a plugin-sized problem.

**Symptom:** a hand-rolled setup works in development and breaks in production.
**Cause:** the production pipeline minified away a leading directive, or resolved with the
wrong condition.
**Fix:** verify directives survive the build, and that both resolution passes exist.

**Symptom:** everything works until a React minor upgrade.
**Cause:** the bundler-facing APIs explicitly do not follow semver in 19.x.
**Fix:** pin the exact version, and expect to do this again.

**Symptom:** SSR and RSC disagree about which copy of a module is in use.
**Cause:** a module forked on `react-server` exists twice, and so does every importer.
**Fix:** expected behaviour, per the RFC. Do not try to unify them.

## Interview questions

**★ What would it take to run Server Components without a framework?**
Five things: bundler integration that resolves the module graph **twice** — once with the
`react-server` condition and once without — plus directive handling that turns `'use client'`
into a boundary and `'use server'` into a callable reference, the `react-server-dom-*`
renderer wired to a Flight endpoint, your own routing, and three entry points for the three
environments. Then a standing commitment to non-semver APIs that may break on any 19.x minor.

**★ Why can't RSC support be a library?**
Because the `"react-server"` export condition means module resolution has to happen twice,
and the duplication propagates to every importer of a forked module. Nothing in userland can
duplicate a bundler's resolution graph — which is also why the renderer ships as one package
per bundler.

**★ Should anyone actually do this?**
Build it to learn, not to ship. Reading a minimal implementation makes the two module graphs,
the payload and the boundary concrete, and it turns serialization errors from mystery into
mechanism. Shipping it means owning a security surface that was exercised in December 2025
and a set of APIs that explicitly do not follow semver.

**What does the three-entry-point setup tell you?**
That the three-environment model is not a teaching device — it is the file layout. An RSC
entry that generates payloads, an SSR entry that turns a payload into HTML for document
requests, and a browser entry that hydrates and installs `callServer`. One per environment.

---

← Prev: [When RSC is the wrong choice](17-when-rsc-is-wrong.md) ·
Index: [Phase 10](README.md) ·
Next → [Taint APIs](19-taint-apis.md)
