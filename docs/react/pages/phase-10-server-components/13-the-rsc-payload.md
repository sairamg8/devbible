---
title: "The RSC payload"
sidebar_label: "13 · The RSC payload"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8** and **Next.js 16.3.1**, from documentation —
> Next.js [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
> (the RSC Payload definition, its three contents, and the first-load and subsequent-navigation
> sequences) and react.dev
> [Server Components](https://react.dev/reference/rsc/server-components).
> ⚠️ **React does not publish a specification of the wire format**, and this page does not
> reproduce a sample payload — an invented one would be worse than none.
> No sandbox script backs this page; claims are cited, not measured.

**A Server Component render does not produce HTML.** It produces a serialized description of
a tree, and that description is the thing streamed to the browser. Knowing what is in it
explains streaming, navigation, and why a Client Component's props must be serializable.

## What it is

> **The RSC Payload is a compact, serialized representation of the rendered React Server
> Components tree. It's used by React on the client to update the browser's DOM.**

Three things are in it, and each maps onto a rule from earlier in this phase:

> **The RSC Payload contains:**
> - **The rendered result of Server Components**
> - **Placeholders for where Client Components should be rendered and references to their
>   JavaScript files**
> - **Any props passed from a Server Component to a Client Component**

| In the payload | The rule it implements |
|---|---|
| rendered Server Component output | the component's *code* never ships ([topic 01](01-what-a-server-component-is/README.md)) |
| placeholders + references to client JS | the render walk stops at client-marked imports ([topic 02](02-two-module-graphs.md)) |
| props for those Client Components | props must be serializable ([topic 05](05-what-crosses-the-boundary.md)) |

**The whole phase is visible in those three bullets.** A Client Component's props are in the
payload because the payload is where they physically are — computed on one side of a network
hop, consumed on the other.

## It is not HTML and not JSON

Two things it gets confused with, and the distinctions matter:

- **Not HTML.** HTML is what the *SSR* pass produces from the client-graph components. The
  payload is a description of a component tree, including references to components that have
  not run yet. Both can exist for one page, produced by different environments
  ([topic 01 · 01](01-what-a-server-component-is/01-the-definition.md)).
- **Not JSON.** JSON has no way to express a reference to a module, a promise that will
  resolve later, or a `Map`. The payload carries all three, which is exactly why the
  serializable list is longer than `JSON.stringify`'s
  ([topic 05](05-what-crosses-the-boundary.md)).

⚠️ **The format itself is an implementation detail.** React has not published a wire-format
specification, and the packages that produce and consume it explicitly do not follow semver
([topic 14](14-renderer-packages.md)). Reading a payload in the network tab is a useful
diagnostic; **parsing one in your own code is building on sand.**

## Why it can stream

The payload is produced as a sequence — the tree is described progressively rather than
assembled and sent at the end. That is the mechanism behind everything Suspense does on the
server ([Phase 8 · 02](../phase-8-concurrent-suspense/02-suspense/README.md)):

- A boundary whose data is still pending can be described as *pending*, with its content
  arriving later in the same response.
- An `async` component's `await` ([topic 08](08-async-components.md)) does not block the
  parts of the tree that are already resolved.
- The browser can begin work on what has arrived instead of waiting for the whole tree.

**This is the concrete reason a Suspense boundary is a streaming unit.** It is not an
analogy — the boundary is where the payload is allowed to say "more later".

## The two sequences worth memorising

### First load

> 1. **HTML** is used to immediately show a fast non-interactive preview of the route to the
>    user.
> 2. **RSC Payload** is used to reconcile the Client and Server Component trees.
> 3. **JavaScript** is used to hydrate Client Components and make the application
>    interactive.

Three artifacts, three jobs. The HTML paints, the payload reconciles, the JavaScript
hydrates. A page that paints but does not respond is stuck between steps 1 and 3 — which is
[Phase 11](../README.md)'s territory.

### Subsequent navigations

> - The **RSC Payload** is prefetched and cached for instant navigation.
> - **Client Components** are rendered entirely on the client, without the server-rendered
>   HTML.

🔴 **No HTML on navigation.** After the first load the app is a client-side application that
fetches *payloads* rather than pages — which is why an RSC app navigates like an SPA rather
than like a multi-page app, and why the payload is the thing worth watching in the network
tab when a navigation feels slow.

## Reading one in the network tab

What you can usefully do without a spec:

1. **Find the request.** On navigation it is the request that returns a payload rather than
   HTML; on first load the payload is delivered inline with the document.
2. **Look at its size.** A payload much larger than the visible content usually means a prop
   is carrying more than the component needs — a whole database row rather than four fields
   ([topic 06 · 01](06-server-function-security/01-everything-is-an-endpoint.md)).
3. **Search it for a string that should not be there.** A token, an email address, an
   internal flag. This is the cheapest leak check you have, and it complements grepping the
   client bundle ([topic 02](02-two-module-graphs.md)) — the bundle catches leaked *code*,
   the payload catches leaked *data*.
4. **Watch whether it arrives in pieces.** Content appearing progressively is streaming
   working; one late block is a boundary missing or a shell held back.

⚠️ **Do not build tooling that parses it.** Use React's own APIs, and treat the payload as
something you inspect, not something you integrate with.

## Gotchas

**Symptom:** the payload is enormous compared with what the page shows.
**Cause:** props carrying whole records to Client Components — everything passed is in there.
**Fix:** pass the fields the component needs ([topic 05](05-what-crosses-the-boundary.md)).

**Symptom:** a secret appears in the page source but not in the JavaScript bundle.
**Cause:** it was passed as a prop, so it is in the payload, not the bundle.
**Fix:** stop passing it; the taint APIs ([topic 19](19-taint-apis.md)) make this an error.

**Symptom:** a parser written against the payload broke after an upgrade.
**Cause:** the format is an implementation detail and the renderer packages do not follow
semver.
**Fix:** do not parse it.

**Symptom:** "the server returned HTML, so RSC is not working."
**Cause:** first load legitimately delivers HTML *and* a payload; navigations deliver only a
payload.
**Fix:** check a navigation, not the first load.

**Symptom:** everything arrives at once instead of streaming.
**Cause:** no Suspense boundary below the shell, so there is nothing the payload can defer.
**Fix:** add boundaries per independent region ([topic 08](08-async-components.md)).

## Interview questions

**★ What is the RSC payload and what is in it?**
A compact, serialized representation of the rendered Server Component tree, used by React on
the client to update the DOM. It contains the rendered result of Server Components,
placeholders for where Client Components go plus references to their JavaScript files, and
any props passed from a Server Component to a Client Component. Those three items are the
whole architecture in miniature.

**★ Is it HTML?**
No. HTML comes from the SSR pass over client-graph components. The payload describes a
component tree, including references to components that have not run yet. A single page can
have both, produced by different environments — that is the RSC-versus-SSR distinction made
concrete.

**★ Why can it stream, and what does that have to do with Suspense?**
Because the tree is described progressively rather than sent as one finished blob, so a
boundary whose data is pending can be marked pending and filled in later in the same
response. That is the literal mechanism behind a Suspense boundary being a streaming unit —
it is where the payload is allowed to say "more later".

**★ What happens on a navigation versus the first load?**
First load: HTML paints a non-interactive preview, the payload reconciles the client and
server trees, and JavaScript hydrates the Client Components. On subsequent navigations the
payload is prefetched and cached, and Client Components render entirely on the client with no
server-rendered HTML. So after first load the app navigates like an SPA that fetches payloads
rather than pages.

**What can you legitimately do with a payload?**
Inspect it. Check its size against the visible content, search it for values that should not
have left the server, and watch whether it arrives progressively. What you should not do is
parse it in your own code — React publishes no wire-format specification and the packages
that produce it explicitly do not follow semver.

**Where would you look for a leaked secret — the bundle or the payload?**
Both, for different leaks. The client bundle catches leaked *code* — a module that ended up
in the client graph. The payload catches leaked *data* — a value passed as a prop. A secret
read inside a Server Component and passed down appears in the payload and never in the
bundle.

---

← Prev: [The December 2025 advisories](12-december-2025-advisories.md) ·
Index: [Phase 10](README.md) ·
Next → [The renderer packages](14-renderer-packages.md)
