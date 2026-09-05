---
title: "A capstone decision tree earns its place only by doing four things a chapter tree is not allowed to do — cross chapters, name the question that actually settles the branch, price what the branch costs you eighteen months later, and mark the one-way doors — and here is that tree for rendering"
sidebar_label: "03 · The rendering tree"
sidebar_position: 11
description: "The first of five capstone trees: the four-things rule that makes a synthesis tree worth more than the chapter procedure it summarises, then the rendering tree itself, answered per layout subtree rather than per page."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 — every branch of this tree terminates in a page of this book that already argues it, verified there against the Next.js 16.3.4 documentation. This page introduces no new framework claims of its own.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**Chapter 6 already contains a rendering decision procedure, and it is a better one than most teams write for themselves: [eight ordered questions](../06-ssg-isr-and-ssr-strategy/01d-the-decision-procedure-and-when-ssr-is-right.md) that eliminate options until a pattern is left. Copying it one level up would be dead weight. What a capstone tree can do that a chapter tree structurally cannot is cross chapters — and rendering is the tree where that matters most, because the answer is not decided by the page you are looking at. It is decided by the nearest ancestor that reads a request API, which lives in a different file, was written by someone else, and does not appear in the route's own directory. A rendering tree answered per page is answered at the wrong granularity, and that single mistake accounts for most of the "it was static last week" incidents in this book.**

## The four-things rule — what a capstone tree owes you

Every tree in this topic carries all four of these, and a tree that carries fewer is a summary pretending to be a decision aid. State the rule once, here, and hold the other four trees to it.

**1 · It crosses chapters.** A chapter is only permitted to argue its own subject. Chapter 6 may not tell you that the rendering answer decides whether the caching tree is even reachable; chapter 8 may not tell you that putting a filter in the URL re-decides chapter 6's answer for that route. Those constraints are real, they are where production breaks, and this topic is the only place in the book allowed to state them.

**2 · It names the question that actually settles the branch.** People ask *"is this fast enough?"* and *"should this be static?"*. Neither settles anything. The settling question for rendering is **"does this scope read a request API, and can that read be hoisted out?"** — a question about the call graph, not about performance. Most architecture arguments end the moment someone asks the settling question instead of the popular one.

**3 · It prices what the branch costs you later.** Every terminal below is cheap on the day you choose it. The bill arrives when the product changes: a prerendered route bills you a deploy per content change unless you tagged it; a fully dynamic route bills you a user-visible outage the first time the upstream dies. A tree that lists only what a branch gives you is a sales brochure.

**4 · It marks the one-way doors.** Almost every branch here is reversible in an afternoon. Two are not, and they are on this tree and on [the runtime tree](03e-the-runtime-and-deployment-target-tree.md). A one-way door is answered for the product's next two years, not for this sprint.

## The rendering tree

```text
RENDERING TREE — answered once per LAYOUT SUBTREE, never once per page

Q0. Is `cacheComponents: true` set in next.config.ts?
    |
    +- No  -> the unit of this whole tree is the ROUTE. Every "hole" below
    |         collapses into "the entire route renders per request", and the
    |         segment config exports still exist.
    +- Yes -> the unit is the COMPONENT, and dynamic / dynamicParams /
              revalidate / fetchCache do not exist. Read on.

Q1. Does anything in this subtree read a request API?
    (cookies() · headers() · draftMode() · await searchParams · connection())
    |
    +- No -------------------------------> Q3
    |
    +- Yes, in a shared layout, a shared
    |  header, or a component that many
    |  routes import ---------------------> STOP. You are not answering this
    |                                       tree for one page. Every route
    |                                       beneath that file is re-decided.
    |                                       Restart Q1 for the whole subtree.
    |
    +- Yes, in one leaf component --------> Q2

Q2. Can that read be HOISTED OUT of the thing that needs the value, so the
    value arrives as a prop or an argument instead of being read inside?
    |
    +- Yes -> hoist it. The reader becomes a small request-time component and
    |         everything it feeds stays prerenderable. Continue at Q3 for the
    |         rest of the subtree.
    +- No  -> that subtree is a HOLE. Wrap it in a Suspense boundary, keep the
              parent prerendered, continue at Q3 for the parent.

Q3. Is the path set enumerable at build time, and how large is the product of
    the dynamic segments?
    |
    +- One URL, or a small fixed set -----> Q4
    +- Enumerable but large --------------> enumerate the traffic head only;
    |                                       the tail generates on first request.
    |                                       Then Q4.
    +- Two or more nested dynamic segments,
    |  or a catch-all -------------------> the enumeration is a CROSS PRODUCT
    |                                       with no natural upper bound. Bound
    |                                       it by construction, then Q4.
    +- Not enumerable (search, arbitrary
       filters, per-user URLs) ----------> there is nothing to prerender PER
                                           URL. The shell is the App Shell.
                                           Q4 still applies to the shell.

Q4. What is the staleness budget for the data in the prerenderable part, and
    who is able to tell you it changed?
    |
    +- It never changes after the build ---> PRERENDERED
    +- It drifts on its own, the budget is
    |  minutes or hours, nobody can tell
    |  you --------------------------------> PRERENDERED + TIME-BASED REVALIDATION
    +- It changes at a known moment and a
    |  system you control knows about it --> PRERENDERED + ON-DEMAND INVALIDATION
    +- One value must be true at the instant
       of reading --------------------------> that VALUE is a hole (back to Q2).
                                              It is not a reason to make the
                                              page dynamic.

Q5. Does a crawler need this URL?
    |
    +- Yes -> the bot path re-renders rather than reusing the shell, so verify
    |         the shell's data is reachable at request time and that metadata
    |         does not read runtime data on an otherwise-prerenderable page.
    +- No (anything behind auth) -> the SEO axis is VOID. Strike it from the
                                    discussion. It is the argument that most
                                    often wins a review it had no stake in.

Q6. Does this application need a server for anything, ever?
    |
    +- Yes -> done. The answer is one of the terminals above.
    +- No  -> STATIC EXPORT is available, and it is a ONE-WAY DOOR.
              Answer Q6 for the next two years of the product, not for today.
```

## Walking it

**Q0 changes what every other answer means, so it is not part of the ordering.** With Cache Components off, "a hole" is not a thing that exists — the route is dynamic or it is not — and a strategy written as `export const revalidate = 3600` is legal. With it on, the same sentence describes an API that no longer exists: `v16.0.0` removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` under the flag. Write the strategy as *"the product grid is cached for an hour and tagged `catalog`, the cart badge is a hole"* and it survives the migration in both directions.

**Q1 is the settling question, and its subject is the subtree.** This is the branch that makes the tree a capstone tree rather than a restatement. A `cookies()` read is not a property of the page that suffers from it; it is a property of the nearest file above the page that performs it. [What breaks at the seams](../06-ssg-isr-and-ssr-strategy/06b-what-breaks-at-the-seams.md) is the full argument: the blast radius of a request-time read is every route beneath the file it sits in, plus every route that imports the component doing it. A theme cookie in the root layout converts the marketing site to per-request rendering with no error, no warning in that route's directory, and nothing to point at during the postmortem.

**Q2 is the move almost nobody makes first.** The reflex on hitting a request-API restriction is to change a directive or a config flag. The correct first move is to change the *shape of the call graph*: read the value at the boundary, pass it inward. It is the same first move on [the cache directive tree](03c-the-cache-directive-tree.md), which is not a coincidence — both trees are asking where in the call graph the request enters, and the answer to both improves when the entry point is as shallow and as small as you can make it.

**Q3 is a build-time bill, not a correctness question.** The array `generateStaticParams` returns is paid by CI on every deploy, so at scale it stops being an enumeration and becomes a budget: [pick the hot set](../06-ssg-isr-and-ssr-strategy/02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md). Two nested dynamic segments multiply, and the framework will happily prerender the cross product; a catch-all has no natural upper bound at all — [the combinatorial explosion](../06-ssg-isr-and-ssr-strategy/02c-nested-segments-and-the-combinatorial-explosion.md) is the arithmetic and the two enumeration strategies.

**Q4 is a product question that engineers keep answering technically.** *"How stale is acceptable?"* is not yours to decide, and the number you pick is not a freshness guarantee either way — regeneration is triggered by a request rather than by a clock, so the staleness your users actually see is set by your traffic. [The staleness budget](../06-ssg-isr-and-ssr-strategy/01b-data-velocity-and-the-staleness-budget.md) argues that velocity is a property of each piece of data and never of a route; [ISR tuning](../06-ssg-isr-and-ssr-strategy/03-isr-at-enterprise-level-stale-while-revalidate-tuning.md) is why the number is a floor rather than a promise.

**Q5 is here to be struck out more often than it is answered.** Behind auth there is no crawler, so the SEO argument has no stake and should be removed from the discussion rather than won. Where it does apply, the thing to check is that [the shell a crawler receives is not the shell a browser receives](../05-caching-ppr-and-cache-components/03b-maximizing-the-shell-the-app-shell-and-what-crawlers-get.md).

**Q6 is last because it is irreversible.** Everything above it can be changed in a pull request.

## The terminals

| Terminal | Reached from | Where the book argues it |
|---|---|---|
| **Prerendered** | Q4, data fixed at build | [Choosing a rendering pattern](../06-ssg-isr-and-ssr-strategy/01-choosing-a-rendering-pattern-seo-build-time-data-velocity-pe.md) · [`generateStaticParams` at scale](../06-ssg-isr-and-ssr-strategy/02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md) |
| **Prerendered + revalidation** | Q4, data drifts or is invalidated | [ISR at enterprise level](../06-ssg-isr-and-ssr-strategy/03-isr-at-enterprise-level-stale-while-revalidate-tuning.md) · [The staleness budget](../06-ssg-isr-and-ssr-strategy/01b-data-velocity-and-the-staleness-budget.md) — then [the caching tree](03b-the-caching-tree.md) for *who sees the invalidation* |
| **PPR shell with dynamic holes** | Q2, the read could not be hoisted | [Partial Prerendering](../05-caching-ppr-and-cache-components/03-partial-pre-rendering-ppr-static-shell-dynamic-holes-for-min.md) · [Maximizing the shell](../05-caching-ppr-and-cache-components/03b-maximizing-the-shell-the-app-shell-and-what-crawlers-get.md) |
| **Fully dynamic** | Q1 answered yes for the whole document | [When SSR is right](../06-ssg-isr-and-ssr-strategy/01d-the-decision-procedure-and-when-ssr-is-right.md) · [Personalization without going dynamic](../06-ssg-isr-and-ssr-strategy/01c-personalization-without-going-dynamic.md) for the rungs below it |
| 🔴 **Static export** | Q6 answered "no server, ever" | [Static export vs serverful](../06-ssg-isr-and-ssr-strategy/04-full-static-export-vs-serverful-edge-distribution.md) · [The migration back](../06-ssg-isr-and-ssr-strategy/04d-the-migration-back-and-the-one-way-door.md) |

## What each terminal costs you later

The tree above is what each branch gives you. This is the bill.

| Terminal | The bill, and when it arrives |
|---|---|
| **Prerendered** | Every content change costs a deploy — unless you tagged the read, which is a decision on [the caching tree](03b-the-caching-tree.md) that you must make *now*, not when marketing complains. Build time grows with the enumerated URL set, silently, over years. |
| **Prerendered + revalidation** | The staleness users see is set by your traffic, not by your interval. Failure becomes invisible: a dead upstream looks like a working site with ageing data, so the monitoring has to move inside the cached function. And on more than one instance, an invalidation reaches the instance it ran on and no others. |
| **PPR shell with dynamic holes** | The shell/hole boundary is now a design constraint on every future feature. Anyone who adds a request read above a boundary shrinks the shell for the whole subtree, and the only symptom is a slower first paint. |
| **Fully dynamic** | You lose the last-good-render. A prerendered page keeps serving its last successful render when the upstream dies; a request-time page serves an error to everyone in the same instant. |
| 🔴 **Static export** | Thirteen documented features are removed, and unwinding the workarounds you built because they were missing is the real migration. Two of those workarounds are irreversible: a public API other people are now consuming, and anything a client-side auth gate shipped into publicly cached HTML. |

## The two one-way doors on this tree

**`output: 'export'` is the loud one.** Deleting it is one line, and the build succeeds; that is exactly the trap, because the build succeeding is not the migration succeeding. The eighteen months of code you wrote *because* there was no server — the client auth gate, the redirects living in a CDN console, the public API you stood up so the browser could fetch what a Server Component used to read directly — is the migration. [04d](../06-ssg-isr-and-ssr-strategy/04d-the-migration-back-and-the-one-way-door.md) is the unwind, item by item, and names the two items you cannot take back.

**`dynamicParams = false` is the quiet one**, and it is only a one-way door socially. Setting it for tidiness means every entity created after the last deploy 404s until the next one, and `generateStaticParams` is not re-run during revalidation to save you. The reason it behaves like a door is that by the time anyone notices, external links to those 404ing URLs exist. Note also that under Cache Components the export does not exist at all — Q0 decides whether this failure mode is even available to you.

## Gotchas

**★ Symptom: a route that was static last week renders per request after a pull request that did not touch it.** Cause: something in a shared ancestor started reading a request API — a theme cookie in the root layout, a session check in a shared header, a feature flag read in a component that forty routes import. The blast radius is every route beneath that file and every route importing that component, and nothing in the affected route's own directory points at the cause. Fix: answer Q1 for the subtree, not the page, and put the reader in the smallest leaf you can:

```tsx
// BAD — every route under this layout is now request-time
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get('theme')?.value ?? 'light'
  return <html data-theme={theme}><body>{children}</body></html>
}

// GOOD — the read is a leaf, the layout stays prerenderable
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Suspense fallback={<ThemeScriptDefault />}>
          <ThemeScript />
        </Suspense>
        {children}
      </body>
    </html>
  )
}
```

**★ Symptom: the tree says "prerendered" and the build says otherwise.** Cause: the tree describes intent, and the code disagrees — a single request-time read in a file nobody opened. Fix: never conclude a rendering discussion from the tree alone. [The accidental opt-out](../06-ssg-isr-and-ssr-strategy/01e-the-accidental-opt-out-and-what-each-pattern-costs.md) is how the divergence happens and how to find it; check what the build actually decided before you write the answer down.

**★ Symptom: an entire route was made dynamic to fix one stale number.** Cause: Q4's last branch was answered for the route instead of for the value. Fix: give the value its own boundary and return the rest of the page to the shell. Almost every over-dynamic route in a real codebase is this mistake, made once, a year ago, by someone who has left.

**★ Symptom: entities created since the last deploy return 404.** Cause: `dynamicParams = false`, set for tidiness, plus the fact that `generateStaticParams` is not re-run during revalidation. Fix: remove the export and let the tail generate on first request; if the 404 was deliberate, it needs to be a documented product decision rather than a config default.

**★ Symptom: a marketing site chose static export, and then the product needed a login.** Cause: Q6 was answered for the current sprint. Fix: there is no cheap fix, which is the point of marking it — the recovery is [04d](../06-ssg-isr-and-ssr-strategy/04d-the-migration-back-and-the-one-way-door.md)'s unwind. The cheap insurance is answering Q6 pessimistically at the start: if anyone can imagine a login, a preview, or a webhook in the next two years, do not take the door.

**★ Symptom: the build time doubled and no page got slower.** Cause: two nested dynamic segments, whose enumeration is a cross product, or a catch-all with no upper bound. Fix: bound `generateStaticParams` by construction rather than by discipline — an explicit `take`, ordered by traffic — so growth in the underlying table cannot silently become growth in CI time.

**Symptom: a crawler sees less content than a browser does.** Cause: the bot path re-renders the page rather than reusing the shell, so anything the shell got from cached data has to be reachable at request time too. Fix: check the crawler's shell explicitly rather than assuming it matches — [03b of chapter 5](../05-caching-ppr-and-cache-components/03b-maximizing-the-shell-the-app-shell-and-what-crawlers-get.md).

**Symptom: the team re-litigates a route's rendering every quarter.** Cause: the decision was recorded as a flag. `force-dynamic` with no comment carries no information about which question produced it. Fix: record the settling question next to the code, so the next person can check whether the constraint still holds:

```tsx
// Rendering: request-time. Q1 — the entitlement check must see this request.
// Q4 — the seat count must be true at the instant of display.
```

**Symptom: a rendering decision was quietly reversed by a state-management decision.** Cause: someone moved a filter into the URL, which puts it in `searchParams`, which is a request-time API. Fix: run [the state placement tree](03d-the-state-placement-tree.md) and this one together — where you `await searchParams` decides how much of the page prerenders, and that is a rendering answer made in a state-management pull request.

**Symptom: the architecture document is full of `export const revalidate` and none of it applies.** Cause: it was written against the pre-Cache-Components model, and the flag removes those exports. Fix: rewrite the decisions as lifetimes and tags on the functions that read data — the vocabulary that survives Q0 in both directions.

## Interview questions

**★ Why is a rendering decision tree answered per subtree rather than per route?**
Because the thing that forces a route off the prerendered default is usually not in that route. A request-API read propagates downward through layouts and outward through imports: the blast radius is every route beneath the file that performs the read, plus every route that imports the component performing it. A team that answers "should this page be static?" one page at a time will get the right answer for each page and the wrong answer for the application, because the shared header nobody reviewed already decided it for all of them.

**★ Somebody asks whether a page is "fast enough to be static". What do you ask instead?**
Whether anything in that subtree reads `cookies()`, `headers()`, `draftMode()`, `connection()` or `searchParams` — and if so, whether that read can be hoisted out and its value passed in. That is the question that settles the branch. Speed is a consequence of the answer, not an input to it; a page can be extremely fast and still be forced to request time by one read in an ancestor, and no amount of optimisation changes that.

**★ What does the "hoist it out" move actually change?**
The shape of the call graph, not the caching configuration. Instead of a component reading a cookie deep inside a tree it wants prerendered, a small component at the boundary reads it and passes a value inward. Everything below the boundary is then a pure function of its arguments and can be prerendered or cached; only the tiny reader defers to request time. It is the same first move that the cache directive tree makes, because both trees are really asking how shallow you can make the point where the request enters.

**★ Which branches of this tree are one-way doors, and what makes them one-way?**
`output: 'export'` and, socially, `dynamicParams = false`. The export is one-way not because the config is hard to delete — it is one line — but because of what you built in its absence: a public API other consumers now depend on, and any data a client-side auth gate shipped into publicly cached HTML. Neither can be recalled. `dynamicParams = false` is one-way because by the time anyone notices new entities 404ing, external links to those URLs already exist.

**★ A page is prerendered and the data is refreshed on a fifteen-minute interval. Someone says users therefore see data at most fifteen minutes old. Are they right?**
No. The interval is a floor under how often the page *may* regenerate, and regeneration is triggered by a request rather than by a clock. On a low-traffic page the observed staleness is set by the arrival of the next visitor, not by the number. The second thing that sentence gets wrong is that on more than one instance, an invalidation applies to the instance that received it — which is a question for the caching tree, not this one.

**★ What is the cost of choosing PPR that nobody mentions on the day they choose it?**
The shell/hole boundary becomes a permanent design constraint. Every future feature that adds a request-time read above a boundary shrinks the static shell for everything beneath it, and the only symptom is a slower first paint — no error, no build failure, nothing in the diff that names the shell. That is a maintenance obligation on the whole team, not a one-time architecture choice, and it is the reason the tree should be re-run whenever a shared component gains a data read.

**★ Under what circumstance do you strike the SEO argument out of a rendering discussion entirely?**
When the route is behind authentication. No crawler will ever request it, so the SEO axis has no stake in the decision and every minute spent on it is spent on the wrong axis. This is worth saying out loud in a review, because SEO is rhetorically powerful and frequently wins arguments about pages it cannot see.

**Cache Components is off in your codebase. How much of this tree still applies?**
The ordering does, and Q1 and Q4 still identify the right constraints — but the terminals change, because there are no holes. A request read anywhere in the subtree makes the whole route request-time, so Q2's "hoist it out" branch is even more valuable, and the fallback for un-hoistable per-user content is a Client Component fetching after hydration, with a visible flash as its price. Q0 exists precisely so that this difference is stated before anyone argues from the wrong model.

← [02d · The two applications side by side](02d-the-two-applications-side-by-side.md) · [Chapter 19 overview](01-explanation.md) · Next → [03b · The caching tree](03b-the-caching-tree.md)
