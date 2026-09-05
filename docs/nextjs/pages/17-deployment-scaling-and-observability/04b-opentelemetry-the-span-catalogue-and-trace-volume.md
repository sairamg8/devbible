---
title: "Next.js instruments itself in OpenTelemetry terms, so the spans exist whether or not you look at them — the work is choosing a registration path that survives the edge runtime and deciding, before the invoice, which spans you actually want"
sidebar_label: "04b · OpenTelemetry and the span catalogue"
sidebar_position: 8
description: "@vercel/otel versus a manual NodeSDK, the edge-runtime incompatibility, every default span Next.js emits with its next.span_type, the next.* attributes and the next.page identity trap, custom spans, and the two environment variables that govern trace volume."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [How to set up instrumentation with OpenTelemetry](https://nextjs.org/docs/app/guides/open-telemetry) (`version: 16.3.4`, `lastUpdated: 2026-08-25`) and [`instrumentation.js`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation) (`lastUpdated: 2026-06-09`).
> Target: **Next.js 16.3.4**. Documentation-verified, **no sandbox run** — every span name and attribute below is quoted from the reference, **not observed in a trace**.

**The useful surprise about tracing a Next.js application is how little of it you write. The framework is already instrumented in OpenTelemetry terms, so a root request span, a render span, a fetch span, a metadata span and a first-byte marker exist for every request whether or not anything is collecting them. What you decide is three things: which registration path you take — `@vercel/otel`, which works on both runtimes, or a manual `NodeSDK`, which the documentation states outright is not compatible with the edge runtime; how you group the attributes, where `next.page` is a genuine identity trap; and how much of it you emit, because most spans are off by default and the switch that turns them on is a volume multiplier on a per-event bill. This page is the catalogue and the switches. The `register()` contract itself is [04](04-telemetry-sentry-logtail-datadog-integration-via-instrumenta.md).**

## Two setups, one of which cannot run on the edge

> *"Next.js supports OpenTelemetry instrumentation out of the box, which means that we already instrumented Next.js itself."*

The short path:

```bash
npm install @vercel/otel @opentelemetry/sdk-logs @opentelemetry/api-logs @opentelemetry/instrumentation
```

```ts
// instrumentation.ts
import { registerOTel } from '@vercel/otel'

export function register() {
  registerOTel({ serviceName: 'sprintdesk' })
}
```

The long path exists for exporters and processors `@vercel/otel` does not expose, and it carries one hard restriction:

> *"Unlike `@vercel/otel`, `NodeSDK` is not compatible with edge runtime, so you need to make sure that you are importing them only when `process.env.NEXT_RUNTIME === 'nodejs'`."*

> *"If edge runtime support is necessary, you will have to use `@vercel/otel`."*

```ts
// instrumentation.node.ts
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'

const sdk = new NodeSDK({
  resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'sprintdesk' }),
  spanProcessor: new SimpleSpanProcessor(new OTLPTraceExporter()),
})
sdk.start()
```

Because it is OpenTelemetry rather than a vendor SDK, the choice of backend is a collector endpoint: *"It's a platform-agnostic way to instrument apps that allows you to change your observability provider without changing your code."* Datadog, Honeycomb, Grafana and Sentry all accept OTLP; the application code above does not change between them.

## What Next.js already emits

Every span carries custom attributes under the `next` namespace:

| Attribute | Meaning (quoted) |
|---|---|
| `next.span_name` | *"duplicates span name"* |
| `next.span_type` | *"each span type has a unique identifier"* |
| `next.route` | *"The route pattern of the request (e.g., `/[param]/user`)"* |
| `next.rsc` | *"Whether the request is an RSC request, such as prefetch"* |
| `next.page` | an internal value; *"can be used as a unique identifier only when paired with `next.route`"* |

That last caveat matters when you build a dashboard: `/layout` alone *"can be used to identify both `/(groupA)/layout.ts` and `/(groupB)/layout.ts`"*, so group by `next.route` and `next.page` together or your layout timings merge two different files.

The default span catalogue, quoted from the reference:

| Span name | `next.span_type` | What it covers |
|---|---|---|
| `[http.method] [next.route]` | `BaseServer.handleRequest` | *"the root span for each incoming request"* |
| `render route (app) [next.route]` | `AppRender.getBodyResult` | rendering a route in the app router |
| `fetch [http.method] [http.url]` | `AppRender.fetch` | *"the fetch request executed in your code"* |
| `executing api route (app) [next.route]` | `AppRouteRouteHandlers.runHandler` | a Route Handler |
| `getServerSideProps [next.route]` | `Render.getServerSideProps` | Pages Router |
| `getStaticProps [next.route]` | `Render.getStaticProps` | Pages Router |
| `render route (pages) [next.route]` | `Render.renderDocument` | Pages Router |
| `generateMetadata [next.page]` | `ResolveMetadata.generateMetadata` | *"a single route can have multiple of these spans"* |
| `resolve page components` | `NextNodeServer.findPageComponents` | component resolution |
| `resolve segment modules` | `NextNodeServer.getLayoutOrPageModule` | *"loading of code modules for a layout or a page"* |
| `start response` | `NextNodeServer.startResponse` | *"zero-length span … when the first byte has been sent"* |

Two environment variables control the volume:

> *"Next.js traces more spans than are emitted by default. To see more spans, you must set `NEXT_OTEL_VERBOSE=1`."*

> *"This span can be turned off by setting `NEXT_OTEL_FETCH_DISABLED=1` in your environment. This is useful when you want to use a custom fetch instrumentation library."*

`start response` deserves a note: it is a zero-length span marking first-byte, which makes it the one span that tells you whether streaming is actually reaching the client. If `start response` sits at the *end* of the root span rather than early inside it, something in front of your server is buffering — the failure described in [02b](02b-caching-and-the-cachehandler-when-you-run-more-than-one-container.md).

## The attributes are standard, and that is the point

> *"Attributes on spans follow [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/reference/specification/trace/semantic_conventions/). We also add some custom attributes under the `next` namespace"*

So the root span carries the common and server HTTP attributes — `http.method`, `http.status_code`, `http.route`, `http.target` — and the fetch span carries the client ones — `http.method`, `http.url`, `net.peer.name`, and `net.peer.port` *"(only if specified)"*. A dashboard built on `http.route` therefore works against any OTLP backend without a vendor-specific mapping, which is the practical meaning of the guide's claim that OpenTelemetry *"allows you to change your observability provider without changing your code"*.

The `next.rsc` boolean is the one worth wiring into a filter early: it marks *"whether the request is an RSC request, such as prefetch"*. Prefetch traffic is generated by the router rather than by a user, so a p95 computed across both numbers measures a mixture of two different things. Split on `next.rsc` before you draw any latency conclusion — and see [chapter 2 · prefetching](../02-routing-and-navigation/01-explanation.md) for how much of that traffic there is.

## Custom spans nest correctly because `register` runs first

> *"The `register` function will execute before your code runs in a new environment. You can start creating new spans, and they should be correctly added to the exported trace."*

```ts
// lib/search.ts
import { trace } from '@opentelemetry/api'

export async function searchCards(query: string) {
  return trace
    .getTracer('sprintdesk')
    .startActiveSpan('searchCards', async (span) => {
      try {
        span.setAttribute('sprintdesk.query_length', query.length)
        return await runSearch(query)
      } finally {
        span.end()
      }
    })
}
```

`startActiveSpan` is what makes the span a child of whatever Next.js span is currently active, rather than a detached root. The `finally` is not stylistic: a span that is never ended is a span that never exports, so a thrown error silently removes the very trace you would want.

Custom attributes should use your own namespace (`sprintdesk.*` above). `next.*` belongs to the framework, and a collision produces a dashboard that is wrong rather than one that errors.

## Testing it, and where it runs

> *"You need an OpenTelemetry collector with a compatible backend to test OpenTelemetry traces locally. We recommend using our [OpenTelemetry dev environment](https://github.com/vercel/opentelemetry-collector-dev-setup)."*

The success criterion is stated precisely enough to check:

> *"If everything works well you should be able to see the root server span labeled as `GET /requested/pathname`. All other spans from that particular trace will be nested under it."*

If your spans are *not* nested under that root, the usual cause is a custom span created outside the active context — `startSpan` rather than `startActiveSpan`, or a span created in a callback that has lost the context.

For deployment the guide is short in both directions:

> *"When you are deploying with OpenTelemetry Collector, you can use `@vercel/otel`. It will work both on Vercel and when self-hosted."*

> *"We made sure that OpenTelemetry works out of the box on Vercel."*

> *"You will need to spin up your own OpenTelemetry Collector to receive and process the telemetry data from your Next.js app."*

And a collector is not mandatory: *"OpenTelemetry Collector is not necessary. You can use a custom OpenTelemetry exporter"* — which is the direct-to-vendor path, at the cost of losing the collector's buffering and re-routing.

⚠️ On a self-hosted deployment, the collector's own availability becomes part of your request path if you export synchronously. The `SimpleSpanProcessor` in the documented manual example exports each span as it ends, which is right for a local dev environment and wrong for production; a batching processor is the production choice, and needing one is a good reason to take the manual `NodeSDK` route.

## Gotchas

**★ Symptom: the app crashes on the edge runtime with a Node built-in module error at startup.** Cause: `NodeSDK` and its dependencies were imported unconditionally, and *"`NodeSDK` is not compatible with edge runtime"*. Fix: gate the import on `NEXT_RUNTIME === 'nodejs'`, or use `@vercel/otel`, which the docs name as the option when edge support is required.

**★ Symptom: layout timings in your dashboard are nonsense because two route groups merged.** Cause: grouping on `next.page` alone, which the docs warn *"can be used as a unique identifier only when paired with `next.route`"* — `/layout` identifies both `/(groupA)/layout.ts` and `/(groupB)/layout.ts`. Fix: group by `next.route` and `next.page` together.

**★ Symptom: you can see request spans but nothing inside them.** Cause: most spans are not emitted by default. Fix: `NEXT_OTEL_VERBOSE=1`, which the docs name as the switch — and be deliberate about it, because it is a volume increase on a per-event-billed backend.

**★ Symptom: every `fetch` appears twice in traces.** Cause: Next.js emits its own `fetch [http.method] [http.url]` span and you also installed a fetch instrumentation library. Fix: turn one off — `NEXT_OTEL_FETCH_DISABLED=1` is documented for exactly this case.

**★ Symptom: custom spans appear as separate traces instead of nesting under the request.** Cause: the span was created without becoming the active context, so it has no parent. Fix: use `startActiveSpan`, and end it in a `finally` so a throw does not lose the span entirely:

```ts
trace.getTracer('sprintdesk').startActiveSpan('searchCards', async (span) => {
  try { return await runSearch(query) } finally { span.end() }
})
```

**★ Symptom: p95 latency looks terrible and nobody can reproduce it.** Cause: prefetch traffic is being counted with user-initiated traffic. The `next.rsc` attribute marks *"whether the request is an RSC request, such as prefetch"*, and prefetches are issued by the router with no user waiting. Fix: filter on `next.rsc` before computing any user-facing latency metric.

**★ Symptom: self-hosted request latency rose after enabling tracing.** Cause: the documented manual example uses `SimpleSpanProcessor`, which exports each span as it ends — so your collector's latency is now inside your request path. Fix: use a batching span processor in production; the local dev setup is the only place `SimpleSpanProcessor` belongs.

**Symptom: a custom attribute overwrites framework data in dashboards.** Cause: it was written under the `next` namespace, which the framework owns. Fix: namespace your own attributes (`sprintdesk.query_length`), and treat every `next.*` key as read-only.

## Interview questions

**★ Why is the `start response` span the one to watch when someone reports that streaming "isn't working"?**
Because it is a zero-length span marking the moment the first byte was sent. In a healthy streamed response it appears early inside the root request span, long before rendering completes. If it appears at the very end, the response was assembled in full before anything left the process — which is the signature of a buffering proxy or load balancer rather than an application bug. It converts an argument about whether streaming is happening into a timestamp.

**★ When do you need the manual `NodeSDK` setup instead of `@vercel/otel`, and what do you give up?**
When you need an exporter, span processor or resource detector that `@vercel/otel` does not expose — a batching processor with specific settings, a custom sampler, an unusual protocol. What you give up is the edge runtime: the documentation states `NodeSDK` is not compatible with it and that `@vercel/otel` is required if edge support is necessary. So a manual setup implies gating on `NEXT_RUNTIME === 'nodejs'` and accepting that edge-executed code is uninstrumented, or running a second, different setup there.

**Why is OpenTelemetry the recommended integration path rather than a vendor SDK?**
Because Next.js instruments itself in OpenTelemetry terms — the span names, `next.span_type` values and `next` attributes documented in the reference are emitted whatever backend you point them at. A vendor SDK re-derives that from the outside and usually gets less. And the documentation's own argument is portability: it is a platform-agnostic way to instrument apps that lets you change your observability provider without changing your code, which in practice means a collector endpoint change rather than a migration.

**How do you keep telemetry from becoming a per-event bill you did not plan for?**
Decide deliberately about the two volume switches. `NEXT_OTEL_VERBOSE=1` multiplies span count and exists for debugging, not for steady state. `NEXT_OTEL_FETCH_DISABLED=1` removes a span per outbound fetch, which on a fan-out heavy route is the largest single contributor. Beyond that, sampling belongs in the exporter configuration, which is one of the reasons to reach for the manual `NodeSDK` setup — and it is a decision to make before the first month's invoice, not after.

**★ Why is `next.page` unusable as an identifier on its own?**
Because it is an internal value naming a special file rather than a route, so the same value describes different files. The documentation gives the exact case: `/layout` can identify both `/(groupA)/layout.ts` and `/(groupB)/layout.ts`, and it can therefore only be used as a unique identifier when paired with `next.route`. A dashboard grouped on `next.page` alone silently averages two unrelated layouts together, and the result looks plausible, which is what makes it dangerous.

**★ You are asked to prove a trace pipeline works before shipping it. What is the check?**
Run a collector locally — the guide points at Vercel's own dev setup — and look for a root server span labelled `GET /requested/pathname` with every other span from that request nested beneath it. That single assertion covers registration (spans exist at all), context propagation (they nest) and export (they arrive). If spans arrive but do not nest, the problem is context, not configuration.

**What changes about tracing when you self-host rather than deploy to Vercel?**
Only who runs the collector. `@vercel/otel` works both on Vercel and when self-hosted, and the docs say OpenTelemetry works out of the box on Vercel; self-hosting means spinning up your own collector to receive and process the data. The consequential difference is operational: the collector becomes infrastructure you own, and if you export span-by-span its availability and latency are inside your request path — which is the argument for a batching processor and, therefore, often for the manual `NodeSDK` setup.

---

← [Telemetry and `instrumentation.ts`](04-telemetry-sentry-logtail-datadog-integration-via-instrumenta.md) · [Chapter 17 overview](01-explanation.md) · Next → [Cost engineering](05-cost-engineering-function-compute-bandwidth-and-edge-cache-h.md)
