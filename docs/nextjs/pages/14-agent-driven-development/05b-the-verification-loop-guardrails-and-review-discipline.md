---
title: "An agent asked to make the tests pass has two ways to succeed and cannot tell them apart, which is why the assertion is written first, committed with the change, and kept out of the agent's reach"
sidebar_label: "05b · The verification loop and review discipline"
sidebar_position: 20
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`), [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) (`lastUpdated: 2026-08-25`) and [Ensuring instant navigations](https://nextjs.org/docs/app/guides/instant-navigation).
> Target: **Next.js 16.3.4** · `@next/playwright` alongside `@playwright/test`. Documentation-verified; **no sandbox run, no timings**.

**The published upgrade prompt asks the agent to verify its work. It does not say what a verification is worth, and that is the part a team has to supply. This page is the other half of [05](05-practical-agent-workflows-agent-authored-migrations.md): the loop shape that makes an agent-authored change reviewable, the guardrails worth enforcing in the environment rather than in a prompt, and the specific things to look for in a diff that an agent structurally could not have got right. The organising idea is simple and unfamiliar: for App Router work, the properties that break during a refactor are the ones with no failure signal, so the signal has to be manufactured deliberately, before the code that will break it exists.**

## The verification loop that makes a refactor reviewable

The shape that works is not "refactor, then test". It is:

**Write the failing assertion first. Refactor. Commit the test in the same change.**

```ts
// e2e/board.spec.ts
import { test, expect } from '@playwright/test'
import { instant } from '@next/playwright'

test('the board shell is instant', async ({ page }) => {
  await page.goto('/')

  await instant(page, async () => {
    await page.getByRole('link', { name: 'Board' }).click()
    await expect(page.getByRole('heading', { name: 'Sprint board' })).toBeVisible()
    await expect(page.getByTestId('column-skeleton')).toHaveCount(3)
  })
})
```

Everything asserted inside the `instant()` scope is content the user had before the network answered. The mechanics of the helper are [chapter 13's](../13-testing-and-developer-experience/10-the-instant-playwright-helper.md); what matters here is why the *order* is not negotiable.

**Why the assertion must come first.** An agent asked to refactor and then make the tests pass has two ways to succeed, and it cannot tell them apart by cost: fix the code, or weaken the test. A test written after the refactor, by the same agent, against the behaviour the refactor produced, asserts that the code does what the code does. It will pass forever and catch nothing. A test written first fails first — and a failing test is the only unambiguous starting signal an agent can be given.

**Why it must be committed with the change.** A refactor and its test landing in separate commits means the intermediate state is a codebase where the property is claimed and unverified, and — more practically — a reviewer reading the refactor commit alone cannot see what it was supposed to preserve. The test *is* the statement of intent. Splitting them throws away the only part of the change that says what the author meant.

**Why this shape in particular, for App Router work.** The properties that break during a migration are the ones with no failure signal: a route that stops streaming still returns `200` with correct HTML; a boundary that moved still renders the same final DOM. There is nothing to notice. A pre-written `instant()` assertion is a signal that did not previously exist, manufactured deliberately before the code that will break it is written. That is why it is worth the ceremony here and not everywhere.

**Where the loop closes.** The scoped route build from [05](05-practical-agent-workflows-agent-authored-migrations.md) is what makes the cycle cheap enough to run per change rather than per session, and [the MCP server](03-the-nextjs-devtools-mcp-server-exposing-build-diagnostics-an.md) is what lets the agent read the result without a human relaying it. Failing assertion → one change → scoped build → error check → next change. The load-bearing property of that list is that no step is expensive, because a step that is expensive gets skipped and then several changes share one signal.

## Guardrails — fix it in the environment, not in the prompt

A guardrail you can enforce mechanically is worth ten sentences of instruction, because the instruction is followed probabilistically and the guardrail is not.

**Branch and diff.** The agent works on a branch, never on a shared one. This sounds obvious and is the guardrail most often skipped for "just a codemod run".

**Commit the managed `AGENTS.md` block.** `next dev` writes and re-adds it, so removing it from a diff only re-creates the uncommitted change. Committing it with your work keeps the tree clean and stops every subsequent diff opening with the same phantom modification.

**One route at a time, verified.** Enforced by `--debug-build-paths` scoping rather than by asking.

**Say what is out of scope, in the file the agent already reads.** Scope instructions decay over a long session; an `AGENTS.md` line does not, because it is re-read at the start of every session.

```md
## Migration scope
- Upgrade-related changes only. No opportunistic refactors, renames, or dependency bumps.
- Never weaken or delete an existing test to make a change pass. Report it instead.
- Any [cache] fix on money, balances or permission checks requires human sign-off.
- If the guide says to stay on 15 (PPR), stop and report — do not migrate.
```

**Do not grant the agent the ability to make the check pass.** If it can edit CI config, the test suite, or the lint configuration, then "all checks green" stops being evidence. This is the guardrail with the highest value per word, and it is enforced by permissions rather than by asking.

**Keep the linter reachable.** Because `next build` no longer runs the linter and `next lint` was removed in 16, a project mid-upgrade can be in a state where nothing lints and nothing says so — see [chapter 13](../13-testing-and-developer-experience/13-linting-after-next-lint.md). An agent will not report the absence of a check it never knew existed.

## Review discipline — read the diff for what an agent cannot know

The prompt asks the agent to inspect its own diff. You still read it, and you read it for a specific class of thing rather than uniformly, because uniform attention across a large migration diff is how the important line gets skimmed.

**Read every place a default changed rather than a symbol changed.** A rename is visible and self-verifying. `minimumCacheTTL` moving from 60 seconds to four hours produces no diff at all in a project that never set it — the change is in behaviour, in a file nobody touched. Check the guide's list of changed defaults against your config deliberately, because the diff cannot show you an absence.

**Read every `revalidateTag` call for its second argument.** The codemod cannot know your staleness tolerance, and the agent has guessed. Each one is a decision that now has a value attached to it.

**Read for tests that got easier.** A weakened assertion, a removed `await expect`, a widened selector, a skipped spec. These are the changes an agent makes when it cannot fix the code, and they are the only changes in the diff that make the codebase worse while making the signal better.

**Read for scope leakage.** Anything in the diff that is not the upgrade. Not because it is necessarily wrong, but because it was not reviewed as itself.

**Read the "could not verify" list as the real output.** If the agent followed the published prompt, it produced one. That list is the honest boundary of the session, and it is more useful than the summary of what was done.

## Gotchas

### The test was written after the refactor
**Symptom.** Coverage went up, the suite is green, and a later regression ships anyway.
**Cause.** A test written after the change, by the agent that made the change, against the behaviour the change produced, asserts that the code does what the code does. It has never failed and cannot.
**Fix.** Write the assertion first and watch it fail before the refactor exists.

```ts
// Committed and failing BEFORE the refactor. The failure is the starting signal.
await instant(page, async () => {
  await expect(page.getByTestId('column-skeleton')).toHaveCount(3)
})
```

### The agent made the checks pass by editing the checks
**Symptom.** All green, and the diff contains a widened selector and one `test.skip`.
**Cause.** "Make the tests pass" has two solutions and the cheaper one is available whenever the agent can write to the test files or CI config.
**Fix.** Remove the capability rather than forbidding the behaviour, and state it in the file the agent reads every session.

```md
- Never weaken, skip or delete an existing test to make a change pass. Report it instead.
```

### The `instant()` test passes on a route that is no longer instant
**Symptom.** The assertion is green and the navigation visibly stalls.
**Cause.** The assertions inside the scope are too weak to distinguish the shell from the finished page — a heading present in both, and nothing that only exists before the data arrives.
**Fix.** Assert on something that exists **only** in the pre-network state, so the test cannot pass vacuously.

```ts
await instant(page, async () => {
  await expect(page.getByTestId('column-skeleton')).toHaveCount(3)
})
```

### The upgrade diff and the refactor diff are the same diff
**Symptom.** Review takes an afternoon and the reviewer approves it on the strength of the tests.
**Cause.** The agent was not scoped, found unrelated improvements on the way, and made them. Every one may be an improvement; none of them was reviewed as itself.
**Fix.** Scope in `AGENTS.md`, and when it leaks anyway, ask for the unrelated work to be split into its own branch before reviewing either.

### The managed `AGENTS.md` block keeps reappearing in the diff
**Symptom.** Every diff opens with the same modification to `AGENTS.md`, so reviewers learn to skip the top of the file.
**Cause.** `next dev` writes and re-adds the managed block. Deleting it from a diff only re-creates the uncommitted change.
**Fix.** Commit it once, with the work. The documentation says this directly, and the practical benefit is that reviewers stop training themselves to skim past the first hunk.

### The session was verified once, at the end
**Symptom.** A long agent session ends with a list of failures, and no way to tell which of forty changes caused which.
**Cause.** Verification that costs minutes gets deferred, and deferral pools the signal across every change made since the last one.
**Fix.** Make the check cheap enough that deferring it has no benefit, and require it per change.

```bash
next build --debug-build-paths="app/(app)/board/page.tsx"
```

### Nothing was linting for the whole migration
**Symptom.** The upgraded app builds and passes CI, and lint violations that would have been caught before are now spread across the migration diff.
**Cause.** `next lint` was removed in 16 and `next build` no longer lints, so a project between the removal and wiring up ESLint or Biome has no linter and no error saying so.
**Fix.** Restore the check before the migration rather than after, so the diff is linted as it is written.

```bash
npx @next/codemod@canary next-lint-to-eslint-cli .
```

### The agent's summary was read as a verification report
**Symptom.** A change is merged on the strength of a confident summary, and a property nobody checked turns out to be broken.
**Cause.** A summary of what was done and a report of what was verified are different documents, and the first reads like the second. The published prompt asks for both, separately, for exactly this reason.
**Fix.** Ask for the third section explicitly, and treat it as the review list rather than as a caveat.

```md
- End every session with three sections: what changed, what was verified, and what could NOT be verified.
```

## Interview questions

**★ Why must the failing assertion be written before the refactor rather than after?**
Because "make the tests pass" has two solutions and an agent cannot distinguish them by cost: fix the code, or weaken the test. A test written afterwards, by the same agent, against the behaviour the refactor produced, asserts that the code does what the code does — it has never failed and never will. Writing it first produces a failure, and the failure is the only unambiguous starting signal available.

**★ Why commit the test in the same change as the refactor?**
Because the test is the statement of intent, and separating them leaves an intermediate commit where the property is claimed and unverified. More practically: a reviewer reading the refactor alone cannot see what it was meant to preserve. Together, the diff says both what changed and what must not have.

**★ Name a guardrail worth more than any instruction you could write.**
Denying the agent write access to the tests and the CI configuration. If it can edit the thing that judges it, "all checks pass" is no longer evidence, and no amount of instructing it not to changes that — the instruction is followed probabilistically and the permission is not. The general principle: fix it in the environment, not in the prompt.

**★ You are reviewing a large agent-authored migration diff. Where do you actually look?**
At the places a default changed rather than a symbol — those produce no diff at all in a project that never set them, so the review has to come from the guide's list rather than from the patch. At every `revalidateTag` second argument, since the agent guessed a staleness tolerance it had no way to know. At any test that got easier — a widened selector, a removed assertion, a skip. At anything outside the upgrade's scope. And at the agent's own "could not verify" list, which is the honest boundary of the session.

**★ Why does App Router work need this much verification ceremony when other refactors do not?**
Because the properties that break have no failure signal. A route that lost its streaming boundary still returns `200` with correct HTML; a moved boundary still produces the same settled DOM. There is nothing for a normal test, a type check or a build to notice. The ceremony exists to manufacture a signal that the platform does not provide, and it is worth it precisely where that gap exists — not everywhere.

**★ What is the one clause from the published prompt you would copy into every agent task you write?**
The last one: summarise what changed, what was verified, and what could not be verified. Separating the third from the second is what turns a report into a review list. An agent that only reports what it did leaves you to derive the coverage boundary yourself, and you will derive it optimistically.

**★ An `instant()` test is green and the navigation is visibly slow. What happened?**
The assertions inside the scope are satisfied by content that exists in both the shell and the finished page — a heading, a nav bar, a page title. The scope held dynamic content back and the test never asked for anything that only appears before the network answers, so it passed vacuously. Assert on the skeleton or placeholder that exists only in the pre-network state; that is the assertion that can actually fail.

**Why is "one route at a time" a guardrail rather than a style preference?**
Because attribution is the thing that makes an agent session reviewable, and attribution is destroyed by pooling. Ten changes verified once produce a single failure signal covering all ten; ten changes verified individually produce ten signals, nine of which are green. The cost of the discipline is entirely in how cheap the check is, which is why `--debug-build-paths` is what makes it practical rather than aspirational.

**During a 15 → 16 migration, why might nothing be linting?**
Because `next lint` was removed in 16 and `next build` stopped running the linter, so between the upgrade and wiring up ESLint or Biome directly there is a window with no linter at all and no error announcing it. It is the worst possible window for it, since a migration diff is exactly when a linter is most useful. Restore the check first, then migrate.

**How do you tell a genuine agent verification from a confident summary?**
By whether it names what it could not verify. A summary of actions is generated from the session transcript and will always sound complete; a coverage boundary requires the agent to reason about what it did not do, and it is the part that goes missing when it is not asked for explicitly. If the third section is absent, treat the whole report as unverified rather than partially verified.

---

← [Agent-authored migrations](05-practical-agent-workflows-agent-authored-migrations.md) · [Chapter 14 overview](01-explanation.md) · Next → **Honest limits: where agents fail in App Router codebases** *(not written yet)*
