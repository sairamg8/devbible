---
title: "Choose between React meta-frameworks on how much of your page is interactive and who owns the server — not on benchmarks, and not on the word 'Remix', which now names two incompatible things"
sidebar_label: "02 · Next.js vs the alternatives"
sidebar_position: 2
description: "React Router v7 framework mode, Astro, TanStack Start and Remix — what each is genuinely better at, the decision criteria that outlive version numbers, and an honest account of when Next.js is the wrong answer."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04. Next.js claims for **16.3.4** against the [installation docs](https://nextjs.org/docs/app/getting-started/installation) and the [16.3 release post](https://nextjs.org/blog/next-16-3). React Router claims against the [official React Router v7 announcement](https://remix.run/blog/react-router-v7) (primary).
> ⚠️ **Competitor version and status claims below are sourced to secondary reporting and are explicitly marked where a primary source could not be reached.** Documentation-verified; **no sandbox run**; **no benchmarks run**.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**Framework comparisons age badly because they are usually written as feature tables, and features get copied between frameworks within a release or two. What does not get copied is the architectural centre — what each project decided to make easy at the cost of making something else hard. This page argues the comparison on those centres, so it stays useful after the version numbers on it are wrong. It also has to start with a naming problem, because "Remix" no longer identifies one thing.**

## 🔴 First, the naming problem: "Remix" names two incompatible things

You cannot have this conversation until this is settled, and most comparison articles do not settle it.

**Remix v2 became React Router v7.** This is confirmed by the official announcement, which states that *"React Router v7 brings everything you love about Remix back into React Router proper"* and explicitly advises: *"We encourage all Remix v2 users to upgrade to React Router v7."* What was Remix is now React Router v7's **framework mode** — described as *"a compiler with broad support for dependencies (based on Vite), server rendering, bundle splitting and optimization, vastly improved type safety, a world-class development environment with HMR."*

**⚠️ Remix v3 is widely reported to be a separate project that is not built on React at all** — a custom component model rather than a React meta-framework — and to have remained pre-release through mid-2026. **This could not be confirmed against a primary source for this page.** The official React Router v7 announcement does not mention v3 or any continuing separate Remix line. Treat it as credible secondary reporting, verify before acting on it, and do not let anyone in a design discussion use "Remix" without saying which one.

The practical consequence: **when someone proposes "Remix" as the alternative to Next.js, the useful comparison is almost always against React Router v7 framework mode.** That is the React-based, production-ready successor to the Remix people mean.

## The four architectural centres

| | Centre of gravity | Makes easy | Makes hard |
|---|---|---|---|
| **Next.js** | Integrated full-stack React with framework-owned caching | Server-first rendering, per-route static/dynamic, one deployment for everything | Escaping the framework's opinions; understanding the caching model |
| **React Router v7** (framework mode) | Web fundamentals — requests, responses, forms | Predictable data flow via loaders/actions; incremental adoption from an SPA | Anything you want the framework to decide for you |
| **Astro** | Content first, JavaScript as the exception | Genuinely zero-JS content pages; mixing UI frameworks on one page | Heavily interactive application shells |
| **TanStack Start** | Type-safe routing as the foundation | End-to-end inference from route to data | Betting on the youngest of the four |

**Read the "makes hard" column first.** Every one of those is a deliberate trade, not a defect, and it is the column that predicts whether you will be fighting the tool in month six.

## React Router v7 framework mode

The closest competitor to Next.js for application work, and the one whose difference is philosophical rather than featural.

Its centre is **the web platform's own model**: a route has a `loader` for reads and an `action` for writes, forms submit, responses are `Response` objects. There is no framework-owned persistent cache that you have to learn, and no equivalent of Next.js's extended `fetch()` semantics. You get what you asked for, when you asked for it.

**Choose it when:** the team values predictability over integration; you are migrating an existing React SPA incrementally; you want to own your server; or Next.js's caching model has already cost you an incident and the team has lost patience with it.

**Choose Next.js instead when:** you want Server Components, streaming and caching as framework concerns rather than application concerns, and you would rather learn one opinionated model than assemble and maintain your own.

⚠️ **Do not choose on "React Router is simpler".** It is simpler in what it decides and correspondingly larger in what you must decide. Caching, in particular, does not disappear — it moves into your application code, where it is your bug rather than the framework's.

## Astro

The clearest fit criterion of any framework here: **what fraction of your page is interactive?**

Astro's islands architecture ships **zero JavaScript by default**, and interactive components are opt-in islands with explicit hydration directives. It is also framework-agnostic — React, Svelte and Vue components can coexist on one page, which is unusual and occasionally decisive during a migration.

**Choose it when:** documentation sites, marketing sites, blogs, content platforms — anything where most of the page is text and a handful of widgets are interactive. Also when you need to render components from more than one UI framework in one place.

**Choose Next.js instead when:** the application shell itself is interactive — a dashboard, an editor, anything with persistent client state across navigations. Astro can do this; it is simply not what it optimises for, and you will be working against the grain.

⚠️ **Next.js Server Components have narrowed this gap and not closed it.** A Server Component ships no JavaScript for itself, which is genuinely the same outcome for a static page. The remaining difference is default and floor: Astro starts at zero and adds, Next.js starts with a framework runtime. For a mostly-static content site that difference is still real.

*Reported status, secondary sources, 2026: Astro 6 stable since February 2026, 6.3.x current around May 2026, with an Astro 7 alpha in progress and the project acquired by Cloudflare in January 2026. ⚠️ Not confirmed against a primary source here — check `astro.build` before quoting any of it.*

## TanStack Start

**Type safety as the organising principle**, extending TanStack Router's fully-inferred routing to a full-stack framework. Route params, search params, loader data and actions are inferred end to end, so a route change surfaces as a type error at every call site rather than a runtime 404.

If your team's actual pain is "we renamed a route param and found out in production", this addresses that at the root, more thoroughly than Next.js's typed routes do.

**Choose it when:** type safety is the top priority; the team already uses TanStack Query and wants coherence; the application is router-centric rather than content-centric.

**Choose Next.js instead when:** you need a large hiring pool and an ecosystem of solved problems, or the project must be low-risk. This is a maturity argument, not a quality one.

*Reported status, secondary sources, 2026: a v1.0 Release Candidate around March 2026, with sources disagreeing on whether 1.x stable had shipped by mid-2026. ⚠️ **The sources consulted genuinely conflict on this point** — one describes an RC "pending final feedback and docs polish", another describes 1.x as already stable. Check `tanstack.com/start` directly; do not repeat either claim from this page.*

## 🔴 When Next.js is the wrong answer

A comparison page that never concludes against its own subject is marketing. Four honest cases:

1. **A mostly-static content site.** Astro or a static generator will be simpler, lighter and cheaper. Next.js will work, and you will carry a framework runtime and a caching model you do not need.
2. **You cannot or will not run a Node server, and self-hosting must be simple.** Next.js self-hosts, but the deployment surface — caching, ISR, image optimization, adapters — is genuinely more complex than a static bundle plus an API.
3. **The team has been burned by the caching model and will not re-learn it.** This is a real and defensible position. The model changed substantially across majors, the direction is now explicitly *"dynamic by default, with no hidden or implicit caching"*, and a team that has already paid for that churn is entitled to want a framework that never had the problem.
4. **An internal tool behind a login, with no SEO requirement and no cold-start concern.** Most of what you are paying Next.js for is first-paint and crawlability. A Vite SPA is a smaller machine.

⚠️ **A case that is *not* on that list: "we only need a SPA, so a meta-framework is overkill."** The App Router does client-side navigation after first load; you are not choosing between server rendering and interactivity. The honest version of that objection is item 4 — no SEO, no cold-start concern — not "SPAs are different".

## The criteria that outlive version numbers

When the specifics above are stale, these still work:

1. **What fraction of the page is interactive?** Mostly static → Astro. Mostly interactive shell → Next.js or TanStack Start.
2. **Who owns caching — the framework or you?** Framework → Next.js. You → React Router v7.
3. **What breaks when someone renames a route?** A type error → TanStack Start. A runtime 404 → most others.
4. **How much does the team's existing knowledge count?** Usually more than any technical difference on this page.
5. **Where does it deploy, and who operates it?** Decide this before the framework, not after.

## Gotchas

**★ Symptom: a team adopts "Remix" from a 2024 article and lands on a project with a different component model than they expected.** Cause: "Remix" now names at least two things — Remix v2, which became React Router v7 framework mode, and a separately reported v3 line that secondary sources describe as not React-based. Fix: never accept "Remix" unqualified in a decision. For a React project the comparison you want is React Router v7 framework mode.

**★ Symptom: the team switches away from Next.js to escape caching bugs and gets caching bugs anyway.** Cause: React Router v7 does not have a framework cache, which means caching moved into application code, not out of existence. The bugs are now yours to write and yours to find. Fix: choose on *who should own caching*, not on *whether caching is hard* — it is hard everywhere.

**★ Symptom: a framework migration is justified with benchmark numbers and delivers no measurable change.** Cause: published benchmarks measure a demo application's shape, not yours, and all four frameworks are fast when used as intended. The real differences are in what each makes easy. Fix: if the argument is performance, measure your own application first — most such migrations are really about developer experience, which is a legitimate reason that should be stated honestly.

**★ Symptom: Astro is chosen for a content site and the team ends up fighting it over an interactive dashboard bolted on later.** Cause: the fit criterion is the interactive fraction, and that fraction changed after the decision. Fix: ask what the site will be in two years. Astro's islands are excellent for widgets on content and awkward for an application shell with persistent client state.

**★ Symptom: "we only need a SPA, so Next.js is overkill" — and the resulting SPA reimplements routing, data fetching and code splitting.** Cause: treating server rendering and client interactivity as opposites. The App Router does client-side navigation after the first load. Fix: the honest form of this objection is no-SEO plus no-cold-start, which is a real case; "SPAs are different" is not.

**Symptom: a comparison table in a design doc is confidently wrong within a quarter.** Cause: features copy between frameworks quickly; architectural centres do not. Fix: write the doc around what each project makes *hard*, which is the stable part.

**Symptom: version numbers on this page do not match what npm reports.** Cause: competitor versions here are secondary-sourced and dated, and at least one — TanStack Start's 1.0 status — had sources actively contradicting each other when this was written. Fix: check the vendor's own site before quoting any number from this page. The architectural argument is what this page is for.

## Interview questions

**★ Someone proposes migrating from Next.js to Remix. What is your first question?**
Which Remix. Remix v2 became React Router v7 — the official announcement says v7 *"brings everything you love about Remix back into React Router proper"* and encourages all v2 users to upgrade — so what was Remix is now v7's framework mode. There is also widely reported to be a separate v3 line that is not built on React at all, though I could not confirm that against a primary source. Until that ambiguity is resolved the proposal has no defined subject, and for a React codebase the comparison almost certainly means React Router v7 framework mode.

**★ How do you actually choose between Next.js, React Router v7, Astro and TanStack Start?**
On architectural centres rather than features, because features get copied between releases and centres do not. Four questions: what fraction of the page is interactive — mostly static favours Astro, an interactive shell favours Next.js or TanStack Start. Who should own caching — the framework, which is Next.js, or you, which is React Router v7. What happens when someone renames a route — a type error is TanStack Start's core promise, a runtime 404 is everyone else. And what the team already knows, which usually outweighs everything technical. I would also decide the deployment target before the framework rather than after.

**★ Give a case where Next.js is the wrong choice.**
A mostly-static content site is the clearest: Astro or a static generator is simpler and lighter, and Next.js makes you carry a framework runtime and a caching model you get no value from. Three others hold up. A team that cannot run a Node server and needs self-hosting to stay simple — Next.js self-hosts, but the surface of caching, ISR, image optimization and adapters is real. A team already burned by the caching model, which is defensible given how much it changed across majors. And an internal tool behind a login with no SEO and no cold-start concern, where most of what Next.js is for does not apply.

**Is "we only need a SPA, so a meta-framework is overkill" a good argument?**
Not as stated, because it treats server rendering and client interactivity as alternatives. The App Router does client-side navigation after first load, so you are not giving up SPA behaviour. The defensible version is narrower: no SEO requirement and no cold-start sensitivity, typically an internal tool behind a login. Then a Vite SPA genuinely is the smaller machine and the argument is sound — but it rests on those two conditions, not on the SPA label.

**Astro ships zero JavaScript by default. Do Server Components close that gap?**
They narrow it substantially and do not close it. A Server Component ships no JavaScript for itself, so for a purely static page the outcome is the same. The remaining difference is the default and the floor: Astro starts at zero and adds islands where you ask, while Next.js starts with a framework runtime. On a mostly-static content site that floor is still a real difference; on an application with an interactive shell it is noise, and Astro's islands become the awkward part instead.

**A team wants to leave Next.js because caching keeps causing incidents. Will React Router v7 fix that?**
It removes the framework-owned cache, so it removes that class of framework bug — and moves caching into application code, where you will write your own. That is a genuine improvement if the team's complaint is *implicitness* rather than difficulty: they want caching to be visible in code they wrote. It is not an improvement if the complaint is that caching is hard, because it is hard everywhere. Worth adding that Next.js is moving in their direction anyway, with the stated goal of dynamic by default and no hidden or implicit caching.

**Why should a comparison document be written around what each framework makes hard?**
Because that is the stable part. Features copy between frameworks within a release or two — every project here has server rendering, streaming, file-based routing and type-safe params in some form — so a feature table is out of date almost immediately. What each project made *hard* follows from what it decided to optimise, and that rarely changes: Astro will keep being awkward for interactive shells, React Router will keep declining to make caching decisions for you, and Next.js will keep having opinions you must learn. A document written on that axis survives the next release; one written on features does not.

---

← Prev [01 · Evolution to the App Router](01-evolution-from-pages-router-to-app-router-why-app-router-is.md) · [Index](01-explanation.md) · Next → [03 · Core philosophy: server-first rendering](03-core-philosophy-server-first-rendering.md)
