---
title: "`provideZonelessChangeDetection()` re-registers three records the framework already prepended, so its only remaining effects are two diagnostics — NG0914 at call time and NG0408 at bootstrap"
sidebar_label: "05c · The redundant opt-in, and NG0408"
sidebar_position: 5.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`provideZonelessChangeDetection`](https://angular.dev/api/core/provideZonelessChangeDetection),
> [Angular without ZoneJS (Zoneless)](https://angular.dev/guide/zoneless) — and
> `angular/angular` at tag `v22.1.5`:
> [`change_detection/scheduling/zoneless_scheduling_impl.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/zoneless_scheduling_impl.ts),
> [`platform/bootstrap.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/platform/bootstrap.ts),
> [`errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`provideZonelessChangeDetection()` is the call every pre-v21 tutorial tells you to add and the one
call a v22 application should not contain. It is not harmful and it is not a no-op: it re-registers
the same three records the framework already prepended, and it additionally sets `PROVIDED_ZONELESS`
— in development mode only — which is the tripwire that arms NG0408. Its other effect happens before
any injector exists: the function body itself warns NG0914 the moment it is called, if the `Zone`
global is present. So its whole remaining purpose in v22 is diagnostic, and both of its diagnostics
are compiled out of a production build.** This chunk is that body line by line, the six APIs that
schedule change detection once Zone.js is gone, and the conflict check in `bootstrap.ts` that fires
when this call and [05b](05b-provide-zone-change-detection-the-opt-out.md)'s end up in the same
flattened array.

## The function, in full

From `zoneless_scheduling_impl.ts`:

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

## The six things that schedule change detection without Zone.js

The list every reader actually wants, verbatim from the same JSDoc:

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

Read the list the other way round and it is a migration checklist. Every item on it is something you
write deliberately — a signal write, a `markForCheck()`, a template `(click)` binding. Nothing on it
happens as a side effect of an unrelated browser API. That is the whole design: in zoneless mode
Angular is notified because your code told it, not because a global was monkey-patched.

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

Note which two tokens the check reads. Neither is `ZONELESS_ENABLED` — that would be useless, since
it always has a value. It reads `PROVIDED_ZONELESS` and `PROVIDED_NG_ZONE`, the two intent flags each
provider function sets about itself, and both default to `false`. That is why the framework's own
internal zoneless providers do not trip it.

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
and none of those APIs is on the list of six things that notify Angular. Fix, if you are not ready
to migrate to signals, is the explicit opt-out plus the polyfill:

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

**★ Symptom: NG0914 prints from a unit test or a script that never bootstraps an application.**
Cause: the warning lives in the provider *function body*, not in an injector — the call checks
`typeof Zone !== 'undefined'` the moment it runs, so merely constructing a providers array is enough
to emit it. A test harness that loads `zone.js/testing` and a config file that calls
`provideZonelessChangeDetection()` is the usual pairing. Fix: delete the call; in v22 the array it
returns is redundant anyway.

**Symptom: NG0408 never appears even though both calls are visibly in the array.** Cause: you are
looking at a production build. `PROVIDED_ZONELESS` is registered only under
`typeof ngDevMode === 'undefined' || ngDevMode`, and the check in `bootstrap.ts` is itself inside an
`ngDevMode` guard, so both halves are compiled out. Fix: reproduce the conflict with `ng serve`; a
production build boots silently in whichever mode the later provider selected.

**Symptom: you searched the console for `Find more at https://angular.dev/errors/NG0914` and found
nothing, so you assumed the warning came from somewhere else.** Cause: `formatRuntimeError` appends
that trailer based on the sign of the numeric code, and `914` is positive. The rendered string ends
at `angular.json file.` Fix: search for the message text, not the trailer.

**Symptom: you keep `provideZonelessChangeDetection()` "for documentation", and a later reviewer
adds `provideZoneChangeDetection()` to the same array to fix a repaint bug.** Cause: the two now
conflict, NG0408 warns in development only, and the winner is decided by array order — which is a
property of a file nobody reads for that reason. Fix: state the mode in a comment, not in a
redundant call, so that the array has exactly one change-detection provider or none.

## Interview questions

**★ What happens if you call `provideZonelessChangeDetection()` in a v22 application?**
It is redundant, not harmful. The three records it returns are identical to the ones the framework
already prepended, so re-registering them changes nothing. It additionally sets `PROVIDED_ZONELESS`
to `true` — in dev mode only — which is what allows NG0408 to fire if something else provides
`provideZoneChangeDetection`. And if the `Zone` global happens to exist, the function warns NG0914
at call time. So its only effects are diagnostic.

**★ Why is NG0408 a warning while `provideHttpClient`'s conflicting features throw?**
It is the rule [chunk 04](04-writing-your-own-provide-function.md) states: throw for a contradiction,
warn for a suspicion. `withXsrfConfiguration()` plus `withNoXsrfProtection()` has no correct
behaviour, so it throws. Zone plus zoneless *does* have a defined outcome — the later provider wins
and the app runs correctly in that mode — so it only warns.

**★ Zone.js patched dozens of browser APIs. Zoneless replaces them with six. Which six, and what is
the pattern?**
`ChangeDetectorRef.markForCheck`, `ComponentRef.setInput`, updating a signal read in a template, a
bound host or template listener firing, attaching a view marked dirty by one of those, and removing a
view. The pattern is that every one of them is something Angular itself mediates — you called an
Angular API, or the template you wrote fired a binding Angular installed. Nothing on the list is a
side effect of an unrelated global. That is why `setTimeout` and a raw `addEventListener` stop
working as change-detection triggers, and why moving state into signals is the durable migration
rather than a stylistic preference.

**Can NG0408 reach production?**
No, and that is worth knowing. `PROVIDED_ZONELESS` is only registered under
`typeof ngDevMode === 'undefined' || ngDevMode`, and the check in `bootstrap.ts` is itself inside an
`ngDevMode` guard. A production build with both providers present boots silently in whichever mode
the later provider selected.

**The NG0408 check reads `PROVIDED_ZONELESS` and `PROVIDED_NG_ZONE`. Why not read
`ZONELESS_ENABLED`, which already records the mode?**
Because `ZONELESS_ENABLED` always has a value — its factory returns `true` with no provider at all —
so it can never distinguish "someone chose this" from "this is the default". The two intent tokens
both default to `false` and are set only by the corresponding public provider function, so reading
both and finding both `true` is exactly the statement "two humans made two contradictory choices".
It also means the framework's own internal zoneless providers cannot trip the check, which is
required, since they are present in every application.

**At what point in bootstrap does NG0408 fire, and why does that ordering matter?**
Inside `ngZone.run(...)` at the top of `bootstrap()` — after the environment injector exists, but
before environment initializers, before `ApplicationInitStatus.runInitializers()` and long before
`appRef.bootstrap()`. It therefore prints ahead of every log line the application itself produces,
which in a busy console means it scrolls away before anyone looks. It is the first thing in the log,
not the last.

---

← Prev: [`provideZoneChangeDetection()`, the opt-out](05b-provide-zone-change-detection-the-opt-out.md) · Index: [Topic index](README.md) · Next → [The polyfill half, and `NoopNgZone`](05d-the-polyfill-half-and-noopngzone.md)
