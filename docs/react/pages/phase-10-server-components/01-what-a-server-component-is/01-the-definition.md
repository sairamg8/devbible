---
title: "The definition, clause by clause"
sidebar_label: "01 · The definition"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Server Components](https://react.dev/reference/rsc/server-components) — the definition,
> the markdown-bundle example, and both the build-time and request-time modes.
> No sandbox script backs this page; claims are cited, not measured.

**One sentence in the docs carries the whole feature.** Read it slowly, because every
restriction and every benefit in this phase is a consequence of one of its three clauses.

> **Server Components are a new type of Component that renders ahead of time, before
> bundling, in an environment separate from your client app or SSR server.**

## "renders ahead of time"

Ahead of what? Ahead of the browser having anything to do. By the time the client is
involved, a Server Component has already run and produced output. There is no moment where
the browser holds a Server Component and decides to render it.

The direct consequence: **a Server Component renders once and never re-renders.** There is
no state to change and no event to respond to, so nothing could trigger a second render of
it in the browser. Re-running it means asking the server again.

This is also why the usual React performance vocabulary does not apply to them. There is no
`memo` question, no "why did this re-render", no reconciliation of a Server Component
against its previous self on the client. [Phase 6](../../phase-6-performance/README.md)'s
concerns are client-graph concerns.

## "before bundling"

This is the clause people skip, and it is the one that explains the bundle savings. A
Server Component is evaluated **before** the bundler builds your client JavaScript, so the
bundler never has to include it — or anything it imports that nothing else uses.

react.dev makes the point with a markdown renderer. Doing it in the browser:

> **This pattern means users need to download and parse an additional 75K (gzipped) of
> libraries, and wait for a second request to fetch the data after the page loads, just to
> render static content that will not change for the lifetime of the page.**

Two costs in one sentence — **75K of JavaScript** *and* **a second round trip** — for
content that is fixed forever. Move the same component to the server and:

> **The rendered output can then be server-side rendered (SSR) to HTML and uploaded to a
> CDN. When the app loads, the client will not see the original `Page` component, or the
> expensive libraries for rendering the markdown. The client will only see the rendered
> output.**

"The client will not see" is literal. The markdown library is not lazily loaded, not
code-split, not deferred — it is **absent** from the client build.

```jsx
// No directive. This is a Server Component.
import marked from 'marked';           // never reaches the browser
import sanitizeHtml from 'sanitize-html'; // neither does this

async function Page({ page }) {
  const content = await file.readFile(`${page}.md`);
  return <div>{sanitizeHtml(marked(content))}</div>;
}
```

Compare that with the client version of the same idea: the imports are in the bundle, the
read becomes a `fetch` in an effect, and the user waits for both. The difference is not a
micro-optimisation — it is a different shape of page load.

## "in an environment separate from your client app or SSR server"

> **This separate environment is the "server" in React Server Components. Server Components
> can run once at build time on your CI server, or they can be run for each request using a
> web server.**

⚠️ **Note the phrase "or SSR server".** The RSC environment is *not* the same thing as the
SSR pass, even when both happen to run inside the same Node process. This is the most
common conflation in the whole area. Hold **three** environments in your head, not two:

| Environment | When it runs | What it produces |
|---|---|---|
| **RSC** | build time, or per request | the serialized component tree ([topic 13](../13-the-rsc-payload.md)) |
| **SSR** | per request | HTML, from the client-graph components |
| **Browser** | after the HTML arrives | hydration, then everything interactive |

A Client Component runs in **two** of those — SSR and browser. A Server Component runs in
**one**, and it is neither of the other two. "It ran on a server, therefore it is a Server
Component" is false: SSR runs client-graph components on a server every request, and those
components still ship to the browser and still hydrate.

## The two modes, and why "server" is a misleading name

The word "server" suggests a machine answering requests. That is only one of the two things
the docs describe.

### Build time — no web server at all

> **Server components can run at build time to read from the filesystem or fetch static
> content, so a web server is not required.**

This is the mode that surprises people: a blog, a documentation site or a marketing page can
use Server Components and still deploy as **static files on a CDN**. The "server" was your
CI job. Nothing is running when a visitor arrives.

Worth saying plainly because it kills a common objection — *"we can't use RSC, we deploy
static"* — which is simply not true for the build-time mode. The objections that do hold up
are in [topic 17](../17-when-rsc-is-wrong.md).

### Request time — your data layer, without an API

> **Server Components can also run on a web server during a request for a page, letting you
> access your data layer without having to build an API. They are rendered before your
> application is bundled, and can pass data and JSX as props to Client Components.**

"Without having to build an API" is the part worth pausing on. The REST or GraphQL endpoint
that existed *only* so the browser could reach the database stops being necessary — the
component is already on the same side as the database.

That is a real architectural claim, and react.dev states it as one:

> **This new application architecture combines the simple "request/response" mental model of
> server-centric Multi-Page Apps with the seamless interactivity of client-centric
> Single-Page Apps, giving you the best of both worlds.**

Treat "best of both worlds" as marketing and the first half as engineering: **the mental
model you get back is request/response.** A page is computed for a request; the parts that
must stay alive afterwards are the ones you deliberately move into the client graph
([topic 11](../11-where-interactivity-goes.md)).

⚠️ **The endpoint does not disappear — it moves.** An API you no longer need for *your own*
page is not an API you no longer need for a mobile app, a partner integration or a webhook.
And a Server Function is itself a public endpoint
([topic 06](../06-server-function-security/README.md)), with every authorization concern intact.

## Gotchas

**Symptom:** "but SSR already ran my component on the server, so it *is* a Server
Component."
**Cause:** conflating the RSC environment with the SSR pass — the definition says "separate
from your client app **or SSR server**".
**Fix:** SSR runs client-graph components on a server to produce HTML; they still ship to
the browser and still hydrate. Different environment, different purpose.

**Symptom:** `console.log` inside a component never appears in the browser console.
**Cause:** it ran in the server environment.
**Fix:** look in your terminal or CI log. This is also a cheap test of which graph a file
is in.

**Symptom:** `window is not defined` / `document is not defined` during a build.
**Cause:** the RSC environment is not a browser, and this code ran there — possibly at
build time, where there is no request either.
**Fix:** move the browser access into a Client Component, in an effect if it must be
post-mount.

**Symptom:** "we deploy to a static host, so RSC is out."
**Cause:** assuming RSC implies a running web server.
**Fix:** the build-time mode is documented and produces output that can be server-rendered
to HTML and uploaded to a CDN.

**Symptom:** an expensive library still shows up in the client bundle despite being used
"only on the server".
**Cause:** something in the client graph imports it too — the exclusion is a property of the
import graph, not of intent.
**Fix:** trace the import chain ([topic 02](../02-two-module-graphs.md)).

## Interview questions

**★ What is a Server Component, in one sentence?**
A component that renders ahead of time, before bundling, in an environment separate from
both the client app and the SSR server — so its code is never sent to the browser. The
three clauses matter individually: *ahead of time* means it has already run before the
browser is involved and never re-renders there; *before bundling* is why its imports are
absent from the client build; *separate environment* is why it has no DOM, no state and no
events.

**★ How is a Server Component different from SSR?**
SSR takes components that are *in the client bundle*, runs them on a server to produce
HTML, ships them to the browser and hydrates them there. A Server Component is never in the
client bundle and never hydrates — it runs in a third environment, before bundling, and
produces a serialized tree rather than HTML. react.dev's definition is explicit that the
RSC environment is separate from "your client app **or SSR server**". An app can use both;
they are not alternatives.

**★ Does using Server Components require a web server?**
No. They can run once at build time — reading the filesystem or fetching static content —
and the output can be server-rendered to HTML and uploaded to a CDN. That is a documented
mode, not a workaround. The other mode is per-request on a web server, which is what gives
you data-layer access without building an API.

**What do Server Components actually save?**
Two things, and the markdown example in the docs names both: 75K gzipped of libraries the
browser never downloads or parses, and the extra round trip it would have taken to fetch
the data after the page loaded. For content that never changes for the lifetime of the
page, both were pure waste.

**Why does "before bundling" matter more than "on the server"?**
Because it is the clause that produces the bundle result. Plenty of code has always run on
a server; what is new is that the component is evaluated before the client build exists, so
the bundler has no reason to include it or its imports. "On the server" describes where;
"before bundling" describes why the browser never sees it.

**If Server Components remove the API layer, what replaces it for a mobile client?**
Nothing — and that is the point to make in an interview. RSC removes the endpoint that
existed *only* to feed your own browser. Anything with another consumer still needs a real
API, and Server Functions are themselves endpoints with the same authorization obligations.

---

← Index: [What a Server Component is](README.md) ·
Next → [The default, the limits, and the stability line](02-defaults-and-limits.md)
