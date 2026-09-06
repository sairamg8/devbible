---
title: "`providePlatformInitializer` is the one `provide*` function that returns a plain `StaticProvider`, so putting it in `app.config.ts` compiles perfectly and registers a record that only the platform injector — built before yours — would ever read"
sidebar_label: "06e · Platform initializers"
sidebar_position: 6.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`providePlatformInitializer`](https://angular.dev/api/core/providePlatformInitializer),
> [`bootstrapApplication`](https://angular.dev/api/platform-browser/bootstrapApplication); and
> `angular/angular` at tag `v22.1.5`:
> [`platform/platform.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/platform/platform.ts),
> [`CHANGELOG.md`](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md) (v21.0.0 breaking changes),
> [`goldens/public-api/platform-browser/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/platform-browser/index.api.md).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every other `provide*` in this topic returns `EnvironmentProviders`, the branded opaque type whose
entire job is to turn a wrong placement into a compile error. `providePlatformInitializer` returns a
plain `StaticProvider` — so it is accepted by every provider array in the framework, including the
one place it can never work.** The platform injector is created by `createOrReusePlatformInjector`
before `bootstrapApplication` builds the application injector, and `runPlatformInitializers` reads
`PLATFORM_INITIALIZER` from that platform injector and nowhere else. A platform initializer in
`app.config.ts` is therefore constructed, stored, and read by nothing: no error, no warning, no code.
This chunk is that trap, the two-line fix, what the platform tier is actually for, and why v21 made
`getPlatform()` return `null` on the server.

## `providePlatformInitializer` — the odd one out, and why it fails silently

```ts
export function providePlatformInitializer(initializerFn: () => void): StaticProvider {
  return {
    provide: PLATFORM_INITIALIZER,
    useValue: initializerFn,
    multi: true,
  };
}

function runPlatformInitializers(injector: Injector): void {
  const inits = injector.get(PLATFORM_INITIALIZER, null);
  runInInjectionContext(injector, () => {
    inits?.forEach((init) => init());
  });
}
```

`runPlatformInitializers` is called with the **platform** injector, which
`createOrReusePlatformInjector` builds *before* `bootstrapApplication` builds the application
injector. A `PLATFORM_INITIALIZER` record registered in the application injector is therefore
created, stored, and read by nothing. No error, no warning, no code.

🔴 **The return type is the whole problem.** `EnvironmentProviders` is the branded opaque type from
[03](03-environmentproviders-vs-provider.md) whose entire job is to make a wrong placement a compile
error. `providePlatformInitializer` cannot use it, because the platform injector is built by
`Injector.create` from a `StaticProvider[]` — so the one initializer that is easiest to misplace is
also the only one the type system will not catch.

The JSDoc says where it goes and shows the call shape:

> *"This function is used to provide initialization functions that will be executed upon
> initialization of the platform injector."*

> *"The platform initializer should be provided during platform creation:"*

```ts
const platformRef = platformBrowser([ providePlatformInitializer(() =>  ...) ]);

bootstrapApplication(App, appConfig, { platformRef })
```

The signature of `platformBrowser` in the same golden is the other half of the explanation:

```ts
// @public
export const platformBrowser: (extraProviders?: StaticProvider[]) => PlatformRef;
```

`StaticProvider[]` — not `Array<Provider | EnvironmentProviders>`. The parameter type is why
`providePlatformInitializer` has the return type it has, and the price of that compatibility is that
nothing stops the value being passed somewhere else.

That third argument is `BootstrapContext`, and the platform-browser golden shows it is exactly one
required property:

```ts
// @public
export interface BootstrapContext {
    platformRef: PlatformRef;
}
```

Written out for a real `main.ts`:

```ts
// src/main.ts
import { providePlatformInitializer } from '@angular/core';
import { bootstrapApplication, platformBrowser } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

const platformRef = platformBrowser([
  providePlatformInitializer(() => {
    performance.mark('angular-platform-created');
  }),
]);

bootstrapApplication(App, appConfig, { platformRef }).catch((err) => console.error(err));
```

## What the platform tier is actually for, and why SSR treats it differently

Chunk [01](01-app-config-and-what-bootstrap-does-with-it.md)'s three-tier table calls
`providePlatformInitializer` "the only normal hook" into the platform injector, and that remains the
honest summary: almost everything you want to do at startup belongs in the application injector.
Reach for the platform tier only when the work must happen once per **page**, across every
application bootstrapped on it — a shared polyfill install, a page-level performance mark, a
single registration with a host shell in a micro-frontend.

On the server the platform is deliberately not shared. From `platform.ts`:

```ts
  // During SSR, using this setting and using an injector from the global can cause the
  // injector to be used for a different request due to concurrency.
  if (typeof ngServerMode === 'undefined' || !ngServerMode) {
    _platformInjector = injector;
  }
```

```ts
export function getPlatform(): PlatformRef | null {
  if (typeof ngServerMode !== 'undefined' && ngServerMode) {
    return null;
  }

  return _platformInjector?.get(PlatformRef) ?? null;
}
```

and the matching v21.0.0 breaking change, verbatim from the changelog:

> *"In addition, `getPlatform()` and `destroyPlatform()` will now return `null` and be a no-op
> respectively when running in a server environment."*

⚠️ **So any code that reaches the platform through `getPlatform()` is browser-only from v21 onward,
and will silently return `null` under SSR** — a `getPlatform()!.injector.get(X)` written before v21
becomes a `TypeError` on the server rather than a wrong-request bug, which is the safer of the two
failures but is still a failure.

## Gotchas

**★ Symptom: `providePlatformInitializer(...)` sits in `app.config.ts`, TypeScript is happy, and the
callback never runs.** Cause: it returns `StaticProvider`, not `EnvironmentProviders`, so nothing
rejects the placement — and `runPlatformInitializers` reads `PLATFORM_INITIALIZER` from the platform
injector, which was built before yours. Fix: move it to the platform and hand that platform back to
`bootstrapApplication` —

```ts
const platformRef = platformBrowser([
  providePlatformInitializer(() => performance.mark('angular-platform-created')),
]);
bootstrapApplication(App, appConfig, { platformRef }).catch((err) => console.error(err));
```

**Symptom: code that called `getPlatform()` returns `null` under SSR after upgrading to v21 or
later.** Cause: the documented v21.0.0 breaking change — `getPlatform()` returns `null` and
`destroyPlatform()` is a no-op in a server environment, because caching the platform injector in a
module-level global would let one request's injector serve another's. Fix: stop reaching for the
platform from application code; inject what you need instead, and keep genuinely page-scoped work in
a `providePlatformInitializer` on the browser entry point where it can still run.

**Symptom: two Angular applications bootstrapped into the same page, and the platform initializer runs
once rather than twice.** Cause: the platform injector is per *page*, not per application — that is
what the tier means. Both applications get their own `EnvironmentInjector` under one shared platform.
Fix: nothing, if the work really is page-scoped; if it is per-application, it was never a platform
initializer —

```ts
// ✅ per application, once for each bootstrapApplication call
providers: [provideEnvironmentInitializer(() => inject(ShellBridge).register())],
```

**Symptom: a second `platformBrowser([...])` call in the same page appears to ignore its providers.**
Cause: the factory is named `createOrReusePlatformInjector` and caches its result in a module-level
`_platformInjector`, which is exactly the global the SSR guard above exists to avoid writing. ⚠️ **I
did not read the reuse branch itself**, so treat "the second call reuses the first platform and drops
the new providers" as the reading the source strongly implies rather than a quoted guarantee — but
build as though it were true. Fix: create the platform once, at the entry point, and pass it down —

```ts
// src/main.ts — one platform, created once, handed to every bootstrap on this page
export const platformRef = platformBrowser([
  providePlatformInitializer(() => performance.mark('angular-platform-created')),
]);

bootstrapApplication(App, appConfig, { platformRef }).catch((err) => console.error(err));
```

## Interview questions

**★ Why does `providePlatformInitializer` return `StaticProvider` when the other two return
`EnvironmentProviders`?**
Because the platform injector is built by `Injector.create` from a `StaticProvider[]`, an API that
predates and does not accept the `EnvironmentProviders` wrapper. The consequence is the interesting
part: `EnvironmentProviders` exists precisely so a misplaced provider becomes a compile error, and
this is the one function that cannot use it — so the initializer with the most confusing placement
rule is also the only one where the type system stays silent. It is a rare case in this API surface
where the type is weaker than the invariant it is protecting, and the mitigation is entirely social:
know that it belongs in `platformBrowser([...])` and nowhere else.

**When is the platform tier the right place for something, and how would you recognise a misuse?**
It is right when the work is genuinely per-*page* rather than per-application: installing a shared
polyfill, taking a page-level performance mark, registering once with a micro-frontend host that will
bootstrap several Angular applications into the same document. The misuse to recognise is anything
that needs application state or application providers — the platform injector is the *parent* of the
application injector, so it cannot see anything you put in `app.config.ts`, and code that tries to
reach downward ends up calling `getPlatform()` and walking back to an application it happens to know
about. That pattern also breaks under SSR from v21, where `getPlatform()` returns `null` by design.

**What is `BootstrapContext` and why is `platformRef` a property of an object rather than a third
positional argument?**
`BootstrapContext` is a one-property interface — `platformRef: PlatformRef`, required — that
`bootstrapApplication` and `createApplication` both accept as their last argument. Making it an object
rather than a bare parameter is what lets the shape grow without another breaking signature change;
chunk 01 meets the same argument as "the SSR handoff", which is the other thing that travels on it.
The practical reading for this chunk is narrower: it is the only supported way to tell
`bootstrapApplication` *which* platform to use, and therefore the only way a platform initializer you
wrote can be part of the same startup as the application it was meant to instrument.

---

← Prev: [Environment initializers](06d-environment-initializers.md) · Index: [Topic index](README.md) · Next → [The global error listeners](06f-provide-browser-global-error-listeners.md)
