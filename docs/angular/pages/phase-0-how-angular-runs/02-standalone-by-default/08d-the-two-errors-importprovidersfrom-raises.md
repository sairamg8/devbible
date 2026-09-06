---
title: "NG0800 rejects a standalone component passed to `importProvidersFrom` and NG0207 rejects the result being used on a component — the first is `ngDevMode`-guarded so it goes silent in production, and the second has two different messages under one code chosen by the `ɵfromNgModule` brand"
sidebar_label: "08d · The two errors it raises"
sidebar_position: 8.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [NG0207](https://angular.dev/errors/NG0207) — and `angular/angular` at tag `v22.1.5`:
> [`packages/core/src/di/provider_collection.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/provider_collection.ts),
> [`packages/core/src/render3/errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts),
> [`packages/core/src/errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts).
> Version spine: `@angular/cli` **22.1.7** · TypeScript peer `>=6.0 <6.1`. Documentation-validated;
> **no sandbox run** — every error string below is quoted from the source that throws it.

**`importProvidersFrom` guards two things and they fail in opposite ways. NG0800 rejects the wrong
*argument* — a standalone component instead of an `NgModule` — and its guard sits inside
`if ((typeof ngDevMode === 'undefined' || ngDevMode) && checkForStandaloneCmp)`, so an optimised build
drops the throw entirely and quietly collects nothing. NG0207 rejects the wrong *destination* — the
result landing in a `@Component.providers` array — and it is a real runtime throw in every build, backed
by a type error TypeScript should have raised first. NG0207 carries two distinct messages under one
code, and which one you see is decided by the `ɵfromNgModule: true` brand `importProvidersFrom` stamps on
its result. Neither error is about `NgModule` semantics; both are about the two arrays being different
types, which is [chunk 07b](07b-imports-split-in-two-and-providers-gained-four-homes.md)'s subject.**

## NG0800 — you passed it a standalone component

The guard, verbatim from `internalImportProvidersFrom` in `provider_collection.ts`:

```ts
if ((typeof ngDevMode === 'undefined' || ngDevMode) && checkForStandaloneCmp) {
  const cmpDef = getComponentDef(source);
  if (cmpDef?.standalone) {
    throw new RuntimeError(
      RuntimeErrorCode.IMPORT_PROVIDERS_FROM_STANDALONE,
      `Importing providers supports NgModule or ModuleWithProviders but got a standalone component "${stringifyForError(
        source,
      )}"`,
    );
  }
}
```

`IMPORT_PROVIDERS_FROM_STANDALONE = 800` in `packages/core/src/errors.ts`, so the runtime code is
**NG0800** and the message you get for a component called `UserCard` reads:

```
Importing providers supports NgModule or ModuleWithProviders but got a standalone component "UserCard"
```

🔴 **The check is `ngDevMode`-guarded, and that is the part worth remembering.** In an optimised build
`ngDevMode` is defined and falsy, the condition is `false`, and the throw is dropped. Execution falls
through to `walkProviderTree`, which contains:

```ts
} else if (cmpDef && !cmpDef.standalone) {
  return false;
}
```

— a standalone component def does not match that branch either, and the walk collects nothing useful
from it. You get **no error and no providers**: the failure resurfaces later as a missing dependency at
the point of injection, in a file that has nothing to do with the mistake.

### Why the parameter exists at all

Note `checkForStandaloneCmp`. The framework's own internal call site passes `false`, because walking a
standalone component's dependency graph is exactly what it needs to do when that component's `imports`
array carries providers — and `walkProviderTree`'s doc comment lists a standalone `ComponentType` as one
of the three things it is designed to visit:

> *"The logic visits an `InjectorType`, an `InjectorTypeWithProviders`, or a standalone `ComponentType`,
> and all of its transitive providers and collects providers."*

So the guard is a **public-API ergonomics check**, not a structural impossibility. The internal path
depends on the very case the public function forbids, which is why the flag is a parameter rather than a
hard-coded rejection.

### There is nothing to reach for instead

If a class is standalone it has no providers to hoist. Its services reach you through
`@Injectable({providedIn: 'root'})`, or through the provider array of whichever environment injector you
want them in; its directives and pipes reach a template through the consuming component's own `imports`.
The correct fix is deletion, not substitution.

## NG0207 — the result landed on a component

`packages/core/src/render3/errors_di.ts` raises one code with two messages, and the branch is chosen by
the brand:

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

`PROVIDER_IN_WRONG_CONTEXT = -207` — the negative sign means the code is a *runtime* error rather than a
compiler diagnostic — so it surfaces as **NG0207**. The `ɵfromNgModule: true` field that
`importProvidersFrom` stamps on its return value exists for this one branch: it lets the runtime name
`importProvidersFrom` specifically instead of saying "some environment providers".

angular.dev's [NG0207](https://angular.dev/errors/NG0207) page states the rule, verbatim:

> *"This error occurs when `EnvironmentProviders` are used in a context that only accepts regular
> providers, such as a component's `providers` array. Environment providers are designed for
> application-wide configuration and can only be used in environment injectors (like the root injector
> configured in `bootstrapApplication` or route configurations)."*

> *"The error message specifies which provider caused the issue. Check that all items in your component's
> `providers` array are regular providers, not environment providers returned by functions like
> `provideHttpClient()`, `provideRouter()`, or `importProvidersFrom()`."*

**TypeScript should catch this first.** `@Component.providers` is inherited from `Directive` and typed
`Provider[]` with no `EnvironmentProviders` member, while `ApplicationConfig.providers` and
`Route.providers` are `Array<Provider | EnvironmentProviders>`. If NG0207 reaches you at runtime,
something in the chain is `any` — a spread of a loosely typed constant, a helper returning `any[]`, or a
`providers` array assembled in a `.js` file.

## The compile-time cousin, for contrast

The mirror-image mistake — putting a `forRoot()` call in a component's `imports` array instead of its
`providers` array — is caught by the compiler, not the runtime, as **NG2012** with a bespoke message:

```ts
makeDiagnostic(
  ErrorCode.COMPONENT_UNKNOWN_IMPORT,
  origin,
  `Component imports contains a ModuleWithProviders value, likely the result of a 'Module.forRoot()'-style call. ` +
    `These calls are not used to configure components and are not valid in standalone component imports - ` +
    `consider importing them in the application bootstrap instead.`,
)
```

[Chunk 05d](05d-the-errors-that-reject-an-import-outright.md) owns NG2012 in full. The three errors
together describe one fence from three sides: NG2012 says *a configuration object is not template
scope*, NG0207 says *environment providers are not component providers*, and NG0800 says *a standalone
class is not a module*.

## Gotchas

**★ Symptom: `Importing providers supports NgModule or ModuleWithProviders but got a standalone component "UserCard"`.** Cause: NG0800 — you passed a standalone component to `importProvidersFrom`, usually while translating a `declarations` array or after a class stopped being a module. A standalone class has no providers to hoist. Fix: delete the call; the class reaches your template through the consuming component's `imports`, and its services through `providedIn: 'root'`:

```ts
// src/main.ts — before: NG0800 in dev, silence in prod
bootstrapApplication(App, {providers: [importProvidersFrom(UserCard)]});

// after
bootstrapApplication(App, {providers: []});
```

```ts
// src/app/dashboard.ts — the class belongs here, not in a provider array
import {Component} from '@angular/core';
import {UserCard} from './user-card';

@Component({
  selector: 'app-dashboard',
  imports: [UserCard],
  template: `<app-user-card />`,
})
export class Dashboard {}
```

**★ Symptom: the NG0800 case above throws in `ng serve` but the production build starts fine and a service is missing at runtime.** Cause: the guard is wrapped in `if ((typeof ngDevMode === 'undefined' || ngDevMode) && checkForStandaloneCmp)`. Optimised builds define `ngDevMode` as falsy, so the throw is dropped, `walkProviderTree` collects nothing from a standalone component def, and the mistake becomes a missing-provider error somewhere else entirely. Fix: treat every NG0800 seen in development as a production bug, and never ship past one on the grounds that "the prod build is fine" — it is fine because the check was compiled out.

**★ Symptom: `Invalid providers from 'importProvidersFrom' present in a non-environment injector. 'importProvidersFrom' can't be used for component providers.`** Cause: NG0207 — the result landed in a `@Component.providers` array. The specific wording (rather than the generic `EnvironmentProviders` one) is chosen by the `ɵfromNgModule: true` brand. Fix: move it to an environment injector, preferring the narrower one:

```ts
// src/app/app.routes.ts
import {Routes} from '@angular/router';
import {importProvidersFrom} from '@angular/core';
import {LegacyReportingModule} from './reports/legacy-reporting.module';

export const routes: Routes = [
  {
    path: 'reports',
    providers: [importProvidersFrom(LegacyReportingModule)],
    loadComponent: () => import('./reports/report-list').then((m) => m.ReportList),
  },
];
```

**★ Symptom: you get the *generic* NG0207 message — `Invalid providers present in a non-environment injector.` — and go looking for an `importProvidersFrom` call that does not exist.** Cause: the generic branch fires for any `EnvironmentProviders` value without the `ɵfromNgModule` flag, which means a `provide*()` function: `provideHttpClient()`, `provideRouter()`, `provideAnimations()`, or your own `makeEnvironmentProviders` wrapper. Fix: read the branch, not the code — the message names which kind of value it was. Move the `provide*` call to `ApplicationConfig.providers`:

```ts
// src/app/app.config.ts
import {ApplicationConfig} from '@angular/core';
import {provideHttpClient} from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient()],
};
```

**★ Symptom: NG0207 in a codebase where TypeScript is strict and the component's `providers` array looks correctly typed.** Cause: the array was assembled somewhere the type was lost — a shared `const PROVIDERS = [...]` inferred as `any[]`, a helper returning `Provider[]` that was cast, or a spread of a value coming from a `.js` file with `allowJs`. TypeScript would have rejected an `EnvironmentProviders` in a `Provider[]` directly. Fix: annotate the shared constant so the error moves to compile time where it belongs:

```ts
// src/app/reports/report-providers.ts
import {Provider} from '@angular/core';
import {ReportFormatter} from './report-formatter';

export const REPORT_COMPONENT_PROVIDERS: Provider[] = [ReportFormatter];
```

**★ Symptom: you defeated the type error with `as any` because "it worked in the NgModule version".** Cause: it did — `@NgModule.providers` is typed `Array<Provider | EnvironmentProviders>`, and `@Component.providers` is not. The asymmetry is the migration's whole point: a module was an environment injector, a component is not. Fix: decide which lifetime you actually want. App-wide goes in `ApplicationConfig.providers`; route-subtree goes in `Route.providers`; genuinely per-component-instance state is a plain `Provider` and never needed `importProvidersFrom`:

```ts
// src/app/reports/report-row.ts
import {Component} from '@angular/core';
import {RowEditBuffer} from './row-edit-buffer';

@Component({
  selector: 'app-report-row',
  providers: [RowEditBuffer],
  template: `<span>{{ buffer.label() }}</span>`,
})
export class ReportRow {
  constructor(readonly buffer: RowEditBuffer) {}
}
```

**★ Symptom: NG0800 never fires even in development, and `importProvidersFrom` silently returns an empty set.** Cause: you passed something that is neither a module nor a standalone component — a plain service class, an `InjectionToken`, or `undefined` from a circular ES module import. `getComponentDef(source)` returns `null`, so the standalone check does not fire, and `walkProviderTree` finds no injector def to walk. Fix: check what you imported; a circular import between two barrel files is the usual cause, and the fix is to import the module from its own file rather than through the barrel:

```ts
// src/main.ts
import {LegacyReportingModule} from './app/reports/legacy-reporting.module';

bootstrapApplication(App, {providers: [importProvidersFrom(LegacyReportingModule)]});
```

## Interview questions

**★ What happens if you pass a standalone component to `importProvidersFrom` in a production build?**
Nothing useful, and nothing loud. The NG0800 guard is inside `if ((typeof ngDevMode === 'undefined' || ngDevMode) && checkForStandaloneCmp)`, so an optimised build drops the throw. `walkProviderTree` then finds a component def that *is* standalone, does not take the `cmpDef && !cmpDef.standalone` early-return either, and collects nothing you wanted. You get a missing provider at the point of injection instead of a clear error at bootstrap — which is why an NG0800 seen in `ng serve` must be treated as a production bug rather than a development inconvenience.

**★ Why does NG0207 have two different messages, and what decides which one you see?**
`importProvidersFrom` stamps `ɵfromNgModule: true` on its return value; a `provide*()` function's `makeEnvironmentProviders` result does not. `errors_di.ts` branches on that flag and throws either *"Invalid providers from 'importProvidersFrom' present in a non-environment injector"* or the generic *"Invalid providers present in a non-environment injector"*. Both are `PROVIDER_IN_WRONG_CONTEXT = -207`. The flag exists purely so the error can name the culprit — it is the only functional difference between the two kinds of `EnvironmentProviders` value.

**★ Why does the framework's own code call `internalImportProvidersFrom` with `checkForStandaloneCmp: false`?**
Because the internal path is doing precisely what the public API forbids. When a standalone component's `imports` array carries providers, Angular walks that component's dependency graph to collect them — and `walkProviderTree` is documented to visit *"an `InjectorType`, an `InjectorTypeWithProviders`, or a standalone `ComponentType`"*. The flag gates a public-API ergonomics check, not a structural impossibility. It is a good example of a guard that protects callers from a mistake rather than protecting the framework from an invalid state.

**If NG0207 is a runtime error, why is it usually described as a type problem?**
Because in a correctly typed codebase it is unreachable. `Directive.providers`, which `Component` inherits, is `Provider[]`; `EnvironmentProviders` is the branded phantom `{ ɵbrand: 'EnvironmentProviders' }` and is not assignable to it. So the compiler rejects the assignment before the runtime ever sees the array. NG0207 firing means the type was lost somewhere — a loosely inferred shared constant, a cast, a `.js` file — and the useful debugging step is to find where, not to move the provider and move on.

**How would you explain NG2012, NG0207 and NG0800 as one rule rather than three errors?**
They are the three faces of the split that made components standalone. `@NgModule.imports` used to accept classes *and* configuration objects and used to feed both a compilation scope and an injector; `@NgModule.providers` used to accept environment providers. Standalone separated all of that. NG2012 says a configuration object is not template scope, at compile time. NG0207 says environment providers are not component providers, at runtime. NG0800 says a standalone class is not a module, at bootstrap. One boundary, three checkpoints, each in the layer that can see the mistake earliest.

**Why is `PROVIDER_IN_WRONG_CONTEXT` a negative number in the error enum?**
Angular's error enum uses the sign to separate runtime errors from compiler diagnostics: `formatRuntimeError` renders the absolute value with the `NG0` prefix, so `-207` becomes `NG0207` at runtime, while a positive compiler code such as `COMPONENT_UNKNOWN_IMPORT = 2012` becomes `NG2012` in a build diagnostic. When you are given a bare code by a bug report, the digit count tells you which half of the stack raised it — a four-digit `NG2xxx` or `NG8xxx` came from `ngtsc`, an `NG0xxx` came from the runtime.

---

← Prev: [Ordering, cycles and multi tokens](08c-ordering-cycles-and-multi-tokens.md) · Index: [Topic index](README.md) · Next → [The standalone migration schematic](09-the-standalone-migration-schematic.md)
