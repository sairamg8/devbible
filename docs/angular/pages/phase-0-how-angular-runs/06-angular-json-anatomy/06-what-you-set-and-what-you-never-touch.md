---
title: "The `application` builder declares forty-odd options and your generated `angular.json` sets nine of them — everything else is a default you have been shipping on without ever seeing it"
sidebar_label: "06 · What you set, what you never touch"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> and [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts)
> at tag `v22.1.7`; cross-checked against
> [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The honest answer to "which fields in `angular.json` do I configure?" is nine, and you can count
them without leaving the file.** The rest of this page is the inventory those nine sit in, and the
one schema property — `additionalProperties: false` — that decides whether a mistake in it is a
loud failure or a silent one. Which of the nine are scaffolding is
[06b](06b-scaffolding-you-do-not-edit.md); which fields a real project actually reaches for is
[06c](06c-the-fields-a-real-project-changes.md).

## The nine, counted out of your own file

A generated `build` target names exactly nine distinct builder options across `options` and both
configurations:

| Where | Options named |
|---|---|
| `options` | `browser`, `tsConfig`, `assets`, `styles` |
| `configurations.production` | `budgets`, `outputHashing` |
| `configurations.development` | `optimization`, `extractLicenses`, `sourceMap` |

That is the whole of what `ng new` decides on your behalf about the build. Every other behaviour —
ahead-of-time compilation, licence extraction in production, output-directory deletion, CommonJS
warnings, service-worker absence, i18n diagnostics — comes from a schema default that is never
written down in your workspace.

🔴 **The practical consequence: reading `angular.json` tells you what is *different*, never what is
*happening*.** To know what a build does you need this file **and** the builder's schema. That is
the single most useful habit this topic can leave you with.

## The option inventory

The full top-level property list of the `application` builder, with the default each property
declares in its schema. `—` means the schema declares no default; see
[05e](05e-the-keys-that-are-not-there.md) for what that implies.

| Option | Type | Schema default |
|---|---|---|
| `tsConfig` | string | — (**the only required option**) |
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

⚠️ **The exact total is not asserted here.** Counting the rows above gives 46; an earlier reading of
the same schema recorded 44, and the discrepancy was not resolved against the file. Nothing on this
page depends on the total — the ratio does, and nine out of forty-odd is the same argument either
way.

## One required option, and it is not the one you would guess

The schema's header is short and load-bearing:

```json
{
  "title": "Application schema for Build Facade.",
  "required": ["tsConfig"],
  "additionalProperties": false
}
```

🔴 **`tsConfig` is the only required option.** Not `browser`, not `outputPath`, not `index`. A
target consisting of a builder string and `{"tsConfig": "tsconfig.app.json"}` is a valid
configuration as far as the schema is concerned. That is a real statement about Angular's build:
the TypeScript program is the input, and everything else — the entry point, the output location,
the assets — has either a default or a fallback. The file `tsConfig` points at is topic 07's
subject.

## `additionalProperties: false` is why a typo is loud

The same header line decides how mistakes surface. Because the schema rejects unknown properties,
`"styless": []` or `"outputpath": "dist"` is a **build failure naming the property**, not a key
that sits in your file doing nothing.

That is worth appreciating rather than resenting. The alternative — a permissive schema — produces
the worst class of configuration bug there is: an option you believe is set, that has never once
been read, discovered months later when the behaviour it was supposed to produce turns out never to
have happened. Angular chose the loud failure, and it makes a migration tractable because you find
every leftover option in one build rather than one at a time
([08b](../05-the-build-angular-build/08b-the-option-renames.md)).

The same strictness applies at the workspace level: the top-level schema is also
`additionalProperties: false`, with a narrow escape hatch for third-party keys that is
**02 · `projects` and the project object**.

## Gotchas

**★ Symptom: you cannot find the option that controls some behaviour anywhere in `angular.json`, so
you conclude Angular does not support configuring it.** Cause: the file records deviations from
defaults, not the defaults themselves — thirty-odd options are active on every build and written
nowhere. Fix: read the builder's schema for the version you are on, then write the option in
explicitly:

```json
{ "options": { "tsConfig": "tsconfig.app.json", "namedChunks": true } }
```

**★ Symptom: a hand edit that misspells an option — `styless`, `outputpath` — fails the build with
a schema-validation error naming that property.** Cause: `additionalProperties: false` — an unknown
key is rejected rather than ignored. Fix: correct the spelling; because the validator names the
offending property there is nothing to hunt for:

```json
{ "options": { "styles": ["src/styles.css"] } }
```

**★ Symptom: a build target with no `browser` option builds anyway, and someone assumes the file is
corrupt.** Cause: `browser` is not required; only `tsConfig` is. A server-only or library-shaped
build legitimately has no browser entry point. Fix: nothing — but if you meant to have a browser
build, the missing key is the bug:

```json
{ "options": { "tsConfig": "tsconfig.app.json", "browser": "src/main.ts" } }
```

**★ Symptom: two developers get different build behaviour from the same `angular.json`.** Cause:
the file does not fully determine the build — a CLI version difference changes schema defaults, and
a different `--configuration` changes which of the nine apply. Fix: pin the CLI in
`package.json` and make CI name the configuration explicitly rather than relying on
`defaultConfiguration`:

```bash
ng build --configuration production
```

**Symptom: an option is set in `options` and has no effect in the configuration you actually
build.** Cause: a configuration replaces the value of any key it names; if the configuration names
the same key, the base value is gone. Fix: check `configurations.<name>` before concluding an
option is broken — the rule is **04 · `options` and `configurations`**:

```json
{
  "options": { "sourceMap": true },
  "configurations": { "production": { "sourceMap": { "scripts": true, "hidden": true } } }
}
```

**Symptom: an option copied from a blog post is rejected outright.** Cause: it belongs to a
different builder. Options are validated against the schema of the builder named in the target, and
`@angular-devkit/build-angular:browser` had options the `application` builder does not. Fix: check
the builder string first, then the option list for *that* builder:

```json
{ "targets": { "build": { "builder": "@angular/build:application" } } }
```

**Symptom: `deployUrl` appears in the option inventory but the migration guide says it is not
supported.** Cause: the two sources disagree — the migration guide says it *"should be removed and
is not supported"*, while the builder's schema still declares it with a full description and no
deprecation marker. This corpus flags the contradiction rather than picking a side. Fix: prefer
`` `<base href>` ``, which is what the guide points at:

```html
<base href="/app/">
```

**Symptom: you add an option under the project object rather than under `options` and it is
silently ignored, or the file fails to parse.** Cause: builder options live at
`projects.<name>.targets.<target>.options`; the project object accepts a fixed set of keys. Fix:
nest it correctly:

```json
{
  "projects": {
    "my-app": {
      "targets": { "build": { "options": { "aot": true } } }
    }
  }
}
```

## Interview questions

**★ How many options does a generated `angular.json` actually set, and why does the number
matter?**
Nine, across the `build` target: `browser`, `tsConfig`, `assets` and `styles` in `options`;
`budgets` and `outputHashing` in `configurations.production`; `optimization`, `extractLicenses` and
`sourceMap` in `configurations.development`. The number matters because it reframes what the file
is. `angular.json` is not a description of your build — it is a **diff against the builder's
defaults**. Anything not in it is still happening, from ahead-of-time compilation to output
directory deletion, and you will not find out which by reading the file.

**★ Which option is required by the `application` builder, and what does that tell you about the
build?**
`tsConfig`, and nothing else — the schema's `required` array has exactly one member. It says the
TypeScript program is the build's real input. The entry point, the output path and the index file
all have defaults or internal fallbacks, but there is no build at all without a tsconfig, because
the compiler pass is not an optional stage bolted onto a bundler — it is the thing being run.

**★ Why is `additionalProperties: false` on the builder schema a good thing rather than an
annoyance?**
Because it converts the worst class of configuration bug into the best. A permissive schema lets a
misspelled or obsolete key sit in your file being ignored, and you discover months later that an
option you believed was set had never been read. Rejecting unknown properties means the mistake
fails the build immediately and names the property, and because the check is exhaustive you find
every leftover option in a single run — which is precisely what makes a builder migration a
one-pass job.

**How would you determine what a colleague's build actually does, given their `angular.json`?**
Two artefacts, not one. Read `angular.json` for the deviations, then read the schema of the builder
named in the target — at their CLI version, since defaults move between majors — for everything
else. Then work out which configuration will apply: `defaultConfiguration` if no flag is passed,
and remember that a configuration replaces the value of every key it names. Any answer that stops
at "read `angular.json`" has seen nine values out of forty-odd.

**Why do options from a blog post so often fail validation?**
Because options are validated against the schema of the builder named in that specific target, and
Angular has two builder namespaces with overlapping but non-identical option sets. Anything written
against `@angular-devkit/build-angular:browser` may name options the `application` builder never
declared, and `additionalProperties: false` rejects them outright. Before evaluating any advice
about `angular.json`, check which builder string it assumed.

**What is the difference between an option that is absent and an option set to its default?**
Behaviourally, nothing — the schema default is applied either way. Editorially, quite a lot. An
explicitly written default is a statement that someone considered the question and chose that
value, and it survives a change to the default in a future major. An absent key inherits whatever
the builder decides next version. For a value your deployment depends on, writing it out is
insurance against a silent change; for everything else it is noise.

---

← Prev: [The keys that are not there](05e-the-keys-that-are-not-there.md) · Index: [Topic index](README.md) · Next → [The scaffolding half](06b-scaffolding-you-do-not-edit.md)
