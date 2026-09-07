---
title: "Incremental hydration became the default in v22 and took event replay with it — so `withEventReplay()` is redundant in every default application, and angular.dev's own hydration guide still tells you to add it"
sidebar_label: "11c · Incremental hydration and event replay"
sidebar_position: 11.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against **Angular 22.1.5** — angular.dev
> [Hydration](https://angular.dev/guide/hydration),
> [Incremental hydration](https://angular.dev/guide/incremental-hydration); and `angular/angular` at
> tag `v22.1.5`:
> [`platform-browser/src/hydration.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/platform-browser/src/hydration.ts),
> [`core/src/hydration/api.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/hydration/api.ts);
> and the v22.0.0 CHANGELOG. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**This is the one question about hydration you cannot answer from the documentation, because
angular.dev contradicts itself on the same page.** Every tutorial, and the "Capturing and replaying
events" section of the current hydration guide, tells you that event replay is enabled by writing
`provideClientHydration(withEventReplay())`. In a default v22 application that argument does
nothing you were not already getting. The proof is three lines of core, and it is worth walking
because the shape — an opt-in promoted to a default, the old function kept and deprecated, a
mirrored opt-out added — is how Angular ships almost every behavioural change.

## The deprecation and its mirror, verbatim

```ts
/**
 * Enables support for incremental hydration using the `hydrate` trigger syntax.
 * …
 * @publicApi 20.0
 * @see {@link provideClientHydration}
 *
 * @deprecated Since v22.0.0, incremental hydration is enabled by default with `provideClientHydration`.
 * Intent to remove in v24.
 */
export function withIncrementalHydration(): HydrationFeature<HydrationFeatureKind.IncrementalHydration> {
  return hydrationFeature(HydrationFeatureKind.IncrementalHydration, ɵwithIncrementalHydration());
}

/**
 * Disables support for incremental hydration (which is enabled by default).
 *
 * @publicApi 22.0
 * @see {@link provideClientHydration}
 */
export function withNoIncrementalHydration(): HydrationFeature<HydrationFeatureKind.NoIncrementalHydration> {
  return hydrationFeature(HydrationFeatureKind.NoIncrementalHydration);
}
```

Two things to notice in the pair.

**`withNoIncrementalHydration()` calls `hydrationFeature()` with one argument** — no providers at
all. It is a kind and nothing else, and the ternary in `provideClientHydration` is the entire
mechanism by which it works. That is the same design as `withNoXsrfProtection()` in
[10e · XSRF protection](10e-xsrf-protection.md), and it is what makes the validation in
[11e · The contradiction checks](11e-the-contradiction-checks.md) possible without inspecting any
provider.

**`withIncrementalHydration()` is not a no-op.** It still returns `ɵwithIncrementalHydration()` in
its providers. So a v22 config that passes it registers those providers twice — once from the
default ternary, once from the feature loop. It is deprecated because it is redundant, not because
it stopped working. That distinction matters when you are deciding whether an upgrade is urgent:
nothing breaks today, and the deadline is v24.

The release note behind it, from the CHANGELOG for v22.0.0, core features table:
*"feat | make incremental hydration default behavior"*, commit `68628dd45b`.

And angular.dev's [Incremental hydration](https://angular.dev/guide/incremental-hydration) guide,
which is up to date and says all three things plainly:

> *"Incremental hydration is enabled by default when you use `provideClientHydration()`."*
>
> *"NOTE: Incremental Hydration depends on and enables [event replay] automatically. If you already
> have `withEventReplay()` in your list, you can safely remove it."*
>
> *"To opt out of incremental hydration, use `withNoIncrementalHydration()`"*

## The three lines of core that settle it

The guide's note is correct, and the reason is the first entry of one provider array. From
[`core/src/hydration/api.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/hydration/api.ts):

```ts
/**
 * Returns a set of providers required to setup support for incremental hydration.
 * Requires hydration to be enabled separately.
 * Enabling incremental hydration also enables event replay for the entire app.
 * …
 */
export function withIncrementalHydration(): Provider[] {
  const providers: Provider[] = [
    withEventReplay(),
    {
      provide: IS_INCREMENTAL_HYDRATION_ENABLED,
      useValue: true,
    },
    {
      provide: DEHYDRATED_BLOCK_REGISTRY,
      useFactory: createDehydratedBlockRegistry,
    },
  ];
```

So the chain is `provideClientHydration()` → the default ternary calls `ɵwithIncrementalHydration()`
→ which calls `withEventReplay()`.

⚠️ **Mind the name collision if you read the source yourself.** The `withIncrementalHydration` in
this file is the **core internal** one — the same symbol `platform-browser` imports under the alias
`ɵwithIncrementalHydration` — and the `withEventReplay` it calls is likewise core's internal
provider factory, not the public `platform-browser` feature wrapper of the same name. Two pairs of
identically-named functions across two packages, distinguished only by the `ɵ` prefix at the import
site. Grepping for `withEventReplay` without noticing which package you are in is how this question
gets answered wrongly.

The doc comment above it also states the dependency in prose — *"Requires hydration to be enabled
separately"* — which is the other half of the design: incremental hydration is a layer on top of DOM
hydration, not a replacement for it, and `provideClientHydration()` is the only thing that installs
the base layer.

## What that means for your config

⚠️ **`withEventReplay()` is only load-bearing when you also pass `withNoIncrementalHydration()`.**
Turning incremental hydration off takes event replay with it, and if you wanted event replay for its
own sake you have to ask for it again:

```ts
// v22 default — event replay is already on. Nothing to add.
provideClientHydration()

// Opted out of incremental hydration, still want event replay: now it is required.
provideClientHydration(withNoIncrementalHydration(), withEventReplay())

// Deprecated, and redundant with the first form.
provideClientHydration(withIncrementalHydration(), withEventReplay())
```

🔴 **angular.dev's hydration guide has not caught up.** Its "Capturing and replaying events" section
still presents `provideClientHydration(withEventReplay())` as *the* way to enable the feature, and
adds only at the end, verbatim: *"NOTE: If you have [incremental hydration] enabled, event replay is
automatically enabled under the hood."* Both statements sit on the same page; the ordering implies
the opposite of the truth for a default v22 app; and the source settles it. The two guides disagree
because they were updated at different times, and the incremental-hydration one was updated second.

## What event replay actually captures

Worth pinning down, because the name suggests more than it does:

> *"Event Replay is a feature that improves user experience by capturing user events that were
> triggered before the hydration process is complete. Then those events are replayed, ensuring none
> of that interaction was lost."*

> *"Event replay supports _native browser events_, for example `click`, `mouseover`, and `focusin`."*

That second sentence is the limit people trip over. A custom `@Output()` firing before hydration is
not a native browser event and is not what gets captured. What is captured and replayed is the DOM
event that would eventually have caused your output to fire — so the output *does* fire, but as a
consequence of the replayed `click`, after hydration, not as a queued emission of its own.

## Gotchas

**★ Symptom: `withEventReplay()` appears in every tutorial you read and you cannot tell whether you
need it.** Cause: the tutorials predate v22, and angular.dev's hydration guide still leads with it.
Fix: in a default v22 app, delete it — `provideClientHydration()` enables incremental hydration,
which calls `withEventReplay()` for you. Keep it **only** if you also pass
`withNoIncrementalHydration()`. The proof is `core/src/hydration/api.ts`, not the guide.

**★ Symptom: you added `withNoIncrementalHydration()` to fix a `@defer (hydrate …)` problem, and
pre-hydration clicks stopped working.** Cause: opting out of incremental hydration removed event
replay along with it, because event replay was only ever arriving transitively. Fix: add
`withEventReplay()` back explicitly. This is the single case where that argument is required.

**★ Symptom: `withIncrementalHydration()` is struck through in your editor after an upgrade.**
Cause: deprecated since v22.0.0, intent to remove in v24. Fix: delete the call. It is a redundant
re-registration of a default, not a feature you are losing — and because it is only deprecated, the
build still passes, so there is no urgency beyond v24.

**★ Symptom: you grepped for `withEventReplay` to prove it is not enabled, found only the definition
in `platform-browser`, and concluded it is off.** Cause: the call that enables it lives in
`@angular/core`, in a different function that happens to share the name
`withIncrementalHydration`. Fix: search `core/src/hydration/api.ts`, or follow the `ɵ`-prefixed
import from `platform-browser/src/hydration.ts` — the aliasing is what hides it.

**★ Symptom: an `@Output()` your component emitted during the pre-hydration window is not replayed.**
Cause: event replay captures *native browser events* — the guide names `click`, `mouseover`,
`focusin`. A component output is not one. Fix: none needed at the output level; what gets replayed
is the DOM event that will cause your output to fire again after hydration.

**★ Symptom: you enabled incremental hydration expecting deferred blocks to hydrate on their own,
and nothing changed.** Cause: incremental hydration is the *mechanism*; the `hydrate` triggers on
your `@defer` blocks are what use it. The provider alone changes nothing about a template that never
asks. Fix: the trigger syntax is a template concern and belongs to Phase 5 and the deferred-loading
material rather than the provider array — what `app.config.ts` owes you is only that
`IS_INCREMENTAL_HYDRATION_ENABLED` is `true`, which by default it is.

**★ Symptom: incremental hydration behaves differently in a library you consume than in your own
code after upgrading to v22.** Cause: the default changed for the whole application, not per
library — `ɵwithIncrementalHydration()` is installed once at the root, and the note in core's own
doc comment is explicit that enabling it *"also enables event replay for the entire app"*. Fix: there
is no per-library scope here; if the library needs the old behaviour, the only lever is the
application-wide `withNoIncrementalHydration()`.

## Interview questions

**★ `withIncrementalHydration()` is deprecated and `withNoIncrementalHydration()` is new in the same
release. What does that pair tell you about how Angular ships a default?**
It is the framework's standard promotion: the opt-in becomes the default, an opt-out with a mirrored
name is added so nobody is trapped, and the old opt-in stays — deprecated, with a named removal
version — so `ng update` can rewrite call sites mechanically instead of breaking builds. The
deprecated function is still functional and still registers its providers; it is redundant, not
inert. Recognising the shape lets you predict the migration: delete the opt-in, and reach for the
opt-out only if you actually wanted the old *off* behaviour.

**★ A colleague says event replay is off because `withEventReplay()` is not in the config. How do
you settle it?**
By reading `ɵwithIncrementalHydration()` in `core/src/hydration/api.ts`, whose provider array starts
with `withEventReplay()`. Documentation will not settle it — angular.dev's hydration guide still
presents `withEventReplay()` as the way to enable the feature and mentions the transitive enablement
only as a trailing note, and `provideClientHydration`'s own JSDoc still lists it as something you
add. The general lesson is the one this topic keeps returning to: a dated `@deprecated` tag or a
function body outranks a guide page, because the guide is edited by hand and the source is the thing
that runs.

**★ Under what single condition is `withEventReplay()` still required in v22?**
When the same call passes `withNoIncrementalHydration()`. Opting out of incremental hydration
removes the transitive enablement, so event replay has to be requested directly. It is a good
interview question precisely because the honest answer is "almost never, and here is the exception"
— an answer of "always" and an answer of "never" are both wrong.

**★ Why is incremental hydration described as depending on hydration rather than including it?**
Because the two live in different packages and different layers. `ɵwithIncrementalHydration()`
provides `IS_INCREMENTAL_HYDRATION_ENABLED` and a dehydrated-block registry; it does not provide
`withDomHydration()`, and its own doc comment says *"Requires hydration to be enabled separately"*.
`provideClientHydration()` in `platform-browser` is the only public entry point that installs the
base layer, which is why there is no way to get incremental hydration without it and no feature that
turns the base layer off.

---

← Prev: [The feature inventory](11b-the-feature-inventory.md) · Index: [Topic index](README.md) · Next → [11d · The HTTP transfer cache](11d-the-http-transfer-cache.md)
