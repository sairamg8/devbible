---
title: "`define` Is a Textual Substitution With Oxc Semantics, Not a Value Injection"
sidebar_label: "`define`"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [`define`](https://vite.dev/config/shared-options#define), [`envPrefix`](https://vite.dev/config/shared-options#envprefix), [Env Variables and Modes](https://vite.dev/guide/env-and-mode), [Migration from v7](https://vite.dev/guide/migration). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ `define` Is a Textual Substitution, Not a Value Injection

`define` is the escape hatch for everything `import.meta.env` will not do — unprefixed variables,
non-string values, constants that are not environment variables at all. It is also the option most
likely to produce a `ReferenceError` at runtime from a config that looked perfectly reasonable,
because **it substitutes text, not values.**

---

## 1. Under-The-Hood Mechanics

### What `define` actually does

> *"Define global constant replacements. Entries will be defined as globals during dev and statically replaced during build."* — [`define`](https://vite.dev/config/shared-options#define)

Same two-implementations-one-API shape as `import.meta.env`, and the same consequences.

🔴 **The value is a source-code expression, not a JavaScript value:**

> *"Vite uses [Oxc's define feature](https://oxc.rs/docs/guide/usage/transformer/global-variable-replacement#define) to perform replacements, so value expressions must be a string that contains a JSON-serializable value (null, boolean, number, string, array, or object) or a single identifier. For non-string values, Vite will automatically convert it to a string with `JSON.stringify`."*

The docs' own example shows both halves:

```js
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify('v1.0.0'),   // → the LITERAL "v1.0.0"
    __API_URL__: 'window.__backend_api_url',     // → the IDENTIFIER, read at runtime
  },
})
```

Those two lines mean completely different things, and the difference is one `JSON.stringify`:

```
__APP_VERSION__: JSON.stringify('v1.0.0')   →  const v = "v1.0.0"      ✅ a string
__APP_VERSION__: 'v1.0.0'                   →  const v = v1.0.0        ⛔ syntax error
__API_URL__: 'window.__backend_api_url'     →  const u = window.__backend_api_url
                                                        ↑ deliberate: a runtime read
```

So a bare string is substituted as **code**. `JSON.stringify` is what turns it into a *literal*.
Omitting it produces a `ReferenceError` — or, far worse, a silent identifier read that happens to
resolve.

### 🔴 Vite 8: `define` does not share object references

From the v7→v8 [migration guide](https://vite.dev/guide/migration):

> *"`define` does not share reference for objects: When you pass an object as a value to `define`, each variable will have a separate copy of the object."*

This is a genuine behaviour change and it follows directly from textual substitution: each
occurrence is replaced with its own object literal, so each evaluates to a distinct object.

```js
define: { __CONFIG__: { retries: 3 } }
```

```js
// a.ts
__CONFIG__.retries = 5;
// b.ts
console.log(__CONFIG__.retries);   // still 3 — a different object
console.log(__CONFIG__ === __CONFIG__);   // ⛔ false: two separate literals
```

Mutating a `define`d object is now meaningless. Treat every `define` value as immutable, or —
better — do not pass objects at all.

### The other v8 renames in this area

- `esbuild.define` → `oxc.define`
- `esbuildOptions.define` → `rolldownOptions.transform.define`
- > *"`import.meta.url` is no longer polyfilled in UMD / IIFE output formats. It will be replaced with `undefined` by default."*

### `define` as the documented escape from `envPrefix`

From the `envPrefix` security callout: `''` is refused, and this is the sanctioned alternative:

> *"If you would like to expose an unprefixed variable, you can use define to expose it"*

```js
define: {
  'import.meta.env.ENV_VARIABLE': JSON.stringify(process.env.ENV_VARIABLE)
}
```

Note the key is the *whole expression* you want replaced, quoted. And note what you have done: you
stepped around the exposure gate deliberately, so the safety argument is now yours to make.

---

## 2. Real-World Engineering Scenario

**A version banner that read `1` in production and crashed the preview build.**

A team wanted the release SHA in the UI. The first attempt:

```js
define: { __BUILD_SHA__: process.env.GITHUB_SHA }
```

The SHA was `9f2c1a8…` — starting with a digit, containing letters. Substituted as code, it is not a
valid expression, and the build failed with a parse error pointing at *application* source, not at
the config. Confusing, but at least loud.

The "fix" was worse. Someone tried a short numeric build number:

```js
define: { __BUILD_NUMBER__: process.env.BUILD_NUMBER }   // "1042"
```

`1042` **is** a valid expression, so it compiled, and the banner showed `1042`. Correct by accident.
It broke the day a build number became `1042.1` — still valid JavaScript, evaluating to the number
`1042.1` — and then again when a hotfix tag `2026.09.1` was substituted as `2026.09.1`, a syntax
error with three dots.

Every one of these is the same bug: **the value was never quoted.**

```js
define: { __BUILD_SHA__: JSON.stringify(process.env.GITHUB_SHA ?? 'unknown') }
```

The `?? 'unknown'` matters too. `JSON.stringify(undefined)` returns `undefined` — the JavaScript
value, not a string — so an unset variable puts the bare identifier `undefined` into your source,
which is valid and silently wrong.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts — every define correctly quoted, and typed alongside.
import { defineConfig } from 'vite';

export default defineConfig(() => {
  // ⚠️ JSON.stringify(undefined) === undefined (the VALUE, not a string), which
  //    substitutes the bare identifier `undefined`. Always supply a fallback.
  const sha = process.env.GITHUB_SHA ?? 'dev';

  return {
    define: {
      // ✅ Literals: quoted via JSON.stringify.
      __BUILD_SHA__: JSON.stringify(sha),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __IS_CANARY__: JSON.stringify(process.env.CHANNEL === 'canary'),

      // ✅ A deliberate runtime read: a single identifier, NOT stringified.
      //    Substituted as code, evaluated in the browser.
      __BACKEND__: 'window.__backend_api_url',

      // ✅ The documented escape from envPrefix, for ONE unprefixed variable.
      'import.meta.env.ENV_VARIABLE': JSON.stringify(process.env.ENV_VARIABLE ?? ''),

      // ⛔ Vite 8: each occurrence becomes a SEPARATE copy of this object.
      //    Mutation does not propagate and `===` is false. Do not do this.
      // __CONFIG__: { retries: 3 },
    },
  };
});
```

```typescript
// src/vite-env.d.ts — the docs' note: "make sure to add the type declarations
// in the vite-env.d.ts file to get type checks and Intellisense."
declare const __BUILD_SHA__: string;
declare const __BUILD_TIME__: string;
declare const __IS_CANARY__: boolean;
declare const __BACKEND__: string;
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Forgetting `JSON.stringify`

```js
// ⛔ substituted as CODE. Either a syntax error, or — worse — a valid identifier
//    that resolves to something unrelated, or a number that is right by accident.
define: { __VERSION__: process.env.VERSION }

// ✅
define: { __VERSION__: JSON.stringify(process.env.VERSION ?? 'unknown') }
```

### ⚠️ Pitfall 2 — `JSON.stringify(undefined)`

It returns `undefined`, not `"undefined"` and not `'null'`. The substituted text is then the bare
identifier `undefined`, which is valid JavaScript and silently wrong. Always `?? 'fallback'`.

### ⚠️ Pitfall 3 — Objects in `define` on Vite 8

> *"each variable will have a separate copy of the object."*

Identity comparisons fail, mutations do not propagate, and every occurrence inflates the bundle by a
full copy of the literal. If a structured constant is genuinely needed, `define` a JSON **string**
and parse it once at a module boundary.

### ⚠️ Pitfall 4 — Using `define` where `import.meta.env` would do

`define` bypasses the prefix filter, has no naming convention, and is invisible to the `VITE_` audit
in [chunk 1b](01b-the-vite-prefix-and-secrets.md). Reach for it when you genuinely need a non-string
constant, an unprefixed variable, or a runtime identifier — not as a general-purpose config channel.

---

## Gotchas

**★ Symptom: a build fails with a parse error pointing at application source you did not change.** Cause: a `define` value was substituted as code — an unquoted SHA, tag or version. Fix: wrap it in `JSON.stringify`.

```js
define: { __BUILD_SHA__: JSON.stringify(process.env.GITHUB_SHA ?? 'dev') }
```

**★ Symptom: a `define`d number is correct until the value gains a dot or a letter.** Cause: it was never quoted; it only worked because a bare integer happens to be a valid expression. Fix: same one. "It works" is not evidence a `define` is quoted — only the quoting is.

**★ Symptom: a `define`d constant is the value `undefined` at runtime with no error.** Cause: `JSON.stringify(undefined)` returns `undefined`, so the bare identifier was substituted. Fix: `?? 'fallback'` before stringifying, and declare the constant in `vite-env.d.ts` so a missing one is a type error too.

**★ Symptom: mutating a `define`d object has no effect elsewhere, and `x === x` is false.** Cause: Vite 8 — *"each variable will have a separate copy of the object."* Fix: treat `define` values as immutable; `define` a JSON string and `JSON.parse` it once if you need a real shared object.

```js
define: { __CONFIG__: JSON.stringify(JSON.stringify({ retries: 3 })) }
// then: const config = JSON.parse(__CONFIG__);   // one object, module-scoped
```

**★ Symptom: after upgrading to Vite 8, an `esbuild.define` option is ignored.** Cause: it was renamed — `esbuild.define` → `oxc.define`, and `esbuildOptions.define` → `rolldownOptions.transform.define`. Fix: rename it. Options whose *name contains a tool* are the ones most likely to have moved in v8.

**★ Symptom: `import.meta.url` is `undefined` in a UMD or IIFE build after upgrading.** Cause: *"`import.meta.url` is no longer polyfilled in UMD / IIFE output formats. It will be replaced with `undefined` by default."* Fix: the migration guide points at `define` plus `build.rolldownOptions.output.intro`; ⚠️ I did not read that option's shape in this pass, so follow the link rather than trusting a reconstruction.

**★ Symptom: a secret reaches the bundle and the `VITE_` audit was clean.** Cause: it went through `define`, which bypasses the prefix filter entirely and uses no naming convention. Fix: audit `define`'s keys as deliberately as `.env` keys — and prefer secret-*shape* greps over key-name greps, since `define` names are arbitrary.

---

## Interview questions

**★ Why does `define` need `JSON.stringify` when `import.meta.env` does not?**
Because `define` takes a **source-code expression**, not a value. The docs are explicit: *"value
expressions must be a string that contains a JSON-serializable value … or a single identifier."* So
`__VERSION__: 'v1.0.0'` substitutes the *code* `v1.0.0`, which is a syntax error, while
`JSON.stringify('v1.0.0')` substitutes `"v1.0.0"`, a string literal. This is a feature rather than a
wart — the identifier form is how you write `__API_URL__: 'window.__backend_api_url'` and get a
genuine runtime read. `import.meta.env` needs no equivalent because it only ever handles strings from
`.env`, so there is no ambiguity to resolve.

**★ What changed about `define` in Vite 8, and why does it follow from the design?**
*"`define` does not share reference for objects: When you pass an object as a value to `define`,
each variable will have a separate copy of the object."* It follows directly from textual
substitution: every occurrence is replaced with its own object literal, so every occurrence
evaluates to a distinct object. Identity comparisons fail, mutations do not propagate, and the
bundle carries one copy per use site. The correct reading is not "Vite 8 broke objects" but "objects
were never really shared and now the documentation says so" — the safe pattern is to treat every
`define` value as immutable, or to define a JSON string and parse it once.

**★ When is `define` the right tool rather than a `VITE_` variable?**
Three cases. A non-string constant, since env values are always strings. A single unprefixed
variable, which is the documented escape from `envPrefix` — `''` is refused precisely because it
would expose everything, and `define` narrows it to one key. And a deliberate runtime identifier
read, the `'window.__backend_api_url'` form, which has no `import.meta.env` equivalent at all.
Outside those, prefer the env variable: `define` bypasses the prefix filter, uses arbitrary names,
and is therefore invisible to the `VITE_*` audit that is your main defence against a leak.

---

← [The Config Loader](02b-the-config-loader.md) · [Vite overview](../../README.md) · Next → [HTML `%VAR%` Replacement](02d-html-constant-replacement.md)
