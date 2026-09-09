---
title: "`ng serve` is a nineteen-option builder with a closed schema and no config file of its own — it owns the socket and the rebuild loop, and delegates every build decision to the `build` target it names"
sidebar_label: "06 · The dev-server contract"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the complete option surface is quoted from
> [`packages/angular/build/src/builders/dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json)
> at tag `v22.1.7` (`"title": "Dev Server Target"`, `additionalProperties: false`), with
> [`packages/angular/build/builders.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/builders.json),
> `addAppToWorkspaceFile()` in
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts),
> and the option-validation message template in
> [`packages/angular_devkit/core/src/json/schema/registry.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/json/schema/registry.ts),
> plus angular.dev — [tools/cli/environments](https://angular.dev/tools/cli/environments) and
> [tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The dev server is the smallest builder in the package and the one people expect to be the
biggest.** Its schema declares nineteen options and forbids everything else; the `application`
builder next door declares forty-four. That gap is not an oversight — it is the shape of the
design. `ng serve` does not build anything itself and does not carry build settings; it names a
`build` target, asks that builder for an in-memory build, and spends its own option surface on the
things a build has no opinion about: a socket, a URL prefix, a proxy table, and how aggressively to
watch the disk. Every "how do I configure the dev server" question is really one of two questions —
*is this a build setting?* (then it is on the other target) or *is this a Vite setting?* (then the
answer is almost always no).

## One builder, one line in the manifest

`@angular/build`'s manifest declares six builders. The dev server is one entry of it, quoted
verbatim from `builders.json` at `v22.1.7`:

```json
"dev-server": {
  "implementation": "./src/builders/dev-server/index",
  "schema": "./src/builders/dev-server/schema.json",
  "description": "Execute a development server for an application."
}
```

That is the entire public declaration. Nothing about Vite appears in it, because Vite is an
implementation detail of `./src/builders/dev-server/index` — which is exactly why there is no
`vite.config.ts` in an Angular workspace and why adding one changes nothing. What that
encapsulation costs you, in angular.dev's own words, is [05 · Vite is only the dev server](05-vite-is-only-the-dev-server.md).

## The one option that couples serve to build

`buildTarget` is the only structural option the dev server has, and everything about how a serve
target reaches a build configuration follows from it — including the two independent configuration
selections that make `ng serve --configuration production` fail to do what it says. That mechanism
has its own page: [06b](06b-the-serve-to-build-coupling.md).

## The complete option surface — nineteen, and the schema is closed

Every description below is verbatim from `dev-server/schema.json` at `v22.1.7`. Defaults are the
schema's own `default` values; a dash means the schema declares none.

| Option | Default | Description (verbatim from the schema) |
|---|---|---|
| `buildTarget` | — | *"A build builder target to serve in the format of `project:target[:configuration]`. You can also pass in more than one configuration name as a comma-separated list. Example: `project:target:production,staging`."* |
| `port` | `4200` | *"Port to listen on."* |
| `host` | `"localhost"` | *"Host to listen on."* |
| `proxyConfig` | — | *"Proxy configuration file. For more information, see https://angular.dev/tools/cli/serve#proxying-to-a-backend-server."* |
| `ssl` | `false` | *"Serve using HTTPS."* |
| `sslKey` | — | *"SSL key to use for serving HTTPS."* |
| `sslCert` | — | *"SSL certificate to use for serving HTTPS."* |
| `allowedHosts` | `[]` | *"The hosts that the development server will respond to. This option sets the Vite option of the same name. For further details: https://vite.dev/config/server-options.html#server-allowedhosts"* |
| `define` | — | *"Defines global identifiers that will be replaced with a specified constant value when found in any JavaScript or TypeScript code including libraries. The value will be used directly. String values must be put in quotes. Identifiers within Angular metadata such as Component Decorators will not be replaced."* |
| `headers` | — | *"Custom HTTP headers to be added to all responses."* |
| `open` | `false` | *"Opens the url in default browser."* |
| `verbose` | — | *"Adds more details to output logging."* |
| `liveReload` | `true` | *"Whether to reload the page on change, using live-reload."* |
| `servePath` | — | *"The pathname where the application will be served."* |
| `hmr` | — | *"Enable hot module replacement. Defaults to the value of 'liveReload'. Currently, only global and component stylesheets are supported."* |
| `watch` | `true` | *"Rebuild on change."* |
| `poll` | — | *"Enable and define the file watching poll time period in milliseconds."* |
| `inspect` | `false` | *"Activate debugging inspector. This option only has an effect when 'SSR' or 'SSG' are enabled."* |
| `prebundle` | `true` | *"Enable and control the Vite-based development server's prebundling capabilities. To enable prebundling, the Angular CLI cache must also be enabled."* |

**Nineteen options, and the schema sets `additionalProperties: false`.** That is a load-bearing
detail: an option the dev server does not declare is a hard failure, not a silently ignored key.
The CLI validates builder options against the builder's schema, and the message template lives in
`registry.ts` — the header is `Schema validation failed with the following errors:` followed by
indented lines of the shape `Data path "<json pointer>" <message>(<offending property>).`, where
the parenthesised name is appended specifically for the `additionalProperties` keyword. Read the
parenthesis; it names the exact key that was rejected. The full CLI error surface — workspace
reader, Architect resolution, option validation — is topic 06's, in
**15 · When `angular.json` is wrong** *(not written yet)*.

## Nineteen against forty-four, and only three passthroughs

The `application` builder's schema declares 44 top-level options. The dev server declares 19. Put
the two numbers next to each other and the sentence angular.dev writes about Vite stops being
abstract:

> *"The usage of Vite, much like the Webpack-based development server, is encapsulated within the
> Angular CLI `dev-server` builder and currently cannot be directly configured."*
> — [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration)

Exactly **three** of the nineteen are acknowledged Vite passthroughs, and each says so in its own
description: `allowedHosts` (*"This option sets the Vite option of the same name"*), `prebundle`
(*"the Vite-based development server's prebundling capabilities"*), and `proxyConfig`, whose
path-matching semantics are Vite's — see [06j](06j-proxying-to-a-backend.md). Everything else in
Vite's `server` config — `fs`, `warmup`, `middlewareMode`, custom plugins — has no exposed knob,
and there is no escape hatch that adds one.

The nineteen fall into eight groups, and the rest of this chunk family follows them:

| Group | Options | Count | Where |
|---|---|---:|---|
| The coupling | `buildTarget` | 1 | [06b](06b-the-serve-to-build-coupling.md) |
| The rebuild loop | `watch`, `poll`, `liveReload`, `hmr` | 4 | [06c](06c-the-rebuild-loop.md) |
| The ones that fail silently | `define`, `inspect`, `prebundle` | 3 | [06d](06d-the-three-that-fail-silently.md) |
| The ones that do what they say | `servePath`, `headers`, `open`, `verbose` | 4 | [06e](06e-the-four-that-do-what-they-say.md) |
| The port | `port` | 1 | 🔴 [06f](06f-ports-and-the-port-variable.md) · [06g](06g-when-the-port-is-taken.md) |
| Who can connect | `host`, `allowedHosts` | 2 | [06h](06h-host-binding-and-allowedhosts.md) |
| What the connection is | `ssl`, `sslKey`, `sslCert` | 3 | [06i](06i-https-on-the-dev-server.md) |
| Talking to a backend | `proxyConfig` | 1 | [06j](06j-proxying-to-a-backend.md) |

## Gotchas

**★ Symptom: an option that works on `ng build` is rejected on `ng serve`.** Cause: the two
builders have separate schemas, and the dev server's is `additionalProperties: false` — it declares
nineteen keys and refuses the rest. `outputHashing`, `optimization`, `sourceMap`, `assets` and
`budgets` are options of the `application` builder, not of the dev server. Fix: put the setting on
the build configuration the `buildTarget` names, and let serve reach it:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "configurations": {
    "development": { "buildTarget": "my-app:build:development" }
  },
  "defaultConfiguration": "development"
}
```

```json
"build": {
  "builder": "@angular/build:application",
  "configurations": {
    "development": { "sourceMap": true, "optimization": false }
  }
}
```

**★ Symptom: a typo'd option fails the command instead of being ignored.** Cause: the closed
schema, and this is the *good* outcome. The message begins `Schema validation failed with the
following errors:` and the offending key is appended in parentheses on the `Data path` line. Fix:
read the parenthesis, not the JSON pointer — it names the key you misspelled.

**★ Symptom: a `serve` target copied from another project — or from a project still on the webpack
dev server — fails validation.** Cause: `@angular/build:dev-server` and
`@angular-devkit/build-angular:dev-server` are two different builders declared in two different
packages, each with its own `schema.json`. An option that exists on one is not guaranteed to exist
on the other, and `@angular/build`'s schema refuses anything it does not declare. Fix: copy the
`buildTarget` wiring and re-derive the rest from the nineteen options above rather than pasting a
target wholesale:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": { "port": 4200 },
  "configurations": {
    "development": { "buildTarget": "my-app:build:development" }
  },
  "defaultConfiguration": "development"
}
```

**Symptom: you cannot find where to configure a Vite feature you know exists.** Cause: there is no
place. Vite *"cannot be directly configured"*, and only `allowedHosts`, `prebundle` and
`proxyConfig` pass anything through. A `vite.config.ts` in the workspace root is inert. Fix: check
whether what you want is one of the three before looking further — if it is not, the answer is that
the option does not exist rather than that you have not found it:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "allowedHosts": ["dev.internal"],
    "prebundle": { "exclude": ["some-dep"] },
    "proxyConfig": "src/proxy.conf.json"
  }
}
```

**Symptom: `architect` in the file and every snippet you find says `targets`.** Cause: both key
names are accepted for the target map; `architect` is the older one and is still read. Fix: read
whichever key your file has and keep exactly one — which key wins when both are present is topic
06's problem, and its short answer is "do not have both".

## Interview questions

**★ The dev server runs on Vite — how much of Vite can you configure through Angular?**
Almost none of it, and that is stated rather than implied: angular.dev says Vite *"is encapsulated
within the Angular CLI `dev-server` builder and currently cannot be directly configured."* The
concrete measure is the schema — nineteen options, of which three are acknowledged passthroughs
(`allowedHosts` sets the Vite option of the same name, `prebundle` controls Vite's dependency
pre-bundling, and `proxyConfig` inherits Vite's proxy path matching). There is no `vite.config.ts`
in an Angular workspace, and adding one has no effect, because the builder constructs the Vite
server itself.

**★ What does `additionalProperties: false` on the dev-server schema buy you?**
It converts a class of silent misconfiguration into a build failure. Without it, a misspelled or
misplaced option — a build option written onto the serve target, say — would sit in `angular.json`
looking correct and do nothing, and you would debug the symptom instead of the typo. With it, the
CLI's option validation rejects the command and names the offending key in parentheses after the
`Data path` in the message. The trade is that you cannot stash arbitrary metadata on the target; in
exchange, everything the file says about `serve` is something the dev server actually reads.

**★ How would you enumerate the dev server's real option surface, rather than guessing at it?**
Read the schema the builder declares. `@angular/build`'s `builders.json` names
`./src/builders/dev-server/schema.json` for the `dev-server` entry, and that file — at the exact tag
your project is on — is the option list, the defaults and the descriptions, all in one place. Every
row of the table on this page came from there at `v22.1.7`. Doing it that way rather than from a
documentation page has two advantages: the schema is versioned with the builder, so it cannot be
stale, and it is what actually validates your `angular.json`, so it is the same source that decides
whether your file is accepted.

**Why does this topic treat the dev server as a separate contract instead of "`ng build` with a
watch loop"?**
Because they are separate builders with separate schemas, separate defaults and one deliberate link.
Nineteen options against forty-four, `watch` defaulting to `true` on one and `false` on the other,
`define` and `poll` declared independently on both — none of that follows from thinking of `serve`
as a variation on `build`. The mental model that survives contact with real problems is: the dev
server owns a socket and a rebuild loop, delegates everything else through one string, and is the
only place Vite appears at all. Every question about it then resolves to "is this mine, or the build
target's?", which is answerable by looking at two schemas.

**How would you prove which builder and which configuration `ng serve` is about to use, without
running it?**
Read the target. `node -p "JSON.stringify(require('./angular.json').projects['my-app'].targets.serve, null, 2)"`
prints the builder string, the `defaultConfiguration`, and every configuration's `buildTarget` in
one go; if it prints `undefined`, the workspace uses the older `architect` key instead of `targets`.
That single object answers "which builder", "which configuration by default", and "which build
configuration does that reach" — which are the three questions behind almost every "it works for me"
report about the dev server.

---

← Prev: [The dev/prod gap](05d-the-dev-prod-gap.md) · Index: [Topic index](README.md) · Next → [The serve-to-build coupling](06b-the-serve-to-build-coupling.md)
