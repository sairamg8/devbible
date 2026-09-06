---
title: "A rejected app initializer does not produce a degraded application — it produces no application at all, and the only thing between that failure and total silence is the `.catch` the CLI generated in `main.ts`"
sidebar_label: "06c · When a startup initializer fails"
sidebar_position: 6.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`provideAppInitializer`](https://angular.dev/api/core/provideAppInitializer),
> [`bootstrapApplication`](https://angular.dev/api/platform-browser/bootstrapApplication); and
> `angular/angular` at tag `v22.1.5`:
> [`platform/bootstrap.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/platform/bootstrap.ts),
> [`application/application_ref.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/application_ref.ts),
> [`errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Startup failure in Angular is all-or-nothing. One rejected `provideAppInitializer` callback rejects
`ApplicationInitStatus.donePromise`, which stops bootstrap before the root component is created,
reports through `ErrorHandler` *outside* the Angular zone, rethrows on purpose, and rejects the
Promise `bootstrapApplication` returned.** The visible result is a blank page with one console line —
and that one line exists only because the CLI generated `.catch((err) => console.error(err))` in
`main.ts`. Delete it and a startup failure becomes an unhandled rejection that a test harness or a
framework wrapper can swallow entirely. This chunk is that chain in full, the decision it forces on
you about degraded starts, and `NG0405`, the error you reach by trying to drive `ApplicationRef`
around it.

## The chain, one link at a time

`Promise.all(asyncInitPromises).catch((e) => this.reject(e))` rejects `donePromise`. Bootstrap's
continuation — the part that reads `LOCALE_ID` and then calls `appRef.bootstrap(rootComponent)` —
never runs. The rejection instead reaches `_callAndReportToErrorHandler`, verbatim:

```ts
function _callAndReportToErrorHandler(
  errorHandler: (e: unknown) => void,
  ngZone: NgZone,
  callback: () => any,
): any {
  try {
    const result = callback();
    if (isPromise(result)) {
      return result.catch((e: any) => {
        ngZone.runOutsideAngular(() => errorHandler(e));
        // rethrow as the exception handler might not do it
        throw e;
      });
    }

    return result;
  } catch (e) {
    ngZone.runOutsideAngular(() => errorHandler(e));
    // rethrow as the exception handler might not do it
    throw e;
  }
}
```

Three details in eighteen lines:

1. **The handler runs `runOutsideAngular`.** Reporting an error must not schedule change detection,
   and in a zone application the reporting path itself would otherwise be patched. In a zoneless
   application `NgZone` is a `NoopNgZone` whose `runOutsideAngular` is `fn()` — see
   [05d](05d-the-polyfill-half-and-noopngzone.md) — so the wrapper is inert but harmless.
2. **The rethrow is deliberate and commented.** *"rethrow as the exception handler might not do it"* —
   a custom `ErrorHandler` that swallows what it is given must not also swallow the *bootstrap
   failure signal*. Reporting and propagating are two separate obligations here.
3. **Both branches exist because a synchronous throw during bootstrap is possible too** — a provider
   factory that throws, a constructor that throws — and it takes exactly the same path.

End to end: **the initializer rejects → `donePromise` rejects → `ErrorHandler.handleError` runs
outside the Angular zone → the error is rethrown → the Promise returned by `bootstrapApplication`
rejects → `main.ts`'s `.catch` logs it → the root component is never created and the page keeps
whatever `index.html` shipped.**

🔴 **Nothing is rolled back.** `Promise.all` rejects on the *first* rejection, but the other
initializers keep running to completion in the background and their side effects still happen. If
partial side effects at startup are unacceptable, that has to be handled inside your own code —
bootstrap failure unwinds nothing.

## The decision this forces: can the application start degraded?

Because there is no partially-started state, the reliability of anything in an app initializer
becomes part of the reliability of the application bundle itself. That is a real architectural
commitment and it is worth making on purpose:

```ts
provideAppInitializer(async () => {
  const config = inject(RuntimeConfigService);
  const errors = inject(ErrorHandler);
  try {
    await config.load();
  } catch (e) {
    // For this app a blank page is worse than built-in defaults. Report, then continue.
    errors.handleError(e);
    config.useBuiltInDefaults();
  }
}),
```

The opposite choice is equally legitimate and should be equally explicit — an application that must
not render with the wrong tenant, the wrong currency or the wrong permissions is *better* off dead
than degraded, and letting the rejection escape is how you say so. What is not legitimate is
arriving at either outcome by accident.

If a failed start needs a human-visible result rather than a console line, the place to produce it is
`main.ts`, because at that point no Angular application exists to render anything:

```ts
// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => {
  console.error(err);
  document.querySelector('#startup-fallback')?.classList.remove('hidden');
});
```

That fallback element has to be in `index.html`, shipped with the document — anything Angular would
have rendered is unavailable by definition.

## `done`, `donePromise`, and `NG0405`

`ApplicationInitStatus` exposes a synchronous `done` boolean, set inside `complete()`, alongside the
`donePromise` bootstrap awaits. `ApplicationRef.bootstrap()` reads the boolean and refuses to run
while it is `false`:

```ts
      if (!initStatus.done) {
        let errorMessage = '';
        if (typeof ngDevMode === 'undefined' || ngDevMode) {
          const standalone = isStandalone(component);
          errorMessage =
            'Cannot bootstrap as there are still asynchronous initializers running.' +
            (standalone
              ? ''
              : ' Bootstrap components in the `ngDoBootstrap` method of the root module.');
        }
        throw new RuntimeError(RuntimeErrorCode.ASYNC_INITIALIZERS_STILL_RUNNING, errorMessage);
      }
```

Two things to keep. The message body is built **only under `ngDevMode`**, so in a production build
the throw still happens and carries the bare string `NG0405` with no explanation —
`formatRuntimeError` collapses to just the code when `message` is falsy. And the second sentence
appears only for a **non-standalone** component, which in v22 means a legacy `NgModule` bootstrap; a
standalone root gets the first sentence alone.

**There is no public "startup finished" event other than the Promise `bootstrapApplication`
returns.** If code must run after initializers have settled, the two honest options are a later app
initializer, or a continuation in `main.ts`:

```ts
bootstrapApplication(App, appConfig)
  .then((appRef) => {
    // every app initializer has settled; the root component exists
    appRef.injector.get(TelemetrySink).markAppReady();
  })
  .catch((err) => console.error(err));
```

Injecting `ApplicationInitStatus` and polling `done` works, but it couples you to an internal surface
for no gain — the Promise carries the same information with an error channel attached.

## Gotchas

**★ Symptom: the page is blank and the console has exactly one red line, logged from `main.ts`.**
Cause: an app initializer rejected, `donePromise` rejected, `bootstrapApplication`'s Promise rejected,
and the root component was never created. Fix: decide whether the app can start degraded, and if it
can, handle the failure inside the initializer so it never escapes —

```ts
provideAppInitializer(async () => {
  const config = inject(RuntimeConfigService);
  const errors = inject(ErrorHandler);
  try {
    await config.load();
  } catch (e) {
    errors.handleError(e);
    config.useBuiltInDefaults();
  }
}),
```

**★ Symptom: the page is blank and the console is completely empty.** Cause: the generated
`.catch((err) => console.error(err))` was removed from `main.ts` — a very common casualty of adding
`await` to the bootstrap call or wrapping it in a helper. A rejected bootstrap Promise with no
handler is an unhandled rejection, and a test runner, an error-reporting wrapper or a micro-frontend
shell can absorb it silently. Fix: never let the bootstrap Promise go unhandled —

```ts
// ⛔ the rejection has nowhere to go
bootstrapApplication(App, appConfig);
// ✅
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
```

**★ Symptom: `NG0405: Cannot bootstrap as there are still asynchronous initializers running.`** Cause:
`ApplicationRef.bootstrap()` was called by hand — from an `ngDoBootstrap`, a custom-element upgrade,
or a test harness — while `initStatus.done` was still `false`. Fix: await the bootstrap Promise
instead of driving `ApplicationRef` yourself —

```ts
const appRef = await bootstrapApplication(App, appConfig);
// every app initializer has settled by the time this line runs
```

**Symptom: in a production build the same failure prints only `NG0405`, with no sentence after it.**
Cause: the message is constructed inside an `ngDevMode` branch, and `formatRuntimeError` produces
just the code when the message is falsy. Fix: reproduce in a development build before debugging. Every
runtime error code in this topic behaves the same way, so a bare `NGxxxx` in production is a signal to
change build configuration, not to start guessing at the cause.

**Symptom: an app initializer rejected, yet its work partly happened — a row was written, an analytics
event was sent, a lock was taken and never released.** Cause: `Promise.all` rejects on the first
rejection and cancels nothing; every other initializer, and the remainder of the rejecting one's own
continuation, runs to completion. Fix: if partial startup side effects are unacceptable, put the
sequence in one initializer with explicit compensation —

```ts
provideAppInitializer(async () => {
  const leases = inject(StartupLeaseService);
  const lease = await leases.acquire();
  try {
    await inject(RuntimeConfigService).load();
  } catch (e) {
    await leases.release(lease);   // bootstrap failure will not do this for you
    throw e;
  }
}),
```

**Symptom: a custom `ErrorHandler` reports the startup failure and the application still does not
start.** Cause: that is the design — `_callAndReportToErrorHandler` rethrows after calling the
handler, precisely because *"the exception handler might not do it"*. Reporting an error and
suppressing it are separate acts, and the framework will not let a handler suppress a bootstrap
failure. Fix: if a particular failure should be survivable, catch it inside the initializer; the
`ErrorHandler` is the wrong lever and cannot reach that decision.

## Interview questions

**★ What exactly happens when a `provideAppInitializer` callback rejects?**
`runInitializers()` catches it in `Promise.all(...).catch((e) => this.reject(e))`, which rejects
`ApplicationInitStatus.donePromise`. Bootstrap's continuation — the part that creates the root
component — never runs. The rejection propagates into `_callAndReportToErrorHandler`, which calls the
`ErrorHandler` **outside the Angular zone** and then deliberately rethrows, with the source comment
*"rethrow as the exception handler might not do it"*. That rethrow rejects the Promise returned by
`bootstrapApplication`, which is why the CLI's generated `.catch((err) => console.error(err))` is the
last thing standing between a failed initializer and total silence. The user-visible result is that
the application does not exist at all — there is no partially-started state to recover from, and
nothing is rolled back.

**★ You need a feature flag fetched from a server before the first render. Where does that go, and
what is the cost?**
`provideAppInitializer`, returning the Promise, because it is the only hook that delays
`appRef.bootstrap()`. The cost is that the request is now on the critical path of first paint and its
failure is a total bootstrap failure — so either that endpoint must be as reliable as the application
bundle itself, or the initializer must catch its own failure and fall back to defaults. The
alternative is to let the app render and let the flag arrive as a signal, which is strictly better for
perceived performance and strictly worse when a wrong first render is unacceptable: an A/B flicker, a
wrong locale, a wrong currency symbol. Naming that trade-off is the answer; "put it in an app
initializer" on its own is not.

**★ Why does the framework call your `ErrorHandler` and *then* rethrow, rather than treating the
handler as having dealt with it?**
Because the two concerns are different. `ErrorHandler` is a reporting seam — it exists so an
application can route errors to a logging service, and a reasonable implementation of it does not
rethrow. But a bootstrap failure is not only an error to report, it is a fact the *caller* must learn:
`bootstrapApplication` returns a Promise, and resolving that Promise after a failed startup would hand
the caller an `ApplicationRef` for an application that was never created. The comment in the source
says exactly this — *"rethrow as the exception handler might not do it"* — and the consequence is that
you cannot make a startup failure survivable by writing a permissive `ErrorHandler`.

**What is the difference between `done` and `donePromise`, and when would you read either?**
`done` is a synchronous boolean flipped inside `complete()`; `donePromise` is what bootstrap awaits
and what carries the rejection. `ApplicationRef.bootstrap()` reads `done` because it needs a
synchronous answer at the moment it is called, and throws `NG0405` when the answer is `false`.
Application code should read neither: the Promise returned by `bootstrapApplication` already resolves
exactly when initialization succeeded and rejects exactly when it failed, and it is public API,
whereas `ApplicationInitStatus` is framework plumbing. Polling `done` is the shape people reach for
when they have put startup work somewhere it cannot be awaited from.

**A startup failure shows nothing at all — no console output, no error overlay. Where do you look
first?**
At `main.ts`, for a missing `.catch` on the bootstrap Promise. That is the single most common cause,
because the rejection has no other handler and an unhandled rejection can be absorbed by a test
runner, a micro-frontend shell, or a reporting library that installs its own listener. Second place to
look is whether the failure happened *before* the `ErrorHandler` was reachable at all — angular.dev
notes there is a window while the root instance is still being created in which Angular has nowhere to
send an error, and it behaves like an ordinary uncaught error instead. Third is a custom
`ErrorHandler` that throws inside `handleError`, which turns one diagnosable failure into two
confusing ones.

---

← Prev: [Initializer ordering](06b-initializer-ordering-and-failure.md) · Index: [Topic index](README.md) · Next → [Environment initializers](06d-environment-initializers.md)
