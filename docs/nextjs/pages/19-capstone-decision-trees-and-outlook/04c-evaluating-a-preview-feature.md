---
title: "Evaluating a preview feature is not a question about the feature — it is four questions about your own codebase, and the one that decides it is how many files would have to change if the API moved"
sidebar_label: "04c · Evaluating a preview feature"
sidebar_position: 62
description: "The base rate that makes blanket caution wrong, the four questions that price the bet, surface area as the variable nobody measures, how to read a deprecation without inventing a deadline, and the watchlist as a dated artefact."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 — the version facts on this page are those already verified in [Appendix E](../20-appendices/05-appendix-e-version-watchlist.md) and [chapter 15 · the Edge Runtime is deprecated](../15-databases-apis-and-full-stack-patterns/05b-the-edge-runtime-is-deprecated.md) against [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`) and [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) (`lastUpdated: 2026-08-25`). The method is this book's; the facts it is built on are cited to their pages.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**Almost every team answers "should we use this preview feature?" with a temperament rather than a method, and both temperaments are wrong in the same way — they answer a question about the feature when the question is about their own codebase. The framework's side of this is a coin whose bias you can actually observe: of the large cohort of previewed features this book tracked into 16.3, the overwhelming majority shipped stable and exactly two remained experimental. So refusing all of them is not caution, it is a policy of being eighteen months behind on things that were going to be fine. What separates a cheap bet from an expensive one is not the feature's odds — it is how much of your code would have to be edited if the API moved, and whether the door swings both ways. This page is those four questions, in the order that makes them answerable.**

## The base rate, because it makes blanket policies indefensible

[Appendix E](../20-appendices/05-appendix-e-version-watchlist.md) began life as a watchlist of every `[16.3 Preview]` feature in this book and resolved when 16.3 shipped on **2026-08-03**. The result:

- **Shipped stable** — Instant Insights, Partial Prefetching, the Navigation Inspector, ISR loading shells, the `instant()` helper, `catchError`, root params, glob imports, prefetch inlining, immutable static assets, TypeScript 7 type checking, version-matched agent docs, native Node.js streams in SSR, the Turbopack filesystem build cache and memory eviction.
- **Still experimental** — `experimental.turbopackRustReactCompiler` and `experimental.useOffline`. Two.
- **Repositioned** — the first-party Skills, which this book initially and wrongly recorded as *withdrawn*.

🔴 **Two things follow, and they point in opposite directions on purpose.** Betting against every preview is a losing strategy at this base rate. Betting on every preview is also losing, because the cost of the ones that move is not evenly distributed — it depends entirely on how deeply you committed. **The discipline is per-feature, and it is a pricing exercise, not a temperament.**

## The four questions, in order

Ask them in this order because each one can end the evaluation.

### 1 · What does it cost if it ships exactly as it is?

Usually nothing, and this is the question people spend all their time on. Answer it quickly and move on — it is the least informative of the four.

### 2 · How many files name the API?

**This is the question that decides it, and almost nobody asks it.** A preview feature is not one bet, it is one bet per call site. Two features with identical odds have wildly different prices:

```ts
// lib/offline.ts — the ENTIRE commitment lives in one module you own.
// If the API moves, one file changes and nothing else in the app knows.
export async function isOffline(): Promise<boolean> {
  // pseudo-code: the preview API is named exactly once, here
  return false
}
```

versus a directive or a config shape sprinkled through two hundred route files, where an API change is a codemod at best and a hand-edit at worst. **Surface area is the variable you control**, and you control it at adoption time by deciding whether the feature is allowed to be named outside a module boundary you own.

⚠️ **Some features cannot be wrapped, and that is a finding rather than a failure.** A cache directive is a compiler-visible token at the top of a scope — you cannot put it behind a function of your own. When wrapping is impossible, the surface area *is* the adoption, and question 2 has answered itself.

### 3 · What does reversal cost — and is it symmetric?

The trap is assuming a flag is reversible because it is a flag. `cacheComponents` is the case study, and it is instructive precisely because it looks like a switch:

> *"Enabling `cacheComponents` is not a rename-only change: it can surface build errors for uncached data outside of `<Suspense>` and requires adopting the Cache Components model."*

Enabling it removed `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` as controls as of v16.0.0. So turning the flag back off does not restore the application you had — **your code changed, not just your configuration**, and the old vocabulary is no longer available to change back to. [ch5 · what changes once the flag is on](../05-caching-ppr-and-cache-components/01d-what-changes-once-the-flag-is-on.md) is the inventory.

The check is one sentence: *if we turned this off tomorrow, what would still be different?* If the answer is "nothing", it is a flag. If the answer names code, it was an adoption wearing a flag's clothing.

### 4 · Is it a one-way door?

A small number of decisions cannot be walked back at any price, and they deserve a different conversation from everything else. `output: 'export'` is the corpus's canonical example — [ch6 · the migration back and the one-way door](../06-ssg-isr-and-ssr-strategy/04d-the-migration-back-and-the-one-way-door.md) is the argument. A one-way door is not evaluated by expected value; it is evaluated by whether you can live with the worst case, because you will not get to revise.

## Reading the status honestly — the evidence, in order of strength

1. **The config key's shape.** Top-level means stable; an `experimental.` prefix means it is not. This is the cheapest and most reliable signal available and it is machine-checkable.
2. **The upgrade guide**, which states removals, deprecations and floors for the version you are moving to.
3. **The API reference for the specific feature**, fetched as Markdown so you can read its frontmatter.
4. **Release notes and blog posts**, which state intent — genuinely useful, and the weakest of the four, because intent is not a schedule.

🔴 **On a docs page, `version:` is the docs build and is stamped identically on every page; `lastUpdated:` is the only freshness signal.** The production checklist is the standing proof: it reports `version: 16.3.4` and `lastUpdated: 2026-03-10` in the same frontmatter block, and its body follows the second. Append `.md` to any `nextjs.org/docs` URL, or send `Accept: text/markdown`, to see both.

```bash
curl -sL https://nextjs.org/docs/app/guides/production-checklist.md | head -8
```

## Reading a deprecation without inventing a deadline

This is where careful teams go wrong, because a deprecation feels like it must come with a clock, and often it does not.

**The Edge Runtime is deprecated in 16.3.4.** The migration is a deletion — *"The Node.js runtime is the default, so no replacement is needed."* But read what the documentation does **not** say: it names **no removal version**, and it does **not** say the build fails. `proxy` throws on the option rather than warning, which is a real and specific behaviour, and it is not the same as a deadline. [ch15 · the Edge Runtime is deprecated](../15-databases-apis-and-full-stack-patterns/05b-the-edge-runtime-is-deprecated.md) is the full treatment.

**`preferredRegion` is deprecated**, and the documentation names **no framework-level successor** — placement became platform configuration. *"There is no successor"* is a legitimate and useful thing to write down; inventing one is not. [ch11 · what survives the withdrawal](../11-performance-optimization-turbopack/04b-what-survives-the-withdrawal-proxy-and-region-placement.md) covers it.

⚠️ **A deadline nobody published is worse than no deadline**, because a team will plan against it, discover it was invented, and then discount the next real one.

## The two errors that produced this section, both from the same habit

This book made one of them and had to correct it in public:

- **Announcing a death that has not happened.** Skills were recorded as *withdrawn*; the documentation says framework knowledge comes from the bundled docs rather than from Skills, and that Skills cover workflows. They ship today. **"Superseded" and "removed" are different words, and a watchlist that conflates them retires a feature its readers could still be using.**
- **Inferring a history the source does not contain.** The docs do not narrate how the arrangement came about, so *"the documentation does not say whether an earlier generation existed"* is the correct end of that sentence.

🔴 **Both errors come from turning a narrow documented statement into a broad narrative one.** The defence is mechanical: quote the sentence you have, and stop at its edge.

## The artefact — a watchlist with a date on it

An evaluation you did not write down will be redone from memory in six months, worse. The form that works is short and it is what [Appendix E](../20-appendices/05-appendix-e-version-watchlist.md) turned out to be:

| Column | Why it is there |
|---|---|
| Feature and **exact config key** | the key's shape is the status signal, so record it verbatim |
| Status **at the date you checked**, and the date | a status with no date is a rumour |
| Where it is used, and **how many files name it** | question 2, recorded so the next person need not re-derive it |
| Reversal cost, and whether it is symmetric | question 3 |
| The re-check trigger | a version, not a calendar reminder — "next major" beats "in six months" |

**The re-check trigger is the row that makes it a living document.** Tie it to an upgrade rather than to a date, because that is the moment somebody is already reading the upgrade guide.

## Gotchas

**★ Symptom: a blanket "no experimental features" policy, defended as caution.** Cause: the feature's odds are being treated as the whole question. Fix: price it instead. At the observed base rate the policy loses far more than it saves, and the same energy spent capping *surface area* — one module names the API, nothing else does — buys the protection the policy was reaching for without the cost.

**★ Symptom: a preview API turns out to be named in ninety files when it moves.** Cause: nobody asked question 2 at adoption time, so the commitment grew silently one call site at a time. Fix: at adoption, decide whether the feature may be named outside a boundary you own, and enforce it with a lint rule or a review convention. Where wrapping is genuinely impossible, record that as the finding it is.

**★ Symptom: "we can just turn the flag off" turns out to be false.** Cause: enabling it changed the code, not only the configuration — `cacheComponents` removed `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` as controls, so there is nothing to turn back *to*. Fix: apply the reversal test before adopting, not after: *if we turned this off tomorrow, what would still be different?* Anything that names code makes this an adoption, not a switch.

**★ Symptom: a team plans a migration against a removal deadline that does not exist.** Cause: a deprecation was read as implying a schedule. The Edge Runtime deprecation names no removal version and does not say the build fails. Fix: quote the documentation's own words in the plan. If it names no version, the plan says *"no removal version published"*, which is honest and still actionable.

**★ Symptom: a status check reports a feature is current because the docs page says `version: 16.3.4`.** Cause: `version:` is the docs build and is stamped on every page identically. Fix: read `lastUpdated:` instead, which means fetching the page as Markdown. The production checklist carries both and disagrees with itself, which is the cheapest available demonstration.

**★ Symptom: a feature was evaluated carefully, and eight months later nobody can say what was decided or why.** Cause: the evaluation happened in a meeting. Fix: the five-column table above, in the repository, with the re-check trigger tied to a version rather than a date — so the next reader arrives at it while already reading an upgrade guide.

**★ Symptom: a preview feature is adopted in production and its own documentation told you not to.** Cause: general enthusiasm outranked a specific instruction. The clearest live example is PPR: *"If you are using PPR today, stay in the current Next.js 15 canary you are using."* Fix: search the upgrade guide for your feature by name before adopting or upgrading; targeted "do not" instructions are rare, and they are the highest-value sentences in the document.

**★ Symptom: the evaluation concludes "wait and see", and nothing triggers the re-look.** Cause: "wait" was recorded as a decision but no observation was attached to it. Fix: "wait" is only a decision if you name what you are waiting for — a stable config key, a named Rust port landing, a benchmark. Waiting for a feeling of readiness is indefinitely deferrable, and it always is deferred.

**★ Symptom: you adopt a stable-but-off feature and colleagues object that it is experimental.** Cause: the rung was inferred from how much the feature is talked about rather than from its key. Fix: show the config. `reactCompiler` is top level and therefore stable; `experimental.turbopackRustReactCompiler` is its Rust port and is not. The API encodes the answer so it does not have to be argued.

## Interview questions

**★ What is the single most useful question when deciding whether to adopt a preview feature, and why is it not about the feature?**
How many files would name the API. The feature's chance of changing is roughly fixed and roughly knowable, but the cost of that change is entirely yours to set: the same feature called once behind a module you own and called in two hundred route files are two completely different bets at identical odds. It is the only term in the calculation you control at adoption time, which makes it the one worth the most thought.

**★ Why is a blanket policy against experimental features a bad policy rather than a conservative one?**
Because the base rate is observable and it is not close. Of the preview cohort this book tracked into 16.3, the overwhelming majority stabilized and two remained experimental. A blanket refusal therefore pays a large, certain cost — being behind on features that were going to be fine — to avoid a small, uncertain one. It also fails to distinguish the cases where the caution is genuinely warranted, which are the deep-commitment and one-way-door ones, so it protects worst where it matters most.

**★ `cacheComponents` is a boolean in a config file. Why is calling it "reversible" wrong?**
Because enabling it removed the previous model's controls — `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` — as of v16.0.0, and the documentation is explicit that it is not a rename-only change and requires adopting the model. The application you write under the flag is not the application you had, and turning the flag off leaves you with code written against a vocabulary the framework no longer provides. The general test is to ask what would still be different if you turned it off tomorrow; anything that names code means you adopted rather than toggled.

**★ How do you tell a stable feature that is switched off from an experimental one?**
The config key. A top-level key means stable and simply not defaulted; an `experimental.` prefix means it is not stable. The React Compiler and its Rust port are the two halves of the same example — `reactCompiler` is top level, `experimental.turbopackRustReactCompiler` is not, and they are frequently discussed as one thing. The signal is in the API surface deliberately, so the question is checkable rather than debatable.

**★ A feature is marked deprecated with no removal version. What goes in your migration plan?**
What the documentation says, and nothing more. For the Edge Runtime that is: deprecated, the migration is a deletion because Node.js is the default, `proxy` throws on the option rather than warning, and **no removal version is published**. The temptation is to supply a deadline so the work can be scheduled, but a deadline nobody published will be discovered to be invented, and the cost of that is that the next real deadline gets discounted too. Schedule it on your own risk assessment and label it as yours.

**★ Why should a watchlist's re-check trigger be a version rather than a date?**
Because a date arrives when nobody is thinking about the framework, and a version arrives when somebody is already reading the upgrade guide. Tying the re-check to "the next major" puts the question in front of the person best placed to answer it at the moment they have the relevant document open. A calendar reminder, by contrast, interrupts someone mid-sprint with a question they will defer.

**★ This book recorded a feature as withdrawn when it had only been repositioned. What is the discipline that prevents that class of error?**
Quote the sentence you have and stop at its edge. The documentation said framework knowledge comes from the bundled docs rather than from Skills, and that Skills cover workflows rather than lookups — a statement about scope. Widening it to "withdrawn" added a claim the source did not make. The matching over-correction, asserting that an earlier generation was removed, would add a history the source also does not contain; the correct ending is "the documentation does not say". Both errors are the same habit, and the defence is mechanical rather than a matter of judgement.

## Where this connects

- [Appendix E · the version watchlist](../20-appendices/05-appendix-e-version-watchlist.md) — the worked example of a watchlist that resolved, including the entry this book got wrong
- [ch1 · versioning and the LTS model](../01-introduction-to-next-js/04-versioning-and-lts-model-what-stable-canary-and-preview-mean.md) — what stable, canary and preview mean in this project
- [ch14 · first-party Skills](../14-agent-driven-development/04-163-preview-first-party-skills-for-multi-step-workflows.md) — the feature the correction is about

---

← [04b · Compiler evolution and the next default](04b-compiler-evolution-and-the-next-default.md) · [Chapter 19 overview](01-explanation.md) · Next chapter → [20 · Appendices](../20-appendices/01-explanation.md)
