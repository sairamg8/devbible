---
title: "SprintDesk is finished, and a retrospective on it is not a demo — it is reading thirteen milestones back as one system and asking which of their decisions are now load-bearing, which were free, and which the next feature will have to pay for"
sidebar_label: "01 · SprintDesk retrospective"
sidebar_position: 1
description: "The thirteen milestones as a single application, what each one actually committed the codebase to, why a working app is the weakest evidence available, and the review method the rest of this topic executes."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 — this page composes material already verified across chapters 4 through 17 of this book against the Next.js 16.3.4 documentation, and takes its review structure from [How to optimize your Next.js application for production](https://nextjs.org/docs/app/guides/production-checklist) as **corrected** in [Appendix D](../20-appendices/04-appendix-d-production-readiness-checklist-security.md). It introduces no new framework claims of its own.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**A retrospective is not a demo, and the difference is the whole value of this chapter. A demo asks "does it work", and SprintDesk works — it has worked since chapter 4, in the sense that it rendered a board and created a task. What a retrospective asks is narrower and much harder: *of the decisions made across thirteen milestones, which ones is the codebase now standing on?* Some are free and could be reversed on a Tuesday. Some are load-bearing, and reversing them means touching every route. And a handful were never decided at all — they were inherited from a default, and nobody has yet had the outage that reveals which default was chosen. This topic is the exercise of separating those three piles for an application you have watched being built, and the reason it comes before the decision trees is that a tree you have not seen applied to a real codebase is a diagram.**

## What SprintDesk is, at the end

Thirteen chapters each closed with a milestone, and each milestone added one capability plus one commitment. The capability is what a demo shows. The commitment is what a retrospective is about.

| Ch | Milestone | The capability it added | 🔴 The commitment it made |
|---|---|---|---|
| 4 | [Scaffold SprintDesk](../04-data-fetching-in-the-app-router/06-project-milestone-scaffold-sprintdesk.md) | team-scoped routes, a server-rendered task list, one Server Action | **the data layer performs real asynchronous I/O** — an in-memory constant would have made every later claim vacuously true |
| 5 | [Cache the board shell](../05-caching-ppr-and-cache-components/06-project-milestone-cache-sprintdesks-team-dashboard-shell-wit.md) | a static shell served before the database is consulted | **Cache Components is on**, so `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` are gone as controls |
| 6 | [Three strategies, one deploy](../06-ssg-isr-and-ssr-strategy/06-project-milestone-static-marketing-pages-isrd-public-team-pa.md) | static marketing, ISR'd public team pages, a dynamic board | **shared layouts are the coupling** — one `cookies()` read in a shared file converts static routes to per-request ones |
| 7 | [Boundary coverage](../07-error-handling-loading-states-and-resilience/07-project-milestone-sprintdesk-gets-full-error-boundary-covera.md) | a failure map with a chosen degradation rung per dependency | **every dependency has a written answer to "what should its outage cost"** |
| 8 | [State ownership](../08-state-management-in-an-rsc-world/07-project-milestone-sprintdesk-board-filters-in-the-url.md) | filters in the URL, a scoped store, an optimistic overlay | **four owners, and every piece of state is filed under exactly one** |
| 9 | [Design system pass](../09-styling-and-ui/06-project-milestone-sprintdesk-design-system-pass.md) | theme, fonts, optimised images, a scripts pass | **the root layout is a contended file** — three unrelated mechanisms meet in it |
| 10 | [Auth with Auth.js](../10-forms-authentication-and-security-hardening/06-project-milestone-sprintdesk-auth-authjs.md) | identity, sessions, authorisation on reads and writes | **one `server-only` module is the only thing allowed to know who is asking** |
| 11 | [Performance audit](../11-performance-optimization-turbopack/07-project-milestone-sprintdesk-performance-audit.md) | a bundle map, an INP fix, spans that outlive their author | **the bundle map is a kept artefact**, diffable across releases |
| 12 | [Public pages indexed](../12-seo-metadata-and-accessibility/06-project-milestone-sprintdesk-public-pages-fully-indexed.md) | metadata, OG images, a `noindex` private area | **one origin constant feeds five consumers** |
| 13 | [The test suite](../13-testing-and-developer-experience/05-project-milestone-sprintdesk-test-suite.md) | five layers, each with a written statement of what it cannot see | **coverage is a ratchet, not a target** |
| 14 | [`AGENTS.md`](../14-agent-driven-development/07-project-milestone-sprintdesk-gets-an-agentsmd.md) | a context file tested against one real refactor | **the half of that file you own is decisions, not advice** |
| 15 | [Drizzle, Neon, SSE, a queue](../15-databases-apis-and-full-stack-patterns/06-project-milestone-sprintdesk-on-drizzle-neon-with-pooling.md) | a real database, a live board, background work | **jobs are enqueued in the same transaction as the write that causes them** |
| 17 | [Deployed twice](../17-deployment-scaling-and-observability/06-project-milestone-sprintdesk-deployed-twice.md) | Vercel and a Docker container, one instrumentation file | **portability is a measured property**, not an aspiration |

Read the right-hand column on its own. That is the application. The left-hand column is what a screenshot shows.

## Why a working application is the weakest evidence you have

This is the sentence that justifies the whole chapter, and it is worth being precise about rather than treating as a slogan.

Every failure this book spent nineteen chapters naming is **silent by construction**:

- A `cookies()` read in a shared layout does not error. It converts a prerendered route to a per-request one, and the page still renders, correctly, slightly slower. → [ch6 · what breaks at the seams](../06-ssg-isr-and-ssr-strategy/06b-what-breaks-at-the-seams.md)
- A Server Action with no authorisation check inside it does not error. It works perfectly for every user who reaches it through your UI. → [ch10 · authorization on writes](../10-forms-authentication-and-security-hardening/06h-milestone-authorization-on-writes.md)
- `revalidateTag()` on a two-instance deployment does not error. It invalidates the instance it ran on, and the other instance keeps serving the old board to whoever is routed to it. → [ch15 · a shared cache across instances](../15-databases-apis-and-full-stack-patterns/05h-a-shared-cache-across-instances.md)
- A connection pool sized for one instance does not error until the instance count multiplies it past the database's limit, at which point it errors for everybody at once. → [ch15 · the three kinds of pool](../15-databases-apis-and-full-stack-patterns/01b-the-three-kinds-of-pool.md)
- An SSE stream buffered by a proxy does not error. The connection succeeds and says nothing. → [ch15 · what silently breaks SSE](../15-databases-apis-and-full-stack-patterns/03h-what-silently-breaks-sse-in-production.md)

🔴 **None of these produces a log line, a failing test, or a red build.** So "SprintDesk works" is compatible with every one of them being present, which makes it worth almost nothing as evidence. The retrospective exists because the only way to know the state of the application is to go and look, item by item, at the things that fail quietly.

## The review instrument, and why you cannot use it as published

The natural instrument is Vercel's own production checklist, and the natural move is to hand a team the link before a launch. **Do not hand them the current one unannotated.**

Fetched as Markdown on 2026-09-04 it reports `version: 16.3.4` in its frontmatter and `lastUpdated: 2026-03-10` in the same block — and the body matches the second date. It still calls Partial Prerendering experimental, still points at a linting setup that 16 removed, and still links a bundle-analyzer section anchored `for-webpack` in a release where Turbopack is the default bundler. [Appendix D](../20-appendices/04-appendix-d-production-readiness-checklist-security.md) is that checklist corrected, item by item, with each correction traced to the document that supersedes it.

⚠️ **The general lesson generalises past this one page.** A docs site stamps `version:` on every page from its build; `lastUpdated:` is the only freshness signal it gives you. A checklist is a document like any other and ages like one — so the first step of any readiness review is establishing how old your checklist is, not working through it.

## The three piles

The review that follows sorts every decision SprintDesk has made into one of three piles. The point of the sort is that the piles have different maintenance costs, and treating them alike is how teams spend a quarter re-litigating something free while never touching something load-bearing.

**Pile 1 · Free.** Reversible in an afternoon, blast radius contained to one directory. SprintDesk's Tailwind-plus-custom-properties theme is here: the theme tokens are consumed through variables, so swapping the implementation touches the definitions and nothing that reads them.

**Pile 2 · Load-bearing.** Reversible only by touching many routes, because the rest of the code was written assuming it. `cacheComponents: true` is the canonical example — turning it off does not restore the old controls, it removes the model every route was written against.

**Pile 3 · Inherited.** Never decided. A default that has held so far because nothing has stressed it. These are the dangerous ones, because the team believes a decision was made.

**01b · The decisions that are now load-bearing** *(not written yet)* does that sort for real, decision by decision. **01c** and **01d**, the checklist passes *(not written yet)*, run the corrected checklist over the application. **01e · What SprintDesk still does not have** *(not written yet)* is the half of a retrospective everybody skips: the honest list of what the application still cannot do, and which of those gaps is a decision rather than a to-do.

## How to run this on an application that is not SprintDesk

The structure transfers, and it is short enough to be worth stating plainly.

1. **List the commitments, not the features.** For every significant piece of work, write the sentence that begins *"from here on, this codebase assumes…"*. If you cannot write that sentence, the work made no commitment, which is itself a finding.
2. **Sort each into free, load-bearing, or inherited.** The test for load-bearing is mechanical: name the number of files that change if you reverse it. The test for inherited is a question — *who decided this, and when?* — and a shrug is the answer that files it in pile 3.
3. **Run a checklist you have dated.** Establish its age before you use it.
4. **For each silent failure mode the framework has, write down the check that would detect it.** Not *"we handle that"* — the actual check, and where it runs.
5. **List what the application cannot do,** and mark each entry as a deferral (we chose this) or a gap (we never considered it).

Step 4 is the one that produces work. Steps 1 and 5 are the ones that produce arguments, which is why they are worth doing with the whole team in the room.

## Gotchas

**★ Symptom: the retrospective produces a list of forty items and nobody acts on any of them.** Cause: the list mixes free and load-bearing decisions, so every item looks equally expensive and the meeting ends without a decision. Fix: sort before you discuss — put the file-count next to each item. *"Reversing this touches 2 files"* and *"reversing this touches 61 files"* end an argument that an hour of discussion will not.

**★ Symptom: a review declares the application healthy, and it goes down within the month on something the review covered.** Cause: the review checked whether a mechanism was *present*, not whether it was *correct*. A `cacheHandler` entry in `next.config.ts` proves configuration, not that two instances share a cache. Fix: for every item, write the observation that would distinguish working from configured — for the shared cache, that is two instances agreeing after an invalidation, and nothing short of it.

**★ Symptom: the team cannot agree on whether an item is load-bearing, and the argument runs for an hour.** Cause: "load-bearing" is being used as a synonym for "important", which is a matter of opinion. Fix: define it as a count. Load-bearing means *reversing this changes N files*, and you go and count N. The disagreement usually evaporates once someone runs the grep.

**★ Symptom: the checklist pass finds nothing, on an application you know has problems.** Cause: you used the published checklist, which is six months behind the release you are on and does not ask about the things 16 changed — the cache directives, `proxy`, parallel-route `default.js` files, the removed build metrics. Fix: use the corrected pass in [Appendix D](../20-appendices/04-appendix-d-production-readiness-checklist-security.md), and note the publication date of any checklist before working through it.

**★ Symptom: "we don't have that problem" is the answer to five separate items.** Cause: absence of a report is being treated as evidence, and every failure on the list is silent. Fix: replace the claim with the check. *"We have never seen connection exhaustion"* becomes *"instances × pool `max` is 240 and the plan's limit is 100"* — which is a number, and it is either fine or it is not.

**★ Symptom: the retrospective is written, filed, and never referenced again.** Cause: it was written as prose, so there is nothing in it a future change can conflict with. Fix: turn the load-bearing pile into the repository's context file — this is precisely what [ch14's milestone](../14-agent-driven-development/07-project-milestone-sprintdesk-gets-an-agentsmd.md) means by *decisions, not advice*. A decision recorded where the next change will read it is documentation; a decision recorded in a document nobody opens is a diary entry.

**★ Symptom: every commitment in the table above reads as obviously correct, and the exercise feels pointless.** Cause: you are reading them with the chapters that argued them still fresh. Fix: do the exercise on a codebase you did not build. The commitments are obvious in retrospect and invisible in a diff, which is exactly why they need writing down — the person who needs them is the one who arrives in eight months.

**★ Symptom: the "inherited" pile is empty.** Cause: nobody looked for it, because an inherited decision does not appear anywhere — it is the absence of a line in a config file. Fix: enumerate the framework defaults the application relies on and ask of each *when did we choose this?* SprintDesk's inherited pile is not empty, and **01b** *(not written yet)* names its members.

## Interview questions

**★ Why is "the application works in production" weak evidence about its architecture?**
Because the failure modes an App Router application actually has are silent. An unprotected Server Action serves every legitimate user perfectly. A route that fell out of prerendering still renders the right HTML. A per-instance cache invalidation is correct for whichever users land on the instance that received it. None of these produces an error, a failing test, or a metric that moves. So a working application is consistent with all of them being present at once, and "it works" tells you about the paths that were exercised rather than about the system.

**★ What distinguishes a load-bearing decision from an important one?**
Cost of reversal, counted in files. Importance is a judgement about how much a decision matters; load-bearing is a measurement of how much code assumes it. They frequently disagree — the session strategy is an important decision that is not especially load-bearing if the data access layer hands out a projection, because the rest of the app never sees a session object. Meanwhile `cacheComponents: true` is load-bearing regardless of anyone's opinion of it, because every route was written against the model it enables and the old segment controls no longer exist to fall back on.

**★ A team asks you to review their Next.js application before launch and hands you Vercel's production checklist. What do you do first?**
Check the date on it. Fetched as Markdown, the page reports `version: 16.3.4` and `lastUpdated: 2026-03-10`, and the body follows the second — so it describes PPR as experimental, sends you to linting that `next build` no longer performs, and links a bundle-analyzer section written for webpack in a release where Turbopack is the default. Working through it unannotated produces a green review that never asked about the things the current major changed. The instrument has to be dated before it can be trusted, and that is true of any checklist, not just this one.

**★ Why does this chapter insist that the retrospective happen before the decision trees rather than after?**
Because a decision tree read cold is a diagram, and everyone agrees with a diagram. Read after a retrospective it is something else: a set of questions you have just watched an application answer, some of which it answered by default rather than on purpose. The tree becomes useful precisely at the moment you can see which branch your own code took and whether anyone chose it.

**★ What goes in the "inherited" pile, and why is it the most dangerous of the three?**
Framework defaults the application depends on that nobody consciously selected — the prefetch behaviour of `<Link>`, whether a route is being prerendered at all, which cache directive an un-annotated function ends up under, the number of connections a pool opens when you do not set `max`. It is the most dangerous pile because the team believes these were decisions. A free decision can be revisited cheaply and a load-bearing one is at least visible in the code; an inherited one is invisible by definition, since it consists of lines nobody wrote.

**★ How would you make a retrospective's findings survive the next twelve months?**
Put the load-bearing pile where the next change has to read it — the repository's context file, the ADR directory, the top of the config it constrains. Prose in a wiki is not conflict-detecting: nothing about a future pull request causes anyone to open it. A decision written next to the code it governs is a thing a reviewer trips over, and tripping over it is the entire mechanism by which documentation works.

## Where this connects

- [Appendix D · the corrected checklist](../20-appendices/04-appendix-d-production-readiness-checklist-security.md) — the instrument the checklist passes of this topic run
- [ch14 · the context file as decisions](../14-agent-driven-development/06b-what-an-agent-cannot-decide-and-what-context-files-fix.md) — where the load-bearing pile belongs afterwards
- **02 · the contrast case study** — the same review method against a differently-shaped application

---

{/* FOOTER */}
