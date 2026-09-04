---
title: "Agent infrastructure has moved the failure boundary from *the agent does not know Next.js 16* to *the agent does not know your product* — which is a much better place for it, and not the same as gone"
sidebar_label: "06b · What an agent cannot decide"
sidebar_position: 8
description: "The fix menu hands over options rather than a choice, an authorization check that proves the session and never the relationship, accessibility as behaviour rather than markup, the changed defaults with no diff to review — and exactly what bundled docs and MCP fix."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) (`lastUpdated: 2026-08-25`), [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`), [Enabling Next.js MCP Server for Coding Agents](https://nextjs.org/docs/app/guides/mcp) (`lastUpdated: 2026-07-08`) and the [production checklist](https://nextjs.org/docs/app/guides/production-checklist) (body dated `2026-03-10`).
> Target: **Next.js 16.3.4** · React 19.2.8. Documentation-verified; **no sandbox run, no timings**. Continues [06 · Honest limits: the silent failures](06-honest-limits-where-agents-fail-in-app-router-codebases-cach.md).

**[06](06-honest-limits-where-agents-fail-in-app-router-codebases-cach.md) covered failures the platform produces silently — a boundary that moved, a route that stopped streaming, a cache profile guessed into existence. Every one of those is, in principle, fixable with a better signal. This page is about the residue that is not, because the information an agent would need is not in the repository at all. It closes by drawing the line precisely: what bundled docs fix, what MCP fixes, and what is left over on the far side of both.**

## Four decisions an agent structurally cannot make

Not "makes badly" — cannot make, because the information required is not in the repository.

### 1 · The fix menu hands over options, not a choice

With Cache Components on, *"a blocking error presents labeled fixes, each making a different trade-off"*, and the dev overlay adds a **Copy prompt** button; the same menu prints in the `next dev` terminal and in `next build` output. The three labels are `[stream]`, `[cache]` and `[block]`, the last of which is *"Set `export const instant = false` to allow a blocking route"*.

All three clear the error. They mean entirely different things:

| Label | What it does | What you have decided |
|---|---|---|
| `[stream]` | wraps the offending scope in a boundary | the user sees a shell now and this content later |
| `[cache]` | marks the scope cached | this data may be stale, for some duration you must name |
| `[block]` | `export const instant = false` | this route is allowed to make the user wait |

The Copy prompt button is a genuinely good piece of design: it moves a well-formed problem statement into the agent's context in one click. It moves the **menu**. An agent handed three fixes and told to make the build pass will take the one with the smallest diff, and the smallest diff is frequently `[block]` — a one-line export that converts a performance property into a permanently disabled one, with a passing build as its receipt.

Note the asymmetry that makes this worse than it looks. `[stream]` and `[cache]` both leave something for a reviewer to react to — a new boundary, a named profile. `[block]` leaves a single export whose name reads like a setting rather than a decision, in a file the reviewer opened for another reason.

### 2 · Authorization: an agent can test the session and never the relationship

The checklist's instruction is unambiguous:

> *"Verify authentication and authorization inside each action. Do not rely on Proxy or layout or page level checks alone. Move database access to a `server-only` Data Access Layer and consider rate limiting for expensive operations."*

An agent follows this and produces something that satisfies every review heuristic:

```ts
export async function deleteCard(cardId: string) {
  const session = await auth()
  if (!session) throw new Error('Unauthorized')   // authentication ✅
  await db.card.delete({ where: { id: cardId } }) //  authorization ❌
}
```

Every action has a check. Every check is real. Not one of them asks whether **this** user has any relationship to **this** card. The distinction between *a user is signed in* and *this user may act on this row* is a fact about your domain model; it is not derivable from the action's signature, and no test that logs in as a valid user and passes a valid id will fail. This is the highest-severity item on the list, and it is the one that looks most finished. Chapter 10 carries the full treatment — [defense in depth](../10-forms-authentication-and-security-hardening/04-defense-in-depth-proxyts-as-a-coarse-filter.md) is where the coarse filter's limits are drawn.

The version-specific sharpening: the checklist explicitly says not to rely on Proxy or layout checks alone, and 16 renamed `middleware` to `proxy` with a runtime change attached — *"The `edge` runtime is **NOT** supported in `proxy`. The `proxy` runtime is `nodejs`, and it cannot be configured."* An agent migrating middleware to proxy has therefore changed the runtime of your coarse filter as a side effect of a rename, which is worth knowing before you decide how much that filter is carrying.

### 3 · Accessibility is behaviour under assistive technology, not markup

An agent can add ARIA attributes to every element in a component and make the result measurably worse — a redundant `aria-label` overriding good visible text, `role` attributes contradicting native semantics, a live region that announces on every keystroke. What it cannot do is operate the component with a screen reader and hear what happens.

There is a version-specific edge here worth knowing. The production checklist still advises *"Use the built-in `eslint-plugin-jsx-a11y` plugin"* — but `next lint` was removed in 16 and `next build` no longer runs the linter, so on a fresh 16 project that plugin is running only if you wired ESLint or Biome up yourself. The static half of a11y checking, weak as it was, is off by default and nothing announces it. Chapter 13's [linting page](../13-testing-and-developer-experience/13-linting-after-next-lint.md) covers restoring it.

What an agent *can* do here is real and worth using: it can hold the file conventions the checklist names — `app/global-error.tsx` for *"consistent, accessible fallback UI"* and `app/global-not-found.tsx` to *"serve an accessible 404 for unmatched routes"* — because those are structural facts with a checkable presence. The boundary is between the markup and the experience, and it is sharp.

### 4 · A changed default produces no diff to review

This is the class that defeats code review entirely, because there is no code.

16 changed `minimumCacheTTL` from `60` seconds to **4 hours**, cut `qualities` to `[75]` only (so *"a `quality` prop of 80, is coerced to 75"*), removed `16` from the default `imageSizes`, capped `maximumRedirects` at **3** from unlimited, and blocked local-IP optimization behind `images.dangerouslyAllowLocalIP`. It also *"removes the `size` and `First Load JS` metrics from the `next build` output"* — so a CI gate that parsed those numbers now passes because it finds nothing to compare.

A project that never set any of those options has **zero diff** across all of it. The agent did not change them; nobody changed them; the behaviour changed anyway. An agent reviewing its own migration reviews its patch, and the patch is silent here. The only artefact that carries this information is the upgrade guide's own list, which is why a migration review starts from [the guide's changed-defaults section](../19-appendices/02c-appendix-b-the-changes-nothing-catches.md) rather than from the diff.

## What context files actually fix, and where the line is

The mitigation story is real, and it is worth stating precisely so the limits are visible.

**Bundled docs fix knowledge staleness.** Next ships *"version-matched documentation inside the `next` package"* at `node_modules/next/dist/docs/`, and an `AGENTS.md` at the root *"directs agents to these bundled docs instead of their training data"*, with *"no network request or external lookup required."* Vercel's position is evidence-backed rather than aesthetic: *"Benchmark results on nextjs.org/evals show agents do better when they read the bundled docs."* On 16.3+, `next dev` generates the file when it detects an agent and no managed block; existing files are *"upserted, so content outside the managed block is preserved"*. On 16.2 the docs are bundled but the file is not generated; on 16.1 and earlier neither, and you run `npx @next/codemod@canary agents-md`.

**MCP fixes runtime blindness.** `get_errors` surfaces exactly the insights the HTTP response hides, which is the single most valuable thing in this chapter for the failure class in [06](06-honest-limits-where-agents-fail-in-app-router-codebases-cach.md). Note two limits recorded on [page 03](03-the-nextjs-devtools-mcp-server-exposing-build-diagnostics-an.md): `get_compilation_issues` and `compile_route` are **Turbopack only**, and the docs state no version-support policy for `next-devtools-mcp` itself, which is installed `@latest` and versioned separately from `next`.

**Neither fixes judgement, and the split is clean:**

> **The bundled docs answer *what does the framework do*. Your `AGENTS.md` answers *what has this repository decided*. Every failure on this page is a failure of the second kind.**

That is the actual content worth writing into the file, outside the managed block:

```md
## Decisions, not advice
- Routes that must stay instant: `/`, `/board/[id]`. If a change costs one its shell,
  stop and say so — do not reach for `export const instant = false`.
- Every Server Action checks the *relationship*, not just the session. A `session &&`
  guard alone is an incomplete action.
- Staleness is a product decision. Named profiles only; no invented `cacheLife` values.
- Out of scope by default: renames, dependency bumps, opportunistic refactors.
```

Two properties make that block work where a prompt would not. It is **re-read at the start of every session**, so it does not decay the way scope instructions decay over a long run. And it is **committed**, so it is reviewed, versioned, and argued about like any other statement of intent — which is what it is.

The honest summary of the whole chapter: agent infrastructure has moved the failure boundary from *the agent does not know Next.js 16* to *the agent does not know your product*. That is a much better place for it to be. It is not the same as gone.

## Gotchas

**The agent picked `export const instant = false` and called it fixed.**
*Symptom:* the fix menu's error is gone; the route now blocks.
*Cause:* `[block]` is the smallest diff of the three labelled fixes, and "make the build pass" rewards small diffs.
*Fix:* name the routes that must stay instant in `AGENTS.md`, so `[block]` on those is a stop-and-ask rather than an option.

**Every Server Action has an auth check and one user can delete another's data.**
*Symptom:* no test fails; authorization is present everywhere.
*Cause:* the check proves a session exists, never that this user has a relationship to the row.
*Fix:* assert ownership against the domain model in the action, and write the negative test — a valid session acting on someone else's id.

**A middleware-to-proxy migration silently changed your runtime.**
*Symptom:* the codemod ran cleanly and edge-specific behaviour is gone.
*Cause:* the `edge` runtime is not supported in `proxy`; the `proxy` runtime is `nodejs` and cannot be configured.
*Fix:* if the edge runtime was load-bearing, keep using `middleware`. Also rename `skipMiddlewareUrlNormalize` to `skipProxyUrlNormalize`, which the codemod handles and a hand-migration forgets.

**A component is covered in ARIA attributes and is harder to use than before.**
*Symptom:* an a11y audit tool is greener and the experience is worse.
*Cause:* an agent optimising for attribute presence — redundant labels overriding visible text, roles contradicting native semantics, a live region announcing every keystroke.
*Fix:* treat a11y as behaviour under assistive technology; the markup is evidence, not the property. Have a person operate it.

**Nothing has been linted since the upgrade.**
*Symptom:* lint violations accumulate with no failing check, a11y rules included.
*Cause:* `next lint` was removed in 16 and `next build` no longer runs the linter.
*Fix:* wire ESLint (flat config) or Biome up directly before migrating, so the migration diff is the thing being linted.
```bash
npx @next/codemod@canary next-lint-to-eslint-cli .
```

**Image quality settings are being silently coerced.**
*Symptom:* images look different after the upgrade with no code change.
*Cause:* `qualities` defaults to `[75]` only, so a `quality` prop of 80 is coerced to 75; `minimumCacheTTL` also moved from 60 seconds to 4 hours.
*Fix:* review changed defaults from the upgrade guide's list. There is no diff to find them in.

**A CI bundle-size gate has been passing since the upgrade and measuring nothing.**
*Symptom:* the gate is green and has been for every build since 16.
*Cause:* 16 removed `size` and `First Load JS` from `next build` output; a parser finds no numbers and reports no regression.
*Fix:* re-point the gate at an artefact that still exists, and treat "passing since the upgrade" as a failure signal in itself.

**An external image stopped loading after the upgrade and the config is unchanged.**
*Symptom:* a URL that worked in 15 now fails.
*Cause:* `maximumRedirects` went from unlimited to **3**, and local-IP optimization is blocked unless `images.dangerouslyAllowLocalIP` is set.
*Fix:* another zero-diff default change — count redirects on the failing URL before touching anything else.

**The agent's report says everything was verified.**
*Symptom:* a complete, confident summary with no gaps.
*Cause:* a summary of actions is generated from the transcript and always sounds complete; a coverage boundary requires reasoning about what was *not* done and goes missing unless asked for.
*Fix:* require a separate "could not verify" section, and treat its absence as making the whole report unverified.

**`AGENTS.md` keeps reappearing as an uncommitted change.**
*Symptom:* every diff opens with the same phantom modification.
*Cause:* the managed block is written and re-added by `next dev`.
*Fix:* commit it with your work. Removing it from a diff only re-creates it.

**Someone edited the managed block and their changes vanished.**
*Symptom:* careful edits to the agent rules disappear on the next `next dev`.
*Cause:* the block between the `BEGIN` and `END` markers is framework-managed and upserted; only content *outside* it is preserved.
*Fix:* put your repository's decisions outside the markers. If you want the generation off entirely, set `agentRules: false` — the docs' own position is that leaving it on is the better default, backed by their evals.

**The agent read docs for a version you are not running.**
*Symptom:* confidently wrong APIs — `unstable_cache`, `experimental_ppr`.
*Cause:* below 16.3 there is no auto-generated `AGENTS.md`, and at 16.1 and earlier the docs are not even bundled.
*Fix:* on 16.2, write the file yourself; on 16.1 and earlier run `npx @next/codemod@canary agents-md` to fetch a version-matched copy into `.next-docs/`.

**MCP tools are configured and two of them do nothing.**
*Symptom:* `get_compilation_issues` and `compile_route` are unavailable.
*Cause:* both are Turbopack-only.
*Fix:* expected on a `--webpack` build; do not debug the MCP configuration for it.

**A second `next dev` did not start and the agent gave up.**
*Symptom:* an agent reports the dev server as unavailable while one is running.
*Cause:* `next dev` writes its PID, port and URL to `.next/dev/lock`, and a second invocation prints the running server's URL and the PID to kill rather than starting a duplicate.
*Fix:* that output is the answer, not an error — the agent should connect to the existing server. Worth a line in `AGENTS.md` for agents that read the message as a failure.

## Interview questions

**★ The Copy prompt button puts the fix menu straight into the agent's context. What has it not solved?**
It has solved problem transfer, which is real — a well-formed error and three labelled fixes arrive in one click instead of being paraphrased by a human. It has not solved selection. `[stream]`, `[cache]` and `[block]` all clear the error and mean different things: show a shell now, accept staleness for some duration, or let the user wait. An agent told to make the build pass optimises for the smallest diff, and `[block]` — a one-line `export const instant = false` — usually wins. The choice is a product decision, so it has to be constrained in advance by naming the routes where `[block]` is not available.

**★ An agent added an authorization check to every Server Action. Why might the app still be insecure?**
Because a session check proves authentication, not authorization. `if (!session) throw` establishes that somebody is signed in; it never asks whether this user has any relationship to the row being acted on. Every action has a check, every check is real, and the review heuristic "does this action verify auth" returns true everywhere. The missing fact — which users may act on which rows — is a property of your domain model, not of the action's signature, and no test that signs in as a valid user and passes a valid id will fail. The test that catches it is the negative one: a valid session acting on someone else's id.

**★ Which class of upgrade regression is invisible to code review, and how do you review it instead?**
Changed defaults. A project that never set `minimumCacheTTL`, `qualities`, `imageSizes` or `maximumRedirects` has no diff for any of them, and 16 changed all four — plus removed `size` and `First Load JS` from the build output, which makes any CI gate parsing them pass vacuously. There is no patch to inspect because nobody wrote one. The only artefact that carries the information is the upgrade guide's own changed-defaults list, so that review starts from the guide and works towards the codebase, which is the opposite direction from every other review.

**★ Draw the line between what bundled docs fix and what they do not.**
Bundled docs make the agent's knowledge of the framework version-accurate: shipped inside the `next` package, read with no network request, and benchmarked as better than on-demand retrieval. That closes "the agent does not know Next.js 16", which was the dominant failure a year ago. It does not touch "the agent does not know your product" — how stale your data may be, which routes must stay instant, what your authorization model means, what is out of scope this week. Those belong in your own `AGENTS.md` content outside the managed block, and every failure worth writing a page about is now on that side of the line.

**★ Why is an `AGENTS.md` line stronger than the same sentence in a prompt?**
Two reasons, and neither is about wording. It is re-read at the start of every session, so it does not decay the way scope instructions decay over a long run — the constraint is as present at hour three as at minute one. And it is committed, so it is reviewed, versioned and disagreed with like any other statement of intent, which means the team's actual policy lives somewhere a person can find it rather than in one engineer's habit of typing it.

**★ Why is accessibility the hardest of the four for an agent, given how much a11y guidance exists in writing?**
Because the volume of guidance is exactly what makes it dangerous. A11y advice is highly patterned and easy to reproduce, so an agent generates plausible ARIA fluently — and the property being asserted is what a screen reader announces, which no amount of markup inspection reaches. Adding attributes can therefore move every static signal in the right direction while making the experience worse: a redundant label overriding good visible text, a role contradicting native semantics. It is the one item on the list where an agent's confidence and its competence point in opposite directions, and 16 removed the weak static backstop by dropping `next lint`.

**Two of the nine MCP tools are unavailable in your setup. What is the likely reason, and is it a bug?**
`get_compilation_issues` and `compile_route` are documented as Turbopack-only, so on a `--webpack` build they are simply absent. Not a bug and not a misconfiguration. Worth knowing before spending an afternoon on the `.mcp.json`, and worth recording in the repo's own notes, since the docs also state no version-support policy for `next-devtools-mcp` — it is installed `@latest` and versioned separately from `next`.

**Your CI bundle-size gate has passed every build since the 16 upgrade. Why is that bad news?**
Because 16 removed `size` and `First Load JS` from `next build` output as inaccurate in server-driven architectures, so a gate that parses them finds nothing and reports no regression. It is not passing; it is not measuring. An unbroken green streak starting exactly at an upgrade is a failure signal, and the general lesson is that a check whose input disappeared fails open — silently, and in the direction that looks like success.

**Someone proposes turning off `AGENTS.md` generation with `agentRules: false`. Make both cases.**
For: the file is generated into your repository by a dev command, the managed block's contents change between versions without your review, and a team that writes its own agent guidance may not want a framework-authored section it did not choose. Against, which is the documented position: the block is what points agents at version-matched bundled docs instead of training data, Vercel's evals show agents do better when they read them, and content outside the markers is preserved anyway — so the cost of leaving it on is one committed block and the benefit is the whole knowledge-staleness class. Turning it off is defensible only if you have replaced the pointer, not merely removed it.

**A colleague concludes from this page that agents should not be used on App Router codebases. Where does that argument break?**
At the comparison it never makes. Every failure here is a failure a human also makes — a guessed staleness tolerance, a boundary moved without noticing, an auth check that proves the session, a changed default nobody read the release notes for. What differs is throughput and attribution: an agent produces more of them per hour, and does so in a session where the reasoning is not recoverable afterwards. That argues for the guardrails, the assertion-first loop and the written-down decisions, not for abstention. The right reading of the page is that the residue is small, specific and enumerable — which is what makes it manageable.

---

← [Honest limits: the silent failures](06-honest-limits-where-agents-fail-in-app-router-codebases-cach.md) · [Chapter 14 overview](01-explanation.md) · Next → [Project milestone: SprintDesk gets an `AGENTS.md`](07-project-milestone-sprintdesk-gets-an-agentsmd.md)
