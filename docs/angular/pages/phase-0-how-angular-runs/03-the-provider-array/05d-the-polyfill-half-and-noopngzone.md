---
title: "`zone.js` is an *optional* peer, so the provider array and `angular.json` are two independent halves of one decision — one direction throws NG0908 and the other says nothing at all"
sidebar_label: "05d · The polyfill half, and `NoopNgZone`"
sidebar_position: 5.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [Angular without ZoneJS (Zoneless)](https://angular.dev/guide/zoneless) — the published
> `@angular/core@22.1.5` `package.json`; and `angular/angular` at tag `v22.1.5`:
> [`zone/ng_zone.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/zone/ng_zone.ts),
> [`change_detection/scheduling/zoneless_scheduling_impl.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/zoneless_scheduling_impl.ts),
> [`errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts); and
> `angular/angular-cli` at tag `v22.1.7`:
> [`schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The change-detection decision has two halves and they live in different files. The provider array
decides whether `NgZone` is real; `angular.json` decides whether the `Zone` global exists at all. The
two must agree, nothing enforces it, and the two failure directions are wildly asymmetric — provider
without polyfill throws `NG0908` during bootstrap, while polyfill without provider is completely
silent and simply ships a library the application never consults. That second one is the most common
half-finished v22 migration in existence, and the only way to catch it is to read `angular.json`,
because the warning that would have told you lives inside the very call you deleted.** This chunk is
the packaging facts, both failure directions, and what `NgZone` actually becomes in a zoneless
application — a class whose every method is the identity function and whose every emitter is
constructed and never emitted to.

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
preview** and dev-mode-only — is **05e · `provideCheckNoChangesConfig`** *(not written yet)*.

## Gotchas

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

**★ Symptom: bare `NG0908` with no message, from a production build only.** Cause: the throw site
passes `ngDevMode && 'In this configuration Angular requires Zone.js'` as the message, so in a
production build the second operand is never reached and `formatRuntimeError` receives `false`. The
code survives; the sentence does not. Fix: reproduce with `ng serve` to get the readable form, then
fix the provider/polyfill mismatch — the cause is identical in both builds.

**★ Symptom: `npm install` and `yarn install` are both clean, and the app still throws NG0908.**
Cause: `zone.js` is declared `"optional": true` in `peerDependenciesMeta`, so no package manager
warns about it being absent and none installs it for you. An optional peer is invisible to exactly
the tooling people rely on to catch a missing dependency. Fix: add it to your own `dependencies`
explicitly whenever `provideZoneChangeDetection()` is in the array.

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

**Symptom: you removed `zone.js` from the `build` target's `polyfills` and the test run still loads
it.** Cause: the zoneless guide describes an older workspace shape with `polyfills` on *both* the
`build` and `test` targets. A freshly generated v22 project has no `polyfills` on the `test` target
at all — `@angular/build:unit-test` inherits from `build` — but a project generated before v21 may
still carry both. Fix: read your own `angular.json` and remove every `zone.js` and `zone.js/testing`
entry you find, rather than assuming which shape you have.

**Symptom: `runOutsideAngular()` is used to keep an expensive loop out of change detection, and it
makes no measurable difference.** Cause: in a zoneless application `NoopNgZone.runOutsideAngular` is
`return fn()` — the identity function. There is nothing to run outside of, because nothing is being
patched. Fix: nothing to fix, but delete the call rather than leaving a line that reads as a
performance measure and is not one.

## Interview questions

**★ You are asked to migrate a v18 application to v22. What are the change-detection steps, in order?**
Delete nothing first — read `angular.json`. If `polyfills` lists `zone.js` and the app relies on
`setTimeout`/`Promise`/event-driven repaints, the safe landing is v22 with
`provideZoneChangeDetection({ eventCoalescing: true })` added and the polyfill kept; the v21 upgrade
migration adds that provider for you. Only then migrate state to signals component by component,
and when nothing depends on zone patching, remove the provider, drop `polyfills` from the build
target, and uninstall `zone.js` from `dependencies`. Adding `provideZonelessChangeDetection()` is
never a step — it is the pre-v21 spelling of doing nothing.

**★ Which half of the zone decision fails loudly and which fails silently, and why is the asymmetry
built that way?**
Provider-without-polyfill fails loudly: `new NgZone(...)` throws NG0908 on `typeof Zone == 'undefined'`
during bootstrap, because a zone-mode application genuinely cannot run. Polyfill-without-provider
fails silently: the application is simply zoneless and carries an unused library, which is a size
problem rather than a correctness one, so nothing throws. The asymmetry is exactly the difference
between "cannot work" and "works but wastes bytes" — and it is why the second one survives in real
codebases for years.

**★ A colleague says "we removed Zone.js, so our app is faster". What would you check before agreeing?**
Whether Zone.js was actually removed from the *build*. Deleting `provideZonelessChangeDetection()`
in v22 leaves the app zoneless but does nothing to `angular.json`, and no diagnostic fires — the
NG0914 warning lives inside the provider that was deleted. Check the `polyfills` option on the
`build` target and `zone.js` in `dependencies`; a v22 zoneless workspace should have neither.

**In a default v22 application, what does `inject(NgZone)` return — and why is that a deliberate
choice rather than an oversight?**
It returns a `NoopNgZone`, because `provideZonelessChangeDetectionInternal()` includes
`{provide: NgZone, useClass: NoopNgZone}`. Returning an instance rather than leaving the token
unprovided means every library that injects `NgZone` keeps compiling and keeps running; it just gets
a class whose `run` is `fn.apply(...)`, whose `runOutsideAngular` is `fn()`, whose `isStable` is the
literal `true`, and whose four emitters are constructed and never emitted to. It is a compatibility
shim: the API surface survives, the behaviour does not.

**Why can a third-party library's `assertInAngularZone()` never pass in a zoneless application?**
Because `NgZone.isInAngularZone()` opens with `typeof Zone !== 'undefined' && …`, and in a zoneless
build the `Zone` global does not exist, so the whole expression short-circuits to `false` regardless
of what the caller is doing. `assertInAngularZone()` is defined in terms of it, so it throws NG0909
unconditionally. There is no calling context that satisfies it — which is why the only real fix is a
zoneless-aware version of the library, not a change on your side.

**`ChangeDetectionScheduler` is bound to the same implementation in both modes. So what is actually
different at runtime between a zone app and a zoneless one?**
Only the notification sources and the `NgZone` implementation. Both modes resolve
`ChangeDetectionScheduler` to `ChangeDetectionSchedulerImpl`; a zone app additionally gets a real
`NgZone` whose patched APIs notify that scheduler on stabilization, plus `scheduleInRootZone`
becoming reachable, since it is computed as
`!this.zonelessEnabled && this.zoneIsDefined && …` and both leading conditions are false without
Zone.js. The traversal, the dirty marking and the `NG0103` notification cap are the same code in
both.

---

← Prev: [The redundant opt-in, and NG0408](05c-the-redundant-opt-in-and-ng0408.md) · Index: [Topic index](README.md) · Next → [Startup and error-listener providers](06-startup-and-error-listener-providers.md)
