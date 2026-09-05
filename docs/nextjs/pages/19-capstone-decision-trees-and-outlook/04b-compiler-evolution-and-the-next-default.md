---
title: "Three compilers are moving at once and they are at three different points on the same ladder — the bundler has landed, the optimizing compiler is stable and switched off, and the rendering model is opt-in with a stated future as the default"
sidebar_label: "04b · Compiler evolution and the next default"
sidebar_position: 61
description: "Turbopack as the shipped default and what its custom-webpack build failure really tells you, the React Compiler's stable-but-off state and why the config key is the tell, and Cache Components plus Partial Prefetching as a migration to plan rather than a feature to watch."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`, fetched as Markdown 2026-09-04), cross-checked against material already verified in [chapter 11](../11-performance-optimization-turbopack/01-turbopack-in-dev-and-production-fast-refresh.md), [chapter 5](../05-caching-ppr-and-cache-components/01-the-explicit-caching-model-cachecomponents-build-flag-and-th.md) and [Appendix E](../20-appendices/05-appendix-e-version-watchlist.md).
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**"Compiler evolution" sounds like one story and it is three, running simultaneously at three different stages, and the single most useful thing a senior engineer can hold about Next.js 16 is which stage each one is at. The bundler has landed: Turbopack is the default for `next dev` and `next build`, and the migration is behind you or it is a build failure. The optimizing compiler has landed and is switched off: the React Compiler is stable, enabled by a top-level config key, and not on by default pending build-performance data. The rendering model is opt-in with a publicly stated future: Vercel has said the behaviours behind Instant Navigations become the default in a future major version. Three stages, three appropriate responses — and the config key you type tells you which stage you are in, because a top-level key is stable and an `experimental.` prefix is not.**

## The ladder, and why the config key is the tell

Every feature in this section sits on one of four rungs. The rung determines what you should do, and it is readable from the API rather than from anybody's enthusiasm.

| Rung | How you can tell | The right response |
|---|---|---|
| **Default** | you get it without typing anything | migrate, or discover it as a build failure |
| **Stable, off** | a **top-level** config key turns it on | evaluate on your codebase; the framework is not withholding it, it is declining to choose for you |
| **Experimental** | an **`experimental.`** prefixed key | try it in a branch; do not build a release plan on it |
| **Stated future default** | shipped behind a flag, with a published statement of intent | plan the migration; the question is when, not whether |

🔴 **Stable-but-off and experimental are different states and the prefix distinguishes them.** The React Compiler is `reactCompiler: true` — top level, therefore stable, and merely not the default. Its Rust port is `experimental.turbopackRustReactCompiler` — prefixed, therefore not. Treating those two as the same thing is how a team either ships an experiment or refuses a stable feature, and it is a distinction you can check in a config file rather than argue about.

## 1 · The bundler — landed, and its failure mode is the interesting part

> *"Starting with **Next.js 16**, Turbopack is stable and used by default with `next dev` and `next build`."*

The migration story is unusual in that the framework refuses to guess:

> *"If your project has a custom `webpack` configuration and you run `next build` (which now uses Turbopack by default), the build will **fail** to prevent misconfiguration issues."*

Three escapes exist — `next build --turbopack` to say you meant it, migrating the configuration, or `--webpack` to opt back out. But the guidance underneath is the part worth carrying, because it describes a situation people find baffling:

> *"If you see failing builds because a `webpack` configuration was found, but you don't define one yourself, it is likely that a plugin is adding a `webpack` option"*

**A hard failure was the right design here and it is worth understanding why.** Silently bundling with a different bundler than your configuration describes produces an application that builds, deploys and behaves subtly differently from the one you configured — the exact class of silent divergence this whole book is organised around. A build that stops is a bad afternoon; a build that quietly ignores half your configuration is a bad quarter.

The compatibility boundary is asymmetric and worth stating plainly:

> *"Turbopack does not support webpack plugins… We do support webpack loaders."*

So a loader is a migration; a plugin is a redesign. [ch11 · what Turbopack does not support](../11-performance-optimization-turbopack/01e-what-turbopack-does-not-support-and-how-to-read-the-list.md) is how to read that list, and [ch18 · the bundler seam](../18-advanced-ecosystem-topics/04b-the-bundler-seam-webpack-and-turbopack.md) is the plugin-authoring view.

⚠️ **One platform caveat that is not a preference.** On platforms with no native bindings — FreeBSD and OpenBSD are the documented examples — Next.js falls back to WebAssembly bindings, and those *"do not support Turbopack"*. There the answer is `--webpack`, and it is a hosting constraint rather than a bundler opinion.

## 2 · The optimizing compiler — stable, off, and the objection is measurable

The React Compiler is stable in 16 behind a top-level key, needs `babel-plugin-react-compiler`, and carries one honest warning:

> *"Expect compile times… to be higher"*

```ts
// next.config.ts — top-level key, therefore stable
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactCompiler: true,
}

export default nextConfig
```

**That warning is the entire reason it is not the default, and it is also why the decision is unusually easy to make well.** The compiler's benefit — the removal of hand-written `useMemo` and `useCallback` and the bugs that come from getting their dependency arrays wrong — is a code-quality claim you have to evaluate. Its cost is a build-time number you can measure on your own repository in an afternoon. A decision with a measurable cost and a describable benefit does not need a working group; it needs one branch and one comparison.

🔴 **Do not conflate the compiler with its Rust port.** `experimental.turbopackRustReactCompiler` is the work that would remove the build-time objection, and it was still experimental after 16.3 — one of only two things in a large 16.3 cohort that did not stabilize. So the honest reading of the situation is: *the feature is ready and its cost is being engineered down*. [ch11 · what the React Compiler costs and the Rust port](../11-performance-optimization-turbopack/02b-what-the-react-compiler-costs-and-the-rust-port.md) has the detail, and [ch11 · migrating existing memoization](../11-performance-optimization-turbopack/02d-migrating-existing-memoization.md) is the practical pass.

## 3 · The rendering model — opt-in today, stated as the default tomorrow

This is the one to actually plan around, because it is the only item here with a published statement of intent behind it:

> *"it will become a default in a future major version of Next.js"*

That sentence is about `cacheComponents`, and the behaviours behind Instant Navigations ride on it together with `partialPrefetching`. [ch2 · Instant Navigations](../02-routing-and-navigation/10-instant-navigations/README.md) is the full treatment; [ch1 · hybrid static, dynamic and the cost model](../01-introduction-to-next-js/03b-hybrid-static-dynamic-and-the-cost-model.md) is why the framework went this way.

**The reason to plan rather than wait is that this migration has already been made harder on purpose.** Enabling the flag removed the old model's controls rather than layering on top of them:

> *"Enabling `cacheComponents` is not a rename-only change: it can surface build errors for uncached data outside of `<Suspense>` and requires adopting the Cache Components model."*

As of v16.0.0, `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` are gone under the flag, and `experimental.ppr` / `experimental_ppr` were removed outright. So there is no configuration in which both models are available and you migrate route by route at leisure — the flag is per-application, and the day you flip it every route has to already make sense under the new model. [ch5 · flipping the flag on an existing app](../05-caching-ppr-and-cache-components/01c-flipping-the-flag-on-an-existing-app.md) is the procedure; [ch5 · what changes once the flag is on](../05-caching-ppr-and-cache-components/01d-what-changes-once-the-flag-is-on.md) is the inventory.

🔴 **The one warning that overrides all of the above, for anyone already using PPR:**

> *"PPR in **Next.js 16** works differently than in **Next.js 15** canaries. If you are using PPR today, stay in the current Next.js 15 canary you are using."*

That is the documentation telling a specific population **not** to upgrade yet, and it is worth more than any amount of directional enthusiasm.

## What "plan the migration" actually means here

Not a ticket that says *"adopt Cache Components"*. Four concrete things, in this order:

1. **Find the request-time reads that are too high in the tree.** A `cookies()` or `headers()` read in a shared layout re-decides rendering for everything beneath it, and that is the work the flag will surface as build errors all at once. Doing it before the flag turns a wall of failures into a sequence of ordinary changes.
2. **Inventory every use of the four removed segment configs.** They are the old model's vocabulary and they have no successors under the new one; each is a decision that has to be re-expressed rather than renamed.
3. **Decide, per data source, which cache directive it lands under** — and note that the first move for a request-API read is always to hoist it out and pass a value in, not to change directive.
4. **Do it on a branch with the flag on**, because the build errors *are* the checklist. Nothing else enumerates the work for you.

## Gotchas

**★ Symptom: `next build` fails complaining about a webpack configuration, and your `next.config.ts` has none.** Cause: a plugin is adding a `webpack` option on your behalf, and Turbopack's guard cannot tell your configuration from your dependency's. Fix: find the plugin rather than the config — then either drop it, replace it with a loader Turbopack supports, or opt that build out with `--webpack` while you do.

**★ Symptom: a webpack plugin has no Turbopack equivalent and the migration stalls.** Cause: the compatibility boundary is asymmetric — loaders are supported, plugins are not — so a plugin is a redesign rather than a port. Fix: work out what the plugin produced and whether the framework now produces it natively; several webpack-era plugins solved problems 16 solves itself, and the honest answer for the remainder is `--webpack` plus a note on the load-bearing pile.

**★ Symptom: builds fail on Turbopack on one CI runner and pass everywhere else.** Cause: that platform has no native bindings, so Next.js fell back to WebAssembly bindings, which do not support Turbopack. Fix: `--webpack` on that platform. This is a hosting fact, not a configuration mistake, and it belongs in the deployment notes rather than in a debugging session.

**★ Symptom: a team refuses the React Compiler as "experimental".** Cause: the rung was read off the feature's reputation rather than its config key. `reactCompiler` is top level, which means stable; only its Rust port carries the `experimental.` prefix. Fix: read the key. The framework encodes maturity in the API surface precisely so this does not have to be a matter of opinion.

**★ Symptom: the React Compiler is enabled and CI times rise noticeably.** Cause: this is documented, not a regression — *"Expect compile times… to be higher"*. Fix: decide with the number in front of you, on your repository, rather than in the abstract; and if the number is the blocker rather than the behaviour, the thing you are waiting for is the Rust port, which has a name you can watch.

**★ Symptom: you enable `cacheComponents` on a large app and get a wall of build errors about uncached data.** Cause: the flag is not a rename — it surfaces every read that sits outside a `<Suspense>` boundary without a cache directive, all at once. Fix: treat the wall as the inventory it is, but generate it early on a branch. The order that works is to hoist request-time reads out of shared layouts *first*, because a single root-layout read produces failures attributable to dozens of unrelated routes.

**★ Symptom: after enabling the flag, `export const revalidate = 3600` stops doing anything, or the build rejects it.** Cause: `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` were removed as of v16.0.0 under the new model — they are the previous model's controls and this is a replacement, not an extension. Fix: re-express the intent in the new vocabulary rather than looking for a compatibility mode; a `revalidate` becomes a `cacheLife` profile on the cached scope.

**★ Symptom: a team on PPR upgrades to 16 and the behaviour changes underneath them.** Cause: PPR in 16 is not the PPR of the 15 canaries, and the documentation says so directly. Fix: this is the one case where the instruction is to stay put — *"If you are using PPR today, stay in the current Next.js 15 canary you are using"* — and it should be written down where the next person to attempt the upgrade will find it.

**★ Symptom: "we'll adopt Cache Components when it becomes the default" — and then the major lands and the migration is an emergency.** Cause: the stated future default was read as permission to defer rather than as a schedule. Fix: the flag exists so the migration can happen on your timetable instead of the release's; the work is identical either way, and the only variable is whether you choose the week.

**★ Symptom: someone cites a removal deadline for one of these features.** Cause: an inference. The documentation states an intent for `cacheComponents` becoming default and gives **no version and no date**, and for the deprecated Edge Runtime it names no removal version at all. Fix: quote what exists and leave the rest unstated. A deadline nobody published is worse than no deadline, because a team will plan against it.

## Interview questions

**★ How do you tell, from a Next.js config file alone, whether a feature is safe to build a release plan on?**
By the shape of the key. A top-level key is a stable feature the framework has simply chosen not to default — `reactCompiler: true` is the example, stable in 16 and off pending build-performance data. An `experimental.` prefix is not stable and should live in a branch, not a plan; `experimental.turbopackRustReactCompiler` is the matching example. The prefix is a maturity signal encoded in the API, so the question does not need to be settled by opinion or by how often a feature is mentioned in release notes.

**★ Why does `next build` fail on a custom webpack configuration rather than warning and continuing?**
Because the alternative is a build that succeeds while ignoring configuration you wrote, producing an artefact that differs from the one you described in ways nobody can see in a diff. That is the silent-divergence failure this whole book is organised around, and a stopped build is dramatically cheaper than it. The failure is also better targeted than it looks: the documentation anticipates the case where you did not write the configuration yourself and a plugin added it, which is the version of this that would otherwise take a day to diagnose.

**★ What is the difference between a loader and a plugin when migrating to Turbopack, and why does it matter so much?**
Turbopack supports webpack loaders and does not support webpack plugins. A loader transforms a file and can be carried across roughly as configuration; a plugin hooks the bundler's internals, so it has no port — you have to work out what it produced and find another way to produce it, which is a design task rather than a migration task. It matters because it decides whether a migration is an afternoon or a project, and it is knowable in advance by reading your own config.

**★ Vercel has said Cache Components becomes the default in a future major. Why is waiting the wrong response?**
Because the work is the same either way and only the timing is yours to choose. Enabling the flag is not a rename: it removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` as controls, and surfaces every uncached read outside a `<Suspense>` boundary as a build error. There is no mode where both models coexist and you migrate a route at a time. Doing it deliberately means hoisting request-time reads out of shared layouts first and taking the errors in a sequence you control; deferring means taking all of them in the week a major upgrade is already in flight.

**★ You are on PPR in a Next.js 15 canary and 16 is out. What do you do?**
Stay. The upgrade guide is unusually direct that PPR in 16 works differently from PPR in the 15 canaries and that current users should remain on the canary they are on. This is one of the few places the documentation tells a specific population not to upgrade, and it outranks any general preference for being current. What it does not do is tell you to stay forever — it is a signal to plan the transition as a real piece of work rather than as a version bump.

**★ Why is "expect compile times to be higher" a good reason to leave a stable feature off by default, and a bad reason for you to leave it off?**
Because the framework has to make one choice for every project and cannot know whether a given team's build budget has room, while you can measure yours in an afternoon. Defaults are a judgement under uncertainty about a population; your decision is a measurement on one repository. The asymmetry is why "the framework hasn't defaulted it" carries almost no information about whether you should enable it — and the thing that would change the framework's calculation, the Rust port, is separately identifiable and still experimental.

**★ Three compilers are described here. Which one should a team on 16.3 spend time on first, and why?**
The rendering model, because it is the only one with a stated future default and the only one whose migration gets more expensive the longer it waits — the flag removes the old vocabulary rather than layering over it. The bundler needs no work unless a build is already failing, in which case the failure is the schedule. The React Compiler is a bounded, measurable evaluation that can happen any time and can be repeated cheaply when the Rust port lands. Ordering by "cost of delay" rather than by novelty puts the rendering model first every time.

## Where this connects

- [ch5 · flipping the flag on an existing app](../05-caching-ppr-and-cache-components/01c-flipping-the-flag-on-an-existing-app.md) — the migration this page says to plan
- [ch11 · the React Compiler](../11-performance-optimization-turbopack/02-react-compiler-retiring-manual-usememo-usecallback.md) — the evaluation this page says is cheap
- [Appendix B · the 15-to-16 migration mechanically](../20-appendices/02b-appendix-b-the-15-to-16-migration-mechanically.md) — the codemods and the floors
- [ch1 · versioning and the LTS model](../01-introduction-to-next-js/04-versioning-and-lts-model-what-stable-canary-and-preview-mean.md) — what stable, canary and preview mean here

---

← [04 · Outlook: AI runtimes](04-outlook-deeper-ai-runtimes.md) · Next → [04c · Evaluating a preview feature](04c-evaluating-a-preview-feature.md)
