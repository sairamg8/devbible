---
title: "The runtime branch of this tree has collapsed to a single answer — the Edge Runtime is deprecated and the migration is a deletion — so the interesting question moved to the deployment target, which is what decides how many cache layers every other tree has to reach"
sidebar_label: "03e · The runtime and target tree"
sidebar_position: 15
description: "The fifth tree: why runtime selection is now one answer, what proxy took over, preferredRegion's deprecation with no successor, the four deployment targets, and how all five trees constrain one another."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 — every branch of this tree terminates in a page of this book that already argues it, verified there against the Next.js 16.3.4 documentation. This page introduces no new framework claims of its own.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**Four years of Next.js advice treated runtime selection as a genuine decision with a real trade-off: Node for capability, Edge for cold starts and geographic placement. In 16.3.4 that branch is gone. `runtime = 'edge'` is deprecated, the documented migration is *"Remove the `runtime` export from your route files"*, and the reason no replacement is offered is that the Edge Runtime was always the restricted environment — the deprecation page says outright that *"The Node.js runtime is the default, so no replacement is needed."* `preferredRegion`, the other half of the old placement story, is deprecated too, with **no framework-level successor named**. What survives is not a runtime tree but a deployment-target tree, and that one matters more than the tree it replaced: the target decides how many instances you run, which decides how many cache layers a mutation must reach, which is [the caching tree's](03b-the-caching-tree.md) first question. This page is that tree, and then the closing statement of how all five constrain each other.**

## Q1, in full, because it is now a statement rather than a question

The segment-config reference marks the value, and the dedicated message page states the migration:

> *"The Edge Runtime is deprecated. Remove the `runtime` export from your route files."*
> *"The Node.js runtime is the default, so no replacement is needed."*
> *"This applies to all route files that support the `runtime` segment config: `page.ts`, `layout.ts`, `route.ts`, and API routes."*

⚠️ Two things the documentation does **not** say, and which you will be told anyway: **it names no removal version**, and **it does not state that the build fails**. That combination — a real deprecation with an unspecified deadline — supports exactly one posture: stop writing it now, delete the existing ones at your convenience, and build nothing new that depends on the runtime's constraints. [05b of chapter 15](../15-databases-apis-and-full-stack-patterns/05b-the-edge-runtime-is-deprecated.md) is the full account including the one-line-per-file migration and the search that finds every occurrence.

## The runtime and deployment-target tree

```text
RUNTIME AND DEPLOYMENT-TARGET TREE

Q1. Does this code need Node APIs, native modules, or the wider npm ecosystem?
    |
    +- Yes -> the Node.js runtime, which is the default.
    +- No --> ALSO the Node.js runtime. There is no second branch in 16.3.4.
              `runtime = 'edge'` is deprecated; the migration is one deleted
              line per file; no removal version is named and the docs do not
              say the build fails.

Q2. Does this code need to run BEFORE the request reaches a route?
    |
    +- No --> it belongs in a route. Go to Q3.
    +- Yes -> proxy.ts.
              Its runtime is nodejs and CANNOT be configured. Setting the
              runtime option in a Proxy file THROWS - it does not warn.
              And the framework's own guidance is that this is a last resort:
              "avoid relying on Middleware unless no other options exist."

Q3. Do you want compute placed closer to users?
    |
    +- Do the arithmetic first. A dynamic request is not one round trip - it
    |  is several sequential database round trips wrapped in one HTTP
    |  response. Moving the compute away from the database lengthens every one
    |  of those and shortens only the single hop a CDN was already handling.
    |
    +- If you still want it: preferredRegion is DEPRECATED, with NO
       framework-level successor. Placement is platform configuration now, and
       the correct framework-level answer is "none".

Q4. What are you deploying onto?
    |
    +- A platform that runs Next.js natively ------> the features in the
    |     deployment matrix are provided for you, including the cache handler.
    |     Your Q5 answer is largely made on your behalf.
    |
    +- An adapter (a platform wiring itself in through the Adapters API) ->
    |     the matrix is the adapter's, not the framework's. Read which rows it
    |     supports BEFORE designing against them.
    |
    +- A container you operate ---------------------> everything below is yours,
    |     including the parts that were invisible when someone else ran them.
    |
    +- Static files only --------------------------> you did not reach this tree
          through Q4. You reached it through the RENDERING tree's Q6, and it is
          a one-way door.

Q5. Do you run more than one instance?
    |
    +- No --> the default in-memory cache is correct and complete. Two layers.
    +- Yes -> do those instances need to AGREE about anything?
        |
        +- No, they are stateless and the data is not cached -> fine.
        +- Yes -> a shared cacheHandler, because the Next.js server cache
                  lives on each instance and revalidation events are local.
                  🔴 This is the moment the CACHING TREE's layer count goes
                     from two to four or five, in a pull request that touches
                     no application code.

Q6. Is there a CDN in front of it?
    |
    +- Yes -> one more layer, invalidated by a purge through the CDN's API,
              and holding an s-maxage your application cannot shorten after
              the response has left.
```

## The terminals

| Terminal | What it decides for you | Where the book argues it |
|---|---|---|
| **A platform that runs Next.js natively** | The cache handler, the CDN, region configuration and preview environments are supplied | [Vercel: deployments, edge network, previews](../17-deployment-scaling-and-observability/01-vercel-automated-deployments-edge-network-preview-branches.md) |
| **An adapter** | A defined subset of the deployment matrix, chosen by the adapter author | [The Adapters API](../17-deployment-scaling-and-observability/10-the-adapters-api-why-it-exists-and-how-a-platform-wires-one-in.md) · [OpenNext](../17-deployment-scaling-and-observability/16-opennext-the-community-adapter-that-became-the-standard.md) |
| **A container you operate** | Nothing. Every layer is yours, including the ones you did not know existed | [Self-hosting with Docker](../17-deployment-scaling-and-observability/02-self-hosting-docker-containerization.md) · [More than one container](../17-deployment-scaling-and-observability/02b-caching-and-the-cachehandler-when-you-run-more-than-one-container.md) |
| **Choosing between them deliberately** | — | [Choosing a deployment target beyond Vercel](../17-deployment-scaling-and-observability/17-choosing-a-deployment-target-beyond-vercel.md) · [SprintDesk deployed twice](../17-deployment-scaling-and-observability/06-project-milestone-sprintdesk-deployed-twice.md) |
| **Global compute, in its 16.3.4 form** | A CDN in front of one Node.js server and a cache handler behind it — both configured, neither declared | [Edge functions and custom cache structures](../15-databases-apis-and-full-stack-patterns/05-edge-functions-and-custom-cache-structures-for-global-comput.md) · [Multi-region and data locality](../17-deployment-scaling-and-observability/03-multi-region-strategies-and-data-locality-patterns.md) |

## What each target costs you later

| Target | The bill |
|---|---|
| **Native platform** | The features you never had to think about are also the features you never learned. The bill arrives as a migration, not as an outage — and the only reliable way to know which of your assumptions were the framework's is to deploy the same repository somewhere else once. |
| **An adapter** | Your feature set is now the intersection of the framework's and the adapter's, and the intersection changes on the adapter's release schedule rather than the framework's. |
| **A container you operate** | The default in-memory cache is correct at one instance and quietly wrong at two, so scaling is a behaviour change with no code change. Every layer the platform used to run is now on your on-call rota. |
| 🔴 **Static files only** | The [rendering tree's one-way door](03-architecture-decision-trees-rendering-strategy.md), and the reason it is on that tree rather than this one: you do not arrive here by choosing infrastructure, you arrive by removing the server. |

## What I could not confirm

⚠️ A claim circulates that if you genuinely need the edge runtime for request-boundary work you should keep `middleware.ts` rather than move to `proxy.ts`. **I could not confirm that from the documentation available to me, and I am not asserting it.** What the reference does state is that Proxy defaults to the Node.js runtime, that the `runtime` config option *"is not available in Proxy files"*, and that setting it *"will throw an error"* — and separately that `v16.0.0` deprecated Middleware and renamed it to Proxy. Since Middleware is itself deprecated, treating it as a supported fallback would be advice the primary source does not give. If you need geographic placement of request-boundary logic, the documented position is that Proxy *"can run outside of your application's main runtime"* and that placement is the platform's to arrange.

## 🔴 How the five trees constrain one another

This is the paragraph the whole topic exists to produce, and no chapter in this book is allowed to write it.

**The rendering answer decides whether the caching tree is even reachable.** If a request-API read in a shared layout defers the whole subtree to request time, then the content is not in the static shell, and [the cache directive tree's](03c-the-cache-directive-tree.md) Q3 branches the other way for every function beneath it. Caching decisions made for a prerendered page are simply the wrong decisions once the page stopped being prerendered, and nothing in the caching code changed.

**The state answer can re-decide the rendering answer.** Moving a filter into the URL puts it in `searchParams`, which is a request-time API, so [the state placement tree](03d-the-state-placement-tree.md) hands the rendering tree a *yes* on its Q1 — and where the `await` sits decides how much of the page keeps a static shell. A state-management pull request can therefore change a rendering strategy, silently, with no rendering code in the diff.

**The runtime and target answer decides how many layers the caching tree has to reach.** One container: two layers, and a plain `revalidateTag` is complete. Four containers behind a CDN: five layers, three of which never hear about the write unless you operate a shared handler and purge the CDN. The identical invalidation code is correct in the first case and a production bug in the second, and the change that broke it was an infrastructure decision.

**And the directive answer feeds back into the target.** Choosing `use cache: remote` means a cache handler must exist. On a platform that supplies one, that is free; on a container you operate, you have just added a piece of infrastructure to the on-call rota, which is a Q5 answer arrived at from a completely different tree.

Run them in this order — rendering, then state, then directive, then caching, then target — and then **run them once more**, because the target answer changes the caching answer and the state answer changes the rendering answer. Two passes is not indecision; it is the shape of a system whose parts constrain each other.

## Gotchas

**★ Symptom: a build warning names the Edge Runtime and nobody can find the route.** Cause: the export can sit in any file that supports segment config — `page.ts`, `layout.ts`, `route.ts` and API routes — so a `layout.tsx` several levels up is a common culprit and is not where anyone looks. Fix: search the whole tree rather than the route you suspect:

```bash
grep -rn "runtime *= *['\"]edge['\"]" --include='*.ts' --include='*.tsx' --include='*.js' .
```

**★ Symptom: renaming `middleware.ts` to `proxy.ts` throws an error about the runtime option.** Cause: the `runtime` config option is not available in Proxy files and setting it throws — a harder failure than the route-file case, which only warns. Fix: delete the export as part of the move; Proxy defaults to Node.js and offers no alternative to select.

```ts
// proxy.ts
- export const runtime = 'edge'

export function proxy(request: Request) {
  return Response.redirect(new URL('/login', request.url))
}
```

**★ Symptom: someone plans a migration around the version that removes the Edge Runtime.** Cause: the documentation names no removal version, and the internet supplies one anyway. Fix: put the honest statement in the ticket — the value is deprecated, the migration is one deleted line per file, and no removal release has been announced. Plan on the deprecation, not on an invented deadline.

**★ Symptom: `next build` warns about `preferredRegion` and CI treats warnings as failures.** Cause: the export is deprecated in 16. Fix: delete it. There is no framework-level successor to name — region placement moved into platform configuration, which is a different system with a different review process:

```ts
- export const preferredRegion = 'home'
```

**★ Symptom: `preferredRegion` was set to an array of regions and compute cost multiplied.** Cause: the array form was never a preference list — the route is deployed to **all** listed regions, not one chosen from them. Fix: this is a good reason the API is gone; pick the single region nearest the data, in the platform's configuration.

**★ Symptom: the application was deployed to three regions and got slower.** Cause: a dynamic request is several sequential database round trips inside one HTTP response, so moving compute away from the database lengthens each of them while shortening only the hop the CDN already handled. Fix: place the compute with the data, and recover proximity at the CDN layer for anything cacheable — the arithmetic is in [03 of chapter 17](../17-deployment-scaling-and-observability/03-multi-region-strategies-and-data-locality-patterns.md).

**★ Symptom: scaling from one container to three broke caching, and the diff contains no application code.** Cause: the Next.js server cache lives on each instance, so ISR, `revalidateTag` and Server Actions all quietly become per-pod facts. Fix: a shared cache handler before you scale, not after — and re-run [the caching tree](03b-the-caching-tree.md), because your layer count just changed.

**★ Symptom: a route removed `runtime = 'edge'` and users far from your region got slower.** Cause: you were getting real geographic placement and have moved to origin. The framework's own framing is that this is a performance rather than a correctness matter — everything works from a single origin. Fix: cache the response at the CDN so distant users never reach the origin, and move genuinely local logic into Proxy, which may run outside your application's main runtime.

**Symptom: an SSE or streaming route stops working after a deployment change.** Cause: streaming is a platform requirement rather than a runtime one — the platform must support chunked transfer encoding or HTTP/2 streaming and must not buffer the response. Removing the edge export did not take streaming away; it made the requirement visible where it always applied. Fix: verify the target's streaming support explicitly, from its own documentation, before designing around it.

**Symptom: a feature works on the platform and not in the container, or the reverse.** Cause: the deployment matrix is a per-target fact, and an adapter supports a subset of it. Fix: read the matrix for your target before designing against a feature, and deploy the same repository to a second target once — it is the only reliable way to find out which of your assumptions were the framework's and which were the platform's.

## Interview questions

**★ How do you choose a runtime in Next.js 16.3.4?**
You do not. The Edge Runtime is deprecated, the documented migration is to remove the `runtime` export, and the reason no replacement is offered is that Node.js was always the superset — the Edge Runtime was a Web-APIs-only sandbox with no Node built-ins and a much smaller set of packages that would run. Deleting the export moves the route to a strictly larger environment, so nothing that worked stops working. What you can lose is geographic placement on some platforms, and the framework's own position is that placement is a performance concern rather than a correctness one.

**★ What does the documentation *not* say about the Edge Runtime deprecation, and why does that matter?**
It names no removal version and it does not state that the build fails. That matters because both gaps will be confidently filled in by somebody in a planning meeting, and a migration scheduled against an invented deadline is worse than one scheduled against an honest "deprecated, no announced removal". The correct posture is to stop writing it now and delete existing occurrences at leisure, while building nothing new that depends on the runtime's constraints.

**★ Someone proposes putting a session lookup in `proxy.ts` because Proxy runs on Node now. What do you say?**
That the runtime objection is genuinely out of date and the recommendation is unchanged. Proxy runs on Node and cannot be configured otherwise, so "no Node APIs" is no longer the reason. The reasons that remain are that it runs on every matched request including prefetches, that it may be deployed away from your database, and that the framework's own reference calls it a last resort to be avoided unless no other option exists. The conclusion — do the real authorisation check in the route or the data access layer — survives the loss of its original argument.

**★ `preferredRegion` is deprecated. What replaces it?**
Nothing at the framework level, and the docs name no successor. Region placement became platform configuration. That is a bigger change than it sounds, because a decision that used to live in a reviewed source file now lives in a console or a platform config file with a different change-control process — so the thing to add when you delete the export is not a replacement export, it is a note in the repository saying where the placement decision now lives.

**★ Why is the deployment target a caching decision?**
Because the number of cache layers is a property of the deployment. One instance means the server cache and the invalidation share memory, and a plain `revalidateTag` is complete. Several instances mean revalidation events are local, so the other instances keep serving stale until you operate a shared handler; a CDN adds one more layer holding an `s-maxage` you cannot retroactively shorten. The application code is identical in all three cases, which is why this is the constraint that catches teams during scaling rather than during development.

**★ In what order do you run these five trees, and why do you run them twice?**
Rendering, state, directive, caching, target — because each supplies an input the next one needs. Then again, because two of the dependencies point backwards: the state answer can turn a prerendered route into a request-time one by putting a value in `searchParams`, and the target answer changes the caching answer by changing the layer count. A single forward pass produces a set of individually defensible decisions that are jointly wrong, which is exactly what most architecture documents contain.

**★ What is the single cheapest thing a team can do to find out which of its assumptions belong to the framework and which to the platform?**
Deploy the same repository a second time onto a different target. Everything that was invisible becomes explicit: the cache handler someone else was running, the CDN behaviour, the streaming support, the region placement. It is a day of work that answers a question nobody can answer by reading, and it is why this chapter's deployment milestone deploys the same application twice on purpose.

**Is the deployment-target choice a one-way door?**
Mostly no, and deliberately so — that is what the Adapters API exists for, and it is why a community adapter could become a standard route off the native platform. What is close to irreversible is not the target but the assumptions you built while on it: code that relies on a cache handler existing, on a CDN purging on deploy, or on regions being configured somewhere you never looked. Those are unwound one by one, exactly like the static-export migration, which is the pattern to notice — the framework-level change is small and the accumulated dependence on it is the real bill.

← [03d · The state placement tree](03d-the-state-placement-tree.md) · [Chapter 19 overview](01-explanation.md) · Next topic → [04 · Outlook: AI runtimes](04-outlook-deeper-ai-runtimes.md)
