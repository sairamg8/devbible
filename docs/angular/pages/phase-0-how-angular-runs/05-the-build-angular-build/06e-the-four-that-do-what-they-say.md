---
title: "Four dev-server options behave exactly as documented, and the only way to misuse them is to expect one of them to survive into a deployment — `servePath` is not `baseHref` and `headers` never leaves `ng serve`"
sidebar_label: "06e · The four that do what they say"
sidebar_position: 6.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — every description and default quoted from
> [`packages/angular/build/src/builders/dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json)
> at tag `v22.1.7`, with the option lists of both builders compared against
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> at the same tag (both schemas are `additionalProperties: false`).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Four of the nineteen options do precisely what their one-line description says, which makes the
only remaining mistake a category error: expecting a development-server setting to exist in
production.** `servePath` and `headers` both shape what a browser sees while you develop and neither
appears anywhere in a built artefact. That is not a limitation to work around — a bundle is files,
and files do not carry response headers or a mount point. Knowing which of the two worlds an option
lives in is the whole skill here.

| Option | Default | Lives in |
|---|---|---|
| `servePath` | — | the dev server only; `baseHref` is the build-side counterpart |
| `headers` | — | the dev server only; there is no build-side counterpart at all |
| `open` | `false` | your machine |
| `verbose` | — | the log |

## `servePath` is not `baseHref`

> `servePath` — *"The pathname where the application will be served."*

Set it when the application will eventually live under a sub-path and you want the dev server to
reproduce that shape locally, so routing, deep links and relative asset URLs behave the same way
they will after deployment.

It is a dev-server option and changes nothing about a built artefact. **`baseHref`** is the *build*
option that ends up in the emitted `index.html` and governs how the browser resolves relative URLs
in the real deployment. The two live on different targets, mean different things, and are almost
always needed together:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": { "servePath": "/admin/" },
  "configurations": {
    "development": { "buildTarget": "my-app:build:development" }
  },
  "defaultConfiguration": "development"
}
```

```json
"build": {
  "builder": "@angular/build:application",
  "options": {
    "baseHref": "/admin/",
    "browser": "src/main.ts",
    "tsConfig": "tsconfig.app.json"
  }
}
```

Set only `servePath` and local routing looks right while the build ships broken. Set only `baseHref`
and the build is correct while local development diverges from it — which is worse, because the
divergence is silent and you stop trusting local behaviour as evidence.

## `headers` applies to `ng serve` and to nothing else

> `headers` — *"Custom HTTP headers to be added to all responses."*

This is the right tool for reproducing a cross-origin isolation requirement, a CSP, or a
`Permissions-Policy` locally — and the wrong tool for setting one in production, where the real
server or CDN does it. There is no build-side equivalent, and there cannot be: a static bundle is a
set of files, and a file does not carry an HTTP header.

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "headers": {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp"
    }
  }
}
```

The value of setting it locally is precisely that it makes local development *fail the same way*
production will — a `SharedArrayBuffer` that needs cross-origin isolation will be unavailable in
both places rather than only in one.

## `open` and `verbose`

> `open` — *"Opens the url in default browser."* Default `false`.

Default `false` for a reason: a headless runner has no default browser to open. Because
`angular.json` is a shared file read by every developer *and* by CI, `"open": true` is a setting you
almost always want on the command line rather than in the workspace:

```bash
ng serve --open
```

> `verbose` — *"Adds more details to output logging."*

The schema declares no default. It is the cheapest diagnostic the builder exposes, and it is the
correct first step when something fails without explanation — before searching an issue tracker,
before bisecting a dependency:

```bash
ng serve --verbose
```

The same option name exists on the `application` builder, where it defaults to `false`. As with
every option that appears on both schemas, the two are independent declarations and neither
inherits from the other. The wider diagnostic surface — the `NG_BUILD_*` environment variables the
build system reads — is [11 · Cache, workers and the environment variables](11-cache-and-workers.md).

## Gotchas

**★ Symptom: routing works under `ng serve` and 404s once the app is deployed under a sub-path.**
Cause: `servePath` was set and `baseHref` was not. `servePath` only tells the dev server where to
mount; the emitted `index.html` still declares the root. Fix: set both, agreeing, on their
respective targets:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": { "servePath": "/admin/" }
}
```

```json
"build": {
  "builder": "@angular/build:application",
  "options": {
    "baseHref": "/admin/",
    "browser": "src/main.ts",
    "tsConfig": "tsconfig.app.json"
  }
}
```

**★ Symptom: `headers` you configured are missing from the deployed app.** Cause: `headers` applies
to responses from `ng serve` and nothing else — there is no build-time equivalent, because headers
are not part of a static bundle. Fix: configure them on the real server or CDN, and keep the
dev-server copy only so that local development behaves the way production will. If the deployment is
`@angular/ssr`-based, the headers belong in the server code, not in `angular.json`.

**★ Symptom: `servePath` or `headers` on the `build` target is rejected outright.** Cause: both
schemas are `additionalProperties: false`, and neither option is declared on the `application`
builder — they describe serving, not building. Fix: move them to the serve target; a dev-server
option is never valid on a build target and the reverse is equally true.

**Symptom: `open: true` fails or hangs on a CI runner, or opens a browser on a colleague's machine
who did not want one.** Cause: it is committed in a workspace file that CI and every developer
reads. Fix: keep the default in the file and pass the flag when you personally want it:

```bash
ng serve --open
```

**Symptom: a dev-server failure with no useful detail and no obvious cause.** Cause: default
logging. Fix: turn on the option that exists for exactly this, before reaching for a bug report:

```bash
ng serve --verbose
```

**Symptom: local development succeeds where production fails a security check, or the reverse.**
Cause: the dev server sends no security headers unless you configure them, so cross-origin
isolation, CSP and frame-ancestor rules only exist in one of the two environments. Fix: mirror the
production headers into the serve target so the two environments fail identically:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "headers": {
      "Content-Security-Policy": "default-src 'self'",
      "X-Frame-Options": "DENY"
    }
  }
}
```

## Interview questions

**★ What is the difference between `servePath` and `baseHref`?**
`servePath` is a dev-server option — the pathname the dev server mounts the application at, so that
local development matches a deployment living under a sub-path. `baseHref` is a build option that
ends up in the emitted `index.html` and governs how the browser resolves relative URLs in the real
deployment. They live on different targets and mean different things. Setting only `servePath` makes
local routing look right and ships a broken build; setting only `baseHref` ships correctly and makes
local development diverge, which is arguably worse because the divergence is silent and you stop
trusting local behaviour as evidence. If the app deploys under a sub-path you want both, agreeing.

**★ Why does the dev server have a `headers` option when a build cannot produce headers?**
Because the point is fidelity, not deployment. A production deployment sits behind a server or CDN
that adds security headers; the dev server does not, so behaviour that depends on those headers —
cross-origin isolation gating `SharedArrayBuffer`, a CSP blocking an inline style, a frame policy —
differs between the two environments by default. `headers` lets you reproduce the production
response envelope locally so that failures happen in both places or neither. What it explicitly does
*not* do is put anything into the build output, because a static bundle is files and files have no
headers.

**★ Which dev-server options also exist on the `application` builder, and does the overlap mean
anything?**
`define`, `verbose`, `watch` and `poll` are declared on both; `servePath`, `headers`, `open`,
`inspect`, `prebundle`, `port`, `host`, `ssl`, `allowedHosts` and `proxyConfig` are dev-server only.
The overlap means nothing structurally — each schema declares its own property with its own default
and there is no inheritance in either direction. `watch` is the clearest demonstration: it defaults
to `true` on the dev server and `false` on the `application` builder, which is exactly why `ng build`
returns and `ng serve` does not. Practically, the rule to remember is that a value set on one target
is never read by the other.

**What is your first move when `ng serve` fails with an unhelpful message?**
`ng serve --verbose`, before anything else. It costs nothing, it is the diagnostic the builder ships
for this purpose, and it frequently names the file or dependency the short message omitted. It is
also the right thing to have run before opening an issue, because the maintainers will ask for it.
If verbose output still does not explain it, the next layer is the build system's environment
variables rather than the option surface — that is a different set of switches on a different part
of the toolchain.

---

← Prev: [The three that fail silently](06d-the-three-that-fail-silently.md) · Index: [Topic index](README.md) · Next → [Ports and the PORT variable](06f-ports-and-the-port-variable.md)
