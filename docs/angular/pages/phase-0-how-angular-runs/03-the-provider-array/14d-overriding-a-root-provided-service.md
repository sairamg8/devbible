---
title: "Overriding a root-provided service — `@Injectable` can carry the whole provider recipe without touching the array, `deps` is a positional contract nothing type-checks, and `useClass` and `useExisting` differ by exactly one instance"
sidebar_label: "14d · Overriding a root service"
sidebar_position: 14.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`: [`core/src/di/injectable.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/injectable.ts), [`core/src/di/interface/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/interface/provider.ts), and the DI compliance goldens in [`compiler-cli/test/compliance/test_cases/r3_view_compiler_di/di/`](https://github.com/angular/angular/tree/v22.1.5/packages/compiler-cli/test/compliance/test_cases/r3_view_compiler_di/di). Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Substituting a service is the single most common reason an application's provider array exists, and it is where the most instances get created by accident.** Two things make it survivable: knowing that `@Injectable`'s options object accepts the entire provider union — so a substitution can live on the class, keeping its tree-shakability — and knowing that `useClass` constructs while `useExisting` aliases. Everything below is shown in code, including the `deps` form, which is positional, unchecked, and the reason modern guidance prefers `inject()` inside the factory.

## `@Injectable` can carry a provider recipe — you do not always need the array to override

The most under-used part of `@Injectable` is that its options object is `{providedIn} & InjectableProvider`, and `InjectableProvider` is the full union:

```ts
export type InjectableProvider =
  | ValueSansProvider
  | ExistingSansProvider
  | StaticClassSansProvider
  | ConstructorSansProvider
  | FactorySansProvider
  | ClassSansProvider;
```

So a class can be root-provided **and** say that injecting it should produce something else. Angular's own compliance goldens show both shapes and their emitted output. From `packages/compiler-cli/test/compliance/test_cases/r3_view_compiler_di/di/useclass_with_deps.ts` at `v22.1.5`, verbatim:

```ts
import {Injectable} from '@angular/core';

class SomeDep {}

@Injectable()
class MyAlternateService {
  constructor(dep: SomeDep) {}
}

@Injectable({providedIn: 'root', useClass: MyAlternateService, deps: [SomeDep]})
export class MyService {
}
```

and its golden output, `useclass_with_deps.js`, verbatim (the `// ...` is the golden's own):

```js
export class MyService {
  // ...
  static ɵprov = /*@__PURE__*/ $r3$.ɵɵdefineInjectable({
    token: MyService,
    factory: function MyService_Factory(__ngFactoryType__) {
      let __ngConditionalFactory__ = null;
      if (__ngFactoryType__) {
        __ngConditionalFactory__ = new __ngFactoryType__();
      } else {
        /* @ts-ignore */
        __ngConditionalFactory__ = new MyAlternateService($r3$.ɵɵinject(SomeDep));
      }
      return __ngConditionalFactory__;
    },
    providedIn: 'root'
  });
}
```

The token stays `MyService`, the scope stays `'root'`, and the factory builds `MyAlternateService`. No line in `app.config.ts`.

## What `useFactory` with `deps` actually changes

`deps` is not decoration. From [`core/src/di/interface/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/interface/provider.ts), verbatim:

> *"A function to invoke to create a value for this `token`. The function is invoked with resolved values of `token`s in the `deps` field."*
>
> *"A list of `token`s to be resolved by the injector. The list of values is then used as arguments to the `useFactory` function."*

`deps` is positional: the array's order is the factory's parameter order, and each element is resolved by the injector before the call. The compiler turns each entry into an `ɵɵinject` call at the call site. From `usefactory_with_deps.ts`, verbatim:

```ts
import {Injectable, Optional} from '@angular/core';

class SomeDep {}
class MyAlternateService {
  constructor(dep: SomeDep, optional: SomeDep|null) {}
}

@Injectable({
  providedIn: 'root',
  useFactory: (dep: SomeDep, optional: SomeDep|null) => new MyAlternateService(dep, optional),
  deps: [SomeDep, [new Optional(), SomeDep]]
})
export class MyService {
}
```

and `usefactory_with_deps.js`, verbatim:

```js
    factory: function MyService_Factory(__ngFactoryType__) {
      let __ngConditionalFactory__ = null;
      if (__ngFactoryType__) {
        __ngConditionalFactory__ = new __ngFactoryType__();
      } else {
        /* @ts-ignore */
        __ngConditionalFactory__ = ((dep, optional) => new MyAlternateService(dep, optional))($r3$.ɵɵinject(SomeDep), $r3$.ɵɵinject(SomeDep, 8));
      }
      return __ngConditionalFactory__;
    },
```

Note `$r3$.ɵɵinject(SomeDep, 8)` — the nested `[new Optional(), SomeDep]` form compiles to a flags argument, which is how you say "optional", "self" or "skip self" inside a `deps` array.

**In modern code you usually do not want `deps` at all.** A `useFactory` runs in an injection context, so `inject()` works inside it and gives you names, types and no positional coupling:

```ts
import {ApplicationConfig, inject, InjectionToken} from '@angular/core';
import {HttpClient} from '@angular/common/http';

export const FEATURE_FLAGS = new InjectionToken<Record<string, boolean>>('FEATURE_FLAGS');

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: FEATURE_FLAGS,
      useFactory: () => {
        const http = inject(HttpClient);
        return buildFlagsFrom(http);
      },
    },
  ],
};
```

`deps` remains necessary in one place: `StaticProvider`, the type `platformBrowser` and `Injector.create` accept, where reflection is explicitly not available and `StaticClassProvider.deps` is required rather than optional.

## Every substitution, in code

Assume `NotificationService` is `@Service()` — root-provided, and the array knows nothing about it. Each of these overrides it from `app.config.ts`, and each does something different.

**Replace the implementation (`useClass`).** A new instance of `LoudNotificationService` is created by the injector; `NotificationService` is only a token now.

```ts
import {ApplicationConfig} from '@angular/core';
import {NotificationService} from './notification-service';
import {LoudNotificationService} from './loud-notification-service';

export const appConfig: ApplicationConfig = {
  providers: [{provide: NotificationService, useClass: LoudNotificationService}],
};
```

**Alias to an existing instance (`useExisting`).** No second instance — injecting either token returns the same object. This is the one people reach for `useClass` by mistake and get two.

```ts
export const appConfig: ApplicationConfig = {
  providers: [
    LoudNotificationService,
    {provide: NotificationService, useExisting: LoudNotificationService},
  ],
};
```

**Build it yourself (`useFactory`).** Use this when construction depends on something you have to read first.

```ts
import {ApplicationConfig, inject} from '@angular/core';
import {NotificationService} from './notification-service';
import {LoudNotificationService} from './loud-notification-service';
import {QuietNotificationService} from './quiet-notification-service';
import {FEATURE_FLAGS} from './feature-flags';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: NotificationService,
      useFactory: () => (inject(FEATURE_FLAGS).loudAlerts
        ? new LoudNotificationService()
        : new QuietNotificationService()),
    },
  ],
};
```

**Supply a ready-made object (`useValue`).** No construction at all — the object you wrote is what everyone injects.

```ts
export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: NotificationService,
      useValue: {notify: (message: string) => console.warn(message)} as NotificationService,
    },
  ],
};
```

**Never construct it (a bare class entry).** `providers: [NotificationService]` is `{provide: NotificationService, useClass: NotificationService}` — the redundant case from [14](14-providedin-root-vs-the-array.md), not an override.

## Gotchas

**★ Symptom: you overrode a root service with `useClass` and now there are two instances — the original one is alive too.** Cause: something injects the original class directly and something else injects the token you re-pointed, or the two classes are both listed. `useClass` constructs a *new* instance for the token; it does not retire the old record. Fix: `useExisting`, so both tokens resolve to one object.

```ts
providers: [
  LoudNotificationService,
  {provide: NotificationService, useExisting: LoudNotificationService},
]
```

**★ Symptom: `useExisting` produces a no-provider error for the token you aliased to.** Cause: `useExisting` is an alias, not a registration — it tells the injector to resolve *another* token and return that. If the target has no record and no `providedIn`, there is nothing to alias to. Fix: provide the target as well, or make it root-provided.

```ts
providers: [
  LoudNotificationService,                                       // ← the target must exist
  {provide: NotificationService, useExisting: LoudNotificationService},
]
```

**★ Symptom: the override in `app.config.ts` had no effect — the old implementation is still running.** Cause: the consumer is not resolving through the application injector. A component or route lists the class in its own `providers`, or the code injecting it runs inside an injector that has its own record. Fix: find the narrower registration; the application injector cannot override a child.

**★ Symptom: your `useFactory` arguments are all `undefined`.** Cause: `deps` is positional and yours does not match the parameter list, or it is missing entirely — the factory is *"invoked with resolved values of `token`s in the `deps` field"*, and an absent `deps` means an absent argument list. Fix: drop `deps` and call `inject()` inside the factory, which is name-based and cannot silently misalign.

```ts
{
  provide: NotificationService,
  useFactory: () => new LoudNotificationService(inject(HttpClient)),
}
```

**★ Symptom: `deps: [SomeToken]` throws when the token is genuinely optional.** Cause: a bare entry in `deps` is a required injection. The optional form is the nested array with a flag object. Fix, matching the compliance golden:

```ts
deps: [SomeDep, [new Optional(), SomeDep]]
```

**★ Symptom: you added `deps` to a provider passed to `platformBrowser([...])` and TypeScript demanded it.** Cause: that parameter is `StaticProvider[]`, where `deps` on a `StaticClassProvider` is required, not optional — static providers exist precisely for the case where reflection is unavailable. Fix: supply `deps` there; it is the one place the modern `inject()` advice does not apply.

**★ Symptom: `@Injectable({providedIn: 'root', useClass: Other})` and the migration schematic refuses to convert it to `@Service()`.** Cause: the schematic rejects any decorator property other than `providedIn`, and the comparison table's fourth row says `@Service` has no advanced provider keys. Fix: keep `@Injectable`. This is one of the legitimate reasons the older decorator still exists.

## Interview questions

**★ You need to swap a root-provided service's implementation. Give three ways and say what each costs.**
First, `{provide: Svc, useClass: Other}` in `app.config.ts` — simple, but it builds a *new* instance for the token, so if anything also injects `Other` directly you now have two objects. Second, `Other` plus `{provide: Svc, useExisting: Other}` — one instance, two names, which is what you usually meant. Third, and often overlooked, `@Injectable({providedIn: 'root', useClass: Other, deps: […]})` on the original class itself: the record stays on the class, the scope stays root, and `app.config.ts` never grows a line, so the tree-shaking property survives. The third is right when the substitution is a permanent property of the service; the first two are right when it is a property of *this application's* configuration.

**★ `useClass` and `useExisting` look interchangeable. When are they not?**
Whenever the target is also reachable under its own token. `useClass` is a construction recipe — the injector instantiates the class fresh for this token and keeps that instance under this token. `useExisting` is an alias — the injector resolves the other token and returns whatever that produced. If `Other` is `@Service()` or is separately listed, `useClass` gives you two live objects with two independent states, and every symptom of that is a state bug rather than a DI error. `useExisting` is the safe default whenever the phrase in your head is "the same thing, under another name".

**★ Why does Angular guidance now prefer `inject()` inside a `useFactory` over `deps`?**
Because `deps` is positional and unchecked. The documentation is explicit that the factory is *"invoked with resolved values of `token`s in the `deps` field"*, in that order, and nothing type-checks the correspondence between that array and the function's parameters. Reordering the parameters, adding one, or deleting a `deps` entry produces a factory called with the wrong arguments and no diagnostic. `inject()` inside the factory body names each dependency at its use site, is fully typed, and cannot drift. The exception is `StaticProvider` — the shape `platformBrowser` and `Injector.create` take — which exists specifically for contexts without reflection, and there `deps` is required.

**★ When would you put the substitution on the class — `@Injectable({providedIn: 'root', useClass: Other})` — rather than in `ApplicationConfig.providers`?**
When the substitution is a property of the service rather than of this application's configuration. A common shape is a public abstract-ish token whose default implementation lives elsewhere: the token stays the thing consumers inject, the class carries the recipe, and no application has to know. The practical payoff is that the record stays on the class, so it keeps its `/*@__PURE__*/` annotation and its tree-shakability, and `app.config.ts` does not grow a line. Move it to the array the moment two builds need different answers — that is exactly when it has stopped being a property of the service.

← Prev: [What `'root'` resolves to](14c-what-root-resolves-to-and-the-other-scopes.md) · Index: [Topic index](README.md) · Next → [The inheritance trap](14e-the-inheritance-trap.md)
