---
title: "Running the corrected production checklist over SprintDesk, item by item — where the application passes, where it passes for the wrong reason, and the four 16-era items the published checklist does not ask about at all"
sidebar_label: "01c · Checklist pass: rendering and caching"
sidebar_position: 4
description: "The rendering, caching and build halves of Appendix D applied to a specific application, with the observation that distinguishes 'working' from 'configured' recorded for every item."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 — this page composes material already verified across chapters 2 through 17 of this book against the Next.js 16.3.4 documentation, and takes its checklist structure from [How to optimize your Next.js application for production](https://nextjs.org/docs/app/guides/production-checklist) as **corrected** in [Appendix D](../20-appendices/04-appendix-d-production-readiness-checklist-security.md). It introduces no new framework claims of its own.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**[Appendix D](../20-appendices/04-appendix-d-production-readiness-checklist-security.md) corrects the official checklist. This page does something the appendix cannot: it runs the corrected version over one specific application and records what it found. The distinction matters more than it sounds, because a checklist read as a list of topics produces a green review, and a checklist read as a list of *observations* produces findings. Every row below therefore carries the same third column — the thing you would have to see to distinguish an item that is genuinely working from one that is merely configured. Three of SprintDesk's items pass for the wrong reason, and four of the most consequential ones are not on the published checklist at all because they arrived with 16.**

## How to read a pass

The format is fixed, and the third column is the whole exercise:

| Column | What goes in it |
|---|---|
| **Item** | the checklist line, corrected where Appendix D corrects it |
| **SprintDesk** | what the application actually does, naming the milestone that did it |
| 🔴 **The observation** | what you must *see* to call it closed — never "we handle that" |

⚠️ **An item with no third column is not a check, it is a topic.** That is the failure mode of every launch review that passes an application which goes down within the month, and it is why [01](01-sprintdesk-retrospective-the-finished-multi-tenant-saas-revi.md) insists that a working application is weak evidence.

## Routing and rendering

| # | Item | SprintDesk | 🔴 The observation |
|---|---|---|---|
| R1 | `layout.js` for shared UI and partial rendering | one root layout, and chapter 9 flagged it as **contended** — font `className`, global stylesheet and pre-hydration theme script all meet there | the root layout performs **no** request-time read; anything else about it is style |
| R2 | `<Link>` for navigation and prefetching | used everywhere, `prefetch` never set | which routes have a `loading.js`, because that file is the prefetch policy — see [01ba](01ba-the-inherited-pile.md) |
| R3 | `error.js`, `not-found.js`, `app/global-error.tsx` | chapter 7 produced a failure map with a chosen degradation rung per dependency | not "does a boundary exist" but "for each dependency, which rung does the user land on", checked against the current file tree |
| R4 | `"use client"` boundary placement | audited in chapter 11; the bundle map is a **kept artefact** | two maps, from different releases, that can be diffed — one map is a snapshot, not an audit |
| R5 | Request-time APIs opt the route into dynamic rendering | chapter 6 built three strategies in one deploy and named shared layouts as the coupling | the **build's own route classification**, not a grep — the grep misses the read inside an imported component |
| R6 | "PPR is experimental" | `cacheComponents: true` since chapter 5 | this item is vacuous here: PPR is the default behaviour, and the flag the checklist names was removed |

### R5 is still the highest-value item on the page

Appendix D quotes it in full because it is the one sentence most worth acting on, and it is worth re-reading with SprintDesk in mind:

> *"Be aware that Request-time APIs like `cookies` and the `searchParams` prop will opt the entire route into Dynamic Rendering (or your whole application if used in the Root Layout). Ensure Request-time API usage is intentional and wrap them in `<Suspense>` boundaries where appropriate."*
> — quoted in [Appendix D part 1](../20-appendices/04-appendix-d-production-readiness-checklist-security.md)

SprintDesk is unusually exposed to this, for a reason that is a *feature* of the application rather than a mistake: it deliberately runs static marketing pages, ISR'd public team pages and a dynamic board in one deployment ([chapter 6's milestone](../06-ssg-isr-and-ssr-strategy/06-project-milestone-static-marketing-pages-isrd-public-team-pa.md)). Three strategies sharing one root layout means the root layout is the single file where one casual line converts all three into one.

```bash
# necessary, not sufficient — it cannot see a read inside an imported component
grep -rn "cookies()\|headers()\|draftMode()" app/layout.tsx components
```

🔴 **The sufficient check is the build.** Chapter 6's seam analysis makes the point that a shared *component* is not a boundary either: if the site header reads a cookie, every route that renders the header inherits the consequence, and no grep of `app/layout.tsx` will show it.

## The two items 16 added and the checklist never mentions

### Parallel-route slots need a `default.js`, or the build fails

Appendix D lists this as `missing` from the published checklist, and it is the only item on this page whose failure mode is *loud*. That makes it easy and worth doing anyway:

```bash
find app -type d -name '@*'      # every parallel-route slot
find app -name 'default.tsx' -o -name 'default.js'
```

**The finding for SprintDesk today is that this does not apply**, and the review value is entirely in the future tense: the first modal, drawer or side-panel implemented as a parallel route turns a passing build into a failing one, for a reason nobody on the team has met before. It is worth writing the two commands into the repository's context file precisely because the application does not need them yet.

### `middleware` is now `proxy`, and its runtime is not a choice

SprintDesk ships a `proxy.ts` deliberately, and chapter 10 is emphatic about what it is for: redirecting the obviously-signed-out fast, so nobody watches a dashboard skeleton resolve into a login page. It is UX, not control ([ch10 · proxy as UX, not control](../10-forms-authentication-and-security-hardening/06l-milestone-proxy-as-ux-not-control.md)).

Two facts that a review has to confirm rather than assume:

- **Proxy runs on the Node.js runtime since v16.0, and the `runtime` config option is not available in Proxy files.** Any assumption the old `middleware.ts` made about the edge runtime is now false.
- **A codemod that renames a file does not verify that the logic still runs where you believed.** Appendix D part 2 makes this point about CSP nonces specifically.

```bash
# should print nothing — the option does not exist in a proxy file
grep -n "runtime" proxy.ts
# should print nothing — the proxy reads the cookie, never the database
grep -n "db\.\|drizzle\|getCurrentUser" proxy.ts
```

🔴 **The observation that distinguishes working from configured here is the second grep, not the first.** A proxy that queries the database to decide a redirect has quietly become a control — it is on the request path for every route, it is now a database dependency for static pages, and the framework's own documentation tells you not to rely on it as the check anyway. The authorisation question belongs to [01d](01d-the-checklist-pass-security-and-the-data-access-layer.md).

## Data fetching and caching

| # | Item | SprintDesk | 🔴 The observation |
|---|---|---|---|
| C1 | Route Handlers give Client Components backend access — *"do not call Route Handlers from Server Components"* | the data access layer is a plain module both entry points import ([ch15](../15-databases-apis-and-full-stack-patterns/02l-the-decision-rule.md)) | `grep -rn "fetch('/api" app` returns nothing |
| C2 | "Verify whether your data requests are being cached" | inverted under Cache Components: nothing is cached until marked | walk the routes and name which reads carry `'use cache'` — a yes/no answer means the wrong question was asked |
| C3 | `revalidateTag` versus `updateTag` | board mutations use `updateTag` for read-your-own-writes; slower content uses `revalidateTag` | for each call site, name the **person** who must see the change: the actor, or somebody else later |
| C4 | `revalidateTag` now takes a `cacheLife` profile as a second argument | every call site was walked at the 16 upgrade | the walk happened *and* produced decisions — some of those calls should have become `updateTag` |
| C5 | Stream with `loading.js` and `<Suspense>`; fetch in parallel | chapter 5's PPR shell plus one per-user hole; chapter 7's boundaries | the shell is served before the database is consulted — which is a thing you watch, not a thing you configure |
| C6 | Static assets in `public` | unchanged | — |

### C7 · The caching item no published checklist has

`revalidateTag()` invalidates the instance it ran on. SprintDesk is [deployed twice](../17-deployment-scaling-and-observability/06-project-milestone-sprintdesk-deployed-twice.md), which is exactly why this is a finding here and invisible in most reviews: with one instance the behaviour is indistinguishable from correct.

🔴 **The observation is two instances agreeing after an invalidation, and nothing short of it.** A `cacheHandler` entry in `next.config.ts` proves configuration. The report *"a board is stale for one user and fresh for a colleague, with no pattern"* is what the absence of a shared cache actually looks like, and it arrives as a support ticket rather than as an error.

### C8 · The migration gate, which is not on anybody's checklist

Chapter 15's second seam: your types say a column is `NOT NULL`; only an applied migration makes the database agree. The check is a release step against the direct connection string, gated so that a pending migration **fails the deploy rather than the first request** — and never run from application startup, because instances race.

**The observation:** a deploy that is rejected when a migration is outstanding. If nobody has ever seen the deploy rejected, the gate has not been tested; it has been written.

## The build

This is where the published checklist has aged worst, and where a review that follows it produces a green result from an instrument that has stopped measuring.

| # | Item | The 16 reality | 🔴 The observation |
|---|---|---|---|
| B1 | *"Use the built-in `eslint-plugin-jsx-a11y` plugin"* | `next lint` was **removed** and *"`next build` no longer runs linting"* | an explicit lint step exists in CI — `grep -n '"lint"' package.json` and a CI job that runs it |
| B2 | silent on build metrics | 16.0 removed `size` and `First Load JS` from `next build` output as *"inaccurate in server-driven architectures using React Server Components"* | any CI budget that parsed those numbers is now **passing vacuously** |
| B3 | *"Use the `@next/bundle-analyzer` plugin"*, anchored `for-webpack` | Turbopack is the default bundler; `next experimental-analyze` shipped in **16.1** | the artefact from chapter 11 exists on disk and has been diffed against a previous release |
| B4 | silent on parallel-route slots | a missing `default.js` **fails the build** | the two `find` commands above, run once and written into the context file |

### B2 is the item that fails a review silently

Chapter 14 states the consequence precisely, and it is the cleanest example in the book of a check that keeps reporting success after it stops working:

> **A CI bundle-size gate has been passing since the upgrade and measuring nothing.**
> *Symptom:* the gate is green and has been for every build since 16.
> *Cause:* 16 removed `size` and `First Load JS` from `next build` output; a parser finds no numbers and reports no regression.
> — [ch14 · what an agent cannot decide](../14-agent-driven-development/06b-what-an-agent-cannot-decide-and-what-context-files-fix.md)

**SprintDesk's answer to this is chapter 11's milestone**, and it is worth naming as the pattern rather than the tool: the audit's first act produces a bundle map, and *keeps the artefact* so it can be diffed across releases. A budget built on a number the build no longer prints is a gate; an artefact you diff is evidence. The former reports green forever, and the latter cannot, because a diff of nothing against something is visibly nothing.

### B1 and the accessibility pass

Chapter 12's milestone included an accessibility pass. Chapter 13 built five test layers, each with a written statement of what it cannot see.

🔴 **The finding is that the a11y pass was an event, not a gate**, and the reason is B1: `next lint` is gone, `next build` no longer lints, so a project that never added an explicit lint step has had no accessibility rule fire since the upgrade — with no configuration change and nothing in the log. The remediation is one line in `package.json` plus a CI job, and the reason it is worth listing on a retrospective rather than in a backlog is that the *absence* is what nobody notices. This lands again in [01e](01e-what-sprintdesk-still-does-not-have.md) as a gap rather than a deferral.

## Gotchas

**★ Symptom: the checklist pass produced all green and the reviewer feels uneasy.** Cause: the items were read as topics, so each was answered "yes, we do that". Fix: rewrite each item as the observation that distinguishes working from configured, and re-run the pass. An item you cannot write an observation for is an item you have not understood; that is a finding in itself.

**★ Symptom: a launch review passes on "our caches are shared" and users report a board that is stale for some people and fresh for others.** Cause: the review saw a `cacheHandler` in the config and stopped. Configuration is not agreement. Fix: the observation is two instances agreeing after an invalidation — deploy the second instance and watch it, which is what chapter 17's two-target milestone makes possible in the first place.

**★ Symptom: the CI bundle budget has been green for months and the client bundle has grown.** Cause: 16 removed `size` and `First Load JS` from `next build` output, so the parser finds nothing to compare and reports no regression. Fix: stop parsing build output and keep the analyzer artefact instead, diffing it release to release — a diff cannot pass vacuously, because an empty side is visible.

**★ Symptom: no accessibility lint rule has fired since the upgrade, and nothing was changed.** Cause: `next lint` was removed and `next build` no longer lints; a project that never added an explicit step now has none. Fix: an explicit ESLint (flat config) or Biome step, wired into CI as a job that can fail:

```json
{ "scripts": { "lint": "eslint ." } }
```

**★ Symptom: a `grep` for `cookies()` in the root layout comes back clean and the pricing page is still dynamic.** Cause: the read is inside a component the layout imports — chapter 6's point that a shared component is not a boundary either. Fix: use the build's own route classification as the authority and treat the grep as a first pass, not a verdict.

**★ Symptom: the first parallel route anyone adds breaks the build, in a release nobody expected to.** Cause: every slot requires a `default.js` in 16 and no published checklist asks about it. Fix: write the two `find` commands into the repository's context file now, while the answer is "no parallel routes" — the point of recording it is that the person who hits it will not be the person who read this.

**★ Symptom: after the `middleware` to `proxy` rename everything works, and a review calls the item closed.** Cause: the codemod renamed a file; it did not verify the logic still runs where you assumed, and the runtime changed underneath it. Fix: confirm `proxy.ts` exports no `runtime` — the option does not exist there — and confirm what the file reads. A proxy that touches the database has become a per-request dependency for every route, including the static ones.

**★ Symptom: `revalidateTag` calls were all mechanically given a second argument at the upgrade and the board now shows stale cards after a drag.** Cause: the required `cacheLife` profile turned a compile error into a compiling call, and the walk past every call site was treated as a chore rather than a decision. Fix: at each site, name the person who must see the change. The actor gets `updateTag`; everybody else gets `revalidateTag`.

**★ Symptom: the deploy succeeds and the first request after it throws about a missing column.** Cause: the migration was generated and never applied, and there is no gate. Fix: run migrations as a release step against the direct connection string, and make a pending migration fail the deploy rather than the request. Then verify it by watching a deploy get rejected — an untested gate is a comment.

## Interview questions

**★ What is the difference between running a checklist and running a checklist pass?**
A checklist is a list of topics and produces the answer "yes, we do that" for every line, which is why launch reviews pass applications that fail the following month. A pass adds a third column to every item: the observation you would have to make to distinguish something that works from something that is merely configured. For a shared cache that is two instances agreeing after an invalidation; for a migration gate it is a deploy you have watched get rejected; for boundary coverage it is naming which degradation rung each dependency lands the user on. If you cannot write the third column for an item, you have not understood the item, and that is itself the most useful finding a review produces.

**★ Which single checklist item would you enforce hardest on an application that mixes rendering strategies?**
The Request-time API warning: `cookies` and the `searchParams` prop opt the whole route into dynamic rendering, and the whole application if used in the root layout. It is the only item where one casually written line silently removes the framework's central performance property everywhere at once, with nothing failing and nothing warning. An application running static marketing, ISR'd public pages and a dynamic dashboard from one deployment has all three strategies sharing a root layout, so that one file is where the coupling lives — and the sufficient check is the build's route classification, not a grep, because a shared component that reads a cookie is not visible in the layout at all.

**★ Why does a CI bundle-size budget pass forever after a 16 upgrade?**
Because 16.0 removed `size` and `First Load JS` from `next build` output, describing them as inaccurate in server-driven architectures using React Server Components. A gate that parsed those numbers now finds none, has nothing to compare, and reports no regression — green on every build, measuring nothing, with no configuration change to point at. The structural fix is to stop gating on parsed output and keep an artefact instead: the bundle map from the analyzer, committed or archived per release and diffed. A diff cannot silently succeed, because one empty side of it is visible on sight.

**★ An accessibility audit was done and passed six months ago. Is accessibility covered?**
No, and the reason is a tooling change rather than a discipline failure. `next lint` was removed and `next build` no longer runs linting, so a project that never added an explicit lint step has had no a11y rule fire since the upgrade — silently, with nothing in the log. An audit is an event; a gate is a property. The audit tells you the state on one day, the gate tells you the state on every day after it, and the published checklist still describes the linting as built in, so a team following it will believe they have the second when they have neither.

**★ What is the parallel-route item, and why bother recording it for an application that has no parallel routes?**
Every parallel-route slot in 16 requires a `default.js`, and the build fails without one. It is the rare item whose failure is loud rather than silent, so it costs nothing to hit — but it costs a confusing afternoon to hit *the first time*, in a release where somebody added a modal and nobody connected the two events. Recording the two `find` commands while the answer is "not applicable" is cheap, and the person it helps is the one who has not read the review. That is the general argument for writing down items an application currently passes by not having the feature.

**★ The `middleware` to `proxy` rename went through cleanly. What do you still check?**
Two things a rename cannot verify. First, the runtime: proxy runs on Node.js since v16.0 and the `runtime` config option is not available in proxy files, so any assumption the old file carried about the edge runtime is now false. Second, what the file actually does. A proxy that reads only a cookie to redirect the obviously-signed-out is a UX optimisation, which is what it should be; a proxy that queries the database has quietly become a per-request dependency for every route including the static ones, and the framework's own documentation says not to treat it as the control regardless. The rename is a behaviour change wearing a refactor's clothes.

**★ Under Cache Components, why is "verify your data requests are being cached" the wrong question?**
Because it was written for a model where `fetch` was cached by default and the risk was accidental caching. The default inverted: data fetching is dynamic, and caching happens only where somebody wrote `'use cache'`. So the original question invites a yes/no about a global behaviour that no longer exists, and it will be answered "yes" by anybody who sees a cache handler in the config. The useful form is per-read and has four parts — which reads are marked cacheable, with what `cacheLife`, under what tag, invalidated by what — and the last part is the one most teams have never had to answer before.

---

← [01ba · The inherited pile](01ba-the-inherited-pile.md) · [01 · SprintDesk retrospective](01-sprintdesk-retrospective-the-finished-multi-tenant-saas-revi.md) · Next → [01d · Checklist pass: security and the data access layer](01d-the-checklist-pass-security-and-the-data-access-layer.md)
