---
title: "Half of what a v17 tutorial shows in `angular.json` is absent from a v22 file, and every one of those absences is a schematic branch evaluating to `undefined` rather than something you lost"
sidebar_label: "05e · The keys that are not there"
sidebar_position: 5.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [`packages/schematics/angular/application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts),
> [`packages/schematics/angular/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/schema.json)
> and [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> at tag `v22.1.7`. Schematic option defaults and builder option defaults are both read from those
> schemas; where a default is not declared, this page says so rather than guessing.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The most common way to misread `angular.json` is to treat an absent key as a missing key.** It is
almost never missing. It is either a schematic branch that evaluated to `undefined` — in which case
the builder's own schema default applies — or an option nobody has ever needed to set. Both look
identical in the file, and neither is damage. This page names the branches, gives the defaults that
fill the gaps, and explains why a tutorial's `angular.json` and yours differ so much.

## `undefined` is an absent key, not a `null`

Two of the assignments in the generated object
([05](05-the-generated-project-line-by-line.md)) evaluate to `undefined` under v22's defaults:

```ts
polyfills: options.zoneless ? undefined : ['zone.js'],
```

```ts
const inlineStyleLanguage = options?.style !== Style.Css ? options.style : undefined;
```

An `undefined` property is dropped when the object is serialised to JSON. It does not become
`null`, and it does not become an empty array — **the key is simply not written.** The builder then
applies its own schema default: `[]` for `polyfills`, `"css"` for `inlineStyleLanguage`. The
behaviour is identical to having written those values by hand.

The same mechanism removes an entire target: `test` is a conditional whose false branch is
`undefined`, so `--skip-tests` and `--minimal` produce a project object with **two** targets rather
than three.

🔴 **`null` is not a synonym.** `"polyfills": null` fails schema validation, because the option is
declared as an array. The schematic's way of "not setting" something is omission, and yours has to
be too.

## The flags that select the branches

Six values in the generated object are conditional. The conditions read `options.*`, and those come
from the application schematic's own `schema.json` at `v22.1.7`:

| Schematic option | Default at 22.1.7 | What it changes in the generated object |
|---|---|---|
| `strict` | **`true`** | selects the strict budget pair written into `configurations.production` |
| `zoneless` | **`true`** | `polyfills` becomes `undefined` → **the key is absent** |
| `style` | `"css"` | `styles: ["src/styles.css"]`, and `inlineStyleLanguage` is `undefined` → absent |
| `testRunner` | **`"vitest"`** | `test.options` is `{}`; with `karma` it is `{ "runner": "karma" }` |
| `prefix` | `"app"` | the `prefix` key |
| `skipTests` / `minimal` | `false` | whether the `test` target exists at all |
| `standalone` | `true` | nothing in `angular.json` — it writes into `schematics` only when `false` |
| `routing` | `true` | nothing in `angular.json` |
| `ssr` | `false` | nothing in `angular.json` — the `ssr` schematic adds its keys separately |
| `fileNameStyleGuide` | `"2025"` | nothing in `angular.json` unless set to `"2016"` |

Four of those rows say *"nothing in `angular.json`"*, and that is worth internalising: **most of
what `ng new --help` offers does not appear in this file at all.** It appears in the generated
source tree, which is topic 08's subject.

## Absent does not mean unset — the defaults that fill the gaps

A generated `build` target sets four `options`. The `application` builder declares 44. The ones
whose absence people most often misread, with the default the builder's own schema declares:

| Option, absent from a generated file | Schema default | So the generated build actually… |
|---|---|---|
| `aot` | `true` | compiles ahead of time, in every configuration |
| `polyfills` | `[]` | ships no polyfills — this is the zoneless default |
| `inlineStyleLanguage` | `"css"` | treats inline component styles as CSS |
| `budgets` | `[]` | enforces nothing outside `configurations.production` |
| `fileReplacements` | `[]` | replaces nothing until you add an entry |
| `optimization` | `true` | optimises, except where `development` turns it off |
| `sourceMap` | `false` | emits no source maps, except in `development` |
| `outputHashing` | `"none"` | does not hash, except in `production` |
| `extractLicenses` | `true` | extracts licences, except in `development` |
| `deleteOutputPath` | `true` | clears the output directory before each build |
| `namedChunks` | `false` | emits numeric chunk names |
| `serviceWorker` | `false` | builds no service worker |
| `ssr` | `false` | builds no server bundle |
| `statsJson` | `false` | writes no `stats.json` |
| `scripts` | `[]` | injects no global scripts |
| `externalDependencies` | `[]` | bundles everything |
| `allowedCommonJsDependencies` | `[]` | warns about every CommonJS dependency it finds |

🔴 **The last four rows in the middle of that table — `optimization`, `sourceMap`,
`outputHashing`, `extractLicenses` — are exactly the ones the generated configurations override.**
That is not a coincidence: a configuration exists to invert a default, so the options a
configuration names are, by construction, the ones absent from `options`.

## `index` and `outputPath` are absent, and their defaults are not in the schema

Two keys are conspicuously missing from a generated file even though every build clearly uses them.
The generated project object sets neither `index` nor `outputPath`, and **the builder's schema
declares no default for either.** A generated application nonetheless builds an `index.html` from
`src/index.html` and writes into a `dist` directory, so the fallback is resolved inside the builder
rather than declared in the schema.

⚠️ **The exact fallback path could not be confirmed from the schema or from angular.dev**, and this
page will not guess at it. The operational consequence is the part that matters and it is certain:
**if you move `index.html`, set `index` explicitly** rather than assuming a convention holds. The
shapes both options accept are **11 · `outputPath`, `index`, and the shape of `dist`**.

## Why a v17 tutorial's file looks so different

A file generated two majors ago and a file generated today differ by more than a version bump, and
almost all of the difference is absence:

- `polyfills` was `"src/polyfills.ts"`, then `["zone.js"]`, and is now **gone** — `zoneless`
  defaults to `true`.
- `main` became `browser`, one of eight option renames the `application` builder brought with it
  ([08b](../05-the-build-angular-build/08b-the-option-renames.md)).
- `"builder": "@angular-devkit/build-angular:browser"` became `"@angular/build:application"`.
- A per-project `schematics` block is no longer written, because `standalone` and the 2025 naming
  style guide are the defaults.
- `test` names `@angular/build:unit-test` with `{}` rather than a karma builder with a
  `karmaConfig` path.

None of that is repairable damage, and copying the missing lines back in from a tutorial is how a
working file stops working. If a tutorial's step depends on a key you do not have, the question to
ask is *which default replaced it*, not *what did I lose*.

## Gotchas

**★ Symptom: a tutorial's `angular.json` has keys yours does not, and you conclude your generation
was broken.** Cause: several keys are conditional in the schematic and evaluate to `undefined`
under v22's defaults, so they are never serialised. Fix: nothing to repair — set a key explicitly
only if you actually want a non-default, which is a different statement from restoring what was
lost:

```json
{ "options": { "polyfills": ["zone.js"], "inlineStyleLanguage": "scss" } }
```

**★ Symptom: you set `"polyfills": null` to "explicitly disable" it and the build fails schema
validation.** Cause: `polyfills` is declared as an array; omission is how the schematic expresses
"not set", and `null` is not a member of the declared type. Fix: delete the key, or write the empty
array:

```json
{ "options": { "polyfills": [] } }
```

**★ Symptom: you generated with `--skip-tests` and `ng test` reports there is no such target.**
Cause: the `test` key is a ternary whose false branch is `undefined`, so the target is absent from
the file rather than present-and-disabled. There is no flag to flip. Fix: write the four-line
target yourself:

```json
{
  "targets": {
    "test": {
      "builder": "@angular/build:unit-test",
      "options": {}
    }
  }
}
```

**★ Symptom: you moved `index.html` out of `src/` and the build stops finding it.** Cause: the
generated file sets no `index`, the schema declares no default for it, and the fallback is resolved
inside the builder against the conventional location. Fix: state it explicitly the moment you move
the file:

```json
{ "options": { "index": "src/pages/index.html" } }
```

**★ Symptom: a zoneless application starts shipping `zone.js` again after someone copied
`["zone.js"]` back into `polyfills` to "restore" the missing key.** Cause: the absence *was* the
zoneless configuration — `zoneless: true` is why the branch produced `undefined` — so adding the
polyfill reintroduces the library the application was generated without, and puts it in the bundle.
Fix: leave `polyfills` absent unless you are deliberately going back to zone-based change
detection:

```json
{ "options": { "browser": "src/main.ts", "tsConfig": "tsconfig.app.json" } }
```

**Symptom: you assume `aot` is off in development because the file never mentions it.** Cause:
`aot` defaults to `true` in the builder schema and neither generated configuration overrides it —
ahead-of-time compilation runs in every configuration. Fix: nothing, unless you genuinely want the
non-default, in which case it must be written:

```json
{ "configurations": { "development": { "aot": false } } }
```

**Symptom: CI shows no budget enforcement, and `budgets` does not appear in `options`.** Cause:
`budgets` defaults to `[]` and the generated file puts the two entries in
`configurations.production` only — a build that runs another configuration enforces nothing. Fix:
either run the production configuration in CI, or lift the budgets into `options`:

```json
{
  "options": {
    "budgets": [{ "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" }]
  }
}
```

**Symptom: `statsJson` is expected by a bundle-analysis script and the build never writes it.**
Cause: it defaults to `false` and the schematic never writes it. Fix: set it on the configuration
the analysis runs against, not on `options`, so ordinary builds do not pay for it:

```json
{ "configurations": { "analyse": { "statsJson": true } } }
```

**Symptom: a build clears a directory you were keeping files in.** Cause: `deleteOutputPath`
defaults to `true` and is absent from the generated file, so the output directory is emptied before
every build. Fix: turn it off deliberately, or stop keeping anything in the output directory:

```json
{ "options": { "deleteOutputPath": false } }
```

## Interview questions

**★ Why is `polyfills` missing from a freshly generated v22 `angular.json`?**
Because `zoneless` now defaults to `true`, the assignment is
`options.zoneless ? undefined : ['zone.js']`, and an `undefined` property is dropped during JSON
serialisation rather than written as `null`. The builder's schema default for `polyfills` is `[]`,
so an absent key and an empty array behave identically. A reader comparing against a v17 tutorial
sees a missing line and assumes damage; what actually changed is a schematic default, and copying
`["zone.js"]` back in reintroduces the zone the application was deliberately generated without.

**★ A generated project object has three targets. What removes one of them?**
`--skip-tests` or `--minimal`. The `test` key is assigned from a conditional expression whose false
branch is `undefined`, and an `undefined` value is not serialised, so the target does not exist in
the file. That is different from a disabled target: there is no flag to flip, and `ng test` fails
at target lookup rather than at execution. Restoring it means writing the target object by hand.

**★ Which `ng new` flags actually change `angular.json`?**
Fewer than people expect. `strict`, `zoneless`, `style`, `testRunner`, `prefix`, `skipTests` and
`minimal` do. `standalone` and `fileNameStyleGuide` only do so when set away from their defaults,
and then only inside the per-project `schematics` block. `routing` and `ssr` change nothing in this
file — `routing` affects the generated source tree, and `ssr` is applied by a separate schematic
that runs afterwards. Knowing the split matters when reproducing someone else's setup: most of the
difference between two Angular projects is not in `angular.json` at all.

**★ How do you find the effective value of an option that does not appear in your file?**
Read the builder's own `schema.json` at the version you are on — for the `application` builder,
`packages/angular/build/src/builders/application/schema.json`, where each property carries its
`default`. That is the authoritative answer, because the CLI validates and fills options against
that exact file. Two cautions: some options declare no default at all, in which case the fallback
lives in builder code rather than the schema and should not be guessed; and the value that ends up
applying is the schema default only *after* the configuration merge, so check
`configurations.<name>` before concluding anything.

**Why is `null` not a way to unset an option?**
Because the option's declared type does not include `null`. The schematic expresses "not set" by
omitting the key — an `undefined` property that never reaches the JSON — and the builder's schema
default then applies. Writing `null` produces a type violation against a schema that is
`additionalProperties: false` and strictly typed per property, so the build fails validation rather
than falling back. Delete the key, or write the default value explicitly.

**Both `index` and `outputPath` are absent from a generated file, yet every build produces an
`index.html` in a `dist` directory. Where does that come from?**
Not from `angular.json`, and not from the builder's schema — neither option declares a default
there. The fallback is resolved inside the builder against the conventional locations. The
practically important part is what follows from that: because the convention is not written down in
your file or in the schema you can read, moving `index.html` or expecting a particular output
layout means setting the option explicitly rather than relying on a convention you cannot cite.

**Why do the options a configuration overrides tend to be exactly the ones absent from `options`?**
Because that is what a configuration is for. `options` carries the values that are true for every
build — entry point, tsconfig, assets, styles — and a configuration carries the deviations from the
builder's defaults for one scenario. `optimization`, `sourceMap`, `extractLicenses` and
`outputHashing` never appear in `options` in a generated file precisely because their defaults are
right for one configuration and wrong for the other, so each configuration states its own.

---

← Prev: [serve, test and libraries](05d-serve-test-and-libraries.md) · Index: [Topic index](README.md) · Next → [What you set, what you never touch](06-what-you-set-and-what-you-never-touch.md)
