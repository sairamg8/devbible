---
title: "A subclass of a root-provided service is not root-provided — `getInjectableDef` reads `ɵprov` with `Object.hasOwn` on purpose, and the one lookup that walks the prototype chain is deprecated and warns with no `NG` code"
sidebar_label: "14e · The inheritance trap"
sidebar_position: 14.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`: [`core/src/di/interface/defs.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/interface/defs.ts), [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts). Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**This one is short because the mechanism is one function, and it is here on its own because the symptom looks like a DI bug and is not.** Extending a `@Service()` class gives you a class with no provider record of its own. The lookup Angular actually uses is deliberately non-inherited; the lookup that is not is on its way out and announces itself with a `console.warn` carrying no error code, so it will not turn up in an error-code search.

## The inheritance trap — `ɵprov` is read with `Object.hasOwn`

A subclass of a root-provided service is **not** root-provided. From [`core/src/di/interface/defs.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/interface/defs.ts), verbatim:

```ts
export function getInjectableDef<T>(type: any): ɵɵInjectableDeclaration<T> | null {
  return getOwnDefinition(type, NG_PROV_DEF);
}

/**
 * Return definition only if it is defined directly on `type` and is not inherited from a base
 * class of `type`.
 */
function getOwnDefinition<T>(type: any, field: string): ɵɵInjectableDeclaration<T> | null {
  // if the ɵprov prop exist but is undefined we still want to return null
  return (Object.hasOwn(type, field) && type[field]) || null;
}
```

`Object.hasOwn`. `R3Injector` calls `getInjectableDef`, so a subclass with no decorator of its own has no def the injector will accept, and injecting it produces a not-found error rather than a silent second instance. There is a second, older path that *does* walk the prototype chain, and it is deprecated with a console warning — from the same file, verbatim:

```ts
/**
 * Read the injectable def (`ɵprov`) for `type` or read the `ɵprov` from one of its ancestors.
 *
 * @param type A type which may have `ɵprov`, via inheritance.
 *
 * @deprecated Will be removed in a future version of Angular, where an error will occur in the
 *     scenario if we find the `ɵprov` on an ancestor only.
 */
```

whose message text is, verbatim:

```ts
        console.warn(
          `DEPRECATED: DI is instantiating a token "${type.name}" that inherits its @Injectable decorator but does not provide one itself.\n` +
            `This will become an error in a future version of Angular. Please add @Injectable() to the "${type.name}" class.`,
        );
```

⚠️ It is `console.warn` inside `ngDevMode`, not a `RuntimeError`, so it carries **no `NG` code** and it does not appear in a production build at all. The fix is in the message: decorate the subclass.

```ts
import {Service} from '@angular/core';
import {NotificationService} from './notification-service';

@Service()                                  // ← the subclass needs its own decorator
export class LoudNotificationService extends NotificationService {}
```

## Gotchas

**★ Symptom: a subclass of a `@Service()` class throws a no-provider error.** Cause: `getInjectableDef` uses `Object.hasOwn`, so `ɵprov` is not inherited. The subclass has no provider record anywhere. Fix: decorate the subclass with its own `@Service()` — or list it in the array if it is not meant to be a root singleton.

**★ Symptom: a dev-mode console warning about a token that "inherits its @Injectable decorator but does not provide one itself", with no `NG` code and nothing in production.** Cause: `getInheritedInjectableDef` — the `@deprecated` sibling of `getInjectableDef` — found the def on an ancestor and warned before returning it. ⚠️ `R3Injector.get` calls `getInjectableDef`, not this one, so the warning reaches you through some other caller; I did not read those call sites and will not name them. What the warning *means* is settled by the function itself. Fix: exactly what the message says — add the decorator to the derived class. Do not search the error-code index; there is no code because it is a `console.warn`, not a `RuntimeError`.

**★ Symptom: you added `@Service()` to a base class *and* its subclass and now hold two singletons.** Cause: correct behaviour — they are two tokens. Each class gets its own `ɵprov`, each is root-provided, each materialises its own record in the application injector's map, and each gets its own instance. Fix: if they must be one object, decorate one and alias the other.

```ts
export const appConfig: ApplicationConfig = {
  providers: [{provide: NotificationService, useExisting: LoudNotificationService}],
};
```

## Interview questions

**★ A subclass of a `providedIn: 'root'` service is injected and fails. Explain the mechanism, not just the fix.**
`R3Injector` resolves an unknown token by calling `getInjectableDef`, which is `getOwnDefinition(type, NG_PROV_DEF)` and uses `Object.hasOwn` — deliberately, so an inherited `ɵprov` is not mistaken for the subclass's own. A subclass with no decorator therefore has no def, `injectableDefInScope` is never reached, and the walk ends at `NullInjector` with a no-provider error. Angular does still have a lookup that walks ancestors, but it is `@deprecated`, it emits a dev-only `console.warn` with no `NG` code, and its doc comment says the scenario will become an error. The fix is to decorate the subclass; the reason is that a provider record identifies a *token*, and a subclass is a different token.

**★ Why does `getInjectableDef` deliberately refuse an inherited `ɵprov`, when JavaScript would have given it to it for free?**
Because a provider record identifies a token, and a subclass is a different token. An inherited `ɵprov` still has `token: BaseClass` and a factory that constructs the base class, so honouring it would mean injecting `Derived` and receiving a `Base` — or, once the factory branch is taken into account, receiving something whose identity does not match what the caller asked for. `getOwnDefinition` uses `Object.hasOwn` precisely to make that impossible, and its comment says so: *"Return definition only if it is defined directly on `type` and is not inherited from a base class of `type`."* The older, prototype-walking lookup still exists for compatibility, but it is `@deprecated`, it warns in dev mode, and its doc comment states the scenario *"will become an error in a future version of Angular"*.

← Prev: [Overriding a root service](14d-overriding-a-root-provided-service.md) · Index: [Topic index](README.md) · Next → [Testing overrides](14f-testing-overrides.md)
