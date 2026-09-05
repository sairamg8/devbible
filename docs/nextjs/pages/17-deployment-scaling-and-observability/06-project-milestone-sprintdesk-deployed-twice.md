---
title: "Deploy SprintDesk twice from one repository — once on Vercel, once as a Docker container behind a proxy — because the second deployment is the only thing that tells you which of your assumptions were the framework's and which were the platform's"
sidebar_label: "06 · Milestone: deployed twice"
sidebar_position: 10
description: "The chapter 17 milestone: one codebase, two targets, one instrumentation file. Shared observability through instrumentation.ts, the differences that are real versus the ones that are configuration, and an acceptance checklist you can tick off."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against the sources named on the chunks this milestone assembles — [Deploying](https://nextjs.org/docs/app/getting-started/deploying), [Self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [`output`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [`instrumentation.js`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation) (all `version: 16.3.4`), and the Vercel [Environments](https://vercel.com/docs/deployments/environments) and [Skew Protection](https://vercel.com/docs/skew-protection) pages.
> Target: **Next.js 16.3.4** · Node `>= 20.9`. Documentation-verified, **no sandbox run**, no timings — the acceptance criteria below are checks *you* run, not results reproduced here.

**Every previous chunk in this chapter is a mechanism in isolation. This milestone is where they meet, and the reason it insists on *two* deployments is that a single deployment cannot distinguish a framework guarantee from a platform convenience. Image optimization works on Vercel with no configuration; it works self-hosted with no configuration too, but with a `sharp` allocator footnote on glibc. Skew protection is a platform product on Vercel and a `deploymentId` in `next.config.js` when you self-host. The ISR cache is invisible until there are two containers. Ship SprintDesk to both targets from one repository, point both at the same telemetry backend, and the list of things you had to change is the honest answer to "how portable is this app?"**

## Scope

| In scope | Out of scope, and where it lands |
|---|---|
| One repository producing both deployments | — |
| Vercel project with environments and protection configured | — |
| A Docker image using `output: 'standalone'`, behind a reverse proxy | — |
| One `instrumentation.ts` exporting traces and errors from both | — |
| A shared cache handler so the container can scale past one replica | — |
| An acceptance checklist covering both targets | — |
| Choosing a non-Vercel *platform* (Cloudflare, AWS, OpenNext) | [17 · Deploying beyond Vercel](17-choosing-a-deployment-target-beyond-vercel.md) |
| Writing an adapter for that platform | [10 · The Adapters API](10-the-adapters-api-why-it-exists-and-how-a-platform-wires-one-in.md) |
| Immutable static assets and `?dpl` | [18 · Immutable static assets](18-immutable-static-assets-across-deployments.md) |
| CI pipelines and test strategy | [chapter 13 · testing and DX](../13-testing-and-developer-experience/01-explanation.md) |
| Auth, CSP and secrets hygiene | [chapter 10 · forms, auth and security](../10-forms-authentication-and-security-hardening/01-explanation.md) |
| The security, a11y and SEO readiness checklist | [Appendix D · production readiness](../20-appendices/04-appendix-d-production-readiness-checklist-security.md) |

## One config, two targets

The only build-level difference is the output mode, and it is conditional so a single `next.config.ts` serves both:

```ts
// next.config.ts
import type { NextConfig } from 'next'

const selfHosted = process.env.DEPLOY_TARGET === 'container'

const nextConfig: NextConfig = {
  // Standalone tracing is what the container needs; Vercel builds without it.
  output: selfHosted ? 'standalone' : undefined,

  // Self-hosted version-skew detection. On Vercel the platform supplies this.
  deploymentId: selfHosted ? process.env.DEPLOYMENT_VERSION : undefined,

  // A shared server cache, only meaningful when you run your own replicas.
  ...(selfHosted
    ? {
        cacheHandler: require.resolve('./cache-handler.js'),
        cacheMaxMemorySize: 0,
      }
    : {}),
}

export default nextConfig
```

🔴 Note what is *not* conditional: routes, caching directives, Server Actions, `instrumentation.ts`. If any of those need a branch, that is the finding — write it down rather than working around it.

## Deployment A — Vercel

```bash
vercel link
vercel env add DATABASE_URL production
vercel env add OTEL_EXPORTER_OTLP_ENDPOINT production
vercel --prod            # the first deployment is always production
```

Settings that must be *decided* rather than defaulted, each covered earlier in the chapter:

- **Environments** — production values defined for production, preview values for preview, and nothing environment-varying behind `NEXT_PUBLIC_` ([01b](01b-vercel-environments-and-the-build-time-runtime-split.md)).
- **Deployment Protection** — scope and method chosen deliberately, and every self-referential `fetch` rewritten off `NEXT_PUBLIC_VERCEL_URL` ([01](01-vercel-automated-deployments-edge-network-preview-branches.md)).
- **Skew protection** — the system-environment-variables setting enabled, and any hand-written client `fetch` pinned ([01c](01c-the-edge-network-and-skew-protection.md)).
- **Auto-promotion** — on or off, as a written decision.

## Deployment B — the container

```yaml
# compose.yaml
services:
  web:
    build: .
    environment:
      DEPLOY_TARGET: container
      DEPLOYMENT_VERSION: ${GIT_SHA}
      HOSTNAME: 0.0.0.0
      PORT: '3000'
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: redis://cache:6379
      OTEL_EXPORTER_OTLP_ENDPOINT: http://collector:4318
    depends_on: [cache, collector]
    deploy:
      replicas: 2
    stop_grace_period: 30s

  proxy:
    image: nginx:1.29-alpine
    ports: ['8080:80']
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on: [web]

  cache:
    image: redis:8-alpine

  collector:
    image: otel/opentelemetry-collector-contrib:latest
    volumes:
      - ./otel-collector.yaml:/etc/otelcol-contrib/config.yaml:ro
```

```nginx
# nginx.conf — buffering off, or streaming and PPR stop being streaming
server {
  listen 80;
  location / {
    proxy_pass http://web:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_buffering off;
    proxy_request_buffering off;
  }
}
```

**Two replicas is the point.** One container hides every multi-instance problem this chapter is about. The Dockerfile is the official one from [02](02-self-hosting-docker-containerization.md); the cache handler is from [02b](02b-caching-and-the-cachehandler-when-you-run-more-than-one-container.md); `stop_grace_period: 30s` is the drain window `after()` needs.

## One instrumentation file, both targets

```ts
// instrumentation.ts
import { type Instrumentation } from 'next'
import { registerOTel } from '@vercel/otel'

export function register() {
  registerOTel({ serviceName: 'sprintdesk' })
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const digest =
    typeof err === 'object' && err !== null && 'digest' in err
      ? String(err.digest)
      : undefined

  await fetch(process.env.ERROR_SINK_URL!, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: err instanceof Error ? err.message : String(err),
      digest,
      deployment: process.env.DEPLOY_TARGET ?? 'vercel',
      path: request.path,
      method: request.method,
      routePath: context.routePath,
      routeType: context.routeType,
      revalidateReason: context.revalidateReason,
    }),
  })
}
```

The `deployment` field is the whole trick: one backend, one service name, one dimension separating the two targets. Any difference in error rate, span shape or latency distribution between the two is now a query rather than an argument.

## What is genuinely different, and what is only configured differently

| Concern | Vercel | Container | Same underneath? |
|---|---|---|---|
| Image optimization | zero config | zero config with `next start`; glibc allocator note for `sharp` | **yes** |
| Static assets | CDN automatically | you copy `public` and `.next/static`, and front it with a CDN | no |
| Skew detection | platform product, `?dpl` | `deploymentId` in `next.config.js`, same `?dpl` | **yes, same mechanism** |
| ISR / server cache | managed | `cacheHandler` + `cacheMaxMemorySize: 0` + `refreshTags` | **yes, same cache** |
| Streaming / PPR | works | requires `proxy_buffering off` end to end | **yes, if not buffered** |
| `after()` | supported | supported, needs a drain window | **yes** |
| Server Function encryption | per build, one build | must pin `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` across instances | **yes** |
| Region placement | `vercel.json` `regions` | wherever you schedule containers | n/a |
| Cost model | metered per resource | your infrastructure bill | different shape, same drivers |

The right-hand column is the deliverable. Almost everything is the same mechanism with a different owner — which is exactly what *"a single `next start` process handles every Next.js feature correctly"* means in practice.

## Acceptance criteria

Tick every box on **both** deployments unless a row says otherwise.

**Builds and starts**
- [ ] `next build` succeeds for both targets from the same commit, with no branch in application code.
- [ ] The container image copies `public` and `.next/static` into the standalone tree.
- [ ] The container runs as a non-root user and `.next` is writable by it.
- [ ] `CMD` is exec form, and `docker stop` produces a clean shutdown rather than a kill.

**Serving**
- [ ] Both deployments serve the board with identical CSS, fonts and images.
- [ ] `/_next/static/*` returns 200 on both, and carries `Cache-Control: public, max-age=31536000, immutable`.
- [ ] A dynamically rendered route carries `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` on both.
- [ ] A streamed route delivers its shell before its dynamic content on both — check the `start response` span position, not a stopwatch.

**Multi-instance behaviour (container only)**
- [ ] Two replicas serve the same ISR page with the same content after a revalidation.
- [ ] `revalidateTag()` from one replica is visible from the other on the next request.
- [ ] A Server Action submitted through the proxy succeeds regardless of which replica handles it.
- [ ] Restarting one replica does not empty the cache.

**Configuration**
- [ ] No environment-varying value reaches the browser through `NEXT_PUBLIC_`.
- [ ] The same image, with different environment variables, runs against staging and production data.
- [ ] `grep -rn 'VERCEL_URL' app/ lib/` returns nothing, or every hit is a documented exception.
- [ ] `grep -rn 'preferredRegion' app/` returns nothing.

**Observability**
- [ ] Both deployments appear in the same trace backend under `sprintdesk`, distinguishable by the `deployment` dimension.
- [ ] A deliberately thrown error in a Server Action reaches the error sink from both, with `routeType: 'action'` and a `digest`.
- [ ] `next.route` is populated on the root span from both.
- [ ] No cookie or authorization header appears in any telemetry payload.

**Deployment lifecycle**
- [ ] A rollback on Vercel is performed by promoting a previous deployment, not by redeploying.
- [ ] Deploying while a browser tab is open produces a hard navigation rather than a chunk-load error, on both.
- [ ] The Vercel preview URL used in CI is the commit URL, not the branch URL.

## Gotchas

**★ Symptom: the container build works locally and the Vercel build fails on `cache-handler.js`.** Cause: `require.resolve` is evaluated when `next.config.ts` loads, on both targets. Fix: keep the whole cache configuration inside the conditional spread, as above — do not compute the path outside it.

**★ Symptom: the two deployments disagree about which routes are static.** Cause: an environment variable read at module scope or in a layout differs between the targets, so one build prerendered a route the other did not. Fix: read environment-varying values at request time behind `connection()`, and compare the build output route table between the two builds as a review step.

**★ Symptom: the container serves stale board data after a webhook revalidation and Vercel does not.** Cause: `refreshTags()` is not implemented, so invalidation reached one replica only — a difference that a single container would have hidden completely. Fix: implement it, then re-run the multi-instance checks above.

**★ Symptom: errors from the container never reach the sink although traces do.** Cause: `onRequestError` did an un-awaited `fetch`, and the container's shorter request lifecycle drops it more often than the platform's. Fix: `await` it. The bug existed on both targets; only one of them made it visible.

**★ Symptom: the self-hosted deployment shows a chunk-load error after every release.** Cause: no `deploymentId`, so there is no version-skew detection and old clients request chunks the new containers do not have. Fix: set it from the commit SHA — and remember `generateBuildId` has no effect once it is set.

**★ Symptom: `after()` writes are missing from the container's telemetry but present on Vercel.** Cause: the orchestrator is killing the process before the drain completes. Fix: `stop_grace_period: 30s` in compose, `terminationGracePeriodSeconds` in Kubernetes, and exec-form `CMD`.

**★ Symptom: images render on Vercel and 404 in the container.** Cause: `public/` was not copied into the standalone tree — the same omission as `.next/static`, but it surfaces as broken images rather than broken styling, so it is often diagnosed separately. Fix: copy both, and make the acceptance checklist assert both.

**Symptom: the two deployments report wildly different latency for the same route.** Cause: usually the proxy buffering, occasionally the database being in a different network. Fix: check the `start response` span first — if it sits at the end of the root span, it is buffering, and no amount of database tuning will move it.

**Symptom: the milestone "passes" but only one container was ever running.** Cause: `replicas: 2` was dropped to simplify local testing. Fix: this invalidates four of the acceptance criteria. Run two; the entire point of the exercise is the problems that only exist at two.

## Interview questions

**★ What does deploying the same application twice tell you that deploying it once cannot?**
Which of your assumptions belong to the framework and which belong to the platform. On one target, "ISR works", "skew is handled" and "images are optimised" are indistinguishable from "the platform does that for us". On two, each becomes a specific mechanism with a specific owner: the cache is a `cacheHandler`, skew is a `deploymentId`, image optimization is `sharp` plus an allocator note. It also surfaces the class of bug that only exists at more than one instance, which most teams meet for the first time during an incident.

**★ Which parts of a Next.js application genuinely have to differ between a Vercel deployment and a container?**
Very few, and none of them in application code. The output mode (`standalone` for the container), the cache handler and `cacheMaxMemorySize`, `deploymentId`, and the infrastructure in front — a CDN for static assets, a proxy that does not buffer, a drain window. Routes, caching directives, Server Actions and `instrumentation.ts` should be byte-identical. If any of them needs a branch, that branch is a portability defect worth recording.

**★ Why does the milestone insist on two replicas rather than one container?**
Because one container is a single `next start` process with a persistent disk, which the documentation says handles every feature correctly — so it hides the entire multi-instance problem set. At two, the ISR cache splits, `revalidateTag` reaches one instance, and Server Function encryption keys must match. Those are the failures that self-hosted teams actually hit, and they are invisible in a single-container test that otherwise looks like a complete validation.

**★ How do you make one telemetry backend useful for two deployments without doubling your dashboards?**
Same service name, one extra dimension. Both targets register the same OpenTelemetry service and both send errors to the same sink; a `deployment` field on the payload and a resource attribute on the traces distinguishes them. Everything then becomes a comparison rather than two separate views — same route, same span shape, two values on one axis. It also means a regression that appears on only one target is immediately visible as a divergence rather than as a number nobody has a baseline for.

**★ You have to justify the effort of a second deployment to a team that is happy on Vercel. What is the argument?**
It is a portability audit and a comprehension test, not a migration plan. It costs a Dockerfile, a compose file and a conditional block in `next.config.ts`, and it returns a written list of everything the platform is doing for you — which is the thing you need on the day a procurement decision, a residency requirement or an outage makes the question urgent. The alternative is discovering the list under time pressure, with the same work to do and none of the calm.

**★ Which acceptance criterion is the most commonly faked, and why does it matter?**
"A streamed route delivers its shell before its dynamic content." It is easy to declare it passed because the page looks fast, and hard to observe without checking the position of the `start response` span inside the root span. A buffering proxy produces correct output with the streaming advantage removed and nothing in the logs, so the only honest check is the timestamp. Every other criterion on the list fails loudly; that one fails silently.

**What would you add to this milestone for an application that is not SprintDesk?**
Whatever the application depends on that a container does not provide by default: a background job runner if `after()` is doing more than fire-and-forget writes, an object store if uploads currently rely on a platform primitive, a session store if authentication assumed one region. The general form of the question is "what is the platform providing that is not in my repository", and the second deployment is the mechanical way to enumerate it — anything you had to add to make the container work is on that list, by construction.

---

← [Cost engineering](05-cost-engineering-function-compute-bandwidth-and-edge-cache-h.md) · [Chapter 17 overview](01-explanation.md) · Next → [The Adapters API](10-the-adapters-api-why-it-exists-and-how-a-platform-wires-one-in.md)
