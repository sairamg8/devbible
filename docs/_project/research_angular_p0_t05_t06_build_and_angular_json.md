---
name: research-angular-p0-t05-t06-build-and-angular-json
description: Banked primary-source research for Angular Phase 0 topics 05 (the build, @angular/build) and 06 (angular.json anatomy) — verbatim quotes and URLs for every planned chunk.
metadata:
  type: reference
---

# Research bank — Angular Phase 0, topics `05` (the build) and `06` (`angular.json`)

Researched **2026-09-09** against `angular/angular-cli` at tag **`v22.1.7`**, `angular/angular` at
tag **`v22.1.5`**, angular.dev (the `adev/src/content/**` sources at `v22.1.5`, which *are* the
published pages), and `registry.npmjs.org`. **No sandbox was run.** Every code block below is
*source text read from a repository, a JSON schema, or a documentation page* — never program
output, never a generated `angular.json` I did not read out of the CLI's own schematic.

**Who this is for.** The chunks of two not-yet-created topic directories:

- `/mnt/Storage/Backup/Knowledge/devbible/docs/angular/pages/phase-0-how-angular-runs/05-the-build-angular-build/`
- `/mnt/Storage/Backup/Knowledge/devbible/docs/angular/pages/phase-0-how-angular-runs/06-angular-json-anatomy/`

Read `## 0 · Facts every chunk needs` first (it is shared by both topics), then your own
`## Chunk NN` section.

🔴 **Rule for using this bank: if a claim is not in here with a URL, either verify it yourself or
write it as explicitly uncertain.** `## 99 · UNSETTLED` lists everything I could not settle, plus
three places where **angular.dev contradicts the CLI source** — do not silently pick a side.

🔴 **Do not re-derive.** Every quote below was read at the tags named above.

---

## 0 · Facts every chunk needs

### 0.1 The version spine — re-measured 2026-09-09 against the registry

| | |
|---|---|
| `@angular/core` `latest` | **22.1.5**, published **2026-09-03T02:38:10Z** |
| `@angular/core` `next` | 22.2.0-next.5 |
| `@angular/cli` / `@angular/build` / `@angular/ssr` / `@angular-devkit/build-angular` `latest` | **22.1.7**, published **2026-09-02T21:04:42Z** (`next` 22.2.0-next.6) |
| `@angular/compiler-cli` `latest` | **22.1.5** |
| LTS lines (`@angular/cli`) | v21 → 21.2.23 · v20 → 20.3.36 · v19 → 19.2.27 · v18 → 18.2.21 |
| LTS lines (`@angular/core`) | v21 → 21.2.22 · v20 → 20.3.30 · v19 → 19.2.25 |
| v22.0.0 released | **2026-06-03** (`@angular/core` 13:04:10Z, `@angular/build` 13:34:50Z) |
| v22.1.0 released | **2026-07-29** |

Sources: `https://registry.npmjs.org/-/package/@angular/core/dist-tags`,
`https://registry.npmjs.org/-/package/@angular/cli/dist-tags`,
`https://registry.npmjs.org/-/package/@angular/build/dist-tags`,
`https://registry.npmjs.org/-/package/@angular/ssr/dist-tags`,
`https://registry.npmjs.org/-/package/@angular-devkit/build-angular/dist-tags`,
`https://registry.npmjs.org/@angular/build` (the `time` map).

✅ **The spine in the phase README matched exactly** — Angular **22.1.5**, CLI / `@angular/build` /
`@angular/ssr` **22.1.7**, TypeScript peer `>=6.0 <6.1`. No drift. Do not change it.

🔴 **The one thing to say out loud in topic 05 that no other topic needs to:** `@angular/build`
**versions independently of `@angular/core`.** `@angular/build@22.1.5` also exists (published
2026-08-19) — the CLI line is simply two patches ahead. A page that writes "Angular 22.1.7" or
"`@angular/build` 22.1.5" has mixed the two lines up.

### 0.2 The `> Verified:` line to copy (adapt the source list per chunk)

```markdown
> Verified: 2026-09-09 against **Angular 22.1.5 / Angular CLI 22.1.7** — angular.dev
> [Page title](https://angular.dev/…) — and `angular/angular-cli` at tag `v22.1.7`:
> [`packages/angular/build/…`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/…).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`, published 2026-09-03) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.
```

Blob URL shapes, both verified working:

- CLI source: `https://github.com/angular/angular-cli/blob/v22.1.7/<path>`
- Framework source: `https://github.com/angular/angular/blob/v22.1.5/<path>`
- Docs source: `https://github.com/angular/angular/blob/v22.1.5/adev/src/content/<path>.md`
  — which publishes at `https://angular.dev/<path>` (e.g.
  `adev/src/content/tools/cli/build.md` → `https://angular.dev/tools/cli/build`).

🔴 **Reading source yourself: `raw.githubusercontent.com` 404s in this environment.** Use
`gh api repos/angular/angular-cli/contents/<path>?ref=v22.1.7 -q .content | base64 -d`.

### 0.3 Filenames — both directories are greenfield, nothing links in yet

`ls` on 2026-09-09 shows `phase-0-how-angular-runs/` contains only `01-…`, `02-…`, `03-…`,
`04-ng-update-not-npm-install/`, `README.md`, `_category_.json`. **Neither `05-` nor `06-` exists.**

The only inbound reference is topic 04's footer, and it is already correctly de-linked:

> `Next topic → **05 · The build: `@angular/build`** *(not written yet)*`
> — `04-ng-update-not-npm-install/README.md` line 56

So the directory names are **yours to pick**, but pick these and stay consistent, because the
phase `README.md` table rows 05 and 06 must be turned into links to them when each lands:

| Topic | Directory | README row to re-link |
|---|---|---|
| 05 | `05-the-build-angular-build/` | `[The build: `@angular/build`](05-the-build-angular-build/README.md)` |
| 06 | `06-angular-json-anatomy/` | `[`angular.json` anatomy](06-angular-json-anatomy/README.md)` |

`sidebar_position` = the chunk number. `sidebar_label` = `"NN · Short label"` with a middle dot.
Both topics are **`<span className="db-tier t-understand">Understand</span>`** — the phase README
sets that, and it is the authority.

### 0.4 🔴 Scope boundaries — four agents are working this phase in parallel

Where your material touches a neighbour's, write **one line and a forward pointer**, never the
material. None of these topics exist on disk yet, so every pointer is **bold text plus
*(not written yet)***, never a link.

| Belongs to | Do not teach it here |
|---|---|
| **Topic 04 — `ng update`, schematics** | How `ng update` works, migration authoring, skipping majors. Topic 05 may *name* `ng update @angular/cli --name use-application-builder` as the migration command and stop. |
| **Topic 07 — the TypeScript setup** | `tsconfig.json` / `tsconfig.app.json` / `tsconfig.spec.json` contents, `strictTemplates`, the `>=6.0 <6.1` peer pin's consequences. Topic 06 may say `tsConfig` is the **one required option** of the `application` builder and point away. |
| **Topic 08 — what `ng new` produces** | The generated file tree, `app.config.ts`, `app.routes.ts`, `main.ts`. Topic 06 owns **the generated `angular.json` project object** and nothing else in that tree. |
| **Topic 09 — the release train** | Six-month majors, LTS windows, reading a changelog. Topics 05/06 may cite one changelog entry as evidence for one fact. |
| **Topics 10/11/12 — partial compilation, JIT vs AOT, dev-mode-only** | What the compiler emits, the linker, `ngDevMode`. Topic 05 says *where* AOT runs (inside an esbuild plugin, `aot` defaults to `true`) and stops. |
| **Phase 14 — Performance and the build** | Bundle **analysis** — `stats.json`, source-map-explorer, hunting the fat dependency, budget *strategy*. Topic 06 teaches the `budgets` **field and its failure modes**; Phase 14 turns it into practice. The phase README already says exactly this. |
| **Phase 15 — Tooling and upgrades** | Full migration mechanics at Master tier. |

### 0.5 The one-line thesis each topic is arguing

- **05:** *Angular's build is not "webpack with a config"; it is a compiler pass wrapped in
  esbuild, with Vite bolted on for the dev server only, and as of v22 the webpack path is
  formally deprecated in every package that carried it.*
- **06:** *`angular.json` is not configuration in the `.eslintrc` sense — it is a **target
  graph**. Almost every field in it is an option to one builder, and the four fields that are
  not (`version`, `projects`, `root`, `projectType`) are the only ones the CLI itself reads.*

---

## 0A · Facts specific to topic 05 — the build

### 0A.1 What `@angular/build@22.1.7` actually is — read from the published package

From `https://registry.npmjs.org/@angular/build/22.1.7`:

```json
{
  "name": "@angular/build",
  "version": "22.1.7",
  "description": "Official build system for Angular",
  "engines": {
    "node": "^22.22.3 || ^24.15.0 || >=26.0.0",
    "npm": "^6.11.0 || ^7.5.6 || >=8.0.0",
    "yarn": ">= 1.13.0"
  },
  "builders": "builders.json"
}
```

Its **runtime dependencies**, exact pins, copied verbatim from the same document — this list is
the single most load-bearing evidence in topic 05, because it is the whole argument in one object:

```json
"dependencies": {
  "esbuild": "0.28.2",
  "vite": "8.1.5",
  "rolldown": "1.2.0",
  "oxc-parser": "0.142.0",
  "sass": "1.101.0",
  "piscina": "5.2.0",
  "beasties": "0.4.3",
  "listr2": "11.0.0",
  "watchpack": "2.5.2",
  "browserslist": "^4.26.0",
  "magic-string": "1.0.0",
  "@babel/core": "8.0.1",
  "@ampproject/remapping": "2.3.0",
  "@vitejs/plugin-basic-ssl": "2.3.0",
  "@angular-devkit/architect": "0.2201.7",
  "parse5-html-rewriting-stream": "8.0.1",
  "@babel/helper-annotate-as-pure": "8.0.0",
  "@babel/helper-split-export-declaration": "7.24.7",
  "@inquirer/confirm": "6.1.1",
  "https-proxy-agent": "9.1.0",
  "jsonc-parser": "3.3.1",
  "mrmime": "2.0.1",
  "picomatch": "4.0.5",
  "semver": "7.8.5",
  "source-map-support": "0.5.21",
  "tinyglobby": "0.2.17"
}
```

🔴 **There is no `webpack` in that list.** There is no `webpack-dev-server`, no `*-loader`, no
`terser`. Four bundler-adjacent tools appear instead: **esbuild** (the bundler), **vite** (the dev
server), **rolldown** (a second-pass chunk optimizer, §Chunk 04) and **oxc-parser** (the JS parser
that replaced Babel plugins in 22.1.0). That contrast is the page.

Its peers, same document:

```json
"peerDependencies": {
  "typescript": ">=6.0 <6.1",
  "@angular/compiler-cli": "^22.0.0",
  "@angular/core": "^22.0.0",
  "@angular/compiler": "^22.0.0",
  "@angular/localize": "^22.0.0",
  "@angular/platform-browser": "^22.0.0",
  "@angular/platform-server": "^22.0.0",
  "@angular/service-worker": "^22.0.0",
  "@angular/ssr": "^22.1.7",
  "less": "^4.2.0",
  "postcss": "^8.4.0",
  "tailwindcss": "^2.0.0 || ^3.0.0 || ^4.0.0",
  "rollup": "^4.0.0",
  "karma": "^6.4.0",
  "vitest": "^4.0.8",
  "ng-packagr": "^22.0.0",
  "istanbul-lib-instrument": "^6.0.0",
  "tslib": "^2.3.0"
}
```

**Optional peers** (`peerDependenciesMeta`, all `{"optional": true}`): `less`, `karma`, `rollup`,
`vitest`, `postcss`, `ng-packagr`, `tailwindcss`, `@angular/ssr`, `@angular/core`,
`@angular/localize`, `@angular/service-worker`, `istanbul-lib-instrument`,
`@angular/platform-server`, `@angular/platform-browser`.

⚠️ **Only two peers are NOT optional: `typescript` and `@angular/compiler-cli`** (plus `tslib`).
That is the sharpest possible statement of §0.5's thesis: the build system's only hard
requirements are *the TypeScript compiler and the Angular compiler*. Everything else — including
`@angular/core` itself — is optional at install time.

⚠️ **`typescript` is not a peer of `@angular/core`.** It is a peer of `@angular/compiler-cli`
**and** of `@angular/build` **and** of `@angular-devkit/build-angular`, all three at
`>=6.0 <6.1`. Attribute it correctly. Topic 07 owns the consequences.

### 0A.2 The builder manifest — `packages/angular/build/builders.json` at `v22.1.7`, in full

Source:
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/builders.json`

```json
{
  "builders": {
    "application": {
      "implementation": "./src/builders/application/index",
      "schema": "./src/builders/application/schema.json",
      "description": "Build an application."
    },
    "dev-server": {
      "implementation": "./src/builders/dev-server/index",
      "schema": "./src/builders/dev-server/schema.json",
      "description": "Execute a development server for an application."
    },
    "extract-i18n": {
      "implementation": "./src/builders/extract-i18n/index",
      "schema": "./src/builders/extract-i18n/schema.json",
      "description": "Extract i18n messages from an application."
    },
    "karma": {
      "implementation": "./src/builders/karma",
      "schema": "./src/builders/karma/schema.json",
      "description": "Run Karma unit tests."
    },
    "ng-packagr": {
      "implementation": "./src/builders/ng-packagr/index",
      "schema": "./src/builders/ng-packagr/schema.json",
      "description": "Build a library with ng-packagr."
    },
    "unit-test": {
      "implementation": "./src/builders/unit-test",
      "schema": "./src/builders/unit-test/schema.json",
      "description": "[EXPERIMENTAL] Run application unit tests."
    }
  }
}
```

**Six builders. That is the whole public surface of `@angular/build`.** Note `unit-test` carries
`[EXPERIMENTAL]` in its own description *and is what `ng new` writes as the `test` target* — see
Chunk 12 and UNSETTLED #6.

### 0A.3 The deprecated package — `@angular-devkit/build-angular@22.1.7`

From `https://registry.npmjs.org/@angular-devkit/build-angular/22.1.7`:

> `"description": "Angular Webpack Build Facade"`

Its dependencies include `webpack: 5.109.2`, `webpack-dev-server: 5.2.6`,
`webpack-dev-middleware: 8.0.3`, `webpack-merge: 6.0.1`, `terser: 5.49.0`, `css-loader: 7.1.4`,
`sass-loader: 17.0.0`, `less-loader: 13.0.0`, `babel-loader: 10.1.1`, `postcss-loader: 8.2.1`,
`source-map-loader: 5.0.0`, `resolve-url-loader: 5.0.0`, `copy-webpack-plugin: 14.0.0`,
`mini-css-extract-plugin: 2.10.2`, `license-webpack-plugin: 4.0.2`,
`webpack-subresource-integrity: 5.1.0`, `@ngtools/webpack: 22.1.7`,
`@angular-devkit/build-webpack: 0.2201.7`, `esbuild-wasm: 0.28.2` — **and `@angular/build: 22.1.7`**.

🔴 **`@angular-devkit/build-angular` depends on `@angular/build`, not the other way round.** The
legacy package is a superset: it re-exposes the new builders *and* carries the whole webpack
stack. Installing it to keep one webpack builder drags in ~20 webpack packages you do not use.

Its manifest,
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/build_angular/builders.json`
— note the **first entry is a bare string, not an object**:

```json
{
  "$schema": "../architect/src/builders-schema.json",
  "builders": {
    "application": "@angular/build:application",
    "app-shell":       { "description": "Build a server application and a browser application, then render the index.html and use it for the browser output." },
    "browser":         { "description": "Build a browser application." },
    "browser-esbuild": { "description": "Build a browser application." },
    "dev-server":      { "description": "Serve a browser application." },
    "extract-i18n":    { "description": "Extract i18n strings from a browser application." },
    "karma":           { "description": "Run Karma unit tests." },
    "server":          { "description": "Build a server Angular application." },
    "ng-packagr":      { "description": "Build a library with ng-packagr." },
    "ssr-dev-server":  { "description": "Serve a universal application." },
    "prerender":       { "description": "Perform build-time prerendering of chosen routes." }
  }
}
```

*(I collapsed the `implementation`/`schema` keys of the object entries for readability; each has
`"implementation": "./src/builders/<name>"` and `"schema": "./src/builders/<name>/schema.json"`.
The `"application": "@angular/build:application"` line is **verbatim and complete** — it really is
a one-line alias, and Chunk 03 of topic 06 explains how Architect follows it.)*

The package's own README, `packages/angular_devkit/build_angular/README.md` at `v22.1.7`, still
describes the whole set, and its builder table is a usable quote:

> *"| application     | Build an Angular application targeting a browser and server environment using [esbuild](https://esbuild.github.io).  |"*
> *"| browser         | Build an Angular application targeting a browser environment using [Webpack](https://webpack.js.org).  |"*
> *"| browser-esbuild | Build an Angular application targeting a browser environment using [esbuild](https://esbuild.github.io). |"*

And its disclaimer, verbatim — worth quoting whenever a page shows a builder's internals:

> *"While the builders when executed via the Angular CLI and their associated options are
> considered stable, the programmatic APIs are not considered officially supported and are not
> subject to the breaking change guarantees of SemVer."*
> — `https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/build_angular/README.md`

### 0A.4 The v22.0.0 deprecation block — verbatim, and the whole reason topic 05 exists now

From `CHANGELOG.md` at `v22.1.7`, section `# 22.0.0 (2026-06-03)`
(`https://github.com/angular/angular-cli/blob/v22.1.7/CHANGELOG.md`):

> *"## Deprecations*
> *### @angular-devkit/build-angular*
> *- Webpack builders in build-angular are deprecated. Use @angular/build builders instead.*
> *### @angular-devkit/build-webpack*
> *- Webpack builders in build-webpack are deprecated. Use @angular/build builders instead.*
> *### @angular/ssr*
> *- CommonEngine APIs are deprecated in favor of AngularNodeAppEngine or AngularAppEngine.*
> *### @ngtools/webpack*
> *- @ngtools/webpack loader and plugin are deprecated. Use @angular/build instead."*

The commits behind them, same section: `b7940dbcb` *"refactor | deprecate Webpack builders"*,
`3d5daa45e` *"refactor | deprecate webpack and webpack-dev-server builders"*, `547ca515b`
*"refactor | deprecate @ngtools/webpack loader and plugin"*, `50b16a65b` *"refactor | deprecate
CommonEngine APIs"*.

Also in the same v22.0.0 Breaking Changes block, all verbatim:

> *"- Node.js v20 is no longer supported. The minimum supported Node.js versions are now v22.22.0 and v24.13.1."*
> *"- The `@angular-devkit/architect-cli` package is no longer available. The `architect` CLI tool has been moved to the `@angular-devkit/architect` package."*
> *"- The experimental `@angular-devkit/build-angular:jest` and `@angular-devkit/build-angular:web-test-runner` builders have been removed."*
> *"- The `@angular/build:dev-server (ng serve)` now assigns the highest priority to the `PORT` environment variable. This value will override any port configurations specified in `angular.json` or via the `--port` command-line flag. This includes the default port 4200."*
> *"- `istanbul-lib-instrument` is now an optional peer dependency. Projects using karma with code coverage enabled will need to ensure that istanbul-lib-instrument is installed. Note: `ng update` will automatically add this dependency during the update process."*
> *"- The server no longer falls back to Client-Side Rendering (CSR) when a request fails host validation. Requests with unrecognized 'Host' headers will now return a 400 Bad Request status code. Users must ensure all valid hosts are correctly configured in the 'allowedHosts' option."* (— `@angular/ssr`)

⚠️ **The phase README's one-liner for topic 05 says "Webpack builders are legacy". As of v22.0.0
that is understating it: they are formally *deprecated*, in three separate packages, on the same
day.** Say "deprecated", cite the changelog, and note that they still ship — `browser`,
`browser-esbuild`, `server`, `app-shell`, `prerender`, `ssr-dev-server` and the webpack
`dev-server` are all still in `builders.json` at `v22.1.7`, and the schema still accepts them.

### 0A.5 The v22.1.0 build-system changes — the newest facts in the topic

From `CHANGELOG.md`, section `# 22.1.0 (2026-07-29)`, `### @angular/build`:

> *"| 585d08af8 | perf | default chunk optimization to use Rolldown |"*
> *"| 10dc30f9c | feat | migrate advanced optimization Babel plugins to oxc-parser + magic-string |"*
> *"| 917393a4c | feat | migrate i18n inliner to oxc-parser + magic-string |"*
> *"| 51f69276f | feat | enable chunk optimization for server builds |"*
> *"| 34d558c3c | feat | add built-in SQLite cache store fallback |"*
> *"| 52ae7f862 | feat | share persistent build cache across git worktrees |"*
> *"| 0c18dc0f6 | feat | emit debug ids for stable subresource integrity hashes |"*
> *"| 09d0a11a8 | perf | enable fast-path AST printing with sourcemaps in AotCompilation |"*

This is the evidence that `rolldown` and `oxc-parser` in §0A.1's dependency list are *load-bearing
and new*, not vestigial.

---

## 0B · Facts specific to topic 06 — `angular.json`

### 0B.1 The schema is the primary source, and it lives in the CLI package

`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/lib/config/workspace-schema.json`

That file is what `"$schema": "./node_modules/@angular/cli/lib/config/schema.json"` at the top of
every generated `angular.json` points at. Its header:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema",
  "$id": "ng-cli://config/schema.json",
  "title": "Angular CLI Workspace Configuration",
  "type": "object"
}
```

**Every field name and description in topic 06 must come from this file or from a builder's own
`schema.json`, not from a tutorial.** The corresponding published page is
`https://angular.dev/reference/configs/workspace-config` (source
`adev/src/content/reference/configs/workspace-config.md` at `v22.1.5`) and it is a legitimate
second source — but where the two disagree, **the schema wins and the disagreement is banked**
(see UNSETTLED #2 and #3).

### 0B.2 The complete top level, verbatim from the schema

```json
"properties": {
  "$schema": { "type": "string" },
  "version": { "$ref": "#/definitions/fileVersion" },
  "cli": { "$ref": "#/definitions/cliOptions" },
  "schematics": { "$ref": "#/definitions/schematicOptions" },
  "newProjectRoot": {
    "type": "string",
    "description": "Path where new projects will be created."
  },
  "projects": {
    "type": "object",
    "patternProperties": {
      "^(?:@[a-zA-Z0-9._-]+/)?[a-zA-Z0-9._-]+$": { "$ref": "#/definitions/project" }
    },
    "additionalProperties": false
  }
},
"additionalProperties": false,
"required": ["version"]
```

Six keys. **`additionalProperties: false`, and only `version` is required.** And:

```json
"fileVersion": {
  "type": "integer",
  "description": "File format version",
  "minimum": 1
}
```

🔴 **`defaultProject` is gone and does not appear anywhere in the schema.** Any page, blog or
memory that mentions it is describing ≤ v13. Chunk 14 of topic 06 owns what replaced it.

🔴 **The `projects` key pattern accepts npm scopes** — `^(?:@[a-zA-Z0-9._-]+/)?[a-zA-Z0-9._-]+$`.
A project may be named `@acme/ui`. The application schematic handles this explicitly:

```ts
// If scoped project (i.e. "@foo/bar"), convert dir to "foo/bar".
let folderName = options.name.startsWith('@') ? options.name.slice(1) : options.name;
```
— `packages/schematics/angular/application/index.ts`,
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts`

### 0B.3 The project object, verbatim from the schema

```json
"project": {
  "type": "object",
  "properties": {
    "cli": { "schematicCollections": { "type": "array", "description": "The list of schematic collections to use.", "items": { "type": "string", "uniqueItems": true } } },
    "schematics": { "$ref": "#/definitions/schematicOptions" },
    "prefix": { "type": "string", "format": "html-selector", "description": "The prefix to apply to generated selectors." },
    "root": { "type": "string", "description": "Root of the project files." },
    "i18n": { "$ref": "#/definitions/project/definitions/i18n" },
    "sourceRoot": { "type": "string", "description": "The root of the source files, assets and index.html file structure." },
    "projectType": { "type": "string", "description": "Project type.", "enum": ["application", "library"] },
    "architect": { "type": "object", "additionalProperties": { "$ref": "#/definitions/project/definitions/target" } },
    "targets":   { "type": "object", "additionalProperties": { "$ref": "#/definitions/project/definitions/target" } }
  },
  "required": ["root", "projectType"],
  "anyOf": [
    { "required": ["architect"], "not": { "required": ["targets"] } },
    { "required": ["targets"],   "not": { "required": ["architect"] } },
    { "not": { "required": ["targets", "architect"] } }
  ],
  "additionalProperties": false,
  "patternProperties": { "^[a-z]{1,3}-.*": {} }
}
```

Three things a chunk must not miss:

1. **Only `root` and `projectType` are required.** `sourceRoot`, `prefix`, `schematics`,
   `targets` are all optional.
2. **That `anyOf` is a legal XOR.** `architect` and `targets` are the same field under two names,
   and **the schema forbids having both**. See UNSETTLED #4 for what the *reader* does when they
   are both present anyway.
3. **`"patternProperties": { "^[a-z]{1,3}-.*": {} }` is the extension escape hatch.** A key of at
   most three lowercase letters followed by a hyphen (`nx-`, `cli-`, `foo-`) is accepted anywhere
   `additionalProperties: false` would otherwise reject it. This is how third-party tooling adds
   keys to `angular.json` legally. The workspace reader enforces the same regex — §Chunk 15.

### 0B.4 The generated project object — read out of the schematic, not out of a terminal

🔴 **This is the single most valuable artefact for topic 06.** It is the *source* that produces
the `projects.<name>` object in a freshly generated `angular.json`, copied verbatim from
`addAppToWorkspaceFile()` in
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts`:

```ts
const project = {
  root: normalize(projectRoot),
  sourceRoot,
  projectType: ProjectType.Application,
  prefix: options.prefix || 'app',
  schematics,
  targets: {
    build: {
      builder: Builders.BuildApplication,
      defaultConfiguration: 'production',
      options: {
        browser: `${sourceRoot}/main.ts`,
        polyfills: options.zoneless ? undefined : ['zone.js'],
        tsConfig: `${projectRoot}tsconfig.app.json`,
        inlineStyleLanguage,
        assets: [{ 'glob': '**/*', 'input': `${projectRoot}public` }],
        styles: [`${sourceRoot}/styles.${options.style}`],
      },
      configurations: {
        production: {
          budgets,
          outputHashing: 'all',
        },
        development: {
          optimization: false,
          extractLicenses: false,
          sourceMap: true,
        },
      },
    },
    serve: {
      builder: Builders.BuildDevServer,
      defaultConfiguration: 'development',
      options: {},
      configurations: {
        production: { buildTarget: `${options.name}:build:production` },
        development: { buildTarget: `${options.name}:build:development` },
      },
    },
    test:
      options.skipTests || options.minimal
        ? undefined
        : {
            builder: Builders.BuildUnitTest,
            options:
              options.testRunner === TestRunner.Vitest
                ? {}
                : { runner: 'karma' },
          },
  },
};
```

and immediately above it, the budgets:

```ts
let budgets: { type: string; maximumWarning: string; maximumError: string }[];
if (options.strict) {
  budgets = [
    { type: 'initial',           maximumWarning: '500kB', maximumError: '1MB' },
    { type: 'anyComponentStyle', maximumWarning: '4kB',   maximumError: '8kB' },
  ];
} else {
  budgets = [
    { type: 'initial',           maximumWarning: '2MB',   maximumError: '5MB' },
    { type: 'anyComponentStyle', maximumWarning: '6kB',   maximumError: '10kB' },
  ];
}
```

and the `inlineStyleLanguage` line, which explains why the key is usually *absent*:

```ts
const inlineStyleLanguage = options?.style !== Style.Css ? options.style : undefined;
```

The `Builders` enum values it references, from
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/utility/workspace-models.ts`:

```ts
BuildApplication = '@angular/build:application',
BuildDevServer   = '@angular/build:dev-server',
BuildUnitTest    = '@angular/build:unit-test',
BuildKarma       = '@angular/build:karma',
BuildNgPackagr   = '@angular/build:ng-packagr',
BuildExtractI18n = '@angular/build:extract-i18n',
```

The schematic defaults that decide which branches run, from
`packages/schematics/angular/application/schema.json` at `v22.1.7`:

| Option | Default | What it changes above |
|---|---|---|
| `strict` | **`true`** | the strict budget pair (500kB/1MB, 4kB/8kB) |
| `zoneless` | **`true`** | `polyfills` is `undefined` → **the key is absent from `angular.json`** |
| `standalone` | `true` | nothing in `angular.json` |
| `style` | `"css"` | `styles: ["src/styles.css"]`; `inlineStyleLanguage` absent |
| `testRunner` | **`"vitest"`** | `test.options` is `{}`; with `karma` it is `{ "runner": "karma" }` |
| `prefix` | `"app"` | `prefix` |
| `routing` | `true` | nothing in `angular.json` |
| `ssr` | `false` | nothing in `angular.json` (the `ssr` schematic adds it) |
| `skipTests` / `minimal` | `false` | `test` target present |
| `fileNameStyleGuide` | `"2025"` | `schematics` defaults block |

🔴 **Consequence a page must state:** in a default v22 `ng new`, `polyfills` and
`inlineStyleLanguage` do **not appear** in `angular.json` at all. A reader comparing against a v17
tutorial will think their file is broken. It is not — `zoneless: true` and `style: css` are the
new defaults.

The `schematics` sub-object is only written when it would be non-empty; the conditions are
verbatim in the same function:

```ts
if (options.inlineTemplate || options.inlineStyle || options.minimal || options.style !== Style.Css) { … }
if (options.skipTests || options.minimal) { /* skipTests: true for class, component, directive,
                                               guard, interceptor, pipe, resolver, service */ }
if (!options.standalone) { /* standalone: false for component, directive, pipe */ }
if (options.fileNameStyleGuide === '2016') { /* type + addTypeToClassName / typeSeparator */ }
```

### 0B.5 The workspace file the CLI writes first — `angular.json.template`, in full

`https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/angular.json.template`

```
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,<% if (packageManager) { %>
  "cli": {
    "packageManager": "<%= packageManager %>"
  },<% } %>
  "newProjectRoot": "<%= newProjectRoot %>",
  "projects": {
  }
}
```

**Ten lines.** `ng new` creates an empty workspace and then the *application* schematic adds the
project object from §0B.4 into it. Two schematics, two files, one result — that is worth saying,
because it explains why `newProjectRoot` exists even in a single-app workspace.

### 0B.6 The application builder's option schema — the field inventory

`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json`

```json
{ "title": "Application schema for Build Facade.", "required": ["tsConfig"], "additionalProperties": false }
```

🔴 **One required option: `tsConfig`.** Not `browser`, not `outputPath`. And
`additionalProperties: false`, which is why a typo'd key is a hard failure and not a silent no-op
(Chunk 15).

The full top-level property list with its schema-declared defaults, read from the file:

| Option | Type | Default |
|---|---|---|
| `tsConfig` | string | — (**required**) |
| `browser` | string | — |
| `server` | string \| false | — |
| `polyfills` | array | `[]` |
| `assets` | array of `assetPattern` | `[]` |
| `styles` | array | `[]` |
| `scripts` | array | `[]` |
| `inlineStyleLanguage` | string | `"css"` |
| `stylePreprocessorOptions` | object | — |
| `index` | string \| object \| `false` | — |
| `outputPath` | string \| object | — |
| `outputHashing` | string | `"none"` |
| `outputMode` | `"static"` \| `"server"` | — |
| `optimization` | boolean \| object | `true` |
| `sourceMap` | boolean \| object | `false` |
| `aot` | boolean | `true` |
| `budgets` | array of `budget` | `[]` |
| `fileReplacements` | array of `fileReplacement` | `[]` |
| `define` | object | — |
| `loader` | object | — |
| `conditions` | array | — |
| `externalDependencies` | array | `[]` |
| `allowedCommonJsDependencies` | array | `[]` |
| `extractLicenses` | boolean | `true` |
| `deleteOutputPath` | boolean | `true` |
| `namedChunks` | boolean | `false` |
| `subresourceIntegrity` | boolean | `false` |
| `crossOrigin` | string | `"none"` |
| `serviceWorker` | string \| `false` | `false` |
| `security` | object | — |
| `ssr` | boolean \| object | `false` |
| `prerender` | boolean \| object | — |
| `appShell` | boolean | — |
| `baseHref` | string | — |
| `deployUrl` | string | — |
| `localize` | boolean \| array | — |
| `i18nMissingTranslation` | string | `"warning"` |
| `i18nDuplicateTranslation` | string | `"warning"` |
| `webWorkerTsConfig` | string | — |
| `watch` | boolean | `false` |
| `poll` | number | — |
| `preserveSymlinks` | boolean | — |
| `progress` | boolean | `true` |
| `verbose` | boolean | `false` |
| `clearScreen` | boolean | `false` |
| `statsJson` | boolean | `false` |

**44 options; a generated `angular.json` sets nine of them.** That ratio *is* the "which fields
you set and which are scaffolding" chunk.

---

## Chunk plan

### Topic 05 — `05-the-build-angular-build/` (12 chunks)

| # | Filename | Concept |
|---|---|---|
| 01 | `01-what-ng-build-actually-runs.md` | `ng build` → the `build` target → a builder; the four build builders |
| 02 | `02-inside-the-package.md` | `@angular/build`'s dependency list and peers; why "low dependency" is the design |
| 03 | `03-esbuild-does-the-output.md` | esbuild as bundler; AOT inside a plugin; browserslist → esbuild target |
| 04 | `04-the-rolldown-chunk-optimizer.md` | the second pass, its threshold, and when it does not run |
| 05 | `05-vite-is-only-the-dev-server.md` | in-memory build handed to Vite; prebundling; HMR scope |
| 06 | `06-the-dev-server-contract.md` | dev-server options, PORT precedence, port-in-use, host warning, proxy semantics |
| 07 | `07-the-webpack-builders-are-deprecated.md` | the v22 deprecation across three packages; what still ships |
| 08 | `08-migrating-off-webpack.md` | `use-application-builder`; the option renames; `browser-esbuild` as the cheap path |
| 09 | `09-what-breaks-when-you-switch.md` | output location, ESM imports, side-effect order, workers, CommonJS, top-level await |
| 10 | `10-features-only-this-builder-has.md` | `define`, `loader`, import attributes, import conditions |
| 11 | `11-cache-workers-and-the-env-vars.md` | `.angular/cache`, lmdb/sqlite, `NG_BUILD_*`, worker count |
| 12 | `12-the-test-builders.md` | `unit-test` (vitest default, `[EXPERIMENTAL]`), `karma`, `builderMode` |

### Topic 06 — `06-angular-json-anatomy/` (15 chunks)

| # | Filename | Concept |
|---|---|---|
| 01 | `01-the-file-the-cli-reads.md` | filenames, lookup order, global config, `version`, `$schema`, JSONC |
| 02 | `02-projects-and-the-project-object.md` | `projects`, `root`/`projectType`, `architect` vs `targets`, the `^[a-z]{1,3}-` hatch |
| 03 | `03-targets-and-builders.md` | the target object; how `pkg:name` resolves; aliases; `ng run` |
| 04 | `04-options-and-configurations.md` | 🔴 the **shallow** merge; `defaultConfiguration`; comma lists |
| 05 | `05-the-generated-project-line-by-line.md` | §0B.4 walked field by field |
| 06 | `06-what-you-set-and-what-you-never-touch.md` | the scaffolding/live split |
| 07 | `07-file-replacements.md` | the schema, the environments schematic, the conflict warnings, the modern alternative |
| 08 | `08-budgets-the-seven-types.md` | the `budget` definition; what each type actually sums |
| 09 | `09-when-a-budget-fails.md` | the verbatim messages; error vs warning; raw bytes; the defaults discrepancy |
| 10 | `10-assets-styles-and-scripts.md` | `assetPattern`, the object forms, `bundleName`/`inject`, preprocessor paths |
| 11 | `11-outputpath-index-and-dist.md` | `outputPath` object, `browser`/`server`/`media`, `index` three forms |
| 12 | `12-optimization-and-sourcemap.md` | the nested objects and every default; the `production`/`development` conditions tie-in |
| 13 | `13-the-cli-block-and-workspace-defaults.md` | `cli`, `schematics`, `newProjectRoot`, cache, precedence |
| 14 | `14-multi-project-workspaces.md` | no `defaultProject`; cwd resolution; the verbatim "Cannot determine project" error |
| 15 | `15-when-angular-json-is-wrong.md` | the whole error surface: schema, reader, resolver |

**Plan boundaries, not file counts.** Every one of these will split past 300 lines into lettered
siblings; that is expected (topic 03's 17 chunks became 90 files).

---

# TOPIC 05 — The build: `@angular/build`

---

## Chunk 05.01 — What `ng build` actually runs

**Thesis.** `ng build` runs *one* thing: the builder named in the `build` target of the resolved
project. Everything else — esbuild, Vite, the compiler — is downstream of that one lookup.

The published page says it in one sentence
(`https://angular.dev/tools/cli/build`, source `adev/src/content/tools/cli/build.md` at `v22.1.5`):

> *"`ng build` only executes the builder for the `build` target in the default project as specified
> in `angular.json`."*

and the table of build builders, verbatim from the same page:

> *"| `@angular/build:application` | Builds an application with a client-side bundle, a Node server,
> and build-time prerendered routes with [esbuild](https://esbuild.github.io/). |"*
> *"| `@angular-devkit/build-angular:browser-esbuild` | Bundles a client-side application for use in
> a browser with [esbuild](https://esbuild.github.io/). |"*
> *"| `@angular-devkit/build-angular:browser` | Bundles a client-side application for use in a
> browser with [webpack](https://webpack.js.org/). |"*
> *"| `@angular/build:ng-packagr` | Builds an Angular library adhering to [Angular Package
> Format](tools/libraries/angular-package-format). |"*

⚠️ **That last href is a Class-2 inherited link.** In a quote block, `(tools/libraries/…)` belongs
to angular.dev, not to us. If you keep the link, make it absolute:
`https://angular.dev/tools/libraries/angular-package-format`.

Two defaults, verbatim from the same page:

> *"Applications generated by `ng new` use `@angular/build:application` by default.*
> *Libraries generated by `ng generate library` use `@angular/build:ng-packagr` by default."*

> *"You can determine which builder is being used for a particular project by looking up the
> `build` target for that project."*

The page's own illustrative `angular.json` fragment — note it uses `architect`, not `targets`,
and note the `…` elisions are the docs' own, so **do not paste it into a devbible code block**
(Rule 3 forbids `...` elisions); re-write it with real values from §0B.4 instead:

```json
{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "builder": "@angular/build:application"
        }
      }
    }
  }
}
```

And the output location, verbatim:

> *"The result of this build process is output to a directory (`dist/${PROJECT_NAME}` by default)."*

⚠️ That sentence is **incomplete for the `application` builder** — the actual browser output is
`dist/<project>/browser`. The migration guide says so explicitly and Chunk 09 carries the quote.
Do not let this sentence stand alone on a page.

**Boundary.** *How* `"@angular/build:application"` becomes a function call is topic 06 Chunk 03.
Give it one line and a pointer.

### Gotchas seeded here

- **Symptom: `ng build` in a multi-project workspace builds the wrong app, or errors.** Cause: no
  project argument and the cwd does not sit inside a project root. Fix and verbatim error text:
  topic 06 Chunk 14.
- **Symptom: `ng build` produces `dist/my-app/browser/…` and the deploy script uploads
  `dist/my-app/`.** Cause: the `application` builder's output layout. Chunk 09.

---

## Chunk 05.02 — Inside the package

Everything for this chunk is in **§0A.1** and **§0A.3** above: the description string, `engines`,
the exact dependency pins, the peer list, and the optional-peer list.

The argument to make, in this order:

1. `@angular/build`'s description is literally *"Official build system for Angular"*; the legacy
   package's is *"Angular Webpack Build Facade"*. The two strings are the whole story.
2. The dependency list has **esbuild, vite, rolldown, oxc-parser** and **no webpack**.
3. `@angular-devkit/build-angular` **depends on** `@angular/build` and adds ~20 webpack packages
   on top. Migration is subtraction, not substitution.
4. Only `typescript`, `@angular/compiler-cli` and `tslib` are non-optional peers. Even
   `@angular/core` is optional.
5. `engines.node` is `^22.22.3 || ^24.15.0 || >=26.0.0` — identical across `@angular/build`,
   `@angular/cli` and `@angular-devkit/build-angular` at 22.1.7. The v22.0.0 breaking change
   ("Node.js v20 is no longer supported… now v22.22.0 and v24.13.1") set the floor; the 22.1.7
   patch line has moved it up to `22.22.3`/`24.15.0`. Both numbers are real; quote the engines
   field for *today* and the changelog for *why*.

**A new v22 app never installs `@angular-devkit/build-angular`.** Proof, from the application
schematic
(`https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts`):

```ts
const APPLICATION_DEV_DEPENDENCIES = [
  { name: '@angular/compiler-cli', version: latestVersions.Angular },
  { name: '@angular/build', version: latestVersions.AngularBuild },
  { name: 'typescript', version: latestVersions['typescript'] },
];
```

plus the workspace `package.json.template`
(`https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/workspace/files/package.json.template`),
whose `devDependencies` are exactly:

```json
"devDependencies": {
  "@angular/cli": "^<version>",
  "@angular/compiler-cli": "<latestVersions.Angular>",
  "prettier": "<latestVersions['prettier']>",
  "typescript": "<latestVersions['typescript']>"
}
```

Its `scripts` block, verbatim, is also worth a line — it is where `--configuration development`
first appears to a reader:

```json
"scripts": {
  "ng": "ng",
  "start": "ng serve",
  "build": "ng build",
  "watch": "ng build --watch --configuration development",
  "test": "ng test"
}
```

*(`"test"` is present unless `--minimal`; `packageManager` is added only when the value is known.
The `<%= … %>` placeholders above are the template's, resolved at generation time — say so, and
do not present them as literal file content. Topic 08 owns the rest of the tree.)*

### Gotchas seeded here

- **Symptom: `npm ls webpack` finds webpack in a v22 app you never configured for it.** Cause:
  something still depends on `@angular-devkit/build-angular` — usually a leftover `build-angular`
  builder in one target, or a third-party schematic that added it. Fix: find the offending
  `"builder"` string in `angular.json`, migrate it (Chunk 08), then remove the package.
- **Symptom: install warns about an unmet peer `typescript`.** Cause: `typescript` is a *hard*
  peer of `@angular/build` at `>=6.0 <6.1`; nothing else supplies it. Topic 07 owns the version
  window.

---

## Chunk 05.03 — esbuild does the output

The migration guide's own list of what the build system *is*
(`https://angular.dev/tools/cli/build-system-migration`, source
`adev/src/content/tools/cli/build-system-migration.md` at `v22.1.5`) — quote it whole, it is the
cleanest statement available:

> *"In v17 and higher, the new build system provides an improved way to build Angular
> applications. This new build system includes:*
> *- A modern output format using ESM, with dynamic import expressions to support lazy module loading.*
> *- Faster build-time performance for both initial builds and incremental rebuilds.*
> *- Newer JavaScript ecosystem tools such as [esbuild](https://esbuild.github.io/) and [Vite](https://vitejs.dev/).*
> *- Integrated SSR and prerendering capabilities.*
> *- Automatic global and component stylesheet hot replacement."*

> *"This new build system is stable and fully supported for use with Angular applications."*

**Where AOT sits.** `aot` is an option of the `application` builder with `"default": true`:

> *"Build using Ahead of Time compilation."* — `application/schema.json`, `aot`

The Angular compilation runs as an **esbuild plugin**, not as a separate `tsc` pass whose output
esbuild then reads. The evidence a chunk can cite without over-claiming is the source layout at
`v22.1.7`: `packages/angular/build/src/tools/esbuild/` contains `angular/` (the compiler plugin
directory), `application-code-bundle.ts`, `compiler-plugin-options.ts`,
`javascript-transformer.ts`, `bundler-context.ts` — i.e. the compiler is one of ~25 esbuild
concerns in that folder. **Do not invent a step list.** Say: *"the Angular compilation is an
esbuild plugin; esbuild owns module resolution, bundling and emit"* and point at the directory.

**Browserslist → esbuild target.** This is the most quotable mechanism in the chunk, and it is
short enough to reproduce in full. From
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/tools/esbuild/target.ts`:

```ts
// https://esbuild.github.io/api/#target
const ESBUILD_SUPPORTED_BROWSERS: ReadonlySet<string> = new Set([
  'chrome', 'edge', 'firefox', 'ie', 'ios', 'node', 'opera', 'safari',
]);
```

and its doc comment, verbatim:

> *"Transform browserlists result to esbuild target.*
> *Only the lowest version for each browser is returned to avoid issues with esbuild and rolldown
> when multiple versions of the same target engine are specified."*

The four normalisation rules, each with its own source comment:

```ts
// browserslist uses the name `ios_saf` for iOS Safari whereas esbuild uses `ios`
if (browserName === 'ios_saf') { browserName = 'ios'; }
```
```ts
// browserslist uses ranges `15.2-15.3` versions but only the lowest is required
// to perform minimum supported feature checks. esbuild also expects a single version.
[version] = version.split('-');
```
```ts
// esbuild only supports numeric versions so `TP` is converted to a high number (999) since
// a Technology Preview (TP) of Safari is assumed to support all currently known features.
version = '999';
```
```ts
// A lone major version is considered by esbuild to include all minor versions. However,
// browserslist does not and is also inconsistent in its `.0` version naming. For example,
// Safari 15.0 is named `safari 15` but Safari 16.0 is named `safari 16.0`.
version += '.0';
```

**Any browserslist entry esbuild does not know is silently dropped** (`if
(!ESBUILD_SUPPORTED_BROWSERS.has(browserName)) { continue; }`). That is a real, non-obvious
gotcha: adding `samsung >= 12` or `and_chr > 100` to `.browserslistrc` has **no effect on the
downlevelling target**, because neither name is in that eight-name set.

The docs on browserslist, verbatim (`https://angular.dev/tools/cli/build`):

> *"By default, the Angular CLI uses a `browserslist` configuration which [matches browsers
> supported by Angular](reference/versions#browser-support) for the current major version."*

> *"To override the internal configuration, run [`ng generate config
> browserslist`](cli/generate/config), which generates a `.browserslistrc` configuration file in
> the project directory matching Angular's supported browsers."*

> *"Avoid expanding this list to more browsers. Even if your application code more broadly
> compatible, Angular itself might not be. You should only ever _reduce_ the set of browsers or
> versions in this list."*

*(The `(reference/versions#browser-support)` and `(cli/generate/config)` hrefs are Class-2 —
absolutise to `https://angular.dev/…` or de-link. The "Even if your application code more broadly
compatible" grammar error is in the source; quote it as-is or paraphrase outside the quote.)*

**Critical CSS inlining** belongs here too, because it is an esbuild-stage output concern:

> *"Angular can inline the critical CSS definitions of your application to improve [First
> Contentful Paint (FCP)](https://web.dev/first-contentful-paint). This option is enabled default."*
> *"This optimization extracts the CSS needed to render the initial viewport and inlines it directly
> into the generated HTML, allowing the browser to display content faster without waiting for the
> full stylesheets to load. The remaining CSS then loads asynchronously in the background. Angular
> CLI uses [Beasties](https://github.com/danielroe/beasties) to analyze your application's HTML and
> styles."* — `https://angular.dev/tools/cli/build`

`beasties: "0.4.3"` is in §0A.1's dependency list — that is the corroboration.

### Gotchas seeded here

- **Symptom: you widen `.browserslistrc` and the output syntax does not change.** Cause: the
  browser name is not one of esbuild's eight, so `transformSupportedBrowsersToTargets` drops it.
  Fix: check the name against `ESBUILD_SUPPORTED_BROWSERS`; and re-read the docs' "only ever
  *reduce*" instruction.
- **Symptom: two versions of the same browser in browserslist and the output targets the older
  one.** Cause: by design — *"Only the lowest version for each browser is returned."*
- **Symptom: `<style>` blocks appear inline in `index.html` in production and a CSP breaks.**
  Cause: critical-CSS inlining, on by default. Fix: `"optimization": { "styles": { "inlineCritical": false } }`
  (topic 06 Chunk 12 has the schema), or use `security.autoCsp`.

---

## Chunk 05.04 — The Rolldown chunk optimizer

**This is the newest mechanism in the topic and no blog covers it correctly. It is worth its own
chunk.**

The file's own header comment, verbatim, from
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/chunk-optimizer.ts`:

> *"@fileoverview This file provides a function to optimize JavaScript chunks using rolldown.*
> *It is designed to be used after an esbuild build to further optimize the output.*
> *The main function, `optimizeChunks`, takes the result of an esbuild build, identifies the main
> browser entry point, and then uses rolldown to rebundle and optimize the chunks. This process can
> result in smaller and more efficient code by combining and restructuring the original chunks. The
> file also includes helper functions to convert rolldown's output into an esbuild-compatible
> metafile, allowing for consistent analysis and reporting of the build output."*

**So there are two bundlers in one production build.** esbuild bundles; rolldown then *re*bundles
the chunks. The call site, verbatim, from
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/execute-build.ts`:

```ts
// Optimize chunks if enabled and threshold is met.
// This pass uses Rollup/Rolldown to further optimize chunks generated by esbuild.
if (options.optimizationOptions.scripts) {
  // Count lazy chunks (files not needed for initial load).
  // Advanced chunk optimization is most beneficial when there are multiple lazy chunks.
  const { metafile, initialFiles } = bundlingResult;
  const lazyChunksCount = Object.keys(metafile.outputs).filter(
    (path) => path.endsWith('.js') && !initialFiles.has(path),
  ).length;

  // Only run if the number of lazy chunks meets the configured threshold.
  // This avoids overhead for small projects with few chunks.
  if (lazyChunksCount >= optimizeChunksThreshold) {
    const { optimizeChunks } = await import('./chunk-optimizer');
    const optimizationResult = await profileAsync('OPTIMIZE_CHUNKS', () =>
      optimizeChunks(
        bundlingResult,
        options.sourcemapOptions.scripts ? !options.sourcemapOptions.hidden || 'hidden' : false,
      ),
    );

    if (optimizationResult.errors) {
      executionResult.addErrors(optimizationResult.errors);

      return executionResult;
    }

    bundlingResult = optimizationResult;
  }
}
```

**Three conditions, all of which a page must state:**

1. `optimization.scripts` must be true. **`ng serve` defaults to `optimization: false`, so the
   optimizer never runs in the dev server.** Anyone comparing dev and prod chunk graphs is
   comparing two different bundlers' output.
2. There must be **at least three lazy chunks**. The threshold, verbatim from
   `https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/environment-options.ts`:

```ts
/**
 * The threshold of lazy chunks required to enable the chunk optimization pass.
 * Can be configured via the `NG_BUILD_OPTIMIZE_CHUNKS` environment variable.
 * - `false` or `0` disables the feature.
 * - `true` or `1` forces the feature on (threshold 0).
 * - A number sets the specific threshold.
 * - Default is 3.
 */
const optimizeChunksEnv = process.env['NG_BUILD_OPTIMIZE_CHUNKS'];
export const optimizeChunksThreshold = (() => {
  if (optimizeChunksEnv === undefined) { return 3; }
  if (optimizeChunksEnv === 'false' || optimizeChunksEnv === '0') { return Infinity; }
  if (optimizeChunksEnv === 'true' || optimizeChunksEnv === '1') { return 0; }
  const num = Number.parseInt(optimizeChunksEnv, 10);

  return Number.isNaN(num) || num < 0 ? 3 : num;
})();
```

3. Rolldown vs Rollup is itself switchable:

```ts
/**
 * Allows using Rolldown for chunk optimization instead of Rollup.
 * This is useful for debugging and testing scenarios.
 */
export const useRolldownChunks = parseTristate(process.env['NG_BUILD_CHUNKS_ROLLDOWN']) ?? true;
```

**Rolldown became the default in 22.1.0** (changelog `585d08af8`, *"perf | default chunk
optimization to use Rolldown"*), and `rollup: "^4.0.0"` remains an **optional peer** — which is
exactly what you would expect if `NG_BUILD_CHUNKS_ROLLDOWN=0` is the fallback path. Server-build
chunk optimization also landed in 22.1.0 (`51f69276f`, *"feat | enable chunk optimization for
server builds"*).

⚠️ **`NG_BUILD_OPTIMIZE_CHUNKS=false` maps to `Infinity`, not to a boolean.** That is the actual
disable mechanism: the threshold can never be met. Say it that way; it is more accurate and more
memorable than "set it to false".

### Gotchas seeded here

- **Symptom: an app with two lazy routes and one with four produce structurally different chunk
  graphs for no apparent reason.** Cause: the three-lazy-chunk threshold. Fix: `NG_BUILD_OPTIMIZE_CHUNKS=1`
  to force it on for comparison, or accept it — the optimizer is skipped precisely because it
  would not pay for itself.
- **Symptom: chunk filenames or counts differ between `ng serve` and `ng build`.** Cause:
  `optimization.scripts` is false under the generated `development` configuration, so the rolldown
  pass is skipped entirely.
- **Symptom: a bundler-plugin-shaped error mentioning rollup in a build with no rollup config.**
  Cause: the post-esbuild pass. Fix while you investigate: `NG_BUILD_OPTIMIZE_CHUNKS=0` isolates
  whether the defect is esbuild's or the optimizer's.

---

## Chunk 05.05 — Vite is only the dev server

🔴 **The single most-misunderstood fact in the topic, and angular.dev states it in italics
itself.** Quote it in full — this paragraph *is* the chunk
(`https://angular.dev/tools/cli/build-system-migration#vite-as-a-development-server`):

> *"The usage of Vite in the Angular CLI is currently within a _development server capacity only_.
> Even without using the underlying Vite build system, Vite provides a full-featured development
> server with client side support that has been bundled into a low dependency npm package. This
> makes it an ideal candidate to provide comprehensive development server functionality. The
> current development server process uses the new build system to generate a development build of
> the application in memory and passes the results to Vite to serve the application. The usage of
> Vite, much like the Webpack-based development server, is encapsulated within the Angular CLI
> `dev-server` builder and currently cannot be directly configured."*

Four claims to pull out and say separately, because readers skim quotes:

1. Vite's **bundler is not used**. esbuild builds in dev too.
2. The dev build is produced **in memory** and handed to Vite.
3. Vite is **encapsulated in the `dev-server` builder** — there is no `vite.config.ts` in an
   Angular app, and adding one does nothing.
4. It **"currently cannot be directly configured"** — the only Vite knobs exposed are the ones the
   `dev-server` schema names (`allowedHosts`, `proxyConfig`, `prebundle`), and each says so.

The code corroborates the "in memory, handed to Vite" claim exactly, from
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/builder.ts`:

```ts
yield* serveWithVite(
  normalizedOptions,
  builderName,
  (options, context, plugins) =>
    buildApplicationInternal(options, context, { codePlugins: plugins }),
  context,
  { indexHtml: extensions?.indexHtmlTransformer },
  extensions,
);
```

**Prebundling**, verbatim from the same docs page:

> *"Prebundling provides improved build and rebuild times when using the development server. Vite
> provides [prebundling capabilities](https://vite.dev/guide/dep-pre-bundling) that are enabled by
> default when using the Angular CLI. The prebundling process analyzes all the third-party project
> dependencies within a project and processes them the first time the development server is
> executed. This process removes the need to rebuild and bundle the project's dependencies each
> time a rebuild occurs or the development server is executed."*

> *"In most cases, no additional customization is required. However, some situations where it may
> be needed include:*
> *- Customizing loader behavior for imports within the dependency such as the [`loader` option](#file-extension-loader-customization)*
> *- Symlinking a dependency to local code for development such as [`npm link`](https://docs.npmjs.com/cli/v10/commands/npm-link)*
> *- Working around an error encountered during prebundling of a dependency"*

> *"By default, `prebundle` is set to `true` but can be set to `false` to fully disable
> prebundling. However, excluding specific dependencies is recommended instead since rebuild times
> will increase with prebundling disabled."*

The two config forms, verbatim from the docs (these are safe to reproduce — they are complete):

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "prebundle": {
      "exclude": ["some-dep"]
    }
  }
}
```

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "prebundle": false
  }
}
```

The schema entry backing it (`dev-server/schema.json` at `v22.1.7`):

> `prebundle` — *"Enable and control the Vite-based development server's prebundling capabilities.
> To enable prebundling, the Angular CLI cache must also be enabled."* — default `true`

🔴 **"To enable prebundling, the Angular CLI cache must also be enabled."** So
`cli.cache.enabled: false` in `angular.json` (topic 06 Chunk 13) silently turns prebundling off
and makes `ng serve` slower. That coupling is the chunk's best gotcha.

**HMR**, verbatim:

> *"While general JavaScript-based hot module replacement (HMR) is currently not supported, several
> more specific forms of HMR are available:*
> *- **global stylesheet** (`styles` build option)*
> *- **component stylesheet** (inline and file-based)*
> *- **component template** (inline and file-based)"*

> *"The HMR capabilities are automatically enabled and require no code or configuration changes to
> use. Angular provides HMR support for both file-based (`templateUrl`/`styleUrl`/`styleUrls`) and
> inline (`template`/`styles`) component styles and templates."*

> *"If preferred, the HMR capabilities can be disabled by setting the `hmr` development server
> option to `false`."*

and the FOUC note, verbatim — this is the answer to a very common "is my app broken?" question:

> *"HELPFUL: With the development server, you may see a small Flash of Unstyled Content (FOUC) on
> startup as the server initializes. The development server attempts to defer processing of
> stylesheets until first use to improve rebuild times. This will not occur in builds outside the
> development server."*

The two HMR environment switches, from `environment-options.ts`:

```ts
/** When `NG_HMR_CSTYLES` is enabled, component styles will be hot-reloaded. */
export const useComponentStyleHmr = parseTristate(process.env['NG_HMR_CSTYLES']) === true;

/** When `NG_HMR_TEMPLATES` is set to `0` or `false`, component templates will not be hot-reloaded. */
export const useComponentTemplateHmr = parseTristate(process.env['NG_HMR_TEMPLATES']) !== false;
```

⚠️ Note the asymmetry: **template HMR is on unless disabled; component-style HMR is off unless
`NG_HMR_CSTYLES` is set.** That does not obviously agree with the docs' "component stylesheet
(inline and file-based)" bullet — see UNSETTLED #5. Do not paper over it.

### Gotchas seeded here

- **Symptom: you add `vite.config.ts` and nothing happens.** Cause: *"encapsulated within the
  Angular CLI `dev-server` builder and currently cannot be directly configured."*
- **Symptom: `ng serve` got much slower after someone set `"cache": { "enabled": false }`.**
  Cause: prebundling requires the cache.
- **Symptom: a locally `npm link`-ed dependency shows stale code in `ng serve` only.** Cause:
  prebundling. Fix: `"prebundle": { "exclude": ["my-linked-dep"] }` — prefer that over
  `"prebundle": false`, per the docs.
- **Symptom: a flash of unstyled content on `ng serve` startup, never in production.** Cause:
  deferred stylesheet processing. Not a bug; quote the HELPFUL note.
- **Symptom: editing a component `.ts` file full-reloads the page while editing its template does
  not.** Cause: general JS HMR is not supported; only styles and templates are.

---

## Chunk 05.06 — The dev-server contract

The complete `@angular/build:dev-server` option surface, read from
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json`
(`"title": "Dev Server Target"`, `additionalProperties: false`), with each description **verbatim**:

| Option | Default | Description (verbatim) |
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

**19 options. That is the entire dev server.** Nineteen, against the `application` builder's 44 —
worth stating, because it is the concrete form of "Vite cannot be directly configured".

⚠️ **`hmr`'s description says *"Currently, only global and component stylesheets are supported"* —
the migration guide says templates are supported too.** UNSETTLED #5.

**`PORT` beats everything.** The v22.0.0 breaking change, verbatim (§0A.4), and the code that
implements it, from
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/options.ts`:

```ts
let port = options.port ?? 4200;
// Overwrite port, if process.env.PORT is available.
if (process.env.PORT) {
  const envPort = Number(process.env.PORT);

  if (!isNaN(envPort)) {
    port = envPort;
    logger.info(`Environment variable "PORT" detected. Using port ${envPort}.`);
  }
}
```

The log line is quotable as a backticked inline phrase:
`Environment variable "PORT" detected. Using port <n>.`

🔴 **Order of precedence, provable from that snippet: `PORT` env var > `--port` > `angular.json`
`port` > `4200`.** Note it happens *after* `options.port` is resolved — so `--port 5000` with
`PORT=3000` in the environment serves on **3000**, which is the opposite of what almost everyone
assumes. This is exactly what the v22 breaking-change note warns about.

**Port already in use.** From
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/check-port.ts`:

```ts
function createInUseError(port: number): Error {
  return new Error(`Port ${port} is already in use. Use '--port' to specify a different port.`);
}
```

and the interactive branch — the prompt text is verbatim:

```ts
if (!isTTY()) {
  reject(createInUseError(port));

  return;
}

import('@inquirer/confirm')
  .then(({ default: confirm }) =>
    confirm({
      message: `Port ${port} is already in use.\nWould you like to use a different port?`,
      default: true,
      theme: { prefix: '' },
    }),
  )
```

🔴 **In CI (no TTY) the same condition is a hard error; interactively it is a prompt that defaults
to yes.** That behavioural split is a first-rate gotcha, and it is why "it works on my machine"
happens with ports.

Also verbatim in that file, worth a line because it explains a surprising restriction:

```ts
// Disabled due to Vite not handling port 0 and instead always using the default value (5173)
// TODO: Enable this again once Vite is fixed
```

**The non-localhost host warning**, verbatim from
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/builder.ts`:

```ts
if (
  !/^127\.\d+\.\d+\.\d+/g.test(normalizedOptions.host) &&
  normalizedOptions.host !== '::1' &&
  normalizedOptions.host !== 'localhost'
) {
  context.logger.warn(`
Warning: This is a simple server for use in testing or debugging Angular applications
locally. It hasn't been reviewed for security issues.

Binding this server to an open connection can result in compromising your application or
computer. Using a different host than the one passed to the "--host" flag might result in
websocket connection issues.
  `);
}
```

And the missing-target guard, also verbatim: `` context.logger.error(`The "dev-server" builder
requires a target to be specified.`) ``.

**Proxying.** The config file shape and the `angular.json` wiring, verbatim from
`https://angular.dev/tools/cli/serve`:

```json
{
  "/api/**": {
    "target": "http://localhost:3000",
    "secure": false
  }
}
```

```json
{
  "projects": {
    "my-app": {
      "architect": {
        "serve": {
          "builder": "@angular/build:dev-server",
          "options": {
            "proxyConfig": "src/proxy.conf.json"
          }
        }
      }
    }
  }
}
```

> *"NOTE: To apply changes made to your proxy configuration file, you must restart the `ng serve`
> process."*

🔴 **The path-matching semantics changed with the builder, and the docs spell it out.** Verbatim:

> *"**`@angular/build:dev-server`** (based on [Vite](https://vite.dev/config/server-options#server-proxy))*
> *- `/api` matches only `/api`.*
> *- `/api/*` matches `/api/users` but not `/api/users/123`.*
> *- `/api/**` matches `/api/users` and `/api/users/123`.*
> *
> ***`@angular-devkit/build-angular:dev-server`** (based on [Webpack DevServer](https://webpack.js.org/configuration/dev-server/#devserverproxy))*
> *- `/api` matches `/api` and any sub-paths (equivalent to `/api/**`)."*

**That is a silent breaking change on migration**: a `proxy.conf.json` keyed `"/api"` that worked
under webpack proxies exactly one URL under Vite. This belongs in Chunk 09's list as well.

### Gotchas seeded here

- **Symptom: `--port 5000` is ignored.** Cause: `PORT` in the environment wins (v22.0.0 breaking
  change). Fix: unset `PORT`, or set it to the value you want.
- **Symptom: `ng serve` fails in CI with `Port 4200 is already in use. Use '--port' to specify a
  different port.` but prompts locally.** Cause: the `isTTY()` branch.
- **Symptom: after migrating off the webpack dev server, only `/api` itself proxies and
  `/api/users` 404s.** Cause: Vite proxy globs. Fix: `"/api/**"`.
- **Symptom: proxy edits have no effect.** Cause: the proxy config is read at startup. Fix:
  restart `ng serve` (the docs' own NOTE).
- **Symptom: a security warning on every `ng serve --host 0.0.0.0`.** Cause: the host check above.
  It is a warning, not an error — but read what it says before ignoring it.

---

## Chunk 05.07 — The webpack builders are deprecated

Everything for this chunk is banked in **§0A.3** and **§0A.4**: the description strings, the
manifests, the alias line, the v22.0.0 Deprecations block verbatim, the commit list.

The migration guide's own statement of status, verbatim
(`https://angular.dev/tools/cli/build-system-migration`):

> *"IMPORTANT: The existing webpack-based build system and `browser` builder are deprecated.
> Applications can temporarily continue to use the `browser` builder and projects can opt-out of
> migrating during an update, but the Angular team recommends migrating to the new build system."*

> *"For new applications*
> *New applications will use this new build system by default via the `application` builder."*

**Which builders still exist at `v22.1.7`** (from `build_angular/builders.json`, §0A.3):
`application` (an alias), `app-shell`, `browser`, `browser-esbuild`, `dev-server`, `extract-i18n`,
`karma`, `server`, `ng-packagr`, `ssr-dev-server`, `prerender`. **Removed in v22.0.0:** the
experimental `jest` and `web-test-runner` builders (changelog, §0A.4).

**The `application` builder subsumed four of them.** Verbatim:

> *"The `application` builder now provides the integrated functionality for all of the following
> preexisting builders:*
> *- `app-shell`*
> *- `prerender`*
> *- `server`*
> *- `ssr-dev-server`"*

And the workspace schema still enumerates every legacy builder by name — the `target` definition's
first branch is a "custom builder" case whose `builder` field carries a `not.enum` listing all
seventeen official builder strings, so that a custom builder gets loose typing and an official one
gets its real schema. The full list is worth reproducing in topic 06 Chunk 03; here just note that
`@angular-devkit/build-angular:browser` is still in it.

**Nothing schedules removal.** The changelog says deprecated, not removed, and gives no target
version. If a chunk wants to say when they go, it must say *"the release notes do not state a
removal version"*. See UNSETTLED #1.

### Gotchas seeded here

- **Symptom: `@angular-devkit/build-angular:application` and `@angular/build:application` both
  appear to work identically.** Cause: the first is a literal one-line alias to the second
  (`"application": "@angular/build:application"`). Fix: use the `@angular/build` name and drop
  the legacy package — the alias exists only so that `ng update` does not have to rewrite the
  string on day one.
- **Symptom: `ng update` finished and `angular.json` still says `@angular-devkit/build-angular`.**
  Cause: the migration is opt-in; *"projects can opt-out of migrating during an update"*. Fix:
  run the named migration (Chunk 08).

---

## Chunk 05.08 — Migrating off webpack

**The automated path**, verbatim from `https://angular.dev/tools/cli/build-system-migration`:

> *"Starting with v18, the update process will ask if you would like to migrate existing
> applications to use the new build system via the automated migration."*

> *"When updating to Angular v18 via `ng update`, you will be asked to execute the migration. This
> migration is entirely optional for v18 and can also be run manually at anytime after an update
> via the following command:"*

```shell
ng update @angular/cli --name use-application-builder
```

**What the migration does**, verbatim — reproduce the whole list, it is the best answer to *"what
will this change in my repo?"*:

> *"- Converts existing `browser` or `browser-esbuild` target to `application`*
> *- Removes any previous SSR builders (because `application` does that now).*
> *- Updates configuration accordingly.*
> *- Merges `tsconfig.server.json` with `tsconfig.app.json` and adds the TypeScript option
>   `"esModuleInterop": true` to ensure `express` imports are ESM compliant.*
> *- Updates application server code to use new bootstrapping and output directory structure.*
> *- Removes any webpack-specific builder stylesheet usage such as the tilde or caret in
>   `@import`/`url()` and updates the configuration to provide equivalent behavior*
> *- Converts to use the new lower dependency `@angular/build` Node.js package if no other
>   `@angular-devkit/build-angular` usage is found."*

> *"While many changes can be automated and most applications will not require any further changes,
> each application is unique and there may be some manual changes required. After the migration,
> please attempt a build of the application as there could be new errors that will require
> adjustments within the code."*

**The two manual paths**, verbatim:

> *"- The `browser-esbuild` builder builds only the client-side bundle of an application designed to
> be compatible with the existing `browser` builder that provides the preexisting build system.
> This builder provides equivalent build options, and in many cases, it serves as a drop-in
> replacement for existing `browser` applications.*
> *- The `application` builder covers an entire application, such as the client-side bundle, as well
> as optionally building a server for server-side rendering and performing build-time prerendering
> of static pages."*

> *"The `application` builder is generally preferred as it improves server-side rendered (SSR)
> builds, and makes it easier for client-side rendered projects to adopt SSR in the future. However
> it requires a little more migration effort, particularly for existing SSR applications if
> performed manually. If the `application` builder is difficult for your project to adopt,
> `browser-esbuild` can be an easier solution which gives most of the build performance benefits
> with fewer breaking changes."*

For `browser-esbuild`, verbatim: *"Changing the `builder` field is the only change you will need
to make."*

**The option renames when going to `application`**, verbatim — this list is the heart of the chunk:

> *"- `main` should be renamed to `browser`.*
> *- `polyfills` should be an array, rather than a single file.*
> *- `buildOptimizer` should be removed, as this is covered by the `optimization` option.*
> *- `resourcesOutputPath` should be removed, this is now always `media`.*
> *- `vendorChunk` should be removed, as this was a performance optimization which is no longer needed.*
> *- `commonChunk` should be removed, as this was a performance optimization which is no longer needed.*
> *- `deployUrl` should be removed and is not supported. Prefer [`<base href>`](guide/routing/router-reference#base-href) instead. See [deployment documentation](tools/cli/deployment#--deploy-url) for more information.*
> *- `ngswConfigPath` should be renamed to `serviceWorker`."*

⚠️ **`deployUrl` "is not supported" contradicts the `application` schema, which still declares
it.** See UNSETTLED #2. The `application` schema's own text:

> `deployUrl` — *"Customize the base path for the URLs of resources in 'index.html' and component
> stylesheets. This option is only necessary for specific deployment scenarios, such as with
> Angular Elements or when utilizing different CDN locations."*

Corroboration for two of the renames, from the `application` schema: `polyfills` is
`"type": "array"` with `"default": []` and the description *"A list of polyfills to include in the
build. Can be a full path for a file, relative to the current workspace or module specifier.
Example: 'zone.js'."*; and `serviceWorker` is `string | false`, *"Path to ngsw-config.json."*.

**SSR-specific notes**, verbatim:

> *"HELPFUL: Remember to remove any CommonJS assumptions in the application server code if using
> SSR such as `require`, `__filename`, `__dirname`, or other constructs from the [CommonJS module
> scope](https://nodejs.org/api/modules.html#the-module-scope). All application code should be ESM
> compatible. This does not apply to third-party dependencies."*

> *"The `ng update` process will automatically remove usages of the `@nguniversal` scope packages
> where some of these builders were previously located. The new `@angular/ssr` package will also be
> automatically added and used with configuration and code being adjusted during the update. The
> `@angular/ssr` package supports the `browser` builder as well as the `application` builder."*

And on the dev server, verbatim:

> *"The development server will automatically detect the new build system and use it to build the
> application. To start the development server no changes are necessary to the `dev-server` builder
> configuration or command line."*

**Boundary.** Topic 04 owns `ng update`, schematics and migration mechanics. Here: name the
command, quote what it changes, stop.

### Gotchas seeded here

- **Symptom: after switching the builder string, `ng build` errors that `main` is not allowed.**
  Cause: `application/schema.json` is `additionalProperties: false` and the option is `browser`.
  Fix: rename it; and see the full rename list above.
- **Symptom: `polyfills": "src/polyfills.ts"` is rejected.** Cause: it is an array now.
- **Symptom: SCSS `@import '~lib/styles'` stops resolving.** Cause: the tilde/caret prefixes were
  webpack loader syntax. The automated migration strips them; a manual migration must.
- **Symptom: your `proxy.conf.json` keys stop matching sub-paths.** Cause: Vite proxy globs
  (Chunk 06). This is not in the migration guide's list — it is in the serve page.

---

## Chunk 05.09 — What breaks when you switch

The migration guide's **Known Issues** section, all verbatim.

**Output location** — put this first, it bites hardest:

> *"By default, after a successful build by the application builder the bundle is located in a
> `dist/<project-name>/browser` directory (instead of `dist/<project-name>` for the browser
> builder). This might break some of the toolchains that rely the previous location. In this case,
> you can [configure the output path](reference/configs/workspace-config#output-path-configuration)
> to suit your needs."*

*(Class-2 href — absolutise to `https://angular.dev/reference/configs/workspace-config#output-path-configuration`.
Topic 06 Chunk 11 owns the `outputPath` object that fixes it.)*

**ESM default vs namespace imports** — the warning text is real and quotable:

> *"TypeScript by default allows default exports to be imported as namespace imports and then used
> in call expressions. This is unfortunately a divergence from the ECMAScript specification. The
> underlying bundler (`esbuild`) within the new build system expects ESM code that conforms to the
> specification. The build system will now generate a warning if your application uses an incorrect
> type of import of a package."*

The warning, quoted by the docs (label the fence `text` and say it is quoted from angular.dev —
**do not label it `console`**):

```text
▲ [WARNING] Calling "moment" will crash at run-time because it's an import namespace object, not a function [call-import-namespace]

    src/main.ts:2:12:
      2 │ console.log(moment().format());
        ╵             ~~~~~~

Consider changing "moment" to a default import instead:

    src/main.ts:1:7:
      1 │ import * as moment from 'moment';
        │        ~~~~~~~~~~~
        ╵        moment
```

The before/after, verbatim:

```ts
import * as moment from 'moment';

console.log(moment().format());
```
```ts
import moment from 'moment';

console.log(moment().format());
```

> *"However, you can avoid the runtime errors and the warning by enabling the `esModuleInterop`
> TypeScript option for the application and changing the import to the following"*

**Order-dependent side-effectful imports:**

> *"Import statements that are dependent on a specific ordering and are also used in multiple lazy
> modules can cause top-level statements to be executed out of order. This is not common as it
> depends on the usage of side-effectful modules and does not apply to the `polyfills` option. This
> is caused by a [defect](https://github.com/evanw/esbuild/issues/399) in the underlying bundler but
> will be addressed in a future update."*

> *"IMPORTANT: Avoiding the use of modules with non-local side effects (outside of polyfills) is
> recommended whenever possible regardless of the build system being used and avoids this particular
> issue. Modules with non-local side effects can have a negative effect on both application size and
> runtime performance as well."*

**Web workers:**

> *"Web Workers can be used within application code using the same syntax (`new Worker(new
> URL('<workerfile>', import.meta.url))`) that is supported with the `browser` builder. However, the
> code within the Worker will not currently be type-checked by the TypeScript compiler. TypeScript
> code is supported just not type-checked. Additionally, any nested workers will not be processed by
> the build system. A nested worker is a Worker instantiation within another Worker file."*

*(⚠️ MDX: `<workerfile>` is a bare angle-bracket token. It is inside backticks in the quote above —
keep it that way or the build breaks.)*

**CommonJS warnings** — the docs page plus the real message from source.
`https://angular.dev/tools/cli/build`:

> *"Angular CLI outputs warnings if it detects that your browser application depends on CommonJS
> modules. When you encounter a CommonJS dependency, consider asking the maintainer to support
> ECMAScript modules, contributing that support yourself, or using an alternative dependency which
> meets your needs. If the best option is to use a CommonJS dependency, you can disable these
> warnings by adding the CommonJS module name to `allowedCommonJsDependencies` option in the `build`
> options located in `angular.json`."*

```json
"build": {
  "builder": "@angular/build:application",
  "options": {
    "allowedCommonJsDependencies": ["lodash"]
  }
}
```

The message itself, from
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/tools/esbuild/commonjs-checker.ts`:

```ts
text: `Module '${request}' used by '${importer}' is not ESM`,
notes: [
  {
    text:
      'CommonJS or AMD dependencies can cause optimization bailouts.\n' +
      'For more information see: https://angular.dev/tools/cli/build#configuring-commonjs-dependencies',
  },
],
```

So the real string is `` Module '<request>' used by '<importer>' is not ESM ``. Quote it inline as
a backticked phrase and name the file it came from. The schema's own description of the escape
hatch: *"A list of CommonJS or AMD packages that are allowed to be used without a build time
warning. Use `'*'` to allow all."*

⚠️ **The check only runs when scripts are optimized.** From `execute-build.ts`:

```ts
// Check metafile for CommonJS module usage if optimizing scripts
if (optimizationOptions.scripts) {
  const messages = checkCommonJSModules(metafile, options.allowedCommonJsDependencies);
  executionResult.addWarnings(messages);
}
```

So the warning never appears under the generated `development` configuration. A reader who only
ever runs `ng serve` will first meet it in CI.

**Top-level await + Zone.js** — a v22-specific note, from `execute-build.ts`:

```ts
// If Zone.js is used, augment top-level await errors with a more helpful message.
// esbuild's default error mentions "target environment" with browser versions, but
// the actual reason is that async/await is downleveled for Zone.js compatibility.
if (!isZonelessApp(options.polyfills)) {
  for (const error of bundlingResult.errors) {
    if (error.text?.startsWith(TOP_LEVEL_AWAIT_ERROR_TEXT)) {
      error.notes ??= [];
      error.notes.push({
        text:
          'Top-level await is not supported in applications that use Zone.js. ' +
          'Consider removing Zone.js or moving this code into an async function. \n' +
          'For more information about zoneless Angular applications, visit: https://angular.dev/guide/zoneless',
        location: null,
      });
    }
  }
}
```

That is a lovely fact: **an esbuild error about "target environment" in a Zone.js app is really
about Zone.js**, and the CLI patches the note in for you. Quote the note verbatim.

**And the migration guide's own caveat on `karma`:**

> *"IMPORTANT: The new features of the `application` builder described here are incompatible with
> the `karma` test builder by default because it is using the `browser` builder internally. Users
> can opt-in to use the `application` builder by setting the `builderMode` option to `application`
> for the `karma` builder. This option is currently in developer preview."*

⚠️ In v22 that sentence applies **only to `@angular-devkit/build-angular:karma`** — see Chunk 12
and UNSETTLED #3.

### Gotchas seeded here (this chunk is a gotcha catalogue by construction)

Symptom → Cause → Fix for each of: wrong `dist` path; `X is not a function` at runtime from a
namespace import; out-of-order module side effects in lazy routes; worker type errors that never
fire; the CommonJS warning appearing only in CI; a confusing esbuild "target environment" error in
a Zone.js app; `proxy.conf.json` sub-paths (Chunk 06).

---

## Chunk 05.10 — Features only this builder has

**`define` — build-time value replacement.** All verbatim from
`https://angular.dev/tools/cli/build-system-migration`:

> *"The `define` option allows identifiers present in the code to be replaced with another value at
> build time. This is similar to the behavior of Webpack's `DefinePlugin` which was previously used
> with some custom Webpack configurations that used third-party builders."*

```json
"build": {
  "builder": "@angular/build:application",
  "options": {
    "define": {
      "SOME_NUMBER": "5",
      "ANOTHER": "'this is a string literal, note the extra single quotes'",
      "REFERENCE": "globalThis.someValue.noteTheAbsentSingleQuotes"
    }
  }
}
```

> *"HELPFUL: All replacement values are defined as strings within the configuration file. If the
> replacement is intended to be an actual string literal, it should be enclosed in single quote
> marks. This allows the flexibility of using any valid JSON type as well as a different identifier
> as a replacement."*

> *"The CLI will merge `--define` values from the command line with `define` values from
> `angular.json`, including both in a build. Command line usage takes precedence if the same
> identifier is present for both."*

```shell
ng build --define SOME_NUMBER=5 --define "ANOTHER='these will overwrite existing'"
```
```shell
export MY_APP_API_HOST="http://example.com"
export API_RETRY=3
ng build --define API_HOST=\'$MY_APP_API_HOST\' --define API_RETRY=$API_RETRY
```
```ts
declare const SOME_NUMBER: number;
declare const ANOTHER: string;
declare const GIT_HASH: string;
declare const API_HOST: string;
declare const API_RETRY: number;
```

> *"IMPORTANT: This option will not replace identifiers contained within Angular metadata such as a
> Component or Directive decorator."*

The schema says the same thing in one sentence: *"Defines global identifiers that will be replaced
with a specified constant value when found in any JavaScript or TypeScript code including
libraries. The value will be used directly. String values must be put in quotes. Identifiers
within Angular metadata such as Component Decorators will not be replaced."*

🔴 **`define` is also on the `dev-server` schema** with the identical description — so it can be
set for serve independently of build. That is not obvious and is worth a line.

**`loader` — file-extension loaders.** Verbatim:

> *"IMPORTANT: This feature is only available with the `application` builder."*

> *"- `text` - inlines the content as a `string` available as the default export*
> *- `binary` - inlines the content as a `Uint8Array` available as the default export*
> *- `file` - emits the file at the application output path and provides the runtime location of the file as the default export*
> *- `dataurl` - inlines the content as a [data URL](https://developer.mozilla.org/docs/Web/HTTP/Basics_of_HTTP/Data_URIs).*
> *- `base64` - inlines the content as a Base64-encoded string.*
> *- `empty` - considers the content to be empty and will not include it in bundles"*

> *"The `empty` value, while less common, can be useful for compatibility of third-party libraries
> that may contain bundler-specific import usage that needs to be removed. One case for this is
> side-effect imports (`import 'my.css';`) of CSS files which has no effect in a browser. Instead,
> the project can use `empty` and then the CSS files can be added to the `styles` build option or use
> some other injection method."*

```json
"build": {
  "builder": "@angular/build:application",
  "options": {
    "loader": {
      ".svg": "text"
    }
  }
}
```
```ts
import contents from './some-file.svg';

console.log(contents); // <svg>...</svg>
```
```ts
declare module '*.svg' {
  const content: string;
  export default content;
}
```

**Per-file loaders via import attributes.** Verbatim:

> *"The presence of the import attribute takes precedence over all other loading behavior including
> JS/TS and any `loader` build option values."*

> *"An additional requirement to use import attributes is that the TypeScript `module` option must
> be set to `esnext` to allow TypeScript to successfully build the application code. Once `ES2025`
> is available within TypeScript, this change will no longer be needed."*

> *"At this time, TypeScript does not support type definitions that are based on import attribute
> values. The use of `@ts-expect-error`/`@ts-ignore` or the use of individual type definition files
> (assuming the file is only imported with the same loader attribute) is currently required."*

```ts
// @ts-expect-error TypeScript cannot provide types based on attributes yet
import contents from './some-file.svg' with {loader: 'text'};
```
```ts
async function loadSvg(): Promise<string> {
  // @ts-expect-error TypeScript cannot provide types based on attributes yet
  return import('./some-file.svg', {with: {loader: 'text'}}).then((m) => m.default);
}
```
```ts
// @ts-expect-error TypeScript cannot provide types based on attributes yet
import imagePath from './image.webp' with {loader: 'file'};

console.log(imagePath); // media/image-ULK2SIIB.webp
```

> *"For the import expression, the `loader` value must be a string literal to be statically
> analyzed. A warning will be issued if the value is not a string literal."*

> *"HELPFUL: When using the development server and using a `loader` attribute to import a file from
> a Node.js package, that package must be excluded from prebundling via the development server
> `prebundle` option."*

*(Note the `media/image-ULK2SIIB.webp` comment: that is the docs' own illustration of the hashed
media path, and it corroborates §0B.6's `outputPath.media` default of `media`. It is **not**
program output — it is a source comment on angular.dev. Say so if you reproduce it.)*

**Import/export conditions** — arguably the most useful thing in the chunk, because it replaces
`fileReplacements`:

> *"Several import/export [conditions](https://nodejs.org/api/packages.html#community-conditions-definitions)
> are automatically applied to support these project needs:*
> *- For optimized builds, the `production` condition is enabled.*
> *- For non-optimized builds, the `development` condition is enabled.*
> *- For browser output code, the `browser` condition is enabled."*

> *"An optimized build is determined by the value of the `optimization` option. When `optimization`
> is set to `true` or more specifically if `optimization.scripts` is set to `true`, then the build is
> considered optimized. This classification applies to both `ng build` and `ng serve`. In a new
> project, `ng build` defaults to optimized and `ng serve` defaults to non-optimized."*

```ts
import {verboseLogging} from '#logger';
```
```json
{
  "imports": {
    "#logger": {
      "development": "./src/logging/debug.ts",
      "default": "./src/logging/noop.ts"
    }
  }
}
```
```json
{
  "imports": {
    "#crashReporter": {
      "browser": "./src/browser-logger.ts",
      "default": "./src/server-logger.ts"
    }
  }
}
```

> *"HELPFUL: If currently using the `fileReplacements` build option, this feature may be able to
> replace its usage."*

The `conditions` option in the schema names the defaults precisely: *"Custom package resolution
conditions used to resolve conditional exports/imports. Defaults to `['module',
'development'/'production']`. The following special conditions are always present if the
requirements are satisfied: 'default', 'import', 'require', 'browser', 'node'."*

🔴 **"optimized" is defined by `optimization.scripts`, not by the configuration's name.** A
`staging` configuration that leaves `optimization` at its default `true` gets the `production`
condition — the word "production" never enters the calculation. That is the chunk's best gotcha
and it ties directly to topic 06 Chunk 04.

### Gotchas seeded here

- **Symptom: a `define`d identifier is not replaced inside a `@Component({...})` decorator.**
  Cause: *"will not replace identifiers contained within Angular metadata."*
- **Symptom: `define: { "API": "prod" }` produces a build error about an undefined variable
  `prod`.** Cause: values are used *directly*; a string literal needs `"'prod'"`.
- **Symptom: `import x from './a.svg' with {loader:'text'}` fails to compile.** Cause: TS `module`
  must be `esnext`. Topic 07 owns the tsconfig.
- **Symptom: a `#logger` subpath import resolves to the production file under `ng serve`.**
  Cause: someone set `optimization: true` in the `development` configuration, so the `production`
  condition applies.

---

## Chunk 05.11 — Cache, workers, and the environment-variable surface

**The cache**, from the workspace schema (`cliOptions.cache`) and
`https://angular.dev/reference/configs/workspace-config#cache-options`:

| Property | Details (verbatim) | Type | Default |
|---|---|---|---|
| `enabled` | *"Configure whether disk caching is enabled for builds."* | `boolean` | `true` |
| `environment` | *"Configure in which environment disk cache is enabled."* — `ci` enables caching only in CI; `local` enables caching only *outside* CI; `all` enables caching everywhere | `local`\|`ci`\|`all` | `local` |
| `path` | *"The directory used to stored cache results."* | `string` | `.angular/cache` |

The schema's own wording is terser: *"Control disk cache."*, *"Configure in which environment disk
cache is enabled."*, *"Configure whether disk caching is enabled."*, *"Cache base path."*

🔴 **The default is `local`, meaning the build cache is OFF in CI.** That single fact explains
more "why is CI slower than my laptop" questions than anything else in the topic, and it is a
deliberate default, not an oversight.

**The cache store**, from `environment-options.ts`:

```ts
/**
 * The persistent cache store configuration to use.
 * Managed by the `NG_BUILD_CACHE_STORE` environment variable.
 * - 'lmdb': Forces the use of LMDB.
 * - 'sqlite': Forces the use of SQLite.
 * - undefined / 'auto' / other: Automatically uses LMDB and falls back to SQLite.
 */
```

The SQLite fallback is new in 22.1.0 (`34d558c3c`, *"feat | add built-in SQLite cache store
fallback"*), as is worktree sharing (`52ae7f862`, *"feat | share persistent build cache across git
worktrees"*) and its 22.1.7 follow-up (`a84906fe3`, *"fix | keep dev-server Vite cache
worktree-local"*). Two related caches, then: the **build** cache is shared across worktrees; the
**dev-server Vite** cache is kept worktree-local.

**Workers**, verbatim from `environment-options.ts`:

```ts
/**
 * Some environments, like CircleCI which use Docker report a number of CPUs by the host and not the count of available.
 * This cause `Error: Call retries were exceeded` errors when trying to use them.
 */
const maxWorkersVariable = process.env['NG_BUILD_MAX_WORKERS'];

export const maxWorkers = isPresent(maxWorkersVariable)
  ? +maxWorkersVariable
  : Math.min(4, Math.max(availableParallelism() - 1, 1));
```

🔴 **The worker count is capped at 4 regardless of core count**, and it is `cores - 1`, floored at
1. A 64-core CI box uses four workers. That is a real, quotable formula — and the comment names
the failure it prevents: `` Error: Call retries were exceeded ``.

**The full `NG_BUILD_*` surface at `v22.1.7`**, every one of these read from
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/environment-options.ts`,
with the file's own doc comment as the description:

| Variable | Effect (verbatim doc comment) |
|---|---|
| `NG_BUILD_MANGLE` | *"Allows disabling of code mangling when the `NG_BUILD_MANGLE` environment variable is set to `0` or `false`. This is useful for debugging build output."* |
| `NG_BUILD_DEBUG_OPTIMIZE` | turns off mangle+minify and turns on beautify; accepts a comma list of `mangle`,`minify`,`beautify` to re-enable individually |
| `NG_BUILD_CHUNKS_ROLLDOWN` | *"Allows using Rolldown for chunk optimization instead of Rollup."* — default `true` |
| `NG_BUILD_OPTIMIZE_CHUNKS` | the lazy-chunk threshold; default `3`, `false`/`0` → `Infinity`, `true`/`1` → `0` |
| `NG_BUILD_MAX_WORKERS` | *"The maximum number of workers to use for parallel processing."* |
| `NG_BUILD_PARALLEL_TS` | *"When `NG_BUILD_PARALLEL_TS` is set to `0` or `false`, parallel TypeScript compilation is disabled."* |
| `NG_BUILD_TYPE_CHECK` | *"When `NG_BUILD_TYPE_CHECK` is set to `0` or `false`, type checking is disabled."* |
| `NG_BUILD_DEBUG_PERF` | *"When `NG_BUILD_DEBUG_PERF` is enabled, performance debugging information is printed."* |
| `NG_BUILD_WATCH_ROOT` | *"When `NG_BUILD_WATCH_ROOT` is enabled, the build will watch the root directory for changes."* |
| `NG_BUILD_LOGS_JSON` | *"When `NG_BUILD_LOGS_JSON` is enabled, build logs will be output in JSON format."* |
| `NG_BUILD_PARTIAL_SSR` | *"When `NG_BUILD_PARTIAL_SSR` is enabled, a partial server-side rendering build will be performed."* |
| `NG_BUILD_CACHE_STORE` | `lmdb` \| `sqlite` \| auto |
| `NG_HMR_CSTYLES` | *"When `NG_HMR_CSTYLES` is enabled, component styles will be hot-reloaded."* |
| `NG_HMR_TEMPLATES` | *"When `NG_HMR_TEMPLATES` is set to `0` or `false`, component templates will not be hot-reloaded."* |

Plus the truthiness rules, which matter because they are stricter than most people expect:

```ts
/** A set of strings that are considered "truthy" when parsing environment variables. */
const TRUTHY_VALUES = new Set(['1', 'true']);

/** A set of strings that are considered "falsy" when parsing environment variables. */
const FALSY_VALUES = new Set(['0', 'false']);
```

with `parseTristate` returning `undefined` for anything else and a `// TODO: Consider whether a
warning is useful in this case of a malformed value` comment beside it.

🔴 **`NG_BUILD_TYPE_CHECK=yes` does nothing.** Only `1`/`true` and `0`/`false` are recognised;
everything else falls through to the default **with no warning**. That is the best gotcha in the
chunk.

⚠️ **None of these are public API.** They appear in an internal `utils/` file, not in the schema
or the docs. Say that explicitly on the page: they are debugging levers, they can change in a
patch, and a build script that depends on one is depending on an implementation detail.

### Gotchas seeded here

- **Symptom: CI builds are slower than local builds with identical hardware.** Cause:
  `cache.environment` defaults to `local`. Fix: `"cli": { "cache": { "environment": "all" } }` —
  and understand you now need to persist `.angular/cache` between runs for it to help.
- **Symptom: a 32-core build machine shows four busy cores.** Cause: `Math.min(4, …)`.
- **Symptom: `NG_BUILD_MANGLE=off` does not disable mangling.** Cause: only `0`/`false` are falsy.
- **Symptom: `ng serve` in a git worktree keeps re-prebundling.** Cause: the Vite cache is
  deliberately worktree-local (22.1.7 `a84906fe3`), unlike the build cache.

---

## Chunk 05.12 — The test builders

**`ng new` writes `@angular/build:unit-test`.** From §0B.4:

```ts
test:
  options.skipTests || options.minimal
    ? undefined
    : {
        builder: Builders.BuildUnitTest,   // '@angular/build:unit-test'
        options:
          options.testRunner === TestRunner.Vitest ? {} : { runner: 'karma' },
      },
```

with `testRunner` defaulting to `"vitest"` in `application/schema.json`.

**And that builder describes itself as experimental.** From `builders.json` (§0A.2):

```json
"unit-test": {
  "description": "[EXPERIMENTAL] Run application unit tests."
}
```

🔴 **The default `test` target of a new v22 application is a builder whose own manifest labels it
`[EXPERIMENTAL]`.** State that plainly; it is true, it is verifiable in two files, and a reader
choosing a test strategy needs to know it. See UNSETTLED #6 for what the docs do and do not say
about it.

The `runner` option, verbatim from
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/unit-test/schema.json`:

```json
"runner": {
  "type": "string",
  "description": "Specifies the test runner to use for test execution.",
  "default": "vitest",
  "enum": ["karma", "vitest"]
}
```

Its full option list at `v22.1.7` (names only — the descriptions belong to a testing phase, not
here): `buildTarget`, `tsConfig`, `runner`, `runnerConfig`, `browsers`, `browserViewport`,
`include`, `exclude`, `filter`, `watch`, `headless`, `debug`, `ui`, `isolate`, `splitting`,
`quiet`, `coverage`, `coverageInclude`, `coverageExclude`, `coverageReporters`,
`coverageThresholds`, `coverageWatermarks`, `reporters`, `outputFile`, `providersFile`,
`setupFiles`, `progress`, `listTests`, `dumpVirtualFiles`.

`vitest: "^4.0.8"` and `karma: "^6.4.0"` are both **optional peers** of `@angular/build` (§0A.1) —
so neither runner is installed unless you use it. The application schematic adds whichever one the
`testRunner` option selected (`addTestRunnerDependencies(options.testRunner, …)` in
`application/index.ts`).

**`builderMode` exists only on the deprecated karma builder.** Verified by reading both schemas at
`v22.1.7`:

- `packages/angular/build/src/builders/karma/schema.json` — **no `builderMode` property.**
- `packages/angular_devkit/build_angular/src/builders/karma/schema.json`:

```json
"builderMode": {
  "type": "string",
  "description": "Determines how to build the code under test. If set to 'detect', attempts to follow the development builder.",
  "enum": ["detect", "browser", "application"],
  "default": "browser"
}
```

So the migration guide's `builderMode` paragraph (quoted in Chunk 09) applies to
`@angular-devkit/build-angular:karma` and to nothing in `@angular/build`. UNSETTLED #3.

**Removed in v22.0.0:** *"The experimental `@angular-devkit/build-angular:jest` and
`@angular-devkit/build-angular:web-test-runner` builders have been removed."*

**Boundary.** How to *write* tests is a later phase. Here: which builder the generated `test`
target names, what `runner` does, and the experimental label.

### Gotchas seeded here

- **Symptom: `ng test` fails with "cannot find module vitest" after copying a `test` target
  between projects.** Cause: the runner is an optional peer; the schematic installs it, a
  copy-paste does not.
- **Symptom: `builderMode` is rejected as an unknown option.** Cause: it is not on
  `@angular/build:karma`. Fix: you are on the new karma builder; drop the option.
- **Symptom: a v21-era `angular.json` with `@angular-devkit/build-angular:jest` stops working.**
  Cause: removed in v22.0.0.

---

# TOPIC 06 — `angular.json` anatomy

---

## Chunk 06.01 — The file the CLI reads

**Two accepted filenames, and a search that walks up.** From
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/utilities/config.ts`:

```ts
const configNames = ['angular.json', '.angular.json'];
const globalFileName = '.angular-config.json';
const defaultGlobalFilePath = path.join(os.homedir(), globalFileName);
```

```ts
async function projectFilePath(projectPath?: string): Promise<string | null> {
  // Find the configuration, either where specified, in the Angular CLI project
  // (if it's in node_modules) or from the current process.
  return (
    (projectPath && (await findUp(configNames, projectPath))) ||
    (await findUp(configNames, process.cwd())) ||
    (await findUp(configNames, __dirname))
  );
}
```

🔴 **`findUp` from the cwd.** Running `ng build` from `src/app/` finds the workspace file three
directories up. That is why the CLI appears to "just know" where the workspace is — and why
running it inside an unrelated nested folder that happens to contain an `angular.json` picks up
the wrong workspace.

**The global config file** is a different thing with a different name, and it follows XDG:

```ts
const xdgConfig = xdgConfigHome(home, 'config.json');   // $XDG_CONFIG_HOME/angular/config.json
```
with a migration warning for the old path, verbatim:

```ts
console.warn(
  `Old configuration location detected: ${xdgConfigOld}\n` +
    `Please move the file to the new location ~/.config/angular/config.json`,
);
```

So: **`~/.config/angular/config.json` is the global CLI config; `angular.json` is the workspace
config.** They use the same `cli` schema shape but the global one uses `cliGlobalOptions`, which
differs — it has `completion` (`{ "prompted": boolean }`) and lacks `cache`. Both are in the
workspace schema file; quote from the right one.

**`angular.json` is JSONC, and that is a genuine surprise.** From
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/core/src/workspace/json/reader.ts`:

```ts
import { Node, findNodeAtLocation, getNodeValue, parseTree } from 'jsonc-parser';
```
```ts
const ast = parseTree(raw, undefined, { allowTrailingComma: true, disallowComments: false });
```

🔴 **Comments and trailing commas are legal in `angular.json`.** `jsonc-parser` is a direct
dependency of both `@angular/cli` and `@angular/build` (`"jsonc-parser": "3.3.1"`). This is why
angular.dev's own examples put `//` comments inside `angular.json` snippets — for example on
`https://angular.dev/tools/cli/serve`:

```json
{
  "projects": {
    "my-app": {
      "architect": {
        // `ng serve` invokes the Architect target named `serve`.
        "serve": {
          "builder": "@angular/build:dev-server"
        }
      }
    }
  }
}
```

⚠️ **But an editor's JSON language service, `JSON.parse()` in your own scripts, and most CI JSON
linters will all reject the same file.** State both halves. The safe advice is: the CLI accepts
comments, your toolchain may not.

**The version gate**, verbatim from the same reader — three distinct errors, in order:

```ts
const raw = await host.readFile(path);
if (raw === undefined) {
  throw new Error('Unable to read workspace file.');
}

const ast = parseTree(raw, undefined, { allowTrailingComma: true, disallowComments: false });
if (ast?.type !== 'object' || !ast.children) {
  throw new Error('Invalid workspace file - expected JSON object.');
}

// Version check
const versionNode = findNodeAtLocation(ast, ['version']);
if (!versionNode) {
  throw new Error('Unknown format - version specifier not found.');
}
const version = versionNode.value;
if (version !== 1) {
  throw new Error(`Invalid format version detected - Expected:[ 1 ] Found: [ ${version} ]`);
}
```

🔴 **`version` must be the integer `1`. `"1"` as a string fails**, with that exact message. The
schema separately says `"minimum": 1` and `"type": "integer"`, but the reader's check is a strict
`!== 1`, so `2` fails too. Both facts are true; quote the reader for the runtime behaviour.

**`$schema` and `version` are skipped by the parser entirely:**

```ts
if (name === '$schema' || name === 'version') {
  // skip
}
```

### Gotchas seeded here

- **Symptom: `Unknown format - version specifier not found.`** Cause: `version` missing (or
  someone deleted it while removing `defaultProject`). Fix: `"version": 1`.
- **Symptom: `Invalid format version detected - Expected:[ 1 ] Found: [ 1 ]`.** Cause: the value
  is the *string* `"1"`. The message looks identical because JSON quoting is invisible in it.
- **Symptom: a `//` comment in `angular.json` breaks your CI's `jq` step but not `ng build`.**
  Cause: JSONC in, JSON out.
- **Symptom: `ng build` uses a workspace you did not expect.** Cause: `findUp` from the cwd.

---

## Chunk 06.02 — `projects` and the project object

The schema fragments are banked verbatim in **§0B.2** and **§0B.3**. What this chunk adds is the
*reader's* behaviour, which is looser than the schema and which is where the surprises live. All
from `packages/angular_devkit/core/src/workspace/json/reader.ts` at `v22.1.7`.

**The required-property check happens twice**, and the reader's message is friendlier:

```ts
const projectNodeValue = getNodeValue(projectNode);
if (!('root' in projectNodeValue)) {
  throw new Error(`Project "${projectName}" is missing a required property "root".`);
}
```

Note the reader checks only `root`; `projectType` is required by the **schema**, not by the
reader. Both are true, at different stages. Say so.

**`architect` and `targets` are handled by the same case, and the parser records which name you
used:**

```ts
case 'targets':
case 'architect': {
  const nodes = findNodeAtLocation(projectNode, [name]);
  if (!isJsonObject(value) || !nodes) {
    context.error(`Invalid "${name}" field found; expected an object.`, value);
    break;
  }
  hasTargets = true;
  targets = parseTargetsObject(projectName, nodes, context);
  jsonMetadata.hasLegacyTargetsName = name === 'architect';
  break;
}
```

🔴 Three facts fall out of those nine lines:

1. **`architect` is the legacy name** — the flag is literally called `hasLegacyTargetsName`.
2. **The CLI preserves whichever name you used** when it writes back (e.g. after `ng generate
   library`). Your file will not be silently rewritten to `targets`.
3. **If both keys are present, the last one in the object wins**, because the loop simply
   reassigns `targets`. The *schema* forbids that combination (§0B.3's `anyOf`), so an editor
   flags it — but the reader will not error. UNSETTLED #4.

**Anything the parser does not recognise is an "extension", and unknown ones warn.** From the same
file:

```ts
const ANGULAR_WORKSPACE_EXTENSIONS = Object.freeze(['cli', 'newProjectRoot', 'schematics']);
const ANGULAR_PROJECT_EXTENSIONS = Object.freeze(['cli', 'schematics', 'projectType', 'i18n']);
```
```ts
if (!context.unprefixedWorkspaceExtensions.has(name) && !/^[a-z]{1,3}-.*/.test(name)) {
  context.warn(`Workspace extension with invalid name (${name}) found.`, name);
}
```
```ts
if (!context.unprefixedProjectExtensions.has(name) && !/^[a-z]{1,3}-.*/.test(name)) {
  context.warn(
    `Project '${projectName}' contains extension with invalid name (${name}).`,
    name,
  );
}
```

🔴 **`^[a-z]{1,3}-.*` is the whole contract for third-party keys.** One to three lowercase letters,
a hyphen, then anything. `nx-something` ✅. `mytool-config` ❌ (five letters). `Nx-something` ❌
(capital). This is the same regex as the schema's `patternProperties` in §0B.3, and it is why
tools pick short prefixes.

**`prefix`, `root` and `sourceRoot` warn rather than error on the wrong type:**

```ts
case 'prefix':
case 'root':
case 'sourceRoot':
  if (typeof value !== 'string') {
    context.warn(`Project property "${name}" should be a string.`, value);
  }
```

And the project-level docs table, verbatim from
`https://angular.dev/reference/configs/workspace-config#project-configuration-options`:

> *"| `root` | The root directory for this project's files, relative to the workspace directory.
> Empty for the initial application, which resides at the top level of the workspace. | `string` |
> None (required) |"*
> *"| `projectType` | One of "application" or "library" An application can run independently in a
> browser, while a library cannot. | `application` \| `library` | None (required) |"*
> *"| `sourceRoot` | The root directory for this project's source files. | `string` | `''` |"*
> *"| `prefix` | A string that Angular prepends to selectors when generating new components,
> directives, and pipes using `ng generate`. Can be customized to identify an application or feature
> area. | `string` | `'app'` |"*

and the structural warning, verbatim:

> *"HELPFUL: The `projects` section of the configuration file does not correspond exactly to the
> workspace file structure.*
> *- The initial application created by `ng new` is at the top level of the workspace file structure.*
> *- Other applications and libraries are under the `projects` directory by default."*

🔴 That is why **the first app's `root` is `""`** and every later one's is `projects/<name>`. It
looks like an inconsistency; it is the documented design.

### Gotchas seeded here

- **Symptom: `Project "foo" is missing a required property "root".`** on a project you hand-wrote.
  Cause: `root` is the one key the reader will not infer. For the top-level app it is `""`, which
  people delete thinking it is a placeholder.
- **Symptom: your editor flags `architect` and `targets` both present, but `ng build` works.**
  Cause: schema `anyOf` vs reader leniency. Fix: keep exactly one — the last one is what runs, and
  which key is "last" depends on JSON key order, which nothing guarantees.
- **Symptom: `Workspace extension with invalid name (myTool) found.`** Cause: the
  `^[a-z]{1,3}-.*` rule. Fix: rename to a ≤3-letter hyphen prefix, or put the config in its own
  file.
- **Symptom: `ng generate` rewrites your `targets` key back to `architect` (or vice versa).**
  It does not — `hasLegacyTargetsName` preserves it. If it changed, something other than the CLI
  edited the file.

---

## Chunk 06.03 — Targets and builders

**The target object** — from the schema's `project.definitions.target`. Every official builder has
its own branch of a big `oneOf`, so that `options` gets typed by that builder's schema. The
**first** branch is the custom-builder case, and its `not.enum` is the complete list of official
builder strings at `v22.1.7` — reproduce it, it is the best possible "what builders exist" table:

```json
{
  "$comment": "Extendable target with custom builder",
  "type": "object",
  "properties": {
    "builder": {
      "type": "string",
      "description": "The builder used for this package.",
      "not": {
        "enum": [
          "@angular/build:application",
          "@angular/build:dev-server",
          "@angular/build:extract-i18n",
          "@angular/build:karma",
          "@angular/build:ng-packagr",
          "@angular/build:unit-test",
          "@angular-devkit/build-angular:application",
          "@angular-devkit/build-angular:app-shell",
          "@angular-devkit/build-angular:browser",
          "@angular-devkit/build-angular:browser-esbuild",
          "@angular-devkit/build-angular:dev-server",
          "@angular-devkit/build-angular:extract-i18n",
          "@angular-devkit/build-angular:karma",
          "@angular-devkit/build-angular:ng-packagr",
          "@angular-devkit/build-angular:prerender",
          "@angular-devkit/build-angular:server",
          "@angular-devkit/build-angular:ssr-dev-server"
        ]
      }
    },
    "defaultConfiguration": {
      "type": "string",
      "description": "A default named configuration to use when a target configuration is not provided."
    },
    "options": { "type": "object" },
    "configurations": {
      "type": "object",
      "description": "A map of alternative target options.",
      "additionalProperties": { "type": "object" }
    }
  },
  "additionalProperties": false,
  "required": ["builder"]
}
```

**Seventeen official builders. `builder` is the only required key of a target.** A target with a
builder and nothing else is valid.

And an official branch, e.g. for the application builder, showing how `options` gets its type:

```json
{
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "builder": { "const": "@angular/build:application" },
    "defaultConfiguration": { "type": "string", "description": "A default named configuration to use when a target configuration is not provided." },
    "options": { "$ref": "../../../../angular/build/src/builders/application/schema.json" },
    "configurations": {
      "type": "object",
      "additionalProperties": { "$ref": "../../../../angular/build/src/builders/application/schema.json" }
    }
  }
}
```

🔴 **`configurations` entries `$ref` the *same* schema as `options`.** So every builder option is
legal inside a configuration, and none is required there (the outer `required: ["tsConfig"]` is
not re-applied per configuration — it applies to the *merged* result). That is worth a sentence:
it is why `"production": { "budgets": [...], "outputHashing": "all" }` is a complete, valid
configuration.

⚠️ **`@angular-devkit/build-angular:application`'s branch `$ref`s
`angular/build/src/builders/application/schema.json`** — the same file as the new builder. Further
proof it is a pure alias.

**How `"@angular/build:application"` becomes a function.** This is the mechanism the chunk is for,
from
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/architect/node/node-modules-architect-host.ts`:

```ts
const [packageName, builderName] = builderStr.split(':', 2);
if (!builderName) {
  throw new Error('No builder name specified.');
}

// Resolve and load the builders manifest from the package's `builders` field, if present
const packageJsonPath = localRequire.resolve(packageName + '/package.json', { paths: [basePath] });

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as { builders?: string };
const buildersManifestRawPath = packageJson['builders'];
if (!buildersManifestRawPath) {
  throw new Error(`Package ${JSON.stringify(packageName)} has no builders defined.`);
}
```
```ts
// Attempt to locate an entry for the specified builder by name
const builder = buildersManifest.builders?.[builderName];
if (!builder) {
  throw new Error(`Cannot find builder ${JSON.stringify(builderStr)}.`);
}

// Resolve alias reference if entry is a string
if (typeof builder === 'string') {
  return this.resolveBuilder(
    builder,
    path.dirname(packageJsonPath),
    (seenBuilders ?? new Set()).add(builderStr),
  );
}
```

**Five steps, and each has its own error:**

1. Split on the first `:` → `<package>` and `<name>`. Missing name → `No builder name specified.`
2. `require.resolve('<package>/package.json')` from the workspace root.
3. Read its **`"builders"` field** → `Package "<pkg>" has no builders defined.`
4. Look up `<name>` in that manifest → `Cannot find builder "<pkg>:<name>".`
5. **If the entry is a bare string, recurse** — that is the `"application": "@angular/build:application"`
   alias in §0A.3. Guarded against cycles:

```ts
if (seenBuilders?.has(builderStr)) {
  throw new Error('Circular builder alias references detected: ' + [...seenBuilders, builderStr]);
}
```

Then the implementation and the schema are loaded, with three more path-safety errors, verbatim:

```ts
`Package "${packageName}" has an invalid builders manifest path: "${buildersManifestRawPath}"`
`Package "${packageName}" has an invalid builder implementation path: "${builderName}" --> "${builder.implementation}"`
`Package "${packageName}" has an invalid builder schema path: "${builderName}" --> "${builder.schema}"`
```

and finally:

```ts
return Promise.resolve({
  name: builderStr,
  builderName,
  description: builder['description'],
  optionSchema: JSON.parse(schemaText) as json.schema.JsonSchema,
  import: path.join(buildersManifestDirectory, implementationPath),
});
```

🔴 **The `description` a builder shows in `ng run --help` is the string from `builders.json`** —
including `[EXPERIMENTAL]` for `unit-test`.

**Target lookup errors**, from `findProjectTarget` in the same file:

```ts
const projectDefinition = workspace.projects.get(project);
if (!projectDefinition) {
  throw new Error(`Project "${project}" does not exist.`);
}

const targetDefinition = projectDefinition.targets.get(target);
if (!targetDefinition) {
  throw new Error('Project target does not exist.');
}

if (!targetDefinition.builder) {
  throw new Error(`A builder is not set for target '${target}' in project '${project}'.`);
}
```

**What a builder *is*** — the concept quote, verbatim from
`https://angular.dev/tools/cli/cli-builder`:

> *"A number of Angular CLI commands run a complex process on your code, such as building, testing,
> or serving your application. The commands use an internal tool called Architect to run _CLI
> builders_, which invoke another tool (bundler, test runner, server) to accomplish the desired
> task. Custom builders can perform an entirely new task, or to change which third-party tool is
> used by an existing command."*

> *"The internal Architect tool delegates work to handler functions called _builders_. A builder
> handler function receives two arguments: … The `options` object is provided by the CLI user's
> options and configuration, while the `context` object is provided by the CLI Builder API
> automatically."*

> *"The builder handler function can be synchronous (return a value), asynchronous (return a
> `Promise`), or watch and return multiple values (return an `Observable`). The return values must
> always be of type `BuilderOutput`. This object contains a Boolean `success` field and an optional
> `error` field that can contain an error message."*

> *"Angular provides some builders that are used by the CLI for commands such as `ng build` and `ng
> test`. Default target configurations for these and other built-in CLI builders can be found and
> configured in the "architect" section of the [workspace configuration
> file](reference/configs/workspace-config), `angular.json`. Also, extend and customize Angular by
> creating your own builders, which you can run directly using the [`ng run` CLI command](cli/run)."*

The file layout of a custom builder, verbatim table from the same page: `src/my-builder.ts` (*"Main
source file for the builder definition."*), `src/schema.json` (*"Definition of builder input
options."*), `builders.json` (*"Builders definition."*), `package.json`, `tsconfig.json`.

**Which command runs which target**, verbatim from
`https://angular.dev/reference/configs/workspace-config#configuring-builder-targets`:

> *"| `build` | Configures defaults for options of the `ng build` command. |"*
> *"| `serve` | Overrides build defaults and supplies extra serve defaults for the `ng serve` command. Besides the options available for the `ng build` command, it adds options related to serving the application. |"*
> *"| `e2e` | Overrides build defaults for building end-to-end testing applications using the `ng e2e` command. |"*
> *"| `test` | Overrides build defaults for test builds and supplies extra test-running defaults for the `ng test` command. |"*
> *"| `lint` | Configures defaults for options of the `ng lint` command, which performs static code analysis on project source files. |"*
> *"| `extract-i18n` | Configures defaults for options of the `ng extract-i18n` command, which extracts localized message strings from source code and outputs translation files for internationalization. |"*

> *"Other targets can be executed using the `ng run` command, and you can define your own targets."*

> *"HELPFUL: All options in the configuration file must use `camelCase`, rather than `dash-case` as
> used on the command line."*

🔴 **That camelCase rule is a top-five gotcha.** `--output-hashing all` on the command line is
`"outputHashing": "all"` in the file. Because the application schema is
`additionalProperties: false`, `"output-hashing"` is a hard schema failure, not a silent ignore.

### Gotchas seeded here

- **Symptom: `Cannot find builder "@angular-devkit/build-angular:application".`** Cause: the
  package is not installed. In a v22 app it is not installed by default (Chunk 05.02). Fix: use
  `@angular/build:application`.
- **Symptom: `Package "@angular/build" has no builders defined.`** Cause: a corrupted or
  hand-edited install; the `"builders": "builders.json"` field is missing from `package.json`.
- **Symptom: `Project target does not exist.`** Cause: `ng run app:lint` with no `lint` target.
  Note the message does **not** name the target — that terseness is itself worth mentioning.
- **Symptom: `"output-hashing": "all"` in `angular.json` fails validation.** Cause: camelCase.

---

## Chunk 06.04 — `options`, `configurations`, and the merge

🔴 **This is the highest-value chunk in topic 06, because the merge rule is not documented
anywhere on angular.dev and almost everyone assumes the wrong one.**

From
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular_devkit/architect/node/node-modules-architect-host.ts`:

```ts
async getOptionsForTarget(target: Target): Promise<json.JsonObject | null> {
  if (!(await this.workspaceHost.hasTarget(target.project, target.target))) {
    return null;
  }

  let options = await this.workspaceHost.getOptions(target.project, target.target);
  const targetConfiguration =
    target.configuration ||
    (await this.workspaceHost.getDefaultConfigurationName(target.project, target.target));

  if (targetConfiguration) {
    const configurations = targetConfiguration.split(',').map((c) => c.trim());
    for (const configuration of configurations) {
      options = {
        ...options,
        ...(await this.workspaceHost.getOptions(target.project, target.target, configuration)),
      };
    }
  }

  return clone(options) as json.JsonObject;
}
```

**Everything a page needs is in those eighteen lines:**

1. 🔴 **`{ ...options, ...configOptions }` is a *shallow* spread.** A configuration does not merge
   into `options` — for every key it names, it **replaces** the value wholesale.
   - `configurations.production.budgets` **replaces** the whole `options.budgets` array. You
     cannot add one budget in a configuration and keep the base ones.
   - `configurations.development.optimization: false` **replaces** an `options.optimization`
     object entirely, including any `styles`/`fonts` sub-keys you set there.
   - `configurations.staging.assets: [...]` **replaces** the base `assets` array — a very common
     way to accidentally stop copying `public/`.
2. **`defaultConfiguration` is applied when no `--configuration` is given**, and it is looked up on
   the target, not on the workspace. From the generated file (§0B.4): `build` has
   `defaultConfiguration: 'production'`, `serve` has `'development'`.
3. **Comma-separated configurations are applied left to right, later wins**, exactly as the docs
   say:

> *"You can also pass in more than one configuration name as a comma-separated list. For example, to
> apply both `staging` and `french` build configurations, use the command `ng build --configuration
> staging,french`. In this case, the command parses the named configurations from left to right. If
> multiple configurations change the same setting, the last-set value is the final one. In this
> example, if both `staging` and `french` configurations set the output path, the value in `french`
> would get used."*
> — `https://angular.dev/reference/configs/workspace-config#alternate-build-configurations`

4. **An unknown configuration name throws, it does not fall back.** From the same file:

```ts
async getOptions(project, target, configuration) {
  const targetDefinition = findProjectTarget(workspaceOrHost, project, target);

  if (configuration === undefined) {
    return (targetDefinition.options ?? {}) as json.JsonObject;
  }

  if (!targetDefinition.configurations?.[configuration]) {
    throw new Error(
      `Configuration '${configuration}' for target '${target}' in project '${project}' is not set in the workspace.`,
    );
  }

  return (targetDefinition.configurations?.[configuration] ?? {}) as json.JsonObject;
}
```

Verbatim message: `` Configuration '<name>' for target '<target>' in project '<project>' is not set
in the workspace. ``

5. **`options` is optional; `?? {}` covers its absence.** The generated `serve` target has
   `"options": {}` for exactly this reason — it is a placeholder, not configuration.

The docs' complementary statements, verbatim:

> *"Angular CLI comes with two build configurations: `production` and `development`. By default, the
> `ng build` command uses the `production` configuration, which applies several build optimizations,
> including:*
> *- Bundling files*
> *- Minimizing excess whitespace*
> *- Removing comments and dead code*
> *- Minifying code to use short, mangled names"*

> *"The `defaultConfiguration` option specifies which configuration is used by default. When
> `defaultConfiguration` is not set, `options` are used directly without modification."*
> — `https://angular.dev/tools/cli/environments`

> *"Each target also has an `options` section that configures default options for the target, and a
> `configurations` section that names and specifies alternative configurations for the target."*
> — `https://angular.dev/reference/configs/workspace-config#configuring-builder-targets`

> *"Configurations can be applied to any Angular CLI builder. Multiple configurations can be
> specified with a comma separator. The configurations are applied in order, with conflicting
> options using the value from the last configuration."*
> — `https://angular.dev/tools/cli/environments`

**The `serve` → `build` link.** The `serve` target does not re-declare build options; it points at
a build target string. Verbatim from
`https://angular.dev/tools/cli/environments`:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": { },
  "configurations": {
    "development": {
      "buildTarget": "my-app:build:development"
    },
    "production": {
      "buildTarget": "my-app:build:production"
    }
  },
  "defaultConfiguration": "development"
}
```

and the schema's own format string for it: *"A build builder target to serve in the format of
`project:target[:configuration]`. You can also pass in more than one configuration name as a
comma-separated list. Example: `project:target:production,staging`."*

🔴 **So there are two independent configuration selections in play during `ng serve`** — the one
on the `serve` target, and the one embedded in its `buildTarget` string. `ng serve --configuration
production` picks the serve target's `production` entry, which then names
`my-app:build:production`. Getting only one of the two changed is a classic confusion.

### Gotchas seeded here — this chunk should carry the most

- **★ Symptom: you add a `bundle` budget to `configurations.production` and the two default
  budgets stop being enforced.** Cause: shallow merge — the array was replaced, not appended. Fix,
  in code: repeat all three entries in the configuration, or move the shared ones into `options`
  and let production replace them knowingly.
- **★ Symptom: `configurations.development` sets `"optimization": false` and your carefully
  configured `optimization.fonts.inline` in `options` stops applying.** Cause: same rule; the
  boolean replaced the object.
- **Symptom: a `staging` configuration that only sets `outputHashing` also loses `assets`.** It
  does not — only keys the configuration *names* are replaced. Use this to state the rule
  precisely: replacement is per top-level key, not whole-object.
- **★ Symptom: `Configuration 'prod' for target 'build' in project 'my-app' is not set in the
  workspace.`** Cause: the configuration is named `production`. There is no fuzzy matching and no
  fallback to `options`.
- **Symptom: `ng build` behaves as if `--configuration production` was passed.** Cause:
  `defaultConfiguration: "production"` on the generated `build` target.
- **Symptom: `ng serve --configuration production` still serves an unoptimised build.** Cause: the
  `serve` target's `production` entry sets `buildTarget`, and if someone edited only one of the two
  places, the build configuration did not change.

---

## Chunk 06.05 — The generated project, line by line

**Use §0B.4 verbatim as the spine of this chunk.** It is the schematic's own source, so a page
built from it is showing the reader exactly what `ng new` will produce — without pretending to
have run `ng new`.

Say so explicitly on the page: *"the object below is transcribed from the CLI's own application
schematic at `v22.1.7`, not from a terminal."* That sentence is what makes the chunk compliant.

Field-by-field notes to write against it:

| Field | Value | What to say |
|---|---|---|
| `root` | `""` for the first app | Empty because `ng new`'s app sits at the workspace top level (docs' HELPFUL note, §Chunk 02) |
| `sourceRoot` | `src` (or `<root>/src`) | `join(normalize(projectRoot), 'src')` |
| `projectType` | `"application"` | The other value is `"library"`, written by `ng generate library` |
| `prefix` | `"app"` | `options.prefix \|\| 'app'`; feeds `app-root` and every generated selector |
| `schematics` | usually **absent** | Only written when a non-default was chosen (§0B.4's four conditions) |
| `targets.build.builder` | `@angular/build:application` | Topic 05 |
| `targets.build.defaultConfiguration` | `"production"` | Chunk 04 |
| `…options.browser` | `src/main.ts` | The **client entry point**. Was called `main` before the migration |
| `…options.polyfills` | **absent** when `zoneless` | `options.zoneless ? undefined : ['zone.js']`, and `zoneless` defaults to `true` |
| `…options.tsConfig` | `tsconfig.app.json` | The one *required* option of the builder. Topic 07 owns the file |
| `…options.inlineStyleLanguage` | **absent** for CSS | `options?.style !== Style.Css ? options.style : undefined` |
| `…options.assets` | `[{ "glob": "**/*", "input": "public" }]` | Chunk 10. Note: **no `output` key**, so it flattens to the output root |
| `…options.styles` | `["src/styles.css"]` | Chunk 10 |
| `…configurations.production` | `{ budgets, outputHashing: "all" }` | Chunks 08–09 and 11 |
| `…configurations.development` | `{ optimization: false, extractLicenses: false, sourceMap: true }` | Each is a deliberate inversion of a builder default (`true`/`true`/`false`) |
| `targets.serve` | `@angular/build:dev-server`, `defaultConfiguration: "development"` | Topic 05 Chunk 06 |
| `targets.test` | `@angular/build:unit-test`, `options: {}` | Topic 05 Chunk 12; absent with `--skip-tests`/`--minimal` |

🔴 **`configurations.development` is three deliberate inversions.** From §0B.6 the builder defaults
are `optimization: true`, `extractLicenses: true`, `sourceMap: false`. The development
configuration flips all three — and the *reason* it can be that short is that `options` already
carries everything else. Point that out; it is the best available illustration of Chunk 04's rule
in a file the reader already has.

**The library target, for contrast.** `ng generate library` writes a `build` target using
`Builders.BuildNgPackagr` (`@angular/build:ng-packagr`) — read from
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/library/index.ts`
if the chunk wants the full object; the point is that `projectType: "library"` changes the builder,
not the file format.

---

## Chunk 06.06 — What you set and what you never touch

**The premise:** the `application` builder has 44 options (§0B.6) and a generated `angular.json`
sets nine. Nine is the honest answer to "which fields do I actually configure?".

**Scaffolding — written once by a schematic, then never edited by hand:**

`$schema`, `version`, `newProjectRoot`, `projects.<name>.root`, `sourceRoot`, `projectType`,
`prefix`, `targets.build.builder`, `targets.serve.builder`, `targets.test.builder`,
`options.browser`, `options.tsConfig`, `options.styles`, `serve.configurations.*.buildTarget`.

Editing any of these means you are moving files or changing tools, and a schematic almost always
exists to do it for you.

**The live fields — the ones a real project changes, and why:**

| Field | Why you touch it | Chunk |
|---|---|---|
| `budgets` | make CI fail on a size regression | 08, 09 |
| `fileReplacements` | per-environment values | 07 |
| `assets` | copy something extra, or stop copying something | 10 |
| `styles` / `scripts` | a global stylesheet, a third-party script | 10 |
| `outputPath` | a deploy toolchain expects a different layout | 11 |
| `optimization` / `sourceMap` | ship source maps, keep licence comments, disable critical CSS | 12 |
| `proxyConfig` (serve) | talk to a local backend | topic 05 Chunk 06 |
| `allowedCommonJsDependencies` | silence a warning you have decided to accept | topic 05 Chunk 09 |
| `define` / `loader` / `conditions` | build-time values and non-JS imports | topic 05 Chunk 10 |
| `cli.cache` / `cli.packageManager` / `cli.schematicCollections` | workspace policy | 13 |
| a new named `configurations` entry | a staging environment | 04, 07 |

**Never-set-by-hand, actively:** the seventeen builder strings are **not** interchangeable — see
Chunk 03. And `defaultProject` does not exist (§0B.2).

This chunk is where the "Understand"-tier reader gets their payoff: they can now open any
`angular.json` and classify every line.

---

## Chunk 06.07 — `fileReplacements`

**The schema definition, verbatim** from
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json`:

```json
"fileReplacement": {
  "type": "object",
  "properties": {
    "replace": { "type": "string", "pattern": "\\.(([cm]?[jt])sx?|json)$" },
    "with":    { "type": "string", "pattern": "\\.(([cm]?[jt])sx?|json)$" }
  },
  "additionalProperties": false,
  "required": ["replace", "with"]
}
```

with the property description: *"Replace compilation source files with other compilation source
files in the build."*, `"default": []`.

🔴 **The regex is a hard constraint nobody expects: only `.js`, `.jsx`, `.ts`, `.tsx`, `.cjs`,
`.cts`, `.mjs`, `.mts`, `.cjsx`… and `.json`.** You **cannot** file-replace a `.scss`, a `.html`
template, an `.svg` or a `.env`. Decompose the pattern on the page — `[cm]?` is the
CommonJS/ESM prefix, `[jt]` is js-or-ts, `sx?` is the optional JSX suffix — and then state the
consequence: `fileReplacements` is a *TypeScript program* mechanism, which is exactly why the
docs' phrasing is *"replace any file in the TypeScript program"*.

**The docs**, verbatim from `https://angular.dev/tools/cli/environments`:

> *"`@angular/build:application` supports file replacements, an option for substituting source files
> before executing a build. Using this in combination with `--configuration` provides a mechanism
> for configuring environment-specific data in your application."*

> *"The main CLI configuration file, `angular.json`, contains a `fileReplacements` section in the
> configuration for each build target, which lets you replace any file in the TypeScript program
> with a target-specific version of that file. This is useful for including target-specific code or
> variables in a build that targets a specific environment, such as production or staging."*

> *"By default no files are replaced, however `ng generate environments` sets up this configuration
> automatically."*

```shell
ng generate environments
```

```text
my-app/src/environments
├── environment.development.ts
├── environment.staging.ts
└── environment.ts
```

```ts
export const environment = {
  production: true,
  apiUrl: 'http://my-prod-url',
};
```
```ts
export const environment = {
  production: false,
  apiUrl: 'http://my-dev-url',
};
```
```json
"configurations": {
  "development": {
    "fileReplacements": [
      {
        "replace": "src/environments/environment.ts",
        "with": "src/environments/environment.development.ts"
      }
    ]
  }
}
```
```ts
import {environment} from './../environments/environment';

// Fetches from `http://my-prod-url` in production, `http://my-dev-url` in development.
fetch(environment.apiUrl);
```

> *"To use the environment configurations you have defined, your components must import the original
> environments file … This ensures that the build and serve commands can find the configurations for
> specific build targets."*

🔴 **The security note is CRITICAL-flagged in the docs — reproduce it, do not paraphrase:**

> *"CRITICAL: Files in `src/environments/` are bundled into your client-side application and visible
> to anyone who loads the page. Never store secrets such as API keys here. Use a server-side proxy
> or a secrets manager instead."*

**The schematic's own conflict handling**, from
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/environments/index.ts`
— two verbatim log messages worth quoting as backticked phrases:

```ts
const replacements = (configurationOptions['fileReplacements'] ??= []) as {
  replace: string;
  with: string;
}[];
const existing = replacements.find((value) => value.replace === defaultFilePath);
if (existing) {
  if (existing.with === configurationFilePath) {
    yield log('info',
      `Skipping addition of already existing file replacements option for "${defaultFilePath}" to "${configurationFilePath}".`);
  } else {
    yield log('warn',
      `Configuration "${name}" has a file replacements option for "${defaultFilePath}" but with a different replacement.` +
        ` Expected "${configurationFilePath}" but found "${existing.with}". This may result in unexpected build behavior.`);
  }
} else {
  replacements.push({ replace: defaultFilePath, with: configurationFilePath });
}
```

**The modern alternative** — cross-reference topic 05 Chunk 10 and quote the docs' own hint:

> *"HELPFUL: If currently using the `fileReplacements` build option, this feature may be able to
> replace its usage."* — the import/export conditions section of
> `https://angular.dev/tools/cli/build-system-migration`

That is a real design recommendation: `package.json` `"imports"` with `development`/`production`/
`browser` conditions handles the same problem without an `angular.json` edit per environment, and
without the `.ts|.json`-only restriction.

### Gotchas seeded here

- **★ Symptom: `fileReplacements` entry for a `.scss` or `.html` file is rejected by schema
  validation.** Cause: the `\.(([cm]?[jt])sx?|json)$` pattern. Fix: move the varying value into a
  `.ts` file and import it from the stylesheet's component, or use `define`.
- **★ Symptom: the replacement does not happen, but the build succeeds.** Cause: components
  imported the *replacement* file directly (`environment.development.ts`) instead of
  `environment.ts`. The docs say why: you must import the original.
- **Symptom: `ng generate environments` warns
  `Configuration "staging" has a file replacements option for … but with a different replacement.`**
  Cause: a hand-written entry pointing somewhere else. It is a warning; the schematic will not
  overwrite you.
- **Symptom: an API key from `environment.prod.ts` shows up in the shipped bundle.** Cause: it was
  always going to. Quote the CRITICAL note.
- **Symptom: you add a `staging` configuration with `fileReplacements` and lose production's
  budgets.** Cause: nothing to do with `fileReplacements` — it is the Chunk 04 shallow-merge rule
  biting in a new configuration that forgot to repeat them.

---

## Chunk 06.08 — Budgets: the seven types

**The schema definition, verbatim** (`application/schema.json`, `definitions.budget`):

```json
"budget": {
  "type": "object",
  "properties": {
    "type": {
      "type": "string",
      "description": "The type of budget.",
      "enum": ["all", "allScript", "any", "anyScript", "anyComponentStyle", "bundle", "initial"]
    },
    "name":           { "type": "string", "description": "The name of the bundle." },
    "baseline":       { "type": "string", "description": "The baseline size for comparison." },
    "maximumWarning": { "type": "string", "description": "The maximum threshold for warning relative to the baseline." },
    "maximumError":   { "type": "string", "description": "The maximum threshold for error relative to the baseline." },
    "minimumWarning": { "type": "string", "description": "The minimum threshold for warning relative to the baseline." },
    "minimumError":   { "type": "string", "description": "The minimum threshold for error relative to the baseline." },
    "warning":        { "type": "string", "description": "The threshold for warning relative to the baseline (min & max)." },
    "error":          { "type": "string", "description": "The threshold for error relative to the baseline (min & max)." }
  },
  "additionalProperties": false,
  "required": ["type"]
}
```

**Only `type` is required.** A budget with just a type does nothing — it produces no thresholds at
all, because `calculateThresholds` yields only for the keys you set.

**What each type actually measures.** The docs give prose; the source gives the truth. Both, side
by side, because they differ in one important way (see below). Docs, verbatim from
`https://angular.dev/tools/cli/build#configuring-size-budgets`:

> *"| `bundle` | The size of a specific bundle. Use this type together with `name` to budget a
> specific bundle, including a lazy-loaded bundle. |"*
> *"| `initial` | The size of JavaScript and CSS needed for bootstrapping the application. This
> corresponds to the `Initial Total` value shown in the build output summary. Defaults to warning at
> 500kb and erroring at 1mb. |"*
> *"| `allScript` | The size of all scripts. |"*
> *"| `all` | The size of the entire application. |"*
> *"| `anyComponentStyle` | This size of any one component stylesheet. Defaults to warning at 2kb and
> erroring at 4kb. |"*
> *"| `anyScript` | The size of any one script. |"*
> *"| `any` | The size of any file. |"*

Source, from
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/bundle-calculator.ts`
— each calculator is four lines and each is quotable:

```ts
/** The sum of all initial chunks (marked as initial). */
class InitialCalculator extends Calculator {
  calculate() {
    return [{
      label: `bundle initial`,
      size: this.chunks.filter((chunk) => chunk.initial)
        .map((chunk) => this.calculateChunkSize(chunk))
        .reduce((l, r) => l + r, 0),
    }];
  }
}
```
```ts
/** The sum of all the scripts portions. */
class AllScriptCalculator extends Calculator {
  calculate() {
    const size = this.assets.filter((asset) => asset.name.endsWith('.js'))
      .map((asset) => this.getAssetSize(asset))
      .reduce((total: number, size: number) => total + size, 0);

    return [{ size, label: 'total scripts' }];
  }
}
```
```ts
/** All scripts and assets added together. */
class AllCalculator extends Calculator {
  calculate() {
    const size = this.assets
      .filter((asset) => !asset.name.endsWith('.map') && !asset.componentStyle)
      .map((asset) => this.getAssetSize(asset))
      .reduce((total: number, size: number) => total + size, 0);

    return [{ size, label: 'total' }];
  }
}
```
```ts
/** A named bundle. */
class BundleCalculator extends Calculator {
  calculate() {
    const budgetName = this.budget.name;
    if (!budgetName) {
      return [];
    }

    const size = this.chunks
      .filter((chunk) => chunk?.names?.includes(budgetName))
      .map((chunk) => this.calculateChunkSize(chunk))
      .reduce((l, r) => l + r, 0);

    return [{ size, label: this.budget.name }];
  }
}
```

`AnyScriptCalculator` and `AnyCalculator` are the same filters as `allScript`/`all` but return one
entry **per asset** rather than a sum; `AnyComponentStyleCalculator` returns one entry per asset
where `componentStyle` is true.

🔴 **`bundle` with no `name` returns `[]` — a silent no-op.** No error, no warning, no threshold.
That is the single most dangerous budget mistake, because the budget *looks* configured.

🔴 **`all` is not "the entire application" under this builder.** The stats object it is handed is
built by
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/tools/esbuild/budget-stats.ts`,
which filters like this:

```ts
for (const { path: file, size, type } of outputFiles) {
  if (!file.endsWith('.js') && !file.endsWith('.css')) {
    continue;
  }

  // Exclude server bundles
  if (type === BuildOutputFileType.ServerApplication || type === BuildOutputFileType.ServerRoot) {
    continue;
  }
  …
}
```

**Only `.js` and `.css` ever reach the calculators, and server output is excluded.** So `all` and
`any` cover scripts and stylesheets — **not images, not fonts, not the `index.html`** — despite
"the size of the entire application" and "the size of any file". UNSETTLED #7.

**`anyComponentStyle` is measured on the *input* file, from the metafile**, not on an output
bundle — the same file, verbatim:

```ts
// Add component styles from metafile
// TODO: Provide this information directly from the AOT compiler
for (const [file, entry] of Object.entries(metafile.outputs)) {
  if (!file.endsWith('.css')) { continue; }
  // 'ng-component' is set by the angular plugin's component stylesheet bundler
  const componentStyle: boolean = (entry as any)['ng-component'];
  if (!componentStyle) { continue; }

  stats.assets.push({
    // Component styles use the input file
    name: Object.keys(entry.inputs)[0],
    size: entry.bytes,
    componentStyle,
  });
}
```

That is why an `anyComponentStyle` failure names `src/app/foo/foo.scss` and not a hashed bundle.

**Units.** Verbatim from `bundle-calculator.ts`:

```ts
export const BYTES_IN_KILOBYTE = 1000;
```
```ts
function calculateBytes(input: string, baseline?: string, factor: 1 | -1 = 1): number {
  const matches = input.trim().match(/^(\d+(?:\.\d+)?)[ \t]*(%|[kmg]?b)?$/i);
  if (!matches) {
    return NaN;
  }

  const baselineBytes = (baseline && calculateBytes(baseline)) || 0;

  let value = Number(matches[1]);
  switch (matches[2] && matches[2].toLowerCase()) {
    case '%':  value = (baselineBytes * value) / 100; break;
    case 'kb': value *= BYTES_IN_KILOBYTE; break;
    case 'mb': value *= BYTES_IN_KILOBYTE * BYTES_IN_KILOBYTE; break;
    case 'gb': value *= BYTES_IN_KILOBYTE * BYTES_IN_KILOBYTE * BYTES_IN_KILOBYTE; break;
  }

  if (baselineBytes === 0) {
    return value;
  }

  return baselineBytes + value * factor;
}
```

Four facts from that function:

1. 🔴 **`kb` is 1000 bytes, not 1024.** `500kB` is 500 000 bytes.
2. The regex is **case-insensitive** and allows a decimal and optional whitespace: `500kb`,
   `500KB`, `1.5mb`, `"500 kb"` all parse. `gb` parses too, though the docs' table omits it.
3. 🔴 **An unparseable string returns `NaN`, not an error.** `"500 kilobytes"` or `"500k"` produces
   a `NaN` limit, and `size <= NaN` is false and `size >= NaN` is false — so the threshold
   *silently never fires*. There is no validation message. That is the second most dangerous budget
   mistake.
4. `%` is relative to `baseline`, and with no baseline the value is used as-is. The docs' worked
   example, verbatim:

> *"| `123` or `123b` | Size in bytes. |"*
> *"| `123kb` | Size in kilobytes. |"*
> *"| `123mb` | Size in megabytes. |"*
> *"| `12%` | Percentage of size relative to baseline. \(Not valid for baseline values.\) |"*

```json
{
  "type": "bundle",
  "name": "main",
  "baseline": "200kb",
  "maximumWarning": "10%",
  "maximumError": "20%"
}
```

> *"In this example, the builder warns when the bundle grows beyond `220kb` and errors when it grows
> beyond `240kb`."*

**`warning` / `error` are two-sided.** From `calculateThresholds`, verbatim — each yields *both* a
Min and a Max threshold:

```ts
if (budget.warning) {
  yield { limit: calculateBytes(budget.warning, budget.baseline, -1), type: ThresholdType.Min, severity: ThresholdSeverity.Warning };
  yield { limit: calculateBytes(budget.warning, budget.baseline,  1), type: ThresholdType.Max, severity: ThresholdSeverity.Warning };
}
```

So `{"baseline": "200kb", "warning": "10%"}` warns **below 180kb as well as above 220kb** — a
"bundle unexpectedly shrank" alarm. Almost nobody knows this exists; it is a great interview
question.

**Lazy bundles**, verbatim from the docs:

> *"To configure a budget for a lazy-loaded bundle, use `type: "bundle"` and set `name` to that
> bundle's name."*

```json
{
  "budgets": [
    {
      "type": "bundle",
      "name": "admin",
      "maximumWarning": "250kb",
      "maximumError": "300kb"
    }
  ]
}
```

> *"The `name` field matches the bundle name, not the emitted filename, so it does not use wildcard
> or regular expression patterns such as `admin.*.js`."*

And the schema's own one-liner for the whole array: *"Budget thresholds to ensure parts of your
application stay within boundaries which you set."*

**Boundary.** Phase 14 owns *choosing* budget values and bundle analysis. This chunk owns the
field and its mechanics.

---

## Chunk 06.09 — When a budget fails

**The two message templates, verbatim** from `bundle-calculator.ts` — quote them as backticked
inline phrases (they are error text, not program output, and they come from source):

```ts
message: `${label} exceeded maximum budget. Budget ${formatSize(threshold.limit)} was not met by ${sizeDifference} with a total of ${formatSize(size)}.`
```
```ts
message: `${label} failed to meet minimum budget. Budget ${formatSize(threshold.limit)} was not met by ${sizeDifference} with a total of ${formatSize(size)}.`
```

The `label` values, from the calculators in Chunk 08: `bundle initial` for `initial`,
`total scripts` for `allScript`, `total` for `all`, **the budget's `name`** for `bundle`, and the
**asset filename** for `any`/`anyScript`/`anyComponentStyle`.

`formatSize`, verbatim from
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/format-bytes.ts`:

```ts
export function formatSize(size: number): string {
  if (size <= 0) {
    return '0 bytes';
  }

  const abbreviations = ['bytes', 'kB', 'MB', 'GB'];
  const index = Math.floor(Math.log(size) / Math.log(1000));
  const roundedSize = size / Math.pow(1000, index);
  // bytes don't have a fraction
  const fractionDigits = index === 0 ? 0 : 2;

  return `${roundedSize.toFixed(fractionDigits)} ${abbreviations[index]}`;
}
```

So the units in a failure message are `bytes` / `kB` / `MB` / `GB`, base **1000**, two decimals
above bytes. That is enough to describe the shape of the message precisely without inventing a
line of output.

**Error vs warning is a build outcome, not a log level.** From
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/execute-build.ts`:

```ts
// Analyze files for bundle budget failures if present
let budgetFailures: BudgetCalculatorResult[] | undefined;
if (options.budgets) {
  const compatStats = generateBudgetStats(metafile, outputFiles, initialFiles);
  budgetFailures = [...checkBudgets(options.budgets, compatStats, true)];
  for (const { message, severity } of budgetFailures) {
    if (severity === 'error') {
      executionResult.addError(message);
    } else {
      executionResult.addWarning(message);
    }
  }
}
```

🔴 **`maximumError` makes `ng build` fail.** That is the entire reason budgets are worth setting:
they are the only mechanism in the default toolchain that turns a size regression into a red CI
job. Say it, and say the corollary — **a `maximumWarning` alone will be ignored by everyone**, so
if you want the guard to work, set the error threshold.

**Budgets measure raw bytes, not transfer size.** Two independent proofs:

1. `generateBudgetStats` pushes `{ name: file, size }` straight from the output files
   (Chunk 08's snippet). No compression is involved.
2. Estimated transfer sizes are computed **separately and afterwards**, and are never handed to
   the budget checker:

```ts
// Calculate estimated transfer size if scripts are optimized
let estimatedTransferSizes;
if (optimizationOptions.scripts || optimizationOptions.styles.minify) {
  estimatedTransferSizes = await calculateEstimatedTransferSizes(executionResult.outputFiles);
}
```

🔴 **So a 500 kB `initial` budget is 500 000 raw bytes, roughly 130–160 kB over the wire after
gzip** — but do **not** put a specific ratio on the page, it is content-dependent and unmeasurable
here. Say: *"budgets are raw bytes; the transfer size the builder reports separately is a different,
smaller number, and the two are not interchangeable."*

**Also:** `checkBudgets(…, compatStats, true)` — the third argument is `checkComponentStyles`, and
the function's default excludes `anyComponentStyle`:

```ts
// Ignore AnyComponentStyle budgets as these are handled in `AnyComponentStyleBudgetChecker` unless requested
const computableBudgets = checkComponentStyles
  ? budgets
  : budgets.filter((budget) => budget.type !== BudgetType.AnyComponentStyle);
```

The `application` builder passes `true`, so component-style budgets **are** checked there. The
comment refers to the webpack path. Mention it only if a chunk explains the legacy difference.

**The defaults discrepancy — do not resolve it silently.** UNSETTLED #2:

| | `initial` | `anyComponentStyle` |
|---|---|---|
| **angular.dev** says *"Defaults to…"* | warning `500kb`, error `1mb` | warning **`2kb`**, error **`4kb`** |
| **`ng new` (strict, the default) writes** | warning `500kB`, error `1MB` ✅ | warning **`4kB`**, error **`8kB`** ❌ |
| **`ng new --no-strict` writes** | warning `2MB`, error `5MB` | warning `6kB`, error `10kB` |

The `initial` row agrees. The `anyComponentStyle` row does not, in either direction. **A page must
state the generated values (they are what the reader's file contains) and note that angular.dev's
table says something different.**

Also worth saying: **there is no built-in budget at all.** The word "defaults" in the docs means
"what the schematic writes into your file", not "what the builder applies when `budgets` is
absent". The schema's default for `budgets` is `[]`, and `if (options.budgets)` skips the whole
check for an empty array's falsy... — careful: `[]` is truthy in JS, so `checkBudgets` runs over
zero budgets and yields nothing. Either way: no budgets in the file, no enforcement.

### Gotchas seeded here

- **★ Symptom: CI never fails on bundle growth even though budgets are configured.** Causes, in
  order of likelihood: (a) only `maximumWarning` is set; (b) the budgets live in
  `configurations.production` and CI runs `ng build --configuration development`; (c) a `bundle`
  budget with no `name`; (d) a threshold string like `"500 kilobytes"` that parses to `NaN`.
- **★ Symptom: a budget of `"512kb"` behaves as if it were smaller than you expected.** Cause:
  `kb` is 1000 bytes.
- **Symptom: `anyComponentStyle` failure names a `.scss` source file, not a bundle.** Cause: it is
  measured on the metafile input. Not a bug.
- **Symptom: an `all` budget passes even though `public/` contains 4 MB of images.** Cause: only
  `.js` and `.css` reach the calculator.
- **Symptom: an SSR app's `initial` budget is unaffected by a huge server bundle.** Cause: server
  output is excluded by `generateBudgetStats`.
- **Symptom: a budget fires warning you the bundle is *too small*.** Cause: `warning`/`error`
  (rather than `maximumWarning`/`maximumError`) create Min thresholds too.

---

## Chunk 06.10 — `assets`, `styles`, `scripts`

**`assetPattern`, verbatim from `application/schema.json`:**

```json
"assetPattern": {
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "followSymlinks": {
          "type": "boolean",
          "default": false,
          "description": "Allow glob patterns to follow symlink directories. This allows subdirectories of the symlink to be searched."
        },
        "glob":   { "type": "string", "description": "The pattern to match." },
        "input":  { "type": "string", "description": "The input directory path in which to apply 'glob'. Defaults to the project root." },
        "ignore": { "description": "An array of globs to ignore.", "type": "array", "items": { "type": "string" } },
        "output": { "type": "string", "default": "", "description": "Absolute path within the output." }
      },
      "additionalProperties": false,
      "required": ["glob", "input"]
    },
    { "type": "string" }
  ]
}
```

**`glob` and `input` are both required in the object form.** The generated entry
`{ "glob": "**/*", "input": "public" }` omits `output`, which defaults to `""` — i.e. the output
root. That is why `public/favicon.ico` lands at `/favicon.ico`.

The `assets` property description: *"Define the assets to be copied to the output directory. These
assets are copied as-is without any further processing or hashing."*

🔴 **"copied as-is without any further processing or hashing"** — this is the sentence that
answers "why isn't my asset fingerprinted?". `outputHashing: "media"` hashes *media referenced from
CSS*, not files copied through `assets`.

The docs' table, verbatim from
`https://angular.dev/reference/configs/workspace-config#assets-configuration`:

> *"| `glob` | A [node-glob](https://github.com/isaacs/node-glob/blob/main/README.md) using `input` as base directory. |"*
> *"| `input` | A path relative to the workspace root. |"*
> *"| `output` | A path relative to `outDir`. Because of the security implications, the Angular CLI never writes files outside of the project output path. |"*
> *"| `ignore` | A list of globs to exclude. |"*
> *"| `followSymlinks` | Allow glob patterns to follow symlink directories. This allows subdirectories of the symlink to be searched. Defaults to `false`. |"*

> *"Each `build` target configuration can include an `assets` array that lists files or folders you
> want to copy as-is when building your project. By default, the contents of the `public/` directory
> are copied over."*

> *"To exclude an asset, you can remove it from the assets configuration."*

The two worked examples, verbatim (both complete — safe to reproduce):

```json
"assets": [
  { "glob": "**/*", "input": "src/assets/", "output": "/assets/" },
  { "glob": "favicon.ico", "input": "src/", "output": "/" }
]
```
```json
"assets": [
  { "glob": "**/*", "input": "src/assets/", "ignore": ["**/*.svg"], "output": "/assets/" }
]
```

⚠️ Note those use `src/assets/` — the **pre-v17 layout**. A v22 app uses `public/`. Say which is
which; a reader copying the docs' example into a v22 workspace copies a directory that does not
exist.

**`styles` and `scripts`**, verbatim from
`https://angular.dev/reference/configs/workspace-config#styles-and-scripts-configuration`:

> *"An array entry for the `styles` and `scripts` options can be a simple path string, or an object
> that points to an extra entry-point file. The associated builder loads that file and its
> dependencies as a separate bundle during the build. With a configuration object, you have the
> option of naming the bundle for the entry point, using a `bundleName` field."*

> *"The bundle is injected by default, but you can set `inject` to `false` to exclude the bundle from
> injection."*

```json
"styles": [
  { "input": "src/external-module/styles.scss", "inject": false, "bundleName": "external-module" }
],
"scripts": [
  { "input": "src/external-module/main.js", "inject": false, "bundleName": "external-module" }
]
```

Schema descriptions: `styles` — *"Global styles to be included in the build."*; `scripts` —
*"Global scripts to be included in the build."*; both `"default": []`.

Docs' summary rows, verbatim:

> *"| `styles` | An array of CSS files to add to the global context of the project. Angular CLI
> supports CSS imports and all major CSS preprocessors. |"*
> *"| `scripts` | An object containing JavaScript files to add to the application. The scripts are
> loaded exactly as if you had added them in a `<script>` tag inside `index.html`. |"*

🔴 **"loaded exactly as if you had added them in a `<script>` tag"** — `scripts` entries are
**not** part of the module graph. They are not tree-shaken, not type-checked, and cannot be
imported. That distinction is the whole reason the option exists and the whole reason it is
misused.

**`stylePreprocessorOptions`**, verbatim:

> *"In Sass, you can make use of the `includePaths` feature for both component and global styles.
> This allows you to add extra base paths that are checked for imports."*

```json
"stylePreprocessorOptions": {
  "includePaths": ["src/style-paths"]
}
```
```scss
// src/app/app.scss
// A relative path works
@import '../style-paths/variables';

// But now this works as well
@import 'variables';
```

> *"HELPFUL: You also need to add any styles or scripts to the `test` builder if you need them for
> unit tests."*

**`inlineStyleLanguage`**, verbatim from the schema: *"The stylesheet language to use for the
application's inline component styles."*, `"default": "css"`; and from the docs: *"Accepts `css`,
`less`, `sass`, or `scss`, and defaults to `css`."*

### Gotchas seeded here

- **★ Symptom: a file in `public/` is served un-hashed and browsers cache a stale version.**
  Cause: *"copied as-is without any further processing or hashing."* Fix: reference it from CSS so
  `outputHashing: "media"` applies, or version the filename yourself.
- **Symptom: you copy the docs' `"input": "src/assets/"` example and the build errors or copies
  nothing.** Cause: v22 uses `public/`.
- **Symptom: a global script's symbols are `undefined` when imported in a component.** Cause:
  `scripts` entries are `<script>` tags, not modules.
- **Symptom: `@import 'variables'` works in `ng build` and fails in `ng test`.** Cause: the docs'
  HELPFUL note — styles/preprocessor paths must be configured on the test target too.
- **Symptom: an asset with `"output": "../outside"` silently does not appear there.** Cause:
  *"the Angular CLI never writes files outside of the project output path."*

---

## Chunk 06.11 — `outputPath`, `index`, and the shape of `dist`

**`outputPath`, verbatim from `application/schema.json`:**

```json
"outputPath": {
  "description": "Specify the output path relative to workspace root.",
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "base":    { "type": "string", "description": "Specify the output path relative to workspace root." },
        "browser": { "type": "string", "pattern": "^[-\\w\\.]*$", "default": "browser", "description": "The output directory name of your browser build within the output path base. Defaults to 'browser'." },
        "server":  { "type": "string", "pattern": "^[-\\w\\.]*$", "default": "server",  "description": "The output directory name of your server build within the output path base. Defaults to 'server'." },
        "media":   { "type": "string", "pattern": "^[-\\w\\.]+$", "default": "media",   "description": "The output directory name of your media files within the output browser directory. Defaults to 'media'." }
      },
      "required": ["base"],
      "additionalProperties": false
    },
    { "type": "string" }
  ]
}
```

🔴 **The `pattern`s matter.** `browser` and `server` are `^[-\w\.]*$` — a **single path segment**,
and the `*` quantifier means `""` is legal, which is how you flatten `dist/app/browser/` back to
`dist/app/`. `media` is `^[-\w\.]+$` — `+`, so it **cannot** be empty. No slashes in any of them.

The docs' table, verbatim from
`https://angular.dev/reference/configs/workspace-config#output-path-configuration`:

> *"| `base` | Specify the output path relative to workspace root. | `string` | |"*
> *"| `browser` | The output directory name for your browser build is within the base output path.
> This can be safely served to users. | `string` | `browser` |"*
> *"| `server` | The output directory name of your server build within the output path base. |
> `string` | `server` |"*
> *"| `media` | The output directory name for your media files located within the output browser
> directory. These media files are commonly referred to as resources in CSS files. | `string` |
> `media` |"*

Combine with the Known Issue from topic 05 Chunk 09 and you have the full answer to the single most
common post-migration question:

> *"By default, after a successful build by the application builder the bundle is located in a
> `dist/<project-name>/browser` directory (instead of `dist/<project-name>` for the browser
> builder)."*

🔴 **`"browser"` is called out as *"This can be safely served to users"* — the implication being
that the base directory is not.** With SSR, `dist/<app>/server/` sits beside it and contains
server code. Pointing a static host at `dist/<app>/` rather than `dist/<app>/browser/` would expose
it. That is a security-flavoured gotcha worth stating plainly.

**Related output options**, from the schema:

| Option | Default | Description (verbatim) |
|---|---|---|
| `outputHashing` | `"none"` | *"Define the output filename cache-busting hashing mode. - `none`: No hashing. - `all`: Hash for all output bundles. - `media`: Hash for all output media (e.g., images, fonts, etc. that are referenced in CSS files). - `bundles`: Hash for output of lazy and main bundles."* |
| `deleteOutputPath` | `true` | *"Delete the output path before building."* |
| `namedChunks` | `false` | *"Use file name for lazy loaded chunks."* |
| `extractLicenses` | `true` | *"Extract all licenses in a separate file."* |
| `subresourceIntegrity` | `false` | *"Enables the use of subresource integrity validation."* |
| `crossOrigin` | `"none"` | *"Define the crossorigin attribute setting of elements that provide CORS support."* |
| `statsJson` | `false` | *"Generates a 'stats.json' file which can be analyzed with https://esbuild.github.io/analyze/."* |
| `baseHref` | — | *"Base url for the application being built."* |
| `outputMode` | — | *"Defines the type of build output artifact. 'static': Generates a static site build artifact for deployment on any static hosting service. 'server': Generates a server application build artifact, required for applications using hybrid rendering or APIs."* |

⚠️ **`outputHashing` defaults to `"none"` in the *builder*, and `ng new` sets `"all"` only in the
`production` configuration.** So a `staging` configuration that forgets it ships unhashed
filenames. Straight consequence of Chunk 04.

⚠️ **`statsJson` points at `https://esbuild.github.io/analyze/`, not webpack-bundle-analyzer.**
The metafile format changed with the builder. Phase 14 owns the analysis; this chunk owns the flag.

**`index`, verbatim from the schema** — three forms, and the third is easy to miss:

```json
"index": {
  "description": "Configures the generation of the application's HTML index.",
  "oneOf": [
    { "type": "string", "description": "The path of a file to use for the application's HTML index. The filename of the specified path will be used for the generated file and will be created in the root of the application's configured output path." },
    {
      "type": "object",
      "properties": {
        "input":  { "type": "string", "minLength": 1, "description": "The path of a file to use for the application's generated HTML index." },
        "output": { "type": "string", "minLength": 1, "default": "index.html", "description": "The output path of the application's generated HTML index file. The full provided path will be used and will be considered relative to the application's configured output path." },
        "preloadInitial": { "type": "boolean", "default": true, "description": "Generates 'preload', 'modulepreload', and 'preconnect' link elements for initial application files and resources." }
      },
      "required": ["input"]
    },
    { "const": false, "type": "boolean", "description": "Does not generate an `index.html` file." }
  ]
}
```

🔴 **`"index": false` is legal** and produces no `index.html` — for apps embedded in another host
page. And `preloadInitial` (default `true`) is why the generated `index.html` contains
`modulepreload` links nobody wrote.

⚠️ **`index` has no default in the schema, and the generated `angular.json` does not set it** — yet
`ng new` produces `src/index.html` and the build uses it. The schema does not document that
fallback. UNSETTLED #8.

### Gotchas seeded here

- **★ Symptom: a deploy script uploads `dist/my-app/` and the site 404s.** Cause: the browser
  output moved to `dist/my-app/browser/`. Fixes, both in code: point the deploy at `browser/`, or
  `"outputPath": { "base": "dist/my-app", "browser": "" }`.
- **Symptom: `"browser": "public"` is rejected... it is not — but `"browser": "a/b"` is.** Cause:
  `^[-\w\.]*$` forbids slashes.
- **Symptom: hashed filenames in production but not in staging.** Cause: `outputHashing: "all"`
  lives only in the `production` configuration.
- **Symptom: an SSR app's server bundle is publicly downloadable.** Cause: the host was pointed at
  the output *base* instead of `browser/`.
- **Symptom: `stats.json` will not open in webpack-bundle-analyzer.** Cause: it is an esbuild
  metafile.

---

## Chunk 06.12 — `optimization` and `sourceMap`

**`optimization`, verbatim from `application/schema.json`** — reproduce the nested defaults, they
are the whole chunk:

```json
"optimization": {
  "description": "Enables optimization of the build output. Including minification of scripts and styles, tree-shaking, dead-code elimination, inlining of critical CSS and fonts inlining.",
  "default": true,
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "scripts": { "type": "boolean", "description": "Enables optimization of the scripts output.", "default": true },
        "styles": {
          "description": "Enables optimization of the styles output.",
          "default": true,
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "minify":                { "type": "boolean", "description": "Minify CSS definitions by removing extraneous whitespace and comments, merging identifiers and minimizing values.", "default": true },
                "inlineCritical":        { "type": "boolean", "description": "Extract and inline critical CSS definitions to improve first paint time.", "default": true },
                "removeSpecialComments": { "type": "boolean", "description": "Remove comments in global CSS that contains '@license' or '@preserve' or that starts with '//!' or '/*!'.", "default": true }
              },
              "additionalProperties": false
            },
            { "type": "boolean" }
          ]
        },
        "fonts": {
          "description": "Enables optimization for fonts. This option requires internet access. `HTTPS_PROXY` environment variable can be used to specify a proxy server.",
          "default": true,
          "oneOf": [
            {
              "type": "object",
              "properties": {
                "inline": { "type": "boolean", "description": "Reduce render blocking requests by inlining external Google Fonts and Adobe Fonts CSS definitions in the application's HTML index file. This option requires internet access. `HTTPS_PROXY` environment variable can be used to specify a proxy server.", "default": true }
              },
              "additionalProperties": false
            },
            { "type": "boolean" }
          ]
        }
      },
      "additionalProperties": false
    },
    { "type": "boolean" }
  ]
}
```

🔴 **`optimization.fonts` requires internet access at build time.** A build in an air-gapped or
proxy-only CI environment will behave differently from a laptop build, and the schema names
`HTTPS_PROXY` as the escape hatch. That is a genuinely load-bearing, rarely-taught fact.

🔴 **`optimization.scripts` is the flag that decides much more than minification** — it gates the
rolldown chunk optimizer (topic 05 Chunk 04), the CommonJS check (topic 05 Chunk 09), the
transfer-size estimate (Chunk 09 above) and the `production`/`development` import conditions
(topic 05 Chunk 10). Cross-reference all four. It is the most consequential boolean in
`angular.json`.

**`sourceMap`, verbatim:**

```json
"sourceMap": {
  "description": "Output source maps for scripts and styles.",
  "default": false,
  "oneOf": [
    {
      "type": "object",
      "properties": {
        "scripts":        { "type": "boolean", "description": "Output source maps for all scripts.", "default": true },
        "styles":         { "type": "boolean", "description": "Output source maps for all styles.", "default": true },
        "hidden":         { "type": "boolean", "description": "Output source maps used for error reporting tools.", "default": false },
        "vendor":         { "type": "boolean", "description": "Resolve vendor packages source maps.", "default": false },
        "sourcesContent": { "type": "boolean", "description": "Output original source content for files within the source map.", "default": true }
      },
      "additionalProperties": false
    },
    { "type": "boolean" }
  ]
}
```

⚠️ **The outer default is `false`, but every inner default is `true`.** `"sourceMap": {}` therefore
turns source maps **on** for scripts and styles — the opposite of the top-level default. That
asymmetry catches people, and it is provable straight from the schema.

The docs' two operational warnings, verbatim from
`https://angular.dev/reference/configs/workspace-config#source-map-configuration`:

> *"HELPFUL: When using hidden source maps, source maps are not referenced in the bundle. These are
> useful if you only want source maps to map stack traces in error reporting tools without showing
> up in browser developer tools. Note that even though `hidden` prevents the source map from being
> linked in the output bundle, your deployment process must take care not to serve the generated
> sourcemaps in production, or else the information is still leaked."*

> *"You can generate source maps without the `sourcesContent` field, which contains the original
> source code. This allows you to deploy source maps to production for better error reporting with
> original source names while protecting your source code from exposure."*

```json
"sourceMap": { "scripts": true, "styles": true, "sourcesContent": false }
```
```json
"sourceMap": { "scripts": true, "styles": false, "hidden": true, "vendor": true }
```

And the docs' optimization table adds one row the schema words differently — quote whichever you
cite:

> *"| `fonts` | Enables optimization for fonts. This requires internet access. | `boolean` \|
> [Fonts optimization options](#fonts-optimization-options) | `true` |"*

⚠️ **The docs' "You can supply a value such as the following to apply optimization to one or the
other" example is wrong on angular.dev** — the JSON block underneath it shows
`stylePreprocessorOptions`, not `optimization`. Do not copy it. UNSETTLED #9.

### Gotchas seeded here

- **★ Symptom: builds succeed locally and fail (or hang) in a locked-down CI network.** Cause:
  `optimization.fonts.inline` fetches from Google/Adobe. Fix: `"optimization": { "fonts": false }`
  or set `HTTPS_PROXY`.
- **★ Symptom: `"sourceMap": {}` unexpectedly produces `.map` files.** Cause: inner defaults are
  `true`.
- **Symptom: source maps in `dist/` on a production host and your source is readable in
  DevTools.** Cause: `hidden` only unlinks; the docs say the deployment must not serve them. Fix:
  `sourcesContent: false`, plus a deploy step that drops `*.map`.
- **Symptom: a `/*! @license */` banner disappears from a global stylesheet.** Cause:
  `removeSpecialComments`, default `true`.
- **Symptom: disabling minification also changes chunk *count*.** Cause: `optimization.scripts`
  gates the rolldown pass too.

---

## Chunk 06.13 — The `cli` block and workspace-wide defaults

**`cliOptions`, verbatim from the workspace schema:**

```json
"cliOptions": {
  "type": "object",
  "properties": {
    "schematicCollections": { "type": "array", "description": "The list of schematic collections to use.", "items": { "type": "string", "uniqueItems": true } },
    "packageManager": { "description": "Specify which package manager tool to use.", "type": "string", "enum": ["npm", "yarn", "pnpm", "bun"] },
    "warnings": {
      "description": "Control CLI specific console warnings",
      "type": "object",
      "properties": {
        "versionMismatch": { "description": "Show a warning when the global version is newer than the local one.", "type": "boolean" }
      },
      "additionalProperties": false
    },
    "analytics": { "type": ["boolean", "string"], "description": "Share pseudonymous usage data with the Angular Team at Google." },
    "cache": {
      "description": "Control disk cache.",
      "type": "object",
      "properties": {
        "environment": { "description": "Configure in which environment disk cache is enabled.", "type": "string", "enum": ["local", "ci", "all"] },
        "enabled": { "description": "Configure whether disk caching is enabled.", "type": "boolean" },
        "path": { "description": "Cache base path.", "type": "string" }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

⚠️ **The schema's `packageManager` enum is `["npm", "yarn", "pnpm", "bun"]`. angular.dev's table
says `npm | cnpm | pnpm | yarn | bun`.** UNSETTLED #10 — `cnpm` is in the docs and not in the
schema at `v22.1.7`.

The docs' table, verbatim from
`https://angular.dev/reference/configs/workspace-config#angular-cli-configuration-options`:

> *"| `analytics` | Share anonymous usage data with the Angular Team. A boolean value indicates
> whether or not to share data, while a UUID string shares data using a pseudonymous identifier. |
> `boolean` \| `string` | `false` |"*
> *"| `cache` | Control [persistent disk cache](cli/cache) used by [Angular CLI Builders](tools/cli/cli-builder). | Cache options | `{}` |"*
> *"| `schematicCollections` | List schematics collections to use in `ng generate`. | `string[]` | `[]` |"*
> *"| `warnings` | Control Angular CLI specific console warnings. | Warnings options | `{}` |"*
> *"| `versionMismatch` | Show a warning when the global Angular CLI version is newer than the local one. | `boolean` | `true` |"*

**The global-config variant is a different definition.** `cliGlobalOptions` in the same schema has
`schematicCollections`, `packageManager`, `warnings`, `analytics` and:

```json
"completion": {
  "type": "object",
  "description": "Angular CLI completion settings.",
  "properties": {
    "prompted": { "type": "boolean", "description": "Whether the user has been prompted to add completion command prompt." }
  },
  "additionalProperties": false
}
```

and **no `cache`** — caching is a workspace concern, completion is a user concern.

**Precedence: project `cli` beats workspace `cli`.** Proven by
`getConfiguredPackageManager()` in
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/utilities/config.ts`:

```ts
const workspace = await getWorkspace('local');
if (workspace) {
  const project = getProjectByCwd(workspace);
  if (project) {
    result = getPackageManager(workspace.projects.get(project)?.extensions['cli']);
  }

  result ??= getPackageManager(workspace.extensions['cli']);
}
```

**The project-level `cli` is narrower than the workspace-level one.** From the schema's `project`
definition (§0B.3), the only documented key there is `schematicCollections` — and note it is
written *without* a `properties` wrapper in the schema, which is a schema bug rather than a
statement about what is legal. Do not over-read it; say the project `cli` block is for
`schematicCollections` and point at `getConfiguredPackageManager` for `packageManager`.

**`schematics` — workspace and project defaults for `ng generate`.** Verbatim from the docs:

> *"[Angular schematics](tools/cli/schematics) are instructions for modifying a project by adding
> new files or modifying existing files. These can be configured by mapping the schematic name to a
> set of default options."*

> *"The "name" of a schematic is in the format: `<schematic-package>:<schematic-name>`. Schematics
> for the default Angular CLI `ng generate` sub-commands are collected in the package
> [`@schematics/angular`](…). For example, the schematic for generating a component with `ng generate
> component` is `@schematics/angular:component`."*

> *"The fields given in the schematic's schema correspond to the allowed command-line argument
> values and defaults for the Angular CLI sub-command options. You can update your workspace schema
> file to set a different default for a sub-command option."*

```json
{
  "projects": {
    "my-app": {
      "schematics": {
        "@schematics/angular:component": {
          "standalone": false
        }
      }
    }
  }
}
```

The schema's `schematicOptions` definition `$ref`s each schematic's own `schema.json`
(`@schematics/angular:application`, `:class`, `:component`, `:directive`, `:enum`, `:guard`,
`:interceptor`, `:interface`, `:library`, `:pipe`, `:ng-new`, `:resolver`, `:service`,
`:web-worker`) and is `"additionalProperties": true` — **so third-party schematic packages can be
configured here and the schema will not complain.** That `true` is deliberate and is the one place
in the file where unknown keys are welcome.

**`newProjectRoot`**, verbatim: *"Path where new projects will be created."* (schema) and *"Path
where new projects are created through tools like `ng generate application` or `ng generate
library`. Path can be absolute or relative to the workspace directory. Defaults to `projects`"*
(docs). It is written by the workspace template (§0B.5) and read by the application schematic:

```ts
const newProjectRoot = (workspace.extensions.newProjectRoot as string | undefined) || '';
```

### Gotchas seeded here

- **★ Symptom: CI builds do not use the disk cache.** Cause: `cache.environment` defaults to
  `local`. Topic 05 Chunk 11.
- **★ Symptom: `ng serve` prebundling silently stops after someone sets `"cache": { "enabled":
  false }`.** Cause: the `prebundle` schema's own requirement.
- **Symptom: `"packageManager": "cnpm"` is flagged by your editor but the docs list it.** Cause:
  the schema enum omits it. UNSETTLED #10.
- **Symptom: `ng generate component` ignores your workspace `schematics` defaults.** Cause: a
  project-level `schematics` block overrides it; `getProjectByCwd` decides which project you are
  in.
- **Symptom: a stale global CLI keeps warning about a version mismatch.** Cause:
  `warnings.versionMismatch`, default `true`. Fix: fix the versions; disabling the warning is the
  wrong fix, and say so.

---

## Chunk 06.14 — Multi-project workspaces

🔴 **`defaultProject` does not exist.** It is not in the workspace schema (§0B.2), which is
`additionalProperties: false` at the top level and inside `project`. Any config, blog or muscle
memory that uses it is describing ≤ v13.

**What replaced it: resolution by current working directory.** From
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/utilities/config.ts`:

```ts
export function getProjectByCwd(workspace: AngularWorkspace): string | null {
  if (workspace.projects.size === 1) {
    // If there is only one project, return that one.
    return Array.from(workspace.projects.keys())[0];
  }

  const project = findProjectByPath(workspace, process.cwd());
  if (project) {
    return project;
  }

  return null;
}
```

and `findProjectByPath`'s rule, verbatim including its comments:

```ts
const projects = Array.from(workspace.projects)
  .map(([name, project]) => [project.root, name] as [string, string])
  .filter((tuple) => isInside(tuple[0], location))
  // Sort tuples by depth, with the deeper ones first. Since the first member is a path and
  // we filtered all invalid paths, the longest will be the deepest (and in case of equality
  // the sort is stable and the first declared project will win).
  .sort((a, b) => b[0].length - a[0].length);

if (projects.length === 0) {
  return null;
} else if (projects.length > 1) {
  const found = new Set<string>();
  const sameRoots = projects.filter((v) => { … });
  if (sameRoots.length > 0) {
    // Ambiguous location - cannot determine a project
    return null;
  }
}

return projects[0][1];
```

**Four rules, all provable from that:**

1. One project in the workspace → it always wins, wherever you are.
2. Otherwise, every project whose `root` **contains** the cwd is a candidate.
3. The **deepest** root wins; ties break on declaration order.
4. **Two projects with the identical `root` → ambiguous → `null`.**

🔴 **The first app's `root` is `""`, which contains everything.** So in a workspace with the
initial app plus `projects/admin`, standing anywhere outside `projects/admin` resolves to the
initial app — and standing *inside* `projects/admin` resolves to `admin` because its root is
deeper. That is the behaviour people describe as "the CLI guesses"; it is fully deterministic.

**When it cannot decide**, from
`https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/cli/src/command-builder/architect-command-module.ts`
— quote this error in full, it is the most useful string in the chunk:

```ts
throw new CommandModuleError(
  'Cannot determine project for command.\n' +
    'This is a multi-project workspace and more than one project supports this command. ' +
    `Run "ng ${this.command}" to execute the command for a specific project or change the current ` +
    'working directory to a project directory.\n\n' +
    `Available projects are:\n${allProjectsForTargetName.sort().map((p) => `- ${p}`).join('\n')}`,
);
```

The surrounding logic, verbatim, which explains *when* it fires:

```ts
if (allProjectsForTargetName.length === 0) {
  return undefined;
}

if (this.multiTarget) {
  // For multi target commands, we always list all projects that have the target.
  return allProjectsForTargetName;
} else {
  if (allProjectsForTargetName.length === 1) {
    return allProjectsForTargetName;
  }

  const maybeProject = getProjectByCwd(workspace);
  if (maybeProject) {
    return allProjectsForTargetName.includes(maybeProject) ? [maybeProject] : undefined;
  }
  …
}
```

🔴 **`multiTarget` commands run the target in *every* project that has it, sequentially.** From
the same file:

```ts
// This runs each target sequentially.
const projectNames = this.getProjectNamesByTarget(target);
if (!projectNames) {
  return this.onMissingTarget('Cannot determine project or target for command.');
}

for (const project of projectNames) {
  process.title = `${originalProcessTitle} (${project})`;
  result |= await this.runSingleTarget({ configuration, target, project }, architectOptions);
}
```

and the positional argument's own help text: *"The name of the project to build. Can be an
application or a library."*

**`ng run` is the explicit escape hatch.** Format `project:target[:configuration]` — the same
format the `buildTarget` option uses (Chunk 04). Docs, verbatim: *"Other targets can be executed
using the `ng run` command, and you can define your own targets."*

### Gotchas seeded here

- **★ Symptom: `Cannot determine project for command.` on a two-app workspace.** Cause: the cwd
  is not inside any project root, or two projects share a root. Fixes, both real: `ng build
  <project>`, or `cd projects/<app>`.
- **★ Symptom: `ng build` in a monorepo builds the wrong app.** Cause: the initial app's
  `root: ""` contains every path. Fix: name the project explicitly in scripts; never rely on cwd
  in CI.
- **Symptom: someone adds `"defaultProject": "admin"` and the CLI errors on schema validation.**
  Cause: top-level `additionalProperties: false` and the key no longer exists.
- **Symptom: `ng lint` runs across every project when you expected one.** Cause: multi-target
  commands iterate all projects that declare the target.
- **Symptom: two projects with the same `root` — the CLI resolves neither.** Cause: the
  `sameRoots` ambiguity check. Fix: give them distinct roots.

---

## Chunk 06.15 — When `angular.json` is wrong

**This chunk is the topic's error catalogue.** Everything in it is banked above; the job here is to
group the failures by *which layer* produced them, because the layer tells you what to fix.

**Layer 1 — the JSONC reader** (`@angular-devkit/core` `workspace/json/reader.ts`). Fires before
anything else, and its messages have no file/line:

| Message (verbatim) | Cause |
|---|---|
| `Unable to read workspace file.` | file unreadable |
| `Invalid workspace file - expected JSON object.` | top level is not an object, or the JSONC is unparseable |
| `Unknown format - version specifier not found.` | no `version` |
| `Invalid format version detected - Expected:[ 1 ] Found: [ <v> ]` | `version` is not the integer `1` |
| `Project "<name>" is missing a required property "root".` | no `root` |
| `Invalid "projects" field found; expected an object.` | `projects` is an array or scalar |
| `Invalid "<targets\|architect>" field found; expected an object.` | ditto for the targets map |
| `Workspace extension with invalid name (<name>) found.` ⚠️ warning | unknown top-level key not matching `^[a-z]{1,3}-.*` |
| `Project '<p>' contains extension with invalid name (<name>).` ⚠️ warning | ditto at project level |
| `Project property "<name>" should be a string.` ⚠️ warning | `root`/`sourceRoot`/`prefix` is not a string |
| `Skipping invalid project value; expected an object.` ⚠️ warning | a project entry is not an object |
| `Skipping invalid target value; expected an object.` ⚠️ warning | a target entry is not an object |

🔴 **Six of those twelve are warnings, and a warning means the key was silently dropped.** A target
written as a string is not an error — it just does not exist afterwards, and the failure you see is
`Project target does not exist.` from a completely different file. That indirection is worth the
page.

**Layer 2 — Architect resolution** (`node-modules-architect-host.ts`, Chunk 03):
`Project "<p>" does not exist.` · `Project target does not exist.` ·
`A builder is not set for target '<t>' in project '<p>'.` · `No builder name specified.` ·
`Package "<pkg>" has no builders defined.` · `Cannot find builder "<pkg>:<name>".` ·
`Circular builder alias references detected: …` · the three `has an invalid … path` messages ·
`Builder is not a builder`.

**Layer 3 — option schema validation** (`@angular-devkit/core` `json/schema/registry.ts`). This is
where a typo'd option lands. Verbatim:

```ts
constructor(errors?: SchemaValidatorError[], baseMessage = 'Schema validation failed with the following errors:') {
  …
  super(`${baseMessage}\n  ${messages.join('\n  ')}`);
}
```
```ts
const messages = errors.map((err) => {
  let message = `Data path ${JSON.stringify(err.instancePath)} ${err.message}`;
  if (err.params) {
    switch (err.keyword) {
      case 'additionalProperties':
        message += `(${err.params.additionalProperty})`;
        break;

      case 'enum':
        message += `. Allowed values are: ${(err.params.allowedValues as string[] | undefined)
          ?.map((v) => `"${v}"`)
          .join(', ')}`;
        break;
    }
  }

  return message + '.';
});
```

So the shape is `Schema validation failed with the following errors:` followed by indented lines of
`Data path "<json pointer>" <ajv message>(<offending property>).` — and for an enum,
`. Allowed values are: "a", "b".`

**Do not fabricate a full example message.** Describe the template from the source, name the two
special cases (`additionalProperties` appends the offending key; `enum` appends the allowed
values), and let the reader match what they see.

🔴 **`additionalProperties: false` is on both the workspace schema *and* every builder option
schema.** Consequences, each worth its own gotcha:

- A misspelled builder option (`"outputHasing"`) is a **hard failure**, not a no-op.
- A `dash-case` option name is a hard failure (the docs' camelCase HELPFUL note, Chunk 03).
- An option that exists on the `browser` builder but not on `application` (`main`, `vendorChunk`,
  `commonChunk`, `buildOptimizer`, `resourcesOutputPath`, `ngswConfigPath`) is a hard failure
  after migration — the exact list from topic 05 Chunk 08.
- An option that is valid but placed on the wrong target (a build option on `serve`) is a hard
  failure, because the dev-server schema is also `additionalProperties: false` with 19 properties.

**Layer 4 — the command layer** (`architect-command-module.ts`, Chunk 14):
`Cannot determine project for command.` (with the available-projects list) ·
`Cannot determine project or target for command.` ·
`Configuration '<c>' for target '<t>' in project '<p>' is not set in the workspace.` (Chunk 04).

**The diagnostic recipe to close the chunk**, in order — this is the practical payoff of the whole
topic:

1. Does the message name a **data path**? → layer 3, an option is wrong; check the builder's
   schema, and check `camelCase`.
2. Does it name a **builder**? → layer 2; check the `builder` string and whether the package is
   installed.
3. Does it name a **configuration**? → layer 4; check spelling and `defaultConfiguration`.
4. Does it name a **project or target**, or none of the above? → layer 1 or 4; check `root`,
   check the cwd, check that the target is an object.
5. No error at all but the wrong behaviour? → **Chunk 04's shallow merge**, or a layer-1 warning
   you scrolled past.

---

## 99 · UNSETTLED — do not guess these

🔴 **This is the most valuable section in the file.** Each item was attempted once against a
primary source. If a chunk needs one, either settle it yourself and update this list, or write the
sentence as explicitly uncertain. **Twenty pages stating "the documentation does not say" is
correct; twenty pages each inventing a different confident answer is the failure this bank exists
to prevent.**

---

**1. When are the webpack builders removed?**
The v22.0.0 changelog deprecates them in three packages (§0A.4) and names **no removal version**.
The migration guide says *"Applications can temporarily continue to use the `browser` builder"* —
"temporarily" is the strongest word available and it is not a date. I found no deprecation-timeline
document for CLI builders analogous to the framework's deprecation guide.
➡️ **Write:** *"deprecated in v22; the release notes do not state a removal version."* Never
predict v23, v24 or "the next major".

---

**2. 🔴 `anyComponentStyle` default budget — angular.dev and the CLI disagree.**
- `https://angular.dev/tools/cli/build#configuring-size-budgets` says: *"`anyComponentStyle` … 
  Defaults to warning at 2kb and erroring at 4kb."*
- `packages/schematics/angular/application/index.ts` at `v22.1.7` writes, with `strict: true` (the
  default): `{ type: 'anyComponentStyle', maximumWarning: '4kB', maximumError: '8kB' }`; with
  `--no-strict`: `6kB`/`10kB`.
- Neither pair is `2kb`/`4kb`. The `initial` row *does* agree (`500kb`/`1mb` vs `500kB`/`1MB`).
➡️ **Write the generated values** (they are what the reader's file contains), and add: *"angular.dev's
budget table states different `anyComponentStyle` defaults (2kb/4kb); the CLI's application
schematic at v22.1.7 writes 4kB/8kB under the default `strict: true`."* Do not reconcile them.
Also note: **the word "defaults" in that table means "what `ng new` writes", not "what the builder
applies when `budgets` is absent"** — the builder's schema default for `budgets` is `[]`.

---

**3. 🔴 `builderMode` — the migration guide points at an option that no longer exists on the
builder it implies.**
`https://angular.dev/tools/cli/build-system-migration` says: *"Users can opt-in to use the
`application` builder by setting the `builderMode` option to `application` for the `karma` builder.
This option is currently in developer preview."*
At `v22.1.7` I read both karma schemas:
- `packages/angular/build/src/builders/karma/schema.json` — **no `builderMode` property**.
- `packages/angular_devkit/build_angular/src/builders/karma/schema.json` — has it, `enum: ["detect",
  "browser", "application"]`, `default: "browser"`.
➡️ **Write:** *"`builderMode` exists only on the deprecated `@angular-devkit/build-angular:karma`
builder; the `@angular/build:karma` schema at 22.1.7 has no such option."* Do not tell a reader on
`@angular/build` to set it.

---

**4. `architect` and `targets` both present — what actually happens?**
The **schema** forbids it (§0B.3's `anyOf`). The **reader** does not: the `case 'targets': case
'architect':` block reassigns `targets` for whichever key it meets, so the later key in the JSON
object wins (Chunk 06.02). I did **not** verify whether the CLI runs schema validation over
`angular.json` itself on every command, or only over builder *options* — the validation I traced
(`registry.ts`) is invoked for builder option schemas.
➡️ **Write:** *"the schema forbids both; the workspace reader would take whichever appears later.
Whether the CLI validates `angular.json` against its schema on every command was not confirmed —
keep exactly one key."*

---

**5. 🔴 HMR scope — three sources, three different scopes.**
- Migration guide: HMR covers *"global stylesheet"*, *"component stylesheet (inline and file-based)"*
  and *"component template (inline and file-based)"*.
- `dev-server/schema.json` `hmr` description: *"Currently, only global and component stylesheets are
  supported."* (no templates)
- `environment-options.ts`: `NG_HMR_TEMPLATES` defaults to **on** (`!== false`), `NG_HMR_CSTYLES`
  defaults to **off** (`=== true`).
The three are mutually inconsistent, and I could not determine which reflects runtime behaviour at
22.1.7 — the env vars may gate an *additional* path rather than the primary one.
➡️ **Write:** *"the migration guide lists stylesheets and templates; the `hmr` option's own schema
description mentions only stylesheets; the sources disagree and the precise scope at 22.1.7 was not
confirmed."* Then state the safe, agreed part: **general JavaScript HMR is not supported.**

---

**6. Is `@angular/build:unit-test` experimental or the supported default?**
Its `builders.json` description is `"[EXPERIMENTAL] Run application unit tests."` (§0A.2), and
`ng new` writes it as the default `test` target with `runner: vitest` (§0B.4). I did **not** find an
angular.dev page that states its stability level — `adev/src/content/tools/cli/` at `v22.1.5` has no
unit-test page, and the changelog entries for it are `fix`/`feat`, not a stability announcement.
➡️ **Write both facts** — the label and the default — and *"the documentation does not state a
stability level for the `unit-test` builder."* Do not call it stable and do not tell readers to
avoid it.

---

**7. Does `all` / `any` really cover only `.js` and `.css`?**
`generateBudgetStats` at `v22.1.7` pushes assets only for files ending `.js` or `.css`, excluding
server output (Chunk 06.08). The `AllCalculator` then sums those assets minus `.map` and component
styles. So under the `application` builder, `all` cannot include images, fonts or `index.html` —
which contradicts angular.dev's *"The size of the entire application"* and *"The size of any file"*.
I did not find a test or doc confirming this is intended rather than a gap.
➡️ **Write:** *"under the `application` builder, budget stats are generated only for `.js` and
`.css` output and exclude server bundles, so `all`/`any` do not cover images or fonts despite the
documentation's wording."* Cite `budget-stats.ts`.

---

**8. Where does `index` get its value when `angular.json` does not set it?**
The generated project object (§0B.4) sets no `index`, the schema declares no default for it, and
yet a generated app builds an `index.html` from `src/index.html`. The fallback exists somewhere in
`application/options.ts` (which I did not read in full).
➡️ **Write:** *"`index` has no schema default and the generated `angular.json` omits it; the
builder resolves a default index path internally. If you move `index.html`, set `index` explicitly."*
Do not assert the exact fallback path.

---

**9. angular.dev's optimization example block is wrong.**
Under *"You can supply a value such as the following to apply optimization to one or the other:"*
(`https://angular.dev/reference/configs/workspace-config#optimization-configuration`), the JSON that
follows shows `stylePreprocessorOptions: { includePaths: [...] }` — copied from the section above
it, not an `optimization` example at all.
➡️ **Do not reproduce it.** Write your own example from the schema's own property names and
defaults (Chunk 06.12), and note the docs' example is a copy-paste error if the chunk cites that
section.

---

**10. `packageManager` — is `cnpm` supported?**
Schema enum at `v22.1.7`: `["npm", "yarn", "pnpm", "bun"]`. angular.dev's table: *"`npm` \| `cnpm` \|
`pnpm` \| `yarn` \| `bun`"*. `cnpm` is in the docs and not in the schema.
➡️ **Write the schema's four values**, and note the docs list a fifth. Do not tell a reader `cnpm`
works.

---

**11. What the build summary actually prints.**
`initial`'s docs description references *"the `Initial Total` value shown in the build output
summary"*, and `formatSize` tells us the units (`bytes`/`kB`/`MB`/`GB`, base 1000). **I have not
seen a build summary and there is no sandbox.**
➡️ **Never reproduce a build summary table.** You may quote the phrase `Initial Total` as
backticked text sourced from angular.dev, and describe the units from `format-bytes.ts`. No column
layouts, no numbers, no timings.

---

**12. The exact esbuild pipeline stages.**
I read `execute-build.ts`'s comment structure (bundle → dispose → chunk-optimize → external-import
analysis → budgets → transfer sizes → CommonJS check → assets → licenses → i18n → metafile) but did
**not** read `setup-bundling.ts` or `tools/esbuild/angular/` in full.
➡️ **A chunk may name the ordered concerns that appear as comments in `execute-build.ts` and cite
that file.** It may not invent a numbered "how a build works" diagram with stages that file does
not name.

---

**13. Whether `@angular/build`'s `rollup` optional peer is ever used by default.**
`useRolldownChunks` defaults to `true`, so rolldown is the default path; `rollup: "^4.0.0"` remains
an optional peer and `chunk-optimizer.ts` imports `type { Plugin } from 'rollup'` (a type-only
import). Whether setting `NG_BUILD_CHUNKS_ROLLDOWN=0` requires the user to install rollup was not
determined.
➡️ **Write:** *"rolldown is the default since 22.1.0; `rollup` remains an optional peer and the
fallback path's install requirements were not confirmed."*

---

**14. `deployUrl` — supported or not?**
The migration guide says *"`deployUrl` should be removed and is not supported."* The
`application` builder's schema still declares it with a full description
(*"Customize the base path for the URLs of resources in 'index.html' and component stylesheets…"*)
and carries **no** `x-deprecated` marker — I grepped the whole schema for `x-deprecated` and found
none.
➡️ **Write:** *"the migration guide says `deployUrl` is not supported by the `application` builder;
the builder's own schema still declares it, undeprecated. Prefer `<base href>`."* Flag the
contradiction rather than picking a side.

---

## 100 · Found, not fixed — defects outside these two topics

Reported, **not touched**. Three other agents are writing in this checkout.

1. 🔴 **`04-ng-update-not-npm-install/01-why-npm-install-is-not-an-upgrade.md` is 321 lines — 21
   over the hard cap.** Surfaced by the repo's own PostToolUse hook during this session. It is
   topic 04's file and belongs to another agent. **It must be split, not trimmed** (a lettered
   sibling `01b-…`, gotchas and questions redistributed, both `wc -l` and `grep -c '^\*\*★'`
   totals up). Flagging only.

2. **The phase README's one-liner for topic 05 understates v22's status.** Row 05 reads
   *"esbuild for output, Vite for the dev server; Webpack builders are legacy"*. As of v22.0.0 the
   webpack builders are formally **deprecated** in `@angular-devkit/build-angular`,
   `@angular-devkit/build-webpack` and `@ngtools/webpack` (§0A.4). "Legacy" is not wrong, but the
   page written from this bank will say "deprecated", and the README row should follow when topic
   05 lands and the row becomes a link. **Not changed** — the README is shared and other agents are
   editing it.

3. **`03-the-provider-array/05c-the-redundant-opt-in-and-ng0408.md` uses `architect` in its
   `angular.json` example** (lines ~151–166) while topic 06 will teach `targets` as the current
   name and `architect` as the legacy alias. Both are valid and the CLI preserves whichever you
   use, so this is **not an error** — but if the corpus wants one house style in JSON examples,
   `targets` is the one the v22 schematic writes. Flagging for consistency only; **do not edit
   another topic's page for style** (S5 in the severity ladder is ledger-only).

4. **angular.dev has three defects that this bank routes around**, listed as UNSETTLED #2, #3 and
   #9: the `anyComponentStyle` budget defaults, the `builderMode` instruction, and the
   copy-pasted optimization example. Worth an upstream issue if anyone is inclined; not our
   corpus's problem to fix, only to not propagate.

---

*Banked 2026-09-09. `angular/angular-cli` `v22.1.7` · `angular/angular` `v22.1.5` ·
registry.npmjs.org. No sandbox. **Do not re-derive** — extend in place.*
