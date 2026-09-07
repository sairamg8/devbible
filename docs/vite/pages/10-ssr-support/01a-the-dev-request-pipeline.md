---
title: "The dev SSR request is six steps and three Vite calls, and every one of them exists because the file Node executes is not the file you wrote"
sidebar_label: "The Dev Request Pipeline"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Server-Side Rendering § Setting Up the Dev Server](https://vite.dev/guide/ssr), [JavaScript API § `ViteDevServer`](https://vite.dev/guide/api-javascript), [SSR Using `ModuleRunner` API](https://vite.dev/changes/ssr-using-modulerunner). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> ⚠️ Two things the docs do not settle are flagged inline as uncertain: the default of `ssrLoadModule`'s `fixStacktrace` option, and the exact difference between *"efficient invalidation similar to HMR"* and *"full HMR support"*.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ The Dev SSR Request Is Six Steps and Three Vite Calls

**Once [chunk 1](01-server-side-rendering-primitives.md) has wired Vite into your server,
every SSR request in development runs the same six steps. Three of them are Vite calls, and
each exists for the same underlying reason: in dev there is no build output, so the HTML on
disk is not servable HTML, the module on disk is not executable JavaScript, and the stack
frames Node produces do not name files you can open.**

---

## 1. Under-The-Hood Mechanics

### The three calls, and what each compensates for

| Call | The gap it closes |
|---|---|
| `vite.transformIndexHtml(url, html)` | `index.html` in dev has no HMR client and no plugin-injected preamble |
| `vite.ssrLoadModule('/src/entry-server.js')` | `entry-server.tsx` is not JavaScript Node will accept |
| `vite.ssrFixStacktrace(e)` | the evaluated code came from a string, so Node has no map to follow |

### `transformIndexHtml` — the HTML the browser needs does not exist on disk

```ts
transformIndexHtml(
  url: string,
  html: string,
  originalUrl?: string,
): Promise<string>
```

The guide names what the call injects:

> *"Apply Vite HTML transforms. This injects the Vite HMR client, and also applies HTML transforms from Vite plugins, e.g. global preambles from `@vitejs/plugin-react`"*

That second clause is the one people lose. Framework plugins deliver their dev-time runtime
through the HTML transform hook, **not** through the module graph, so a template served
without this call yields an app whose modules all load and whose refresh runtime is absent.

### `ssrLoadModule` — the transform pipeline, reachable from Node

```ts
ssrLoadModule(
  url: string,
  options?: { fixStacktrace?: boolean },
): Promise<Record<string, any>>
```

> *"Load the server entry. ssrLoadModule automatically transforms ESM source code to be usable in Node.js! There is no bundling required, and provides efficient invalidation similar to HMR."*

Three separate claims live in that sentence:

1. **It transforms.** The URL goes through the plugin container — `resolveId`, `load`,
   `transform` — before evaluation, so TSX, SFCs, CSS imports and `import.meta.env` all work.
2. **It does not bundle.** Unlike the production SSR build, nothing is rolled up. Modules
   are fetched and evaluated one at a time, on demand.
3. **It invalidates efficiently.** Editing one file does not re-evaluate the world.

⚠️ The docs describe `ssrLoadModule` as *"efficient invalidation similar to HMR"* and
`runner.import` as returning a module *"with full HMR support"*. **They do not spell out the
difference between those two phrases**, so treat it as: `ssrLoadModule` re-evaluates what
changed, and HMR *acceptance* (`import.meta.hot.accept`) is documented only on the Module
Runner path in [chunk 1c](01c-the-module-runner.md).

⚠️ The `options.fixStacktrace` flag appears in the published type signature with **no prose
and no stated default**. Do not rely on it; call `ssrFixStacktrace` explicitly, which is what
every documented example does.

### `ssrFixStacktrace` — because there is no file to map from

```ts
ssrFixStacktrace(e: Error): void
```

> *"If an error is caught, let Vite fix the stack trace so it maps back to your actual source code."*

It mutates the error in place and returns nothing, so it must be called **before** you read
`e.stack`, log it, or hand the error onward.

The Module Runner path removes the need for it entirely:

> *"`server.ssrFixStacktrace` and `server.ssrRewriteStacktrace` do not have to be called when using the Module Runner APIs. The stack traces will be updated unless `sourcemapInterceptor` is set to `false`."*

---

## 2. Real-World Engineering Scenario

**"It renders, but the error page is useless and editing the template does nothing."**

A team stands up middleware-mode SSR from a snippet and it works. Then two complaints arrive
within a week. First: a `TypeError` from a React component produces a stack whose top frame
is an anonymous function in a file nobody recognises — the transformed output — so the
on-call engineer bisects by commenting code out. Second: someone adds a `meta` tag to
`index.html` and it never appears, because the template was read once at boot into a
module-scope variable and closed over.

Both are the same mistake in two costumes: **treating a dev-time artefact as if it were a
build artefact.** In dev, `index.html` is source that must be re-read and re-transformed per
request, and the executing module is a string Vite produced that only Vite can map back.

---

## 3. Production-Grade Code Example

```js
// ssr-handler.js — the six documented steps, as an Express 5 handler factory
import fs from 'node:fs'
import path from 'node:path'

export function ssrHandler(vite) {
  return async function handleSsrRequest(req, res, next) {
    const url = req.originalUrl

    try {
      // 1. Read index.html FRESH per request. In dev this file is source.
      let template = fs.readFileSync(
        path.resolve(import.meta.dirname, 'index.html'),
        'utf-8',
      )

      // 2. Inject the HMR client and every plugin's HTML transform
      //    (e.g. the React refresh preamble from @vitejs/plugin-react).
      template = await vite.transformIndexHtml(url, template)

      // 3. Load the server entry THROUGH the transform pipeline.
      //    A bare import() here would hand Node raw TSX and throw.
      const { render } = await vite.ssrLoadModule('/src/entry-server.js')

      // 4. Render. `render` calls the framework's SSR API,
      //    e.g. ReactDOMServer.renderToString().
      const appHtml = await render(url)

      // 5. Function form of replace() — see chunk 1j for why the string
      //    form corrupts markup containing $& or $'.
      const html = template.replace('<!--ssr-outlet-->', () => appHtml)

      // 6. Send.
      res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
    } catch (e) {
      // Mutates e in place; must run before anything reads e.stack.
      vite.ssrFixStacktrace(e)
      next(e)
    }
  }
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

**`ssrLoadModule` takes a *URL*, not a filesystem path.** `'/src/entry-server.js'` is
root-relative and goes through Vite's resolver — aliases, plugins and virtual modules all
apply. Passing an absolute OS path or a `file://` URL is not the documented shape.

**The extension in the URL need not match the file on disk.** The documented call is
`ssrLoadModule('/src/entry-server.js')` in projects whose entry is `.ts` or `.tsx`; Vite's
resolver handles the extension. Writing the real extension also works.

**`next(e)` is doing more work than it looks.** Express' default error handler prints the
stack only outside production, so delegating gives you a dev stack and a bare 500 in prod
from one code path. Writing `res.end(e.stack)` yourself removes that distinction.

---

## Gotchas

**★ Symptom: an SSR error's stack points at code you never wrote.**
Cause: Node executed Vite's transformed output, evaluated from a string, so its frames name
that output. Fix: remap before you touch the error. It returns `void` — assigning its result
is the second half of this mistake.
```js
} catch (e) {
  vite.ssrFixStacktrace(e)   // mutates e; do not assign
  next(e)
}
```

**★ Symptom: editing `index.html` in dev changes nothing until you restart the server.**
Cause: the template was read once at boot and captured in a closure. Fix: read it inside the
handler, per request, as the documented example does.
```js
app.use('*all', async (req, res, next) => {
  let template = fs.readFileSync(
    path.resolve(import.meta.dirname, 'index.html'), 'utf-8')
  template = await vite.transformIndexHtml(req.originalUrl, template)
})
```

**★ Symptom: the app renders and hydrates, but every edit triggers a full page reload instead of a hot update.**
Cause: the template was served without `transformIndexHtml`, so the HMR client and the
framework plugin's dev preamble were never injected. The module graph is fine; the runtime
that would apply an update is missing. Fix: step 2 is not optional, even when the template
already contains the client script tag.
```js
template = await vite.transformIndexHtml(url, template)
```

**★ Symptom: `SyntaxError: Unexpected token '<'` thrown from the server entry.**
Cause: someone replaced `ssrLoadModule` with a native `import()` — reasonable-looking, since
the path is a real file — and Node received unstripped JSX. Fix: keep the call. In dev the
entry must go through the pipeline; only the *production* branch imports a built file
directly (see [chunk 1f](01f-the-two-builds.md)).
```js
const { render } = await vite.ssrLoadModule('/src/entry-server.js')
```

**★ Symptom: production responses contain a full stack trace.**
Cause: the dev error branch was copied into the production branch verbatim. Fix: never write
the stack into the response; delegate and let the environment decide what to print.
```js
} catch (e) {
  if (import.meta.env.DEV) vite.ssrFixStacktrace(e)
  next(e)  // Express prints the stack only outside production
}
```

**★ Symptom: the error page shows a useful stack the first time and a transformed one after a refactor.**
Cause: a logging or error-reporting call was inserted above `ssrFixStacktrace`, so the
reporter captured `e.stack` before the remap. Fix: remap first, report second — the ordering
is the whole contract of an in-place mutation.
```js
} catch (e) {
  vite.ssrFixStacktrace(e)
  reportToSentry(e)
  next(e)
}
```

---

## Interview questions

**★ Why does Vite need `ssrLoadModule()` at all — Node can already `import()` an ES module?**
Node can import an ES module; it cannot import *your* ES module. The server entry is TSX, or
a `.vue` SFC, or imports a CSS file, or reads `import.meta.env`. None of that is JavaScript
Node accepts. `ssrLoadModule` resolves the URL through Vite's plugin container, runs
`resolveId` / `load` / `transform`, evaluates the result, and records the dependency edges in
the SSR module graph so a later edit can invalidate precisely what changed. A bare `import()`
executes the file on disk and dies on the first non-standard token.

**★ Why must `transformIndexHtml` run on every request in dev, but not in production?**
In dev, `index.html` is source. It has no HMR client, no framework refresh preamble, and no
rewritten asset URLs — all injected at serve time by Vite and by plugins' HTML transform
hooks. In production the client build has already applied those transforms and emitted
`dist/client/index.html` with hashed asset links, so the production branch reads the built
file and skips the call entirely.

**★ Node reads source maps. Why is `ssrFixStacktrace` necessary?**
Node's source-map support maps a frame back through a map it can locate on disk for a file it
loaded from disk. A module loaded via `ssrLoadModule` was transformed in memory and evaluated
from a string; there is no on-disk artefact to key from. Vite keeps its own record of the
transform and uses it to rewrite the frames. This is also why the Module Runner path makes
the call unnecessary — it installs a source-map interceptor when the runner is created, and
the docs say the stack traces *"will be updated unless `sourcemapInterceptor` is set to `false`"*.

**★ Steps 1 and 2 read and transform HTML on every single request. Is that not wasteful?**
In dev, yes, and deliberately so: correctness beats throughput on a machine serving one
developer. In production neither step happens — you read a pre-transformed
`dist/client/index.html`, typically once at boot. The shape of the handler is the same in
both branches; what differs is where the template and the entry come from. Optimising the dev
path by hoisting the read is the single most common way to make `index.html` edits appear not
to work.

**★ What does "there is no bundling required" actually buy an SSR dev server?**
It means the cost of a change is proportional to the change, not to the size of the server
graph. A bundled dev SSR story has to re-roll the server bundle on every edit; Vite fetches
and evaluates modules individually and invalidates the affected subgraph. The trade-off is
that per-request module resolution is slower than executing one pre-built file, which is why
production does the opposite and imports a built bundle.

**★ You see `options?: { fixStacktrace?: boolean }` in the `ssrLoadModule` signature. Should you use it?**
Not on the strength of the signature alone. It is published in the `ViteDevServer` interface
with no prose describing it and no documented default, so its behaviour is unspecified from
a consumer's point of view. Every example in the SSR guide calls `ssrFixStacktrace` in the
catch block instead, which is explicit and version-stable. Treat undocumented options in a
public type as a hint about internals, not as API you can build a runbook on.

---

← [SSR Primitives](01-server-side-rendering-primitives.md) · [Vite overview](../../README.md) · Next → [Environments vs the `ssr` Boolean](01b-environments-replace-the-ssr-boolean.md)
