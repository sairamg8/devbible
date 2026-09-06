---
title: "Angular has three initializer providers, they fire at three different moments, and exactly one of them is awaited — `provideAppInitializer` is the only entry in the provider array that can hold back the first render"
sidebar_label: "06 · Startup and error-listener providers"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`provideAppInitializer`](https://angular.dev/api/core/provideAppInitializer),
> [`provideEnvironmentInitializer`](https://angular.dev/api/core/provideEnvironmentInitializer),
> [`providePlatformInitializer`](https://angular.dev/api/core/providePlatformInitializer); and
> `angular/angular` at tag `v22.1.5`:
> [`application/application_init.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/application_init.ts),
> [`di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Three functions in `@angular/core` are named `provide*Initializer`, they all take a zero-argument
callback, and they look interchangeable. They are not, and only one of them — `provideAppInitializer`
— is awaited.** Everything the first render must not happen without goes there and nowhere else. This
chunk is that one function: the four lines it provides, the twenty-line runner that consumes them,
and the surprises hiding in that runner — an Observable finishes on `complete` and not on its first
value, a synchronous return value is not tracked at all, and adding your first async initializer
changes the timing of every step after it. Ordering and failure are
[06b](06b-initializer-ordering-and-failure.md); the two initializers that are *not* awaited are
[06c](06d-environment-initializers.md).

## The three, side by side

Every difference below is readable in source; this chunk and 06c are the evidence.

| | `providePlatformInitializer` | `provideEnvironmentInitializer` | `provideAppInitializer` |
|---|---|---|---|
| Returns | **`StaticProvider`** | `EnvironmentProviders` | `EnvironmentProviders` |
| Underlying token | `PLATFORM_INITIALIZER` | `ENVIRONMENT_INITIALIZER` | `APP_INITIALIZER` |
| Goes in | `platformBrowser([...])` | `ApplicationConfig.providers`, a route's `providers`, `createEnvironmentInjector` | `ApplicationConfig.providers` |
| Runs when | the platform injector is created | that injector runs `resolveInjectorInitializers()` | `ApplicationInitStatus.runInitializers()` |
| Callback type | `() => void` | `() => void` | `() => Observable<unknown> \| Promise<unknown> \| void` |
| **Awaited?** | **no** | **no** | **yes** |
| Runs once per | page | **injector** — app *and* each route injector | application |

🔴 **Read the callback-type row before the "awaited" row.** The type is the only place the framework
tells you which one blocks. `provideAppInitializer` is the only signature that admits a
`Promise<unknown>` or an `Observable<unknown>`, because it is the only one with somewhere to put the
result. The other two are `() => void`, and `void` there is not a stylistic preference — it is the
runner announcing in advance that it will discard whatever you return.

## `provideAppInitializer` — four lines against a deprecated token

```ts
export function provideAppInitializer(
  initializerFn: () => Observable<unknown> | Promise<unknown> | void,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: APP_INITIALIZER,
      multi: true,
      useValue: initializerFn,
    },
  ]);
}
```

Its JSDoc states the contract:

> *"The provided function is injected at application startup and executed during app initialization.
> If the function returns a Promise or an Observable, initialization does not complete until the
> Promise is resolved or the Observable is completed."*

> *"Note that the provided initializer is run in the injection context."*

> *"Previously, this was achieved using the `APP_INITIALIZER` token which is now deprecated."*

`APP_INITIALIZER` itself carries `@deprecated from v19.0.0, use provideAppInitializer instead`. The
token still exists and still works — `provideAppInitializer` *is* a `multi: true` provider for it —
but writing the raw provider by hand is how you produce `NG0209`, below. This is the pattern
[02](02-why-provide-functions-replaced-forroot.md) describes for the whole surface: the token becomes
an implementation detail and the function becomes the API.

The realistic use is runtime configuration that must exist before any component renders:

```ts
// src/app/config/runtime-config.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface RuntimeConfig {
  apiBaseUrl: string;
  featureFlags: Record<string, boolean>;
}

@Injectable({ providedIn: 'root' })
export class RuntimeConfigService {
  private readonly http = inject(HttpClient);
  private config: RuntimeConfig | null = null;

  async load(): Promise<void> {
    this.config = await firstValueFrom(this.http.get<RuntimeConfig>('/assets/config.json'));
  }

  useBuiltInDefaults(): void {
    this.config = { apiBaseUrl: '/api', featureFlags: {} };
  }

  get snapshot(): RuntimeConfig {
    if (!this.config) {
      throw new Error('RuntimeConfigService read before its app initializer completed.');
    }
    return this.config;
  }
}
```

```ts
// src/app/app.config.ts
import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { RuntimeConfigService } from './config/runtime-config.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideAppInitializer(() => inject(RuntimeConfigService).load()),
  ],
};
```

`inject()` works inside the callback because the runner wraps it, which is the next section.

## `runInitializers()`, verbatim — the twenty lines this chunk exists for

From `application_init.ts`:

```ts
  /** @internal */
  runInitializers() {
    if (this.initialized) {
      return;
    }

    const asyncInitPromises = [];
    for (const appInits of this.appInits) {
      const initResult = runInInjectionContext(this.injector, appInits);
      if (isPromise(initResult)) {
        asyncInitPromises.push(initResult);
      } else if (isSubscribable(initResult)) {
        const observableAsPromise = new Promise<void>((resolve, reject) => {
          initResult.subscribe({complete: resolve, error: reject});
        });
        asyncInitPromises.push(observableAsPromise);
      }
    }

    const complete = () => {
      // @ts-expect-error overwriting a readonly
      this.done = true;
      this.resolve();
    };

    Promise.all(asyncInitPromises)
      .then(() => {
        complete();
      })
      .catch((e) => {
        this.reject(e);
      });

    if (asyncInitPromises.length === 0) {
      complete();
    }
    this.initialized = true;
  }
```

**Five things fall out of that loop, and four of them surprise people.**

1. **Initializers are *started* in array order, synchronously, all of them, before anything is
   awaited.** The `for` loop runs to completion first; only then does `Promise.all` wait. They are
   **concurrent, not sequential** — the consequences are [06b](06b-initializer-ordering-and-failure.md).
2. **An Observable completes on `complete`, not on its first value.** The subscription is
   `{complete: resolve, error: reject}` — there is no `next` handler, so emitted values are discarded
   entirely. A `BehaviorSubject`, an `interval()`, or any hot stream returned from an initializer
   hangs bootstrap **forever**, with no timeout and no diagnostic.
3. **A synchronous return value is not tracked at all.** Only `isPromise` and `isSubscribable`
   results are pushed onto `asyncInitPromises`. A thenable-shaped object that is not a real Promise —
   a jQuery-style deferred, a hand-rolled `{then}` — is invisible to this loop and is silently not
   awaited.
4. **`runInInjectionContext(this.injector, appInits)`** — `inject()` is legal inside the callback,
   and the injector is the application `EnvironmentInjector`, so every provider in your array is
   reachable from an initializer, and nothing narrower is.
5. **`if (asyncInitPromises.length === 0) complete();`** — with only synchronous initializers, `done`
   is `true` before `runInitializers()` returns and bootstrap never yields to the microtask queue.
   Adding your *first* async initializer therefore changes the timing of everything after it, not
   just its own step. A test that passed with three synchronous initializers can start failing when a
   fourth one returns a Promise, and nothing about that fourth one is wrong.

The `if (this.initialized) return;` guard at the top makes the method idempotent per
`ApplicationInitStatus` instance: one application, one run, however many times bootstrap touches it.

## Gotchas

**★ Symptom: bootstrap hangs forever — no error, no root component, the loading shell stays up.**
Cause: an app initializer returned an Observable that emits but never completes. `runInitializers`
subscribes with `{complete: resolve, error: reject}`, so values do nothing at all. Fix: make the
termination explicit at the call site —

```ts
import { firstValueFrom, take } from 'rxjs';

provideAppInitializer(() => inject(FeatureFlagService).changes$.pipe(take(1))),
// or, equivalently:
provideAppInitializer(() => firstValueFrom(inject(FeatureFlagService).changes$)),
```

**★ Symptom: a startup fetch that used to run before the first paint now runs after it, and nothing
changed except a refactor.** Cause: the callback stopped returning its Promise — an arrow body gained
braces, or a `.then()` chain lost its `return`. A `void` return is a legal signature, so neither
TypeScript nor Angular complains. Fix: return it —

```ts
// ⛔ returns undefined; bootstrap does not wait
provideAppInitializer(() => { inject(RuntimeConfigService).load(); }),
// ✅
provideAppInitializer(() => inject(RuntimeConfigService).load()),
```

**Symptom: `NG0209: Unexpected type of the APP_INITIALIZER token value (expected an array, but got
function). Please check that the APP_INITIALIZER token is configured as a multi: true provider.`**
Cause: somebody wrote the raw provider without `multi: true`, which replaces the multi record with a
single value; `ApplicationInitStatus`'s constructor checks the type it got. Fix: never write the
token by hand —

```ts
// ⛔ replaces the whole multi record
{ provide: APP_INITIALIZER, useValue: () => inject(RuntimeConfigService).load() },
// ✅
provideAppInitializer(() => inject(RuntimeConfigService).load()),
```

**Symptom: an initializer that returns a library's own "promise-like" object is not awaited.** Cause:
`isPromise` is a real check, not a duck-type on `.then` alone, and `isSubscribable` looks for
`subscribe`. Anything that is neither falls through both branches and is treated as a synchronous
initializer. Fix: normalise at the boundary —

```ts
provideAppInitializer(() => {
  const legacy = inject(LegacyBootstrapBridge);
  return Promise.resolve(legacy.start());   // a real Promise, whatever start() returned
}),
```

## Interview questions

**★ Three functions, three tokens, one of them awaited. How do you tell which, without looking it
up?**
By the callback's return type. `provideAppInitializer` is typed
`() => Observable<unknown> | Promise<unknown> | void`; the other two are `() => void`. A runner that
intends to wait must have a place to put the thing it waits on, so the signature is the contract. The
corollary is the useful half: `provideEnvironmentInitializer` cannot be made to block by returning a
Promise, because the type already told you the value goes nowhere.

**★ Why does returning an Observable that emits but never completes hang bootstrap, when the same
Observable behaves fine everywhere else in Angular?**
Because `runInitializers` converts it with
`new Promise((resolve, reject) => initResult.subscribe({complete: resolve, error: reject}))`. There
is no `next` handler at all, so the first emission is not merely insufficient for resolution — it is
ignored entirely. Everywhere else in the framework an Observable is consumed for its *values*; here
it is consumed only for its *termination*. That is why handing initializers a Promise is the safer
habit: `firstValueFrom` and `take(1)` both make the termination visible at the call site instead of
burying it in the stream's definition.

**★ What does `multi: true` on `APP_INITIALIZER` buy, and what breaks without it?**
It makes the token accumulate rather than replace: `R3Injector.processProvider` pushes onto the
record's `multi` array instead of overwriting the `Map` entry, so ten libraries can each register an
initializer without any of them knowing the others exist. Without it, the last provider for the token
wins and nine initializers silently vanish — exactly what `NG0209` exists to catch, because a
non-multi provider makes `this.appInits` a function rather than an array and the constructor notices
the type before anything runs.

**Adding one async app initializer to an app that had only synchronous ones changed the behaviour of
unrelated code. How is that possible?**
Because of the `if (asyncInitPromises.length === 0) complete();` fast path. With no async
initializers, `done` flips to `true` synchronously inside `runInitializers()` and bootstrap continues
in the same task. The moment one initializer returns a Promise, `complete()` moves into a
`Promise.all(...).then(...)` continuation, so everything downstream of startup — the root component's
construction, the first change-detection pass, the router's initial navigation — happens at least one
microtask later. Code that accidentally depended on the synchronous ordering, most often a test that
asserted immediately after bootstrap without awaiting, breaks. The initializer is not at fault; the
assumption was.

---

← Prev: [The polyfill half, and `NoopNgZone`](05d-the-polyfill-half-and-noopngzone.md) · Index: [Topic index](README.md) · Next → [Initializer ordering and failure](06b-initializer-ordering-and-failure.md)
