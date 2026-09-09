---
title: "What a test can substitute — `configureTestingModule` obeys the same map-first rule as production, `TestBed.overrideProvider` overwrites *all* providers for a token and has no `useClass` overload, and it reads your `providedIn` to decide which bucket the override lands in"
sidebar_label: "14f · Testing overrides"
sidebar_position: 14.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`: [`core/testing/src/test_bed.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/testing/src/test_bed.ts), [`core/testing/src/test_bed_compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/testing/src/test_bed_compiler.ts); plus `angular/angular-cli` at tag `v22.1.7`: [`schematics/angular/service/files`](https://github.com/angular/angular-cli/tree/v22.1.7/packages/schematics/angular/service/files). Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**"But how will I stub it in tests?" is the most common argument for keeping a redundant array entry, and it is wrong on the facts.** `TestBed` handles a `providedIn: 'root'` service better than an array-provided one, because it reads the class's own `ɵprov` and routes your override into a synthetic module that carries the root scope. The two substitution APIs are not interchangeable — one adds a provider to the testing environment injector and obeys the ordinary precedence rules, the other is documented as overwriting *all* providers for a token — and only one of them can reach inside a component's own `providers` array.

## Testing — what a test can substitute, and how

The spec the CLI generates alongside the service is the shortest possible statement that `providedIn: 'root'` needs no test wiring. From `angular/angular-cli` at `v22.1.7`, verbatim:

```ts
import { TestBed } from '@angular/core/testing';
import { <%= classifiedName %> } from './<%= dasherize(name) %><%= type ? '.' + dasherize(type) : '' %>';

describe('<%= classifiedName %>', () => {
  let service: <%= classifiedName %>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(<%= classifiedName %>);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
```

`configureTestingModule({})` — an empty configuration — and `TestBed.inject` finds the service anyway, because the record is on the class.

### Substituting it: the same rule as production

`TestBed.configureTestingModule({providers: […]})` puts records in the testing environment injector, and by the map-first rule those records are found before any `ɵprov` is consulted. So the ordinary provider forms all work unchanged:

```ts
import {TestBed} from '@angular/core/testing';
import {NotificationService} from './notification-service';
import {FakeNotificationService} from './testing/fake-notification-service';

describe('CheckoutComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{provide: NotificationService, useClass: FakeNotificationService}],
    });
  });
});
```

### `TestBed.overrideProvider` — narrower than it looks

There is a second mechanism, and its contract is stronger. From [`core/testing/src/test_bed.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/testing/src/test_bed.ts), verbatim:

```ts
  /**
   * Overwrites all providers for the given token with the given provider definition.
   */
  overrideProvider(
    token: any,
    provider: {useFactory: Function; deps: any[]; multi?: boolean},
  ): TestBed;
  overrideProvider(token: any, provider: {useValue: any; multi?: boolean}): TestBed;
  overrideProvider(
    token: any,
    provider: {useFactory?: Function; useValue?: any; deps?: any[]; multi?: boolean},
  ): TestBed;
```

🔴 **There is no `useClass` overload and no `useExisting` overload.** Only `useFactory` + `deps`, or `useValue`. If you want a class, you write `useFactory: () => new Fake()`. And *"Overwrites all providers for the given token"* is the point of the API: `configureTestingModule` adds a provider to the testing module, while `overrideProvider` replaces the token **everywhere in the test**, including inside component and route provider arrays the test does not own.

### Where the override lands depends on `providedIn`

This is the part that explains the API's odd reach. From [`core/testing/src/test_bed_compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/testing/src/test_bed_compiler.ts), verbatim:

```ts
    const injectableDef: InjectableDeclaration<any> | null =
      typeof token !== 'string' ? getInjectableDef(token) : null;
    const providedIn = injectableDef === null ? null : resolveForwardRef(injectableDef.providedIn);
    const overridesBucket =
      providedIn === 'root' ? this.rootProviderOverrides : this.providerOverrides;
    overridesBucket.push(providerDef);
```

`TestBed` reads the class's own `ɵprov` to decide where to put your override. A `providedIn: 'root'` token's override goes into `rootProviderOverrides`, which is emptied into a synthetic module the compiler builds for exactly this purpose, verbatim:

```ts
  private compileTestModule(): void {
    class RootScopeModule {}
    compileNgModuleDefs(RootScopeModule as NgModuleType<any>, {
      providers: [
        ...this.rootProviderOverrides,
        provideZonelessChangeDetectionInternal(),
        TestBedApplicationErrorHandler,
```

Everything else — `providedIn: 'platform'`, `providedIn: null`, a plain `InjectionToken`, a token you provided yourself — goes into `providerOverrides`, appended to the testing module's own providers, verbatim:

```ts
      ...this.providers,
      ...this.providerOverrides,
    ];
```

and a third bucket handles the deprecated module scope, verbatim:

```ts
  // Overrides for injectables with `{providedIn: SomeModule}` need to be tracked and added to that
  // module's provider list.
  private providerOverridesByModule = new Map<InjectorType<any>, Provider[]>();
```

The consequence is worth stating plainly: **`TestBed.overrideProvider` behaves differently for a root-provided service than for anything else, and it decides which by reading the decorator you wrote.** That is why an override of a root service reaches into component-level providers arrays as well, and an override of a plain token generally does not.

## Gotchas

**★ Symptom: `TestBed.overrideProvider(Svc, {useClass: FakeSvc})` does not type-check.** Cause: there is no `useClass` overload — the signatures accept `{useFactory, deps}` or `{useValue}` only. Fix: wrap it.

```ts
TestBed.overrideProvider(NotificationService, {useFactory: () => new FakeNotificationService()});
```

**★ Symptom: `configureTestingModule({providers: [{provide: Svc, useClass: Fake}]})` did not replace the service a child component provides for itself.** Cause: `configureTestingModule` adds a record to the testing environment injector; a component's own `providers` array creates a record in that component's element injector, which is found first. Fix: `TestBed.overrideProvider`, which *"Overwrites all providers for the given token"* rather than adding one.

```ts
TestBed.overrideProvider(NotificationService, {useValue: new FakeNotificationService()});
```

**★ Symptom: `overrideProvider` replaced a `providedIn: 'root'` service everywhere but did not touch a `providedIn: 'platform'` one the same way.** Cause: the bucket is chosen by reading `getInjectableDef(token).providedIn` — `'root'` goes to `rootProviderOverrides` and into the synthetic `RootScopeModule`, everything else goes to `providerOverrides` on the testing module. Fix: provide the platform-scoped token explicitly in `configureTestingModule`, or restructure the service to `'root'` if platform scope was not deliberate.

**★ Symptom: you passed a string token to `overrideProvider` and it behaved differently from a class.** Cause: the implementation short-circuits — `typeof token !== 'string' ? getInjectableDef(token) : null` — so a string token can never be treated as root-provided. Fix: use a typed `InjectionToken` instead of a string; string tokens also go through a `@deprecated` `Injector.get` overload.

**★ Symptom: `overrideProvider` had no effect and the error mentions the test module already being instantiated.** Cause: `TestBed` asserts that overrides are registered before the testing module is compiled; calling it after the first `TestBed.inject` or `createComponent` is too late. Fix: move every `overrideProvider` call into `beforeEach`, before anything resolves.

**★ Symptom: a test passes alone and fails in the suite, and the service is `providedIn: 'root'`.** Cause: `providedIn: 'root'` gives *"a single, shared instance for the entire application"*, and each `TestBed` resets that — but state you stored in a module-level variable outside the class does not reset. Fix: keep state in the service instance, not in module scope, so `TestBed`'s per-test injector actually gives you a fresh one.

**★ Symptom: you removed the array entry for a service in production and a test broke.** Cause: the test relied on that entry, either directly or by ordering. If the class is `@Service()`, the test does not need it — `TestBed.configureTestingModule({})` finds it. If the class is `@Injectable()` with no arguments, the entry was the only registration and the test was right to depend on it. Fix: check the decorator, then either add `@Service()` or restore the entry — not both.

**★ Symptom: `TestBed.overrideProvider` on a `multi: true` token did not append to the existing contributions.** Cause: the documented contract is *"Overwrites all providers for the given token with the given provider definition"* — the API is a replacement, and `multi` on the override describes the record you are installing, not a merge with what was there. ⚠️ The source does not spell the interaction out further than that sentence, so do not infer more: pass the complete set you want and assert on it in the test rather than assuming your entry is added to a list.

```ts
TestBed.overrideProvider(HTTP_INTERCEPTORS, {
  useValue: [new FakeAuthInterceptor()],
  multi: true,
});
```

**★ Symptom: a service is listed in `app.config.ts` purely "so tests can override it".** Cause: a misconception about `TestBed`. Overriding a root-provided service is exactly the case `overrideProvider` handles best — it reads `getInjectableDef(token).providedIn`, sees `'root'`, and installs your override into the synthetic `RootScopeModule` that carries the root scope. Fix: delete the production array entry; the test loses nothing.

```ts
TestBed.overrideProvider(NotificationService, {useValue: new FakeNotificationService()});
```

## Interview questions

**★ A service is `@Service()`. What does its generated spec have to do to get an instance, and why?**
Nothing beyond `TestBed.configureTestingModule({})` and `TestBed.inject(Svc)`. The provider record is `ɵprov` on the class, so the testing injector — which carries the root scope — materialises it on first request exactly as the application injector would. That is the CLI's generated spec verbatim, and it is a useful diagnostic in reverse: if a spec has to list the service in `providers` to get one, the class is not actually root-provided.

**★ What is the difference between putting a provider in `configureTestingModule` and calling `TestBed.overrideProvider`?**
Reach. `configureTestingModule({providers})` adds a record to the testing environment injector, and anything with a *narrower* record — a component's `providers`, a route's `providers` — still wins, exactly as in production. `overrideProvider` is documented as *"Overwrites all providers for the given token"*: `TestBed` collects it into an override bucket and applies it while compiling every definition, so it reaches inside provider arrays the test does not own. Use the first when you are configuring the environment, the second when you need to displace a provider somebody else wrote.

**★ `TestBed.overrideProvider` accepts `useFactory` and `useValue` but not `useClass`. Why does that matter in practice?**
Because it changes what you write, and it removes an ambiguity. `useClass` would ask the injector to construct the class, which raises the question of which injector's dependencies it should use while overrides are still being applied; `useFactory` with an explicit `deps` array, or a plain `useValue`, is unambiguous. In practice you write `{useFactory: () => new Fake()}` where you would have written `{useClass: Fake}`, and if the fake needs dependencies you either pass them to the constructor yourself or list them in `deps`.

**★ Why does `TestBed` read the service's `providedIn` before deciding where to put your override?**
Because the two cases need different placement to behave correctly. A `providedIn: 'root'` service is resolved by scope, not by any providers array, so an override has to be installed in something that carries the root scope — `TestBed` builds a synthetic `RootScopeModule` and puts `rootProviderOverrides` first in its providers. Everything else is resolved from an actual providers array, so its override belongs on the testing module alongside `this.providers`. There is a third bucket, `providerOverridesByModule`, purely for the deprecated `providedIn: SomeNgModule` form. Reading the decorator is how `TestBed` picks the bucket, which means the way you wrote the service changes how the testing API behaves on it.

**★ A test for a `providedIn: 'root'` service passes on its own and fails when the suite runs. Where do you look first?**
Not at DI. Each `TestBed` builds its own injector, so the service instance is genuinely fresh per test — that is what *"a single, shared instance for the entire application"* means when the "application" is one test. What is *not* fresh is anything the module holds outside the class: a module-level `let`, a cached promise, a registry populated at import time, a `WeakMap` keyed on something long-lived. Those are initialised once per module load and survive every `TestBed` reset in the file. The second place to look is an `overrideProvider` call made after the testing module was already instantiated, which `TestBed` rejects rather than silently applying.

← Prev: [The inheritance trap](14e-the-inheritance-trap.md) · Index: [Topic index](README.md) · Next → [Route-level `providers`](15-route-level-providers.md)
