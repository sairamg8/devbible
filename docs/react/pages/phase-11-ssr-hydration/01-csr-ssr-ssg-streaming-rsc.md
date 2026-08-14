---
title: "CSR vs SSR vs SSG vs streaming vs RSC"
sidebar_label: "01 · The five, distinguished"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [`renderToString`](https://react.dev/reference/react-dom/server/renderToString),
> [`renderToPipeableStream`](https://react.dev/reference/react-dom/server/renderToPipeableStream),
> [`prerender`](https://react.dev/reference/react-dom/static/prerender),
> [`hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot) and
> [Server Components](https://react.dev/reference/rsc/server-components).
> No sandbox script backs this page; claims are cited, not measured.

**Five names, constantly used as if they were four synonyms and one buzzword.** They are
five different things, they answer different questions, and several of them compose. Getting
this table right is the whole topic; everything else in the phase is detail underneath it.

## The five, on one axis each

| | Where the first HTML comes from | When | Does it hydrate? | React API |
|---|---|---|---|---|
| **CSR** | nowhere — an empty div | — | no, it renders | `createRoot` |
| **SSR** | a server, per request | request time | **yes** | `renderToString` / `renderToPipeableStream` / `renderToReadableStream` |
| **SSG** | a build | build time | **yes** | `prerender` / `prerenderToNodeStream` |
| **Streaming SSR** | a server, **progressively** | request time | **yes**, and selectively | `renderToPipeableStream` / `renderToReadableStream` |
| **RSC** | *not HTML* — a payload | build **or** request time | **no** | `react-server-dom-*` |

Read the last two columns first. **"Does it hydrate?" separates RSC from the rest**, and
"where does the first HTML come from" separates the rest from each other.

## What each actually is

### CSR — client-side rendering

The server sends `<div id="root"></div>` and a script. React builds everything in the
browser. Nothing to reuse, so `createRoot`, not `hydrateRoot`:

> **If your app is client-rendered with no HTML rendered already, using `hydrateRoot()` is
> not supported. Use `createRoot()` instead.**

Cheap to operate, and everything waits on JavaScript.

### SSR — server-side rendering

Components are rendered to HTML **on a server, per request**, sent, and then **hydrated** in
the browser. The components are ordinary client-graph components; the server run is an extra
pass over the same code.

**The cost people forget:** the browser still downloads all that JavaScript and runs the
components again. SSR improves what the user *sees* first; it does not reduce the bundle.

### SSG — static site generation

The same render, moved to build time, written to files. React's own API for this is
`prerender`, and the distinguishing behaviour is stated plainly:

> **`prerender` waits for all data to load before finishing the static HTML generation and
> resolving.**

No request-time server, so nothing to scale, and content is as fresh as the last build.

### Streaming SSR

SSR that sends HTML **in pieces** as it becomes ready, rather than one document at the end.

> **Streaming allows the user to start seeing the content even before all the data has loaded
> on the server.**

And the property that makes it more than a nicety:

> **Streaming does not need to wait for React itself to load in the browser, or for your app
> to become interactive. The HTML content from the server will get progressively revealed
> before any of the `<script>` tags load.**

The unit of streaming is a `<Suspense>` boundary ([topic 06](06-streaming-ssr.md)).

### RSC — React Server Components

The odd one out, and the reason this table exists. RSC components run in a **separate
environment before bundling**, produce a **payload rather than HTML**, and **never
hydrate** — their code is not in the browser at all
([Phase 10](../phase-10-server-components/01-what-a-server-component-is/README.md)).

🔴 **RSC is not "SSR done better".** They answer different questions:

| | SSR asks | RSC asks |
|---|---|---|
| Question | how do we show HTML before JS loads? | how do we stop shipping this code at all? |
| Output | HTML | a serialized tree |
| Bundle impact | **none** | removes the component and its imports |
| Hydration | yes | no |

An RSC app usually uses SSR as well — the payload's Client Components still get
server-rendered to HTML for the first paint
([Phase 10 · 13](../phase-10-server-components/13-the-rsc-payload.md)).

## Which combinations are real

| Combination | Real? | |
|---|---|---|
| CSR alone | ✅ | a dashboard behind a login; nothing to prerender |
| SSR + hydration | ✅ | the classic setup |
| SSG + hydration | ✅ | docs, blogs, marketing |
| Streaming SSR + Suspense | ✅ | SSR with the waterfall broken up |
| RSC + streaming SSR | ✅ | the mainstream framework setup |
| RSC + SSG | ✅ | Server Components at build time, output to a CDN |
| **RSC instead of hydration** | ✖ | Client Components still hydrate |
| **SSR instead of a bundle** | ✖ | SSR sends the same JavaScript |
| **SSG + per-request data** | ✖ | that is SSR — or partial pre-rendering ([topic 09](09-partial-prerendering/README.md)) |

⚠️ **The last row is the one worth knowing**, because "static, but with some dynamic bits"
sounds like a contradiction and is exactly what `prerender`'s `postponed` /`resume` pair
exists to do.

## What each one fixes, and what it does not

| Problem | Fixed by |
|---|---|
| Blank screen until JS loads | SSR, SSG, streaming |
| Slow first paint on a slow connection | streaming SSR |
| Crawlers seeing nothing | SSR or SSG — with `onAllReady` for crawlers ([topic 06](06-streaming-ssr.md)) |
| Too much JavaScript in the bundle | **RSC only** |
| A slow database query | none of them |

🔴 **Only RSC touches bundle size.** SSR, SSG and streaming all ship the same JavaScript;
they change *when the user sees pixels*, not *how much code arrives*. Choosing SSR to fix a
bundle problem is the most common category error in this area, and
[Phase 10 · 17](../phase-10-server-components/17-when-rsc-is-wrong.md) is the other half of
that conversation.

## Gotchas

**Symptom:** SSR was added and the bundle is unchanged.
**Cause:** SSR renders the same client components on a server; they still ship and hydrate.
**Fix:** expected. Bundle size is RSC's problem to solve.

**Symptom:** `hydrateRoot` is used on a page with no server HTML.
**Cause:** that is CSR.
**Fix:** `createRoot` — hydrating nothing is explicitly unsupported.

**Symptom:** SSG output is stale.
**Cause:** it was generated at build time.
**Fix:** rebuild, move to SSR, or use partial pre-rendering for the dynamic parts.

**Symptom:** streaming was enabled and nothing streams.
**Cause:** with no `<Suspense>` boundary below the shell, there is nothing to defer.
**Fix:** add boundaries per independent region.

**Symptom:** "we use RSC, so we don't need hydration."
**Cause:** Server Components do not hydrate; **Client Components still do**.
**Fix:** both mechanisms are present in an RSC app.

**Symptom:** a crawler sees fallbacks instead of content.
**Cause:** streaming reveals progressively, and the crawler did not wait.
**Fix:** `onAllReady` for crawlers, `onShellReady` for humans ([topic 06](06-streaming-ssr.md)).

## Interview questions

**★ Distinguish SSR from RSC.**
SSR takes components that are **in the client bundle**, renders them to HTML on a server per
request, ships them, and hydrates them in the browser. RSC runs components in a separate
environment **before bundling**, produces a serialized payload rather than HTML, and never
hydrates — the code is not in the browser. SSR changes when the user sees pixels; RSC changes
how much JavaScript arrives. Most RSC apps use both.

**★ Which of the five reduces bundle size?**
Only RSC. SSR, SSG and streaming SSR all ship the same JavaScript — they change the timing
of the first paint, not the amount of code. Reaching for SSR to fix a bundle problem is the
classic category error here.

**★ What is the difference between SSG and SSR, in React's own APIs?**
`prerender` versus the `renderTo*` family, and the behaviour that separates them is that
**`prerender` waits for all data to load before resolving** — it is designed for static
generation and does not stream. The streaming renderers start emitting as soon as the shell
is ready.

**★ What does streaming SSR buy that plain SSR does not?**
The user starts seeing content before all the data has loaded on the server, and — the part
that matters most — the HTML is progressively revealed **before any `<script>` tags load**,
so it does not wait for React or for interactivity. The unit of streaming is a Suspense
boundary.

**Can you have static generation with per-request data?**
Not as plain SSG — but that is exactly what partial pre-rendering is for. `prerender` can
return a `postponed` object alongside the prelude, which `resume` uses at request time to
fill in the dynamic holes.

**Someone says "we'll add SSR so crawlers can see the page." What do you check?**
That they are waiting for the content. A streaming render reveals progressively, so a crawler
that does not wait sees fallbacks. React's answer is to pipe in `onAllReady` for crawlers and
`onShellReady` for everyone else — the docs give exactly that branch.

---

Index: [Phase 11](README.md) ·
Next → [Hydration mismatches](02-hydration-mismatches.md)
