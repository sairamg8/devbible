---
title: "Every entry in the provider array ends in one of two operations — a `Map` write the last caller wins, or a push onto an array — and every ordering surprise in `app.config.ts` is really a question about which of the two a given token gets"
sidebar_label: "13 · Order dependence"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — `angular/angular` at tag `v22.1.5`:
> [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts),
> [`core/src/application/create_application.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/create_application.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**There is no ordering *policy* in Angular's provider array. There is one loop and one `Map`.**
`R3Injector`'s constructor walks the array depth-first before a single service is constructed, and
every leaf it reaches lands in exactly one of two code paths: `this.records.set(token, record)`, which
overwrites — so the **last** provider for a token wins — or `multiRecord.multi!.push(provider)`, which
appends — so **every** provider for that token survives, in registration order. Nothing else is going
on. Once you can name which path a token takes, every question of the form *"does it matter whether I
put `provideRouter()` before or after `provideHttpClient()`"* answers itself, and the ones that
genuinely have no answer become obvious too.

This page is the mechanism. The rest of the family is the cases:
[13b](13b-mixing-multi-and-non-multi.md) for the one arrangement that is an outright error,
[13c](13c-last-wins-in-practice.md) and [13d](13d-features-versus-hand-written-providers.md) for the
non-multi collisions, [13e](13e-multi-tokens-append.md) and
[13f](13f-interceptors-and-initializers-append.md) for the multi ones,
[13g](13g-where-order-does-not-matter.md) for the much larger set of arrangements that cannot matter
at all, and [13h](13h-five-collisions-in-one-config.md) for one configuration where five of these
rules are live simultaneously.

## The array is walked once, depth-first, before anything is constructed

From [`core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts),
the constructor — the first thing that happens to your `providers` array:

```ts
  constructor(
    providers: Array<Provider | EnvironmentProviders>,
    readonly parent: Injector,
    readonly source: string | null,
    readonly scopes: Set<InjectorScope>,
  ) {
    super();
    // Start off by creating Records for every provider.
    forEachSingleProvider(providers as Array<Provider | InternalEnvironmentProviders>, (provider) =>
      this.processProvider(provider),
    );
```

and the walker itself, from the same file:

```ts
function forEachSingleProvider(
  providers: Array<Provider | EnvironmentProviders>,
  fn: (provider: SingleProvider) => void,
): void {
  for (const provider of providers) {
    if (Array.isArray(provider)) {
      forEachSingleProvider(provider, fn);
    } else if (provider && isEnvironmentProviders(provider)) {
      forEachSingleProvider(provider.ɵproviders, fn);
    } else {
      fn(provider as SingleProvider);
    }
  }
}
```

Three properties of that function decide everything downstream, and all three are visible in six
lines:

- **It recurses in place.** A nested array is expanded *where it sits*, not appended at the end.
  `[a, [b, c], d]` registers `a, b, c, d` — so `d` beats `b` and `c`, and `a` loses to all of them.
- **`EnvironmentProviders` is unwrapped in place too.** The `ɵproviders` array behind a
  `provideRouter()` or a `provideHttpClient()` call is spliced into the sequence at that call's
  position ([03](03-environmentproviders-vs-provider.md) has the branded type; the point here is that
  the brand is a *marker*, not a barrier).
- **It runs to completion before any provider is used.** Registration is one eager pass;
  construction happens later, on demand.

🔴 **So "position in the array" always means position in the flattened sequence, never position in
the literal you wrote.** Grouping five providers into a helper constant does not move them to the
end, and wrapping them in `makeEnvironmentProviders()` does not give them a scope of their own.

```ts
// The two arrangements below are NOT equivalent, and the reason is `forEachSingleProvider`.
const observability = [
  {provide: ErrorHandler, useClass: SentryErrorHandler},
  provideAppInitializer(() => inject(TelemetryService).start()),
];

// Arrangement A — Sentry wins: the group is expanded at index 0, the plain entry at index 1.
export const configA: ApplicationConfig = {
  providers: [observability, {provide: ErrorHandler, useClass: ConsoleErrorHandler}],
};
// Effective ErrorHandler: ConsoleErrorHandler.

// Arrangement B — the group moved, so the winner moved with it.
export const configB: ApplicationConfig = {
  providers: [{provide: ErrorHandler, useClass: ConsoleErrorHandler}, observability],
};
// Effective ErrorHandler: SentryErrorHandler.
```

## Two operations, and the token decides which one you get

`processProvider`, verbatim (the `ngDevMode` profiler block in the middle of the real function is
not reproduced — everything quoted below is contiguous source apart from that omission):

```ts
  private processProvider(provider: SingleProvider): void {
    provider = resolveForwardRef(provider);
    let token: any = isTypeProvider(provider)
      ? provider
      : resolveForwardRef(provider && provider.provide);

    const record = providerToRecord(provider);

    if (!isTypeProvider(provider) && provider.multi === true) {
      // If the provider indicates that it's a multi-provider, process it specially.
      // First check whether it's been defined already.
      let multiRecord = this.records.get(token);
      if (multiRecord) {
        // It has. Throw a nice error if
        if (ngDevMode && multiRecord.multi === undefined) {
          throwMixedMultiProviderError();
        }
      } else {
        multiRecord = makeRecord(undefined, NOT_YET, true);
        multiRecord.factory = () => injectArgs(multiRecord!.multi!);
        this.records.set(token, multiRecord);
      }
      token = provider;
      multiRecord.multi!.push(provider);
    } else {
      if (ngDevMode) {
        const existing = this.records.get(token);
        if (existing && existing.multi !== undefined) {
          throwMixedMultiProviderError();
        }
      }
    }
    this.records.set(token, record);
  }
```

**The non-multi path — last wins.** Every call ends at `this.records.set(token, record)`. `records`
is a `Map`; a second `set` for the same key discards the first record entirely. There is no merge, no
warning and no diagnostic. Overwriting is not an error condition in Angular's DI — it is the
*mechanism*, and the next section is why.

**The multi path — append, never replace.** The first `multi: true` provider for a token creates a
container record whose factory is `() => injectArgs(multiRecord.multi!)`; every subsequent one is
pushed onto `multi`. Injecting the token later resolves the whole accumulated array, in the order the
providers were registered. Note the deliberate `token = provider;` line just before the push: the
final `this.records.set(token, record)` then keys the *individual* provider's record by the provider
object itself, so the container record under the real token is never clobbered by its own members.

**`resolveForwardRef` runs first, on both the provider and its `provide` key.** A
`forwardRef(() => ApiClient)` is resolved during this walk, not lazily at injection time — so
`forwardRef` solves a *declaration-order* problem in your TypeScript module and changes nothing about
registration order in the array.

## Why your provider beats the framework's, and why that is the right way round

From [`core/src/application/create_application.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/create_application.ts):

```ts
    // Create root application injector based on a set of providers configured at the platform
    // bootstrap level as well as providers passed to the bootstrap call by a user.
    const allAppProviders = [
      provideZonelessChangeDetectionInternal(),
      errorHandlerEnvironmentInitializer,
      ...(ngDevMode ? [validAppIdInitializer] : []),
      ...(appProviders || []),
    ];
```

Your `ApplicationConfig.providers` is spread **last**. Combined with last-wins, that single line is
the whole override story for the application injector: the framework registers its defaults, you
register yours afterwards, and for any non-multi token yours is the record that survives. This is why
`provideZoneChangeDetection()` can turn off a zoneless default that was already provided
([05b](05b-provide-zone-change-detection-the-opt-out.md) asks exactly this question and defers the
answer here), and it is why `{provide: ErrorHandler, useClass: MyHandler}` works without any opt-out
API existing.

⚠️ **And it is why the framework cannot warn you about a duplicate.** A warning on the second `set`
for a token would fire on every legitimate framework override in every application. The absence of a
diagnostic is not an oversight; it is forced by the design.

## Gotchas

**★ Symptom: you extracted a group of providers into a `const` to tidy `app.config.ts` and an
override stopped working.** Cause: `forEachSingleProvider` expands a nested array *in place*, so the
group occupies the position of the constant, not the end of the array. Whatever follows the constant
now overrides what is inside it. Fix: move the constant to the position its contents need, and stop
relying on textual proximity:

```ts
// Before — `observability` was written last in the file, so it "looked" last.
providers: [observability, {provide: ErrorHandler, useClass: ConsoleErrorHandler}]

// After — one ErrorHandler, chosen once, and the group is order-independent again.
const observability = [provideAppInitializer(() => inject(TelemetryService).start())];
providers: [observability, {provide: ErrorHandler, useClass: SentryErrorHandler}]
```

**★ Symptom: you wrapped your own providers in `makeEnvironmentProviders()` expecting them to be
isolated from the rest of the array.** Cause: `isEnvironmentProviders(provider)` causes the walker to
recurse into `provider.ɵproviders` at the same position — the brand controls *where the value may be
written* ([03](03-environmentproviders-vs-provider.md)), not how it is registered. Fix: if you need
isolation, you need a different injector — a route's `providers` — not a different wrapper. See
[15 · Route-level providers](15-route-level-providers.md).

**★ Symptom: a `forwardRef` in the provider array did not delay anything.** Cause: `processProvider`
opens with `provider = resolveForwardRef(provider)` and resolves the `provide` key the same way, both
during the eager registration walk. Fix: use `forwardRef` for what it is for — a class referenced
before its declaration is evaluated — and treat registration order as fixed by array position
regardless.

**★ Symptom: `importProvidersFrom(SomeModule)` overrode a provider you had already written, or
failed to.** Cause: it returns `EnvironmentProviders`, so it is flattened in place like everything
else, and the module's providers land at that argument's position. Fix: place the
`importProvidersFrom(...)` call *before* anything you intend to win, and read
[03](03-environmentproviders-vs-provider.md) for what it costs.

**★ Symptom: two providers for the same token and no warning whatsoever.** Cause: last-wins is the
override mechanism, not a mistake — the framework's own defaults rely on being beaten by your array
via `...(appProviders || [])`. A warning here would fire on every correct application. Fix: enforce
it yourself. One provider per token per file, and where two really must be composed, compose them
explicitly:

```ts
// Instead of two ErrorHandler entries and a silent winner:
{
  provide: ErrorHandler,
  useFactory: () => new CompositeErrorHandler([new SentryErrorHandler(), new ConsoleErrorHandler()]),
}
```

## Interview questions

**★ Two providers for the same token are in one array. Which one wins, and what in the source decides
it?**
The later one, and the deciding line is `this.records.set(token, record)` at the end of
`processProvider`. `records` is a `Map`, so the second `set` for a key replaces the first record
outright — there is no merge step and no diagnostic. The only wrinkle is that "later" means later in
the *flattened* walk performed by `forEachSingleProvider`, which expands nested arrays and
`EnvironmentProviders` values in place, so a provider buried inside a helper constant at index 0 is
earlier than a plain entry at index 1.

**★ The framework registers its defaults before your array. Why is that the correct order, rather
than the framework applying its defaults last as a safety net?**
Because "defaults last" would make overriding impossible without a dedicated opt-out API for every
default. With `...(appProviders || [])` spread last, every framework default is overridable by the
ordinary mechanism, and Angular does not need to ship a `disableX()` for each one — which is exactly
what `provideZoneChangeDetection()` exploits to replace `NoopNgZone` with a real `NgZone`. The cost
is that the same mechanism cannot distinguish a deliberate override from an accidental duplicate,
which is why there is no duplicate-provider warning anywhere in `R3Injector`.

**Does `EnvironmentProviders` create an ordering or scoping boundary?**
No. `forEachSingleProvider` treats it exactly like a nested array — it recurses into `ɵproviders` at
the same position. The brand is a *type-system* device that stops the value being written where it
cannot work (a component's `providers`), which is chunk 03's subject. At registration time an
`EnvironmentProviders` value and a plain nested array are indistinguishable.

**Where does `resolveForwardRef` sit in this, and can it change ordering?**
It is the first statement of `processProvider`, applied to the provider and again to its `provide`
key. Both resolutions happen during the eager registration walk, so a `forwardRef` never defers
registration — it only lets you name a class whose declaration is evaluated later in the module. If
you are reaching for `forwardRef` to fix an ordering problem in the provider array, you are fixing
the wrong thing.

**Why does the multi branch reassign `token = provider` before pushing?**
So that the final `this.records.set(token, record)` — which every path runs — keys the individual
provider's own record by the provider object rather than by the multi token. Without that line the
last member of a multi-provider would overwrite the container record that holds all of them, and
injecting the token would yield one value instead of an array.

← Prev: [Experimental and dev-only](12h-experimental-preview-and-dev-only.md) · Index: [Topic index](README.md) · Next → [Mixing multi and non-multi](13b-mixing-multi-and-non-multi.md)
