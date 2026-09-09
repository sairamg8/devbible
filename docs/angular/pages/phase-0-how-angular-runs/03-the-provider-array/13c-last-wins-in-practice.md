---
title: "Change detection and the HTTP backend are the two last-wins collisions every application already has, and only one of them prints anything — the warning that does exist reads intent markers rather than the token that holds the answer"
sidebar_label: "13c · Last-wins in practice"
sidebar_position: 13.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/platform/bootstrap.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/platform/bootstrap.ts),
> [`core/src/change_detection/scheduling/zoneless_scheduling_impl.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/zoneless_scheduling_impl.ts),
> [`core/src/change_detection/scheduling/ng_zone_scheduling.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/ng_zone_scheduling.ts),
> [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Both cases here are the same `Map.set` from [13](13-order-dependence.md), and exactly one of them
prints anything.** That asymmetry is the useful part: `provideZoneChangeDetection()` beside
`provideZonelessChangeDetection()` warns because somebody wrote a check for that specific pair, and
the backend swap is silent because nobody did. There is no general duplicate detection to fall back
on. [13d](13d-features-versus-hand-written-providers.md) continues with the three collisions that
involve router features and repeated `provide*` calls.

## Change detection — the one pair that warns

The framework prepends this, from
[`zoneless_scheduling_impl.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/zoneless_scheduling_impl.ts):

```ts
export function provideZonelessChangeDetectionInternal(): Provider[] {
  return [
    {provide: ChangeDetectionScheduler, useExisting: ChangeDetectionSchedulerImpl},
    {provide: NgZone, useClass: NoopNgZone},
    {provide: ZONELESS_ENABLED, useValue: true},
  ];
}
```

and `provideZoneChangeDetection()` re-provides two of the same three tokens, from
[`ng_zone_scheduling.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/ng_zone_scheduling.ts):

```ts
  return [
    {provide: ZONELESS_ENABLED, useValue: false},
    {provide: NgZone, useFactory: ngZoneFactory},
```

Your array is spread last into `allAppProviders`, so `false` overwrites `true` and the real `NgZone`
overwrites `NoopNgZone`. That is the entire opt-out — and it is the exact question
[05b](05b-provide-zone-change-detection-the-opt-out.md) hands to this chunk.

Now put both public functions in one array and the order decides the mode:

```ts
// Zone mode wins — provideZoneChangeDetection is later in the flattened walk.
providers: [provideZonelessChangeDetection(), provideZoneChangeDetection({eventCoalescing: true})]

// Zoneless mode wins — same two calls, swapped.
providers: [provideZoneChangeDetection({eventCoalescing: true}), provideZonelessChangeDetection()]
```

Both arrangements print the same warning, from
[`core/src/platform/bootstrap.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/platform/bootstrap.ts):

```ts
    if (typeof ngDevMode === 'undefined' || ngDevMode) {
      if (envInjector.get(PROVIDED_ZONELESS) && envInjector.get(PROVIDED_NG_ZONE)) {
        console.warn(
          formatRuntimeError(
            RuntimeErrorCode.PROVIDED_BOTH_ZONE_AND_ZONELESS,
            'Both provideZoneChangeDetection and provideZonelessChangeDetection are provided. ' +
              'This is likely a mistake. Update the application providers to use only one of the two.',
          ),
        );
      }
    }
```

🔴 **The warning cannot tell you which one won**, because it reads `PROVIDED_ZONELESS` and
`PROVIDED_NG_ZONE` — two marker tokens that both end up `true` — rather than `ZONELESS_ENABLED`,
the token that actually holds the answer. It is a `console.warn`, it is dev-mode only, and the
application boots either way. [05c](05c-the-redundant-opt-in-and-ng0408.md) has the full NG0408
treatment; what belongs here is that the *outcome* is decided by position and the *warning* is not.

**The fix is to delete one call, not to reorder them:**

```ts
// Zone.js needed (a library patches setTimeout, or state lives in plain fields):
providers: [provideZoneChangeDetection({eventCoalescing: true})]

// Zoneless (the v22 default): provide nothing. `ZONELESS_ENABLED`'s own factory returns `true`.
providers: []
```

### The third token in that list never collides

`provideZonelessChangeDetectionInternal()` provides three tokens; `provideZoneChangeDetection()`
re-provides two of them. `{provide: ChangeDetectionScheduler, useExisting: ChangeDetectionSchedulerImpl}`
is written **once**, by the framework, and nothing in the public API writes it again — so it has
exactly one record no matter what you put in the array or in what order.

That is worth noticing for two reasons. It is a worked example of the reading skill this whole
family depends on — *take the set of tokens each function writes and intersect them* — applied to two
functions that look like exact opposites and in fact overlap on two tokens out of three. And it is
the mechanical form of the v21 changelog's claim that *"All Angular applications now consistently use
the same scheduler"*: consistency here is not a policy, it is the absence of a second provider.


## The HTTP backend — silently swapped

From [`common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts),
`provideHttpClient`'s base array ends with:

```ts
    {
      provide: HttpBackend,
      useFactory: () => {
        return inject(FetchBackend);
      },
    },
```

and then:

```ts
  for (const feature of features) {
    providers.push(...feature.ɵproviders);
  }
```

`withXhr()` contributes a non-multi provider for `HttpBackend`, so it lands after the base entry and
wins. `withFetch()` contributes one too. Put both in and **the last argument wins, with no error**:

```ts
// Backend: XHR. No diagnostic — two overrides of one non-multi token is a defined outcome.
provideHttpClient(withFetch(), withXhr())

// Backend: fetch. Same two features, swapped.
provideHttpClient(withXhr(), withFetch())
```

⚠️ Contrast that with the pair `provideHttpClient()` *does* refuse — `withRequestsMadeViaParent()`
together with either backend feature throws at call time, before any injector exists. The asymmetry
is the point: two writes to one token degrade to a defined last-wins, whereas delegating to a parent
handler while also pinning a local backend has no defined meaning.
[09b](09b-inside-provide-http-client.md) has both validation strings verbatim.

## Gotchas

**★ Symptom: `NG0408` warns about both change-detection providers and you cannot tell which mode the
app is in.** Cause: the check reads `PROVIDED_ZONELESS` and `PROVIDED_NG_ZONE` — two intent markers,
both `true` when both functions were called — not `ZONELESS_ENABLED`, which holds the actual mode.
Fix: do not reorder to resolve it; delete one call. If you need Zone.js, keep
`provideZoneChangeDetection()` alone; if you do not, provide neither, because `ZONELESS_ENABLED`'s own
default factory returns `true`.

**★ Symptom: `withFetch()` and `withXhr()` in one call and no error.** Cause: they both write the
non-multi token `HttpBackend`, and two writes to one token is a defined outcome — last wins. The
dev-mode validation in `provideHttpClient` only refuses `withRequestsMadeViaParent()` combined with a
backend feature. Fix: pass one backend feature, and remember that `withFetch()` is deprecated in v22
because `FetchBackend` is already the default.

**★ Symptom: you moved a `provide*` call to "make sure it runs last" and the bug persisted.** Cause:
last-wins applies per token. If the two calls write disjoint tokens, moving them changes nothing at
all — see [13d · Where order does not matter](13g-where-order-does-not-matter.md). Fix: identify the
token first, then check whether it is multi. Reordering without naming the token is guessing.

**★ Symptom: you expected `provideZoneChangeDetection()` to swap the change-detection *scheduler* and
cannot find where it does.** Cause: it does not. It writes `ZONELESS_ENABLED` and `NgZone`;
`ChangeDetectionScheduler` stays bound to `ChangeDetectionSchedulerImpl` in both modes, provided once
by the framework. Fix: stop looking for a per-mode scheduler — in v22 Zone.js is a notification source
feeding the one shared scheduler, which is why the token has no second provider to collide with
([05b](05b-provide-zone-change-detection-the-opt-out.md)).

## Interview questions

**★ `provideZonelessChangeDetection()` and `provideZoneChangeDetection()` in one array: what
determines the mode, and what does NG0408 actually tell you?**
The mode is determined by whichever is later in the flattened array, because both write
`ZONELESS_ENABLED` and `NgZone` as non-multi providers and the last `Map.set` wins. NG0408 tells you
only that both *functions were called* — it is a check on `PROVIDED_ZONELESS` and `PROVIDED_NG_ZONE`,
two marker tokens that record intent, not on the mode token. So it is a genuine "this is likely a
mistake" signal and not a description of the outcome. It is a `console.warn` under `ngDevMode`, so
production gets the same behaviour with no message.

**★ Why does `provideHttpClient(withFetch(), withXhr())` not throw when
`provideHttpClient(withRequestsMadeViaParent(), withXhr())` does?**
Because two providers for one non-multi token have a defined resolution — the later one wins — while
delegating requests to the parent injector's handler *and* pinning a local backend is a contradiction
with no defined resolution. The framework only spends a check where the outcome would otherwise be
undefined; it deliberately does not warn about the ordinary override, because the ordinary override is
how every application beats the framework's own defaults.

**★ `provideZonelessChangeDetection` and `provideZoneChangeDetection` look like exact opposites. How
many tokens do they actually collide on?**
Two out of three. The framework's internal zoneless provider writes `ChangeDetectionScheduler`,
`NgZone` and `ZONELESS_ENABLED`; `provideZoneChangeDetection` writes `ZONELESS_ENABLED` and `NgZone`
and deliberately leaves the scheduler alone. So the mode flag and the zone implementation are
contested and resolved by last-wins, while the scheduler has exactly one provider and cannot be
affected by ordering at all. Working that out is the general procedure in miniature: read what each
function returns, intersect the token sets, and only then ask which branch of `processProvider` the
shared tokens take.

{/* FOOTER */}
