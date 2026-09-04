---
title: "A soft navigation cannot leave the application that owns the route tree, so every cross-zone link must be a plain anchor — and everything a client bundle holds in memory dies at that boundary, which is simultaneously the isolation you bought and the bill for it"
sidebar_label: "01c · Crossing a zone boundary"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — the multi-zones guide
> ([nextjs.org/docs/app/guides/multi-zones](https://nextjs.org/docs/app/guides/multi-zones),
> served `lastUpdated` 2026-06-01), which returned `version: 16.3.4` in its own metadata.
> Everything about what survives a boundary crossing is **derived from the guide's
> hard-navigation sentence, not separately documented**, and is labelled inline.
> Target: **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**. Documentation-verified;
> **no sandbox run**.

**The single rule that catches every team building their first multi-zone: `next/link` does not work across a zone boundary, and the failure is not a compile error.** It is a link that behaves oddly, or a prefetch that fetches something meaningless, or a navigation that stalls — discovered in QA, or not at all. The mechanism is simple once stated: a zone's client router knows this application's route tree and nothing else, so a soft navigation to a path this build does not own has nothing to render. The documentation's remedy is a plain `<a>` tag, which is a deliberate downgrade to a full document load. And that document load is the honest price list for the whole architecture: React context, client bundles, the router's in-memory caches and every piece of application state are discarded at the boundary. That is the isolation you bought. It is also, every single time a user crosses, the bill.

## The rule, quoted

> *"Navigating between pages in the same zone will perform soft navigations, a navigation that does not require reloading the page. For example, in this diagram, navigating from `/` to `/products` will be a soft navigation."*
> — [multi-zones guide](https://nextjs.org/docs/app/guides/multi-zones)

> *"Navigating from a page in one zone to a page in another zone, such as from `/` to `/dashboard`, will perform a hard navigation, unloading the resources of the current page and loading the resources of the new page. Pages that are frequently visited together should live in the same zone to avoid hard navigations."*

And the instruction that follows from it:

> *"Links to paths in a different zone should use an `a` tag instead of the Next.js `<Link>` component. This is because Next.js will try to prefetch and soft navigate to any relative path in `<Link>` component, which will not work across zones."*

**That last sentence contains the whole mechanism in eleven words: *prefetch and soft navigate to any relative path*.** `next/link` does not inspect the destination to decide whether it is reachable — a relative href is, as far as the component is concerned, a route in this application. It will attempt to prefetch it and it will attempt to render it client-side. Both operations assume the target is described by *this* build's routing data, which for a cross-zone path it is not.

⚠️ **What the documentation states is the outcome, not the internals.** It says the attempt *"will not work across zones"*; it does not enumerate what the client router does with the response. I have not found a documented description of that failure path and am not going to invent one — the actionable fact is complete without it: **relative `href` in `<Link>` means "in this app", and a cross-zone path is not in this app.** Prefetch mechanics for the in-app case are covered in [chapter 2 · prefetching fundamentals](../02-routing-and-navigation/05-prefetching-fundamentals-and-the-native-view-transitions-api.md), and the navigation primitives themselves in [chapter 2 · navigation mechanics](../02-routing-and-navigation/04-navigation-mechanics-link-userouter-redirect-notfound.md).

## The broken code, and the correct code

Broken, and it will render without complaint:

```tsx
// apps/www/components/site-nav.tsx — 🔴 BROKEN: /dashboard belongs to another zone
import Link from 'next/link'

export function SiteNav() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/products">Products</Link>
      <Link href="/dashboard">Dashboard</Link>
    </nav>
  )
}
```

Correct — the cross-zone destination becomes an anchor:

```tsx
// apps/www/components/site-nav.tsx — /dashboard crosses a boundary, so it is an anchor
import Link from 'next/link'

export function SiteNav() {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/products">Products</Link>
      <a href="/dashboard">Dashboard</a>
    </nav>
  )
}
```

Note what did **not** change: the href. It is still `/dashboard`, still relative, still on the public origin — because the rewrite makes that path valid at the origin. Only the element changed. **You are not routing around Next.js; you are telling the browser to do the navigation instead of the client router.**

## Make the rule mechanical, because humans will not remember it

The version above is correct and unmaintainable. Six months in, a nav item moves zones, someone adds a link in a marketing component, and nothing in the type system objects. Encode the zone map once and let a component enforce it.

```tsx
// packages/ui/src/zone-link.tsx — one component that cannot get the rule wrong
import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

/**
 * Every path prefix owned by a zone OTHER than the one rendering this component
 * is listed in NEXT_PUBLIC_FOREIGN_ZONE_PREFIXES, comma-separated.
 * e.g. in apps/www:      "/dashboard,/blog"
 *      in apps/blog:     "/dashboard"
 */
const FOREIGN_PREFIXES = (process.env.NEXT_PUBLIC_FOREIGN_ZONE_PREFIXES ?? '')
  .split(',')
  .map((prefix) => prefix.trim())
  .filter(Boolean)

function isForeignZone(href: string): boolean {
  return FOREIGN_PREFIXES.some(
    (prefix) => href === prefix || href.startsWith(`${prefix}/`)
  )
}

type ZoneLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string
  children: ReactNode
}

export function ZoneLink({ href, children, ...rest }: ZoneLinkProps) {
  if (isForeignZone(href)) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    )
  }

  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  )
}
```

```tsx
// apps/www/components/site-nav.tsx — now the rule is data, not discipline
import { ZoneLink } from '@acme/ui'

export function SiteNav() {
  return (
    <nav>
      <ZoneLink href="/">Home</ZoneLink>
      <ZoneLink href="/products">Products</ZoneLink>
      <ZoneLink href="/dashboard">Dashboard</ZoneLink>
    </nav>
  )
}
```

**The prefix list differs per zone, which is the point.** In `apps/dashboard`, `/dashboard` is local and `/blog` is foreign; the same shared component compiles into both and behaves correctly in each because the environment differs. The variable must be `NEXT_PUBLIC_`-prefixed because the decision happens where the link renders, including on the client.

## What is not shared across a zone boundary, and why that is the whole deal

The guide's hard-navigation sentence — *"unloading the resources of the current page and loading the resources of the new page"* — is the source for everything in this table. **These are derived consequences of a document load, not separately documented guarantees**, and are labelled as such.

| Thing | Survives a zone crossing? | Why |
|---|---|---|
| React context | ❌ | The React tree is destroyed; a new one mounts in a new document |
| Client bundle | ❌ | Downloaded again, per zone — the same `react-dom` ships twice |
| Router cache / prefetched RSC payloads | ❌ | Live in the discarded page's memory |
| `useState`, Zustand/Redux store, refs | ❌ | Same |
| Scroll position, focus, open modal | ❌ | Same |
| In-flight requests | ❌ | Aborted with the document |
| Design-system CSS | ⚠️ Re-downloaded per zone unless a shared CDN URL is used | Each zone builds its own CSS |
| Cookies on the public origin | ✅ | Browser-scoped to the domain, not to the application — see [01d](01d-when-zones-are-the-wrong-answer.md) |
| `localStorage` / `sessionStorage` | ✅ | Origin-scoped, and the origin is shared |
| Server-side session backed by a cookie | ✅ | Each zone reads the same cookie and looks it up itself |

🔴 **Read that table as a design brief, not a bug list.** Nothing above is a defect to work around; it is the definition of the boundary. If a piece of state must survive the crossing, it does not belong in memory — it belongs in the URL, in a cookie, in `sessionStorage`, or in a server-side store keyed by a session. If *lots* of state must survive the crossing, the boundary is in the wrong place and the two zones should be one, which is the argument [01d](01d-when-zones-are-the-wrong-answer.md) makes.

The guide gives the operational version of the same advice in one sentence:

> *"Pages that are frequently visited together should live in the same zone to avoid hard navigations."*

**That is the zone-boundary test, and it is a usage question, not an ownership question.** Draw the boundary where users rarely cross, not where the org chart happens to split — and when the two disagree, the org chart is the thing you can change more cheaply than user behaviour.

## Version skew is legal, which is the feature and the trap

> *"Since applications are decoupled, Multi-Zones also allows other applications on the domain to use their own choice of framework."*

Framework choice per zone is stated outright. **The guide never says "different Next.js majors" in those words**, but the property that permits a different framework entirely necessarily permits a different version of the same one: there is no build-time link between zones for a version constraint to be checked across. In practice this is what a "decoupled deploy cadence" *means* — the blog zone can sit on Next.js 15 for a quarter while the dashboard zone moves to 16.

And this is where the shared design-system package quietly breaks. Consider `@acme/ui`, consumed by both zones:

```json
// packages/ui/package.json — peer ranges are the only guard rail you get
{
  "name": "@acme/ui",
  "version": "3.2.0",
  "peerDependencies": {
    "next": ">=15.0.0 <17.0.0",
    "react": "^19.0.0"
  }
}
```

**Nothing enforces that both zones are on the same version of `@acme/ui` itself.** Each zone resolves and bundles its own copy at its own build time. So a component that renders differently in 3.1.0 and 3.2.0 produces a header that visibly changes as the user crosses from `/` to `/dashboard` — a class of bug that never reproduces locally, because locally you are running one zone. The guide's answer is not a technical one:

> *"Since the pages in different zones may be released at different times, feature flags can be useful for enabling or disabling features in unison across the different zones."*

A flag evaluated at runtime in both zones is version-independent; a component whose behaviour is baked in at build time is not. **Gate cross-zone visual changes behind a flag, not behind a package version.** And on sharing code generally:

> *"The Next.js applications that make up the different zones can live in any repository. However, it is often convenient to put these zones in a monorepo to more easily share code. For zones that live in different repositories, code can also be shared using public or private NPM packages."*

Note what a monorepo buys and does not buy here: it makes the *source* easy to share and makes an atomic version bump possible; it does not make the deploys atomic, and the deploy is where the skew appears.

## Gotchas

**★ Symptom: a nav link to another zone renders fine, and clicking it behaves strangely or not at all.** Cause: it is a `next/link`, and *"Next.js will try to prefetch and soft navigate to any relative path in `<Link>` component, which will not work across zones."* Fix: use a plain anchor for cross-zone destinations — same href, different element.

```tsx
// 🔴 broken
<Link href="/dashboard">Dashboard</Link>
// ✅ correct
<a href="/dashboard">Dashboard</a>
```

**★ Symptom: the cross-zone rule was applied correctly at launch and has decayed since.** Cause: it is enforced by human memory in a codebase where nothing type-checks it, and a shared nav component is edited by people who have never heard of zones. Fix: make it structural — route every internal link through a `ZoneLink` that consults a per-zone prefix list, as shown above, and ban bare `next/link` in shared packages with a lint rule.

```json
// packages/ui/.eslintrc.json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "paths": [
          {
            "name": "next/link",
            "message": "Shared components must use ZoneLink — it decides Link vs <a> per zone."
          }
        ]
      }
    ]
  }
}
```

**★ Symptom: a user fills a multi-step form, crosses into another zone and comes back to an empty form.** Cause: the crossing is a hard navigation — *"unloading the resources of the current page and loading the resources of the new page"* — so every piece of client memory, including the form state, is gone. Fix: state that must survive a boundary cannot live in React. Put it in the URL, a cookie, or `sessionStorage`, which is origin-scoped and therefore shared.

```tsx
// apps/www/app/apply/step-two.tsx
'use client'
import { useEffect, useState } from 'react'

const DRAFT_KEY = 'acme:application-draft'

export function StepTwo() {
  const [email, setEmail] = useState('')

  useEffect(() => {
    const saved = sessionStorage.getItem(DRAFT_KEY)
    if (saved) setEmail(JSON.parse(saved).email ?? '')
  }, [])

  useEffect(() => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ email }))
  }, [email])

  return (
    <input
      type="email"
      value={email}
      onChange={(event) => setEmail(event.target.value)}
    />
  )
}
```

**★ Symptom: the shared header renders one way on `/` and subtly differently on `/dashboard`.** Cause: the two zones built against different versions of the shared design-system package; nothing forces them to agree, because each zone resolves its own dependency tree at its own build time. Fix: pin the shared package exactly in every zone, and gate any *behavioural* cross-zone change behind a runtime flag instead of a version, per the guide's own advice that *"feature flags can be useful for enabling or disabling features in unison across the different zones."*

```json
// apps/www/package.json and apps/dashboard/package.json — exact, not caret
{
  "dependencies": {
    "@acme/ui": "3.2.0"
  }
}
```

**Symptom: the same React and the same design system are downloaded twice by one user in one session.** Cause: zones do not share client bundles; each ships its own. This is not fixable within the architecture — it is what "independent deploy" costs. Fix: reduce the number of crossings rather than the size of the duplication, by moving frequently-co-visited pages into one zone as the guide advises. If crossings cannot be reduced, that is evidence the split is wrong.

**Symptom: a View Transition or a shared-element animation never plays across a zone boundary.** Cause: those mechanisms operate within a client-side navigation, and a cross-zone move is a document load. ⚠️ The multi-zones guide does not discuss view transitions at all, and I did not verify whether any cross-document transition mechanism applies here — **I could not confirm this either way.** Treat cross-zone animation as unavailable until you have evidence otherwise; the in-app case is covered in [chapter 2 · prefetching and view transitions](../02-routing-and-navigation/05-prefetching-fundamentals-and-the-native-view-transitions-api.md).

**Symptom: an `<a>` with a cross-zone href triggers a full reload even when the target turns out to be in the same zone.** Cause: you over-applied the rule. An anchor is *always* a document load; using it for a same-zone path throws away the soft navigation you were entitled to. Fix: the prefix list must contain only *foreign* zones, and it must differ per zone — which is precisely why `NEXT_PUBLIC_FOREIGN_ZONE_PREFIXES` is set per application rather than shared.

## Interview questions

**★ Why can `next/link` not navigate into another zone?**
Because a relative `href` in `<Link>` is, to that component, a route in the current application — and the documentation says it *"will try to prefetch and soft navigate to any relative path"*. Both operations assume the destination is described by this build's routing data, and a cross-zone path is served by a different application with a different build. The docs state the outcome — it *"will not work across zones"* — rather than the internal failure path, and the actionable rule is complete without it: cross-zone means a plain `<a>`, so the browser performs a document load and the destination zone renders from scratch.

**★ What exactly is lost when a user crosses a zone boundary?**
Everything held in the page's memory. The guide describes a hard navigation as *"unloading the resources of the current page and loading the resources of the new page"*, which means the React tree and all its context, every client bundle, the router's caches and prefetched payloads, component state, refs, scroll position, focus, and any in-flight request. What survives is what the browser scopes to the origin rather than the document: cookies, `localStorage` and `sessionStorage`, and anything reconstructible server-side from a session cookie. The design rule falls straight out of that — state that must cross a boundary cannot live in React.

**★ Where should a zone boundary be drawn?**
Where users rarely cross it. The guide is explicit: *"Pages that are frequently visited together should live in the same zone to avoid hard navigations."* That makes it a usage question, not an ownership question — and the two frequently disagree, because org charts split by team while users navigate by task. When they disagree, prefer the usage boundary, because you can restructure a team more cheaply than you can retrain user behaviour. A boundary users cross constantly converts every crossing into a full page load and hands you the costs of the architecture with none of the benefit.

**★ Two zones are on different Next.js majors. Is that legal, and what breaks?**
Legal, and it is the deploy-cadence independence you bought. The guide states that *"Since applications are decoupled, Multi-Zones also allows other applications on the domain to use their own choice of framework"* — different frameworks entirely, so certainly different versions of one. What breaks is anything assumed to be consistent across the boundary but resolved at build time: most often a shared design-system package, where each zone bundles its own copy and a visual change lands in one zone before the other. The mitigation the guide names is runtime feature flags *"for enabling or disabling features in unison across the different zones"*, because a flag is evaluated after both builds are frozen.

**How would you stop the `<Link>`-versus-`<a>` rule from decaying over six months?**
Take it out of human hands. One `ZoneLink` component consults a per-zone list of foreign path prefixes supplied as a `NEXT_PUBLIC_` environment variable, and returns either `Link` or an anchor. Shared packages ban `next/link` with a `no-restricted-imports` lint rule so the choice cannot be made ad hoc. The property that makes this work is that the same component compiles into every zone and behaves correctly in each, because what is foreign differs per zone and lives in configuration rather than in code.

**A designer wants a shared-element transition between the marketing page and the dashboard. What do you tell them?**
That the two live in different zones, so the move is a document load rather than a client-side navigation, and the animation mechanisms that operate within a soft navigation do not apply. I could not confirm from the multi-zones documentation whether any cross-document transition mechanism is usable here, so I would not promise one. The productive response is to ask why those two pages are on opposite sides of a boundary at all — a transition request is usually evidence the pages are frequently visited together, which is the guide's own criterion for putting them in the same zone.

---

← [Routing requests to a zone](01b-routing-requests-to-a-zone.md) · [Chapter index](01-explanation.md) · Next → [When a multi-zone is the wrong answer](01d-when-zones-are-the-wrong-answer.md)
