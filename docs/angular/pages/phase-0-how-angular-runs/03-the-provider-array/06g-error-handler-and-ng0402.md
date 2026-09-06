---
title: "`ErrorHandler` is a plain class with no `providedIn`, so the provider array is the only place it can be replaced — and the framework injects it through a lazy function token specifically so your replacement is allowed to depend on the rest of the application"
sidebar_label: "06g · `ErrorHandler` and NG0402"
sidebar_position: 6.6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [Unhandled errors in Angular](https://angular.dev/best-practices/error-handling),
> [`ErrorHandler`](https://angular.dev/api/core/ErrorHandler); and `angular/angular` at tag `v22.1.5`:
> [`error_handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/error_handler.ts),
> [`application/create_application.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/create_application.ts),
> [`errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Everything in the previous three chunks funnels into one token, and that token is deliberately not
`providedIn: 'root'`.** `ErrorHandler` is an ordinary class whose default implementation is four lines
of `console.error`, provided by the platform rather than by a tree-shakable injectable — which is why
replacing it means putting a provider in `ApplicationConfig.providers`, and why the framework ships an
environment initializer, `NG0402`, whose whole job is to shout if the token ends up unprovided. The
subtler piece is `INTERNAL_APPLICATION_ERROR_HANDLER`, a function-valued token that resolves your
handler *lazily*, on the first error rather than at bootstrap — which is what makes it legal for your
`ErrorHandler` to inject the `Router` or an HTTP client without closing a dependency cycle.

## The default handler is four lines

```ts
export class ErrorHandler {
  /**
   * @internal
   */
  _console: Console = console;

  handleError(error: any): void {
    this._console.error('ERROR', error);
  }
}
```

No decorator, no `providedIn`. It is provided by `BrowserModule` in the `NgModule` world and by the
platform providers in a standalone application, so **`inject(ErrorHandler)` is not guaranteed by the
class — it is guaranteed by bootstrap having put a record there.** That is the gap `NG0402` closes.

Note also the literal string prefix `'ERROR'`. In a browser console an unhandled Angular error looks
like `ERROR Error: …` rather than a native uncaught-error entry, which — combined with the
`preventDefault()` in [06f](06f-provide-browser-global-error-listeners.md) — is why the console's
appearance changes as soon as the global listeners are installed.

## `NG0402` — the framework checks that you still have one

`internalCreateApplication` prepends this to every application's providers, ahead of your array
(chunk [01](01-app-config-and-what-bootstrap-does-with-it.md) quotes the surrounding code):

```ts
export const errorHandlerEnvironmentInitializer = {
  provide: ENVIRONMENT_INITIALIZER,
  useValue: () => {
    const handler = inject(ErrorHandler, {optional: true});
    if ((typeof ngDevMode === 'undefined' || ngDevMode) && handler === null) {
      throw new RuntimeError(
        RuntimeErrorCode.MISSING_REQUIRED_INJECTABLE_IN_BOOTSTRAP,
        `A required Injectable was not found in the dependency injection tree. ` +
          'If you are bootstrapping an NgModule, make sure that the `BrowserModule` is imported.',
      );
    }
  },
  multi: true,
};
```

Three things to read out of it. It is an **environment initializer**, so it runs at step 2 of
bootstrap — before any app initializer, and before the root component exists. It is **dev-mode only**
in its message: `RuntimeErrorCode.MISSING_REQUIRED_INJECTABLE_IN_BOOTSTRAP` is `402`, a positive code,
so `formatRuntimeError` appends no *"Find more at"* link, and in a production build the throw carries
just `NG0402`. And it uses `{optional: true}` deliberately — it wants to *diagnose* the missing token
rather than fail with a provider-not-found error pointing at the framework's own injection site. In a
standalone v22 application it is nearly unreachable; it is overwhelmingly an `NgModule` app that
dropped `BrowserModule` during a migration, which is exactly what the message says.

## Replacing it — the provider, and where it goes

angular.dev is specific about the placement:

> *"Angular reports unhandled errors to the application's root `ErrorHandler`. When providing a custom
> `ErrorHandler`, provide it in your `ApplicationConfig` as part of calling `bootstrapApplication`."*

The documentation's own worked handler:

```ts
export class GlobalErrorHandler implements ErrorHandler {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly router = inject(Router);

  handleError(error: any) {
    const url = this.router.url;
    const errorMessage = error?.message ?? 'unknown';

    this.analyticsService.trackEvent({
      eventName: 'exception',
      description: `Screen: ${url} | ${errorMessage}`,
    });

    console.error(GlobalErrorHandler.name, {error});
  }
}
```

```ts
// src/app/app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};
```

🔴 **`ErrorHandler` is a non-multi token, so this is a last-wins override** — the mechanism chunk 13
works through. Your array is spread in after the framework's defaults, so your record replaces the
platform's. Two libraries that both provide `ErrorHandler` will silently leave only one standing, and
which one depends on array position, not on merit.

⚠️ **A route's `providers` is the wrong place for it.** The error handler the framework consults is
resolved from the application injector; a record in a route injector is a different record that
nothing in the error path looks up. The same is true of a component's `providers`.

## `INTERNAL_APPLICATION_ERROR_HANDLER` — why your handler may inject the `Router`

The handler above injects `Router`, which is provided by the same array that provides the handler. If
the framework resolved `ErrorHandler` eagerly at bootstrap, that would be a real risk of a cycle. It
does not:

```ts
export const INTERNAL_APPLICATION_ERROR_HANDLER = new InjectionToken<(e: any) => void>(
  typeof ngDevMode === 'undefined' || ngDevMode ? 'internal error handler' : '',
  {
    factory: () => {
      // The user's error handler may depend on things that create a circular dependency
      // so we inject it lazily.
      const zone = inject(NgZone);
      const injector = inject(EnvironmentInjector);
      let userErrorHandler: ErrorHandler;
      return (e: unknown) => {
        zone.runOutsideAngular(() => {
          if (injector.destroyed && !userErrorHandler) {
            setTimeout(() => {
              throw e;
            });
          } else {
            userErrorHandler ??= injector.get(ErrorHandler);
            userErrorHandler.handleError(e);
          }
        });
      };
    },
  },
);
```

**Four behaviours worth knowing.**

- **The handler is resolved on the first error, then memoised** (`userErrorHandler ??= …`). Until
  something goes wrong your `ErrorHandler` is never constructed, so a constructor with side effects
  runs at an unpredictable moment, or never.
- **Every report runs `runOutsideAngular`**, so handling an error never schedules change detection.
  In a zoneless application that is a `NoopNgZone` and the wrapper is inert — one of the compatibility
  shims [05d](05d-the-polyfill-half-and-noopngzone.md) covers.
- **If the injector is already destroyed and no handler was ever resolved, the error is rethrown from
  a `setTimeout`** — becoming an uncaught error rather than being swallowed by teardown. That is the
  one case where an error escapes the funnel by design.
- **This token, not `ErrorHandler`, is what the global listeners inject.** Everything routes through
  the function, and the function decides when to materialise the class.

## Gotchas

**★ Symptom: `NG0402: A required Injectable was not found in the dependency injection tree. If you are
bootstrapping an NgModule, make sure that the `BrowserModule` is imported.`** Cause: `ErrorHandler`
has no `providedIn`, so it exists only because bootstrap provided it — and an `NgModule` application
that dropped `BrowserModule` has removed the record. Fix: in an `NgModule` app, restore the import; in
a standalone app, which should never see this, provide it explicitly —

```ts
providers: [{ provide: ErrorHandler, useClass: GlobalErrorHandler }],
```

**★ Symptom: your custom `ErrorHandler` is never constructed, and a breakpoint in its constructor
never hits.** Cause: `INTERNAL_APPLICATION_ERROR_HANDLER` resolves it lazily, on the first error, and
memoises it. Nothing is wrong. Fix: if the handler must exist from startup — to install a session ID,
to open a transport — do that in an environment initializer instead of in the constructor —

```ts
provideEnvironmentInitializer(() => inject(CrashReporter).openSession()),
{ provide: ErrorHandler, useClass: GlobalErrorHandler },
```

**★ Symptom: a custom `ErrorHandler` in a lazily-loaded route's `providers` never receives anything.**
Cause: the error path resolves `ErrorHandler` from the *application* `EnvironmentInjector` captured by
`INTERNAL_APPLICATION_ERROR_HANDLER`'s factory. A route injector's record is a different record that
nothing consults. Fix: provide it once, in `app.config.ts`, and branch inside the handler if a feature
needs different treatment —

```ts
handleError(error: unknown): void {
  const url = this.router.url;
  if (url.startsWith('/admin')) {
    this.reporter.captureWithSeverity(error, 'critical');
    return;
  }
  this.reporter.capture(error);
}
```

**Symptom: two libraries each provide an `ErrorHandler` and only one of them ever runs.** Cause:
`ErrorHandler` is a non-multi token — the last provider for it in the flattened array wins. Fix: own
the token yourself and fan out explicitly —

```ts
@Injectable()
export class CompositeErrorHandler implements ErrorHandler {
  private readonly sinks = [inject(CrashReporter), inject(ConsoleSink)];
  handleError(error: unknown): void {
    for (const sink of this.sinks) {
      sink.capture(error);
    }
  }
}
```

**Symptom: an error inside `handleError` produces a confusing second failure.** Cause: nothing catches
the handler — it is called directly by the function token, inside `runOutsideAngular`. A handler that
throws turns one diagnosable error into two. Fix: make `handleError` total —

```ts
handleError(error: unknown): void {
  try {
    this.reporter.capture(error);
  } catch {
    // the reporter is down; never let that mask the original error
  }
  console.error(error);
}
```

**Symptom: an error thrown during teardown appears as an uncaught error rather than in your reporter.**
Cause: the `injector.destroyed && !userErrorHandler` branch rethrows from a `setTimeout` rather than
resolve a class from a dead injector. Fix: none available and none wanted — recognise it as an error
late enough in teardown that the reporting infrastructure was already gone.

**Symptom: a unit test fails with an error your production build tolerates.** Cause: *"Angular's
`TestBed` rethrows unexpected errors"*, so a handler that reports and returns cannot silence anything
under test. Fix: treat it as the test telling you the truth — assert the error explicitly if it is
expected, rather than widening the handler to make the test pass.

## Interview questions

**★ Why is `ErrorHandler` a plain class with no `providedIn: 'root'`, when almost everything else in
`@angular/core` is tree-shakably provided?**
Because it is not optional. `providedIn: 'root'` exists so a service that nobody injects can be
dropped from the bundle — but the framework injects `ErrorHandler` on every error path, so it can
never be dropped, and making it tree-shakable would buy nothing. Providing it from bootstrap instead
has a second benefit: it makes replacement a provider-array decision with clear last-wins semantics,
rather than a `providedIn` decision that a library could also make. The cost is the failure mode the
framework then has to guard against — an application that somehow has no record for it — which is
exactly what `NG0402` and its environment initializer are for.

**★ Your custom `ErrorHandler` injects the `Router`, which is part of the same application it is
reporting errors for. Why is that not a dependency cycle?**
Because `INTERNAL_APPLICATION_ERROR_HANDLER` does not resolve `ErrorHandler` when it is created — it
captures the `EnvironmentInjector` and returns a closure that calls `injector.get(ErrorHandler)` on
the first error, memoising the result. The source says so in a comment: *"The user's error handler may
depend on things that create a circular dependency so we inject it lazily."* By the time an error
occurs, the whole application injector is constructed and the `Router` resolves normally. The
observable consequence is that your handler's constructor runs on the first error rather than at
bootstrap, which is worth knowing before you put anything important in it.

**★ Where exactly does `provideBrowserGlobalErrorListeners()` send an error, and why is that not
`ErrorHandler` directly?**
It injects `INTERNAL_APPLICATION_ERROR_HANDLER` — a token whose value is a function `(e) => void` —
and calls it. Going through the function rather than the class buys three things at once: the lazy
resolution above, an unconditional `runOutsideAngular` so that reporting never schedules change
detection, and a defined behaviour when the injector has already been destroyed (rethrow from a
`setTimeout` rather than touch a dead injector). A listener that called `inject(ErrorHandler)`
directly would have to reimplement all three at every call site, and the pre-bootstrap and
post-destroy windows are precisely where that would go wrong.

**Two libraries in your dependency tree both provide `ErrorHandler`. What happens, and what do you
do?**
The last one in the flattened provider array wins, silently, because the token is not `multi` —
`R3Injector.processProvider` ends every non-multi provider with `this.records.set(token, record)`, so
registering it twice replaces the record. There is no warning; one library's reporting simply stops.
Fanning out through a composite handler you own — the gotcha above — is the only way to have two
consumers of a single-valued token, and it also moves the ordering decision into your code instead of
leaving it to a transitive dependency's position in the array.

---

← Prev: [The global error listeners](06f-provide-browser-global-error-listeners.md) · Index: [Topic index](README.md) · Next → [`provideRouter()` and the route array](07-provide-router-and-the-route-array.md)
