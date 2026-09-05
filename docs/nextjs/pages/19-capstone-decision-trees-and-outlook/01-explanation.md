---
title: "19 · Capstone, decision trees and outlook — the chapter that introduces nothing new, and is the only one allowed to say how the other eighteen constrain each other"
sidebar_label: "Overview"
sidebar_position: 0
description: "The capstone: SprintDesk reviewed as a set of commitments rather than features, a PPR storefront as the contrast case, five decision trees that cross chapters, and an outlook written so a later reader can check it rather than believe it."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 — this chapter composes material already verified across chapters 1 through 18 against the Next.js 16.3.4 documentation, plus [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16), [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) and [the production checklist](https://nextjs.org/docs/app/guides/production-checklist) as **corrected** in [Appendix D](../20-appendices/04-appendix-d-production-readiness-checklist-security.md). 🔴 **It introduces no new framework claims of its own** — every branch of every tree terminates in a page that already argues it.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**Every other chapter in this book is only permitted to argue its own subject, and that restriction is what makes this one necessary. Chapter 6 may not tell you that the rendering answer decides whether the caching question is even reachable. Chapter 8 may not tell you that moving a filter into the URL re-decides chapter 6's answer for that route. Chapter 5 may not tell you that the number of cache layers a mutation has to reach is a property of chapter 17's deployment rather than of your code. Those constraints are real, they are where production actually breaks, and this is the only chapter allowed to state them. So the capstone teaches nothing new on purpose: it reviews an application you watched being built, contrasts it with one shaped the opposite way, turns the accumulated arguments into five trees you can answer at 2am, and closes with an outlook written so that a reader in a year can check it rather than believe it.**

## The four topics

| # | Topic | What it settles |
|---|---|---|
| 01 | **[SprintDesk retrospective](01-sprintdesk-retrospective-the-finished-multi-tenant-saas-revi.md)** | Thirteen milestones read back as one system, sorted into free / load-bearing / inherited — and 🔴 why a working application is the weakest evidence available |
| 02 | **[Case study 2: a PPR storefront](02-case-study-2-contrast-a-ppr-driven-e-commerce-storefront.md)** | The same framework producing the opposite architecture, and the one inversion that drives every difference |
| 03 | **[The architecture decision trees](03-architecture-decision-trees-rendering-strategy.md)** | Five trees — rendering, caching, cache directive, state placement, runtime — each crossing chapters and marking its one-way doors |
| 04 | **[Outlook](04-outlook-deeper-ai-runtimes.md)** | What has shipped versus what has been stated, the three-compiler ladder, and how to price a preview feature |

## The chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[SprintDesk retrospective](01-sprintdesk-retrospective-the-finished-multi-tenant-saas-revi.md)** | the thirteen milestones as *commitments* rather than capabilities; the three piles; 🔴 why "it works in production" is compatible with every failure this book names |
| 2 | **[The decisions that are now load-bearing](01b-the-decisions-that-are-now-load-bearing.md)** | the sort done for real, with cost of reversal counted in files — and why the ORM choice is far freer than it looks |
| 3 | **[The inherited pile](01ba-the-inherited-pile.md)** | 🔴 the decisions nobody made: defaults the team believes were chosen, and what would reveal each one |
| 4 | **[Checklist pass: rendering, caching, the build](01c-the-checklist-pass-rendering-caching-and-the-build.md)** | the corrected checklist applied, each item carrying the observation that separates *working* from *configured* |
| 5 | **[Checklist pass: security and the data access layer](01d-the-checklist-pass-security-and-the-data-access-layer.md)** | the half of the official checklist that has not aged, expanded into the mechanism each bullet assumes |
| 6 | **[What SprintDesk still does not have](01e-what-sprintdesk-still-does-not-have.md)** | the honest gaps, each marked **deferral** (chosen) or **gap** (never considered) — and why confusing the two wastes a quarter |
| 7 | **[Case study 2: the storefront](02-case-study-2-contrast-a-ppr-driven-e-commerce-storefront.md)** | traffic shape as the architectural input; 🔴 personal parts as small holes in shared pages, and the inverse |
| 8 | **[The storefront's rendering and caching](02b-the-storefronts-rendering-and-caching-decisions.md)** | catalogue enumeration and its combinatorial ceiling, staleness budgets for price and stock, where `use cache: remote` finally earns its cost |
| 9 | **[The cart, checkout and where state lives](02c-the-cart-checkout-and-where-state-lives.md)** | the same four state owners landing in different places; the cart badge as the usual prerender-killer; why checkout is dynamic and should not be fought |
| 10 | **[The two applications side by side](02d-the-two-applications-side-by-side.md)** | 🔴 three decisions that produce identical code and mean different things, two that look different and are one problem, and what to do when your app is honestly both |
| 11 | **[The rendering tree](03-architecture-decision-trees-rendering-strategy.md)** | the four-things rule a capstone tree owes you, and 🔴 rendering answered per **layout subtree**, never per page |
| 12 | **[The caching tree](03b-the-caching-tree.md)** | what invalidates this and who sees it; the layer count as a property of your deployment rather than your code |
| 13 | **[The cache directive tree](03c-the-cache-directive-tree.md)** | `use cache` vs `remote` vs `private` vs none — placement, not performance; and why `private` is not the fix for the error it silences |
| 14 | **[The state placement tree](03d-the-state-placement-tree.md)** | the four owners, with the *specific reproducible bug* named beside each mis-filing |
| 15 | **[The runtime and deployment-target tree](03e-the-runtime-and-deployment-target-tree.md)** | the deprecated Edge Runtime with no published removal version, `preferredRegion` with no successor, and how the five trees constrain one another |
| 16 | **[Outlook: AI runtimes](04-outlook-deeper-ai-runtimes.md)** | framework knowledge moved from training data into `node_modules`; what an agent structurally cannot decide; the direction claim this book got wrong |
| 17 | **[Compiler evolution and the next default](04b-compiler-evolution-and-the-next-default.md)** | three compilers on three rungs, and 🔴 the config key as the maturity signal — top-level means stable, `experimental.` does not |
| 18 | **[Evaluating a preview feature](04c-evaluating-a-preview-feature.md)** | the observed base rate, the four questions, surface area as the variable you control, and reading a deprecation without inventing a deadline |

## Phase gate

You are done with this chapter when you can take an App Router application you did **not** build and, without running it, produce three things: the list of decisions it is standing on with the cost of reversing each counted in files; the branch it took on all five trees, marking which branches were chosen and which were inherited from a default; and the observation — not the assurance — that would demonstrate each of its silent failure modes is closed rather than merely unreported.

⚠️ **The gate is deliberately not "you can build SprintDesk."** You could do that after chapter 15. Reading someone else's architecture is the harder skill and the one this chapter exists for.

## Where this connects

- [ch15 · the SprintDesk milestone](../15-databases-apis-and-full-stack-patterns/06-project-milestone-sprintdesk-on-drizzle-neon-with-pooling.md) — the six named seams this chapter reviews
- [ch16 · Building a CRUD API with Postgres](../16-building-a-crud-api-with-postgres/01-explanation.md) — chapter 15 answers *which*, chapter 16 answers *how, and what breaks when two requests overlap*
- [ch17 · Deployment, scaling and observability](../17-deployment-scaling-and-observability/01-explanation.md) — the platform half of the runtime tree
- [ch20 · Appendices](../20-appendices/01-explanation.md) — the glossary, the corrected production checklist, and the version watchlist this chapter leans on

---

Start → [01 · SprintDesk retrospective](01-sprintdesk-retrospective-the-finished-multi-tenant-saas-revi.md)
