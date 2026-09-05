---
title: "On Vercel a deployment is an immutable build artefact with its own URL and production is only a pointer at one of them — the first deploy landing in production, a branch preview URL that moves under your test run, and protection breaking your own fetches all follow from that"
sidebar_label: "01 · Vercel: deploys, previews, protection"
sidebar_position: 1
description: "Git-driven deployments, what triggers preview versus production, branch versus commit preview URLs, promotion and rollback without a rebuild, and the Deployment Protection method/scope matrix with the VERCEL_URL trap it springs."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Vercel documentation — [Deploying to Vercel](https://vercel.com/docs/deployments) (`last_updated: 2026-09-03`), [Environments](https://vercel.com/docs/deployments/environments) (`2026-08-14`) and [Deployment Protection](https://vercel.com/docs/deployment-protection) (`2026-08-28`).
> Target: **Next.js 16.3.4** · Node `>= 20.9`. `next` is **not installed in this checkout** — documentation-verified only, **no sandbox run**, no timings, no console output.

**Vercel's workflow is one idea repeated: a deployment is an immutable artefact, permanently addressable at its own URL, and "production" is nothing more than an alias pointing at one of them. Every piece of behaviour that catches people out is that idea showing through. The first deploy of a new project goes to production even when you did not ask for it, because a project with no production deployment has nothing to point domains at. A branch preview URL silently retargets when anyone pushes, because it is a pointer too. Rollback is not a rebuild, because the good artefact still exists. And the moment you enable Deployment Protection, the generated URL your own server-side `fetch` calls were using stops answering — which is the single most common self-inflicted outage on the platform. Configuration and environment variables are the sibling page, [01b](01b-vercel-environments-and-the-build-time-runtime-split.md); this one is the lifecycle and the access control.**

## A deployment is a build, not a state

> *"A **deployment** on Vercel is the result of a successful build of your project. Each time you deploy, Vercel generates a unique URL so you and your team can preview changes in a live environment."*

Read that literally. The deployment is the *output*, it has a URL for as long as it is retained, and it does not change. There is no "staging server" that gets redeployed; there are N artefacts and a handful of aliases pointing into them. Rollback is therefore not a rebuild — it is moving the production alias back to an artefact that still exists.

Five documented ways to create one: Git, [Vercel Drop](https://vercel.com/docs/drop), the CLI, Deploy Hooks and the REST API. For a Next.js app only the first two matter day to day.

> *"The most common way to create a deployment is by pushing code to a connected Git repository. When you import a Git repository to Vercel, each commit or pull request (on supported Git providers) automatically triggers a new deployment."*

## What triggers a preview, and what triggers production

The rules are exact, and the exception is where the surprise lives.

> *"By default, Vercel creates a preview deployment when you: Push a commit to a branch that is **not** your production branch (commonly `main`); Create a pull request (PR) on GitHub, GitLab, or Bitbucket; Deploy using the CLI without the `--prod` flag, for example just `vercel`"*

And production:

> *"By default, pushing or merging changes into your production branch (commonly `main`) triggers a production deployment."*

🔴 Then the rule that catches every team exactly once:

> *"The first deployment of a new project is always a **production** deployment. This happens even when you: Import a Git repository in the dashboard; Run `vercel` or `vercel deploy` from the CLI without `--prod`; Deploy from a branch that is not your production branch"*

The reason is given in the same section: Vercel does this so every new project has a production deployment and can receive production domains right away. So the very first `vercel` you run — from a feature branch, with a half-filled `.env.local` and no database configured — *is* your production site. If a custom domain is already attached, it is live.

## The two preview URLs are not interchangeable

> *"There are two types of preview URLs: **Branch-specific URL** – Always points to the latest changes on that branch; **Commit-specific URL** – Points to the exact deployment of that commit"*

| Use | URL to paste |
|---|---|
| "Review my PR" in Slack | **branch** URL — reviewers should see your latest push |
| A bug report, a screenshot, a failing-test artefact | **commit** URL — it must not move |
| An end-to-end suite in CI | **commit** URL — otherwise a teammate's push retargets the host mid-run |
| A QA sign-off record | **commit** URL — a sign-off against a moving target signs off on nothing |

A CI job that reads the branch URL and then runs a twenty-minute Playwright suite against it is testing whatever happened to be deployed at each moment, not the commit that triggered it. This is the most common source of "flaky" preview tests that are not flaky at all.

## Promotion and rollback

The dashboard actions on any deployment are **Redeploy**, **Inspect**, **Assign a Custom Domain** and:

> *"**Promote to Production**: Convert a preview deployment to production (if needed)."*

Auto-promotion is optional:

> *"For advanced workflows, you can disable the auto-promotion of deployments and manually control promotion."*

Turning auto-promotion off converts "merge to `main`" from *ship* into *build a production-configured candidate*. That is the right shape for a team that wants a human gate — and it also removes the build-time-inlining hazard described in [01b](01b-vercel-environments-and-the-build-time-runtime-split.md), because the candidate is built with production values rather than promoted from a preview build.

🔴 **Rollback is promotion, not redeployment.** Promoting the last known-good deployment moves the alias to bytes that are already proven. **Redeploy** re-runs the build, which resolves dependencies again, re-reads environment variables and re-inlines every `NEXT_PUBLIC_` value — so it can produce something subtly different from the artefact you were trying to get back to. A rollback should not involve a compiler.

## Deployment Protection: two axes, not one

> *"Deployment Protection lets you control who can access your preview and production URLs. You configure it at the project level, choosing both a **protection method** (how you protect) and a **protection scope** (what you protect)."*

**Method** — who gets through:

| Method | Availability |
|---|---|
| Vercel Authentication | **All plans** |
| Passport (your own identity provider) | Enterprise |
| Password Protection | Enterprise, or a paid add-on for Pro |
| Trusted IPs | Enterprise |

**Scope** — what is covered:

| Scope | What it protects | Availability |
|---|---|---|
| Standard Protection | *"all deployments **except** production domains"* | All plans |
| All Deployments | *"**all** URLs, including production domains"* | Pro and Enterprise |
| (Legacy) Standard Protection | all preview and deployment URLs; up-to-date production URLs unprotected | legacy |
| (Legacy) Pre-Production Deployments | preview URLs only | legacy |

Two consequences people miss. First:

> *"Deployment Protection requires authentication for all requests, including those to Routing Middleware."*

Your proxy or middleware does not run first and wave the request through — protection is *upstream* of your code. You cannot write a matcher that exempts a webhook path.

Second, the Hobby caveat is a real constraint on a side project: Vercel Authentication with Standard Protection covers previews and deployment URLs, but the production domain stays public. Protecting a production domain needs Pro or Enterprise.

### 🔴 The `VERCEL_URL` trap that Standard Protection springs

Enabling Standard Protection restricts the production *generated* deployment URL. If your own code fetches itself through that URL, your own code now receives an authentication page instead of JSON.

> *"Update any fetch requests that use `VERCEL_URL` or `VERCEL_BRANCH_URL` from System Environment Variables to target the same domain the user requested, since those variables will no longer be publicly accessible."*

The documented fix for client-side calls is relative paths, which target the requested domain and carry the protection cookie automatically:

```ts
// ❌ before: absolute, through the generated URL, now blocked by protection
fetch(`${process.env.NEXT_PUBLIC_VERCEL_URL}/api/board`)

// ✅ after: relative, same origin, the protection cookie rides along
fetch('/api/board')
```

Note the spelling. The docs are explicit that the framework-scoped variable differs from the system one: *"`VERCEL_URL` for Next.js is `NEXT_PUBLIC_VERCEL_URL`"* — which also makes it a `NEXT_PUBLIC_` value, inlined into the bundle at build time, and therefore wrong after any promotion. Two distinct bugs in one variable.

For server-side calls, the documented fix is to use the origin of the incoming request and forward its cookies:

```ts
// app/api/refresh/route.ts
import { headers, cookies } from 'next/headers'

export async function POST() {
  const h = await headers()
  const c = await cookies()
  const origin = h.get('origin') ?? `https://${h.get('host')}`
  const cookieHeader = c
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ')

  const res = await fetch(`${origin}/api/board`, {
    headers: { cookie: cookieHeader },
  })
  return Response.json(await res.json())
}
```

⚠️ Where a fully-qualified URL is genuinely required — the docs name OG image generation — use the real production domain, not the generated one.

### Source maps without shipping source

> *"Protected Source Maps gates `.map` file requests behind Vercel Authentication, so you can ship browser source maps to production without exposing source code."*

This is the answer to "we want readable stack traces in Sentry but not a public copy of our codebase". It pairs directly with [04 · Telemetry](04-telemetry-sentry-logtail-datadog-integration-via-instrumenta.md), where unminified frames are the whole point of the integration.

### The add-on has a lock-in clause

Advanced Deployment Protection — Password Protection, private production deployments, protection exceptions — is **$150 per month** on Pro, and:

> *"You must have used the feature for **a minimum of 30 days** before you can disable it."*

Enabling it to unblock one client demo costs a month.

## Gotchas

**★ Symptom: your first `vercel` from a feature branch put an unfinished app on the production domain.** Cause: the documented rule that the first deployment of a new project is always a production deployment, regardless of branch or flags, because a project needs a production deployment before it can hold production domains. Fix: create the project deliberately, from the branch you mean, and attach the domain only afterwards:

```bash
git switch main
vercel link
vercel --prod          # a deliberate first production deployment
# only now attach the domain in Project → Settings → Domains
```

**★ Symptom: end-to-end tests pass, fail, then pass again on the same PR with no code change.** Cause: CI is pointed at the branch-specific preview URL, which *"always points to the latest changes on that branch"*, so a colleague's push retargets it mid-run. Fix: capture the commit-specific URL the deploy prints and pin the run to it:

```bash
DEPLOY_URL=$(vercel deploy | tail -n 1)
PLAYWRIGHT_BASE_URL="$DEPLOY_URL" npx playwright test
```

**★ Symptom: enabling Standard Protection broke server-side fetches inside your own application.** Cause: the production generated deployment URL is now protected, and `NEXT_PUBLIC_VERCEL_URL` points at it. Fix: derive the origin from the incoming request and forward the cookie header, as in the Route Handler above — never widen the protection scope to make your own code work.

**★ Symptom: your own login page never renders on a protected preview; you get Vercel's instead.** Cause: protection *"requires authentication for all requests, including those to Routing Middleware"*, so the platform answers before your code runs. Fix: do not code around it. Either scope protection to previews only, or issue a Protection Bypass for Automation secret to the callers that must reach it.

**★ Symptom: an incoming webhook — Stripe, a CMS, a GitHub app — returns 401 on preview deployments only.** Cause: previews are protected and the third party has no Vercel session. Fix: point the webhook at production, or attach a Protection Bypass for Automation secret to the preview endpoint. Setting the scope to "None" to make one webhook work removes protection from every preview in the project.

**★ Symptom: a rollback "redeployed" and picked up a broken transitive dependency.** Cause: **Redeploy** re-runs the build; you wanted to move the production alias back to an artefact that already exists. Fix: promote the known-good deployment instead of rebuilding it. Immutability is exactly what makes that safe.

**Symptom: a deployment URL that worked last month now 404s.** Cause: deployment retention deleted the artefact. Immutability is not permanence — a deleted deployment is gone, and anything pinned to it (a bug-report link, a skew-protected client) breaks with it. Fix: record the commit SHA next to any URL you intend to keep, and treat commit URLs as short-lived references.

**Symptom: the PR comment shows a deployment that never finished building, and reviewers see the previous version.** Cause: the branch alias only advances on a *successful* build; a failed build leaves it pointing at the last good one. Fix: read the deployment status, not the URL, before treating a preview as review-ready — a green link and a green build are different facts.

## Interview questions

**★ Why does Vercel make the first deployment of a project a production deployment even when you did not ask for it?**
Because production domains have to point at something. The documentation states the rule and the reason together: the first deployment is always production so that every new project has a production deployment and can receive production domains right away. Until that artefact exists there is no target for an alias. The practical consequence is that the very first `vercel` you run — from any branch, with or without `--prod` — defines production, so link and deploy deliberately before attaching a domain.

**★ What is the difference between a branch preview URL and a commit preview URL, and when does the difference bite?**
The branch URL always points to the latest deployment on that branch; the commit URL points at one specific deployment for as long as it is retained. The difference bites in anything long-running or evidential — a CI suite, a QA sign-off, a bug report. A twenty-minute test run against the branch URL can start on one artefact and finish on another because a teammate pushed. Anything that must be reproducible uses the commit URL.

**★ What is the correct way to roll back a bad production deploy, and what is the common wrong way?**
Promote the last known-good deployment: the production alias moves to an artefact that already exists and is byte-identical to what was working. The common wrong way is **Redeploy** on the old commit, which re-runs the build — resolving dependencies again, re-reading environment variables, re-inlining every `NEXT_PUBLIC_` value — so it can differ from the thing you were trying to restore. A rollback should not involve a compiler.

**★ Deployment Protection has a "method" and a "scope". Why two axes rather than one setting?**
Because *who may enter* and *what is behind the door* are independent decisions with different plan availability. Vercel Authentication is on every plan; Trusted IPs and Passport are Enterprise. Standard Protection (everything except production domains) is on every plan; covering production domains too needs Pro or Enterprise. Splitting the axes lets you express "Vercel Authentication over previews only" on Hobby and "Trusted IPs over production only" on Enterprise with the same two controls.

**★ Enabling Standard Protection broke calls your application makes to itself. Explain precisely why, and fix it.**
Standard Protection restricts the production *generated* deployment URL — the `*.vercel.app` host that `VERCEL_URL` / `NEXT_PUBLIC_VERCEL_URL` exposes — while leaving the custom production domain open. Code that built an absolute URL from that variable now requests a protected host without a session and receives an authentication response instead of data. On the client the fix is a relative path, which targets the domain the user requested and carries the protection cookie. On the server, use the origin from the incoming request and forward the request's cookies manually.

**★ Where does Deployment Protection sit relative to your own middleware, and why does that ordering matter?**
Upstream of it. The documentation is explicit that protection applies to all requests, including those to Routing Middleware, so the platform answers before your code runs. You cannot exempt a webhook path with a matcher and you cannot render your own login page for a protected preview. Machine callers need Protection Bypass for Automation; there is no in-application workaround, and looking for one is how teams end up disabling protection entirely.

**★ Why do "protected source maps" exist as a separate feature rather than just shipping or not shipping `.map` files?**
Because the two things you want are in tension: readable stack traces in an error tracker require source maps to be reachable, and reachable source maps are your source code. Protected Source Maps gates `.map` requests behind Vercel Authentication, so the files ship with the deployment and resolve for authenticated tooling without being public. Without it teams either upload maps out-of-band to the error tracker or accept minified frames in production incidents.

**Your team wants a human gate between merging to `main` and users seeing the change. What changes, and what does it cost?**
Disable auto-promotion. Merging then produces a production-configured deployment that is built but not aliased, and someone promotes it explicitly. The benefit beyond the gate is that the candidate is built with production values, so nothing is inlined from a preview environment. The cost is that "merged" and "shipped" become two distinct states your process, your changelog and your on-call rotation all have to track.

**Why is "immutable deployment" a security property and not just an operational one?**
Because it means an artefact under investigation cannot change while you are investigating it. A commit URL from an incident three weeks ago serves exactly the bytes that were serving then, so you can diff behaviour rather than reconstruct it — provided retention has not deleted it. It also means a compromised build is contained to one artefact: you promote past it rather than trying to repair it in place, and you can delete it to stop clients reaching it.

---

← [Chapter 17 overview](01-explanation.md) · Next → [Environments and the build-time/runtime split](01b-vercel-environments-and-the-build-time-runtime-split.md)
