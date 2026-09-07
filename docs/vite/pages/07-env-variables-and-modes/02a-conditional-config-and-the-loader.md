---
title: "Conditional Config: `command`, `mode`, and Two Flags That Are Not Booleans"
sidebar_label: "Conditional Config"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Configuring Vite](https://vite.dev/config/). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Conditional Config: `command`, `mode`, and Two Flags That Are Not Booleans

[Chunk 2](02-config-time-env-and-define.md) established that the config runs before env files are
read. This chunk covers what the config function *is* handed instead — and the fact that two of
those four arguments are not booleans, whatever their types say.

---

## 1. Under-The-Hood Mechanics

### The signature

```js
export default defineConfig(({ command, mode, isSsrBuild, isPreview }) => { /* … */ })
```

> *"in Vite's API the command value is `serve` during dev (in the cli `vite`, `vite dev`, and `vite serve` are aliases), and `build` when building for production"*

So `command` is exactly two values, and `vite dev` does **not** produce `command === 'dev'` — a
detail that catches people who reason from the CLI name rather than the API.

🔴 **The two flags are tri-state:**

> *"`isSsrBuild` and `isPreview` are additional optional flags to differentiate the kind of build and serve commands respectively. Some tools that load the Vite config may not support these flags and will pass `undefined` instead. Hence, it's recommended to use explicit comparison against `true` and `false`."*

```
isSsrBuild:  true         → this is an SSR build
             false        → this is a client build
             undefined    → the tool loading this config did not say
```

`if (!isSsrBuild)` collapses the third state into the second. An SSR-only plugin guarded that way is
active in a client build whenever a wrapper tool — a framework CLI, a test runner, a
config-inspection tool — loads the config without the flag.

### Async config

> *"If the config needs to call async functions, it can export an async function instead. And this async function can also be passed through `defineConfig` for improved intellisense support"*

```js
export default defineConfig(async ({ command, mode }) => {
  const data = await asyncFunction()
  return { /* vite config */ }
})
```

Worth knowing because it removes the usual excuse for top-level side effects in a config file: if
something needs fetching or reading, `await` it inside the function rather than at module scope,
where it runs even for tools that only want to inspect the config.

### Config intellisense, without `defineConfig`

> *"Since Vite ships with TypeScript typings, you can leverage your IDE's intellisense with jsdoc type hints"* — `/** @type {import('vite').UserConfig} */`

and the `satisfies` form for TypeScript:

```ts
import type { UserConfig } from 'vite'
export default { /* … */ } satisfies UserConfig
```

`defineConfig` is a convenience for typing, not a requirement — but it is the only form that types
the **function** overload's arguments for you, which is why conditional configs almost always use it.

---

## 2. Real-World Engineering Scenario

**An SSR-only plugin that shipped a 400 kB server-rendering polyfill to browsers.**

A team ran SSR in production and used a plugin that injects a Node-compatibility shim. They guarded
it the natural way:

```ts
plugins: [react(), !isSsrBuild && nodeShim()].filter(Boolean),
```

Correct for `vite build` and `vite build --ssr`. Then they adopted a framework CLI that wrapped Vite
and loaded the config itself — and that wrapper did not pass `isSsrBuild`, so it arrived as
`undefined`. `!undefined` is `true`, so the shim was included in **both** builds.

Nothing failed. The client bundle simply grew by 400 kB of code that never executed, and the
regression arrived in the same release as the CLI migration, where it read as "the new tooling is
heavier".

It was found by a bundle-size budget three releases later, and the diagnosis took a day because the
config *looked* correct — the guard is the shape everyone writes. The docs had warned about exactly
this, in one sentence, in a paragraph about two optional flags.

The fix is one character short of trivial and worth writing everywhere:

```ts
plugins: [react(), isSsrBuild === false && nodeShim()].filter(Boolean),
```

Note that `=== false` and `!== true` are **not** the same choice here. `=== false` means "I was told
this is a client build"; `!== true` means "I was not told it is an SSR build", which includes the
unknown case. Which one you want depends on whether the safe default is to include or exclude — and
being forced to answer that is the point.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts — every documented constraint, applied.
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode, isSsrBuild, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // `command` is exactly 'serve' | 'build'. `vite dev` produces 'serve', not 'dev'.
  const isDev = command === 'serve';

  return {
    // ⚠️ Tri-state. `=== false` means "told it is a client build";
    //    `!== true` would also include "nobody told me". Pick deliberately.
    plugins: [
      isSsrBuild === false && clientOnlyPlugin(),
      isSsrBuild === true && serverOnlyPlugin(),
      isPreview === true && previewBannerPlugin(),
    ].filter(Boolean),

    // Dev-only options belong behind `command`, which is never undefined.
    server: isDev
      ? { port: Number(env.APP_PORT ?? 5173), proxy: { '/api': env.VITE_API_URL } }
      : undefined,

    build: { sourcemap: mode !== 'production' },
  };
});
```

```typescript
// Async config — for anything that must be fetched or read before the config exists.
// Keeping it inside the function means tools that merely inspect the config
// do not pay for it at module scope.
export default defineConfig(async ({ mode }) => {
  const remoteFlags = await fetch(`https://flags.internal/${mode}`).then((r) => r.json());
  return { define: { __FLAGS__: JSON.stringify(remoteFlags) } };
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Truthiness on `isSsrBuild` / `isPreview`

*"Some tools that load the Vite config may not support these flags and will pass `undefined`."* So
`!isSsrBuild` is `true` for both "client build" and "nobody told me". Compare against `true` and
`false` explicitly.

### ⚠️ Pitfall 2 — Assuming `command === 'dev'`

The CLI has `vite`, `vite dev` and `vite serve` as aliases, and the API value for all three is
`'serve'`. There is no `'dev'`.

### ⚠️ Pitfall 3 — Top-level side effects in the config

Anything at module scope runs whenever *anything* loads the config — a framework CLI, a test runner,
an IDE plugin, `vite --help` in some setups. Put work inside the config function, and use the async
form if it must be awaited.

---

## Gotchas

**★ Symptom: an SSR-only plugin is active in a client build.** Cause: `if (!isSsrBuild)` treats `undefined` as false, and some tools that load the config pass `undefined`. Fix: `isSsrBuild === true` / `=== false`, exactly as the docs recommend.

```ts
plugins: [isSsrBuild === false && nodeShim()].filter(Boolean),
```

**★ Symptom: a client bundle grows sharply after adopting a framework CLI, with no source change.** Cause: the wrapper does not pass `isSsrBuild`, so every truthiness-guarded SSR plugin now applies to both builds. Fix: the explicit comparison above — and a bundle-size budget in CI, because this class of regression never fails a test.

**★ Symptom: `command === 'dev'` never matches.** Cause: `vite`, `vite dev` and `vite serve` are CLI aliases that all map to the API value `'serve'`. Fix: compare against `'serve'`.

**★ Symptom: something in the config runs during an unrelated command.** Cause: a top-level side effect. The config module is evaluated by anything that wants to read the config, not only by `dev` and `build`. Fix: move it inside the config function; use the async form if it needs `await`.

**★ Symptom: `isPreview` is `undefined` during `vite preview`.** Cause: the same optionality — it is documented as an *"additional optional flag"*, and not every code path that loads the config supplies it. Fix: never let preview-only behaviour be load-bearing; treat `isPreview === true` as an enhancement and make the unknown case behave like a normal serve.

**★ Symptom: `defineConfig` was removed for "cleanliness" and the config function's arguments lost their types.** Cause: the plain-object forms (`@type` JSDoc, `satisfies UserConfig`) type an object, not the function overload. Fix: keep `defineConfig` for conditional configs; it is the only documented form that types `({ command, mode, isSsrBuild, isPreview })` for you.

---

## Interview questions

**★ Why does the documentation insist on `isSsrBuild === true` instead of truthiness?**
Because the flag is optional in a way that is invisible: *"Some tools that load the Vite config may
not support these flags and will pass `undefined` instead."* So there are three states — `true`,
`false`, and "nobody told me" — and truthiness collapses the third into the second. `if
(!isSsrBuild)` takes the client branch both when it *is* a client build and when the information is
missing, which is how an SSR-only plugin ends up in a client bundle under a wrapper tool. The
general lesson is worth stating: **an optional boolean is not a boolean**, and the moment `undefined`
is a reachable value the correct comparison is explicit.

**★ `command` has two values but the CLI has three commands. Explain.**
`vite`, `vite dev` and `vite serve` are aliases and all produce `command === 'serve'`; only
`vite build` produces `'build'`. The API is describing what Vite is *doing* — running a server or
producing an artefact — rather than which word you typed, and the alias set exists for ergonomics.
It matters because reasoning from the CLI name produces a comparison that silently never matches,
and a config branch that never runs is not an error anywhere.

**★ What is the risk of top-level code in `vite.config.ts`?**
It runs whenever anything loads the config, which is a much larger set than "dev and build" — a
framework CLI inspecting options, a test runner reusing the config, an IDE integration, a lint
plugin. A top-level `fetch`, a file write, or an expensive computation therefore executes in
contexts you never considered, sometimes repeatedly. The documented alternative is the async config
function, which is a real design affordance rather than a style preference: it gives you a place to
put work that only runs when a config is actually being built.

---

← [Config-Time Env & `loadEnv`](02-config-time-env-and-define.md) · [Vite overview](../../README.md) · Next → [How Vite Loads the Config File](02b-the-config-loader.md)
