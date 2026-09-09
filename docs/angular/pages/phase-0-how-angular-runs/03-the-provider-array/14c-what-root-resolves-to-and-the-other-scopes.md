---
title: "`'root'` is a token value an injector is handed, not a keyword the framework knows — and once you can see that, the array beating `providedIn` stops being about order, `'platform'` stops being reachable from `app.config.ts`, and `'any'` stops being a scope at all"
sidebar_label: "14c · What `'root'` resolves to"
sidebar_position: 14.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`: [`core/src/di/scope.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/scope.ts), [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts), [`core/src/render3/ng_module_ref.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/ng_module_ref.ts), [`core/src/platform/platform.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/platform/platform.ts), [`core/src/di/injectable.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/injectable.ts), [`platform-browser/src/browser.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/platform-browser/src/browser.ts). Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Almost every wrong intuition about `providedIn` comes from believing `'root'` is a keyword.** It is a string, compared against a `Set` on the injector, and the injector gets that string from an ordinary provider that `bootstrapApplication` prepends to your array. Once that is on the table, three separate confusions dissolve at once: why an array entry always beats `providedIn` regardless of position, why `providedIn: 'platform'` cannot be configured from `ApplicationConfig`, and why `providedIn: 'any'` was never really a scope. This page stays on the *wiring* — how the scope marker gets into the injector. Injector hierarchies and resolution flags are **Phase 6 · Dependency injection** *(not written yet)*.

## What `'root'` actually resolves to — it is a token value, not a keyword

`'root'` reads like a magic word. It is a string compared against a `Set` that an injector builds from a provider you never wrote. From [`core/src/di/scope.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/scope.ts), the whole file that defines the vocabulary, verbatim:

```ts
export type InjectorScope = 'root' | 'platform' | 'environment';

/**
 * An internal token whose presence in an injector indicates that the injector should treat itself
 * as a root scoped injector when processing requests for unknown tokens which may indicate
 * they are provided in the root scope.
 */
export const INJECTOR_SCOPE = new InjectionToken<InjectorScope | null>(
  typeof ngDevMode !== 'undefined' && ngDevMode ? 'Set Injector scope.' : '',
);
```

The application injector is **not** created with the `'root'` scope. From [`core/src/render3/ng_module_ref.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/ng_module_ref.ts), `EnvironmentNgModuleRefAdapter` — the class `bootstrapApplication` uses — verbatim:

```ts
    const injector = new R3Injector(
      [...config.providers, {provide: viewEngine_NgModuleRef, useValue: this}],
      config.parent || getNullInjector(),
      config.debugName,
      new Set(['environment']),
    );
```

`new Set(['environment'])`. The `'root'` scope arrives afterwards, from the providers themselves. From [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts), at the end of the `R3Injector` constructor, verbatim:

```ts
    // Detect whether this injector has the APP_ROOT_SCOPE token and thus should provide
    // any injectable scoped to APP_ROOT_SCOPE.
    const record = this.records.get(INJECTOR_SCOPE) as Record<InjectorScope | null>;
    if (record != null && typeof record.value === 'string') {
      this.scopes.add(record.value as InjectorScope);
    }
```

and the provider that supplies it lives in `platform-browser`, first line of `BROWSER_MODULE_PROVIDERS` in [`platform-browser/src/browser.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/platform-browser/src/browser.ts), verbatim:

```ts
const BROWSER_MODULE_PROVIDERS: Provider[] = [
  {provide: INJECTOR_SCOPE, useValue: 'root'},
  {provide: ErrorHandler, useFactory: errorHandler},
```

which reaches your injector through the same function that reads your `ApplicationConfig`, verbatim:

```ts
function createProvidersConfig(options?: ApplicationConfig, context?: BootstrapContext) {
  return {
    platformRef: context?.platformRef,
    appProviders: [...BROWSER_MODULE_PROVIDERS, ...(options?.providers ?? [])],
    platformProviders: INTERNAL_BROWSER_PLATFORM_PROVIDERS,
  };
}
```

So the chain is: `bootstrapApplication` prepends `BROWSER_MODULE_PROVIDERS` to your array → one of those entries is `{provide: INJECTOR_SCOPE, useValue: 'root'}` → the `R3Injector` constructor reads that record out of its own `Map` and adds `'root'` to `this.scopes` → and a `providedIn: 'root'` class now matches. **`providedIn: 'root'` means "in whichever injector holds the `'root'` scope marker", and in a browser application that is the one `bootstrapApplication` built for you.**

Two consequences fall straight out. A route injector is created by `createEnvironmentInjector`, which goes through the same adapter and therefore the same `new Set(['environment'])` — it is **not** root-scoped, so `providedIn: 'root'` services resolve past it to the application injector. And `INJECTOR_SCOPE` is exported only as `ɵINJECTOR_SCOPE`; it is private API and not a knob.

## 🔴 The array does not "win by being last". It wins by being looked at first

This is the single most misread part of the comparison, and the code settles it. From `R3Injector.get`, verbatim:

```ts
      // Check for the SkipSelf flag.
      if (!(flags & InternalInjectFlags.SkipSelf)) {
        // SkipSelf isn't set, check if the record belongs to this injector.
        let record: Record<T> | undefined | null = this.records.get(token);
        if (record === undefined) {
          // No record, but maybe the token is scoped to this injector. Look for an injectable
          // def with a scope matching this injector.
          const def = couldBeInjectableType(token) && getInjectableDef(token);
          if (def && this.injectableDefInScope(def)) {
            // Found an injectable def and it's scoped to this injector. Pretend as if it was here
            // all along.
```

`this.records.get(token)` first. **The `ɵprov` on the class is consulted only when the `Map` has no record at all** — `if (record === undefined)`. Every entry in `ApplicationConfig.providers` produced a record during construction, so for any token you listed, the `providedIn` path is never reached.

Three things follow that people get wrong:

- **Position in the array is irrelevant to beating `providedIn`.** First entry or last, the record exists before the first `get()` runs. The "last wins" rule from [13 · Order dependence](13-order-dependence.md) governs *two array entries for the same token*; it has nothing to do with the decorator.
- **A miss is cached too.** The `else` branch sets `record = null` and then `this.records.set(token, record)` unconditionally. A token that was not in scope here is remembered as not in scope here.
- **The comment says it exactly:** *"Pretend as if it was here all along."* A `providedIn` hit is materialised into the same `Map`, so after the first injection the two mechanisms are indistinguishable at runtime.

The scope test itself is four lines, verbatim:

```ts
  private injectableDefInScope(def: ɵɵInjectableDeclaration<any>): boolean {
    if (!def.providedIn) {
      return false;
    }
    const providedIn = resolveForwardRef(def.providedIn);
    if (typeof providedIn === 'string') {
      return providedIn === 'any' || this.scopes.has(providedIn);
    } else {
      return this.injectorDefTypes.has(providedIn);
    }
  }
```

`if (!def.providedIn) return false` is `providedIn: null` — `@Injectable()` with no arguments, and `@Service({autoProvided: false})`. Those classes are in scope nowhere and the array is their only home.

## `'platform'` — a real scope you cannot reach from `app.config.ts`

`providedIn: 'platform'` means the injector that carries the `'platform'` marker, created here — from [`core/src/platform/platform.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/platform/platform.ts), verbatim:

```ts
/**
 * Helper function to create an instance of a platform injector (that maintains the 'platform'
 * scope).
 */
function createPlatformInjector(providers: StaticProvider[] = [], name?: string): Injector {
  return Injector.create({
    name,
    providers: [
      {provide: INJECTOR_SCOPE, useValue: 'platform'},
      {provide: PLATFORM_DESTROY_LISTENERS, useValue: new Set([() => (_platformInjector = null)])},
      ...providers,
    ],
  });
}
```

The platform injector is the parent of every application injector on the page, so a `providedIn: 'platform'` service is shared across applications. `@Injectable`'s own metadata JSDoc, verbatim:

> *"- 'platform' : A special singleton platform injector shared by all applications on the page."*

🔴 **`ApplicationConfig.providers` cannot put anything there.** Your array becomes `appProviders`, which builds a child of the platform injector. To provide at platform scope you create the platform yourself and pass it in — `platformBrowser` takes `extraProviders`, and `bootstrapApplication`'s third parameter accepts the resulting `PlatformRef`:

```ts
import {bootstrapApplication, platformBrowser} from '@angular/platform-browser';
import {InjectionToken} from '@angular/core';
import {App} from './app/app';
import {appConfig} from './app/app.config';

export const PAGE_CORRELATION_ID = new InjectionToken<string>('PAGE_CORRELATION_ID');

const platformRef = platformBrowser([
  {provide: PAGE_CORRELATION_ID, useValue: crypto.randomUUID()},
]);

bootstrapApplication(App, appConfig, {platformRef});
```

`BootstrapContext` is exactly one field, verbatim:

```ts
export interface BootstrapContext {
  /**
   * A reference to a platform.
   */
  platformRef: PlatformRef;
}
```

⚠️ Note the type: `platformBrowser` takes `StaticProvider[]`, not `Array<Provider | EnvironmentProviders>`. No `provide*()` function's return value is accepted there — the reason is in [03](03-environmentproviders-vs-provider.md).

**On the server, "platform singleton" does not mean what it means in the browser.** From the same file, verbatim, including the source's own typo:

```ts
  // During SSR, using this setting and using an injector from the global can cause the
  // injector to be used for a different requjest due to concurrency.
  _platformInjector = typeof ngServerMode === 'undefined' || !ngServerMode ? injector : null;
```

Under SSR the platform injector is deliberately **not** retained in the module-level global, because concurrent requests would share it. `bootstrapApplication`'s own JSDoc for the `context` parameter says the same, verbatim: *"This is useful for advanced use-cases, for example, server-side rendering, where the platform is created for each request."* So a `providedIn: 'platform'` service is a per-page singleton in the browser and a per-request singleton on the server — never a process-wide one. How the *application* config is assembled on the server is **17 · The server config merge** *(not written yet)*.

## `'any'` — deprecated, and it is not a scope at all

`providedIn: 'any'` short-circuits the scope test: `return providedIn === 'any' || this.scopes.has(providedIn)`. It is `true` for **every** `R3Injector`, so every environment injector that is asked for the token materialises its own record and its own instance. `@Injectable`'s metadata JSDoc, verbatim:

> *"- 'any' : Provides a unique instance in each lazy loaded module while all eagerly loaded modules share one instance. This option is DEPRECATED."*

and the decorator's overload carries the tag, from [`core/src/di/injectable.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/injectable.ts), verbatim:

```ts
  /**
   * @deprecated The `providedIn: NgModule` or `providedIn:'any'` options are deprecated. Please use the other signatures.
   */
  (options?: {providedIn: Type<any> | 'any'} & InjectableProvider): TypeDecorator;
  (options?: {providedIn: 'root' | 'platform' | null} & InjectableProvider): TypeDecorator;
```

🔴 **The deprecation is on the decorator overload, not on the `providedIn` field's type.** The public-API golden flattens the overloads into `providedIn?: Type<any> | 'root' | 'platform' | 'any' | null;` with no marker, so grepping the golden will tell you `'any'` is fine. It is not: the call signature that accepts it is `@deprecated`, and the same sentence appears in `InjectionToken`'s doc comment. Migrate `'any'` to `'root'` unless you were genuinely relying on per-lazy-injector instances, in which case the modern spelling is a route's `providers`.

⚠️ One typing curiosity worth knowing before it confuses you: `ɵɵdefineInjectable`'s parameter allows a fifth value the public decorator does not — `providedIn?: Type<any> | 'root' | 'platform' | 'any' | 'environment' | null`. `'environment'` is a valid `InjectorScope` but there is no public way to write it on a class.

## Gotchas

**★ Symptom: you moved a provider from the end of the array to the beginning to "make it win over `providedIn: 'root'`" and nothing changed.** Cause: it was already winning, and position was never the reason. Any record in the injector's `Map` is found before `getInjectableDef` is consulted at all. Fix: none needed — but if a *different* provider is actually winning, that is two array entries for one token, which is the last-wins rule and a genuinely order-sensitive case.

**★ Symptom: the service is `@Service()` and you still see two instances.** Cause: a second registration exists somewhere with a narrower injector — a component's `providers`, or a route's. Both create a record in *their* injector, and that record is found before the walk ever reaches the application injector. Fix: remove the narrower registration, unless the second instance is the point. [01](01-app-config-and-what-bootstrap-does-with-it.md) has the component case; [15 · Route-level `providers`](15-route-level-providers.md) has the route case.

**★ Symptom: a service is `providedIn: 'root'` and a route-provided component gets the application instance, not a route one.** Cause: route injectors are built by `createEnvironmentInjector`, which uses `new Set(['environment'])` — they never carry the `'root'` marker, so `injectableDefInScope` returns `false` there and resolution continues to the parent. Fix: if you want a route-scoped instance, list the class in that route's `providers`. [15 · Route-level `providers`](15-route-level-providers.md).

**★ Symptom: a `providedIn: 'platform'` service gives you a fresh instance per request under SSR and you expected one per process.** Cause: `createPlatform` refuses to cache the injector in its module-level global when `ngServerMode` is set, because concurrent requests would otherwise share it — the comment says so. Fix: nothing in DI. If you genuinely want process-wide state on the server, hold it in a module-scoped value outside Angular's injector and understand that you now own the concurrency.

**★ Symptom: you put `{provide: SomeToken, useValue: x}` in `app.config.ts` and a `providedIn: 'platform'` service still cannot see it.** Cause: the platform injector is the **parent**. Resolution walks up, never down, so nothing provided in the application injector is visible to a platform-scoped instance. Fix: provide it at the platform.

```ts
const platformRef = platformBrowser([{provide: SomeToken, useValue: x}]);
bootstrapApplication(App, appConfig, {platformRef});
```

**★ Symptom: your linter or a code review flags `providedIn: 'any'` and the public API golden shows no deprecation.** Cause: the deprecation lives on the `@Injectable` call **overload**, which API Extractor's golden does not preserve; the flattened `providedIn?: …` field type looks clean. Fix: trust the source JSDoc — *"The `providedIn: NgModule` or `providedIn:'any'` options are deprecated"* — and change it to `'root'`.

**★ Symptom: `providedIn: SomeNgModule` still compiles and you cannot find the replacement.** Cause: it is the same deprecated overload as `'any'`, and its scope test is the other branch — `this.injectorDefTypes.has(providedIn)` — which only matches an injector that actually imported that module's `ɵinj`. Fix: `'root'` plus lazy loading of the code, or a route's `providers` if you want a real lifetime.

**★ Symptom: you wrote `providedIn: 'environment'` because you saw it in `InjectorScope` and TypeScript rejects it.** Cause: `'environment'` is a real scope name inside `ɵɵdefineInjectable`'s signature, but `@Injectable`'s public overloads only accept `'root' | 'platform' | 'any' | null` or a type. Fix: there is no public spelling for it; every environment injector already accepts `'any'`, and a route's `providers` is the supported way to bind to one specific environment injector.

**★ Symptom: a token that failed to resolve once keeps failing, even after you believe you fixed the wiring.** Cause: the miss is memoised. When neither the map nor `injectableDefInScope` produces a record, `get` runs `record = null` and then `this.records.set(token, record)` unconditionally — the injector remembers that this token is not its business. Fix: there is no "add a provider later"; providers are processed in the `R3Injector` constructor. If a hot reload left you with a stale injector, restart the application rather than reasoning about the map.

## Interview questions

**★ Where does the `'root'` in `providedIn: 'root'` actually come from?**
From a provider, not from the framework's structure. `bootstrapApplication` builds the application's `R3Injector` with `new Set(['environment'])` — no root scope. It also prepends `BROWSER_MODULE_PROVIDERS` to your array, whose first entry is `{provide: INJECTOR_SCOPE, useValue: 'root'}`. At the end of its constructor the injector reads `INJECTOR_SCOPE` out of its own record map and adds the value to `this.scopes`. Only then does `providedIn: 'root'` match. So "root" is a marker token an injector can be given, the platform injector gets `'platform'` the same way, and a route injector gets neither — which is why route injectors do not capture root-provided services.

**★ Why is it wrong to say "the array wins because it comes last"?**
Because the two mechanisms are not in the same competition. `R3Injector.get` checks `this.records.get(token)` first and only falls through to `getInjectableDef(token)` when the map has no entry — `if (record === undefined)`. Every array entry created a record at construction time, so for any token you listed, the class's `ɵprov` is never read, regardless of where the entry sits. "Last wins" is a real rule, but it governs two *array* entries for the same token; it says nothing about `providedIn`.

**★ What is the difference between `providedIn: 'root'` and `providedIn: 'platform'`, and when would you actually use the second?**
`'root'` binds the service to the injector `bootstrapApplication` creates — one instance per application. `'platform'` binds it to the injector's parent, which is shared by every Angular application bootstrapped on the same page, and which you can only configure by creating the platform yourself with `platformBrowser([...])` and passing the `PlatformRef` as `bootstrapApplication`'s third argument. It earns its keep in exactly one situation: multiple Angular applications on one page that must share a single instance of something — a message bus, a shared auth token holder. In a single-application build it buys you nothing and costs you the ability to configure it from `app.config.ts`. On the server it is per-request, not per-process, because `createPlatform` refuses to cache the injector globally under `ngServerMode`.

**★ `providedIn: 'any'` is deprecated. What did it do, and what replaced it?**
Its scope check is `providedIn === 'any' || this.scopes.has(providedIn)` — it matches unconditionally, so every environment injector that is asked for the token creates its own instance and caches it. In the NgModule era that produced one instance per lazy-loaded module and one shared instance across everything eager, which was a subtle enough contract that most uses of it were accidents. The replacement depends on what you wanted: `'root'` if you wanted a singleton whose code still lazy-loads, and a route's `providers` if you genuinely wanted an instance bound to a feature's lifetime — which is the same thing but explicit about which injector, and visible at the route rather than hidden on the class.

**★ Two components inject the same `providedIn: 'root'` service. What does the second injection cost compared with the first?**
A map lookup and nothing else. The first injection misses `this.records`, finds the `ɵprov`, passes `injectableDefInScope`, and materialises a record — the comment in the source is *"Pretend as if it was here all along"* — which is then stored with `this.records.set(token, record)`. `hydrate` sees `record.value === NOT_YET`, calls the factory once, and writes the instance into the record. The second injection finds the record immediately and `hydrate` returns `record.value` without touching the factory. So after the first resolution a `providedIn` service and an array-provided service are the same thing: one entry in one `Map`, holding one instance.

← Prev: [Where the decorator runs out](14b-where-the-decorator-runs-out.md) · Index: [Topic index](README.md) · Next → [Overriding a root service](14d-overriding-a-root-provided-service.md)
