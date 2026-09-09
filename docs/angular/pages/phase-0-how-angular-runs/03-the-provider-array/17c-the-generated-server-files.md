---
title: "ng add @angular/ssr writes three files and only one line of them is wiring — the rest is a route table, an entry point and a set of filenames that are convention rather than API"
sidebar_label: "17c · The generated server files"
sidebar_position: 17.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular 22.1.5** and **`@angular/ssr` 22.1.7** — `angular/angular-cli`
> at tag `v22.1.7`:
> [`packages/schematics/angular/server/files/application-builder/standalone-src`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/server/files/application-builder/standalone-src/app/app.config.server.ts.template),
> [`goldens/public-api/angular/ssr/index.api.md`](https://github.com/angular/angular-cli/blob/v22.1.7/goldens/public-api/angular/ssr/index.api.md).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`ng add @angular/ssr` adds three source files next to the ones `ng new` already produced, and
exactly one line in them decides how the application is configured on the server:
`export const config = mergeApplicationConfig(appConfig, serverConfig);`. Read that line and you know
two things at once — that the browser config runs on the server too, and that the server config
overrides it.**

Everything else in the three files is a route table, an entry point, and a set of names that look
like API and are not.

## The three generated files, verbatim

From the CLI's own templates at `@angular/cli` **22.1.7**. `app.config.server.ts.template` contains
no EJS at all — this is literally the file you get:

```ts
// src/app/app.config.server.ts
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

```ts
// src/app/app.routes.server.ts
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
```

`main.server.ts` still carries EJS placeholders for the root component's name and path; with those
resolved for a default application it reads:

```ts
// src/main.server.ts
import { BootstrapContext, bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { config } from './app/app.config.server';

const bootstrap = (context: BootstrapContext) =>
    bootstrapApplication(App, config, context);

export default bootstrap;
```

Note what is **not** here: no browser-side counterpart is generated, and `main.ts` is untouched. It
still bootstraps with `appConfig`, not with anything merged. That asymmetry is deliberate and it is
the subject of [17e](17e-what-belongs-in-which-config.md). The third parameter to
`bootstrapApplication` is [17d](17d-bootstrapcontext-and-the-server-platform.md).

## Reading the one line that matters

```ts
export const config = mergeApplicationConfig(appConfig, serverConfig);
```

- `appConfig` is **first**, so its providers are earlier in the concatenated array.
- `serverConfig` is **second**, so its providers are later and win every non-multi collision — which
  is the direction you want, because "the server needs a different implementation of X" is the entire
  reason the second file exists.
- Every multi token receives both configs' contributions. An app initializer in `appConfig` and one
  in `serverConfig` both run on the server.
- The browser build never sees `serverConfig` at all, because `main.ts` imports `appConfig` directly.

[13h](13h-five-collisions-in-one-config.md) walks the collision rules across these two files entry by
entry; [17](17-the-server-config-merge.md) is why the concatenation works at all.

## `provideServerRendering` — the surface, and the overload the template skips

From `@angular/ssr` **22.1.7**'s public-API golden, verbatim:

```ts
// @public
export function provideServerRendering(...features: ServerRenderingFeature<ServerRenderingFeatureKind>[]): EnvironmentProviders;

// @public
export function provideServerRendering(options: ServerRenderingOptions, ...features: ServerRenderingFeature<ServerRenderingFeatureKind>[]): EnvironmentProviders;

// @public
export function withRoutes(routes: ServerRoute[]): ServerRenderingFeature<ServerRenderingFeatureKind.ServerRoutes>;

// @public
export function withAppShell(component: Type<unknown> | (() => Promise<Type<unknown> | DefaultExport<Type<unknown>>>)): ServerRenderingFeature<ServerRenderingFeatureKind.AppShell>;

// @public
export interface ServerRenderingOptions {
    maxResponseBodySize: number;
}
```

It is the same `provide*(...features)` shape the rest of this topic covers — an `EnvironmentProviders`
return, a rest parameter of branded feature records;
[02](02-why-provide-functions-replaced-forroot.md) and
[04](04-writing-your-own-provide-function.md) explain the pattern. One difference is worth knowing:
**there is a second overload that takes an options object first.** The generated template uses the
first. If you need `maxResponseBodySize`, the options object goes **before** the features:

```ts
// options first, then every feature you already had
provideServerRendering({ maxResponseBodySize: 2_000_000 }, withRoutes(serverRoutes))
```

⚠️ **`RenderMode`, `ServerRoute`, `PrerenderFallback` and the app shell belong to SSR proper, not to
the provider array.** They are named here because they appear in the generated files;
**Phase 12 — SSR, hydration and the server** *(not written yet)* is where they are taught. The golden
also exports `IS_DISCOVERING_ROUTES` as a public `InjectionToken<boolean>`; this page did not read its
implementation and does not describe it.

## None of these filenames are API

`app.config.server.ts`, `app.routes.server.ts` and `main.server.ts` are schematic filenames, exactly
as `app.config.ts` is — [01](01-app-config-and-what-bootstrap-does-with-it.md) makes the same point
about the browser side. The actual contracts are:

- `main.server.ts` must have a **default export** that is a function taking a `BootstrapContext` and
  returning what `bootstrapApplication` returns;
- the object handed to `bootstrapApplication` must structurally match `ApplicationConfig`;
- the build must be pointed at whatever file holds that default export.

Everything else — the names, the split into three files, the `serverConfig` constant being local and
unexported — is convention. You can assemble the config in a function, in one file, or from six;
`bootstrapApplication` only looks at the shape. That matters more than it sounds, because it is what
makes a per-environment config factory legal:

```ts
// src/app/app.config.server.ts — nothing here is special to the framework
function buildServerConfig(env: 'staging' | 'production'): ApplicationConfig {
  return mergeApplicationConfig(appConfig, {
    providers: [
      provideServerRendering(withRoutes(serverRoutes)),
      {provide: API_BASE, useValue: env === 'production' ? 'https://api.example.com' : 'https://api.staging.example.com'},
    ],
  });
}

export const config = buildServerConfig(process.env['APP_ENV'] === 'production' ? 'production' : 'staging');
```

## Gotchas

**★ Symptom: `provideServerRendering({ maxResponseBodySize: N })` and the server stops honouring your
route configuration.** Cause: the options object is a **separate overload** that takes options first
and features after; adding options while dropping `withRoutes(...)` leaves the server with no route
configuration at all. Fix: options first, then every feature you already had:

```ts
// ⛔ withRoutes gone
provideServerRendering({ maxResponseBodySize: 2_000_000 })

// ✅
provideServerRendering({ maxResponseBodySize: 2_000_000 }, withRoutes(serverRoutes))
```

**★ Symptom: `@angular/ssr` code appears in the browser bundle.** Cause: `provideServerRendering` was
moved into `app.config.ts`, and `main.ts` imports that file — so every import it makes is reachable
from the browser entry point. It is the same bundler-reachability argument
[02](02-why-provide-functions-replaced-forroot.md) makes about `provide*` functions, applied at file
granularity. Fix: `@angular/ssr` imports belong in `app.config.server.ts`, which only
`main.server.ts` imports.

**★ Symptom: a provider added to `app.config.server.ts` has no effect in the browser, and you expected
it to.** Cause: the merge is one-directional. `main.ts` bootstraps with `appConfig`; nothing in the
browser build reads `config`. Fix: put anything both builds need in `app.config.ts`
([17e](17e-what-belongs-in-which-config.md) is the whole decision procedure).

**Symptom: you renamed `app.config.server.ts` and the build could not find the configuration.**
Cause: nothing in the framework cares about the name, but the build is pointed at `main.server.ts`
and that file's import is a plain relative path. Fix: rename both ends, or leave the convention
alone — the filename buys you a reviewer who recognises it instantly.

**Symptom: the generated `app.routes.server.ts` prerenders everything, including authenticated
pages.** Cause: the template ships `{path: '**', renderMode: RenderMode.Prerender}` — one wildcard,
prerender, for the whole application. It is a starting point, not a decision. Fix: replace the
wildcard with real per-path entries before the first production build; the modes themselves belong to
**Phase 12 — SSR, hydration and the server** *(not written yet)*, but the fact that the default is a
blanket prerender is something to notice on day one.

## Interview questions

**★ Is `app.config.server.ts` an API?**
No. It is a filename a schematic chose, exactly like `app.config.ts`. The contracts are structural: a
default export from the server entry point that takes a `BootstrapContext`, and an object matching
`ApplicationConfig` passed to `bootstrapApplication`. You could assemble the configuration in a
function, inline it, or split it across six files, and nothing in the framework would notice — which
is what makes an environment-parameterised config factory a legal thing to write.

**★ What does `provideServerRendering(withRoutes(serverRoutes))` contribute to the injector, and why
is it in the server config rather than the shared one?**
It returns `EnvironmentProviders` — the same branded, opaque shape every other `provide*` in this
topic returns — carrying the server rendering configuration and the server route table. It lives in
the server config for two independent reasons: it is only meaningful during a server render, and
`app.config.ts` is imported by `main.ts`, so putting an `@angular/ssr` import there makes that package
reachable from the browser entry point.

**★ The merge is `mergeApplicationConfig(appConfig, serverConfig)`. What is the browser's equivalent
line?**
There isn't one, and that is the single most useful thing to know about this arrangement. `main.ts`
bootstraps with `appConfig` directly, so the server config is a **superset** of the browser config
while the browser config has no server-side counterpart to override. Everything in `app.config.ts`
runs in both environments; only `app.config.server.ts` gets to differ. If you want browser-only
providers you have to create the file and repoint `main.ts` yourself.

**Why does `provideServerRendering` have two overloads rather than an options *feature*?**
The rest of this topic's `provide*` functions push configuration into `with*()` feature records, so
an options object as a positional first argument is the odd one out. The golden shows both
signatures, and the generated template uses the features-only one; beyond that, the documentation
read for this page does not state a rationale, so treat the shape as a fact about the API rather than
as a pattern to copy when writing your own `provide*`
([04](04-writing-your-own-provide-function.md) has the pattern that is house style).

{/* FOOTER */}
