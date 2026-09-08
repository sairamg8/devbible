---
title: "resolve.mainFields is a fallback that exports always overrides, and Vite 8 deleted the heuristic that used to guess which field's file was actually ESM"
sidebar_label: "01i · mainFields & browser field"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Vite documentation — [`resolve.mainFields`](https://vite.dev/config/shared-options#resolve-mainfields), [Migration from v7 — Removed Module Resolution Using Format Sniffing](https://vite.dev/guide/migration#removed-module-resolution-using-format-sniffing), and the community [`browser` field spec](https://github.com/defunctzombie/package-browser-field-spec). Some claims below are sourced directly from Vite's own resolve-plugin source rather than a docs page, and are labelled as such. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ `resolve.mainFields` and the Legacy `browser` Field

**`mainFields` is what Node resolution looked like before `exports` existed: an ordered list
of `package.json` fields to check for a single entry-point string, tried in order until one
is found. Vite 8 kept the option but deleted a heuristic that used to peek inside the actual
file content to decide which field's file was really the ESM one — a change that is silent
until a package that relied on it starts shipping the wrong build.**

## The default order, and the one rule that overrides all of it

**Type:** `string[]` · **Default:** `['browser', 'module', 'jsnext:main', 'jsnext']`
(`defaultClientMainFields`) — the client default. Consulted in order, first match wins:

> *"List of fields in `package.json` to try when resolving a package's entry point. Note
> this takes lower precedence than conditional exports resolved from the `exports` field: if
> an entry point is successfully resolved from `exports`, the main field will be ignored."*

That second sentence is unconditional. A package with a valid `exports` map never reaches
`mainFields` at all — this option only fires for the shrinking set of dependencies that ship
`main`/`module`/`browser` fields and nothing under `exports`. On the SSR side the same
option exists with a different default that drops `browser`; the full mechanics and every
gotcha specific to that split are in
[../10-ssr-support/01e-ssr-target-and-resolve-conditions.md](../10-ssr-support/01e-ssr-target-and-resolve-conditions.md) — this page only needs
the one fact that the client list includes `browser` and the SSR list does not.

```json
// a legacy package with no "exports" field at all
{
  "main": "./dist/index.cjs.js",
  "module": "./dist/index.esm.js",
  "browser": "./dist/index.browser.js"
}
```

On the client, with the default order, `browser` is checked first and wins. Change
`resolve.mainFields` to `['module', 'main']` and the same package resolves to the ESM build
regardless of what the `browser` field points at — nothing about the package changed, only
which field Vite consulted first.

## Vite 8 removed the "look inside the file to guess" heuristic

Before this option settled into a plain ordered list, Vite had special-cased the case where
a package published both `browser` and `module`:

> *"When both `browser` and `module` fields are present in `package.json`, Vite used to
> resolve the field based on the content of the file and it used to pick the ESM file for
> browsers. This was introduced because some packages were using the `module` field to point
> to ESM files for Node.js and some other packages were using the `browser` field to point to
> UMD files for browsers."*

The historical reason was that `module` and `browser` never had a single agreed meaning
across the ecosystem — some authors used `module` for "this is ESM, for any environment
that understands it" and `browser` for "this is UMD, safe to `<script>` tag"; others used
`browser` for "this is ESM meant for the browser." Vite used to sniff the actual file
content to tell which was which. Vite 8 removed that entirely:

> *"Given that the modern `exports` field solved this problem and is now adopted by many
> packages, Vite no longer uses this heuristic and always respects the order of the
> [`resolve.mainFields`] option. If you were relying on this behavior, you can use the
> [`resolve.alias`] option to map the field to the desired file or apply a patch with your
> package manager (e.g. `patch-package`, `pnpm patch`)."*

The migration section is literally titled *"Removed Module Resolution Using Format
Sniffing."* The practical effect: a handful of old, `exports`-less packages that depended on
the sniffing to get the ESM build instead of a UMD bundle now resolve strictly by field
*order*, and if `browser` happens to point at a UMD file, that is what loads — content is
never inspected anymore.

```js
// vite.config.js — the documented workaround for a package still relying on the old sniff
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      // Force the specific file the removed heuristic used to find by content-sniffing.
      'legacy-widget-lib': 'legacy-widget-lib/dist/legacy-widget-lib.esm.js',
    },
  },
})
```

## The legacy `browser` field's object form — a per-file stub map

`browser` is not Node core's field at all; it is a community convention Node never
standardized and `exports` was explicitly designed to replace. It has two forms. The string
form is a single alternate entry point, as above. The object form is a *map*, and this is
where it does something `exports` cannot cleanly express — silently substituting or deleting
individual files:

> *"When using an object. The left hand side (key) is the name of a module or file you wish
> to replace and the right side is the replacement."*

```json
{
  "browser": {
    "module-a": "./shims/module-a.js",
    "./server/only.js": "./shims/client-only.js"
  }
}
```

And critically, for anything client code should never touch:

> *"You can simply prevent a module or file from being loaded into a bundle by specifying a
> value of `false` for any of the keys."*

```json
{
  "browser": {
    "fs": false,
    "./src/server-only-logger.js": false
  }
}
```

Vite implements this object form directly — confirmed by reading Vite's own resolve-plugin
source (`packages/vite/src/node/plugins/resolve.ts`, `resolvePackageEntry`, `main` branch,
read 2026-09-08 — this is source code, not a documentation page, and is cited as such):

```typescript
// from Vite's resolve plugin — only consulted when 'browser' is in mainFields
// AND the field is an object, not a string
const { browser: browserField } = data
if (options.mainFields.includes('browser') && isObject(browserField)) {
  entry = mapWithBrowserField(entry, browserField) || entry
}
```

A module mapped to `false` resolves to a dedicated internal sentinel Vite defines for exactly
this case:

```typescript
// special id for paths marked with browser: false
// https://github.com/defunctzombie/package-browser-field-spec#ignore-a-module
export const browserExternalId = '__vite-browser-external'
```

This is the mechanism behind a specific, otherwise-mysterious behaviour: a dependency that
internally uses `fs` for a Node-only code path, but ships `"browser": { "fs": false }`, loads
cleanly in the browser with that code path silently turned into a no-op — not because Vite
has a built-in Node-shim system, but because the *package itself* declared the stub, and Vite
honours it. Remove `browser` from `resolve.mainFields` and this stubbing stops happening for
every package that relies on the object form, not just the ones you intended to change.

## Object-form `browser` only fires when the string entry did too

Both forms live in the same field and are read by the same `mainFields` gate — a package
cannot have its object-form stubs consulted while its top-level entry point comes from
`module` instead of `browser`. If `resolve.mainFields` is customised to put `module` ahead of
`browser`, or to drop `browser` entirely, the object-form stub map for that package's
internal files stops being read too, not just the top-level entry choice.

```js
// ❌ drops the entry-point AND the per-file stub map for every dependency using
// the object-form `browser` field
export default defineConfig({
  resolve: { mainFields: ['module', 'main'] },
})

// ✅ keep 'browser' in the list if any dependency needs its object-form stubs honoured,
// even if you also want `module` preferred for packages that only use the string form
export default defineConfig({
  resolve: { mainFields: ['browser', 'module', 'main'] },
})
```

## Gotchas

**★ Symptom: a package's `fs`/`path`/`crypto` usage was silently working in the browser, and after a `resolve.mainFields` edit it starts throwing at runtime instead.** Cause: the
package relied on its own object-form `browser` field to stub that usage to `false`, and
`browser` was removed from, or reordered out of first-match position in, `resolve.mainFields`
— so the object-form map is never consulted and the real Node-targeting file loads instead.
Fix: keep `browser` in `resolve.mainFields` for any project depending on packages that use
this pattern; there is no way to opt one dependency in and another out except
`resolve.alias`, applied per package.

**★ Symptom: a Vite 8 upgrade makes an old, `exports`-less dependency load its UMD bundle in the browser where it previously loaded ESM.** Cause: Vite 7 and earlier content-sniffed
`browser` vs `module` to guess which was ESM; Vite 8 removed that heuristic entirely and
resolves `mainFields` strictly by declared order. Fix: pin the exact file with
`resolve.alias`, the documented workaround.
```js
resolve: { alias: { 'old-widget': 'old-widget/dist/old-widget.esm.js' } }
```

**★ Symptom: `resolve.mainFields` is set, and the package still resolves to a file `mainFields` doesn't even mention.** Cause: the package has an `exports` field, and `exports`
always wins — *"if an entry point is successfully resolved from `exports`, the main field
will be ignored."* `mainFields` is only consulted when `exports` resolution does not apply
at all. Fix: for a package with `exports`, the levers are `resolve.conditions` (which branch
of the map) and `resolve.alias` (a hard override), never `mainFields`.

**★ Symptom: two packages disagree about what their `browser` field means, and one of them silently ships server code to the client.** Cause: `browser` predates any single
agreed spec and Node never standardized it — the field is a convention, not an enforced
contract, so different authors have used it inconsistently (ESM-for-browsers vs.
UMD-for-`<script>`-tags) for years. `exports` with an explicit `"browser"` condition key
solves this ambiguity going forward, but only for packages that have adopted `exports`. Fix:
for a package still on the bare `browser` field, verify by inspecting the actual file it
resolves to rather than trusting the field name; `resolve.alias` is the escape hatch once you
know which file is actually correct.

## Interview questions

**★ `resolve.mainFields` lists `browser` first by default. Why doesn't that make every dual-published package load its browser build the way `resolve.conditions` does with the `browser` condition?**
Because `mainFields` and `exports`/`conditions` are two independent resolution paths, and
`exports` always wins when present: *"if an entry point is successfully resolved from
`exports`, the main field will be ignored."* `mainFields` is a fallback for the shrinking set
of packages that never adopted `exports` at all. A modern dual-published package's browser
selection goes entirely through `resolve.conditions`; `mainFields` never even gets consulted
for it. Confusing the two is common because both default lists happen to favour the browser
environment on the client, but they are consulted for disjoint sets of packages.

**★ What did Vite 8 remove about `mainFields`/`browser` resolution, and what is the documented workaround for code that depended on it?**
The "format sniffing" heuristic — Vite used to open the file a `module` or `browser` field
pointed to and infer from its actual content which one was really the ESM build, so it could
still pick correctly even when packages used the fields inconsistently. Vite 8 deleted that
inspection step entirely and now *"always respects the order of the `resolve.mainFields`
option"* with no content check. The documented fix for a package that needs the old
behaviour is `resolve.alias`, pointing the package's specifier directly at the file that was
previously chosen by the sniff — or patching the package with `patch-package`/`pnpm patch`.

**★ A dependency's `fs` import works fine in the browser build with no config anywhere in the app. How, mechanically, is that possible without a Node polyfill?**
The dependency's own `package.json` declares an object-form `browser` field mapping `"fs":
false`, and Vite implements that community convention directly in its resolve plugin —
confirmed in the plugin's own source, which reads the field only when `browser` is present
in `resolve.mainFields` and the field value is an object rather than a string, and resolves
a `false`-mapped entry to an internal sentinel id (`__vite-browser-external`) rather than the
real module. Nothing about this is Vite polyfilling Node — it is the package author
declaring, ahead of time, "on the client, treat this import as inert," and Vite honouring
that declaration as part of standard resolution. Remove `browser` from `mainFields` and the
same import throws, because the stub declaration is never read.

---

← [01h · resolve.conditions](01h-resolve-conditions.md) · [Vite overview](../../README.md) · Next → [01j · Node built-ins in the browser](01j-node-builtins-in-browser-code.md)
