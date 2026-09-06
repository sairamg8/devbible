---
title: "app.config.ts is a plain object with exactly one property, and bootstrapApplication turns that array into the application's environment injector"
sidebar_label: "01 · app.config.ts and bootstrap"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`ApplicationConfig`](https://angular.dev/api/core/ApplicationConfig),
> [`bootstrapApplication`](https://angular.dev/api/platform-browser/bootstrapApplication) — and
> `angular/angular` at tag `v22.1.5`:
> [`application_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/application_config.ts),
> [`create_application.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/create_application.ts),
> [`bootstrap.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/platform/bootstrap.ts);
> `angular/angular-cli` at tag `v22.1.7` (`packages/schematics/angular/application/files/standalone-files`).
> `@angular/cli` 22.1.7 · TypeScript `>=6.0 <6.1`. Documentation-validated; **no sandbox run**.

**`ApplicationConfig` is not a framework feature. It is an interface with a single property —
`providers` — and `bootstrapApplication` does exactly one interesting thing with it: it splices
that array into a fixed list the framework builds first, and hands the whole thing to a single
`EnvironmentInjector` that lives as long as the browser tab. Everything people call "Angular
application wiring" is that one array and the ordering of it.**

## The two files, verbatim from the v22 schematic

`ng new` in v22 generates these. The templates below are the CLI's own, at
`@angular/cli` 22.1.7, with the EJS conditionals resolved for a routed, zoneless app:

```ts
// src/app/app.config.ts
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes)
  ]
};
```

```ts
// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
```

Two things are worth noticing before anything else. There is no `provideZonelessChangeDetection()`
in the generated file — **chunk 05** *(not written yet)* explains why. And
`app.config.ts` is a **file name chosen by a schematic**, not an API: the exported symbol could be
called anything, live anywhere, and be assembled by a function. `bootstrapApplication` only cares
that the second argument structurally matches `ApplicationConfig`.

## The interface has one property. That is the whole type.

From `packages/core/src/application/application_config.ts` at `v22.1.5`:

```ts
/**
 * Set of config options available during the application bootstrap operation.
 *
 * @publicApi
 */
export interface ApplicationConfig {
  /**
   * List of providers that should be available to the root component and all its children.
   */
  providers: Array<Provider | EnvironmentProviders>;
}
```

The doc comment is the load-bearing sentence, and angular.dev repeats it verbatim on the
[`ApplicationConfig`](https://angular.dev/api/core/ApplicationConfig) reference page:

> *"List of providers that should be available to the root component and all its children."*

Two consequences follow immediately:

- **There is no `zoneless: true`, no `routes:`, no `imports:`, no `bootstrap:` key.** Every
  behaviour you want to switch on is expressed as an entry in `providers`. That uniformity is the
  point of the design, not an oversight.
- **The element type is a union.** `Provider` is the familiar
  `TypeProvider | ValueProvider | ClassProvider | ConstructorProvider | ExistingProvider | FactoryProvider | any[]`;
  `EnvironmentProviders` is a different, opaque thing. [Chunk 03](03-environmentproviders-vs-provider.md)
  is entirely about why that second member of the union exists.

## What `bootstrapApplication` actually does

The public signature, from angular.dev:

```ts
function bootstrapApplication(
  rootComponent: Type<unknown>,
  options?: ApplicationConfig | undefined,
  context?: BootstrapContext | undefined,
): Promise<ApplicationRef>;
```

> *"Bootstraps an instance of an Angular application and renders a standalone component as the
> application's root component."*

The third parameter, `BootstrapContext`, is the SSR handoff and is covered in
**chunk 17** *(not written yet)*. The second parameter is optional — `bootstrapApplication(App)`
is legal and boots an application with no application-level providers at all.

Internally the call lands in `internalCreateApplication`, and this is the part worth memorising.
From `packages/core/src/application/create_application.ts` at `v22.1.5`:

```ts
// Create root application injector based on a set of providers configured at the platform
// bootstrap level as well as providers passed to the bootstrap call by a user.
const allAppProviders = [
  provideZonelessChangeDetectionInternal(),
  errorHandlerEnvironmentInitializer,
  ...(ngDevMode ? [validAppIdInitializer] : []),
  ...(appProviders || []),
];
const adapter = new EnvironmentNgModuleRefAdapter({
  providers: allAppProviders,
  parent: platformInjector as EnvironmentInjector,
  debugName: typeof ngDevMode === 'undefined' || ngDevMode ? 'Environment Injector' : '',
  // We skip environment initializers because we need to run them inside the NgZone, which
  // happens after we get the NgZone instance from the Injector.
  runEnvironmentInitializers: false,
});
```

Read that literally:

1. **The framework's own providers go first.** Zoneless change detection, the error handler
   initializer, and (in a development build only) the app-ID validator are prepended.
2. **Your array is spread in last.** `...(appProviders || [])` — everything you wrote in
   `app.config.ts` is appended after the framework's defaults. Because a later provider for the
   same token wins, *this is the mechanism by which your config overrides framework defaults*.
   **Chunk 13** *(not written yet)* works through what "wins" means precisely.
3. **There is exactly one injector for the whole array.** Its parent is the platform injector; its
   dev-mode debug name is the literal string `Environment Injector`, which is what you will see in
   Angular DevTools and in the `Source:` clause of a v22 DI error.

## What "root provider" means when there is no `AppModule`

In the `NgModule` era, "provided in root" meant "listed in `AppModule.providers`, or
`providedIn: 'root'`, resolved against the injector `AppModule` created". With no `AppModule`, the
definition collapses to something simpler and more honest:

> A **root provider** is a record in the application's single `EnvironmentInjector` — the one
> `bootstrapApplication` creates. It is constructed lazily on first injection, there is exactly one
> instance per bootstrapped application, and it is destroyed when that injector is destroyed.

The injector hierarchy in a v22 browser app has three tiers, and only the middle one is this
topic's business:

| Tier | Created by | Lifetime | Owned by |
|---|---|---|---|
| Platform injector | `createOrReusePlatformInjector` | the page | not yours; `providePlatformInitializer` is the only normal hook |
| **Application `EnvironmentInjector`** | **`bootstrapApplication`** | **the application** | **`ApplicationConfig.providers` — this topic** |
| Route injectors, element injectors | `Router`, the renderer | route / component | Phase 8 and Phase 6 |

🔴 **The mechanism of that hierarchy — how `inject()` walks it, what `@Self`/`@SkipSelf`/`@Optional`
do, how a token resolves, what a multi-provider is at the record level — is Phase 6, "Dependency
injection".** This topic is about *what you put in the array and why*, not about how the array is
resolved. Where the two overlap, the pages here say so and stop.

## The bootstrap sequence, in the order it happens

`bootstrap()` in `packages/core/src/platform/bootstrap.ts` runs this order, which matters as soon
as you use **`provideAppInitializer`** *(not written yet)*:

1. `envInjector.get(NgZone)` and `ngZone.run(...)` — everything below runs inside whatever zone
   implementation the providers resolved to (a `NoopNgZone` in a zoneless app).
2. `resolveInjectorInitializers()` — environment initializers run, **not awaited**.
3. `INTERNAL_APPLICATION_ERROR_HANDLER` is resolved and subscribed to `ngZone.onError`.
4. `ApplicationInitStatus.runInitializers()` — app initializers run, and `donePromise` **is**
   awaited.
5. `LOCALE_ID` is read and installed.
6. `appRef.bootstrap(rootComponent)` — only now does the root component exist.

Step 6 being last is why nothing in your providers may depend on a component instance, and why
`provideAppInitializer` can safely fetch configuration before the first template renders.

## Gotchas

**★ Symptom: you add a provider to `app.config.ts`, save, and nothing changes.** Cause: almost
always a second config. Either `main.ts` passes an inline object literal instead of importing
`appConfig`, or you are running SSR and edited `app.config.ts` while the server entry boots from
`app.config.server.ts`, or the provider is in a lazily-loaded route's `providers` you have not
navigated to yet. Fix: make `main.ts` the single source of truth and read it before editing
anything else —

```ts
// src/main.ts — if the second argument is a literal, app.config.ts is dead code
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
```

**★ Symptom: `Object literal may only specify known properties, and 'zoneless' does not exist in
type 'ApplicationConfig'`.** Cause: `ApplicationConfig` has one property. There is no options bag;
zoneless, hydration, the router and HTTP are all *providers*. Fix: express it as a provider —
`providers: [provideZonelessChangeDetection()]` — not as a config key.

**★ Symptom: `NG0907: The App component is not marked as standalone, but Angular expects to have a
standalone component here.`** Cause: `bootstrapApplication` asserts the root component is
standalone (`assertStandaloneComponentType`), and a `standalone: false` flag survived a migration.
The full message, from `packages/core/src/render3/errors.ts`, is
`The ${type} component is not marked as standalone, but Angular expects to have a standalone
component here. Please make sure the ${type} component does not have the \`standalone: false\` flag
in the decorator.` Fix: delete the flag; in v22 standalone is the default and the flag exists only
as a legacy-interop opt-out (topic 02).

**★ Symptom: the app renders nothing and the console is empty.** Cause: `bootstrapApplication`
returns a `Promise<ApplicationRef>` and a bootstrap failure *rejects it* rather than throwing
synchronously. Without the `.catch`, an unhandled rejection can be swallowed by a framework wrapper
or by a test harness. Fix: keep the generated `.catch((err) => console.error(err))`, and in v22 add
`provideBrowserGlobalErrorListeners()` so post-bootstrap `unhandledrejection` and `error` events
reach the `ErrorHandler` too (**chunk 06** *(not written yet)*).

**★ Symptom: a service you provided in `app.config.ts` is constructed twice.** Cause: not the
config — you also listed it in a component's `providers`, or in a route's `providers`, which
creates a *different* injector record. The root record was never wrong; a narrower one shadowed it.
Fix: remove the narrower listing, or accept it deliberately — see
**chunk 12** *(not written yet)* and **chunk 15** *(not written yet)*.

## Interview questions

**★ Why does `ApplicationConfig` have only one property when `NgModule` had six?**
Because every one of the other five had a replacement that is *local* to the thing it configures.
`declarations` and `imports` became a component's own `imports` array; `exports` disappeared because
there is nothing to re-export when dependencies are per-component; `bootstrap` became the first
argument to `bootstrapApplication`. Only `providers` describes something genuinely application-wide,
so only `providers` survived. The narrow interface is the visible consequence of moving every other
concern down to the component that actually needs it.

**★ Your provider array is `[provideRouter(routes)]` and the framework also provides things you
never wrote. Where do those come from, and can you override them?**
`internalCreateApplication` builds `allAppProviders` as
`[provideZonelessChangeDetectionInternal(), errorHandlerEnvironmentInitializer, ...(ngDevMode ? [validAppIdInitializer] : []), ...appProviders]`.
The framework's defaults are prepended and yours are spread in afterwards, so for a non-multi token
the last record set wins and *your* provider overrides the framework's. That is exactly how
`provideZoneChangeDetection()` re-enables zone-based change detection on top of the zoneless default.

**What is the lifetime of something provided in `ApplicationConfig.providers`?**
It lives in the application's `EnvironmentInjector`. It is not created at bootstrap — it is created
lazily on first injection — and it is destroyed when that injector is destroyed, which for a normal
browser app means when the tab closes or when `ApplicationRef.destroy()`/platform destruction runs.
On the server it means per request, because each rendered request bootstraps its own application.

**Is `app.config.ts` required?**
No. It is a filename the CLI schematic generates. `bootstrapApplication(App, { providers: [] })` in
`main.ts` is equally valid, and so is a config assembled by a function that reads a build-time flag.
The only contract is the `ApplicationConfig` shape.

**What happens if you call `bootstrapApplication` twice?**
You get two applications, each with its own `EnvironmentInjector` and therefore its own instances of
every root provider, sharing one platform injector. This is legal and is how multiple Angular
islands on one page work — but it is also the answer to "why is my `@Service()` singleton not a
singleton", when a test or a micro-frontend host has bootstrapped a second time.

---

← Prev: [Topic index](README.md) · Index: [Topic index](README.md) · Next → [Why provide functions replaced forRoot](02-why-provide-functions-replaced-forroot.md)
