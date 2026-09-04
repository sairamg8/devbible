---
title: "A layout that refuses to render its children does not stop them running, the UI that hides a button does not stop the action, and a statically generated route has no request-time read to gate — the three layers people put the gate on that cannot hold it"
sidebar_label: "04d · The three places the gate cannot hold"
sidebar_position: 23
description: "Why a layout is not a security boundary and the data reaches the RSC Payload anyway, why the SPA return-null pattern is explicitly not recommended, the one case where the gate correctly moves outward to the proxy, the database layer underneath, and how to read the data-security audit checklist as a statement about layers."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [How to implement authentication in Next.js](https://nextjs.org/docs/app/guides/authentication) (`lastUpdated: 2026-08-25`) — its *Layouts and auth checks* section and the auth-checks-in-components guidance are quoted verbatim below — and [How to think about data security in Next.js](https://nextjs.org/docs/app/guides/data-security) (`lastUpdated: 2026-08-25`), whose *Auditing* checklist is quoted in full.
> Target: **Next.js 16.3.4**, App Router. Documentation-verified; **no sandbox run**. Prior page: [04c · The innermost layer that can see the fact](04c-defence-in-depth-the-innermost-layer-that-can-see-the-fact.md).

**Three layers attract the gate and cannot hold it, and each one fails differently. A **layout** looks like a wrapper around the page and is not one — the router renders segments and slots, the layout only places their output, so a layout that hides `{children}` has not stopped `{children}` from running or from reaching the wire. The **UI** hides a button and leaves the endpoint. And a **statically generated route** has no request-time read to attach a check to, which is the one case where the gate legitimately moves *outward* to the proxy rather than inward. Getting all three right is the difference between a design that survives a refactor and one that survives only until someone opens the network tab.**

## 🔴 A layout is not a boundary

This is the most confidently-held wrong belief in App Router security, and the authentication guide contradicts it in two separate places.

> *"Due to [Partial Rendering](/docs/app/getting-started/linking-and-navigating#client-side-transitions), be cautious when doing checks in [Layouts](/docs/app/api-reference/file-conventions/layout) as these don't re-render on navigation, meaning the user session won't be checked on every route change."*

> *"A layout also does not control whether the rest of the route renders. Route segments and [parallel route slots](/docs/app/api-reference/file-conventions/parallel-routes#conditional-routes) are rendered by the router, so a layout that hides or swaps them does not stop them from running or from appearing in the [RSC Payload](/docs/app/glossary#rsc-payload)."*

Take the second one slowly, because it is much worse than "the check is skipped."

A layout does not call its children. The router renders each segment — and each parallel route slot, *"whether or not they are displayed"* — and hands the layout the finished output to position. So in this code:

```tsx filename="app/dashboard/layout.tsx"
// 🔴 BROKEN. This is not a gate.
import { verifySession } from '@/app/lib/session'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await verifySession()
  if (!session.isAdmin) return <p>Not authorized</p>

  return <section>{children}</section>
}
```

…the protected page's Server Component **has already executed**. Its database queries ran. Its result was serialized. The layout's decision not to place `{children}` in the returned tree removes it from the visible UI and does nothing about any of that: the segment's rendered output is in the RSC Payload, which is delivered to the browser and is readable in the network tab by anyone who opens it.

The data crossed the wire. Only the JSX did not.

Add the first quote on top and it gets worse still: because layouts do not re-render on client-side navigation, a user who passes the check once and then navigates between sibling routes under that layout is not re-checked at all.

The fix is the placement rule from [04c](04c-defence-in-depth-the-innermost-layer-that-can-see-the-fact.md) — gate the data, not the JSX:

```tsx filename="app/dashboard/layout.tsx"
// The layout is layout. It gates nothing and pretends to gate nothing.
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <section className="dashboard">{children}</section>
}
```

```tsx filename="app/dashboard/reports/page.tsx"
import { notFound } from 'next/navigation'
import { getAdminReportsDTO } from '@/app/lib/dal'

export default async function ReportsPage() {
  // Refuses on its own, whatever rendered it, on every navigation.
  const reports = await getAdminReportsDTO()
  if (!reports) notFound()

  return <ul>{reports.map((r) => <li key={r.id}>{r.title}</li>)}</ul>
}
```

The guide's own conclusion is one sentence:

> *"Instead, you should do the checks close to your data source or the component that'll be conditionally rendered."*

⚠️ **A layout is still the right place to *fetch* shared data**, and the guide says so — it recommends fetching the user in the layout for the nav avatar and doing the auth check inside the DAL, *"This guarantees that wherever `getUser()` is called within your application, the auth check is performed."* Fetch in the layout, gate in the DAL. Note also the streaming cost the guide flags: a top-level `await` on `cookies()`, `headers()` or the DAL in a layout *"delays the first streamed chunk for that segment and holds `{children}` behind that work"*, so push the session-dependent part into a nested Server Component behind `<Suspense>`.

## The UI is not a boundary either

The client-side version of the same mistake, named and rejected by the guide:

> *"A common pattern in SPAs is to `return null` in a layout or a top-level component if a user is not authorized. This pattern is **not recommended** since Next.js applications have multiple entry points, which will not prevent nested route segments and Server Actions from being accessed."*

> *"Ensure that any Server Actions called from these components also perform their own authorization checks, as client-side UI restrictions alone are not sufficient for security."*

Conditionally rendering an admin control is a perfectly good thing to do — the guide demonstrates it, in a leaf Server Component that reads the session and returns `null` for non-admins. What it is not is a control. The Server Function behind that button remains a POST endpoint on the route where it is used, callable whether or not the button ever rendered, and per the chapter's [CVE record](14-the-2026-cve-record-eleven-vulnerabilities-and-what-each-one-teaches.md) the endpoint IDs themselves were disclosable in 2026 (CVE-2026-64643) precisely so that direct invocation is a realistic step rather than a theoretical one.

```tsx filename="app/ui/admin-actions.tsx"
import { verifySession } from '@/app/lib/session'
import { archiveProject } from '@/app/lib/actions'

// Presentation. Hides the affordance; guarantees nothing.
export default async function AdminActions({ projectId }: { projectId: string }) {
  const session = await verifySession()
  if (session.role !== 'admin') return null

  return (
    <form action={archiveProject.bind(null, projectId)}>
      <button type="submit">Archive project</button>
    </form>
  )
}
```

```ts filename="app/lib/actions.ts"
'use server'

import { archiveProjectForViewer } from '@/app/lib/dal'

// The control. Runs whether or not the button above ever rendered.
export async function archiveProject(projectId: string) {
  await archiveProjectForViewer(projectId)
}
```

The per-action treatment is [01 · Server Actions: where the check lives](01-server-actions-for-mutations-with-useactionstate-and-useopti.md); [ch07 · 03c](../07-error-handling-loading-states-and-resilience/03c-an-action-is-a-public-post-endpoint.md) already covers the framework guarantees and their limits.

## The static route: the one case where the gate moves outward

There is a genuine case where the proxy is the control, and it is the placement rule applying rather than failing. If a route is statically generated, there is no request-time data read to attach a check to — the read happened at build time, for everyone, before any requester existed.

> *"To protect static routes that share data between users (e.g. content behind a paywall)."*

> *"A DAL can be used to protect data fetched at request time. However, for static routes that share data between users, data will be fetched at build time and not at request time. Use [Proxy](#optimistic-checks-with-proxy-optional) to protect static routes."*

For that route, the innermost layer that can see **any** fact about the requester is the proxy, because everything below it ran before the requester existed. So the gate goes there.

You should be uneasy about it, and the unease is the correct response: the guarantee is now only as strong as a hand-maintained matcher literal, which [04b](04b-proxy-configuration-matchers-runtime-and-what-the-rename-meant.md) shows cannot be derived from your routes and cannot be computed at all. The alternative, when the content genuinely matters, is to stop making it static — render the gated portion dynamically so that a request-time read exists to gate:

```tsx filename="app/articles/[slug]/page.tsx"
import { Suspense } from 'react'
import { getArticleTeaser } from '@/app/lib/dal'
import { PaidBody } from './paid-body'

// Teaser is shared and cacheable. The body is per-request and gated.
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const teaser = await getArticleTeaser(slug)

  return (
    <article>
      <h1>{teaser.title}</h1>
      <p>{teaser.excerpt}</p>
      <Suspense fallback={<p>Checking your subscription…</p>}>
        <PaidBody slug={slug} />
      </Suspense>
    </article>
  )
}
```

```tsx filename="app/articles/[slug]/paid-body.tsx"
import { getArticleBodyDTO } from '@/app/lib/dal'

export async function PaidBody({ slug }: { slug: string }) {
  // Reads the session; returns null for non-subscribers. Request-time gate.
  const body = await getArticleBodyDTO(slug)
  if (!body) return <a href="/subscribe">Subscribe to read the rest</a>

  return <div dangerouslySetInnerHTML={{ __html: body.html }} />
}
```

That is a real trade — a fully static route with a proxy-only gate against a partially dynamic route with a data-layer gate — and it has costs on both sides. Picking one deliberately is the job; picking neither and assuming the DAL covers a static route is the failure.

## Underneath: the layer that does not trust your application

The database is the only layer that can enforce a predicate against a query your application never intended to write — a reporting job, a raw SQL escape hatch, an ORM call a contractor added at the wrong level. Row-level security is that enforcement, and this corpus teaches it in [ch15 · 10c](../15-databases-apis-and-full-stack-patterns/10c-tenant-isolation-in-the-data-access-layer.md), including the `FORCE ROW LEVEL SECURITY` detail (without it the table owner bypasses its own policies, and your application user is very often the table owner) and the pooled-connection trap that makes a plain `SET` unsafe.

It is outside the Next.js documentation entirely, and it is the layer that saves you when every layer above it has a bug. Under the placement rule it is exactly where you would expect it: the fact *"no query may cross a tenant boundary"* is observable at the connection, which is innermost.

## Reading the audit checklist as a statement about layers

The data-security guide closes with a checklist, and its *shape* is the lesson:

> *"**Data Access Layer:** Is there an established practice for an isolated Data Access Layer? Verify that database packages and environment variables are not imported outside the Data Access Layer."*

> *"**`"use client"` files:** Are the Component props expecting private data? Are the type signatures overly broad?"*

> *"**`"use server"` files:** Are the Action arguments validated in the action or inside the Data Access Layer? Is the user re-authorized inside the action? Does the action check ownership of the resource (authorization, not just authentication)? Are return values filtered to only what the client needs? Is database access delegated to a `server-only` Data Access Layer?"*

> *"**`/[param]/.`** Folders with brackets are user input. Are params validated?"*

> *"**`proxy.ts` and `route.ts`:** Have a lot of power. Spend extra time auditing these using traditional techniques. Perform Penetration Testing or Vulnerability Scanning regularly or in alignment with your team's software development lifecycle."*

The questions get **more specific as you move inward**. For `"use server"` files there are five precise, answerable questions. For the DAL there is a structural one you can verify with a grep. For `proxy.ts` and `route.ts` — the outermost items — there are no questions at all, only *"spend extra time"* and a recommendation to do penetration testing.

That is what a documentation team writes when a layer's correctness **cannot be established from its code alone**. It is a strong, indirect statement about where not to put the gate, and it is the closing argument of this whole sub-topic.

## Gotchas

**★ Symptom: an unauthorized user sees no UI, but the protected page's queries ran and its data is in the RSC Payload.**
Cause: a layout that conditionally renders `{children}`. Segments and parallel slots are rendered by the router, so they execute and appear in the payload whether or not the layout places them.
Fix: gate the data. The layout returns layout; the page's DAL call refuses.

```tsx filename="app/dashboard/reports/page.tsx"
const reports = await getAdminReportsDTO() // refuses on its own
if (!reports) notFound()
```

**★ Symptom: a check in a layout works on first load, then a client-side navigation into a sibling route skips it.**
Cause: partial rendering — layouts *"don't re-render on navigation, meaning the user session won't be checked on every route change."*
Fix: move the check into the data read, which runs for every segment render on every navigation.

**★ Symptom: `return null` in a top-level component was accepted in code review as an authorization control.**
Cause: an SPA habit. The guide names and rejects it: *"not recommended since Next.js applications have multiple entry points, which will not prevent nested route segments and Server Actions from being accessed."*
Fix: keep the conditional render as presentation and put the control in the action's DAL call, as in the `AdminActions` pair above.

**★ Symptom: a statically generated paywalled article is readable by anyone with the URL, despite a working DAL.**
Cause: the DAL protects data fetched at request time; a static route's data was fetched at build time, so there is no request-time read to gate.
Fix: gate it in the proxy — the documented exception — or split the route so the paid portion is a per-request read behind `<Suspense>`, as shown above. Both are legitimate; assuming the DAL already covers it is not.

**★ Symptom: moving the auth check out of the layout and into the DAL makes the first paint noticeably later.**
Cause: the session read moved but stayed at the top of the segment, so the top-level `await` still *"delays the first streamed chunk for that segment and holds `{children}` behind that work."*
Fix: push the dynamic access down into a nested component and stream the shell.

```tsx filename="app/dashboard/layout.tsx"
import { Suspense } from 'react'
import { UserMenu } from './user-menu' // awaits the session inside

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <section>
      <nav>
        <Suspense fallback={<span aria-hidden>…</span>}>
          <UserMenu />
        </Suspense>
      </nav>
      {children}
    </section>
  )
}
```

**★ Symptom: a Client Component needs the user, so `verifySession()` is imported into it and the build fails — or worse, a hand-rolled client copy of the check appears.**
Cause: *"Client Components can't import the DAL."*
Fix: resolve it in a parent Server Component and pass a narrow value down, per the guide, and taint the fields that must never cross. Never reimplement the check on the client; a client-side check is a fourth layer that can see nothing.

**★ Symptom: parallel route slots for an unauthorized area still execute.**
Cause: the router renders parallel route slots *"whether or not they are displayed"*, so a conditional route that swaps a slot does not prevent the hidden slot's work.
Fix: each slot's data comes from its own gated DAL function; do not treat slot selection as access control.

**★ Symptom: RLS is enabled, and the application user still reads every tenant's rows.**
Cause: `ENABLE ROW LEVEL SECURITY` without `FORCE` — the table owner bypasses its own policies, and the application role is frequently the owner.
Fix: `ALTER TABLE project FORCE ROW LEVEL SECURITY;`, plus the transaction-scoped connection setting. Full treatment, including the pooled-connection trap, in [ch15 · 10c](../15-databases-apis-and-full-stack-patterns/10c-tenant-isolation-in-the-data-access-layer.md).

## Interview questions

**★ Why does a layout that refuses to render `{children}` fail to protect the page underneath it?**
Because the layout is not what renders the page. Route segments and parallel route slots are rendered by the router, and the layout receives their *output* to position; so the protected segment's Server Component executes, its queries run, and its result is serialized into the RSC Payload whether or not the layout places it in the tree. The docs say it directly: a layout *"does not control whether the rest of the route renders"* and hidden segments still appear in the payload. Add partial rendering — layouts do not re-render on navigation — and the check may not even run a second time. The data reached the wire; only the JSX did not, which means the failure is invisible in the UI and obvious in the network tab.

**★ Is it ever correct to read the session in a layout?**
Yes — to *fetch*, not to *gate*. The guide's own recommendation is to fetch the user in the layout for shell UI like a nav avatar and to do the auth check inside the DAL, because *"this guarantees that wherever `getUser()` is called within your application, the auth check is performed."* There is a streaming cost attached: a top-level `await` on `cookies()`, `headers()` or the DAL in a layout delays the first streamed chunk and holds `{children}` behind it, so the session-dependent part belongs in a nested Server Component wrapped in `<Suspense>`.

**★ A colleague hides an admin button for non-admins and says the feature is secured. What exactly is still open?**
The Server Function behind it. It is a POST endpoint on the route where it is used, reachable without the button ever having rendered — and the 2026 record includes an unauthenticated disclosure of Server Function endpoint IDs (CVE-2026-64643), which turns "an attacker would have to find it" into a solved problem. The guide is unambiguous: client-side UI restrictions alone are not sufficient, and any Server Action called from such a component must perform its own authorization. Hiding the button is good UX and zero security.

**★ Name the one situation where the gate correctly moves outward to the proxy, and explain why that is the rule applying rather than failing.**
A statically generated route whose data is shared between users — paywalled content is the documented example. The DAL protects data fetched at request time; a static route fetched its data at build time, for everyone, so there is no request-time read to attach a check to. The innermost layer that can see any fact about the *requester* is therefore the proxy, and that is where the rule puts the gate. The unease is warranted, because the guarantee is now only as strong as a hand-maintained matcher literal — so if the content genuinely matters, splitting the route so the paid body is a per-request read behind `<Suspense>` is the stronger design.

**★ What does the shape of the data-security guide's audit checklist tell you, independent of its contents?**
That confidence in a layer is inversely proportional to how far out it sits. The checklist asks five precise questions about `"use server"` files, one structurally verifiable question about the DAL, and for `proxy.ts` and `route.ts` it asks nothing at all — it says *"spend extra time auditing these using traditional techniques"* and recommends penetration testing. That is what you write when a layer's correctness cannot be established from its code, which is a strong indirect argument about where the gate should not be.

**★ Why is the database still worth gating when the DAL already checks ownership?**
Because the DAL can only constrain queries that go through it, and the queries that cause incidents are usually the ones that did not — a reporting job, a migration script, an analytics tool with read credentials, a raw SQL escape hatch added for one deadline. Row-level security enforces the predicate at the connection, which under the placement rule is exactly where the fact *"this connection is acting for tenant X"* lives. It is the layer that is still correct when everything above it has a bug, and the one detail that most often defeats it is enabling RLS without `FORCE`, because the application role is usually the table owner and owners bypass their own policies.

---

← [04c · The innermost layer that can see the fact](04c-defence-in-depth-the-innermost-layer-that-can-see-the-fact.md) · [Chapter 10 overview](01-explanation.md) · Next → [05 · RSC serialization hardening](05-rsc-serialization-hardening-lessons-from-react2shell-cve-202.md)
