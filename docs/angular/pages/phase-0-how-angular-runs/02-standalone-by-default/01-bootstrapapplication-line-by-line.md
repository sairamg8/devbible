---
title: "`bootstrapApplication(App, appConfig)` is a function that builds a root environment injector and renders one component — it is not a shorter spelling of `bootstrapModule`"
sidebar_label: "01 · bootstrapApplication, line by line"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [`bootstrapApplication`](https://angular.dev/api/platform-browser/bootstrapApplication);
> the published `@angular/platform-browser` 22.1.5 type definitions and
> `fesm2022/_browser-chunk.mjs`; `@schematics/angular` **22.1.7**
> `application/files/standalone-files/src/main.ts.template`. Documentation-validated;
> **no sandbox run**.

**Every Angular 22 application starts with one function call in `main.ts`. Reading it as
"the new way to write `bootstrapModule`" hides the two things that actually changed: the
root injector is now built from a plain array you can read, and there is no root
`NgModule` class whose `imports` silently contribute providers and directives to the whole
app. This chunk goes through the call argument by argument, then puts the v14-era
`NgModule` bootstrap next to it so the difference is a diff and not a memory.**

## The file the CLI generates

`@schematics/angular` 22.1.7 emits exactly this for `ng new` (verified against
`application/files/standalone-files/src/main.ts.template`):

```ts
// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
```

Three imports, one call, one rejection handler. There is no `AppModule`, no
`platformBrowserDynamic`, and no `enableProdMode()` — that last one has been the build's
job since Ivy, and topic 12 covers what replaced it.

The root component it hands over, also generated verbatim:

```ts
// src/app/app.ts
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('my-app');
}
```

Note what is *absent*: `standalone: true`. Chunk
[03](03-standalone-by-default-which-version-changed-what.md) is entirely about why.

## The signature

From the shipped `@angular/platform-browser` 22.1.5 `.d.ts`:

```ts
declare function bootstrapApplication(
  rootComponent: Type<unknown>,
  options?: ApplicationConfig,
  context?: BootstrapContext,
): Promise<ApplicationRef>;
```

The javadoc-equivalent on angular.dev is worth quoting because it contains the one hard
constraint:

> *"Bootstraps an instance of an Angular application and renders a standalone component as
> the application's root component."*

> *"The root component passed into this function **must** be a standalone one"*

**`rootComponent`** — a component class, passed by identity. Not a string, not a factory.
`ComponentFactoryResolver` and `ComponentFactory` were removed outright in v22.0.0
(*"Pass the component class directly to APIs that previously required a factory"*), so
there is no longer a factory form of this argument to be confused by.

**`options`** — an `ApplicationConfig`, which is a one-field interface:

```ts
interface ApplicationConfig {
  /** List of providers that should be available to the root component and all its children. */
  providers: Array<Provider | EnvironmentProviders>;
}
```

That is the entire type. Everything an app is configured with — the router, HTTP, hydration,
change detection — arrives through that single array. Topic **03 · The provider array is the wiring** *(not written yet)* is about what belongs
in it.

**`context`** — added for server rendering. The `.d.ts` comment:

> *"Optional context object that can be used to provide a pre-existing platform injector.
> This is useful for advanced use-cases, for example, server-side rendering, where the
> platform is created for each request."*

You will not pass it in a browser app. `@angular/ssr` passes it for you.

## What the function actually does

The v22.1.5 implementation in `fesm2022/_browser-chunk.mjs` is short enough to read whole:

```ts
// @angular/platform-browser 22.1.5, fesm2022/_browser-chunk.mjs (shipped source)
async function bootstrapApplication(rootComponent, options, context) {
  const config = {
    rootComponent,
    ...createProvidersConfig(options, context),
  };
  if ((typeof ngJitMode === 'undefined' || ngJitMode) && typeof fetch === 'function') {
    await resolveJitResources();
  }
  return _internalCreateApplication(config);
}

function createProvidersConfig(options, context) {
  return {
    platformRef: context?.platformRef,
    appProviders: [...BROWSER_MODULE_PROVIDERS, ...(options?.providers ?? [])],
    platformProviders: INTERNAL_BROWSER_PLATFORM_PROVIDERS,
  };
}
```

Four things fall out of those nine lines.

**1 · `BrowserModule` did not disappear, its providers were inlined.** `BROWSER_MODULE_PROVIDERS`
is prepended to *your* providers. In 22.1.5 that list is the root injector scope marker, the
default `ErrorHandler`, the two `EVENT_MANAGER_PLUGINS` (`DomEventsPlugin`, `KeyEventsPlugin`),
`DomRendererFactory2`, `SharedStylesHost` and `EventManager`. This is why you never import
`BrowserModule` in a standalone app and why importing it anyway is an error — see the gotchas.

**2 · Your providers come *after* the browser ones,** so a `{ provide: ErrorHandler, … }`
in `appConfig.providers` wins. Last-wins for the same token is the DI rule; the ordering
here is what makes overriding the default error handler work at all.

**3 · It is `async` and returns `Promise<ApplicationRef>`.** Anything you want to run after
the app exists belongs in a `.then()`, in `provideAppInitializer()`, or in
`afterNextRender()` — not on the line after the call.

**4 · The `ngJitMode` branch is dev-server-only.** Under AOT (`ng build`) `ngJitMode` is
statically `false`, the branch is removed by the optimizer, and `resolveJitResources` —
which fetches `templateUrl`/`styleUrl` files at runtime — is dropped with it. Topic 11
covers JIT; topic 12 covers what else vanishes.
## Gotchas

**★ Symptom: `NG0907: The App component is not marked as standalone, but Angular expects to
have a standalone component here.`** The v22.1.5 message continues *"Please make sure the App
component does not have the `standalone: false` flag in the decorator."* Cause: the class you
passed to `bootstrapApplication` carries `standalone: false`, almost always because it was
migrated from an app where it sat in `AppModule.declarations`. Note the check is inside an
`ngDevMode` guard — a production build does not raise NG0907, it fails later and less
legibly. Fix: delete `standalone: false` from the decorator and move its template
dependencies out of the module into the component's own `imports`:

```ts
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent],
  templateUrl: './app.html',
})
export class App {}
```

**★ Symptom: `NG0906: The App is not an Angular component, make sure it has the @Component
decorator.`** Cause: you passed a class Angular could not find a `ɵcmp` definition on —
usually a service, a directive, or a component whose decorator was lost to a bad barrel
re-export or a `default` export mismatch. Fix: import the class directly from the file that
declares it, and check the decorator is `@Component` and not `@Directive`.

**★ Symptom: code after `bootstrapApplication(...)` runs before the app exists.** Cause: it
is `async`. The synchronous statement after the call executes while the promise is still
pending. Fix: chain it, or use the initializer hook:

```ts
import { APP_ID } from '@angular/core';

bootstrapApplication(App, appConfig)
  .then((appRef) => console.log('app id', appRef.injector.get(APP_ID)))
  .catch((err) => console.error(err));
```

**★ Symptom: a bootstrap failure shows as an unhandled promise rejection with no component
context.** Cause: you dropped the generated `.catch()`. Fix: keep it.
`provideBrowserGlobalErrorListeners()` in `appConfig` covers *runtime* `error` and
`unhandledrejection` events, but it is installed by the bootstrap that is failing, so it
cannot report its own failure.

**★ Symptom on the server only: `Missing Platform: This may be due to using
bootstrapApplication on the server without passing a BootstrapContext.`** Cause: server
rendering builds a platform per request and `internalCreateApplication` refuses to create one
implicitly when `ngServerMode` is set. Fix: take the context from the SSR entry point and
pass it through rather than calling the browser bootstrap directly:

```ts
// src/main.server.ts
import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { App } from './app/app';
import { config } from './app/app.config.server';

export default (context: BootstrapContext) => bootstrapApplication(App, config, context);
```

**★ Symptom: two `bootstrapApplication` calls on one page each get their own everything —
two routers, two HTTP clients, two copies of a `providedIn: 'root'` service.** Cause: each
call builds its own environment injector; only the *platform* injector is shared, and only
if you share it. Fix: this is correct behaviour for micro-frontends and is exactly what
`BootstrapContext` exists for — pass the same `platformRef` when you want one platform. If
you did not mean to bootstrap twice, look for a second entry point in `angular.json`.

**Symptom: a provider you put in `appConfig.providers` does not override an Angular default.**
Cause: it is not an ordering problem in the direction you think. `internalCreateApplication`
builds the final list as `[provideZonelessChangeDetectionInternal(), errorHandlerEnvironmentInitializer,
…dev-only initializers, ...appProviders]`, and `appProviders` is itself
`[...BROWSER_MODULE_PROVIDERS, ...yourProviders]` — so yours are genuinely last and do win
for the same token. If the override is not taking, the token is different from the one the
framework injects. Fix: check you are providing the exact class Angular asks for
(`ErrorHandler`, not a subclass token) and use `useExisting` to alias when both must resolve
to one instance.

## Interview questions

**★ Why does `bootstrapApplication` take a component and `bootstrapModule` take a module?**
Because the root of an Angular app is two things bundled together: a set of root providers
and a component to render. `NgModule` fused them into one class, so bootstrapping meant
"instantiate this module, read its `bootstrap` array, render what is in it". Standalone
splits them: the component is the first argument, the providers are the second, and there
is no class in between whose `imports` can quietly add a third thing you did not ask for.

**★ What happens if you pass a component with `standalone: false`?**
Bootstrap fails with NG0907 in a development build. The root component must be standalone; a
non-standalone component has no compilation scope of its own, so Angular would have no way
to resolve its template dependencies without the `NgModule` that declares it. The assertion
is inside an `ngDevMode` guard, so in production the same mistake surfaces later as a
template that cannot resolve anything.

**What is the third `context` argument for, and when would you pass it?**
`BootstrapContext` carries a pre-existing `platformRef`. Server rendering creates a platform
per request, so `@angular/ssr` passes one in rather than letting each bootstrap create its
own — and on the server, omitting it is a hard error rather than a fallback. In a browser
application you leave it undefined and Angular creates the platform with
`INTERNAL_BROWSER_PLATFORM_PROVIDERS`.

**Why is the function asynchronous when nothing in a compiled app needs to await anything?**
Because the same function serves the JIT dev path, where `templateUrl` and `styleUrl` are
fetched over the network before the root component can be compiled. Under AOT the `await`
resolves against an already-empty queue and the whole branch is optimized away, but the
signature has to stay `Promise`-returning for both.

**What would break if `ApplicationConfig` had more fields than `providers`?**
Nothing technically, but the single-field shape is the point: it forces every piece of
application configuration through one uniform mechanism — dependency injection — instead of
a growing bag of bootstrap options. That is why the ecosystem convention is a `provide*`
function returning `EnvironmentProviders` rather than an options object, which topic
**03 · The provider array is the wiring** *(not written yet)* unpacks.

**Where does the root injector come from if there is no root module?**
`internalCreateApplication` constructs an `EnvironmentNgModuleRefAdapter` over your provider
array with the platform injector as its parent. The "root" scope is not a class any more; it
is an `EnvironmentInjector` built from an array, which is why an injector-hierarchy question
in a standalone app has exactly three answers — platform, environment, element — and no
"which module am I in?" branch. Phase 6 owns the rest.

---

← Prev: [Topic index](README.md) · Index: [Topic index](README.md) · Next → [The NgModule bootstrap it replaced](01b-the-ngmodule-bootstrap-it-replaced.md)
