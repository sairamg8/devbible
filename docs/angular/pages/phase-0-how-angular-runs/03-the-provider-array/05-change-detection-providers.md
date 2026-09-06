---
title: "Zoneless is the default in Angular 22 — `ng new` emits no change-detection provider at all, and the `ZONELESS_ENABLED` token's own factory returns `true`"
sidebar_label: "05 · Zoneless is the default"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against **Angular 22.1.5** — angular.dev
> [Angular without ZoneJS (Zoneless)](https://angular.dev/guide/zoneless),
> [`provideZoneChangeDetection`](https://angular.dev/api/core/provideZoneChangeDetection),
> [`provideZonelessChangeDetection`](https://angular.dev/api/core/provideZonelessChangeDetection) — and
> `angular/angular` at tag `v22.1.5`:
> [`change_detection/scheduling/zoneless_scheduling.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/zoneless_scheduling.ts),
> [`zoneless_scheduling_impl.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/change_detection/scheduling/zoneless_scheduling_impl.ts),
> [`CHANGELOG.md`](https://github.com/angular/angular/blob/v22.1.5/CHANGELOG.md); and
> `angular/angular-cli` at tag `v22.1.7`:
> [`schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Every tutorial written before v21 tells you to add `provideZonelessChangeDetection()` to opt in to
zoneless change detection. In Angular 22 that call is redundant: zoneless is what you get when you
provide nothing at all. The framework prepends the zoneless providers before your array, the
`ZONELESS_ENABLED` token's own default factory returns `true`, and `ng new` emits no
change-detection provider whatsoever. The provider you write in v22 is `provideZoneChangeDetection()`,
and it is an opt-*out* — it exists to put Zone.js back for an application that still needs it.**
Which means the interesting question is no longer "how do I turn zoneless on"; it is "what exactly
does the opt-out overwrite, and what breaks when only half of it is done". This chunk establishes
the default and proves it three ways — from the CLI schematic, from the changelog, and from the
token's own factory. The opt-out function is
[05b](05b-provide-zone-change-detection-the-opt-out.md), the redundant opt-in and the NG0408
conflict warning are [05c](05c-the-redundant-opt-in-and-ng0408.md), and the `angular.json` half of
the migration — plus what `NgZone` becomes when Zone.js is gone — is
[05d](05d-the-polyfill-half-and-noopngzone.md). The change-detection *machine* itself — dirty
marking, `OnPush`, the refresh traversal, the scheduler's microtask race — is **Phase 5**
*(not written yet)*.

## The generated app is the proof: there is no change-detection provider in it

The CLI's `app.config.ts` schematic is an EJS template, and the conditional is the whole story.
Verbatim from `packages/schematics/angular/application/files/standalone-files/src/app/app.config.ts.template`
at `@angular/cli` `v22.1.7`:

```text
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

That is the schematic *source*, not the file a user gets —
[chunk 01](01-app-config-and-what-bootstrap-does-with-it.md) prints the resolved output. And the
flag it branches on defaults to on, from `application/schema.json` in the same tag:

```json
"zoneless": {
  "description": "Generate an application that does not use `zone.js`.",
  "type": "boolean",
  "default": true
}
```

🔴 **So `ng new` in v22 emits no change-detection provider at all.**
`provideZoneChangeDetection({ eventCoalescing: true })` appears only under `--no-zoneless`. The
zoneless guide says the same thing in one sentence:

> *"Zoneless is the default in Angular v21+ so you do not need to do anything to enable it."*

> *"You should verify that `provideZoneChangeDetection` is not used anywhere to override the default configuration."*

The breaking change that made it true is in the **v21.0.0 / core** block of `CHANGELOG.md`:

> *"Angular no longer provides a change detection scheduler for ZoneJS-based change detection by default. Add `provideZoneChangeDetection` to the providers of your `bootstrapApplication` function or your `AppModule` (if using `bootstrapModule`). This provider addition will be covered by an automated migration."*

Two more lines from the same block, each of which is a real-world failure in disguise:

> *"Using a combination of `provideZoneChangeDetection` while also removing ZoneJS polyfills will no longer result in the internal scheduler being disabled. All Angular applications now consistently use the same scheduler, and those with the Zone change detection provider include additional automatic scheduling behaviors based on NgZone stabilization."*

> *"`ignoreChangesOutsideZone` is no longer available as an option for configuring ZoneJS change detection behavior."*

## The token proves it harder than the changelog does

From `change_detection/scheduling/zoneless_scheduling.ts`:

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

🔴 **`ZONELESS_ENABLED`'s default factory is `() => true`.** Zoneless is not merely what the
framework happens to prepend — it is what an injector answers when *nobody* provided the token.
`PROVIDED_ZONELESS` defaults to `false` and exists for exactly one purpose: detecting that you
called `provideZonelessChangeDetection()` explicitly, which is what arms NG0408 in
[05c](05c-the-redundant-opt-in-and-ng0408.md).

What the framework prepends, from `zoneless_scheduling_impl.ts`:

```ts
export function provideZonelessChangeDetectionInternal(): Provider[] {
  return [
    {provide: ChangeDetectionScheduler, useExisting: ChangeDetectionSchedulerImpl},
    {provide: NgZone, useClass: NoopNgZone},
    {provide: ZONELESS_ENABLED, useValue: true},
  ];
}
```

[Chunk 01](01-app-config-and-what-bootstrap-does-with-it.md) already quoted the call site: in
`internalCreateApplication`, `allAppProviders` is
`[provideZonelessChangeDetectionInternal(), errorHandlerEnvironmentInitializer, …, ...(appProviders || [])]`.
**Your array is spread in last**, which is the entire override mechanism — see
**chunk 13 · Order dependence** *(not written yet)*.

Read together, the three pieces of evidence say the same thing at three different layers: the CLI
does not write the provider, the changelog says the framework stopped supplying the zone scheduler,
and the token answers `true` with no provider in the graph at all. **A v22 application that never
mentions change detection anywhere is zoneless, and there is no configuration to check.**

## Gotchas

**★ Symptom: a tutorial, a Stack Overflow answer or an LLM tells you to add
`provideZonelessChangeDetection()` to go zoneless, and you cannot see what it changed.** Cause: the
advice predates v21.0.0, when the call really was the opt-in. In v22 it re-registers records the
framework already prepended. Fix: write nothing — an empty change-detection surface *is* zoneless:

```ts
// src/app/app.config.ts — a v22 zoneless application, in full
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideRouter(routes)]
};
```

**★ Symptom: you ran `ng new storefront --no-zoneless` expecting a zoneless application and got
`provideZoneChangeDetection({ eventCoalescing: true })` plus a `zone.js` polyfill.** Cause: the flag
reads backwards from the way most people scan it. `zoneless` defaults to `true` in
`application/schema.json`, so `--no-zoneless` sets it to `false` and turns the *zone* mode on. Fix:
plain `ng new` is the zoneless one; there is no `--zoneless` to add.

```bash
ng new storefront          # zoneless — no change-detection provider, no polyfill
ng new storefront --no-zoneless   # Zone.js — provider AND polyfill
```

**★ Symptom: you copy an `app.config.ts` out of a v20 project into a v22 one and change detection
behaves differently from either project.** Cause: the file is not self-describing. Under v20 the
framework supplied a ZoneJS scheduler by default and the file's silence meant "zone"; under v22 the
same silence means "zoneless". The provider array did not change — the framework underneath it did.
Fix: decide explicitly on arrival, and if the app relied on zone patching keep the pair together:

```ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true })]
};
```

**Symptom: `Object literal may only specify known properties, and 'ignoreChangesOutsideZone' does
not exist in type 'NgZoneOptions'`.** Cause: the option was removed in v21.0.0 — the changelog line
is *"`ignoreChangesOutsideZone` is no longer available as an option for configuring ZoneJS change
detection behavior."* `NgZoneOptions` now has exactly two fields, `eventCoalescing` and
`runCoalescing`. Fix: delete it; there is no replacement, because the scheduler is no longer disabled
when it is absent.

**Symptom: a migration guide or internal wiki says "drop the `zone.js` polyfill and Angular disables
its internal scheduler, so the app runs on nothing".** Cause: that was true before v21.0.0. The
changelog reversed it explicitly — *"Using a combination of `provideZoneChangeDetection` while also
removing ZoneJS polyfills will no longer result in the internal scheduler being disabled. All Angular
applications now consistently use the same scheduler."* Fix: stop treating the polyfill as a kill
switch. In v22 removing it while keeping the provider is a hard failure, not a quiet degradation —
[05d](05d-the-polyfill-half-and-noopngzone.md) is that error.

**Symptom: an audit asks "is this application zoneless?" and nobody can answer from the source.**
Cause: the default is invisible — there is nothing in `app.config.ts` to read. Fix: the question is
answered by two greps, not one. The application is zoneless if `provideZoneChangeDetection` appears
nowhere; it is *shipping* zoneless if `angular.json` also has no `polyfills` entry for `zone.js`.
Those are two independent facts and they routinely disagree.

## Interview questions

**★ What is the difference between "zoneless is stable" and "zoneless is the default"?**
Two different releases. `provideZonelessChangeDetection` graduated from experimental to stable as an
API — you could ship it with confidence. Separately, v21.0.0 stopped providing a ZoneJS change
detection scheduler at all, which made zoneless the behaviour you get with an empty provider array.
A v22 app that never mentions change detection anywhere is zoneless, and the `ZONELESS_ENABLED`
token's `{factory: () => true}` is the proof.

**★ If zoneless is the default, why does the framework still explicitly provide
`{provide: ZONELESS_ENABLED, useValue: true}` when the token already defaults to `true`?**
The documentation does not state a reason, and the source carries no comment explaining it, so treat
any answer as a reading rather than a fact. The mechanically defensible half is that an explicit
record is a *record* — it exists in the application injector, so a child environment injector
resolves it by walking to a real provider rather than falling back to the token's tree-shakable
default, and tooling that enumerates records can see it. Saying "I do not know, and here is what the
source does guarantee" is the correct answer to this one.

**★ Without running anything, how do you prove that a v22 application with an empty provider array is
zoneless?**
Read the token, not the app. `ZONELESS_ENABLED` is constructed with `{factory: () => true}`, so an
injector with no provider for it still answers `true` — the default is a property of the token, not
of the bootstrap path. That is stronger evidence than the framework's prepended
`{provide: ZONELESS_ENABLED, useValue: true}`, which could in principle be reordered; a tree-shakable
token default cannot be overridden by anything except an actual provider, and an empty array has
none.

**What exactly did v21.0.0 break, and what does the automated migration do about it?**
It stopped providing a change detection scheduler for ZoneJS-based change detection by default —
*"Add `provideZoneChangeDetection` to the providers of your `bootstrapApplication` function or your
`AppModule` (if using `bootstrapModule`)"*. The changelog states that *"This provider addition will
be covered by an automated migration"*, so an app moving through v21 with `ng update` gets the
provider inserted for it. An app that jumps a major, or that hand-edits its dependencies, does not —
which is why a v18-to-v22 leap is the version of this migration that actually goes wrong.

**Why does `PROVIDED_ZONELESS` exist at all when `ZONELESS_ENABLED` already records the mode?**
Because they answer different questions. `ZONELESS_ENABLED` is *which mode is the application in*,
and it is meaningful with no provider at all. `PROVIDED_ZONELESS` is *did a human write
`provideZonelessChangeDetection()`*, and it defaults to `false` precisely so that the framework's own
internal call does not set it. Only the second one can distinguish a deliberate opt-in from the
default, which is what the NG0408 conflict check needs.

**Is `ng new --no-zoneless` the same as `ng new` followed by adding `provideZoneChangeDetection()`?**
No, on two counts. The schematic writes `provideZoneChangeDetection({ eventCoalescing: true })`,
which is not the API default — `getNgZoneOptions` defaults `shouldCoalesceEventChangeDetection` to
`false`. And `--no-zoneless` additionally adds `zone.js` to `dependencies` and `polyfills` to the
build target. Adding the provider by hand gets you neither, which is one of the two half-migrations
[05d](05d-the-polyfill-half-and-noopngzone.md) is about.

---

← Prev: [Writing your own `provide*`](04-writing-your-own-provide-function.md) · Index: [Topic index](README.md) · Next → [`provideZoneChangeDetection()`, the opt-out](05b-provide-zone-change-detection-the-opt-out.md)
