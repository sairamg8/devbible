---
title: "`ApplicationConfig.providers` is the widest-typed position in Angular and never rejects an entry, which is why it fills up — and why every line in it is both an eager registration and a static reference the bundler must keep"
sidebar_label: "12 · What does not belong"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts),
> [`core/src/application/create_application.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/create_application.ts),
> the `core` public-API golden — and angular.dev
> [Hierarchical injectors](https://angular.dev/guide/di/hierarchical-dependency-injection).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Nothing in Angular pushes back when you add a line to `app.config.ts`. It is the widest-typed
provider position in the framework, it is the one file every developer already has open, and it
never errors on an entry that would have been better somewhere else — so over eighteen months it
accumulates services that could have declared themselves, feature configuration that wanted a
`provide*` of its own, `useValue` blobs keyed by strings, and at least one provider that compiles,
registers, and never runs.** This chunk and the four after it are the judgement chunks of the
topic. This one establishes *why* the array fills up and the first two of the four costs a full one
carries — the two that are paid whether or not anything ever goes wrong.

## The type-level reason the array fills up

One line explains the whole phenomenon:

- `Component.providers`, `Directive.providers` and `Component.viewProviders` are **`Provider[]`**.
- `ApplicationConfig.providers` and `Route.providers` are **`Array<Provider | EnvironmentProviders>`**.

The full acceptance table, the branded `EnvironmentProviders` type it comes from, and both `NG0207`
messages are already worked in
[03 · `EnvironmentProviders` vs `Provider`](03-environmentproviders-vs-provider.md) — do not
re-derive them. The consequence is what matters here. Every `provide*()` in the framework returns
`EnvironmentProviders`, so a component cannot hold one, and a route only helps if the thing is
genuinely feature-scoped. That leaves `app.config.ts` as the position with the fewest constraints
in the entire framework: it accepts class providers, value providers, factory providers, multi
providers, nested arrays, `EnvironmentProviders` wrappers and `importProvidersFrom` output, in any
order, with no cardinality check and no duplicate check.

**A container with no constraints is a container that fills up.** Nothing here is a design flaw —
it is the price of `ApplicationConfig` having exactly one property instead of `NgModule`'s six
([01](01-app-config-and-what-bootstrap-does-with-it.md)). But it means the discipline `NgModule`
used to impose by having a `declarations` array *and* a `providers` array *and* an `imports` array
now has to come from you, and the compiler will not help.

## Cost 1 — registration is eager, and it is not counted in lines

From [`r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts),
`R3Injector`'s constructor, verbatim:

```ts
  constructor(
    providers: Array<Provider | EnvironmentProviders>,
    readonly parent: Injector,
    readonly source: string | null,
    readonly scopes: Set<InjectorScope>,
  ) {
    super();
    // Start off by creating Records for every provider.
    forEachSingleProvider(providers as Array<Provider | InternalEnvironmentProviders>, (provider) =>
      this.processProvider(provider),
    );
```

and the walker it uses, verbatim:

```ts
function forEachSingleProvider(
  providers: Array<Provider | EnvironmentProviders>,
  fn: (provider: SingleProvider) => void,
): void {
  for (const provider of providers) {
    if (Array.isArray(provider)) {
      forEachSingleProvider(provider, fn);
    } else if (provider && isEnvironmentProviders(provider)) {
      forEachSingleProvider(provider.ɵproviders, fn);
    } else {
      fn(provider as SingleProvider);
    }
  }
}
```

Read the constructor's comment literally: *"Start off by creating Records for every provider."*
**Instantiation is lazy — registration is not.** Before your first component renders, the injector
has recursed through every nested array, unwrapped every `EnvironmentProviders` in place, and
called `processProvider` on each leaf, which ends in a `Map.set`.

That has a consequence people consistently get backwards: **the cost is not the number of lines in
the array, it is the number of leaf providers behind them**, and the call site hides that number by
design.

```ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, retryInterceptor])),
    ReportingService,
    {provide: 'API_URL', useValue: 'https://api.example.com'},
  ],
};
```

Six lines. The number of records registered at bootstrap is not six, and you cannot tell what it is
from this file: `provideRouter(routes)` contributes a whole subsystem's worth of providers plus a
`ROUTES` multi entry ([07](07-provide-router-and-the-route-array.md)), and `provideHttpClient`
contributes its backend, its handler and one `HTTP_INTERCEPTOR_FNS` entry per interceptor
([09b](09b-inside-provide-http-client.md)). That opacity is deliberate and is the entire point of
the `provide*` convention ([02](02-why-provide-functions-replaced-forroot.md)) — but it means "my
config is only twelve lines" is not a statement about anything.

⚠️ **Do not turn this into a performance argument.** A `Map.set` per leaf is cheap, and no
realistic application is slow because its provider array is long. The reason eager registration
matters is that it is what makes the other three costs unavoidable: a provider that is registered
is a provider that was imported, that can shadow another, and that can silently join a multi token.

## Cost 2 — every entry is a static reference, so every entry ships

This is [chunk 02](02-why-provide-functions-replaced-forroot.md)'s argument run in reverse. The
`forRoot` → `provide*` migration was about bundler reachability: what you do not call, you do not
ship. The mirror of that rule is that **what you do call, you ship** — and an entry in
`app.config.ts` is a call, or for a bare class provider a static import, made from a file that is
reachable from the application's entry point by definition.

That is why `ReportingService` in the array above is a bundle cost even if no component ever
injects it, while the same class annotated `@Service()` and never injected is dropped. The
decorator moves the provider record onto the class itself, so nothing in the import graph has to
mention it. angular.dev states the trade directly, in the *Tree-shaking and @Service()* callout on
[Hierarchical injectors](https://angular.dev/guide/di/hierarchical-dependency-injection):

> *"Using the `@Service()` decorator is preferable to using the `ApplicationConfig` `providers`
> array. With `@Service`, optimization tools can perform tree-shaking, which removes services that
> your application isn't using. This results in smaller bundle sizes."*
>
> *"Tree-shaking is especially useful for a library because the application which uses the library
> may not have a need to inject it."*

**The reachability cost is transitive, and that is what makes it the expensive one.** Deleting one
line does not save one class; it saves everything that class's module graph pulled in that nothing
else needed. A `provideAnalytics()` in the root config that exists for a single admin screen drags
its whole implementation into the initial chunk, where a route-level `providers` entry on the admin
route would have put it in that route's lazy chunk instead.

The full comparison — what `providedIn: 'root'` buys, what `@Service()` cannot express, and the six
cases where the array is genuinely the only home — is **14 · `providedIn: 'root'` vs listing in the
array** *(not written yet)*. The move itself, in code, is
[12c · The things with a better home](12c-the-things-with-a-better-home.md).

## Gotchas

**★ Symptom: you counted twelve providers in the config and the injector has far more records.**
Cause: `forEachSingleProvider` recurses through nested arrays *and* unwraps every
`EnvironmentProviders` in place, so one `provideRouter(routes)` contributes an unknown number of
leaves. Fix: nothing to fix — but stop reasoning about bootstrap from the line count. If you
genuinely need to know what a `provide*` contributed, the wrapper's `ɵproviders` array is readable
at runtime, which [03](03-environmentproviders-vs-provider.md) covers along with why you should not
depend on it.

**★ Symptom: a service listed in `app.config.ts` is in the production bundle although nothing
injects it.** Cause: the array entry is a static reference from a file reachable from the entry
point, so the class is reachable and the bundler keeps it. Fix: delete the entry and let the class
declare itself:

```ts
// app.config.ts — delete this line
providers: [ReportingService, provideRouter(routes)]

// reporting.ts — the record moves onto the class
@Service()
export class ReportingService {
  private readonly http = inject(HttpClient);
}
```

That is what the *Tree-shaking and @Service()* callout is about, and it is the only one of the four
costs that shows up on a bundle report.

**★ Symptom: your lazy route's chunk is tiny and the initial chunk is enormous, although the
feature's code all lives in the lazy directory.** Cause: one entry in `app.config.ts` references
the feature — a `provideFeature()`, a config token whose `useValue` imports a type from it, or a
service listed by class. Reachability does not care which directory a file is in. Fix: move the
entry to the route's `providers`, which is loaded with the route; **15 · Route-level `providers`**
*(not written yet)*.

**★ Symptom: a barrel file made a provider you deleted from the config reachable again.** Cause:
an `index.ts` that re-exports everything in a feature directory is a single import edge to all of
it, so any surviving import of the barrel keeps the whole feature reachable regardless of what the
provider array says. Fix: import from the concrete file, not the barrel — the same failure mode
[04](04-writing-your-own-provide-function.md) describes for a library's optional features.

## Interview questions

**★ Is a long provider array a runtime cost or only a bundle cost?**
Both, but very asymmetrically, and the runtime half is almost never the one that matters.
`R3Injector`'s constructor calls `processProvider` on every leaf before anything renders — the
comment says *"Start off by creating Records for every provider"* — so registration is eager and
linear in the number of leaf providers, not in the number of lines. Instantiation stays lazy: a
record is a `Map` entry, and its factory does not run until something injects the token. So the
runtime cost is some dozens of `Map.set` calls, which is nothing. The bundle cost is the real one,
because an array entry is a static reference from the entry point and it scales with whatever those
entries drag in transitively. And there is a third cost that is neither: a long array is a large
surface for a silent token collision, which
[12b](12b-collisions-multi-tokens-and-the-triage-order.md) covers.

**★ Why is the leaf count invisible from `app.config.ts`, and is that a problem?**
Because `provide*` functions return an opaque `EnvironmentProviders` whose `ɵproviders` array is
branded specifically so you cannot read it as a `Provider[]` — chunk 03's whole argument. That
opacity is the feature: it is what lets `provideRouter` change its internal provider set between
minor versions without breaking anyone, and what stops application code from filtering or
reordering a subsystem's own wiring. It is not a problem for the reason people assume it might be —
registration is cheap — but it does mean the array is not self-documenting, and that any reasoning
of the form "we only have twelve providers" is unfounded. Judge the array by what each line *means*
rather than by how many there are.

**★ Someone argues that moving providers out of `app.config.ts` is cosmetic. What is the concrete
counter-argument?**
Three concrete ones. First, bundle size: an array entry is a static reference, so a service listed
there ships whether or not anything injects it, while the same class annotated `@Service()` does
not — angular.dev states that outright in the tree-shaking callout, and the effect is transitive, so
one line can hold a whole feature in the initial chunk. Second, blast radius: a provider in the root
config is in scope for the entire application, so an accidental second registration of the same
token silently changes behaviour everywhere, whereas the same mistake inside a route's `providers`
is contained to that route. Third, change locality: a feature whose wiring lives in
`app.config.ts` cannot gain a dependency without a change to the application's root file, which is
a merge-conflict magnet in any team of more than about four people. None of those is about how the
file looks.

**★ What does `ApplicationConfig.providers` accept that `Component.providers` does not, and why
does that asymmetry drive the whole problem?**
`ApplicationConfig.providers` is `Array<Provider | EnvironmentProviders>`; `Component.providers` is
`Provider[]`. So every `provide*()` in the framework — which all return `EnvironmentProviders` —
can only be placed in an environment position: the application config, a route, an `NgModule`, or a
manually created environment injector. There is no narrower home for them at all. That is correct
and deliberate, because those functions configure application-wide subsystems. The side effect is
that the application config becomes the position that accepts strictly more than any other, so
whenever a developer is unsure where something goes, the config is the only place guaranteed to
compile. Trial and error therefore lands everything in one file, and nothing ever moves it back
out.

{/* FOOTER */}
