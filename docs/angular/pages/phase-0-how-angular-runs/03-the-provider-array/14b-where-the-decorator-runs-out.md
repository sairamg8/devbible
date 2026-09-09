---
title: "Where the decorator runs out — the two rows of the comparison table that are hard `No`s, the migration schematic's refusal rules read as a specification, and the seven cases where `ApplicationConfig.providers` is the correct answer"
sidebar_label: "14b · Where the decorator runs out"
sidebar_position: 14.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev [Creating and using services](https://angular.dev/guide/di/creating-and-using-services) — and `angular/angular` at tag `v22.1.5`: [`core/schematics/ng-generate/service-migration/migration.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/ng-generate/service-migration/migration.ts), [`core/src/di/service.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/service.ts), [`core/src/di/interface/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/interface/provider.ts). Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The rule in [14](14-providedin-root-vs-the-array.md) has an exception list, and it is short, closed and mechanical — which is exactly what makes it usable in review.** Angular ships the boundary twice over: once as a published comparison table with two hard `No`s in it, and once as executable code, in the migration schematic that converts `@Injectable` to `@Service` and *refuses* every case the decorator cannot express. Read the refusal rules as a specification and you have a decision procedure that needs no judgement. What is left over — seven cases — is the legitimate content of `ApplicationConfig.providers`.

## What `@Service()` cannot express

angular.dev publishes the comparison as a table. Reproduced verbatim from [Creating and using services](https://angular.dev/guide/di/creating-and-using-services):

| Feature / Requirement | `@Service` | `@Injectable` |
| --- | --- | --- |
| **`inject()` function support** | Yes | Yes |
| **Constructor-based DI** | ❌ No | Yes |
| **Implicit root singleton provider** | Yes | ❌ No (requires `{providedIn: 'root'}`) |
| **Advanced provider keys (`useClass`, etc.)** | ❌ No | Yes |
| **Custom initialization factories** | Yes | Yes |
| **Non-root scopes (`platform`, etc.)** | ❌ No | Yes |

Two rows are worth reading twice. **Constructor-based DI is a hard No** — `@Service()` classes take their dependencies through `inject()`, full stop. And **non-root scopes are a hard No**, which means the moment you need `providedIn: 'platform'`, you are back on `@Injectable`. The `Service` metadata interface has exactly two optional fields and neither of them is a scope:

```ts
export interface Service {
  autoProvided?: boolean;
  factory?: () => unknown;
}
```

## The migration schematic draws the boundary for you

`ng generate @angular/core:service-migration` converts `@Injectable` to `@Service` and, usefully, **refuses the cases the decorator cannot express**. Its analysis, from [`core/schematics/ng-generate/service-migration/migration.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/schematics/ng-generate/service-migration/migration.ts), verbatim:

```ts
  // We can't migrate if the class is using constructor DI.
  if (usesConstructorDI(node, typeChecker)) {
    return analysis;
  } else if (decoratorArgs.length === 0) {
    analysis.canMigrate = true;
    return analysis;
  } else if (decoratorArgs.length !== 1 || !ts.isObjectLiteralExpression(decoratorArgs[0])) {
    return analysis;
  }

  for (const prop of decoratorArgs[0].properties) {
    // We can't migrate if there's any other property than `providedIn`.
    if (
      !ts.isPropertyAssignment(prop) ||
      (!ts.isIdentifier(prop.name) && !ts.isStringLiteralLike(prop.name)) ||
      prop.name.text !== 'providedIn'
    ) {
      analysis.canMigrate = false;
      return analysis;
    }

    // We can only migrate if `providedIn` is set to `root`.
    if (ts.isStringLiteralLike(prop.initializer) && prop.initializer.text === 'root') {
      analysis.providedInRoot = true;
    } else {
      // Otherwise we can't migrate it either.
      analysis.canMigrate = false;
      return analysis;
    }
  }
```

Read as a specification, that is: **migrate if there is no constructor with parameters (on this class or any base class), and either no decorator argument at all, or exactly `{providedIn: 'root'}`.** Anything else — `'platform'`, `'any'`, an `NgModule` type, a `useClass`, a `useFactory`, a `deps` — is left alone.

And note the output for the no-argument case, verbatim from the same file:

```ts
          tracker.replaceText(
            sourceFile,
            decorator.node.getStart(),
            decorator.node.getWidth(),
            `@Service(${analysis.providedInRoot ? '' : '{ autoProvided: false }'})`,
          );
```

A bare `@Injectable()` becomes `@Service({autoProvided: false})`, because a bare `@Injectable()` was never root-provided either — it is the "I have DI metadata, put me in an array" form, and `autoProvided: false` is its exact translation.

`usesConstructorDI` walks base classes too:

```ts
function usesConstructorDI(node: ts.ClassDeclaration, typeChecker: ts.TypeChecker): boolean {
  const baseClasses = [node, ...findBaseClassDeclarations(node, typeChecker).map((c) => c.node)];

  for (const current of baseClasses) {
    const constructorNode = current.members.find(
      (member): member is ts.ConstructorDeclaration =>
        ts.isConstructorDeclaration(member) && !!member.body,
    );

    if (constructorNode) {
      return constructorNode.parameters.length > 0;
    }
  }

  return false;
}
```

## When you still need the array — the seven cases, in code

The decorator covers the common case. These are the ones it structurally cannot, and each is a legitimate line in `app.config.ts`.

**1 · You do not own the class.** You cannot add a decorator to a type from `node_modules`.

```ts
import {ApplicationConfig} from '@angular/core';
import {ThirdPartyAnalytics} from 'some-vendor-sdk';

export const appConfig: ApplicationConfig = {
  providers: [ThirdPartyAnalytics],
};
```

**2 · You are overriding a framework default.** The canonical case is `ErrorHandler`, which deliberately carries no `providedIn` — see [06g](06g-error-handler-and-ng0402.md).

```ts
import {ApplicationConfig, ErrorHandler} from '@angular/core';
import {SentryErrorHandler} from './sentry-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [{provide: ErrorHandler, useClass: SentryErrorHandler}],
};
```

**3 · The thing is not a class.** A configuration object, a URL, a function — there is no class to decorate, so there is a token and a value.

```ts
import {ApplicationConfig, InjectionToken} from '@angular/core';

export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');

export const appConfig: ApplicationConfig = {
  providers: [{provide: API_BASE_URL, useValue: 'https://api.example.com'}],
};
```

⚠️ An `InjectionToken` created **with** a factory is already root-provided by that factory and needs no array entry at all — that is the shape [11g](11g-the-standalone-core-providers.md) dissects on `IDLE_SERVICE`, and re-providing it in the array is case 2, not case 3.

**4 · The value is an `EnvironmentProviders`.** Every `provide*()` function returns one, and by construction it can only be spread into an `Array<Provider | EnvironmentProviders>` — the type is the argument, as [03](03-environmentproviders-vs-provider.md) sets out in full.

```ts
import {ApplicationConfig} from '@angular/core';
import {provideRouter} from '@angular/router';
import {provideHttpClient} from '@angular/common/http';
import {routes} from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes), provideHttpClient()],
};
```

**5 · It is a multi-provider.** A class cannot declare itself into a `multi: true` token; contributing to one is an act of the array.

```ts
import {ApplicationConfig, APP_INITIALIZER} from '@angular/core';
import {ConfigLoader} from './config-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: (loader: ConfigLoader) => () => loader.load(),
      deps: [ConfigLoader],
    },
  ],
};
```

**6 · You want a non-root scope.** `providedIn: 'platform'` is not reachable from `ApplicationConfig` at all, and per-feature lifetime belongs on a route — both covered next in [14c](14c-what-root-resolves-to-and-the-other-scopes.md).

**7 · `@Service()` cannot express the shape.** Constructor DI, `useClass`, `useExisting`, a non-root scope. Either drop back to `@Injectable` with provider options — shown in [14d](14d-overriding-a-root-provided-service.md) — or say so explicitly and take the array:

```ts
import {Service} from '@angular/core';

@Service({autoProvided: false})
export class ReportBuilder {}
```

```ts
import {ApplicationConfig} from '@angular/core';
import {ReportBuilder} from './report-builder';

export const appConfig: ApplicationConfig = {
  providers: [ReportBuilder],
};
```

That pairing is worth preferring over a bare undecorated class: `autoProvided: false` is a *statement* that the omission is deliberate, and it still gives the class a `ɵfac` and a `ɵprov`, so nothing about injection changes.

## Gotchas

**★ Symptom: you deleted the array line and now something is undefined at runtime.** Cause: the class was not actually root-provided — it is `@Injectable()` with no arguments, or `@Service({autoProvided: false})`, both of which compile to `providedIn: null` and are found by no injector on their own. Fix: pick one. Either make it root-provided, or keep the array entry.

```ts
// before: @Injectable() — not root-provided, needs the array
@Service()                // after: root-provided, array entry can go
export class CartService {}
```

**★ Symptom: `@Service()` on a class with a constructor that takes dependencies, and the compiler or the migration refuses it.** Cause: the comparison table's second row — constructor-based DI is `❌ No` for `@Service`. Fix: move the dependencies to `inject()`.

```ts
import {Service, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';

@Service()
export class CartService {
  private readonly http = inject(HttpClient);
}
```

**★ Symptom: `@Service({useClass: OtherThing})` does not type-check.** Cause: `Service`'s metadata interface has two fields, `autoProvided` and `factory`. `useClass`, `useExisting`, `useValue` and `deps` belong to `@Injectable`'s `InjectableProvider` union. Fix: use `@Injectable` with the provider key, which keeps `providedIn: 'root'` — see [14d](14d-overriding-a-root-provided-service.md).

**★ Symptom: `ng generate @angular/core:service-migration` left half your services on `@Injectable` and reported no error.** Cause: by design. It migrates only a class with no parameterised constructor (its own or an inherited one) and either no decorator argument or exactly `{providedIn: 'root'}`. `'platform'`, `'any'`, a module type, or any extra property is a deliberate skip. Fix: read the skips as a to-do list — each one is a class that genuinely needs `@Injectable`, or a constructor that wants converting to `inject()` first.

**★ Symptom: the migration turned `@Injectable()` into `@Service({autoProvided: false})` and you expected `@Service()`.** Cause: correct translation. A bare `@Injectable()` was never root-provided; it only produced DI metadata for a class you were going to list in a providers array. Fix: nothing — but if the class *should* be a root singleton, this is the moment to make it `@Service()` and delete its array entry.

**★ Symptom: an `InjectionToken` created with a factory stopped using its default, and nobody remembers overriding it.** Cause: somebody added `{provide: THE_TOKEN, useValue: …}` to the array. A token built as `new InjectionToken<T>('desc', {factory: …})` is *already* root-provided by that factory, so the array entry is not a registration — it is an override, and the record wins by the same map-first rule as everything else. Fix: delete the entry if the default was correct; keep it and say so in a comment if the override is deliberate.

```ts
export const RETRY_LIMIT = new InjectionToken<number>('RETRY_LIMIT', {factory: () => 3});

export const appConfig: ApplicationConfig = {
  providers: [
    {provide: RETRY_LIMIT, useValue: 5},   // deliberate override of the token's own default
  ],
};
```

## Interview questions

**★ Name four things that cannot use `providedIn` and must be listed in the array.**
An override of an existing token — `{provide: ErrorHandler, useClass: MyHandler}` — because the thing being replaced already has a record and only a provider entry can beat it. A non-class token: an `InjectionToken` for a URL, a config object or a function, where there is no class to decorate. A multi-provider contribution: a class cannot declare itself into `APP_INITIALIZER` or `HTTP_INTERCEPTORS`, because `multi: true` lives on the provider entry, not on the injectable. And anything typed `EnvironmentProviders` — every `provide*()` return value — which by construction is only accepted by an `Array<Provider | EnvironmentProviders>`. A fifth, if you want it: a class you do not own and therefore cannot decorate.

**★ What is `@Service({autoProvided: false})` for, given that omitting the decorator entirely also leaves the class out of the root injector?**
Two things. Mechanically, it still emits `ɵfac` and `ɵprov` — the class is a proper injectable with a factory, just with `providedIn: null` — so it can be listed in a providers array as a bare type and Angular knows how to construct it. Editorially, it converts an absence into a statement: a reader can tell the class is deliberately not a root singleton rather than that somebody forgot the decorator. The migration schematic relies on that reading, which is why it translates a bare `@Injectable()` into `@Service({autoProvided: false})` and not into `@Service()`.

**★ A team standard says "every provider goes in `app.config.ts` so configuration lives in one place". Argue against it.**
The premise is good and the implementation defeats itself. `app.config.ts` is imported by `main.ts` unconditionally, so every identifier it names is reachable from the entry point and every class it names ships — including the ones this build never injects. You have bought discoverability with bundle size, and you pay it on every route, including the landing page. The better version of the same instinct is: *configuration* lives in one place, *registration* lives on the thing being registered. Feature configuration becomes one `provideFeature()` call, per-feature services move to that feature's route, and a plain root singleton keeps its own record on its own class. The array then reads as a list of decisions rather than a manifest of classes, which is more discoverable, not less.

{/* FOOTER */}
