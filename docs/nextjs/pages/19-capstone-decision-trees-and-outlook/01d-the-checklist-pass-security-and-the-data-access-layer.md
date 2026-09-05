---
title: "The security half of the checklist has not aged a day, and running it over SprintDesk turns four short bullets into eleven findings — because every clause in them assumes a mental model the application had to build on purpose"
sidebar_label: "01d · Checklist pass: security"
sidebar_position: 12
description: "The Server Actions bullet expanded clause by clause against what SprintDesk actually built, the tenancy predicate as the highest-value invariant in the codebase, tainting, environment variables, rate limiting, and what sign-out does not clear."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 — this page composes material already verified across chapters 10, 13 and 15 of this book against the Next.js 16.3.4 documentation, and takes its checklist structure from [How to optimize your Next.js application for production](https://nextjs.org/docs/app/guides/production-checklist) as expanded in [Appendix D part 2](../20-appendices/04b-appendix-d-security.md). It introduces no new framework claims of its own; every quotation below is reproduced from a page of this book that cites its primary source.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **Next.js 16.3.4** · React canary bundled by the App Router · Node.js **24.20.0**.

**[01c](01c-the-checklist-pass-rendering-caching-and-the-build.md) found four checklist items that 16 made obsolete. This half of the checklist has the opposite problem: nothing on it is out of date, and everything on it is denser than it looks. One bullet about Server Actions contains four separate instructions, each of which took SprintDesk a milestone to satisfy, and each of which fails silently and completely when it is not satisfied. This page expands that bullet clause by clause against what the application actually built, adds the multi-tenancy predicate the published checklist has no line for at all, and records the observation for each — because "we check authorization" is the single most common sentence said about an application that does not.**

## Why the security half aged differently

Appendix D part 2 puts it plainly: the tooling advice describes a release that no longer exists, while *"every item still holds, and every item is denser than it looks"*. The reason is structural. The tooling items name APIs, and APIs move. The security items name **properties of the RSC boundary** — that props crossing it are on the wire, that a Server Action is a public endpoint, that a prefix decides whether a value reaches a browser — and none of those has changed because none of them is a feature.

🔴 **So the honest framing for a review is that the security half is not a checklist you can fall behind on. It is one you can only fail to have understood.**

## 1 · The bullet that carries the most weight

> *"**Server Actions**: Verify authentication and authorization inside each action. Do not rely on Proxy or layout or page level checks alone. Move database access to a `server-only` Data Access Layer and consider rate limiting for expensive operations."*
> — quoted in [Appendix D part 2](../20-appendices/04b-appendix-d-security.md)

Four instructions. SprintDesk satisfies three cleanly and the fourth partially, and the fourth is the one this pass records as an open finding.

### Clause 1 · "Verify authentication and authorization inside each action"

The reason is the glossary's own definition of the thing:

> **Server Action** — *"A Server Function that is passed to a Client Component as a prop or bound to a form action."*

The moment a `"use server"` function crosses that boundary it acquires an ID and an HTTP entry point. **It is a public POST endpoint that anyone can call, in any order, with any arguments, without ever loading the page it lives on.** Chapter 15's milestone states the consequence as a seam: *"A Server Action is a POST route reachable by anyone who can send the same POST. The page's `auth()` check does not protect it."*

Chapter 10's [authorization on writes](../10-forms-authentication-and-security-hardening/06h-milestone-authorization-on-writes.md) is the milestone that closed this, and the shape it committed to is two checks, not one:

```ts
'use server'
import { requireBoardAccess } from '@/lib/dal'

export async function moveCard(cardId: string, toBoardId: string, position: number) {
  const user = await requireBoardAccess(toBoardId)  // authentication AND authorization
  // …
}
```

🔴 **A session check alone is a horizontal privilege escalation.** `if (!session) throw` establishes that somebody is signed in and never asks whether *this* user has any relationship to the row being acted on — and the review heuristic "does this action verify auth" returns true for every one of them.

**The observation:** a negative test. A valid session acting on another team's id, expected to fail. Nothing else distinguishes an action that checks the relationship from one that checks only the session, because both pass every positive test you will ever write.

### Clause 2 · "Do not rely on Proxy or layout or page level checks alone"

The layout half of that clause is the most commonly-mishandled idea in App Router authentication, and the documentation gives two independent reasons:

> *"Due to Partial Rendering, be cautious when doing checks in Layouts as these don't re-render on navigation, meaning the user session won't be checked on every route change."*
>
> *"A layout also does not control whether the rest of the route renders. Route segments and parallel route slots are rendered by the router, so a layout that hides or swaps them does not stop them from running or from appearing in the RSC Payload."*
> — Authentication guide, quoted in [ch10 · the layout is not a boundary](../10-forms-authentication-and-security-hardening/06e-milestone-the-layout-is-not-a-boundary.md)

Read the second one carefully, because it is the part people are surprised by. A layout that renders a sign-in wall instead of its children **has not stopped the children from running.** They executed, they queried the database, and their output is in the RSC payload that was sent to the browser. The layout chose what to *display*. Hiding is not protecting.

The Proxy half is the same argument at a different layer, and chapter 10 accepted it deliberately: SprintDesk's `proxy.ts` exists to redirect the obviously-signed-out fast, so nobody watches a dashboard skeleton resolve into a login page. It is UX, and the documentation is the thing telling you not to rely on it as control ([ch10 · proxy as UX, not control](../10-forms-authentication-and-security-hardening/06l-milestone-proxy-as-ux-not-control.md)).

**The observation:** there is no `(protected)` route group whose layout performs the check. If there is one, the check is decorative regardless of how it reads.

### Clause 3 · "Move database access to a `server-only` Data Access Layer"

SprintDesk's is chapter 10's [06d](../10-forms-authentication-and-security-hardening/06d-milestone-the-data-access-layer.md), and `server-only` is the enforcement rather than the convention: importing it makes the module a build error if it is ever reachable from a client bundle. A naming convention documents an intention and enforces nothing.

The stronger half is *where the authorisation lives*. Appendix D part 2 shows it in the query rather than beside it:

```ts
return db.projects.findFirst({
  where: { id: projectId, members: { some: { userId: session.userId } } },
})
```

A user who is not a member does not get a "Forbidden" — they get nothing, because the row was never selected. **Rules that live in the query cannot be forgotten at a call site**, which is the entire argument for the layer.

**The observation:** `grep -rn "\bauth()" app lib | grep -v "lib/dal"` prints nothing, and `grep -rn "from '@/db'" app components` prints nothing. Both are decay checks — the decision was made once and holds only while nothing routes around it.

### Clause 4 · "Consider rate limiting for expensive operations" — 🔴 SprintDesk's open finding

Chapter 15 is direct about why "consider" is too soft: an action's *"invocation rate is unbounded"*, and there is no `429` to return because an action returns a value rather than a status ([ch15 · return values and rate limiting](../15-databases-apis-and-full-stack-patterns/02f-return-values-and-rate-limiting.md)).

SprintDesk has three operations whose cost is borne outside the request:

| Operation | Why it is expensive | Limited today |
|---|---|---|
| digest email enqueue | sends mail; cost and reputation are external | **no** |
| SSE stream open | holds a connection; browsers cap at 6 per domain without HTTP/2 | **no** |
| attachment upload | writes a large row, calls storage | **no** |

The shape of the fix, keyed on the authenticated identity and placed before any expensive work:

```ts
'use server'
export async function requestDigestNow(boardId: string) {
  const user = await requireBoardAccess(boardId)
  if (!(await rateLimit(`digest:${user.id}`, { max: 3, windowSec: 3600 }))) {
    throw new Error('Too many requests')
  }
  await enqueueDigest(boardId)
}
```

⚠️ **The disabled button in the UI is not on the path an attacker takes.** This is recorded as an open item and carried into [01e](01e-what-sprintdesk-still-does-not-have.md), where it is classified — and it is a **gap**, not a deferral, because nobody ever decided against it.

## 2 · The item the checklist has no line for: the tenancy predicate

SprintDesk is multi-tenant, and chapter 15 states the guarantee in one sentence:

> **In a shared-schema multi-tenant application, the entire isolation guarantee is one `WHERE tenant_id = $1` clause.** It has to appear on every query against every tenant-scoped table, forever, including the query a contractor writes at 5pm on a Friday.
> — [ch15 · tenant isolation in the data access layer](../15-databases-apis-and-full-stack-patterns/10c-tenant-isolation-in-the-data-access-layer.md)

🔴 **And the most common multi-tenant vulnerability is treating the tenant slug in the path as an authorization decision.** It is not; it is a request parameter that a user typed. Every tenant-scoped request resolves the URL's tenant and the session's membership and reconciles them.

SprintDesk makes that structural rather than remembered. Chapter 13 introduced an unforgeable scope type — a `TeamScope` that only `scopeFor()` can produce, checked against the caller's membership — so a query cannot be called without a checked scope. That is a compile-time guarantee, not a convention.

And then the test, which chapter 13 calls the highest-value test in the suite:

```ts
describe('every list query is team-scoped', () => {
  it('emits a team_id predicate', () => {
    const { sql, params } = buildListTasksQuery(
      { teamId: '11111111-1111-1111-1111-111111111111' } as never,
      { status: ['todo'] },
    )
    expect(sql).toContain('team_id = ')
    expect(params).toContain('11111111-1111-1111-1111-111111111111')
  })
})
```

**Why it is worth more than the rest of the suite combined:** the failure mode of forgetting the predicate is *catastrophic and invisible* — the query works, the page renders, and one customer sees another's tasks. No positive test fails. No error is logged. Reviewing for it does not scale, because it is an absence rather than a mistake. This test asserts the predicate reaches SQL, which is the only place the guarantee is real.

⚠️ The design change the test demands — splitting `buildListTasksQuery` from the function that executes it — is worth making anyway, because a builder that returns SQL and parameters is also loggable and reviewable.

## 3 · Props crossing the boundary are on the wire

> *"**Tainting**: Prevent sensitive data from being exposed to the client by tainting data objects and/or specific values."*

The mechanism it defends is not obvious to anyone who has not been told: **props passed into a Client Component are serialized into the RSC Payload in full**, so the browser receives every column of the object, not the two fields your JSX renders. Nothing warns, because it is a perfectly ordinary prop. The same property is why a Server Action's return value is a public surface:

> *"Server Action return values are serialized and sent to the client. Only return what the UI needs, not raw database records."*
> — quoted in [ch15 · return values and rate limiting](../15-databases-apis-and-full-stack-patterns/02f-return-values-and-rate-limiting.md)

SprintDesk's answer is projection at the boundary, made unavoidable by the DAL returning a DTO rather than a row ([ch10 · the Data Access Layer](../10-forms-authentication-and-security-hardening/06d-milestone-the-data-access-layer.md)). Tainting is the net under it, not the design.

**The observation:** open a board page's RSC payload in the network panel and read it. If a field appears there that no component renders, the projection is not happening — and that is a thing you look at, not a thing you configure.

## 4 · Environment variables, and the clause everyone reads backwards

> *"**Environment Variables**: Ensure your `.env.*` files are added to `.gitignore` and only public variables are prefixed with `NEXT_PUBLIC_`."*

Read the second clause in the direction it is written: **only public variables are prefixed** — not "all public variables must be prefixed". `NEXT_PUBLIC_` means *inline this value into the client bundle*, and once a build carrying it has shipped, the value is public forever. Rotation is the only remediation; removing the prefix later does nothing about builds already in browsers and caches.

```bash
grep -rn "NEXT_PUBLIC_" app components lib   # every one of these is published
grep -n "^\.env" .gitignore                  # must cover the .env.* family, not just .env
```

SprintDesk has one deliberate public value — the origin constant from chapter 12, which feeds `metadataBase`, the canonical, the sitemap, `robots.ts` and every absolute URL in a JSON-LD payload. That is exactly what the prefix is for: one value, published on purpose, with five consumers.

## 5 · What sign-out does not clear

Not a checklist item anywhere, and it belongs on this pass because it is the failure that reaches a shared machine. Chapter 10's [sign-out chunk](../10-forms-authentication-and-security-hardening/06k-milestone-sign-out-and-the-caches.md) frames the real question: not *"is the session gone"* but *"what is still sitting in memory that was rendered for the person who just left"* — a per-user cache entry on the server, a private cache in the browser, an RSC payload for a route prefetched three clicks ago.

SprintDesk chose database sessions, so revocation is a `DELETE` and *"sign out everywhere"* is available. **The observation is the shared-machine test:** sign out, press Back, and read what renders.

## Gotchas

**★ Symptom: an authorization bug where any signed-in user can act on any record.** Cause: the action checks authentication and not authorization — a session exists, so the call proceeds with whatever id was passed. Fix: check the relationship, in the query itself so it cannot be skipped, and write the negative test that a valid session acting on someone else's id must fail.

**★ Symptom: a `(protected)` route group's layout renders a sign-in wall, and data for the protected route is in the RSC payload anyway.** Cause: a layout chooses what to display, not what to render — route segments and parallel route slots are rendered by the router regardless. Fix: move the check into the data access layer the segments call, and treat the layout as presentation.

**★ Symptom: `proxy.ts` gates `/boards/*` and a user who was removed from a team can still move its cards.** Cause: Proxy runs on requests for pages; a Server Action invoked from an already-loaded page is a different entry point. Fix: check inside the action, through the same DAL the Route Handlers use. The checklist says this in as many words.

**★ Symptom: a review confirms "every action calls `requireBoardAccess`" and a tenancy leak ships anyway.** Cause: the DAL function was called and the query it runs lost its `team_id` predicate — the authorization check and the isolation predicate are two different things. Fix: the unforgeable scope type, so a query cannot be built without a checked scope, plus the test that asserts the predicate reaches SQL.

**★ Symptom: a tenant sees another tenant's board, and the URL was correct for the user who reported it.** Cause: the tenant slug in the path was treated as an authorization decision. It is a request parameter a user typed. Fix: resolve the URL's tenant and the session's membership separately and reconcile them; a mismatch throws before any query runs.

**★ Symptom: a Client Component renders a display name and the page source contains fields nobody rendered.** Cause: the whole row was passed as a prop, and props are serialized into the RSC Payload in full. Fix: project at the boundary — which the DAL already does by returning a DTO — and taint the source object so the next person cannot repeat it.

**★ Symptom: a Server Action that enqueues a digest is called ten thousand times in an hour.** Cause: the button was disabled in the UI and the endpoint was not limited; an action's invocation rate is unbounded and there is no `429` for it to return. Fix: rate limit inside the action, keyed on the authenticated user, before any expensive work — shown above.

**★ Symptom: a secret is in the client bundle and removing the prefix does not fix it.** Cause: `NEXT_PUBLIC_` does not mean "make available", it means "inline into the bundle", and shipped builds are already in browsers and caches. Fix: rotate the value, then remove the prefix. There is no unpublish.

**★ Symptom: `.env.local` is in the repository.** Cause: `.gitignore` covers `.env` and not the `.env.*` family. Fix: ignore the family, and treat any value ever committed as compromised — rotate rather than delete.

**★ Symptom: a Server Action validates its input in the form and nowhere else, and a malformed id reaches the database.** Cause: treating the form as the boundary. The action accepts whatever a caller serializes to it, including types your `select` could never produce. Fix: schema-parse as the action's first statement, authorize against the parsed values as its second.

**★ Symptom: a signed-out user presses Back on a shared machine and sees the previous user's board.** Cause: sign-out deleted a row and a cookie and touched no cache — the server's per-user entry, the browser's private cache and a prefetched RSC payload all survive it. Fix: enumerate what survives and invalidate the parts that must not, then verify with the Back-button test rather than by reading the sign-out handler.

**★ Symptom: a database helper ends up in a client bundle and nobody notices until a secret is in the browser.** Cause: nothing marks the module as server-only, so an innocent import from a Client Component pulls it across. Fix: `import 'server-only'` at the top, which converts a runtime disclosure into a failed build caught by the person who made it.

## Interview questions

**★ Why must authorization live inside a Server Action rather than in the page that renders the form?**
Because they are different entry points to the same server. A Server Action passed to a Client Component acquires an ID and a public HTTP endpoint; anybody can invoke it directly, with arbitrary arguments, without ever requesting the page. The page's check runs on the page request and simply does not execute on the action invocation. Treating the page check as protection means the security of a mutation depends on the attacker choosing to use your UI, which is not a property anyone can rely on — and the checklist is unusually direct about it: verify inside each action, do not rely on Proxy, layout or page-level checks alone.

**★ A layout renders a sign-in wall instead of its children. What has it actually prevented?**
Display, and nothing else. Route segments and parallel route slots are rendered by the router, so a layout that hides or swaps them does not stop them running, does not stop them querying, and does not stop their output appearing in the RSC Payload that goes to the browser. There is a second, independent reason not to put the check there: layouts do not re-render on navigation because of Partial Rendering, so the session is not re-checked on every route change. One of those reasons is about security and one is about correctness over time, and a layout check fails both.

**★ What is the difference between the authorization check and the tenancy predicate, given both are "authorization"?**
The check answers *may this user act at all*, and it runs once per entry point. The predicate answers *which rows exist for this user*, and it must appear on every query against every tenant-scoped table, forever. An application can pass a review of the first and leak on the second: every action calls `requireBoardAccess`, every call succeeds, and one query lost its `WHERE team_id` clause in a refactor. That is why the strongest form puts the predicate in the query rather than beside it — a non-member gets nothing rather than a "Forbidden", because the row was never selected — and why the scope is an unforgeable type rather than a string.

**★ Why is one tenancy test described as worth more than the rest of the suite combined?**
Because of the shape of the failure it catches. Forgetting a tenancy predicate produces no error, no exception and no failing assertion anywhere else: the query runs, the page renders, and one customer sees another customer's data. Every positive test passes, code review does not scale to catching an absence, and the incident arrives as a customer email rather than as an alert. A test that asserts the predicate reaches the emitted SQL is the only artefact in the suite that can fail for this reason, and the cost of the failure it prevents is categorically different from a rendering bug.

**★ `NEXT_PUBLIC_` — what are the exact semantics, and why is it irreversible?**
It means the value is inlined into the client bundle at build time. Not readable-if-requested; physically present in shipped JavaScript. Once a build carrying it has been served the value is public, and the only remediation is rotation — removing the prefix in a later build does nothing about the builds already sitting in browsers and CDN caches. That is why the checklist's phrasing is *only* public variables are prefixed: it is a publication decision, not an accessibility one, and the correct number of prefixed variables in most applications is very small and deliberately chosen.

**★ Rate limiting appears on the checklist as "consider". When is it not optional?**
Whenever the cost of the operation is borne outside the request — sending mail, calling a metered API, holding a connection, writing a large row, or anything that can be used to enumerate. Those are not performance concerns; an unlimited endpoint that sends email is an abuse vector and a bill. Two properties of Server Actions make it sharper than it looks: the invocation rate is unbounded by anything in the framework, and there is no status code to return, because an action returns a value rather than a response. So the limit has to be enforced inside the action, keyed on the authenticated identity, before the expensive work starts — and the disabled button in the UI is irrelevant, because it is not on the path an attacker takes.

**★ What does tainting defend against that projection does not?**
The next person. Projection at the boundary is the design and it is correct; tainting is the net that fails the build when somebody bypasses it. The accident it names is specific: props crossing into a Client Component are serialized into the RSC Payload in full, so passing a database row to render a display name ships every column of that row. Nothing warns, because it is an ordinary prop. Tainting marks an object or value so that passing it across the boundary fails, which converts a silent disclosure into an error at the moment it is written.

**★ Sign-out deletes the session row and the cookie. What is still there?**
Everything that was rendered while the session was alive. A per-user cache entry on the server, the browser's own private cache, and the RSC payload of a route that was prefetched three clicks ago. None of it is automatically discarded and most of it does not need to be — the question is which parts do, and the answer is product-specific. The check is not reading the sign-out handler, it is the shared-machine test: sign out, press Back, and read what renders. That is the scenario the feature exists for, and it is the only one that distinguishes a sign-out that works from one that works except in the meeting room.

**★ Which of these findings would you fix first on a Monday morning?**
The negative authorization test, because it is the cheapest artefact that can detect the most expensive failure, and because until it exists nobody can tell the difference between an application that checks relationships and one that checks sessions. Second, the rate limits on the three operations whose cost leaves the request, because that is an open gap rather than a decision anybody made. The tenancy predicate is already structural here — an unforgeable scope type plus a test asserting the clause reaches SQL — which is why it does not appear on this list, and it would be first on almost any application where it were not.

---

← [01c · Checklist pass: rendering and caching](01c-the-checklist-pass-rendering-caching-and-the-build.md) · [01 · SprintDesk retrospective](01-sprintdesk-retrospective-the-finished-multi-tenant-saas-revi.md) · Next → [01e · What SprintDesk still does not have](01e-what-sprintdesk-still-does-not-have.md)
