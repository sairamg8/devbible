---
title: "mergeApplicationConfig concatenates exactly one key and plainly overwrites every other, and that asymmetry — not a merge algorithm — is the whole of what a server config does to a browser config"
sidebar_label: "17 · The server config merge"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev
> [`ApplicationConfig`](https://angular.dev/api/core/ApplicationConfig) — and `angular/angular` at
> tag `v22.1.5`:
> [`core/src/application/application_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/application_config.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`mergeApplicationConfig` is nine lines and it does two different things in one expression: it
concatenates the `providers` arrays, and it plainly overwrites every other property. Nothing is
de-duplicated, nothing is reconciled, nothing is validated. Once you have read the expression, every
question about SSR configuration — which config wins, why a route table is doubled, why an
interceptor runs twice — collapses into a question about array order that
[13 · Order dependence](13-order-dependence.md) already answered.**

The whole of what makes it correct is a third argument to `Object.assign`, evaluated before the call
that would otherwise have destroyed the data it reads. That detail is why hand-rolled merge helpers
in this shape are almost always broken, and it is worth ten minutes.

## The whole function

From
[`packages/core/src/application/application_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/application_config.ts)
at `v22.1.5` — this is the entire file apart from the `ApplicationConfig` interface
[01](01-app-config-and-what-bootstrap-does-with-it.md) already quoted:

```ts
/**
 * Merge multiple application configurations from left to right.
 *
 * @param configs Two or more configurations to be merged.
 * @returns A merged [ApplicationConfig](api/core/ApplicationConfig).
 *
 * @publicApi
 */
export function mergeApplicationConfig(...configs: ApplicationConfig[]): ApplicationConfig {
  return configs.reduce(
    (prev, curr) => {
      return Object.assign(prev, curr, {providers: [...prev.providers, ...curr.providers]});
    },
    {providers: []},
  );
}
```

Six things fall straight out of it:

1. **It is a concatenation, not a merge** — `[...prev.providers, ...curr.providers]`.
2. **Every *other* own enumerable property of `curr` overwrites `prev`'s.** That is `Object.assign`.
3. **The third argument is the entire correctness of the function.**
4. **The accumulator is mutated; the inputs never are**, because the seed is a fresh literal.
5. **It validates nothing and de-duplicates nothing**, and could not do either from where it stands.
6. **It takes `...configs`** — any number, folded left, including zero and one.

The first three are this page. The last three are [17b](17b-what-the-merge-does-not-do.md).

## Two operations, and only the first one is a merge

`Object.assign(target, ...sources)` copies each source's own enumerable properties onto the target,
later sources winning. There are two sources here — `curr`, then the object literal — so the sequence
per fold step is:

1. every key of `curr`, `providers` included, is copied onto the accumulator, **destroying**
   `prev.providers`;
2. the literal's `providers` key is copied over the top, replacing it with the concatenation.

🔴 **The concatenation survives step 1 only because argument expressions are evaluated before the
call.** JavaScript evaluates `Object.assign`'s three arguments left to right and *then* invokes it,
so `[...prev.providers, ...curr.providers]` reads `prev.providers` while it is still the left-hand
config's array. Split that single expression into two statements and the function stops working:

```ts
// ⛔ The "obvious" refactor. It returns the RIGHT-hand providers twice and the left-hand ones not at all.
function mergeBroken(prev: ApplicationConfig, curr: ApplicationConfig): ApplicationConfig {
  Object.assign(prev, curr);                                  // prev.providers is now curr.providers
  prev.providers = [...prev.providers, ...curr.providers];    // ...so this concatenates curr with curr
  return prev;
}

// ✅ The framework's form. One expression, so the read happens before the overwrite.
function mergeCorrect(prev: ApplicationConfig, curr: ApplicationConfig): ApplicationConfig {
  return Object.assign(prev, curr, {providers: [...prev.providers, ...curr.providers]});
}
```

The broken version has no diagnostic at all. It type-checks, it returns an `ApplicationConfig`, and
the application boots — with every browser-side provider silently gone and every server-side one
registered twice. For non-multi tokens the duplication is invisible (last-wins, same value); for
multi tokens it doubles the route table and the initializer list. That combination — a real defect
whose only symptom is in the multi half — is why this function is written the way it is.

## The sibling key that silently replaces

Concatenation is special-cased for exactly one property name. Everything else takes `Object.assign`
semantics, which means **the last config wins outright**:

```ts
// `ApplicationConfig` has one property, so widen it to make the asymmetry visible.
interface TaggedConfig extends ApplicationConfig {
  buildTag: string;
}

const browser: TaggedConfig = {
  buildTag: 'browser',
  providers: [provideRouter(routes)],
};

const server: TaggedConfig = {
  buildTag: 'server',
  providers: [provideServerRendering(withRoutes(serverRoutes))],
};

// The declared return type is `ApplicationConfig`, so the extra key needs a cast to be read at all.
const merged = mergeApplicationConfig(browser, server) as TaggedConfig;

// merged.providers -> [provideRouter(routes), provideServerRendering(...)]   BOTH, in order
// merged.buildTag  -> 'server'                                              browser's is GONE
```

Two consequences worth holding onto:

- **The type system will not show you this.** `mergeApplicationConfig` is declared to return
  `ApplicationConfig`, so any extra property is erased from the result's type while surviving on the
  runtime object. A key you added deliberately becomes a key nobody can see without a cast.
- **Today `ApplicationConfig` has exactly one property**, so inside the framework's own type the
  asymmetry is latent rather than active. It becomes active the moment you widen the interface, pass
  an object literal with extra fields, or copy this shape into a merge helper of your own — which is
  the common case, because "merge my config objects" is a thing applications do for feature flags,
  build tags and environment metadata.

⚠️ If `ApplicationConfig` ever gains a second property, that property will be **replaced** by the
right-hand config and not merged with the left-hand one. The function's shape has already decided
that, years before the property exists.

## "Left to right" describes the fold, not the precedence

The doc comment says *"Merge multiple application configurations from left to right."* That sentence
is about `reduce`, and it is the sentence people misread as "the left-hand config wins". It does not.
Left to right is the order in which providers are **appended**, and appending later means winning:

- **non-multi token** — the last entry in the flattened array is the one the injector keeps, so the
  **rightmost** config wins. [13c](13c-last-wins-in-practice.md) has the mechanism.
- **multi token** — every entry contributes, in array order, so both configs' entries are present.
  [13e](13e-multi-tokens-append.md) has that half.

`mergeApplicationConfig` introduces no rule of its own. It builds an array; the rules are the ones
[13 · Order dependence](13-order-dependence.md) already stated, and
[13h](13h-five-collisions-in-one-config.md) walks the two-file case entry by entry. This page and its
siblings assume both, and go after what is specific to the server.

## Gotchas

**★ Symptom: you replace `mergeApplicationConfig` with a spread and half the application stops
working on the server.** Cause: `{...appConfig, ...serverConfig}` gives `serverConfig.providers`
outright — the browser config's providers are not merged, they are gone, so the router, the
interceptors and the error listeners all disappear. Fix: use the function, or if you genuinely need
your own helper, keep the concatenation in the same expression:

```ts
// ⛔ discards appConfig.providers entirely
const config = {...appConfig, ...serverConfig};

// ✅
const config = mergeApplicationConfig(appConfig, serverConfig);
```

**★ Symptom: a hand-written merge helper doubles the right-hand config's providers and loses the
left-hand config's.** Cause: the two-statement form. `Object.assign(prev, curr)` overwrites
`prev.providers` with `curr.providers` before the next line reads it, so the concatenation is `curr`
with `curr`. Fix: one expression, third argument — `mergeCorrect` above. There is no diagnostic for
the broken form; the only visible symptom is doubled multi providers, so a config with no multi
tokens will hide it completely.

**★ Symptom: a property you added to your config object came out of the merge with the wrong value.**
Cause: only `providers` is concatenated. Every other key is a plain `Object.assign` overwrite, so the
rightmost config's value survives and the others are discarded silently. Fix: do not carry data on
the config object; carry it in a provider, where the same last-wins rule is at least the rule you
expect:

```ts
// ⛔ silently replaced by the right-hand config
const browser = {buildTag: 'browser', providers: []};

// ✅ an injectable value, subject to the ordinary provider rules
const browser: ApplicationConfig = {
  providers: [{provide: BUILD_TAG, useValue: 'browser'}],
};
```

**★ Symptom: an extra property on the merged config is invisible to TypeScript.** Cause:
`mergeApplicationConfig` is declared `(...configs: ApplicationConfig[]): ApplicationConfig`, so the
return type is narrowed to the one-property interface even though the runtime object carries whatever
`Object.assign` copied. Fix: cast at the merge site and accept that the cast is the documentation —
`mergeApplicationConfig(a, b) as TaggedConfig` — or, better, stop putting data on the config object
at all.

**Symptom: you read "merge from left to right" and put the server config first.**
Cause: the doc comment describes the fold direction, not the precedence. Fix:
`mergeApplicationConfig(appConfig, serverConfig)` — the CLI's order, and the one that lets the server
override. [13h](13h-five-collisions-in-one-config.md) works the reversed case through in full.

## Interview questions

**★ `mergeApplicationConfig(appConfig, serverConfig)` — which config wins a conflict, and why is the
doc comment's "left to right" not the answer?**
The right-hand one wins, for non-multi tokens. "Left to right" describes the direction of the
`reduce`, i.e. the order in which the providers arrays are appended — and appending later is what
wins, because the injector keeps the last entry it sees for a non-multi token. So the sentence
describes the fold, and the precedence reads the opposite way round to how the sentence sounds. For
multi tokens nothing wins at all: both configs contribute and the entries concatenate.

**★ Why is the third argument to `Object.assign` there, and what happens if you refactor it away?**
It rebuilds `providers` after `Object.assign` has already overwritten it with `curr`'s. The
concatenation is computed as an *argument expression*, so JavaScript evaluates it — reading
`prev.providers` — before the call mutates `prev`. Refactor it into `Object.assign(prev, curr)`
followed by `prev.providers = [...prev.providers, ...curr.providers]` and the second line
concatenates `curr.providers` with itself: the left-hand config's providers are lost and the
right-hand config's are registered twice. It type-checks, it boots, and the only symptom is doubled
multi providers.

**★ Is `mergeApplicationConfig` a deep merge, a shallow merge, or something else?**
Something else, and the distinction is the point. For `providers` it is a **concatenation** — both
arrays end to end, nothing compared, nothing removed. For every other property it is a **shallow
overwrite**, the last config's value replacing the earlier ones. It is never deep: no property is
recursed into, and no provider object is inspected. Calling it a merge is the source of most
misunderstanding about it.

**`ApplicationConfig` has one property. Why does the overwrite half of the function matter at all
then?**
Because it decides the behaviour of a property that does not exist yet, and because people copy the
shape. Today the overwrite branch of `Object.assign` runs against `providers` — which is immediately
replaced by the third argument — plus any extra key an object literal happened to carry, which
TypeScript will not show you on the result. The moment `ApplicationConfig` gains a second property,
or the moment somebody writes their own `mergeMyConfig` in this shape, that branch becomes the
observable behaviour and it is a replace, not a merge.

{/* FOOTER */}
