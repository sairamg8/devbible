---
title: "The decorator is the default and the array is the exception — `@Service()` compiles to a `providedIn: 'root'` record wrapped in `/*@__PURE__*/`, and every line you add to `ApplicationConfig.providers` is a static reference that guarantees the bundler cannot drop it"
sidebar_label: "14 · `providedIn: 'root'` vs the array"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev [Hierarchical injectors](https://angular.dev/guide/di/hierarchical-dependency-injection), [Creating and using services](https://angular.dev/guide/di/creating-and-using-services) — and `angular/angular` at tag `v22.1.5`: [`core/src/di/interface/service.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/interface/service.ts), [`core/src/di/service.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/service.ts), [`compiler/src/service_compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/service_compiler.ts), and the compliance goldens in [`compiler-cli/test/compliance/test_cases/service_decorator/`](https://github.com/angular/angular/tree/v22.1.5/packages/compiler-cli/test/compliance/test_cases/service_decorator); plus `angular/angular-cli` at tag `v22.1.7`: [`schematics/angular/service/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/service/schema.json). Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The rule is one sentence: a class that can declare where it lives should declare it, and everything else goes in the array.** Both routes end at the same singleton in the same injector, so people treat the choice as taste. It is not. The decorator writes a provider record onto the class as a `/*@__PURE__*/`-annotated static field, which a bundler is free to delete when nothing injects the class; a line in `ApplicationConfig.providers` is a static import in a file that is unconditionally reachable from `main.ts`, which is a bundler's definition of "keep". That is the whole difference, and it is the same reachability argument [02](02-why-provide-functions-replaced-forroot.md) made about `forRoot()`.

## What the CLI generates in v22, and what changed

`ng generate service` no longer emits `@Injectable`. From `angular/angular-cli` at `v22.1.7`, `packages/schematics/angular/service/schema.json`, verbatim:

```json
"injectable": {
  "type": "boolean",
  "default": false,
  "description": "When true, generates an `@Injectable` instead of `@Service`."
}
```

and the template it drives, `packages/schematics/angular/service/files/__name@dasherize__.__type@dasherize__.ts.template`, verbatim:

```ts
import { <%= injectable ? 'Injectable' : 'Service' %> } from '@angular/core';

<% if (injectable) { %>@Injectable({
  providedIn: 'root',
})<% } else { %>@Service()<% } %>
export class <%= classifiedName %> {
}
```

So the default output of the scaffolding tool is `@Service()`, and `@Injectable({providedIn: 'root'})` is now the `--injectable` opt-in. Neither one produces a line in `app.config.ts`. That is the CLI stating the rule by construction: **the generated service registers itself, and the generated `app.config.ts` never learns its name.**

## `@Service()` *is* `providedIn: 'root'` — one field apart

They are not analogous, they are the same record. From [`core/src/di/interface/service.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/interface/service.ts), verbatim:

```ts
export function ɵɵdefineService<T>(opts: {
  token: unknown;
  autoProvided?: boolean;
  factory: (parent?: Type<unknown>) => T;
}): ɵɵInjectableDeclaration<T> {
  return {
    token: opts.token,
    providedIn: opts.autoProvided === false ? null : 'root',
    factory: opts.factory,
    value: undefined,
  };
}
```

`autoProvided` is a boolean that is spelled `providedIn: 'root'` in the record and `providedIn: null` when you turn it off. angular.dev says the same thing in prose — from [Creating and using services](https://angular.dev/guide/di/creating-and-using-services), verbatim:

> *"The `@Service` decorator serves as a modern, ergonomic shorthand for the traditional `@Injectable({ providedIn: 'root' })` syntax."*

The decorator's own JSDoc, from [`core/src/di/service.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/service.ts), gives you the escape hatch in the same breath, verbatim:

> *"When `autoProvided` is set to `false`, the service won't be exposed to the dependency injection system automatically. It is up to the user to expose it in a providers list."*
>
> *"Creates a service that is automatically provided and uses the value returned from the `factory` function."*

## The compiled output, from Angular's own compliance goldens

These are the fixtures the compiler is tested against, in `packages/compiler-cli/test/compliance/test_cases/service_decorator/` at `v22.1.5`. They are the emitted JavaScript, quoted, not reconstructed — and they include the goldens' own `// ...` for members the test does not assert on.

`@Service({autoProvided: true})` — `explicitly_provided_service.js`, verbatim:

```js
export class MyService {
  static ɵfac = function MyService_Factory(__ngFactoryType__) { return new (__ngFactoryType__ || MyService)(); };
  static ɵprov = /*@__PURE__*/ $r3$.ɵɵdefineService({ token: MyService, factory: MyService.ɵfac });
}
```

`@Service({autoProvided: false})` — `not_provided_service.js`, verbatim:

```js
export class MyService {
  static ɵfac = function MyService_Factory(__ngFactoryType__) { return new (__ngFactoryType__ || MyService)(); };
  static ɵprov = /*@__PURE__*/ $r3$.ɵɵdefineService({ token: MyService, factory: MyService.ɵfac, autoProvided: false });
}
```

And the compiler only emits the field at all when it differs from the default — from [`compiler/src/service_compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/service_compiler.ts), verbatim:

```ts
  // Only generate providedIn property if it's different from the default.
  if (meta.autoProvided === false) {
    def.set('autoProvided', o.literal(false));
  }
```

## Why one of these tree-shakes and the other cannot

Look at where the provider record physically lives.

**With the decorator**, the record is `MyService.ɵprov`, a static field on the class, in the class's own file, wrapped in `/*@__PURE__*/`. That annotation is the contract with the bundler: this call has no side effects, so if the binding it initialises is never read, delete the whole thing. Nothing in the application's import graph mentions `MyService` unless somebody injects it. If nobody does, the module is unreachable from the entry point and the class, its `ɵfac`, its `ɵprov` and everything it imported go with it.

**With the array**, `app.config.ts` contains `import {MyService} from './my-service'` and a live reference to the identifier inside an exported object literal that `main.ts` passes to `bootstrapApplication`. That chain is reachable from the entry point unconditionally. The bundler cannot prove the reference is dead — it is not dead, the array holds it — so the class stays in the bundle whether or not a single component injects it.

angular.dev states the consequence directly. From [Hierarchical injectors](https://angular.dev/guide/di/hierarchical-dependency-injection), in a callout titled *"Tree-shaking and @Service()"*, verbatim:

> *"Using the `@Service()` decorator is preferable to using the `ApplicationConfig` `providers` array. With `@Service`, optimization tools can perform tree-shaking, which removes services that your application isn't using. This results in smaller bundle sizes."*
>
> *"Tree-shaking is especially useful for a library because the application which uses the library may not have a need to inject it."*

and enumerates what root provisioning buys, from [Creating and using services](https://angular.dev/guide/di/creating-and-using-services), verbatim:

> *"Services are provisioned at the root level by default. When a service is provided globally, Angular guarantees three main benefits:"*
>
> *"- **Singleton Instance:** Creates a single, shared instance for the entire application."*
>
> *"- **Global Availability:** Automatically accessible anywhere without manual provider registration."*
>
> *"- **Tree-shakability:** Ensures the service is excluded from the final production bundle if your code never explicitly uses it."*

🔴 **The second and third of those are in tension with the array in a way the first is not.** Listing a `@Service()` class in `ApplicationConfig.providers` does not give you two instances and does not break anything — it gives you exactly the singleton you already had, and quietly cancels benefit three. That is why the mistake survives code review: nothing observable changes.

## Gotchas

**★ Symptom: you added `@Service()` *and* listed the class in `ApplicationConfig.providers`, and everything works.** Cause: it does work — you get one instance, from the array's record. What you lost is silent: the array holds a static reference to the class from a file `main.ts` reaches unconditionally, so the `/*@__PURE__*/` annotation on `ɵprov` can never fire and the class ships even in a build where nothing injects it. Fix: delete the array line.

```ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    CartService,          // ⛔ delete — CartService is already @Service()
  ],
};
```

**★ Symptom: tree-shaking did not happen even though you used `@Service()` and nothing injects the class.** Cause: something else references it. A barrel `index.ts` that re-exports the whole feature and is imported for one other symbol; a `useExisting` in some other provider; a `deps: [ThatClass]`; a decorator metadata emit in a file that is itself reachable. The `/*@__PURE__*/` annotation only licenses removal of an *unreferenced* binding. Fix: import from the concrete module path rather than the barrel, and grep for the class name across the reachable graph.

**★ Symptom: a library you ship registers its service in the consumer's `app.config.ts` and consumers complain about bundle size.** Cause: exactly the case the documentation calls out — *"Tree-shaking is especially useful for a library because the application which uses the library may not have a need to inject it."* An array entry forces every consumer to ship it. Fix: `@Service()` on the class, and export a `provideX()` only for the configuration that genuinely needs an array, per [04](04-writing-your-own-provide-function.md).

**★ Symptom: you added a `factory` to `@Service()` and the class's type changed under you.** Cause: that is a different overload. Its return type is `<C extends Type<unknown> | AbstractType<unknown>>(target: C) => C extends Type<unknown> ? Type<T> : abstract new (...args: any[]) => T` — with a `factory`, the decorated symbol produces `T`, whatever the factory returned, not the class you wrote. Fix: have the factory return an instance of the class itself, or drop the factory and do the work in the class.

```ts
import {Service, inject} from '@angular/core';
import {API_BASE_URL} from './api-base-url';

@Service({factory: () => new ApiClient(inject(API_BASE_URL))})
export class ApiClient {
  constructor(readonly baseUrl: string) {}
}
```

**★ Symptom: you decompiled a `@Service()` class and cannot find `providedIn` anywhere in the output.** Cause: the compiler emits the field only when it differs from the default — *"Only generate providedIn property if it's different from the default"* — so a plain `@Service()` produces `ɵɵdefineService({token, factory})` with no scope in the literal, and `ɵɵdefineService` supplies `providedIn: 'root'` at runtime. Fix: read `ɵɵdefineService`, not the emitted object. Its absence means root, and `autoProvided: false` is the only thing you will ever see written out.

## Interview questions

**★ `@Service()` and listing the class in `ApplicationConfig.providers` both give you one instance in the application injector. Why is the decorator preferred?**
Because of where the provider record physically lives, and therefore what a bundler can prove. The decorator compiles to a `/*@__PURE__*/`-annotated `ɵprov` static on the class itself, in the class's own module; the record travels with the code and is only found when someone injects the class. If nobody does, nothing in the import graph names the class and the whole module is dropped. The array puts a live reference to the class inside an object literal in `app.config.ts`, which `main.ts` reaches unconditionally, so the reference is provably alive and the class ships regardless. The documentation says the same thing in one sentence: *"With `@Service`, optimization tools can perform tree-shaking, which removes services that your application isn't using."* Nothing observable changes at runtime, which is exactly why the redundant array entry survives review.

**★ You inherit a 40-line `app.config.ts`. Which entries do you delete first, and what evidence tells you it is safe?**
Bare class names — `providers: [CartService, OrdersService, TelemetryService]`. For each, open the class: if it carries `@Service()` or `@Injectable({providedIn: 'root'})`, the array entry is redundant and deleting it changes nothing at runtime while restoring tree-shakability. If it carries `@Injectable()` with no arguments or `@Service({autoProvided: false})`, the entry is load-bearing and must stay, or the class must be converted. The evidence is the decorator, not the behaviour — behaviour is identical either way, which is the entire reason this needs checking by hand.

**★ Why does the CLI's `service` schematic default to `@Service()` and offer `@Injectable` behind a flag, rather than the other way round?**
Because the common case is a root singleton with no provider keys and no constructor injection, and for that case `@Service()` is strictly shorter with identical semantics — `ɵɵdefineService` maps it to `providedIn: 'root'` in the record. The flag exists because `@Injectable` is strictly more expressive: it is the only one of the two that can say `'platform'`, `useClass`, `useFactory`, `deps`, or accept a parameterised constructor. Defaulting to the smaller surface and escalating on demand is the same design as `provide*()` functions defaulting to zero features with `with*()` opt-ins.

**★ What does the `/*@__PURE__*/` in front of `ɵɵdefineService` actually license a bundler to do?**
It is an assertion that the call has no observable side effects, which is what lets a minifier delete the whole `static ɵprov = …` initialiser when the binding it feeds is never read. Without it a bundler must assume that calling `ɵɵdefineService` might do something — mutate a registry, touch a global — and keep it, which would keep the class, which would keep everything the class imports. The annotation is why "the provider record lives on the class" is a bundle-size claim and not just an architectural one. Note it is present on **both** `@Service()` and `@Service({autoProvided: false})` output: the annotation is about the call, not about the scope.

{/* FOOTER */}
