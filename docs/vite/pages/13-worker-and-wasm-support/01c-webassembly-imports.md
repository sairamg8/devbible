---
title: "A bare .wasm import and a ?init import are not two flavors of the same feature — one gives you the module's exports directly and requires top-level await, the other gives you a function you call yourself"
sidebar_label: "01c · WebAssembly imports"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vite documentation — [Features](https://vite.dev/guide/features), [Assets](https://vite.dev/guide/assets), [Build Options](https://vite.dev/config/build-options); MDN — [`WebAssembly.instantiate()`](https://developer.mozilla.org/en-US/docs/WebAssembly/JavaScript_interface/instantiate), [`WebAssembly.Instance`](https://developer.mozilla.org/en-US/docs/WebAssembly/JavaScript_interface/Instance); [`vite-plugin-wasm`](https://github.com/Menci/vite-plugin-wasm) README. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ WebAssembly: `.wasm` imports, `?init`, and why instantiation is always async

**Vite gives you exactly three ways to bring a `.wasm` binary into your code, and the difference between them is not stylistic — it's whether Vite instantiates the module for you eagerly (requiring your module to support top-level `await`), hands you a function to instantiate it yourself, or refuses to instantiate it at all and just gives you a URL.** The reason none of these can be a synchronous import, ever, is not a Vite limitation — `WebAssembly.instantiate` is asynchronous by the WebAssembly JavaScript API's own specification, full stop, so there is no bundler trick that makes a `.wasm` file import like a plain JS module without an `await` somewhere in the chain.

## The three import forms

```typescript
// 1. Bare import — Vite instantiates it FOR you, eagerly, at module-evaluation time
import { add, multiply } from './math.wasm';
// this module is an ASYNC module — importing it requires the importer to also
// support top-level await, transitively, all the way up

// 2. ?init — YOU control when instantiation happens
import init from './math.wasm?init';
const instance = await init(); // instance is a WebAssembly.Instance
const { add, multiply } = instance.exports;

// 3. ?url — no instantiation at all, just the built asset's URL
import wasmUrl from './math.wasm?url';
// use this with WebAssembly.instantiateStreaming yourself, or to instantiate
// the same module more than once
```

> *"A `.wasm` file can be imported directly. Vite reads the module's imports and exports from the binary, instantiates it, and re-exposes its exports"* — [Features](https://vite.dev/guide/features)

> *"Because a WebAssembly module is instantiated asynchronously, a directly imported `.wasm` file behaves as an async module and requires top-level `await` support."* — [Features](https://vite.dev/guide/features)

Form 1 is convenient exactly until you need control over instantiation — a second instance for a worker pool, a custom `importObject`, or a runtime the browser can only reach via `WebAssembly.instantiateStreaming` for performance. That's what `?init` exists for.

## What `?init`'s function argument and return value actually are — precisely

This is the detail the seed content on this page got vague about, and it's exactly the kind of vagueness that produces a `TypeError` three lines later. Quoted exactly:

> *"The default export will be an initialization function that returns a Promise of the [`WebAssembly.Instance`](https://developer.mozilla.org/en-US/docs/WebAssembly/JavaScript_interface/Instance)"* — [Features](https://vite.dev/guide/features)

> *"The init function can also take an importObject which is passed along to [`WebAssembly.instantiate`](https://developer.mozilla.org/en-US/docs/WebAssembly/JavaScript_interface/instantiate)"* — [Features](https://vite.dev/guide/features)

So, precisely:

- **The init function's argument** is an `importObject` — the same shape `WebAssembly.instantiate(bufferSource, importObject)` accepts natively, i.e. an object whose keys are module names the WASM binary imports (memory, table, or host functions the binary calls into) and whose values satisfy those imports.
- **The init function's return value** is a `Promise<WebAssembly.Instance>` — **not** the exports object directly, and **not** the `WebAssembly.Module`. `WebAssembly.Instance` is a wrapper; the actual callable exports live on its `.exports` property.

```typescript
// math.wasm expects an imported function for logging, declared in the .wat/.wasm source
import init from './math.wasm?init';

const instance = await init({
  env: {
    log: (value: number) => console.debug('wasm log:', value),
  },
});

// ❌ instance itself is a WebAssembly.Instance, not the exports
instance.add(2, 3); // TypeError: instance.add is not a function

// ✅ exports live on .exports
const { add, multiply } = instance.exports as { add: (a: number, b: number) => number; multiply: (a: number, b: number) => number };
add(2, 3);
```

## Accessing the `Module` object for repeat instantiation

Both `.wasm` bare import and `?init` give you an *instance* — a single, already-linked instantiation. If you need the underlying `WebAssembly.Module` itself, to instantiate the same compiled module multiple times (a worker pool where each worker gets its own linear memory from the same compiled bytes) or to use streaming instantiation:

> *"If you need access to the `Module` object, e.g. to instantiate it multiple times, use an [explicit URL import](https://vite.dev/guide/assets#explicit-url-imports) to resolve the asset, and then perform the instantiation"*

> *"You can use an [explicit URL import](https://vite.dev/guide/assets#explicit-url-imports) and then utilize `WebAssembly.instantiateStreaming`"*

```typescript
import wasmUrl from './math.wasm?url';

async function instantiateForWorker(importObject: WebAssembly.Imports) {
  const response = await fetch(wasmUrl);
  const { instance, module } = await WebAssembly.instantiateStreaming(response, importObject);
  return { instance, module }; // `module` can now seed further instantiations without re-fetching
}
```

Neither the bare-import form nor `?init` exposes the compiled `Module` — only the `?url` + manual `WebAssembly.instantiateStreaming` path does, because that's the only one where you, not Vite, control the whole instantiation call.

## `build.target` and why top-level await needs a modern-enough target

A bare `.wasm` import is an async module requiring top-level `await`, which transitively forces every module that imports it — and everything importing *that* — to also be treated as async up the chain. Whether that compiles down to something the target browser can run depends on `build.target`.

Vite 8 changed `build.target`'s default:

> *"The default browser values of `build.target` and `'baseline-widely-available'` are updated to newer browser versions"* — [Migration from v7](https://vite.dev/guide/migration), listing Chrome 107→111, Edge 107→111, Firefox 104→114, Safari 16.0→16.4, aligned to Baseline Widely Available as of January 1, 2026.

Top-level await has been part of Baseline Widely Available browser support for long enough that the default target supports it without special configuration — but if `build.target` is set explicitly to an older value (a legacy-browser support requirement unrelated to WASM), a bare `.wasm` import's implicit top-level await requirement can push you into needing a plugin to transform it away, which is exactly the gap `vite-plugin-top-level-await` fills for the third-party WASM tooling below.

## `vite-plugin-wasm` and the ESM-integration story

Vite's *built-in* `.wasm` handling (the two forms above) is deliberately minimal — it does not implement the fuller "WASM as an ES module with imports resolved automatically the way JS module imports are" story that tools like webpack's `asyncWebAssembly` experiment aimed for. The community plugin filling that gap is [`vite-plugin-wasm`](https://github.com/Menci/vite-plugin-wasm), commonly paired with `vite-plugin-top-level-await`:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
});
```

The README states why the second plugin is paired with the first:

> *"You also need the `vite-plugin-top-level-await` plugin unless you target very modern browsers only (i.e. set `build.target` to `esnext`)."*

That statement predates Vite 8's Rolldown/Oxc-based build pipeline (`vite-plugin-wasm`'s README targets the esbuild-based build era), so its exact interaction with Vite 8's default `build.target` of `'baseline-widely-available'` is **not confirmed by primary sources for this page** — treat "still required on Vite 8" as the safer assumption rather than testing it live in a production app first.

The README also flags a real limitation for anyone relying on `wasm-pack`-generated bindings:

> *"TypeScript typing is broken. Since we can't declare a module with `Record<string, any>` as its named export map, your `import ... from './module.wasm';` will still get Vite's built-in typing, but the transformed code is fine."*

The workaround it documents is a namespace import with a manual type assertion rather than named imports:

```typescript
// workaround for vite-plugin-wasm's TypeScript typing gap on wasm-pack output
import * as mathModule from './math.wasm';
const { add, multiply } = mathModule as unknown as { add: (a: number, b: number) => number; multiply: (a: number, b: number) => number };
```

## WASM under SSR: the `node:fs` restriction

This is the sharpest, most specific claim in the whole topic, and it is Vite's own documented text, not an inference:

> *"Due to the lack of a universal way to load a file, the internal implementation for both direct `.wasm` imports and `.wasm?init` relies on the `node:fs` module."* — [Features](https://vite.dev/guide/features)

> *"these features will only work in Node.js compatible runtimes for SSR builds"*

Read precisely: **both** the bare-import form and `?init` are affected, because both rely on Vite's SSR transform loading the `.wasm` binary through `node:fs` under the hood when your SSR entry runs in Node. If your SSR target is an edge runtime that doesn't ship `node:fs` (Cloudflare Workers, a Deno Deploy edge function, Vercel's Edge Runtime), a `.wasm` import that works perfectly in the browser bundle and in a Node-based SSR server will fail specifically in that edge SSR context — not because WebAssembly itself isn't supported there (most of these runtimes support WASM natively, often better than Node does), but because Vite's own loading mechanism for the import is `node:fs`-dependent. The `?url` form sidesteps this, since it returns a string rather than triggering Vite's internal load-and-instantiate path — fetch the URL yourself using whatever the edge runtime's native fetch/streaming APIs are.

## Gotchas

**★ Symptom: `import wasmExports from './module.wasm?init'; wasmExports.add(2, 3)` throws `TypeError: wasmExports.add is not a function`.** Cause: the default export of a `?init` import is the initializer **function**, not the module's exports — calling `.add` on the function itself is meaningless. Fix: call and await the function, then read `.exports` off the resulting `WebAssembly.Instance`.
```typescript
import init from './module.wasm?init';
const instance = await init();
instance.exports.add(2, 3);
```

**★ Symptom: after switching from a bare `.wasm` import to `?init`, the module's imported host functions (a `log` callback, an imported memory) stop being wired up, even though nothing else changed.** Cause: the bare-import form has Vite construct and pass a default `importObject` for you as part of "instantiates it, and re-exposes its exports"; `?init`'s function accepts an `importObject` as its own argument and does nothing with the binary's declared imports unless you pass one yourself. Fix: pass the same import object explicitly to `init()`.
```typescript
const instance = await init({ env: { log: (n: number) => console.debug(n) } });
```

**★ Symptom: a bare `.wasm` import compiles locally and then the production bundle fails to load in a target browser that predates top-level `await`.** Cause: the docs are explicit that a directly-imported `.wasm` file "requires top-level `await` support," and that requirement propagates to every module that imports it, transitively. If `build.target` was pinned lower than the browser range where top-level await landed, the build either fails to transform it correctly or ships code the target can't run. Fix: raise `build.target` to at least the default (`'baseline-widely-available'`), or switch to `?init` — an async **function** call inside an `async` function you control does not require the *importing module itself* to use top-level await, only the code path that calls `init()` does.

**★ Symptom: you need to run the same compiled `.wasm` module in four separate worker instances, each with isolated linear memory, and re-fetching/re-compiling the binary four times feels wasteful.** Cause: neither the bare-import nor `?init` form exposes the underlying `WebAssembly.Module` — both give you an already-linked `Instance`. Fix: use `?url` and `WebAssembly.instantiateStreaming` yourself, which returns both `{ instance, module }`, and reuse the `module` for subsequent instantiations without re-fetching or re-compiling the bytes.
```typescript
import wasmUrl from './shared.wasm?url';
const first = await WebAssembly.instantiateStreaming(await fetch(wasmUrl));
const second = await WebAssembly.instantiate(first.module, importObjectForWorker2);
```

**★ Symptom: a `.wasm` import works in the browser bundle and in a Node-hosted SSR server, then throws once the same SSR code is deployed to an edge runtime (Cloudflare Workers, an Edge Runtime function).** Cause: Vite's SSR handling for both the bare-import and `?init` forms is documented as relying on `node:fs` internally to load the file, and edge runtimes commonly do not ship `node:fs` at all, independent of whether they support WebAssembly natively (many do, often well). Fix: use `?url` for any code path that must also run under edge SSR, and instantiate manually with the runtime's native fetch/streaming primitives instead of Vite's built-in load path.

**★ Symptom: `vite-plugin-wasm`-processed `wasm-pack` output fails TypeScript compilation with an error about an export map, even though the JS it produces at runtime is correct.** Cause: the plugin's own README documents this as a known limitation — a WASM module's dynamic export shape can't be declared as a TypeScript module type with `Record<string, any>` as its named exports. Fix: import with a namespace import and an explicit type assertion, as the README recommends, rather than trying to get named imports to type-check.
```typescript
import * as mathModule from './math.wasm';
const typed = mathModule as unknown as { add(a: number, b: number): number };
```

## Interview questions

**★ Why can a `.wasm` file never be imported the way a plain `.js` module is?**
Because `WebAssembly.instantiate` — the only spec-defined way to turn compiled WASM bytes into a runnable instance — is asynchronous by the WebAssembly JavaScript API's own design, not by any bundler's choice. Compiling and linking a WASM module can be genuinely slow relative to parsing JS, and the platform never offered a synchronous instantiation path at all. A bundler could paper over that by pre-instantiating at build time in some cases, but Vite's own bare-import form instead makes the honest choice: it imports as an *async module*, which correctly propagates the requirement for top-level `await` support up through every module that imports it, rather than hiding an inherently asynchronous operation behind syntax that looks synchronous.

**★ What exactly does `import init from './module.wasm?init'` give you, and what's the most common mistake made with it?**
It gives you a function — call it, and it returns a `Promise` that resolves to a `WebAssembly.Instance`, not the module's exports directly and not a `WebAssembly.Module`. The most common mistake is skipping the `.exports` step and calling a function directly on the resolved instance, which throws, because the instance is a wrapper object whose actual callable exports live one property level down, at `instance.exports`.

**★ Your `.wasm` module declares an imported host function for logging. It works with a bare `.wasm` import and breaks after switching to `?init`. Why?**
Because the two forms handle the WASM binary's own declared imports differently. A bare import has Vite construct and supply the `importObject` on your behalf as part of the "instantiate it, and re-expose its exports" step the docs describe. `?init`'s returned function accepts an `importObject` as an explicit argument and passes it straight through to `WebAssembly.instantiate` — if you call `init()` with no argument, any host functions or imported memory the binary declares are simply absent, and the binary either fails to instantiate or the specific import call fails at the point the WASM code tries to invoke it.

**★ A `.wasm` import works fine in your Node SSR server and fails only when the same server code runs on an edge runtime. What's the mechanism, and is it a WebAssembly support problem?**
Not a WebAssembly support problem specifically — most edge runtimes support WASM well, sometimes better than Node. It's a loading-mechanism problem: Vite's documented SSR implementation for both the bare `.wasm` import and `?init` relies on `node:fs` internally to read the binary off disk, and that dependency has nothing to do with WebAssembly execution itself — it's purely how Vite gets the bytes into memory before instantiating. An edge runtime that doesn't provide `node:fs` breaks at that loading step, before WebAssembly is even involved. The fix is to route around Vite's built-in loader entirely — `?url` plus a manual `fetch()` and `WebAssembly.instantiateStreaming()` call, using whichever fetch implementation the edge runtime natively provides.

---

← [01b · Shared workers & messaging](01b-shared-workers-and-messaging.md) · [Vite overview](../../README.md) · Next → [01d · TypeScript for workers & WASM](01d-typescript-for-workers-and-wasm.md)
