---
title: "Next.js App Router vs React Router"
sidebar_label: "16 · Next.js vs React Router"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **Next.js 16.3.1** and **React Router** (docs as of this
> date), from documentation — Next.js
> [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
> and [Data security](https://nextjs.org/docs/app/guides/data-security), and React Router
> [React Server Components](https://reactrouter.com/how-to/react-server-components).
> ⚠️ **Version numbers move fast here.** Treat the stability statements as dated, not
> permanent, and re-check before quoting them.
> No sandbox script backs this page; claims are cited, not measured.

**Two mainstream RSC implementations, at very different points on the same curve.** What
transfers between them is everything in topics 01–15; what does not is the routing, the
caching and the conventions each layers on top.

## What each one is

| | **Next.js App Router** | **React Router** |
|---|---|---|
| RSC status | production feature, the default for `app/` | ⚠️ *"experimental and subject to breaking changes in minor/patch releases"* |
| API naming | stable | every RSC API is `unstable_`-prefixed |
| Bundler | Turbopack / webpack | Vite, via `@vitejs/plugin-rsc` (a peer dependency) |
| Routing | file conventions (`layout`, `page`, parallel routes) | route config, or file conventions in Framework Mode |
| You assemble | almost nothing | the server, SSR and browser entries |

That last row is the honest summary of the difference. Next.js hands you a working
application shape; React Router hands you the pieces and expects you to know what they do.

## What transfers unchanged

**Everything React owns.** If you learned topics 01–15 you already know the part that is
the same in both:

- `'use client'` and `'use server'`, and the module-graph rules behind them
  ([topics 02–04](02-two-module-graphs.md))
- what may cross the boundary ([topic 05](05-what-crosses-the-boundary.md))
- Server Functions as endpoints, and their security obligations
  ([topic 06](06-server-function-security/README.md))
- composition — `children`, async components, `use`
  ([topics 07–10](07-server-components-as-children.md))
- `cache`, `cacheSignal`, and the payload
  ([topics 13](13-the-rsc-payload.md), [15](15-data-fetching-in-rsc.md))

Next.js's own documentation makes the point implicitly by linking straight out to react.dev
for the directives, the serialization rules and Server Functions rather than restating them.

## What does not transfer

**Routing, caching and file conventions.** These are the framework's, not React's, and this
is where a mental model built on one breaks on the other:

- **File conventions.** `layout.tsx`, `page.tsx`, parallel routes and route groups are
  Next.js. React Router uses a route config where *"the `lazy` field of the RSC route config
  expects the same exports as the Route Module API"*, and a route that exports a
  **`ServerComponent`** instead of a default export renders on the server.
- **Caching and revalidation.** `revalidatePath`, `revalidateTag`, the router cache — all
  framework surface with no React equivalent.
- **Environment conventions.** `NEXT_PUBLIC_` is a Next.js rule for what reaches the client
  bundle. React Router's RSC mode removes its own `.server`/`.client` module conventions and
  points at the `server-only` / `client-only` packages instead.
- **The request-scoped helpers.** `cookies()`, `headers()`, `redirect()` are Next.js APIs.

⚠️ **The trap is assuming a Next.js habit is a React rule.** "Add `NEXT_PUBLIC_`", "call
`revalidatePath` after a mutation", "put it in `layout.tsx`" — none of those are RSC. They
are one framework's answers, and topic 02's module-graph reasoning is what still applies when
you move.

## The setup each expects

Next.js: create the app, write `app/page.tsx`, and Server Components are the default. The
bundler integration, the renderer package and the entries are not yours to think about.

React Router asks for three entry points, and naming them is the clearest picture of what a
framework is actually doing for you:

| Entry | Its job, in the docs' words |
|---|---|
| `entry.rsc` | *"matching the request to a route and generating RSC payloads"* |
| `entry.ssr` | *"calling the RSC server, and converting the RSC payload into HTML on document requests"* |
| `entry.browser` | *"hydrating the generated HTML and setting the `callServer` function to support post-hydration server actions"* |

Plus the Vite config, where *"the `@vitejs/plugin-rsc` plugin should be placed after the
React Router RSC plugin"*. Three environments, one entry each — exactly the three-environment
model from [topic 01](01-what-a-server-component-is/01-the-definition.md), made into files.

React Router also splits RSC into **Framework Mode** and **Data Mode**:

> **RSC Data Mode is missing some of the features of RSC Framework Mode (e.g. `routes.ts`
> config and file system routing, HMR and Hot Data Revalidation), but is more flexible and
> allows you to integrate with your own bundler and server abstractions.**

Data Mode is the "build your own framework" path — useful, and a lot of rope.

## Choosing between them

**Choose Next.js when** RSC is the point of the project, you want the mainstream path, and
you can accept its conventions and its caching model as given. It is the implementation with
the most production mileage and the one most third-party libraries test against.

**Choose React Router when** you already have a React Router application and want to adopt
RSC incrementally, you are on Vite and want to stay there, or you specifically need control
over the server and bundler that Data Mode gives you — and you can live with `unstable_`
APIs that may break in a patch release.

**Choose neither** if the honest answer is that you do not need RSC at all
([topic 17](17-when-rsc-is-wrong.md)). Both of these are real costs, and "which RSC
framework" is the second question.

⚠️ **Check the current stability wording before you commit.** React Router's RSC support was
experimental at the time of writing, and that is exactly the sort of statement that changes.
The rest of this page — what transfers and what does not — will outlive the version numbers.

## Gotchas

**Symptom:** a Next.js pattern does not exist in React Router.
**Cause:** it was a framework convention, not React.
**Fix:** separate the two lists. Directives, serialization and composition are React;
routing, caching and file conventions are not.

**Symptom:** an env var reaches the client in one framework and not the other.
**Cause:** `NEXT_PUBLIC_` is a Next.js rule.
**Fix:** rely on the module graph, and on `server-only` to make a wrong import a build error.

**Symptom:** a React Router RSC app breaks after a patch upgrade.
**Cause:** documented — RSC support is experimental and may break in minor or patch releases.
**Fix:** pin, and read the release notes before upgrading.

**Symptom:** Vite plugin order produces confusing build errors.
**Cause:** `@vitejs/plugin-rsc` must come **after** the React Router RSC plugin.
**Fix:** check the order first; it is documented and easy to get backwards.

**Symptom:** a route renders on the client when it was meant to be server-rendered.
**Cause:** in React Router, a route renders on the server when it exports `ServerComponent`
rather than a default component.
**Fix:** export the right name.

## Interview questions

**★ What transfers between RSC frameworks and what does not?**
Everything React owns transfers: the two directives, the module-graph rules, what may cross
the boundary, Server Functions and their security obligations, composition, `cache` and the
payload. What does not: routing, file conventions, caching and revalidation, request helpers
like `cookies()`, and environment-variable conventions. Those are one framework's answers.

**★ How do Next.js and React Router differ in maturity?**
Next.js's App Router is a production feature with RSC as the default. React Router's RSC
support is documented as **experimental and subject to breaking changes in minor and patch
releases**, with every RSC API still `unstable_`-prefixed. That is the single biggest
practical difference at the time of writing — and the sort of statement worth re-checking
rather than quoting from memory.

**★ What does React Router make you assemble that Next.js does not?**
Three entry points: an RSC server entry that matches the request and generates payloads, an
SSR entry that turns a payload into HTML for document requests, and a browser entry that
hydrates and installs `callServer` for post-hydration Server Functions. Plus the Vite plugin
wiring. It is the three-environment model turned into files — which makes it a good way to
learn what a framework actually does for you.

**Which would you pick?**
Next.js if RSC is the point of the project and its conventions are acceptable — most mileage,
most library support. React Router if you are already on it and Vite, want incremental
adoption, or need Data Mode's control over the server and bundler, and can accept unstable
APIs. And neither if the app does not need RSC, which is the question that should come first.

**Someone says "you must prefix env vars with `NEXT_PUBLIC_` in RSC." Correct them.**
That is a Next.js rule about what reaches the client bundle, not an RSC one. The React-level
rule is the module graph: a value is exposed if the file reading it is in the client graph,
directly or transitively. `server-only` turns a wrong import into a build error, and that
works regardless of framework.

---

← Prev: [Data fetching in RSC](15-data-fetching-in-rsc.md) ·
Index: [Phase 10](README.md) ·
Next → [When RSC is the wrong choice](17-when-rsc-is-wrong.md)
