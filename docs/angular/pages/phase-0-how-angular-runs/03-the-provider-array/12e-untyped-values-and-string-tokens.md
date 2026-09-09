---
title: "Triage step four: the entries that are not misplaced but mis-shaped — a typed `InjectionToken` is the only place a non-class value's type can live, and a token with a default factory needs no array entry at all"
sidebar_label: "12e · Untyped values and typed tokens"
sidebar_position: 12.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/di/injection_token.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/injection_token.ts)
> (doc comment, quoted verbatim),
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts)
> (`Injector.get`'s deprecated overload),
> [`core/src/di/null_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/null_injector.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every other triage step moves a correct entry to a better place. This one is different: a
`{provide: SOMETHING, useValue: {...}}` entry is usually not in the wrong file, it is in the wrong
shape.** The value it provides has no type anywhere, because the only place a non-class value's
type can live is the token it is keyed by. Replacing an untyped entry with a typed
`InjectionToken<T>` puts the type back, and in the common case where the token gets a default
`factory` it removes the array entry altogether — which is why this step is worth doing even when
the untyped version "works". The string-keyed variant of the same problem is a category of its own
and is [12f](12f-string-tokens-and-the-deprecated-overload.md).

## What `InjectionToken` is actually for

From the doc comment in
[`injection_token.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/injection_token.ts),
verbatim:

> *"Use an `InjectionToken` whenever the type you are injecting is not reified (does not have a
> runtime representation) such as when injecting an interface, callable type, array or parameterized
> type."*
>
> *"`InjectionToken` is parameterized on `T` which is the type of object which will be returned by
> the `Injector`. This provides an additional level of type safety."*

That first sentence is the test, and it is broader than people expect. A class is *reified* — it
exists at runtime and can be its own token. An interface is not. A `string`, a `boolean`, a
`Record<string, boolean>` of feature flags, a function, an array of handlers: none of them are, so
each one of them needs a token, and the token is the only place their type can live.

```ts
// before — app.config.ts
providers: [
  {provide: 'API_URL', useValue: 'https://api.example.com'},
  {provide: 'FEATURE_FLAGS', useValue: {newCheckout: true, betaSearch: false}},
  {provide: 'RETRY_COUNT', useValue: 3},
]
```

```ts
// after — app.tokens.ts, one file, exported once
export interface FeatureFlags {
  readonly newCheckout: boolean;
  readonly betaSearch: boolean;
}

export const API_URL = new InjectionToken<string>(ngDevMode ? 'API_URL' : '');

export const FEATURE_FLAGS = new InjectionToken<FeatureFlags>(
  ngDevMode ? 'FEATURE_FLAGS' : '',
  {factory: () => ({newCheckout: false, betaSearch: false})},
);

export const RETRY_COUNT = new InjectionToken<number>(ngDevMode ? 'RETRY_COUNT' : '', {
  factory: () => 3,
});

// app.config.ts — only the one with no sensible default survives
providers: [{provide: API_URL, useValue: 'https://api.example.com'}]
```

Two of the three entries disappeared, and the consumer changed from `inject(FLAGS) as FeatureFlags`
to `inject(FEATURE_FLAGS)` returning `FeatureFlags` with no cast.

The `ngDevMode ? 'API_URL' : ''` description is the framework's own idiom — `IDLE_SERVICE` is
declared exactly that way ([11g](11g-the-standalone-core-providers.md)). The description is only
ever used to build error messages, which production does not produce in full, so the ternary keeps
a readable name in development and drops the string literal from the production bundle.

## A token with a `factory` is already provided

This is the sentence that removes the array entry. From the same doc comment, verbatim:

> *"When creating an `InjectionToken`, you can optionally specify a factory function which returns
> (possibly by creating) a default value of the parameterized type `T`. This sets up the
> `InjectionToken` using this factory as a provider as if it was defined explicitly in the
> application's root injector."*
>
> *"As mentioned above, `'root'` is the default value for `providedIn`."*

So `RETRY_COUNT` above is **root-provided by its own declaration**. Listing it in
`app.config.ts` as well is not an error — the array entry wins, because the array is registered
last ([12b](12b-collisions-multi-tokens-and-the-triage-order.md)) — but it is redundant unless you
are deliberately overriding the default, and it reintroduces the static reference the factory form
exists to avoid. The framework relies on this everywhere: `ZONELESS_ENABLED`, `INITIAL_NAVIGATION`,
`HTTP_INTERCEPTOR_FNS` and `IDLE_SERVICE` are all tokens with default factories, and none of them
needs a providers entry until you want to change it.

⚠️ **`providedIn: 'any'` and `providedIn: NgModule` are deprecated for tokens.** From the same doc
comment, verbatim:

> *"Additionally, if a `factory` is specified you can also specify the `providedIn` option, which
> overrides the above behavior and marks the token as belonging to a particular `@NgModule` (note:
> this option is now deprecated). As mentioned above, `'root'` is the default value for
> `providedIn`."*
>
> *"The `providedIn: NgModule` and `providedIn: 'any'` options are deprecated."*

⚠️ **Be precise about the scope of that deprecation.** Those sentences are in `InjectionToken`'s
doc comment. The `Injectable` decorator's own typing in the public-API golden at `v22.1.5` is
`providedIn?: Type<any> | 'root' | 'platform' | 'any' | null;` and carries **no** deprecation
marker, so *"`providedIn: 'any'` is deprecated on `@Injectable` too"* is a claim this page cannot
settle. Written accurately: it is deprecated for `InjectionToken`, and the `Injectable` typing does
not mark it.

## Use the same token instance — and the stale error name in the warning itself

Also verbatim, and worth reading twice:

> *"**Important Note**: Ensure that you use the same instance of the `InjectionToken` in both the
> provider and the injection call. Creating a new instance of `InjectionToken` in different places,
> even with the same description, will be treated as different tokens by Angular's DI system,
> leading to a `NullInjectorError`."*

A token's identity is the **object**, not the string. Two `new InjectionToken<string>('API_URL')`
calls in two files are two different keys that print the same name in the error message, which is
about the most confusing diagnostic the DI system can produce. The fix is structural: declare each
token once, export it from one module, and never construct one inside a function.

```ts
// wrong — a new token object on every call, and the provider's is not the consumer's
export function apiUrlToken() {
  return new InjectionToken<string>('API_URL');
}

// right — one instance, exported once
export const API_URL = new InjectionToken<string>(ngDevMode ? 'API_URL' : '');
```

🔴 **Note what that Important Note says the error will be: `NullInjectorError`. It will not.** There
is no `NullInjectorError` class in `@angular/core` at `v22.1.5`. `NullInjector.get` builds its error
with `createRuntimeError(message, RuntimeErrorCode.PROVIDER_NOT_FOUND)` and then sets
`error.name = 'ɵNotFound'`; the code is `NG0201` and the dev-mode message is
``No provider found for `API_URL`.`` The stale name survives in the framework's own doc comment,
not only on the website — which is the clearest possible evidence that searching for
`NullInjectorError` is not how you debug this in v22. **16 · The injector error surface** *(not
written yet)* is the chunk that works through the current message and its three causes.

## Gotchas

**★ Symptom: two places inject "the same" token and one of them throws `NG0201` with a message
naming a token you can plainly see is provided.** Cause: two `new InjectionToken` instances with
the same description string — the doc comment's Important Note. The error prints the description,
so both tokens look identical in the message. Fix: export one `const` from one module and import it
in both places; never construct a token inside a function or a class body.

**★ Symptom: you searched the source for `NullInjectorError` because a doc comment told you to, and
found nothing.** Cause: the string is stale in Angular's own `InjectionToken` doc comment and on the
DI troubleshooting guide. The v22 error's `name` is `ɵNotFound` and its code is `NG0201`. Fix:
search for `NG0201` or `ɵNotFound`; see [16 · The injector error surface](16-the-injector-error-surface.md).

**★ Symptom: a token with a default `factory` is also listed in `app.config.ts`, and a reviewer
asks whether that is wrong.** Cause: it is redundant rather than wrong — the factory already
provides it in the root injector *"as if it was defined explicitly"*, and the array entry simply
wins because it is registered later. Fix: delete the entry unless it is deliberately overriding the
default, in which case leave it and make the override obvious:

```ts
// redundant — the token already defaults to 3
providers: [{provide: RETRY_COUNT, useValue: 3}]

// deliberate — reads as an override because the value differs and is named
providers: [{provide: RETRY_COUNT, useValue: environment.retries}]
```

**★ Symptom: `providedIn: 'any'` on an `InjectionToken` is flagged as deprecated by your editor.**
Cause: the doc comment states it — *"The `providedIn: NgModule` and `providedIn: 'any'` options are
deprecated."* Fix: use the default `'root'`, or drop `providedIn` entirely and let the `factory`
imply it. If you genuinely needed per-injector instances, that is a route or component scope
question ([12d](12d-lifetime-is-the-whole-question.md)), not a `providedIn` value.

**★ Symptom: a token declared next to the component that consumes it creates a circular import.**
Cause: the token's module imports the component's module for a type, and the component imports the
token. Fix: put tokens in their own leaf file with no imports other than types — `app.tokens.ts` or
`billing/billing.tokens.ts`. This is also why exporting the token from a barrel is a bad idea: the
barrel drags in everything else in the directory.

**★ Symptom: two features mutate the same `useValue` config object and see each other's changes.**
Cause: `useValue` provides the *same object reference* to every consumer; nothing copies or freezes
it. Fix: declare the interface's fields `readonly`, and if the value must be per-consumer, use
`useFactory` so each injector that registers it builds its own:

```ts
export interface FeatureFlags {
  readonly newCheckout: boolean;
}

// one shared, immutable-by-convention value
providers: [{provide: FEATURE_FLAGS, useValue: {newCheckout: true}}]
```

**★ Symptom: a library's token has a default `factory` and your override in `app.config.ts` is
ignored in one part of the application.** Cause: something is resolving the token from an injector
that does not see your entry — a platform-level consumer, or a child injector created before
bootstrap. Fix: check which injector the consumer runs in before assuming the override is broken;
the root array only beats the token's own factory for consumers resolving through the root
injector.

**★ Symptom: `inject(SOME_TOKEN)` returns `undefined` instead of throwing.** Cause: the token was
declared with a `factory` returning `undefined`, or the call passed `{optional: true}`. A token with
a factory never reaches the `NullInjector`, so the missing-provider error you were expecting cannot
happen. Fix: make the factory throw or return a real default, so "not configured" is a loud failure
rather than a value that propagates.

## Interview questions

**★ A token is declared with a default `factory`. Do you still need an entry in the providers
array?**
No, and that is the point of the form. The doc comment says the factory *"sets up the
`InjectionToken` using this factory as a provider as if it was defined explicitly in the
application's root injector"*, and `'root'` is the default `providedIn`. So the token is provided by
its own declaration, tree-shakably: an application that never injects it has no import path to it
and drops it entirely. You add an array entry only to override the default, and then the entry
wins because the application's providers are registered last. The framework uses this shape for its
own defaults throughout — `ZONELESS_ENABLED`, `INITIAL_NAVIGATION`, `IDLE_SERVICE` — which is the
strongest available argument that it is the intended default pattern rather than a shortcut.

**★ Why do two `InjectionToken`s with the same description behave as different tokens, and why is
that the right design?**
Because a token's identity is the object reference, and the description is only used to build error
messages. The doc comment is explicit about the consequence and calls it an Important Note. The
design is right because the alternative — string identity — is exactly the global namespace problem
that string tokens have: two independent libraries choosing the same description would silently
share a provider, and there would be no way to have two distinct tokens that happen to be named the
same thing. Object identity gives every token a unique key for free, at the cost of a diagnostic
that prints two identical-looking names. The practical rule that follows is a coding rule rather
than an API one: declare each token exactly once, in a leaf module, and never inside a function.

**★ Angular's own `InjectionToken` doc comment says a mismatched token leads to a
`NullInjectorError`. What actually happens in v22, and what does the discrepancy tell you?**
You get a `RuntimeError` whose `name` is `ɵNotFound` and whose code is `NG0201`, with a dev-mode
message of the form ``No provider found for `API_URL`.`` — there is no `NullInjectorError` class in
`@angular/core` at v22.1.5 at all. The discrepancy is worth knowing for two reasons. Practically,
searching a codebase or the web for `NullInjectorError` finds material written against older
versions, which is a slow way to debug a current error. Methodologically, it shows that stale prose
survives inside the repository and not just on the documentation site, so "the doc comment says so"
is weaker evidence than the code it is attached to. When the two disagree, the source wins.

← Prev: [Lifetime is the question](12d-lifetime-is-the-whole-question.md) · Index: [Topic index](README.md) · Next → [String tokens](12f-string-tokens-and-the-deprecated-overload.md)
