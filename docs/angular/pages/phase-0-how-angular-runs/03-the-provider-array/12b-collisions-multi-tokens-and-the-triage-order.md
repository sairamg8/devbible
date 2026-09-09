---
title: "The other two costs of a full provider array are both the same token appearing twice — and whether the second entry replaces the first or joins it is a property of the token, not of your call"
sidebar_label: "12b · Collisions and the triage order"
sidebar_position: 12.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts)
> (`processProvider`),
> [`core/src/render3/errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts)
> (`throwMixedMultiProviderError`),
> [`core/src/application/create_application.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/create_application.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The first two costs of a long provider array are paid whether or not anything goes wrong. The
other two are the ones that produce the bug report.** Both come from the same event — the same
token registered twice — and the framework's response to that event is not one behaviour but two
opposite ones, chosen by a flag on the token rather than by anything visible at your call site.
This chunk finishes the cost argument and then turns it into the triage order that the rest of the
category chunks follow.

## Cost 3 — collisions are silent, and the silence is by construction

`processProvider`'s last statement, for every non-multi provider, is
`this.records.set(token, record)`. A `Map`. Registering the same token twice does not warn, does
not throw and does not merge: the later record replaces the earlier one, and
`forEachSingleProvider` walks the array depth-first in source order, so **the last non-multi
provider for a token wins.**

Your array is spread in *last of all*. From
[`create_application.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/create_application.ts),
verbatim:

```ts
    // Create root application injector based on a set of providers configured at the platform
    // bootstrap level as well as providers passed to the bootstrap call by a user.
    const allAppProviders = [
      provideZonelessChangeDetectionInternal(),
      errorHandlerEnvironmentInitializer,
      ...(ngDevMode ? [validAppIdInitializer] : []),
      ...(appProviders || []),
    ];
```

[01](01-app-config-and-what-bootstrap-does-with-it.md) works through that list. What matters here is
the ordering: the framework's own providers are registered first and yours last, **so that** a
later entry for `ErrorHandler` or `IDLE_SERVICE` beats the default. That is the entire override
mechanism, and it is precisely why nothing can warn you — from the injector's point of view, an
accidental duplicate and a deliberate override are the same operation, executed by the same line of
code.

Validation, where it exists at all, exists because an individual `provide*` function chose to write
it: the `ngDevMode` contradiction checks you write yourself in
[04](04-writing-your-own-provide-function.md), `NG0408` for zone-plus-zoneless in
[05c](05c-the-redundant-opt-in-and-ng0408.md), the hydration feature conflicts in
[11e](11e-the-contradiction-checks.md). There is no general duplicate check and there will not be
one. **A long array is a large surface for a collision nobody wrote a check for.** Where order
matters and where it genuinely does not is **13 · Order dependence** *(not written yet)*.

## Cost 4 — multi tokens accumulate rather than replace

The other branch of `processProvider` ends in `multiRecord.multi!.push(provider)`, and the record's
factory is built as `() => injectArgs(multiRecord!.multi!)`. For a token declared `multi: true`, a
second registration **appends**, and the consumer injects the whole array. So the two halves of one
function behave in opposite ways, and nothing at the call site tells you which one you are in:

| You wrote it twice | What you get |
|---|---|
| `{provide: ErrorHandler, useClass: MyHandler}` | one handler — the later record replaces the earlier |
| `provideAppInitializer(fn)` | **two** initializers, both run |
| `provideRouter(routesA)`, `provideRouter(routesB)` | **both** route tables, appended into `ROUTES` |
| `provideHttpClient(withInterceptors([a]))` twice | interceptors appended; the XSRF interceptor is deduplicated **by reference** ([10](10-http-features.md)) |

⚠️ **Mixing the two forms for one token throws** — `Cannot mix multi providers and regular
providers`, from `throwMixedMultiProviderError` in
[`errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts),
and **only under `ngDevMode`**. That is the one collision class the framework does check, because
it is the one that cannot possibly be intentional.

Note the asymmetry that follows: **you cannot override a multi token, only add to it.** There is no
"replace the interceptor list" provider. If you need to remove a contribution someone else made,
the removal has to happen at the consumer — a router `Route` that is never matched, an interceptor
that passes the request straight through — or the contributing `provide*` call has to go. That is a
real constraint on how far a long array can be refactored in place.

## The triage order

Given a forty-line `app.config.ts`, work in this order. Each step is strictly cheaper to verify
than the one after it, and the first two usually remove half the file.

1. **Anything a service can declare about itself** → `@Service()` or
   `@Injectable({providedIn: 'root'})`. **Delete** the line.
2. **Anything whose lifetime is one screen or one component instance** → a route's `providers`, or
   the component's. **Move** the line.
3. **Anything feature-scoped that is more than one entry** → one `provideFeature()` of your own,
   in the feature's directory. **Collapse** the lines.
4. **`useValue` blobs and string tokens** → a typed `InjectionToken<T>`, usually with a `factory`,
   which then does not need an array entry at all. **Rewrite** the line.
5. **Anything experimental, developer-preview, or dev-only** → decide deliberately, at every
   release. **Justify or delete** the line.

Steps 1 and 3 are the same argument about ownership and are worked in code in
[12c · The things with a better home](12c-the-things-with-a-better-home.md). Step 2 is a different
axis entirely — [12d · Lifetime is the question](12d-lifetime-is-the-whole-question.md). Step 4
splits in two: [12e · Untyped values and typed tokens](12e-untyped-values-and-string-tokens.md) and
the string-key case in
[12f · String tokens](12f-string-tokens-and-the-deprecated-overload.md). Step 5 is
[12h · Experimental and dev-only](12h-experimental-preview-and-dev-only.md).

🔴 **And there is a sixth category the triage order will not surface, because nothing about it looks
wrong:** an entry that compiles, registers, and is read by a consumer in a different injector.
`providePlatformInitializer()` in `app.config.ts` is the case nothing in the framework will ever
tell you about —
[12g · Registered in the wrong injector](12g-registered-in-the-wrong-injector.md).

## What legitimately belongs

The counterweight, because "keep it short" is not a rule you can apply without one. The array is
the only home for:

- an **override** of something the framework or a library provides — `{provide: ErrorHandler,
  useClass: MyHandler}`, `useExisting`, `useFactory`, `useValue`;
- anything that is **not a class** and has no default factory — most configuration tokens;
- a **multi-provider** contribution, because a class cannot declare itself into a multi token;
- anything returning **`EnvironmentProviders`**, which by construction cannot go anywhere narrower
  than an environment injector;
- a class you **do not own** and therefore cannot decorate;
- a **non-root scope** that `@Service()` cannot express.

Each of those is a line you should be able to defend in review in one sentence. The full treatment,
including the `@Service` vs `@Injectable` capability table, is **14 · `providedIn: 'root'` vs
listing in the array** *(not written yet)*.

## Gotchas

**★ Symptom: "our `app.config.ts` is sixty lines and nobody knows what half of it does."** Cause:
the array is the widest-typed position in the framework and never rejects an entry, so every wiring
decision lands there by default. Fix: run the triage order above, top down. In practice the biggest
single win is step 3 — three related entries become one `provideFeature()` living in the feature's
own directory, which moves the *next* change out of the root config entirely. The mechanics are
[04](04-writing-your-own-provide-function.md); the judgement is
[12c](12c-the-things-with-a-better-home.md).

**★ Symptom: you added a provider for a token that was already in the array, and either nothing
changed or everything did.** Cause: whether the second entry replaces the first or appends to it is
a property of the **token**, not of your call. Non-multi ends in `this.records.set(token, record)`
and the last one wins; `multi: true` ends in `multiRecord.multi!.push(provider)` and both survive.
Fix: check the token's declaration before assuming, and read **13 · Order dependence** *(not written
yet)*. If you meant to override a multi token, you cannot — you have to neutralise the contribution
at the consumer or remove the call that made it.

**★ Symptom: `Cannot mix multi providers and regular providers` in development, and nothing at all
in production.** Cause: `throwMixedMultiProviderError` is guarded by `ngDevMode`. One entry declares
`multi: true` for a token and another does not — commonly a hand-written
`{provide: APP_INITIALIZER, useValue: fn}` sitting next to a `provideAppInitializer()`. Fix: make
both entries multi, or use the `provide*` function for both:

```ts
// wrong — the second entry is not multi, and only dev mode tells you
providers: [
  provideAppInitializer(() => warmCache()),
  {provide: APP_INITIALIZER, useValue: () => loadFlags()},
]

// right
providers: [
  provideAppInitializer(() => warmCache()),
  provideAppInitializer(() => loadFlags()),
]
```

**★ Symptom: you removed an entry from `app.config.ts` and a completely unrelated feature broke.**
Cause: the entry was overriding a framework default, and the framework's own provider — spread into
`allAppProviders` *before* yours — became the winner again. Fix: read every deleted line as a
possible override before deleting it. `{provide: ErrorHandler, useClass: …}` and
`provideIdleServiceWith(…)` are both invisible-until-removed in exactly this way; see
[11g](11g-the-standalone-core-providers.md) for the second.

**★ Symptom: two `provideRouter()` calls, and routes from the second one are unreachable.** Cause:
`ROUTES` is typed `InjectionToken<Route[][]>` with `multi: true`, and the `Router` reads it as
`inject(ROUTES, {optional: true})?.flat() ?? []`. Both tables are therefore present, concatenated
in registration order — so a `{path: '**'}` in the *first* call shadows everything the second one
contributed. Fix: one `provideRouter()` per application, with the tables merged at the call site:

```ts
// wrong — adminRoutes are unreachable if appRoutes ends in a wildcard
providers: [provideRouter(appRoutes), provideRouter(adminRoutes)]

// right
providers: [provideRouter([...appRoutes, ...adminRoutes])]
```

[07](07-provide-router-and-the-route-array.md) works through `ROUTES` and why its type is
`Route[][]` rather than `Route[]`.

**★ Symptom: an interceptor runs twice for every request.** Cause: `withInterceptors` contributes to
the `HTTP_INTERCEPTOR_FNS` multi token, so a second `provideHttpClient(withInterceptors([…]))` — in
the app config and again on a route, or added twice during a merge — appends rather than replaces.
Fix: one `provideHttpClient()` per injector, and for a route that needs an extra interceptor use
`withRequestsMadeViaParent()` so the parent's chain is reused rather than rebuilt
([10f](10f-requests-made-via-parent.md)).

**★ Symptom: an override you added in `app.config.ts` is ignored, and the framework default is
still in effect.** Cause: the token is `multi: true`, so your entry was appended to the default
rather than replacing it — the classic case is expecting to replace the built-in XSRF interceptor
by providing your own. Fix: check whether the token is multi first. If it is, there is no override;
configure the feature instead ([10e](10e-xsrf-protection.md) for XSRF specifically).

## Interview questions

**★ Given a forty-line `app.config.ts`, what is your triage order?**
Five passes, cheapest first. One: anything a service can declare about itself — a class with no
override, no constructor-injection requirement and no non-root scope becomes `@Service()` or
`@Injectable({providedIn: 'root'})`, and the line goes away, which also makes it tree-shakable.
Two: anything whose lifetime is one screen moves to that route's `providers`, and anything whose
lifetime is one component instance moves to the component's. Three: anything feature-scoped that
occupies more than one entry collapses into a single `provideFeature()` in the feature's own
directory, so the next service that feature needs is not a change to the root config. Four:
`useValue` blobs and string-keyed entries become typed `InjectionToken<T>`s, and a token with a
default `factory` usually needs no array entry at all. Five: anything experimental,
developer-preview or dev-only gets justified line by line at every release, or removed — that is
the category that ages badly without anyone noticing. What survives all five passes is overrides,
non-class tokens, multi contributions and `EnvironmentProviders`, and each of those you should be
able to defend in one sentence.

**★ Why can't Angular just warn about a duplicate provider?**
Because a duplicate and a deliberate override are the same operation. The framework's own providers
are spread into `allAppProviders` before yours, precisely so that a later entry for `ErrorHandler`
or `IDLE_SERVICE` beats the default; the injector cannot distinguish that from an accident, because
there is nothing to distinguish — both are `this.records.set(token, record)` running twice. The
only case it *can* rule out is mixing `multi: true` and non-multi for one token, which nobody could
mean, and that one does throw, in dev mode. Everything else is checked, when it is checked at all,
by an individual `provide*` function that went looking for a contradiction it already knew about,
like `NG0408` for zone-plus-zoneless. That is a deliberate design position rather than an
oversight: a general duplicate check would break the override mechanism the whole configuration
model rests on.

**★ You need to remove an interceptor that a shared library's `provide*` function contributes. How?**
You cannot remove it from the array, because `HTTP_INTERCEPTOR_FNS` is a multi token and a second
registration appends rather than replaces — there is no negative provider in Angular. The options
are, in order of preference: stop calling the library's `provide*` and call its narrower parts if
it exposes them; configure the interceptor to no-op through whatever token it reads, if the library
provided one; or, if the library did not, isolate the affected requests into a child injector with
its own `provideHttpClient()` so the parent's chain never applies. This is the practical cost of
multi tokens, and it is worth knowing before you build your own subsystem on one.

**★ Both `provideRouter(a)` and `provideRouter(b)` "work". Why is that worse than an error?**
Because it produces a routing table that is the concatenation of two tables in array order, and
route matching is first-match-wins, so the behaviour depends on the order of two lines in a config
file that nothing documents as ordered. The `ROUTES` token is `multi: true` and multi means append,
so the injector is behaving exactly as specified; the mistake is at the human level, where "provide
the router" reads like an idempotent setup call. An error would have been better, but the framework
cannot raise one without forbidding the legitimate case of a route contributing more routes. The
defence is a convention, not a check: exactly one `provideRouter()` per application, everything
else expressed inside the `Routes` array.

{/* FOOTER */}
