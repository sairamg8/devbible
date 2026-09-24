---
name: research-angular-p0-03-the-provider-array
description: Banked primary-source research for Angular Phase 0 topic 03-the-provider-array — verbatim quotes and URLs for every remaining chunk.
metadata:
  type: reference
---

# Research bank — Angular Phase 0, topic `03-the-provider-array`

Researched **2026-09-06** against `angular/angular` at tag **`v22.1.5`**, `angular/angular-cli`
at tag **`v22.1.7`**, angular.dev, and `registry.npmjs.org`. **No sandbox was run** — every code
block below is *source text read from a repository or a documentation page*, never program output.

**Who this is for.** The 13 unwritten chunks (05–17) of
`/mnt/Storage/Backup/Knowledge/devbible/docs/angular/pages/phase-0-how-angular-runs/03-the-provider-array/`.
Chunks 01–04 are already written. Jump to your own `## Chunk NN` section; read
`## 0 · Facts every chunk needs` first, it is short and load-bearing.

🔴 **Rule for using this bank: if a claim is not in here with a URL, either verify it yourself or
write it as explicitly uncertain.** `## 99 · UNSETTLED` lists what I could not settle.

---

## 0 · Facts every chunk needs

### 0.1 The version spine — re-measured 2026-09-06, do not re-derive

| | |
|---|---|
| `@angular/core` `latest` | **22.1.5**, published **2026-09-03** |
| `next` | 22.2.0-next.5 |
| `@angular/cli` / `@angular/build` / `@angular/ssr` `latest` | **22.1.7** (`next` 22.2.0-next.6) |
| `@angular/material` + `@angular/cdk` | 22.1.5 |
| LTS | v21 → 21.2.22 · v20 → 20.3.30 · v19 out of support at 19.2.25 |
| `@angular/core@22.1.5` peers | `rxjs: ^6.5.3 \|\| ^7.4.0` · `zone.js: ~0.15.0 \|\| ~0.16.0` (**optional**) · `@angular/compiler: 22.1.5` (**optional**) |
| `@angular/compiler-cli@22.1.5` peers | **`typescript: >=6.0 <6.1`** · `@angular/compiler: 22.1.5` |
| engines (`compiler-cli`, `@angular/build`) | `node: ^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0` |
| `@angular/build@22.1.7` test peers | `vitest: ^4.0.8` · `karma: ^6.4.0` · `@angular/ssr: ^22.1.7` · `typescript: >=6.0 <6.1` |

Sources: `https://registry.npmjs.org/-/package/@angular/core/dist-tags`,
`https://registry.npmjs.org/-/package/@angular/cli/dist-tags`,
`https://registry.npmjs.org/@angular/core/22.1.5`,
`https://registry.npmjs.org/@angular/compiler-cli/22.1.5`,
`https://registry.npmjs.org/@angular/build/22.1.7`.

⚠️ **`typescript` is NOT a peer of `@angular/core`.** It is a peer of `@angular/compiler-cli` and
`@angular/build`. Say "TypeScript peer `>=6.0 <6.1`" without attributing it to `core`.

### 0.2 The `> Verified:` line to copy (adapt the source list per chunk)

```markdown
> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [Page title](url) — and `angular/angular` at tag `v22.1.5`:
> [`path/file.ts`](https://github.com/angular/angular/blob/v22.1.5/path/file.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
```

Blob URL shape (verified working): `https://github.com/angular/angular/blob/v22.1.5/<path>`.
CLI: `https://github.com/angular/angular-cli/blob/v22.1.7/<path>`.

🔴 **Reading the source yourself: `raw.githubusercontent.com` 404s in this environment.** Use
`gh api repos/angular/angular/contents/<path>?ref=v22.1.5 -q .content | base64 -d`.

### 0.3 🔴 Filenames already fixed by inbound links — do not rename

Chunks 01–04 already link forward to these exact paths. Using a different filename ships a
dangling link and breaks the production build for every session in this shared checkout.

| # | **Required filename** | Linked from |
|---|---|---|
| 05 | `05-change-detection-providers.md` | 01 |
| 06 | `06-startup-and-error-listener-providers.md` | 01, 03, 04 |
| 10 | `10-http-features.md` | 02 |
| 11 | `11-hydration-animations-and-the-rest.md` | 02 |
| 12 | `12-what-does-not-belong.md` | 01 |
| 13 | `13-order-dependence.md` | 01, 02 |
| 15 | `15-route-level-providers.md` | 01, 04 |
| 17 | `17-the-server-config-merge.md` | 01 |

Chunks **07, 08, 09, 14, 16 have no inbound link yet**, so their filenames are yours to pick.
Suggested, matching the README rows: `07-provide-router-and-the-route-array.md`,
`08-router-features-one-by-one.md`, `09-provide-http-client-and-the-backend.md`,
`14-provided-in-root-vs-the-array.md`, `16-the-injector-error-surface.md`.

`sidebar_position` = the chunk number. `sidebar_label` = `"NN · Short label"` with a **middle dot**.

### 0.4 What chunks 01–04 already said — do not repeat, do not contradict

- **01** — the two CLI-generated files verbatim; `ApplicationConfig` has one property;
  `internalCreateApplication`'s `allAppProviders` list; the three-tier injector table; the
  six-step bootstrap order; `NG0907`.
- **02** — `forRoot` → `provide*` is about **bundler reachability**; `RouterModule.forRoot`'s body;
  the `{ɵkind, ɵproviders}` feature record; the module→function mapping table; `HttpClientModule`
  is `provideHttpClient(withInterceptorsFromDi(), withXhr())`.
- **03** — the `EnvironmentProviders` branded type in full; the acceptance table;
  `NG0207` both variants verbatim; `importProvidersFrom` and its price.
- **04** — writing your own `provideX()`/`withY()`; `makeEnvironmentProviders`; `ngDevMode`
  validation; "throw for a contradiction, warn for a suspicion"; the tree-shaking rule.

### 0.5 🔴 Scope boundary — this topic is WIRING, not DI

Injectors, tokens, resolution order, hierarchies, `inject()`, `@Self`/`@SkipSelf`/`@Host`,
multi-provider record internals: **Phase 6**. Forward-reference, do not teach. Every chunk that
brushes against the mechanism should say so in one line and stop, the way chunks 01 and 03 do.

Phase 6 / Phase 8 / Phase 12 pages do **not exist yet** — write them as
**bold text plus *(not written yet)***, never as links.

### 0.6 The complete v22 `provide*` surface in `@angular/core`

From `goldens/public-api/core/index.api.md` at `v22.1.5`
([link](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/core/index.api.md)) —
copied exactly, including the API-Extractor release tag comment above each:

```ts
// @public
export function provideAppInitializer(initializerFn: () => Observable<unknown> | Promise<unknown> | void): EnvironmentProviders;

// @public
export function provideBrowserGlobalErrorListeners(): EnvironmentProviders;

// @public
export function provideCheckNoChangesConfig(options: {
    exhaustive: false;
}): EnvironmentProviders;

// @public
export function provideCheckNoChangesConfig(options: {
    interval?: number;
    exhaustive: true;
}): EnvironmentProviders;

// @public
export function provideEnvironmentInitializer(initializerFn: () => void): EnvironmentProviders;

// @public
export function provideExperimentalWebMcpTools<const InputSchema extends JsonSchemaForInference>(tools: WebMcpToolDescriptor<InputSchema>[]): EnvironmentProviders;

// @public
export function provideIdleServiceWith(useExisting: AbstractType<IdleService> | InjectionToken<IdleService>): EnvironmentProviders;

// @public
export function provideNgReflectAttributes(): EnvironmentProviders;

// @public
export function providePlatformInitializer(initializerFn: () => void): StaticProvider;

// @public
export function provideStabilityDebugging(): EnvironmentProviders;

// @public
export function provideZoneChangeDetection(options?: NgZoneOptions): EnvironmentProviders;

// @public
export function provideZonelessChangeDetection(): EnvironmentProviders;
```

🔴 **Two things to notice.**
1. **`providePlatformInitializer` returns `StaticProvider`, not `EnvironmentProviders`.** It is the
   only one. See chunk 06 for why that matters.
2. **The golden's `// @public` tag is API-Extractor's release tag and is NOT Angular's stability
   marker.** `provideCheckNoChangesConfig` is marked `// @public` in the golden while its JSDoc in
   source says `@developerPreview 20.0`. **The JSDoc wins.** Never cite the golden as evidence that
   something is stable.

### 0.7 Error-message formatting — the machinery every error quote depends on

From [`packages/core/src/errors.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/errors.ts):

```ts
export function formatRuntimeErrorCode<T extends number = RuntimeErrorCode>(code: T): string {
  // Error code might be a negative number, which is a special marker that instructs the logic to
  // generate a link to the error details page on angular.io.
  // We also prepend `0` to non-compile-time errors.
  return `NG0${Math.abs(code)}`;
}

export function formatRuntimeError<T extends number = RuntimeErrorCode>(
  code: T,
  message: null | false | string,
): string {
  const fullCode = formatRuntimeErrorCode(code);

  let errorMessage = `${fullCode}${message ? ': ' + message : ''}`;

  if (ngDevMode && code < 0) {
    const addPeriodSeparator = !errorMessage.match(/[.,;!?\n]$/);
    const separator = addPeriodSeparator ? '.' : '';
    errorMessage = `${errorMessage}${separator} Find more at ${ERROR_DETAILS_PAGE_BASE_URL}/${fullCode}`;
  }
  return errorMessage;
}
```

- `ERROR_DETAILS_PAGE_BASE_URL` is `'https://angular.dev/errors'`
  ([`error_details_base_url.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/error_details_base_url.ts)).
- A **negative** code in the enum means "has a guide page"; the `Find more at …` suffix is
  appended **only in dev mode**.
- In production `message` is `false`/`null` and the whole string collapses to just `NG0201`.

Codes this topic touches, from the `RuntimeErrorCode` enum in the same file:

```ts
  PROVIDER_NOT_FOUND = -201,
  INVALID_MULTI_PROVIDER = -209,
  PROVIDER_IN_WRONG_CONTEXT = -207,
  MISSING_REQUIRED_INJECTABLE_IN_BOOTSTRAP = 402,
  ASYNC_INITIALIZERS_STILL_RUNNING = 405,
  PROVIDED_BOTH_ZONE_AND_ZONELESS = 408,
  TYPE_IS_NOT_STANDALONE = 907,
  UNEXPECTED_ZONEJS_PRESENT_IN_ZONELESS_MODE = 914,
```

(`HYDRATION_CONFLICTING_FEATURES` is referenced by `provideClientHydration`; it is **not** in the
`core` enum shown above — it comes from the platform-browser range. See `## 99 · UNSETTLED`.)

### 0.8 🔴 Corrections to the dispatch spec — the spec is wrong on these

1. **`withRouterFeatures` does not exist.** It is not in
   `goldens/public-api/router/index.api.md` at `v22.1.5` (grep count: 0). The dispatch spec named
   it. What exists is the **type** `RouterFeatures`, the union of all feature types accepted by
   `provideRouter`'s rest parameter. Do not invent a function.
2. **`withViewTransitions` is `@developerPreview 19.0`, not stable.** Source JSDoc, verbatim.
   The dispatch listed it among ordinary features.
3. **There is a THIRD non-stable router feature the spec did not name: `withRouterResources()`,
   `@experimental`.** It is exported from `provide_router.ts` but is **absent from the public-API
   golden**, and its type alias is `RouterFeature<RouterFeatureKind.ViewTransitionsFeature>` — it
   reuses the view-transitions kind. Treat it as internal/experimental; do not teach it as usable.
4. **`withFetch` is deprecated but `FetchBackend` being the default goes further than the spec
   says:** in v22 `HttpClient`, `HttpHandler` and `HttpBackend` are all `providedIn: 'root'`, so
   **`provideHttpClient()` is no longer required to inject `HttpClient` at all.** See chunk 09.
5. **`provideRoutes()` was REMOVED in v22.0.0** — a breaking change the spec did not mention.
6. `provideCheckNoChangesConfig` is developer preview **and dev-mode-only**: in a production build
   it returns an empty provider set.

---

## 1 · The single most valuable mechanism in the topic

`R3Injector`'s constructor and `processProvider`, from
[`packages/core/src/di/r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts).
Chunks 13, 05, 09, 12, 14 and 17 all lean on this. Verbatim:

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

(The `ngDevMode` profiler block in the middle of `processProvider` is elided above; the elision is
marked here, not in the page — **quote only the lines you need, and never with a `...` in the page.**)

**The four consequences, all directly readable from that code:**

1. **`forEachSingleProvider` is a depth-first flatten in source order** — nested arrays and
   `EnvironmentProviders` wrappers are both walked in place, so a `provide*()` in position 3
   contributes all its providers before anything in position 4.
2. **Non-multi: last wins.** Every provider ends in `this.records.set(token, record)` on a `Map`.
   Registering the same token twice replaces the record; the *later* one survives.
3. **Multi: append, never replace.** `multiRecord.multi!.push(provider)` accumulates in
   registration order, and the record's factory is `() => injectArgs(multiRecord.multi!)`.
4. **Mixing multi and non-multi for one token throws** `Cannot mix multi providers and regular
   providers` (`throwMixedMultiProviderError`, in
   [`render3/errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts)),
   in dev mode only.

And from
[`packages/core/src/application/create_application.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/create_application.ts),
which is why "last wins" is the whole override story:

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

Your array is spread in **last**, so for a non-multi token your provider beats the framework's.

---

## Chunk 05 — `05-change-detection-providers.md`

### 05.1 🔴 The headline: zoneless is the DEFAULT, and the generated file proves it

The **actual CLI 22.1.7 template**, verbatim from
[`packages/schematics/angular/application/files/standalone-files/src/app/app.config.ts.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/standalone-files/src/app/app.config.ts.template):

```
import { ApplicationConfig, provideBrowserGlobalErrorListeners<% if (!zoneless) { %>, provideZoneChangeDetection<% } %> } from '@angular/core';<% if (routing) { %>
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';<% } %>

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),<% if (!zoneless) { %>
    provideZoneChangeDetection({ eventCoalescing: true }),<% } %>
    <% if (routing) { %>provideRouter(routes)<% } %>
  ]
};
```

(That is an EJS template. Label it as such in the page — it is the schematic *source*, not the
file a user gets. Chunk 01 already prints the resolved output; do not reprint it.)

And the schematic's own default, from
[`application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/schema.json):

```json
 "zoneless": {
  "description": "Generate an application that does not use `zone.js`.",
  "type": "boolean",
  "default": true
 }
```

🔴 **So `ng new` in v22 emits NO change-detection provider at all.** `provideZoneChangeDetection({ eventCoalescing: true })` appears only under `--no-zoneless`.

angular.dev, [Angular without ZoneJS (Zoneless)](https://angular.dev/guide/zoneless), verbatim:

> *"Zoneless is the default in Angular v21+ so you do not need to do anything to enable it."*

> *"You should verify that `provideZoneChangeDetection` is not used anywhere to override the default configuration."*

> *"ZoneJS is typically loaded via the `polyfills` option in `angular.json`, both in the `build` and `test` targets. Remove `zone.js` and `zone.js/testing` from both to remove it from the build."*

The changelog sentence that made it true, from the **v21.0.0 breaking changes / core** section of
[`CHANGELOG.md`](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md), verbatim:

> *"Angular no longer provides a change detection scheduler for ZoneJS-based change detection by default. Add `provideZoneChangeDetection` to the providers of your `bootstrapApplication` function or your `AppModule` (if using `bootstrapModule`). This provider addition will be covered by an automated migration."*

Two more v21.0.0 breaking-change lines from the same block, both worth a gotcha:

> *"Using a combination of `provideZoneChangeDetection` while also removing ZoneJS polyfills will no longer result in the internal scheduler being disabled. All Angular applications now consistently use the same scheduler, and those with the Zone change detection provider include additional automatic scheduling behaviors based on NgZone stabilization."*

> *"`ignoreChangesOutsideZone` is no longer available as an option for configuring ZoneJS change detection behavior."*

### 05.2 The token-level proof, and the exact override mechanism

[`change_detection/scheduling/zoneless_scheduling.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/zoneless_scheduling.ts):

```ts
/** Token used to indicate if zoneless was enabled via provideZonelessChangeDetection(). */
export const ZONELESS_ENABLED = new InjectionToken<boolean>(
  typeof ngDevMode === 'undefined' || ngDevMode ? 'Zoneless enabled' : '',
  {factory: () => true},
);

/** Token used to indicate `provideZonelessChangeDetection` was used. */
export const PROVIDED_ZONELESS = new InjectionToken<boolean>(
  typeof ngDevMode === 'undefined' || ngDevMode ? 'Zoneless provided' : '',
  {factory: () => false},
);
```

🔴 **`ZONELESS_ENABLED`'s default factory is `() => true`.** Zoneless is not merely "what the
framework prepends" — it is the value you get when nothing is provided at all.
`PROVIDED_ZONELESS` defaults to `false` and exists **only** to detect the double-provide (NG0408).

What the framework prepends, from
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

What `provideZoneChangeDetection()` swaps back, from
[`ng_zone_scheduling.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/ng_zone_scheduling.ts):

```ts
export function internalProvideZoneChangeDetection({
  ngZoneFactory,
  scheduleInRootZone,
}: {
  ngZoneFactory?: () => NgZone;
  scheduleInRootZone?: boolean;
}): StaticProvider[] {
  ngZoneFactory ??= () =>
    new NgZone({...getNgZoneOptions(), scheduleInRootZone} as InternalNgZoneOptions);
  return [
    {provide: ZONELESS_ENABLED, useValue: false},
    {provide: NgZone, useFactory: ngZoneFactory},
```

```ts
export function provideZoneChangeDetection(options?: NgZoneOptions): EnvironmentProviders {
  const scheduleInRootZone = (options as any)?.scheduleInRootZone;
  const zoneProviders = internalProvideZoneChangeDetection({
    ngZoneFactory: () => {
      const ngZoneOptions = getNgZoneOptions(options);
      ngZoneOptions.scheduleInRootZone = scheduleInRootZone;
      if (ngZoneOptions.shouldCoalesceEventChangeDetection) {
        performanceMarkFeature('NgZone_CoalesceEvent');
      }
      return new NgZone(ngZoneOptions);
    },
    scheduleInRootZone,
  });
  return makeEnvironmentProviders([{provide: PROVIDED_NG_ZONE, useValue: true}, zoneProviders]);
}
```

🔴 **The whole opt-out is two `Map.set` overwrites.** `ZONELESS_ENABLED` goes `true → false` and
`NgZone` goes `NoopNgZone → NgZone`, purely because your providers are spread in **after** the
framework's (§1). `ChangeDetectionScheduler` is *not* re-provided — it stays
`ChangeDetectionSchedulerImpl` either way, which is exactly what the v21 changelog line above
means by "All Angular applications now consistently use the same scheduler."

`provideZoneChangeDetection`'s own JSDoc, verbatim:

> *"Provides `NgZone`-based change detection for the application bootstrapped using `bootstrapApplication`."*
> *"Add this provider to use `NgZone`/ZoneJS-based change detection and configure options like `eventCoalescing` in the `NgZone`."*
> *"If you need this provider function in an NgModule-based application, pass it as `applicationProviders` to `bootstrapModule()`."*

`NgZoneOptions` is exactly two fields (source, same file):

```ts
export interface NgZoneOptions {
  eventCoalescing?: boolean;
  runCoalescing?: boolean;
}
```

with these doc sentences, verbatim:

> *"By default, this option is set to false, meaning events will not be coalesced, and change detection will be triggered multiple times. If this option is set to true, change detection will be triggered once in the scenario described above."*

> *"With ngZoneRunCoalescing options, all change detections in an event loop trigger only once. In addition, the change detection executes in requestAnimation."*

`getNgZoneOptions` (same file) shows the real defaults:

```ts
export function getNgZoneOptions(options?: NgZoneOptions): InternalNgZoneOptions {
  return {
    enableLongStackTrace: typeof ngDevMode === 'undefined' ? false : !!ngDevMode,
    shouldCoalesceEventChangeDetection: options?.eventCoalescing ?? false,
    shouldCoalesceRunChangeDetection: options?.runCoalescing ?? false,
  };
}
```

### 05.3 `provideZonelessChangeDetection()` — what you no longer write, and its NG0914 warning

```ts
export function provideZonelessChangeDetection(): EnvironmentProviders {
  performanceMarkFeature('NgZoneless');

  if ((typeof ngDevMode === 'undefined' || ngDevMode) && typeof Zone !== 'undefined' && Zone) {
    const message = formatRuntimeError(
      RuntimeErrorCode.UNEXPECTED_ZONEJS_PRESENT_IN_ZONELESS_MODE,
      `The application is using zoneless change detection, but is still loading Zone.js. ` +
        `Consider removing Zone.js to get the full benefits of zoneless. ` +
        `In applications using the Angular CLI, Zone.js is typically included in the "polyfills" section of the angular.json file.`,
    );
    console.warn(message);
  }

  return makeEnvironmentProviders([
    ...provideZonelessChangeDetectionInternal(),
    typeof ngDevMode === 'undefined' || ngDevMode
      ? [{provide: PROVIDED_ZONELESS, useValue: true}]
      : [],
  ]);
}
```

🔴 **Three separate, quotable facts here.**
- **NG0914 is a `console.warn`, not a throw**, it fires **at call time** (inside
  `provideZonelessChangeDetection()`, before any injector exists), and **only in dev mode**. Full
  rendered string: `NG0914: The application is using zoneless change detection, but is still
  loading Zone.js. Consider removing Zone.js to get the full benefits of zoneless. In applications
  using the Angular CLI, Zone.js is typically included in the "polyfills" section of the
  angular.json file.` (code 914 is positive → **no** `Find more at` suffix).
- Calling `provideZonelessChangeDetection()` in v22 is **not an error and not a no-op** — it
  re-registers the same three records the framework already prepended, and additionally sets
  `PROVIDED_ZONELESS = true`, which is what arms NG0408. It is redundant, and its only observable
  effect is the warning and the NG0408 tripwire.
- `PROVIDED_ZONELESS` is registered **in dev mode only**, so **NG0408 cannot fire in production**.

Its JSDoc note, verbatim:

> *"NOTE: Zoneless is enabled by default in Angular v21+. Ensure `provideZoneChangeDetection` is not used to override this default."*

And its list of what actually schedules change detection, verbatim from the same JSDoc — use this,
it is exactly the "what replaces Zone.js" list readers want:

> *"ZoneJS uses browser events to trigger change detection. When using this provider, Angular will instead use Angular APIs to schedule change detection. These APIs include:"*
> - `ChangeDetectorRef.markForCheck`
> - `ComponentRef.setInput`
> - updating a signal that is read in a template
> - when bound host or template listeners are triggered
> - attaching a view that was marked dirty by one of the above
> - removing a view
> - registering a render hook (templates are only refreshed if render hooks do one of the above)

### 05.4 NG0408 — both provided

From [`packages/core/src/platform/bootstrap.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/platform/bootstrap.ts), verbatim:

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

Rendered: `NG0408: Both provideZoneChangeDetection and provideZonelessChangeDetection are provided.
This is likely a mistake. Update the application providers to use only one of the two.`

🔴 **It is a WARNING, dev-mode only, and the app still runs.** Which one wins is decided by §1 —
whichever call is **later in the flattened array**. Chunk 04 already cites this as the framework's
own example of "throw for a contradiction, warn for a suspicion"; do not re-explain that, cite it.

Note the check runs **inside `ngZone.run(...)` at the top of `bootstrap()`**, i.e. after the
injector exists but before environment initializers, `ApplicationInitStatus.runInitializers()` and
`appRef.bootstrap()`.

### 05.5 `provideCheckNoChangesConfig` — developer preview, dev-mode only

Full source,
[`packages/core/src/change_detection/provide_check_no_changes_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/provide_check_no_changes_config.ts):

```ts
/**
 * Used to disable exhaustive checks when verifying no expressions changed after they were checked.
 *
 * This means that `OnPush` components that are not marked for check will not be checked.
 * This behavior is the current default behavior in Angular. When running change detection
 * on a view tree, views marked for check are refreshed and the flag to check it is removed.
 * When Angular checks views a second time to ensure nothing has changed, `OnPush` components
 * will no longer be marked and not be checked.
 *
 * @developerPreview 20.0
 */
export function provideCheckNoChangesConfig(options: {exhaustive: false}): EnvironmentProviders;
/**
 * - `interval` will periodically run `checkNoChanges` on application views. This can be useful
 *   in zoneless applications to periodically ensure no changes have been made without notifying
 *   Angular that templates need to be refreshed.
 * - The exhaustive option will treat all application views as if they were `ChangeDetectionStrategy.Eager`/`Default` when verifying
 *   no expressions have changed. All views attached to `ApplicationRef` and all the descendants of
 *   those views will be checked for changes (excluding those subtrees which are detached via `ChangeDetectorRef.detach()`).
 *   This is useful because the check that runs after regular change detection does not work for components using `ChangeDetectionStrategy.OnPush`.
 *   This check is will surface any existing errors hidden by `OnPush` components.
 *
 * @developerPreview 20.0
 */
export function provideCheckNoChangesConfig(options: {
  interval?: number;
  exhaustive: true;
}): EnvironmentProviders;
export function provideCheckNoChangesConfig(options: {
  interval?: number;
  exhaustive: boolean;
}): EnvironmentProviders {
  return makeEnvironmentProviders(
    typeof ngDevMode === 'undefined' || ngDevMode
      ? [
          {
            provide: UseExhaustiveCheckNoChanges,
            useValue: options.exhaustive,
          },
          options?.interval !== undefined ? exhaustiveCheckNoChangesInterval(options.interval) : [],
        ]
      : [],
  );
}
```

🔴 **Four facts, all directly readable:**
- `@developerPreview 20.0` on **both** overloads. Label it. The golden's `// @public` is
  API-Extractor's tag, not a stability claim (§0.6).
- The whole body is `ngDevMode ? [...] : []` — **in production it provides nothing.**
- `interval` is only accepted on the `exhaustive: true` overload; `{exhaustive: false}` takes no
  interval. That is enforced by the overload signatures, so it is a *compile* error, not runtime.
- The word "current default" in the first doc block means `exhaustive: false` is the status quo;
  the provider's real use is turning it **on**.

The interval implementation, verbatim from
[`scheduling/exhaustive_check_no_changes.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/exhaustive_check_no_changes.ts):

```ts
export function exhaustiveCheckNoChangesInterval(interval: number) {
  return provideEnvironmentInitializer(() => {
    const applicationRef = inject(ApplicationRef);
    const errorHandler = inject(ErrorHandler);
    const scheduler = inject(ChangeDetectionSchedulerImpl);
    const ngZone = inject(NgZone);

    function scheduleCheckNoChanges() {
      ngZone.runOutsideAngular(() => {
        setTimeout(() => {
          if (applicationRef.destroyed) {
            return;
          }
          if (scheduler.pendingRenderTaskId || scheduler.runningTick) {
            scheduleCheckNoChanges();
            return;
          }

          for (const view of applicationRef.allViews) {
            try {
              checkNoChangesInternal(view._lView, true /** exhaustive */);
            } catch (e) {
              errorHandler.handleError(e);
            }
          }

          scheduleCheckNoChanges();
        }, interval);
      });
    }
    scheduleCheckNoChanges();
  });
}
```

Note it is built on **`provideEnvironmentInitializer`** — a good cross-link to chunk 06 — and that
failures go to the `ErrorHandler`, not to a throw.

angular.dev's zoneless guide on it, verbatim:

> *"`provideCheckNoChangesConfig({exhaustive: true, interval: <milliseconds>})` can be used to periodically check to ensure that no bindings have been updated without a notification."*

> *"Angular throws `ExpressionChangedAfterItHasBeenCheckedError` if there is an updated binding that would not have refreshed by the zoneless change detection."*

### 05.6 The `ChangeDetectionSchedulerImpl` details worth one paragraph (not a whole section)

From `zoneless_scheduling_impl.ts` — this is Phase 5's material, so **name it and stop**:

- `CONSECUTIVE_MICROTASK_NOTIFICATION_LIMIT = 100`, and exceeding it throws
  `RuntimeErrorCode.INFINITE_CHANGE_DETECTION` (**NG0103**) with the message
  `'Angular could not stabilize because there were endless change notifications within the browser event loop. The stack from the last several notifications: \n' + …`.
- `scheduleInRootZone` defaults to `false` in zoneless mode:
  `private readonly scheduleInRootZone = !this.zonelessEnabled && this.zoneIsDefined && (inject(SCHEDULE_IN_ROOT_ZONE, {optional: true}) ?? false);`
- The scheduler picks `scheduleCallbackWithMicrotask` or `scheduleCallbackWithRafRace`.

### 05.7 Gotchas to write (symptom-first)

Every one of these is settled by a quote above.

1. **"I added `provideZonelessChangeDetection()` and got NG0914."** Zone.js is still in
   `angular.json` `polyfills`. Fix in code: delete the zoneless call (it is the default) **and**
   remove `"zone.js"` from `polyfills` in both the `build` and `test` targets.
2. **"NG0408 in the console but the app works."** Both providers present; warning only, dev only;
   the later one in the flattened array wins.
3. **"I upgraded to v21/v22 and my `setTimeout`-driven UI stopped updating."** The v21 breaking
   change: no ZoneJS scheduler is provided by default. Fix: either migrate to signals, or add
   `provideZoneChangeDetection({eventCoalescing: true})` — and keep `zone.js` in `polyfills`.
4. **"`provideZoneChangeDetection` has no effect."** It is in a **component's** `providers` (does
   not compile — `EnvironmentProviders`), or in a **route's** `providers`, where it registers a
   record the already-created root `NgZone` never consults.
5. **"`provideCheckNoChangesConfig` does nothing in prod."** By design — the body is dev-only.
6. **"`ignoreChangesOutsideZone` is not a valid option."** Removed in v21.0.0.
7. **`ReferenceError: Zone is not defined`** in a zoneless app that still imports
   `zone.js/testing` in the test target only, or vice versa — the guide says remove it from
   **both** targets.
8. **`NG0103`** endless-notification loop — an effect or listener that notifies on every tick.

### 05.8 Interview questions worth asking

- ★ *Why does `provideZoneChangeDetection()` override the framework's own zoneless providers,
  when the framework's come first?* → §1: last non-multi provider wins, and your array is spread
  in last.
- ★ *`ZONELESS_ENABLED` has `{factory: () => true}`. Why does the framework still prepend
  `{provide: ZONELESS_ENABLED, useValue: true}`?* → so a *child* environment injector (a route
  injector) that asks for it resolves through the application record rather than the token
  default, and so DevTools sees a real record. (⚠️ this reasoning is mine, not a quote — write it
  as "the most plausible reading" or leave it out. See `## 99 · UNSETTLED`.)
- *Why is NG0408 a warning and NG0207 a throw?* → chunk 04's rule, cited.
- *What is the difference between "zoneless is stable" and "zoneless is the default"?* → v20.2
  stabilised `provideZonelessChangeDetection` (`@publicApi 20.2`); v21.0.0 stopped providing the
  Zone scheduler at all.

---

## Chunk 06 — `06-startup-and-error-listener-providers.md`

### 06.1 The three initializers, side by side — this table is the chunk's spine

| | `providePlatformInitializer` | `provideEnvironmentInitializer` | `provideAppInitializer` |
|---|---|---|---|
| Returns | **`StaticProvider`** | `EnvironmentProviders` | `EnvironmentProviders` |
| Token | `PLATFORM_INITIALIZER` | `ENVIRONMENT_INITIALIZER` | `APP_INITIALIZER` |
| Goes in | `platformBrowser([...])` | `ApplicationConfig.providers` / route / `createEnvironmentInjector` | same |
| Runs when | platform injector is created | that injector's `resolveInjectorInitializers()` | `ApplicationInitStatus.runInitializers()` |
| Signature | `() => void` | `() => void` | `() => Observable<unknown> \| Promise<unknown> \| void` |
| **Awaited?** | **no** | **no** | **yes** |
| Runs per | page | injector (app **and** each route injector) | application |

### 06.2 `provideAppInitializer` — source, and what a rejection does

[`packages/core/src/application/application_init.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/application_init.ts):

```ts
export function provideAppInitializer(
  initializerFn: () => Observable<unknown> | Promise<unknown> | void,
): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: APP_INITIALIZER,
      multi: true,
      useValue: initializerFn,
    },
  ]);
}
```

JSDoc, verbatim:

> *"The provided function is injected at application startup and executed during app initialization. If the function returns a Promise or an Observable, initialization does not complete until the Promise is resolved or the Observable is completed."*

> *"Note that the provided initializer is run in the injection context."*

> *"Previously, this was achieved using the `APP_INITIALIZER` token which is now deprecated."*

`APP_INITIALIZER`'s own deprecation tag, verbatim: `@deprecated from v19.0.0, use provideAppInitializer instead`.

The runner, verbatim — **this is the paragraph the whole chunk is for**:

```ts
  /** @internal */
  runInitializers() {
    if (this.initialized) {
      return;
    }

    const asyncInitPromises = [];
    for (const appInits of this.appInits) {
      const initResult = runInInjectionContext(this.injector, appInits);
      if (isPromise(initResult)) {
        asyncInitPromises.push(initResult);
      } else if (isSubscribable(initResult)) {
        const observableAsPromise = new Promise<void>((resolve, reject) => {
          initResult.subscribe({complete: resolve, error: reject});
        });
        asyncInitPromises.push(observableAsPromise);
      }
    }

    const complete = () => {
      // @ts-expect-error overwriting a readonly
      this.done = true;
      this.resolve();
    };

    Promise.all(asyncInitPromises)
      .then(() => {
        complete();
      })
      .catch((e) => {
        this.reject(e);
      });

    if (asyncInitPromises.length === 0) {
      complete();
    }
    this.initialized = true;
  }
```

🔴 **Read out of that, precisely:**
- Initializers are started **in array order, synchronously, all at once** — then `Promise.all`
  waits. They are **not sequential**. An initializer that depends on another one's result is a
  bug, and this is the code that proves it.
- An **Observable** initializer completes on `complete`, **not on first value**. An observable
  that emits and never completes hangs bootstrap forever.
- `runInInjectionContext(this.injector, appInits)` — `inject()` works inside; the injector is the
  environment injector.
- **A rejection rejects `donePromise`.** Chain: `this.reject(e)` → `initStatus.donePromise` rejects
  → in `bootstrap.ts` the `.then(...)` never runs → `_callAndReportToErrorHandler` catches it,
  calls `errorHandler(e)` **outside the Angular zone**, and **rethrows** → the
  `bootstrapApplication(...)` promise **rejects** → the root component is **never created**.
  The generated `.catch((err) => console.error(err))` in `main.ts` is what you see.

The rethrow, verbatim from `bootstrap.ts`:

```ts
function _callAndReportToErrorHandler(
  errorHandler: (e: unknown) => void,
  ngZone: NgZone,
  callback: () => any,
): any {
  try {
    const result = callback();
    if (isPromise(result)) {
      return result.catch((e: any) => {
        ngZone.runOutsideAngular(() => errorHandler(e));
        // rethrow as the exception handler might not do it
        throw e;
      });
    }

    return result;
  } catch (e) {
    ngZone.runOutsideAngular(() => errorHandler(e));
    // rethrow as the exception handler might not do it
    throw e;
  }
}
```

The dev-mode guard against a non-multi `APP_INITIALIZER`, verbatim from `ApplicationInitStatus`'s
constructor — this is **NG0209**:

```ts
      throw new RuntimeError(
        RuntimeErrorCode.INVALID_MULTI_PROVIDER,
        'Unexpected type of the `APP_INITIALIZER` token value ' +
          `(expected an array, but got ${typeof this.appInits}). ` +
          'Please check that the `APP_INITIALIZER` token is configured as a ' +
          '`multi: true` provider.',
      );
```

And **NG0405**, from
[`application_ref.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/application_ref.ts) — thrown if you call `ApplicationRef.bootstrap()` yourself before initializers finish:

```ts
      if (!initStatus.done) {
        let errorMessage = '';
        if (typeof ngDevMode === 'undefined' || ngDevMode) {
          const standalone = isStandalone(component);
          errorMessage =
            'Cannot bootstrap as there are still asynchronous initializers running.' +
            (standalone
              ? ''
              : ' Bootstrap components in the `ngDoBootstrap` method of the root module.');
        }
        throw new RuntimeError(RuntimeErrorCode.ASYNC_INITIALIZERS_STILL_RUNNING, errorMessage);
      }
```

### 06.3 `provideEnvironmentInitializer` — not awaited, runs per injector

[`packages/core/src/di/provider_collection.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/provider_collection.ts):

```ts
export function provideEnvironmentInitializer(initializerFn: () => void): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: initializerFn,
    },
  ]);
}
```

JSDoc, verbatim:

> *"This function is used to provide initialization functions that will be executed upon construction of an environment injector."*
> *"Note that the provided initializer is run in the injection context."*
> *"Previously, this was achieved using the `ENVIRONMENT_INITIALIZER` token which is now deprecated."*

The runner, verbatim from
[`r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts):

```ts
  /** @internal */
  resolveInjectorInitializers() {
    const prevConsumer = setActiveConsumer(null);
    const previousInjector = setCurrentInjector(this);
    const previousInjectImplementation = setInjectImplementation(undefined);
    let prevInjectContext: InjectorProfilerContext | undefined;
    if (ngDevMode) {
      prevInjectContext = setInjectorProfilerContext({injector: this, token: null});
    }

    try {
      const initializers = this.get(ENVIRONMENT_INITIALIZER, EMPTY_ARRAY, {self: true});
      if (ngDevMode && !Array.isArray(initializers)) {
        throw new RuntimeError(
          RuntimeErrorCode.INVALID_MULTI_PROVIDER,
          'Unexpected type of the `ENVIRONMENT_INITIALIZER` token value ' +
            `(expected an array, but got ${typeof initializers}). ` +
            'Please check that the `ENVIRONMENT_INITIALIZER` token is configured as a ' +
            '`multi: true` provider.',
        );
      }
      for (const initializer of initializers) {
        initializer();
      }
    } finally {
      setCurrentInjector(previousInjector);
      setInjectImplementation(previousInjectImplementation);
      ngDevMode && setInjectorProfilerContext(prevInjectContext!);
      setActiveConsumer(prevConsumer);
    }
  }
```

🔴 **Three things nobody expects, all in that code:**
- **`{self: true}`.** Environment initializers do **not** inherit. A route injector runs only the
  initializers registered *on that route*, never the application's again.
- **`initializer()` — the return value is discarded.** Returning a promise silently does nothing.
- It is called by name from `bootstrap()`, **before** `ApplicationInitStatus.runInitializers()`,
  and **inside** `ngZone.run(...)`. The `runEnvironmentInitializers: false` flag in
  `internalCreateApplication` (quoted in chunk 01) exists precisely to defer it until the zone
  exists; its comment, verbatim: *"We skip environment initializers because we need to run them
  inside the NgZone, which happens after we get the NgZone instance from the Injector."*

### 06.4 `providePlatformInitializer` — the odd one out

[`packages/core/src/platform/platform.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/platform/platform.ts):

```ts
export function providePlatformInitializer(initializerFn: () => void): StaticProvider {
  return {
    provide: PLATFORM_INITIALIZER,
    useValue: initializerFn,
    multi: true,
  };
}

function runPlatformInitializers(injector: Injector): void {
  const inits = injector.get(PLATFORM_INITIALIZER, null);
  runInInjectionContext(injector, () => {
    inits?.forEach((init) => init());
  });
}
```

JSDoc, verbatim, including the usage snippet:

> *"This function is used to provide initialization functions that will be executed upon initialization of the platform injector."*
> *"The platform initializer should be provided during platform creation:"*

```ts
const platformRef = platformBrowser([ providePlatformInitializer(() =>  ...) ]);

bootstrapApplication(App, appConfig, { platformRef })
```

🔴 **The gotcha this exists for.** `providePlatformInitializer(...)` returns a plain
`StaticProvider`, so putting it in `ApplicationConfig.providers` **type-checks and compiles**. It
then registers a `PLATFORM_INITIALIZER` record in the *application* injector — and
`runPlatformInitializers` only ever reads the token from the **platform** injector, which was
created first, in `createOrReusePlatformInjector`. **It silently never runs.** Show the fix in
code: move it into the `platformBrowser([...])` array and pass `{ platformRef }` as
`bootstrapApplication`'s third argument.

Also from `platform.ts`, relevant to SSR:

```ts
export function getPlatform(): PlatformRef | null {
  if (typeof ngServerMode !== 'undefined' && ngServerMode) {
    return null;
  }

  return _platformInjector?.get(PlatformRef) ?? null;
}
```

with the comment in `createOrReusePlatformInjector`:

```ts
  // During SSR, using this setting and using an injector from the global can cause the
  // injector to be used for a different request due to concurrency.
  if (typeof ngServerMode === 'undefined' || !ngServerMode) {
    _platformInjector = injector;
  }
```

and the v21.0.0 breaking change, verbatim from `CHANGELOG.md`:

> *"In addition, `getPlatform()` and `destroyPlatform()` will now return `null` and be a no-op respectively when running in a server environment."*

### 06.5 `provideBrowserGlobalErrorListeners` — full source

[`packages/core/src/error_handler.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/error_handler.ts):

```ts
/**
 * Provides an environment initializer which forwards unhandled errors to the ErrorHandler.
 *
 * The listeners added are for the window's 'unhandledrejection' and 'error' events.
 *
 * @see [Global error listeners](best-practices/error-handling#global-error-listeners)
 *
 * @publicApi
 */
export function provideBrowserGlobalErrorListeners(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideEnvironmentInitializer(() => void inject(globalErrorListeners)),
  ]);
}
```

and the token it pulls, verbatim (this is the whole behaviour):

```ts
const globalErrorListeners = new InjectionToken<void>(
  typeof ngDevMode !== 'undefined' && ngDevMode ? 'GlobalErrorListeners' : '',
  {
    factory: () => {
      if (typeof ngServerMode !== 'undefined' && ngServerMode) {
        return;
      }
      const window = inject(DOCUMENT).defaultView;
      if (!window) {
        return;
      }

      const errorHandler = inject(INTERNAL_APPLICATION_ERROR_HANDLER);
      const rejectionListener = (e: PromiseRejectionEvent) => {
        errorHandler(e.reason);
        e.preventDefault();
      };
      const errorListener = (e: ErrorEvent) => {
        if (e.error) {
          errorHandler(e.error);
        } else {
          errorHandler(
            new Error(
              ngDevMode
                ? `An ErrorEvent with no error occurred. See Error.cause for details: ${e.message}`
                : e.message,
              {cause: e},
            ),
          );
        }
        e.preventDefault();
      };

      const setupEventListeners = () => {
        window.addEventListener('unhandledrejection', rejectionListener);
        window.addEventListener('error', errorListener);
      };

      // Angular doesn't have to run change detection whenever any asynchronous tasks are invoked in
      // the scope of this functionality.
      if (typeof Zone !== 'undefined') {
        Zone.root.run(setupEventListeners);
      } else {
        setupEventListeners();
      }

      inject(DestroyRef).onDestroy(() => {
        window.removeEventListener('error', errorListener);
        window.removeEventListener('unhandledrejection', rejectionListener);
      });
    },
  },
);
```

🔴 **Facts to lift:** it is **a no-op on the server** (`ngServerMode` early return); it calls
`e.preventDefault()`, so the browser's own console reporting is **suppressed** and everything is
routed through `ErrorHandler`; the listeners are **removed on injector destroy**; and it is
implemented as a `provideEnvironmentInitializer`, so it is *not awaited* and adds nothing to
startup latency.

The framework's own error-handler initializer, prepended by `internalCreateApplication` and
therefore always present — **NG0402**:

```ts
export const errorHandlerEnvironmentInitializer = {
  provide: ENVIRONMENT_INITIALIZER,
  useValue: () => {
    const handler = inject(ErrorHandler, {optional: true});
    if ((typeof ngDevMode === 'undefined' || ngDevMode) && handler === null) {
      throw new RuntimeError(
        RuntimeErrorCode.MISSING_REQUIRED_INJECTABLE_IN_BOOTSTRAP,
        `A required Injectable was not found in the dependency injection tree. ` +
          'If you are bootstrapping an NgModule, make sure that the `BrowserModule` is imported.',
      );
    }
  },
  multi: true,
};
```

The default `ErrorHandler`, verbatim — note it is a **plain class**, not `providedIn: 'root'`:

```ts
export class ErrorHandler {
  /**
   * @internal
   */
  _console: Console = console;

  handleError(error: any): void {
    this._console.error('ERROR', error);
  }
}
```

and the lazy indirection that makes overriding it safe, verbatim:

```ts
export const INTERNAL_APPLICATION_ERROR_HANDLER = new InjectionToken<(e: any) => void>(
  typeof ngDevMode === 'undefined' || ngDevMode ? 'internal error handler' : '',
  {
    factory: () => {
      // The user's error handler may depend on things that create a circular dependency
      // so we inject it lazily.
      const zone = inject(NgZone);
      const injector = inject(EnvironmentInjector);
      let userErrorHandler: ErrorHandler;
      return (e: unknown) => {
        zone.runOutsideAngular(() => {
          if (injector.destroyed && !userErrorHandler) {
            setTimeout(() => {
              throw e;
            });
          } else {
            userErrorHandler ??= injector.get(ErrorHandler);
            userErrorHandler.handleError(e);
          }
        });
      };
    },
  },
);
```

### 06.6 angular.dev on error handling — quotable sentences

From [Unhandled errors in Angular](https://angular.dev/best-practices/error-handling), verbatim:

> *"Angular reports unhandled errors to the application's root `ErrorHandler`. When providing a custom `ErrorHandler`, provide it in your `ApplicationConfig` as part of calling `bootstrapApplication`."*

> *"Angular does _not_ catch errors inside of APIs that are called directly by your code."*

> *"Adding [`provideBrowserGlobalErrorListeners()`] to the [ApplicationConfig] adds the `'error'` and `'unhandledrejection'` listeners to the browser window and forwards those errors to `ErrorHandler`. The Angular CLI generates new applications with this provider by default. The Angular team recommends handling these global errors for most applications, either with the framework's built-in listeners or with your own custom listeners. If you provide custom listeners, you can remove `provideBrowserGlobalErrorListeners`."*

> *"When using [Angular with SSR], Angular automatically adds the `'unhandledRejection'` and `'uncaughtException'` listeners to the server process. These handlers prevent the server from crashing and instead log captured errors to the console."*

> *"IMPORTANT: If the application is using Zone.js, only the `'unhandledRejection'` handler is added. When Zone.js is present, errors inside the Application's Zone are already forwarded to the application `ErrorHandler` and do not reach the server process."*

> *"There's a brief moment when Angular can't send errors to your `ErrorHandler` yet: while it is still creating your app's root module or root component. Angular needs that root instance to exist before it can look up the `ErrorHandler` you provided, so an error thrown before then has nowhere to go. It behaves like a normal uncaught error instead of being reported through `ErrorHandler`."*

> *"Angular's `TestBed` rethrows unexpected errors to ensure that errors caught by the framework cannot be unintentionally missed or ignored."*

A worked custom handler, verbatim from the same page (safe to reproduce, it is the doc's own):

```ts
export class GlobalErrorHandler implements ErrorHandler {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly router = inject(Router);

  handleError(error: any) {
    const url = this.router.url;
    const errorMessage = error?.message ?? 'unknown';

    this.analyticsService.trackEvent({
      eventName: 'exception',
      description: `Screen: ${url} | ${errorMessage}`,
    });

    console.error(GlobalErrorHandler.name, {error});
  }
}
```

### 06.7 Gotchas to write

1. **"My `providePlatformInitializer` never runs."** It is in `app.config.ts`. §06.4, with the fix.
2. **"Bootstrap hangs forever."** An `provideAppInitializer` returned an Observable that emits but
   never completes. Fix in code: `.pipe(take(1))`, or return `firstValueFrom(...)`.
3. **"The app shows nothing and the console has one red line from `main.ts`."** A rejected app
   initializer. Full chain in §06.2. Fix: handle the failure *inside* the initializer and resolve
   with a fallback, if the app can start degraded.
4. **"My two `provideAppInitializer` calls run out of order / the second sees stale data."** They
   are started synchronously in array order and awaited with `Promise.all` — there is no
   sequencing. Fix: one initializer that awaits both, in order.
5. **"`provideEnvironmentInitializer` returning a promise doesn't delay anything."** The return
   value is discarded. Fix: use `provideAppInitializer`.
6. **"My route-level `provideEnvironmentInitializer` ran, but the app-level one ran again too /
   didn't."** `{self: true}` — each injector runs only its own.
7. **NG0209** — someone wrote `{provide: APP_INITIALIZER, useValue: fn}` without `multi: true`.
   Fix in code: use `provideAppInitializer(fn)`.
8. **NG0405** — calling `appRef.bootstrap()` manually during startup.
9. **NG0402** — the `ErrorHandler` is missing; almost always an `NgModule` app that dropped
   `BrowserModule`.
10. **"Errors during a custom element upgrade vanish."** angular.dev's "Errors thrown while your
    app is still starting up" paragraph, plus its three suggested fixes (`setTimeout`,
    `APP_BOOTSTRAP_LISTENER`, `ngDoBootstrap`).
11. **"`provideBrowserGlobalErrorListeners()` did nothing on the server."** It early-returns under
    `ngServerMode`; the server gets process-level handlers instead.
12. **"Errors stopped appearing in the browser console after adding it."** `e.preventDefault()`.

### 06.8 Interview questions worth asking

- ★ *What exactly happens to a `provideAppInitializer` that rejects?* → the full chain in §06.2.
- ★ *`provideEnvironmentInitializer` and `provideAppInitializer` look identical. When does the
  difference bite?* → awaited vs not; per-injector vs per-application; `{self: true}`.
- ★ *Why does `providePlatformInitializer` return `StaticProvider` instead of
  `EnvironmentProviders`?* → because the platform injector is built by `Injector.create` from
  `StaticProvider[]` (`createPlatformInjector`), which cannot accept the wrapper; the type is the
  only thing telling you it belongs somewhere else — and it is a *weaker* guard than
  `EnvironmentProviders`, which is why the silent no-op is possible.
- *Why is `INTERNAL_APPLICATION_ERROR_HANDLER` a function token rather than just `ErrorHandler`?*
  → the comment: *"The user's error handler may depend on things that create a circular dependency
  so we inject it lazily."*

---

## Chunk 07 — `provideRouter()` and the route array

### 07.1 The whole function — it provides four things and nothing else

[`packages/router/src/provide_router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/provide_router.ts), verbatim:

```ts
export function provideRouter(routes: Routes, ...features: RouterFeatures[]): EnvironmentProviders {
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    // Publish this util when the router is provided so that the devtools can use it.
    ɵpublishNonCoreGlobalUtil('ɵgetLoadedRoutes', getLoadedRoutes);
    ɵpublishNonCoreGlobalUtil('ɵgetRouterInstance', getRouterInstance);
    ɵpublishNonCoreGlobalUtil('ɵnavigateByUrl', navigateByUrl);
  }

  return makeEnvironmentProviders([
    {provide: ROUTES, multi: true, useValue: routes},
    {provide: ActivatedRoute, useFactory: rootRoute},
    {provide: APP_BOOTSTRAP_LISTENER, multi: true, useFactory: getBootstrapListener},
    features.map((feature) => feature.ɵproviders),
  ]);
}

export function rootRoute(): ActivatedRoute {
  return inject(Router).routerState.root;
}
```

🔴 **That is the entire body.** Four entries. Compare with `RouterModule.forRoot`'s eleven-branch
body, already quoted in chunk 02 — **do not re-quote it**, point at chunk 02.

JSDoc, verbatim:

> *"Sets up providers necessary to enable `Router` functionality for the application. Allows to configure a set of routes as well as extra features that should be enabled."*
> *"@param routes A set of `Route`s to use for the application routing table."*
> *"@param features Optional features to configure additional router behaviors."*
> *"@returns A set of providers to setup a Router."*

### 07.2 🔴 Where the `Router` itself comes from — `provideRouter` does not provide it

[`packages/router/src/router.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router.ts):

```ts
@Service()
export class Router {
```

`@Service()` is v22's shorthand for `@Injectable({providedIn: 'root'})` — angular.dev, verbatim:

> *"The `@Service` decorator serves as a modern, ergonomic shorthand for the traditional `@Injectable({ providedIn: 'root' })` syntax."*
> ([Creating and using services](https://angular.dev/guide/di/creating-and-using-services))

So **the `Router` exists whether or not you call `provideRouter`.** What `provideRouter` supplies
is the *route table*, the root `ActivatedRoute`, and the bootstrap hook that starts navigation.

### 07.3 🔴 The single best fact in this chunk — routes are a multi-provider of *arrays*

`ROUTES`, from
[`router_config_loader.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/router_config_loader.ts):

```ts
/**
 * `ROUTES` is a low level API for router configuration via dependency injection.
 *
 * We recommend that in almost all cases to use higher level APIs such as `RouterModule.forRoot()`,
 * `provideRouter`, or `Router.resetConfig()`.
 *
 * @publicApi
 */
export const ROUTES = new InjectionToken<Route[][]>(
```

and how the `Router` consumes it — **`router.ts` line 162**, verbatim:

```ts
  config: Routes = inject(ROUTES, {optional: true})?.flat() ?? [];
```

Everything about "two calls append rather than replace" is in those two lines and §1:

- The token's type is **`Route[][]`** — an array *of route arrays*, one entry per `provideRouter`
  call (or per `RouterModule.forRoot` / `forChild` / raw `{provide: ROUTES, multi: true}`).
- `multi: true` ⇒ `multiRecord.multi!.push(provider)` ⇒ **append in registration order**.
- `.flat()` concatenates them into one flat `Routes`. A wildcard `{path: '**'}` in the *first*
  call therefore shadows every route contributed by the *second*.
- `{optional: true}` ⇒ **no `provideRouter` at all is legal**: `config` becomes `[]` and the
  `Router` still exists and still navigates (to nothing).

### 07.4 `Route.providers` — the type, and the one sentence that defines route scope

[`packages/router/src/models.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/models.ts), verbatim:

```ts
  /**
   * A `Provider` array to use for this `Route` and its `children`.
   *
   * The `Router` will create a new `EnvironmentInjector` for this
   * `Route` and use it for this `Route` and its `children`. If this
   * route also has a `loadChildren` function which returns an `NgModuleRef`, this injector will be
   * used as the parent of the lazy loaded module.
   * @see [Route providers](guide/di/defining-dependency-providers#route-providers)
   */
  providers?: Array<Provider | EnvironmentProviders>;
```

(That is chunk 15's material — chunk 07 should quote only the *type* line to make the point that
`Routes` is a plain value, and hand the rest over.)

### 07.5 🔴 v22.0.0 breaking change: `provideRoutes()` is gone

From the **22.0.0 Breaking Changes / router** block of
[`CHANGELOG.md`](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md), verbatim:

> *"`provideRoutes()` has been removed. Use `provideRouter()` or `ROUTES` as multi token if necessary."*

Two more router breaking changes in the same v22.0.0 block, both worth naming here or in 08:

> *"paramsInheritanceStrategy now defaults to 'always'*
> *The default value of paramsInheritanceStrategy has been changed from 'emptyOnly' to 'always'. This means that route parameters are inherited from all parent routes by default. To restore the previous behavior, set paramsInheritanceStrategy to 'emptyOnly' in your router configuration."*

> *"The `currentSnapshot` parameter in `CanMatchFn` and the `canMatch` method of the `CanMatch` interface is now required."*

### 07.6 `getBootstrapListener` — what the third provider actually does

```ts
export function getBootstrapListener() {
  const injector = inject(Injector);
  return (bootstrappedComponentRef: ComponentRef<unknown>) => {
    const ref = injector.get(ApplicationRef);

    if (bootstrappedComponentRef !== ref.components[0]) {
      return;
    }

    const router = injector.get(Router);
    const bootstrapDone = injector.get(BOOTSTRAP_DONE);

    if (injector.get(INITIAL_NAVIGATION) === InitialNavigation.EnabledNonBlocking) {
      router.initialNavigation();
    }

    injector.get(ROUTER_PRELOADER, null, {optional: true})?.setUpPreloading();
    injector.get(ROUTER_SCROLLER, null, {optional: true})?.init();
    router.resetRootComponentType(ref.componentTypes[0]);
    if (!bootstrapDone.closed) {
      bootstrapDone.next();
      bootstrapDone.complete();
      bootstrapDone.unsubscribe();
    }
  };
}
```

🔴 **Two things fall out of this and they are the chunk's best gotchas:**
- The guard `if (bootstrappedComponentRef !== ref.components[0]) return;` means the listener only
  acts for the **first** bootstrapped component. Two `provideRouter` calls register **two**
  `APP_BOOTSTRAP_LISTENER` multi-entries, both of which run, both of which try to
  `router.initialNavigation()` and re-init preloading/scrolling on the *same* root `Router`.
- The preloader and the scroller are `{optional: true}` lookups — that is how
  `withPreloading()` and `withInMemoryScrolling()` get switched on without the base function
  referencing them (chunk 02's tree-shaking argument, now visible in the router's own code).

`INITIAL_NAVIGATION`'s default, verbatim:

```ts
const INITIAL_NAVIGATION = new InjectionToken<InitialNavigation>(
  typeof ngDevMode === 'undefined' || ngDevMode ? 'initial navigation' : '',
  {factory: () => InitialNavigation.EnabledNonBlocking},
);
```

and its explanatory comment, verbatim — worth quoting because it defines all three modes:

> *"When set to `EnabledBlocking`, the initial navigation starts before the root component is created. The bootstrap is blocked until the initial navigation is complete. This value should be set in case you use [server-side rendering], but do not enable [hydration] for your application."*
> *"When set to `EnabledNonBlocking`, the initial navigation starts after the root component has been created. The bootstrap is not blocked on the completion of the initial navigation."*
> *"When set to `Disabled`, the initial navigation is not performed. The location listener is set up before the root component gets created. Use if there is a reason to have more control over when the router starts its initial navigation due to some complex initialization logic."*

### 07.7 Gotchas to write

1. **"I called `provideRouter` twice and got both route tables."** §07.3 — `ROUTES` is
   `multi: true` and `.flat()`ed. Fix in code: one call, `provideRouter([...adminRoutes, ...shopRoutes])`.
2. **"Routes from my second `provideRouter` are unreachable."** A `{path: '**'}` in the first
   array. `.flat()` preserves order and the router matches first-wins.
3. **"Navigation happens twice / the preloader initialises twice."** Two
   `APP_BOOTSTRAP_LISTENER` entries, §07.6.
4. **"`provideRoutes` is not exported from `@angular/router`."** Removed in v22.0.0, §07.5.
5. **"`provideRouter` in a route's `providers` did nothing."** The root `Router` is `@Service()`
   and read `ROUTES` from the injector it was created in. A route injector's `ROUTES` record is
   never consulted by it. Fix: put route-scoped *services* on the route (chunk 15) and the route
   *table* in the root call, via `loadChildren`.
6. **"`ActivatedRoute` injects fine but is always the root."** `provideRouter` provides
   `{provide: ActivatedRoute, useFactory: rootRoute}` at the *application* level — the
   per-component `ActivatedRoute` comes from the outlet's injector, not this one.
7. **"My child route params disappeared after upgrading to v22."** `paramsInheritanceStrategy`
   flipped to `'always'`, §07.5. Fix in code:
   `provideRouter(routes, withRouterConfig({paramsInheritanceStrategy: 'emptyOnly'}))`.

### 07.8 Interview questions

- ★ *`provideRouter` returns only four providers. Where does the `Router` come from?* → `@Service()`.
- ★ *What happens if you call `provideRouter` twice, and why is that different from calling
  `provideHttpClient` twice?* → `ROUTES` is multi (append); HTTP's backend providers are non-multi
  (last wins). Same injector, two different collision rules — §1.
- *`ROUTES` is typed `Route[][]`. Why not `Route[]`?* → because a multi-provider's value is the
  array of every contributed value, and each contribution is itself a route table.

---

## Chunk 08 — Router features, one by one

### 08.1 The feature record and the complete inventory

```ts
export interface RouterFeature<FeatureKind extends RouterFeatureKind> {
  ɵkind: FeatureKind;
  ɵproviders: Array<Provider | EnvironmentProviders>;
}

function routerFeature<FeatureKind extends RouterFeatureKind>(
  kind: FeatureKind,
  providers: Array<Provider | EnvironmentProviders>,
): RouterFeature<FeatureKind> {
  return {ɵkind: kind, ɵproviders: providers};
}
```

⚠️ **Note the difference from HTTP:** the router's `ɵproviders` is
`Array<Provider | EnvironmentProviders>` (it can nest wrappers — `withEnabledBlockingInitialNavigation`
puts a `provideAppInitializer(...)` inside it), while `HttpFeature.ɵproviders` is bare `Provider[]`.
Chunk 04 already flagged this; cite it, don't re-derive.

`RouterFeatures`, verbatim from source and from
[`goldens/public-api/router/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/router/index.api.md):

```ts
export type RouterFeatures =
  | PreloadingFeature
  | DebugTracingFeature
  | InitialNavigationFeature
  | InMemoryScrollingFeature
  | RouterConfigurationFeature
  | NavigationErrorHandlerFeature
  | ComponentInputBindingFeature
  | ViewTransitionsFeature
  | ExperimentalAutoCleanupInjectorsFeature
  | RouterHashLocationFeature
  | ExperimentalPlatformNavigationFeature;

export const enum RouterFeatureKind {
  PreloadingFeature,
  DebugTracingFeature,
  EnabledBlockingInitialNavigationFeature,
  DisabledInitialNavigationFeature,
  InMemoryScrollingFeature,
  RouterConfigurationFeature,
  RouterHashLocationFeature,
  NavigationErrorHandlerFeature,
  ComponentInputBindingFeature,
  ViewTransitionsFeature,
  ExperimentalAutoCleanupInjectorsFeature,
  ExperimentalPlatformNavigationFeature,
}
```

**Every `with*` in the router golden at `v22.1.5`, exactly as the golden lists them:**

```ts
// @public
export function withComponentInputBinding(options?: ComponentInputBindingOptions): ComponentInputBindingFeature;
// @public
export function withDebugTracing(): DebugTracingFeature;
// @public
export function withDisabledInitialNavigation(): DisabledInitialNavigationFeature;
// @public
export function withEnabledBlockingInitialNavigation(): EnabledBlockingInitialNavigationFeature;
// @public
export function withExperimentalAutoCleanupInjectors(): ExperimentalAutoCleanupInjectorsFeature;
// @public
export function withExperimentalPlatformNavigation(): ExperimentalPlatformNavigationFeature;
// @public
export function withHashLocation(): RouterHashLocationFeature;
// @public
export function withInMemoryScrolling(options?: InMemoryScrollingOptions): InMemoryScrollingFeature;
// @public
export function withNavigationErrorHandler(handler: (error: NavigationError) => unknown | RedirectCommand): NavigationErrorHandlerFeature;
// @public
export function withPreloading(preloadingStrategy: Type<PreloadingStrategy>): PreloadingFeature;
// @public
export function withRouterConfig(options: RouterConfigOptions): RouterConfigurationFeature;
// @public
export function withViewTransitions(options?: ViewTransitionsFeatureOptions): ViewTransitionsFeature;
```

🔴 **Stability, from the JSDoc in `provide_router.ts` (NOT from the golden, §0.6):**

| Feature | JSDoc tag | How to present it |
|---|---|---|
| `withComponentInputBinding` | *(none on the fn; `@publicApi` on the type)* | stable |
| `withDebugTracing` | `@publicApi` | stable, dev-mode-only body |
| `withDisabledInitialNavigation` | `@publicApi` | stable |
| `withEnabledBlockingInitialNavigation` | `@publicApi` | stable |
| `withHashLocation` | `@publicApi` | stable |
| `withInMemoryScrolling` | `@publicApi` | stable |
| `withNavigationErrorHandler` | `@publicApi` | stable |
| `withPreloading` | `@publicApi` | stable |
| `withRouterConfig` | `@publicApi` | stable |
| **`withViewTransitions`** | **`@developerPreview 19.0`** | 🔴 label developer preview |
| **`withExperimentalAutoCleanupInjectors`** | **`@experimental 21.1`** | 🔴 never teach as shippable |
| **`withExperimentalPlatformNavigation`** | **`@experimental 21.1`** | 🔴 never teach as shippable |
| **`withRouterResources`** | **`@experimental`, absent from the golden** | 🔴 mention only as "exists, internal" |

⚠️ **`withRouterFeatures` does not exist.** §0.8.

### 08.2 Each feature's body, verbatim — this is the section that earns the page

```ts
export function withInMemoryScrolling(
  options: InMemoryScrollingOptions = {},
): InMemoryScrollingFeature {
  const providers = [
    {
      provide: ROUTER_SCROLLER,
      useFactory: () => new RouterScroller(options),
    },
  ];
  return routerFeature(RouterFeatureKind.InMemoryScrollingFeature, providers);
}
```

```ts
export function withPreloading(preloadingStrategy: Type<PreloadingStrategy>): PreloadingFeature {
  const providers = [
    {provide: ROUTER_PRELOADER, useExisting: RouterPreloader},
    {provide: PreloadingStrategy, useExisting: preloadingStrategy},
  ];
  return routerFeature(RouterFeatureKind.PreloadingFeature, providers);
}
```

```ts
export function withRouterConfig(options: RouterConfigOptions): RouterConfigurationFeature {
  const providers = [{provide: ROUTER_CONFIGURATION, useValue: options}];
  return routerFeature(RouterFeatureKind.RouterConfigurationFeature, providers);
}
```

```ts
export function withHashLocation(): RouterHashLocationFeature {
  const providers = [{provide: LocationStrategy, useClass: HashLocationStrategy}];
  return routerFeature(RouterFeatureKind.RouterHashLocationFeature, providers);
}
```

```ts
export function withNavigationErrorHandler(
  handler: (error: NavigationError) => unknown | RedirectCommand,
): NavigationErrorHandlerFeature {
  const providers = [
    {
      provide: NAVIGATION_ERROR_HANDLER,
      useValue: handler,
    },
  ];
  return routerFeature(RouterFeatureKind.NavigationErrorHandlerFeature, providers);
}
```

```ts
export function withComponentInputBinding(
  options: ComponentInputBindingOptions = {},
): ComponentInputBindingFeature {
  const providers = [
    {
      provide: INPUT_BINDER,
      useFactory: () =>
        new RoutedComponentInputBinder(options, inject(ROUTER_RESOURCES_FEATURE, {optional: true})),
    },
  ];

  return routerFeature(RouterFeatureKind.ComponentInputBindingFeature, providers);
}
```

```ts
export function withViewTransitions(
  options?: ViewTransitionsFeatureOptions,
): ViewTransitionsFeature {
  performanceMarkFeature('NgRouterViewTransitions');
  const providers = [
    {provide: CREATE_VIEW_TRANSITION, useValue: createViewTransition},
    {
      provide: VIEW_TRANSITION_OPTIONS,
      useValue: {skipNextTransition: !!options?.skipInitialTransition, ...options},
    },
  ];
  return routerFeature(RouterFeatureKind.ViewTransitionsFeature, providers);
}
```

```ts
export function withDebugTracing(): DebugTracingFeature {
  let providers: Provider[] = [];
  if (typeof ngDevMode === 'undefined' || ngDevMode) {
    providers = [
      {
        provide: ENVIRONMENT_INITIALIZER,
        multi: true,
        useFactory: () => {
          const router = inject(Router);
          return () =>
            router.events.subscribe((e: Event) => {
              // tslint:disable:no-console
              console.group?.(`Router Event: ${(<any>e.constructor).name}`);
              console.log(stringifyEvent(e));
              console.log(e);
              console.groupEnd?.();
              // tslint:enable:no-console
            });
        },
      },
    ];
  } else {
    providers = [];
  }
  return routerFeature(RouterFeatureKind.DebugTracingFeature, providers);
}
```

```ts
export function withDisabledInitialNavigation(): DisabledInitialNavigationFeature {
  const providers = [
    provideAppInitializer(() => {
      inject(Router).setUpLocationChangeListener();
    }),
    {provide: INITIAL_NAVIGATION, useValue: InitialNavigation.Disabled},
  ];
  return routerFeature(RouterFeatureKind.DisabledInitialNavigationFeature, providers);
}
```

```ts
export function withEnabledBlockingInitialNavigation(): EnabledBlockingInitialNavigationFeature {
  const providers = [
    {provide: IS_ENABLED_BLOCKING_INITIAL_NAVIGATION, useValue: true},
    {provide: INITIAL_NAVIGATION, useValue: InitialNavigation.EnabledBlocking},
    provideAppInitializer(() => {
      const injector = inject(Injector);
      const locationInitialized: Promise<any> = injector.get(
        LOCATION_INITIALIZED,
        Promise.resolve(),
      );

      return locationInitialized.then(() => {
        return new Promise((resolve) => {
          const router = injector.get(Router);
          const bootstrapDone = injector.get(BOOTSTRAP_DONE);
          afterNextNavigation(router, () => {
            // Unblock APP_INITIALIZER in case the initial navigation was canceled or errored
            // without a redirect.
            resolve(true);
          });

          injector.get(NavigationTransitions).afterPreactivation = () => {
            // Unblock APP_INITIALIZER once we get to `afterPreactivation`. At this point, we
            // assume activation will complete successfully (even though this is not
            // guaranteed).
            resolve(true);
            return bootstrapDone.closed ? of(void 0) : bootstrapDone;
          };
          router.initialNavigation();
        });
      });
    }),
  ];
  return routerFeature(RouterFeatureKind.EnabledBlockingInitialNavigationFeature, providers);
}
```

```ts
export function withExperimentalAutoCleanupInjectors(): ExperimentalAutoCleanupInjectorsFeature {
  return routerFeature(RouterFeatureKind.ExperimentalAutoCleanupInjectorsFeature, [
    {provide: ROUTE_INJECTOR_CLEANUP, useValue: routeInjectorCleanup},
  ]);
}
```

```ts
export function withExperimentalPlatformNavigation(): ExperimentalPlatformNavigationFeature {
  const devModeLocationCheck =
    typeof ngDevMode === 'undefined' || ngDevMode
      ? [
          provideEnvironmentInitializer(() => {
            const locationInstance = inject(Location);
            if (!(locationInstance instanceof ɵNavigationAdapterForLocation)) {
              const locationConstructorName = (locationInstance as any).constructor.name;
              let message =
                `'withExperimentalPlatformNavigation' provides a 'Location' implementation that ensures navigation APIs are consistently used.` +
                ` An instance of ${locationConstructorName} was found instead.`;
              if (locationConstructorName === 'SpyLocation') {
                message += ` One of 'RouterTestingModule' or 'provideLocationMocks' was likely used. 'withExperimentalPlatformNavigation' does not work with these because they override the Location implementation.`;
              }
              throw new Error(message);
            }
          }),
        ]
      : [];
  const providers = [
    {provide: StateManager, useExisting: NavigationStateManager},
    {provide: Location, useClass: ɵNavigationAdapterForLocation},
    devModeLocationCheck,
  ];
  return routerFeature(RouterFeatureKind.ExperimentalPlatformNavigationFeature, providers);
}
```

### 08.3 The option shapes, from the golden

```ts
export interface InMemoryScrollingOptions {
    anchorScrolling?: 'disabled' | 'enabled';
    scrollPositionRestoration?: 'disabled' | 'enabled' | 'top';
}

export interface RouterConfigOptions {
    canceledNavigationResolution?: 'replace' | 'computed';
    defaultQueryParamsHandling?: QueryParamsHandling;
    onSameUrlNavigation?: OnSameUrlNavigation;
    paramsInheritanceStrategy?: 'emptyOnly' | 'always';
    resolveNavigationPromiseOnError?: boolean;
    urlUpdateStrategy?: 'deferred' | 'eager';
}

export interface ComponentInputBindingOptions {
    queryParams?: boolean;
    unmatchedInputBehavior?: 'alwaysUndefined' | 'undefinedIfStale';
}

export interface ViewTransitionsFeatureOptions {
    onViewTransitionCreated?: (transitionInfo: ViewTransitionInfo) => void;
    skipInitialTransition?: boolean;
}

export interface ExtraOptions extends InMemoryScrollingOptions, RouterConfigOptions {
    bindToComponentInputs?: boolean | ComponentInputBindingOptions;
    enableTracing?: boolean;
    enableViewTransitions?: boolean;
    errorHandler?: (error: any) => RedirectCommand | any;
    initialNavigation?: InitialNavigation;
    preloadingStrategy?: any;
    scrollOffset?: [number, number] | (() => [number, number]);
    useHash?: boolean;
}
```

⚠️ **`ComponentInputBindingOptions` is new surface** — `withComponentInputBinding()` took no
arguments before. Both its fields are worth a sentence.

`ExtraOptions` is the `RouterModule.forRoot` options bag; put it beside the feature list to make
chunk 02's argument concrete — every field there maps to a `with*` that a bundler can drop.

### 08.4 The JSDoc sentences worth quoting verbatim

`withComponentInputBinding` — this block is the whole precedence rule and is easy to get wrong:

> *"The router bindings information from any of the following sources:"*
> *"- query parameters / - path and matrix parameters / - static route data / - data from resolvers"*
> *"Duplicate keys are resolved in the same order from above, from least to greatest, meaning that resolvers have the highest precedence and override any of the other information from the route."*
> *"Importantly, when an input does not have an item in the route data with a matching key, this input is set to `undefined`. This prevents previous information from being retained if the data got removed from the route (i.e. if a query parameter is removed). Default values can be provided with a resolver on the route to ensure the value is always present or an input and use an input transform in the component."*

`withViewTransitions`:

> *"Enables view transitions in the Router by running the route activation and deactivation inside of `document.startViewTransition`."*
> *"Note: The View Transitions API is not available in all browsers. If the browser does not support view transitions, the Router will not attempt to start a view transition and continue processing the navigation as usual."*

`withNavigationErrorHandler`:

> *"This function is run inside application's [injection context] so you can use the [`inject`] function."*
> *"This function can return a `RedirectCommand` to convert the error to a redirect, similar to returning a `UrlTree` or `RedirectCommand` from a guard. This will also prevent the `Router` from emitting `NavigationError`; it will instead emit `NavigationCancel` with code NavigationCancellationCode.Redirect. Return values other than `RedirectCommand` are ignored and do not change any behavior with respect to how the `Router` handles the error."*

`withHashLocation`:

> *"Provides the location strategy that uses the URL fragment instead of the history API."*

`withDebugTracing`:

> *"Enables logging of all internal navigation events to the console. Extra logging might be useful for debugging purposes to inspect Router event sequence."*

`withEnabledBlockingInitialNavigation`:

> *"Configures initial navigation to start before the root component is created."*
> *"The bootstrap is blocked until the initial navigation is complete. This should be set in case you use [server-side rendering], but do not enable [hydration] for your application."*

`withExperimentalAutoCleanupInjectors`:

> *"When enabled, the router will automatically destroy `EnvironmentInjector`s associated with `Route`s that are no longer active or stored by the `RouteReuseStrategy`."*
> *"This feature is opt-in and requires `RouteReuseStrategy.shouldDestroyInjector` to return `true` for the routes that should be destroyed. If the `RouteReuseStrategy` uses stored handles, it should also implement `retrieveStoredRouteHandles` to ensure injectors for handles that will be reattached are not destroyed."*

`withExperimentalPlatformNavigation` — quote the CRITICAL line **first**:

> *"CRITICAL: This feature is _highly_ experimental and should not be used in production. Browser support is limited and in active development. Use only for experimentation and feedback purposes."*
> *"This function provides a `Location` strategy that uses the browser's `Navigation` API. By using the platform's Navigation APIs, the Router is able to provide native browser navigation capabilities."*
> *"NOTE: Deferred entry updates are not part of the interop 2025 Navigation API commitments so the "ongoing navigation" communication support is limited."*

### 08.5 🔴 The one cross-provider interaction that trips people

`provideClientHydration()` installs a dev-mode detector that fires when
`withEnabledBlockingInitialNavigation()` is also present. From
[`packages/platform-browser/src/hydration.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/platform-browser/src/hydration.ts), verbatim:

```ts
        if (isEnabledBlockingInitialNavigation) {
          const console = inject(Console);
          const message = formatRuntimeError(
            RuntimeErrorCode.HYDRATION_CONFLICTING_FEATURES,
            'Configuration error: found both hydration and enabledBlocking initial navigation ' +
              'in the same application, which is a contradiction.',
          );
          console.warn(message);
        }
```

Belongs in **both** 08 and 11; agree which one owns it (suggest 11 owns the message, 08 links).

### 08.6 Gotchas to write

1. **"I passed the same feature twice and nothing complained."** `provideRouter` does **no**
   duplicate-kind validation at all — unlike `provideHttpClient` and `provideClientHydration`,
   which both build a `Set` of kinds and throw. `features.map((f) => f.ɵproviders)` just flattens
   them, so for non-multi providers the last one wins (§1). Fix: pass each feature once.
2. **"`withViewTransitions()` and `withRouterResources()` conflict."** They share
   `RouterFeatureKind.ViewTransitionsFeature` — `RouterResourcesFeature` is literally declared as
   `RouterFeature<RouterFeatureKind.ViewTransitionsFeature>`. Also `withRouterResources` is
   `@experimental` and not in the public golden. Fix: do not use it.
3. **"`withDebugTracing()` logs nothing in my staging build."** Its body is `ngDevMode`-gated;
   it returns `[]` in production.
4. **"Bound component inputs go `undefined` when I remove a query param."** By design, quoted
   above. Fix in code: a resolver supplying a default, or an input transform.
5. **"`withHashLocation()` had no effect."** Something later provided `LocationStrategy` —
   `withHashLocation` is a plain non-multi `{provide: LocationStrategy, useClass: HashLocationStrategy}`
   and loses to any later provider for that token, including `withExperimentalPlatformNavigation`'s
   `{provide: Location, useClass: ɵNavigationAdapterForLocation}` pairing.
6. **"`withExperimentalPlatformNavigation` throws in my tests."** Its dev-mode initializer rejects
   any non-`ɵNavigationAdapterForLocation` `Location`, and names `SpyLocation` explicitly.
   Quote the message; the fix is not to combine it with `RouterTestingModule`/`provideLocationMocks`.
7. **"Hydration + `withEnabledBlockingInitialNavigation` warns."** §08.5.
8. **"`withPreloading(PreloadAllModules)` doesn't preload."** The preloader is initialised from
   `getBootstrapListener`, which returns early for anything but the *first* bootstrapped
   component — so a second bootstrapped root, or a second `provideRouter`, changes behaviour.
9. **"My route params changed behaviour in v22."** `paramsInheritanceStrategy` default flip, §07.5.

### 08.7 Interview questions

- ★ *`provideHttpClient` throws on contradictory features; `provideRouter` does not validate at
  all. Why is that not an inconsistency?* → the router's features mostly provide *distinct*
  tokens, so a duplicate degrades to last-wins rather than to undefined behaviour; HTTP's
  contradictions target the *same* token with opposite meanings.
- ★ *`withDebugTracing()` compiles to an empty array in production. Why is it still a function
  rather than a boolean option?* → chunk 02's argument: a boolean option must import the
  implementation unconditionally; a function that is never called is never imported.
- *Which router features are not stable in v22, and how would you tell without asking?* →
  `@developerPreview 19.0` on `withViewTransitions`, `@experimental 21.1` on the two experimental
  ones, and the golden's `// @public` proves nothing (§0.6).

---

## Chunk 09 — `provideHttpClient()` and the backend

### 09.1 🔴 The fact that reframes the whole chunk: you no longer need the call to inject `HttpClient`

angular.dev, [Setting up `HttpClient`](https://angular.dev/guide/http/setup), **first line of the page**, verbatim:

> *"`HttpClient` is available for injection by default in Angular v21 and later."*

Confirmed in source. All three of the stack's tokens are root-provided:

```ts
@Injectable({providedIn: 'root'})
export class HttpClient {
```
([`packages/common/http/src/client.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/client.ts))

```ts
@Injectable({providedIn: 'root', useExisting: FetchBackend})
export abstract class HttpBackend implements HttpHandler {

@Injectable({providedIn: 'root'})
export class HttpInterceptorHandler implements HttpHandler {

@Injectable({providedIn: 'root', useExisting: HttpInterceptorHandler})
export abstract class HttpHandler {
```
([`packages/common/http/src/backend.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/backend.ts))

and even XSRF protection has a default, from
[`packages/common/http/src/interceptor.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/interceptor.ts):

```ts
/**
 * A multi-provided token of `HttpInterceptorFn`s.
 */
export const HTTP_INTERCEPTOR_FNS = new InjectionToken<readonly HttpInterceptorFn[]>(
  typeof ngDevMode !== 'undefined' && ngDevMode ? 'HTTP_INTERCEPTOR_FNS' : '',
  {factory: () => [xsrfInterceptorFn]},
);
```

🔴 **So in v22: `inject(HttpClient)` works with an empty `app.config.ts`, on the `fetch` backend,
with XSRF protection on.** `provideHttpClient()` is now about *configuration* — interceptors, XSRF
customisation, backend swap, parent delegation — not about availability. That is a genuinely new
statement for anyone whose mental model is v17.

### 09.2 `provideHttpClient` in full

[`packages/common/http/src/provider.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/common/http/src/provider.ts):

```ts
export function provideHttpClient(
  ...features: HttpFeature<HttpFeatureKind>[]
): EnvironmentProviders {
  if (ngDevMode) {
    const featureKinds = new Set(features.map((f) => f.ɵkind));
    if (
      featureKinds.has(HttpFeatureKind.NoXsrfProtection) &&
      featureKinds.has(HttpFeatureKind.CustomXsrfConfiguration)
    ) {
      throw new Error(
        `Configuration error: found both withXsrfConfiguration() and withNoXsrfProtection() in the same call to provideHttpClient(), which is a contradiction.`,
      );
    }

    const hasBackendOverride =
      featureKinds.has(HttpFeatureKind.Fetch) || featureKinds.has(HttpFeatureKind.Xhr);
    if (featureKinds.has(HttpFeatureKind.RequestsMadeViaParent) && hasBackendOverride) {
      throw new Error(
        `Configuration error: withRequestsMadeViaParent() cannot be combined with withFetch() or withXhr() in the same call to provideHttpClient().`,
      );
    }
  }

  const providers: Provider[] = [
    HttpClient,
    FetchBackend,
    HttpInterceptorHandler,
    {provide: HttpHandler, useExisting: HttpInterceptorHandler},
    {
      provide: HttpBackend,
      useFactory: () => {
        return inject(FetchBackend);
      },
    },
    {
      provide: HTTP_INTERCEPTOR_FNS,
      useValue: xsrfInterceptorFn,
      multi: true,
    },
  ];

  for (const feature of features) {
    providers.push(...feature.ɵproviders);
  }

  return makeEnvironmentProviders(providers);
}
```

🔴 **Read out of that body, precisely:**
- **The XSRF interceptor is pushed BEFORE any feature's providers.** `HTTP_INTERCEPTOR_FNS` is
  `multi: true` (append, §1), so `xsrfInterceptorFn` is always index 0 and **XSRF always runs
  first**, whatever you pass to `withInterceptors`.
- **The default backend is a `useFactory` that injects `FetchBackend`.** `withXhr()` overrides
  `HttpBackend` with `{provide: HttpBackend, useExisting: HttpXhrBackend}` *after* it, so
  last-wins applies (§1).
- **Both validations are `if (ngDevMode)` and `throw new Error`, not `RuntimeError`** — so **no
  `NGxxxx` code**. Do not invent one. Quote the two strings exactly as above.
- Both throws happen **at call time**, while the config object is being built — before any
  injector exists.
- The two contradictions are *asymmetric*: `withFetch()` + `withXhr()` together is **not** an
  error (they are two backend overrides; last wins). Only `withRequestsMadeViaParent` + either
  throws.

The feature record and kind enum, verbatim (chunk 02 already quoted `HttpFeature`; quote the enum
here because chunk 09 needs it):

```ts
export enum HttpFeatureKind {
  Interceptors,
  LegacyInterceptors,
  CustomXsrfConfiguration,
  NoXsrfProtection,
  JsonpSupport,
  RequestsMadeViaParent,
  Fetch,
  Xhr,
}
```

⚠️ Note `HttpFeatureKind` is a **plain `enum`** (`@publicApi`), while `RouterFeatureKind` is a
`const enum` marked internal. A small, real difference.

### 09.3 `withFetch` and `withXhr` — the deprecation, verbatim

```ts
/**
 * Configures the current `HttpClient` instance to make requests using the fetch API.
 *
 * Note: The Fetch API doesn't support progress report on uploads.
 *
 * @see [Advanced fetch Options](guide/http/making-requests#advanced-fetch-options)
 *
 * @publicApi
 * @deprecated `withFetch` is not required anymore. `FetchBackend` is the default `HttpBackend`.
 */
export function withFetch(): HttpFeature<HttpFeatureKind.Fetch> {
  return makeHttpFeature(HttpFeatureKind.Fetch, [
    FetchBackend,
    {provide: HttpBackend, useExisting: FetchBackend},
  ]);
}
```

CHANGELOG v22.0.0, **Deprecations / http**, verbatim:

> *"`withFetch` is now deprecated, it can be safely removed."*
> *"The `reportProgress` option is deprecated please use `reportUploadProgress` & `reportDownloadProgress` instead."*

CHANGELOG v22.0.0, **Breaking Changes / http**, verbatim:

> *"Use the `HttpXhrBackend` with `provideHttpClient(withXhr)` if you want to keep supporting upload progress reports."*

The feature commit line, from the v22.0.0 core table:

> *"feat | Use `FetchBackend` as default for the `HttpBackend` implementation"* — commit `5c432fb8bb`

and, from the same table, the migration Angular shipped for it:

> *"feat | Add a schematics to migrate `provideHttpClient` to keep using the `HttpXhrBackend` implementation."* — commit `3bc095d508`

🔴 **`withXhr()` carries a security warning that most writers miss.** Source JSDoc, verbatim:

```
 * <div class="docs-alert docs-alert-critical">
 *
 * Do not use {@link withXhr} in server-side rendering (SSR) environments. XHR support on the
 * server is **deprecated** and is intended to be removed in Angular 23 because the underlying `xhr2`
 * library does not safely handle redirects (e.g. it can forward `Authorization` headers on
 * cross-origin redirects and is susceptible to denial-of-service via redirect loops).
 *
 * </div>
```

and the same text on angular.dev's setup guide, verbatim:

> *"XHR support on the server is **deprecated** and is intended to be removed in Angular 23. The underlying `xhr2` library does not safely handle redirects: it can forward `Authorization` headers on cross-origin redirects and is susceptible to denial-of-service (DoS) via redirect loops. For SSR applications, use the default `fetch` backend instead."*

There is a matching **runtime warning** for exactly this, from `backend.ts` — `NOT_USING_FETCH_BACKEND_IN_SSR`:

```ts
      if (
        typeof ngServerMode !== 'undefined' &&
        ngServerMode &&
        !(this.backend instanceof FetchBackend) &&
        !isTestingBackend
      ) {
        fetchBackendWarningDisplayed = true;
        injector
          .get(Console)
          .warn(
            formatRuntimeError(
              RuntimeErrorCode.NOT_USING_FETCH_BACKEND_IN_SSR,
              'Angular detected that `HttpClient` is not configured ' +
                "to use `fetch` APIs. It's strongly recommended to " +
                'enable `fetch` for applications that use Server-Side Rendering ' +
                'for better performance and compatibility. ' +
                'To enable `fetch`, remove the `withXhr()` feature from the `provideHttpClient()` call',
            ),
          );
      }
```

with this comment above it, verbatim, which explains the flag:

> *"This flag is necessary because provideHttpClientTesting() overrides the backend even if `withFetch()` is used within the test. When the testing HTTP backend is provided, no HTTP calls are actually performed during the test, so producing a warning would be misleading."*

⚠️ **The numeric value of `NOT_USING_FETCH_BACKEND_IN_SSR` lives in
`packages/common/http/src/errors.ts`, which I did not read.** Common's range is 2000–2999
(from the `core` `errors.ts` header comment). Write "an `NG2xxx` runtime warning" or read the file
before naming a code. See `## 99 · UNSETTLED`.

`withFetch`'s guide statement, verbatim:

> *"By default, `HttpClient` uses the [`fetch`] API to make requests. The `withXhr` feature switches the client to use the [`XMLHttpRequest`] API instead."*
> *"`fetch` is a more modern API and is available in a few environments where `XMLHttpRequest` is not supported. It does have a few limitations, such as not producing upload progress events."*

### 09.4 The `HttpClientModule` end of the road

Chunk 02 already quoted `HttpClientModule`'s body and deprecation notice. What chunk 09 adds is
**angular.dev's own module→function table**, verbatim from the setup guide:

| **NgModule**                            | `provideHttpClient()` equivalent                         |
| --------------------------------------- | -------------------------------------------------------- |
| `HttpClientModule`                      | `provideHttpClient(withInterceptorsFromDi(), withXhr())` |
| `HttpClientJsonpModule`                 | `withJsonpSupport()`                                     |
| `HttpClientXsrfModule.withOptions(...)` | `withXsrfConfiguration(...)`                             |
| `HttpClientXsrfModule.disable()`        | `withNoXsrfProtection()`                                 |

and its callout, verbatim:

> *"When `HttpClientModule` is present in multiple injectors, the behavior of interceptors is poorly defined and depends on the exact options and provider/import ordering."*
> *"Prefer `provideHttpClient` for multi-injector configurations, as it has more stable behavior."*

🔴 **The sharpest line available for this chunk:** `HttpClientModule`'s equivalent *pins `withXhr()`*,
and per §09.3 XHR on the server is deprecated with a stated redirect/DoS risk and an intent to
remove in v23. So "we still import `HttpClientModule`" is now a **security-relevant** finding in an
SSR app, not merely a style one.

### 09.5 Gotchas to write

1. **"`inject(HttpClient)` works but my interceptor never runs."** In v22 `HttpClient` is
   root-provided; without `provideHttpClient(withInterceptors([...]))` there is no interceptor
   registration. Show the fix in code.
2. **"`Configuration error: found both withXsrfConfiguration() and withNoXsrfProtection() in the
   same call to provideHttpClient(), which is a contradiction.`"** Exact string, §09.2. Dev-mode
   only, thrown at call time. Fix: pick one.
3. **"`Configuration error: withRequestsMadeViaParent() cannot be combined with withFetch() or
   withXhr() in the same call to provideHttpClient().`"** Exact string, §09.2.
4. **"`withFetch()` shows a strikethrough in my editor."** Deprecated in v22.0.0; delete it.
5. **"Upload progress events stopped after upgrading to v22."** The default backend became
   `FetchBackend`, which does not report upload progress. Fix in code: `provideHttpClient(withXhr())`
   — and if the app is SSR, read §09.3 first, because that is the deprecated-on-server path.
6. **The SSR fetch warning fires once per process** (`fetchBackendWarningDisplayed` is a
   module-level `let`), so a second app on the same server will not warn again.
7. **"XSRF headers are sent even though I never called `provideHttpClient`."**
   `HTTP_INTERCEPTOR_FNS`'s default factory is `() => [xsrfInterceptorFn]`.
8. **"My custom interceptor runs before XSRF."** It cannot: `xsrfInterceptorFn` is pushed before
   the feature loop. §09.2, and chunk 10 for the ordering rule.
9. **"`withJsonpSupport()` is deprecated."** §10.
10. **"Two `provideHttpClient()` calls in one injector."** Non-multi entries (`HttpBackend`,
    `HttpHandler`) are last-wins; the `HTTP_INTERCEPTOR_FNS` multi entries **both** register, so
    `xsrfInterceptorFn` is registered twice. (⚠️ Whether the dedup in
    `HttpInterceptorHandler.handle` — `Array.from(new Set([...]))` — removes the duplicate: it
    does, because both entries are the *same function reference*. That is readable in §10.1's
    quote, so it is safe to state.)

### 09.6 Interview questions

- ★ *In v22, what does `provideHttpClient()` still buy you, given `HttpClient` is
  `providedIn: 'root'`?* → interceptor registration, XSRF customisation, backend swap, parent
  delegation. Availability is no longer one of them.
- ★ *`withFetch()` and `withXhr()` together does not throw, but `withRequestsMadeViaParent()` with
  either does. Why the asymmetry?* → two backend overrides for one token degrade to last-wins,
  which is *defined*; delegating to the parent while also pinning a local backend is not.
- *Why is the XSRF interceptor pushed before the feature loop rather than added by a feature?* →
  so it is unconditionally first in the multi array, i.e. so a request cannot leave without the
  token however the interceptor list is configured.

---

## Chunk 10 — `10-http-features.md`

### 10.1 🔴 Interceptor order — the two quotes that settle it

Registration, from `provider.ts`:

```ts
export function withInterceptors(
  interceptorFns: HttpInterceptorFn[],
): HttpFeature<HttpFeatureKind.Interceptors> {
  return makeHttpFeature(
    HttpFeatureKind.Interceptors,
    interceptorFns.map((interceptorFn) => {
      return {
        provide: HTTP_INTERCEPTOR_FNS,
        useValue: interceptorFn,
        multi: true,
      };
    }),
  );
}
```

Execution, from `backend.ts` — **quote the comment, it is the rule stated by the framework itself**:

```ts
  handle(initialRequest: HttpRequest<any>): Observable<HttpEvent<any>> {
    if (this.chain === null) {
      const parentHandler = this.injector.get(HttpHandler, null, {skipSelf: true});
      const isDelegating = parentHandler !== null && this.backend === parentHandler;
      const rootInterceptorFns = this.injector.get(
        HTTP_ROOT_INTERCEPTOR_FNS,
        [],
        isDelegating ? {self: true} : undefined,
      );
      const dedupedInterceptorFns = Array.from(
        new Set([...this.injector.get(HTTP_INTERCEPTOR_FNS), ...rootInterceptorFns]),
      );

      // Note: interceptors are wrapped right-to-left so that final execution order is
      // left-to-right. That is, if `dedupedInterceptorFns` is the array `[a, b, c]`, we want to
      // produce a chain that is conceptually `c(b(a(end)))`, which we build from the inside
      // out.
      this.chain = dedupedInterceptorFns.reduceRight(
        (nextSequencedFn, interceptorFn) =>
          chainedInterceptorFn(nextSequencedFn, interceptorFn, this.injector),
        interceptorChainEndFn as ChainedInterceptorFn<unknown>,
      );
    }
```

🔴 **Everything the chunk needs about ordering is in those two blocks:**
- One `multi: true` provider **per function**, mapped in array order ⇒ the array *is* the
  registration order ⇒ (§1, multi appends) the array *is* the execution order.
- `reduceRight` wrapping is what makes left-to-right true; the comment says so verbatim.
- `xsrfInterceptorFn` is registered before the feature loop (§09.2) ⇒ **XSRF is always first**.
- `Array.from(new Set([...]))` **de-duplicates by function reference** — the same interceptor
  registered twice runs once.
- `HTTP_ROOT_INTERCEPTOR_FNS` are appended **after** the local ones, and read with `{self: true}`
  when this handler is delegating to a parent.

`HTTP_ROOT_INTERCEPTOR_FNS`'s own doc comment, verbatim:

> *"A multi-provided token of `HttpInterceptorFn`s that are only set in root."*

and `HTTP_INTERCEPTORS`, the class-based token, verbatim:

```ts
/**
 * A multi-provider token that represents the array of registered
 * `HttpInterceptor` objects.
 *
 * @see [HTTP Guide](guide/http/interceptors)
 *
 * @publicApi
 */
export const HTTP_INTERCEPTORS = new InjectionToken<readonly HttpInterceptor[]>(
  typeof ngDevMode !== 'undefined' && ngDevMode ? 'HTTP_INTERCEPTORS' : '',
);
```

### 10.2 `withInterceptorsFromDi` — and the comment explaining the double-indirection

```ts
export function withInterceptorsFromDi(): HttpFeature<HttpFeatureKind.LegacyInterceptors> {
  // Note: the legacy interceptor function is provided here via an intermediate token
  // (`LEGACY_INTERCEPTOR_FN`), using a pattern which guarantees that if these providers are
  // included multiple times, all of the multi-provider entries will have the same instance of the
  // interceptor function. That way, the `HttpINterceptorHandler` will dedup them and legacy
  // interceptors will not run multiple times.
  return makeHttpFeature(HttpFeatureKind.LegacyInterceptors, [
    {
      provide: LEGACY_INTERCEPTOR_FN,
      useFactory: legacyInterceptorFnFactory,
    },
    {
      provide: HTTP_INTERCEPTOR_FNS,
      useExisting: LEGACY_INTERCEPTOR_FN,
      multi: true,
    },
  ]);
}
```

🔴 **This is the single best worked example of "why identity matters in a multi-provider" in the
whole framework**, and it is *why* the dedup `Set` in §10.1 works. The comment (typo `HttpINterceptorHandler`
included — quote it as-is or fix silently, but do not misquote) states the intent.

JSDoc, verbatim:

> *"Includes class-based interceptors configured using a multi-provider in the current injector into the configured `HttpClient` instance."*
> *"Prefer `withInterceptors` and functional interceptors instead, as support for DI-provided interceptors may be phased out in a later release."*

angular.dev, setup guide, verbatim:

> *"HELPFUL: Functional interceptors (through `withInterceptors`) have more predictable ordering and we recommend them over DI-based interceptors."*

⚠️ **`withInterceptorsFromDi` is NOT deprecated in v22** — the golden marks it plain `// @public`.
Say "discouraged, with an intent-to-phase-out sentence", not "deprecated".

### 10.3 XSRF

```ts
export function withXsrfConfiguration({
  cookieName,
  headerName,
}: {
  cookieName?: string;
  headerName?: string;
}): HttpFeature<HttpFeatureKind.CustomXsrfConfiguration> {
  const providers: Provider[] = [];
  if (cookieName !== undefined) {
    providers.push({provide: XSRF_COOKIE_NAME, useValue: cookieName});
  }
  if (headerName !== undefined) {
    providers.push({provide: XSRF_HEADER_NAME, useValue: headerName});
  }

  return makeHttpFeature(HttpFeatureKind.CustomXsrfConfiguration, providers);
}

export function withNoXsrfProtection(): HttpFeature<HttpFeatureKind.NoXsrfProtection> {
  return makeHttpFeature(HttpFeatureKind.NoXsrfProtection, [
    {
      provide: XSRF_ENABLED,
      useValue: false,
    },
  ]);
}
```

JSDoc, verbatim:

> *"Customizes the XSRF protection for the configuration of the current `HttpClient` instance."*
> *"This feature is incompatible with the `withNoXsrfProtection` feature."*

> *"Disables XSRF protection in the configuration of the current `HttpClient` instance."*
> *"This feature is incompatible with the `withXsrfConfiguration` feature."*

🔴 **`withXsrfConfiguration({})` with neither field produces an EMPTY provider array** — it is a
no-op that *still* registers `HttpFeatureKind.CustomXsrfConfiguration` and therefore still trips
the contradiction check against `withNoXsrfProtection()`. A real, findable gotcha.

Also: `withNoXsrfProtection()` does **not** remove the interceptor; it sets `XSRF_ENABLED` to
`false` and `xsrfInterceptorFn` reads that. So the interceptor still runs, first, and no-ops.

### 10.4 `withRequestsMadeViaParent`

```ts
export function withRequestsMadeViaParent(): HttpFeature<HttpFeatureKind.RequestsMadeViaParent> {
  return makeHttpFeature(HttpFeatureKind.RequestsMadeViaParent, [
    {
      provide: HttpBackend,
      useFactory: () => {
        const handlerFromParent = inject(HttpHandler, {skipSelf: true, optional: true});
        if (ngDevMode && handlerFromParent === null) {
          throw new Error(
            'withRequestsMadeViaParent() can only be used when the parent injector also configures HttpClient',
          );
        }
        return handlerFromParent;
      },
    },
  ]);
}
```

JSDoc, verbatim — the whole rationale, worth quoting at length because it is the only place the
"multiple `HttpClient` instances" model is written down:

> *"By default, `provideHttpClient` configures `HttpClient` in its injector to be an independent instance. For example, even if `HttpClient` is configured in the parent injector with one or more interceptors, they will not intercept requests made via this instance."*
> *"With this option enabled, once the request has passed through the current injector's interceptors, it will be delegated to the parent injector's `HttpClient` chain instead of dispatched directly, and interceptors in the parent configuration will be applied to the request."*
> *"If there are several `HttpClient` instances in the injector hierarchy, it's possible for `withRequestsMadeViaParent` to be used at multiple levels, which will cause the request to "bubble up" until either reaching the root level or an `HttpClient` which was not configured with this option."*
> *"This feature cannot be combined with `withFetch` or `withXhr` in the same `provideHttpClient()` call."*
> `@publicApi 19.0`

angular.dev, setup guide, verbatim:

> *"CRITICAL: You must configure an instance of `HttpClient` above the current injector, or this option is not valid and you'll get a runtime error when you try to use it."*

🔴 **The error is thrown lazily, inside the `HttpBackend` factory** — i.e. on the *first request*,
not at bootstrap. Exact string above; note again it is a bare `Error`, **no `NG` code**.

### 10.5 `withJsonpSupport` — deprecated 22.1, and why

```ts
/**
 * Add JSONP support to the configuration of the current `HttpClient` instance.
 *
 * @see {@link provideHttpClient}
 * @deprecated 22.1 JSONP is deprecated as it can cause XSS vulnerabilities. Use standard HTTP requests instead. Intent to remove in future versions of Angular.
 */
export function withJsonpSupport(): HttpFeature<HttpFeatureKind.JsonpSupport> {
  return makeHttpFeature(HttpFeatureKind.JsonpSupport, [
    JsonpClientBackend,
    {provide: JsonpCallbackContext, useFactory: jsonpCallbackContext},
    {provide: HTTP_INTERCEPTOR_FNS, useValue: jsonpInterceptorFn, multi: true},
  ]);
}
```

Golden: `// @public @deprecated`. angular.dev's setup guide still documents it neutrally with only
a `HELPFUL: Prefer using [CORS] … instead of JSONP when possible.` — **a doc/source mismatch worth
one sentence** (the deprecation landed in 22.1 and the guide has not caught up).

⚠️ `withJsonpSupport()` registers `jsonpInterceptorFn` as a **multi** entry appended after your
`withInterceptors` list, so JSONP handling runs *last* in the chain.

### 10.6 Gotchas to write

1. **"My auth interceptor sees the request after the logging one, though I listed it first."** No —
   it does not: array order *is* execution order (§10.1). If the observed order differs, a second
   `provideHttpClient` or an `HTTP_ROOT_INTERCEPTOR_FNS` registration is involved.
2. **"My interceptor runs twice."** Two distinct function references doing the same job, or a
   class interceptor pulled in both by `withInterceptorsFromDi()` and by an
   `HTTP_INTERCEPTORS` provider in a child injector. The `Set` dedups by **reference** only.
3. **"XSRF still adds a header after `withNoXsrfProtection()`."** It should not — the interceptor
   runs but `XSRF_ENABLED` is `false`. If a header appears, something else is adding it.
4. **`withXsrfConfiguration({})` + `withNoXsrfProtection()` throws even though the first is a
   no-op.** §10.3.
5. **`withRequestsMadeViaParent() can only be used when the parent injector also configures HttpClient`**
   — thrown on first request, not at bootstrap. §10.4.
6. **"Interceptors registered on a route don't apply to requests from a root service."** The root
   service injects the root `HttpClient`, whose handler was built from the root injector's
   `HTTP_INTERCEPTOR_FNS`. `withRequestsMadeViaParent()` is the *other* direction.
7. **"The chain is cached."** `if (this.chain === null)` — the interceptor chain is built once per
   `HttpInterceptorHandler` and memoised. Providers added after the first request never join it.
8. **`withJsonpSupport` deprecation** and the XSS rationale, §10.5.

### 10.7 Interview questions

- ★ *Is `withInterceptors([a, b, c])` execution order `a, b, c` or `c, b, a`, and what in the
  source proves it?* → `a, b, c`; the `reduceRight` comment.
- ★ *Why does `withInterceptorsFromDi` route through an intermediate `LEGACY_INTERCEPTOR_FN` token
  instead of providing the function directly?* → so repeated inclusion yields the **same function
  reference**, which the `Set` dedup can collapse. Quote the comment.
- ★ *You have interceptors at the root and on a lazy route. Which run, and in what order?* → the
  route's `HttpClient` is a different instance with its own chain; add
  `withRequestsMadeViaParent()` for the request to also traverse the root chain, and the
  bubbling paragraph in §10.4 describes the multi-level case.
- *Can a user interceptor run before XSRF?* → no, §09.2.

---

## Chunk 11 — `11-hydration-animations-and-the-rest.md`

### 11.1 `provideClientHydration` — the full body, and the surprise inside it

[`packages/platform-browser/src/hydration.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/platform-browser/src/hydration.ts), verbatim:

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

🔴 **Five facts, all directly readable, and they are the chunk:**
1. `withDomHydration()` is **unconditional** — hydration itself is not a feature.
2. **The HTTP transfer cache is ON by default** — `ɵwithHttpTransferCache({})` unless
   `withNoHttpTransferCache()` or `withHttpTransferCacheOptions()` was passed.
3. **Incremental hydration is ON by default** — `ɵwithIncrementalHydration()` unless
   `withNoIncrementalHydration()` was passed.
4. `provideStabilityDebugging()` is installed **automatically in dev mode** by
   `provideClientHydration()` — you rarely add it yourself under SSR.
5. `provideEnabledBlockingInitialNavigationDetector()` is the cross-check with the router (§08.5).

Its own JSDoc list, verbatim — note it already names `withNoIncrementalHydration` and **omits**
`withIncrementalHydration` from the "these functions allow you to…" list:

> *"By default, the function enables the recommended set of features for the optimal performance for most of the applications. It includes the following features:"*
> *"* Reconciling DOM hydration. … * [`HttpClient`] response caching while running on the server and transferring this cache to the client to avoid extra HTTP requests. … Incremental hydration."*
> *"These functions allow you to disable some of the default features or enable new ones:"*
> *"* {@link withNoHttpTransferCache} to disable HTTP transfer cache"*
> *"* {@link withHttpTransferCacheOptions} to configure some HTTP transfer cache options"*
> *"* {@link withI18nSupport} to enable hydration support for i18n blocks"*
> *"* {@link withEventReplay} to enable support for replaying user events"*
> *"* {@link withNoIncrementalHydration} to disable incremental hydration"*
> `@publicApi 17.0`

### 11.2 The hydration feature inventory

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

⚠️ Two neighbours in the same golden, worth a line each in "and the rest":
`provideCssVarNamespacing(namespace?: string): EnvironmentProviders` (`// @public`, new surface)
and `provideProtractorTestingSupport(options?: {usePendingTasksForStability?: boolean;}): Provider[]`
(`// @public`). ⚠️ I did **not** read `provideCssVarNamespacing`'s implementation or doc comment —
see `## 99 · UNSETTLED`.

### 11.3 `withIncrementalHydration` — the deprecation, verbatim

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

CHANGELOG v22.0.0, core features table: *"feat | make incremental hydration default behavior"* —
commit `68628dd45b`.

angular.dev, [Incremental Hydration](https://angular.dev/guide/incremental-hydration), verbatim:

> *"Incremental hydration is enabled by default when you use `provideClientHydration()`."*
> *"NOTE: Incremental Hydration depends on and enables [event replay] automatically. If you already have `withEventReplay()` in your list, you can safely remove it."*
> *"To opt out of incremental hydration, use `withNoIncrementalHydration()`"*

🔴 **`withEventReplay()` is redundant in a default v22 app — proven in core source.** From
[`packages/core/src/hydration/api.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/hydration/api.ts), verbatim:

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

So: `provideClientHydration()` → `ɵwithIncrementalHydration()` → `withEventReplay()`.
⚠️ **`withEventReplay()` is only needed when you also pass `withNoIncrementalHydration()`.**

⚠️ **angular.dev's own hydration guide has not caught up** — its "Capturing and replaying events"
section still presents `provideClientHydration(withEventReplay())` as the way to enable it, and
adds the note only at the end (verbatim: *"NOTE: If you have [incremental hydration] enabled, event
replay is automatically enabled under the hood."*). Say so on the page; the source is right.

Other hydration doc quotes worth having:

> *"IMPORTANT: Make sure that the `provideClientHydration()` call is also included into a set of providers that is used to bootstrap an application on the **server**."* — [Hydration](https://angular.dev/guide/hydration)

> *"Event Replay is a feature that improves user experience by capturing user events that were triggered before the hydration process is complete. Then those events are replayed, ensuring none of that interaction was lost."*

> *"Event replay supports _native browser events_, for example `click`, `mouseover`, and `focusin`."*

> *"Disables HTTP transfer cache. Effectively causes HTTP requests to be performed twice: once on the server and other one on the browser."* — `withNoHttpTransferCache` JSDoc

> *"The function accepts an object, which allows to configure cache parameters, such as which headers should be included (no headers are included by default), whether POST requests should be cached or a callback function to determine if a particular request should be cached."* — `withHttpTransferCacheOptions` JSDoc

### 11.4 Animations — deprecated, with dates

`provideAnimationsAsync`, from
[`packages/platform-browser/animations/async/src/providers.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/platform-browser/animations/async/src/providers.ts), verbatim:

```
 * @param type pass `'noop'` as argument to disable animations.
 *
 * @publicApi
 *
 * @deprecated 20.2 Use `animate.enter` or `animate.leave` instead. Intent to remove in v23
 */
export function provideAnimationsAsync(
```

Golden (`platform-browser/animations/async`): `// @public @deprecated`,
`provideAnimationsAsync(type?: 'animations' | 'noop'): EnvironmentProviders;`

Golden (`platform-browser/animations`) — **both eager ones are deprecated too**:

```ts
// @public @deprecated
export function provideAnimations(): Provider[];

// @public @deprecated
export function provideNoopAnimations(): Provider[];
```

⚠️ Note `provideAnimations` / `provideNoopAnimations` return **`Provider[]`**, not
`EnvironmentProviders` — so they *can* legally sit in a component's `providers` (and shouldn't).
That is a nice callback to chunk 03.

angular.dev, [Introduction to Angular animations](https://angular.dev/guide/animations/overview), **first line**, verbatim:

> *"IMPORTANT: The `@angular/animations` package is now deprecated. The Angular team recommends using native CSS with `animate.enter` and `animate.leave` for animations for all new code. Learn more at the new enter and leave [animation guide]. Also see [Migrating away from Angular's Animations package] to learn how you can start migrating to pure CSS animations in your apps."*

⚠️ **The same page then tells you to add `provideAnimationsAsync()`**, verbatim:

> *"Import `provideAnimationsAsync` from `@angular/platform-browser/animations/async` and add it to the providers list in the `bootstrapApplication` function call."*

Flag that internal contradiction on the page; the deprecation tag in source is dated (`20.2`,
intent to remove in v23) and wins.

CHANGELOG v22.0.0, breaking changes / core, animations-adjacent, verbatim:

> *"Leave animations are no longer limited to the element being removed."*
> *"change AnimationCallbackEvent.animationComplete signature"*

### 11.5 "…and the rest" — the remaining `@angular/core` providers

`provideNgReflectAttributes`, from
[`packages/core/src/ng_reflect.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/ng_reflect.ts), verbatim:

> *"Enables the logic to produce `ng-reflect-*` attributes on elements with bindings."*
> *"Note: this is a dev-mode only setting and it will have no effect in production mode. In production mode, the `ng-reflect-*` attributes are *never* produced by Angular."*
> *"Important: using and relying on the `ng-reflect-*` attributes is not recommended, they are deprecated and only present for backwards compatibility. Angular will stop producing them in one of the future versions."*

⚠️ The *attributes* are described as deprecated; the **function itself is not tagged
`@deprecated`** (golden: plain `// @public`). Be precise about which.

`provideStabilityDebugging`, from
[`packages/core/src/application/stability_debug_impl.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/stability_debug_impl.ts), verbatim:

> *"Provides an application initializer that will log information about what tasks are keeping the application from stabilizing if the application does not stabilize within 9 seconds."*
> *"The logged information includes the stack of the tasks preventing stability. This stack can be traced back to the source in the application code."*
> *"If you are using Zone.js, it is recommended that you also temporarily import "zone.js/plugins/task-tracking"."*
> *"IMPORTANT: Neither the zone.js task tracking plugin nor this utility are removed from production bundles. They are intended for temporary use while debugging stability issues during development, including for optimized production builds."*
> `@publicApi 21.1`

```ts
import 'zone.js/plugins/task-tracking';

bootstrapApplication(AppComponent, {providers: [provideStabilityDebugging()]});
```

🔴 Cross-link: `provideClientHydration()` already adds it in dev mode (§11.1), and **it is not
tree-shaken from production** — so adding it by hand and forgetting is a real shipping cost.

`provideIdleServiceWith`, from
[`packages/core/src/defer/idle_service.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/defer/idle_service.ts), verbatim:

> *"Configures Angular to use the given DI token as its `IdleService`."*
> *"The given token must be available for injection from the root injector, and the injected value must implement the `IdleService` interface."*

with the token it overrides:

```ts
export const IDLE_SERVICE = new InjectionToken<IdleService>(ngDevMode ? 'IDLE_SERVICE' : '', {
  factory: () => new RequestIdleCallbackService(),
});
```

`provideExperimentalWebMcpTools`, from
[`packages/core/src/webmcp/provide_tools.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/webmcp/provide_tools.ts), verbatim — 🔴 **label experimental**:

> *"Provides a list of WebMCP tools tied to the lifecycle of the associated `Injector`."*
> *"The tools are automatically registered when the environment is initialized and unregistered when the associated injector is destroyed."*
> *"The `tools[number].execute` function is invoked in the injection context of the associated `Injector`."*
> *"@returns An {@link EnvironmentProviders} that can be used in `bootstrapApplication` or route providers."*
> `@experimental`

### 11.6 Gotchas to write

1. **"`withEventReplay()` shows up in every tutorial — do I need it?"** No, unless you also pass
   `withNoIncrementalHydration()`. §11.3, with the core source as proof and the note that
   angular.dev's hydration guide is behind.
2. **`Configuration error: found both withIncrementalHydration() and withNoIncrementalHydration() in the same call to provideClientHydration(), which is a contradiction.`** Exact string, dev-mode only.
3. **`Configuration error: found both withHttpTransferCacheOptions() and withNoHttpTransferCache() in the same call to provideClientHydration(), which is a contradiction.`** Exact string.
4. **"Every request fires twice — once on the server, once in the browser."** Someone passed
   `withNoHttpTransferCache()`. Quote the JSDoc, which says exactly that.
5. **"`withIncrementalHydration()` is struck through."** Deprecated since v22.0.0, intent to
   remove in v24; it is a redundant re-registration of what is already on.
6. **"Hydration works locally but not in production."** `provideClientHydration()` is only in
   `app.config.ts` and not in the *server* config — quote the hydration guide's IMPORTANT.
   Cross-link chunk 17: `mergeApplicationConfig(appConfig, serverConfig)` is what makes the
   browser config apply on the server, so it usually *is* included; the failure is a custom setup.
7. **`NG0508 MISCONFIGURED_INCREMENTAL_HYDRATION`** exists in the core error enum — name it as a
   thing to look up, do not invent its message (⚠️ I did not read it; see `## 99 · UNSETTLED`).
8. **"Hydration + `withEnabledBlockingInitialNavigation()` warns."** §08.5, exact string.
9. **"`provideAnimationsAsync()` is deprecated but the guide still tells me to use it."** §11.4.
10. **"`provideStabilityDebugging()` is still in my production bundle."** By design; quote the
    IMPORTANT.
11. **"`provideAnimations()` in a component's `providers` compiled."** It returns `Provider[]`,
    not `EnvironmentProviders` — the type guard chunk 03 relies on does not apply here.

### 11.7 Interview questions

- ★ *In v22, what does `provideClientHydration()` with no arguments actually turn on?* → DOM
  hydration, the HTTP transfer cache, incremental hydration, and therefore event replay; plus, in
  dev mode, the stability debugger and the blocking-navigation detector.
- ★ *`withIncrementalHydration()` is deprecated, `withNoIncrementalHydration()` is new in 22.0.
  What does that pair tell you about how Angular ships defaults?* → the opt-in becomes the default
  and is replaced by an opt-out with a matching name; the old function stays, deprecated, with a
  removal version, so `ng update` can rewrite it.
- *Why does `provideClientHydration` validate feature contradictions but `provideRouter` does not?*
  → hydration's contradictory pairs write opposite values for one behaviour flag; the router's
  features mostly own distinct tokens.

---

## Chunk 12 — `12-what-does-not-belong.md`

This chunk is the *judgement* chunk. There is less quotable source; the leverage comes from citing
rules already established elsewhere and applying them.

### 12.1 The type-level line — already fully quoted in chunk 03

Do **not** re-derive `EnvironmentProviders`, `NG0207` or `importProvidersFrom`. Cite chunk 03 and
move on. The one thing worth restating in one line: `Component.providers` is `Provider[]`,
`ApplicationConfig.providers` is `Array<Provider | EnvironmentProviders>`.

### 12.2 What genuinely does not belong, with the source that says so

**(a) Anything a service can declare about itself.** angular.dev,
[Hierarchical injectors](https://angular.dev/guide/di/hierarchical-dependency-injection), verbatim:

> *"Using the `@Service()` decorator is preferable to using the `ApplicationConfig` `providers` array. With `@Service`, optimization tools can perform tree-shaking, which removes services that your application isn't using. This results in smaller bundle sizes."*
> *"Tree-shaking is especially useful for a library because the application which uses the library may not have a need to inject it."*

That is chunk 14's thesis; chunk 12 uses it as the first "delete this line" rule.

**(b) Component-scoped state.** From
[`packages/router/src/models.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/models.ts) and the DI guide's route-provider section (§15) — anything whose lifetime is
"one screen" belongs on the route, anything whose lifetime is "one component instance" belongs on
the component.

**(c) Feature configuration that has a `provide*` home.** Chunk 04's whole argument.

**(d) Untyped `useValue` blobs.** The `InjectionToken` doc comment, from
[`packages/core/src/di/injection_token.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/injection_token.ts), verbatim:

> *"Use an `InjectionToken` whenever the type you are injecting is not reified (does not have a runtime representation) such as when injecting an interface, callable type, array or parameterized type."*
> *"`InjectionToken` is parameterized on `T` which is the type of object which will be returned by the `Injector`. This provides an additional level of type safety."*
> *"**Important Note**: Ensure that you use the same instance of the `InjectionToken` in both the provider and the injection call. Creating a new instance of `InjectionToken` in different places, even with the same description, will be treated as different tokens by Angular's DI system, leading to a `NullInjectorError`."*

⚠️ **That last sentence contains the stale `NullInjectorError` string in the SOURCE'S OWN doc
comment at `v22.1.5`.** That is a second, independent instance of the trap chunk 16 documents —
worth one sentence here and a cross-link, because it shows the stale name survives *inside the
repository*, not only on the website.

> *"Additionally, if a `factory` is specified you can also specify the `providedIn` option, which overrides the above behavior and marks the token as belonging to a particular `@NgModule` (note: this option is now deprecated). As mentioned above, `'root'` is the default value for `providedIn`."*
> *"The `providedIn: NgModule` and `providedIn: 'any'` options are deprecated."*

🔴 **Two shippable rules out of that:** a `new InjectionToken<T>('desc', {factory: …})` is
**already root-provided** — putting it in the array is redundant; and `providedIn: 'any'` /
`providedIn: SomeNgModule` are **deprecated**, so a token doing either should be rewritten.

**(e) A string token.** `Injector.get`'s deprecated overload, from `r3_injector.ts`:

```ts
  /**
   * @deprecated from v4.0.0 use ProviderToken<T>
   * @suppress {duplicate}
   */
  abstract get<T>(token: string | ProviderToken<T>, notFoundValue?: any): any;
```

**(f) `providePlatformInitializer`.** §06.4 — it type-checks here and silently never runs. This is
the strongest single "does not belong" case in the whole topic, because nothing catches it.

**(g) Anything experimental, in production.** `provideExperimentalWebMcpTools` (`@experimental`),
`withExperimentalPlatformNavigation` / `withExperimentalAutoCleanupInjectors` (`@experimental 21.1`),
`withViewTransitions` (`@developerPreview 19.0`), `provideCheckNoChangesConfig`
(`@developerPreview 20.0`). Table them.

**(h) Dev-only debugging providers left in.** `provideStabilityDebugging` is explicitly *not*
removed from production bundles (§11.5); `provideNgReflectAttributes` is dev-mode-only in effect
but still a line in the config.

### 12.3 The mechanical costs of a bloated array — each with its source

- **Every entry is eagerly *registered*.** `R3Injector`'s constructor walks the whole tree at
  construction (§1) and calls `processProvider` on each leaf. Instantiation is lazy;
  **registration is not**. So a forty-entry array is forty `Map.set`s at bootstrap regardless of
  what you inject.
- **Every entry is a reachable import.** Chunk 02's argument, reversed: what you *do* call, you do
  ship.
- **Collisions become invisible.** §1: last non-multi wins, silently, and dev-mode validation
  exists only where a `provide*` function chose to write it.
- **Multi tokens accumulate.** Two `provideRouter` calls append route tables (§07.3), two
  `provideHttpClient` calls append `xsrfInterceptorFn` twice (deduped by reference, §10.1) — the
  behaviour differs per token and you have to know which is which.

### 12.4 Gotchas to write

1. **"I added the provider and it silently did nothing."** `providePlatformInitializer` (§06.4);
   or a route-level `provideRouter` (§07.7); or an entry shadowed by a later one (§1).
2. **"Two tokens with the same description resolve differently."** Two `new InjectionToken`
   instances. Quote the Important Note. Fix in code: export one const from one module.
3. **"`providedIn: 'any'` is flagged."** Deprecated, §12.2(d).
4. **"I provided the token and the factory too."** A token with a `factory` is already
   root-provided; the array entry is redundant unless it is deliberately overriding.
5. **"`{provide: 'API_URL', useValue: …}`."** String tokens go through the deprecated
   `Injector.get` overload and have no type. Fix in code with a typed `InjectionToken<string>`.
6. **"My component gets a second instance of a root service."** It is listed in the component's
   `providers`; chunk 01 already has this gotcha — cross-link, do not duplicate.
7. **"Our `app.config.ts` is 60 lines."** Chunk 04's `provideFeature()` refactor.
8. **"Dev-only providers shipped."** §12.2(h).

### 12.5 Interview questions

- ★ *Given a 40-line `app.config.ts`, what is your triage order?* → (1) anything that could be
  `@Service()`; (2) anything feature-scoped that could be a route's `providers`; (3) anything that
  could be one `provideFeature()`; (4) anything experimental or dev-only; (5) `useValue` blobs
  that want a typed `InjectionToken`.
- ★ *Is a long provider array a runtime cost or only a bundle cost?* → both, but asymmetrically:
  registration is eager and O(n) at bootstrap, instantiation is lazy, and the bundle cost is the
  one that scales with what the entries drag in.
- *Why is `providePlatformInitializer` in `app.config.ts` worse than a type error?* → because it
  compiles, registers, and never runs; nothing in the framework will ever tell you.

---

## Chunk 13 — `13-order-dependence.md`

Everything mechanical for this chunk is in **§1** — quote it there, not here. This section adds
the *cases*.

### 13.1 Where order genuinely matters

| Case | Rule | Proof |
|---|---|---|
| Same non-multi token, twice | **last wins** | §1, `this.records.set(token, record)` |
| Framework default vs your provider | **yours wins** | §1, `...(appProviders \|\| [])` is spread last |
| `provideZoneChangeDetection()` over the zoneless default | **yours wins** — `ZONELESS_ENABLED` `true → false` | §05.2 |
| `withXhr()` over the default fetch backend | **later wins** on `HttpBackend` | §09.2 |
| `withHashLocation()` vs a later `LocationStrategy` | **later wins** | §08.2 |
| `withInterceptors([a,b,c])` | **array order IS execution order** | §10.1, the `reduceRight` comment |
| `xsrfInterceptorFn` vs your interceptors | **XSRF always first**, unconditionally | §09.2, pushed before the feature loop |
| Two `provideRouter` calls | **append**, `.flat()` in registration order | §07.3 |
| `mergeApplicationConfig(a, b)` | **concat**, so `b` overrides `a` | §17.1 |
| Nested arrays / nested `EnvironmentProviders` | **depth-first, source order** | §1, `forEachSingleProvider` |
| App initializers | started **in array order**, then `Promise.all` — **not sequential** | §06.2 |
| Environment initializers | called in array order, `{self: true}`, return value discarded | §06.3 |

### 13.2 Where order does NOT matter, and people think it does

- **Between a `provide*` and the services it configures.** Registration is eager but instantiation
  is lazy (§1, `NOT_YET` records; `hydrate` runs on first `get`). `provideRouter(routes)` before or
  after `provideHttpClient()` is identical.
- **Between two `provide*` calls that touch disjoint tokens.** Which is most of them.
- **Whether a `provide*` comes before or after a plain `{provide: X, useValue: …}` for a
  *different* token.**
- **`multi` accumulation across different tokens.**
- **Relative to `providedIn: 'root'` services.** Those are not in the array at all; they are
  `ɵprov` records resolved on demand.

### 13.3 The mixed-multi error

From
[`packages/core/src/render3/errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts), verbatim:

```ts
export function throwMixedMultiProviderError() {
  throw new Error(`Cannot mix multi providers and regular providers`);
}
```

🔴 **A bare `Error` with no `NG` code**, thrown from `processProvider` in **dev mode only**, in
*both* directions (multi after non-multi, and non-multi after multi). Exact string above.

### 13.4 The one worked example the chunk should build

A single `app.config.ts` where five different collision rules apply at once, each traceable to a
row of §13.1. Suggested shape (all of it verifiable from this bank; **write it out fully, no
elisions**):

```ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(publicRoutes, withInMemoryScrolling({scrollPositionRestoration: 'top'})),
    provideRouter(adminRoutes),                       // APPENDS — two ROUTES entries, .flat()ed
    provideHttpClient(withInterceptors([authInterceptor, loggingInterceptor])),
    provideZoneChangeDetection({eventCoalescing: true}),   // OVERRIDES the zoneless default
    {provide: ErrorHandler, useClass: SentryErrorHandler}, // OVERRIDES the default ErrorHandler
    {provide: ErrorHandler, useClass: ConsoleErrorHandler},// and THIS one wins — last non-multi
  ],
};
```

and then walk it: routes concatenate; interceptors run `xsrf → auth → logging`; `NgZone` is real;
`ConsoleErrorHandler` silently beats `SentryErrorHandler`; and nothing warns about the last one.

### 13.5 Gotchas to write

1. **"Two providers for the same token and no warning."** Last wins, silently. Fix in code: one
   provider, or a deliberate `useFactory` that composes them.
2. **`Cannot mix multi providers and regular providers`** — §13.3.
3. **"Moving `provideRouter` to the top of the array changed which routes match."** It changed
   `ROUTES` registration order and therefore `.flat()` order (§07.3).
4. **"Reordering `provideHttpClient` and `provideRouter` fixed nothing."** Disjoint tokens; the
   real cause is elsewhere.
5. **"My interceptor order changed after I extracted a helper."** The array passed to
   `withInterceptors` is the order; extracting changed the array.
6. **"`provideZonelessChangeDetection()` after `provideZoneChangeDetection()` reverted my zone."**
   Last wins on `ZONELESS_ENABLED` and `NgZone`; NG0408 warns but does not stop it (§05.4).
7. **"The server config overrode my browser config."** §17 — `mergeApplicationConfig` concatenates
   left-to-right, so the *later* config's providers win for non-multi tokens.
8. **"My two app initializers race."** §06.2 — `Promise.all`, not sequential.
9. **"An env initializer's promise is ignored."** §06.3.
10. **"A provider I added at the end of a nested array didn't win."** It did — but the *flatten*
    is depth-first, so a nested array's contents come before whatever follows the nested array,
    not after everything.

### 13.6 Interview questions

- ★ *Two providers for the same token: which wins, and what in the source decides it?* → the
  later; `this.records.set(token, record)` on a `Map`.
- ★ *`provideRouter` twice appends, `provideHttpClient` twice mostly last-wins. Same array, same
  injector — why the different outcome?* → `multi: true` vs not; §1.
- ★ *Does moving a `provide*` earlier in the array ever change when a service is constructed?* →
  no. Registration is eager, instantiation is lazy on first injection. Order changes *which record
  exists*, never *when it is built*.
- *Why is there no framework warning for a duplicate non-multi provider?* → because overriding is
  the intended mechanism — it is how your config beats the framework's prepended defaults.

---

## Chunk 14 — `providedIn: 'root'` vs listing in the array

### 14.1 The load-bearing quote

angular.dev, [Hierarchical injectors](https://angular.dev/guide/di/hierarchical-dependency-injection),
in a `docs-callout` titled *"Tree-shaking and @Service()"*, verbatim:

> *"Using the `@Service()` decorator is preferable to using the `ApplicationConfig` `providers` array. With `@Service`, optimization tools can perform tree-shaking, which removes services that your application isn't using. This results in smaller bundle sizes."*
> *"Tree-shaking is especially useful for a library because the application which uses the library may not have a need to inject it."*

and, from the same page's opening table, verbatim:

> *"`EnvironmentInjector` hierarchy | Configure an `EnvironmentInjector` in this hierarchy using `@Service()` or `providers` array in `ApplicationConfig`."*

> *"There are two more injectors above `root`, an additional `EnvironmentInjector` and `NullInjector()`."*

> *"The `bootstrapApplication()` method creates a child injector of the platform injector which is configured by the `ApplicationConfig` instance. This is the `root` `EnvironmentInjector`."*

> *"The next parent injector in the hierarchy is the `NullInjector()`, which is the top of the tree. If you've gone so far up the tree that you are looking for a service in the `NullInjector()`, you'll get an error unless you've used `@Optional()`…"*

### 14.2 The three benefits, verbatim

angular.dev, [Creating and using services](https://angular.dev/guide/di/creating-and-using-services), verbatim:

> *"Services are provisioned at the root level by default. When a service is provided globally, Angular guarantees three main benefits:"*
> *"- **Singleton Instance:** Creates a single, shared instance for the entire application."*
> *"- **Global Availability:** Automatically accessible anywhere without manual provider registration."*
> *"- **Tree-shakability:** Ensures the service is excluded from the final production bundle if your code never explicitly uses it."*

and the `@Service` vs `@Injectable` decision table, verbatim (reproduce it, it is exactly the
comparison this chunk needs):

> *"The `@Service` decorator serves as a modern, ergonomic shorthand for the traditional `@Injectable({ providedIn: 'root' })` syntax."*

| Feature / Requirement                         | `@Service` | `@Injectable`                           |
| --------------------------------------------- | ---------- | --------------------------------------- |
| **`inject()` function support**               | Yes        | Yes                                     |
| **Constructor-based DI**                      | ❌ No      | Yes                                     |
| **Implicit root singleton provider**          | Yes        | ❌ No (requires `{providedIn: 'root'}`) |
| **Advanced provider keys (`useClass`, etc.)** | ❌ No      | Yes                                     |
| **Custom initialization factories**           | Yes        | Yes                                     |
| **Non-root scopes (`platform`, etc.)**        | ❌ No      | Yes                                     |

> *"While `providedIn: 'root'` covers most use cases, Angular also provides additional ways you can configure services for more specialized scenarios: **Component-specific instances** … **Manual configuration** … **Factory providers** … **Value providers**"*

`Injectable`'s `providedIn` type, from
[`goldens/public-api/core/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/core/index.api.md):

```ts
    providedIn?: Type<any> | 'root' | 'platform' | 'any' | null;
```

⚠️ **`providedIn: 'any'` and `providedIn: SomeNgModule` are deprecated** — from the
`InjectionToken` doc comment (§12.2(d)), verbatim: *"The `providedIn: NgModule` and
`providedIn: 'any'` options are deprecated."* For `Injectable` specifically I did not find an
equivalent sentence; see `## 99 · UNSETTLED`.

### 14.3 The mechanism, in one paragraph (do not go further — Phase 6 owns it)

`providedIn` compiles to a `ɵprov` static on the class (`ɵɵdefineInjectable`), so the *class file*
carries its own provider record. Nothing in the application's import graph has to mention it; the
record is found by the injector only when someone injects the class, and if nobody does, the class
is unreachable from the entry point and the bundler drops it. Listing the same class in
`ApplicationConfig.providers` puts a **static reference** to it in `app.config.ts`, which makes it
reachable **whether or not anything injects it**. That is the entire tree-shaking difference, and
it is the same reachability argument as chunk 02.

`InjectionToken` has the identical property, from its doc comment, verbatim:

> *"When creating an `InjectionToken`, you can optionally specify a factory function which returns (possibly by creating) a default value of the parameterized type `T`. This sets up the `InjectionToken` using this factory as a provider as if it was defined explicitly in the application's root injector."*
> *"As mentioned above, `'root'` is the default value for `providedIn`."*

Real examples of tokens with default factories, all quoted elsewhere in this bank — use them as
the worked evidence rather than inventing one:
`ZONELESS_ENABLED` (`{factory: () => true}`, §05.2), `HTTP_INTERCEPTOR_FNS`
(`{factory: () => [xsrfInterceptorFn]}`, §09.1), `INITIAL_NAVIGATION`
(`{factory: () => InitialNavigation.EnabledNonBlocking}`, §07.6), `IDLE_SERVICE` (§11.5),
`INTERNAL_APPLICATION_ERROR_HANDLER` (§06.5), `BOOTSTRAP_DONE` (§07.6).

### 14.4 When you still need the array

1. **You are not the author of the class** — you cannot add a decorator to someone else's type.
2. **You are overriding** — `{provide: ErrorHandler, useClass: MyHandler}`, `useExisting`,
   `useFactory`, `useValue`. The default `ErrorHandler` (§06.5) is a plain class with no
   `providedIn`, so overriding it is *the* canonical example.
3. **The thing is not a class** — a token, a config object, a function.
4. **A `provide*` returns `EnvironmentProviders`** — by construction it can only go here.
5. **Multi-providers** — `APP_INITIALIZER`, `ENVIRONMENT_INITIALIZER`, `HTTP_INTERCEPTOR_FNS`,
   `ROUTES`, `APP_BOOTSTRAP_LISTENER`. A class cannot declare itself into a multi token.
6. **Non-root scope** — `providedIn: 'platform'`, or a route's `providers`.
7. **`@Service()` cannot express it** — constructor DI, `useClass`, non-root scopes (the table).

### 14.5 Gotchas to write

1. **"I added `@Service()` and also listed it in the array — is that wrong?"** It is redundant and
   it defeats the tree-shaking benefit, because the array is a static reference.
2. **"The service is `providedIn: 'root'` but I get two instances."** A component or a route also
   lists it. Cross-link chunk 01's gotcha and chunk 15.
3. **"Tree-shaking didn't happen even with `@Service()`."** Something references the class —
   a barrel file, a type-only import that was not erased, a `useExisting` elsewhere.
4. **"`providedIn: 'any'` is flagged as deprecated."** §12.2(d).
5. **"I can't use constructor injection with `@Service()`."** The table says so; use `inject()`
   or `@Injectable({providedIn: 'root'})`.
6. **"My token has a factory and I also provided it."** The array entry wins (§1) — fine if
   deliberate, a silent surprise if not.
7. **"`@Service()` on an abstract class / with `useClass`."** Not supported; the table's last two
   rows.

### 14.6 Interview questions

- ★ *`@Service()` and listing the class in `providers` give the same singleton. Why prefer the
  decorator?* → the callout, verbatim, plus the reachability explanation in §14.3.
- ★ *Name four things that cannot use `providedIn` and must be in the array.* → overrides,
  non-class tokens, multi-providers, `EnvironmentProviders`.
- *Why is the default `ErrorHandler` a plain class rather than `providedIn: 'root'`?* → because
  overriding it is expected, and a root-provided default would still be overridable but the plain
  class makes the override the *only* record. (⚠️ this reasoning is mine; the source does not say
  it. Write it as a reading or leave it out.)
- *What is the difference between `providedIn: 'root'` and `providedIn: 'platform'`?* → Phase 6;
  name it and stop.

---

## Chunk 15 — `15-route-level-providers.md`

### 15.1 The type and the doc comment — the whole contract

From
[`packages/router/src/models.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/router/src/models.ts), verbatim:

```ts
  /**
   * A `Provider` array to use for this `Route` and its `children`.
   *
   * The `Router` will create a new `EnvironmentInjector` for this
   * `Route` and use it for this `Route` and its `children`. If this
   * route also has a `loadChildren` function which returns an `NgModuleRef`, this injector will be
   * used as the parent of the lazy loaded module.
   * @see [Route providers](guide/di/defining-dependency-providers#route-providers)
   */
  providers?: Array<Provider | EnvironmentProviders>;
```

🔴 Note the type is the **same union** as `ApplicationConfig.providers` — which is why
`provideHttpClient()` on a route is legal and `provideHttpClient()` on a component is not
(chunk 03's table already lists this row; cite it).

### 15.2 angular.dev's guidance, verbatim

[Defining dependency providers](https://angular.dev/guide/di/defining-dependency-providers#route-providers), verbatim:

> *"Use route-level providers for:"*
> *"- **Feature-specific services** - Services only needed for particular routes or feature modules"*
> *"- **Lazy-loaded module dependencies** - Services that should only load with specific features"*
> *"- **Route-specific configuration** - Settings that vary by application area"*

and its example, verbatim (reproduce it; it is the doc's own and it is complete):

```ts
// routes.ts
export const routes: Routes = [
  {
    path: 'admin',
    providers: [
      AdminService, // Only loaded with admin routes
      {provide: FEATURE_FLAGS, useValue: {adminMode: true}},
    ],
    loadChildren: () => import('./admin/admin.routes'),
  },
  {
    path: 'shop',
    providers: [
      ShoppingCartService, // Isolated shopping state
      PaymentService,
    ],
    loadChildren: () => import('./shop/shop.routes'),
  },
];
```

> *"Services provided at the route level are available to all components and directives within that route, as well as to its guards and resolvers."*

🔴 *"Since these services are instantiated independently of the route's components, they do not have direct access to route-specific information."* — that sentence is the chunk's best gotcha seed.

The DI guide's model sentence, verbatim:

> *"You have the option to create `EnvironmentInjector` hierarchies whenever a dynamically loaded component is created, such as with the Router, which will create child `EnvironmentInjector` hierarchies."*

### 15.3 What a route injector actually does with initializers — the non-obvious half

From §06.3: `resolveInjectorInitializers()` reads `ENVIRONMENT_INITIALIZER` with **`{self: true}`**.
So a route injector runs **only its own** environment initializers. A `provideBrowserGlobalErrorListeners()`
on a route registers a *second* set of window listeners scoped to that route injector's lifetime
(they are removed via `inject(DestroyRef).onDestroy(...)`, §06.5).

By contrast `APP_INITIALIZER` is consumed once by `ApplicationInitStatus` during bootstrap
(§06.2) — a `provideAppInitializer()` on a route is registered in a route injector that did not
exist at bootstrap, so **it never runs**. ⚠️ That inference follows from §06.2 + §15.1 but I did
not find a doc sentence stating it; write it as "follows from the mechanism" or verify.

### 15.4 The router features that are route-shaped, and the ones that are not

- **Route-shaped:** `provideHttpClient(withRequestsMadeViaParent(), withInterceptors([...]))` —
  §10.4's whole design is about exactly this hierarchy; the NG0207 doc page's own "For
  route-specific providers" example is `providers: [provideHttpClient(withInterceptors([authInterceptor]))]`
  on an `admin` route (quoted verbatim in §16.4).
- **Not route-shaped:** `provideRouter` (§07.7 #5), `provideZoneChangeDetection` (§05.7 #4),
  `providePlatformInitializer` (§06.4), `provideClientHydration` (bootstrap-time).
- **Explicitly allowed on routes by its own JSDoc:** `provideExperimentalWebMcpTools` —
  *"@returns An {@link EnvironmentProviders} that can be used in `bootstrapApplication` or route providers."* (§11.5)

### 15.5 Forward references this chunk owes

- **Phase 6 — Dependency injection** *(not written yet)*: how the route injector sits in the
  hierarchy, `@SkipSelf`, and resolution.
- **Phase 8 — Routing** *(not written yet)*: `loadChildren`, `loadComponent`, guards, resolvers,
  `RouteReuseStrategy` (and `withExperimentalAutoCleanupInjectors`, §08.2, which is about
  destroying these injectors).

### 15.6 Gotchas to write

1. **"My route-level service is a singleton across two sibling routes."** Chunk 04 already has the
   double-`provideBilling` gotcha — cross-link, then add the sibling case: two routes each with
   their own `providers` get **two** injectors and two instances; one parent route with
   `providers` and two children get **one**.
2. **"The route-level provider didn't apply to a service that was already created."** The root
   instance already exists (chunk 04's gotcha, cited).
3. **"`provideAppInitializer` on a route never ran."** §15.3.
4. **"A guard can't see my route-provided service."** It can — the doc says guards and resolvers
   are included. If it cannot, the guard is on a *parent* route.
5. **"My route service can't read the route params."** Quoted sentence in §15.2.
6. **"`provideRouter` on a route did nothing."** §07.7 #5.
7. **"The route injector never gets destroyed."** By default route injectors are not
   automatically cleaned up; `withExperimentalAutoCleanupInjectors()` is the (experimental) opt-in,
   §08.2 — quote its JSDoc and label it experimental.
8. **"`importProvidersFrom` on a route."** Legal (chunk 03's table) and it is the documented
   NG0207 remedy; the tree-shaking price still applies.

### 15.7 Interview questions

- ★ *Route `providers` and `ApplicationConfig.providers` have the identical type. What is actually
  different?* → the injector's lifetime and position, not the type. One is created by
  `bootstrapApplication` and lives for the application; the other is created by the `Router` per
  route and is (by default) never destroyed.
- ★ *You want a feature's services to load only with the feature. Route `providers` or
  `providedIn: 'root'` plus lazy `loadComponent`?* → both tree-shake; route `providers` also gives
  you a *lifetime* and lets you scope configuration tokens per feature. `providedIn: 'root'` gives
  you a singleton whose code still lazy-loads.
- *Which `provide*` functions are wrong on a route even though they compile?* → §15.4.

---

## Chunk 16 — The injector error surface

🔴 **This is the chunk with the live trap. Read §16.1 before writing a single line.**

### 16.1 The contradiction, stated exactly

**angular.dev says one thing. The v22.1.5 source says another. The source is right.**

**What angular.dev's DI troubleshooting guide says**, verbatim from
[`adev/src/content/guide/di/debugging-and-troubleshooting-di.md`](https://github.com/angular/angular/blob/v22.1.5/adev/src/content/guide/di/debugging-and-troubleshooting-di.md)
at tag `v22.1.5`, published at
<https://angular.dev/guide/di/debugging-and-troubleshooting-di>:

> *"### NullInjectorError: No provider for [Service]"*
> *"**Error code:** None (displayed as `NullInjectorError`)"*
> *"This error occurs when Angular cannot find a provider for a token in the injector hierarchy. The error message includes a dependency path showing where the injection was attempted."*

```
NullInjectorError: No provider for UserClient!
  Dependency path: App -> AuthClient -> UserClient
```

> *"Angular resolves dependencies by walking up the injector hierarchy. When a `NullInjectorError` occurs, understanding this search order helps you identify where to add the missing provider."*
> *"1. **Element injector** - The current component or directive / 2. **Parent element injectors** - Up the DOM tree through parent components / 3. **Environment injector** - The route or application injector / 4. **NullInjector** - Throws `NullInjectorError` if not found"*

**What the source actually throws**, verbatim —
[`packages/core/src/di/null_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/null_injector.ts), **the entire file body**:

```ts
export class NullInjector implements Injector {
  get(token: any, notFoundValue: any = THROW_IF_NOT_FOUND): any {
    if (notFoundValue === THROW_IF_NOT_FOUND) {
      const message = ngDevMode ? `No provider found for \`${stringify(token)}\`.` : '';
      const error = createRuntimeError(message, RuntimeErrorCode.PROVIDER_NOT_FOUND);

      // Note: This is the name used by the primitives to identify a not found error.
      error.name = 'ɵNotFound';

      throw error;
    }
    return notFoundValue;
  }
}
```

🔴 **Four differences, every one of them observable:**

| | angular.dev's guide | `v22.1.5` source |
|---|---|---|
| `error.name` | `NullInjectorError` | **`ɵNotFound`** |
| message | ``No provider for UserClient!`` | ``No provider found for `UserClient`.`` |
| code | *"None"* | **`NG0201`** (`PROVIDER_NOT_FOUND = -201`) |
| path label | `Dependency path: A -> B -> C` | **`Path: A -> B -> C.`** |

**There is no `NullInjectorError` class in `@angular/core` at `v22.1.5`.** The string survives in
exactly two places in the repository: this guide, and the `InjectionToken` doc comment
(§12.2(d)) — *"…will be treated as different tokens by Angular's DI system, leading to a
`NullInjectorError`."* Both are stale prose, not code.

**Say this on the page**, per the house rule: docs and source disagree, and the source wins.

### 16.2 The message you actually get, assembled from source

The formatter,
[`packages/core/src/render3/errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts), verbatim:

```ts
export function createRuntimeError(message: string, code: number, path?: string[]): Error {
  // Cast to `any`, so that extra info can be monkey-patched onto this instance.
  const error = new RuntimeError(code, message) as any;

  // Monkey-patch a runtime error code and a path onto an Error instance.
  error[NG_RUNTIME_ERROR_CODE] = code;
  error[NG_RUNTIME_ERROR_MESSAGE] = message;
  if (path) {
    error[NG_TOKEN_PATH] = path;
  }
  return error;
}

export function prependTokenToDependencyPath(
  error: any,
  token: ProviderToken<unknown> | {multi: true; provide: ProviderToken<unknown>},
): void {
  error[NG_TOKEN_PATH] ??= [];
  // Append current token to the current token path. Since the error
  // is bubbling up, add the token in front of other tokens.
  const currentPath = error[NG_TOKEN_PATH];
  // Do not append the same token multiple times.
  let pathStr: string;
  if (typeof token === 'object' && 'multi' in token && token?.multi === true) {
    assertDefined(token.provide, 'Token with multi: true should have a provide property');
    pathStr = stringifyForError(token.provide);
  } else {
    pathStr = stringifyForError(token);
  }

  if (currentPath[0] !== pathStr) {
    (error[NG_TOKEN_PATH] as string[]).unshift(pathStr);
  }
}

export function augmentRuntimeError(error: any, source: string | null): Error {
  const tokenPath: string[] = error[NG_TOKEN_PATH];
  const errorCode = error[NG_RUNTIME_ERROR_CODE];
  const message = error[NG_RUNTIME_ERROR_MESSAGE] || error.message;
  error.message = formatErrorMessage(message, errorCode, tokenPath, source);
  return error;
}

function formatErrorMessage(
  text: string,
  code: number,
  path: string[] = [],
  source: string | null = null,
): string {
  let pathDetails = '';
  // If the path is empty or contains only one element (self) -
  // do not append additional info the error message.
  if (path && path.length > 1) {
    pathDetails = ` Path: ${path.join(' -> ')}.`;
  }
  const sourceDetails = source ? ` Source: ${source}.` : '';
  return formatRuntimeError(code, `${text}${sourceDetails}${pathDetails}`);
}
```

and where it is driven, from
[`r3_injector.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/di/r3_injector.ts), verbatim:

```ts
      // If there was a cyclic dependency error or a token was not found,
      // an error is thrown at the level where the problem was detected.
      // The error propagates up the call stack and the code below appends
      // the current token into the path. As a result, the full path is assembled
      // at the very top of the call stack, so the final error message can be
      // formatted to include that path.
      const errorCode = getRuntimeErrorCode(error);
      if (
        errorCode === RuntimeErrorCode.CYCLIC_DI_DEPENDENCY ||
        errorCode === RuntimeErrorCode.PROVIDER_NOT_FOUND
      ) {
        // Note: we use `if (ngDevMode) { ... }` instead of an early return.
        // ESBuild is conservative about removing dead code that follows `return;`
        // inside a function body, so the block may remain in the bundle.
        // Using a conditional ensures the dev-only logic is reliably tree-shaken
        // in production builds.
        if (ngDevMode) {
          prependTokenToDependencyPath(error, token);

          if (previousInjector) {
            // We still have a parent injector, keep throwing
            throw error;
          } else {
            // Format & throw the final error message when we don't have any previous injector
            throw augmentRuntimeError(error, this.source);
          }
        } else {
          throw new RuntimeError(errorCode, null);
        }
      } else {
        throw error;
      }
```

🔴 **Assemble the dev-mode message from those three pieces** and present it as a construction, not
as a captured transcript (there is no sandbox — say "assembled from the source, not captured"):

- text: ``No provider found for `UserClient`.``
- `+ sourceDetails`: `` Source: Environment Injector.`` — `this.source` is the injector's debug
  name; chunk 01 already established that `internalCreateApplication` passes
  `debugName: 'Environment Injector'` in dev mode.
- `+ pathDetails`: `` Path: App -> AuthClient -> UserClient.`` — only when the path has **more than
  one** entry.
- `formatRuntimeError` prefixes `NG0201: ` and, because `-201 < 0` and `ngDevMode`, appends
  `` Find more at https://angular.dev/errors/NG0201``. The text already ends in `.`, so
  `addPeriodSeparator` is false and no extra period is inserted.

🔴 **And the production form: `NG0201`, nothing else.** `throw new RuntimeError(errorCode, null)` —
no token name, no path, no source, no link. That is the single most useful practical fact in the
chunk: *a DI failure in a production build tells you nothing but the code.*

### 16.3 The second, different NG0201 — do not conflate them

Also in `errors_di.ts`, verbatim:

```ts
/** Throws an error when a token is not found in DI. */
export function throwProviderNotFoundError(
  token: ProviderToken<unknown>,
  injectorName?: string,
): never {
  const errorMessage =
    ngDevMode &&
    `No provider for ${stringifyForError(token)} found${injectorName ? ` in ${injectorName}` : ''}`;
  throw new RuntimeError(RuntimeErrorCode.PROVIDER_NOT_FOUND, errorMessage);
}
```

🔴 **Same code `NG0201`, different string** — `No provider for UserClient found` /
`No provider for UserClient found in NodeInjector`, **no backticks, no trailing period, no
`ɵNotFound` name, no `Path:`**. Two message shapes behind one code is exactly the sort of thing
that makes a stale doc plausible; name both and say which comes from where (the `NullInjector`
one is the end of the *environment* walk; this one is thrown directly by the element-injector
path). ⚠️ I did not read the render3 call sites, so attribute the second one as "thrown by
`throwProviderNotFoundError`" and do not over-claim exactly which lookups reach it.

### 16.4 NG0207 — the doc page, verbatim and complete

Chunk 03 already quotes the two thrown strings. What chunk 16 adds is the **guide page**, which is
short and entirely reproducible:
[`adev/src/content/reference/errors/NG0207.md`](https://github.com/angular/angular/blob/v22.1.5/adev/src/content/reference/errors/NG0207.md) → <https://angular.dev/errors/NG0207>

> *"# EnvironmentProviders in wrong context"*
> *"This error occurs when `EnvironmentProviders` are used in a context that only accepts regular providers, such as a component's `providers` array. Environment providers are designed for application-wide configuration and can only be used in environment injectors (like the root injector configured in `bootstrapApplication` or route configurations)."*
> *"The error message specifies which provider caused the issue. Check that all items in your component's `providers` array are regular providers, not environment providers returned by functions like `provideHttpClient()`, `provideRouter()`, or `importProvidersFrom()`."*

Its "For route-specific providers" remedy, verbatim — reuse this in chunk 15 too:

```ts
const routes: Routes = [
  {
    path: 'admin',
    component: AdminView,
    providers: [provideHttpClient(withInterceptors([authInterceptor]))],
  },
];
```

### 16.5 🔴 The NG0201 guide page is the stale one — quote it as evidence

[`adev/src/content/reference/errors/NG0201.md`](https://github.com/angular/angular/blob/v22.1.5/adev/src/content/reference/errors/NG0201.md) → <https://angular.dev/errors/NG0201>, verbatim and in full:

> *"# No Provider Found"*
> *"You see this error when you try to inject a service but have not declared a corresponding provider. A provider is a mapping that supplies a value that you can inject into the constructor of a class in your application."*
> *"## Debugging the error"*
> *"Work backwards from the object where the error states that a provider is missing: `No provider for ${this}!`. This is commonly thrown in services, which require non-existing providers."*
> *"To fix the error ensure that your service is registered in the list of providers of an `NgModule` or has the `@Service` decorator at top."*
> *"The most common solution is to add a provider in `@Service`"*

🔴 ``No provider for ${this}!`` is the **pre-v20 string**. The page has been partly modernised
(`@Service`, which is v22 surface) and partly not — which is a better illustration of doc drift
than any assertion, and is worth one sentence of commentary.

### 16.6 The rest of the DI error surface this chunk should enumerate

All from the `RuntimeErrorCode` enum (§0.7) plus the strings quoted above:

| Code | Constant | Message source | Where quoted |
|---|---|---|---|
| **NG0200** | `CYCLIC_DI_DEPENDENCY` | ``Circular dependency detected for `X`.`` | `errors_di.ts` — `cyclicDependencyError` |
| **NG0201** | `PROVIDER_NOT_FOUND` | ``No provider found for `X`.`` **or** `No provider for X found` | §16.1, §16.3 |
| **NG0205** | `INJECTOR_ALREADY_DESTROYED` | `Injector has already been destroyed.` | `errors.ts` class doc example |
| **NG0207** | `PROVIDER_IN_WRONG_CONTEXT` | two strings, chunk 03 | §16.4 |
| **NG0209** | `INVALID_MULTI_PROVIDER` | the two `APP_INITIALIZER` / `ENVIRONMENT_INITIALIZER` messages | §06.2, §06.3 |
| **NG0402** | `MISSING_REQUIRED_INJECTABLE_IN_BOOTSTRAP` | `A required Injectable was not found in the dependency injection tree. …` | §06.5 |
| **NG0405** | `ASYNC_INITIALIZERS_STILL_RUNNING` | `Cannot bootstrap as there are still asynchronous initializers running.` | §06.2 |
| **NG0408** | `PROVIDED_BOTH_ZONE_AND_ZONELESS` | warn | §05.4 |
| **NG0914** | `UNEXPECTED_ZONEJS_PRESENT_IN_ZONELESS_MODE` | warn | §05.3 |
| *(no code)* | mixed multi | `Cannot mix multi providers and regular providers` | §13.3 |
| *(no code)* | HTTP contradictions | two `Configuration error: …` strings | §09.2 |
| *(no code)* | parent HttpClient | `withRequestsMadeViaParent() can only be used when the parent injector also configures HttpClient` | §10.4 |

⚠️ NG0200's exact text: `cyclicDependencyError` builds ``Circular dependency detected for \`${token}\`.``
and `cyclicDependencyErrorWithDetails` runs it through `augmentRuntimeError(…, null)` — so it gets
the `Path:` treatment too. Negative code ⇒ `Find more at https://angular.dev/errors/NG0200`.

### 16.7 The three causes behind one NG0201 symptom

The dispatch asked for this framing. All three are supportable from what is quoted above:

1. **The provider genuinely is not there** — no `@Service()`/`@Injectable({providedIn:'root'})`,
   not in any reachable `providers`.
2. **It is there, but not in an injector this consumer can reach** — provided on a route while the
   consumer is a root singleton; provided on a component while the consumer is a sibling. The
   `Source:` clause tells you *which* injector gave up.
3. **It is a different token than you think** — two `new InjectionToken` instances with the same
   description (§12.2(d), quoted), or a duplicated package copy of a class.

### 16.8 Gotchas to write

1. **"I searched for `NullInjectorError` and found nothing."** It no longer exists; §16.1.
   Fix: search for `NG0201` or for `ɵNotFound`.
2. **"My `try { } catch (e) { if (e.name === 'NullInjectorError') … }` stopped matching."**
   `error.name = 'ɵNotFound'`. Fix in code: check the name against `'ɵNotFound'`, or better, do
   not depend on it — the comment says it is *"the name used by the primitives"*, i.e. internal.
3. **"Production says `NG0201` and nothing else."** By design; §16.2. Fix: reproduce with a
   development build, or ship source maps and a dev build of the failing route.
4. **"No `Path:` in my error."** The path is only appended when it has more than one entry
   (`if (path && path.length > 1)`).
5. **"`Source: Environment Injector.`" — what is that?** The injector's `debugName`, set by
   `internalCreateApplication`; chunk 01 already quoted it.
6. **"The angular.dev page for NG0201 shows a different message than my console."** §16.5 — the
   page is stale. Say so.
7. **NG0207 after a cast** — chunk 03's gotcha; cross-link.
8. **`Cannot mix multi providers and regular providers`** — §13.3.
9. **Two `InjectionToken`s, same description** — §16.7 cause 3.
10. **NG0200 circular dependency** presenting *as* a missing provider, because both codes share the
    same path-assembly branch in `r3_injector.ts`.

### 16.9 Interview questions

- ★ *A colleague's v22 app throws a DI error. They google `NullInjectorError` and find the Angular
  docs. What is wrong with that?* → the whole of §16.1: the class is gone, the name is
  `ɵNotFound`, the code is `NG0201`, and the doc page is stale. Source over docs.
- ★ *Why does a production build's DI error carry no token name?* → `throw new RuntimeError(errorCode, null)`
  in the non-`ngDevMode` branch, plus `formatRuntimeError`'s `message ? ': ' + message : ''`.
  And the comment above it explains why it is a branch rather than an early return —
  *"ESBuild is conservative about removing dead code that follows `return;`"*.
- ★ *How is the `Path: A -> B -> C` assembled?* → each injector level catches, calls
  `prependTokenToDependencyPath` and rethrows; the top level (no `previousInjector`) calls
  `augmentRuntimeError`. Quote the comment.
- *One error code, two different message texts. Which is which?* → §16.3.

---

## Chunk 17 — `17-the-server-config-merge.md`

### 17.1 `mergeApplicationConfig` — the whole function

[`packages/core/src/application/application_config.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/application_config.ts), verbatim — **this is the entire file
apart from the interface chunk 01 already quoted**:

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

🔴 **Six things fall straight out of nine lines, and they are the chunk:**

1. **It is a CONCAT, not a merge.** `{providers: [...prev.providers, ...curr.providers]}`. Nothing
   is de-duplicated, replaced or reconciled.
2. **"Left to right" therefore means the *later* config wins** for any non-multi token, by §1 —
   `mergeApplicationConfig(appConfig, serverConfig)` puts the server's providers **after** the
   browser's, so the **server config overrides**.
3. **And *appends* for any multi token** — two `provideRouter` calls across the two configs
   concatenate route tables (§07.3); interceptors from both configs both register (§10.1).
4. **`Object.assign(prev, curr, …)` MUTATES `prev`.** The seed is a fresh `{providers: []}`, so the
   inputs are safe — but `Object.assign`'s target is the accumulator, and the third argument
   overwrites the `providers` key `curr` just wrote. Correct, but worth reading carefully; a
   naive `{...prev, ...curr}` would have dropped `prev.providers` entirely, which is precisely the
   bug the explicit third argument prevents.
5. **It copies every other own enumerable property of `curr`** — `ApplicationConfig` has only
   `providers`, so today that is a no-op; an object with extra keys would carry them through.
6. **It takes `...configs`** — any number, folded left.

### 17.2 The generated server files, verbatim from CLI 22.1.7

[`packages/schematics/angular/server/files/application-builder/standalone-src/app/app.config.server.ts.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/server/files/application-builder/standalone-src/app/app.config.server.ts.template)
— **no EJS in this one, it is literal**:

```ts
import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes))
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
```

[`…/standalone-src/main.server.ts.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/server/files/application-builder/standalone-src/main.server.ts.template)
(EJS placeholders for the component name):

```
import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { <%= appComponentName %> } from '<%= appComponentPath %>';
import { config } from './app/app.config.server';

const bootstrap = (context: BootstrapContext) =>
    bootstrapApplication(<%= appComponentName %>, config, context);

export default bootstrap;
```

[`…/standalone-src/app/app.routes.server.ts.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/server/files/application-builder/standalone-src/app/app.routes.server.ts.template):

```ts
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
```

🔴 **`export const config = mergeApplicationConfig(appConfig, serverConfig);` is the sentence the
whole chunk explains.** The browser config comes **first**; the server's providers are appended
after it and therefore win. That is why `provideClientHydration()` in `app.config.ts` is present on
the server too (hydration guide's IMPORTANT, §11.3) — the merge carries it across.

### 17.3 `BootstrapContext` — why the third argument exists

CHANGELOG v21.0.0, breaking changes / core, verbatim:

> *"The server-side bootstrapping process has been changed to eliminate the reliance on a global platform injector."*
> Before: `const bootstrap = () => bootstrapApplication(AppComponent, config);`
> After: `const bootstrap = (context: BootstrapContext) => bootstrapApplication(AppComponent, config, context);`
> *"A schematic is provided to automatically update `main.server.ts` files to pass the `BootstrapContext` to the `bootstrapApplication` call."*
> *"In addition, `getPlatform()` and `destroyPlatform()` will now return `null` and be a no-op respectively when running in a server environment."*

and the runtime guard, verbatim from
[`create_application.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/application/create_application.ts):

```ts
  if (typeof ngServerMode !== 'undefined' && ngServerMode && !platformRef) {
    throw new RuntimeError(
      RuntimeErrorCode.PLATFORM_NOT_FOUND,
      ngDevMode &&
        'Missing Platform: This may be due to using `bootstrapApplication` on the server without passing a `BootstrapContext`. ' +
          'Please make sure that `bootstrapApplication` is called with a `context` argument.',
    );
  }
```

🔴 **NG0401**, full text above. The concurrency reason is in `platform.ts`'s own comment (§06.4):
*"During SSR, using this setting and using an injector from the global can cause the injector to
be used for a different request due to concurrency."*

### 17.4 `@angular/ssr` 22.1.7's provider surface

From
[`goldens/public-api/angular/ssr/index.api.md`](https://github.com/angular/angular-cli/blob/v22.1.7/goldens/public-api/angular/ssr/index.api.md), verbatim:

```ts
// @public
export function provideServerRendering(...features: ServerRenderingFeature<ServerRenderingFeatureKind>[]): EnvironmentProviders;

// @public
export function provideServerRendering(options: ServerRenderingOptions, ...features: ServerRenderingFeature<ServerRenderingFeatureKind>[]): EnvironmentProviders;

// @public
export function withAppShell(component: Type<unknown> | (() => Promise<Type<unknown> | DefaultExport<Type<unknown>>>)): ServerRenderingFeature<ServerRenderingFeatureKind.AppShell>;

// @public
export function withRoutes(routes: ServerRoute[]): ServerRenderingFeature<ServerRenderingFeatureKind.ServerRoutes>;

// @public
export interface ServerRenderingOptions {
    maxResponseBodySize: number;
}

// @public
export enum RenderMode {
    Client = 1,
    Prerender = 2,
    Server = 0
}

// @public
export enum PrerenderFallback {
    Client = 1,
    None = 2,
    Server = 0
}

// @public
export type ServerRoute = ServerRouteClient | ServerRoutePrerender | ServerRoutePrerenderWithParams | ServerRouteServer;

// @public
export interface ServerRouteCommon {
    headers?: Record<string, string>;
    path: string;
    status?: number;
}

// @public
export const IS_DISCOVERING_ROUTES: InjectionToken<boolean>;
```

⚠️ **`provideServerRendering` has a two-overload signature in 22.1.7** — the second takes
`ServerRenderingOptions` (`{maxResponseBodySize: number}`) *before* the features. The generated
template uses the first. Present the same `provide*(...features)` shape the rest of the topic uses,
and note the options overload in one line. Details of `RenderMode`/`ServerRoute` are **Phase 12** —
name them and stop.

### 17.5 Gotchas to write

1. **"I set a provider in `app.config.ts` and the server ignores it."** It does not — but a
   provider for the *same non-multi token* in `serverConfig` wins, because the merge appends
   (§17.1 #2). Fix in code: put the browser-specific one in a browser-only config, or make the
   server config the one that does not set it.
2. **"I called `mergeApplicationConfig(serverConfig, appConfig)` and everything inverted."** Order
   is the whole semantics. Show both orders and what each yields.
3. **"My routes are duplicated on the server."** Both configs called `provideRouter` — the merge
   concatenates and `ROUTES` is multi, so `.flat()` yields both tables (§07.3).
4. **"My interceptor runs twice on the server."** Both configs called
   `provideHttpClient(withInterceptors([...]))` with *different function references*, so the `Set`
   dedup (§10.1) cannot collapse them.
5. **`NG0401 Missing Platform: This may be due to using `bootstrapApplication` on the server
   without passing a `BootstrapContext`. …`** — §17.3, exact text. Fix in code: the
   `(context: BootstrapContext) => bootstrapApplication(App, config, context)` shape.
6. **"Hydration works in the browser build but not in SSR."** The hydration guide's IMPORTANT
   (§11.3); the merge normally handles it, so suspect a hand-written server config that does not
   merge `appConfig`.
7. **"`getPlatform()` returns null on the server."** v21 breaking change, §17.3.
8. **"`provideBrowserGlobalErrorListeners()` does nothing on the server."** §06.5 — early return
   under `ngServerMode`; the server gets process-level handlers instead (§06.6).
9. **`withXhr()` in a merged server config** — §09.3, the deprecation and the redirect/DoS
   rationale, plus the `NOT_USING_FETCH_BACKEND_IN_SSR` warning.
10. **"`mergeApplicationConfig` mutated my object."** It does not mutate the *inputs* — the
    accumulator seed is a fresh `{providers: []}` — but the code is `Object.assign(prev, curr, …)`
    and it is worth reading before you copy the pattern into your own merge helper.

### 17.6 Interview questions

- ★ *`mergeApplicationConfig(appConfig, serverConfig)` — which config wins a conflict, and why?* →
  the server's, because the merge concatenates left-to-right and §1's last-non-multi-wins then
  applies. "Left to right" in the doc comment describes the **fold**, not the precedence.
- ★ *What happens to a multi-provider under the merge?* → both contribute; `ROUTES` concatenates
  route tables, interceptor lists concatenate. Nothing is de-duplicated except by reference
  identity inside `HttpInterceptorHandler`.
- ★ *Why did v21 add `BootstrapContext` as a third argument?* → to remove the global platform
  injector on the server; quote the concurrency comment. NG0401 is what you get without it.
- *Is `app.config.server.ts` an API?* → no, it is a schematic filename, exactly like
  `app.config.ts` (chunk 01). The contract is `ApplicationConfig` and the default export of
  `main.server.ts`.

---

## 99 · UNSETTLED — do not guess these

Each of these was attempted once. If a chunk needs one, either verify it or write
"the documentation does not state whether X".

1. ✅ **RESOLVED 2026-09-06 (session `4bb50618`) — read the file, do NOT re-fetch.**
   `packages/common/http/src/errors.ts` at `v22.1.5` was read in full.
   🔴 **The old note's range was WRONG.** The header comment reads *"Reserved error code range:
   **2800-2899**"*, not 2000–2999. And the code is settled:

   ```ts
   NOT_USING_FETCH_BACKEND_IN_SSR = 2801,
   ```

   It is **positive**, so by §0.7's rule it has **no guide page and no `Find more at …` suffix** —
   the message renders as **`NG2801`**. Name it.

   🔴 **The same read surfaced a whole family chunks 09 and 10 owe the reader** — the capabilities
   you silently lose by opting out of fetch with `withXhr()`, each its own error code:

   ```ts
   MISSING_JSONP_MODULE = -2800,          NOT_USING_FETCH_BACKEND_IN_SSR = 2801,
   HEADERS_ALTERED_BY_TRANSFER_CACHE = -2802,
   HTTP_ORIGIN_MAP_USED_IN_CLIENT = 2803, HTTP_ORIGIN_MAP_CONTAINS_PATH = 2804,
   CANNOT_SPECIFY_BOTH_FROM_STRING_AND_FROM_OBJECT = 2805,
   RESPONSE_IS_NOT_AN_ARRAY_BUFFER = 2806, RESPONSE_IS_NOT_A_BLOB = 2807,
   RESPONSE_IS_NOT_A_STRING = 2808,        UNHANDLED_OBSERVE_TYPE = 2809,
   JSONP_WRONG_METHOD = 2810,              JSONP_WRONG_RESPONSE_TYPE = 2811,   // all three
   JSONP_HEADERS_NOT_SUPPORTED = 2812,                                          // @deprecated 22.1
   KEEPALIVE_NOT_SUPPORTED_WITH_XHR = 2813, CACHE_NOT_SUPPORTED_WITH_XHR = 2814,
   PRIORITY_NOT_SUPPORTED_WITH_XHR = 2815,  MODE_NOT_SUPPORTED_WITH_XHR = 2816,
   REDIRECT_NOT_SUPPORTED_WITH_XHR = 2817,  CREDENTIALS_NOT_SUPPORTED_WITH_XHR = 2818,
   WITH_CREDENTIALS_OVERRIDES_EXPLICIT_CREDENTIALS = 2819,
   INTEGRITY_NOT_SUPPORTED_WITH_XHR = 2820, REFERRER_NOT_SUPPORTED_WITH_XHR = 2821,
   INVALID_TIMEOUT_VALUE = 2822,            REFERRER_POLICY_NOT_SUPPORTED_WITH_XHR = 2823,
   FETCH_UPLOAD_PROGRESS_NOT_SUPPORTED = 2824, FETCH_RESPONSE_BODY_TOO_LARGE = -2825,
   JSONP_UNSAFE_URL = 2826,                                                     // @deprecated 22.1
   ```

   🔴 **Eleven `*_NOT_SUPPORTED_WITH_XHR` codes is the argument chunk 09 is actually making.**
   `withXhr()` is not a neutral swap: `keepalive`, `cache`, `priority`, `mode`, `redirect`,
   `credentials`, `integrity`, `referrer` and `referrerPolicy` all stop working, each with its own
   diagnostic. That is why `FetchBackend` became the default and `withFetch()` the deprecation.
   The four `JSONP_*` codes carry a verbatim `@deprecated 22.1` JSDoc — *"JSONP is deprecated as it
   can cause XSS vulnerabilities. Use standard HTTP requests instead. Intent to remove in future
   versions of Angular."* — which is the reason §10.5 wants for `withJsonpSupport`.
2. ✅ **RESOLVED 2026-09-06 (session `4bb50618`) — do NOT re-fetch.**
   `packages/platform-browser/src/errors.ts` at `v22.1.5`: *"Reserved error code range: 5000-5500."*
   and `HYDRATION_CONFLICTING_FEATURES = 5001`. **Positive, so no guide page and no `Find more at …`
   suffix — it renders as `NG5001`.** Chunk 11 may name it.
3. ⚠️ **PARTLY RESOLVED 2026-09-06 (session `4bb50618`).** The **code** is confirmed in `core`'s
   enum at `v22.1.5` — `MISCONFIGURED_INCREMENTAL_HYDRATION = 508`, positive, so **`NG0508` with no
   guide-page link**. Its **throw site and message text are still unread**: chunk 11 may name the
   code and must NOT invent the message.
   🔴 Note also that `core`'s header comment reads *"Reserved error code range: **100-999**"* — the
   figure to use if any chunk needs to explain why `core` codes are three digits.
4. **Whether `@Injectable({providedIn: 'any'})` is deprecated.** The `InjectionToken` doc comment
   says *"The `providedIn: NgModule` and `providedIn: 'any'` options are deprecated"* — but that
   comment is about `InjectionToken`. The `Injectable` golden entry
   (`providedIn?: Type<any> | 'root' | 'platform' | 'any' | null;`) carries no deprecation marker.
   Write it as "deprecated for `InjectionToken`; the `Injectable` typing does not mark it".
5. **`provideCssVarNamespacing`.** Present in the platform-browser golden as
   `provideCssVarNamespacing(namespace?: string): EnvironmentProviders` (`// @public`). I did not
   read its implementation or JSDoc, and did not find a guide page. Mention it as "new v22 surface"
   or leave it out.
6. **Whether `provideAppInitializer()` in a route's `providers` ever runs.** Mechanically it
   cannot (§15.3) — `ApplicationInitStatus` is constructed and run at bootstrap, before route
   injectors exist. I found no documentation sentence stating it. Present as an inference from the
   mechanism, or verify.
7. **Whether the two `NG0201` message shapes (§16.1 vs §16.3) map cleanly onto
   "environment injector" vs "element injector".** The `NullInjector` one is unambiguously the end
   of the environment walk. `throwProviderNotFoundError`'s call sites are in `render3` and I did
   not read them. Attribute by function name only.
8. **`provideNgReflectAttributes` deprecation status.** The `ng-reflect-*` **attributes** are
   described as deprecated in the JSDoc; the **function** carries no `@deprecated` tag and the
   golden marks it plain `// @public`. Be precise; do not merge the two.
9. **Exact `RouterModule.forChild` status in v22.** Chunk 02 asserts `forChild` "has no successor";
   I did not re-verify that `forChild` still exists in the v22 router source. If chunk 07 or 15
   needs to say anything about it, read `packages/router/src/router_module.ts` first.
10. **Why `ZONELESS_ENABLED` is both defaulted and explicitly provided** (§05.7's second interview
    question). My explanation is a reading, not a quote.
11. ✅ **RESOLVED 2026-09-06 — no longer unsettled.** *Whether `withComponentInputBinding`'s
    `unmatchedInputBehavior: 'undefinedIfStale'` changes the "set to `undefined`" rule quoted in
    §08.4.* It does. `ComponentInputBindingOptions`' own JSDoc was read at `v22.1.5`: the older
    paragraph describes the **default**, `'alwaysUndefined'`, and `'undefinedIfStale'` narrows it.
    Both settings are now stated accurately on
    `03-the-provider-array/08c-with-component-input-binding.md`. **Do not re-derive.**

---

## 100 · Found, not fixed — defects outside this topic

Reported per the standing rule; **I changed nothing.**

1. ✅ **STALE as of 2026-09-06 — fixed, do not act on this.** All eight were demoted to bold text
   in commit `70928c81`; `yarn linkcheck docs/angular` now reports **0 problems across 92 files**.
   Left below as the historical record of why the deploy was red for two hours.

   ~~🔴 **Dangling forward links already on disk in topic 03.** Chunks 01–04 link to eight files
   that do not exist yet (§0.3 lists them). Until 05–17 land, `docs/angular/pages/phase-0-how-angular-runs/03-the-provider-array/`
   contains **live broken relative links**, which is the exact failure mode the authoring contract
   forbids ("Anything you intend to write later is bold text plus *(not written yet)*"). The topic
   `README.md` handles this correctly; the chunks do not. Whoever writes 05–17 will incidentally
   fix it — but if this run stalls partway, the build stays broken.~~
2. ✅ **STALE as of 2026-09-06 — verified fixed, do not act on this.** All four were split into
   lettered siblings by the lane that owned them; **nothing in `docs/angular` is over 300 lines**
   (`04` → `04`/`04b`/`04c`/`04d`, `05` → `05`/`05b`/`05c`/`05d`, `06` → `06`–`06g`,
   `07` → `07`/`07b`/`07c`). An agent re-reported this as a live defect on 2026-09-06 and it was
   not one — **re-measure before acting on any cap claim in this section.**

   ~~🔴 **Topic 02 has four files over the 300-line cap** (reported by the repo's own pre/post-tool
   hook while I was writing):~~
   `02-standalone-by-default/04-what-imports-actually-means.md` (677),
   `06-not-a-known-element.md` (709),
   `05-unused-imports-and-the-compiler-diagnostics.md` (381→668, it moved during my session),
   `07-what-replaced-each-ngmodule-responsibility.md` (322→444, likewise).
   Another lane is actively writing there; these need **splitting on a concept boundary into
   lettered siblings**, not trimming. Not mine to touch.
3. ⚠️ **angular.dev is stale in three places relevant to this corpus** — all three are worth a
   sentence on the page that hits them, per the house rule that the source wins:
   - `guide/di/debugging-and-troubleshooting-di` teaches `NullInjectorError` (§16.1).
   - `reference/errors/NG0201` teaches ``No provider for ${this}!`` (§16.5).
   - `guide/animations/overview` carries a deprecation banner **and then** instructs the reader to
     add `provideAnimationsAsync()` (§11.4). `guide/hydration` similarly presents
     `withEventReplay()` as required (§11.3).
   The stale `NullInjectorError` string also survives **inside the source**, in
   `packages/core/src/di/injection_token.ts`'s doc comment (§12.2(d)).
