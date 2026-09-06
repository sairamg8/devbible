---
title: "Zoneless is the default in Angular 22, so the change-detection provider you actually write is the opt-out — and the whole switch is two records overwritten in one Map"
sidebar_label: "05 · Change-detection providers"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [Angular without ZoneJS (Zoneless)](https://angular.dev/guide/zoneless),
> [`provideZoneChangeDetection`](https://angular.dev/api/core/provideZoneChangeDetection),
> [`provideZonelessChangeDetection`](https://angular.dev/api/core/provideZonelessChangeDetection) — and
> `angular/angular` at tag `v22.1.5`:
> [`change_detection/scheduling/zoneless_scheduling.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/zoneless_scheduling.ts),
> [`zoneless_scheduling_impl.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/zoneless_scheduling_impl.ts),
> [`ng_zone_scheduling.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/ng_zone_scheduling.ts),
> [`zone/ng_zone.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/zone/ng_zone.ts),
> [`platform/bootstrap.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/platform/bootstrap.ts),
> [`errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts),
> [`CHANGELOG.md`](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md); and
> `angular/angular-cli` at tag `v22.1.7`:
> [`schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every tutorial written before v21 tells you to add `provideZonelessChangeDetection()` to opt in to
zoneless change detection. In Angular 22 that call is redundant: zoneless is what you get when you
provide nothing at all. The framework prepends the zoneless providers before your array, the
`ZONELESS_ENABLED` token's own default factory returns `true`, and `ng new` emits no
change-detection provider whatsoever. The provider you write in v22 is `provideZoneChangeDetection()`,
and it is an opt-*out* — it exists to put Zone.js back for an application that still needs it.**
Which means the interesting question is no longer "how do I turn zoneless on"; it is "what exactly
does the opt-out overwrite, and what breaks when only half of it is done". This chunk answers that
and names the diagnostics — **NG0408**, **NG0914**, **NG0908** — that fire when it goes wrong.
The change-detection *machine* itself — dirty marking, `OnPush`, the refresh traversal, the
scheduler's microtask race — is **Phase 5** *(not written yet)*.

## The generated app is the proof: there is no change-detection provider in it

The CLI's `app.config.ts` schematic is an EJS template, and the conditional is the whole story.
Verbatim from `packages/schematics/angular/application/files/standalone-files/src/app/app.config.ts.template`
at `@angular/cli` `v22.1.7`:

```text
import { ApplicationConfig, provideBrowserGlobalErrorListeners<% if (!zoneless) { %>, provideZoneChangeDetection<% } %> } from '@angular/core';<% if (routing) { %>
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';<% } %>

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),<% if (!zoneless) { %>
    provideZoneChangeDetection({ eventCoalescing: true }),<% } %>
    <% if (routing) { %>provideRouter(routes)<% } %>
  ]
};
```

That is the schematic *source*, not the file a user gets —
[chunk 01](01-app-config-and-what-bootstrap-does-with-it.md) prints the resolved output. And the
flag it branches on defaults to on, from `application/schema.json` in the same tag:

```json
"zoneless": {
  "description": "Generate an application that does not use `zone.js`.",
  "type": "boolean",
  "default": true
}
```

🔴 **So `ng new` in v22 emits no change-detection provider at all.**
`provideZoneChangeDetection({ eventCoalescing: true })` appears only under `--no-zoneless`. The
zoneless guide says the same thing in one sentence:

> *"Zoneless is the default in Angular v21+ so you do not need to do anything to enable it."*

> *"You should verify that `provideZoneChangeDetection` is not used anywhere to override the default configuration."*

The breaking change that made it true is in the **v21.0.0 / core** block of `CHANGELOG.md`:

> *"Angular no longer provides a change detection scheduler for ZoneJS-based change detection by default. Add `provideZoneChangeDetection` to the providers of your `bootstrapApplication` function or your `AppModule` (if using `bootstrapModule`). This provider addition will be covered by an automated migration."*

Two more lines from the same block, each of which is a real-world failure in disguise:

> *"Using a combination of `provideZoneChangeDetection` while also removing ZoneJS polyfills will no longer result in the internal scheduler being disabled. All Angular applications now consistently use the same scheduler, and those with the Zone change detection provider include additional automatic scheduling behaviors based on NgZone stabilization."*

> *"`ignoreChangesOutsideZone` is no longer available as an option for configuring ZoneJS change detection behavior."*

## The token proves it harder than the changelog does

From `change_detection/scheduling/zoneless_scheduling.ts`:

```ts
/** Token used to indicate if zoneless was enabled via provideZonelessChangeDetection(). */
export const ZONELESS_ENABLED = new InjectionToken<boolean>(
  typeof ngDevMode === 'undefined' || ngDevMode ? 'Zoneless enabled' : '',
  {factory: () => true},
);

/** Token used to indicate `provideZonelessChangeDetection` was used. */
export const PROVIDED_ZONELESS = new InjectionToken<boolean>(
  typeof ngDevMode === 'undefined' || ngDevMode ? 'Zoneless provided' : '',
  {factory: () => false},
);
```

🔴 **`ZONELESS_ENABLED`'s default factory is `() => true`.** Zoneless is not merely what the
framework happens to prepend — it is what an injector answers when *nobody* provided the token.
`PROVIDED_ZONELESS` defaults to `false` and exists for exactly one purpose: detecting that you
called `provideZonelessChangeDetection()` explicitly, which is what arms NG0408 below.

What the framework prepends, from `zoneless_scheduling_impl.ts`:

```ts
export function provideZonelessChangeDetectionInternal(): Provider[] {
  return [
    {provide: ChangeDetectionScheduler, useExisting: ChangeDetectionSchedulerImpl},
    {provide: NgZone, useClass: NoopNgZone},
    {provide: ZONELESS_ENABLED, useValue: true},
  ];
}
```

[Chunk 01](01-app-config-and-what-bootstrap-does-with-it.md) already quoted the call site: in
`internalCreateApplication`, `allAppProviders` is
`[provideZonelessChangeDetectionInternal(), errorHandlerEnvironmentInitializer, …, ...(appProviders || [])]`.
**Your array is spread in last**, which is the entire override mechanism — see
**chunk 13 · Order dependence** *(not written yet)*.

## `provideZoneChangeDetection()` is two `Map.set` overwrites

From `ng_zone_scheduling.ts`:

```ts
export function internalProvideZoneChangeDetection({
  ngZoneFactory,
  scheduleInRootZone,
}: {
  ngZoneFactory?: () => NgZone;
  scheduleInRootZone?: boolean;
}): StaticProvider[] {
  ngZoneFactory ??= () =>
    new NgZone({...getNgZoneOptions(), scheduleInRootZone} as InternalNgZoneOptions);
  return [
    {provide: ZONELESS_ENABLED, useValue: false},
    {provide: NgZone, useFactory: ngZoneFactory},
```

```ts
export function provideZoneChangeDetection(options?: NgZoneOptions): EnvironmentProviders {
  const scheduleInRootZone = (options as any)?.scheduleInRootZone;
  const zoneProviders = internalProvideZoneChangeDetection({
    ngZoneFactory: () => {
      const ngZoneOptions = getNgZoneOptions(options);
      ngZoneOptions.scheduleInRootZone = scheduleInRootZone;
      if (ngZoneOptions.shouldCoalesceEventChangeDetection) {
        performanceMarkFeature('NgZone_CoalesceEvent');
      }
      return new NgZone(ngZoneOptions);
    },
    scheduleInRootZone,
  });
  return makeEnvironmentProviders([{provide: PROVIDED_NG_ZONE, useValue: true}, zoneProviders]);
}
```

🔴 **The entire opt-out is two records replaced.** `ZONELESS_ENABLED` goes `true → false` and
`NgZone` goes `NoopNgZone → NgZone`, purely because your providers register after the framework's.
Notice what is **not** re-provided: `ChangeDetectionScheduler` stays `ChangeDetectionSchedulerImpl`
in both modes. That is precisely what the v21 changelog meant by *"All Angular applications now
consistently use the same scheduler"* — Zone.js in v22 is an extra *notification source* feeding one
shared scheduler, not a second change-detection engine.

Its JSDoc, verbatim:

> *"Provides `NgZone`-based change detection for the application bootstrapped using `bootstrapApplication`."*
> *"Add this provider to use `NgZone`/ZoneJS-based change detection and configure options like `eventCoalescing` in the `NgZone`."*
> *"If you need this provider function in an NgModule-based application, pass it as `applicationProviders` to `bootstrapModule()`."*

`NgZoneOptions` is exactly two fields, and `getNgZoneOptions` shows the real defaults — both `false`:

```ts
export interface NgZoneOptions {
  eventCoalescing?: boolean;
  runCoalescing?: boolean;
}

export function getNgZoneOptions(options?: NgZoneOptions): InternalNgZoneOptions {
  return {
    enableLongStackTrace: typeof ngDevMode === 'undefined' ? false : !!ngDevMode,
    shouldCoalesceEventChangeDetection: options?.eventCoalescing ?? false,
    shouldCoalesceRunChangeDetection: options?.runCoalescing ?? false,
  };
}
```

> *"By default, this option is set to false, meaning events will not be coalesced, and change detection will be triggered multiple times. If this option is set to true, change detection will be triggered once in the scenario described above."*

> *"With ngZoneRunCoalescing options, all change detections in an event loop trigger only once. In addition, the change detection executes in requestAnimation."*

⚠️ **The schematic's own `--no-zoneless` output passes `{ eventCoalescing: true }`, which is not the
API default.** If you hand-write the opt-out and omit the options object you get *less* coalescing
than `ng new --no-zoneless` would have given you.

## `provideZonelessChangeDetection()` — the call you no longer write

Full source, from `zoneless_scheduling_impl.ts`:

```ts
export function provideZonelessChangeDetection(): EnvironmentProviders {
  performanceMarkFeature('NgZoneless');

  if ((typeof ngDevMode === 'undefined' || ngDevMode) && typeof Zone !== 'undefined' && Zone) {
    const message = formatRuntimeError(
      RuntimeErrorCode.UNEXPECTED_ZONEJS_PRESENT_IN_ZONELESS_MODE,
      `The application is using zoneless change detection, but is still loading Zone.js. ` +
        `Consider removing Zone.js to get the full benefits of zoneless. ` +
        `In applications using the Angular CLI, Zone.js is typically included in the "polyfills" section of the angular.json file.`,
    );
    console.warn(message);
  }

  return makeEnvironmentProviders([
    ...provideZonelessChangeDetectionInternal(),
    typeof ngDevMode === 'undefined' || ngDevMode
      ? [{provide: PROVIDED_ZONELESS, useValue: true}]
      : [],
  ]);
}
```

Its own JSDoc no longer pretends it is an opt-in:

> *"NOTE: Zoneless is enabled by default in Angular v21+. Ensure `provideZoneChangeDetection` is not used to override this default."*

Four facts read straight off that body:

- **The call is redundant but not a no-op.** It re-registers the same three records the framework
  already prepended (harmless — a `Map.set` with an identical value) and *additionally* sets
  `PROVIDED_ZONELESS = true`. Its only observable effects in v22 are the NG0914 warning and arming
  the NG0408 tripwire.
- **NG0914 is a `console.warn`, not a throw**, and it fires **at call time** — inside the provider
  function, before any injector exists — so it appears even if the returned providers are never used.
- **`PROVIDED_ZONELESS` is registered in dev mode only**, so **NG0408 cannot fire in a production
  build**. A double-provide that survives to production is silent.
- Code `914` is positive in the `RuntimeErrorCode` enum, so per `formatRuntimeError` there is
  **no `Find more at https://angular.dev/errors/NG0914` suffix** — the string ends at `angular.json file.`

And the list every reader actually wants — what schedules change detection once Zone.js is gone,
verbatim from the same JSDoc:

> *"ZoneJS uses browser events to trigger change detection. When using this provider, Angular will instead use Angular APIs to schedule change detection. These APIs include:"*
> - `ChangeDetectorRef.markForCheck`
> - `ComponentRef.setInput`
> - updating a signal that is read in a template
> - when bound host or template listeners are triggered
> - attaching a view that was marked dirty by one of the above
> - removing a view

🔴 **`setTimeout`, `Promise.then`, `addEventListener` on a raw DOM node, an RxJS subscription and a
bare `fetch` callback are not on that list.** In zone mode they scheduled change detection as a side
effect of being patched; in v22 they do not. That is one migration hazard, not seven, but it is the
one that breaks apps.

## NG0408 — both providers present

From `platform/bootstrap.ts`:

```ts
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      if (envInjector.get(PROVIDED_ZONELESS) && envInjector.get(PROVIDED_NG_ZONE)) {
        console.warn(
          formatRuntimeError(
            RuntimeErrorCode.PROVIDED_BOTH_ZONE_AND_ZONELESS,
            'Both provideZoneChangeDetection and provideZonelessChangeDetection are provided. ' +
              'This is likely a mistake. Update the application providers to use only one of the two.',
          ),
        );
      }
    }
```

Rendered: `NG0408: Both provideZoneChangeDetection and provideZonelessChangeDetection are provided.
This is likely a mistake. Update the application providers to use only one of the two.`

🔴 **It is a warning, dev-mode only, and the application still boots.** Which mode you end up in is
decided by ordinary provider precedence — whichever call sits **later in the flattened array** wins
for `ZONELESS_ENABLED` and `NgZone`. [Chunk 04](04-writing-your-own-provide-function.md) already
uses this as the framework's own example of *throw for a contradiction, warn for a suspicion*; this
is the contradiction it declined to throw on, because one of the two does win.

The check runs inside `ngZone.run(...)` at the top of `bootstrap()` — after the injector exists,
before environment initializers, before `ApplicationInitStatus.runInitializers()`, and well before
`appRef.bootstrap()`. So it precedes the first render, which is why it is easy to miss in a noisy
console: it prints before anything the application itself logs.

## `zone.js` is an *optional* peer, and that reaches into two files

`@angular/core@22.1.5`'s published `package.json` declares it as a peer and then marks it optional:

```json
"peerDependencies": {
  "rxjs": "^6.5.3 || ^7.4.0",
  "zone.js": "~0.15.0 || ~0.16.0",
  "@angular/compiler": "22.1.5"
},
"peerDependenciesMeta": {
  "zone.js": { "optional": true },
  "@angular/compiler": { "optional": true }
}
```

**Optional means npm and yarn will not warn you when it is absent, and will not install it.** So an
application that opts back in with `provideZoneChangeDetection()` must add `zone.js` to its own
`dependencies` — nothing upstream does it. The CLI schematic does exactly that, conditionally
(`packages/schematics/angular/application/index.ts` at `v22.1.7`):

```ts
  if (!options.zoneless) {
    rules.push(
      addDependency('zone.js', latestVersions['zone.js'], {
        type: DependencyType.Default,
        existing: ExistingBehavior.Skip,
        install: options.skipInstall ? InstallBehavior.None : InstallBehavior.Auto,
      }),
    );
  }
```

and the build target it writes is the second file:

```ts
        options: {
          browser: `${sourceRoot}/main.ts`,
          polyfills: options.zoneless ? undefined : ['zone.js'],
          tsConfig: `${projectRoot}tsconfig.app.json`,
```

🔴 **A v22 zoneless workspace has no `polyfills` key in `angular.json` at all**, not
`"polyfills": []`. The two halves must agree: the provider decides whether `NgZone` is real, and
`polyfills` decides whether the `Zone` global exists. Half a migration fails loudly in one direction
and silently in the other. The zoneless guide's instruction, for a workspace generated before v21:

> *"ZoneJS is typically loaded via the `polyfills` option in `angular.json`, both in the `build` and `test` targets. Remove `zone.js` and `zone.js/testing` from both to remove it from the build."*

⚠️ **That sentence describes an older workspace shape.** The v22 application schematic writes a
`test` target with no `polyfills` option of its own — under `@angular/build:unit-test` it inherits
from the build target — so on a freshly generated v22 project there is only one place to edit. Check
your own `angular.json` rather than assuming either shape.

### The failure when the provider says zone and the polyfill says none

`NgZone`'s constructor throws immediately, from `zone/ng_zone.ts`:

```ts
    if (typeof Zone == 'undefined') {
      throw new RuntimeError(
        RuntimeErrorCode.MISSING_ZONEJS,
        ngDevMode && `In this configuration Angular requires Zone.js`,
      );
    }
```

`MISSING_ZONEJS = 908`, so the dev-mode string is `NG0908: In this configuration Angular requires
Zone.js` and the production string collapses to bare `NG0908` (the `ngDevMode &&` makes the message
`false` in a production build, and `formatRuntimeError` drops it).

### The failure in the other direction is *no* failure

If you leave `"polyfills": ["zone.js"]` in place and simply delete your
`provideZonelessChangeDetection()` call — the correct v22 migration — nothing warns.
`UNEXPECTED_ZONEJS_PRESENT_IN_ZONELESS_MODE` has exactly one throw site in the repository, inside
`provideZonelessChangeDetection`, so deleting the call also deletes the only thing that would have
told you Zone.js is still being shipped. The app runs zoneless and pays for a polyfill it never
consults. **This is the single most common half-finished v22 migration**, and the only way to catch
it is to read `angular.json`.

### `NoopNgZone` is stable forever, and that is observable

```ts
export class NoopNgZone implements NgZone {
  readonly hasPendingMicrotasks = false;
  readonly hasPendingMacrotasks = false;
  readonly isStable = true;
  readonly onUnstable = new EventEmitter<any>();
  readonly onMicrotaskEmpty = new EventEmitter<any>();
  readonly onStable = new EventEmitter<any>();
  readonly onError = new EventEmitter<any>();

  run<T>(fn: (...args: any[]) => T, applyThis?: any, applyArgs?: any): T {
    return fn.apply(applyThis, applyArgs);
  }

  runGuarded<T>(fn: (...args: any[]) => any, applyThis?: any, applyArgs?: any): T {
    return fn.apply(applyThis, applyArgs);
  }

  runOutsideAngular<T>(fn: (...args: any[]) => T): T {
    return fn();
  }

  runTask<T>(fn: (...args: any[]) => T, applyThis?: any, applyArgs?: any, name?: string): T {
    return fn.apply(applyThis, applyArgs);
  }
}
```

Every emitter is constructed and **never emitted to**. `run` and `runOutsideAngular` are the identity
function. So in a v22 default app, `NgZone` still injects — it is provided — but every zone-shaped
API silently becomes a no-op, and `ngZone.onStable.subscribe(...)` never fires. Related, from the
same file: `NgZone.isInAngularZone()` begins `typeof Zone !== 'undefined' && …`, so it returns
`false` unconditionally, and `NgZone.assertInAngularZone()` therefore always throws
`NG0909: Expected to be in Angular Zone, but it is not!`. Library code that guards on either of
those takes the "outside Angular" branch in every zoneless application.

## Where the machine lives

`ChangeDetectionSchedulerImpl` in `zoneless_scheduling_impl.ts` is the shared scheduler both modes
resolve to. Three facts belong here only as signposts — the mechanism is **Phase 5 · Change
detection and zoneless** *(not written yet)*. It caps consecutive microtask notifications at
`CONSECUTIVE_MICROTASK_NOTIFICATION_LIMIT = 100` and throws `NG0103`
(`INFINITE_CHANGE_DETECTION`) past it; it chooses between `scheduleCallbackWithMicrotask` and
`scheduleCallbackWithRafRace`; and `scheduleInRootZone` resolves to `false` in zoneless mode
because the field is computed as
`!this.zonelessEnabled && this.zoneIsDefined && (inject(SCHEDULE_IN_ROOT_ZONE, {optional: true}) ?? false)`.
This chunk's job ends at *which providers put you in which mode*.

The remaining change-detection provider — `provideCheckNoChangesConfig`, which is **developer
preview** and dev-mode-only — is **05b · `provideCheckNoChangesConfig`** *(not written yet)*.

## Gotchas

**★ Symptom: `NG0914: The application is using zoneless change detection, but is still loading Zone.js.`**
Cause: you called `provideZonelessChangeDetection()` (the pre-v21 opt-in) in a workspace whose
`angular.json` still lists `zone.js` in `polyfills`. Fix both halves — delete the call, because
zoneless is the default, and remove the polyfill:

```ts
// src/app/app.config.ts — v22: no change-detection provider at all
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideRouter(routes)]
};
```

```json
{
  "projects": {
    "storefront": {
      "architect": {
        "build": {
          "builder": "@angular/build:application",
          "options": {
            "browser": "src/main.ts",
            "tsConfig": "tsconfig.app.json"
          }
        }
      }
    }
  }
}
```

Then drop `"zone.js"` from `dependencies` in `package.json`; it is an optional peer, so nothing
re-adds it.

**★ Symptom: `NG0408: Both provideZoneChangeDetection and provideZonelessChangeDetection are provided.`
in the console, and the app works anyway.** Cause: both calls are in the flattened provider array —
very often one is yours and one arrived through a shared config, a `mergeApplicationConfig` server
config, or a library's `provideX()`. It is a dev-only warning; whichever call is *later* in the
flattened array wins. Fix: delete one, and prefer deleting `provideZonelessChangeDetection()`
because it is the redundant half in v22.

**★ Symptom: you upgrade to v21/v22 and UI driven by `setTimeout`, `Promise.then` or a raw
`addEventListener` stops repainting.** Cause: no ZoneJS scheduler is provided by default any more,
and none of those APIs is on the list of things that notify Angular. Fix, if you are not ready to
migrate to signals, is the explicit opt-out plus the polyfill:

```ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true })]
};
```

```json
{
  "polyfills": ["zone.js"]
}
```

The durable fix is to move the value into a signal, which *is* on the notify list:

```ts
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-countdown',
  template: `{{ secondsLeft() }}`,
})
export class Countdown {
  readonly secondsLeft = signal(30);

  constructor() {
    setInterval(() => this.secondsLeft.update((n) => (n > 0 ? n - 1 : 0)), 1000);
  }
}
```

**★ Symptom: `NG0908: In this configuration Angular requires Zone.js`, thrown during bootstrap.**
Cause: `provideZoneChangeDetection()` is in the array but the `Zone` global does not exist — the
`NgZone` constructor throws on `typeof Zone == 'undefined'`. Either you removed the polyfill and not
the provider, or `zone.js` is absent from `dependencies` because it is an optional peer. Fix: add
both back, or remove the provider.

```json
{
  "dependencies": {
    "@angular/core": "22.1.5",
    "zone.js": "~0.16.0"
  }
}
```

**★ Symptom: nothing warns, but your bundle still contains Zone.js.** Cause: you deleted
`provideZonelessChangeDetection()` and left `polyfills` alone. NG0914 lives *inside* that provider
function, so deleting the call deletes the only warning about the leftover polyfill. Fix: remove the
`polyfills` option from the `build` target (a v22 zoneless workspace has no `polyfills` key at all),
and uninstall `zone.js`.

**★ Symptom: `provideZoneChangeDetection()` appears to have no effect.** Cause: it is not in the
application's environment injector. It cannot be in a component's `providers` — that is a compile
error, because it returns `EnvironmentProviders`
([chunk 03](03-environmentproviders-vs-provider.md)) — but it *can* legally sit in a **route's**
`providers`, where it type-checks, registers a record in a child environment injector, and is never
consulted: the application's single `NgZone` was resolved at bootstrap, long before that route
injector existed. Fix: move it into `ApplicationConfig.providers`.

**Symptom: `Object literal may only specify known properties, and 'ignoreChangesOutsideZone' does
not exist in type 'NgZoneOptions'`.** Cause: the option was removed in v21.0.0. `NgZoneOptions` now
has exactly two fields, `eventCoalescing` and `runCoalescing`. Fix: delete it; there is no
replacement, because the scheduler is no longer disabled when it is absent.

**Symptom: `ngZone.onStable.subscribe(...)` never fires, or an SSR/testing helper waits for
stability forever.** Cause: in a zoneless app `NgZone` resolves to `NoopNgZone`, whose `isStable` is
the literal `true` and whose `onStable` emitter is never emitted to. Fix: use `ApplicationRef`'s
own stability signal rather than the zone's:

```ts
import { ApplicationRef, inject, Injectable } from '@angular/core';
import { filter, firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SnapshotService {
  private readonly appRef = inject(ApplicationRef);

  async whenSettled(): Promise<void> {
    await firstValueFrom(this.appRef.isStable.pipe(filter((stable) => stable)));
  }
}
```

**Symptom: `NG0909: Expected to be in Angular Zone, but it is not!` from a third-party library.**
Cause: `NgZone.isInAngularZone()` starts with `typeof Zone !== 'undefined'`, so it is `false` in
every zoneless application, and `assertInAngularZone()` throws unconditionally. Fix: the library
needs a zoneless-aware version; the local workaround is to opt that application back in with
`provideZoneChangeDetection()` and keep the polyfill until it ships one.

**Symptom: `NG0103` — Angular reports it could not stabilize because of endless change
notifications.** Cause: something notifies on every tick — commonly an `effect` that writes a signal
it also reads, or a template binding that constructs a new object each pass. The scheduler gives up
after `CONSECUTIVE_MICROTASK_NOTIFICATION_LIMIT = 100` consecutive microtask notifications. Fix
belongs to **Phase 5** *(not written yet)*; the immediate move is to read the stack the message
carries and break the write-read cycle with `untracked`.

**Symptom: coalescing behaves differently between an app you generated and one you migrated by
hand.** Cause: `getNgZoneOptions` defaults `shouldCoalesceEventChangeDetection` to `false`, but the
CLI's `--no-zoneless` template writes `provideZoneChangeDetection({ eventCoalescing: true })`. A
hand-written `provideZoneChangeDetection()` is *not* the same configuration. Fix: pass the options
object explicitly and stop relying on the framework default matching the schematic.

## Interview questions

**★ Why does `provideZoneChangeDetection()` win over the framework's zoneless providers, when the
framework's are registered first?**
Because provider registration is a `Map` write and the last non-multi write for a token wins.
`internalCreateApplication` builds `allAppProviders` as the framework's list followed by
`...(appProviders || [])`, so your array is flattened in afterwards; your `{provide: ZONELESS_ENABLED,
useValue: false}` and `{provide: NgZone, useFactory: …}` overwrite the framework's `true` and
`NoopNgZone`. Nothing about change detection is special here — it is the ordinary override rule
that **chunk 13** *(not written yet)* works through.

**★ What is the difference between "zoneless is stable" and "zoneless is the default"?**
Two different releases. `provideZonelessChangeDetection` graduated from experimental to stable as an
API — you could ship it with confidence. Separately, v21.0.0 stopped providing a ZoneJS change
detection scheduler at all, which made zoneless the behaviour you get with an empty provider array.
A v22 app that never mentions change detection anywhere is zoneless, and the `ZONELESS_ENABLED`
token's `{factory: () => true}` is the proof.

**★ If zoneless is the default, why does the framework still explicitly provide
`{provide: ZONELESS_ENABLED, useValue: true}` when the token already defaults to `true`?**
The documentation does not state a reason, and the source carries no comment explaining it, so treat
any answer as a reading rather than a fact. The mechanically defensible half is that an explicit
record is a *record* — it exists in the application injector, so a child environment injector
resolves it by walking to a real provider rather than falling back to the token's tree-shakable
default, and tooling that enumerates records can see it. Saying "I do not know, and here is what the
source does guarantee" is the correct answer to this one.

**★ You are asked to migrate a v18 application to v22. What are the change-detection steps, in order?**
Delete nothing first — read `angular.json`. If `polyfills` lists `zone.js` and the app relies on
`setTimeout`/`Promise`/event-driven repaints, the safe landing is v22 with
`provideZoneChangeDetection({ eventCoalescing: true })` added and the polyfill kept; the v21 upgrade
migration adds that provider for you. Only then migrate state to signals component by component,
and when nothing depends on zone patching, remove the provider, drop `polyfills` from the build
target, and uninstall `zone.js` from `dependencies`. Adding `provideZonelessChangeDetection()` is
never a step — it is the pre-v21 spelling of doing nothing.

**Why is NG0408 a warning while `provideHttpClient`'s conflicting features throw?**
It is the rule [chunk 04](04-writing-your-own-provide-function.md) states: throw for a contradiction,
warn for a suspicion. `withXsrfConfiguration()` plus `withNoXsrfProtection()` has no correct
behaviour, so it throws. Zone plus zoneless *does* have a defined outcome — the later provider wins
and the app runs correctly in that mode — so it only warns.

**What happens if you call `provideZonelessChangeDetection()` in a v22 application?**
It is redundant, not harmful. The three records it returns are identical to the ones the framework
already prepended, so re-registering them changes nothing. It additionally sets `PROVIDED_ZONELESS`
to `true` — in dev mode only — which is what allows NG0408 to fire if something else provides
`provideZoneChangeDetection`. And if the `Zone` global happens to exist, the function warns NG0914
at call time. So its only effects are diagnostic.

**Can NG0408 reach production?**
No, and that is worth knowing. `PROVIDED_ZONELESS` is only registered under
`typeof ngDevMode === 'undefined' || ngDevMode`, and the check in `bootstrap.ts` is itself inside an
`ngDevMode` guard. A production build with both providers present boots silently in whichever mode
the later provider selected.

**A colleague says "we removed Zone.js, so our app is faster". What would you check before agreeing?**
Whether Zone.js was actually removed from the *build*. Deleting `provideZonelessChangeDetection()`
in v22 leaves the app zoneless but does nothing to `angular.json`, and no diagnostic fires — the
NG0914 warning lives inside the provider that was deleted. Check the `polyfills` option on the
`build` target and `zone.js` in `dependencies`; a v22 zoneless workspace should have neither.

---

← Prev: [Topic index](README.md) · Index: [Topic index](README.md) · Next → **06 · Startup and error-listener providers** *(not written yet)*
