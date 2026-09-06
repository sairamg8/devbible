---
title: "`provideBrowserGlobalErrorListeners()` is one environment initializer that adds two window listeners and calls `preventDefault()` on both — it costs nothing at startup, it is a no-op on the server, and it takes the browser's own error reporting away from you"
sidebar_label: "06f · The global error listeners"
sidebar_position: 6.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [Unhandled errors in Angular](https://angular.dev/best-practices/error-handling),
> [`provideBrowserGlobalErrorListeners`](https://angular.dev/api/core/provideBrowserGlobalErrorListeners); and
> `angular/angular` at tag `v22.1.5`:
> [`error_handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/error_handler.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The CLI puts `provideBrowserGlobalErrorListeners()` at the top of every generated `app.config.ts`,
and almost nobody reads what it does. It is one `provideEnvironmentInitializer` whose callback injects
a token whose factory adds `'error'` and `'unhandledrejection'` listeners to `window`, forwards both
to the application's `ErrorHandler`, and calls `e.preventDefault()` on each.** That last detail is the
one that surprises people: the browser's own console reporting for those events is suppressed, so if
your `ErrorHandler` is quiet, so is the console. It is also a complete no-op under SSR, it removes its
listeners when the injector is destroyed, and — because it is an *environment* initializer rather than
an app initializer — it adds exactly zero latency to startup. This chunk is that function, what it
covers, and the three windows it does not cover.

## The whole function is one environment initializer

```ts
/**
 * Provides an environment initializer which forwards unhandled errors to the ErrorHandler.
 *
 * The listeners added are for the window's 'unhandledrejection' and 'error' events.
 *
 * @see [Global error listeners](best-practices/error-handling#global-error-listeners)
 *
 * @publicApi
 */
export function provideBrowserGlobalErrorListeners(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideEnvironmentInitializer(() => void inject(globalErrorListeners)),
  ]);
}
```

The `void` operator there is not decoration — it discards the token's value explicitly, which matters
because the initializer's declared type is `() => void` and the whole point of the token is its
*factory's side effects*, not its value. This is the same nesting chunk
[04](04-writing-your-own-provide-function.md) describes: `makeEnvironmentProviders` accepts
`(Provider | EnvironmentProviders)[]`, so a `provide*` function can be built out of another one.

Because it is an environment initializer and not an app initializer, **it is not awaited** — see
[06d](06d-environment-initializers.md). Adding it to `app.config.ts` cannot slow down your first
paint.

## What the token's factory actually does

```ts
const globalErrorListeners = new InjectionToken<void>(
  typeof ngDevMode !== 'undefined' && ngDevMode ? 'GlobalErrorListeners' : '',
  {
    factory: () => {
      if (typeof ngServerMode !== 'undefined' && ngServerMode) {
        return;
      }
      const window = inject(DOCUMENT).defaultView;
      if (!window) {
        return;
      }

      const errorHandler = inject(INTERNAL_APPLICATION_ERROR_HANDLER);
      const rejectionListener = (e: PromiseRejectionEvent) => {
        errorHandler(e.reason);
        e.preventDefault();
      };
      const errorListener = (e: ErrorEvent) => {
        if (e.error) {
          errorHandler(e.error);
        } else {
          errorHandler(
            new Error(
              ngDevMode
                ? `An ErrorEvent with no error occurred. See Error.cause for details: ${e.message}`
                : e.message,
              {cause: e},
            ),
          );
        }
        e.preventDefault();
      };

      const setupEventListeners = () => {
        window.addEventListener('unhandledrejection', rejectionListener);
        window.addEventListener('error', errorListener);
      };

      // Angular doesn't have to run change detection whenever any asynchronous tasks are invoked in
      // the scope of this functionality.
      if (typeof Zone !== 'undefined') {
        Zone.root.run(setupEventListeners);
      } else {
        setupEventListeners();
      }

      inject(DestroyRef).onDestroy(() => {
        window.removeEventListener('error', errorListener);
        window.removeEventListener('unhandledrejection', rejectionListener);
      });
    },
  },
);
```

**Six facts, all readable above.**

1. **It is a no-op on the server.** The `ngServerMode` early return fires before anything is
   installed. angular.dev explains what happens instead: *"When using [Angular with SSR], Angular
   automatically adds the `'unhandledRejection'` and `'uncaughtException'` listeners to the server
   process. These handlers prevent the server from crashing and instead log captured errors to the
   console."*
2. **It is also a no-op with no `defaultView`** — a `DOCUMENT` with no window, which is how it stays
   safe in non-browser test environments.
3. **`e.preventDefault()` on both listeners.** This is the behavioural change people do not expect:
   the browser's default reporting of an uncaught error or an unhandled rejection is suppressed, and
   everything is routed through `ErrorHandler` instead.
4. **An `ErrorEvent` with no `error` is synthesised into a real `Error`** with the original event as
   `cause`, and a longer message under `ngDevMode`. That is the cross-origin script case, where the
   browser withholds the error object.
5. **Under Zone.js the listeners are installed in `Zone.root`**, with the comment *"Angular doesn't
   have to run change detection whenever any asynchronous tasks are invoked in the scope of this
   functionality."* Error reporting must not itself schedule a render.
6. **`DestroyRef.onDestroy` removes both listeners.** In a page that creates and destroys
   applications — tests, micro-frontends — the listeners do not accumulate.

## What angular.dev says to do with it

> *"Adding [`provideBrowserGlobalErrorListeners()`] to the [ApplicationConfig] adds the `'error'` and
> `'unhandledrejection'` listeners to the browser window and forwards those errors to `ErrorHandler`.
> The Angular CLI generates new applications with this provider by default. The Angular team
> recommends handling these global errors for most applications, either with the framework's built-in
> listeners or with your own custom listeners. If you provide custom listeners, you can remove
> `provideBrowserGlobalErrorListeners`."*

> *"Angular reports unhandled errors to the application's root `ErrorHandler`. When providing a custom
> `ErrorHandler`, provide it in your `ApplicationConfig` as part of calling `bootstrapApplication`."*

🔴 **And the sentence that defines the boundary of everything on this page:**

> *"Angular does _not_ catch errors inside of APIs that are called directly by your code."*

A `try`-less `await` inside a component method that you called yourself is not an unhandled
rejection at the window level unless it actually escapes to the microtask queue unhandled. The global
listeners are a net under the *runtime*, not a substitute for handling errors where they happen.

## The three windows it does not cover

**Before the root component exists.** angular.dev, verbatim:

> *"There's a brief moment when Angular can't send errors to your `ErrorHandler` yet: while it is
> still creating your app's root module or root component. Angular needs that root instance to exist
> before it can look up the `ErrorHandler` you provided, so an error thrown before then has nowhere to
> go. It behaves like a normal uncaught error instead of being reported through `ErrorHandler`."*

A rejected app initializer is adjacent to this window but not in it — that one *does* reach the
`ErrorHandler`, and its chain is [06c](06c-when-a-startup-initializer-fails.md).

**On the server.** Covered by process-level handlers instead, with a caveat that catches
half-migrated applications:

> *"IMPORTANT: If the application is using Zone.js, only the `'unhandledRejection'` handler is added.
> When Zone.js is present, errors inside the Application's Zone are already forwarded to the
> application `ErrorHandler` and do not reach the server process."*

**In tests.** The framework deliberately does not let a swallowed error stay swallowed:

> *"Angular's `TestBed` rethrows unexpected errors to ensure that errors caught by the framework
> cannot be unintentionally missed or ignored."*

So a custom `ErrorHandler` that quietly reports and returns behaves differently under test than in
production — by design, and in the direction that makes tests fail loudly rather than pass quietly.

## Gotchas

**★ Symptom: after adding `provideBrowserGlobalErrorListeners()`, uncaught errors stop appearing in
the browser console.** Cause: both listeners call `e.preventDefault()`, which suppresses the browser's
own reporting; everything now goes to `ErrorHandler`, and the default `ErrorHandler` logs with the
prefix `'ERROR'` rather than as a browser error entry. Fix: nothing, if you have a reporting
`ErrorHandler` — but if you rely on the console during development, make sure your custom handler
still logs —

```ts
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly reporter = inject(CrashReporter);

  handleError(error: unknown): void {
    this.reporter.capture(error);
    console.error(error);   // do not lose the console: preventDefault already took it away
  }
}
```

**★ Symptom: `provideBrowserGlobalErrorListeners()` is in `app.config.ts` and does nothing under
SSR.** Cause: the factory early-returns when `ngServerMode` is set — by design, because the server
already installs `'unhandledRejection'` and `'uncaughtException'` handlers on the process. Fix: none
needed in the browser config; if you need server-side capture beyond the console, wire it in the
server entry point, not in `app.config.ts`.

**★ Symptom: server-side errors thrown inside components are not reaching the process handlers, in an
application that still has Zone.js.** Cause: the documented caveat — with Zone.js present, only
`'unhandledRejection'` is added on the server, because errors inside the application's Zone already go
to the `ErrorHandler` and never escape to the process. Fix: capture through a custom `ErrorHandler`
rather than at the process level while Zone.js is present, or complete the zoneless migration
([05d](05d-the-polyfill-half-and-noopngzone.md)) so there is one path instead of two.

**Symptom: a cross-origin script error arrives as a generic `Error` with no useful message.** Cause:
the browser withholds the error object for cross-origin scripts, so `e.error` is null and the listener
synthesises `new Error(message, {cause: e})`. Fix: read `error.cause` in your handler — the original
`ErrorEvent`, with `filename`, `lineno` and `colno`, is attached —

```ts
handleError(error: unknown): void {
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause instanceof ErrorEvent) {
    this.reporter.capture(error, { file: cause.filename, line: cause.lineno });
    return;
  }
  this.reporter.capture(error);
}
```

Serving the script with `crossorigin` and a permissive CORS header is what makes the real error
object available in the first place; the `cause` is the fallback, not the fix.

**Symptom: the listeners are still firing after an application was destroyed, in a page that mounts
several apps.** Cause: they should not be — `DestroyRef.onDestroy` removes both. If they persist, the
listeners were installed by something else, most often a hand-rolled `window.addEventListener` copied
from a blog. Fix: use the provider, which owns its own teardown, and delete the manual listeners.

**Symptom: you removed `provideBrowserGlobalErrorListeners()` in favour of an SDK's own listeners, and
now every error is counted twice.** Cause: the SDK's auto-instrumentation is forwarding to the window
*and* something is still routing into `ErrorHandler`. Fix: pick one owner. angular.dev explicitly
sanctions the swap — *"If you provide custom listeners, you can remove
`provideBrowserGlobalErrorListeners`"* — but running both double-counts everything in your dashboards.

## Interview questions

**★ `provideBrowserGlobalErrorListeners()` is in every generated `app.config.ts`. What does it cost
at startup, and how do you know?**
Nothing measurable, and you know because of *which* initializer it is built on: it returns
`makeEnvironmentProviders([provideEnvironmentInitializer(() => void inject(globalErrorListeners))])`,
and environment initializers are not awaited — `resolveInjectorInitializers` calls them and discards
the result. The work itself is two `addEventListener` calls. Contrast that with anything built on
`provideAppInitializer`, which is on the critical path of the first render by construction. The
general lesson is that reading which initializer a `provide*` function uses tells you its startup
cost without measuring anything.

**★ What behaviour changes in the browser the moment you add it, other than errors reaching your
`ErrorHandler`?**
`e.preventDefault()` is called on both the `'error'` and `'unhandledrejection'` events, so the
browser's own default reporting is suppressed. That is a genuine trade: you gain one funnel for every
unhandled error, and you lose the browser's native presentation of them — including, in some
browsers, the distinctive formatting and the "Uncaught (in promise)" prefix that makes a rejection
recognisable at a glance. If your `ErrorHandler` does not log, the console goes quiet, and that reads
exactly like "the error stopped happening".

**★ Where does this provider *not* help, and what would you use instead in each case?**
Three places. Before the root component exists, because Angular has no way to look up your
`ErrorHandler` yet — angular.dev says such an error *"behaves like a normal uncaught error"*, so the
`.catch` on `bootstrapApplication` in `main.ts` is the only net. On the server, where the factory
early-returns and Angular's SSR integration installs process-level `'unhandledRejection'` and
`'uncaughtException'` handlers instead. And inside code you call directly — *"Angular does not catch
errors inside of APIs that are called directly by your code"* — where the answer is ordinary
`try`/`catch` at the call site.

**Why is it implemented as an `InjectionToken` with a side-effecting factory rather than as a service
or a plain function call in the initializer?**
Because the factory gets an injection context for free and an idempotence guarantee for free. It can
`inject(DOCUMENT)`, `inject(INTERNAL_APPLICATION_ERROR_HANDLER)` and `inject(DestroyRef)` directly,
and because injector records are created at most once per injector, the listeners cannot be installed
twice even if something else also injects the token. A service would have needed to be instantiated
explicitly and would have shown up in the public surface; a plain function in the initializer body
would have had to be handed the injector by hand. The `void inject(...)` at the call site is the
smallest expression that says "I want the factory's side effect and nothing else".

**The CLI adds this by default. When is removing it the right call?**
When you have installed your own `'error'` and `'unhandledrejection'` listeners — which the
documentation explicitly sanctions — typically because a crash-reporting SDK wants to own the window
events so it can attach breadcrumbs and session context the framework knows nothing about. Keeping
both means every error is counted twice. What is *not* a good reason is "we do not want errors going
to `ErrorHandler`": the funnel is the useful part, and the way to change what happens to an error is
to provide a different `ErrorHandler`, not to remove the listeners that feed it.

---

← Prev: [Platform initializers](06e-platform-initializers.md) · Index: [Topic index](README.md) · Next → [`ErrorHandler` and the seam everything routes into](06g-error-handler-and-ng0402.md)
