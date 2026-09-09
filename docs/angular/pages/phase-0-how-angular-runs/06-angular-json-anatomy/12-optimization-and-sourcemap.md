---
title: "`optimization.scripts` is the most consequential boolean in `angular.json`, `optimization.fonts` needs internet access at build time, and `\"sourceMap\": {}` turns source maps on because every inner default inverts the outer one"
sidebar_label: "12 · `optimization` and `sourceMap`"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the `optimization` and `sourceMap`
> properties of
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> at tag `v22.1.7`, and
> [angular.dev/reference/configs/workspace-config](https://angular.dev/reference/configs/workspace-config#source-map-configuration),
> quoted verbatim. ⚠️ **angular.dev's "apply optimization to one or the other" example is wrong** —
> the JSON block beneath that sentence shows `stylePreprocessorOptions` rather than `optimization`.
> It is named here and deliberately not reproduced.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Two options with nested objects, and both hide something in the nesting.** `optimization` looks
like a minification switch and is actually the flag four unrelated build behaviours are gated on.
`sourceMap` has an outer default of `false` and inner defaults of `true`, so the empty object means
the opposite of the bare default. Neither surprise is documented in prose; both are provable
straight from the schema.

## `optimization`

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

### 🔴 `optimization.scripts` gates four things, only one of which is minification

It is the most consequential boolean in the file. Setting it decides:

| What it gates | Where |
|---|---|
| Script minification and mangling | this option's own description |
| The **Rolldown chunk optimizer** — the second pass over esbuild's output | [05 · 04b](../05-the-build-angular-build/04b-what-the-second-pass-is-worth.md) |
| The **CommonJS dependency check** | [05 · 09b](../05-the-build-angular-build/09b-what-the-build-stops-telling-you.md) |
| The **`production` vs `development` import conditions** | [05 · 10c](../05-the-build-angular-build/10c-import-attributes-and-conditions.md) |

So "turn off minification so I can read the output" is not a small change: it also stops the chunk
graph being re-bundled, silences the CommonJS warning, and flips which branch every conditional
import resolves to. If you want unminified output *without* those side effects, the environment
variables in
[05 · 11b](../05-the-build-angular-build/11b-the-ng-build-environment-surface.md) are the narrower
instrument.

### 🔴 `optimization.fonts` requires internet access during the build

The schema says it twice, on the parent and on `inline`: *"This option requires internet access.
`HTTPS_PROXY` environment variable can be used to specify a proxy server."*

`inline` *"Reduce[s] render blocking requests by inlining external Google Fonts and Adobe Fonts CSS
definitions in the application's HTML index file."* — which means the build fetches from Google or
Adobe. On a laptop that is invisible. In an air-gapped or proxy-only CI environment it is a build
that behaves differently from the one you tested, and the schema names the escape hatch:

```bash
HTTPS_PROXY=http://proxy.internal:3128 ng build
```

Or opt out entirely, which is the right call when you self-host fonts anyway:

```json
{ "options": { "optimization": { "fonts": false } } }
```

### The styles sub-options

`minify`, `inlineCritical` and `removeSpecialComments` all default to `true`. The third is worth
knowing by name: it removes comments containing `@license` or `@preserve`, or starting with `//!` or
`/*!` — the exact convention other tools use to *protect* a banner. If a licence header must survive
into a global stylesheet, this is the option that is deleting it.

## `sourceMap` — the inversion

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

⚠️ **The outer default is `false`; every inner default is `true`.** So `"sourceMap": {}` — an empty
object, which reads like "no options, so nothing" — turns source maps **on** for scripts and styles.
It is the opposite of the bare default and it is provable straight from the schema.

### `hidden` unlinks the map; it does not protect it

> *"HELPFUL: When using hidden source maps, source maps are not referenced in the bundle. These are
> useful if you only want source maps to map stack traces in error reporting tools without showing
> up in browser developer tools. Note that even though `hidden` prevents the source map from being
> linked in the output bundle, your deployment process must take care not to serve the generated
> sourcemaps in production, or else the information is still leaked."*

🔴 **Read the last clause.** `hidden` removes the `//# sourceMappingURL` comment. The `.map` files
are still written to the output directory, and a static host that serves the whole directory serves
them. Guessing the URL is trivial. `hidden` is a DevTools convenience, not a security control.

The genuine mitigation is a different option:

> *"You can generate source maps without the `sourcesContent` field, which contains the original
> source code. This allows you to deploy source maps to production for better error reporting with
> original source names while protecting your source code from exposure."*

```json
"sourceMap": { "scripts": true, "styles": true, "sourcesContent": false }
```

```json
"sourceMap": { "scripts": true, "styles": false, "hidden": true, "vendor": true }
```

The first is the one to reach for when you want readable stack traces in an error reporter and do
not want to ship your source: names are preserved, content is not.

## Gotchas

**★ Symptom: builds succeed locally and hang or fail in a locked-down CI network.** Cause:
`optimization.fonts.inline` fetches Google Fonts and Adobe Fonts CSS at build time, and the schema
states the internet requirement twice. Fix: either point it at your proxy or turn it off:

```json
{ "options": { "optimization": { "fonts": false } } }
```

**★ Symptom: `"sourceMap": {}` unexpectedly produced `.map` files.** Cause: the outer default is
`false` but `scripts` and `styles` both default to `true`, so an empty object enables them. Fix: say
`false` if you mean off:

```json
{ "options": { "sourceMap": false } }
```

**★ Symptom: source maps are on a production host and your original source is readable in
DevTools.** Cause: `hidden` only removes the reference from the bundle — the files are still emitted
and served. Fix: strip content from the maps *and* stop serving them:

```json
{ "options": { "sourceMap": { "scripts": true, "sourcesContent": false, "hidden": true } } }
```

**★ Symptom: a `/*! @license */` banner disappears from a global stylesheet.** Cause:
`removeSpecialComments` defaults to `true` and targets exactly that convention. Fix: keep it while
still minifying:

```json
{ "options": { "optimization": { "styles": { "minify": true, "removeSpecialComments": false } } } }
```

**★ Symptom: turning off minification also changed the number of chunks.** Cause:
`optimization.scripts` gates the Rolldown chunk optimizer as well as minification. Fix: if you only
wanted readable output, use the narrower environment lever instead of the option:

```bash
NG_BUILD_MANGLE=0 ng build --configuration production
```

**★ Symptom: a conditional `#`-prefixed import resolved to the development branch in a production
build.** Cause: the same flag again — `optimization.scripts` decides the `production` versus
`development` import condition. Fix: check the option rather than the configuration's name:

```bash
node -p "JSON.stringify(require('./angular.json').projects['my-app'].targets.build.configurations, null, 2)"
```

**★ Symptom: the CommonJS warning vanished after a configuration change nobody connects to it.**
Cause: it is gated on `optimization.scripts` too. Fix: expected — run the production configuration
when you want the check.

**★ Symptom: `"optimization": { "styles": true }` is rejected alongside another key you added.**
Cause: `additionalProperties` is `false` at every level of this option, so a misspelled sub-key
fails the whole build rather than being ignored. Fix: the styles object accepts exactly `minify`,
`inlineCritical` and `removeSpecialComments`.

**★ Symptom: vendor code shows as compiled output in stack traces even with source maps on.**
Cause: `vendor` defaults to `false`, so vendor packages' own maps are not resolved. Fix: opt in
while debugging a library:

```json
{ "options": { "sourceMap": { "scripts": true, "vendor": true } } }
```

**★ Symptom: you copied an `optimization` example from angular.dev and it configured something
else.** Cause: the JSON block under that page's "apply optimization to one or the other" sentence
shows `stylePreprocessorOptions`, not `optimization`. Fix: use the schema, which is what actually
validates your file.

## Interview questions

**★ Why is `optimization.scripts` the most consequential boolean in `angular.json`?**
Because four unrelated behaviours are gated on it, and only one of them is in its description. It
controls script minification and mangling; it decides whether the Rolldown chunk optimizer runs, so
turning it off changes the chunk graph and not just the byte count; it gates the CommonJS dependency
check, which is why that warning appears only in optimized builds; and it selects the `production`
versus `development` package import conditions, so conditional imports resolve differently. The
practical upshot is that "turn off optimization to debug" changes four things at once, and the
narrower instrument for reading output is `NG_BUILD_MANGLE=0`.

**★ What does `"sourceMap": {}` do, and why is that surprising?**
It turns source maps on for scripts and styles. The outer property defaults to `false`, but every
property inside the object form defaults to `true` — so supplying an empty object opts into the
inner defaults rather than inheriting the outer one. It is a genuine trap because an empty object
reads as "configured, but with nothing set". The rule generalises: in this schema, choosing the
object form means you get that object's defaults, not the scalar default of the parent.

**★ Is `hidden: true` enough to keep your source private?**
No, and the documentation says so explicitly: `hidden` prevents the map being linked from the
bundle, but *"your deployment process must take care not to serve the generated sourcemaps in
production, or else the information is still leaked."* The `.map` files are still written into the
output directory, and their URLs are guessable. It is a DevTools convenience, not a security
control. The real mitigation is `sourcesContent: false`, which keeps the name mappings your error
reporter needs while omitting the original source text — plus a deploy step that does not upload
`*.map` at all.

**Why would a build work on a laptop and fail in CI with no code change?**
`optimization.fonts` is the classic answer: it inlines Google Fonts and Adobe Fonts CSS and
therefore requires internet access at build time, which a developer machine has and a locked-down
runner may not. The schema states the requirement twice and names `HTTPS_PROXY` as the escape hatch.
It is worth knowing as a category — build-time network access — because it is invisible in the
configuration unless you read the option's description.

**What does `removeSpecialComments` remove, and why is the default awkward?**
Comments in global CSS containing `@license` or `@preserve`, or starting with `//!` or `/*!`. The
awkwardness is that this is precisely the convention the wider ecosystem uses to mark a comment as
*must survive minification*, and Angular's default is to strip it. For a project with a licence
banner obligation, the default is wrong and the failure is silent — the banner is simply not in the
output.

{/* FOOTER */}
