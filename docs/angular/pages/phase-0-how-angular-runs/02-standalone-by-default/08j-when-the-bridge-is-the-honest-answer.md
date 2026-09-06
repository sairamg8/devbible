---
title: "The migration schematic's own output is the rule in one example — it converts every module with a `provide*` equivalent and leaves exactly one `importProvidersFrom` standing, which is what the call is for: a residue, in four nameable situations, not a habit"
sidebar_label: "08j · When the bridge is honest"
sidebar_position: 8.9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev [NgModules overview](https://angular.dev/guide/ngmodules/overview), [`importProvidersFrom`](https://angular.dev/api/core/importProvidersFrom) — and `angular/angular` at tag `v22.1.5`:
> [`packages/core/schematics/ng-generate/standalone-migration/README.md`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/ng-generate/standalone-migration/README.md),
> [`packages/core/src/di/provider_collection.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/provider_collection.ts),
> and [`goldens/public-api/upgrade/static/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/upgrade/static/index.api.md).
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`. Documentation-validated; **no sandbox run**.

**Five pages have now argued against `importProvidersFrom`, which makes this one necessary: a chapter
that only said "never use it" would be lying, and a reader who took that literally would go and
reimplement a vendor's private provider list from its typings — which is strictly worse than the thing
they were avoiding. The function is a *residue*, and the migration schematic's own published output shows
exactly what residue means: everything with a `provide*` equivalent gets converted, and one call is left
standing for the one module that has none. There are four situations where that call is the right answer,
they are nameable, and the discipline is not avoiding the function — it is being able to say which of the
four you are in, in a comment, at the call site.**

## The schematic's output is the rule in one example

Verbatim from `packages/core/schematics/ng-generate/standalone-migration/README.md` at `v22.1.5` — this
is what `--mode=standalone-bootstrap` produces:

```ts
bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(SharedModule),
    {provide: token, useValue: {foo: true, bar: {baz: false}}},
    {provide: CONFIG, useClass: ExportedConfigClass},
    provideAnimations(),
    provideRouter(
      [
        {
          path: 'shop',
          loadComponent: () => import('./app/shop/shop.component').then((m) => m.ShopComponent),
        },
      ],
      withEnabledBlockingInitialNavigation(),
    ),
  ],
}).catch((e) => console.error(e));
```

Read what the migration chose. `RouterModule.forRoot(...)` became `provideRouter(...)`.
`BrowserAnimationsModule` became `provideAnimations()`. Plain providers were carried across unchanged.
Only `SharedModule` — which has no `provide*` equivalent, because nobody wrote one — stayed behind
`importProvidersFrom`. The schematic states the policy itself, verbatim:

> *"If an API with a standalone equivalent is detected, it may be converted automatically as well. E.g.
> `RouterModule.forRoot` will become `provideRouter`."*

**`importProvidersFrom` is what is left after every module with a real function has been converted.**
That is not a workaround the tool fell back on; it is the tool's correct output, and it is a useful
triage signal — every call the schematic emits names a module *you* wrote, which is exactly the
population [08e](08e-the-interop-shapes-that-beat-it.md)'s bucket sort applies to.

## The four situations

**1 · A third-party module you do not control, with no `provide*` equivalent.** The alternative —
copying its provider list out of its published typings — is a dependency on an implementation detail
that neither side is watching. Use the bridge, and scope it as narrowly as the module allows
([08g](08g-narrowing-the-injector-and-the-lifetime.md)).

⚠️ **Do not generalise about which libraries this covers.** Only `@angular/material` 22.1.5 and
`@angular/upgrade` 22.1.5 were checked for this corpus. "Most libraries still ship `NgModule`s" is not a
claim this page can make; whether *your* dependency does is a question you answer by opening its
`.d.ts`, one package at a time.

**2 · A module whose providers the framework consumes at bootstrap.** An app initialiser, a global
`ErrorHandler`, an interceptor every request must pass through, a locale. A route injector does not exist
when those are read, so `ApplicationConfig.providers` is the only place they can go — which means the
route narrowing is unavailable and the bootstrap form is not a compromise but the answer.

**3 · A migration in progress.** A call with a comment naming what you needed from it, and a ticket, is a
tracked work item. The count of calls is the progress metric ([08b](08b-what-importprovidersfrom-drags-in.md)),
and a metric with a number on it is a healthier state than a codebase that has "finished migrating"
because nobody counted.

**4 · A hybrid AngularJS application.** `@angular/upgrade` is published at 22.1.5 and `UpgradeModule` is
a live, undeprecated `NgModule` — from `goldens/public-api/upgrade/static/index.api.md`, verbatim:

```ts
// @public
export class UpgradeModule {
    $injector: any;
    constructor(
    injector: Injector,
    ngZone: NgZone,
    platformRef: PlatformRef);
    bootstrap(element: Element, modules?: string[], config?: any): any;
    injector: Injector;
    ngZone: NgZone;
    static ɵmod: i0.ɵɵNgModuleDeclaration<UpgradeModule, never, never, never>;
}
```

Here the module is the mechanism rather than a leftover: two injectors have to be bridged and this class
is the bridge. [Chunk 11](11-where-ngmodule-still-legitimately-appears.md) owns the hybrid case in full.

**Anything outside those four is case 3 and nobody has noticed.**

## What the call site should say

The single highest-value thing you can add to a legitimate `importProvidersFrom` is a comment naming
which of the four you are in and what you needed. It costs one line and it is the only documentation the
call will ever have, because the result is opaque and the walk leaves no report:

```ts
// src/app/app.config.ts
import {ApplicationConfig, importProvidersFrom} from '@angular/core';
import {VendorSdkModule} from '@vendor/sdk';

export const appConfig: ApplicationConfig = {
  providers: [
    // Case 1 + 2: @vendor/sdk ships no provideVendorSdk(), and its ErrorHandler override
    // must be installed before bootstrap, so this cannot move to a route.
    // Tracked in PLAT-1841; delete when the vendor ships a function.
    importProvidersFrom(VendorSdkModule.forRoot({region: 'eu'})),
  ],
};
```

## Gotchas

**★ Symptom: you avoided `importProvidersFrom(VendorSdkModule)` by copying its provider list out of the published typings, and the app broke on a patch upgrade.** Cause: a module's `providers` array is not public API. What is published is the class and its `ɵinj` definition, and the contents can change in any release with no deprecation cycle and no changelog entry — because from the vendor's point of view nothing observable changed. Fix: use the supported bridge and contain it at the narrowest injector the module allows:

```ts
// src/app/app.routes.ts
import {Routes} from '@angular/router';
import {importProvidersFrom} from '@angular/core';
import {VendorSdkModule} from '@vendor/sdk';

export const routes: Routes = [
  {
    path: 'checkout',
    // Case 1: vendor ships no provideVendorSdk(). Only checkout needs it. PLAT-1841.
    providers: [importProvidersFrom(VendorSdkModule.forRoot({region: 'eu'}))],
    loadComponent: () => import('./checkout/checkout').then((m) => m.Checkout),
  },
];
```

**★ Symptom: an `importProvidersFrom` call has been in `main.ts` for three years and nobody can say why.** Cause: case 3 without the tracking. The call is a work item that was never written down, and because the return value is opaque and the walk emits no report, the only documentation it could ever have had was a comment nobody wrote. Fix: every remaining call gets a comment naming the case and what you needed, so the next reader knows what to check before deleting it:

```ts
// src/app/app.config.ts
import {ApplicationConfig, importProvidersFrom} from '@angular/core';
import {SharedModule} from './shared/shared.module';

export const appConfig: ApplicationConfig = {
  providers: [
    // Case 3: needed only for LEGACY_REPORT_FORMATTER. Everything else SharedModule
    // provides is already providedIn: 'root'. Delete after PLAT-2077.
    importProvidersFrom(SharedModule),
  ],
};
```

**★ Symptom: you declared the migration finished because the `importProvidersFrom` count reached zero, and the codebase still has fourteen `NgModule`s.** Cause: the call count measures *bridges*, not modules. A module reached through `loadChildren` ([08h](08h-narrowing-the-lifetime-keeping-the-module-lazy.md)) is invisible to that metric by design, because it is not a bridge — it is a contained, unconverted feature. Fix: count both, and be explicit that they mean different things. Zero bridges plus fourteen lazy modules is a good state; calling it "no modules left" is how a team stops noticing the fourteen.

**Symptom: you planned a quarter of work on the assumption that "most of our dependencies still ship `NgModule`s".** Cause: an assumption nobody checked. Whether a given package ships a module, a `provide*` function, or both is a per-package fact readable in one file — and the answer for Angular's own packages at 22.1.5 is "a module that declares nothing", which is a very different problem from a provider-carrying one. Fix: open the typings before you plan. A module whose `Declarations` slot is `never` and whose `providers` array is empty is a re-export bundle, and converting it is a five-minute import change rather than a migration.

**Symptom: you moved a bootstrap-only `importProvidersFrom` to a route "for consistency" and something initialised too late or not at all.** Cause: case 2 was misread as case 1. The route narrowing is only available when nothing outside the subtree needs the providers, and a module contributing an initialiser or a global handler fails that test by construction ([08g](08g-narrowing-the-injector-and-the-lifetime.md)). Fix: leave it at the root and say why in the comment — a call that is at the root *deliberately* reads completely differently from one that is at the root by accident.

## Interview questions

**★ When is `importProvidersFrom` the right answer rather than a residue?**
Four situations. A third-party module with no `provide*` equivalent that you do not control, where the alternative is reimplementing a private provider list from its typings. A module whose providers the framework consumes at bootstrap — an initialiser, a global `ErrorHandler`, a root interceptor — because a route injector does not exist at that point and `ApplicationConfig.providers` is the only home. A migration in flight, where the call is a tracked work item with a comment naming what you needed. And a hybrid AngularJS application, where `UpgradeModule` is the mechanism rather than a leftover — it is `@public` and undeprecated at 22.1.5. Anything else is the third case with nobody tracking it, and the discipline is not avoiding the function but being able to name which of the four you are in.

**★ Why does the migration schematic convert `RouterModule.forRoot` but leave `SharedModule` behind `importProvidersFrom`?**
Because it converts what it has a mapping for, and it says so: *"If an API with a standalone equivalent is detected, it may be converted automatically as well. E.g. `RouterModule.forRoot` will become `provideRouter`."* First-party modules have published equivalents, so the mapping exists. `SharedModule` is a module you wrote, with hand-written providers and no equivalent for the tool to detect, so the bridge is the only correct output — not a fallback, the right answer. That makes the schematic's output a triage signal: every `importProvidersFrom` it emits names a module you own and can read.

**★ Why is reimplementing a vendor module's providers by reading its `.d.ts` worse than the bridge you are trying to avoid?**
Because a module's provider list is not part of its public API. What is published is the class and its `ɵinj` definition; the contents of that definition can change in any release, including a patch, with no deprecation cycle, no migration and no changelog entry — from the vendor's point of view nothing observable changed. Copying the list creates a dependency on an implementation detail neither side is watching, and it fails on an upgrade, in a way that looks like a framework bug. `importProvidersFrom` is expensive and supported; a copied provider list is cheap and unsupported, and "cheap" stops being true the first time it breaks.

**Your team wants one ticket titled "migrate off NgModules". Why is that the wrong shape of work?**
Because it bundles five unrelated jobs with different risks. Converting a first-party module to its published function is mechanical and behaviour-preserving. Converting a module you wrote is a bucket sort that has to be reviewed provider by provider. Moving a call to a route is a scoping decision that can break bootstrap ordering. Putting a module behind `loadChildren` is a bundling change with no conversion at all. And deciding to live with a vendor module is a decision, not a task. One ticket makes them one diff, which makes them unreviewable, and the first thing that breaks — silently, in HTTP, three weeks later — takes the whole change down with it. Split by shape, and count bridges and modules separately.

**Is an `NgModule` in a 2026 Angular codebase a defect?**
Not by itself, and the framework agrees — `@NgModule` is not deprecated at 22.1.5 and neither is `standalone: false`. There are four places a module is legitimate: a re-export bundle, a bridge such as `UpgradeModule` or one reached through `importProvidersFrom`, a framework internal you did not write such as the testing module, and code that has not been migrated yet. The useful question is not "is there a module" but "which of the four is this one" — and if the honest answer is none of them, it is the fourth and nobody has noticed. That is a triage rule rather than a style rule, and it is why this chapter ends with a taxonomy instead of a prohibition.

---

← Prev: [What a library should ship](08i-what-a-library-should-ship-instead.md) · Index: [Topic index](README.md) · Next → [The standalone migration schematic](09-the-standalone-migration-schematic.md)
