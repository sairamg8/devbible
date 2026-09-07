---
title: "`provideClientHydration()` with no arguments is the maximal recommended configuration, not a minimal one — four subsystems come on before the function looks at a single feature you passed"
sidebar_label: "11 · Hydration, animations and the rest"
sidebar_position: 11
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

**Every other `provide*` function in this topic is a switch you turn on. `provideClientHydration()`
is a switch you turn *down*.** Called with no arguments it installs DOM hydration, the HTTP transfer
cache, incremental hydration — and, through incremental hydration, event replay — plus two dev-only
debugging providers you never asked for. Four of its six public features exist to *remove* or
*narrow* something. That inversion is why the two lines you will find in almost every hydration
tutorial written before v22, `withEventReplay()` and `withIncrementalHydration()`, are now at best
redundant and at worst struck through in your editor.

This page reads the body and nothing else, because the body is where the surprises are. What you are
allowed to pass it is [11b · The feature inventory](11b-the-feature-inventory.md); the three
consequences each get their own page after that —
[11c · Incremental hydration and event replay](11c-incremental-hydration-and-event-replay.md),
[11d · The HTTP transfer cache](11d-the-http-transfer-cache.md) and
[11e · The contradiction checks](11e-the-contradiction-checks.md). The rest of what people put in
`app.config.ts` and this topic has not covered yet — the animations family, deprecated in its
entirety, and the standalone `@angular/core` providers that belong to no subsystem — is
[11f](11f-animations-are-deprecated.md) and [11g](11g-the-standalone-core-providers.md).

## What the function does before it looks at your arguments

The whole body, from
[`platform-browser/src/hydration.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/platform-browser/src/hydration.ts):

```ts
export function provideClientHydration(
  ...features: HydrationFeature<HydrationFeatureKind>[]
): EnvironmentProviders {
  const providers: Provider[] = [];
  const featuresKind = new Set<HydrationFeatureKind>();

  for (const {ɵproviders, ɵkind} of features) {
    featuresKind.add(ɵkind);

    if (ɵproviders.length) {
      providers.push(ɵproviders);
    }
  }

  const hasHttpTransferCacheOptions = featuresKind.has(
    HydrationFeatureKind.HttpTransferCacheOptions,
  );

  if (typeof ngDevMode !== 'undefined' && ngDevMode) {
    if (featuresKind.has(HydrationFeatureKind.NoHttpTransferCache) && hasHttpTransferCacheOptions) {
      throw new RuntimeError(
        RuntimeErrorCode.HYDRATION_CONFLICTING_FEATURES,
        'Configuration error: found both withHttpTransferCacheOptions() and withNoHttpTransferCache() in the same call to provideClientHydration(), which is a contradiction.',
      );
    }
    if (
      featuresKind.has(HydrationFeatureKind.IncrementalHydration) &&
      featuresKind.has(HydrationFeatureKind.NoIncrementalHydration)
    ) {
      throw new RuntimeError(
        RuntimeErrorCode.HYDRATION_CONFLICTING_FEATURES,
        'Configuration error: found both withIncrementalHydration() and withNoIncrementalHydration() in the same call to provideClientHydration(), which is a contradiction.',
      );
    }
  }

  return makeEnvironmentProviders([
    typeof ngDevMode !== 'undefined' && ngDevMode
      ? provideEnabledBlockingInitialNavigationDetector()
      : [],
    typeof ngDevMode !== 'undefined' && ngDevMode ? provideStabilityDebugging() : [],
    withDomHydration(),
    featuresKind.has(HydrationFeatureKind.NoHttpTransferCache) || hasHttpTransferCacheOptions
      ? []
      : ɵwithHttpTransferCache({}),
    featuresKind.has(HydrationFeatureKind.NoIncrementalHydration)
      ? []
      : ɵwithIncrementalHydration(),
    providers,
    {
      provide: CACHE_ACTIVE,
      useValue: {isActive: true},
    },
    {
      provide: APP_BOOTSTRAP_LISTENER,
      multi: true,
      useFactory: () => {
        const appRef = inject(ApplicationRef);
        const cacheState = inject(CACHE_ACTIVE);

        return () => {
          appRef.whenStable().then(() => {
            cacheState.isActive = false;
          });
        };
      },
    },
  ]);
}
```

Five things are directly readable from that, and together they are the shape of the whole family.

**1. `withDomHydration()` is unconditional.** It is not in the ternaries and there is no public
feature that removes it. Hydration itself is not a feature of `provideClientHydration()`; it is the
function's identity. The way to not have hydration is to not call it.

**2. The HTTP transfer cache is on by default.** `ɵwithHttpTransferCache({})` runs unless you passed
`withNoHttpTransferCache()` **or** `withHttpTransferCacheOptions()`. Note the `||`: passing options
suppresses the default call, because the options feature's own `ɵproviders` — already pushed into
`providers` by the loop — carry the configured version. That has consequences worth their own page:
[11d · The HTTP transfer cache](11d-the-http-transfer-cache.md).

**3. Incremental hydration is on by default.** `ɵwithIncrementalHydration()` runs unless you passed
`withNoIncrementalHydration()`. This is new in v22, is the single largest behavioural change in this
function's history, and is why `withEventReplay()` is now redundant —
[11b](11c-incremental-hydration-and-event-replay.md).

**4. `provideStabilityDebugging()` is installed for you in dev mode.** If you are debugging an
application that will not stabilise under SSR, you very likely already have the debugger. Adding it
by hand is not merely redundant, it is a production cost, because it is deliberately *not* stripped
— [11f](11g-the-standalone-core-providers.md).

**5. `provideEnabledBlockingInitialNavigationDetector()` is the router cross-check.** It is the
mechanism behind the warning [08f · Initial navigation](08f-initial-navigation.md) works through:
combining hydration with `withEnabledBlockingInitialNavigation()` `console.warn`s rather than
throws, and this dev-mode-only provider is the half that lives on the hydration side of that pair.

🔴 **Notice what the two dev-mode ternaries mean structurally.** The function's *provider list* is
different between development and production — not just its validation. A development bootstrap
installs two providers a production bootstrap does not. That is unusual: most `provide*` functions in
this topic guard only their error checks with `ngDevMode` and return an identical provider set either
way. It is also the reason a bug that only reproduces in production can legitimately be a hydration
bug: the injector genuinely holds different contents.

## Gotchas

**★ Symptom: hydration works locally and does nothing in production.** Cause: `provideClientHydration()`
is in `app.config.ts` but not in the providers used to bootstrap on the **server**. The hydration
guide names exactly this, verbatim: *"IMPORTANT: Make sure that the `provideClientHydration()` call
is also included into a set of providers that is used to bootstrap an application on the
**server**."* Fix: check the merge. In a standard CLI SSR setup
`mergeApplicationConfig(appConfig, serverConfig)` means the browser config *is* applied on the
server and the failure does not arise; it shows up in hand-rolled or partially-migrated server entry
points where the two configs were kept separate. The mechanics are **17 · The server config merge**
*(not written yet)*.

**★ Symptom: a `console.warn` about hydration and `enabledBlocking` initial navigation.** Cause:
`provideClientHydration()` and `withEnabledBlockingInitialNavigation()` in the same application.
Fix: drop the router feature. Worked through in full at
[08f · Initial navigation](08f-initial-navigation.md); the hydration-side provider that detects it
is `provideEnabledBlockingInitialNavigationDetector()`, installed by the first dev-mode ternary.

**★ Symptom: your SSR development build logs stability diagnostics you never configured.** Cause:
`provideClientHydration()` installs `provideStabilityDebugging()` in dev mode, so any hydrating app
that fails to stabilise within nine seconds reports itself. Fix: nothing — this is the framework
handing you the diagnosis for free. Read the stack it prints; it names the task holding the
application un-stable. Details in [11f](11g-the-standalone-core-providers.md).

**★ Symptom: a bug reproduces in a production build and not in `ng serve`, and hydration is
involved.** Cause: this function genuinely returns a different provider set in the two modes — the
two dev-mode ternaries add `provideEnabledBlockingInitialNavigationDetector()` and
`provideStabilityDebugging()` that production does not have, and the two contradiction checks are
dev-only as well. Fix: do not assume parity. When triaging a hydration bug, establish which mode
each observation came from before comparing them.

## Interview questions

**★ In v22, what does `provideClientHydration()` with no arguments actually turn on?**
DOM hydration, unconditionally — there is no feature that removes it. The HTTP transfer cache, by
default. Incremental hydration, by default since 22.0. And therefore event replay, because
`ɵwithIncrementalHydration()` includes `withEventReplay()` in its providers. Plus, in dev mode only,
`provideStabilityDebugging()` and `provideEnabledBlockingInitialNavigationDetector()`. The useful
framing is that four of the six public features exist to remove or narrow something, so the bare
call is the maximal recommended configuration rather than a minimal one.

**★ Does `provideClientHydration()` return the same providers in development and production?**
No, and this is worth knowing before you debug one. Two entries are behind `ngDevMode` ternaries —
the blocking-navigation detector and the stability debugger — so the development injector holds two
providers the production injector does not. Most `provide*` functions in Angular guard only their
error messages this way and return an identical set; this one changes its contents. It means
"works in dev, breaks in prod" is a legitimate class of hydration bug rather than an
automatic sign that something else is wrong.

---

← Prev: [JSONP, and the deprecated end](10g-jsonp-and-the-deprecated-end.md) · Index: [Topic index](README.md) · Next → [11b · The feature inventory](11b-the-feature-inventory.md)

---

← Prev: [JSONP, and the deprecated end](10g-jsonp-and-the-deprecated-end.md) · Index: [Topic index](README.md) · Next → [11b · The feature inventory](11b-the-feature-inventory.md)
