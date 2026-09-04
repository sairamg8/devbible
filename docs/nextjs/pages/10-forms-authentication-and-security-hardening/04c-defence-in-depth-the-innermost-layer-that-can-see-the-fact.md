---
title: "Defence in depth is not \"check in several places\" — it is the rule that a control belongs at the innermost layer that can see the fact it depends on, and everything outside that layer is a filter"
sidebar_label: "04c · The innermost layer that can see the fact"
sidebar_position: 22
description: "The six layers of a Next.js request and what each can genuinely enforce, why the placement rule is a rule rather than a preference, why the innermost layer also has the fewest entry points, and the one control the rule pushes outward instead of inward."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [How to think about data security in Next.js](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`), [How to implement authentication in Next.js](https://nextjs.org/docs/app/guides/authentication) (`lastUpdated: 2026-08-25`) and [`proxy.js`](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified; **no sandbox run**. Prior page: [04b · Matchers, runtime and the rename](04b-proxy-configuration-matchers-runtime-and-what-the-rename-meant.md).

**"Defence in depth" is usually taught as *check in several places*, which is both true and useless — it gives you no way to decide where a given check goes, so it produces four duplicated half-checks and no gate. The usable version is a placement rule: **a control belongs at the innermost layer that can see the fact it depends on.** "Is there a session cookie" is visible at the proxy, so the proxy may filter on it. "Does user 7 own project 42" is a row, and rows are visible only where the query runs — so that control lives in the Data Access Layer and nowhere else. Every layer outside the one that can see the fact is a filter: valuable for cost, latency and user experience, worthless as a guarantee. [04d](04d-the-three-places-the-gate-cannot-hold.md) takes the three layers people most often mistake for the gate.**

## The six layers, and what each can genuinely enforce

| Layer | What it can see | What it can enforce | What it structurally cannot |
|---|---|---|---|
| **Network / CDN / WAF** | IP, TLS, raw HTTP, request rate | IP blocks, rate limits, request-size caps, bot rules | Anything about identity or data |
| **`proxy.ts`** | URL, headers, cookies — *"before routes are rendered"* | "A session cookie exists and decrypts", a coarse route bounce, static-route gating | Which route will handle it, which row it will read, whether the session was revoked |
| **Page / layout render** | Session, params, whatever it fetches | Which UI it emits | Whether nested segments, parallel slots or Server Functions run at all |
| **Server Function (`'use server'`)** | Session, its own arguments | Authentication and authorization for that one mutation | Anything it does not itself read; it is reached by direct POST regardless of UI |
| **Data Access Layer** | Session **and** the row | Ownership, roles, field-level visibility, the DTO shape | Whatever a caller does with a raw handle obtained elsewhere |
| **Database** | Rows, connection context | Row-level security, constraints, grants | Application intent |

Two rows in that table are routinely mistaken for gates. The **page/layout render** row is the one people trust most and it enforces the least — it decides what UI it emits and nothing else. The **proxy** row is what [04](04-defense-in-depth-proxyts-as-a-coarse-filter.md) takes apart in detail. Both mistakes have the same shape: a layer that can *see* the session is assumed to be able to *stop* things, and seeing is not stopping.

## The rule, and why it is a rule rather than a preference

A control is a predicate over some fact. If a layer cannot observe the fact, it cannot evaluate the predicate — it can only evaluate a **stand-in** for the predicate. A URL prefix stands in for a membership. A cookie stands in for a live session. A rendered form stands in for permission to submit it.

Stand-ins drift, because the mapping between the stand-in and the real fact is maintained by hand and nothing enforces it. `/dashboard/*` means "members only" until someone mounts a public status page under it. A decrypting cookie means "logged in" until an account is suspended. Every one of those drifts is a routine, reasonable change that nobody would flag in review, because the code that encodes the mapping is nowhere near the code that changed.

Push the control inward until the layer reads the fact directly, and the drift has nowhere to live: the check and the data it depends on are now in the same function, and there is no mapping left to rot. That is the entire argument, and the documented recommendation falls out of it as a corollary:

> *"While Proxy can be useful for initial checks, it should not be your only line of defense in protecting your data. The majority of security checks should be performed as close as possible to your data source."*

### The second payoff: entry points

Pushing inward buys something less obvious and arguably more valuable. **The innermost layer has the fewest ways in.**

| Layer | Reachable by |
|---|---|
| Page | Direct visit · client-side navigation · RSC prefetch · `_next/data` request |
| Server Function | Form submit · client-side call · a bare `curl` POST to the route it is used on |
| `getProjectDTO()` | Being called |

A check at a layer with four entry points has to be correct for four request shapes, and the framework is actively working against you on one of them: proxy cannot even tell an RSC navigation from an HTML load, because Next.js strips `rsc`, `next-router-state-tree` and `next-router-prefetch` from `request.headers` *"to prevent accidentally handling an RSC request differently than the HTML request as both need to align."* A check inside a function has exactly one entry point, and it is a function call.

## The gate: the fact and the check in one function

The predicate the proxy could not evaluate, evaluated where the row is:

```ts filename="app/lib/dal.ts"
import 'server-only'

import { cache } from 'react'
import { db } from '@/app/lib/db'
import { verifySession } from '@/app/lib/session'

export const getProjectDTO = cache(async (projectId: string) => {
  // The viewer comes from the cookie, never from a parameter.
  const session = await verifySession()

  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      memberIds: true,
      billingAccountId: true,
    },
  })
  if (!project) return null

  // This is the fact. It is a row, so this is the only layer that can see it.
  const isMember =
    project.ownerId === session.userId ||
    project.memberIds.includes(session.userId)
  if (!isMember) return null

  // ownerId, memberIds and billingAccountId stay on the server.
  return { id: project.id, name: project.name }
})
```

Every entry point that wants this project must call this function, so every entry point is gated by construction rather than by discipline. The page becomes trivial and, importantly, carries no authorization logic of its own:

```tsx filename="app/dashboard/projects/[id]/page.tsx"
import { notFound } from 'next/navigation'
import { getProjectDTO } from '@/app/lib/dal'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = await getProjectDTO(id)
  if (!project) notFound()

  return <h1>{project.name}</h1>
}
```

🔴 **This page does not teach how to build a Data Access Layer** — its three rules, `server-only`, the `cache()` memoization, the `process.env` restriction and the DTO shape are all owned by [03b · The Data Access Layer](03b-the-data-access-layer-server-only-and-the-dto.md). What this page argues is *why the gate lands there* rather than one layer up, and the argument has to stand on its own because the same reasoning will place other controls in other places.

Two supporting quotes from the data-security guide, which describe the payoff in the framework's own terms:

> *"This approach centralizes all data access logic, making it easier to enforce consistent data access and reduces the risk of authorization bugs. You also get the benefit of sharing an in-memory cache across different parts of a request."*

> *"We recommend choosing one data fetching approach and avoiding mixing them. This makes it clear for both developers working in your code base and security auditors what to expect."*

That second one is a rule about *auditability*, not tidiness. A codebase where some pages go through the DAL, some run `sql` inline and some `fetch` an internal HTTP API has no answer to "where is authorization enforced", which means an audit cannot conclude anything at all — not "insecure", just *unknown*.

## The rule cuts outward too

The rule is symmetric, and forgetting that produces a different failure. **Rate limiting** depends on a fact — how many requests this client has made recently — that the outer layers see as well or better, and that the inner layers only see after paying for the work being limited. So rate limiting belongs at the network edge, and pushing it inward is the same category of error as pushing ownership checks outward.

The data-security guide scopes its in-application advice accordingly:

> *"For expensive operations (sending emails, writing to a database), consider adding rate limiting to prevent abuse."*

That is a second line behind the edge, aimed at *specific expensive operations*, not a replacement for it. The 2026 CVE record makes the point empirically: per [14](14-the-2026-cve-record-eleven-vulnerabilities-and-what-each-one-teaches.md), CVE-2026-64641 drives CPU exhaustion in an App Router application with at least one Server Action, and the recorded consequence is that the CPU usage blocks the processing of further requests in the same process. A limit inside the process cannot help with a bug that starves the process.

Applying the rule honestly therefore gives you a short list per fact:

| Fact the control depends on | Innermost layer that sees it | Where the control goes |
|---|---|---|
| Request rate from this client | Network edge | CDN / WAF |
| Request body size | Framework request handling | Server Actions body limit; edge caps |
| A session cookie exists | `proxy.ts` | Proxy — as a **filter** |
| The session is still valid | Session store read | DAL |
| This user owns this row | The query | DAL — **the gate** |
| No query may cross tenants | The connection | Database RLS |

## One gate, named, plus filters

The practical output of all of this is not more checks. It is the same number of checks with one of them labelled. Exactly one layer is the control for a given fact; everything outside it is documented, in code, as a filter that is allowed to be wrong without it being a breach:

```ts filename="proxy.ts"
// FILTER ONLY — bounces obviously-anonymous traffic to save a render.
// The GATE for project access is getProjectDTO() in app/lib/dal.ts.
// If this file stops running, the worst outcome is a wasted render.
```

That comment is the cheapest security artifact in the codebase and the one most often missing. Without it, the next reader cannot tell a filter from a gate, so they either strengthen the filter (wasted work, and it still cannot see the row) or weaken the gate (a breach).

## Gotchas

**★ Symptom: four layers each perform a partial check and nobody can say which one is authoritative.**
Cause: "defence in depth" read as "check everywhere" rather than as a placement rule. The checks then drift independently — the proxy's route list, the layout's role test and the action's session read stop agreeing after two refactors, and nobody can say which was supposed to be correct.
Fix: name the gate in code, as above, and let the outer checks be explicitly fallible.

**★ Symptom: an authorization bug is fixed by adding a check to the proxy, and the same bug class reappears a month later on a different route.**
Cause: the fix was applied to a stand-in (a URL prefix) rather than to the fact (a row). The next route that needs the same predicate does not inherit it, because the mapping from prefix to predicate is hand-maintained.
Fix: move the predicate into the data read so new call sites inherit it by construction.

```ts filename="app/lib/dal.ts"
// Not: proxy matches '/reports/*' and checks a role claim.
// But: every reports query resolves the viewer and filters by it.
export const getReportDTO = cache(async (reportId: string) => {
  const session = await verifySession()
  const report = await db.report.findFirst({
    where: { id: reportId, orgId: session.orgId },
    select: { id: true, title: true, generatedAt: true },
  })
  return report ?? null
})
```

**★ Symptom: rate limiting was implemented in the Data Access Layer and does nothing about the load.**
Cause: the fact it depends on — request volume — is observable at the edge, and the DAL only sees it after the request has already cost you a render. The rule applies in both directions.
Fix: limit at the CDN or in front of the application; keep in-application limiting for *"expensive operations (sending emails, writing to a database)"* as a second line.

**★ Symptom: a page-level `redirect('/login')` is treated as protecting the Server Actions defined on that page.**
Cause: the render and the action are different entry points. The data-security guide is explicit: *"A page-level authentication check does not extend to the Server Actions defined within it. Always re-verify inside the action."*
Fix: the action's first statement is a DAL call, so the check is attached to the data rather than to the route. The per-action treatment is [01 · Server Actions: where the check lives](01-server-actions-for-mutations-with-useactionstate-and-useopti.md).

**★ Symptom: the DAL exists, and half the codebase still runs `sql` inline in Server Components.**
Cause: the guide's three data-fetching approaches — external HTTP APIs, Data Access Layer, component-level access — were treated as a menu per feature rather than a decision per project.
Fix: pick one and make the others fail lint, so the convention survives contact with a deadline.

```js filename="eslint.config.js"
// The DAL is only a boundary if nothing else can import the database client.
{
  files: ['app/**/*.{ts,tsx}'],
  ignores: ['app/lib/dal/**'],
  rules: {
    'no-restricted-imports': [
      'error',
      { paths: [{ name: '@/app/lib/db', message: 'Query through app/lib/dal.' }] },
    ],
  },
}
```

**★ Symptom: a control is placed at the proxy "for defence in depth" and the team stops adding the inner one.**
Cause: an outer filter feels like progress and is visible in a diff, while the inner gate is invisible until something goes wrong. Defence in depth becomes a reason to stop early rather than a reason to go further.
Fix: order the work inward. Write the gate first, then add outer filters for cost and UX — never the reverse. A codebase with the gate and no filter is secure and slightly wasteful; a codebase with the filter and no gate is neither.

## Interview questions

**★ State the placement rule for a security control in one sentence, and derive the standard Next.js advice from it.**
A control belongs at the innermost layer that can observe the fact it depends on. "Does a session cookie exist" is observable at the proxy, so the proxy may filter on it; "does this user own this project" is a row, observable only where the query runs, so it belongs in the Data Access Layer. That single rule yields the documented advice as a corollary — *"the majority of security checks should be performed as close as possible to your data source"* — and, unlike "check in several places", it tells you where a given check goes and, just as importantly, which layers are merely filters.

**★ Why do outer-layer checks drift, in terms of the rule rather than in terms of carelessness?**
Because an outer layer cannot evaluate the real predicate, it evaluates a stand-in: a URL prefix for a membership, a decrypting cookie for a live session, a rendered form for permission to submit. The mapping between stand-in and predicate is maintained by hand and enforced by nothing, and it is broken by changes that are individually reasonable — mounting a public page under `/dashboard`, suspending an account without invalidating its cookie. Nobody flags those in review because the code encoding the mapping is nowhere near the code that changed. Move the check inward and the mapping stops existing.

**★ Besides visibility, what does pushing a check inward buy you?**
Fewer entry points. A page is reachable by direct visit, client-side navigation, RSC prefetch and `_next/data` request; a Server Function by a form submit, a client-side call, or a bare POST; a DAL function only by being called. A check at the page has to be right for four request shapes, and the framework deliberately hides one distinction from you — proxy cannot tell an RSC navigation from an HTML load because Next.js strips the Flight headers *"to prevent accidentally handling an RSC request differently than the HTML request."* One entry point is a much easier thing to be correct about than four.

**★ Where does rate limiting belong under this rule, and why is that not a contradiction?**
At the network edge, because the fact it depends on — request volume from this client — is visible there and is *not* better observed further in; the inner layers only learn about it after paying for the work you were trying to prevent. The rule is symmetric: innermost layer *that can see the fact*, which for volume is outer. CVE-2026-64641 in the chapter's CVE record makes it concrete — CPU exhaustion in an App Router application with at least one Server Action blocks further requests in the same process, and a limiter inside that process cannot help.

**★ The data-security guide says to pick one data-fetching approach and not mix them. Why is that a security rule rather than a style rule?**
Because it is a statement about auditability. It says explicitly that the point is to make it *"clear for both developers working in your code base and security auditors what to expect."* A codebase with three approaches has no single place where authorization is known to happen, so a reviewer cannot conclude anything — not "insecure", just *unknown*, which is the worse finding because it cannot be remediated by a patch. One approach means one question to answer and one place to answer it.

**★ Why is "check in several places" a worse formulation of defence in depth than "one gate plus filters"?**
Because it gives no criterion for placement, so every layer ends up with a partial check and none of them is authoritative. Partial checks drift independently and a reader cannot tell which was meant to be load-bearing. "One gate plus filters" keeps the same number of checks and adds the one thing that matters — a named layer that is allowed to be wrong nowhere, and outer layers that are allowed to be wrong without it being a breach. It also makes the incident report tractable: when a filter fails you lost a redirect, when the gate fails you lost the data.

**★ A colleague adds an authorization check to `proxy.ts` and closes the ticket. What do you ask in review?**
Which fact the check depends on, and whether the proxy can see it. If it is "a session cookie exists", fine — that is a filter, and it should be labelled as one in a comment so the next reader does not mistake it for the gate. If it is anything about a resource, ask where the row is read and whether that function refuses on its own; if it does not, the proxy check is a stand-in that will drift, and the ticket is not closed. The follow-up question is what happens if proxy does not run at all — per the CVE record, CVE-2026-64642 was a proxy bypass, so "it always runs" is not an assumption the record supports.

---

← [04b · Matchers, runtime and the rename](04b-proxy-configuration-matchers-runtime-and-what-the-rename-meant.md) · [Chapter 10 overview](01-explanation.md) · Next → [04d · The three places the gate cannot hold](04d-the-three-places-the-gate-cannot-hold.md)
