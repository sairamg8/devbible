---
title: "The third pile is the one you cannot grep for, because it consists entirely of lines nobody wrote — SprintDesk's inherited decisions, what each default actually is, and the specific observation that would reveal it"
sidebar_label: "01ba · The inherited pile"
sidebar_position: 3
description: "Eight framework defaults SprintDesk depends on and never chose — prefetch behaviour, prerender status, pool max, the 30-second client floor, the image cache TTL, the default cacheLife profile and the two config keys that write the same number — each with the check that surfaces it."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 — this page composes material already verified across chapters 1, 2, 5, 6, 14 and 15 of this book against the Next.js 16.3.4 documentation. It introduces no new framework claims of its own; every default below is stated on a page of this book that cites its primary source.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**[01b](01b-the-decisions-that-are-now-load-bearing.md) sorted the decisions SprintDesk made. This page is the harder half: the decisions it did not make, and is nonetheless standing on. An inherited decision is a framework default that has held so far because nothing has stressed it, and it is the most dangerous of the three piles for a reason that is structural rather than psychological — you cannot find it with a grep, because there is no line to find. A team looking for its inherited pile in a diff will find nothing and conclude the pile is empty. The only way to produce it is to enumerate the framework's defaults from the framework's own documentation and ask, of each, *when did we choose this?* Eight of SprintDesk's answers are "we didn't", and each one below carries the specific observation that would surface it before an incident does.**

## Why this pile has no diff

Chapter 14 says it in one sentence about the 16 upgrade, and the sentence generalises to every entry on this page:

> A project that never set any of those options has **zero diff** across all of it. The agent did not change them; nobody changed them; the behaviour changed anyway.
> — [ch14 · what an agent cannot decide](../14-agent-driven-development/06b-what-an-agent-cannot-decide-and-what-context-files-fix.md)

🔴 **Which means the review direction is inverted.** Every other review starts from the codebase and works outward. This one starts from the framework's documented defaults and works *towards* the codebase, asking whether anything overrides each one. There is no other order that finds these.

## The eight

| # | Inherited default | What it actually is | 🔴 What would reveal it |
|---|---|---|---|
| I1 | `<Link>` prefetch behaviour | `"auto"` — full prefetch for static routes, partial-to-`loading.js` for dynamic, nothing for a dynamic route without one | list which routes have a `loading.js`, then watch the network panel on a board link |
| I2 | Whether a route is prerendered | under Cache Components, only what is marked — and one request-time read in a shared file removes it for everything beneath | the build's own route classification, plus the seam grep below |
| I3 | Pool `max` | `10`, the `node-postgres` default | instances × 10 against your plan's `max_connections`, computed before a spike |
| I4 | Client-router stale floor | **30 seconds, enforced regardless of configuration** | a `cacheLife` with `stale` under 30s that appears to do nothing |
| I5 | `images.minimumCacheTTL` | **4 hours** since 16, previously 60 seconds | a re-uploaded avatar that does not change for the rest of the afternoon |
| I6 | `images.qualities` | `[75]` only, so *"a `quality` prop of 80, is coerced to 75"* | a `quality` prop in the codebase that has no visible effect |
| I7 | The `default` `cacheLife` profile | `stale` 5 minutes, `revalidate` 15 minutes, `expire` never | any `'use cache'` with no `cacheLife` beside it |
| I8 | Which config key wrote `default.stale` | both `cacheLife.default` and `staleTimes.static` write it | client-side staleness that is not the number you configured |

The rest of this page is each of those, with the argument and the check.

### I1 · What `<Link>` actually prefetches

Chapter 2 quotes the reference directly:

> *"**`"auto"` or `null` (default)**: Prefetch behavior depends on whether the route is static or dynamic. For static routes, the full route will be prefetched (including all its data). For dynamic routes, the partial route down to the nearest segment with a `loading.js` boundary will be prefetched."*
> — quoted in [ch2 · prefetching fundamentals](../02-routing-and-navigation/05-prefetching-fundamentals-and-the-native-view-transitions-api.md)

Read the second sentence for what it does not say. **A dynamic route with no `loading.js` gets nothing prefetched at all**, and the same page's table gives the client-cache side: a full page prefetch is held for five minutes (`staleTimes.static`), while the partial one is *"off by default"* (`staleTimes.dynamic`).

SprintDesk never set `prefetch` on a `<Link>` and never set `staleTimes`. So its navigation performance is entirely a function of which routes happen to have a loading boundary — a file-placement decision made for streaming reasons in chapter 7, now silently doubling as the prefetch policy.

**The check:**

```bash
# which routes have a boundary — and therefore a prefetch policy
find app -name 'loading.tsx' -o -name 'loading.js'
# which links opted out of the default, if any
grep -rn "prefetch=" app components
```

### I2 · Whether the board is actually prerendered

Under Cache Components nothing is cached until it is marked, and chapter 6 states the blast radius rule that makes this an inherited property rather than a per-route one: *"a request-time read makes the route it is in render per request, and its blast radius is every route beneath the file that performed the read"* ([ch6 · what breaks at the seams](../06-ssg-isr-and-ssr-strategy/06b-what-breaks-at-the-seams.md)).

Nobody on the team decided that the pricing page is dynamic. If it is, the cause is a `cookies()` call in a shared file written for a completely unrelated reason, and the page still renders correctly.

**The check** — chapter 6's own grep, plus the build's classification of every route:

```bash
grep -rn "cookies()\|headers()\|draftMode()" app/layout.tsx app/**/layout.tsx components
```

⚠️ **The build output is the authority here, not the grep** — the grep finds the reads you can see and misses the one inside an imported component. Chapter 6 makes exactly that point about `SiteHeader`.

### I3 · The pool size nobody set

`node-postgres` defaults `max` to 10. Chapter 15 turns that into the number that matters:

> A Neon 1 CU compute has `max_connections = 419` (Neon's published table). Leave the `pg` default `max: 10` in place. You are safe up to **41 concurrent instances** and you fall over at 42 — and 42 concurrent instances is a completely ordinary Tuesday for a Next.js app that has one slow Server Component.
> — [ch15 · database integrations](../15-databases-apis-and-full-stack-patterns/01-database-integrations-serverless-postgres-neon-prisma-drizzl.md)

The inherited part is not the 10. It is that **nobody in SprintDesk's history has computed instances × `max` against the compute size actually provisioned.** The number exists whether or not anyone has looked at it, and the day it is exceeded it is exceeded for every user at once.

**The check** is arithmetic, done before a launch rather than during one: your plan's `max_connections`, minus the reserve, divided by `max`, is your instance ceiling. Write the number down. It is one of the very few things in this book that a retrospective can settle with a calculator.

### I4 · The 30-second floor the client router enforces anyway

> *"**Minimum of 30 seconds is enforced** to ensure prefetched links remain usable."*
> *"`stale` under 30 seconds: excluded from prerenders, because a prefetch would expire before the user could click."*
> — quoted in [Appendix A part 1](../20-appendices/01-appendix-a-glossary-ppr.md)

And the second threshold, from the same source: *"`stale` of at least 30 seconds but under 5 minutes: included in prerenders, but excluded from the route's App Shell."*

This is inherited in the purest sense — it is enforced *regardless of configuration*, so no line anywhere in SprintDesk can express agreement or disagreement with it. What a team can get wrong is writing a `cacheLife` below the floor and believing it took effect. Nothing errors; the content is simply excluded from prerendering, and the prefetching everyone assumed was happening is not.

**The check:**

```bash
grep -rn "stale:" app lib next.config.ts
```

Any value under `30` is a line that does not do what it says. The fix is not a smaller number — it is on-demand invalidation at the mutation, which is what SprintDesk's `updateTag` calls already are.

### I5 and I6 · The image defaults that changed underneath the application

16 changed `minimumCacheTTL` from 60 seconds to **4 hours**, cut `qualities` to `[75]` only — so *"a `quality` prop of 80, is coerced to 75"* — removed `16` from the default `imageSizes`, and capped `maximumRedirects` at 3 ([ch14 · what an agent cannot decide](../14-agent-driven-development/06b-what-an-agent-cannot-decide-and-what-context-files-fix.md), citing the upgrade guide).

SprintDesk serves avatars and attachments through the image component (chapter 9's milestone). It set none of these options, so all four moved and the repository has no diff for any of them.

🔴 **The four-hour TTL is the one with a user-visible consequence.** A user who replaces their avatar and still sees the old one is not looking at a bug in your upload path.

**The check:**

```bash
grep -n "images" next.config.ts
grep -rn "quality=" app components
```

An empty first result and a non-empty second is the signature: quality props that are being silently coerced, in a project that never opted into a quality list.

### I7 and I8 · The cache profile nothing names, and the two keys that write it

Any `'use cache'` with no `cacheLife` beside it takes the built-in `default` profile: **`stale` 5 minutes, `revalidate` 15 minutes, `expire` never** ([ch5 · the `use cache` directive and custom `cacheLife` profiles](../05-caching-ppr-and-cache-components/02-the-use-cache-directive-and-custom-cachelife-profiles.md)).

That is a real freshness policy for SprintDesk's cached team data, and nobody wrote it down. It is also the entry most likely to be *changed* by accident, because chapter 5 flags two independent hazards:

> 🔴 **Redefining `default` is a whole-codebase change with no diff at the call sites.**

> ⚠️ **One more thing writes to `default`'s `stale` from a different config key.** `staleTimes.static` also updates it. Two places in `next.config.ts` can therefore set the same number, and the one you are not looking at wins if it is set later.

**The check:**

```bash
# every cached function that inherited the default profile
grep -rn -A2 "'use cache'" app lib | grep -B1 -v "cacheLife"
# the two keys that can write default.stale
grep -n "cacheLife\|staleTimes" next.config.ts
```

## The ritual that produces this pile

It is short, and it is the only part of the retrospective that cannot be delegated to a search:

1. **Open the upgrade guide's changed-defaults section**, not your diff. Chapter 14's point is that the diff is empty by construction, so the diff is the wrong artefact.
2. **For each default, ask who chose it.** A shrug files it here.
3. **Write the observation, not the reassurance.** *"We handle images correctly"* is not an entry; *"an avatar re-upload stays stale for up to four hours because `minimumCacheTTL` is 4h and we never set it"* is.
4. **Promote anything you now agree with into an explicit line.** A default you have decided to keep, written down as a config value with a comment, has left this pile — that is the entire remediation. It costs one line and converts an invisible dependency into a reviewable one.
5. **Put the remainder in the context file.** Chapter 14's milestone is the destination: [decisions, not advice](../14-agent-driven-development/07-project-milestone-sprintdesk-gets-an-agentsmd.md).

⚠️ **Step 4 is the one people skip, and it is the whole point.** The goal is not to change the behaviour — the defaults are mostly good. The goal is to make the dependency visible to the next person, who will otherwise inherit it a second time.

## Gotchas

**★ Symptom: the inherited pile comes back empty and the team concludes there is nothing there.** Cause: it was searched for in the codebase, and an inherited decision is by definition the absence of a line. Fix: enumerate from the framework's documentation towards your code rather than the other way round, starting with the upgrade guide's changed-defaults list.

**★ Symptom: prefetching "does not work" on the board despite `<Link>` everywhere and no `prefetch` prop anywhere.** Cause: the board is a dynamic route, and a dynamic route with no `loading.js` boundary has nothing prefetched — the default is partial-to-the-boundary, and there is no boundary. Fix: `find app -name 'loading.tsx'`, then decide deliberately whether each dynamic route should have one. The file that was added for streaming is also your prefetch policy.

**★ Symptom: a `cacheLife({ stale: 10 })` was added for freshness and nothing about the application got fresher.** Cause: 30 seconds is enforced by the client router regardless of configuration, and content below it is excluded from prerenders entirely. Fix: raise `stale` above the floor and get the freshness from `updateTag` at the mutation, which is where SprintDesk's board already gets it.

**★ Symptom: a user replaces their avatar, hard-refreshes, and still sees the old one an hour later.** Cause: `images.minimumCacheTTL` moved from 60 seconds to 4 hours in 16, and the project never set it, so there is no diff and nothing to blame. Fix: set it explicitly to the value your product actually wants, and treat the line as documentation of a decision rather than as a tweak:

```ts
// next.config.ts — avatars change rarely, but not on a four-hour horizon
const nextConfig: NextConfig = {
  images: { minimumCacheTTL: 300 },
}
```

**★ Symptom: a `quality={90}` prop was added to attachments and the images look identical.** Cause: `qualities` defaults to `[75]` and a quality outside the list is coerced — *"a `quality` prop of 80, is coerced to 75"*. Fix: add the quality you want to `images.qualities` in the config, or delete the prop; leaving it in place documents an intention the framework is overruling.

**★ Symptom: a database outage under load, and every configuration file in the repository looks correct.** Cause: `max` was never set, so it is 10 per instance, and nobody multiplied it by the instance count the traffic produced. Fix: do the arithmetic before the launch, not after — plan `max_connections` divided by `max` is your instance ceiling, and it is a number, not an opinion.

**★ Symptom: someone redefines `cacheLife.default` to tune one slow page, and prefetching stops across the whole application.** Cause: `default` applies to every `'use cache'` with no profile beside it, and dropping its `stale` below 30 seconds excludes all of them from prerendering. Fix: never tune `default`; define a named profile and apply it to the function that needed it.

**★ Symptom: the client-side staleness is not the number in `cacheLife.default`.** Cause: `staleTimes.static` writes the same value from a different config key, and whichever is set later wins. Fix: grep for both keys in `next.config.ts` before concluding the framework is wrong, and pick one place to set it.

**★ Symptom: the pile is written up, everyone agrees the defaults are fine, and nothing changes.** Cause: agreeing with a default leaves it inherited — the pile is about visibility, not about behaviour. Fix: write the agreed default into the config explicitly with a one-line comment. The behaviour is identical; the difference is that the next person sees a decision instead of nothing.

## Interview questions

**★ Why is the inherited pile the most dangerous of the three, given the defaults are usually sensible?**
Because the team believes a decision was made. A free decision can be revisited cheaply; a load-bearing one is at least visible in the code and will be found by anyone who greps for it. An inherited one consists of lines nobody wrote, so it survives code review, survives the diff, and survives the retrospective unless somebody deliberately enumerates the framework's defaults. The danger is not that the default is wrong — it is that when the default becomes wrong, nothing points at it, and the investigation starts in the application code where the cause is not.

**★ How do you find an inherited decision, mechanically?**
You invert the direction of the review. Every other review reads the codebase and asks what it does; this one reads the framework's documented defaults and asks whether anything in the codebase overrides each. The upgrade guide's changed-defaults section is the highest-yield starting point, because a major release that moves a default produces exactly zero diff in a project that never set it — chapter 14 makes that the defining property of the class. Then, for each default with no override, write the observation that would surface it, and treat "we've never seen that" as a non-answer.

**★ SprintDesk has never set `prefetch` on a `<Link>`. What is its prefetching behaviour?**
It depends per route, and the deciding factor is a file placed for an unrelated reason. The default is `"auto"`: static routes are prefetched in full including their data, and held in the client cache for five minutes; dynamic routes are prefetched only down to the nearest `loading.js` boundary, with the client cache off by default; and a dynamic route with no boundary at all gets nothing. So the loading boundaries added in the error-handling chapter for streaming reasons are also, silently, the application's prefetch policy. That is a textbook inherited decision — real behaviour, deriving from a file whose author was thinking about something else.

**★ What is the 30-second floor, and why can no configuration change it?**
It is the minimum client-router staleness, enforced *"to ensure prefetched links remain usable"*, and content whose `stale` is under it is excluded from prerenders entirely because a prefetch would expire before the user could click. It cannot be configured away, which makes it the purest inherited item on the list: there is no line in any project that can express agreement or disagreement with it. What a project can get wrong is writing a smaller number and believing it applies. The correct response to needing sub-30-second freshness is not a smaller `stale`, it is an on-demand invalidation at the mutation.

**★ A user says their new avatar has not updated. Where do you look first, and why is it not the upload code?**
At `images.minimumCacheTTL`, which 16 changed from 60 seconds to four hours, and which most projects have never set. The upload path is the obvious suspect and the wrong one, because the symptom — a correct new file that nobody sees — is exactly what an image cache produces. The general lesson is the reason this pile exists: when the behaviour changed without a commit, the cause is a default, and the only artefact that records it is the upgrade guide.

**★ What does a `'use cache'` with no `cacheLife` beside it actually do?**
It takes the built-in `default` profile — `stale` five minutes, `revalidate` fifteen minutes, `expire` never. That is a real freshness and retention policy that nobody in the project chose or wrote down, applied to every unannotated cached function at once. It is also unusually fragile as an inherited value, because redefining `default` in `next.config.ts` changes every one of those call sites with no diff at any of them, and because `staleTimes.static` writes the same `stale` number from a second key. Two config keys and one silent default is a combination worth checking before believing any number about client-side staleness.

**★ How do you remediate an inherited decision you agree with?**
Write it down as an explicit config line with a comment saying why. The behaviour does not change at all, and that is the point — the remediation is not behavioural, it is that the dependency stops being invisible. After it, a reviewer sees a value someone chose and can argue with it; before it, there is nothing on the screen to argue with. This is the cheapest item in any retrospective and the one most often dismissed as pointless, because it produces no functional change and its entire value is delivered to a person who has not joined yet.

**★ Your team runs this exercise and finds twelve inherited defaults. How do you prioritise them?**
By what each one costs on the day it becomes wrong, not by how surprising it is. Pool `max` is first, because exceeding the connection ceiling fails for every user simultaneously and the arithmetic that predicts it takes a minute. The prerender status of shared routes is second, because it converts into an infrastructure bill with no commit to blame. The image cache TTL is third — user-visible, confusing, harmless. The rest can be written into the config as a batch. The ordering principle is blast radius on failure, and it is worth stating because the temptation is to order by how clever the finding felt.

---

← [01b · The decisions that are now load-bearing](01b-the-decisions-that-are-now-load-bearing.md) · [01 · SprintDesk retrospective](01-sprintdesk-retrospective-the-finished-multi-tenant-saas-revi.md) · Next → [01c · The checklist pass: rendering, caching and the build](01c-the-checklist-pass-rendering-caching-and-the-build.md)
