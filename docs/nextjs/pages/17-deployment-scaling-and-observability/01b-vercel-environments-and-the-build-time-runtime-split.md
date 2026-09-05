---
title: "An environment on Vercel is a set of variables, not a machine — and because NEXT_PUBLIC_ values are inlined into the bundle at build time, 'promote the staging build to production' silently ships staging configuration"
sidebar_label: "01b · Environments and build-time vs runtime"
sidebar_position: 2
description: "Local, Preview, Production and custom environments with their plan limits, pulling variables for local work, and the build-time versus runtime boundary that decides whether an artefact can be promoted across environments at all."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [Environments](https://vercel.com/docs/deployments/environments) (`last_updated: 2026-08-14`) and [Deploying to Vercel](https://vercel.com/docs/deployments) (`2026-09-03`) on vercel.com, and the Next.js [Self-hosting guide § Environment Variables](https://nextjs.org/docs/app/guides/self-hosting) (`version: 16.3.4`, `lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** · Node `>= 20.9`. Documentation-verified, **no sandbox run**. Prior page: [01 · Vercel deploys, previews, protection](01-vercel-automated-deployments-edge-network-preview-branches.md).

**There is no staging server. An environment on Vercel is a named set of environment variables plus a rule for which deployments get them — and that is the whole abstraction. This is a better model than a machine, right up until you meet the one place it leaks: a `NEXT_PUBLIC_` value is not read from the environment at runtime, it is textually substituted into the JavaScript bundle during `next build`. That makes it a property of the artefact rather than of the environment serving it. So "build once, promote everywhere" is true for server-side configuration and false for anything the browser reads, and a team that has not drawn that line will eventually promote a preview build to production and watch the browser keep calling the staging API. This page is where the line is, and how to write code that stays on the right side of it.**

## The three environments, and the fourth you may not have

> *"Vercel provides three default environments—**Local**, **Preview**, and **Production**"*

> *"Pro and Enterprise teams can create **Custom Environments** for more specialized workflows (e.g., `staging`, `QA`). Every environment can define its own unique environment variables, like database connection information or API keys."*

The plan limits are a design constraint, not a footnote:

| Plan | Custom environments per project |
|---|---|
| Hobby | none |
| Pro | **1** |
| Enterprise | **12** |

A pipeline with `dev → qa → staging → prod` does not fit on Pro. What fits is one custom environment plus branch-tracked previews carrying their own variables — which is usually enough, because a preview *is* a full deployment with its own configuration, not a degraded one.

A custom environment can be given **branch tracking** so a matching push deploys to it automatically, and a **domain** so it has a stable URL rather than a generated one. Without a domain, "the staging URL" changes on every deploy and nobody can bookmark it.

## Getting the variables onto your machine

The documented flow is pull, not copy-paste:

```bash
npm i -g vercel
vercel link            # writes .vercel/ with the project and org IDs
vercel env pull        # writes .env.local
```

> *"This will populate the `.env.local` file in your application directory."*

For a custom environment, everything takes an explicit target:

```bash
vercel deploy --target=staging
vercel pull --environment=staging
vercel env add DATABASE_URL staging
```

⚠️ `vercel env pull` with no `--environment` does **not** give you production values. If you are debugging a production-only behaviour locally, pull production explicitly and into a file you will notice:

```bash
vercel env pull .env.production.local --environment=production
```

## 🔴 The build-time / runtime boundary

Two sentences from the Next.js self-hosting guide carry the whole argument:

> *"Next.js can support both build time and runtime environment variables."*

> *"**By default, environment variables are only available on the server**. To expose an environment variable to the browser, it must be prefixed with `NEXT_PUBLIC_`. However, these public environment variables will be inlined into the JavaScript bundle during `next build`."*

**Inlined** is the load-bearing word. It does not mean "made available to the browser at runtime"; it means the string is substituted into the emitted JavaScript, the way a C preprocessor macro is. After the build there is no variable left to change. The value is as fixed as any other literal in the bundle.

That produces a clean rule with no exceptions:

| Where the value is read | When it is resolved | Can the artefact be promoted across environments? |
|---|---|---|
| Server, on a static/prerendered path | build time | no — the value is baked into the prerender |
| Server, after `connection()` / `cookies()` / `headers()` | request time | **yes** |
| Browser, via `NEXT_PUBLIC_*` | build time | **no** |
| Browser, via a prop rendered by the server | request time | **yes** |

The documented pattern for the runtime case:

```tsx
// app/status/page.tsx
import { connection } from 'next/server'

export default async function StatusPage() {
  await connection()
  // cookies, headers, and other Request-time APIs also opt into dynamic
  // rendering, so these are read when the request arrives, not at build.
  const region = process.env.DEPLOY_REGION ?? 'unknown'
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? 'local'

  return (
    <dl>
      <dt>Region</dt>
      <dd>{region}</dd>
      <dt>Commit</dt>
      <dd>{commit}</dd>
    </dl>
  )
}
```

The guide draws the conclusion in one sentence, about Docker but true of any artefact:

> *"This allows you to use a singular Docker image that can be promoted through multiple environments with different values."*

## Getting an environment-varying value to the browser without inlining it

Read it on the server, pass it as a prop. The Client Component never touches `process.env`.

```tsx
// app/analytics-client.tsx
'use client'

import { useEffect } from 'react'

export function AnalyticsClient({ host }: { host: string }) {
  useEffect(() => {
    if (!host) return
    const script = document.createElement('script')
    script.src = `${host}/collector.js`
    script.async = true
    document.head.appendChild(script)
    return () => {
      script.remove()
    }
  }, [host])

  return null
}
```

```tsx
// app/(marketing)/layout.tsx — scoped to the routes that need it,
// not the root layout, so the rest of the app stays static.
import { connection } from 'next/server'
import { AnalyticsClient } from '../analytics-client'

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await connection()
  const analyticsHost = process.env.ANALYTICS_HOST ?? ''

  return (
    <>
      <AnalyticsClient host={analyticsHost} />
      {children}
    </>
  )
}
```

🔴 **`connection()` opts that subtree into dynamic rendering.** Every route under this layout now runs a function on every request instead of being served from cache, and that shows up on the invoicing side as invocations, Active CPU and Provisioned Memory — see [05 · Cost engineering](05-cost-engineering-function-compute-bandwidth-and-edge-cache-h.md). Putting this in the *root* layout makes the entire application dynamic to configure one script tag. Scope it to the smallest layout that needs the value.

If a value genuinely never varies between environments — a public product name, a fixed CDN hostname you own — `NEXT_PUBLIC_` is correct and free. The rule is about *variance*, not about publicity.

## System environment variables

Vercel injects its own set (deployment ID, commit SHA, branch, URL). Two facts about them are easy to trip over.

The framework-scoped variables are prefixed:

> *"The Framework Environment Variable `VERCEL_URL` is prefixed with the name of the framework. For example, `VERCEL_URL` for Next.js is `NEXT_PUBLIC_VERCEL_URL`"*

Which means `NEXT_PUBLIC_VERCEL_URL` is subject to everything above: inlined at build, wrong after a promotion, and — as [01](01-vercel-automated-deployments-edge-network-preview-branches.md) covers — pointing at a host that Standard Protection makes unreachable.

And exposure is a project setting that other features depend on. Skew Protection's own enablement steps begin with:

> *"Ensure your project has the Enable access to System Environment Variables setting enabled"*

So a project with that setting off does not merely lack a few convenience variables; features that read them stop working. See [01c · The edge network and skew protection](01c-the-edge-network-and-skew-protection.md).

## Gotchas

**★ Symptom: you promoted the staging deployment to production and the browser still calls the staging API.** Cause: `NEXT_PUBLIC_*` values are *"inlined into the JavaScript bundle during `next build`"*, so promotion moves an alias to an artefact whose bundle already contains the staging host. Fix: read the value on the server and pass it down, as in `MarketingLayout` above. If you keep the prefix, you must rebuild rather than promote — those are the only two options.

**★ Symptom: rotating a secret in the Vercel dashboard changed nothing until the next deploy.** Cause: a build-time value is captured in the artefact; the running deployment was built with the old one. Server-side values read at request time do pick up changes on the next deploy too, because the artefact is what carries them — the dashboard edits the *next* build's inputs. Fix: after any variable change, redeploy the affected environment, and treat "edited the variable" as an incomplete action:

```bash
vercel env add STRIPE_SECRET_KEY production
vercel --prod          # nothing changed until this runs
```

**★ Symptom: `vercel env pull` handed you preview values while you were reproducing a production bug.** Cause: the CLI pulls for the environment it targets, and the bare command is not the production set. Fix: `vercel env pull .env.production.local --environment=production`, and never assume `.env.local` matches anything in particular.

**★ Symptom: adding one analytics script made every route in the application dynamic and the invoice moved.** Cause: `connection()` was called in the root layout to read a runtime value, opting the whole tree out of static rendering. Fix: move the call into the narrowest layout that needs it — a marketing group, a dashboard segment — so the static routes stay static.

**★ Symptom: `staging` cannot be created on Pro because a custom environment already exists.** Cause: the documented limit of one custom environment per project on Pro, twelve on Enterprise. Fix: collapse to a single pre-production environment and use branch-tracked previews with their own variables for the second stage; a preview deployment is a full deployment, not a reduced one.

**★ Symptom: the "staging URL" changes every time someone deploys, and the QA bookmark is always stale.** Cause: the custom environment has no attached domain, so it serves on generated URLs. Fix: attach a domain to the environment. The documentation also notes the domain must be verified and serve the environment's latest deployment directly rather than redirect elsewhere.

**Symptom: a secret appeared in the client bundle.** Cause: somebody prefixed it `NEXT_PUBLIC_` to make an import error go away. Inlining is literal — the secret is now a string constant in a public JavaScript file, and in every browser cache that fetched it. Fix: remove the prefix, rotate the secret (it is compromised, not merely exposed), and move the read to a Server Component or Route Handler.

**Symptom: `NEXT_PUBLIC_VERCEL_URL` is correct in previews and wrong in production.** Cause: it was inlined during whichever build produced the artefact now aliased to production. If that artefact was built as a preview and then promoted, it carries the preview host. Fix: do not build URLs from it at all — use a relative path on the client, and the incoming request's origin on the server.

**Symptom: local development works and the deployed preview cannot reach the database.** Cause: `.env.local` was populated by `vercel env pull` from one environment while the preview deployment reads another environment's set. Fix: check which environment the variable is actually defined in, in the dashboard; a variable that exists only in Development is invisible to every deployment.

## Interview questions

**★ Why can a Docker image or a built artefact be promoted from staging to production for server configuration but not for browser configuration?**
Because the two are resolved at different times. Server-side values read at request time — after `connection()`, `cookies()` or `headers()` — come from the process environment of whatever is running the artefact, so the same image behaves differently in different environments. `NEXT_PUBLIC_` values are inlined into the JavaScript bundle during `next build`, so they are literals inside the artefact and no environment can override them. The documentation makes exactly this point when it says a single Docker image can be promoted through multiple environments with different values: it is talking about the runtime half.

**★ What does "inlined" actually mean, and why is it stronger than "exposed"?**
It means textual substitution into the emitted code at build time, the way a macro expands — after the build there is no variable, only a string literal. "Exposed" would suggest the browser reads a value that still exists somewhere and could be changed; inlining means it cannot. That is why a mistakenly-prefixed secret is *compromised* rather than merely *visible*: it is a constant in a public file, already in CDN and browser caches, and rotating the variable does not remove the copies.

**★ You edited an environment variable in the dashboard and the running site did not change. Is that a bug?**
No, it is the artefact model. A deployment is the output of a build, and the build is what read the variables. Editing a variable changes the inputs to the *next* build. For a value that must change without a deploy you need a different mechanism entirely — a configuration store read at request time, or a feature-flag service — not an environment variable.

**★ How would you ship an environment-varying analytics host to the browser without a rebuild per environment, and what does the fix cost?**
Read it in a Server Component after `connection()` and pass it as a prop to a Client Component that does the DOM work. The Client Component never mentions `process.env`, so nothing is inlined. The cost is that `connection()` opts the subtree into dynamic rendering, so those routes stop being served from cache and start invoking a function per request. That is why you place the call in the narrowest layout that needs it rather than the root layout — the root layout version makes the whole application dynamic to configure one script tag.

**★ On the Pro plan you get one custom environment. Design a four-stage pipeline anyway.**
Use Production, one custom environment for the long-lived pre-production stage that needs a stable domain and its own database, and branch-tracked previews for everything upstream of it. A preview deployment is a full deployment with its own variable set, so "QA" and "integration" can be branches rather than environments; what they lose is a stable bookmarkable URL, which is the actual thing a custom environment buys. If two stages both need stable URLs and different secrets, that is the point at which the plan limit is a real constraint rather than an inconvenience.

**★ Why is `NEXT_PUBLIC_VERCEL_URL` a trap on two separate axes?**
First, it is a `NEXT_PUBLIC_` variable, so it is inlined at build time — an artefact built as a preview and later promoted carries the preview host into production. Second, it names the *generated* deployment URL, which Standard Protection restricts, so code that builds absolute URLs from it starts receiving authentication responses the day protection is enabled. Neither failure is visible in review; both are fixed the same way, by using relative paths on the client and the incoming request's origin on the server.

**What is the relationship between the "Enable access to System Environment Variables" project setting and features you did not configure?**
Some platform features are implemented by the framework reading those variables at build or run time. Skew Protection's documented enablement steps start by requiring that setting, because the deployment ID it pins requests to arrives that way. So turning the setting off is not a cosmetic tightening — it can silently disable a feature whose own toggle is still on, and the symptom shows up as version-skew errors rather than as a missing variable.

**A colleague argues that all configuration should be `NEXT_PUBLIC_` for simplicity. Give the counter-argument in one paragraph.**
Every `NEXT_PUBLIC_` value is three things at once: a public string, a build input, and a promotion blocker. Public means secrets are out of the question. Build input means changing it requires a deploy, which removes your ability to fix configuration during an incident without shipping code. And promotion blocker means the build-once-deploy-many pipeline stops working, so every environment needs its own build, multiplying build minutes and creating the possibility that the artefact you tested is not the artefact you shipped. The prefix is correct for values that are genuinely constant across environments and genuinely public — a product name, a domain you own — and wrong for everything else.

---

← [Vercel: deploys, previews, protection](01-vercel-automated-deployments-edge-network-preview-branches.md) · [Chapter 17 overview](01-explanation.md) · Next → [The edge network and skew protection](01c-the-edge-network-and-skew-protection.md)
