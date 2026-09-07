---
title: "Every animations provider is deprecated — the async one since 20.2 with removal named for v23, both eager ones in the goldens — and angular.dev's animations guide opens with the deprecation and then tells you to add one anyway"
sidebar_label: "11f · Animations are deprecated"
sidebar_position: 11.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against **Angular 22.1.5** — angular.dev
> [Introduction to Angular animations](https://angular.dev/guide/animations/overview); and
> `angular/angular` at tag `v22.1.5`:
> [`platform-browser/animations/async/src/providers.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/platform-browser/animations/async/src/providers.ts),
> the `platform-browser/animations` and `platform-browser/animations/async` public-API goldens; and
> the v22.0.0 CHANGELOG. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**There are three ways to put animations in `app.config.ts` and all three are deprecated.** That is
unusual enough to be worth stating plainly, because the normal reading of a deprecation — "there is
a better function, use that one instead" — does not apply. There is no replacement *provider*. The
replacement is CSS, reached through the `animate.enter` and `animate.leave` template syntax, and the
correct end state for the provider array is that nothing animations-related is in it at all.

The complication is that angular.dev's animations overview page says both things: it opens with the
deprecation and later instructs you to add `provideAnimationsAsync()`. This page settles that, and
covers the one type-level trap the family carries.

## The tags, verbatim

`provideAnimationsAsync`, from
[`platform-browser/animations/async/src/providers.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/platform-browser/animations/async/src/providers.ts):

```
 * @param type pass `'noop'` as argument to disable animations.
 *
 * @publicApi
 *
 * @deprecated 20.2 Use `animate.enter` or `animate.leave` instead. Intent to remove in v23
 */
export function provideAnimationsAsync(
```

And the goldens — the eager pair is deprecated too:

```ts
// platform-browser/animations/async
// @public @deprecated
export function provideAnimationsAsync(type?: 'animations' | 'noop'): EnvironmentProviders;

// platform-browser/animations
// @public @deprecated
export function provideAnimations(): Provider[];
// @public @deprecated
export function provideNoopAnimations(): Provider[];
```

🔴 **Read the deprecation dates as a schedule, not as an opinion.** `20.2` with *"Intent to remove
in v23"* means the code compiles today on 22.1.5, will warn for the rest of the v22 line, and is
expected to be gone one major later. If you are on v22 and planning an upgrade, this is a known,
dated piece of migration debt with roughly one release of runway — which is a very different
planning input from an undated "consider migrating".

## The type-level trap: two of the three return `Provider[]`

⚠️ **`provideAnimations()` and `provideNoopAnimations()` return `Provider[]`, not
`EnvironmentProviders`.** They are therefore legal in a *component's* `providers` array, where the
type system will not stop you and the result is an animations engine scoped to that component's
element injector — which nobody intends and which will behave strangely.

This is the exact hole [03 · `EnvironmentProviders` vs `Provider`](03-environmentproviders-vs-provider.md)
describes: the `EnvironmentProviders` brand is what makes "root-only" a **compile-time** fact, and a
provider function that does not return it has opted out of that guarantee. `provideAnimationsAsync()`
does return `EnvironmentProviders` and is protected; the two eager functions predate the discipline.

It is a useful pair to remember when you write your own `provide*` function, because the lesson
generalises: if your function must only ever be called at the application root, returning
`makeEnvironmentProviders([...])` is not a formality, it is the only thing that enforces it.
[04 · Writing your own provide function](04-writing-your-own-provide-function.md) is where that is
worked through.

## The guide contradicts itself, and the source wins

angular.dev's [Introduction to Angular animations](https://angular.dev/guide/animations/overview)
opens with, verbatim:

> *"IMPORTANT: The `@angular/animations` package is now deprecated. The Angular team recommends
> using native CSS with `animate.enter` and `animate.leave` for animations for all new code. Learn
> more at the new enter and leave [animation guide]. Also see [Migrating away from Angular's
> Animations package] to learn how you can start migrating to pure CSS animations in your apps."*

and then, further down the same page:

> *"Import `provideAnimationsAsync` from `@angular/platform-browser/animations/async` and add it to
> the providers list in the `bootstrapApplication` function call."*

The deprecation tag in source is dated and specific — `20.2`, intent to remove in **v23** — and it
wins. The instruction is residue from before the deprecation, left in place because the page still
has to explain the package to the many applications that use it.

🔴 **This is the third documentation-versus-source disagreement in this topic**, after
[10g · JSONP](10g-jsonp-and-the-deprecated-end.md) — where angular.dev documents
`withJsonpSupport()` neutrally while the tag names an XSS risk — and
[11c](11c-incremental-hydration-and-event-replay.md), where the hydration guide still leads with
`withEventReplay()`. The pattern is consistent enough to be a working rule: **when a guide page and
a dated `@deprecated` tag disagree, the tag is newer.** Guides are edited by hand, per page, and the
deprecation lands in one commit across the whole package.

## Two v22 behaviour changes for code that has not migrated

From the v22.0.0 CHANGELOG's breaking changes, verbatim:

> *"Leave animations are no longer limited to the element being removed."*
> *"change AnimationCallbackEvent.animationComplete signature"*

Worth knowing because they affect the applications *least* likely to be watching — the ones still on
the deprecated package. A leave animation that previously applied only to the removed element now
has a wider scope, and any code typed against `AnimationCallbackEvent.animationComplete` needs its
signature updated.

## Gotchas

**★ Symptom: `provideAnimationsAsync()` is deprecated but the animations guide tells you to add
it.** Cause: angular.dev's overview page carries both the deprecation IMPORTANT and the installation
instruction. Fix: believe the source. `@deprecated 20.2 … Intent to remove in v23` is dated and
specific; the instruction predates it. New code uses `animate.enter` / `animate.leave`.

**★ Symptom: `provideAnimations()` compiled inside a component's `providers` array and something is
subtly wrong at runtime.** Cause: it returns `Provider[]`, not `EnvironmentProviders`, so the brand
that makes root-only a compile error does not apply, and you have created a component-scoped
animations engine. Fix: it belongs in the application config if it belongs anywhere — and in v22 the
real fix is the CSS migration. See [03](03-environmentproviders-vs-provider.md).

**★ Symptom: you migrate to `animate.enter` and leave `provideAnimationsAsync()` in the config
"just in case".** Cause: reasonable caution, wrong outcome — the whole point of the migration is
that the provider becomes unnecessary, and leaving it keeps `@angular/animations` in the dependency
graph and therefore in the bundle. Fix: remove the provider in the same change as the last template
migration, and let the build tell you if something still needs it.

**★ Symptom: you cannot find the replacement `provide*` function for animations.** Cause: there is
not one. Every deprecation in this family points at template syntax, not at another provider. Fix:
stop looking for a provider — the migration is `animate.enter` / `animate.leave` in templates plus
CSS, and the correct end state has nothing animations-related in `app.config.ts`.

**★ Symptom: a leave animation started affecting elements it did not touch before, after upgrading
to v22.** Cause: the CHANGELOG breaking change — *"Leave animations are no longer limited to the
element being removed."* Fix: scope the animation deliberately rather than relying on the old
implicit limit. ⚠️ This is a behaviour change in the deprecated package, so it lands on exactly the
applications that have not migrated.

**★ Symptom: TypeScript errors on an animation completion callback after a v22 upgrade.** Cause:
*"change AnimationCallbackEvent.animationComplete signature"*, also from the v22.0.0 breaking
changes. Fix: update the callback's type. Take it as a prompt: the package is being changed while
deprecated, which is a reason to migrate rather than to keep patching.

**★ Symptom: you pass `'noop'` and cannot remember what it does.** Cause: the parameter is
documented in one line — *"@param type pass `'noop'` as argument to disable animations"* — and the
golden types it `type?: 'animations' | 'noop'`. Fix: it is the disable switch, most often used in
tests. If that is why you have it, note that the migration removes the need for the switch too:
CSS animations are disabled by the same mechanisms as any other CSS.

## Interview questions

**★ `provideAnimations()` returns `Provider[]` while `provideAnimationsAsync()` returns
`EnvironmentProviders`. Why does that difference matter?**
Because `EnvironmentProviders` is the brand that makes "this is root-only" a compile-time fact — a
component's `providers` array is typed `Provider[]` and will not accept it. The eager animations
functions predate that discipline, so they can be dropped into a component's providers and will
compile, giving you a component-scoped animations engine nobody intended. It illustrates that the
type-level guarantee described in chunk 03 is only as strong as each provider function's return
type.

**★ Every animations provider is deprecated and none of them has a replacement provider. What is the
migration, and how much time do you have?**
The migration is to native CSS driven by the `animate.enter` and `animate.leave` template syntax;
the correct end state has nothing animations-related in the provider array at all. The runway is
readable from the tag: deprecated in `20.2` with *"Intent to remove in v23"*, so on 22.1.5 you have
approximately one major release. Two v22.0.0 breaking changes already landed inside the deprecated
package, which is a reasonable argument for not waiting.

**★ angular.dev's animations overview both announces the deprecation and instructs you to add
`provideAnimationsAsync()`. How do you decide which to follow, and can you generalise the rule?**
Follow the source. A `@deprecated` tag carries a version and an intent-to-remove, so it is dated
evidence; a guide sentence is undated prose that may predate it. The generalisation this topic
supports with three independent cases — JSONP in [10g](10g-jsonp-and-the-deprecated-end.md), event
replay in [11c](11c-incremental-hydration-and-event-replay.md), and animations here — is that a
deprecation lands in one commit across a package while guide pages are updated individually and
later, so the tag is almost always the newer statement.

---

← Prev: [The contradiction checks](11e-the-contradiction-checks.md) · Index: [Topic index](README.md) · Next → [11g · The standalone core providers](11g-the-standalone-core-providers.md)
