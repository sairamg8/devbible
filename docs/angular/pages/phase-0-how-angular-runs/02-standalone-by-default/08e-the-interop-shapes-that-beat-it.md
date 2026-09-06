---
title: "Every shape that beats `importProvidersFrom` is the same move made in a different dimension — and only one of the three is a migration: opening the module and sorting everything in it into five buckets, each with one mechanical answer"
sidebar_label: "08e · The interop shapes that beat it"
sidebar_position: 8.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`importProvidersFrom`](https://angular.dev/api/core/importProvidersFrom),
> [NgModules overview](https://angular.dev/guide/ngmodules/overview) — and `angular/angular` at tag
> `v22.1.5`:
> [`packages/core/src/di/provider_collection.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/provider_collection.ts),
> [`packages/core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts),
> and `goldens/public-api/core/index.api.md` at the same tag (`makeEnvironmentProviders`,
> `EnvironmentProviders`, `InjectionToken`).
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript
> peer `>=6.0 <6.1`. Documentation-validated; **no sandbox run**.

**Four chunks have now spent their length on why `importProvidersFrom` is expensive: the walk is eager
and total, the module class is referenced by value, the result is an opaque brand, the ordering rule
surprises everybody, and one of its two guards is compiled out of production. None of that is an argument
for doing nothing — it is an argument for one of three replacements, and all three are the same move made
in a different dimension. Narrow the **set**: read the module, convert each provider, delete the import.
Narrow the **injector**: put the providers on the route that needs them. Narrow the **lifetime**: leave
the legacy module intact and reach it through `loadChildren`. Only the first is a migration; the other
two are containment, and [08g](08g-narrowing-the-injector-and-the-lifetime.md) is theirs. This page is
the first one, because it is the only one that ends with the call deleted — and the whole of it is a
five-way sort you do by reading, with no tool to help you.**

## The three narrowings, and what each one does not fix

| Shape | Narrows | Deletes the `importProvidersFrom` call? | Reduces what the bundler must keep? | Costs |
|---|---|---|---|---|
| **1 · Provide the pieces yourself** | the **set** — you name every provider | ✅ yes, eventually | ✅ yes — the module class stops being referenced | Reading the module by hand. There is no tool for this step |
| **2 · Scope it to a route** | the **injector** — a child `EnvironmentInjector` per route subtree | ❌ no, it moves | ❌ no — the class is still referenced by value | Nothing works before first navigation to that route |
| **3 · Keep it lazy behind `loadChildren`** | the **lifetime** — the module's injector is built when the chunk loads | ❌ no, it disappears (you stop calling it at all) | ✅ yes — the module leaves the initial chunk | The module survives; you deferred the conversion, not did it |

🔴 **Only shape 1 is a migration.** Shapes 2 and 3 are containment: they make a module you have not
converted cheap and legible instead of global and invisible. That is a real and worthwhile step —
[08b](08b-what-importprovidersfrom-drags-in.md) argued that the call count is the only progress metric a
standalone migration has, and containment does not move that number. It moves the blast radius.

## Open the module. Everything in it is one of five buckets

This is the module we are deleting. It is deliberately ordinary — four providers and one import, which is
what a real `SharedModule` looks like once you stop being frightened of it:

```ts
// src/app/reports/legacy-reporting.module.ts — the "before"
import {NgModule} from '@angular/core';
import {HTTP_INTERCEPTORS, HttpClientModule} from '@angular/common/http';
import {CorrelationIdInterceptor} from './correlation-id.interceptor';
import {ReportCacheService} from './report-cache.service';
import {ReportFormatter} from './report-formatter';
import {REPORT_CACHE_TTL_MS} from './report-tokens';

@NgModule({
  imports: [HttpClientModule],
  providers: [
    ReportCacheService,
    ReportFormatter,
    {provide: REPORT_CACHE_TTL_MS, useValue: 60_000},
    {provide: HTTP_INTERCEPTORS, useClass: CorrelationIdInterceptor, multi: true},
  ],
})
export class LegacyReportingModule {}
```

| What you find | Where it goes | Why |
|---|---|---|
| A bare `@Injectable` class in `providers` | `@Injectable({providedIn: 'root'})` on the class, and delete the entry | The class then provides itself, is created on first injection, and is dropped by the bundler when nothing injects it |
| A token with `useValue` / `useFactory` / `useClass` | your own `provideX()` built on `makeEnvironmentProviders` | Keeps the configuration next to the subsystem instead of in `app.config.ts` — [topic 03 · 04](../03-the-provider-array/04-writing-your-own-provide-function.md) is the how-to |
| An Angular module with a first-party function | the function: `HttpClientModule` → `provideHttpClient(…)`, `RouterModule.forRoot(routes)` → `provideRouter(routes)`, `BrowserAnimationsModule` → `provideAnimations()` | These are the modules the migration schematic converts for you ([09](09-the-standalone-migration-schematic.md)) |
| A `multi: true` entry — `HTTP_INTERCEPTORS`, initialiser hooks, `ROUTES` | re-registered explicitly, because [08c](08c-ordering-cycles-and-multi-tokens.md) showed a multi record **appends** and can never be overridden | 🔴 The bucket that changes behaviour silently. [08f](08f-the-multi-bucket-worked-end-to-end.md) works it end to end |
| A component, directive or pipe | the consuming component's own `imports` array | Not a provider at all. [Chunk 04](04-what-imports-actually-means.md) owns template scope; [chunk 11](11-where-ngmodule-still-legitimately-appears.md) owns the re-export bundle |

`makeEnvironmentProviders` is the public constructor for the second bucket, and its doc comment says
exactly what it is for, verbatim:

> *"Wrap an array of `Provider`s into `EnvironmentProviders`, preventing them from being accidentally
> referenced in `@Component` in a component injector."*

The first three buckets of `LegacyReportingModule`, converted:

```ts
// src/app/reports/reporting.providers.ts
import {EnvironmentProviders, makeEnvironmentProviders} from '@angular/core';
import {ReportFormatter} from './report-formatter';
import {REPORT_CACHE_TTL_MS} from './report-tokens';

export interface ReportingOptions {
  readonly cacheTtlMs: number;
}

export function provideReporting(options: ReportingOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    ReportFormatter,
    {provide: REPORT_CACHE_TTL_MS, useValue: options.cacheTtlMs},
  ]);
}
```

`ReportCacheService` is not in that array on purpose: it is a bare class with no scoped dependencies, so
it belongs in bucket one and provides itself.

```ts
// src/app/reports/report-cache.service.ts
import {Injectable} from '@angular/core';

@Injectable({providedIn: 'root'})
export class ReportCacheService {
  private readonly entries = new Map<string, unknown>();

  knownIds(): string[] {
    return [...this.entries.keys()];
  }

  put(id: string, value: unknown): void {
    this.entries.set(id, value);
  }
}
```

## Delete each entry as you convert it — the module is the checklist

The reason to shrink the module in place rather than write the replacement beside it is that the module
is the only inventory you have. After three buckets, `LegacyReportingModule` is down to one line and the
remaining work is visible in the diff:

```ts
// src/app/reports/legacy-reporting.module.ts — mid-conversion, and this is a good state to commit
import {NgModule} from '@angular/core';
import {HTTP_INTERCEPTORS, HttpClientModule} from '@angular/common/http';
import {CorrelationIdInterceptor} from './correlation-id.interceptor';

@NgModule({
  imports: [HttpClientModule],
  providers: [{provide: HTTP_INTERCEPTORS, useClass: CorrelationIdInterceptor, multi: true}],
})
export class LegacyReportingModule {}
```

What is left is the fourth bucket, and it is left for last because it is the only one where a faithful
transcription is not obvious — the module you are importing is itself a shim over a `provide*` call, and
the token is `multi: true`, so [08c](08c-ordering-cycles-and-multi-tokens.md)'s "you cannot override a
multi record" applies. [08f](08f-the-multi-bucket-worked-end-to-end.md) finishes it.

## Gotchas

**★ Symptom: you converted half the module, and a token that used to resolve one way now resolves the other.** Cause: [08c](08c-ordering-cycles-and-multi-tokens.md)'s ordering rule applies only *inside* an `importProvidersFrom` call — `ModuleWithProviders` entries are replayed last, so a `forRoot()` beat a plain module regardless of argument order. The moment you provide the token yourself at the top level of the provider array, plain array order and `R3Injector.processProvider`'s final `this.records.set(token, record)` take over, and the winner can flip. Fix: while a conversion is in flight, state the winner explicitly and put it after every remaining `importProvidersFrom` call:

```ts
// src/main.ts
import {bootstrapApplication, importProvidersFrom} from '@angular/core';
import {App} from './app/app';
import {API_BASE_URL} from './app/core/api-tokens';
import {VendorSdkModule} from './app/vendor/vendor-sdk.module';

bootstrapApplication(App, {
  providers: [
    importProvidersFrom(VendorSdkModule.forRoot({region: 'eu'})),
    {provide: API_BASE_URL, useValue: 'https://api.internal.example.com'},
  ],
});
```

**★ Symptom: `ng serve` is fine after the conversion, but a component test fails with a missing provider.** Cause: `TestBed.configureTestingModule({imports: [LegacyReportingModule]})` was silently supplying the module's providers to every test that imported it, and the test never mentioned them by name. Deleting the module deletes that too. Fix: the test gets the same call the application does — and it goes in `providers`, not `imports`, because `provideReporting()` returns `EnvironmentProviders` and a component's `imports` array will not accept one:

```ts
// src/app/reports/report-list.spec.ts
import {TestBed} from '@angular/core/testing';
import {provideHttpClient} from '@angular/common/http';
import {ReportList} from './report-list';
import {provideReporting} from './reporting.providers';

TestBed.configureTestingModule({
  imports: [ReportList],
  providers: [provideHttpClient(), provideReporting({cacheTtlMs: 1000})],
});
```

**★ Symptom: you moved a bare `@Injectable` out of `@NgModule.providers` onto `providedIn: 'root'` and it can no longer inject a token that only exists in a feature injector.** Cause: `providedIn: 'root'` does not just change where the class is *declared*, it changes which injector *constructs* it — the root one, which cannot see a token provided further down the tree. Fix: promote only the classes whose dependencies are themselves root-provided; leave anything with a scoped dependency inside the provider array of the injector that owns it:

```ts
// src/app/reports/reporting.providers.ts
import {EnvironmentProviders, makeEnvironmentProviders} from '@angular/core';
import {ReportFormatter} from './report-formatter';
import {REPORT_CACHE_TTL_MS} from './report-tokens';

export function provideReporting(cacheTtlMs: number): EnvironmentProviders {
  return makeEnvironmentProviders([
    ReportFormatter,
    {provide: REPORT_CACHE_TTL_MS, useValue: cacheTtlMs},
  ]);
}
```

**Symptom: moving a bare class to `providedIn: 'root'` works, but doing the same to an `InjectionToken` throws `No provider found for …` at first injection.** Cause: a class can provide itself because it has a constructor to call; a token has nothing to construct. Fix: a token's equivalent of `providedIn: 'root'` is the second argument to its constructor, which takes both the scope and the factory:

```ts
// src/app/reports/report-tokens.ts
import {InjectionToken} from '@angular/core';

export const REPORT_CACHE_TTL_MS = new InjectionToken<number>('REPORT_CACHE_TTL_MS', {
  providedIn: 'root',
  factory: () => 60_000,
});
```

**Symptom: you deleted the last `importProvidersFrom(LegacyReportingModule)` and the module class is still in the build output.** Cause: deleting the call removes one reference, not all of them. A barrel `export * from './legacy-reporting.module'` keeps the class reachable from anything that imports the barrel, and a value import used only for a type does the same. Fix: delete the file, and let the compiler find the leftovers — every remaining import becomes a build error, which is the fastest audit available:

```ts
// src/app/reports/index.ts — after
export {provideReporting} from './reporting.providers';
export {ReportCacheService} from './report-cache.service';
export {ReportList} from './report-list';
```

**Symptom: the schematic converted three of your modules and left the fourth untouched, and you cannot see why.** Cause: the migration only recognises APIs it has a mapping for — its README says *"If an API with a standalone equivalent is detected, it may be converted automatically as well. E.g. `RouterModule.forRoot` will become `provideRouter`."* A module of your own with hand-written providers has no equivalent to detect. Fix: nothing to fix in the tool; that module is bucket-sort work. Use the fact as a triage rule — anything the schematic left is a module *you* wrote, and you are the person who can read it.

## Interview questions

**★ You inherit `importProvidersFrom(SharedModule)` in `main.ts`. Describe the procedure that ends with that line deleted.**
Open `SharedModule` and sort every entry in its `providers` and `imports` into five buckets. Bare `@Injectable` classes become `providedIn: 'root'` and leave the array entirely. Tokens with `useValue`/`useFactory` move into your own `provideX()` built on `makeEnvironmentProviders`. Angular modules with first-party functions become those functions — and you transcribe the module's *body*, not its deprecation notice. `multi: true` entries get re-registered explicitly, because a multi record appends and can never be overridden later. Components, directives and pipes are not providers at all and move to the consuming component's `imports`. Delete each entry from the module as you convert it, so the module itself is the remaining-work checklist; when it is empty, delete the file and let the compiler find every leftover import. The reading step has no tooling — the schematic converts what it recognises and leaves the rest, which is exactly the modules you wrote yourself.

**★ Why can converting a module's providers one at a time flip which provider wins, even though you changed no values?**
Because you changed which rule applies. Inside an `importProvidersFrom` call, `internalImportProvidersFrom` defers every `ModuleWithProviders` entry and replays it after the plain-module walk, so a `forRoot()` configuration beats an ordinary module's provider for the same token regardless of argument order. Once you provide that token yourself, at the top level of the bootstrap array, it is an ordinary entry in a flat array and `R3Injector.processProvider`'s final `this.records.set(token, record)` makes the *last* one win. Half-converted is the dangerous state: two rules, one array, and nothing at the call site telling you which one governs a given token.

**★ Why is `providedIn: 'root'` not automatically the right destination for a class that was in `@NgModule.providers`?**
Because it changes the injector that constructs the class, not just where the class is declared. A root-provided class is instantiated in the root environment injector and can only resolve root-level dependencies — so a service that used to be constructed inside a feature module's injector, and happily injected a token that module provided, will now fail to find it. The rule is directional: promote classes whose dependencies are all root-provided or absent, and leave classes with scoped dependencies inside the provider array of whichever injector owns those dependencies. The upside of promoting when it is safe is real, though: a `providedIn: 'root'` record is created on first injection and dropped entirely by the bundler when nothing injects it, which is a property `@NgModule.providers` never had.

**★ Why does the bucket sort look only at `providers` and `imports`, and not at `declarations` and `exports`?**
Because `importProvidersFrom` is a provider mechanism and nothing else — it collects providers and contributes nothing to any component's compilation scope. A module's `declarations` and `exports` are template scope, which standalone replaced with the consuming component's own `imports` array, and that conversion is a different job with a different failure mode ([chunk 06](06-not-a-known-element.md) owns the error you get when it is unfinished). Sorting them into the same pass is how people end up "fixing" `'app-user-card' is not a known element` by adding a provider, which cannot work. Two arrays, two jobs, two migrations.

**Why does the conversion get *harder* as the module gets smaller, rather than easier?**
Because the buckets are sorted by difficulty without anyone arranging it that way. Bare classes and value tokens are mechanical. First-party Angular modules have a published mapping. What is left at the end is the `multi: true` bucket and any module that has no equivalent — and `multi` is the one place where "provide it again, later" does not mean "replace", so a faithful transcription requires knowing what already registered the token and in what order. That is why the honest sequencing is to do the easy buckets first *and commit them*, rather than attempting the whole module in one diff.

**How would you sequence a conversion so that no single commit changes behaviour?**
Do the transcription before the improvement. First commit: replace the module with the exact functions its body calls, features included, the `multi` entries re-registered by hand, the tokens re-provided with the same values. That commit is behaviour-preserving by construction and reviewable, because every provider is now named. Second commit: modernise the pieces — class interceptors to functional ones, hand-rolled tokens to `providedIn: 'root'` factories. Third: change anything that is a genuine behaviour decision, one at a time, each with its own testing. Bundling those three is how a conversion becomes an unreviewable diff that "broke something".

---

← Prev: [The two errors it raises](08d-the-two-errors-importprovidersfrom-raises.md) · Index: [Topic index](README.md) · Next → [The multi bucket, worked end to end](08f-the-multi-bucket-worked-end-to-end.md)
