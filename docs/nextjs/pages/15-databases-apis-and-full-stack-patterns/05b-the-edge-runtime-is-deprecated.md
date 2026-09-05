---
title: "`export const runtime = 'edge'` is deprecated in Next.js 16 and the migration is a deletion — but the docs name no removal version and do not say the build fails, so the urgency is real and the deadline is not"
sidebar_label: "05b · The Edge Runtime is deprecated"
sidebar_position: 300
description: "What the deprecation notice actually says, the one line you remove, why Proxy never had the option, and an honest account of what the documentation does not claim."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js 16.3.4 documentation — [`runtime` route segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime), [Edge Runtime Deprecated](https://nextjs.org/docs/messages/edge-runtime-deprecated), [`proxy.js`](https://nextjs.org/docs/app/api-reference/file-conventions/proxy), [Deploying to Platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms).
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · React 19.2.8 · Node 24.20.0.

**For four years the advice was that a route with no Node built-ins should opt into the Edge Runtime for faster cold starts and wider geographic placement. That advice is now wrong, and the correction is unusually simple: delete the line. Next.js 16.3.4 lists `'edge'` as deprecated on the `runtime` segment config, and the deprecation page says the Node.js runtime is the default so *"no replacement is needed."* This page covers exactly what the documentation says, exactly what it does not say — it names no removal release and does not state that the build fails — and the one genuine subtlety, which is that Proxy was already moved and never had the option in the first place.**

## What the documentation says

The segment-config reference lists the two values and marks one of them:

> *"* **`'nodejs'`** (default) * **`'edge'`** (deprecated)"*
> *"The Edge Runtime is deprecated. Remove the `runtime` export from your route files."*
> *"This option cannot be used in Proxy."*
> — [Next.js · `runtime`](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime)

The dedicated message page repeats it and states the migration:

> *"One or more routes in your application use `export const runtime = 'edge'`, which is deprecated."*
> *"Remove the `runtime` export from your route files: `- export const runtime = 'edge'`"*
> *"The Node.js runtime is the default, so no replacement is needed."*
> *"This applies to all route files that support the `runtime` segment config: `page.ts`, `layout.ts`, `route.ts`, and API routes."*
> — [Next.js · Edge Runtime Deprecated](https://nextjs.org/docs/messages/edge-runtime-deprecated)

So the whole migration is one deletion per file:

```ts
// app/api/health/route.ts
- export const runtime = 'edge'

export async function GET() {
  return Response.json({ ok: true })
}
```

Finding every one of them is a single command, and it is worth running across a monorepo rather than a package:

```bash
grep -rn "runtime *= *['\"]edge['\"]" --include='*.ts' --include='*.tsx' --include='*.js' .
```

## What the documentation does **not** say

This is the part worth being careful about, because the internet will supply confident answers that the primary source does not.

⚠️ **No removal version is named.** The docs mark the value deprecated and instruct you to remove the export. They do not say which release drops it. Anyone who tells you "removed in 17" is quoting something other than the documentation.

⚠️ **The build is not stated to fail.** The message page is written as a warning — it explains why the warning occurred and how to resolve it — and nothing in it says the build errors. Treat it as a warning today and plan the deletion anyway, because a deprecation with no announced deadline is not a reprieve, it is an absence of information.

That combination — real deprecation, unspecified timeline — is the honest situation, and it drives a reasonable posture: **stop writing it now, delete the existing ones at your convenience, and do not build anything new that depends on the runtime's constraints.**

## Why deleting the line is safe, and what actually changes

The reason "no replacement is needed" is true rather than a euphemism is that the Edge Runtime was always the *restricted* environment. It was a subset: a Web-APIs-only sandbox with no Node built-ins, no native modules, and a much smaller set of npm packages that would run. Removing the export moves the route to the Node.js runtime, which is a superset. Nothing that worked stops working.

What changes is **where the code can be placed**, and that is a platform question rather than a framework one. The framework's own position is that placement is a performance matter:

> *"Additional infrastructure (CDN caching, edge compute, shared cache) primarily improves **performance** and multi-instance consistency."*
> *"The \"Edge Stitching\" column is a **performance optimization**, not a correctness requirement. All features work correctly from a single origin server."*
> — [Next.js · Deploying to Platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms)

So the thing you might lose by deleting the export is some geographic proximity on some platforms. The thing you gain is every Node API, the whole npm ecosystem, and one runtime to reason about instead of two — which matters more than it sounds, because a codebase with two runtimes has two sets of rules about which imports are legal in which file, and that rule is enforced at build time in a way that is famously hard to trace back to the import that caused it.

🔴 **And the proximity you thought you were buying was rarely the thing making the request slow.** A route that reads Postgres is bounded by the round trip to your single-region database, not by where the JavaScript ran — [01b](01b-the-three-kinds-of-pool.md) works through that arithmetic, and it is the reason "move the compute closer to the user" so often produces no measurable improvement. Compute placement helps when the work is genuinely local: a redirect, a header rewrite, a cache lookup. For those, Proxy is the tool, and Proxy has already moved.

## Proxy: the case that was decided separately

Middleware was renamed and re-homed in Next.js 16, and the version history is explicit:

> `v16.0.0` — *"Middleware is deprecated and renamed to Proxy. Proxy defaults to the Node.js runtime"*
> `v15.5.0` — *"Middleware can now use the Node.js runtime (stable)"*
> — [Next.js · `proxy.js`](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)

And the runtime option is not merely deprecated there — it is refused:

> *"Proxy defaults to using the Node.js runtime. The `runtime` config option is not available in Proxy files. Setting the `runtime` config option in Proxy will throw an error."*

That is a harder failure than the route-file case, and worth knowing before you migrate a `middleware.ts` that carried the export: moving the file is not enough, the line has to go with it.

The rename itself has a stated rationale that is more useful than most renames:

> *"The name Proxy clarifies what Middleware is capable of. The term \"proxy\" implies a network boundary in front of the app, which is how this feature behaves. It can run outside of your application's main runtime and handle requests before they reach your app."*

Read *"can run outside of your application's main runtime"* carefully. That is where geographic placement survives in the new model — not as a runtime you declare, but as a boundary the platform is free to place in front of you. The deployment matrix bears this out: the Proxy/Middleware row is *"Runs at edge or origin"*, with Streaming **No**, Shared Cache **No** and Edge Stitching **No**.

## What to do with a route that was on the edge for a real reason

Three honest cases, because "delete the line" is the whole answer only when the line was cargo-culted.

**It was there for cold starts.** Delete it and measure. Cold start is a platform property now, not a runtime you select, and if it is genuinely your bottleneck, the levers are bundle size ([01hc](01hc-ergonomics-size-and-when-each-is-wrong.md)) and instance lifetime rather than a directive.

**It was there for geographic placement of cheap logic.** That logic probably belongs in Proxy, which runs before your app and which the platform may place at the edge — and which never accepted the `runtime` export anyway.

**It was there because the route is a streaming endpoint.** This is the one to check carefully, because streaming has a real platform requirement that is independent of the runtime:

> *"**Streaming Required** means the platform must support chunked transfer encoding or HTTP/2 streaming and must not buffer the response before sending it to the client."*

An SSE route ([03d](03d-writing-the-sse-route-handler.md)) needs that from the platform whether it runs on the edge or on Node. Removing `runtime = 'edge'` does not take streaming away; it just makes the requirement visible where it always applied.

## Gotchas

**★ Symptom: a build warning names the Edge Runtime and you cannot find the route that causes it.** Cause: the export can sit in any file that supports segment config — the message page lists `page.ts`, `layout.ts`, `route.ts` and API routes — so a `layout.tsx` several levels up is a common culprit and is not where anyone looks first. Fix: search the whole tree rather than the route you suspect:

```bash
grep -rn "runtime *= *['\"]edge['\"]" --include='*.ts' --include='*.tsx' --include='*.js' .
```

**★ Symptom: moving `middleware.ts` to `proxy.ts` throws an error about the runtime option.** Cause: *"The `runtime` config option is not available in Proxy files. Setting the `runtime` config option in Proxy will throw an error."* The rename moved the file; the export came with it. Fix: delete the export as part of the move — Proxy defaults to Node.js and has no alternative to select.

**★ Symptom: after deleting the export, a route gets slower for users far from your region.** Cause: you were getting real geographic placement and have now moved to origin. The framework calls this a performance rather than a correctness change, and it is the one genuine cost of the deprecation. Fix: recover it at the layer that still offers it — cache the response at the CDN so distant users are served without reaching the origin at all, and move any genuinely-local logic into Proxy, which *"can run outside of your application's main runtime"*.

**★ Symptom: someone claims a specific Next.js version removes the Edge Runtime and plans a migration around that date.** Cause: the documentation names no removal version. Fix: plan on the deprecation, not on an invented deadline. The correct statement to put in a ticket is that the value is deprecated, that the migration is a one-line deletion per file, and that no removal release has been announced.

**★ Symptom: a package that failed to import under the edge runtime now works, and nobody knows why.** Cause: the Edge Runtime was the restricted environment — Web APIs only, no Node built-ins. Deleting the export moves the route to the superset. Fix: nothing is wrong, but take the opportunity to remove the workarounds that were there for the restriction — a hand-rolled base64 helper, a `crypto` shim, a fetch-based reimplementation of something `node:` provides.

**★ Symptom: an SSE route stopped streaming after a platform change, and the team blames the runtime deletion.** Cause: streaming is a platform capability — the host *"must not buffer the response before sending it to the client"* — and it is required regardless of runtime. The deletion did not remove it; the platform never had it, or a proxy in front is buffering. Fix: diagnose it as the buffering problem it is; [03h](03h-what-silently-breaks-sse-in-production.md) covers what silently breaks a stream in production.

**★ Symptom: two runtimes in one codebase produce an import error that points at a file with no imports in it.** Cause: the restriction is transitive — a Node built-in three modules down fails the whole edge route, and the error names the boundary rather than the cause. Fix: this is an argument for the deprecation rather than a problem to solve. One runtime means one set of rules, and the error class disappears with the export.

## Interview questions

**★ What is the migration path off the Edge Runtime in Next.js 16?**
Delete the export. The documentation says *"Remove the `runtime` export from your route files"* and *"The Node.js runtime is the default, so no replacement is needed."* It is a deletion rather than a rewrite because the Edge Runtime was the restricted environment — Web APIs only, no Node built-ins — so moving to Node.js is moving to a superset and nothing that worked stops working.

**★ Which release removes it?**
The documentation does not say, and that is the correct answer rather than a gap in your knowledge. It marks the value deprecated and gives the migration; it names no removal version and does not state that the build fails. The right posture is to stop writing it immediately and delete the existing occurrences on your own schedule, without inventing a deadline.

**★ You lose the Edge Runtime. What actually gets slower, and for whom?**
Potentially, geographic placement — a request from a distant user that previously ran near them now reaches your origin. The framework frames this as a performance rather than a correctness matter: *"All features work correctly from a single origin server."* Whether it is measurable depends entirely on whether the route was doing local work. A route that queries a single-region database was already bounded by that round trip, so its placement barely mattered; a redirect or a header rewrite genuinely benefited, and that work belongs in Proxy.

**★ Why does Proxy throw an error on the `runtime` option rather than deprecating it?**
Because Proxy was settled separately and earlier. Middleware gained a stable Node.js runtime in 15.5.0 and was renamed to Proxy in 16.0.0 with Node.js as the default, so by the time the file exists under its new name there is no second runtime to choose between. The documentation is explicit that setting the option there *"will throw an error"* — which makes migrating a `middleware.ts` that carried the export a two-part change rather than a rename.

**★ If there is no edge runtime, how does anything run globally?**
Through the layers in front of and behind the server rather than through the server's runtime. In front, a CDN serving cached responses so distant users never reach the origin, and Proxy, which *"can run outside of your application's main runtime and handle requests before they reach your app"*. Behind, a shared cache handler so instances agree on what is current. The framework's own summary is that a Node.js server is the only requirement and everything else *"primarily improves performance and multi-instance consistency"*.

**★ Why is having one runtime worth something on its own, beyond the deprecation?**
Because two runtimes means two sets of rules about which imports are legal in which file, enforced at build time and transitively. A Node built-in three modules deep fails an edge route, and the error names the route rather than the import, which makes it one of the harder classes of build failure to trace. Collapsing to one runtime deletes that class entirely, and it also deletes the shims people wrote to work around the restricted environment.

**★ A team wants to keep `runtime = 'edge'` because they measured it faster. What do you advise?**
Take the measurement seriously and the mechanism more seriously. Find out what the route actually does: if it is local work — a rewrite, a redirect, a signed-cookie check — that work belongs in Proxy, which keeps the placement and has a supported future. If the route touches a database or an origin API, the win was probably not placement, and running the same comparison against a warm origin will usually show it. Either way, building on a deprecated option to preserve an unexplained measurement is the trade to avoid.

---

← [05 · Edge and custom cache structures](05-edge-functions-and-custom-cache-structures-for-global-comput.md) · Next → [05c · The CDN layer and `Cache-Control`](05c-the-cdn-layer-and-cache-control.md) · Jump → [05h · A shared cache across instances](05h-a-shared-cache-across-instances.md)
