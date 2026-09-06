---
title: "`provideZoneChangeDetection()` is the opt-*out*, and the whole switch is two records overwritten in one Map — the scheduler is deliberately not one of them"
sidebar_label: "05b · `provideZoneChangeDetection()`, the opt-out"
sidebar_position: 5.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`provideZoneChangeDetection`](https://angular.dev/api/core/provideZoneChangeDetection),
> [Angular without ZoneJS (Zoneless)](https://angular.dev/guide/zoneless) — and
> `angular/angular` at tag `v22.1.5`:
> [`change_detection/scheduling/ng_zone_scheduling.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/ng_zone_scheduling.ts),
> [`change_detection/scheduling/zoneless_scheduling.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/zoneless_scheduling.ts),
> [`CHANGELOG.md`](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`provideZoneChangeDetection()` is the only change-detection provider a v22 application has any
reason to write, and it is an opt-*out*. Read its body and the whole thing collapses to two records
replaced in one Map: `ZONELESS_ENABLED` goes `true → false` and `NgZone` goes `NoopNgZone → NgZone`.
What it deliberately does *not* re-provide is `ChangeDetectionScheduler`, which stays bound to
`ChangeDetectionSchedulerImpl` in both modes — that single omission is the mechanical content of the
v21 changelog's "all Angular applications now consistently use the same scheduler", and it means
Zone.js in v22 is an extra notification *source*, not a second change-detection engine.** Its options
bag is two booleans, both defaulting to `false`, and neither default matches what
`ng new --no-zoneless` writes into your `app.config.ts` — which is why a hand-written opt-out and a
generated one are not the same configuration. The default this overrides is
[05](05-change-detection-providers.md); the redundant opt-in and NG0408 are
[05c](05c-the-redundant-opt-in-and-ng0408.md).

## Two `Map.set` overwrites, and that is the entire switch

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

A third record goes in that is neither of those: `{provide: PROVIDED_NG_ZONE, useValue: true}`, the
mirror of `PROVIDED_ZONELESS`. Nothing about change detection reads it; it exists so the conflict
check in [05c](05c-the-redundant-opt-in-and-ng0408.md) can tell *"a human wrote this call"* apart
from *"this is the mode the application happens to be in"*.

Its JSDoc, verbatim:

> *"Provides `NgZone`-based change detection for the application bootstrapped using `bootstrapApplication`."*
> *"Add this provider to use `NgZone`/ZoneJS-based change detection and configure options like `eventCoalescing` in the `NgZone`."*
> *"If you need this provider function in an NgModule-based application, pass it as `applicationProviders` to `bootstrapModule()`."*

That third sentence is the one people miss on an `NgModule` codebase: it goes in `bootstrapModule()`'s
`applicationProviders`, not in `AppModule.providers`.

## The options bag is two booleans, and both default to `false`

`NgZoneOptions` is exactly two fields, and `getNgZoneOptions` shows the real defaults:

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

Three readings fall out of that function body and are worth stating separately, because each is a
question people ask:

- **`enableLongStackTrace` is not yours to set.** It is computed from `ngDevMode`, not from the
  options object — there is no field for it on `NgZoneOptions`, so long stack traces are on in
  development and off in production, and that is the whole policy.
- **`eventCoalescing` and `runCoalescing` are independent.** Neither implies the other, and both
  default to `false`; the `performanceMarkFeature('NgZone_CoalesceEvent')` call fires only for the
  first one.
- **`scheduleInRootZone` is read off the options object with an `as any` cast**, which is the source
  telling you it is not part of the public `NgZoneOptions` type. It is threaded through to
  `InternalNgZoneOptions`, so it exists, but the type system does not offer it to you.

⚠️ **The schematic's own `--no-zoneless` output passes `{ eventCoalescing: true }`, which is not the
API default.** If you hand-write the opt-out and omit the options object you get *less* coalescing
than `ng new --no-zoneless` would have given you.

## Gotchas

**★ Symptom: `provideZoneChangeDetection()` appears to have no effect.** Cause: it is not in the
application's environment injector. It cannot be in a component's `providers` — that is a compile
error, because it returns `EnvironmentProviders`
([chunk 03](03-environmentproviders-vs-provider.md)) — but it *can* legally sit in a **route's**
`providers`, where it type-checks, registers a record in a child environment injector, and is never
consulted: the application's single `NgZone` was resolved at bootstrap, long before that route
injector existed. Fix: move it into `ApplicationConfig.providers`.

```ts
// src/app/app.config.ts — the only place it does anything
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes)]
};
```

**★ Symptom: coalescing behaves differently between an app you generated with `--no-zoneless` and
one you migrated by hand.** Cause: `getNgZoneOptions` defaults `shouldCoalesceEventChangeDetection`
to `false`, but the CLI's `--no-zoneless` template writes
`provideZoneChangeDetection({ eventCoalescing: true })`. A hand-written `provideZoneChangeDetection()`
is *not* the same configuration. Fix: pass the options object explicitly and stop relying on the
framework default matching the schematic:

```ts
// not the same thing
provideZoneChangeDetection()                          // eventCoalescing: false
provideZoneChangeDetection({ eventCoalescing: true }) // what ng new --no-zoneless writes
```

**★ Symptom: `Object literal may only specify known properties, and 'scheduleInRootZone' does not
exist in type 'NgZoneOptions'`.** Cause: `NgZoneOptions` declares exactly `eventCoalescing` and
`runCoalescing`; `provideZoneChangeDetection` reaches the third value through
`(options as any)?.scheduleInRootZone`, which is the source's own admission that it is not part of
the public type. Fix: there is no supported way to set it from the public API, and casting to reach
an internal option is a bet on an unversioned field. Leave it alone.

**★ Symptom: you added `provideZoneChangeDetection()` to `AppModule.providers` in an `NgModule`
application and nothing changed.** Cause: the JSDoc names the one correct location for that shape —
*"If you need this provider function in an NgModule-based application, pass it as
`applicationProviders` to `bootstrapModule()`."* `AppModule.providers` is a module-level array read
after the platform has already decided the zone mode. Fix:

```ts
// main.ts — NgModule bootstrap in v22
import { provideZoneChangeDetection } from '@angular/core';
import { platformBrowser } from '@angular/platform-browser';
import { AppModule } from './app/app.module';

platformBrowser().bootstrapModule(AppModule, {
  applicationProviders: [provideZoneChangeDetection({ eventCoalescing: true })],
});
```

**Symptom: you set `runCoalescing: true` and event handlers still trigger change detection once
each.** Cause: the two flags are independent switches over different things — `eventCoalescing`
coalesces multiple events, `runCoalescing` coalesces multiple `NgZone.run` calls within an event
loop and moves the pass into `requestAnimationFrame`. Setting one does not imply the other, and both
start at `false`. Fix: set both when you want both.

```ts
provideZoneChangeDetection({ eventCoalescing: true, runCoalescing: true })
```

**Symptom: you want long stack traces off in development because they are slowing the app down.**
Cause: `enableLongStackTrace` is derived — `typeof ngDevMode === 'undefined' ? false : !!ngDevMode`
— and is not exposed on `NgZoneOptions`. Fix: there is no provider-level switch; the only lever is
the build configuration that sets `ngDevMode`, which means measuring in a production build rather
than tuning the development one.

## Interview questions

**★ Why does `provideZoneChangeDetection()` win over the framework's zoneless providers, when the
framework's are registered first?**
Because provider registration is a `Map` write and the last non-multi write for a token wins.
`internalCreateApplication` builds `allAppProviders` as the framework's list followed by
`...(appProviders || [])`, so your array is flattened in afterwards; your `{provide: ZONELESS_ENABLED,
useValue: false}` and `{provide: NgZone, useFactory: …}` overwrite the framework's `true` and
`NoopNgZone`. Nothing about change detection is special here — it is the ordinary override rule
that **chunk 13** *(not written yet)* works through.

**★ `provideZoneChangeDetection()` re-provides two tokens. Which one does it deliberately leave
alone, and why does that matter?**
`ChangeDetectionScheduler`. It stays bound to `ChangeDetectionSchedulerImpl` in both modes, which is
the mechanical content of the v21 changelog line *"All Angular applications now consistently use the
same scheduler"*. The consequence is that Zone.js in v22 is a *notification source* feeding the one
shared scheduler, not an alternative change-detection engine — so reasoning like "zone apps and
zoneless apps take different code paths through change detection" is wrong at the provider level.

**★ It returns `EnvironmentProviders`. Where is that legal, and where does "legal" stop meaning
"works"?**
`EnvironmentProviders` is accepted in `ApplicationConfig.providers` and in `Route.providers`, and
rejected on a component — that is the whole point of the branded type
([chunk 03](03-environmentproviders-vs-provider.md)). But only the first of those two does anything
for change detection: the application's `NgZone` and `ZONELESS_ENABLED` are resolved once at
bootstrap, so a `provideZoneChangeDetection()` sitting in a route's `providers` type-checks, creates
a record in a child environment injector, and is never read. It is the clearest case in the phase of
the type system permitting something the runtime ignores.

**What does `PROVIDED_NG_ZONE` do that `{provide: ZONELESS_ENABLED, useValue: false}` does not?**
It records *intent* rather than *state*. `ZONELESS_ENABLED` answers "which mode is this application
in", and it is meaningful with no provider at all because its factory returns `true`.
`PROVIDED_NG_ZONE` answers "did someone call `provideZoneChangeDetection()`", which is a different
question and the only one a conflict check can act on — a mode value cannot tell a deliberate
choice from a default.

**Why does the function bother with a factory for `NgZone` instead of `useClass`?**
Because the options have to be computed at provider-construction time and closed over.
`getNgZoneOptions(options)` reads `ngDevMode`, applies both coalescing defaults, and the factory then
patches `scheduleInRootZone` onto the result before calling `new NgZone(...)`. A `useClass` binding
has no place to put any of that; the constructor takes an already-resolved `InternalNgZoneOptions`.

**If Zone.js is now just a notification source, what did you actually gain by keeping it?**
The patched APIs. `setTimeout`, `Promise.then`, `addEventListener` and XHR callbacks notify the
shared scheduler in zone mode and do not in zoneless mode — that is the entire practical difference,
and it is why an application whose state lives in plain fields rather than signals still needs the
opt-out. What you do not gain is a different change-detection algorithm; the traversal is the same
one either way.

---

← Prev: [Zoneless is the default](05-change-detection-providers.md) · Index: [Topic index](README.md) · Next → [The redundant opt-in, and NG0408](05c-the-redundant-opt-in-and-ng0408.md)
