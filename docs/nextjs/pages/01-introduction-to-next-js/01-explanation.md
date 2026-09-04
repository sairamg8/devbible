---
title: "Next.js is a React meta-framework whose whole product is the set of decisions React deliberately leaves open — where a component runs, when its data is fetched, and what gets cached"
sidebar_label: "01 · Overview: what Next.js is"
sidebar_position: 0
description: "Chapter 1 overview: what a meta-framework actually decides for you, the server-first default, the App Router's place in the framework's history, how the chapter's seven pages fit together, and the version reality as of 16.3.4."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against the [installation docs](https://nextjs.org/docs/app/getting-started/installation) (page header `version: 16.3.4`, `lastUpdated` 2026-07-21), the [16.3 release post](https://nextjs.org/blog/next-16-3) (`publishedAt` August 3rd 2026) and the [Next.js Support Policy](https://nextjs.org/support-policy).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**React is a library for describing user interfaces, and it is deliberately silent on almost everything a production application needs to decide: which machine a component runs on, when its data is fetched, what is cached and for how long, how a URL maps to code, and what the browser receives before any JavaScript executes. Next.js is the answer to that silence. Every feature in the following eighteen chapters is a consequence of one architectural bet — that those decisions belong to the framework, made per-route and per-fetch, rather than to a stack of libraries you assemble yourself. Understanding the bet is what makes the rest of the book coherent rather than a list of APIs.**

## What a meta-framework actually decides

The word "meta-framework" is doing real work and is worth unpacking, because the alternative to Next.js is not "no framework" — it is a set of choices you make yourself and then maintain forever.

| Decision | React alone | Next.js App Router |
|---|---|---|
| Where a component runs | Client, always | **Server by default**, client on opt-in |
| URL → code | A router library you install and wire | File-system routing under `app/` |
| Data fetching | `useEffect`, or a data library | `async` Server Components; an extended `fetch()` |
| Caching | Whatever your data library does | A framework concern, per-route and per-fetch |
| What ships to the browser | Your whole component tree | Only what is marked interactive |
| First paint | After JS downloads and hydrates | HTML/RSC payload, before hydration |

Read down that right-hand column and you have the chapter list. Chapters 2–3 are routing and the server/client split, 4–5 are fetching and caching, 6–7 are rendering strategy and failure. None of it is arbitrary; it is the consequences of moving those five rows into the framework.

## The one idea underneath all of it: server-first

**The default is that your code runs on the server, and interactivity is something you opt into.** That inverts the assumption most React developers built their instincts on, where everything is a client component and the server is a JSON endpoint.

Three consequences, each of which gets its own page later:

1. **Compute sits next to data.** A Server Component can query a database directly. There is no round trip to your own API for the common case, and no serialisation boundary to design.
2. **Interactivity is a cost you pay explicitly.** `'use client'` is a boundary marker. Everything below it ships to the browser; everything above it does not.
3. **Static and dynamic stop being a global mode.** The same application can prerender a marketing page, stream a dashboard, and revalidate a product list on a timer — decided per route, and increasingly per fetch.

🔴 **The failure mode this creates is specific and extremely common: reaching for `'use client'` at the top of every file because that is what makes the familiar hooks work.** Do that and you have reconstructed a Pages-era client bundle inside App Router syntax, paying the migration cost and receiving none of the benefit. [03 · Core philosophy](03-core-philosophy-server-first-rendering.md) is about pushing that boundary down the tree instead.

## How this chapter is laid out

| Page | What it settles |
|---|---|
| **[01 · Evolution to the App Router](01-evolution-from-pages-router-to-app-router-why-app-router-is.md)** | Why the Pages Router existed, what it could not do, and what "App Router is the standard" means for a codebase that still has both |
| **[02 · Next.js vs the alternatives](02-nextjs-vs-alternatives-remix-react-router-v7-astro-tanstack.md)** | Remix / React Router v7, Astro, TanStack Start — what each is genuinely better at, and when Next.js is the wrong answer |
| **[03 · Core philosophy](03-core-philosophy-server-first-rendering.md)** | Server-first rendering, the `'use client'` boundary, and hybrid static/dynamic as a per-route decision |
| **[03b · Hybrid static/dynamic](03b-hybrid-static-dynamic-and-the-cost-model.md)** | Why static and dynamic are per-route rather than global, what silently flips a route to request-time, and why 'accidentally static' is the more dangerous bug |
| **[04 · Versioning and the LTS model](04-versioning-and-lts-model-what-stable-canary-and-preview-mean.md)** | 🔴 Support is per **major line**; the two-year maintenance clock; why a minor bump can break you on 15.x |
| **[05 · Project setup](05-project-setup-create-next-app-turbopack-defaults-typescript.md)** | `create-next-app` and every prompt it asks, Turbopack as the default bundler, the linter choice, and what `next build` stopped doing in 16 |
| **[06 · Hello World with `app/`](06-hello-world-with-the-app-directory.md)** | The two required files, why the root layout is special, and what actually happens on the first request |
| **[07 · Key framework shifts](07-key-framework-shifts-stable-react-compiler-support.md)** | The React Compiler (and its Rust port — two different things), async `params`/`searchParams`, and the Node 20.9 floor |

## The version reality, stated once

Every page in this book is written against a specific version, and this chapter is the place that number is established rather than assumed.

| | As of 2026-09-04 |
|---|---|
| Current stable | **16.3.4** |
| 16.3 | **Stable since August 3, 2026** — not "in preview" |
| Support lines | **16.x Active LTS · 15.x Maintenance LTS** (majors, not minors) |
| Node.js floor | **20.9** |
| TypeScript floor | **5.1.0** |
| React, on the App Router | **Bundled React canary**, not your `package.json` version |

⚠️ **If you are reading a page in this book that says stable is 16.2 and 16.3 is in preview, that page predates the 2026-09-03 verification pass and is stale.** The corrections are flagged in place where they were found. [04 · Versioning](04-versioning-and-lts-model-what-stable-canary-and-preview-mean.md) explains why the support line matters more than the version number.

## Where Next.js is going, in its own words

Worth knowing early, because it explains why some chapters teach two models. The 16.3 release post describes the direction as part of

> our work over the last year to simplify Next.js back to its roots: dynamic by default, with no hidden or implicit caching.

That sentence is a course correction. Earlier App Router versions cached aggressively and implicitly, which was the single most-complained-about aspect of the framework — behaviour that was hard to predict and harder to opt out of. The `'use cache'` directive and Cache Components are the replacement: explicit, composable, and opt-in. **The behaviours behind Instant Navigations are stated to become the default in a future major version**, so what is opt-in via `cacheComponents: true` today is the shape of the framework tomorrow. Chapter 5 teaches both models for exactly that reason.

## A worked orientation: the smallest complete application

Two files. This is genuinely all of it — no router configuration, no build config, no server entry point.

```tsx
// app/layout.tsx — required; must contain <html> and <body>
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

```tsx
// app/page.tsx — a Server Component, because that is the default
export default function Page() {
  return <h1>Hello, Next.js!</h1>
}
```

That `page.tsx` ships **zero JavaScript** to the browser for its own sake. Not "a small amount" — none, because nothing in it is interactive. Adding a `useState` and a click handler is what makes it a client component, and that is the moment a bundle appears. [06 · Hello World](06-hello-world-with-the-app-directory.md) walks the whole request path.

## The running example

Chapters use **SprintDesk**, a multi-tenant SaaS task dashboard, so that examples accumulate into one system rather than restarting each chapter. It is deliberately a shape with tension in it: tenant isolation, per-user data that must never be cached wrongly, a dashboard that should stream, and marketing pages that should be fully static. Chapter 18 contrasts it with a PPR-driven storefront, where the trade-offs land differently.

## Gotchas

**★ Symptom: you migrate to the App Router and the bundle gets *bigger*.** Cause: `'use client'` at the top of nearly every file, usually because a hook threw an error and adding the directive made it stop. You now ship the Pages-era bundle plus App Router overhead. Fix: move the directive **down** the tree to the smallest interactive leaf. A layout or page is almost never the right place for it.

```tsx
// app/dashboard/page.tsx — server, no directive; fetches directly
export default async function Page() {
  const tasks = await db.task.findMany()
  return <TaskList tasks={tasks} />   // TaskList is server too
}
// app/dashboard/filter-input.tsx — only THIS ships to the browser
'use client'
export function FilterInput() { /* useState lives here */ }
```

**★ Symptom: "Next.js is just webpack-for-React, we'll use the bits we like."** Cause: treating the framework as a bundler with conventions. Routing, the server/client boundary and caching are not conveniences layered on React — they are the product, and they interlock. Fix: adopt the model or choose a different tool honestly; [02](02-nextjs-vs-alternatives-remix-react-router-v7-astro-tanstack.md) covers when that is the right call. Opting out piecemeal reimplements a worse framework inside a better one.

**★ Symptom: a tutorial's code does not compile, and the API it uses does not exist.** Cause: App Router material written across four majors is all still online, and the framework changed substantially in each. `request.ip` and `request.geo` were removed in v15.0.0; Route Handlers stopped being cached by default in v15.0.0-RC; v16.0.0 removes several route segment config options under Cache Components. Fix: check the publication date, and prefer the docs bundled in your own `node_modules/next/dist/docs/` — they match your installed version by construction.

**★ Symptom: an AI agent writes confident App Router code against APIs that were removed.** Cause: it is answering from training data. Fix: `next upgrade` maintains version-matched docs inside the package and an `AGENTS.md` block pointing at them. This is the mechanism that replaced Vercel's earlier documentation Skills, and it only works if you actually upgrade.

**Symptom: the same `fetch()` call caches on one route and not on another, with no code difference.** Cause: caching is a property of the route as much as the call — whether anything in the route reads a Request-time API decides whether it prerenders. Fix: read chapter 4 before debugging a specific call; the behaviour is not local to the line you are looking at.

**Symptom: you pin React to get a specific version and the App Router ignores you.** Cause: the App Router uses bundled React canary releases; `package.json` React exists for tooling and ecosystem compatibility. Fix: track the Next.js version instead. The Pages Router *does* use your pinned version, so a codebase mid-migration answers this question two different ways.

**Symptom: "we're on the latest 15, so we're current."** Cause: conflating the newest minor with a supported line. 15.x is Maintenance LTS, closing around October 2026. Fix: state your position as major line plus phase, never a bare version number. See [04](04-versioning-and-lts-model-what-stable-canary-and-preview-mean.md).

## Interview questions

**★ What is a "meta-framework", and what specifically does Next.js decide that React does not?**
React describes UI and is deliberately silent on the surrounding architecture. A meta-framework fills that silence with defaults. Next.js decides five things: where a component runs — server by default, client on opt-in; how URLs map to code, via file-system routing under `app/`; how data is fetched, through `async` Server Components and an extended `fetch()`; what is cached and for how long, as a framework concern rather than a data-library concern; and what the browser receives before hydration. The alternative to a meta-framework is not "no framework" — it is making those five decisions yourself and maintaining them forever.

**★ What does "server-first" mean in practice, and what is the most common way teams get it wrong?**
It means components run on the server unless you explicitly mark them otherwise, so interactivity is a cost you opt into rather than the baseline. In practice that lets compute sit next to data — a Server Component can query the database directly, with no round trip to your own API and no serialisation boundary to design. The common failure is putting `'use client'` at the top of every file, usually because a hook errored and the directive made the error go away. That reconstructs the old client bundle inside the new syntax: you pay the migration cost and get none of the benefit. The fix is to push the directive down to the smallest interactive leaf.

**★ Next.js says it is moving to "dynamic by default, with no hidden or implicit caching". What is that a correction to?**
To earlier App Router versions, which cached aggressively and implicitly. It was the framework's most-criticised behaviour: hard to predict, harder to opt out of, and it made simple dynamic pages mysteriously stale. The `'use cache'` directive and Cache Components are the replacement — explicit, composable, opt-in. It matters for learning because the behaviours behind Instant Navigations are stated to become the default in a future major, so what you enable today with `cacheComponents: true` is the framework's future shape. That is why the caching chapter has to teach two models rather than one.

**Why does the same `fetch()` call cache on one route and not another?**
Because caching is a property of the route as well as the call. If anything in the route reads a Request-time API — cookies, headers, search params — the route renders per request; otherwise it can prerender and the fetch runs once at build. So an unannotated fetch behaves differently in two places because the *route* differs, not the call. The lesson is that you cannot debug caching by staring at the line in front of you, which is why the framework encourages stating intent explicitly on the call.

**A candidate says "Next.js is just webpack for React". How would you respond?**
That it describes an older Next.js and misses the current product entirely. Routing, the server/client boundary and the caching model are not conveniences layered over React — they interlock, and using only "the bits you like" means reimplementing the rest yourself, worse. The reasonable version of that instinct is to ask whether you want a meta-framework at all: Astro is better for content-heavy sites, TanStack Start for router-centric type-safe apps, Remix for closeness to web fundamentals. Choosing one of those is legitimate; opting out of Next.js piecemeal while still using Next.js is not.

**What are the current version floors, and which one behaves differently from the others?**
Node 20.9 — the patch component is load-bearing, so a CI image on an older 20.x satisfies a naive "Node 20+" check and still fails. TypeScript 5.1.0. Browsers Chrome/Edge/Firefox 111+ and Safari 16.4+. React is the odd one: on the App Router it is not a floor you set at all, because the App Router bundles React canary releases internally. You still declare `react` and `react-dom`, but for tooling and ecosystem compatibility rather than version selection — the Next.js version is what moves the React underneath you.

**Why is so much App Router material on the internet wrong?**
Because the App Router changed substantially across four majors and all of it is still indexed. Concretely: `request.ip` and `request.geo` were removed in v15.0.0 and now read `undefined`, so a rate limiter keyed on them silently collapses to one bucket; Route Handlers stopped being cached by default in v15.0.0-RC, which inverts a widely-repeated pitfall; and v16.0.0 removes several route segment config options under Cache Components. The defence is to prefer the docs bundled at `node_modules/next/dist/docs/`, which match your installed version by construction rather than by the author's memory.

---

Next → [01 · Evolution from the Pages Router to the App Router](01-evolution-from-pages-router-to-app-router-why-app-router-is.md)
