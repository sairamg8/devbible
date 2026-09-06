---
title: "The whole provider is one ternary on `ngDevMode`, so a production build receives an empty `EnvironmentProviders` — and the public-API golden calls it `// @public` while the source calls it `@developerPreview 20.0`"
sidebar_label: "05f · Dev-only, and developer preview"
sidebar_position: 5.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`change_detection/provide_check_no_changes_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/provide_check_no_changes_config.ts)
> (full implementation body and both `@developerPreview 20.0` JSDoc tags),
> [`goldens/public-api/core/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/core/index.api.md).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Two facts about `provideCheckNoChangesConfig` are invisible from the call site and change how you
should write it. First, the entire provider list is the true branch of a ternary on `ngDevMode`: in a
production build the function returns `makeEnvironmentProviders([])` — a real, correctly branded
`EnvironmentProviders` object carrying nothing at all. Nothing in a production bundle ever consults
this provider, by design, because `checkNoChanges` is a second full traversal of the view tree run
purely to assert the first one was idempotent. Second, its stability tags disagree with each other:
the public-API golden marks it `// @public`, and the JSDoc on both overloads says
`@developerPreview 20.0`. The JSDoc wins, and reading stability off the golden is the same trap
[08g](08g-tracing-and-the-experimental-end.md) documents for `withViewTransitions`. The blind spot
this provider closes is [05e](05e-provide-check-no-changes-config.md); the `interval` poll is
[05g](05g-the-check-no-changes-interval.md).**

## The body: one token in development, an empty array in production

The full implementation, from
[`provide_check_no_changes_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/provide_check_no_changes_config.ts):

```ts
export function provideCheckNoChangesConfig(options: {
  interval?: number;
  exhaustive: boolean;
}): EnvironmentProviders {
  return makeEnvironmentProviders(
    typeof ngDevMode === 'undefined' || ngDevMode
      ? [
          {
            provide: UseExhaustiveCheckNoChanges,
            useValue: options.exhaustive,
          },
          options?.interval !== undefined ? exhaustiveCheckNoChangesInterval(options.interval) : [],
        ]
      : [],
  );
}
```

Five readings, all direct:

- **`makeEnvironmentProviders` is the wrapper**, which is why the return type is
  `EnvironmentProviders` and why the result is legal in `ApplicationConfig.providers` and illegal in
  a component's ([03](03-environmentproviders-vs-provider.md)). It is also the exact shape chunk
  [04](04-writing-your-own-provide-function.md) recommends for your own `provide*` function — the
  framework is following its own recipe here.
- **`typeof ngDevMode === 'undefined' || ngDevMode`** is Angular's standard guard, and the first
  clause is not redundant. In a context where the global was never defined at all — a plain test
  harness, a script that imports `@angular/core` without a CLI build — the branch is treated as
  *development*. Only a build that explicitly defines `ngDevMode` as `false` takes the `[]` path.
- **In production the function returns `makeEnvironmentProviders([])`**, not `[]`. That distinction is
  forced by the signature: both branches have to produce an `EnvironmentProviders`, and a bare array
  is not one — it is a `Provider[]`, which is a different type with different acceptance rules. So
  the call still allocates a branded object; it just carries no records.
- **The inner `[]` is a provider array nested inside a provider array**, which the injector's
  collection walk flattens. That is how the second element can be "either an initializer or nothing"
  without a spread or a filter.
- **Only one of the two entries is a plain provider.** `UseExhaustiveCheckNoChanges` is a non-multi
  `useValue`; `exhaustiveCheckNoChangesInterval(...)` is an environment initializer registered
  `multi: true`. They override in opposite directions, which is [05g](05g-the-check-no-changes-interval.md)'s
  subject.

Where `UseExhaustiveCheckNoChanges` is *read* is in the change-detection traversal itself — **Phase 5
· Change detection and zoneless** *(not written yet)* — and this page does not reproduce it. What
this chunk can settle is that the provider's whole non-interval effect is one `useValue` on that
token.

⚠️ **Behaviourally free is not the same as byte-free.** Leaving the call in a production build costs
nothing at runtime: no token, no initializer, no extra traversal. But the call site is still code,
and whether the guarded branch and `exhaustiveCheckNoChangesInterval` disappear from the bundle
depends on the build folding `ngDevMode` to a constant `false` and dropping the dead branch. The
shape that does not depend on the optimiser at all is the conditional array from
[08g](08g-tracing-and-the-experimental-end.md) — build the provider list and only push this entry
when you are not building for production:

```ts
import { ApplicationConfig, EnvironmentProviders, Provider } from '@angular/core';
import { provideCheckNoChangesConfig } from '@angular/core';
import { environment } from '../environments/environment';

const debugProviders: (Provider | EnvironmentProviders)[] = environment.production
  ? []
  : [provideCheckNoChangesConfig({ exhaustive: true })];

export const appConfig: ApplicationConfig = {
  providers: [...debugProviders],
};
```

## The stability tags disagree with each other, and the JSDoc wins

The golden says `// @public`. The source says, on **both** overloads:

```ts
/**
 * Used to disable exhaustive checks when verifying no expressions changed after they were checked.
 *
 * ...
 *
 * @developerPreview 20.0
 */
```

🔴 **`// @public` in `goldens/public-api/core/index.api.md` is API-Extractor's release tag, not
Angular's stability promise.** Every entry in that file carries it; it means "this symbol is part of
the public surface", not "this symbol is stable". The tag that answers *may this change in a minor
release* is the JSDoc one, and here it is `@developerPreview 20.0` — not `@publicApi`. This is
exactly the disagreement [08g](08g-tracing-and-the-experimental-end.md) documents for
`withViewTransitions`, which reads as stable in the golden and is `@developerPreview 19.0` in source.
What Angular formally promises for developer-preview APIs is set out in its release-practices
documentation, which this page did not verify; the fact you can act on without any further reading is
that the tag is **not** `@publicApi`.

The practical consequence here is unusually small, and it is worth saying why: because the provider
does nothing in production, the risk of a developer-preview API changing under you is confined to
your development builds and your CI. A signature change breaks a compile, not a customer. That is a
genuinely different risk profile from a developer-preview *router* feature that ships, and it is why
this one is worth using despite the tag.

## Gotchas

**★ Symptom: `provideCheckNoChangesConfig` visibly does nothing in production.** Cause: by design —
the whole provider list is the true branch of `typeof ngDevMode === 'undefined' || ngDevMode ? [...]
: []`, so a production build gets `makeEnvironmentProviders([])`. Fix: nothing to repair, but stop
expecting it to be a production safety net, and stop shipping the call. Register it from a
development-only array so the intent is legible:

```ts
const debugProviders = environment.production
  ? []
  : [provideCheckNoChangesConfig({ exhaustive: true, interval: 1000 })];
```

**★ Symptom: the provider is active somewhere you expected production behaviour — a plain unit test,
a Node script, a harness that imports `@angular/core` directly.** Cause: the guard's first clause,
`typeof ngDevMode === 'undefined'`, treats a *missing* global as development. Only a build that
defines `ngDevMode` as `false` reaches the empty branch, and most non-CLI entry points never define
it at all. Fix: do not infer build mode from this provider's behaviour; if a harness must behave as
production, configure it with the production provider array rather than relying on the flag:

```ts
TestBed.configureTestingModule({
  providers: [...productionProviders], // built without the debug array
});
```

**★ Symptom: you shipped a call you believed was stable API and a minor release changed its shape.**
Cause: reading stability off the public-API golden, where `provideCheckNoChangesConfig` is
`// @public` because API-Extractor tags every symbol in the surface that way. The JSDoc on both
overloads says `@developerPreview 20.0`. Fix: read the JSDoc tag on the function, or the badge
angular.dev renders on its API page, and treat the golden as an inventory only —

```ts
// the tags that carry Angular's promise, all from JSDoc at v22.1.5:
//   @publicApi              — stable
//   @developerPreview 20.0  — provideCheckNoChangesConfig, both overloads
//   @experimental           — no promise at all
```

**Symptom: a reviewer reads `provideCheckNoChangesConfig({exhaustive: true})` in `app.config.ts` and
concludes the application has runtime protection against stale bindings.** Cause: the line is
indistinguishable from a production setting at the call site — nothing in the name, the arguments or
the return type says "development only". Fix: make the configuration say it, which costs nothing and
removes the ambiguity permanently:

```ts
// ⛔ reads as a production guarantee
providers: [provideCheckNoChangesConfig({ exhaustive: true })],

// ✅ reads as what it is
providers: [...(environment.production ? [] : [provideCheckNoChangesConfig({ exhaustive: true })])],
```

**Symptom: someone "optimises" the production branch by returning `[]` from their own wrapper around
this provider, and it no longer type-checks where the original did.** Cause: `EnvironmentProviders`
is a branded opaque type; a bare `Provider[]` is not assignable to it, which is precisely why the
framework wraps even the empty case in `makeEnvironmentProviders`
([03](03-environmentproviders-vs-provider.md)). Fix: wrap the empty case the same way the framework
does:

```ts
export function provideStaleBindingChecks(): EnvironmentProviders {
  return makeEnvironmentProviders(
    typeof ngDevMode === 'undefined' || ngDevMode
      ? [provideCheckNoChangesConfig({ exhaustive: true })]
      : [],
  );
}
```

## Interview questions

**★ Why does this provider do nothing in production — is that a limitation or the point?**
The point. `checkNoChanges` is a second full traversal of the view tree run purely to assert that the
first one was idempotent; it is a whole extra traversal for every change detection cycle and produces no
user-visible output. It has always been development-only in Angular, and this provider follows the
same rule by putting its entire provider list behind `typeof ngDevMode === 'undefined' || ngDevMode`
and returning `makeEnvironmentProviders([])` otherwise. If you want production-time detection of a
stale UI, this is the wrong tool by construction: what you want is telemetry through your
`ErrorHandler` ([06g](06g-error-handler-and-ng0402.md)) and real user monitoring.

**★ How do you tell that `provideCheckNoChangesConfig` is not stable API, given the golden says
`// @public`?**
By reading the JSDoc on the function rather than the golden. `// @public` is API-Extractor's release
tag and appears on every entry in `goldens/public-api/core/index.api.md`; it means the symbol is part
of the public surface, not that Angular promises it will not change. The tag that carries the promise
lives in source, and here it is `@developerPreview 20.0` on both overloads — the same disagreement
`withViewTransitions` has ([08g](08g-tracing-and-the-experimental-end.md)). Using the golden to
answer "is this safe to ship" produces a confident, specific, wrong answer, and it produces it for
every developer-preview and experimental symbol in the framework simultaneously.

**Someone proposes leaving `provideCheckNoChangesConfig({exhaustive: true})` in the production
configuration "because it costs nothing". Are they right?**
At runtime, yes: the function returns an empty `EnvironmentProviders` in a production build, so there
is no token, no initializer and no extra traversal — nothing to measure. But it is not free of
*code*: the call site remains, and whether the guarded branch and `exhaustiveCheckNoChangesInterval`
are eliminated depends on the build folding `ngDevMode` to a constant and dropping the dead branch.
The stronger objection is not bytes at all. It is a line in `app.config.ts` that reads as a
production safety measure and is not one — the kind of thing an incident review discovers at the
worst possible moment. Register it from a development-only array instead.

**Why does the guard treat an undefined `ngDevMode` as development rather than production?**
Because the failure modes are asymmetric. Treating "unknown" as production would silently disable
every development-time diagnostic in Angular for anything that is not a full CLI build — plain unit
tests, custom harnesses, scripts that import `@angular/core` — and the symptom would be checks that
appear to be configured and never fire. Treating "unknown" as development costs an extra traversal in
environments that are not performance-critical anyway. The same
`typeof ngDevMode === 'undefined' || ngDevMode` shape appears throughout the framework for exactly
this reason, and it is the shape to copy in your own `provide*` validation
([04](04-writing-your-own-provide-function.md)).

**Why does the production branch bother calling `makeEnvironmentProviders([])` instead of returning
an empty array?**
Because `EnvironmentProviders` is a branded opaque type, and a `Provider[]` is not assignable to it —
the branding is the whole mechanism chunk [03](03-environmentproviders-vs-provider.md) describes.
Both branches of the ternary are arguments to a single `makeEnvironmentProviders` call, so the
function has exactly one return statement and one return type in both modes. The result is that the
*call sites* need no conditional typing: `provideCheckNoChangesConfig(...)` is an
`EnvironmentProviders` in every build, and only its contents differ.

---

← Prev: [05e · `provideCheckNoChangesConfig`](05e-provide-check-no-changes-config.md) · Index: [Topic index](README.md) · Next → [05g · The `checkNoChanges` interval](05g-the-check-no-changes-interval.md)
