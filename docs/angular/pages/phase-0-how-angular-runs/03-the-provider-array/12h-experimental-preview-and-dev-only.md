---
title: "Triage step five is the only one that has to be repeated every release — experimental and developer-preview providers owe you no deprecation period, dev-only providers are not all removed from production, and the public-API golden's `@public` tag is not Angular's stability marker"
sidebar_label: "12h · Experimental and dev-only"
sidebar_position: 12.7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/application/stability_debug_impl.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/stability_debug_impl.ts),
> [`core/src/ng_reflect.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/ng_reflect.ts),
> [`core/src/webmcp/provide_tools.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/webmcp/provide_tools.ts),
> [`core/src/application/create_application.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/create_application.ts),
> and [`goldens/public-api/core/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/core/index.api.md).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The other four triage steps are done once and stay done. This one has to be redone at every
upgrade, because what makes these entries questionable is not where they are but what they promise
— and the promise changes underneath you.** Three separate things get grouped here because they
share one property: the line looks completely ordinary in `app.config.ts`, and there is no
mechanical check anywhere that will flag it. An experimental feature can change shape in a minor
release. A developer-preview feature can too. And a dev-only provider may still be in your
production bundle, by explicit design.

## The tag is the contract, and it lives in the JSDoc

| Call | Tag at `v22.1.5` | Where it is covered |
|---|---|---|
| `provideExperimentalWebMcpTools()` | `@experimental` | [11g](11g-the-standalone-core-providers.md) |
| `withExperimentalAutoCleanupInjectors()` | `@experimental 21.1` | [08g](08g-tracing-and-the-experimental-end.md) |
| `withExperimentalPlatformNavigation()` | `@experimental 21.1` | [08g](08g-tracing-and-the-experimental-end.md) |
| `withViewTransitions()` | `@developerPreview 19.0` | [08d](08d-view-transitions-and-scrolling.md) |
| `provideCheckNoChangesConfig()` | `@developerPreview 20.0` | [05e](05e-provide-check-no-changes-config.md) |
| `provideStabilityDebugging()` | `@publicApi 21.1`, **not stripped from production** | [11g](11g-the-standalone-core-providers.md) |
| `provideNgReflectAttributes()` | `@publicApi`, dev-mode-only effect | [11g](11g-the-standalone-core-providers.md) |

What each tag actually promises, which is the part people get wrong:

- **`@publicApi`** — semantic-versioning guarantees apply. It will not change shape in a minor, and
  a removal is preceded by a `@deprecated` period.
- **`@developerPreview`** — the API is complete enough to use and explicitly outside those
  guarantees. The number after it (`19.0`, `20.0`) is when the preview *started*, not when it
  becomes stable.
- **`@experimental`** — no promise about the future at all. It can change or disappear in a minor.
  Angular usually labels these twice, in the tag and in the identifier, so a call site announces it.
- **`@deprecated`** — a promise about the *past*: it works today, and there is a stated direction
  away from it. Counter-intuitively this is the *safest* of the four to have in a config, because
  it is the only one with a removal you can plan against.

🔴 **Do not read the public-API golden as a stability marker.** `goldens/public-api/core/index.api.md`
annotates every export with an API-Extractor release tag, and at `v22.1.5`
`provideCheckNoChangesConfig` is marked `// @public` there while its own JSDoc in source says
`@developerPreview 20.0`. **The JSDoc wins.** The golden is a machine-generated record of the
exported surface, not a statement about the framework's commitments, and citing it as evidence that
something is stable is a mistake that reads as thoroughly researched.

## Dev-only is not one thing — it is three

The word "dev-only" hides three different behaviours, and only one of them means "free in
production".

**Dev-only in effect, and the provider set collapses.** `provideCheckNoChangesConfig()` returns an
empty provider set in a production build — the configuration it carries has nothing to configure,
because the checks it configures do not exist there. Leaving the call in costs you the import and
nothing else, but it also means a production incident cannot be investigated with it.
[05f](05f-check-no-changes-in-production-and-developer-preview.md) has the detail.

**Dev-only in effect, but the function is real.** `provideNgReflectAttributes()`, verbatim from
[`ng_reflect.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/ng_reflect.ts):

> *"Note: this is a dev-mode only setting and it will have no effect in production mode. In
> production mode, the `ng-reflect-*` attributes are *never* produced by Angular."*

⚠️ And the deprecation in that same doc comment is about the **attributes**, not the function — the
golden marks the function plain `// @public` and it carries no `@deprecated` tag. Reporting the
function as deprecated is a claim a reviewer will check and find false; make the argument on the
attributes, which is where the deprecation actually is.

**Not dev-only at all, despite being a debugging tool.** `provideStabilityDebugging()`, verbatim
from
[`stability_debug_impl.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/stability_debug_impl.ts):

> *"IMPORTANT: Neither the zone.js task tracking plugin nor this utility are removed from production
> bundles. They are intended for temporary use while debugging stability issues during development,
> including for optimized production builds."*

That is not a warning so much as a design statement — it is meant to be usable against an optimised
build, which is where a stability bug is most likely to appear and least likely to reproduce
locally. But it means the only thing that removes it is you.

## The fix, in code

For anything genuinely diagnostic, the honest answer is **delete the call when you are done**. When
you need it conditionally, the framework's own idiom is a guarded spread —
`create_application.ts` builds its own provider list exactly this way:

```ts
    const allAppProviders = [
      provideZonelessChangeDetectionInternal(),
      errorHandlerEnvironmentInitializer,
      ...(ngDevMode ? [validAppIdInitializer] : []),
      ...(appProviders || []),
    ];
```

so in application code:

```ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    ...(ngDevMode ? [provideStabilityDebugging(), provideNgReflectAttributes()] : []),
  ],
};
```

⚠️ **Two honest limits on that pattern.** It removes the *call* in a production build where
`ngDevMode` resolves to a falsy constant, but whether the optimiser then drops the imported
implementation depends on your build being able to fold the constant — the framework's own build
does this for its packages, and I did not verify the behaviour for arbitrary application code at
v22. And `ngDevMode` is not universally defined: it throws `ReferenceError: ngDevMode is not
defined` in a plain Node script or an unconfigured unit test, which
[04](04-writing-your-own-provide-function.md) covers. Where you want certainty rather than
probability, delete the line.

For experimental and preview entries the fix is not code at all — it is a review cadence. Put every
one of them in one place in the config with a comment naming the tag, and re-read that block on
each major upgrade. A tag is not a warning your build will repeat.

## Gotchas

**★ Symptom: `provideStabilityDebugging()` is in your production bundle.** Cause: by design. The
JSDoc's IMPORTANT states outright that neither it nor the Zone.js task-tracking plugin is removed
from production bundles, deliberately, so it can be used against an optimised build. Fix: remove
the call when the debugging session ends — nothing else will. Also check whether you needed it:
under SSR, `provideClientHydration()` installs it in dev mode already
([11g](11g-the-standalone-core-providers.md)).

**★ Symptom: an `@experimental` provider changed shape or disappeared in a minor upgrade and your
build broke.** Cause: `@experimental` owes no deprecation period; the usual "one major of runway"
expectation does not apply to it. Fix: pin your expectations to the tag, not to the version number,
and re-read every experimental entry at each upgrade. Angular usually encodes the warning in the
identifier as well — `provideExperimentalWebMcpTools`, `withExperimentalAutoCleanupInjectors` — so
grepping for `Experimental` in your config finds most of them.

**★ Symptom: you cited the public-API golden to argue a provider is stable, and were wrong.**
Cause: the golden's `// @public` is API-Extractor's release tag for the exported surface, not
Angular's stability marker. `provideCheckNoChangesConfig` is `// @public` in the golden and
`@developerPreview 20.0` in its own JSDoc. Fix: read the JSDoc in the source file; when the two
disagree, the JSDoc wins.

**★ Symptom: `provideCheckNoChangesConfig()` has no effect in a production build.** Cause: it
returns an empty provider set there — the checks it configures do not run in production at all, so
there is nothing to configure. Fix: nothing to fix, but do not plan on using it to diagnose a
production-only issue; [05f](05f-check-no-changes-in-production-and-developer-preview.md) explains
what is available instead.

**★ Symptom: `ng-reflect-*` attributes are missing in production and your end-to-end tests select
on them.** Cause: the JSDoc is explicit — *"In production mode, the `ng-reflect-*` attributes are
*never* produced by Angular"* — and `provideNgReflectAttributes()` is a dev-mode-only setting. Fix:
select on a `data-testid` instead. The attributes are additionally described as deprecated, so this
is worth doing before the removal rather than after.

**★ Symptom: you searched for a `@deprecated` tag on `provideNgReflectAttributes` to justify
removing it, and found none.** Cause: the deprecation in the doc comment is about the `ng-reflect-*`
**attributes**, not the function; the golden marks the function plain `// @public`. Fix: make the
argument on the attributes. Do not report the function as deprecated — a reviewer who checks will
find it is not, and the rest of your case loses credibility with it.

**★ Symptom: a developer-preview feature has been in your config for two years and you assumed it
graduated.** Cause: the number in `@developerPreview 19.0` is when the preview *began*; nothing
announces graduation in your build, and `withViewTransitions` still carries the tag at v22.1.5.
Fix: check the current source's JSDoc at your pinned version rather than trusting the memory of
when you added it. This is exactly the entry that a per-release review of the config catches and
nothing else does.

**★ Symptom: `ngDevMode is not defined` after wrapping providers in a `ngDevMode ?` guard.**
Cause: `ngDevMode` is a build-time global the CLI defines; it is not present in a plain Node script
or an unconfigured test runner. Fix: [04](04-writing-your-own-provide-function.md) covers the
guarding pattern. If the config is evaluated outside a CLI build — a script, a custom test harness —
use `typeof ngDevMode !== 'undefined' && ngDevMode` or drop the guard and delete the line instead.

**★ Symptom: a debugging provider you added is duplicated because another provider already added
it.** Cause: `provideClientHydration()` installs `provideStabilityDebugging()` behind its own
dev-mode ternary, so under SSR you have it without asking. Fix: check what your existing `provide*`
calls already include before adding a diagnostic by hand — the composite providers in this topic
add more than their names suggest, which [11](11-hydration-animations-and-the-rest.md) inventories.

## Interview questions

**★ The public-API golden marks a provider `// @public`. Is it stable?**
Not necessarily, and this is a genuinely load-bearing distinction. The golden is generated by
API-Extractor and its tags describe the *exported surface* — `@public` there means "part of the
package's public entry point", which is a packaging fact. Angular's stability commitment lives in
the JSDoc on the declaration: `@publicApi`, `@developerPreview`, `@experimental`, `@deprecated`. The
two can disagree, and at v22.1.5 they do: `provideCheckNoChangesConfig` is `// @public` in the
golden and `@developerPreview 20.0` in its source. The JSDoc wins. The practical consequence is that
"I checked the public API file" is not a sufficient answer to "is this safe to depend on" — you have
to open the source file, and if you are quoting evidence to a colleague, quote the JSDoc.

**★ What is your policy for experimental providers in something you ship to customers?**
Treat the tag as the contract and design around what it does not promise. `@experimental` means no
deprecation period is owed, so anything depending on it must be something you can remove in an
afternoon: isolated behind your own function, not woven through feature code, and covered by a test
that fails loudly rather than degrades. Keep every such entry in one visibly-marked block of the
config with the tag quoted in a comment, so the review at each upgrade is a single place rather than
a search. And be honest about the trade rather than banning them outright — several of these
features are genuinely the reason to be on a recent version, and `withViewTransitions` has been in
developer preview since 19.0 without changing. The failure mode to avoid is not using them; it is
forgetting that you did.

**★ Why does `provideStabilityDebugging()` explicitly refuse to be removed from production, when
every other convention in the framework is about stripping debug code?**
Because the bug it exists to diagnose is disproportionately a production bug. An application that
never stabilises is usually held open by a timer, a never-completing observable or a pending
request, and those depend on real network conditions, real data volumes and real user behaviour —
the situation least likely to reproduce on a developer's machine. A diagnostic that vanished in the
optimised build would be useless exactly when it was needed, so the JSDoc says outright that it is
intended for temporary use *"including for optimized production builds"*. The cost is that removal
becomes a human responsibility, which is why it belongs in triage step five: nothing in the build
will ever remind you, and the nine-second threshold means a healthy application produces no output
to remind you either.

**★ Someone says `@deprecated` is the tag to worry about in a provider array. Are they right?**
No — it is the one to worry about *least*, and the inversion is worth stating clearly. A
`@deprecated` provider works today, is covered by semantic-versioning guarantees until it is
removed, and usually names a version or a successor, so it is schedulable work with a known cost.
`@experimental` and `@developerPreview` carry no such promise: the shape can change in a minor, and
nothing in your build announces it. The genuinely dangerous entries are therefore the ones that look
newest, not the ones that look oldest. The one thing to check on a deprecated entry is whether the
stated replacement exists yet, because a deprecation with no successor is a signal to wait rather
than to act.

← Prev: [Registered in the wrong injector](12g-registered-in-the-wrong-injector.md) · Index: [Topic index](README.md) · Next → [Order dependence](13-order-dependence.md)
