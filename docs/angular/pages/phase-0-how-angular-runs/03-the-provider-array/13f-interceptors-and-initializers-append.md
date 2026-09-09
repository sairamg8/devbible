---
title: "The interceptor array literal is the execution order, app initializers are started in array order and then awaited together rather than sequenced, and environment initializers are read with `{self: true}` — three multi tokens, three different meanings for the same append"
sidebar_label: "13f · Interceptors and initializers"
sidebar_position: 13.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts),
> [`common/http/src/backend.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/backend.ts),
> [`core/src/application/application_init.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/application_init.ts),
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`multi: true` guarantees only that every contribution survives in registration order — what that
order *means* is decided by the consumer, and these three consumers mean three different things.**
The interceptor chain folds the array right-to-left so registration order becomes execution order.
`ApplicationInitStatus` starts every entry in one loop and then awaits them together, so position is
start order and nothing more. And `resolveInjectorInitializers` reads its token with `{self: true}`
and throws the return value away, so neither inheritance nor sequencing exists at all.
[13e](13e-multi-tokens-append.md) covers the router's two multi tokens.

## `HTTP_INTERCEPTOR_FNS` — the array literal *is* the execution order

Registration maps one provider per function, in the array's own order:

```ts
export function withInterceptors(
  interceptorFns: HttpInterceptorFn[],
): HttpFeature<HttpFeatureKind.Interceptors> {
  return makeHttpFeature(
    HttpFeatureKind.Interceptors,
    interceptorFns.map((interceptorFn) => {
      return {
        provide: HTTP_INTERCEPTOR_FNS,
        useValue: interceptorFn,
        multi: true,
      };
    }),
  );
}
```

and the chain is built by folding that accumulated array from the right, from
[`common/http/src/backend.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/backend.ts)
— the comment is the framework stating the rule itself:

> *"Note: interceptors are wrapped right-to-left so that final execution order is left-to-right. That
> is, if `dedupedInterceptorFns` is the array `[a, b, c]`, we want to produce a chain that is
> conceptually `c(b(a(end)))`, which we build from the inside out."*

So `multi` append order plus `reduceRight` gives you the one rule people actually need: **the order
you write the array is the order the interceptors run.** Two things then follow that catch people out
on a refactor:

```ts
// ⛔ Extracting a helper changed the array, and therefore the order.
const infrastructure = [loggingInterceptor, retryInterceptor];
provideHttpClient(withInterceptors([...infrastructure, authInterceptor]))
// runs: xsrf, logging, retry, auth  — auth now signs a request that retry may replay unsigned

// ✅ Position is a design decision; write it where the decision is visible.
provideHttpClient(withInterceptors([authInterceptor, loggingInterceptor, retryInterceptor]))
```

and:

```ts
// ⛔ Two features that both write HTTP_INTERCEPTOR_FNS — argument order is execution order.
provideHttpClient(withInterceptorsFromDi(), withInterceptors([authInterceptor]))
// ✅ or the reverse, deliberately. Neither is wrong; the wrong thing is not knowing which you chose.
provideHttpClient(withInterceptors([authInterceptor]), withInterceptorsFromDi())
```

[10b](10b-choosing-interceptor-positions.md) is the page on *choosing* a position;
[10d](10d-the-two-interceptor-systems.md) is the page on the two systems coexisting. What this chunk
adds is why the argument position of a *feature* propagates to the runtime order at all: the feature
loop spreads `ɵproviders` into one array, and the multi branch preserves that array's order.

## `APP_INITIALIZER` — array order is *start* order and nothing else

```ts
export function provideAppInitializer(
  initializerFn: () => Observable<unknown> | Promise<unknown> | void,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: APP_INITIALIZER,
      multi: true,
      useValue: initializerFn,
    },
  ]);
}
```

and the runner, from
[`core/src/application/application_init.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/application_init.ts):

```ts
    const asyncInitPromises = [];
    for (const appInits of this.appInits) {
      const initResult = runInInjectionContext(this.injector, appInits);
      if (isPromise(initResult)) {
        asyncInitPromises.push(initResult);
      } else if (isSubscribable(initResult)) {
        const observableAsPromise = new Promise<void>((resolve, reject) => {
          initResult.subscribe({complete: resolve, error: reject});
        });
        asyncInitPromises.push(observableAsPromise);
      }
    }
```

🔴 **The loop starts every initializer, then `Promise.all` awaits them together.** Array position
decides which one *starts* first; it does not sequence them. So the arrangement below does not do
what its author believed:

```ts
// ⛔ Two initializers, one depending on the other's result. They race.
providers: [
  provideAppInitializer(() => inject(ConfigService).load()),
  provideAppInitializer(() => inject(FeatureFlags).initFrom(inject(ConfigService).baseUrl)),
]
```

```ts
// ✅ One initializer that expresses the dependency in the only place that can enforce it.
providers: [
  provideAppInitializer(async () => {
    const config = await inject(ConfigService).load();
    await inject(FeatureFlags).initFrom(config.baseUrl);
  }),
]
```

⚠️ There is a second trap inside that fix, and it belongs to
[06b](06b-initializer-ordering-and-failure.md): the injection context ends at the first `await`, so
both `inject()` calls above must happen before any awaiting, or be restructured. Read that page
before writing a two-step initializer.

## `ENVIRONMENT_INITIALIZER` — appends, runs in order, and inherits nothing

```ts
      const initializers = this.get(ENVIRONMENT_INITIALIZER, EMPTY_ARRAY, {self: true});
      if (ngDevMode && !Array.isArray(initializers)) {
        throw new RuntimeError(
          RuntimeErrorCode.INVALID_MULTI_PROVIDER,
          'Unexpected type of the `ENVIRONMENT_INITIALIZER` token value ' +
            `(expected an array, but got ${typeof initializers}). ` +
            'Please check that the `ENVIRONMENT_INITIALIZER` token is configured as a ' +
            '`multi: true` provider.',
        );
      }
      for (const initializer of initializers) {
        initializer();
      }
```

Two facts about ordering fall out of that, and neither is about the array:

- **`{self: true}`.** A route injector reads only the initializers registered *on that route*. The
  application's are not inherited and are not re-run. So "order" between an application initializer
  and a route initializer is not a question about position at all — they are in different injectors.
- **`initializer()` — the return value is discarded.** An `async` environment initializer's promise is
  dropped on the floor; nothing sequences it against anything.
  [06d](06d-environment-initializers.md) is the page for this.

And note the error message quoted above: `RuntimeErrorCode.INVALID_MULTI_PROVIDER` exists precisely
because writing `ENVIRONMENT_INITIALIZER` *without* `multi: true` produces a non-array value here. It
is the other half of `Cannot mix multi providers and regular providers` — the same mistake caught at
the consumer instead of at registration.

## Gotchas

**★ Symptom: your interceptor order changed after a refactor that "did not change any logic".**
Cause: the array literal passed to `withInterceptors` is the registration order and therefore the
execution order; spreading a helper constant into it changed positions. Fix: keep the array literal
flat and explicit at the call site, and if it must be composed, assert the composition where it is
written rather than discovering it in a network log.

**★ Symptom: the same interceptor appears twice in your providers but runs once.** Cause:
`HttpInterceptorHandler.handle` de-duplicates with `Array.from(new Set([...]))` before folding, so the
same *function reference* collapses to one entry at its first position. Fix: nothing to fix, but know
the limit — two structurally identical but separately-declared functions are two references and both
run ([10c](10c-the-interceptor-chain-internals.md)).

**★ Symptom: two app initializers where the second depends on the first, and it intermittently reads
stale state.** Cause: the runner starts every initializer in one loop and then awaits
`Promise.all(asyncInitPromises)` — array position is start order, not sequence. Fix: one initializer
containing both steps, awaited in order.

**★ Symptom: an `async` `provideEnvironmentInitializer` body appears to be ignored.** Cause: the
runner calls `initializer()` and discards the return value; there is no await anywhere in
`resolveInjectorInitializers`. Fix: use `provideAppInitializer` if the work must be awaited before the
application starts, and keep environment initializers synchronous.

**★ Symptom: `Unexpected type of the ENVIRONMENT_INITIALIZER token value (expected an array, but got
function)`.** Cause: someone provided the token by hand without `multi: true`, so the record holds a
single value rather than the accumulated array. Fix: `provideEnvironmentInitializer(fn)`, which sets
`multi: true` for you — and if you must write it out, `{provide: ENVIRONMENT_INITIALIZER, multi: true,
useValue: fn}`.

**★ Symptom: a library's `provideX()` called in two places doubles a side effect you cannot see.**
Cause: the library contributed to a multi token — an initializer, a listener, an interceptor — and
multi never replaces. Fix: call third-party `provide*` functions exactly once, in the application
config, and treat a `provide*` inside a shared constant that is itself spread into two configs as the
same bug ([13c](13c-last-wins-in-practice.md) has the non-multi half of it).

## Interview questions

**★ You are told an interceptor "runs too late". What do you check, in order?**
First, which array it is in: interceptors registered by a route's `provideHttpClient()` are in a
different injector's handler entirely, so "late" may mean "different chain"
([10c](10c-the-interceptor-chain-internals.md)). Second, its index in the `withInterceptors` array,
because that array literal is the execution order. Third, the argument position of the feature that
contributed it, since `withInterceptorsFromDi()` and `withInterceptors()` both write
`HTTP_INTERCEPTOR_FNS` and inherit their relative order from the feature loop. Fourth,
`xsrfInterceptorFn`, which is pushed into the base array before the loop and therefore always first.
Nothing in that list is about registration *time*.

**★ Does array position sequence app initializers?**
No — it decides start order only. `runInitializers` iterates `this.appInits` in one synchronous loop,
calling each function and collecting any promise or subscribable into `asyncInitPromises`, then awaits
them with `Promise.all`. So initializer B starts while A is still pending. If B needs A's result, the
only correct expression of that is one initializer that awaits both steps in order — with the caveat
that the injection context ends at the first `await`.

**Environment initializers and app initializers are both multi and both run at startup. Why is
"ordering" a different question for each?**
App initializers all live in the application injector and are read as one array, so their relative
order is a real, answerable question about array position. Environment initializers are read with
`{self: true}` — each injector runs only its own — so an application initializer and a route
initializer are never in the same array and never ordered relative to each other by position; they are
ordered by *when their injector is created*, which is a hierarchy question, not an array question.

**What is `RuntimeErrorCode.INVALID_MULTI_PROVIDER` for, given that mixing multi and non-multi already
throws at registration?**
It catches the case registration cannot: a token that is *only ever* provided without `multi: true`,
where nothing was mixed and nothing was overwritten, but the consumer expected an array. The
registration-time check compares a new provider against an existing record; if there is only one
provider and it is wrong, there is nothing to compare it to. The consumer-side check in
`resolveInjectorInitializers` is where that shows up, and its message names the fix explicitly.

← Prev: [Multi tokens append](13e-multi-tokens-append.md) · Index: [Topic index](README.md) · Next → [Where order does not matter](13g-where-order-does-not-matter.md)
