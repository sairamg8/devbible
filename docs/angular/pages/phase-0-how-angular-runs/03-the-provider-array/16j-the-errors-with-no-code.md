---
title: "One function throws three different provider errors and only two of them are `RuntimeError`s — `Invalid provider` and `Cannot mix multi providers and regular providers` are plain `Error`s with no code, no `Path:` and nothing to look up"
sidebar_label: "16j · The errors with no code"
sidebar_position: 16.9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/render3/errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts) (verbatim),
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts), and the adev source for
> [`errors/NG0207.md`](https://github.com/angular/angular/blob/v22.1.5/adev/src/content/reference/errors/NG0207.md).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Not every provider failure gets an `NG` code, and the ones that do not are the hardest to search for.** `throwInvalidProviderError` has three branches: two throw a `RuntimeError` with `PROVIDER_IN_WRONG_CONTEXT` and give you `NG0207` plus a guide page, and two throw a plain `Error` — one of them the three-word `Invalid provider`, which identifies nothing. `throwMixedMultiProviderError` is the same story in one line. A plain `Error` carries no monkey-patched code, so `getRuntimeErrorCode` returns `undefined`, the `r3_injector` catch takes its pass-through branch, and the error arrives with no path, no source and no link. This chunk closes the error surface with those, and with the one error-reference page in this area that is actually accurate.

### NG0207 and the two uncoded errors, from one function

`throwInvalidProviderError` produces three different failures and only two of them carry a code.
Verbatim:

```ts
export function throwInvalidProviderError(
  ngModuleType?: Type<unknown>,
  providers?: any[],
  provider?: any,
): never {
  if (ngModuleType && providers) {
    const providerDetail = providers.map((v) => (v == provider ? '?' + provider + '?' : '...'));
    throw new Error(
      `Invalid provider for the NgModule '${stringify(
        ngModuleType,
      )}' - only instances of Provider and Type are allowed, got: [${providerDetail.join(', ')}]`,
    );
  } else if (isEnvironmentProviders(provider)) {
    if (provider.ɵfromNgModule) {
      throw new RuntimeError(
        RuntimeErrorCode.PROVIDER_IN_WRONG_CONTEXT,
        `Invalid providers from 'importProvidersFrom' present in a non-environment injector. 'importProvidersFrom' can't be used for component providers.`,
      );
    } else {
      throw new RuntimeError(
        RuntimeErrorCode.PROVIDER_IN_WRONG_CONTEXT,
        `Invalid providers present in a non-environment injector. 'EnvironmentProviders' can't be used for component providers.`,
      );
    }
  } else {
    throw new Error('Invalid provider');
  }
}
```

🔴 **The first and last branches throw a plain `Error`, not a `RuntimeError`.** No code, no
`NG` prefix, nothing to look up on angular.dev, and `getRuntimeErrorCode` returns `undefined`
for them — so the `r3_injector` catch takes its `else { throw error; }` path and they get no
`Path:` either. `Invalid provider` in particular is three words with no context whatsoever; it
means an entry in a `providers` array was neither a `Provider` nor a `Type`, which in practice
means `undefined` from a circular import or a missing `export`.

The NG0207 guide page is short and accurate, unlike NG0201's. Verbatim from
[`adev/src/content/reference/errors/NG0207.md`](https://github.com/angular/angular/blob/v22.1.5/adev/src/content/reference/errors/NG0207.md)
→ [angular.dev/errors/NG0207](https://angular.dev/errors/NG0207):

> *"# EnvironmentProviders in wrong context"*
>
> *"This error occurs when `EnvironmentProviders` are used in a context that only accepts regular providers, such as a component's `providers` array. Environment providers are designed for application-wide configuration and can only be used in environment injectors (like the root injector configured in `bootstrapApplication` or route configurations)."*
>
> *"The error message specifies which provider caused the issue. Check that all items in your component's `providers` array are regular providers, not environment providers returned by functions like `provideHttpClient()`, `provideRouter()`, or `importProvidersFrom()`."*

and its route-scoped remedy, verbatim:

```ts
const routes: Routes = [
  {
    path: 'admin',
    component: AdminView,
    providers: [provideHttpClient(withInterceptors([authInterceptor]))],
  },
];
```

### The multi-provider error with no code at all

Verbatim, also from `errors_di.ts`:

```ts
export function throwMixedMultiProviderError() {
  throw new Error(`Cannot mix multi providers and regular providers`);
}
```

A bare `Error`. It does not name the token, it does not name the file, and it has no `NG` code
to search for — which is why [13b](13b-mixing-multi-and-non-multi.md) treats it as a review
problem rather than a debugging one. If you see it, the search is `multi: true` across your
provider arrays and the token that appears both with and without it.

## Gotchas

**★ Symptom: `Cannot mix multi providers and regular providers` with no code and no token name.** Cause: `throwMixedMultiProviderError` throws a plain `Error`. There is nothing to look up and nothing to grep for beyond the sentence itself. Fix: search your provider arrays for the token that appears both with and without `multi: true` — [13b](13b-mixing-multi-and-non-multi.md) has the mechanism and the corrected arrays.

**★ Symptom: a three-word `Invalid provider` error.** Cause: the final `else` of `throwInvalidProviderError` — an entry in a `providers` array that is neither a `Provider` nor a `Type`. In practice that means `undefined`, from a circular import between two modules or a missing `export`. Fix: log the array before bootstrap, or bisect it. Nothing in the error identifies the entry.

**★ Symptom: `NG0207` appeared after someone silenced a type error with a cast.** Cause: `EnvironmentProviders` is a branded type precisely so a `provide*()` call cannot land in a component's `providers`; a cast removes the compile-time guard and `throwInvalidProviderError` catches it at runtime instead. Fix: put the call where it belongs — application config, or a route's `providers`, which is an environment injector too. [03](03-environmentproviders-vs-provider.md) has the branded type in full.

## Interview questions

**★ Some provider errors have an `NG` code and some do not. Why, and what do you do with the ones that do not?**
`throwInvalidProviderError` is the clearest example: its `EnvironmentProviders` branches throw a `RuntimeError` with `PROVIDER_IN_WRONG_CONTEXT`, so you get `NG0207` and a guide page, but its NgModule branch and its final `else` throw a plain `Error` — `Invalid provider for the NgModule '…'` and the three-word `Invalid provider`. `throwMixedMultiProviderError` likewise throws a plain `Error` with `Cannot mix multi providers and regular providers`. A plain `Error` has no monkey-patched code, so `getRuntimeErrorCode` returns `undefined`, the `r3_injector` catch takes its `else { throw error; }` path, and it gets no `Path:` either — you are left with the sentence and nothing else. For `Invalid provider` the practical read is that an array entry was `undefined`, which nearly always means a circular import or a missing `export`; you bisect the array rather than search for a code.

**What would you change about Angular's DI error surface?**
Two things, and both are supportable from the source rather than taste. First, the production message: the argument for stripping it is bundle size and not leaking symbol names, but the result is that the single most common runtime failure in the framework is undiagnosable from a production log. A middle position — keep the token name behind an opt-in provider, the way `provideNgReflectAttributes` re-enables another dev-only affordance — would cost one flag. Second, the two `NG0201` message shapes: one code with two texts, one of which sets `error.name` and one of which does not, means the framework's own `isNotFound` guard has a hole in it. Making `throwProviderNotFoundError` go through the same `createRuntimeError` path would unify both. I would also say the honest thing about the docs: the fix there is not a rewrite but a test — the error-reference pages quote message strings that nothing verifies, which is why `` No provider for ${this}! `` survived two major versions.

← Prev: [The codes next door](16i-the-codes-next-door.md) · Index: [Topic index](README.md) · Next → [The server config merge](17-the-server-config-merge.md)
