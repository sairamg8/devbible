---
title: "`interval` turns `checkNoChanges` into a self-rescheduling timer whose only exit is application destruction, and because half the provider is `multi: true` no later call can switch it off"
sidebar_label: "05g · The `checkNoChanges` interval"
sidebar_position: 5.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`change_detection/scheduling/exhaustive_check_no_changes.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/exhaustive_check_no_changes.ts)
> (full source of `exhaustiveCheckNoChangesInterval`),
> [`di/provider_collection.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/provider_collection.ts)
> (`provideEnvironmentInitializer`),
> [`di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts)
> (`resolveInjectorInitializers`).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Passing `interval` to `provideCheckNoChangesConfig` does something categorically different from
passing `exhaustive` alone: instead of strengthening the check Angular already runs after change
detection, it arms a `setTimeout` chain that runs an exhaustive `checkNoChanges` over every attached
view on a schedule, for as long as the application exists. The whole thing is twenty-five lines, and
every one of its design decisions changes how you debug with it — it is not awaited, it runs outside
the Angular zone, it re-schedules rather than skipping when a tick is in flight, its findings arrive
through `ErrorHandler` rather than as a throw, and its only exit is `applicationRef.destroyed`. The
sharpest consequence is an ordering asymmetry: the `exhaustive` half of the provider is a non-multi
`useValue` that a later call overwrites, while the timer half is a `multi: true` environment
initializer that only ever accumulates. There is no provider that turns an interval off. The blind
spot this closes is [05e](05e-provide-check-no-changes-config.md); its dev-only body and
developer-preview tag are [05f](05f-check-no-changes-in-production-and-developer-preview.md).**

## Twenty-five lines, six decisions

`exhaustiveCheckNoChangesInterval`, verbatim from
[`scheduling/exhaustive_check_no_changes.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/exhaustive_check_no_changes.ts):

```ts
export function exhaustiveCheckNoChangesInterval(interval: number) {
  return provideEnvironmentInitializer(() => {
    const applicationRef = inject(ApplicationRef);
    const errorHandler = inject(ErrorHandler);
    const scheduler = inject(ChangeDetectionSchedulerImpl);
    const ngZone = inject(NgZone);

    function scheduleCheckNoChanges() {
      ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          if (applicationRef.destroyed) {
            return;
          }
          if (scheduler.pendingRenderTaskId || scheduler.runningTick) {
            scheduleCheckNoChanges();
            return;
          }

          for (const view of applicationRef.allViews) {
            try {
              checkNoChangesInternal(view._lView, true /** exhaustive */);
            } catch (e) {
              errorHandler.handleError(e);
            }
          }

          scheduleCheckNoChanges();
        }, interval);
      });
    }
    scheduleCheckNoChanges();
  });
}
```

**It is an environment initializer, not an app initializer.** `provideEnvironmentInitializer` is
literally `{provide: ENVIRONMENT_INITIALIZER, multi: true, useValue: initializerFn}`, so the function
runs at injector construction, in the injection context, and its return value is discarded —
bootstrap is not delayed by a millisecond ([06d](06d-environment-initializers.md)). The initializer's
entire job is to arm one timer and return, which is exactly the shape a non-awaited initializer is
for.

**It runs outside the Angular zone.** In a zone application `setTimeout` is patched, so scheduling
the poll inside the zone would notify the scheduler on every iteration — the check would cause the
very change detection run it exists to observe the absence of, forever. `runOutsideAngular` puts the
timer on the unpatched path. In a zoneless application `NoopNgZone.runOutsideAngular` is `return
fn()`, the identity function ([05d](05d-the-polyfill-half-and-noopngzone.md)), and the raw
`setTimeout` notifies nothing anyway — so the call costs a stack frame and changes nothing. Writing
it unconditionally is cheaper than branching on the mode.

**Its only exit is application destruction.** `if (applicationRef.destroyed) { return; }` and nothing
else. The function returns no handle, there is no token to flip, and no later provider removes it.
Once the initializer has run, the loop re-arms every `interval` milliseconds for the life of the
application.

**It defers rather than skips while change detection is in flight.** `scheduler.pendingRenderTaskId ||
scheduler.runningTick` means a tick is scheduled or running, and checking mid-tick would be
meaningless — so the callback calls `scheduleCheckNoChanges()` and returns. That is *re-schedule*,
not *skip*: it comes back in another `interval` milliseconds rather than losing the round.

**It always checks exhaustively, whatever the token says.** The call is
`checkNoChangesInternal(view._lView, true /** exhaustive */)` — a literal `true`, not the value of
`UseExhaustiveCheckNoChanges`. The token and the timer are two independent knobs, and it is the
*overload signatures* that keep them in agreement ([05e](05e-provide-check-no-changes-config.md)); the
implementation enforces nothing.

**Failures go to `ErrorHandler`, not to a throw.** The `try`/`catch` sits inside the
`for (const view of applicationRef.allViews)` loop, so one misbehaving view neither hides the rest
nor kills the timer. What reaches you is `errorHandler.handleError(e)` — an error *reported* from a
timer callback, asynchronously, with no user interaction anywhere in its stack
([06g](06g-error-handler-and-ng0402.md)).

## The two halves override asymmetrically

`provideCheckNoChangesConfig` returns **two different kinds of provider**, and they behave in
opposite ways when the call appears twice in the same flattened array:

| Half | Provider kind | What a second call does |
|---|---|---|
| `{provide: UseExhaustiveCheckNoChanges, useValue: options.exhaustive}` | plain, non-multi | **overwrites** — the last one in the flattened array wins ([05](05-change-detection-providers.md)) |
| `exhaustiveCheckNoChangesInterval(interval)` | `ENVIRONMENT_INITIALIZER`, `multi: true` | **accumulates** — you now have two timers |

So a later `provideCheckNoChangesConfig({exhaustive: false})` written to "turn the earlier one off"
flips the token and leaves the timer running — and the timer hardcodes `exhaustive: true`, so the
thing you were trying to disable carries on happening on a schedule. **The only control over an
interval is not calling it.**

## Gotchas

**★ Symptom: you add `{exhaustive: false}` later in the array to switch off an earlier
`{exhaustive: true, interval: 1000}`, and errors keep arriving every second.** Cause: the two halves
of the provider are different kinds. The `UseExhaustiveCheckNoChanges` `useValue` is non-multi, so
the later `false` does win; the interval is an `ENVIRONMENT_INITIALIZER` with `multi: true`, so it
accumulates and is never replaced — and its check passes a literal `true` regardless of the token.
Fix: there is no "off" provider; decide once, at the point of registration:

```ts
// ⛔ the timer from the first call is still running
providers: [
  provideCheckNoChangesConfig({ exhaustive: true, interval: 1000 }),
  provideCheckNoChangesConfig({ exhaustive: false }),
],

// ✅ one call, or none
providers: [
  ...(environment.production ? [] : [provideCheckNoChangesConfig({ exhaustive: true, interval: 1000 })]),
],
```

**★ Symptom: the check runs twice as often as the interval you configured, or the same finding is
reported twice.** Cause: two calls carrying an `interval` — typically one in a shared debug array and
one added locally — each contributing its own `multi: true` initializer and therefore its own
independent, self-rescheduling `setTimeout` chain. Nothing deduplicates them. Fix: give the setting a
single owner and import it:

```ts
// debug.providers.ts — the only place this provider is called
export const debugProviders = environment.production
  ? []
  : [provideCheckNoChangesConfig({ exhaustive: true, interval: 1000 })];
```

**★ Symptom: you put the provider in a lazy route's `providers` and the timer only starts after
someone visits that route.** Cause: `EnvironmentProviders` is legal in a route's `providers`, and
`resolveInjectorInitializers` reads `ENVIRONMENT_INITIALIZER` with **`{self: true}`** on each
injector, so the initializer runs when *that route's* injector is constructed — not at bootstrap
([06d](06d-environment-initializers.md)). It then injects the root `ApplicationRef` and polls the
whole application from there, so the scope is application-wide but the start time is a navigation.
Fix: register it in `ApplicationConfig`, where the lifetime matches what it is checking:

```ts
// app.config.ts — not in a route
export const appConfig: ApplicationConfig = {
  providers: [provideCheckNoChangesConfig({ exhaustive: true, interval: 1000 })],
};
```

Whether the `UseExhaustiveCheckNoChanges` **token** is honoured when provided in a route injector
rather than the application one depends on which injector the change-detection traversal reads it
through, and this page did not verify that — a second reason to keep the whole call at application
level.

**Symptom: a test suite slows down or produces errors long after the test that caused them.** Cause:
the loop re-arms unconditionally and exits only on `applicationRef.destroyed`, and it returns no
handle, so a test configuration that includes the interval provider keeps a timer chain alive for the
life of every application instance it creates. Fix: do not register it in test configurations — build
the testing providers without the debug array rather than trying to disable it afterwards:

```ts
TestBed.configureTestingModule({
  providers: [...applicationProviders], // deliberately without debugProviders
});
```

**Symptom: you set a very small `interval` on a busy screen and no findings ever appear.** Cause:
every callback that lands while `scheduler.pendingRenderTaskId || scheduler.runningTick` is truthy
re-schedules instead of checking. An application that has a tick scheduled or running at almost every
timer boundary can keep deferring, and the deferral is silent — there is no log, no counter, nothing
that distinguishes "checked and found nothing" from "never got a quiet moment". Fix: use an interval
long enough to land between ticks:

```ts
// ⛔ on a busy screen this can defer indefinitely
provideCheckNoChangesConfig({ exhaustive: true, interval: 5 }),

// ✅ lands in the gaps
provideCheckNoChangesConfig({ exhaustive: true, interval: 1000 }),
```

**Symptom: the interval provider ends up in the server configuration through a config merge.** Cause:
a server config is normally the application config merged with server-specific providers — the merge
mechanics are **17 · The server config merge** *(not written yet)* — so anything in the shared array
is registered during server-side rendering too, and the initializer arms a timer there. The loop's
only exit is `applicationRef.destroyed`, so it ends when the rendered application is destroyed; this
page did not verify how a given server build defines `ngDevMode` or exactly when that destruction
happens. Fix: keep debugging providers out of the shared array so the question never arises:

```ts
// app.config.ts — shared, no debug providers
export const appConfig: ApplicationConfig = { providers: [...coreProviders] };

// app.config.browser.ts — browser-only debugging
export const browserConfig = mergeApplicationConfig(appConfig, { providers: debugProviders });
```

## Interview questions

**★ `provideCheckNoChangesConfig` returns two providers. Why does knowing that change how you
configure it?**
Because they override in opposite directions. The `exhaustive` setting is a plain non-multi `useValue`
on `UseExhaustiveCheckNoChanges`, so a later call overwrites it and the last one in the flattened
array wins — ordinary provider shadowing ([05](05-change-detection-providers.md)). The interval is
`provideEnvironmentInitializer(...)`, which is `{provide: ENVIRONMENT_INITIALIZER, multi: true, …}`,
so a second call *adds* a second timer rather than replacing the first, and there is no mechanism
anywhere for removing one. The practical rule that falls out: `exhaustive` is a setting you may
override, and `interval` is a commitment you can only decline at the point of registration.

**★ Why is the poll built on `provideEnvironmentInitializer` rather than `provideAppInitializer`?**
Because it must not delay bootstrap. `provideAppInitializer` is awaited — bootstrap blocks until the
returned promise settles ([06](06-startup-and-error-listener-providers.md)) — so a debugging feature
built on it could hold up the first render. `provideEnvironmentInitializer` runs at injector
construction, in the injection context, and its return value is thrown away
([06d](06d-environment-initializers.md)). The initializer here does nothing but arm a `setTimeout`
and return, so "not awaited" is exactly right, and the `{self: true}` read means a route-level
registration would run on that route's injector instead.

**Why does the timer call `ngZone.runOutsideAngular` when a zoneless application's `NgZone` is a
no-op?**
Because the provider has to work in both modes and only one of them needs it. In a zone application
`setTimeout` is patched by Zone.js, so scheduling the poll inside the Angular zone would notify the
scheduler on every iteration — the check would trigger the change detection it exists to observe the
absence of, in a loop that never settles. `runOutsideAngular` schedules on the unpatched path. In a
zoneless application `NoopNgZone.runOutsideAngular` is `return fn()`
([05d](05d-the-polyfill-half-and-noopngzone.md)) and the timer is unpatched anyway, so the call is
inert. Writing it unconditionally is simpler and cheaper than asking which mode is active.

**The callback re-schedules when a tick is in flight instead of checking or skipping. Why is that the
right choice both ways?**
Checking anyway would be meaningless: `checkNoChanges` asserts that a *completed* change detection
run left the tree stable, so running it mid-tick would report differences that are simply work in
progress — false positives on a tool whose whole value is that its findings are real. Skipping the
round would fail in the other direction: an application that happens to be busy at every timer
boundary would silently never be checked, and the feature would look configured while doing nothing.
Re-scheduling neither lies nor gives up. Its cost is the failure mode in the gotchas — a very short
interval on a very busy screen can defer for a long time with no signal that it is doing so.

**Why does each view's check sit in its own `try`/`catch` calling `handleError`, instead of letting
the error throw?**
Two reasons, both visible in the source. The `try` is inside the `for (const view of
applicationRef.allViews)` loop, so catching per view means one broken component does not hide every
other broken component — you get the whole sweep in a single pass rather than one finding per run.
And `scheduleCheckNoChanges()` is called after the loop, so an uncaught throw would terminate the
timer chain: the first finding would also be the last, and the feature would stop working precisely
when it started being useful. Routing through `ErrorHandler` also delivers findings wherever the
application already sends errors ([06g](06g-error-handler-and-ng0402.md)) — a benefit until someone
installs a handler that does not log.

**The poll passes a literal `true` for `exhaustive` and never reads
`UseExhaustiveCheckNoChanges`. What does that tell you about the API?**
That the coupling between the two options lives entirely in the type system. The implementation
signature is `{interval?: number; exhaustive: boolean}` and the body registers the timer whenever
`interval !== undefined`, so a caller who reaches that state — from JavaScript, or through `as any` —
gets a periodic *exhaustive* check while the after-change-detection pass stays non-exhaustive, a
combination the documentation never describes. The two overloads exist to make that unreachable from
TypeScript ([05e](05e-provide-check-no-changes-config.md)). It is a good illustration of a general
rule for your own `provide*` functions: when the runtime does not enforce a combination, the
signature has to, and an options bag with independent optional fields cannot
([04](04-writing-your-own-provide-function.md)).

---

← Prev: [05f · Dev-only, and developer preview](05f-check-no-changes-in-production-and-developer-preview.md) · Index: [Topic index](README.md) · Next → [05h · Hunting a stale binding](05h-hunting-a-stale-binding-in-zoneless.md)
