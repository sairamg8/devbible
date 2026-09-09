---
title: "One token cannot be both multi and non-multi, and the error that says so is a bare `Error` with no `NG` code thrown only in development — which makes it the one ordering mistake whose production behaviour differs from what you debugged"
sidebar_label: "13b · Mixing multi and non-multi"
sidebar_position: 13.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/render3/errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts),
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts),
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts),
> [`common/http/src/interceptor.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/interceptor.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A token picks one of `processProvider`'s two branches and has to keep picking it — and the check
that enforces that is the least ergonomic diagnostic in the whole DI surface.** It is a bare `Error`
with no error code, so there is nothing to search; it fires in both directions, so the stack does not
tell you which entry was the mistake; and it is guarded by `ngDevMode`, so the production build fails
differently. This chunk covers that error, the ordering question it exposes at the boundary between a
plain provider and an `EnvironmentProviders` value, and the pattern Angular uses internally to make a
`provide*` function survive being called twice.

## Mixing multi and non-multi throws — in development, and without an error code

From [`core/src/render3/errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts),
in full:

```ts
export function throwMixedMultiProviderError() {
  throw new Error(`Cannot mix multi providers and regular providers`);
}
```

🔴 **That is a bare `Error`, not a `RuntimeError` — there is no `NG` code to search for.** Both
branches of `processProvider` call it, so it fires in *either* direction: a `multi: true` provider
arriving after a plain one, and a plain one arriving after a `multi: true` one. The trigger is the
flattened order, so which of the two "arrived second" depends on where the offending entry sits after
nesting is expanded.

```ts
// Throws at bootstrap: `Cannot mix multi providers and regular providers`.
export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => inject(ConfigService).load()),   // APP_INITIALIZER, multi: true
    {provide: APP_INITIALIZER, useValue: () => seedCache()},     // same token, no `multi`
  ],
};

// Fixed: use the provider function, which sets `multi: true` for you.
export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => inject(ConfigService).load()),
    provideAppInitializer(() => seedCache()),
  ],
};
```

**Both checks are guarded by `ngDevMode`.** Read the code with the guards removed — which is what a
production build gives you — and the two directions fail differently, neither of them nicely:

- **Multi after non-multi.** `multiRecord` is the existing *non-multi* record, whose `multi` property
  is `undefined`. The next statement is `multiRecord.multi!.push(provider)` — a property access on
  `undefined`. The non-null assertion is a compile-time claim, not a runtime guard.
- **Non-multi after multi.** Nothing intervenes; the final `this.records.set(token, record)` replaces
  the container record, and every accumulated multi entry is silently discarded.

⚠️ Both bullets are readings of the source above rather than documented behaviour — the
documentation states neither. What *is* documented, in the sense of being in the source verbatim, is
that the check exists only under `ngDevMode`. Treat the practical rule as: **this error is one you
must fix in development, because production will not tell you the same story.**

## The ordering question chunk 10 deferred

[10 · HTTP features](10-http-features.md) leaves one question open on purpose: `provideHttpClient()`
pushes `xsrfInterceptorFn` into `HTTP_INTERCEPTOR_FNS` before it drains the feature list, so nothing
you pass to `provideHttpClient()` can precede XSRF — but could a raw multi-provider placed *earlier
in the same `ApplicationConfig.providers` array* get in front of it?

**Mechanically, yes, and `forEachSingleProvider` is the reason.** A plain object literal at index 0
is registered before the `EnvironmentProviders` value at index 1 is unwrapped, `HTTP_INTERCEPTOR_FNS`
is `multi: true`, and multi appends in registration order — so index 0's function would sit at
position 0 of the resulting array and run first.

```ts
// pseudo-code — the mechanism, not a recommendation. See the caveat below.
export const appConfig: ApplicationConfig = {
  providers: [
    {provide: HTTP_INTERCEPTOR_FNS, useValue: auditInterceptorFn, multi: true},
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
// Registration order: auditInterceptorFn, xsrfInterceptorFn, authInterceptor.
```

🔴 **Do not build on this.** The source comment on `HTTP_INTERCEPTOR_FNS` is a bare
*"A multi-provided token of `HttpInterceptorFn`s"* with **no `@publicApi` tag**, while
`HTTP_INTERCEPTORS` — the class-based token defined alongside it — carries `@publicApi` explicitly. I
could not confirm that `HTTP_INTERCEPTOR_FNS` is exported from the `@angular/common/http` entry
point, so the block above is labelled pseudo-code and is here to close the mechanism, not to be
copied. The supported answer to *"can I run before XSRF"* remains **no**: every documented route into
the interceptor chain goes through `provideHttpClient()`'s feature loop, and that loop runs after the
XSRF entry is already in place.

## Making a `provide*` safe to call twice — the pattern Angular uses on itself

The multi branch has no idempotence: contribute the same behaviour twice and it registers twice.
`withInterceptorsFromDi()` has to survive exactly that, because a lazily-loaded feature calling
`provideHttpClient(withInterceptorsFromDi())` is a normal thing to do — and its implementation
comment states the technique verbatim:

> *"Note: the legacy interceptor function is provided here via an intermediate token
> (`LEGACY_INTERCEPTOR_FN`), using a pattern which guarantees that if these providers are included
> multiple times, all of the multi-provider entries will have the same instance of the interceptor
> function. That way, the `HttpINterceptorHandler` will dedup them and legacy interceptors will not
> run multiple times."*

(The `HttpINterceptorHandler` typo is in the source; it is quoted as written.)

The shape is: **do not push a freshly created function into the multi token. Push a value read from
a second, non-multi token, so every contribution resolves to the same reference** — which then
collapses under the consumer's `Array.from(new Set([...]))`:

```ts
// The idempotent shape, applied to your own feature.
const AUDIT_INTERCEPTOR_FN = new InjectionToken<HttpInterceptorFn>('AUDIT_INTERCEPTOR_FN');

export function withAuditing(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {provide: AUDIT_INTERCEPTOR_FN, useFactory: auditInterceptorFnFactory},
    {provide: HTTP_INTERCEPTOR_FNS, useExisting: AUDIT_INTERCEPTOR_FN, multi: true},
  ]);
}
```

Called twice in one injector, the non-multi `AUDIT_INTERCEPTOR_FN` record is written twice and
last-wins leaves one factory; the two multi entries both resolve *through* it to that one function
reference; the handler's `Set` collapses them. Called once, nothing changes. That is the whole trick,
and it only works because the consumer de-duplicates by reference — a multi token whose consumer just
iterates the array gets no protection from it.

🔴 **Not every multi token has a de-duplicating consumer.** `APP_INITIALIZER`, `ENVIRONMENT_INITIALIZER`
and `APP_BOOTSTRAP_LISTENER` iterate the array directly, so this pattern does not make a
`provideAppInitializer()` idempotent. For those, the only defence is calling the function once —
[04](04-writing-your-own-provide-function.md) is where "what happens if someone calls this twice"
belongs in a `provide*` function's own contract.


## Gotchas

**★ Symptom: `Cannot mix multi providers and regular providers`, and grepping the error code finds
nothing.** Cause: there is no code. `throwMixedMultiProviderError` throws a plain `Error` with that
exact string, so there is no `NG0xxx` to look up and no entry on `angular.dev/errors`. Fix: search
your providers for the token named in the stack and make every entry for it agree —
either all `multi: true`, or exactly one entry with no `multi`. The usual culprit is a hand-written
`{provide: APP_INITIALIZER, useValue: fn}` next to a `provideAppInitializer()`; delete the hand-written
one.

**★ Symptom: the same mixed-provider mistake behaves completely differently in a production build.**
Cause: both checks are inside `if (ngDevMode)`. Reading the surrounding code, multi-after-non-multi
then reaches `multiRecord.multi!.push(...)` on an object whose `multi` is `undefined`, and
non-multi-after-multi silently overwrites the accumulated array. Fix: never diagnose a DI wiring bug
against a production build; reproduce it in development first, where the dev-mode assertions are the
whole diagnostic surface.

**★ Symptom: a feature you wrote registered twice when a lazy route called your `provide*` again.**
Cause: multi tokens append unconditionally, and a factory that creates a new function each call
produces two distinct references, so nothing de-duplicates them. Fix: route the contribution through
an intermediate non-multi token and reference it with `useExisting`, the way
`withInterceptorsFromDi()` does — and only if the consumer de-duplicates by reference.

**★ Symptom: you copied the intermediate-token pattern onto an app initializer and it still ran
twice.** Cause: `ApplicationInitStatus.runInitializers()` iterates `this.appInits` directly with no
`Set` — the de-duplication that makes the pattern work lives in `HttpInterceptorHandler.handle`, not
in the DI container. Fix: guard inside the initializer body, or document the function as
call-once:

```ts
let started = false;
export function provideTelemetry(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      if (started) return;
      started = true;
      return inject(TelemetryService).start();
    }),
  ]);
}
```

## Interview questions

**★ `provideRouter()` twice appends route tables; `provideHttpClient()` twice mostly behaves as
last-wins. Same array, same injector — why the different outcome?**
Because the collision rule is a property of the *token*, not of the call. `provideRouter` contributes
`{provide: ROUTES, multi: true, useValue: routes}`, and the multi branch of `processProvider` pushes
onto an accumulating array. `provideHttpClient` contributes non-multi entries for `HttpBackend` and
`HttpHandler`, which take the `Map.set` path. The interesting part is that `provideHttpClient` does
*both*: its `HTTP_INTERCEPTOR_FNS` entry is `multi: true`, so calling it twice overwrites the backend
once and registers the XSRF interceptor twice. One call, two collision rules.

**★ Why does the mixed-multi check live in `processProvider` rather than at injection time?**
Because at injection time the information is gone. `processProvider` is the only place that sees both
the existing record and the incoming provider, and it can compare `existing.multi !== undefined`
against the new provider's `multi` flag. Once both have been written the record either holds an
accumulating array or a single value, and there is no trace of the disagreement. The cost of catching
it early is that the check runs on every provider in every injector, which is why it is wrapped in
`ngDevMode` — and that in turn is why the production build has different behaviour rather than a
different message.

**How would you make a `provide*` function of your own safe to call twice?**
It depends entirely on which branch its tokens take. For non-multi tokens it is already safe: the
second call rewrites the same records with equivalent values. For a multi token whose consumer
de-duplicates by reference — `HTTP_INTERCEPTOR_FNS` is the one in the framework — route the
contribution through an intermediate non-multi token and reference it with `useExisting`, so both
calls yield the same function instance. For a multi token whose consumer just iterates —
`APP_INITIALIZER`, `ENVIRONMENT_INITIALIZER`, `APP_BOOTSTRAP_LISTENER` — no provider-level trick
exists, and the honest answer is to guard inside the callback and say so in the function's own
documentation.

← Prev: [Order dependence](13-order-dependence.md) · Index: [Topic index](README.md) · Next → [Last-wins in practice](13c-last-wins-in-practice.md)
