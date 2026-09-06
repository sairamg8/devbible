---
title: "A `forRoot()` configuration always beats a plain module's provider for the same token because `ModuleWithProviders` entries are replayed last — and the cycle check is development-only while the deduplication is not, so a cyclic module graph throws in `ng serve` and silently picks a winner in production"
sidebar_label: "08c · Ordering, cycles and multi tokens"
sidebar_position: 8.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`packages/core/src/di/provider_collection.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/provider_collection.ts)
> (`walkProviderTree`, `processInjectorTypesWithProviders`) and
> [`packages/core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts)
> (`processProvider`); plus angular.dev
> [`importProvidersFrom`](https://angular.dev/api/core/importProvidersFrom).
> Version spine: `@angular/cli` **22.1.7** · TypeScript peer `>=6.0 <6.1`. Documentation-validated;
> **no sandbox run**.

**Two of `importProvidersFrom`'s costs are not about volume at all — they are about which provider wins
and which check runs. `internalImportProvidersFrom` defers every `ModuleWithProviders` entry into a side
list and replays it *after* the plain-module walk, with a comment naming the ViewEngine bug it is
preserving compatibility with; combine that with `R3Injector.processProvider` ending its non-multi
branch in a plain `this.records.set(token, record)` and you get a rule that surprises everybody: a
`forRoot()` configuration beats an ordinary module's provider for the same token regardless of the order
you wrote them in. The multi branch does the opposite — it pushes rather than replaces, so there is no
"provide it later" escape for `HTTP_INTERCEPTORS`. And the walk's cycle detection is wrapped in
`ngDevMode` while its deduplication is not, which means a cyclic module graph is an error in `ng serve`
and a silent coin-flip in an optimised build.**

## `ModuleWithProviders` is replayed last

Entries that return `true` from `walkProviderTree` — that is, module classes that arrived wrapped in a
`ModuleWithProviders` object — are set aside and processed after everything else. The deferral happens
twice, once at the top level and once inside the recursive walk:

```ts
// Imports which are declared with providers (TypeWithProviders) need to be processed
// after all imported modules are processed. This is similar to how View Engine
// processes/merges module imports in the metadata resolver. See: FW-1349.
if (importTypesWithProviders !== undefined) {
  processInjectorTypesWithProviders(importTypesWithProviders, visitor);
}
```

and the replay itself:

```ts
function processInjectorTypesWithProviders(
  typesWithProviders: InjectorTypeWithProviders<unknown>[],
  visitor: WalkProviderTreeVisitor,
): void {
  for (let i = 0; i < typesWithProviders.length; i++) {
    const {ngModule, providers} = typesWithProviders[i];
    deepForEachProvider(
      providers! as Array<Provider | InternalEnvironmentProviders>,
      (provider) => {
        ngDevMode && validateProvider(provider, providers || EMPTY_ARRAY, ngModule);
        visitor(provider, ngModule);
      },
    );
  }
}
```

`walkProviderTree`'s doc comment states the contract in words:

> *"If an `InjectorTypeWithProviders` that declares providers besides the type is specified, the function
> will return "true" to indicate that the providers of the type definition need to be processed. This
> allows us to process providers of injector types after all imports of an injector definition are
> processed. (following View Engine semantics: see FW-1349)"*

## Last non-multi provider wins — and the multi branch does not

`R3Injector.processProvider` in `r3_injector.ts` ends like this:

```ts
if (!isTypeProvider(provider) && provider.multi === true) {
  // If the provider indicates that it's a multi-provider, process it specially.
  // First check whether it's been defined already.
  let multiRecord = this.records.get(token);
  if (multiRecord) {
    // It has. Throw a nice error if
    if (ngDevMode && multiRecord.multi === undefined) {
      throwMixedMultiProviderError();
    }
  } else {
    multiRecord = makeRecord(undefined, NOT_YET, true);
    multiRecord.factory = () => injectArgs(multiRecord!.multi!);
    this.records.set(token, multiRecord);
  }
  token = provider;
  multiRecord.multi!.push(provider);
} else {
  if (ngDevMode) {
    const existing = this.records.get(token);
    if (existing && existing.multi !== undefined) {
      throwMixedMultiProviderError();
    }
  }
}
this.records.set(token, record);
```

Two rules in one function. For a plain provider, the final `this.records.set(token, record)` **replaces**
whatever record was there — last write wins. For a `multi: true` provider, the branch above reassigns
`token = provider` so that final `set` stores the individual provider under its own identity, while the
shared `multiRecord.multi` array is **appended** to. Nothing you add later can remove an earlier multi
contribution.

🔴 **Put the two facts together.** Inside one `importProvidersFrom(...)` call, a `forRoot()`
configuration beats an ordinary module's provider of the same token — because it is replayed last — and
that is true regardless of argument order. But for `HTTP_INTERCEPTORS`, `APP_INITIALIZER`-style multi
tokens and `ROUTES`, "later" means "also", not "instead".

`ROUTES` is the clearest example, because `provideRouter` and `RouterModule.forChild` both register it as
`multi: true`. Two calls **append** two route tables rather than one replacing the other — which is why a
lazily loaded legacy module's `RouterModule.forChild(routes)` composes with the root `provideRouter`
instead of fighting it.

## The cycle check is development-only; the deduplication is not

From `walkProviderTree`:

```ts
// Check for circular dependencies.
if (ngDevMode && parents.indexOf(defType) !== -1) {
  const defName = stringify(defType);
  const path = parents.map(stringify).concat(defName);
  throw cyclicDependencyErrorWithDetails(defName, path);
}

// Check for multiple imports of the same module
const isDuplicate = dedup.has(defType);
```

The `parents` stack that feeds the cycle check is itself maintained under the same guard:

```ts
// Before processing defType's imports, add it to the set of parents. This way, if it ends
// up deeply importing itself, this can be detected.
ngDevMode && parents.push(defType);
// Add it to the set of dedups. This way we can detect multiple imports of the same module
dedup.add(defType);
```

and popped in a `finally`:

```ts
} finally {
  // Remove it from the parents set when finished.
  ngDevMode && parents.pop();
}
```

So in an optimised build `parents` is always empty, `parents.indexOf(defType)` is always `-1`, and the
cycle throw is unreachable. The walk terminates anyway — on `dedup`, which has no guard — having
collected whichever branch it reached first. **A cyclic module graph does not fail in production; it
resolves arbitrarily.**

## Gotchas

**★ Symptom: two modules both provide `API_BASE_URL` and the "wrong" one wins, no matter which order you list them in.** Cause: `internalImportProvidersFrom` defers every `ModuleWithProviders` entry into `injectorTypesWithProviders` and replays them via `processInjectorTypesWithProviders` **after** the plain-module walk (the FW-1349 comment), and `R3Injector.processProvider` ends in `this.records.set(token, record)`, so the last write wins. A `forRoot()` config therefore beats a plain module's provider of the same token in the same call. Fix: stop relying on collection order and state the winner explicitly, last, at the top level of the provider array:

```ts
// src/main.ts
bootstrapApplication(App, {
  providers: [
    importProvidersFrom(LegacyHttpModule, VendorSdkModule.forRoot({region: 'eu'})),
    {provide: API_BASE_URL, useValue: 'https://api.internal.example.com'},
  ],
});
```

**★ Symptom: a legacy module's HTTP interceptor still runs after you provided your own replacement "last".** Cause: `HTTP_INTERCEPTORS` is a `multi: true` token, and `processProvider`'s multi branch does `multiRecord.multi!.push(provider)` — it accumulates. The "last non-multi provider wins" rule does not apply, so your entry is appended to the legacy one rather than replacing it. Fix: stop importing the module and register the interceptors you want explicitly, in the order you want them to run:

```ts
// src/app/app.config.ts
import {ApplicationConfig} from '@angular/core';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {authInterceptor} from './core/auth.interceptor';
import {retryInterceptor} from './core/retry.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient(withInterceptors([authInterceptor, retryInterceptor]))],
};
```

The `withInterceptors` array order **is** execution order. ⚠️ `withFetch` is **deprecated in v22** —
`FetchBackend` is already the default and `withXhr()` is the opt-out — so do not add it here out of
habit.

**★ Symptom: a mixed-provider error appears only in development, and the production build starts fine with a `FEATURE_FLAGS` value of the wrong shape.** Cause: `throwMixedMultiProviderError()` — raised when the same token is provided both with and without `multi: true` — is called from inside `if (ngDevMode)` in *both* branches of `processProvider`. Legacy modules do this by accident when one declares `{provide: FEATURE_FLAGS, useValue: ['beta']}` and another declares the same token with `multi: true`; in production neither guard runs and you get whichever record survived. Fix: pick one shape for the token and make every provider use it:

```ts
// src/app/core/feature-flags.ts
import {InjectionToken} from '@angular/core';

export const FEATURE_FLAGS = new InjectionToken<readonly string[]>('FEATURE_FLAGS', {
  providedIn: 'root',
  factory: () => [],
});
```

**★ Symptom: an import cycle between two legacy modules blows up in `ng serve` with a cyclic-dependency path, but the production bundle boots.** Cause: `walkProviderTree`'s cycle check *and* the `parents.push`/`parents.pop` that feed it are all `ngDevMode`-guarded; `dedup.has(defType)` is not. In production `parents` is empty, the throw is unreachable, and the walk terminates on the dedup instead. Fix: break the cycle rather than shipping past it — the production build is not "working", it is landing on whichever module the walk reached first. Move the shared providers to `providedIn: 'root'` services, which belong to no module and therefore cannot participate in a module cycle:

```ts
// src/app/shared/report-cache.service.ts
import {Injectable} from '@angular/core';

@Injectable({providedIn: 'root'})
export class ReportCacheService {
  private readonly entries = new Map<string, unknown>();
  get(key: string): unknown | undefined {
    return this.entries.get(key);
  }
  set(key: string, value: unknown): void {
    this.entries.set(key, value);
  }
}
```

**★ Symptom: a diamond — two modules both importing `HttpModuleShim` — produces one set of providers, and you assume that is a dev-mode nicety that might not hold in production.** Cause: the opposite of the cycle case. `dedup` is a plain `Set` with no `ngDevMode` guard, so deduplication by module type happens in every build. Fix: nothing to fix — but do not build a design on the *cycle* check behaving the same way, because it does not. Only the dedup is unconditional, and the two live three lines apart.

**★ Symptom: a lazily loaded legacy module's `RouterModule.forChild(routes)` seems to replace the root routes rather than adding to them, or vice versa, and you cannot tell which.** Cause: `ROUTES` is registered `multi: true` by both `provideRouter` and `forChild`, so contributions **append**; what changes is which injector each contribution lands in. A `forChild` inside a module reached by `loadChildren` lands in that module's own injector, parented to the route's; the same call hoisted into `ApplicationConfig.providers` lands in the root. Fix: keep it lazy, so the scoping is explicit ([08h · Narrowing the lifetime](08h-narrowing-the-lifetime-keeping-the-module-lazy.md) has the full shape):

```ts
// src/app/app.routes.ts
import {Routes} from '@angular/router';

export const routes: Routes = [
  {
    path: 'reports',
    loadChildren: () => import('./reports/reports.module').then((m) => m.ReportsModule),
  },
];
```

## Interview questions

**★ You have two modules in one `importProvidersFrom` call and both provide the same token. Which wins, and why is your intuition wrong?**
The `ModuleWithProviders` one — the `forRoot()` call — regardless of argument order. `internalImportProvidersFrom` pushes every entry that returns `true` from `walkProviderTree` into `injectorTypesWithProviders` and replays them through `processInjectorTypesWithProviders` *after* the main walk, a deliberate ViewEngine compatibility documented in the code as FW-1349. `R3Injector.processProvider` then ends its non-multi branch with `this.records.set(token, record)`, so the last write wins. Intuition says "source order"; the mechanism says "configuration objects last".

**★ Why does the same "last one wins" reasoning fail for `HTTP_INTERCEPTORS`?**
Because `processProvider` branches on `provider.multi === true` before it reaches the final `records.set`. For a multi token it looks up or creates a single `multiRecord`, reassigns `token = provider` so the final `set` stores that provider under its own identity, and does `multiRecord.multi!.push(provider)` — every contribution is appended and all of them are injected as an array. Overriding is not possible by adding another provider later; the only way to remove a legacy interceptor is to stop the module that registers it from being walked at all.

**★ What is the difference between the cycle check and the dedup check in `walkProviderTree`, and why does it matter in production?**
The cycle check is written `if (ngDevMode && parents.indexOf(defType) !== -1)`, and the `parents.push`/`parents.pop` that feed it are themselves `ngDevMode &&`-guarded, so in an optimised build `parents` is always empty and the throw is unreachable. The dedup is a plain `dedup.has(defType)` with no guard. So a diamond import is collapsed in every build, while a genuine module import cycle is only *reported* in development; in production the walk terminates on the dedup having collected whichever branch it reached first. A build that "only fails in dev" is therefore not a dev-tooling problem — it is a production build quietly picking a winner.

**Why would the framework preserve a ViewEngine ordering quirk in the Ivy-era provider collector?**
Because the alternative was silently changing which provider wins for every application that upgraded. The comment names the issue — FW-1349 — and says the behaviour follows *"View Engine semantics"*. A `forRoot()` whose whole purpose is to configure the module it wraps must be able to override defaults the module itself declares; had Ivy switched to plain source order, a library configured through `forRoot` would suddenly be overridden by its own defaults in some import arrangements and not others. Compatibility here is not inertia, it is the semantics the convention depends on.

**Two teams both call `provideRouter` with different route arrays. What happens, and how is that different from two `provide*` calls for a non-multi token?**
The route tables are concatenated, because `provideRouter` registers `ROUTES` as `multi: true` — both arrays end up in the injected `ROUTES` value and the router sees the union. For a non-multi token, a second `provide*` call would replace the first, silently, with the last one in the flattened provider array winning. The lesson is that "calling it twice" has two completely different meanings depending on the token's multiplicity, and nothing in the call site tells you which — you have to know the token.

**How would you debug "the wrong `API_BASE_URL` is injected" in an app with three `importProvidersFrom` calls?**
Not by reordering the arguments, because the ordering rule is `ModuleWithProviders`-last rather than source-order. Establish which providers are involved by reading each module's `providers` array and its transitive `imports` by hand — the result is opaque and there is no report — then settle it declaratively: provide the token yourself, as a plain non-multi provider, at the *top level* of the bootstrap array after the `importProvidersFrom` calls. That entry is processed last in the flattened array and its `records.set` is the final write.

---

← Prev: [What it drags in](08b-what-importprovidersfrom-drags-in.md) · Index: [Topic index](README.md) · Next → [The two errors it raises](08d-the-two-errors-importprovidersfrom-raises.md)
