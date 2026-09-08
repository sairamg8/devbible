---
title: "Every mechanism in this topic buys deploy independence and pays for it in runtime coupling a single build gets for free, so the first question is what splitting actually buys and what it costs before any decision gets made"
sidebar_label: "09 · When not to split"
sidebar_position: 23
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against [Module Federation — Vite integration](https://module-federation.io/integrations/build-tool/vite.html), [Vite — Configuring Vite](https://vite.dev/config/), and package facts from **registry.npmjs.org**, fetched 2026-09-08. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+ · `@module-federation/vite` 1.21.5**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**This topic has spent fourteen chunks on proxying to many backends, freezing service URLs
at build time and fixing that, workspaces of independent apps, and Module Federation with
its shared-dependency and version-skew traps. None of that is an argument for doing any of
it. Every mechanism here buys exactly one thing — the ability to deploy a piece of the
frontend on its own schedule, without coordinating with everyone else who owns a piece of
the same page — and every mechanism pays for that with runtime coupling, build complexity,
or both, that a single Vite app never has to think about. This chunk tallies the payoff and
the price; [09b](09b-the-decision-framework.md) turns that tally into a decision procedure —
the organisational tests, the migration-cost asymmetry, and the cases that genuinely justify
a split.**

## The one thing splitting actually buys

State it plainly, because it is the only thing on the list: **independent deploy cadence.**
Team A ships Tuesday, team B ships whenever it wants, and neither one waits on the other's
code review, the other's test suite, or the other's release approval. That is the entire
payoff of every pattern in this topic, from `04-one-repo-many-vite-apps.md`'s separate
build pipelines to `05-module-federation-on-vite.md`'s runtime-shared remote.

It is **not** performance — a federated remote loading a duplicate copy of React because
`shared` was misconfigured (`05a-shared-dependencies-and-singleton-breakage.md`) is *slower*
than one bundle, not faster. It is **not** bundle size — route-level code splitting inside
one app gets you the same lazy-loaded chunks with none of the runtime coupling, covered
below. And it is **not** code reuse — a shared npm package
(`04b-shared-packages-and-the-deploy-decision.md`) gives a team reuse at a fraction of the
cost of a runtime-shared remote, because a version bump is reviewable in a PR and a
federated `shared` mismatch is a production bug discovered by a user.

If the teams touching this frontend can already ship on their own schedule from one repo —
because the codebase is small, because one team owns all of it, because releases are
frequent and low-ceremony — a split buys nothing and costs everything below.

## The costs, and where this topic already paid them

Every cost below is demonstrated, not asserted, on an earlier chunk in this topic. Read the
mechanism there; this section only tallies the bill.

- **Duplicated framework runtimes and singleton breakage.** Two independently built bundles
  each bring their own copy of React unless `shared` is configured exactly right, and even
  then the failure is silent — the app renders, then breaks in ways that look like a state
  bug. Full mechanism: `05a-shared-dependencies-and-singleton-breakage.md`.
- **A runtime version contract negotiated between artefacts built weeks apart.** A host
  built today and a remote built next month have to agree on a shared dependency's version
  at *runtime*, not at CI time, because they were never compiled against each other. Full
  mechanism: `05a2-shared-dependency-versioning-and-the-optimizedeps-gap.md`.
- **No compile-time type checking across the seam.** A host importing a remote's exposed
  module gets whatever that module's ambient types claim, if any — TypeScript cannot see
  into a bundle that did not exist at the host's compile time the way it sees into a
  workspace package. This is not documented as a Module Federation feature to fix; it is a
  structural consequence of the host and remote being separate compilations, and no source
  in this topic's research contradicts that.
- **A mutable manifest sitting in the caching hot path.** Federation's remote manifest has
  to be fetched fresh (or short-cached) on every host load to know which remote version to
  pull, which means the one file that must never be stale is also the one file every CDN
  and browser wants to cache aggressively. Full mechanism:
  `05c-version-skew-and-the-remote-manifest.md`.
- **No dev-mode HMR across remotes.** The Module Federation Vite integration is explicit
  about this gap — hot updates for remote modules are on the roadmap, not shipped — so
  developing a host against a live remote in dev mode means a full reload, not a hot patch,
  every time the remote changes. Full mechanism: `05-module-federation-on-vite.md`.
- **N build pipelines, N deploys, N rollback stories.** Every independently deployed piece
  needs its own CI job, its own deploy step, its own "how do we roll this back without
  breaking the host" runbook. One app has one of each.
- **A debugging story where the stack trace crosses an origin boundary.** A bug reported
  against the host page can originate in code the host's team does not own, cannot see the
  source for in their own repo, and cannot reproduce without pulling up a second
  application. Source maps, error tracking and on-call all get harder the moment the call
  stack crosses a deploy boundary.

## The cheaper answers, in order

Reach for the next tier only when the current one has visibly failed — not preemptively.

1. **One app.** The default. No mechanism in this topic applies. Ships as one build, one
   deploy, one bundle analysis, one stack trace.
2. **One app + route-level code splitting.** `React.lazy` paired with a dynamic `import()`
   at the route boundary:
   ```jsx
   import { lazy, Suspense } from 'react';

   const BillingPage = lazy(() => import('./pages/BillingPage'));

   function App() {
     return (
       <Suspense fallback={<PageSkeleton />}>
         <Routes>
           <Route path="/billing" element={<BillingPage />} />
         </Routes>
       </Suspense>
     );
   }
   ```
   🔴 This is the part worth saying explicitly: **this gives you the exact lazy-loading
   behaviour most people reach for micro-frontends to get** — a route's code only downloads
   when a user visits it — with *none* of the runtime coupling. There is one build, one
   `package.json`, one version of React, no `shared` config, no manifest, no cross-origin
   stack trace. If the stated goal is "the billing page shouldn't bloat the initial bundle",
   this is the fix, and it is a Rollup/Rolldown chunking concern
   (`../05-build-system-rollup/01-build-options.md`), not an architecture decision.
3. **A shared component package.** When two or more genuinely separate apps need the same
   buttons, tokens and layout primitives, and there already are separate apps for another
   reason, publish the shared pieces as a workspace package consumed at build time. Full
   treatment, including the `optimizeDeps` trap that breaks HMR on a source-linked package:
   `04b-shared-packages-and-the-deploy-decision.md`.
4. **Separate apps behind one gateway path prefix.** When the apps are independent enough
   to deploy separately but still need to appear as one product under one domain, a gateway
   or reverse proxy routes `/app-a/*` and `/app-b/*` to different origins, each its own Vite
   build with its own `base`. This is `04-one-repo-many-vite-apps.md`'s territory — workspace
   layout, per-app config, no runtime sharing at all.
5. **Only then, federation.** Reach for `05-module-federation-on-vite.md` when a page
   genuinely needs to compose modules from independently deployed apps *at runtime*, in the
   same process, sharing state or a design system's live component tree — not files, a
   running React tree. That is a narrow requirement, and the mechanisms in
   [09b](09b-the-decision-framework.md) satisfy most things that sound like it without
   touching `shared` at all.

The rest of the decision — the organisational tests, the migration-cost asymmetry, and the
cases that genuinely justify federation — continues on
[09b](09b-the-decision-framework.md).

## Gotchas

**★ Symptom: a team asks for micro-frontends specifically to fix bundle size.** Cause: bundle
size is a Rollup/Rolldown chunking problem, and Module Federation does not shrink a bundle —
it moves *when* code downloads, and can easily make total bytes shipped *larger* if `shared`
duplicates a framework across remotes (`05a-shared-dependencies-and-singleton-breakage.md`).
Fix: point them at route-level code splitting with `React.lazy` and dynamic `import()` first;
measure whether that alone solves it before any architecture conversation happens.

**Symptom: the split gets justified by "code reuse" and a shared npm package would have done
the same job for a fraction of the operational cost.** Cause: runtime sharing (federation)
and build-time sharing (a workspace package) both solve "don't duplicate this code", and
teams reach for the flashier one. Fix: default to `04b-shared-packages-and-the-deploy-decision.md`'s
shared package; it is reviewable in a PR, versioned in `package.json`, and carries none of
`05a2-shared-dependency-versioning-and-the-optimizedeps-gap.md`'s runtime version-negotiation
problem.

## Interview questions

**★ A team wants micro-frontends. When do you say no?** When none of the organisational
tests hold — the pieces already ship on the same schedule, one team owns everything, no
shared release train has actually blocked anyone, there's no regulatory or vendor boundary,
and nobody needs one team's deploy to be isolated from another's ([09b](09b-the-decision-framework.md)
lists these tests). In that shape, every mechanism in this topic (proxying to services,
workspace apps, Module Federation) adds deploy machinery, runtime coupling or both, and buys
nothing the team doesn't already have. The honest answer is one app, with route-level code
splitting if the actual complaint is bundle size.

**★ A team asks for micro-frontends to fix bundle size. What do you tell them?** That bundle
size is solved by route-level code splitting inside one app — `React.lazy` plus a dynamic
`import()` at the route boundary gives the same "only download this page's code when the
user visits it" behaviour, with one build, one version of React, and no `shared` config to
get wrong. Splitting the frontend into separately deployed pieces doesn't shrink the bundle;
it changes *when* pieces of it download, and if the shared-dependency config is wrong it can
make the total bytes shipped larger, not smaller, because two remotes each ship their own
copy of React.

**★ What is the single thing splitting a frontend into independently deployed pieces
actually buys, and what does it not buy?** It buys independent deploy cadence — team A ships
without waiting on team B's review or release approval. It does not buy performance (a
misconfigured `shared` key can make things slower), does not buy smaller bundles
(route-level code splitting does that inside one app), and does not buy code reuse cheaper
than a shared npm package would.

**Why does "no compile-time type checking across the seam" matter, concretely?** In one
app, TypeScript sees every import across the whole codebase and catches a signature change
at the call site during `tsc`. Across a Module Federation boundary, the host imports a
module the remote exposes at *runtime* — the host's compiler never sees the remote's actual
source, only whatever ambient types exist for it, if any. A remote can change an exposed
component's props and the host's build stays green; the break surfaces at runtime in the
browser instead, which is strictly worse than a compile error, since it reaches production
before anyone with a red pipeline sees it.

---

← [Many deployables, not microservices](08b-many-deployables-is-not-microservices.md) · [Vite overview](../../README.md) · Next → [The decision framework](09b-the-decision-framework.md)
