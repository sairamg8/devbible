---
title: "Eight options change when you convert to the `application` builder — five vanish, three are renamed, and the one the migration guide says is unsupported is still declared in the builder's own schema"
sidebar_label: "08b · The option renames"
sidebar_position: 8.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration)
> (every quoted list below is verbatim from that page), cross-checked against
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> at tag `v22.1.7`.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The rename list is the whole of a manual conversion to `application`, and the schema is
`additionalProperties: false` — so every option you miss is a hard error rather than a warning.**
That is genuinely helpful: work the list in one pass and the build tells you when you are done. What
it will not tell you is the case where the documentation and the schema disagree, which is exactly
one option long and is at the end of this page. The path decision that gets you here is
[08 · Migrating off webpack](08-migrating-off-webpack.md).

## The eight option renames

Going to `application` by hand means applying this list. It is verbatim, with the two links inside
it resolved to absolute angular.dev URLs — inside a quote, a relative href belongs to the site being
quoted:

> *"- `main` should be renamed to `browser`.*
> *- `polyfills` should be an array, rather than a single file.*
> *- `buildOptimizer` should be removed, as this is covered by the `optimization` option.*
> *- `resourcesOutputPath` should be removed, this is now always `media`.*
> *- `vendorChunk` should be removed, as this was a performance optimization which is no longer needed.*
> *- `commonChunk` should be removed, as this was a performance optimization which is no longer needed.*
> *- `deployUrl` should be removed and is not supported. Prefer [`<base href>`](https://angular.dev/guide/routing/router-reference#base-href) instead. See [deployment documentation](https://angular.dev/tools/cli/deployment#--deploy-url) for more information.*
> *- `ngswConfigPath` should be renamed to `serviceWorker`."*

Two of them are corroborated directly by the `application` schema, which is worth knowing because
the schema is what actually rejects your file: `polyfills` is `"type": "array"` with `"default": []`
and is described as *"A list of polyfills to include in the build. Can be a full path for a file,
relative to the current workspace or module specifier. Example: 'zone.js'."*; `serviceWorker` is
`string | false`, *"Path to ngsw-config.json."*

As a before-and-after on the four that change shape rather than disappearing:

```json
{
  "builder": "@angular-devkit/build-angular:browser",
  "options": {
    "main": "src/main.ts",
    "polyfills": "src/polyfills.ts",
    "buildOptimizer": true,
    "vendorChunk": false,
    "ngswConfigPath": "ngsw-config.json"
  }
}
```

```json
{
  "builder": "@angular/build:application",
  "options": {
    "browser": "src/main.ts",
    "polyfills": ["zone.js"],
    "serviceWorker": "ngsw-config.json"
  }
}
```

🔴 **`deployUrl` is the one to be careful about, because the two sources disagree.** The migration
guide says it *"is not supported"*. The `application` builder's own schema still declares it, with a
full description — *"Customize the base path for the URLs of resources in 'index.html' and component
stylesheets. This option is only necessary for specific deployment scenarios, such as with Angular
Elements or when utilizing different CDN locations."* — and **no `x-deprecated` marker anywhere in
the schema**. This corpus flags the contradiction rather than picking a side. The safe reading:
prefer `` `<base href>` ``, and do not build a deployment on `deployUrl` while the documentation
says it is unsupported.

## If you server-render

> *"HELPFUL: Remember to remove any CommonJS assumptions in the application server code if using
> SSR such as `require`, `__filename`, `__dirname`, or other constructs from the [CommonJS module
> scope](https://nodejs.org/api/modules.html#the-module-scope). All application code should be ESM
> compatible. This does not apply to third-party dependencies."*

> *"The `ng update` process will automatically remove usages of the `@nguniversal` scope packages
> where some of these builders were previously located. The new `@angular/ssr` package will also be
> automatically added and used with configuration and code being adjusted during the update. The
> `@angular/ssr` package supports the `browser` builder as well as the `application` builder."*

Note the last clause: `@angular/ssr` works with **both** builders, so adopting it is not gated on
finishing the migration.

And the dev server needs nothing from you:

> *"The development server will automatically detect the new build system and use it to build the
> application. To start the development server no changes are necessary to the `dev-server` builder
> configuration or command line."*

## Gotchas

**★ Symptom: you changed the builder string to `@angular/build:application` and `ng build` errors
that `main` is not an allowed property.** Cause: the `application` schema sets
`additionalProperties: false`, and the option is now called `browser`. Fix: rename it, and work the
whole list above in one pass rather than one error at a time:

```json
{ "options": { "browser": "src/main.ts" } }
```

**★ Symptom: `"polyfills": "src/polyfills.ts"` is rejected as the wrong type.** Cause: `polyfills`
became an array of file paths or module specifiers. Fix: wrap it, and note the idiomatic value is
usually the bare specifier rather than a file:

```json
{ "options": { "polyfills": ["zone.js"] } }
```

**★ Symptom: SCSS `@import '~some-lib/styles'` stops resolving after the switch.** Cause: the tilde
and caret prefixes were webpack loader syntax, not Sass. Fix: drop the prefix and let normal
resolution find it — the automated migration does this for you, a manual one must:

```scss
@use 'some-lib/styles';
```

**★ Symptom: SSR server code fails with `__dirname is not defined` after migrating.** Cause: the
output is ESM, and `require`, `__filename` and `__dirname` are CommonJS module scope. Fix: use the
ESM equivalents in your own server code — third-party dependencies are unaffected:

```ts
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
```

**★ Symptom: you removed `deployUrl` because the migration guide said it is unsupported, and your
CDN deployment broke.** Cause: the guide and the schema disagree — the option is still declared and
undeprecated on the `application` builder. Fix: move the deployment to `` `<base href>` ``, which is
what the guide points at, rather than relying on an option one source calls unsupported.

**★ Symptom: `resourcesOutputPath` was ignored and your assets moved.** Cause: it is removed, and
the location is now always `media`. Fix: expected — update whatever referenced the old path rather
than trying to configure it back.

**★ Symptom: bundle names changed and a deployment script that globbed `vendor.*.js` finds
nothing.** Cause: `vendorChunk` and `commonChunk` are gone; the chunking is no longer expressed
that way. Fix: stop matching on chunk names. If a script needs to know what was emitted, read the
build output directory rather than guessing filenames.

**★ Symptom: after migrating an SSR app, `express` imports fail at runtime.** Cause: CommonJS
interop. The automated migration adds `"esModuleInterop": true` when it merges
`tsconfig.server.json` into `tsconfig.app.json`; a manual migration has to do both. Fix:

```jsonc
// tsconfig.app.json
{ "compilerOptions": { "esModuleInterop": true } }
```

## Interview questions

**★ Which options change when you move to the `application` builder?**
Eight. `main` becomes `browser`; `polyfills` becomes an array; `ngswConfigPath` becomes
`serviceWorker`; and `buildOptimizer`, `resourcesOutputPath`, `vendorChunk`, `commonChunk` and
`deployUrl` are removed — the first because `optimization` covers it, the second because the path is
always `media` now, the two chunk flags because the optimization they expressed no longer applies,
and `deployUrl` because the guide says it is unsupported. The schema is
`additionalProperties: false`, so a leftover option is a hard error rather than a warning, which is
actually helpful: you find all of them in one build.

**What does `deployUrl` illustrate about reading Angular's documentation?**
That the guide and the schema are separate artefacts and can disagree. The migration guide says
`deployUrl` *"should be removed and is not supported"*; the `application` builder's schema declares
it with a full description and carries no deprecation marker anywhere. Neither source is obviously
stale. The correct move is to name the contradiction and act on the conservative reading — use
`` `<base href>` `` — rather than to pick whichever source supports what you wanted to do.

**Why does an SSR migration require touching your own server code, when a client-only one usually
does not?**
Because the output is ESM and the old server code was written for CommonJS module scope — `require`,
`__filename`, `__dirname`. Those are not polyfilled, and the guide is explicit that the requirement
applies to your application code and not to third-party dependencies. The automated migration
handles the bootstrapping and output-structure changes and adds `esModuleInterop`, but constructs in
your own server file are yours to convert.

**★ Why is `additionalProperties: false` on the builder schema a good thing during a migration?**
Because it converts a silent problem into a loud one. A schema that ignored unknown keys would let
`buildOptimizer` or `vendorChunk` sit in your config doing nothing, and you would discover months
later that an option you believed was set has never applied. Failing the build names the leftover
option immediately, and because the check is exhaustive you find every one of them in a single run
rather than one build at a time.

---

← Prev: [Migrating off webpack](08-migrating-off-webpack.md) · Index: [Topic index](README.md) · Next → [What breaks when you switch](09-what-breaks-when-you-switch.md)
