---
title: "A Server Action and a Route Handler are both POST endpoints on your own origin — the difference is who is meant to call them and what the framework does for you either way, and every real decision in this topic follows from that one sentence"
sidebar_label: "02 · Hybrid API design"
sidebar_position: 15
description: "Route Handlers and Server Actions side by side: the compile-time swap and the published URL, the four framework protections and the four application checks, sequential dispatch and the single-response re-render, and the Data Access Layer both entry points share."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Next.js · Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions), [Next.js · Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [Next.js · `route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route), [Next.js · Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend), [Next.js · Data Security](https://nextjs.org/docs/app/guides/data-security), [Next.js · `use server`](https://nextjs.org/docs/app/api-reference/directives/use-server) and [Next.js · `use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache) — every page fetched carrying `version: 16.3.4` in its frontmatter.
> Documentation-verified; **no sandbox run**. Load-bearing sentences quoted verbatim throughout.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**Most teams argue about this in the wrong currency: which is nicer to write, which is more testable, which feels more like a real API. Strip the ergonomics away and both are POST endpoints on your origin, reachable by anyone who can shape the request. The framework treats them very differently — an action gets an origin check, a body cap, an encrypted rotating identifier and a response that carries a re-rendered tree; a handler gets a URL you published on purpose and nothing else — but neither gets authentication, authorisation, validation or rate limiting. So the real question is never "which is better". It is "who is meant to call this", followed by "where does the rule that governs it live".**

## The sentence the whole topic rests on

> *"A Server Action runs as a POST request against the page that invokes it. At build time, the `'use server'` directive tells the compiler to swap the function's implementation in client bundles for a reference (an action ID plus a dispatcher) that POSTs back to the server. The implementation stays on the server, but the route is reachable to anyone who can send the same POST. Treat every action as an untrusted entry point."*

And its counterpart on the other side:

> *"Route Handlers are public HTTP endpoints. Any client can access them."*

Two entry points, one threat model. The difference is not exposure — both are exposed — but **addressability**: an action is addressed by an encrypted build artefact that only your own bundle knows how to use and that rotates on deploy, while a handler is addressed by a path you can write into a partner's configuration.

## Side by side

| | Server Action | Route Handler |
|---|---|---|
| Address | encrypted action ID, POSTs to the invoking page's URL | a path you chose, e.g. `/api/posts` |
| Invoked by | `<form action>`, `<button formAction>`, a transition | any HTTP client |
| Methods | POST only | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`; anything else 405s |
| CSRF | `Origin` compared to `Host` / `X-Forwarded-Host`, mismatches rejected | none — yours to implement |
| Body limit | 1MB default, `serverActions.bodySizeLimit` | none by default |
| Concurrency | **one at a time per client** | unconstrained |
| Returns | a serialised value — no status code, no headers | a `Response` — any status, headers, content type, stream |
| Cache updates | `updateTag`, `revalidateTag`, `revalidatePath`, `refresh` | `revalidateTag`, `revalidatePath` (`updateTag` is *"Server Actions only"*) |
| Re-render | ships in the same Flight response when it revalidates | none — it is not a route segment |
| Caching | n/a | not cached by default since v15; `force-static` opts in |
| Survives a deploy | no — IDs rotate | yes — the URL is stable |
| Progressive enhancement | yes, via a form's `action` prop | only as a plain HTML form POST you wire yourself |
| Authn · authz · validation · rate limit | **yours** | **yours** |

That last row is identical, and it is why this topic ends at a Data Access Layer rather than at a preference.

## The decision rule, in one line

**Ask who is meant to call it.** Your own browser running your own bundle → a Server Action, and take the origin check and the single-response re-render for free. Anything else — a webhook, an OAuth redirect, a mobile app, a partner, a crawler, `curl` — → a Route Handler, because an action has no URL to hand out and would reject the request anyway. Reads a Server Component needs → neither; call the source directly, because *"fetch data in Server Components directly from its source, not via Route Handlers."*

The full table, the anti-patterns and the both-doors case are in [02l](02l-the-decision-rule.md).

## Chunks

| # | Chunk | Covers |
|---|---|---|
| b | **[What an action compiles into](02b-what-a-server-action-compiles-into.md)** | the two placements of `'use server'`, the compile-time swap, why the directive *publishes*, the three invocation doors, 🔴 an action has no URL of its own |
| c | **[Closures, action IDs and deploys](02c-closures-action-ids-and-deploys.md)** | closure capture as a wire format, per-build encryption, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, dead-code elimination, 🔴 the 14-day ID cache and "Failed to find Server Action" |
| d | **[What the framework gives you](02d-what-the-framework-gives-an-action.md)** | the four protections verbatim, the `Origin`/`Host` check and `allowedOrigins`, the 1MB cap, 🔴 a Route Handler gets none of them |
| e | **[Authn and authz per entry point](02e-authentication-and-authorisation-at-the-entry-point.md)** | 🔴 render-time gating is not a boundary, IDOR surviving zod, ownership as a `where` predicate, credentials from the envelope |
| f | **[Return values and rate limiting](02f-return-values-and-rate-limiting.md)** | returning an ORM row as a public API, tainting as a net, error-message leakage, loud failure, 🔴 no 429 from an action |
| g | **[Dispatch and the response](02g-sequential-dispatch-and-the-single-response.md)** | one at a time per client, why `Promise.all` does not parallelise, the single Flight response, 🔴 the `revalidateTag` stale-while-revalidate exception |
| h | **[Route Handler mechanics](02h-route-handler-mechanics.md)** | the method table and the automatic 405/`OPTIONS`, per-path ownership and the `page.js` collision, `RouteContext`, the params promise, the read-once body |
| i | **[Route Handler caching](02i-route-handler-caching.md)** | not cached since v15, `force-static`, the Cache Components model, 🔴 `use cache` in a helper and `next-request-in-use-cache` passing `next build` |
| j | **[Handler-only territory](02j-handler-only-territory.md)** | webhooks and raw-body signatures, idempotency, OAuth callbacks and the open-redirect guard, CORS and preflight, 🔴 CORS is not access control |
| k | **[Content types and deployment](02k-content-types-and-the-deployment-envelope.md)** | XML, downloads and streams, `Vary: Accept` negotiation, proxying with validation, `export` mode, 🔴 the four things a lambda host takes away |
| l | **[The decision rule](02l-the-decision-rule.md)** | the caller-driven table, one data-fetching approach, 🔴 why fetching your own handler from a Server Component fails the build |
| m | **[The Data Access Layer](02m-the-data-access-layer.md)** | the three obligations, `React.cache` for identity, `process.env` only in the DAL, what `import 'server-only'` enforces, classes as a guard |
| n | **[Thin entry points](02n-thin-entry-points-over-one-rule.md)** | the DAL for mutations, a `'use server'` file that is also `server-only`, two doors one rule, the audit checklist as a set of greps |

## Phase gate

You are done with this topic when, given a described feature, you can name the entry point and justify it by the **caller** rather than by taste; when you can list the four things Next.js does for an action and the four it does not, without looking; when you can explain why `Promise.all` over actions is not parallel and why a save that calls `revalidateTag` can leave the screen stale; and when you can point at exactly one file in a codebase and say "that is where the ownership check for this operation lives."

## Where this connects

- [01 · Database integrations](01-database-integrations-serverless-postgres-neon-prisma-drizzl.md) — the connection the DAL holds, and [01ga](01ga-where-the-prisma-instance-lives.md) for where the client is constructed
- [03 · Real-time: SSE and WebSockets](03-real-time-server-sent-events-and-websockets-in-a-serverless.md) — the streaming case a handler owns, and the lambda constraints from [02k](02k-content-types-and-the-deployment-envelope.md)
- [04 · Background jobs and message queues](04-background-jobs-and-message-queues-for-async-workloads.md) — where work goes when it will not fit inside a request
- [10 · Forms, authentication and security hardening](../10-forms-authentication-and-security-hardening/01-server-actions-for-mutations-with-useactionstate-and-useopti.md) — the form-side ergonomics of the same actions, and [03h](../10-forms-authentication-and-security-hardening/03h-the-trust-boundary-around-a-server-action.md) for the trust boundary from the auth side
- [05 · Caching, PPR and Cache Components](../05-caching-ppr-and-cache-components/02-the-use-cache-directive-and-custom-cachelife-profiles.md) — the `use cache` model that [02i](02i-route-handler-caching.md) applies to handlers

## Gotchas

**★ Symptom: the entry-point choice is being made on style, and the review keeps relitigating it.** Cause: the question was framed as "which is better" rather than "who calls it". Fix: make the caller the tie-breaker in writing — your own bundle means an action, anything else means a handler, and a read a Server Component needs means neither.

**★ Symptom: the same capability exists twice with two different security postures.** Cause: an action and a handler each grew their own copy of the authorisation rule. Fix: both become three lines over one `server-only` function ([02n](02n-thin-entry-points-over-one-rule.md)).

**★ Symptom: a team believes actions are "internal" and handlers are "public".** Cause: the ergonomics imply a privacy that does not exist — an action's implementation is private, its endpoint is not. Fix: reread the compile-time swap in [02b](02b-what-a-server-action-compiles-into.md); both entry points are public, and only the addressability differs.

**Symptom: a migration to "proper REST endpoints" quietly removes CSRF protection across the app.** Cause: the four framework protections travel with the action, not with the mutation. Fix: [02d](02d-what-the-framework-gives-an-action.md) enumerates what you are giving up before you give it up.

## Interview questions

**★ Are Server Actions more secure than Route Handlers?**
They arrive with more framework machinery — an `Origin`/`Host` comparison, a 1MB body cap, an encrypted rotating identifier and dead-code elimination — and all four are genuine. But every one of them is about the transport, and none is about the caller: an action with no `auth()` call is an unauthenticated public endpoint, exactly like an unguarded handler. The documentation is unambiguous that the route *"is reachable to anyone who can send the same POST"* and that you should *"treat every action as an untrusted entry point."* So the honest answer is that actions have a better default posture and identical obligations, and a team that hears "more secure" and stops writing checks is worse off than one that heard nothing.

**★ Two engineers disagree: one wants every mutation behind `/api`, the other wants everything as a Server Action. What do you tell them?**
That they are both answering a question the caller has already answered. If a mutation is only ever triggered by your own UI, an action is the better default because the framework contributes protections you would otherwise rebuild and the response carries a re-rendered tree, removing a follow-up fetch. If anything else must call it — a webhook, a partner, a mobile client — a handler is not preferable but mandatory, since an action has no publishable URL and its identifier rotates on deploy. When a capability genuinely has both audiences, the answer is both entry points over one `server-only` function, so the disagreement stops being architectural and becomes a two-line file each.

**★ What is the single most important structural decision in this topic?**
Where the authorisation rule lives. Everything else — which entry point, which cache function, which status code — is transport detail that can be changed in an afternoon. But if the rule is written per entry point, then every new door is a new copy, copies drift, and the drifted one is the one nobody reviews. Putting authentication, authorisation and DTO shaping in a `server-only` Data Access Layer makes the number of places the rule lives independent of the number of doors, which is why the official audit checklist asks *"Is database access delegated to a `server-only` Data Access Layer?"* rather than asking whether each action is individually correct.

**Why does this topic spend so long on things that are not about choosing?**
Because the choice is easy once the mechanics are known and impossible before. "Which should I use" is genuinely answered by one question about the caller — but knowing that a webhook cannot use an action requires knowing that action IDs are rotating build artefacts; knowing that typeahead cannot use one requires knowing about the per-client queue; knowing that a handler for your own UI costs you something requires knowing which four protections you just gave up. The decision rule is one page ([02l](02l-the-decision-rule.md)); the reason each row of it is true is the rest.

---

← [01 · Database integrations](01-database-integrations-serverless-postgres-neon-prisma-drizzl.md) · Next → [02b · What an action compiles into](02b-what-a-server-action-compiles-into.md)
