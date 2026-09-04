---
title: "Every way an agent fails in an App Router codebase is the same failure wearing different clothes — it changed something whose breakage has no signal, and then verified that the page still works"
sidebar_label: "06 · Honest limits: the silent failures"
sidebar_position: 6
description: "Why cache semantics defeat an agent when the type system only checks arity, why boundary placement is tree-global while a diff is file-local, and the failure class that returns 200 with correct HTML and passing tests."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents) (`lastUpdated: 2026-08-25`), [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`), [Enabling Next.js MCP Server for Coding Agents](https://nextjs.org/docs/app/guides/mcp) (`lastUpdated: 2026-07-08`) and the [production checklist](https://nextjs.org/docs/app/guides/production-checklist) (body dated `2026-03-10`).
> Target: **Next.js 16.3.4** · React 19.2.8. Documentation-verified; **no sandbox run, no timings**.

**The previous three pages were about what to give an agent: a context file, a diagnostics channel, a verification loop. This page and [its sibling](06b-what-an-agent-cannot-decide-and-what-context-files-fix.md) are about what none of that reaches. The chapter's honesty depends on them, because the mitigations are genuinely good and it is easy to finish the chapter believing they are sufficient.**

They are not, and the reason is structural rather than a matter of model quality. An agent verifies by observing consequences. The App Router's most consequential properties — what is cached, where the shell ends, what streams, what a route costs — produce **no observable consequence when they break**. The build succeeds. The route returns `200`. The HTML is correct. The settled DOM is identical. A model that is checking its work is checking the things that still look right.

This page covers the three failure classes the platform produces silently — cache semantics, boundary placement, and the properties with no signal at all. Everything in it is one shape: **the change was silent, and the verification was blind to it.** What an agent cannot decide even with perfect information is [06b](06b-what-an-agent-cannot-decide-and-what-context-files-fix.md).

## Cache semantics — the type system checks the arity, never the number

Cache Components inverts the framework's default. Before it, caching was a set of heuristics you nudged; with `cacheComponents: true`, caching is explicit and the compiler holds you to it. The upgrade guide says so in the strongest terms available to documentation:

> *"Enabling `cacheComponents` is not a rename-only change: it can surface build errors for uncached data outside of `<Suspense>` and requires adopting the Cache Components model."*

An agent arrives at that inversion carrying a mental model built from a corpus in which the old model is overwhelmingly represented — `unstable_cache`, `experimental_ppr`, single-argument `revalidateTag`, `fetch` options as the caching interface. This is the gap the version-matched bundled docs from [page 02](02-agentsmd-and-repository-context-maps-version-matched-bundled.md) exist to close, and they close it well. What they cannot close is the second gap, which is not about knowledge at all.

### The archetype: `revalidateTag`'s second argument

In 16, `revalidateTag` *"now requires a second argument specifying a `cacheLife` profile. The single-argument form is deprecated and will produce a TypeScript error."*

Read what that guarantees and what it does not. The type error fires on **arity** — a call with one argument is rejected, loudly, at build time, and an agent fixes it in seconds. The type system then has no further opinion. Which profile is correct is a statement about how stale this particular data is allowed to be for these particular users, and it is unavailable anywhere in the codebase, the types, or the documentation. The agent supplies a plausible value because it must supply something.

```ts
// Before: a compile error the agent will fix.
revalidateTag('board-42')

// After: compiles, ships, and is a guess.
revalidateTag('board-42', 'hours')
```

The change is green on every check you have. It is also a product decision — *"a stale board is acceptable for up to an hour"* — made silently by a tool with no access to the fact. This is the single most reviewable line in an agent-authored 16 migration, and it looks like the least.

### The neighbouring API with the same shape and different semantics

16 also introduced `updateTag`, described as *"a new Server Actions-only API that provides **read-your-writes** semantics"*, alongside `refresh`, which *"allows you to refresh the client router from within a Server Action."*

Three APIs, adjacent in the docs, similar in shape, different in guarantee. An agent that reaches for `revalidateTag` inside a Server Action where `updateTag` was required produces code that is correct in every test that mutates and then re-reads later, and wrong only when the same user reads immediately after their own write. That is a race, it is intermittent, it is invisible in review because the call site looks exactly like the right one, and it will be reported as a caching bug months later by someone who cannot reproduce it.

### `"use cache"` as an error-suppression reflex

The failure mode chapter 12 documents for metadata generalises. Adding `'use cache'` to a scope that raised a blocking-prerender error does clear the error — and if the `cacheLife` profile attached to it has a `revalidate` shorter than the prerender's effective lifetime, the scope stays out of the prerender and the route is now *partially* dynamic. Error gone, static shell gone, nothing said. An agent optimising for "the build is green" has been rewarded for making the route slower.

### Where the mitigation actually lands

Bundled docs fix the agent's **knowledge** of the caching model. They do not, and cannot, supply the two things every one of these decisions needs: how stale this data may be, and which of several correct-looking APIs matches this call site's guarantee. Those live in your repository's head, which is why they belong in your `AGENTS.md` — as the concrete list of profiles that exist and what each one means, not as advice.

```md
## Caching decisions this repo has already made
- `cacheLife` profiles in use: `minutes` (board lists), `hours` (public marketing),
  `max` (the glossary). Do not invent a profile; if none fits, stop and ask.
- Inside a Server Action, a tag the same request will read back uses `updateTag`.
  `revalidateTag` is for tags read by a *later* request.
```

## Boundary placement — the change is tree-global, the diff is file-local

Server/client and static/dynamic boundaries share a property that makes them adversarial to code review: **the effect of a boundary is felt by its entire subtree, and a diff shows you one file.**

**A `<Suspense>` boundary moved up one level.** Two lines change. The settled DOM is byte-identical, because the same components render the same markup in the same order. What changed is where the static shell stops — the glossary defines Suspense boundaries as the thing that *"define where the static shell ends and streaming begins, enabling Partial Prerendering"* — so the prerendered portion of the route just shrank, and every descendant that was in the shell is now behind the network. Nothing failed.

**A request API read one level too high.** The production checklist states that request-time APIs *"will opt the entire route into Dynamic Rendering (or your whole application if used in the Root Layout)."* An agent adding a theme cookie read to a shared layout has written three obviously-correct lines and de-optimised every route beneath it. The reviewer of the page that got slow will never open the file that did it.

**`'use client'` added to a shared module.** One line. The module and everything it pulls in cross to the client bundle. There is no error, no warning, and the visible behaviour is unchanged; the cost is bundle size and the loss of server-only execution for a subtree the diff does not name.

**`server-only` is not a boundary check.** It enforces import *direction* — a client module importing a server module fails the build — and that is genuinely valuable, but a boundary that has been legally moved to the wrong place imports nothing it should not. See [chapter 3's treatment of exactly what it does not protect](../03-server-components-vs-client-components/05b-what-server-only-does-not-protect.md).

The practical consequence for review: **for boundary work, the diff is the wrong artefact.** What you need is the before-and-after route classification, which is what the build output and the MCP `get_routes` / `get_page_metadata` tools give you, and which is why [page 03](03-the-nextjs-devtools-mcp-server-exposing-build-diagnostics-an.md) treats runtime sight as infrastructure rather than convenience.

## The failure class with no signal anywhere in the response

Instant navigation is the cleanest example in the framework of a property that can be lost without producing anything to notice, and the docs are unusually direct about it:

> *"Insights don't show up in the HTTP response. An offending route still returns `200` with rendered HTML in dev. The insight only appears in the dev overlay, the dev-server log, or the MCP `get_errors` tool."*

Every default verification strategy an agent will reach for is defeated by that sentence. Requesting the route: `200`. Diffing the HTML: identical. Asserting the final DOM in a test: passes. Checking the build for errors: clean. The agent reports success accurately — it verified what it could observe, and the loss was not observable there.

The related trap has the same shape: a `stale` value under 30 seconds means a route is *"excluded from prerenders, because a prefetch would expire before the user could click"*, with a **minimum of 30 seconds enforced** to keep prefetched links usable. A configuration change of `stale: 20` is a reasonable-looking number that quietly removes the route from prerendering.

This is the whole justification for the assertion-first loop in [05b](05b-the-verification-loop-guardrails-and-review-discipline.md). The ceremony is not general good practice applied enthusiastically; it exists **precisely where the platform provides no signal**, to manufacture one before the code that will break it is written.

## Where this goes next

The three failure classes above are things the **platform** does silently. The other half of the honesty — the decisions no amount of tooling can hand to an agent, and exactly how far context files and MCP carry you — is [06b · What an agent cannot decide, and what context files actually fix](06b-what-an-agent-cannot-decide-and-what-context-files-fix.md).

## Gotchas

**The migration is green and the board is stale for an hour.**
*Symptom:* everything compiles, tests pass, users report the board not updating.
*Cause:* `revalidateTag` gained a required second argument, the agent supplied a plausible `cacheLife` profile, and nobody read it as a decision.
*Fix:* grep every call and confirm the profile against a stated policy, not against plausibility.
```bash
grep -rn "revalidateTag(" app/ lib/
```

**A user's own write does not appear on their next read.**
*Symptom:* intermittent, unreproducible, only for the user who made the change.
*Cause:* `revalidateTag` used inside a Server Action where `updateTag`'s read-your-writes semantics were required.
*Fix:* inside a Server Action, a tag the same request reads back uses `updateTag`; `revalidateTag` is for later requests.

**The agent reached for `unstable_cache` and it typechecks fine.**
*Symptom:* new caching code that looks like every example the agent has ever seen, sitting next to `"use cache"` code that does not match it.
*Cause:* the pre-16 model dominates training data, and the production checklist itself still advises caching non-`fetch` requests via `unstable_cache`. In 16 the model is `"use cache"` with `cacheLife`/`cacheTag`, both of which **dropped** the `unstable_` prefix on stabilising.
*Fix:* treat any `unstable_` prefix in generated caching code as a version tell, and check the bundled docs rather than the published checklist, whose body is dated `2026-03-10`.

**The blocking-prerender error is gone and the page got slower.**
*Symptom:* build green, route drops from static or partial to dynamic.
*Cause:* `'use cache'` applied as error suppression, with a `cacheLife` whose `revalidate` is shorter than the prerender's effective lifetime, so the scope stays out of the prerender.
*Fix:* choose a longer profile, or accept the dynamic portion deliberately — and check the route classification in the build output, not the error count.

**A two-line diff removed half the route from the static shell.**
*Symptom:* no error, identical DOM, worse Time to First Byte.
*Cause:* a `<Suspense>` boundary moved up a level; the shell ends earlier.
*Fix:* review boundary changes against route classification before and after, not against the diff. The settled DOM is not evidence.

**Every route in the app went dynamic after a one-file change.**
*Symptom:* the whole application de-optimises; the file that caused it is not in the route's own directory.
*Cause:* a request-time API read in a shared or root layout, which opts the entire route — or the whole application from the root layout — into dynamic rendering.
*Fix:* keep request APIs out of shared layouts, or confine them behind a boundary; treat any layout edit as a route-wide change during review.

**The client bundle grew and no check complained.**
*Symptom:* larger bundle, unchanged behaviour, clean build.
*Cause:* `'use client'` added to a shared module, pulling its subtree across the boundary.
*Fix:* review `'use client'` additions by what imports the module, not by the line itself.

**`server-only` is installed and a boundary is still wrong.**
*Symptom:* the guard is in place and the code is on the wrong side anyway.
*Cause:* `server-only` enforces import direction, not placement; correctly-placed imports in a wrongly-placed boundary pass.
*Fix:* treat it as one check among several, per chapter 3.

**A route lost instant navigation and every check stayed green.**
*Symptom:* nothing. `200`, correct HTML, passing tests.
*Cause:* insights are absent from the HTTP response; they appear only in the dev overlay, the dev-server log, or MCP `get_errors`.
*Fix:* read `get_errors` as part of the loop, and hold the property with a pre-written `instant()` assertion.

**Setting `stale` to a snappier-looking number removed the route from prerendering.**
*Symptom:* a route silently stops being prerendered after a config tweak.
*Cause:* a `stale` under 30 seconds is excluded from prerenders because the prefetch would expire before a click; 30 seconds is the enforced minimum.
*Fix:* treat sub-30-second staleness as an opt-out of prerendering and say so at the call site.

**An agent scaffolded a parallel route and the build fails with nothing obviously wrong.**
*Symptom:* a slot renders in dev and the production build refuses.
*Cause:* in 16, parallel-route slots require explicit `default.js` files; builds fail without them.
*Fix:* add the `default.js`. Worth listing separately because it is the rare boundary mistake that is **loud** — and it is therefore the one an agent reliably fixes on its own, which is a useful calibration for how much of this list it cannot.

## Interview questions

**★ Why is `revalidateTag`'s new second argument the best example of an agent's limits?**
Because it separates the two things people conflate when they talk about agent reliability. The *arity* change is caught by the type system, which means an agent fixes it instantly and correctly — that is knowledge, and version-matched docs plus a compiler handle it. The *value* is a statement about how stale this data may be for these users, which exists nowhere in the codebase, the types, or the documentation. The agent must supply something, so it supplies a plausible thing, and every check you have goes green on a product decision nobody made. Knowledge gaps are closeable; judgement gaps are not.

**★ An agent's refactor produced an identical settled DOM and the route got slower. Explain.**
Almost certainly a boundary moved. A `<Suspense>` boundary defines where the static shell ends, so moving it up shrinks the prerendered portion while the same components still render the same markup in the same order — the final DOM cannot distinguish the two. The other common cause is a request-time API read in a shared layout, which opts the whole route into dynamic rendering from a file the route's reviewer never opened. Both are tree-global effects with file-local diffs, which is why the diff is the wrong artefact for boundary review; the route classification before and after is the right one.

**★ Why does the instant-navigation failure defeat every default verification an agent will attempt?**
Because the insight is deliberately absent from the response. The route returns `200` with correct rendered HTML, so requesting it proves nothing; the HTML is unchanged, so diffing it proves nothing; the settled DOM is unchanged, so a normal end-to-end test passes; and the build is clean. The signal exists only in the dev overlay, the dev-server log, and the MCP `get_errors` tool. An agent that verified by observing the response verified honestly and learned nothing, which is why the loop has to read `get_errors` and why the assertion is written before the change.

**★ Why is PPR advice recalled from training data specifically dangerous right now?**
Because it is wrong in two directions at once. 16 removed the experimental PPR flag and the `experimental_ppr` route segment config, so the older advice references configuration that no longer exists — and the upgrade guide adds the sharper warning that PPR in 16 *works differently* from the 15 canaries, telling anyone using it today to stay on their current 15 canary. So an agent can be confidently wrong about the API, and separately confidently wrong about the semantics, while producing code that looks exactly like the examples it learned from. Under `cacheComponents` the behaviour is the default rather than a flag, which is the part the older material cannot express at all.

**Why does adding `'use cache'` to clear a build error sometimes leave the route slower than before?**
Because the directive changes what is *allowed*, not what is *achieved*. If the `cacheLife` profile attached to the scope has a `revalidate` shorter than the prerender's effective lifetime, the scope is kept out of the prerender, and the route becomes partially dynamic. The error was about uncached data outside a boundary and it is genuinely resolved; the shell is gone as a side effect. The check that catches it is the route classification in the build output, which is why "the build is green" is a weaker signal than it looks.

**What does `server-only` actually guarantee, and what does an agent still get wrong?**
It guarantees import direction: a client module importing a server module fails the build, which is a real and valuable check. It says nothing about placement. Code that has been moved to the wrong side of a boundary, or a boundary that has been moved around correct code, imports nothing it should not and passes cleanly. It is one check in a set, not the boundary review.

**Two APIs are adjacent in the docs and one of them is a race condition. How do you keep an agent off the wrong one?**
Not by describing the semantics, because `revalidateTag` and `updateTag` both read as "invalidate this tag" and the difference — read-your-writes — only manifests when the same request reads back what it just wrote. Describe the *call site* instead: inside a Server Action whose result the same request will read, `updateTag`; for tags read by a later request, `revalidateTag`. A rule keyed to a location in the code is checkable in review; a rule keyed to a guarantee is not.

**Which of the failures on this page would a code reviewer plausibly catch, and which would they not?**
A reviewer who knows the codebase catches the `'use client'` addition and the request API in a shared layout, because both are visible lines with known consequences. They will not catch a `cacheLife` profile that is merely plausible, because nothing in the diff says what the right one is; they will not catch a moved `<Suspense>` boundary, because the interesting effect is on a subtree the diff does not show; and they will not catch lost instant navigation, because there is nothing anywhere to see. The dividing line is not reviewer skill — it is whether the consequence is local to the change.

---

← [The verification loop, guardrails and review discipline](05b-the-verification-loop-guardrails-and-review-discipline.md) · [Chapter 14 overview](01-explanation.md) · Next → [What an agent cannot decide](06b-what-an-agent-cannot-decide-and-what-context-files-fix.md)
