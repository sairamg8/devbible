---
title: "`isNotFound` from `@angular/core/primitives/di` is the supported way to recognise a missing provider — while `RuntimeErrorCode`, marked `// @public` in a golden, is not importable at all, and the code on the error object is `-201` rather than `201`"
sidebar_label: "16d · Catching it in code"
sidebar_position: 16.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/primitives/di/src/not_found.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/primitives/di/src/not_found.ts) (entire file, verbatim),
> the `core` and `core/primitives/di` public-API goldens, and the `exports` map of
> [`@angular/core@22.1.5`](https://registry.npmjs.org/@angular/core/22.1.5) read from the npm registry.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**If you catch DI failures in code, three of the four obvious ways to recognise one are wrong at `v22.1.5`.** `e.name === 'NullInjectorError'` has not matched since the v20 line. `e.code === 201` never matches, because the framework stores the raw enum member and `PROVIDER_NOT_FOUND` is `-201` — negative on purpose. And `import {RuntimeErrorCode} from '@angular/core/errors'` does not resolve, despite a golden in the repository marking the enum `// @public`, because the published package has no such subpath. The one that works is a real, published, documented type guard in a subpath most people have never opened.

## `isNotFound` is the supported check, and it is a published entry point

The comment in `null_injector.ts` — *"This is the name used by the primitives to identify a not
found error"* — points at a real, public helper. Verbatim, the whole of
[`packages/core/primitives/di/src/not_found.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/primitives/di/src/not_found.ts)
at `v22.1.5`:

```ts
/**
 * Value returned if the key-value pair couldn't be found in the context
 * hierarchy.
 */
export const NOT_FOUND: unique symbol = Symbol('NotFound');

/**
 * Error thrown when the key-value pair couldn't be found in the context
 * hierarchy. Context can be attached below.
 */
export class NotFoundError extends Error {
  override readonly name: string = 'ɵNotFound';
  constructor(message: string) {
    super(message);
  }
}

/**
 * Type guard for checking if an unknown value is a NotFound.
 */
export function isNotFound(e: unknown): e is NotFound {
  return e === NOT_FOUND || (e as NotFoundError)?.name === 'ɵNotFound';
}

/**
 * Type union of NotFound and NotFoundError.
 */
export type NotFound = typeof NOT_FOUND | NotFoundError;
```

`isNotFound` checks exactly the property `NullInjector` sets. That is not a coincidence and it
is not internal-only: `@angular/core/primitives/di` is a real subpath in the published package's
`exports` map at `22.1.5` —

```json
"./primitives/di": {
  "types": "./types/primitives-di.d.ts",
  "default": "./fesm2022/primitives-di.mjs"
}
```

— and `isNotFound`, `NOT_FOUND`, `NotFound` and `NotFoundError` all carry `// @public` in
`goldens/public-api/core/primitives/di/index.api.md`. So the fix for a broken `catch` is a
one-line import:

```ts
import {isNotFound} from '@angular/core/primitives/di';

export function loadFeature(injector: Injector, token: ProviderToken<unknown>) {
  try {
    return injector.get(token);
  } catch (e: unknown) {
    if (isNotFound(e)) {
      return null;                       // the feature is simply not configured
    }
    throw e;                             // anything else is a real failure
  }
}
```

⚠️ **`isNotFound` is a name check, and the name is a `ɵ`-prefixed internal string.** The helper
is public; the constant it compares against is not. Prefer `isNotFound` over writing
`e.name === 'ɵNotFound'` yourself, precisely so that a future rename costs you nothing.

## `@angular/core/errors` exists in the repo and is not shipped

This one catches people who read the goldens. There **is** a file
`goldens/public-api/core/errors.api.md` at `v22.1.5`, headed *"API Report File for
`core_errors`"*, and it marks four things `// @public`:

```ts
// @public
export function formatRuntimeError<T extends number = RuntimeErrorCode>(code: T, message: null | false | string): string;

// @public (undocumented)
export function formatRuntimeErrorCode<T extends number = RuntimeErrorCode>(code: T): string;

// @public
export class RuntimeError<T extends number = RuntimeErrorCode> extends Error {
    constructor(code: T, message: null | false | string);
    // (undocumented)
    code: T;
}

// @public
export const enum RuntimeErrorCode { /* … */ }
```

🔴 **None of it is importable.** The `exports` map of `@angular/core@22.1.5` has exactly seven
subpaths — `.`, `./testing`, `./package.json`, `./rxjs-interop`, `./schematics/*`,
`./primitives/di`, `./primitives/signals`, `./primitives/event-dispatch`, plus the
`event-dispatch-contract.min.js` file — and **`./errors` is not among them**. Nor is
`RuntimeError` re-exported from the root: the `@angular/core` index golden contains the string
`RuntimeError` zero times.

This is the trap §0.6 of this topic's research warns about in general form, made concrete: the
golden's `// @public` is **API-Extractor's release tag**, describing how the symbol is annotated
in source. It is not a statement that the package exports it. Never read a golden as an import
list.

So: **do not write `import {RuntimeErrorCode} from '@angular/core/errors'`.** It will not
resolve. If you need the numeric code, read it off the error object — the property is there
regardless of whether the type is importable:

```ts
// pseudo-code for the type only; `RuntimeError` is not importable
function isProviderNotFound(e: unknown): boolean {
  return (e as {code?: number} | null)?.code === -201;
}
```

🔴 **And note the value: `-201`, not `201`, and certainly not the string `'NG0201'`.**
`RuntimeError`'s constructor stores the raw enum member, and `PROVIDER_NOT_FOUND = -201` is
negative because it has a guide page. `Math.abs` is applied only when rendering the text. A
comparison against `201` silently never matches.

## Gotchas

**★ Symptom: `catch (e) { if (e.name === 'NullInjectorError') … }` silently stopped taking its branch.** Cause: `error.name` is now `'ɵNotFound'`, set explicitly by `NullInjector`. Fix: use the published type guard rather than the string —

```ts
import {isNotFound} from '@angular/core/primitives/di';

try {
  return injector.get(FEATURE_CONFIG);
} catch (e: unknown) {
  if (isNotFound(e)) return null;
  throw e;
}
```

**★ Symptom: `isNotFound(e)` is `true` in `ng serve` and `false` in the deployed build.** Cause: read the `r3_injector` catch — the production branch is `throw new RuntimeError(errorCode, null)`, a *new* error object. It never has `name` set to `ɵNotFound`, so the guard cannot recognise it. ⚠️ This is a reading of the two quoted sources, not a documented behaviour; I found no Angular documentation stating it. Fix: if the branch must work in production, test the code as well —

```ts
import {isNotFound} from '@angular/core/primitives/di';

function isProviderMissing(e: unknown): boolean {
  return isNotFound(e) || (e as {code?: number} | null)?.code === -201;
}
```

**★ Symptom: `if (error.code === 201)` never matches.** Cause: `RuntimeError` stores the raw enum member and `PROVIDER_NOT_FOUND = -201`. The minus sign is the "has a guide page" marker, and `formatRuntimeErrorCode` applies `Math.abs` only when rendering the text. Fix: compare against `-201`. Every code you see rendered as `NG02xx` with a guide page is negative on the object.

**★ Symptom: `import {RuntimeErrorCode} from '@angular/core/errors'` fails to resolve.** Cause: `goldens/public-api/core/errors.api.md` exists and marks the enum `// @public`, but the published package's `exports` map has no `./errors` subpath, and the root index golden contains `RuntimeError` zero times. A golden is an API-Extractor report, not an import list. Fix: hard-code the numeric literal with a comment, or check `isNotFound` instead. There is no supported import for the enum.

## Interview questions

**★ How would you detect "the provider is missing" in code, in a way that survives an Angular upgrade?**
Import `isNotFound` from `@angular/core/primitives/di` — a real subpath in the published `exports` map, with `// @public` on the symbol in the primitives golden — and use it as a type guard in the `catch`. Do not compare `error.name` to `'ɵNotFound'` yourself: the helper exists precisely so the `ɵ`-prefixed internal string can change without breaking you. Do not compare against `'NullInjectorError'`, which has not matched since the v20 line. And do not try `import {RuntimeErrorCode} from '@angular/core/errors'`: the golden for it exists in the repository and marks the enum `// @public`, but the published package has no `./errors` subpath and the root index does not re-export `RuntimeError`. If you need the raw code, read `error.code` off the object and compare it to `-201` — negative, because the sign is the framework's marker for "this code has a guide page" and `Math.abs` is applied only at render time. The honest caveat is that `isNotFound` is true in development and false in production for the same failure, because the production branch throws a fresh `RuntimeError` with no `name` set; if the branch must work in both, test the code as well as the guard.

**★ A symbol is marked `// @public` in a file under `goldens/public-api/`. Can you import it?**
Not necessarily, and `RuntimeErrorCode` is the case that proves it. `// @public` is an **API-Extractor release tag**: it records how the symbol is annotated where it is declared, and API-Extractor generates one report per *entry point it is pointed at*, whether or not that entry point is published. `goldens/public-api/core/errors.api.md` exists at `v22.1.5`, is headed *"API Report File for `core_errors`"*, and marks `RuntimeError`, `RuntimeErrorCode`, `formatRuntimeError` and `formatRuntimeErrorCode` public. None of them is reachable: the `exports` map of `@angular/core@22.1.5` has no `./errors` subpath, and the root index golden does not contain the string `RuntimeError` at all. The check that actually answers the question is the package's `exports` map, not the golden — and the same caution applies in the other direction within this topic: `provideCheckNoChangesConfig` is `// @public` in the core golden while its own JSDoc says `@developerPreview`, which is why [12h](12h-experimental-preview-and-dev-only.md) treats the JSDoc as authoritative. A golden tells you how a symbol is annotated. It never tells you that you can import it, and it never tells you it is stable.

← Prev: [What production tells you](16c-what-a-production-build-tells-you.md) · Index: [Topic index](README.md) · Next → [The two message shapes](16e-the-two-message-shapes.md)
