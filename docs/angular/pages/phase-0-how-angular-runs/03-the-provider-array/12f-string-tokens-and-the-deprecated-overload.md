---
title: "A string provider key has no type, no namespace and no supported accessor — its only documented retrieval path is an `Injector.get` overload Angular deprecated in v4 and has carried unchanged for eighteen majors"
sidebar_label: "12f · String tokens"
sidebar_position: 12.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts)
> (`Injector.get`'s deprecated overload, quoted verbatim),
> [`core/src/di/injection_token.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/injection_token.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`{provide: 'API_URL', useValue: 'https://api.example.com'}` is the single most common entry in a
long `app.config.ts` that has no defence at all.** It is not merely untyped — it is keyed in a
global namespace nobody owns, and the accessor Angular documents for it has been deprecated since
version 4. This is a short chunk because the argument is short: there is no case where a string key
is better than an `InjectionToken`, and the migration is mechanical.

## The type is `any` and the retrieval path is deprecated

A string key still works — a `Map` does not care what its keys are — but the only retrieval API the
framework documents for one is an overload it deprecated eighteen major versions ago. From
[`r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts),
verbatim:

```ts
  /**
   * @deprecated from v4.0.0 use ProviderToken<T>
   * @suppress {duplicate}
   */
  abstract get<T>(token: string | ProviderToken<T>, notFoundValue?: any): any;
```

Read the return type: **`any`**, not `T`. The type parameter is present on the signature and does
nothing for the string branch, because there is nothing to infer from — a string carries no type
information. So every consumer of a string-keyed provider either casts or silently accepts `any`,
and a change to the shape of the value produces no compile error anywhere in the application.

```ts
// before — nothing checks this, and nothing will
const flags = inject(Injector).get('FEATURE_FLAGS');
if (flags.newCheckout) { /* a typo here compiles fine */ }

// after — the token carries the type
const flags = inject(FEATURE_FLAGS);
if (flags.newCheckout) { /* a typo here is a compile error */ }
```

⚠️ **I did not verify whether the `inject()` function accepts a bare string in v22**; its public
signature is expressed in terms of `ProviderToken<T>`, and I found no sentence settling the string
case. The deprecated path that certainly exists is the `Injector.get` overload above. Either way
the conclusion is unchanged, and it is not a style preference: a string token has no type, and its
documented accessor has been deprecated since Angular 4.

## The second problem: the namespace is global and unowned

An `InjectionToken`'s identity is its object reference, so two tokens described `'API_URL'` in two
libraries are two distinct keys ([12e](12e-untyped-values-and-string-tokens.md) quotes the
Important Note that says so). A **string** token's identity *is* the string. Two libraries — or two
teams in one monorepo — that both choose `'API_URL'` are providing the same token, and the rules of
[12b](12b-collisions-multi-tokens-and-the-triage-order.md) apply in full: last non-multi
registration wins, silently, with the winner decided by array order in a file neither team owns.

That is the failure that has no diagnostic at all. A missing provider at least throws `NG0201`. A
colliding string key produces a value of the wrong shape, injected successfully, in a part of the
application that never referenced the other library.

## The migration, mechanically

```ts
// before — app.config.ts and a consumer somewhere
providers: [{provide: 'API_URL', useValue: 'https://api.example.com'}]

@Injectable({providedIn: 'root'})
export class OrdersClient {
  constructor(@Inject('API_URL') private readonly baseUrl: string) {}
}
```

```ts
// after — api.tokens.ts
export const API_URL = new InjectionToken<string>(ngDevMode ? 'API_URL' : '');

// app.config.ts — the entry stays, because a URL has no sensible default
providers: [{provide: API_URL, useValue: 'https://api.example.com'}]

// orders-client.ts
@Injectable({providedIn: 'root'})
export class OrdersClient {
  private readonly baseUrl = inject(API_URL);
}
```

Three things changed and all three are the point. The provider key is now an object with a type
parameter, so `useValue: 42` at the call site is a compile error. The consumer's `baseUrl` is
`string` by inference rather than by a `@Inject` annotation whose argument nothing validates. And
the key is scoped to whatever module exports it, so no other package can collide with it.

Do this migration **before** the rest of triage step four, not after: a string key is the one form
where the compiler cannot help you find the consumers, so the earlier you convert, the more of the
remaining work the type checker does for you.

## Gotchas

**★ Symptom: you changed a config object's shape and nothing broke at compile time, then a screen
crashed at runtime.** Cause: the value was provided under a string key, so every consumer got `any`
from `Injector.get`. Fix: a typed `InjectionToken<T>` where `T` is a declared interface — the
*"additional level of type safety"* the `InjectionToken` doc comment names is the entire point of
the class, and it is the only mechanism that makes a config change a compile error.

**★ Symptom: a value injected under a string key is suddenly the wrong shape after adding a
dependency.** Cause: a string key is a global namespace entry. The new package provides the same
string, and last registration wins. Fix: convert to an `InjectionToken`, which cannot collide
across packages because identity is object identity. There is no way to make a string key safe;
there is only the conversion.

**★ Symptom: `@Inject('API_URL')` compiles but the injected value is `undefined`.** Cause: nothing
checks the spelling of a string token at either end — the provider might be `'API_URL '` with a
trailing space, or `'apiUrl'`, and the compiler has no opinion. Fix: an `InjectionToken` makes the
mismatch an unresolved-import error at the exact line, which is the difference between a five-second
fix and an afternoon.

**★ Symptom: your editor greys out `injector.get('SOME_KEY')` with a deprecation strikethrough.**
Cause: that is the `get<T>(token: string | ProviderToken<T>, notFoundValue?: any): any` overload,
tagged `@deprecated from v4.0.0 use ProviderToken<T>`. Fix: convert the token. ⚠️ Do not silence it
with a cast to `ProviderToken<T>` — the deprecation is about the string branch, and casting it away
keeps every problem the deprecation exists to flag.

**★ Symptom: a string-keyed provider works in the application and cannot be overridden cleanly in a
test.** Cause: overriding it requires reproducing the exact same string literal in the test file,
so the test and the production code share nothing the compiler can check, and a rename in one place
silently stops overriding. Fix: import the same exported token object in both.

## Interview questions

**★ `{provide: 'API_URL', useValue: 'https://…'}` works. Why change it?**
Three reasons, in increasing order of importance. It is untyped: the only documented way to retrieve
a string-keyed provider is `Injector.get<T>(token: string | ProviderToken<T>)`, whose return type is
`any`, so every consumer either casts or accepts `any`, and a change to the value's shape produces
no compile error anywhere. That overload has carried the tag
`@deprecated from v4.0.0 use ProviderToken<T>`
for eighteen major versions, so you are building on a path the framework has been signposting away
from for most of its life. And the key is global and unnamespaced — two libraries
that both pick `'API_URL'` collide silently, with last-one-wins semantics and no diagnostic. A typed
`InjectionToken<string>` fixes all three, costs one exported constant, and usually removes the
providers entry too if you give it a factory.

**★ Angular deprecated the string overload in v4 and it is still there in v22. What should you take
from that?**
That deprecation in Angular is a statement about intent, not an execution schedule, and that a
`@deprecated` tag is a stronger design signal than a removal date. The overload survives because
removing it would break every application that still uses a string key, and the cost of carrying one
extra signature is near zero. But the tag has been present for the entire life of Ivy, standalone
components, signals and the `provide*` convention — no part of modern Angular is designed around
string tokens, and none of the framework's own tokens is one. Practically: do not read "it still
compiles" as "it is still supported", and do not wait for the removal to migrate, because the
migration gets harder as the number of untyped consumers grows.

**★ How is a string-key collision different from any other duplicate provider, and why is it
worse?**
Mechanically it is not different at all — it is `this.records.set(token, record)` running twice,
last one wins, exactly as for any non-multi token. It is worse because of who can cause it and
whether anyone can see it. An `InjectionToken` collision requires two registrations of the *same
exported object*, which means somebody imported it, which means it is greppable and usually
intentional. A string collision requires only that two independent authors picked the same word,
which is likely for `'API_URL'`, `'CONFIG'` or `'ENVIRONMENT'`, and there is nothing to grep —
neither side references the other. So the same mechanism produces a bug with no import edge
connecting cause and effect, which is about the hardest shape of bug to find.

{/* FOOTER */}
