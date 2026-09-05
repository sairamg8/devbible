---
title: "Give SprintDesk an `AGENTS.md`, connect the diagnostics, and run exactly one agent-executed refactor through human review — because a context file you have never tested against a real change is a document, not infrastructure"
sidebar_label: "07 · Milestone: SprintDesk gets an `AGENTS.md`"
sidebar_position: 9
description: "The chapter 14 milestone: the managed block and the half of the file you own, a repository context map made of decisions rather than advice, MCP wired to the dev server, and one scoped refactor with a failing assertion written first — with acceptance criteria you can tick off."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against the sources named on the chunks this milestone assembles — [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) (`lastUpdated: 2026-08-25`), [Enabling Next.js MCP Server for Coding Agents](https://nextjs.org/docs/app/guides/mcp) (`lastUpdated: 2026-07-08`), [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`) and the [production checklist](https://nextjs.org/docs/app/guides/production-checklist).
> Target: **Next.js 16.3.4** · React 19.2.8. Documentation-verified, **no sandbox run**, no timings — the acceptance criteria below are checks *you* run, not results reproduced here.

**Every previous chunk in this chapter is a mechanism in isolation: a file convention, a diagnostics protocol, a workflow, a list of limits. This milestone is where they meet, and it insists on *one* refactor rather than a programme of them for the same reason chapter 17's milestone insists on two deployments — a single exercise run end to end tells you which parts of your setup are real. A context file that has never been tested against a change is a document. The refactor is what turns it into infrastructure, because it is the only step that can fail.**

## Scope

| In scope | Out of scope, and where it lands |
|---|---|
| An `AGENTS.md` with the managed block committed | — |
| A repository context map made of **decisions**, not advice | — |
| `.mcp.json` wired to the running dev server | — |
| One scoped, agent-executed refactor with a failing assertion written first | — |
| A review pass that looks at the four things a diff cannot show | — |
| Acceptance criteria you can tick off | — |
| What `AGENTS.md` is and why the framework generates it | [02 · `AGENTS.md` and context maps](02-agentsmd-and-repository-context-maps-version-matched-bundled.md) |
| The nine MCP tools in detail | [03 · The DevTools MCP server](03-the-nextjs-devtools-mcp-server-exposing-build-diagnostics-an.md) |
| Skills, `agent-browser`, the fix menu | [04 · Skills, agent-browser and fix-menus](04-163-preview-first-party-skills-for-multi-step-workflows.md) |
| A whole 15 → 16 migration | [05 · Agent-authored migrations](05-practical-agent-workflows-agent-authored-migrations.md) |
| The verification loop and guardrails | [05b · The verification loop](05b-the-verification-loop-guardrails-and-review-discipline.md) |
| What none of this reaches | [06](06-honest-limits-where-agents-fail-in-app-router-codebases-cach.md) · [06b](06b-what-an-agent-cannot-decide-and-what-context-files-fix.md) |
| Writing the tests this milestone assumes | [chapter 13 · testing and DX](../13-testing-and-developer-experience/01-explanation.md) |
| The authorization model the context map asserts | [chapter 10 · forms, auth and security](../10-forms-authentication-and-security-hardening/01-explanation.md) |

## Step 1 — the managed block, and the half of the file you own

On 16.3 or later this is not something you write. Run `next dev` with an agent detected in the environment and no managed block present, and Next.js generates `AGENTS.md` and `CLAUDE.md` at the project root; an existing file is *"upserted, so content outside the managed block is preserved"*. `CLAUDE.md` is generated as the single line `@AGENTS.md`.

Two facts decide how you treat the result:

- The block between `<!-- BEGIN:nextjs-agent-rules -->` and `<!-- END:nextjs-agent-rules -->` is **framework-owned**. Editing inside it is editing a generated file. It opens `# This is NOT the Next.js you know`, which tells you what it is for: it exists to stop an agent applying a pre-16 mental model.
- Everything **outside** the markers is yours and survives regeneration.

Commit the whole file, block included. It is re-added by `next dev`, so leaving it uncommitted means every diff from now on opens with the same phantom modification.

If SprintDesk is not on 16.3 yet, the milestone still works with one extra step:

| Version | What you get | What you do |
|---|---|---|
| **16.3+** | docs bundled, `AGENTS.md` auto-generated | nothing — run `next dev` |
| **16.2** | docs bundled, no auto-generation | write the pointer to `node_modules/next/dist/docs/` yourself |
| **≤ 16.1** | neither | `npx @next/codemod@canary agents-md` — downloads a version-matched copy to `.next-docs/` |

## Step 2 — the repository context map

This is the part that makes or breaks the milestone, and the failure mode is writing advice. Advice is what the bundled docs already carry, better than you will restate it. What they cannot carry is **what this repository has decided**, and that is the entire value of your half of the file.

The test for every line: *could an agent have derived this from the code and the framework docs?* If yes, delete it. If no, it belongs here.

```md
# SprintDesk

## Architecture facts
- App Router, Cache Components on. Data access goes through `lib/dal/*`, which is
  `server-only`. No component imports the database client directly.
- Route groups: `(marketing)` is fully static. `(app)` is authenticated and per-user.

## Decisions, not advice
- Routes that must stay instant: `/`, `/board/[id]`. If a change costs one its shell,
  stop and say so. Do not reach for `export const instant = false`.
- `cacheLife` profiles in use: `minutes` (board lists), `hours` (public marketing),
  `max` (the glossary). Do not invent a profile; if none fits, stop and ask.
- Inside a Server Action, a tag the same request reads back uses `updateTag`.
  `revalidateTag` is for tags read by a later request, and always with a profile.
- Every Server Action checks the *relationship*, not just the session. A `session &&`
  guard alone is an incomplete action.
- Request-time APIs (`cookies()`, `headers()`, `searchParams`) do not go in shared
  layouts. If one is needed, it goes behind a `<Suspense>` boundary in the leaf.

## Scope
- Out of scope by default: renames, dependency bumps, opportunistic refactors.
- Report what changed, what was verified, and separately what could **not** be verified.
```

Twenty-odd lines, and every one of them is a fact no agent could have inferred. Notice what the list is made of: it is the failure inventory from [06](06-honest-limits-where-agents-fail-in-app-router-codebases-cach.md) and [06b](06b-what-an-agent-cannot-decide-and-what-context-files-fix.md), turned around and stated as policy. That is the honest way to write one of these — not by imagining what an agent might need, but by writing down the decisions you already know it cannot make.

## Step 3 — connect the diagnostics

`.mcp.json` at the project root, exactly as documented:

```json
{
  "mcpServers": {
    "next-devtools": {
      "command": "npx",
      "args": ["-y", "next-devtools-mcp@latest"]
    }
  }
}
```

Start the dev server and the package *"will automatically discover and connect to your running Next.js instance"* through the built-in endpoint at `/_next/mcp`. Two operational notes worth having in the repo's own notes rather than rediscovering: `get_compilation_issues` and `compile_route` are **Turbopack only**, and `next dev` writes its PID, port and URL to `.next/dev/lock`, so a second `next dev` prints the running server's URL and the PID to kill rather than starting a duplicate — which is information, not an error.

Prove the connection before you rely on it. Ask the agent for `get_routes` and check the answer against the filesystem yourself. A misconfigured MCP server does not announce itself; it just leaves the agent working blind, which looks identical to it working fine right up until the failure that only `get_errors` would have shown.

## Step 4 — one refactor, and the review that follows it

Pick something small, real, and inside the boundary the context map describes. A good candidate for SprintDesk: **move the board's per-user column ordering out of a shared layout and behind a boundary in the leaf**, which is exactly the class of change that de-optimises a route silently.

The order is not negotiable, and [05b](05b-the-verification-loop-guardrails-and-review-discipline.md) has the argument:

1. **Write the failing assertion first**, and commit it in the same change as the refactor. An `instant()` test asserting the board shell and its three column skeletons — content that exists only before the network answers.
2. **Branch.** Never a shared one, however small the change.
3. **Scope the build.** One route at a time, verified, using `--debug-build-paths`, so a failure is attributable to a change rather than to a session.
4. **Let the agent read its own results** through `get_errors` rather than having a human relay them.
5. **Require the three-part report**: what changed, what was verified, and — separately — what could not be verified.

Then review, and review the four things the diff cannot show you:

| Look at | Because |
|---|---|
| Every `revalidateTag` second argument | the profile is a guessed product decision the type system waved through |
| Route classification, before and after | a moved boundary produces an identical settled DOM |
| Any test that got *easier* | a widened selector or a removed assertion is a passing suite that stopped checking |
| The "could not verify" list | it is the only honest statement of the session's coverage boundary |

## Acceptance criteria

Tick these off. Each one is a check you run, not a claim this page makes.

- [ ] `AGENTS.md` exists at the project root with the managed block present, and it is **committed** — `git status` is clean after `next dev` runs.
- [ ] `CLAUDE.md` exists and contains the single line `@AGENTS.md`.
- [ ] The content **outside** the managed block survives a `next dev` restart unchanged.
- [ ] Every line of your section fails the derivability test — none of it could have come from the code or the framework docs.
- [ ] The context map names the routes that must stay instant, the `cacheLife` profiles that exist, the `updateTag`-versus-`revalidateTag` rule, the authorization rule, and what is out of scope.
- [ ] `.mcp.json` is committed and the agent can answer a `get_routes` request whose output you have checked against the filesystem yourself.
- [ ] A failing `instant()` assertion existed **before** the refactor and is in the same commit as it.
- [ ] The refactor ran on a branch, scoped to one route with `--debug-build-paths`.
- [ ] The route's classification is what you expected **after** the change — read from the build output, not inferred from the page looking right.
- [ ] `get_errors` is clean for the affected route, checked directly and not taken from the agent's summary.
- [ ] The agent's report has a **separate** "could not verify" section. If it does not, the whole report counts as unverified.
- [ ] The diff contains no `export const instant = false` on a route the context map protects.
- [ ] No test in the diff got easier.
- [ ] A linter is actually running — `next lint` is gone in 16 and `next build` no longer lints, so if you have not wired ESLint or Biome up, nothing has been linted since the upgrade.

## Gotchas

**The milestone is "done" and the context file has never been tested.**
*Symptom:* a careful `AGENTS.md`, no refactor run through it.
*Cause:* writing the file is the satisfying part; the refactor is the part that can fail.
*Fix:* the refactor is not optional. It is the only step that produces evidence, and a rule nobody has tried is a guess about your own codebase.

**Your half of the file is full of things the docs already say.**
*Symptom:* a long `AGENTS.md` that reads like a Next.js tutorial.
*Cause:* writing advice instead of decisions.
*Fix:* apply the derivability test line by line — if an agent could have got it from the code or the bundled docs, delete it. Length is not the goal; underivability is.

**Edits inside the managed block keep disappearing.**
*Symptom:* careful changes to the agent rules vanish on the next `next dev`.
*Cause:* the block between the markers is framework-managed and upserted.
*Fix:* everything of yours goes outside the markers.

**`AGENTS.md` shows up modified in every diff.**
*Symptom:* a permanent phantom change at the top of every review.
*Cause:* the block is re-added by `next dev` and was never committed.
*Fix:* commit it. Removing it from a diff only re-creates it.

**MCP is configured and the agent is still guessing.**
*Symptom:* answers that do not match the project.
*Cause:* the server never connected, and nothing says so.
*Fix:* verify with a `get_routes` call you check by hand before trusting anything downstream.

**The agent reports the dev server as unavailable while it is running.**
*Symptom:* a second `next dev` prints a URL and a PID and the agent treats it as an error.
*Cause:* the lockfile at `.next/dev/lock` deliberately prevents duplicates.
*Fix:* say so in `AGENTS.md` — connect to the existing server rather than starting one.

**The refactor is green and the route lost its shell.**
*Symptom:* passing tests, `200`, correct HTML, worse navigation.
*Cause:* the `instant()` assertion was written after the change, so it asserts the behaviour the change produced.
*Fix:* the assertion comes first and fails first. A test written afterwards by the same agent asserts that the code does what the code does.

**Acceptance is checked from the agent's summary rather than from the tools.**
*Symptom:* every box ticks and something is still wrong.
*Cause:* a session summary is generated from the transcript and always sounds complete.
*Fix:* each criterion above is a command you run. The report is an input to the review, not the review.

**The refactor grew.**
*Symptom:* a rename or a dependency bump rode along with the change.
*Cause:* nothing in the environment said not to, and scope instructions in a prompt decay over a long session.
*Fix:* the out-of-scope line lives in `AGENTS.md`, which is re-read at the start of every session, rather than in the prompt.

## Interview questions

**★ Why does this milestone insist on running one refactor rather than just producing the context file?**
Because the file is unfalsifiable until something is run through it. Writing rules feels like the work and produces no evidence: you cannot tell a rule that will constrain an agent from one that reads well, and you cannot tell a context map that describes your architecture from one that describes the architecture you think you have. The refactor is the only step with a failure mode, so it is the only step that can teach you anything — and the specific thing it teaches is which of your decisions you had never actually written down.

**★ What is the test for whether a line belongs in your half of `AGENTS.md`?**
Whether an agent could have derived it from the code and the framework docs. Everything derivable is either already true in the repository or already in the bundled version-matched documentation, and restating it costs context for no gain. What survives the test is the underivable: how stale each kind of data may be, which routes must keep their shell, what your authorization model actually means, what is out of scope this week. Those are decisions, and decisions are the only thing the file is for.

**★ Why commit the managed block instead of keeping the file clean?**
Because `next dev` re-adds it, so "clean" is not an available state — removing it from a diff only re-creates the uncommitted change, and every subsequent review opens with the same phantom modification that reviewers learn to scroll past. Committing it also makes its content reviewable when it changes between versions, which matters because it is the thing steering agents away from a pre-16 mental model.

**★ Your acceptance list says to check the route classification rather than that the page works. Why?**
Because "the page works" is true in every failing case this chapter documents. A route that lost its static shell returns `200` with correct HTML and an identical settled DOM; a boundary moved the wrong way changes nothing observable in the response. The classification in the build output is the artefact that distinguishes the before and after states, which makes it the only acceptance check that can fail for the right reason.

**How would you adapt this milestone for a repository that is not on 16.3?**
The context map and the refactor are unchanged; only the pointer step differs. On 16.2 the version-matched docs are bundled but nothing generates the file, so you write the pointer to `node_modules/next/dist/docs/` yourself. On 16.1 and earlier the docs are not bundled at all, so `npx @next/codemod@canary agents-md` downloads a version-matched copy into `.next-docs/` and you point at that. Skipping the step entirely is the one variant that does not work, because the whole value of the file is redirecting the agent off its training data.

**Why is "no test in the diff got easier" on an acceptance list rather than in a code review guideline?**
Because it is the specific way an agent-authored change fails invisibly. An agent asked to refactor and make the tests pass has two routes to success and no way to price them against each other; weakening a selector or dropping an assertion is smaller than fixing the code, and the suite is green either way. A reviewer scanning a large diff sees green and moves on. Making it a checklist line forces someone to look at the test changes specifically, which is the only place that failure is visible.

**What does this milestone deliberately not attempt, and why?**
A whole migration. That is page 05's exercise, and the reason for separating them is attribution: a migration produces many changes sharing one verification signal, so when something is wrong afterwards you cannot say which change did it or whether your context file helped. One scoped refactor gives you a clean read on whether the setup works. The milestone's ambition is deliberately small because its output is a judgement about your own infrastructure, not a body of changed code.

---

← [What an agent cannot decide](06b-what-an-agent-cannot-decide-and-what-context-files-fix.md) · [Chapter 14 overview](01-explanation.md) · Next → [Chapter 15 · Databases, APIs and full-stack patterns](../15-databases-apis-and-full-stack-patterns/01-explanation.md)
