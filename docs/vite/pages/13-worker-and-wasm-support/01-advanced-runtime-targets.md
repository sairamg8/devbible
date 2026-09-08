---
title: "A worker or a WASM module is a second, separate module graph that Vite builds alongside your app, not a string path handed to a runtime API"
sidebar_label: "01 · Worker & WASM import surface"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vite documentation — [Features](https://vite.dev/guide/features), [Assets](https://vite.dev/guide/assets), [Worker Options](https://vite.dev/config/worker-options); MDN — [`Worker()`](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ The worker and WASM import surface

**Every other import in Vite resolves to a module — a worker or a WASM import resolves to a *build artifact of a second module graph*, and which artifact you get (a constructor, a URL string, or an inlined blob) is decided entirely by the query suffix or constructor form you write.** The two mainstream JS bundling problems — "convert this to something the browser can run" and "give me a handle to it" — collapse into one decision here, because a worker script and a `.wasm` binary both need a build step the main module graph doesn't: the worker needs its own bundle, and the WASM binary needs an async instantiation step before its exports exist at all. Get the suffix wrong and you don't get a compile error — you get a `Worker` constructor where you expected a URL, or a promise-returning function where you expected the module's real exports.

## The two ways to import a worker

Vite recognizes a worker two ways, and they produce a materially different amount of static analysis.

**1. The standards-based form** — `new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })`. This is not Vite syntax at all; it's the platform's own way to construct a worker relative to the current module, and Vite statically detects it during the build so the referenced file gets its own bundle and a hashed output URL, exactly like an asset import.

**2. The query-suffix form** — appending `?worker` or `?sharedworker` to the import specifier:

```typescript
import ImageFilterWorker from './image-filter.worker.ts?worker';
import ClipboardSyncWorker from './clipboard-sync.ts?sharedworker';
```

> *"A web worker script can be directly imported by appending `?worker` or `?sharedworker` to the import request."* — [Features](https://vite.dev/guide/features)

Both forms end up in the same place — a separate build of the worker's own module graph — but the suffix form is Vite-specific sugar; the `new URL()` form is what you'd write with zero bundler-specific knowledge at all, which is why the docs frame it as the primary pattern and the suffix as the alternative.

## What each import specifier actually evaluates to

This is the part that bites people, because none of these forms *look* different enough to remind you what you're holding:

| Import | Evaluates to | Use it when |
|---|---|---|
| `import W from './w.js?worker'` | A `Worker` **constructor** — `new W()` spins one up | Default; the worker ships as its own chunk in the build |
| `import W from './w.js?worker&inline'` | A `Worker` constructor whose script is a **base64-inlined blob URL**, no separate network request | Cross-origin worker sources (a CDN-hosted app shell), or a worker so small the extra request costs more than the inline weight |
| `import url from './w.js?worker&url'` | A **string** — the built worker's URL, not a constructor | You need the URL itself: constructing the `Worker` yourself, passing it to a library that wants a URL, or lazy-creating workers on demand |
| `import SW from './s.js?sharedworker'` | A `SharedWorker` **constructor** | Cross-tab/cross-frame shared state — see [01b](01b-shared-workers-and-messaging.md) |

> *"By default, the worker script will be emitted as a separate chunk in the production build."* — [Features](https://vite.dev/guide/features)
> *"If you wish to inline the worker as base64 strings, add the `inline` query"* — [Features](https://vite.dev/guide/features)
> *"If you wish to retrieve the worker as a URL, add the `url` query"* — [Features](https://vite.dev/guide/features)

The `&url` form matters specifically because of `blob:` origins and cross-origin CDNs: a `Worker` constructor built by `?worker` still needs the script served from a location the browser is willing to fetch as a worker. If your app is served from a CDN and the worker script must be constructed against a `blob:` URL you build yourself (common in embeddable widgets, where the worker file must not leak the embedding page's origin into a same-origin fetch), `?worker&url` gives you the raw string to build that `blob:` wrapper from — `?worker` alone gives you a constructor with no seam to intercept the fetch.

## The precise rule for the `new URL()` form

The standards-based form only gets Vite's static analysis under two conditions, both stated exactly, both silently unenforced (nothing throws if you break them — you just don't get the worker build):

> *"The worker detection will only work if the `new URL()` constructor is used directly inside the `new Worker()` declaration."*

> *"Additionally, all options parameters must be static values (i.e. string literals)."*

"Directly inside" means literally inline — not assigned to a variable first, not returned from a helper function, not built from a ternary. And "static values" means the `{ type: 'module' }` options object's fields must be string literals, not `{ type: workerType }` where `workerType` is a runtime variable. This mirrors the exact same static-analysis constraint the `new URL(path, import.meta.url)` asset pattern has for plain assets:

> *"However, the URL string must be static so it can be analyzed, otherwise the code will be left as is."*

```typescript
// ✅ Detected — literal URL, literal options object, both inline
const worker = new Worker(new URL('./worker.js', import.meta.url), {
  type: 'module',
});

// ❌ NOT detected — the URL is built by a helper, so the literal the analyzer
// needs to see never appears inside the `new Worker(...)` call itself
function resolveWorkerUrl(path: string) {
  return new URL(path, import.meta.url);
}
const worker2 = new Worker(resolveWorkerUrl('./worker.js'), { type: 'module' }); // left as-is — no worker build happens
```

There is no Vite-emitted warning for the second form. It compiles, it runs in dev (where the browser fetches the file directly), and it silently ships a raw, untransformed, un-hashed source path in the production build — which then 404s because that path was never emitted as a build artifact. This is the single most common "works in dev, breaks in prod" report for this feature.

## Dev vs build: why this feature has two completely different code paths

> *"**Note**: During development this relies on [browser native support](https://caniuse.com/?search=module%20worker), but for the production build it is compiled away."* — [Features](https://vite.dev/guide/features)

In dev, a `?worker`-imported or `new Worker(new URL(...), { type: 'module' })`-constructed worker is served as **native ESM** — the browser itself resolves the worker's `import` statements, using the module worker support it already has for `<script type="module">`. Vite is not bundling the worker in dev at all; it's transforming individual files on request, same as the main app. That means the worker actually depends on the browser having module-worker support, which is a materially newer feature than module `<script>` tags — check the linked caniuse table before you assume every browser your app supports also supports a module worker.

In the production build, that dependency evaporates: the worker script and everything it imports gets bundled by Rolldown into a self-contained artifact (`worker.format` decides whether that artifact is ESM or IIFE — see [01a](01a-worker-build-configuration.md)), so the built output does not require the browser to support module workers at all if `format` is `'iife'`. This is why a codebase can genuinely ship module-worker syntax and still support a browser with no module-worker support: dev needs it, the built artifact might not.

## What the WASM half of this page argues, briefly — full treatment in 01c

The same "you get an artifact, not the thing itself" shape repeats for WebAssembly, but the artifact is an async initializer instead of a constructor, and the reason is platform-level, not Vite's choice: `WebAssembly.instantiate` is asynchronous by specification, so there is no synchronous import form that could exist. `?init` versus a bare `.wasm` import versus `?url` is the same three-way split as the worker suffixes, and it gets its own full treatment in [01c](01c-webassembly-imports.md) because the precision required around what the init function's argument and return value actually are is enough content on its own.

## Gotchas

**★ Symptom: a worker built with `new Worker(new URL('./w.js', import.meta.url))` works in `vite dev` and 404s in the production build.** Cause: the URL or the options object was not a literal inline in the `new Worker(...)` call — routed through a variable, a helper function, or a computed path — so Vite's static detection never fired and the file was never registered as a build entry. Fix: inline both arguments literally, per the two required conditions above; if you need a computed path, use the `?worker&url` suffix form instead and construct the `Worker` yourself, since that path doesn't depend on AST-level detection.

**★ Symptom: `import Worker from './w.js?worker&url'` produces a `Worker` instance with no `postMessage` method — actually, it doesn't error, but `new Worker()` throws because `Worker` isn't a constructor.** Cause: `&url` changes the import's return type from a constructor to a plain string; the code still calls `new Worker(Worker)`, which throws `Worker is not a constructor` (the exact wording is a JS runtime message, not a Vite one) because the imported value is a URL string, not a class. Fix: use the string as the argument to a real `new Worker(url, { type: 'module' })` call, or drop `&url` and import with plain `?worker` if you didn't actually need the URL as data.
```typescript
import workerUrl from './w.js?worker&url';
const worker = new Worker(workerUrl, { type: 'module' }); // ✅ url used as an argument, not called
```

**★ Symptom: a worker imported with `?worker&inline` bloats the main bundle noticeably even though the worker script itself is small.** Cause: `&inline` base64-encodes the worker's *entire built output*, including anything it imports, straight into the chunk that imports it — there's no separate network request, which is the point, but there's also no code-splitting benefit, and base64 is ~33% larger than the binary it encodes. Fix: only use `&inline` for workers whose script (plus its own imports) is genuinely small, or where the cross-origin/`blob:` requirement makes a separate request impossible anyway; for anything larger, use the default `?worker` form and accept the extra request.

## Interview questions

**★ Why does Vite recognize two completely different syntaxes — `?worker` and `new Worker(new URL(...))` — for the same thing?**
Because they have different audiences and different amounts of magic. The `new URL()` form is standards-based: it's exactly what you'd write with no bundler at all, using `import.meta.url` to resolve a relative path against the current module and the platform's own `Worker` constructor to run it — Vite just statically detects that pattern and slots the file into the build graph, the same trick it uses for `new URL(path, import.meta.url)` asset references. The `?worker` suffix is Vite-specific sugar that skips the `new Worker(...)` boilerplate and hands you a ready constructor. Teams that care about their source surviving a bundler swap tend to prefer the standards-based form for exactly that reason; teams that don't, take the suffix because it's shorter.

**★ A worker construction works in dev and 404s only in the production build. Where do you look first?**
Not the worker script's contents — the construction site. This symptom is the signature of failed static detection on the `new Worker(new URL(...))` form: Vite's analyzer requires the `new URL()` call to sit directly inside the `new Worker()` call with a literal path and literal options, and if either was routed through a variable or a function, the analyzer silently skips it. Dev doesn't need that detection — the browser resolves the raw `import.meta.url`-relative path itself as native ESM — so it works there regardless. The build does need it, because that's the only signal telling Rolldown "treat this file as a worker entry point," and with no entry point registered, the raw source path ships untransformed and unbuilt, then 404s once the app is served from the built `dist/` output.

**★ What decides whether a module worker is required to exist in the browser your app supports?**
Dev mode does; the production build might not. In dev, Vite serves the worker as native ESM and leans on the browser's own module-worker support (`new Worker(url, { type: 'module' })` support, which is newer than `<script type="module">` support and not universal). In the production build, the worker's whole module graph gets bundled into one artifact by Rolldown, and `worker.format` decides what that artifact looks like — `'iife'` produces a self-contained classic script with no module-worker dependency at all. So a codebase can use `import`/`export` syntax inside its worker source, develop it against a modern browser, and still ship a production build that runs on a browser with zero module-worker support — and `'iife'` is in fact `worker.format`'s **default**, not the exception (see [01a](01a-worker-build-configuration.md) for why that default surprises people who read only the source and never the config).

---

← [01 · resolve.alias fundamentals](../12-path-resolution-and-aliases/01-resolve-options.md) · [Vite overview](../../README.md) · Next → [01a · Worker build configuration](01a-worker-build-configuration.md)
