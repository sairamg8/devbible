---
title: "EnvironmentProviders is a branded opaque type whose only job is to make provideRouter() on a component a compile error"
sidebar_label: "03 · EnvironmentProviders vs Provider"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`EnvironmentProviders`](https://angular.dev/api/core/EnvironmentProviders),
> [`makeEnvironmentProviders`](https://angular.dev/api/core/makeEnvironmentProviders),
> [`importProvidersFrom`](https://angular.dev/api/core/importProvidersFrom) — and `angular/angular`
> at tag `v22.1.5`:
> [`di/interface/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/interface/provider.ts),
> [`di/provider_collection.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/provider_collection.ts),
> [`render3/errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts),
> `goldens/public-api/core/index.api.md`. Documentation-validated; **no sandbox run**.

**`ApplicationConfig.providers` is typed `Array<Provider | EnvironmentProviders>` and a component's
`providers` is typed `Provider[]`. That single difference is the whole enforcement mechanism: it is
why `provideRouter()` on a component does not compile, and why the framework needed to invent an
opaque wrapper type that carries no useful information at all.**

## The type, in full

```ts
/**
 * Encapsulated `Provider`s that are only accepted during creation of an `EnvironmentInjector` (e.g.
 * in an `NgModule`).
 *
 * Using this wrapper type prevents providers which are only designed to work in
 * application/environment injectors from being accidentally included in
 * `@Component.providers` and ending up in a component injector.
 *
 * This wrapper type prevents access to the `Provider`s inside.
 */
export type EnvironmentProviders = {
  ɵbrand: 'EnvironmentProviders';
};
```

Three separate claims in that comment, each true and each load-bearing:

1. **"only accepted during creation of an `EnvironmentInjector`"** — an application injector, an
   `NgModule` injector, or a route injector. Not a component injector.
2. **"prevents … from being accidentally included in `@Component.providers`"** — this is a *type*
   guarantee, checked by `tsc`, not a runtime convention.
3. **"prevents access to the `Provider`s inside"** — the declared type has one phantom property.
   You cannot read the array, spread it, filter it, or replace one entry of it. That is deliberate:
   the wrapper is a capability token, not a container.

At runtime the object is a real record with a `ɵproviders` array on it; `isEnvironmentProviders()`
checks for it. But nothing in the *public* type surface exposes that, so no supported code can
depend on the internals.

## Where each type is accepted — the table that answers most questions

Measured from `goldens/public-api/core/index.api.md` at `v22.1.5`:

| Position | Declared type | Accepts `EnvironmentProviders`? |
|---|---|---|
| `ApplicationConfig.providers` | `Array<Provider \| EnvironmentProviders>` | **yes** |
| `Route.providers` (`@angular/router`) | `Array<Provider \| EnvironmentProviders>` | **yes** |
| `NgModule.providers` | `Array<Provider \| EnvironmentProviders>` | **yes** |
| `createEnvironmentInjector(providers, parent, debugName?)` | `Array<Provider \| EnvironmentProviders>` | **yes** |
| `Directive.providers` / `Component.providers` | `Provider[]` | **no** |
| `Component.viewProviders` | `Provider[]` | **no** |
| `PlatformRef` / `createPlatformFactory` | `StaticProvider[]` | **no** |
| `TestBed.configureTestingModule({ providers })` | `any[]` | **yes, but unchecked** — see the gotchas |

## The two errors, verbatim

The type error comes first, at build time. Put `provideRouter(routes)` in a component's `providers`
and `tsc` rejects it because `EnvironmentProviders` is not assignable to `Provider`.

If you defeat the type check — a cast, an `any`, a `TestBed` call, a JavaScript consumer — the
runtime check catches it. From `packages/core/src/render3/errors_di.ts` at `v22.1.5`, inside
`throwInvalidProviderError`:

```ts
} else if (isEnvironmentProviders(provider)) {
  if (provider.ɵfromNgModule) {
    throw new RuntimeError(
      RuntimeErrorCode.PROVIDER_IN_WRONG_CONTEXT,
      `Invalid providers from 'importProvidersFrom' present in a non-environment injector. 'importProvidersFrom' can't be used for component providers.`,
    );
  } else {
    throw new RuntimeError(
      RuntimeErrorCode.PROVIDER_IN_WRONG_CONTEXT,
      `Invalid providers present in a non-environment injector. 'EnvironmentProviders' can't be used for component providers.`,
    );
  }
}
```

`PROVIDER_IN_WRONG_CONTEXT` is `-207`, so the message you see is prefixed **`NG0207:`** and, in a
development build, suffixed with `Find more at https://angular.dev/errors/NG0207`. Note that the
framework distinguishes the `importProvidersFrom` case, because that one has a different fix.

## Why an opaque brand rather than a nominal class

A class would work — `instanceof` is a runtime check — but it would not survive erasure into the
structural type system TypeScript actually has, and it would make every `provide*` return value a
heap object with a prototype for no benefit. A phantom property is checked entirely at compile time
and costs nothing at runtime. The cost is the error message quality: assign an `EnvironmentProviders`
where a `Provider` is wanted and TypeScript talks about a missing `ɵbrand` property, which reads as
noise until you know what it means.

🔴 **What resolution actually does with these — how the environment injector differs from an element
injector, what `@Self`, `@SkipSelf` and `@Host` do to the walk, why a component injector is a
different kind of thing — is Phase 6, "Dependency injection".** This chunk is only about the *type*
that keeps the two apart.

## `importProvidersFrom` — the bridge, and its price

```ts
function importProvidersFrom(...sources: ImportProvidersSource[]): EnvironmentProviders;
```

> *"Collects providers from all NgModules and standalone components, including transitively imported
> ones."*

and, from the same reference page:

> *"[Providers] are only usable in an application injector or another environment injector (such as
> a route injector). They should not be used in component providers."*

Use it when a library you depend on still ships only an `NgModule`:

```ts
// src/app/app.config.ts
import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { LegacyChartsModule } from '@vendor/legacy-charts';

export const appConfig: ApplicationConfig = {
  providers: [
    importProvidersFrom(LegacyChartsModule),
  ]
};
```

The price is real and worth stating plainly. `importProvidersFrom` walks the module's **entire
transitive `imports` graph** and collects every provider it finds. There is no branch to prune,
because there is no call site to leave uncalled — you get the module's whole provider surface,
which is precisely the tree-shaking property [chunk 02](02-why-provide-functions-replaced-forroot.md)
says `provide*` was invented to recover. It is a bridge, not a destination; when the library ships
`provideVendorCharts()`, migrate.

## Writing the pattern yourself

`makeEnvironmentProviders` is the public constructor for the wrapper:

> *"Wrap an array of `Provider`s into `EnvironmentProviders`, preventing them from being
> accidentally referenced in `@Component` in a component injector."*

```ts
function makeEnvironmentProviders(
  providers: (Provider | EnvironmentProviders)[],
): EnvironmentProviders;
```

[Chunk 04](04-writing-your-own-provide-function.md) uses it to build a `provideBilling()` with its
own `with*` features. The important observation for now is that the signature takes
`(Provider | EnvironmentProviders)[]` — you can nest wrappers, which is how `provideZonelessChangeDetection()`
wraps `provideZonelessChangeDetectionInternal()` and how a library's `provideX()` can compose
`provideHttpClient()`.

## Gotchas

**★ Symptom: `Type 'EnvironmentProviders' is not assignable to type 'Provider'. Property 'ɵbrand' is
missing…`** Cause: a `provide*` call landed in a component's or directive's `providers`. Fix: move
it to `ApplicationConfig.providers`, or to a `Route.providers` if it is genuinely feature-scoped.

```ts
// wrong
@Component({ selector: 'app-orders', providers: [provideHttpClient()], template: '' })
export class Orders {}

// right — application wiring lives in the config
export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient()]
};
```

**★ Symptom: `NG0207: Invalid providers present in a non-environment injector. 'EnvironmentProviders'
can't be used for component providers.`** Cause: the type check was bypassed — usually a
`as any`, a `Provider[]` variable that was widened, or a spread through an untyped helper. Fix: type
the helper. A local array declared as `const extra = [provideHttpClient()]` infers
`EnvironmentProviders[]` and will not silently pass; a `const extra: any[] = [...]` will.

**★ Symptom: `NG0207: Invalid providers from 'importProvidersFrom' present in a non-environment
injector.`** Cause: the distinct branch — someone reached for `importProvidersFrom(SomeModule)`
inside a component to get "just this component's copy" of a legacy module's services. That is not
what it does and cannot be made to do it. Fix: if you genuinely need a per-component instance, list
the concrete service class in the component's `providers`; if you need the module's root wiring,
put `importProvidersFrom` in the application config.

**★ Symptom: a `TestBed` test passes while the same providers fail in the application.** Cause:
`TestModuleMetadata.providers` is declared `any[]`, so the compile-time guard does not apply in
tests at all. `TestBed` builds an environment injector, so `EnvironmentProviders` are legitimately
accepted there — but the reverse also holds: a test cannot prove that a provider is placeable on a
component. Fix: do not use a green test as evidence that a provider belongs in a component; check
the declared type of the position you are targeting.

**★ Symptom: you want to inspect or filter what `provideRouter()` returned.** Cause: the wrapper
type has exactly one phantom property and no public accessor; `ɵproviders` exists at runtime but is
internal and unsupported. Fix: do not try. If you need conditional wiring, branch at the call site
and return different `EnvironmentProviders` from your own function —

```ts
export function provideAnalytics(enabled: boolean): EnvironmentProviders {
  return makeEnvironmentProviders(
    enabled
      ? [AnalyticsClient, { provide: ANALYTICS_ENDPOINT, useValue: '/collect' }]
      : [{ provide: AnalyticsClient, useClass: NoopAnalyticsClient }],
  );
}
```

**★ Symptom: an `NgModule`-based library's providers work but its *directives* do not.** Cause:
`importProvidersFrom` collects **providers only**. Components, directives and pipes declared by the
module are not made available to any template — templates get their dependencies from a component's
own `imports`. Fix: import the module (or the individual standalone directives) into the component's
`imports` as well; `importProvidersFrom` is not a substitute for that.

## Interview questions

**★ Why can't you put `provideHttpClient()` in a component's `providers` array?**
Because it returns `EnvironmentProviders` and `Directive.providers` is declared `Provider[]`, so it
does not type-check; and if you force it past the compiler, the injector throws `NG0207: Invalid
providers present in a non-environment injector.` The reason behind the reason is that
`provideHttpClient` configures an application-wide subsystem — one `HttpClient`, one interceptor
chain, one XSRF configuration. A component injector is created and destroyed with a component
instance, so the same wiring would be built and torn down repeatedly with no defined precedence.
The type stops you before the semantics can confuse you.

**★ `EnvironmentProviders` carries no information you can read. What is it for, then?**
It is a capability marker. Its entire value is in the positions where TypeScript will and will not
accept it — the union `Array<Provider | EnvironmentProviders>` on `ApplicationConfig.providers`,
`Route.providers`, `NgModule.providers` and `createEnvironmentInjector`, versus the bare
`Provider[]` on `Component.providers`. Making it opaque is what stops a consumer from unwrapping it
and re-wrapping it somewhere the framework did not intend.

**★ When is `importProvidersFrom` the right call, and what does it cost?**
It is right when a dependency's public API is still an `NgModule` and there is no `provide*`
equivalent. It costs tree-shaking: it collects providers from the module and everything in its
transitive `imports` graph, unconditionally, because there is no call site to leave uncalled. It
also collects providers only — the module's declared directives still have to be imported into the
component that uses them. Treat it as a migration bridge with a date on it.

**Does `EnvironmentProviders` mean the providers are eagerly created?**
No. The wrapper is about *where* the providers may be registered, not *when* they are instantiated.
Registration is eager — the records go into the injector at creation — but instantiation is lazy,
on first injection, exactly as for a plain `Provider`. The one exception is an initializer, which is
a multi-provider the framework itself injects during bootstrap
([chunk 06](06-startup-and-error-listener-providers.md)).

**Could Angular have used a class instead of a branded type?**
It could have, and `instanceof` would have worked at runtime. It would have cost a prototype and an
allocation for every `provide*` return value, and it would not have given a *better* compile-time
guarantee, because TypeScript's structural typing means a class with one private field and a type
with one phantom field are equally effective as a nominal marker. The chosen design is the cheapest
thing that makes the wrong code fail to compile.

---

← Prev: [Why provide* replaced forRoot](02-why-provide-functions-replaced-forroot.md) · Index: [Topic index](README.md) · Next → [Writing your own provide function](04-writing-your-own-provide-function.md)
