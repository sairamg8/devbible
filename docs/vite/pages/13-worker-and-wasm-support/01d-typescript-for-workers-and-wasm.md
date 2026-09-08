---
title: "vite/client's ambient module declarations make ?worker and ?init type-check, but the message payloads crossing postMessage are typed by you or not at all"
sidebar_label: "01d · TypeScript for workers & WASM"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vite documentation — [Features](https://vite.dev/guide/features), `vite/client` type declarations (`packages/vite/client.d.ts`, [vitejs/vite](https://github.com/vitejs/vite)); MDN — [`MessageEvent`](https://developer.mozilla.org/en-US/docs/Web/API/MessageEvent). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Typing worker and WASM imports, and the message payloads that cross them

**TypeScript has no native concept of a `?worker` or `?init` import specifier — `foo.js?worker` isn't a real module on disk, so without help, the compiler simply cannot resolve it and every such import is a type error.** `vite/client` fixes the *import specifier* problem with ambient module declarations that pattern-match on the query suffix. It does **not** and cannot fix the second, harder problem: once a worker is running, every message crossing `postMessage`/`onmessage` is `any` by default on both sides, because `MessageEvent<T>`'s `T` is something the platform types leave open for you to fill in — and nothing enforces that the two sides of the channel agree on what they filled it in with.

## Wiring up `vite/client` so the query-suffix imports type-check at all

Per [Features](https://vite.dev/guide/features), there are two ways to bring these ambient declarations into scope, and a project needs exactly one of them:

```json
// tsconfig.json — option 1
{
  "compilerOptions": {
    "types": ["vite/client"]
  }
}
```

```typescript
// vite-env.d.ts — option 2
/// <reference types="vite/client" />
```

> *"Note that if `compilerOptions.types` is specified, only these packages will be included in the global scope (instead of all visible `@types` packages)."* — [Features](https://vite.dev/guide/features)

That note matters the moment a project also depends on ambient `@types` packages for other reasons (a global test-runner API, a third-party global) — setting `types` explicitly silently drops every package not named in that array from the global scope, `vite/client` included if you forget to list it alongside the others.

## What the ambient declarations actually give you

The shapes below are Vite's own `client.d.ts` ambient module declarations — read as *the shape of the declaration*, since this was fetched through a research tool rather than a raw byte-for-byte diff, but the field names, types, and structure are accurate to the source:

```typescript
declare module '*?worker' {
  const workerConstructor: {
    new (options?: { name?: string }): Worker
  }
  export default workerConstructor
}

declare module '*?worker&inline' {
  const workerConstructor: {
    new (options?: { name?: string }): Worker
  }
  export default workerConstructor
}

declare module '*?worker&url' {
  const src: string
  export default src
}

declare module '*?sharedworker' {
  const sharedWorkerConstructor: {
    new (options?: { name?: string }): SharedWorker
  }
  export default sharedWorkerConstructor
}

declare module '*.wasm?init' {
  const initWasm: (options?: WebAssembly.Imports) => Promise<WebAssembly.Instance>
  export default initWasm
}

declare module '*.wasm' {}
```

Two things worth noticing that aren't obvious from just using the imports day to day:

**First**, the worker constructor types (`*?worker`, `*?worker&inline`) accept an options object typed as `{ name?: string }` — narrower than the platform `WorkerOptions` type, which also has `type` and `credentials`. That's not an oversight; `type` isn't yours to set here, because Vite itself already decided the worker's format via `worker.format` at build time (see [01a](01a-worker-build-configuration.md)) — passing `{ type: 'module' }` to a `?worker`-imported constructor is meaningless, since the constructor Vite generated for you already bakes in whichever format it built.

**Second**, `declare module '*.wasm' {}` is an **empty** declaration — it makes the bare import specifier resolvable to *something* so TypeScript doesn't error on the import statement's existence, but it declares no exports at all. A bare `.wasm` import's real exports (whatever functions the WASM binary actually exports) are untyped by `vite/client`; TypeScript will let you write `import { add } from './math.wasm'` without complaint on the specifier, but it has no idea `add` exists, and depending on your `noImplicitAny`/`isolatedModules` settings this can either silently type as `any` or fail elsewhere for unrelated reasons. This is the type gap [`vite-plugin-wasm`](01c-webassembly-imports.md) also documents for its own transform, for the same underlying reason: nothing static can know a compiled binary's export shape without actually reading it.

## Typing `?init`'s return value precisely

`*.wasm?init`'s declared type — `(options?: WebAssembly.Imports) => Promise<WebAssembly.Instance>` — matches exactly what [01c](01c-webassembly-imports.md) quotes from the prose docs: a function taking an optional `importObject`, returning a `Promise` of an *instance*, not the exports. `WebAssembly.Instance.exports` is typed in `lib.dom.d.ts` (via `WebAssembly.Exports`) as `Record<string, WebAssembly.ExportValue>` — effectively `Record<string, any>`, since a WASM export could be a function, a memory, a table, or a global. That means even with `vite/client`'s types loaded, `instance.exports.add` type-checks as `any`, and calling it with wrong argument types compiles fine and fails at the WASM boundary at runtime. Closing that gap requires a hand-written cast:

```typescript
import init from './math.wasm?init';

interface MathExports {
  add(a: number, b: number): number;
  multiply(a: number, b: number): number;
}

async function loadMath(): Promise<MathExports> {
  const instance = await init();
  return instance.exports as unknown as MathExports;
}
```

Nothing verifies this cast against the actual `.wasm` binary — if the binary changes its exported signature, this compiles clean and fails only when called, exactly the same trust boundary as `JSON.parse(x) as SomeType`.

## Typing `postMessage`/`onmessage` message unions

`MessageEvent<T>` is generic, but neither `Worker`'s `onmessage` property nor `addEventListener('message', ...)` are typed generically over it in `lib.dom.d.ts` — both leave `data` as `any` by default, because the platform type has no way to know what a given worker will actually send. The fix is the same discipline as typing a Redux action union or an IPC message bus: define the message shapes once, share the type between both sides, and annotate the event handler explicitly.

```typescript
// worker-messages.ts — shared between main thread and worker source
export type MainToWorkerMessage =
  | { type: 'filter'; imageData: ImageData; kernel: 'sobel' | 'convolve' }
  | { type: 'cancel' };

export type WorkerToMainMessage =
  | { type: 'result'; imageData: ImageData }
  | { type: 'error'; message: string };
```

```typescript
// image-filter.worker.ts
import type { MainToWorkerMessage, WorkerToMainMessage } from './worker-messages';

self.onmessage = (event: MessageEvent<MainToWorkerMessage>) => {
  const message = event.data;
  if (message.type === 'cancel') {
    return; // TypeScript narrows correctly inside each branch
  }
  // message.type === 'filter' here — imageData and kernel are both known
  const filtered = applyKernel(message.imageData, message.kernel);
  const reply: WorkerToMainMessage = { type: 'result', imageData: filtered };
  self.postMessage(reply);
};

function applyKernel(imageData: ImageData, kernel: 'sobel' | 'convolve'): ImageData {
  return imageData; // pixel-processing omitted — the point here is the message typing
}
```

```typescript
// PhotoEditor.tsx — main-thread side, same shared types
import ImageFilterWorker from './image-filter.worker.ts?worker';
import type { MainToWorkerMessage, WorkerToMainMessage } from './worker-messages';

const worker = new ImageFilterWorker();

worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => {
  const message = event.data;
  if (message.type === 'error') {
    console.error(message.message);
    return;
  }
  applyFilteredImage(message.imageData); // narrowed to the 'result' branch
};

function send(message: MainToWorkerMessage) {
  worker.postMessage(message);
}

function applyFilteredImage(imageData: ImageData) {
  // render the filtered image
}
```

Nothing about this pattern is Vite-specific — it's the same discriminated-union approach used for any two-sided message channel — but it's worth stating explicitly here because `?worker`'s ambient type gives you a correctly-typed `Worker` constructor and stops there; the `Worker` interface's own `onmessage`/`postMessage` signatures are generic-free in `lib.dom.d.ts`, so the message contract is entirely your own discipline to enforce, not something the query suffix or `vite/client` types you into.

## The `?url` / `?raw` / `?inline` family, briefly

`*?worker&url` and `*.wasm?init`'s companion forms reuse the same generic `?url`/`?raw`/`?inline` asset-suffix family topic 06 covers in full — see [06 · Static asset imports](../06-asset-handling/01-static-asset-imports.md) for the general mechanism (what gets inlined below the size threshold, what `?raw` returns as a string, how `?inline`/`?no-inline` override the default). The only worker/WASM-specific fact worth restating here is that `*?worker&url` and `*?url` share the exact same declared type in `vite/client` — both are `const src: string; export default src` — so from TypeScript's point of view they are indistinguishable; the difference is entirely in what Vite's resolver does with the specifier before the type declaration ever matters.

## Gotchas

**★ Symptom: `import Worker from './w.js?worker'` reports `Cannot find module './w.js?worker' or its corresponding type declarations`.** Cause: `vite/client`'s ambient module declarations were never brought into the TypeScript program — neither `tsconfig.json`'s `compilerOptions.types` includes `"vite/client"`, nor does any `.d.ts` file in the project carry `/// <reference types="vite/client" />`. Fix: add one of the two, and if `compilerOptions.types` is already set to a non-empty array for another reason, add `"vite/client"` to that same array rather than creating a second, conflicting configuration.
```json
{ "compilerOptions": { "types": ["vite/client", "vitest/globals"] } }
```

**★ Symptom: `new MyWorker({ type: 'module' })` fails to type-check — TypeScript reports the object literal only allows a `name` property.** Cause: the `?worker`-imported constructor's ambient type deliberately narrows the options object to `{ name?: string }`, because `type` (module vs classic) was already decided at build time by `worker.format` — it isn't a per-instantiation choice the way it is with the raw platform `new Worker(url, { type: 'module' })` constructor. Fix: don't pass `type` at all when using a `?worker` import; if you need a runtime-chosen format, use the standards-based `new Worker(new URL(...), { type: ... })` form instead, which is typed against the platform's real `WorkerOptions`.

**★ Symptom: `instance.exports.add(2, 3)` from a `?init`-loaded WASM module type-checks with no error, then throws at runtime because `add` doesn't exist on this build of the binary.** Cause: `WebAssembly.Instance['exports']` is typed as an untyped record (`WebAssembly.Exports`, effectively `Record<string, any>`) — `vite/client` has no way to know a compiled binary's real export shape, so any hand-written interface asserted over `.exports` is trusted, not checked. Fix: there is no compiler-enforced fix; treat the cast the same way you'd treat `JSON.parse(x) as SomeType` — verify it against the actual binary when the binary changes, and consider a small runtime assertion (checking `typeof instance.exports.add === 'function'`) at the load site if the binary's build is not fully under your control.

**★ Symptom: a worker's `onmessage` handler compiles fine with a typo'd message `type` field, or with a field that doesn't exist on any variant of the message union, and the bug is only caught by manual testing.** Cause: `Worker['onmessage']` and `addEventListener('message', ...)` are untyped over their payload in `lib.dom.d.ts` — `MessageEvent<T>`'s `T` defaults to `any` unless you annotate the handler's parameter type yourself, and nothing forces the annotation on both the sending and receiving side to reference the same shared type. Fix: define the message union once, in a module imported by both the worker source and the main-thread caller, and annotate every handler explicitly against it, as shown above — treat it as a discriminated-union IPC contract, not as "whatever data happens to arrive."

## Interview questions

**★ Why does `import Worker from './w.js?worker'` need a special TypeScript setup at all, when a plain `import './w.js'` doesn't?**
Because `'./w.js?worker'` isn't a real path on disk — the `?worker` suffix is a Vite-specific resolution instruction, not a filesystem fact, and TypeScript's module resolution has no built-in concept of query-suffixed specifiers. `vite/client` closes that gap with ambient `declare module '*?worker' { ... }` blocks that pattern-match on the suffix and declare a fabricated module shape for it — the compiler isn't resolving the specifier to a real file, it's matching the string against a wildcard pattern and trusting the shape Vite's own type declarations assert. Without `vite/client` loaded into the program (via `compilerOptions.types` or a triple-slash reference), no such pattern exists and the specifier is a hard type error.

**★ `vite/client` types your `?worker` import correctly as a `Worker` constructor. Does that mean the messages you send and receive through it are also type-safe?**
No — and this is the gap people assume doesn't exist. `vite/client`'s job stops at "this import specifier resolves to a value of this shape" — a constructor, a string, an init function. The `Worker` interface itself, from `lib.dom.d.ts`, types `postMessage` and `onmessage`/`addEventListener('message', ...)` with no generic constraint on the payload at all; `event.data` is `any` by default. Type safety for the actual messages crossing the channel is something you build yourself — a shared discriminated-union type imported by both the worker source and the main-thread caller, with explicit `MessageEvent<YourUnionType>` annotations on every handler. Nothing in Vite or `vite/client` enforces that the two sides agree.

**★ Why is `declare module '*.wasm' {}` an empty declaration, and what does that cost you?**
Because a compiled WebAssembly binary's export shape — which functions it exports, their signatures, whether it exports memory or tables — can't be known statically from the file's existence alone; it would require actually parsing the binary's export section, which `vite/client`'s ambient declarations don't do. The empty declaration exists purely to stop TypeScript from erroring on the import specifier itself. The cost is that a bare `.wasm` import's named exports are entirely untyped — `import { add } from './math.wasm'` compiles, but TypeScript has no idea `add` is a real export or what its signature is, so a typo in the imported name, or a mismatched argument type at the call site, is invisible to the compiler and surfaces only at runtime.

---

← [01c · WebAssembly imports](01c-webassembly-imports.md) · [Vite overview](../../README.md) · Next → [01 · The Vitest/Vite relationship](../14-testing-integration/01-vitest-relationship.md)
