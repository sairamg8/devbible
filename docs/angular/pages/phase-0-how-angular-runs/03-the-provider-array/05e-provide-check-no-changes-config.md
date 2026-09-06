---
title: "Angular's after-change-detection verification pass skips the very `OnPush` views it has just refreshed, and `provideCheckNoChangesConfig({exhaustive: true})` is the only supported way to close that blind spot"
sidebar_label: "05e · `provideCheckNoChangesConfig`"
sidebar_position: 5.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`change_detection/provide_check_no_changes_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/provide_check_no_changes_config.ts)
> (both overload JSDoc blocks, quoted verbatim),
> [`goldens/public-api/core/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/core/index.api.md).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`provideCheckNoChangesConfig` is the fourth and last change-detection provider, and the only one
whose entire purpose is to make a *development-time assertion* stronger. It exists because Angular's
after-change-detection verification pass — the one that raises
`ExpressionChangedAfterItHasBeenCheckedError` — has a structural blind spot: change detection
refreshes a view that is marked for check and clears the mark *as part of refreshing it*, so when
Angular walks the tree a second time to prove nothing changed, `OnPush` components are no longer
marked and are skipped. Every such error inside an `OnPush` subtree has therefore been invisible for
the whole life of `OnPush`. This chunk is the blind spot and the configuration surface: two
overloads, four callable shapes, one of which is a compile error. The dev-only body and the
developer-preview tag are [05f](05f-check-no-changes-in-production-and-developer-preview.md); the
`interval` poll is [05g](05g-the-check-no-changes-interval.md).**

## The hole: an unmarked `OnPush` view is refreshed once and verified never

Angular runs change detection, and then in development runs the tree a *second* time and asserts
that no binding produced a different value. That second pass is `checkNoChanges`, and it is where
`ExpressionChangedAfterItHasBeenCheckedError` comes from. The first overload's JSDoc explains, in one
paragraph, why the second pass is weaker than the first:

> *"Used to disable exhaustive checks when verifying no expressions changed after they were checked."*
>
> *"This means that `OnPush` components that are not marked for check will not be checked. This behavior is the current default behavior in Angular. When running change detection on a view tree, views marked for check are refreshed and the flag to check it is removed. When Angular checks views a second time to ensure nothing has changed, `OnPush` components will no longer be marked and not be checked."*

Read the order of operations there, because it is the whole chunk. Pass one finds a marked `OnPush`
view, refreshes it, **and clears the mark as part of refreshing it**. Pass two starts from a tree in
which that view is indistinguishable from an `OnPush` view nothing ever touched — so it is skipped.
The verification is not *disabled* for `OnPush`; it is defeated by the same bookkeeping that makes
`OnPush` fast.

🔴 **"This behavior is the current default behavior in Angular" is the load-bearing sentence.**
`exhaustive: false` is the status quo, so the `{exhaustive: false}` overload configures Angular to do
exactly what it already does. The provider's real purpose is the other overload.

The second overload's JSDoc says what turning it on buys, and what it still misses:

> *"- The exhaustive option will treat all application views as if they were `ChangeDetectionStrategy.Eager`/`Default` when verifying no expressions have changed. All views attached to `ApplicationRef` and all the descendants of those views will be checked for changes (excluding those subtrees which are detached via `ChangeDetectorRef.detach()`). This is useful because the check that runs after regular change detection does not work for components using `ChangeDetectionStrategy.OnPush`. This check is will surface any existing errors hidden by `OnPush` components."*

(The `"This check is will surface"` typo is upstream's at `v22.1.5`; it is quoted verbatim rather
than corrected.) Three things are stated there and all three matter. The scope is **`ApplicationRef`'s
views and their descendants**. `ChangeDetectorRef.detach()` still opts a subtree out. And turning the
option on **surfaces errors that already exist** rather than introducing new ones — the phrase is
*"any existing errors hidden by `OnPush` components"*.

⚠️ **What exhaustive checking is *not*.** It changes the **verification** traversal only — the JSDoc
scopes it with *"when verifying no expressions have changed"*. It does not mark anything for check,
does not make `OnPush` components refresh more often, and cannot repair a screen that is showing a
stale value. It makes a silent wrong render into a reported error, which is a completely different
job.

⚠️ **On the error's identity.** Angular's documentation names it by class —
`ExpressionChangedAfterItHasBeenCheckedError` — and that is what this topic calls it. The
`RuntimeErrorCode` extract used to write these chunks does not carry a numeric code for it, so **no
`NG0…` number is named here**; do not assume one from an older Angular version.

## Four callable shapes, and one of them will not compile

From `goldens/public-api/core/index.api.md` at `v22.1.5` — two overloads, and the difference between
them is not cosmetic:

```ts
// @public
export function provideCheckNoChangesConfig(options: {
    exhaustive: false;
}): EnvironmentProviders;

// @public
export function provideCheckNoChangesConfig(options: {
    interval?: number;
    exhaustive: true;
}): EnvironmentProviders;
```

`interval` exists **only** on the `exhaustive: true` overload. `exhaustive` is required on both —
there is no zero-argument form and no default object, so the discriminant is always written out at
the call site.

| You write | What you get |
|---|---|
| nothing at all | the default: the verification pass runs, unmarked `OnPush` views are skipped |
| `provideCheckNoChangesConfig({exhaustive: false})` | the same thing, spelled out — only meaningful as an override |
| `provideCheckNoChangesConfig({exhaustive: true})` | the verification pass covers the whole attached tree, synchronously, after each change detection run |
| `provideCheckNoChangesConfig({exhaustive: true, interval: 1000})` | that, **plus** a timer that re-runs an exhaustive check every second ([05g](05g-the-check-no-changes-interval.md)) |
| `provideCheckNoChangesConfig({exhaustive: false, interval: 1000})` | **does not compile** — no overload accepts it |
| `provideCheckNoChangesConfig()` | **does not compile** — `exhaustive` is required |

The fifth row is worth dwelling on. That restriction is expressed entirely in the overload
signatures, so it is a **compile-time** failure with no runtime counterpart: the implementation
signature is `{interval?: number; exhaustive: boolean}` and its body would happily build the timer
for `exhaustive: false`. The types are the only thing standing between you and that combination —
which is why a JavaScript caller, or a call laundered through `as any`, can reach a state the public
API does not describe.

Both overloads return `EnvironmentProviders`, so the call is legal in `ApplicationConfig.providers`
and in a route's `providers`, and rejected in a component's — chunk
[03](03-environmentproviders-vs-provider.md) has the acceptance table and both error messages.

## Gotchas

**★ Symptom: you add `{exhaustive: true}` and are immediately buried in
`ExpressionChangedAfterItHasBeenCheckedError` from components that worked yesterday.** Cause: exactly
what the JSDoc promises — *"This check is will surface any existing errors hidden by `OnPush`
components."* The errors were always there; the default verification pass could not see them because
the views had already been unmarked. Fix: fix the bindings, not the flag. The usual culprit is a
template reading something that mutates state as a side effect —

```ts
// ⛔ the template reads it, the getter mutates it: the value differs between the two passes
get label(): string {
  this.renderCount += 1;
  return `${this.name} (${this.renderCount})`;
}

// ✅ derive, never mutate, during rendering
readonly label = computed(() => `${this.name()} (${this.renderCount()})`);
```

**★ Symptom: you turn exhaustive checking on hoping to fix a screen that shows stale data, and the
screen is still stale.** Cause: the option is scoped, in its own JSDoc, to *"when verifying no
expressions have changed"* — the verification traversal, not change detection. Nothing is marked for
check and nothing refreshes more often; you have added an assertion, not a notification. Fix: make
the state notify the scheduler, which in a zoneless application means a signal write:

```ts
// ⛔ nothing notifies: the field changes, the template does not
this.rows.push(row);

// ✅ a signal write marks the view and schedules a refresh
this.rows.update((current) => [...current, row]);
```

**★ Symptom: `provideCheckNoChangesConfig({exhaustive: false, interval: 500})` will not compile.**
Cause: `interval` is declared only on the `exhaustive: true` overload, so no overload matches that
object and it is rejected by the type checker rather than at runtime. Fix: the periodic check exists
only in exhaustive form — say so:

```ts
provideCheckNoChangesConfig({ exhaustive: true, interval: 500 }),
```

**Symptom: `provideCheckNoChangesConfig()` with no arguments will not compile either.** Cause: both
overloads take a required `options` object with a required `exhaustive` property; there is no
zero-argument form and no default, unlike `provideZoneChangeDetection()`
([05b](05b-provide-zone-change-detection-the-opt-out.md)), whose options bag is optional. Fix: state
the discriminant, which is the whole point of the call:

```ts
provideCheckNoChangesConfig({ exhaustive: true }),
```

**Symptom: `{exhaustive: false}` reads like "turn the whole check off" in a code review.** Cause: the
name says *exhaustive*, not *checkNoChanges*. The verification pass still runs after every change
detection cycle in development; the flag only decides whether unmarked `OnPush` views are included.
Fix: delete the call — with no provider at all Angular already behaves as `{exhaustive: false}`,
which the JSDoc calls *"the current default behavior in Angular"*. A provider that restores the
default is the same category of noise as `provideZonelessChangeDetection()` in v22
([05c](05c-the-redundant-opt-in-and-ng0408.md)). It earns its place only when it is overriding an
earlier `{exhaustive: true}` in the same flattened array.

**Symptom: a subtree is provably broken and exhaustive checking never reports it.** Cause: the
documented scope is *"All views attached to `ApplicationRef` and all the descendants of those views …
(excluding those subtrees which are detached via `ChangeDetectorRef.detach()`)"*. A detached view is
outside both change detection and its verification. Fix: stop detaching in order to get
`OnPush`-like behaviour — that is what `OnPush` plus signals is for, and it keeps the subtree inside
the check:

```ts
// ⛔ detached: fast, and invisible to every verification pass
constructor(private cdr: ChangeDetectorRef) {
  this.cdr.detach();
}

// ✅ attached, OnPush, driven by signals — refreshed only when the signal changes
@Component({ changeDetection: ChangeDetectionStrategy.OnPush, template: `{{ rows() }}` })
export class GridComponent {
  readonly rows = input.required<readonly Row[]>();
}
```

**Symptom: you put the call in a component's `providers` and it will not compile.** Cause: it returns
`EnvironmentProviders`, which is a branded type accepted only in environment-level provider arrays —
`ApplicationConfig.providers`, a route's `providers`, `createEnvironmentInjector`. A component or
directive `providers` array takes `Provider` only. Fix: it is an application-wide setting; put it in
`app.config.ts`:

```ts
export const appConfig: ApplicationConfig = {
  providers: [provideCheckNoChangesConfig({ exhaustive: true })],
};
```

## Interview questions

**★ Why does the default `checkNoChanges` pass miss `ExpressionChangedAfterItHasBeenCheckedError`
inside `OnPush` components?**
Because the flag it would use to find them has already been consumed. Change detection refreshes a
view that is marked for check and clears the mark as part of refreshing it. The verification pass
then walks the tree a second time and finds those `OnPush` views unmarked, which is its signal to
skip them — it cannot distinguish "already refreshed this cycle" from "nothing ever touched this".
So the check that exists to prove nothing changed after checking does not visit the components most
likely to have changed something. `{exhaustive: true}` removes that shortcut by treating every
attached view as if it were `ChangeDetectionStrategy.Default` for the verification pass only, which
is why turning it on surfaces errors rather than causing them.

**★ `{exhaustive: false}` is already the default. What is that overload for?**
Two things, one of them real. It documents the setting explicitly at the call site, which is worth
little. The functional use is to override an earlier `{exhaustive: true}` further up the flattened
provider array — that half of the provider is a plain non-multi `useValue`, so the last one wins, the
same override mechanism the whole change-detection family relies on
([05](05-change-detection-providers.md)). The trap is that it overrides *only* that half: if the
earlier call carried an `interval`, the timer is a `multi: true` environment initializer that
accumulates rather than being replaced ([05g](05g-the-check-no-changes-interval.md)).

**★ Does `{exhaustive: true}` make `OnPush` components update more often?**
No, and believing it does is the most expensive misreading of this provider. Its own documentation
scopes the option to *"when verifying no expressions have changed"* — the second, assertion-only
traversal that runs after change detection in development. It marks nothing for check and schedules
nothing. What changes is which views the assertion visits: with it on, the pass treats every attached
view as `Default` and therefore inspects `OnPush` subtrees it would otherwise skip. A stale screen
stays stale; it just stops being silent about it.

**Why is `exhaustive` a required discriminant instead of an optional flag with a default?**
Because the constraint the API needs cannot be expressed with a single optional bag. A signature like
`{exhaustive?: boolean; interval?: number}` would make `{exhaustive: false, interval: 1000}`
type-legal, and that combination has no meaning — the timer's own check is always exhaustive. Two
overloads discriminated on a literal `true`/`false` are what let `interval` exist on one shape and
not the other, and a literal discriminant has to be written to be discriminated on. The cost is that
the trivial call `provideCheckNoChangesConfig()` does not exist; the benefit is that the meaningless
combination is a compile error rather than a support question.

**What does `ChangeDetectorRef.detach()` do to exhaustive checking, and why does that matter for a
performance-tuned screen?**
It removes the subtree from it entirely. The documented scope is all views attached to
`ApplicationRef` and their descendants, *"excluding those subtrees which are detached via
`ChangeDetectorRef.detach()`"*. That matters because `detach()` plus manual `detectChanges()` is a
common tuning move on a heavy grid or chart — precisely the code most likely to contain a subtle
binding bug, and exactly the code the strongest verification Angular offers cannot see. `OnPush` with
signal inputs gives the same "refresh only when I say so" behaviour while staying attached, and
therefore stays inside the check.

---

← Prev: [05d · The polyfill half, and `NoopNgZone`](05d-the-polyfill-half-and-noopngzone.md) · Index: [Topic index](README.md) · Next → [05f · Dev-only, and developer preview](05f-check-no-changes-in-production-and-developer-preview.md)
