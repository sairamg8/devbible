---
title: "The merge is one-directional — everything in app.config.ts runs on the server, nothing in app.config.server.ts runs in the browser, and there is no generated third file for the case you will actually need"
sidebar_label: "17e · What belongs in which config"
sidebar_position: 17.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-09 against **Angular 22.1.5** — angular.dev
> [Hydration](https://angular.dev/guide/hydration),
> [Unhandled errors in Angular](https://angular.dev/best-practices/error-handling) — and
> `angular/angular-cli` at tag `v22.1.7`
> ([`app.config.server.ts.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/server/files/application-builder/standalone-src/app/app.config.server.ts.template)).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`main.ts` bootstraps with `appConfig`; `main.server.ts` bootstraps with
`mergeApplicationConfig(appConfig, serverConfig)`. That single asymmetry decides every placement
question in an SSR application: `app.config.ts` means "both environments", `app.config.server.ts`
means "server only", and there is no generated file that means "browser only" — you have to write it
and repoint `main.ts` yourself.**

The mistake this page exists to prevent is assuming the shared config is the browser config. It is
not. Everything in it is registered during every server render too, and the framework will not tell
you which of those providers had no business being there.

## Three buckets, and the one the CLI does not give you

| Bucket | File | Reached by |
|---|---|---|
| both environments | `app.config.ts` | `main.ts` directly, and `main.server.ts` through the merge |
| server only | `app.config.server.ts` | `main.server.ts` only |
| browser only | **nothing generated** | you create it, and repoint `main.ts` |

The third bucket is a two-line change and it is worth making the moment you have your first
browser-only provider:

```ts
// src/app/app.config.browser.ts — new file
import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { appConfig } from './app.config';

const browserOnly: ApplicationConfig = {
  providers: [provideCheckNoChangesConfig({ exhaustive: true, interval: 1000 })],
};

export const browserConfig = mergeApplicationConfig(appConfig, browserOnly);
```

```ts
// src/main.ts — one import changed
import { bootstrapApplication } from '@angular/platform-browser';
import { browserConfig } from './app/app.config.browser';
import { App } from './app/app';

bootstrapApplication(App, browserConfig)
  .catch((err) => console.error(err));
```

Both branches now start from `appConfig` and neither can affect the other, because each merge
produces a fresh object and a fresh array ([17b](17b-what-the-merge-does-not-do.md) has the identity
rules). ⚠️ The cost is one more file to keep in your head at review time — which is why the CLI does
not generate it speculatively, and why it is worth adding only when you have a concrete reason.

## Hydration belongs in the shared config, and the docs say so

The hydration guide states it as an IMPORTANT, verbatim:

> *"IMPORTANT: Make sure that the `provideClientHydration()` call is also included into a set of providers that is used to bootstrap an application on the **server**."*

🔴 **In a CLI-generated application that requirement is already satisfied and you must not "fix" it.**
`provideClientHydration()` goes in `app.config.ts`, the merge puts it in the server config as well,
and both halves of hydration are configured from one call. The sentence exists for hand-assembled
server configurations — the ones that build an `ApplicationConfig` from scratch instead of merging
`appConfig` — which is exactly where it goes wrong.

The transfer cache makes the reason concrete, because it is a feature that **spans both
environments** from a single provider: the server populates it during rendering, and the hydrating
browser reads it instead of re-issuing the requests. Configure it in one place and both sides agree;
configure it twice, or in the wrong place, and they do not.
[11d](11d-the-http-transfer-cache.md) covers the cache's lifetime and its options, and
[11](11-hydration-animations-and-the-rest.md) covers the feature list.

```ts
// ✅ app.config.ts — shared, so both environments see the same hydration configuration
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withHttpTransferCacheOptions({ includeHeaders: ['x-request-id'] })),
  ],
};

// ⛔ app.config.server.ts — a second, different hydration configuration. Now the two disagree.
const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    provideClientHydration(),
  ],
};
```

The second call wins for every non-multi token it writes, so the server renders with the default
transfer-cache configuration while the browser was built expecting the configured one. Nothing warns.

## Debug and diagnostic providers do not belong in the shared config

This is [05g](05g-the-check-no-changes-interval.md)'s warning stated as a placement rule.
`provideCheckNoChangesConfig({exhaustive: true, interval: N})` registers an initializer that arms a
repeating timer; put it in `app.config.ts` and that initializer runs during **every server render**,
not just in the browser where you wanted it. The loop's only exit is the application being destroyed.

```ts
// ⛔ app.config.ts — armed on the server too, once per render
providers: [provideRouter(routes), provideCheckNoChangesConfig({ exhaustive: true, interval: 1000 })],

// ✅ app.config.ts stays clean; the debug provider moves to the browser-only config above
providers: [provideRouter(routes)],
```

Two qualifications, both worth stating precisely rather than hand-waving:

- `provideCheckNoChangesConfig` is **developer preview and dev-mode only** — in a production build it
  contributes an empty provider set ([05f](05f-check-no-changes-in-production-and-developer-preview.md)).
  So this is a development-server concern, not a production one.
- [05g](05g-the-check-no-changes-interval.md) explicitly did **not** verify how a given server build
  defines `ngDevMode`, or exactly when the rendered application is destroyed. Neither did this page.
  The placement rule stands regardless, because it removes the question instead of answering it.

The same reasoning covers anything else whose purpose is to observe a running browser application:
`provideStabilityDebugging()`, `provideNgReflectAttributes()`, a console-logging `ErrorHandler`, a
devtools bridge. [12h](12h-experimental-preview-and-dev-only.md) has the inventory of dev-only
surface.

## Some shared providers are inert on the server, and that is fine

Not everything browser-flavoured needs moving. `provideBrowserGlobalErrorListeners()` is in the
generated `app.config.ts` and stays there: its factory early-returns under `ngServerMode`, so it adds
nothing to a server render — [06f](06f-provide-browser-global-error-listeners.md) reads the source.
The server is covered by process-level handlers instead, which angular.dev describes verbatim:

> *"When using [Angular with SSR], Angular automatically adds the `'unhandledRejection'` and `'uncaughtException'` listeners to the server process. These handlers prevent the server from crashing and instead log captured errors to the console."*

> *"IMPORTANT: If the application is using Zone.js, only the `'unhandledRejection'` handler is added. When Zone.js is present, errors inside the Application's Zone are already forwarded to the application `ErrorHandler` and do not reach the server process."*

🔴 **"Inert on the server" and "must not be on the server" are different categories and the fix
differs.** A provider that guards itself with `ngServerMode` belongs in the shared config, because
moving it buys nothing and costs a file. A provider that does real work on the server when you meant
it for the browser needs the browser-only config. The only way to tell them apart is to read the
provider — there is no naming convention that distinguishes them.

## The placement checklist

| Question | Answer | File |
|---|---|---|
| Does the browser need it? | yes, and the server render also needs it | `app.config.ts` |
| Does the browser need it, and is it inert on the server? | yes, guards itself with `ngServerMode` | `app.config.ts` |
| Does it configure hydration? | yes — both halves come from one call | `app.config.ts` |
| Does it do real work you only want in the browser? | yes | browser-only config, and repoint `main.ts` |
| Does it import `@angular/ssr`? | yes | `app.config.server.ts` |
| Is it a server-only override of a shared token? | yes | `app.config.server.ts` |
| Is it a diagnostic that observes a running application? | yes | browser-only config |

## Gotchas

**★ Symptom: a provider added to `app.config.server.ts` has no effect in the browser.** Cause: the
merge is one-directional. `main.ts` bootstraps with `appConfig` and never reads the merged `config`.
Fix: move it to `app.config.ts` if both environments need it — there is no mechanism that pushes a
server provider into the browser build.

**★ Symptom: hydration works in the browser build and not under SSR.** Cause: almost always a
hand-written server configuration that does not merge `appConfig`, so `provideClientHydration()` is
present on one side only — the case the guide's IMPORTANT is written for. Fix: build the server
config with `mergeApplicationConfig(appConfig, serverConfig)` rather than from scratch, and keep the
hydration call in the shared file:

```ts
// ⛔ a server config assembled independently — hydration never reaches the server render
export const config: ApplicationConfig = {
  providers: [provideServerRendering(withRoutes(serverRoutes))],
};

// ✅
export const config = mergeApplicationConfig(appConfig, {
  providers: [provideServerRendering(withRoutes(serverRoutes))],
});
```

**★ Symptom: `provideClientHydration()` appears in both configs and the transfer cache behaves like
the default despite being configured.** Cause: two calls, two sets of providers, and the server's
non-multi tokens are later in the concatenated array, so the server's plain
`provideClientHydration()` overrides the browser file's configured one. Fix: one hydration call, in
`app.config.ts`; if the server genuinely needs different behaviour, override the specific token
rather than re-calling the whole feature function.

**★ Symptom: a `setInterval`-based diagnostic keeps a server render busy.** Cause: a debug provider in
the shared array. `provideCheckNoChangesConfig({exhaustive: true, interval: N})` arms its timer from
an initializer, and the initializer runs wherever the config is bootstrapped. Fix: the browser-only
config shown above. The general rule is that a provider whose job is to watch a running application
belongs where that application is running.

**★ Symptom: you moved `provideBrowserGlobalErrorListeners()` out of the shared config "because it
says browser", and lost error reporting in the browser without gaining anything on the server.**
Cause: it already no-ops on the server — the factory early-returns under `ngServerMode` — so the move
had no upside, and the server's error handling was never coming from it in the first place. Fix: put
it back in `app.config.ts`, which is where the schematic generates it.

**★ Symptom: a token has different values on the server and in the browser and nobody can find where
the server value comes from.** Cause: a `{provide: X, useValue: …}` in `app.config.server.ts`
overriding the shared one by position, which is the intended mechanism and is invisible from the
browser file. Fix: nothing mechanical — but make the override obvious. A comment naming the token it
replaces costs one line and saves the next reader the merged-array reconstruction.

**Symptom: `app.config.browser.ts` exists and its providers are missing at runtime.** Cause: creating
the file does nothing on its own; `main.ts` still imports `appConfig`. Fix: repoint `main.ts` at the
new export — the browser bucket only exists once the entry point uses it.

## Interview questions

**★ Where does a provider go in an SSR application, and what is the default answer?**
The default is `app.config.ts`, because that file is bootstrapped by both entry points, and the whole
arrangement is designed so most providers can be stated once. `app.config.server.ts` is for two
things: providers that import `@angular/ssr`, and deliberate server-side overrides of a shared token.
A browser-only bucket does not exist until you create the file and repoint `main.ts`, which is worth
doing as soon as you have a provider that does real work you do not want during a server render.

**★ Why does `provideClientHydration()` go in the shared config rather than in the server config,
given that hydration is a server-rendering feature?**
Because it configures both sides of a two-sided mechanism. The guide is explicit — *"Make sure that
the `provideClientHydration()` call is also included into a set of providers that is used to bootstrap
an application on the server"* — and the shared config satisfies that automatically through the merge.
The transfer cache makes the reason visible: the server populates the cache during rendering and the
hydrating browser reads it, so the two environments must be configured identically. Two separate calls
in two files is the failure mode, because the server's call is later and silently overrides.

**★ Something in `app.config.ts` is doing work during server renders that you did not intend. What is
the fix, and what is the fix people reach for that does not work?**
The fix is a browser-only config file plus a one-line change in `main.ts`, so the provider is never
in the array the server bootstraps. The fix people reach for is moving it to `app.config.server.ts` —
which does the exact opposite, since that file is server-only — or adding a runtime `isPlatformBrowser`
check inside the provider, which leaves the provider registered and only guards its body. Guarding
the body is what the framework's own providers do (`provideBrowserGlobalErrorListeners` early-returns
on `ngServerMode`) and it is a reasonable choice for code you own; it is not available for a
third-party or framework provider, and the config split is.

**★ How do you tell whether a browser-flavoured provider is safe to leave in the shared config?**
Read it. If it guards its work with `ngServerMode` — or with any equivalent environment check — it
costs a provider record on the server and nothing else, and moving it buys you nothing. If it does
real work unconditionally, it will do that work on every server render. There is no naming convention
that separates the two categories, which is why "it has 'browser' in the name" is not an answer:
`provideBrowserGlobalErrorListeners()` is the safest thing in the generated config.

**Why is there no generated `app.config.browser.ts`?**
Because most applications do not need one, and the merge already gives the server the ability to
override anything shared. Generating a third file speculatively would put a merge in `main.ts`'s
import path for every project, including the majority that never adds a browser-only provider. The
cost of that decision is that the browser bucket is the one people forget exists, and its absence is
routinely misread as "the shared config is the browser config".

← Prev: [BootstrapContext and NG0401](17d-bootstrapcontext-and-the-server-platform.md) · Index: [Topic index](README.md) · Next → [The HTTP backend across two configs](17f-the-http-backend-across-two-configs.md)
