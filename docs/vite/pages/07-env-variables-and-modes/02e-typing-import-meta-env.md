---
title: "Typing `import.meta.env`: the Augmentation That Silently Stops Working"
sidebar_label: "Typing `import.meta.env`"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Env Variables and Modes § IntelliSense for TypeScript](https://vite.dev/guide/env-and-mode), [`define`](https://vite.dev/config/shared-options#define). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Typing `import.meta.env`: the Augmentation That Silently Stops Working

Two failures live here, and they are opposite. The first is an augmentation that stops applying
because of a single `import` statement — noisy, obvious, and documented. The second is an
augmentation that works perfectly and **tells you a lie**, because a `.d.ts` file describes what you
intended and the build substitutes what was actually on disk.

---

## 1. Under-The-Hood Mechanics

### The baseline

> *"By default, Vite provides type definitions for `import.meta.env` in `vite/client.d.ts`."*

That covers the five built-ins. Your own `VITE_*` variables are unknown to TypeScript until you say
otherwise:

> *"While you can define more custom env variables in `.env.[mode]` files, you may want to get TypeScript IntelliSense for user-defined env variables that are prefixed with `VITE_`. To achieve this, you can create an `vite-env.d.ts` in `src` directory, then augment `ImportMetaEnv`"*

```ts
// vite-env.d.ts
interface ViteTypeOptions {
  // By adding this line, you can make the type of ImportMetaEnv strict
  // to disallow unknown keys.
  // strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

### `strictImportMetaEnv` — opt-in exhaustiveness

The commented line in the docs' own snippet is the interesting part. By default the augmented
interface is *permissive*: `import.meta.env.VITE_TYPO` type-checks as whatever the index signature
allows. Uncommenting `strictImportMetaEnv: unknown` inside `ViteTypeOptions` makes the type strict
so unknown keys are rejected — turning a class of silent `undefined` into a compile error.

🔴 **This is off by default and almost nobody turns it on.** It is the single highest-value line in
this chunk: it converts the most common env bug — a mistyped key — from a runtime `undefined` into a
build failure.

### The augmentation that silently stops working

> *"If the `ImportMetaEnv` augmentation does not work, make sure you do not have any import statements in `vite-env.d.ts`."*

This is TypeScript's module rule, not a Vite quirk. A `.d.ts` with **no** top-level `import` or
`export` is a *global script*, and its `interface` declarations merge with the global ones. Add one
`import` and the file becomes a *module*; its interfaces are now module-scoped and merge with
nothing.

```ts
// ❌ ONE import turns this file into a module. The augmentation stops applying,
//    with no error — every VITE_* key silently reverts to the base type.
import type { Foo } from './foo';

interface ImportMetaEnv { readonly VITE_API_URL: string }
```

```ts
// ✅ Need a type from elsewhere? Use an inline import, which does not
//    make the file a module.
interface ImportMetaEnv {
  readonly VITE_TIER: import('./types').Tier;
}
```

The failure has no error message. It presents as "IntelliSense stopped working", and it is usually
introduced by an unrelated refactor.

### `lib`, for non-DOM environments

> *"If your code relies on types from browser environments such as DOM and WebWorker, you can update the `lib` field in `tsconfig.json`."*

```json
{ "lib": ["WebWorker"] }
```

### Typing `define`d constants

`define` values are not part of `import.meta.env`, so they need their own declarations:

> *"For TypeScript users, make sure to add the type declarations in the `vite-env.d.ts` file to get type checks and Intellisense."* — [`define`](https://vite.dev/config/shared-options#define)

```ts
// vite-env.d.ts
declare const __APP_VERSION__: string
```

---

## 2. Real-World Engineering Scenario

**An `import` in a `.d.ts`, and forty type errors that were all real.**

A team added a shared `Tier` union and, tidying up, imported it at the top of `src/vite-env.d.ts` to
type `VITE_TIER`. Everything compiled. Nobody noticed that the same commit had turned the file into
a module and disabled the whole `ImportMetaEnv` augmentation.

For six weeks `import.meta.env.VITE_API_URL` and its siblings type-checked as the permissive base
type. Nothing failed — the code was already correct — so the loss of type safety was invisible.

It surfaced when someone enabled `strictImportMetaEnv` and got **forty** errors. Every one was real:
three genuine typos that had been silently `undefined` in a rarely-hit branch, and thirty-seven keys
the augmentation should have been narrowing and was not.

Two lessons, and the second is the general one:

- The fix was replacing the top-level import with an inline `import('./types').Tier`.
- **A type-safety regression produces no error.** Nothing fails when types get weaker; you simply
  stop being told about bugs. That is why the strict flag is worth turning on early — it converts an
  invisible regression into a visible one.

---

## 3. Production-Grade Code Example

```typescript
// src/vite-env.d.ts
// 🔴 NO top-level import/export in this file — one turns it into a module and
//    silently disables every augmentation below it.
/// <reference types="vite/client" />

interface ViteTypeOptions {
  // Reject unknown keys. Turns a mistyped VITE_* from a runtime `undefined`
  // into a compile error. Off by default; turn it on on day one.
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_TITLE: string;
  readonly VITE_ANALYTICS_ENABLED: string;   // env values are ALWAYS strings
  // Inline import — does NOT make this file a module.
  readonly VITE_TIER: import('./types').Tier;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// `define` constants are NOT part of import.meta.env and need their own declarations.
declare const __APP_VERSION__: string;
declare const __BUILD_SHA__: string;
```

```typescript
// src/config/env.ts — where the REAL types come from.
// The .d.ts describes intent; this file establishes fact.
const required = (v: string | undefined, name: string): string => {
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
};

export const env = {
  // `required` narrows string | undefined → string by THROWING, so the type
  // below is earned rather than asserted.
  apiUrl: required(import.meta.env.VITE_API_URL, 'VITE_API_URL'),
  title: import.meta.env.VITE_APP_TITLE ?? 'Acme',
  analytics: import.meta.env.VITE_ANALYTICS_ENABLED === 'true',
  tier: import.meta.env.VITE_TIER,
} as const;
```

```json
// tsconfig.json — `lib` for non-DOM targets, per the docs.
{ "compilerOptions": { "lib": ["WebWorker", "ES2023"] } }
```

```bash
# The check the type system cannot do: does the .env file define what the
# .d.ts claims? Runs in CI, comparing declaration to reality.
- run: |
    declared=$(grep -oE 'VITE_[A-Z0-9_]+' src/vite-env.d.ts | sort -u)
    defined=$(cat .env .env.production 2>/dev/null | grep -oE '^VITE_[A-Z0-9_]+' | sort -u)
    missing=$(comm -23 <(echo "$declared") <(echo "$defined"))
    [ -z "$missing" ] || { echo "::error::declared but never defined:"; echo "$missing"; exit 1; }
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — A top-level `import` in `vite-env.d.ts`

One import turns the file into a module and silently disables every augmentation in it. Use inline
`import('...')` types instead. There is no error message for this.

### ⚠️ Pitfall 2 — Leaving `strictImportMetaEnv` commented out

The docs ship it commented. Leaving it that way means a mistyped key type-checks and is `undefined`
at runtime — the most common env bug in the whole topic, left un-caught by the one line that catches
it.

### ⚠️ Pitfall 3 — Deleting the `/// <reference types="vite/client" />` line

It is what pulls in the built-in constants and Vite's client-side module declarations. Removing it
during a tidy-up produces a cascade of unrelated-looking errors about `import.meta.env` and asset
imports.

---

## Gotchas

**★ Symptom: `import.meta.env` IntelliSense stopped working after an unrelated refactor.** Cause: a top-level `import` was added to `vite-env.d.ts`, turning it from a global script into a module — *"make sure you do not have any import statements in `vite-env.d.ts`."* Fix: use an inline import type.

```ts
readonly VITE_TIER: import('./types').Tier;   // ✅ not a top-level import
```

**★ Symptom: a mistyped `import.meta.env.VITE_TYPOO` compiles cleanly.** Cause: the augmented interface is permissive by default. Fix: uncomment `strictImportMetaEnv: unknown` in `ViteTypeOptions`. Expect a batch of real errors the first time — that is the flag doing its job.

**★ Symptom: enabling `strictImportMetaEnv` produces dozens of errors at once.** Cause: either genuine typos, or an augmentation that had silently stopped applying. Fix: read them; both causes are real bugs. This is the documented way to discover that your `.d.ts` became a module.

**★ Symptom: `__APP_VERSION__` is not defined in TypeScript although the `define` is in the config.** Cause: `define` adds globals, not `import.meta.env` properties, and needs its own `declare const`. Fix: add it to `vite-env.d.ts`, as the `define` docs instruct.

**★ Symptom: DOM types are missing in a worker or SSR-only package.** Cause: `lib` does not include the environment. Fix: *"you can update the `lib` field in `tsconfig.json`"* — e.g. `"lib": ["WebWorker"]`.

**★ Symptom: `import.meta.env` errors after removing a `/// <reference types="vite/client" />` line.** Cause: that reference supplies the built-in constant types and Vite's asset-module declarations. Fix: restore it; it is not redundant with the interface augmentation, which only adds your keys.

---

## Interview questions

**★ Why does adding one `import` to `vite-env.d.ts` break every type in it?**
Because it changes the file's kind. A `.d.ts` with no top-level `import` or `export` is a **global
script**, and its `interface` declarations participate in global declaration merging — which is
exactly what augmenting `ImportMetaEnv` requires. One top-level import makes it a **module**, its
interfaces become module-scoped, and they merge with nothing. The docs call this out directly. What
makes it dangerous is that there is no error: the augmentation stops applying, types get weaker, and
weaker types never fail a build. The fix is inline `import('./types').Tier`, which references a
module without making the file one.

**★ What does `strictImportMetaEnv` do, and why is it off by default?**
It makes the augmented `ImportMetaEnv` reject unknown keys, so `import.meta.env.VITE_TYPOO` is a
compile error rather than a permissive `undefined`. It is off by default because turning it on is
breaking for any project that reads keys it has not declared — which is most projects, including
ones reading a dependency's variables. That is a reasonable default for a tool and a bad default for
your project: it converts the single most common env bug from a runtime `undefined` into a build
failure, and the migration cost is a one-time batch of errors that are, in my experience of this
pattern, mostly real.

---

← [HTML `%VAR%` Replacement](02d-html-constant-replacement.md) · [Vite overview](../../README.md) · Next → [Types That Lie About Runtime](02f-types-that-lie-about-runtime.md)
