---
title: "Only one of the six hydration features is a plain opt-in — the rest are defaults, opt-outs and one deprecated re-statement, and `provideClientHydration`'s own JSDoc has already stopped describing them accurately"
sidebar_label: "11b · The feature inventory"
sidebar_position: 11.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against **Angular 22.1.5** — angular.dev
> [Hydration](https://angular.dev/guide/hydration),
> [Incremental hydration](https://angular.dev/guide/incremental-hydration); and `angular/angular` at
> tag `v22.1.5`:
> [`platform-browser/src/hydration.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/platform-browser/src/hydration.ts),
> [`core/src/hydration/api.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/hydration/api.ts),
> [`goldens/public-api/platform-browser/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/platform-browser/index.api.md).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`provideClientHydration()` has six public features and only one of them is a plain "enable
this".** The other five are a default, two opt-outs, a configurator and a deprecated re-statement of
something already on. Reading the inventory that way — rather than as a menu — is what tells you
which arguments in an inherited `app.config.ts` are load-bearing and which are residue from a
version that has been superseded twice.

Two sources settle it: the function's own JSDoc, which is half-migrated and therefore misleading in
a specific way worth knowing, and the public-API golden, which carries the `@deprecated` marks the
JSDoc has already dropped.

## Its own JSDoc list, and the two things it does not say

Verbatim from the same file:

> *"By default, the function enables the recommended set of features for the optimal performance for
> most of the applications. It includes the following features:"*
>
> *"\* Reconciling DOM hydration. … \* [`HttpClient`] response caching while running on the server and
> transferring this cache to the client to avoid extra HTTP requests. … Incremental hydration."*
>
> *"These functions allow you to disable some of the default features or enable new ones:"*
>
> *"\* `{@link withNoHttpTransferCache}` to disable HTTP transfer cache"*
> *"\* `{@link withHttpTransferCacheOptions}` to configure some HTTP transfer cache options"*
> *"\* `{@link withI18nSupport}` to enable hydration support for i18n blocks"*
> *"\* `{@link withEventReplay}` to enable support for replaying user events"*
> *"\* `{@link withNoIncrementalHydration}` to disable incremental hydration"*
>
> `@publicApi 17.0`

🔴 **Read the list for what is missing.** `withIncrementalHydration` is not in it — the deprecated
function has already been dropped from the doc comment, while the golden still exports it. And
`withEventReplay` **is** in it, described as "to enable support for replaying user events", which in
v22 is no longer true of a default application: event replay is already enabled. The JSDoc is
half-migrated. That is not really a criticism of the comment; it is the practical reason you cannot
settle the `withEventReplay()` question from documentation and have to read
`ɵwithIncrementalHydration`, which is what [11b](11c-incremental-hydration-and-event-replay.md) does.

## The six features, and which are real choices

```ts
export enum HydrationFeatureKind {
  NoHttpTransferCache,
  HttpTransferCacheOptions,
  I18nSupport,
  EventReplay,
  IncrementalHydration,
  NoIncrementalHydration,
}
```

From
[`goldens/public-api/platform-browser/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/platform-browser/index.api.md):

```ts
// @public
export function withEventReplay(): HydrationFeature<HydrationFeatureKind.EventReplay>;
// @public
export function withHttpTransferCacheOptions(options: HttpTransferCacheOptions): HydrationFeature<HydrationFeatureKind.HttpTransferCacheOptions>;
// @public
export function withI18nSupport(): HydrationFeature<HydrationFeatureKind.I18nSupport>;
// @public @deprecated
export function withIncrementalHydration(): HydrationFeature<HydrationFeatureKind.IncrementalHydration>;
// @public
export function withNoHttpTransferCache(): HydrationFeature<HydrationFeatureKind.NoHttpTransferCache>;
// @public
export function withNoIncrementalHydration(): HydrationFeature<HydrationFeatureKind.NoIncrementalHydration>;
```

| Feature | On in a bare `provideClientHydration()`? | What passing it actually does |
|---|---|---|
| DOM hydration (no feature exists) | 🔴 **always** | `withDomHydration()` is outside every ternary |
| HTTP transfer cache | ✅ on | — |
| `withNoHttpTransferCache()` | opt-out | suppresses `ɵwithHttpTransferCache({})`; requests then run on both server and client |
| `withHttpTransferCacheOptions(o)` | configure | **also** suppresses the default `{}` call, via the `\|\|` |
| `withI18nSupport()` | ❌ off | the only feature in the set that is a plain opt-in |
| Incremental hydration | ✅ on (v22+) | — |
| `withNoIncrementalHydration()` | opt-out (new in 22.0) | contributes **zero providers** — works by kind alone |
| `withIncrementalHydration()` | ⚠️ **deprecated 22.0**, remove in v24 | re-registers what is already registered |
| `withEventReplay()` | ✅ on transitively | redundant unless paired with `withNoIncrementalHydration()` |

Only `withI18nSupport()` is a straightforward "enable this". Everything else is either already on,
an opt-out, or a re-statement of a default — which is the shape you would expect from an API that
has spent five major versions moving features from opt-in to default without breaking anyone's
config.

⚠️ **Two neighbours in the same golden**, not hydration features but frequently found in the same
array: `provideCssVarNamespacing(namespace?: string): EnvironmentProviders` (`// @public`, a newer
surface) and `provideProtractorTestingSupport(options?: {usePendingTasksForStability?: boolean;}): Provider[]`
(`// @public`). ⚠️ Their implementations and doc comments were **not read** for this page, so nothing
here describes their behaviour beyond the signature. One thing the signature alone does tell you:
`provideProtractorTestingSupport` returns `Provider[]`, so it carries the hole
[03 · `EnvironmentProviders` vs `Provider`](03-environmentproviders-vs-provider.md) describes — it
will compile inside a component's `providers`.

## Gotchas

**★ Symptom: you go looking for a feature that turns DOM hydration off for one route or one
component.** Cause: there is not one. `withDomHydration()` sits outside every ternary and no public
`HydrationFeatureKind` removes it. Fix: hydration is an application-level decision — the granular
control you are looking for is `ngSkipHydration` on the element, which is a template concern rather
than a provider one, and `@defer` with a `hydrate` trigger for the incremental case.

**★ Symptom: `provideProtractorTestingSupport()` compiles inside a component's `providers` array.**
Cause: it returns `Provider[]`, not `EnvironmentProviders`, so the brand that makes root-only a
compile error does not apply to it. Fix: keep it in the application config — and note that the same
hole applies to `provideAnimations()` and `provideNoopAnimations()`, covered in
[11e](11f-animations-are-deprecated.md).

**★ Symptom: you read the JSDoc, concluded `withEventReplay()` is how you enable event replay, and
added it.** Cause: the doc comment still lists it under *"These functions allow you to disable some
of the default features or enable new ones"*, and was not updated when incremental hydration became
the default. Fix: read `ɵwithIncrementalHydration()` instead — the argument is made in full in
[11c](11c-incremental-hydration-and-event-replay.md). The general rule this topic keeps arriving at
is that a dated `@deprecated` tag or a function body outranks a prose list.

**★ Symptom: `withI18nSupport()` looks like it might be on by default because everything else is.**
Cause: reasonable inference, wrong answer. It is the one genuine opt-in in the set — it appears in
no ternary in the function body, so it takes effect only through its own `ɵproviders`. Fix: if you
have i18n blocks and you want them hydrated rather than re-rendered, you must pass it.

**★ Symptom: an inherited config passes `withHttpTransferCacheOptions()` *and* you assumed the
default cache was still underneath it.** Cause: the `||` in the ternary treats the options feature as
a replacement, not a layer. Fix: read the options as the complete configuration.
[11d](11d-the-http-transfer-cache.md) works through what that costs you.

## Interview questions

**★ Which of the hydration features is a plain opt-in, and why does that answer say something about
the API?**
Only `withI18nSupport()`. Everything else is a default, an opt-out, or a deprecated re-statement of
a default. That distribution is what an API looks like after several releases of promoting features
from opt-in to default: each promotion leaves behind a now-redundant opt-in — kept, deprecated, so
`ng update` can rewrite it — and adds a mirrored opt-out so the old behaviour stays reachable. If
you can read that shape you can usually predict which arguments in an old config are safe to delete.

**★ A feature that contributes zero providers still changes what `provideClientHydration()` returns.
How?**
Because the function tracks two things separately: a `Set` of `ɵkind` values and an array of
`ɵproviders`. The ternaries that decide whether to install the default transfer cache and the
default incremental hydration read only the `Set`. So `withNoIncrementalHydration()` — which calls
`hydrationFeature()` with no providers at all — works purely by being *present* in the kinds. It is
the same design as `withNoXsrfProtection()` in [10e](10e-xsrf-protection.md), and it is what makes
the contradiction checks in [11d](11e-the-contradiction-checks.md) possible without inspecting any
provider.

**★ The golden marks `withIncrementalHydration` as `@public @deprecated` while the function's own
JSDoc list has dropped it entirely. Which do you trust, and why does the difference exist?**
Both, for different questions. The golden is generated from the type surface, so it is the authority
on *what is exported and how it is tagged* — the deprecation is real and machine-readable, which is
what lets `ng update` and your editor act on it. The JSDoc list is hand-written prose, so it is the
authority on nothing and is where drift shows up first: the maintainer removed the deprecated entry
from the list but did not revisit the `withEventReplay` line in the same list, which is now wrong for
a default v22 application. When they disagree, the answer is almost always to read the function
body, which is neither.

**★ You inherit an `app.config.ts` containing `provideClientHydration(withEventReplay(), withIncrementalHydration())`.
What do you change and what do you leave?**
Delete both. `withIncrementalHydration()` is deprecated as of 22.0 with intent to remove in v24 and
re-registers a default; `withEventReplay()` is enabled transitively by that same default. The result
is `provideClientHydration()`, which is behaviourally identical. The thing to be careful about is
the opposite case: if the config had contained `withNoIncrementalHydration()`, then `withEventReplay()`
would be load-bearing and deleting it would silently drop event replay.

---

← Prev: [Hydration, animations and the rest](11-hydration-animations-and-the-rest.md) · Index: [Topic index](README.md) · Next → [11c · Incremental hydration and event replay](11c-incremental-hydration-and-event-replay.md)
