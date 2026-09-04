---
title: "Several applications behind one origin means the browser sees one origin — which is what makes cookies work and Server Actions fail closed — and unless a second team genuinely owns a second deploy pipeline, the honest recommendation is route groups in a monorepo, not zones"
sidebar_label: "01d · When zones are the wrong answer"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — the multi-zones guide
> ([nextjs.org/docs/app/guides/multi-zones](https://nextjs.org/docs/app/guides/multi-zones),
> served `lastUpdated` 2026-06-01) and the `rewrites` reference
> ([nextjs.org](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites),
> 2026-06-30), both returning `version: 16.3.4` in their own metadata. Cookie behaviour
> here is **derived from the guide's one-origin premise, not quoted** — flagged inline.
> Target: **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**. Documentation-verified;
> **no sandbox run**.

**A multi-zone is an organisational instrument that happens to be implemented in `next.config.js`, and it should be chosen on organisational evidence.** The one thing it buys that nothing else does is an independent deploy pipeline per path range: team B ships `/dashboard` on Tuesday without waiting for team A's release train, and a bad deploy in one zone cannot take down the other. Everything else on the benefits list — smaller bundles, faster builds, cleaner module boundaries — is available from a monorepo with route groups at a fraction of the cost, without duplicated bundles, without a hard navigation at every crossing, and without version skew. So the decision rule is blunt: **if you cannot name the second team and the second deploy pipeline, you do not have a multi-zone problem.** This chunk closes the topic with what a shared origin actually implies operationally, how to move into and out of zones, and the case for not doing it at all.

## One origin, several applications: cookies, sessions and Server Actions

⚠️ **The multi-zones guide is silent on cookies, sessions and authentication.** What follows is derived from one documented fact plus standard browser behaviour, and is flagged rather than dressed up as a Next.js guarantee.

The documented fact is the Server Actions requirement, and its stated reason is the load-bearing part:

> *"When using Server Actions with Multi-Zones, you must explicitly allow the user-facing origin since your user facing domain may serve multiple applications. In your `next.config.js` file, add the following lines:"*

```js
// apps/dashboard/next.config.js — reproduced in the shape the guide shows
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['your-production-domain.com'],
    },
  },
}

module.exports = nextConfig
```

**"Your user facing domain may serve multiple applications" confirms the browser's view: one origin.** A Server Action POST therefore arrives at the zone carrying the public origin, while the zone is deployed at its own domain — so the zone's origin check sees a mismatch, and the allow-list is how you declare the public origin legitimate. It is a genuine same-origin defence that the rewrite deliberately confuses; the correct response is to name the legitimate origin, not to weaken the check.

⚠️ **Reproduced verbatim including the `experimental` nesting, because that is how the guide shows it.** I did not fetch the dedicated `serverActions` config reference, so **I could not confirm whether the key is still nested under `experimental` in 16.3.4 or has been promoted.** Check [`serverActions.allowedOrigins`](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions) before copying it.

**From that same one-origin fact, cookie behaviour follows** — and this is browser behaviour, not a Next.js feature. A cookie set on `example.com` is attached by the browser to requests for `example.com` regardless of which application produced or will receive them, because cookies are scoped by domain and path, not by the server that set them. So a session cookie issued by the dashboard zone is sent on requests the blog zone will serve.

**What that does and does not give you:**

- ✅ **The cookie travels.** Every zone can read the same session cookie.
- ✅ **A hard navigation carries it.** Unlike in-memory state, cookies survive the document load — which is exactly why session state belongs there in a zoned architecture.
- ❌ **Nothing decodes it for you.** Each zone must independently verify the token or look up the session. That means every zone holds the signing key or reaches the same session store, which is a real expansion of the secret's blast radius — see [enterprise compliance and token leakage](03-enterprise-compliance-owasp-mapping-token-leakage-prevention.md).
- ❌ **No shared in-memory auth context.** A `useSession()`-style provider in one zone tells the next zone nothing; each zone re-derives auth on its own first render.
- ⚠️ **Path-scoped cookies are a foot-gun here.** A cookie written with `path=/dashboard` is not sent to `/blog`. Set the path explicitly to `/` for anything cross-zone rather than relying on a default.

```ts
// packages/auth/src/session.ts — one helper, imported by every zone
import { cookies } from 'next/headers'

const SESSION_COOKIE = 'acme_session'

export async function setSessionCookie(token: string) {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/', // 🔴 must be '/', or other zones never receive it
    maxAge: 60 * 60 * 8,
  })
}

export async function readSessionCookie(): Promise<string | undefined> {
  const jar = await cookies()
  return jar.get(SESSION_COOKIE)?.value
}
```

🔴 **This section is reasoning, not citation.** The one-origin premise is quoted; the cookie consequences are ordinary HTTP behaviour that I did not verify against the cookie specification for this page. Treat the code above as a sound default and confirm the details against your auth library's own documentation before relying on it.

## Moving in and out: `fallback` is the strangler-fig phase

The third rewrite phase is the one to reach for when a new application is *replacing* an existing origin rather than sitting beside a sibling zone:

> *"You can also have Next.js fall back to proxying to an existing website after checking all Next.js routes. This way you don't have to change the rewrites configuration when migrating more pages to Next.js"*
> — [`rewrites`](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)

```js
// apps/www/next.config.js — anything this app does not serve goes to the legacy origin
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [
        {
          source: '/:path*',
          destination: `${process.env.LEGACY_ORIGIN}/:path*`,
        },
      ],
    }
  },
}

module.exports = nextConfig
```

**This inverts the migration workload.** `fallback` runs at step 8 of the documented route order, after dynamic routes at step 7 — so adding a page to the new application automatically stops that path reaching the legacy origin, with no config change per page. `afterFiles` cannot do that, because it is consulted before dynamic routes are matched. It is the single most useful phase for a strangler-fig migration and it is easy to miss, because it is documented under "Rewriting to an external URL" rather than under multi-zones.

**The same mechanism runs in reverse when you collapse zones back together.** Merging a zone into the router application is: copy the routes in, delete the three rewrite rules, delete the zone's `assetPrefix`, and swap every `<a>` back to `<Link>` — which is the step people forget, and the one that silently leaves a full page load in the middle of a now-single application. That is why the [`ZoneLink` component](01c-crossing-zone-boundaries.md) is worth building even for a two-zone estate: collapsing a zone becomes an environment-variable edit rather than a hunt through JSX.

## When a multi-zone is the wrong answer

**The most common bad reason: "we want modularity."** Modularity is a code-organisation goal, and a multi-zone answers it with a deployment topology — which is like fixing a naming problem by buying a second building. Next.js already has the cheap answer: **route groups**, directories named in parentheses that organise the `app/` tree without appearing in the URL, combined with a monorepo package per bounded area.

```
apps/web/app/
├── (marketing)/
│   ├── layout.tsx          marketing chrome only
│   ├── page.tsx            → /
│   └── pricing/page.tsx    → /pricing
├── (dashboard)/
│   ├── layout.tsx          authenticated chrome only
│   ├── dashboard/page.tsx  → /dashboard
│   └── settings/page.tsx   → /settings
└── layout.tsx              the root layout both share
```

⚠️ I did not re-fetch the route-groups reference for this page; the mechanics are covered in [chapter 2 · nested layouts and route groups](../02-routing-and-navigation/02-nested-layouts-parallel-routes-slot-intercepting-routes-rout.md). What matters to *this* decision is what the shape buys you, and the list is long: separate layouts per area, code ownership expressible in `CODEOWNERS`, a single dependency tree, one design-system version by construction, **and soft navigation everywhere**, including between marketing and dashboard.

Set the two side by side honestly:

| | **Route groups in one app** | **Multi-zones** |
|---|---|---|
| Deploy pipelines | One | One **per zone** — the only unique benefit |
| Blast radius of a bad deploy | Whole site | One zone |
| Navigation between areas | Soft, always | 🔴 Hard, always |
| Client bundle for shared deps | Downloaded once | Downloaded per zone |
| Design-system version | One, by construction | Per zone, by policy |
| Framework version | One | Per zone — legal, and a skew source |
| Local development | Run one app | Run every zone you might link to |
| Cost of moving a page between areas | Move a directory | Move code, move a rewrite, change every link to it |
| Type-safety across the boundary | Full | None — the boundary is a URL |
| Build time | One large build | Smaller builds, in parallel |

🔴 **Read row 1 and row 3 together.** If you cannot point at a real second deploy pipeline you need, you are paying every cost in that column for nothing — and the one you will feel first is row 3, because it is the one your users experience.

**The cases where zones genuinely are the answer:**

- **Two teams with two release trains and separate on-call.** The independent deploy is the product, and the hard navigation between `/` and `/dashboard` is a price a logged-in user pays roughly once per session.
- **A section that is not Next.js**, or not yours. The guide names this outright — *"Multi-Zones also allows other applications on the domain to use their own choice of framework."* A docs site on a static generator, or an acquired product, mounted at a path.
- **A genuinely unrelated section with a different lifecycle.** The guide's own criterion: *"This is useful when there are collections of pages unrelated to the other pages in the application."*
- **Incremental migration off a legacy origin**, using the `fallback` shape above — a temporary zone with a scheduled end date.
- **A build that has grown intolerable**, where the split is justified by *"you can reduce the size of each application which improves build times."* ⚠️ This is a real documented benefit and also the one most often used to rationalise a split that the org chart does not support. Try the cheaper fixes first.

**The cases where it is the wrong answer, stated plainly:**

- One team, one deploy, wanting cleaner boundaries → route groups and packages.
- A section users enter and leave constantly → the guide's own rule forbids it: *"Pages that are frequently visited together should live in the same zone to avoid hard navigations."*
- A shared, stateful shell — a persistent player, a live cart drawer, a socket connection — that must survive the crossing. It cannot; it is destroyed with the document.
- Wanting to render two teams' components on one screen. Multi-zones cannot do this at all; one zone renders the page.
- A team of three arguing about folder structure. This is a code-review problem wearing an architecture costume.

## The checklist to run before splitting

Answer these out loud, in a room, before anyone edits `next.config.js`. Every one of them is answerable from evidence you already have.

1. **Name the second team and the second on-call rotation.** If both answers are the same team, stop here.
2. **Name the second deploy pipeline and how often it will release independently.** "Eventually" means you are not ready.
3. **Draw the path map.** Every top-level prefix, with exactly one owner — the docs require it: *"URL paths should be unique to a zone."* If two candidate zones want the same prefix, the split is in the wrong place.
4. **Pull the analytics for crossings.** Count the sessions that move between the two candidate path ranges. Every one of those becomes a full page load. The guide's rule is *"Pages that are frequently visited together should live in the same zone."*
5. **List the state that must survive a crossing.** Anything not in a cookie, the URL or `sessionStorage` will not. If the list is long, the boundary is wrong.
6. **Decide the shared-code strategy now**, not later — monorepo with an exact-pinned internal package, or published NPM packages, per the guide's two options. And decide who bumps it in both zones.
7. **Decide the version policy.** How far apart may the zones' Next.js versions drift, who notices, and what forces convergence.
8. **Write the exit criteria.** If this is a migration zone, when does it merge back, and who owns that ticket.

🔴 **A "no" or "don't know" on 1, 2 or 4 is a decision, not a gap to fill in later.** Those three are the ones that determine whether the architecture is load-bearing or decorative, and they are all answerable in an afternoon.

## Gotchas

**★ Symptom: a Server Action in a zone is rejected when invoked through the public domain, but works when the zone's own deployment URL is hit directly.** Cause: the action's origin check sees the public origin, which the zone does not know about. Fix: allow-list the public origin in **every zone that has Server Actions**, not just the one where you noticed.

```js
// apps/dashboard/next.config.js
module.exports = {
  experimental: {
    serverActions: {
      allowedOrigins: ['example.com'],
    },
  },
}
```

**★ Symptom: login works in the dashboard zone and the blog zone still thinks the user is anonymous.** Cause: either the cookie was written with a zone-scoped `path`, or the blog zone has no code to read and verify it. Cookies cross; *interpretation* of them does not. Fix: `path: '/'` on the cookie, and a shared verification helper imported by every zone — the `packages/auth/src/session.ts` shape above.

**Symptom: the zone's own deployment URL appears in search results alongside the canonical path.** Cause: a rewrite forwards traffic; it does not make the destination origin private, so both the public path and the zone's deployment domain serve the same document. Fix: restrict the zone origin at the platform level, and emit a canonical URL that always points at the public origin.

```tsx
// apps/blog/app/blog/[slug]/page.tsx
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return {
    alternates: { canonical: `https://example.com/blog/${slug}` },
  }
}
```

⚠️ The multi-zones guide does not address this; treat it as a deployment concern you own.

**★ Symptom: six months after splitting into zones, developer velocity is worse and nobody can say why.** Cause: the split was made on an org-chart boundary rather than a usage boundary, so every feature touches two applications, every developer runs both locally, and every shared change needs two PRs and two deploys. Fix: merge the zones back — copy the routes into the router application, delete its three rewrite rules and the zone's `assetPrefix`, and swap the anchors back to links. The merge is cheap precisely because a zone is *"a normal Next.js application"*; the expensive part is admitting it.

```js
// apps/www/next.config.js — after the merge, the rewrites simply go away
/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig
```

**Symptom: a persistent element — an audio player, a live chat, an open cart drawer — dies whenever the user moves between sections.** Cause: those sections are in different zones, so the move is a document load and the React tree is destroyed. There is no configuration that fixes this. Fix: put those sections in the same zone. If they cannot be in the same zone, the persistent element must be reimplemented as something the browser owns across documents rather than something React owns within one — and that is a large enough constraint that it should be re-examined as evidence the boundary is wrong.

**Symptom: a `fallback` rewrite to a legacy origin stops firing for a path that the new app does not actually serve.** Cause: `fallback` runs at step 8, after dynamic routes at step 7 — so a catch-all route in the new application swallows the path before the fallback is consulted. The docs also warn that with `fallback: true/'blocking'` in `getStaticPaths`, *"those dynamic routes take priority over the fallback `rewrites` defined in your `next.config.js`."* Fix: narrow the catch-all, or move the legacy rule into `afterFiles` for the specific prefixes that must never reach the new app.

**Symptom: a zone works in production and 404s in a preview or staging environment.** Cause: the rewrite destinations are environment variables, and the preview deployment of the router zone still points at production zone domains — or at nothing. There is no framework mechanism that pairs preview deployments across independent applications. Fix: make the destination resolution explicit per environment and fail loudly when a value is missing, rather than letting an empty string produce a rewrite to a relative path.

```js
// apps/www/zone-domains.js — imported by next.config.js
function required(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing zone domain: ${name}. Every environment must set it.`)
  }
  return value
}

module.exports = {
  BLOG_DOMAIN: required('BLOG_DOMAIN'),
  DASHBOARD_DOMAIN: required('DASHBOARD_DOMAIN'),
}
```

**Symptom: the migration proxy that was supposed to be temporary is still in production two years later.** Cause: nobody wrote down the end condition, and a `proxy.ts` that always returns the same answer looks like working code. Fix: pair every migration proxy with a dated removal ticket and collapse it to a static rewrite the moment the flag stops varying — the docs recommend `rewrites` by default *"to minimize latency overhead for the requests"*, and a permanent proxy is that overhead paid forever for a decision that no longer changes.

## Interview questions

**★ When is a multi-zone the wrong answer, and what would you recommend instead?**
Whenever there is not a second team with a second deploy pipeline. Independent deployment and blast-radius isolation are the only benefits zones provide that nothing cheaper does; smaller bundles, faster builds and cleaner module boundaries are all obtainable from route groups plus packages inside one monorepo application. The recommendation is route groups — parenthesised directories that give each area its own layout without affecting the URL — with `CODEOWNERS` enforcing ownership. That keeps soft navigation everywhere, one dependency tree, one design-system version by construction, and full type-safety across the internal boundary, all of which zones give up.

**★ What is the trade-off a multi-zone actually makes?**
It trades runtime and maintenance cost for organisational independence. You get: per-zone deploys, per-zone blast radius, smaller and faster builds, and freedom of framework per zone. You pay: a full document load at every boundary crossing, duplicated client bundles including a second copy of React, version skew between zones that nothing enforces, no type-safety across the boundary, and a local development story where everyone runs everything. If you cannot name the team the independence is for, the trade is one-sided.

**Do cookies work across zones?**
Yes, and this is the main reason session-based auth is workable in a zoned architecture. The browser sees one origin — the guide's own Server Actions note says *"your user facing domain may serve multiple applications"* — and cookies are scoped by domain and path rather than by the application that set them. Two caveats matter in practice. First, a cookie written with a zone-scoped path such as `/dashboard` will not be sent to another zone, so set `path: '/'` deliberately. Second, the cookie travelling is not the same as it being understood: every zone must independently verify the token or look up the session, which means every zone holds the key or reaches the store. That is a real expansion of the secret's blast radius and should be a conscious decision.

**Why do Server Actions need `allowedOrigins` in a multi-zone, and why not just disable the check?**
The action POST arrives carrying the public origin while the zone is deployed at its own domain, so the zone's origin check sees a mismatch and rejects it. The guide requires you to *"explicitly allow the user-facing origin since your user facing domain may serve multiple applications."* Disabling the check is the wrong instinct because it is a real same-origin defence that the rewrite has confused rather than invalidated — the correct move is to declare exactly which foreign-looking origin is legitimate, keeping the protection for every origin you did not name.

**★ How would you migrate an existing monolithic Next.js app to a zone, and how would you migrate back?**
Out: give the new zone real routes under its prefix and an `assetPrefix`, add the three rewrite rules to the router application, delete the corresponding routes from the router, and convert every link that now crosses the boundary to an anchor. Route the cutover through `proxy.ts` behind a flag if you need to roll back per cohort, then collapse it to a static rewrite. Back: copy the routes in, delete the rewrites and the `assetPrefix`, and swap the anchors back to links. Both directions are cheap because a zone is *"a normal Next.js application"* — the link conversion is the step that gets forgotten, which is the argument for routing every link through one component that reads a per-zone prefix list.

**A team wants zones because the build takes twelve minutes. Is that a good reason?**
It is a documented benefit — the guide says splitting *"can reduce the size of each application which improves build times"* — and it is also the reason most often used to justify a split the organisation cannot support. Before accepting it, exhaust the cheaper options, because a zone split costs you hard navigations and version skew permanently while a build fix costs you an afternoon. If the build really is the binding constraint and the pages are genuinely unrelated, zones are legitimate; if the split would put a boundary in the middle of a common user journey, the guide's own rule about frequently co-visited pages says no.

**What is the `fallback` rewrite phase good for that `afterFiles` is not?**
Strangler-fig migrations. `fallback` runs at step 8, after dynamic routes and all static assets have been checked, so it catches only what the new application genuinely does not serve — *"You can also have Next.js fall back to proxying to an existing website after checking all Next.js routes. This way you don't have to change the rewrites configuration when migrating more pages to Next.js."* Adding a page to the new app automatically stops that path reaching the legacy origin, with no config change per page. `afterFiles` cannot do that because it is consulted before dynamic routes are matched.

**Your product manager asks for a persistent audio player that survives navigation to the docs section, which is a separate zone. What do you say?**
That the two requirements are in direct conflict and one has to give. A zone crossing is a document load — *"unloading the resources of the current page and loading the resources of the new page"* — so a React-owned player is destroyed by definition. The options are: move the docs into the same zone, which is what the guide's frequently-co-visited rule would advise anyway; accept that the player restarts; or reimplement it as something the browser owns across documents rather than something React owns within one. The useful framing for the conversation is that this request is *evidence about the boundary*, not a bug to work around.

---

← [Crossing a zone boundary](01c-crossing-zone-boundaries.md) · [Chapter index](01-explanation.md) · Next → [Pages Router → App Router migration](02-pages-router-app-router-migration-roadmaps-for-legacy-codeba.md)
