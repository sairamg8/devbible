---
title: "Vercel now publishes the prompt for its own major-version upgrade, which tells you exactly which parts of a migration are mechanical — and the codemods tell you which parts are not"
sidebar_label: "05 · Agent-authored migrations"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`) and [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** · upgrade path **15 → 16**. Documentation-verified; **no sandbox run, no timings**.

**The 15 → 16 upgrade guide opens with a section headed "Use an AI agent (recommended)" and then prints a prompt to hand your agent. That is a remarkable thing for a framework to publish, and it is worth reading as a design document rather than as a convenience: by writing the prompt themselves, the maintainers have declared which parts of their own migration they believe an agent can be trusted with, which parts they want it to stop and ask about, and what "done" means. This page is the migration half — the prompt, the codemods, and the gap between what they cover and what they leave for a person to decide. The half that makes the result reviewable is [05b](05b-the-verification-loop-guardrails-and-review-discipline.md).**

## The published prompt, and what its shape tells you

The prompt is on the [upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) and you should paste it from there rather than from anywhere else, since it will track the guide. What is worth studying is its structure — it is a much better example of instructing an agent than most teams write for themselves, and every clause is doing a job:

**It establishes grounding before it permits editing.** The first instruction is not about the upgrade at all: it tells the agent to confirm that `AGENTS.md` points at version-matched docs, and to fix that first if it does not. Nothing else in the prompt is safe until this holds, because an ungrounded agent migrating to 16 writes 15-era code with total confidence — the failure this whole chapter exists to prevent. [Page 02](02-agentsmd-and-repository-context-maps-version-matched-bundled.md) covers what that block is and how `next dev` maintains it.

**It names a single source of truth.** The agent is pointed at the upgrade guide itself and told to treat it as authoritative for the migration. This displaces the agent's training data explicitly rather than hoping the bundled docs win by proximity.

**It requires a plan in user-facing language before broad changes.** Not a technical plan — a plan the human can evaluate without reading the diff. This is the cheapest possible checkpoint: it costs one paragraph, and it catches a misunderstanding before forty files change rather than after.

**It defines four conditions for stopping, and tells the agent to keep moving otherwise.** The stop conditions are: the guide requires a project-specific decision, the change is destructive, credentials or environment setup are missing, or the correct migration is ambiguous. Everything else follows the documented defaults without asking. This is the part most hand-written prompts get wrong in both directions — either the agent asks about everything and the session becomes a conversation, or it asks about nothing and quietly makes a product decision on your behalf.

**It scopes the work.** Keep the migration to the upgrade. An agent with an open remit will find and fix unrelated things, and a diff that mixes a framework migration with opportunistic refactors is not reviewable by anyone.

**It requires verification with a named preference and a named fallback.** The agent is asked to use the runtime verification flow from the AI-agents guide, preferring the `next-dev-loop` Skill where it is available — 16.3 or later with Turbopack — and otherwise falling back to `next dev`, browser and build checks. The prompt is explicit that some verification tooling only becomes available *after* the app is upgraded, which is why verification is staged this way rather than demanded up front.

**It asks for a summary that separates what was verified from what was not.** This is the single most transferable clause in the whole prompt. An agent that reports only what it did leaves you to work out the coverage boundary yourself; an agent that names what it could not verify has handed you your review list.

## The three codemods, and the gap between them

The mechanical work runs through `@next/codemod`. There are three commands you may need and the relationship between them is the thing to get right:

```bash
# 1. The main one: config, lint migration, proxy rename, unstable_ prefixes, experimental_ppr
npx @next/codemod@canary upgrade latest

# 2. Async Request APIs — only if you still have synchronous access from the 15 compatibility period
npx @next/codemod@canary next-async-request-api .

# 3. next lint -> ESLint CLI, as a standalone run
npx @next/codemod@canary next-lint-to-eslint-cli .
```

🔴 **The gap is stated plainly in the guide and is the load-bearing sentence of this whole page: the `upgrade` codemod does not run every migration codemod.** It is a partial transform that presents as a complete one. Running it produces a green-looking result, a satisfying diff, and an app that still accesses `cookies()` synchronously — which 16 removed entirely, so it fails at runtime rather than at build.

What `upgrade latest` does cover: rewriting `next.config.js` to the top-level `turbopack` option, migrating `next lint` to the ESLint CLI, renaming the deprecated `middleware` convention to `proxy` (including config flags such as `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`), dropping `unstable_` prefixes from stabilised APIs, and removing the `experimental_ppr` route segment config from pages and layouts.

What it does not cover is a long list, and this is where an agent earns its place, because every item is a judgement rather than a rewrite:

- **`revalidateTag` now requires a second argument** naming a `cacheLife` profile; the single-argument form is deprecated and produces a TypeScript error. Which profile is correct is a per-call decision, and where you actually wanted read-your-writes semantics the answer is not a profile at all but `updateTag`.
- **`cacheComponents: true` is not a rename** of the removed `experimental.dynamicIO` / `experimental.useCache` flags. The guide is explicit that enabling it can surface build errors for uncached data outside a Suspense boundary and requires adopting the model. If you were not actively adopting Cache Components, the correct migration is to delete the flags, not to translate them.
- **Parallel route slots now require explicit `default.js` files** or the build fails — and whether the right body is `notFound()` or `return null` is a product question about what that slot should show.
- **`next/image` defaults moved underneath you**: `minimumCacheTTL` from 60 seconds to four hours, `16` removed from `imageSizes`, `qualities` narrowed to `[75]` so a `quality` prop of 80 is coerced down, local IP optimisation blocked, and `maximumRedirects` capped at 3. None of these break the build. They change output.
- **`serverRuntimeConfig` and `publicRuntimeConfig` are gone**, and the replacement is environment variables — with `connection()` needed before reading `process.env` if the value must be read at runtime rather than baked in at build.
- **PPR users are told to stay put.** The guide states that PPR in 16 works differently from the 15 canaries and that if you use PPR today you should remain on your current 15 canary. An agent that migrates a PPR app because it was told to upgrade has followed instructions past the point where the guide told it to stop.

**Read that list as the definition of the human's job in an agent-authored migration.** The codemods take the transforms; the agent takes the mechanical follow-up and the verification; what is left is a set of decisions where the codebase does not contain the answer.

## Scoping the verify: `--debug-build-paths`

The reason migrations go badly with an agent is rarely a bad edit. It is that verification is too expensive to do per change, so changes accumulate between checks and the failure cannot be attributed to any one of them.

A full production build on a large app is minutes. `next build --debug-build-paths` builds only the routes you name:

```bash
next build --debug-build-paths="app/(app)/board/page.tsx"
```

That converts "verify after the migration" into "verify after each route", which is the whole difference between a reviewable session and an unreviewable one. The flag is enumerated in [Appendix C part 3](../20-appendices/03c-appendix-c-the-cli-surface.md), and [chapter 4](../04-data-fetching-in-the-app-router/03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md) uses it as the first step of diagnosing a route whose caching behaviour changed — which is exactly the diagnosis you need mid-migration.

⚠️ **One documented limit, worth knowing before you build a workflow on it: `--debug-build-paths` does not narrow type checking.** Since `next build` shells out to the project-local `tsc`, the type check covers the whole project selected by your `tsconfig` regardless of the flag, and combining the two produces a warning — see [chapter 13](../13-testing-and-developer-experience/12-typescript-7-and-build-type-checking.md). The route build is scoped; the type check is not.

## Gotchas

### The upgrade codemod ran cleanly and the app breaks at runtime
**Symptom.** `upgrade latest` reported success, the build passes, and requests fail on routes that read cookies or headers.
**Cause.** `upgrade` is not a superset of the migration codemods — the guide says so explicitly — and 16 removed synchronous access to the Request APIs entirely.
**Fix.** Run the async codemod as a separate step, and treat it as part of the standard sequence rather than a conditional.

```bash
npx @next/codemod@canary upgrade latest
npx @next/codemod@canary next-async-request-api .
```

### The agent migrated a PPR app that the guide told it to leave alone
**Symptom.** A working 15-canary PPR app is now on 16 and behaving differently, with no single broken thing to point at.
**Cause.** PPR in 16 is not the 15-canary feature under a new flag, and the guide instructs PPR users to stay on their current 15 canary. "Upgrade this app" outranked that sentence for the agent.
**Fix.** Encode the stop condition where it will be read before the work starts, not in the session prompt.

```md
## Migration scope
- This app uses PPR on a Next.js 15 canary. Do NOT upgrade to 16. Stop and report.
```

### `cacheComponents: true` swapped in for the removed experimental flags
**Symptom.** The build now fails with errors about uncached data outside a Suspense boundary, on routes nobody edited.
**Cause.** `experimental.dynamicIO` and `experimental.useCache` were removed, and the mechanical-looking move is to translate them to the top-level flag. The guide states this is not a rename-only change and requires adopting the model.
**Fix.** If you were not deliberately adopting Cache Components, delete the flags rather than translating them.

```ts
// next.config.ts — the correct migration for a project that was NOT adopting the model
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // experimental.dynamicIO and experimental.useCache removed, not replaced
}

export default nextConfig
```

### Every `revalidateTag` got the same second argument
**Symptom.** The type errors are gone, the build is green, and some surface is stale in a way that matters.
**Cause.** The second argument names a `cacheLife` profile. Applying one value uniformly is the only thing an agent can do without knowledge it does not have, and it is wrong per call rather than wrong overall.
**Fix.** Review each call site; where the user must see their own write immediately, the right API is not a profile at all.

```ts
'use server'

import { updateTag } from 'next/cache'

export async function updateUserProfile(userId: string, profile: Profile) {
  await db.users.update(userId, profile)
  updateTag(`user-${userId}`) // read-your-writes; not a revalidateTag profile choice
}
```

### An image-related regression with no diff to point at
**Symptom.** Images look subtly different or cache differently after the upgrade, and nothing in the diff touches images.
**Cause.** 16 changed `next/image` defaults — `minimumCacheTTL` to four hours, `imageSizes` without `16`, `qualities` narrowed to `[75]` so a `quality` of 80 coerces down, local IP optimisation blocked, redirects capped at 3. A project that never set them has no line to review.
**Fix.** Set explicitly whichever ones you were relying on implicitly, so the value becomes visible to the next reader.

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    minimumCacheTTL: 60,
    qualities: [50, 75, 100],
  },
}

export default nextConfig
```

### A parallel route slot's mandatory `default.js` was generated blindly
**Symptom.** The build passes after the agent added the required files, and a modal slot now renders nothing where it used to render a fallback — or 404s a route that should have stayed visible.
**Cause.** 16 requires an explicit `default.js` for every parallel route slot, and the guide offers two bodies: `notFound()` or `return null`. They are opposite behaviours, and nothing in the codebase says which this slot wants.
**Fix.** Decide per slot, and write the reason down where the next person will see it.

```tsx
// app/@modal/default.tsx — nothing should render when this slot is unmatched
export default function Default() {
  return null
}
```

### `serverRuntimeConfig` values were replaced with build-time environment reads
**Symptom.** A value that used to change per deployment is now frozen to whatever it was when the image was built.
**Cause.** `serverRuntimeConfig` and `publicRuntimeConfig` were removed in favour of environment variables, and a direct `process.env` read in a Server Component can be inlined at build time.
**Fix.** Call `connection()` first where the value genuinely has to be read at request time.

```tsx
import { connection } from 'next/server'

export default async function Page() {
  await connection()
  const config = process.env.RUNTIME_CONFIG
  return <p>{config}</p>
}
```

### The migration is verified only at the end
**Symptom.** The final build fails with several unrelated errors and no way to attribute any of them to a change.
**Cause.** A full build is expensive enough that it gets deferred, so forty edits accumulate between signals.
**Fix.** Scope the build to the route just touched, so verification is cheap enough to do every time.

```bash
next build --debug-build-paths="app/(app)/board/page.tsx"
```

### `--debug-build-paths` was expected to speed up the type check too
**Symptom.** The scoped build is still slow, and a warning appears about combining the options.
**Cause.** `next build` shells out to the project-local `tsc`, which checks the file set your `tsconfig` selects. The flag scopes the route build, not the type check, and the docs say combining them warns.
**Fix.** Accept the whole-project type check as a fixed cost, or run the route build and the type check as separate steps in your loop rather than expecting one command to be cheap.

## Interview questions

**★ Vercel publishes a prompt for upgrading to 16. What is actually useful about that?**
Not the convenience — the declaration. By writing it themselves the maintainers have said which parts of their own migration they consider mechanical, which four conditions should make an agent stop (a project-specific decision, a destructive change, missing credentials or environment setup, or an ambiguous migration), and what "done" means. It is a better-written instruction than most teams produce for themselves, and its structure is worth copying for migrations that have no published prompt.

**★ Why does the published prompt handle `AGENTS.md` before it touches any code?**
Because an ungrounded agent migrating to 16 writes 15-era code with complete confidence, and every subsequent instruction inherits that error. Establishing that the agent is reading version-matched docs is the precondition for the rest of the prompt meaning anything. It also asks the agent to re-check the same thing at the end, so the project is left ready for the next session rather than only for this one.

**★ What is the gap between the upgrade codemod and the migration?**
The guide states that `upgrade` does not run every migration codemod. It covers the `turbopack` config move, the lint migration, the `middleware` → `proxy` rename and its config flags, `unstable_` prefix removal and `experimental_ppr` removal. It does not cover async Request APIs, which need `next-async-request-api` run separately — and it cannot cover anything requiring judgment: `revalidateTag`'s new profile argument, whether `cacheComponents` should be enabled at all, what a parallel route's mandatory `default.js` should render, or which changed `next/image` default you were relying on.

**★ Why is "the codemod ran cleanly" a dangerous signal?**
Because a partial transform presents identically to a complete one. You get a successful run, a plausible diff and a passing build, on an app that still accesses `cookies()` synchronously — which fails at runtime, not at build. The absence of an error is evidence about the transform that ran, not about the migration as a whole.

**★ What does `--debug-build-paths` change about working with an agent, and what does it not do?**
It builds only the routes you name, which turns verification from something deferred to the end into something done after each change — the difference between attributable and unattributable failures. It does not narrow type checking: `next build` shells out to the project-local `tsc`, which checks whatever your `tsconfig` selects, and combining the two warns. Scope the route build; treat the type check as a fixed cost.

**★ The guide tells PPR users to stay on Next.js 15. How do you stop an agent overriding that?**
By putting the stop condition in the file it reads at the start of every session rather than in the prompt for one session. "Upgrade this app to 16" is a direct instruction and will outrank a sentence buried in a guide the agent is skimming; a line in `AGENTS.md` saying this app must not be upgraded is read as a constraint before the task is. The general lesson is that session prompts decay and repository context does not.

**★ Which category of 16 breaking change is hardest to review, and why?**
The changed defaults, because they produce no diff. A project that never set `minimumCacheTTL` has no line for a reviewer to look at, and yet its image cache lifetime moved from 60 seconds to four hours. Renames are self-evidencing; removals fail loudly; defaults change behaviour silently in files nobody touched. The only defence is to check the guide's list against your config deliberately rather than reviewing the patch.

**Why does the published prompt ask for a plan in user-facing language before broad changes?**
Because it is the cheapest checkpoint that exists. A paragraph a non-specialist can evaluate catches a misunderstanding before forty files change, and it costs one round trip. A technical plan would not do the same job — it is reviewed by reading the same assumptions back.

**Why does the prompt stage verification after the upgrade rather than before?**
Because some of the verification tooling only exists after the app is on 16 — the `next-dev-loop` Skill is named as the preference where available, which the prompt ties to 16.3 or later with Turbopack, with `next dev`, browser and build checks as the fallback. Demanding the preferred flow up front would fail on exactly the apps that most need upgrading.

**An agent replaced `serverRuntimeConfig` with `process.env` reads and a per-deployment value is now frozen. What went wrong?**
The replacement is correct and incomplete. Environment variables are the documented successor, but a `process.env` read in a Server Component can be resolved at build time; `connection()` before the read is what forces it to request time. It is a good example of the class of migration an agent completes plausibly — the symbol is right, the timing is wrong, and nothing fails until deployment.

---

← [Skills, agent-browser and fix-menus](04-163-preview-first-party-skills-for-multi-step-workflows.md) · [Chapter 14 overview](01-explanation.md) · Next → [The verification loop, guardrails and review discipline](05b-the-verification-loop-guardrails-and-review-discipline.md)
