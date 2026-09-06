---
title: "Only the primary block of a `@defer` gets a `dependencyResolverFn` — `@placeholder`, `@loading` and `@error` are ordinary embedded templates in the host component's own slot range, so a design-system spinner in a placeholder can cancel the entire benefit of the block it decorates"
sidebar_label: "11d · What `@defer` never defers"
sidebar_position: 11.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [Deferred loading with `@defer`](https://angular.dev/guide/templates/defer) — and `angular/angular` at tag `v22.1.5`: [`packages/core/src/defer/instructions.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/defer/instructions.ts), [`packages/compiler/src/render3/view/compiler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler/src/render3/view/compiler.ts), [`packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts) — and the [v22.0.0 CHANGELOG](https://github.com/angular/angular/blob/main/CHANGELOG.md) for the incremental-hydration default.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**A `@defer` block has four sub-blocks and exactly one of them is deferred.** The `ɵɵdefer`
instruction takes each sub-block as a *template slot index* in the host component's own
declaration range, and only the primary index has a `dependencyResolverFn` beside it. So the
placeholder, the loading state and the error state are compiled exactly like any other template
in the file — eagerly, with their dependencies in the initial bundle. That is not a policy
decision that could have gone the other way; it falls straight out of the instruction's
signature. This chunk is also where the trigger sits in the story: triggers decide *when* the
chunk is requested, never *whether* it exists.

## The instruction signature is the whole argument

`packages/core/src/defer/instructions.ts`, the `ɵɵdefer` docstring, verbatim:

```ts
/**
 * Creates runtime data structures for defer blocks.
 *
 * @param index Index of the `defer` instruction.
 * @param primaryTmplIndex Index of the template with the primary block content.
 * @param dependencyResolverFn Function that contains dependencies for this defer block.
 * @param loadingTmplIndex Index of the template with the loading block content.
 * @param placeholderTmplIndex Index of the template with the placeholder block content.
 * @param errorTmplIndex Index of the template with the error block content.
 * @param loadingConfigIndex Index in the constants array of the configuration of the loading.
 *     block.
 * @param placeholderConfigIndex Index in the constants array of the configuration of the
 *     placeholder block.
 * @param enableTimerScheduling Function that enables timer-related scheduling if `after`
 *     or `minimum` parameters are setup on the `@loading` or `@placeholder` blocks.
 * @param flags A set of flags to define a particular behavior (e.g. to indicate that
 *              hydrate triggers are present and regular triggers should be deactivated
 *              in certain scenarios).
 *
 * @codeGenApi
 */
export function ɵɵdefer(
  index: number,
  primaryTmplIndex: number,
  dependencyResolverFn?: DependencyResolverFn | null,
  loadingTmplIndex?: number | null,
  placeholderTmplIndex?: number | null,
  errorTmplIndex?: number | null,
  loadingConfigIndex?: number | null,
  placeholderConfigIndex?: number | null,
  enableTimerScheduling?: typeof ɵɵdeferEnableTimerScheduling | null,
  flags?: TDeferDetailsFlags | null,
) {
```

Four `*TmplIndex` parameters, one `dependencyResolverFn`, and the resolver sits immediately after
`primaryTmplIndex` because it belongs to it. The other three sub-blocks are *just* template slot
indices — ordinary embedded templates living in the component's own `decls` range, which is the
slot model of [07b](07b-the-view-is-an-array-decls-and-vars.md). Their dependencies are compiled
exactly like any other template dependency in the file.

The guide says the same thing from the outside:

> *"Keep in mind the dependencies of the placeholder block are eagerly loaded."*

and repeats it for `@loading` and `@error`. The practical consequence is blunt: **a placeholder
built from your design-system components can cancel the entire benefit of the block it
decorates.**

```html
@defer (on viewport) {
  <heavy-chart [series]="series" />
} @placeholder {
  <div class="chart-skeleton" aria-hidden="true"></div>
}
```

Plain markup and a CSS class cost nothing. `<ds-card><ds-spinner /></ds-card>` drags `DsCard` and
`DsSpinner` — and whatever they import — into the eager bundle, and does it silently, because
eager loading of a placeholder is correct behaviour rather than a mistake.

## Triggers decide *when*, not *whether*

The bundling story is settled at compile time; triggers are a runtime concern. A `@defer` block
with `on immediate` still gets a `dependencyResolverFn` full of dynamic imports and still produces
a separate chunk — it just requests that chunk as soon as the surrounding view renders. That is a
genuinely useful configuration: it takes a large component out of the initial chunk without
delaying it behind an interaction. Prefetch triggers (`prefetch on idle`, `prefetch on hover`) run
the same resolver earlier and store the result; they change scheduling, not emission.

⚠️ Angular's documentation states the per-dependency dynamic import as a property of the block, not
of the trigger, and I could find no sentence in the guide that makes an exception for any trigger.
The claim above therefore follows from the emit path rather than from an explicit doc sentence —
treat it as a reading of `compileDeferResolverFunction`, which never inspects the trigger.

Triggers do get compile-time checks of their own, and they are about *coherence*, not bundling.
From `error_code.ts` doc comments, verbatim:

- **NG8010** `INACCESSIBLE_DEFERRED_TRIGGER_ELEMENT` — *"The trigger of a `defer` block cannot
  access its trigger element, either because it doesn't exist or it's in a different view."*
- **NG8019** `DEFER_IMPLICIT_TRIGGER_MISSING_PLACEHOLDER` — *"An `@defer` block with an implicit
  trigger does not have a placeholder"*
- **NG8020** `DEFER_IMPLICIT_TRIGGER_INVALID_PLACEHOLDER` — *"The `@placeholder` for an implicit
  `@defer` trigger is not set up correctly"* — its example is a placeholder with multiple root
  nodes
- **NG8021** `DEFER_TRIGGER_MISCONFIGURATION` — *"Raised when an `@defer` block defines unreachable
  or redundant triggers. Examples: multiple main triggers, 'on immediate' together with other
  mains or any prefetch, prefetch timer delay that is not earlier than the main timer, or an
  identical prefetch"*

NG8021 is an **extended diagnostic** and is new in v22 — the CHANGELOG entry is *"Adds warning for
prefetch without main defer trigger"* (commit `7f9450219f`). Extended diagnostics are warnings by
default; promoting them to errors is chunk 15's subject.

## On the server, the primary block does not render at all

Guide, verbatim:

> *"By default, when rendering an application on the server (either using SSR or SSG), defer blocks
> always render their `@placeholder` (or nothing if a placeholder is not specified) and triggers are
> not invoked. On the client, the content of the `@placeholder` is hydrated and triggers are
> activated."*

So the placeholder is not merely eagerly *bundled* — on a server-rendered page it is the markup
your users actually see first, and the primary block's chunk is not requested until a client-side
trigger fires.

⚠️ **A version note the guide has not caught up with.** Incremental hydration is on by default in
v22 when `provideClientHydration` is used, and `withIncrementalHydration` is deprecated; the
CHANGELOG's v22.0.0 platform-browser entry is *"make incremental hydration default behavior"*
(commit `68628dd45b`). The guide sentence still reads as though you *"can enable the Incremental
Hydration feature"*. Opt out with `withNoIncrementalHydration()` rather than by omitting anything.

## Gotchas

**★ Symptom: you deferred a heavy chart, the chunk splits correctly, and the initial bundle barely
shrinks.** Cause: the `@placeholder` (or `@loading`, or `@error`) is built from components, and
those are compiled as ordinary eager template dependencies of the host component. Fix: make the
non-primary blocks plain markup, and if you need a real skeleton component, defer *it* too or
accept the cost knowingly:

```html
@defer (on viewport) {
  <heavy-chart [series]="series" />
} @loading (after 100ms; minimum 300ms) {
  <div class="skeleton skeleton--chart"></div>
} @error {
  <p role="alert">The chart could not be loaded.</p>
}
```

**★ Symptom: an SSR page shows the placeholder and never the real content until the user
interacts, and you expected the server to render the primary block.** Cause: the documented server
behaviour — defer blocks *"always render their `@placeholder` … and triggers are not invoked"* on
the server. Fix: this is the design; choose the placeholder as though it were your above-the-fold
markup, because on a server-rendered page it is. If the content genuinely must be in the server
HTML, it does not belong in a `@defer` block.

**★ Symptom: you add `prefetch on idle` to a block with no main trigger and get a build warning you
have never seen.** Cause: NG8021 `DEFER_TRIGGER_MISCONFIGURATION`, new in v22 — *"Raised when an
`@defer` block defines unreachable or redundant triggers"*, whose listed examples include a
prefetch with no reachable main trigger and `on immediate` combined with anything else. Fix: give
the block a main trigger, or drop the prefetch. It is an extended diagnostic, so it is a warning
unless you have promoted it.

**Symptom: a `@defer` block with an implicit trigger reports a diagnostic about its placeholder.**
Cause: NG8019 / NG8020 — an implicit trigger needs a placeholder to attach to
(*"An `@defer` block with an implicit trigger does not have a placeholder"*), and that placeholder
must have a single root node (*"The `@placeholder` for an implicit `@defer` trigger is not set up
correctly"*). Fix: give the placeholder exactly one root element:

```html
@defer (on interaction) {
  <heavy-chart [series]="series" />
} @placeholder {
  <button type="button" class="chart-stub">Show chart</button>
}
```

**Symptom: a trigger element referenced by `on hover(ref)` produces NG8010 even though the
reference exists in the file.** Cause: *"the trigger of a `defer` block cannot access its trigger
element, either because it doesn't exist or it's in a different view."* A template reference
declared inside another `@if`, `@for` or `<ng-template>` is in a different view, and views are
separate address spaces ([07b](07b-the-view-is-an-array-decls-and-vars.md)). Fix: move the
reference into the same view as the `@defer` block, or into the block's own `@placeholder`, which
is the case the implicit trigger exists for.

**Symptom: you add `@loading (after 100ms; minimum 300ms)` to avoid a flash and the block now feels
slower than it did before you deferred it.** Cause: both parameters are *timers*, and `ɵɵdefer`
carries a parameter whose only job is to switch timer scheduling on when they are present —
*"@param enableTimerScheduling Function that enables timer-related scheduling if `after` or
`minimum` parameters are setup on the `@loading` or `@placeholder` blocks."* A block whose chunk
arrives faster than the timers you configured can only end up slower. Fix: add them one at a time
and check the effect against a throttled network profile rather than configuring both by reflex.
⚠️ The exact semantics of `after` versus `minimum` are defined in the `@defer` guide's trigger
section, which this page did not quote; what the source settles is only that both are timers and
that they apply to `@loading` and `@placeholder`.

## Interview questions

**★ A colleague puts the app's standard loading spinner component into `@placeholder` and reports
that deferring saved nothing. What happened?**
The four sub-blocks of a `@defer` block are ordinary embedded templates identified by slot index in
the `ɵɵdefer` call; only the primary block gets a `dependencyResolverFn`. So the placeholder's
components are compiled as eager template dependencies of the host, exactly as if they were used
outside the block, and the documentation says so explicitly — *"Keep in mind the dependencies of
the placeholder block are eagerly loaded."* If the spinner pulls in a design-system module, that
module is now in the initial bundle. The fix is plain markup in the non-primary blocks.

**★ Does `@defer (on immediate)` produce a separate chunk, and if so, why would anyone use it?**
Yes — the emission of the resolver function is independent of the trigger;
`compileDeferResolverFunction` never inspects it. `on immediate` requests the chunk as soon as the
surrounding view renders, so it removes the component from the initial bundle without adding an
interaction delay. It is the right tool for something large that is definitely needed but not
needed *first* — you trade a second request for a smaller critical path.

**★ How does `@defer` behave during server-side rendering, and what does that imply for how you
write the placeholder?**
The server renders the `@placeholder` — or nothing, if there is none — and does not invoke
triggers; the client hydrates that placeholder and activates the triggers. So the placeholder is
your server-rendered, above-the-fold markup for that region. It should be sized and styled to
match what replaces it, it should be plain markup so it costs no bundle, and anything that must
appear in the initial HTML for SEO or first paint must not be inside the primary block at all.

**Why is there a compile-time diagnostic for trigger *configuration* but none for a dependency that
failed to defer?**
Because they are different kinds of fact. A misconfigured trigger — two main triggers, a prefetch
timer later than the main timer — is unreachable or contradictory *within the template the compiler
is looking at*, so it can be reported with certainty as NG8021. A dependency that fails to qualify
for deferral is, from the compiler's point of view, a legal program: the `else` branch of
`compileDeferResolverFunction` emits a class reference, `DependencyResolverFn`'s type admits it,
and the block works. Angular chose not to warn on a supported state; the only place it does warn is
`deferredImports`, where you asserted an intent it could not honour ([11c](11c-diagnosing-a-defer-that-did-not-split.md)).

---

← Prev: [11c · Diagnosing a `@defer` that did not split](11c-diagnosing-a-defer-that-did-not-split.md) · Index: [Topic index](README.md) · Next → **12 · Ivy and locality** *(not written yet)*
