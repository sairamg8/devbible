---
title: "The outlook on AI runtimes is not a prediction about agents getting better — it is that Next.js 16 moved framework knowledge out of a model's training data and into your `node_modules`, and that inversion is what a team has to be positioned for"
sidebar_label: "04 · Outlook: AI runtimes"
sidebar_position: 16
description: "What the framework has already committed to publicly, the retrieval-to-always-available-context inversion and its consequences for a codebase, what an agent still cannot decide, and the direction claim this book itself got wrong."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-05 against [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) (`lastUpdated: 2026-08-25`) and [Enabling Next.js MCP Server for Coding Agents](https://nextjs.org/docs/app/guides/mcp) (`lastUpdated: 2026-07-08`), both fetched as Markdown 2026-09-04. The mechanisms themselves are taught in [chapter 14](../14-agent-driven-development/01-explanation.md) and [Appendix C](../20-appendices/03-appendix-c-tooling.md); this page argues only the direction they point in.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**An outlook chapter is where books go to be wrong, so this one is written to a rule: it makes claims only about things the framework has already shipped or has publicly said it will do, and it says explicitly which is which. On that basis the honest headline is not "agents will get better" — nobody in this book can source that. It is that Next.js 16 performed a specific, verifiable inversion. Framework knowledge used to live in a model's training data and be retrieved on demand; it now ships in your `node_modules`, pinned to the version you installed, and is loaded whether or not anybody asks for it. Vercel's stated reason is a benchmark result: *"always-available context outperforms on-demand retrieval."* Everything else in the agent story — the generated context file, the MCP endpoint on the dev server, the repositioning of Skills — follows from that one finding, and it is the thing worth being positioned for.**

## What has actually shipped, so the direction is not speculation

Three concrete things, all in 16.x, all quotable. [Chapter 14](../14-agent-driven-development/01-why-the-framework-now-ships-agent-infrastructure-the-shift-f.md) teaches them; the point here is their shape taken together.

**1 · Documentation became a build artefact.** Next.js ships version-matched docs inside the package:

> *"Next.js ships version-matched documentation inside the `next` package… An `AGENTS.md` file at the root of your project directs agents to these bundled docs instead of their training data."*

They live at `node_modules/next/dist/docs/`, and the guarantee is the interesting half:

> *"Agents always have access to docs that match your installed version, with no network request or external lookup required."*

**2 · The dev server became an API.** 16+ exposes an MCP endpoint at `/_next/mcp`, and `next-devtools-mcp` connects to it:

> *"Next.js 16+ includes MCP support that enables coding agents to access your application's internals in real-time."*

It is not a documentation lookup. Its tools read build errors, runtime errors, type errors, the route table, logs, page and project metadata, and it can resolve a Server Action id back to a source file. Two of the nine — `get_compilation_issues` and `compile_route` — are documented **Turbopack only**. [Appendix C part 2](../20-appendices/03b-appendix-c-runtime-sight-mcp-and-the-error-loop.md) is the mechanics.

**3 · The repository became part of the toolchain.** On 16.3 or later, `next dev` generates the context file itself:

> *"When an AI coding agent is detected in the environment and no managed block is present, Next.js auto-generates `AGENTS.md` and `CLAUDE.md` at the project root. Existing `AGENTS.md` or `CLAUDE.md` files are upserted, so content outside the managed block is preserved."*

The generated region is delimited, and the framework owns it:

```text
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know
...
<!-- END:nextjs-agent-rules -->
```

⚠️ **That delimiter is an HTML comment, and this book's pages are parsed as MDX** — which is why it appears above inside a fenced block and must never be pasted into prose. A bare comment of that form aborts the production build. It is a small thing and it has cost this corpus three days of broken deploys before.

`agentRules: false` in `next.config.ts` opts out. On **16.2** the docs are bundled but the file is not generated; on **16.1 and earlier** neither happens and the legacy `npx @next/codemod@canary agents-md` downloads a version-matched copy to `.next-docs/`.

## The inversion, and the four consequences that actually land on a team

The pattern in all three is the same: **something that used to be external, general and version-agnostic became internal, specific and version-pinned.** That is the trajectory. Four consequences follow, and they are what to act on.

**Your docs now have a version, and it is the one in your lockfile.** The failure mode changes shape. It used to be "the agent is describing Next.js 13"; it becomes "the agent is describing whatever `next` your lockfile resolved", which is a *correct* answer to the wrong question if your lockfile is stale. Upgrading the framework now silently upgrades the documentation your tooling reads.

**Diff noise becomes a policy question.** The managed block is re-added by `next dev`, so removing it from a diff only recreates the uncommitted change. Commit it with your work and the tree stays clean; fight it and every developer has a permanently dirty working directory.

**The half of the context file you own is the valuable half.** The framework writes the framework's half. Yours is the part no generator can produce, and [ch14's milestone](../14-agent-driven-development/07-project-milestone-sprintdesk-gets-an-agentsmd.md) is emphatic about its content: **decisions, not advice.** This is where the load-bearing pile from a retrospective belongs — it is the one document a future change is guaranteed to read.

**"No network request" is a supply-chain statement as much as a latency one.** Bundled docs are one fewer external dependency in the loop, and they are also one more thing arriving through your package manager. The lesson [ch18 records](../18-advanced-ecosystem-topics/03b-supply-chain-vigilance.md) — that the AVIF RCE arrived through libheif → `sharp` → Next.js while the framework's own code was never at fault — applies to anything that ships inside a package, documentation included.

## What an agent still cannot decide, and why that is structural

This is the part an outlook chapter usually omits, and it is the part that ages best, because it is not about capability.

Every tool listed above answers a question with a **checkable** answer: what are the errors, what are the routes, which file is this Server Action. None of them answers the questions this chapter is built out of — which cache directive a scope should use, what a dependency's outage should cost, whether a piece of state belongs in the URL or a store. Those are not lookups. They are **trade-offs against a product's requirements**, and the requirement is not in the repository.

🔴 **The distinction is not "hard versus easy". It is "in the codebase versus not in the codebase".** An agent with perfect reasoning still cannot read a decision nobody wrote down. That is exactly why a context file made of decisions is infrastructure and one made of advice is a document — and it is why the retrospective comes before the outlook in this chapter. [ch14 · honest limits](../14-agent-driven-development/06-honest-limits-where-agents-fail-in-app-router-codebases-cach.md) and [what context files fix](../14-agent-driven-development/06b-what-an-agent-cannot-decide-and-what-context-files-fix.md) are the full treatment.

## The direction claim this book got wrong

An outlook page that has never been wrong has not been checked. This one has, and the correction is worth more than the rest of the page.

Until 2026-09-04 this book asserted that the first-party Skills were **withdrawn**, superseded by version-matched bundled docs, and offered that as its example of a previewed feature being retired rather than stabilized. The AI agents guide says something narrower:

> *"Framework knowledge comes from the bundled docs, not from Skills. Benchmark results show that always-available context outperforms on-demand retrieval. Skills cover the tasks that are workflows rather than lookups."*

Skills lost **one job** and kept the other. They ship today, installed with `npx skills add vercel/next.js`, in three documented categories — *"Runtime foundations"*, *"Interactive workflows"*, *"Unattended loops"* — with four named in the guide: `next-dev-loop`, `next-cache-components-adoption`, `next-cache-components-optimizer`, `next-partial-prefetching-adoption`.

⚠️ **The over-correction is also available and also wrong.** The documentation does not narrate how the arrangement came to be, so it cannot settle whether an earlier generation of Skills existed and was removed. The accurate word is **repositioned**, and *"the docs do not say"* is the honest end of that sentence. [Appendix E](../20-appendices/05-appendix-e-version-watchlist.md) carries the full correction.

🔴 **The general lesson: "superseded" and "removed" are different words, and a watchlist that conflates them retires a feature its readers could still be using.** Both errors — announcing a death that did not happen, and inferring a history the source does not contain — come from the same habit of turning a narrow documented statement into a broad narrative one.

## What would falsify this direction

Stated so a later reader can check rather than believe. The inversion argued here would be in question if any of these happened: the bundled docs stopped being version-matched and became a single copy; `agentRules` defaulted to off; the MCP surface moved out of the dev server and into a hosted service; or Vercel published a benchmark reversing the always-available-context finding. **None of those has happened as of 16.3.4**, and this page makes no claim about whether any of them will.

## Gotchas

**★ Symptom: the agent confidently describes an API that does not exist in your project.** Cause: it is answering from training data rather than the bundled docs, because no `AGENTS.md` points it at `node_modules/next/dist/docs/` — or because it is running on a version below 16.2, where the docs are not bundled at all. Fix: check the version floor first, then the file. On 16.1 and earlier, `npx @next/codemod@canary agents-md` fetches a version-matched copy into `.next-docs/`.

**★ Symptom: the agent describes the framework accurately, and its advice is still wrong for your project.** Cause: the bundled docs match your **lockfile**, so a stale lockfile produces a correct description of a version you are trying to leave. Fix: treat the installed version as the answer's premise. Print it before trusting anything version-sensitive:

```bash
node -p "require('./node_modules/next/package.json').version"
```

**★ Symptom: `AGENTS.md` keeps reappearing in `git status` after you delete it.** Cause: `next dev` re-adds the managed block whenever an agent is detected and no block is present — removing it from a diff only recreates the uncommitted change. Fix: decide the policy once. Commit the block with your work, or turn generation off in config; do not do neither:

```ts
// next.config.ts
const nextConfig = { agentRules: false }
export default nextConfig
```

**★ Symptom: your careful notes in `AGENTS.md` vanish after a `next dev`.** Cause: they were written **inside** the managed block, which the framework rewrites. Fix: keep everything you own outside the `BEGIN`/`END` delimiters. The guide is explicit that content outside the managed block is preserved, and content inside it is not yours.

**★ Symptom: two MCP tools return nothing useful, while the other seven work.** Cause: `get_compilation_issues` and `compile_route` are documented **Turbopack only**. Fix: this is not a misconfiguration to debug — check the bundler before the wiring. Turbopack is the default in 16, so the usual cause is a project that opted back out with `--webpack`.

**★ Symptom: an agent starts a second dev server and then reports the wrong port.** Cause: nothing told it one was already running. Fix: 16 writes the PID, port and URL to `.next/dev/lock`, and a second `next dev` in the same project prints the running server's URL and the PID to kill — so the fix is to let the agent read that rather than to add process management of your own.

**★ Symptom: the context file is long, well written, and changes nothing about the output.** Cause: it is advice — *"prefer Server Components"*, *"write clean code"* — which restates what the bundled docs already say better. Fix: replace it with decisions the docs cannot know. *"Mutations go through Server Actions; Route Handlers exist only for non-browser clients"* is a fact about this repository and is worth more than a page of principles.

**★ Symptom: a team blocks agent adoption pending a policy on "AI reading our code", while `next dev` has been generating a context file for weeks.** Cause: the framework moved first, and the default is on when an agent is detected. Fix: make it an explicit decision either way — `agentRules: false` is a one-line, reviewable, greppable answer, and having no answer is not the same as having declined.

**★ Symptom: you cite a feature as "withdrawn" and a reader is still using it.** Cause: a narrow documented statement — *"framework knowledge comes from the bundled docs, not from Skills"* — was widened into a narrative one. Fix: quote the sentence you have and stop there. *"Repositioned; the docs do not say whether an earlier generation was removed"* is longer, uglier, and correct.

## Interview questions

**★ What actually changed about AI tooling in Next.js 16, stated without adjectives?**
Framework knowledge moved from a model's training data into the installed package. `node_modules/next/dist/docs/` ships version-matched documentation; `AGENTS.md` points agents at it; and from 16.3 `next dev` generates that file itself when it detects an agent. Alongside it the dev server exposes an MCP endpoint at `/_next/mcp` giving tools access to build errors, the route table, logs and Server Action ids. The stated rationale is a benchmark result — always-available context beating on-demand retrieval — and everything else in the story, including the repositioning of Skills, follows from it.

**★ Why does version-matched documentation change the failure mode rather than remove it?**
Because the docs are now pinned to your lockfile rather than to a training cutoff. The old failure was an agent describing a version of the framework nobody is running. The new failure is an agent describing *your* version correctly while your version is two majors behind where the team thinks it is. The second is harder to notice, because everything it says is internally consistent and verifiable — it is simply an accurate answer about the wrong premise.

**★ An agent can read your build errors, your routes and your logs. Why can it still not choose your caching strategy?**
Because the inputs are not in the repository. Choosing between `use cache`, `use cache: remote`, `use cache: private` and none depends on whether the data may rest on a shared server, how stale a given reader is allowed to be, and what the upstream costs — and those are product and compliance requirements, not code. The limit is structural rather than a matter of capability: a decision nobody wrote down cannot be read, however good the reader. This is the argument for a context file made of decisions.

**★ Your team wants to stop `next dev` writing `AGENTS.md`. Is that reasonable, and what is the cost?**
It is reasonable and it is one line — `agentRules: false`. The cost is that you give up version-matched context for whatever agents do end up running in the repository, and the guide is direct about its own preference: *"We believe leaving auto-generation on is a good default."* The failure to avoid is neither choice but the absence of one, where the block is generated, uncommitted, and quietly deleted by each developer in turn.

**★ This book asserted that first-party Skills were withdrawn. What was wrong with that, and what is the general lesson?**
The documentation says framework knowledge comes from the bundled docs rather than from Skills, and that Skills cover workflows rather than lookups. That is a statement about scope, not about existence — Skills ship today in three documented categories. The claim widened a narrow sentence into a narrative one. The general lesson is that "superseded" and "removed" are different words, and conflating them in a watchlist retires a feature readers could still be using. The matching over-correction is inventing a history the source does not contain, which is why the corrected entry ends with *"the docs do not say."*

**★ How should an outlook section be written so it is checkable rather than merely confident?**
By separating what has shipped from what has been stated as intent from what the author is guessing, and by naming what would falsify the argument. This page claims an inversion that is already in the package, quotes the sentence supporting each part, marks the Instant Navigations default as a *stated* future rather than a shipped one, and lists four observations that would put the direction in question. A reader in a year can check every one of those against the docs, which is the only property that makes a forward-looking page worth keeping.

## Where this connects

- [ch14 · why the framework ships agent infrastructure](../14-agent-driven-development/01-why-the-framework-now-ships-agent-infrastructure-the-shift-f.md) — the mechanics this page only argues about
- [Appendix C · tooling](../20-appendices/03-appendix-c-tooling.md) — the MCP configuration and the CLI surface
- [Appendix E · the version watchlist](../20-appendices/05-appendix-e-version-watchlist.md) — where the Skills correction is recorded in full

← [03e · The runtime and deployment-target tree](03e-the-runtime-and-deployment-target-tree.md) · [Chapter 19 overview](01-explanation.md) · Next → [04b · Compiler evolution and the next default](04b-compiler-evolution-and-the-next-default.md)
