---
title: "Next.js ships agent infrastructure because the framework changed faster than the models that were trained on it — and the fix could not come from the tooling layer"
sidebar_label: "01 · Why the framework ships agent infrastructure"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) (`lastUpdated: 2026-08-25`), [Enabling Next.js MCP Server for Coding Agents](https://nextjs.org/docs/app/guides/mcp) (`lastUpdated: 2026-07-08`) and [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** · 16.3 GA **2026-08-03**. Documentation-verified; **no sandbox run, no timings**.

**The heading Next.js writes into your repository is not marketing copy. When `next dev` generates `AGENTS.md`, the block it inserts opens with the sentence *"This is NOT the Next.js you know"* — addressed to a machine, in the imperative, because the framework has concluded that a coding agent's default behaviour on a Next.js 16 codebase is to write confident Next.js 14. That is a strong claim for a framework to make about its own ecosystem, and this page is about why it is true, why the fix had to ship inside the `next` package rather than in an editor extension, and what the three-part investment actually consists of. The mechanics are in [chapter 20's Appendix C](../20-appendices/03-appendix-c-tooling.md); this chapter is about working this way.**

## 1 · The concrete version of "not the Next.js you know"

Vagueness helps nobody here, so take the five things a model trained on the pre-16 corpus believes, each of which produces code that looks right and is wrong:

| The model believes | True in 16 | What it writes |
|---|---|---|
| `params` and `searchParams` are synchronous | *"Starting with **Next.js 16**, synchronous access is fully removed"* | `const { slug } = params` — a build error, and the fix is not obvious from the message if you do not know a major happened |
| the file is `middleware.ts` | renamed to `proxy.ts`; the glossary entry for Middleware is now the single line *"See Proxy"* | a file the framework never loads, silently doing nothing |
| `next lint` runs your linting | removed, and *"`next build` no longer runs linting"* | a CI step that exits non-zero on an unknown command — or worse, a lint step nobody notices has vanished |
| PPR is behind `experimental.ppr` | flag and `experimental_ppr` segment config **removed**; PPR is the default under `cacheComponents` | a config key that no longer exists |
| `fetch` is cached by default | inverted — data fetching is dynamic by default under Cache Components; you opt in with `"use cache"` | code that is correct-looking, builds fine, and is dynamic everywhere |

🔴 **The last row is the dangerous one and it is the reason this is a framework problem rather than a documentation problem.** The first four fail loudly. The fifth produces an application that works, passes tests, renders correctly, and quietly costs a server render on every request. Nothing in the code says so. An agent cannot discover it, and neither can a reviewer reading the diff.

## 2 · Why the fix had to live in the framework

Three properties are needed to close that gap, and no editor extension has all three.

**It has to be version-matched, automatically.** The failure is not "the agent lacks documentation" — documentation is on the public internet. The failure is that the agent cannot tell *which version's* documentation applies to the repository in front of it, and a plausible-looking answer for 14 is worse than no answer. Only the package knows its own version:

> *"Next.js ships version-matched documentation inside the `next` package… Agents always have access to docs that match your installed version, with no network request or external lookup required."*

Upgrading the package upgrades the docs in the same step — *"including new guidance for existing features."* Nothing outside the dependency tree can promise that.

**It has to be available without asking for it.** This is the finding that shaped the design, and it is stated as an empirical result rather than a preference:

> *"Framework knowledge comes from the bundled docs, not from Skills. Benchmark results show that always-available context outperforms on-demand retrieval."*

That sentence is a small argument about agent design generally. Retrieval only fires when the agent knows it does not know — and the entire problem here is an agent that is *confident* and wrong. A retrieval step is never reached, because nothing triggers it. Always-available context does not depend on the agent recognising its own ignorance.

**It has to see runtime state.** The third gap is not knowledge at all:

> *"Runtime errors, client-side warnings, and rendered output live in the browser, where agents can't look."*

## 3 · The three-part investment

| Part | What it closes | Mechanism |
|---|---|---|
| **Knowledge** | the agent believes an older major | docs bundled at `node_modules/next/dist/docs/`, indexed by `AGENTS.md` |
| **Sight** | the agent cannot see the dev server or the browser | MCP at `/_next/mcp` + `next-devtools-mcp`; `agent-browser` for the DOM side |
| **Action** | the agent knows something is wrong and not what to do | errors that print a labelled fix menu; per-error pages under `/docs/messages` written for agents; Skills for multi-step workflows |

Each has its own page in this chapter: [02](02-agentsmd-and-repository-context-maps-version-matched-bundled.md), [03](03-the-nextjs-devtools-mcp-server-exposing-build-diagnostics-an.md), [04](04-163-preview-first-party-skills-for-multi-step-workflows.md).

## 4 · Autocomplete and workflow agents need different things

The shift in the chapter's title is not about model capability. It is about what the two modes require from their surroundings.

**Autocomplete needs local context only.** The buffer, the imports, the symbols in scope. It is proposing the next few tokens, a human is reading every one of them, and the correction loop is instant. Framework version barely matters, because a wrong suggestion is rejected in under a second.

**A workflow agent needs three things autocomplete never did.** It makes a sequence of changes without a human reading each one, so it needs to know the framework's *rules* rather than its *syntax* — and rules are exactly what changed between majors. It needs to check its own work, which means seeing runtime state rather than source text. And it needs a way to decide what to do next when something fails, which means errors have to carry more than a description.

That last one is the least obvious and the most interesting. An error that says *what is wrong* is enough for a human, who supplies the judgement about what to do. Next.js 16 errors say what is wrong **and enumerate the fixes with their trade-offs**:

```txt
Ways to fix this:
  - [stream] Provide a placeholder with `<Suspense fallback={...}>` around the data access
  - [cache] Cache the data access with `"use cache"` (does not apply to `connection()`)
  - [block] Set `export const instant = false` to allow a blocking route
```

🔴 **Read what that format concedes.** The framework is not telling the agent what to do — it is telling it that there are three answers and they are not equivalent. That is a deliberate refusal to automate a decision, and [page 06](06-honest-limits-where-agents-fail-in-app-router-codebases-cach.md) is about why that refusal is correct.

## 5 · What the framework does *not* claim to solve

Worth stating early, because the rest of this chapter is more useful if you are not expecting more than is on offer.

- **It does not make the agent right about your codebase.** Bundled docs fix framework knowledge. Your cache boundaries, your data-access rules and your `"use client"` conventions are yours to encode — which is what [page 02](02-agentsmd-and-repository-context-maps-version-matched-bundled.md) is actually about.
- **It does not reach production.** Every MCP capability is a dev-server capability. There is no production surface at all.
- **It does not verify judgement.** Nothing checks whether `[stream]` was the right choice for that route, whether an authorization check tests the relationship or only the session, or whether the app is usable with a keyboard.

## Gotchas

**★ Symptom: an agent writes `const { slug } = params` and defends it when challenged.** Cause: it is answering from training data where that was correct, and confidence is not calibrated to version. Fix: `AGENTS.md` pointing at `node_modules/next/dist/docs/`, so the correct answer is in context before it starts rather than retrievable if it thinks to ask. Arguing with the model is the wrong loop; changing what it reads at session start is the right one.

**★ Symptom: an agent-written feature builds, passes tests, renders correctly, and the hosting bill goes up.** Cause: the pre-16 default was cached `fetch`; the 16 default is dynamic. Code written against the old assumption is not *broken*, it is *dynamic*, and nothing fails. Fix: encode the rule where the agent will read it, and check it structurally rather than by review.

```md
## Caching rules for this repo
Data fetching is dynamic by default (Cache Components). Any read in a Server Component
must either be marked `"use cache"` with an explicit `cacheLife` and `cacheTag`, or sit
below a `<Suspense>` boundary. A read that is neither is a bug, not a default.
```

**★ Symptom: you add an MCP server and the agent still writes Next.js 14 code.** Cause: conflating the two halves — MCP gives *sight*, not *knowledge*. It can tell the agent an error exists; it cannot tell it that `params` became async. Fix: you need both. `AGENTS.md` for knowledge, MCP for runtime state. Adding one and expecting the other's benefit is the most common setup mistake.

**★ Symptom: a team adds a retrieval tool over the Next.js docs and agents still hallucinate APIs.** Cause: retrieval fires when the agent knows it does not know, and the failure mode here is confident wrongness — nothing triggers the lookup. Fix: always-available context, which is what the bundled docs plus `AGENTS.md` provide, and which Vercel's published benchmarks are the stated basis for.

**★ Symptom: `middleware.ts` exists, looks fine, and does nothing.** Cause: the convention is `proxy.ts` in 16; an agent restored or created the old filename from training data. Fix: rename, and read the consequence rather than just accepting the transform — `proxy` runs on the Node.js runtime and *"cannot be configured"*, so anything that relied on the edge runtime needs a decision, not a rename.

**★ Symptom: an agent proposes `experimental.ppr: true` to "enable Partial Prerendering".** Cause: the flag existed for two majors and is heavily represented in training data. Fix: the flag and the `experimental_ppr` segment config were removed; PPR is the default behaviour under `cacheComponents`. And this is not a rename — enabling `cacheComponents` *"can surface build errors for uncached data outside of `<Suspense>` and requires adopting the Cache Components model."*

**★ Symptom: agent output quality varies wildly between two developers on the same repo.** Cause: one has `AGENTS.md` and the MCP config, the other does not — and neither file is obviously load-bearing to someone who did not set them up. Fix: commit both. `AGENTS.md` is a source file, `.mcp.json` is a source file, and treating them as personal editor config is how the repo ends up with two classes of contributor.

**★ Symptom: someone deletes the managed block from `AGENTS.md` because "it is generated".** Cause: correct instinct, wrong conclusion. Fix: commit it. `next dev` writes it back every time, so deleting it produces a permanently dirty tree; the block says so about itself, and names the generator at `node_modules/next/dist/server/lib/generate-agent-files.js` if you want to verify.

## Interview questions

**★ Why did Next.js bundle its documentation into the npm package instead of relying on the docs site?**
Because the problem is not availability, it is version resolution. The documentation was always on the public internet; what an agent could not do is determine which version's documentation applies to the repository in front of it — and a confident answer for Next.js 14 in a Next.js 16 codebase is worse than no answer at all. Bundling makes version-matching structural: the docs travel with the package, upgrading one upgrades the other, and no network request is involved, so it works in a sandbox or an offline runner. Nothing outside the dependency tree can make that guarantee.

**★ Vercel says always-available context beats on-demand retrieval. Why would that be true rather than just cheaper?**
Because retrieval requires the agent to recognise its own ignorance, and the failure mode here is confident wrongness. A model that believes `params` is synchronous has no reason to look anything up — it is not uncertain. So the retrieval step never fires, and the tool that would have corrected it is never invoked. Always-available context does not depend on that recognition; the correct information is in the session whether or not the agent thinks it needs it. It is a claim about where the failure sits, not about latency.

**★ Which Next.js 16 change is most dangerous for an agent to get wrong, and why?**
The caching default inverting. The others fail loudly — synchronous `params` is a build error, a removed config key is rejected, `next lint` does not exist. The caching change produces an application that builds, passes tests and renders correctly while being dynamic everywhere, so it is invisible in code review and shows up later as latency and cost. A failure with no signal is worse than a failure with a bad message, because the bad message at least starts an investigation.

**★ Distinguish what MCP gives an agent from what `AGENTS.md` gives it.**
`AGENTS.md` is knowledge: it points the agent at version-matched documentation so it reasons about the framework you are actually running. MCP is sight: it exposes the running dev server's errors, logs, routes and compilation state so the agent can check what actually happened. They fail in opposite directions and neither substitutes for the other — an agent with MCP and no `AGENTS.md` will see an error clearly and propose a Next.js 14 fix for it, and one with `AGENTS.md` and no MCP will reason correctly about a runtime state it cannot observe.

**★ Next.js errors now print a menu of labelled fixes rather than one recommendation. What is the design argument?**
That the three fixes are genuinely different products and the framework does not know which one you want. `[stream]` keeps the route instant with a fallback; `[cache]` keeps it instant with possibly-stale data; `[block]` gives up instant navigation for freshness. A single recommendation would silently make a product decision on the developer's behalf, at scale, in every error. Enumerating them with their trade-offs is the framework declining to automate a judgement it is not in a position to make — and it is also, incidentally, the format most useful to an agent, which can then present the choice rather than guess.

**★ What is the difference in requirements between an autocomplete assistant and a workflow agent?**
Autocomplete needs local context and a fast correction loop: a human reads every suggestion, so a wrong one costs a keystroke. A workflow agent makes a sequence of changes without per-step review, so it needs the framework's rules rather than its syntax — and rules are what change across majors. It needs to verify its own work, which means observing runtime state rather than reading source. And it needs decidable next actions when something fails, which is why errors carrying enumerated fixes matter more than error messages carrying better prose. The three parts of the framework's investment map onto exactly those three needs.

**★ A colleague says agent infrastructure is an editor concern, not a framework concern. Respond.**
Two of the three parts cannot live in an editor. Version-matched documentation requires knowing the installed version and shipping with it — an extension would have to guess, and guessing is the original failure. Runtime state requires a server that exposes it; `/_next/mcp` runs inside `next dev` because that is where the errors, routes and compilation state exist. The third part, errors that enumerate their own fixes, requires the framework to know what the trade-offs are for its own semantics. An editor can host the agent and render the results, and that is a real job, but it cannot supply any of those three.

**★ What does this infrastructure explicitly not solve?**
Anything about your codebase rather than the framework. Bundled docs make the agent right about Next.js; they say nothing about your cache boundaries, your data-access rules or where your `"use client"` boundaries belong — that is what you encode yourself, outside the managed block. It also does not reach production: every MCP capability is a dev-server capability. And it does not verify judgement — nothing checks whether the fix chosen from the menu was the right one for that route, whether an authorization check tests the relationship rather than just the session, or whether the result is usable with a keyboard.

---

← [Chapter 14 overview](01-explanation.md) · Next → [`AGENTS.md` and repository context maps](02-agentsmd-and-repository-context-maps-version-matched-bundled.md)
