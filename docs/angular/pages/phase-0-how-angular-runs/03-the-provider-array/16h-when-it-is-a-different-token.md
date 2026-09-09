---
title: "The third cause has no fix in your provider array at all — two `InjectionToken` instances or two copies of one class print the same name in the message, and `{self: true}` and `{optional: true}` each change what the error means"
sidebar_label: "16h · When it is a different token"
sidebar_position: 16.7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/util/stringify.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/util/stringify.ts),
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts),
> [`core/src/render3/errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The third cause is the one where every check you make confirms your mistake.** The provider is in the array, the consumer is in the right injector, the name in the error matches the name in the file — and it still throws, because the token in the error and the token in the array are two different objects that print the same string. There are two shapes: two `InjectionToken` instances constructed with the same description, and two copies of one class arriving from a duplicated package. Neither is fixed by editing a provider array. This chunk also covers the two inject options that change what an `NG0201` means when you see one, or mean you never see one at all.

### Cause 3 — it is a different token than you think

The message prints a *name*. Two different tokens with the same name are indistinguishable in
it, which is why this cause survives so long.

Two `InjectionToken` instances with the same description:

```ts
// api-config.token.ts
export const API_BASE = new InjectionToken<string>('API_BASE');

// features/reports/reports.token.ts — someone re-declared it rather than importing
export const API_BASE = new InjectionToken<string>('API_BASE');
```

Both print as `API_BASE`. One is provided; the other is injected. The error names a token you can
see in `app.config.ts`. Fix: one `const`, one module, imported everywhere —
[12e](12e-untyped-values-and-string-tokens.md) covers the doc-comment rule this violates, and
[12f](12f-string-tokens-and-the-deprecated-overload.md) the string-token variant.

```ts
// tokens.ts — the only declaration in the workspace
export const API_BASE = new InjectionToken<string>('API_BASE');
```

The duplicate-package variant is the same bug with no code of yours to blame: two copies of a
library in `node_modules` (a mismatched peer range, an npm alias, a linked workspace package)
give you two distinct `ReportStore` classes with identical `.name`. The provider registers one;
the consumer imports the other. Nothing in the message distinguishes them because `stringify`
prints `.name` and both are `ReportStore`. The check is a dependency tree, not a code read —
resolve the duplicate to a single copy and the error disappears with no source change.

### The two flags that change the answer

Both belong to Phase 6 in full; both change the *diagnosis* enough to name here.

- **`{self: true}`** (and the `@Self` decorator) short-circuits the parent chain — `r3_injector`
  sets `nextInjector` to `getNullInjector()` instead of `this.parent`. So a `self` lookup throws
  `NG0201` for a token that is provided, correctly, one level up. The tell is that the path has
  a single entry, so there is **no `Path:` clause at all**.
- **`{optional: true}`** converts the not-found value from `THROW_IF_NOT_FOUND` to `null` before
  the walk reaches `NullInjector`, so nothing is thrown and `inject()` returns `null`. If a
  dependency is silently `null` in production and you never saw an error, look for an `optional`
  you or a library added.

```ts
// self: throws even though ReportStore is provided by the parent
private readonly store = inject(ReportStore, {self: true});

// optional: never throws; be sure the null branch is real code, not an oversight
private readonly store = inject(ReportStore, {optional: true});
```

## Gotchas

**★ Symptom: `inject(X, {self: true})` throws `NG0201` for a token that is provided one level up, and the error has no `Path:`.** Cause: with the `Self` flag, `r3_injector` sets `nextInjector = getNullInjector()` instead of `this.parent`, so the walk ends immediately; the path has one entry and is suppressed. Fix: drop `self` if you wanted inheritance, or provide the token on the same injector as the consumer if you meant to require locality.

**★ Symptom: a dependency is `null` at runtime, nothing was ever logged, and you spend an hour looking for a swallowed error.** Cause: `{optional: true}` converts `notFoundValue` from `THROW_IF_NOT_FOUND` to `null` before the walk reaches `NullInjector`, so nothing is thrown. Fix: search the failing service and its libraries for `optional`. If the null branch is not real handled behaviour, remove the flag and let it throw.

**★ Symptom: the token in the message is one you can point at in `app.config.ts`.** Cause: two `InjectionToken` instances constructed with the same description — the messages print a name, and both print the same one. Fix: one declaration, exported from one module, imported everywhere ([12e](12e-untyped-values-and-string-tokens.md)). Never construct a token inside a function body or a class field.

**★ Symptom: the same class is provided and injected, and it still throws.** Cause: two copies of the package in `node_modules` — a mismatched peer range, an alias, a linked workspace — give two distinct classes with identical `.name`, and `stringify` prints `.name`. Fix: this is a dependency-tree problem, not a code problem. Deduplicate to one copy; no source change is needed once there is one class.

## Interview questions

**★ Two `InjectionToken` instances with the same description. Why is that failure so hard to see, and how would you prove it?**
Because every surface that could distinguish them prints the same string. `stringify` walks `token.overriddenName || token.name`, an `InjectionToken` has neither, so it falls through to `toString()` — which is built from the description you passed to the constructor. Two tokens constructed with `'API_BASE'` are two distinct object identities with one printed name, so the error names a token you can point at in `app.config.ts`, and everything you check confirms your belief that it is provided. Proving it does not require a debugger: identity is comparable, so import both declarations into one scratch module and compare them, or — faster in a real codebase — grep for the constructor call and count the declarations. The rule that prevents it entirely is the one Angular's own `InjectionToken` doc comment states and [12e](12e-untyped-values-and-string-tokens.md) quotes: one `const`, in one module, exported and imported everywhere. The two places it goes wrong in practice are a token constructed inside a function body or a class field — a fresh instance per call — and a token declared twice because two features wanted "the same" configuration key.

**★ From the error alone, how do you tell a `{self: true}` failure from a genuinely missing provider?**
By the absence of a `Path:` clause on a failure that is more than one level deep, and by the fact that the token is visibly provided on an ancestor. Mechanically, `R3Injector.get` chooses `const nextInjector = !(flags & InternalInjectFlags.Self) ? this.parent : getNullInjector();` — with the `Self` flag the walk skips the entire parent chain and goes straight to the end, so the failure is detected at the first injector and the path has exactly one entry. `formatErrorMessage` then suppresses the clause, because `if (path && path.length > 1)`. So a `self` failure reads as a bare `No provider found for X.` with a `Source:` and no path, for a token you can see registered one level up. The fix depends on intent: drop `self` if you wanted inheritance, or, if you meant to require that the consumer's own injector supplies it, add the provider to that injector. And do not reach for `{optional: true}` to make the error go away — that converts `notFoundValue` to `null` before the walk ends, so nothing throws, and you trade a loud failure for a `null` that shows up somewhere else entirely.

← Prev: [Not there, or not reachable](16g-not-there-or-not-reachable.md) · Index: [Topic index](README.md) · Next → [The codes next door](16i-the-codes-next-door.md)
