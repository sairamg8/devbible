---
title: "The preview label on this concept has resolved: Skills were repositioned rather than withdrawn, and the piece that changes your day is an error menu that refuses to pick a fix for you"
sidebar_label: "04 · Skills, agent-browser and fix-menus"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) (`lastUpdated: 2026-08-25`) and the [Next.js 16.3 release post](https://nextjs.org/blog/next-16-3).
> Target: **Next.js 16.3.4** · 16.3 GA **2026-08-03**. Documentation-verified; **no sandbox run, no timings**.

**This concept arrived in the syllabus with a `[16.3 Preview]` label on it, and that label has expired — 16.3 went GA on 2026-08-03, so everything below is shipped surface rather than a roadmap. One thing did change shape on the way, and getting it wrong costs you real tooling: first-party Skills were **repositioned, not withdrawn**. They stopped being the delivery mechanism for framework knowledge, because [version-matched bundled docs](02-agentsmd-and-repository-context-maps-version-matched-bundled.md) do that job better, and they became packages of *workflow* — the multi-step migrations nobody wants to hand-drive. Alongside them sit two pieces that matter more than their size suggests: a browser CLI that reports which Suspense boundaries are still pending, and an error menu that hands you a labelled choice and a **Copy prompt** button instead of a fix.**

## The correction, first, because a lot of writing got this wrong

The 16.3 notes retired the *earlier* Skills — the ones that existed to carry current documentation into your project. That retirement was widely read as "Skills are gone." It was not. The guide is explicit that framework knowledge now comes from the bundled docs rather than from Skills, and gives the reason: always-available context beats on-demand retrieval. Then it says what Skills are for now:

> *"Skills cover the tasks that are workflows rather than lookups."*

That is the whole distinction, and it is a good one. A **lookup** is "what are the arguments to `revalidateTag`?" — a question the agent only asks if it already suspects it does not know. A **workflow** is "migrate this app to Cache Components" — twelve coordinated edits across route segments, data functions and config, in an order where getting step three wrong makes step seven fail somewhere unrelated. No amount of reference documentation makes that reliable, because the failure is not ignorance of an API; it is sequencing.

🔴 **Why the distinction is worth this much space:** a reader who believes Skills were withdrawn will hand-drive the Cache Components migration, and there is a published Skill for it. This corpus itself carried the wrong statement — [Appendix E](../19-appendices/05-appendix-e-version-watchlist.md) said "Withdrawn" until it was corrected on 2026-09-04.

## The four Skills, and what installing one actually gives you

They install per-Skill, from the framework's own repository:

```bash
npx skills add vercel/next.js --skill next-cache-components-adoption
```

They are browsable at `skills.sh/vercel/next.js` and live in the Next.js repository under `skills/`. The catalogue groups them under three headings — **runtime foundations**, **interactive workflows** and **unattended loops** — and four are shipped:

| Skill | The job it automates |
|---|---|
| `next-dev-loop` | The develop-and-verify cycle: run, read what broke, change one thing, re-verify — the loop [MCP](03-the-nextjs-devtools-mcp-server-exposing-build-diagnostics-an.md) makes cheap |
| `next-cache-components-adoption` | Turning Cache Components on in an app that was written without it |
| `next-cache-components-optimizer` | Tightening an app that has already adopted it — moving boundaries, widening what can be cached |
| `next-partial-prefetching-adoption` | Adopting partial prefetching across an existing route tree |

⚠️ **Two honest limits on that table.** The guide names the three headings and it names the four Skills; it does not publish a row-by-row mapping of which Skill sits under which heading, and I have not invented one. The "job" column is read off each Skill's name and the framework migration it is named after — treat it as orientation, and read the Skill's own description at `skills.sh` before you run it.

**The prerequisite that catches people is not the Skill, it is the feature.** `next-cache-components-adoption` can only do its work on a project where Cache Components is available to be turned on; a Skill is a scripted workflow, not a backport. Check the version floor of the underlying feature before you install the Skill that migrates to it, or the agent will spend a long session discovering it for you.

## Why bundled docs beat a lookup Skill — the mechanism, not the benchmark

The guide cites benchmarks. The mechanism underneath is more useful to hold, because it generalises to every tool you will ever build for an agent:

**A retrieval tool only fires when the agent decides it needs one.** An agent that confidently believes `next lint` still exists does not experience uncertainty about `next lint`, so it never reaches for the lookup. Retrieval fixes *known* unknowns. The failure mode that actually breaks a Next.js codebase — an agent writing 15-era App Router code against 16 with total confidence — is an *unknown* unknown, and the only intervention that touches it is putting the correct information in front of the agent before it forms the belief. That is what an `AGENTS.md` pointing at `node_modules/next/dist/docs/` does at session start.

Which is exactly why the workflow Skills survived the change and the lookup Skills did not: a workflow Skill is invoked deliberately, by name, for a task you already know you are doing. It never has to guess that it is needed.

## `agent-browser` — the part that sees what a DOM snapshot cannot

[`agent-browser`](https://github.com/vercel-labs/agent-browser) is a CLI that exposes the DOM, the console, the network and Web Vitals as structured text — the browser reduced to something an agent can actually read. It is a **`vercel-labs` project, not part of the `next` package**, so it arrives on its own release cadence and its own stability expectations. Budget for that when you put it in a team's standard toolchain.

The flag is the interesting part:

```bash
agent-browser open http://localhost:3000/board/1 --enable react-devtools
```

With React DevTools enabled it additionally reports the component tree **and which Suspense boundaries are still pending**.

🔴 **That second half is the whole reason to care.** A streamed page and a fully blocking page converge on the same DOM. Wait for the network to settle, snapshot the document, and the two are indistinguishable — same nodes, same text, same attributes. Every assertion an agent can write against a settled DOM passes equally well on the route you optimised and on the route that quietly lost its streaming boundary. Pending Suspense boundaries are the one observable that separates them, because they exist only in the window where the shell has rendered and the data has not arrived. An agent that cannot see them cannot tell you whether your streaming still works; it can only tell you the page eventually renders, which was never in doubt.

This is the same blind spot [page 06](06-honest-limits-where-agents-fail-in-app-router-codebases-cach.md) treats as a structural limit, and `--enable react-devtools` is the narrowest available fix for one slice of it.

## The fix-menu: three labels, and a framework that declines to choose

With Cache Components enabled, a blocking error does not print a single suggested fix. It prints a menu of labelled fixes, each making a different trade-off:

- **`[stream]`** — keep the data dynamic and put it behind a Suspense boundary, so the shell ships immediately and this part streams in.
- **`[cache]`** — make the data cacheable, so it becomes part of the prerendered shell.
- **`[block]`** — accept a blocking route, explicitly.

The third is a route segment config export:

```tsx
// app/dashboard/page.tsx
export const instant = false

export default async function DashboardPage() {
  const summary = await getAccountSummary()
  return <Summary data={summary} />
}
```

The menu is not confined to the browser overlay. It prints in the `next dev` terminal and in `next build` output too, which is what makes it reachable by an agent that has no browser at all — and by CI, which has no eyes.

**In the dev overlay the menu carries a `Copy prompt` button**: it packages the error, its location and the available fixes into text you paste straight into an agent. That is the smallest possible version of the whole idea in this chapter — the framework doing the context-assembly step that the human would otherwise do badly, by hand, from a stack trace.

### Why three options and no default is the right design

It would have been easy to auto-fix. Wrapping the offending subtree in Suspense is mechanical, and a codemod could do it. The framework does not, and the reason is worth internalising: **the three options are not three implementations of one decision, they are three different products.**

`[stream]` means the user sees a skeleton where that number should be. `[cache]` means the user may see a number that is thirty seconds old. `[block]` means the user sees nothing at all until the number is ready. Those are answers to a question about *this* screen and *this* data — is a stale balance acceptable, is a spinner acceptable, is a slower first paint acceptable — and nothing in the code says which. An agent asked to "fix the build error" will pick one, apply it uniformly, and be right by accident on some routes.

So the menu is a boundary marker: it is the framework identifying precisely the point where the decision stops being technical, and refusing to cross it. Read it as documentation of where your review attention belongs.

## When the error alone is not enough: `--debug-prerender`

A production build minifies server code, so a prerender failure can surface as a frame stack in code that no longer resembles anything you wrote — which defeats a human and defeats an agent completely, since the agent's next move is to search your source for a symbol that only exists after minification. The escape hatch:

```bash
next build --debug-prerender
```

It turns on server source maps and continues past the first failure instead of stopping there. Both halves matter for agent work: source maps make the error name a real file, and continuing past the first failure means one build yields the whole list rather than one item at a time. Ten sequential builds to discover ten errors is how a session's budget disappears.

The rest of the CLI surface — including the flags that scope a build to particular routes — is enumerated in [Appendix C part 3](../19-appendices/03c-appendix-c-the-cli-surface.md).

## Gotchas

### "Skills were withdrawn, so we do it by hand"
**Symptom.** A team hand-drives a Cache Components migration across forty routes, and the review that follows finds boundary placement inconsistent between the routes done on Monday and the routes done on Thursday.
**Cause.** The 16.3 notes retired the documentation-carrying Skills, and the summary that reached the team dropped the qualifier. Migration Skills shipped in the same release.
**Fix.** Install the one that matches the migration you are doing.

```bash
npx skills add vercel/next.js --skill next-cache-components-adoption
```

### Installing a Skill to give the agent framework knowledge
**Symptom.** Skills are installed, and the agent still writes App Router code with `15`-era assumptions in it.
**Cause.** Framework knowledge is not what Skills carry any more. It is carried by the version-matched docs inside your `node_modules`, reached through the managed `AGENTS.md` block — and if that block is missing, nothing points the agent at them.
**Fix.** Get the docs into context; the Skill is orthogonal.

```bash
# 16.3+: next dev writes and maintains the managed AGENTS.md block itself
next dev

# 16.1 and earlier: the docs are not bundled at all
npx @next/codemod@canary agents-md
```

### Letting the agent pick from the fix-menu
**Symptom.** The build is green and a product manager reports that a dashboard number is "sometimes yesterday's".
**Cause.** The agent applied `[cache]` because it was the smallest diff. Nothing in the codebase told it that this particular number must never be stale, so nothing stopped it.
**Fix.** Encode the policy where the agent will read it, in the `AGENTS.md` your project already has, so the choice is constrained rather than delegated.

```md
## Cache Components fix-menu policy
- Money, balances and permission checks: NEVER [cache]. Use [stream].
- Marketing and docs surfaces: prefer [cache].
- [block] requires a comment saying why streaming was unacceptable.
```

### Pasting the copied prompt with nothing around it
**Symptom.** The agent's proposed fix is correct in isolation and wrong for the route — a Suspense boundary landing around a subtree that was deliberately kept blocking.
**Cause.** The copied prompt carries the error and the options. It does not carry your product's answer to which trade-off is acceptable here, because the framework does not know it.
**Fix.** Paste the prompt and the constraint together — one sentence is enough: *"this figure is a live balance and must never be stale; choose accordingly."*

### Treating a settled DOM as evidence that streaming still works
**Symptom.** A refactor is reviewed, the assertions all pass, and page-load feel degrades in production with no test failing.
**Cause.** The route lost its streaming boundary. After settle, the DOM is byte-identical to the streamed version; every assertion written against the finished document passes.
**Fix.** Ask for the observable that only exists mid-stream.

```bash
agent-browser open http://localhost:3000/board/1 --enable react-devtools
```

If the report shows no pending Suspense boundaries on a route that is supposed to stream, the boundary is gone — regardless of what the final DOM looks like.

### Adding `agent-browser` to the toolchain as if it were part of `next`
**Symptom.** A CI job breaks after an unrelated dependency update, and nobody can find the change in the Next.js release notes.
**Cause.** `agent-browser` is a `vercel-labs` CLI on its own release cadence, not part of the `next` package. It does not inherit the framework's stability guarantees or its LTS window.
**Fix.** Pin it like any other third-party tool, and keep it out of the path that blocks a deploy.

### Hunting a minified symbol from a prerender failure
**Symptom.** The agent greps the codebase for a function name in the build error and finds nothing, then starts changing plausible-looking code.
**Cause.** Production builds minify server code, so the name in the trace was generated by the minifier and never existed in source.
**Fix.** Re-run with source maps on, and collect every failure in one pass rather than one per build.

```bash
next build --debug-prerender
```

### Assuming the fix-menu only exists in the browser
**Symptom.** A headless agent — no browser, CI-only — is written off as unable to act on Cache Components errors.
**Cause.** The overlay is the most visible surface, so it gets mistaken for the only one.
**Fix.** Read `next dev`'s terminal output or `next build`'s, where the same labelled menu prints. Only the `Copy prompt` button is overlay-specific; the content it copies is in the text stream.

### A Skill installed against a project below the feature's floor
**Symptom.** A long agent session ends having changed a great deal and achieved nothing that builds.
**Cause.** The Skill scripts a migration to a feature the installed version does not have. The Skill's own prerequisite is satisfied — it installed fine — while the framework's is not.
**Fix.** Check the feature's version floor before installing the Skill that adopts it, and upgrade first if it is not met.

## Interview questions

**★ Were first-party Next.js Skills withdrawn in 16.3?**
No, and the distinction is load-bearing. The Skills that existed to carry current documentation into a project were retired, because version-matched docs bundled inside `node_modules/next/dist/docs/` do that job without a retrieval step. Skills themselves were repositioned onto workflows rather than lookups, and four ship today — `next-dev-loop`, `next-cache-components-adoption`, `next-cache-components-optimizer` and `next-partial-prefetching-adoption`. Someone who read the change as "Skills are gone" will hand-drive migrations that are already scripted.

**★ Why are bundled docs a better delivery mechanism for framework knowledge than a retrieval Skill?**
Because retrieval only fires when the agent notices it needs something, and the expensive failure is the one where it does not notice. An agent that confidently believes `next lint` still exists feels no uncertainty about `next lint`, so it never invokes the lookup; it writes the wrong code at full confidence. Always-available context intervenes before the belief forms rather than after. The published benchmarks point the same way, but the mechanism is the part that transfers to any agent tooling you design.

**★ What does `--enable react-devtools` add to `agent-browser`, and why is it worth a flag?**
It reports the component tree and which Suspense boundaries are still pending. That is the only observable distinguishing a streamed page from a blocking one, because after the network settles both produce the same DOM. Without it an agent can confirm a page eventually renders — which was never the question — and cannot confirm that it still streams.

**★ The fix-menu offers `[stream]`, `[cache]` and `[block]`. Why doesn't the framework just apply one?**
Because they are three different products, not three implementations of one decision. `[stream]` shows a skeleton, `[cache]` may show a stale value, `[block]` shows nothing until the data is ready. Which is acceptable depends on what the data means to the user, and that fact is not in the code. The menu marks the exact point where the decision stops being technical — which makes it a useful signal for where a reviewer should look.

**★ What is `export const instant = false` and when would you write it?**
It is the route segment config behind the `[block]` option: an explicit statement that this route blocks rather than streams. You write it when both other options are genuinely wrong for the screen — the data cannot be stale and a partial render would be misleading rather than helpful. It is worth a comment saying which, because the next reader will otherwise assume it was the path of least resistance.

**★ Your agent has no browser. Can it act on Cache Components errors?**
Yes. The labelled menu prints in the `next dev` terminal and in `next build` output as well as the overlay. Only the `Copy prompt` button is overlay-specific, and it is a convenience over text the agent can already read. A headless agent in CI has the same information; what it lacks is the product judgment to choose between the options, which is true of the agent in the browser as well.

**★ What does `next build --debug-prerender` change, and why does it matter more for an agent than for you?**
It turns on server source maps and continues past the first failure. Both halves help an agent disproportionately. Minified server code makes an error name a symbol that does not exist in your source, and an agent's response to a name it cannot find is to start guessing at plausible code — a much worse failure than a human's, which is usually to stop. Continuing past the first failure collects the whole list in one build, where the alternative is one build per error and a budget spent on rebuilds.

**★ How would you stop an agent from silently choosing `[cache]` on a route where staleness is unacceptable?**
Write the policy into the file the agent reads at session start. The `AGENTS.md` your project already maintains is the natural home: name the categories of data where `[cache]` is never acceptable, name where it is preferred, and require a justifying comment for `[block]`. This converts a judgment call the agent is not equipped to make into a rule it can follow, which is the general shape of every good constraint you will give an agent.

**★ A Skill installs cleanly and then the migration goes nowhere. What is the usual cause?**
The Skill's prerequisite and the feature's prerequisite are different things. Installing `next-cache-components-adoption` succeeds regardless of what your project can support; the migration it scripts requires a version where Cache Components exists. Check the feature's floor before the Skill's, and upgrade first.

**Is `agent-browser` part of Next.js?**
No. It is a `vercel-labs` CLI, distributed and versioned separately from the `next` package, so it carries neither the framework's stability guarantees nor its LTS window. Useful, worth using, and worth pinning like any other third-party dependency rather than treating as framework surface.

**How does this page's material relate to the MCP server?**
They cover different surfaces of the same loop. [MCP](03-the-nextjs-devtools-mcp-server-exposing-build-diagnostics-an.md) answers questions about the running dev server — which routes exist, what is failing, which source function an action ID belongs to. `agent-browser` answers questions about the rendered page — the DOM, the console, the network, and with the DevTools flag, which boundaries are pending. The fix-menu is the framework volunteering a structured task rather than waiting to be asked. Skills package the multi-step workflows those three make verifiable.

---

← [The DevTools MCP server](03-the-nextjs-devtools-mcp-server-exposing-build-diagnostics-an.md) · [Chapter 14 overview](01-explanation.md) · Next → **Practical agent workflows: agent-authored migrations** *(not written yet)*
