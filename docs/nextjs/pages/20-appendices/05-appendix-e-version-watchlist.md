---
title: "Appendix E · the watchlist resolved: 16.3 shipped, so this is now a record of what stabilized, what stayed experimental, and the one entry this book had wrong"
sidebar_label: "13 · Appendix E — the version watchlist"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) (`lastUpdated: 2026-08-25`) and [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`), building on the currency pass of 2026-09-03 against [Next.js 16.3](https://nextjs.org/blog/next-16-3).
> Target: **Next.js 16.3.4** · 16.3 GA **2026-08-03** · 16.3 = Active LTS, 15.5 = Maintenance LTS. Documentation-verified; **no sandbox run, no timings**.

**This appendix was commissioned as a watchlist: every `[16.3 Preview]` feature in this book, with the stabilization status to check before using it in production. 16.3 shipped on 2026-08-03, so there is nothing left to watch and the page has become something more useful — a worked record of what happened to a cohort of preview features, including the two that did not stabilize, the one that was retired, and the one this book got wrong. A watchlist that resolves cleanly teaches nothing. This one did not resolve cleanly, and the interesting part is the entry that had to be corrected.**

## 🔴 The correction

**Until 2026-09-04 this page asserted that the first-party Skills were *withdrawn, superseded by version-matched bundled docs*, and offered that as the appendix's best example of a previewed feature being retired rather than stabilized. That is wrong, and the source that settles it is the AI agents guide.**

What the documentation actually says is narrower and more interesting:

> *"Framework knowledge comes from the bundled docs, not from Skills. Benchmark results show that always-available context outperforms on-demand retrieval. Skills cover the tasks that are workflows rather than lookups, such as adopting Cache Components or Partial Prefetching across an app."*

So Skills lost **one job** — carrying framework knowledge — to the docs bundled in `node_modules`, and kept the other. They ship today, installed with `npx skills add vercel/next.js`, in three documented categories: *"Runtime foundations"*, *"Interactive workflows"* and *"Unattended loops"*. Four are named in the guide: `next-dev-loop`, `next-cache-components-adoption`, `next-cache-components-optimizer` and `next-partial-prefetching-adoption`. [Appendix C part 2](03b-appendix-c-runtime-sight-mcp-and-the-error-loop.md) covers them.

⚠️ **What this page will not do is over-correct.** The documentation does not say whether an *earlier* generation of Skills existed and was removed. It describes the current arrangement and does not narrate how it got there. So the accurate statement is **repositioned, not withdrawn** — and where the earlier claim came from is not something this page can settle.

The general lesson is the one worth keeping: **"superseded" and "removed" are different words, and a watchlist that conflates them retires a feature its readers could still be using.**

## Shipped stable in 16.3

The bulk of the cohort landed. From the 16.3 release material, verified 2026-09-03:

| | |
|---|---|
| Instant Insights · Partial Prefetching · Navigation Inspector | the Instant Navigations trio |
| loading shells for un-prerendered ISR routes | the App Shell as ISR fallback |
| the `instant()` Playwright helper | the only machine-checkable proof of instant navigation |
| `catchError` (`next/error`) · root params (`next/root-params`) | error and routing surface |
| `import.meta.glob` · prefetch inlining | build and prefetch |
| immutable static assets across deploys | the version-skew story |
| TypeScript 7 type checking · version-matched agent docs | tooling |
| native Node.js streams in SSR | runtime |
| Turbopack FS build cache · Turbopack memory eviction | bundler |

## Still experimental after 16.3

- `experimental.turbopackRustReactCompiler`
- `experimental.useOffline`

Two out of a large cohort is a good hit rate, and it is the right prior to carry into the next release: **most previewed features ship, so betting against all of them is as wrong as betting on all of them.** The discipline is per-feature, not blanket.

⚠️ Note the distinction from the **React Compiler**, which is a different thing: it is *stable* in 16 via top-level `reactCompiler: true` and simply **not enabled by default**, pending build-performance data. Stable-but-off and experimental are two different states and the config key tells you which — a top-level key is stable, an `experimental.` prefix is not. [Appendix B part 1](02-appendix-b-react-upgrade-blueprint-tracking-react-canary-nex.md) covers the trade.

## Deprecated and removed alongside

| Item | State |
|---|---|
| `preferredRegion` | **deprecated** — and [chapter 16](../16-deployment-scaling-and-observability/01-explanation.md) records that the documentation names **no framework-level successor**; placement became platform configuration |
| `next lint` | **removed** in 16, and `next build` no longer lints |
| `experimental.ppr` / `experimental_ppr` | **removed** — superseded by `cacheComponents` |
| `experimental.dynamicIO` / `experimental.useCache` | **removed** — superseded by `cacheComponents` |
| `unstable_rootParams` | **removed** — superseded by `next/root-params` |
| `middleware` | **deprecated** in favour of `proxy` — 🔴 but keep it if you need the edge runtime |
| `next/legacy/image` · `images.domains` | **deprecated** |
| AMP · `serverRuntimeConfig` · `publicRuntimeConfig` | **removed** |

🔴 **`middleware` is the row to read twice.** It is deprecated, and the documented advice is nevertheless to keep using it if you need the edge runtime, because `proxy` is Node.js-only and not configurable. A deprecation you are told to ignore under a stated condition is not something a watchlist normally has a column for.

## The two opt-ins with a date on them

⚠️ **Vercel states the Instant Navigations behaviours — `cacheComponents` plus `partialPrefetching` — will become the default in a future major.**

That reclassifies them. An experiment is something you can decline; a future default is a migration you are scheduling whether or not you have written the date down. The practical consequence is that the cost of adopting them only goes up: adopt now and you choose the moment, the branch and the pace; adopt at the major and you do it alongside every other breaking change in that release.

## Keep the habit, not the list

This page's contents expire. The method does not.

1. **Read the release notes for the major, not the patch.** Preview features stabilize, get renamed, or quietly go away at majors.
2. **Distinguish four states, not two.** *Stable and default* · *stable but off* (`reactCompiler`) · *experimental* (`experimental.` prefix) · *deprecated with a stated exception* (`middleware`). A two-column watchlist cannot express the last two and will mislead you about both.
3. **Read the config key.** A top-level key is stable; an `experimental.` prefix is not. That is a more reliable signal than prose, because the prefix is enforced by the type.
4. **Check `lastUpdated:`, never `version:`.** Fetch any docs page with `.md` appended. [Appendix D part 1](04-appendix-d-production-readiness-checklist-security.md) is the case study: a page stamped `16.3.4` whose body was last reviewed in March.
5. **Re-verify before quoting.** This page carried a wrong entry for a day because a plausible summary went unchecked against the guide that owned the feature.

## Gotchas

**★ Symptom: a team declines to use Skills because they were "withdrawn."** Cause: a plausible but wrong summary — the one this page carried. Fix: they were repositioned. Framework knowledge moved to the bundled docs; Skills ship today for workflows, installed with `npx skills add vercel/next.js`. Check the AI agents guide before acting on any claim that a feature is gone.

**★ Symptom: you treat `reactCompiler: true` as an experimental flag and refuse it on those grounds.** Cause: conflating *stable but off* with *experimental*. Fix: read the key. It is top-level, not under `experimental.`, which means the API is committed; it is off pending build-performance data, and the documented cost is longer compile times because it runs through Babel. That is a measurement decision, not a risk decision.

**★ Symptom: someone removes `middleware.ts` because it is deprecated, and loses edge-runtime behaviour.** Cause: reading a deprecation as an instruction. Fix: the docs say to keep `middleware` if you need the edge runtime, because `proxy` runs on Node.js and cannot be configured otherwise. Deprecated does not always mean "migrate now" — read for the stated exception.

**★ Symptom: `preferredRegion` is removed from the codebase and nothing replaces it.** Cause: assuming a deprecation implies a successor. Fix: there is no framework-level successor — the documentation names none. Region placement moved to platform configuration, and [chapter 16](../16-deployment-scaling-and-observability/01-explanation.md) records that gap explicitly rather than inventing a replacement.

**★ Symptom: `cacheComponents` adoption keeps being deferred as "an experiment we might not need."** Cause: reading a future default as an optional feature. Fix: Vercel states these behaviours will flip to default in a future major, so the work is scheduled either way. Doing it now costs one focused migration; doing it at the major costs that migration plus everything else in the release, simultaneously.

**★ Symptom: a preview feature in a book is assumed dead because it is not in the current docs.** Cause: absence taken as evidence. Fix: the official glossary has no entry for MCP or Instant Navigations and both are shipped, documented features — see [Appendix A part 3](01c-appendix-a-glossary-the-a-to-z.md). Search the sitemap and the guides before concluding anything is gone.

**★ Symptom: a watchlist entry is recorded from a release blog post and later turns out wrong.** Cause: blog posts summarise; guides and API references specify, and they are corrected over time while a post is frozen at its publication date. Fix: verify the status against the reference page that owns the feature, and record which source settled it, so the next reader can re-check cheaply.

**★ Symptom: your team asks "is X still current" and nobody can answer without a research session.** Cause: no recorded provenance. Fix: keep a page like this one, with the source and the date beside every claim. Its whole value is that re-verification costs a fetch rather than an investigation.

## Interview questions

**★ Were the first-party Next.js Skills withdrawn?**
No — repositioned, and the distinction matters. The docs are explicit that framework knowledge comes from the version-matched documentation bundled inside `node_modules`, not from Skills, and give the reason: benchmarks show always-available context beating on-demand retrieval. What Skills carry now is workflows rather than lookups — `next-dev-loop` for the inspect-edit-verify cycle, plus the adoption Skills for Cache Components and Partial Prefetching. They install with `npx skills add vercel/next.js`.

**★ How do you tell an experimental feature from a stable one that is merely off by default?**
Read the config key. An `experimental.` prefix means the API itself is not committed and can change without a major; a top-level key means the API is stable and any default is a separate decision. `reactCompiler` is the clean example: top-level and therefore stable, but off while Vercel gathers build-performance data, with a documented cost in compile time because it relies on Babel. Treating those two states as one leads teams either to refuse committed APIs or to build on uncommitted ones.

**★ `middleware` is deprecated. Should you migrate?**
Usually yes, and there is a documented exception that makes the answer conditional: `proxy` runs on the Node.js runtime and that cannot be configured, so if your middleware depends on the edge runtime the docs tell you to keep using `middleware` until further instructions arrive in a minor release. That is unusual enough to be worth noticing as a general lesson — a deprecation is a direction of travel, not always an instruction for today, and the exception is in the prose rather than in the deprecation notice.

**★ Out of a cohort of preview features in 16.3, two remained experimental. What is the right prior for the next release?**
That most previewed features ship. Betting against all of them is as wrong as betting on all of them, and both blanket policies are ways of avoiding a per-feature judgement. The useful discipline is to ask, per feature, what happens if the API moves: a preview feature confined to one module is cheap to adopt and cheap to revise, while one that changes how every route renders is not — which is exactly why `cacheComponents` deserves scheduling and `import.meta.glob` does not.

**★ Vercel says the Instant Navigations behaviours will become the default in a future major. How does that change your plan?**
It converts a feature evaluation into a migration schedule. Something that will be the default is not optional; the only variable left is whether you do it on your timetable or on the release's. Doing it now means one focused change on a branch you control, with the dev-time validation telling you which routes need work. Doing it at the major means doing it alongside every other breaking change in that release, which is the version of the work with the worst debugging conditions.

**★ This page carried an incorrect entry. What process failure does that represent, and what fixes it?**
A plausible summary was recorded without being checked against the source that owned the feature — the AI agents guide, which describes Skills as current and repositions rather than removes them. The fix is structural rather than about care: record the source and the date next to every claim, so re-verification is a single fetch rather than a fresh investigation, and prefer the reference page over the release post, because references are corrected over time while posts are frozen. It is also the argument for a watchlist existing at all — a claim nobody wrote down cannot be re-checked, only re-argued.

---

← [Appendix D part 3 · metadata, a11y and the measurements](04c-appendix-d-metadata-a11y-and-the-measurements.md) · [Chapter 19 overview](01-explanation.md)
