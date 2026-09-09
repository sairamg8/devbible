---
title: "Half the diagnostic value of `NG0201` is knowing when your error is `NG0200`, `NG0203` or `NG0205` instead — one shares its catch block, one names a token without being about providers, and one is thrown before the lookup even starts"
sidebar_label: "16i · The codes next door"
sidebar_position: 16.8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts) (the `RuntimeErrorCode` enum and its range comment),
> [`core/src/render3/errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts),
> [`core/src/di/injector_compatibility.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/injector_compatibility.ts),
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts) — all quoted verbatim.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Three codes are routinely mistaken for a missing provider, and each of them sends you somewhere `NG0201`'s fix cannot help.** `NG0200` shares the same catch block, the same path assembly and the same layout, so a circular dependency and a missing provider are nearly indistinguishable at a glance. `NG0203` names a token in its message despite having nothing to do with providers — it means `inject()` ran where no injector was current. And `NG0205` is thrown by the first statement of `R3Injector.get()`, before the record lookup, so a destroyed injector never gets far enough to have an opinion about whether the token exists. The chunk opens with the full map of the DI codes and the package ranges that tell you, from the digits alone, whether an error is `core`'s at all.

## The codes next door

Half of the diagnostic value of `NG0201` is knowing when the error you have is *not* `NG0201`.
Every code below sits in `core`'s reserved range — the enum's header comment says *"Reserved
error code range: 100-999"*, and lists the per-package ranges: *"forms: 1000-1999 / common:
2000-2999 / animations: 3000-3999 / router: 4000-4999 / platform-browser: 5000-5500 /
service-worker: 5600-5699 / platform-server: 5700-5800"*. A four-digit `NG` code is never a
`core` DI error.

| Code | Enum member | What it means | Where it is quoted |
|---|---|---|---|
| **NG0200** | `CYCLIC_DI_DEPENDENCY = -200` | `` Circular dependency detected for `X`. `` | below |
| **NG0201** | `PROVIDER_NOT_FOUND = -201` | two message shapes | [16](16-the-injector-error-surface.md), [16e](16e-the-two-message-shapes.md) |
| **NG0203** | `MISSING_INJECTION_CONTEXT = -203` | `inject()` called outside an injection context | below |
| **NG0205** | `INJECTOR_ALREADY_DESTROYED = -205` | `Injector has already been destroyed.` | below |
| **NG0207** | `PROVIDER_IN_WRONG_CONTEXT = -207` | `EnvironmentProviders` in a component | [03](03-environmentproviders-vs-provider.md), below |
| **NG0209** | `INVALID_MULTI_PROVIDER = -209` | a non-`multi` entry on a `multi` token | [13b](13b-mixing-multi-and-non-multi.md) |
| **NG0402** | `MISSING_REQUIRED_INJECTABLE_IN_BOOTSTRAP = 402` | a required injectable missing at bootstrap | [06g](06g-error-handler-and-ng0402.md) |
| **NG0405** | `ASYNC_INITIALIZERS_STILL_RUNNING = 405` | bootstrap raced an async initializer | [06b](06b-initializer-ordering-and-failure.md) |
| *(none)* | — | `Cannot mix multi providers and regular providers` | [13b](13b-mixing-multi-and-non-multi.md), below |
| *(none)* | — | `Invalid provider` | below |

### NG0200 — the circular dependency that arrives through the same door

`CYCLIC_DI_DEPENDENCY = -200` is the **only other code** the `r3_injector` catch block handles.
Look at the condition again: `errorCode === RuntimeErrorCode.CYCLIC_DI_DEPENDENCY || errorCode
=== RuntimeErrorCode.PROVIDER_NOT_FOUND`. Both get `prependTokenToDependencyPath`, both get
`augmentRuntimeError`, both come out with a `Path:` and a `Source:`. Verbatim:

```ts
/** Creates a circular dependency runtime error. */
export function cyclicDependencyError(token: string, path?: string[]): Error {
  const message = ngDevMode ? `Circular dependency detected for \`${token}\`.` : '';
  return createRuntimeError(message, RuntimeErrorCode.CYCLIC_DI_DEPENDENCY, path);
}

/** Creates a circular dependency runtime error including a dependency path in the error message. */
export function cyclicDependencyErrorWithDetails(token: string, path: string[]): Error {
  return augmentRuntimeError(cyclicDependencyError(token, path), null);
}
```

Two consequences. First, an `NG0200` and an `NG0201` **look almost identical** in a console: same
shape, same `Path:` clause, same `Find more at` suffix. Read the code, not the layout. Second,
`cyclicDependencyErrorWithDetails` passes `null` for `source`, so an `NG0200` produced that way
has a `Path:` and **no `Source:`** — which is itself a way to tell the two producers apart.

The fix for a cycle is never a provider change; it is a design change. Break it with a
`Provider` boundary rather than by injecting lazily out of habit:

```ts
// before: Orders needs Billing, Billing needs Orders — NG0200
@Service({providedIn: 'root'})
export class Orders {
  private readonly billing = inject(Billing);
}
@Service({providedIn: 'root'})
export class Billing {
  private readonly orders = inject(Orders);
}

// after: the shared state moves to a third service both depend on, and neither depends on the other
@Service({providedIn: 'root'})
export class Ledger {
  readonly entries = signal<Entry[]>([]);
}
@Service({providedIn: 'root'})
export class Orders {
  private readonly ledger = inject(Ledger);
}
@Service({providedIn: 'root'})
export class Billing {
  private readonly ledger = inject(Ledger);
}
```

### NG0203 — the one that is not about providers at all

`MISSING_INJECTION_CONTEXT = -203` is thrown before any walk begins, from
`injectInjectorOnly` — the `currentInjector === undefined` branch quoted in
[16e](16e-the-two-message-shapes.md). Its message, verbatim:

> *"The `${stringify(token)}` token injection failed. `inject()` function must be called from an injection context such as a constructor, a factory function, a field initializer, or a function used with `runInInjectionContext`."*

🔴 **It names the token, which is why people misread it as a missing provider.** It is not. The
provider may be perfectly registered; you called `inject()` from a place where no injector is
current — inside a `setTimeout`, a promise callback, an event handler, a method body rather than
a field initializer. The fix is to move the call, or to carry the context:

```ts
// ✗ NG0203 — inject() in a method, long after construction
export class Uploader {
  start() {
    const http = inject(HttpClient);
  }
}

// ✓ field initializer — runs inside the injection context
export class Uploader {
  private readonly http = inject(HttpClient);
  start() { /* use this.http */ }
}

// ✓ or carry the context explicitly where a field will not do
export class Uploader {
  private readonly injector = inject(Injector);
  start() {
    runInInjectionContext(this.injector, () => {
      const http = inject(HttpClient);
    });
  }
}
```

### NG0205 — the injector that was destroyed

`assertNotDestroyed` runs at the very top of `R3Injector.get()`, before anything else. Verbatim:

```ts
export function assertNotDestroyed(injector: R3Injector): void {
  if (injector.destroyed) {
    throw new RuntimeError(
      RuntimeErrorCode.INJECTOR_ALREADY_DESTROYED,
      ngDevMode && 'Injector has already been destroyed.',
    );
  }
}
```

Because it precedes the lookup, a destroyed injector produces `NG0205` and **never** `NG0201`,
regardless of whether the token was provided. That is the exact failure
[15e](15e-the-injector-that-is-never-destroyed.md) describes from the other side: with route
injector destruction enabled, a stale reference to a torn-down route's injector fails here.
`ngDevMode &&` on the message means production gives you a bare `NG0205`, the same way it gives
you a bare `NG0201`.

## Gotchas

**★ Symptom: `NG0203` and you start adding providers.** Cause: `MISSING_INJECTION_CONTEXT` is thrown by `injectInjectorOnly` before any injector is consulted, and its message names the token, which reads like a missing provider. Fix: move the `inject()` call to a field initializer or constructor, or wrap it in `runInInjectionContext(this.injector, …)`.

**★ Symptom: `NG0205: Injector has already been destroyed.` where you expected `NG0201`.** Cause: `assertNotDestroyed` runs at the top of `R3Injector.get()`, before the record lookup, so a destroyed injector never gets as far as deciding whether the token exists. Fix: stop holding the reference. With route injector destruction enabled ([15e](15e-the-injector-that-is-never-destroyed.md)) this is what a leaked `EnvironmentInjector` from a torn-down route looks like.

**★ Symptom: `NG0200` and `NG0201` look identical in a console.** Cause: they are the only two codes the `r3_injector` catch handles, and they share `prependTokenToDependencyPath` and `augmentRuntimeError` — same `Path:`, same `Source:`, same `Find more at` suffix. Fix: read the code, and read the verb: `Circular dependency detected for` versus `No provider found for`. An `NG0200` from `cyclicDependencyErrorWithDetails` also passes `null` for `source`, so it has a `Path:` and no `Source:`.

**★ Symptom: an `NG` code in the 2000s or 5000s and you are reading the `core` DI guide.** Cause: the ranges are partitioned and `core` owns only `100-999`. Fix: read the enum header — *"forms: 1000-1999 / common: 2000-2999 / animations: 3000-3999 / router: 4000-4999 / platform-browser: 5000-5500 / service-worker: 5600-5699 / platform-server: 5700-5800"*. A four-digit code is never a `core` DI failure; `NG2801`, for instance, is the HTTP package telling you the fetch backend is not in use on the server ([09d](09d-withxhr-on-the-server-and-httpclientmodule.md)).

## Interview questions

**★ What is the difference between `NG0201` and `NG0203`, given that both name a token?**
`NG0201` means a walk happened and ended without a record. `NG0203` means no walk happened at all — `injectInjectorOnly` found `getCurrentInjector()` to be `undefined` and threw before consulting anything, with the message *"The `X` token injection failed. `inject()` function must be called from an injection context such as a constructor, a factory function, a field initializer, or a function used with `runInInjectionContext`."* Because it names the token, people read it as a provider problem and start editing `app.config.ts`, which cannot help. The cause is placement: `inject()` inside a method body, a `setTimeout`, a promise callback or an event handler, rather than in a field initializer or constructor. The fix is either to move the call, or to capture an `Injector` and wrap the call in `runInInjectionContext`.

**★ Why does a destroyed injector give you `NG0205` rather than `NG0201`?**
Because `assertNotDestroyed(this)` is the first statement of `R3Injector.get()`, before the record lookup, before the scope check, before the parent walk. A destroyed injector therefore never reaches the point where it could decide whether the token exists — the answer is `Injector has already been destroyed.` regardless of what is provided. In practice this is the signature of a leaked reference to a torn-down route injector, which is exactly the failure mode route injector destruction introduces and which [15e](15e-the-injector-that-is-never-destroyed.md) covers. Note also the `ngDevMode &&` on the message: in production you get a bare `NG0205`, with the same total absence of context as a bare `NG0201`.

**★ Why is `NG0200` handled by the same catch block as `NG0201`, and how do you tell them apart?**
Because both are failures discovered at the bottom of a resolution chain whose useful information is the chain itself, so they share the path-assembly machinery: the condition is `errorCode === CYCLIC_DI_DEPENDENCY || errorCode === PROVIDER_NOT_FOUND`, and both get `prependTokenToDependencyPath` on the way out and `augmentRuntimeError` at the top. That is why they look nearly identical in a console — same layout, same `Path:`, same `Find more at` suffix. You tell them apart by the code and the verb: `Circular dependency detected for` versus `No provider found for`. There is one more tell: `cyclicDependencyErrorWithDetails` calls `augmentRuntimeError(…, null)`, passing `null` for the source, so an `NG0200` produced by that path has a `Path:` and no `Source:` at all. And the fixes have nothing in common — a missing provider is a registration change, a cycle is a design change, usually extracting the shared state into a third service that neither of the two depends on.

← Prev: [When it is a different token](16h-when-it-is-a-different-token.md) · Index: [Topic index](README.md) · Next → [The errors with no code](16j-the-errors-with-no-code.md)
