---
title: "The extension points you will actually use are not config keys at all — they are files whose mere existence rewires the compiler, the server lifecycle, the request path and the document shell"
sidebar_label: "04c · Seams that are files"
sidebar_position: 16
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — [`instrumentation.js`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation), [Turbopack · Language features](https://nextjs.org/docs/app/api-reference/turbopack), [Custom Webpack Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/webpack). All three carry `version: 16.3.4` in their own metadata. React 19.2.8 · Node `>= 20.9`. Quoted, not run — **no sandbox run**. The Pages Router `_app` / `_document` reference and the Route Handler reference were **not fetched in this pass**; where this page describes them it says so and points at the corpus page that did.

**Next.js's real plugin system is the filesystem. There is no registration call anywhere in it: you create a file with an exact name in an exact place, export functions with exact names, and the framework finds it. `instrumentation.ts` gives you the one documented "run this before the server accepts traffic" hook and the one documented server-error callback. `proxy.ts` gives you the request path. A Babel config file — a file you do not even import — silently changes which compiler transforms your source. That is a real API surface, it is stable in a way `next.config.js` internals are not, and it is where a "we need a plugin" request should land nine times out of ten.**

## A Babel config file is an extension point, and the rule inverted in 16

You never import it and never reference it in `next.config.js`. Its *presence on disk* changes the compiler:

> *"**Babel** | **Supported** | Starting in Next.js 16, Turbopack uses Babel automatically if it detects a configuration file. Unlike in webpack, SWC is always used for Next.js's internal transforms and downleveling to older ECMAScript revisions. Next.js with webpack disables SWC if a Babel configuration file is present. Files in `node_modules` are excluded, unless you manually configure `babel-loader`."*
> — [Turbopack · Language features](https://nextjs.org/docs/app/api-reference/turbopack)

Read that as two different products:

| | webpack path (`--webpack`) | Turbopack path (default) |
|---|---|---|
| A `.babelrc` / `babel.config.js` is present | **SWC is disabled** | Babel runs *in addition*; SWC still does Next's internal transforms and downleveling |
| Cost of keeping one Babel plugin | you lose the SWC pipeline for your app code | you pay Babel's cost on top of SWC |
| `node_modules` | excluded unless you configure `babel-loader` yourself | same |

**So the answer to "we still need one Babel plugin" changed in 16: keep it, and stay on the default bundler.** Under webpack, one Babel config file costs you the whole SWC pipeline for your own source. Under Turbopack, Babel is an extra pass and the transforms Next.js itself depends on keep running through SWC. The detection is itself a flag — `turbopackUseBuiltinBabel`, *"Enable automatic Babel loader configuration when a Babel config file is present"*, default `true` in dev and in build — so you can switch it off when a stray `.babelrc` belonging to some other tool in the repo is being picked up by the build.

```json
{
  "presets": [],
  "plugins": ["babel-plugin-sprintdesk-i18n-extract"]
}
```

That file, at the project root, is the entire installation procedure for an AST transform in Next.js 16. No config key, no wrapper, no registration.

⚠️ **SWC itself is not user-pluggable through any documented `next.config.js` key that I could find.** The reference describes SWC as the engine (*"Uses SWC under the hood"*) and exposes *outcomes* — the transforms Next.js chooses to run — not a plugin slot. I found no documented API in the pages checked for registering a custom SWC (Wasm) plugin. If you need a custom AST pass, the two documented routes are the Babel config file above and a Turbopack loader rule that returns JavaScript ([04b](04b-the-bundler-seam-webpack-and-turbopack.md)).

One consequence of "SWC under the hood" that catches teams migrating off webpack:

> *"Type-checking is not done by Turbopack (run `tsc --watch` or rely on your IDE for type checks)."*

## `instrumentation.ts` — the only documented server-startup hook

> *"The `instrumentation.js|ts` file is used to integrate observability tools into your application, allowing you to track the performance and behavior, and to debug issues in production."*

> *"To use it, place the file in the **root** of your application or inside a `src` folder if using one."*

> *"The file exports a `register` function that is called **once** when a new Next.js server instance is initiated, and must complete before the server is ready to handle requests. `register` can be an async function."*
> — [`instrumentation.js`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)

Three properties of that sentence are what make it an extension point rather than a convenience:

- **Once per server instance** — not per request, not per route. It is where a connection pool, a feature-flag client, or a tracer provider gets constructed.
- **Must complete before the server is ready** — so it is a genuine barrier. Anything you initialise there is guaranteed present for the first request, which no other seam gives you.
- **May be async** — so awaiting a remote fetch (a config service, a secret manager) is legitimate, at the cost of slower cold starts.

```ts
// instrumentation.ts
import { registerOTel } from '@vercel/otel'

export function register() {
  registerOTel('next-app')
}
```

Runtime targeting is documented and is the reason most real `instrumentation.ts` files are three lines that delegate:

> *"The `instrumentation.js` file works in both the Node.js and Edge runtime, however, you can use `process.env.NEXT_RUNTIME` to target a specific runtime."*

```js
// instrumentation.js
export function register() {
  if (process.env.NEXT_RUNTIME === 'edge') {
    return require('./register.edge')
  } else {
    return require('./register.node')
  }
}

export function onRequestError() {
  if (process.env.NEXT_RUNTIME === 'edge') {
    return require('./on-request-error.edge')
  } else {
    return require('./on-request-error.node')
  }
}
```

**Why the delegation matters:** a top-level `import` of a Node-only SDK is evaluated in *both* runtime builds, so it fails in the edge one even if `register` would never have called it. The `require` inside the branch is evaluated only on the branch taken.

Version history from the reference: `v13.2.0` introduced as experimental, `v14.0.4` Turbopack support, `v15.0.0` — *"`onRequestError` introduced, `instrumentation` stable"*. Deeper coverage of the OpenTelemetry side lives at [ch11 · `instrumentation.ts` for OpenTelemetry](../11-performance-optimization-turbopack/06-instrumentationts-for-opentelemetry-and-application-monitori.md).

## `onRequestError` — the error seam, with a type that tells you where you are

> *"You can optionally export an `onRequestError` function to track **server** errors to any custom observability provider."*

The full signature, verbatim from the reference's Types block, is worth reading closely because the `context` object is the part people do not know exists:

```ts
export function onRequestError(
  error: unknown,
  request: {
    path: string // resource path, e.g. /blog?name=foo
    method: string // request method. e.g. GET, POST, etc
    headers: { [key: string]: string | string[] }
  },
  context: {
    routerKind: 'Pages Router' | 'App Router' // the router type
    routePath: string // the route file path, e.g. /app/blog/[dynamic]
    routeType: 'render' | 'route' | 'action' | 'proxy' // the context in which the error occurred
    renderSource:
      | 'react-server-components'
      | 'react-server-components-payload'
      | 'server-rendering'
    revalidateReason: 'on-demand' | 'stale' | undefined // undefined is a normal request without revalidation
    renderType: 'dynamic' | 'dynamic-resume' // 'dynamic-resume' for PPR
  }
): void | Promise<void>
```

`context.routeType` is a four-value enum that names the four places server code runs — a render, a Route Handler, a Server Action, and the proxy — and `renderType: 'dynamic-resume'` marks a PPR resume. That is enough to build a genuinely useful error taxonomy without parsing stack traces.

```ts
// instrumentation.ts
import { type Instrumentation } from 'next'

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const message = err instanceof Error ? err.message : String(err)
  const digest =
    typeof err === 'object' && err !== null && 'digest' in err
      ? String(err.digest)
      : undefined

  await fetch('https://.../report-error', {
    method: 'POST',
    body: JSON.stringify({
      message,
      digest,
      request,
      context,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
```

Two documented caveats, both of which produce silently wrong telemetry if ignored:

> *"If you're running any async tasks in `onRequestError`, make sure they're awaited. `onRequestError` will be triggered when the Next.js server captures the error."*

> *"The `error` instance might not be the original error instance thrown, as it may be processed by React if encountered during Server Components rendering. If this happens, you can use `digest` property on an error to identify the actual error type."*

> *"`error`: The caught value is typed as `unknown`. Narrow it before reading properties like `message` or `digest`."*

## `proxy.ts` — the request-path seam

The request interception layer in this corpus's version spine is `proxy.ts`, and the instrumentation reference corroborates that naming twice without ever mentioning `middleware`: `routeType` includes `'proxy'`, and the webpack reference says

> *"`nextRuntime` `"edge"` is currently for proxy and Server Components in edge runtime only."*
> — [Custom Webpack Config](https://nextjs.org/docs/app/api-reference/config/next-config-js/webpack)

Its API, matcher semantics and the migration from `middleware.ts` are covered in full at [ch2 · The `proxy.ts` layer](../02-routing-and-navigation/07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md) and are not re-derived here. What matters for *extension* is the shape: it is one file, one exported function, no registration — and it is the only documented place to run your own code on a request before routing decides anything.

**Where teams get the choice wrong:** `proxy.ts` runs on matched requests and adds latency to every one of them; `instrumentation.ts` runs once. Anything that only needs to happen at startup — SDK init, warming a cache client, validating that required environment variables exist — belongs in `register`, not in the request path.

## Route Handlers and the document shells

The remaining file seams are the ones you extend the *application* with rather than the framework:

- **Route Handlers** (`app/**/route.ts`) — the App Router's HTTP endpoints, and the right home for a webhook receiver, an OAuth callback, or a health check that some integration needs. The instrumentation reference names them in `routeType: 'route'`, which is the evidence used here; **the Route Handler reference page itself was not fetched in this pass**, so no signature is quoted for it.
- **Root `layout.tsx`** (App Router) — the single component every App Router page renders inside, and therefore the only place to install a provider tree, a global font, or an analytics `<Script>` that must exist on every page.
- **`_app` / `_document`** (Pages Router) — the equivalent pair on the legacy router: `_app` wraps every page component, `_document` owns the HTML shell. ⚠️ **The Pages Router reference was not re-fetched in this pass**, so nothing about their exact exports is quoted here. Treat this bullet as orientation and check the reference before writing one; the migration path from those files to `layout.tsx` is covered by [02 · Pages Router → App Router migration roadmaps](02-pages-router-app-router-migration-roadmaps-for-legacy-codeba.md).

**The important structural point:** a root layout and a `_document` are *not* interchangeable extension points. `_document` renders once on the server and never on the client, so client-side state has no business in it; a root layout is a Server Component in the normal React tree, so a provider that needs `'use client'` must be a child component of it, not the layout itself.

## Gotchas

**★ Symptom: you removed `.babelrc` and the webpack build got faster and subtly different; you put it back and it reverted.** Cause: *"Next.js with webpack disables SWC if a Babel configuration file is present."* One file switches the entire compiler for your source. Fix: either delete the Babel config, or move to the default bundler, where Babel is additive rather than exclusive — under Turbopack *"SWC is always used for Next.js's internal transforms"*:

```json
{ "scripts": { "dev": "next dev", "build": "next build" } }
```

**★ Symptom: type errors that used to fail the build now reach production.** Cause: Turbopack does not type-check — *"Type-checking is not done by Turbopack (run `tsc --watch` or rely on your IDE for type checks)."* Fix: make it a separate, required step rather than an assumed side effect of bundling:

```json
{ "scripts": { "typecheck": "tsc --noEmit", "ci": "yarn typecheck && yarn build" } }
```

**★ Symptom: `instrumentation.ts` throws `Cannot find module` in the edge build even though the code path never runs there.** Cause: a top-level `import` is evaluated in both runtime compilations; the branch on `process.env.NEXT_RUNTIME` happens too late. Fix: move the import inside the branch:

```js
// ❌ import { NodeSDK } from '@opentelemetry/sdk-node'
export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    return require('./register.node') // ✅ evaluated only on this branch
  }
}
```

**★ Symptom: errors are reported with a useless message like a generic React error, and you cannot tell what actually threw.** Cause: *"The `error` instance might not be the original error instance thrown, as it may be processed by React if encountered during Server Components rendering."* Fix: report the `digest` alongside the message and correlate on it:

```ts
const digest =
  typeof err === 'object' && err !== null && 'digest' in err ? String(err.digest) : undefined
```

**Symptom: `onRequestError` reports nothing in production, or reports intermittently.** Cause: the reporting `fetch` was not awaited, and the serverless invocation froze or exited before it flushed. Fix: `await` every async task inside the handler — the reference says so explicitly — and make the export `async`:

```ts
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  await fetch('https://.../report-error', { method: 'POST', body: JSON.stringify({ request, context }) })
}
```

**Symptom: `err.message` is a TypeScript error inside `onRequestError`.** Cause: the first parameter is typed `unknown` on purpose, because a thrown value need not be an `Error`. Fix: narrow it, do not cast it:

```ts
const message = err instanceof Error ? err.message : String(err)
```

**Symptom: startup work you put in `proxy.ts` runs on every request and the p99 moves.** Cause: the proxy is a request-path seam; there is no "first request only" contract in it, and on serverless every cold instance re-runs your module anyway. Fix: move one-time work into `register`, which is documented to run *"once when a new Next.js server instance is initiated"* and to complete before traffic is accepted.

**Symptom: `instrumentation.ts` is ignored entirely.** Cause: it is in the wrong directory. The reference is specific — *"place the file in the **root** of your application or inside a `src` folder if using one"* — so `app/instrumentation.ts` or `src/app/instrumentation.ts` are both wrong when your code lives under `src/`. Fix: `src/instrumentation.ts`, a sibling of `src/app`, or the project root when there is no `src/`.

## Interview questions

**★ Does adding a Babel config to a Next.js 16 project disable SWC?**
It depends on the bundler, and the answer inverted in 16. Under webpack, yes — *"Next.js with webpack disables SWC if a Babel configuration file is present."* Under Turbopack, no: Babel is detected automatically and runs, but *"SWC is always used for Next.js's internal transforms and downleveling to older ECMAScript revisions."* Since Turbopack is the default since 16.0, the practical answer for a new project is that a Babel plugin costs you an extra pass rather than the whole SWC pipeline. Either way `node_modules` is excluded unless you configure `babel-loader` yourself.

**★ Can you write a custom SWC transform the way you would write a Babel plugin?**
Not through any documented `next.config.js` seam that I could confirm. The reference describes SWC as the engine and exposes its *results* — the transforms Next.js chooses to run — not a registration point. The documented routes for a custom AST pass are a Babel configuration file, which Turbopack now detects automatically, or a Turbopack loader rule that returns JavaScript. If someone tells you they registered an SWC plugin through `next.config.js`, ask which documentation page says so.

**★ What can `register` in `instrumentation.ts` do that no other seam can?**
Run exactly once per server instance *and* block the server from accepting traffic until it finishes. Nothing else in the framework offers that ordering guarantee: a root layout runs per render, a Route Handler per request, `proxy.ts` per matched request, and module-scope side effects in your own files run whenever the module is first imported, which is not a moment you control. That combination — once, and before the first request — is what a tracer provider, a connection pool or a mandatory-config check needs.

**★ You need to send every server-side error to your own observability backend. Which seam, and what do you have to be careful about?**
`onRequestError` in `instrumentation.ts`. Three careful points: `await` every async task inside it, or on a serverless platform the report can be lost when the invocation freezes; treat the first argument as `unknown` and narrow it, because a thrown value need not be an `Error`; and record the error's `digest` because React may replace the instance during Server Components rendering, so the digest is the only reliable identity. The `context` argument also tells you whether you were in a render, a Route Handler, a Server Action or the proxy — worth capturing, since the same message means different things in each.

**Why is "put it in `proxy.ts`" usually the wrong answer for cross-cutting setup?**
Because the proxy is on the request path. Anything you do there is paid on every matched request, and it cannot give you an initialisation guarantee — there is no first-request hook in it. Setup goes in `register`; per-request behaviour goes in `proxy.ts`; per-endpoint behaviour goes in a Route Handler. Teams that put SDK initialisation in the proxy get both a latency cost and a race, because concurrent requests can each see a half-initialised client.

**Why does the framework's "plugin system" being filenames age better than a config-based one?**
Because a filename is a contract with a very small surface: the framework promises to look for `instrumentation.ts` and call exports named `register` and `onRequestError`. Everything behind it — how the server boots, how errors propagate out of React, what the bundler did — can change completely between versions without changing that contract. A config-based hook, by contrast, hands you an object shaped like an internal, and the internal is what moves. That is why `webpack()` is explicitly outside semver while the file conventions have version-history tables measured in *feature additions*, not breaks.

---

← [04b · The bundler seam](04b-the-bundler-seam-webpack-and-turbopack.md) · [Chapter index](01-explanation.md) · Next → [Internals coupling and the plugin decision](04d-internals-coupling-and-the-plugin-decision.md)
