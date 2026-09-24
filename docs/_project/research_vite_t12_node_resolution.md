---
name: research-vite-t12-node-resolution
description: Part 2 of the bare-specifier bank — Node.js packages.html verbatim (exports/imports, ERR_PACKAGE_PATH_NOT_EXPORTED, self-reference), the legacy browser-field object form, the real Failed-to-resolve-import error strings, the Rolldown plugin-interface confirmation, and the on-disk cross-links checked 2026-09-08. Part 1 is [[research-vite-t12-bare-specifiers]].
metadata:
  type: project
---

## Node.js packages.html (fetched against docs/latest-v22.x — the pin-relevant version)

### "exports" encapsulation / ERR_PACKAGE_PATH_NOT_EXPORTED
> "The "exports" provides a modern alternative to "main" allowing multiple entry points to
be defined, conditional entry resolution support between environments, and preventing any
other entry points besides those defined in "exports". This encapsulation allows module
authors to clearly define the public interface for their package."
> "Existing packages introducing the "exports" field will prevent consumers of the package
from using any entry points that are not defined, including the package.json (e.g.
require('your-package/package.json')). This will likely be a breaking change."
> "When the "exports" field is defined, all subpaths of the package are encapsulated and no
longer available to importers. For example, require('pkg/subpath.js') throws an
ERR_PACKAGE_PATH_NOT_EXPORTED error."
> "This encapsulation of exports provides more reliable guarantees about package interfaces
for tools and when handling semver upgrades for a package. It is not a strong encapsulation
since a direct require of any absolute subpath of the package such as [...]" (sentence
continues describing that `require(resolve('pkg/private-module.js'))` still works — the
encapsulation is at the resolver level, not the filesystem level).

### Main field vs exports precedence
> "If both "exports" and "main" are defined, the "exports" field takes precedence over
"main" in supported versions of Node.js."

### Conditional exports — condition list, in priority order (Node's own, v22 docs)
> "Node.js implements the following conditions, listed in order from most specific to least
specific as conditions should be defined:"
- `"node-addons"` — "similar to "node" and matches for any Node.js environment. This
  condition can be used to provide an entry point which uses native C++ addons... This
  condition can be disabled via the --no-addons flag."
- `"node"` — "matches for any Node.js environment. Can be a CommonJS or ES module file. In
  most cases explicitly calling out the Node.js platform is not necessary."
- `"import"` — "matches when the package is loaded via import or import(), or via any
  top-level import or resolve operation by the ECMAScript module loader. Applies regardless
  of the module format of the target file. Always mutually exclusive with "require"."
- `"require"` — "matches when the package is loaded via require(). The referenced file
  should be loadable with require() although the condition matches regardless of the module
  format of the target file. Expected formats include CommonJS, JSON, native addons, and ES
  modules. Always mutually exclusive with "import"."
- `"module-sync"` — "matches no matter the package is loaded via import, import() or
  require(). The format is expected to be ES modules that does not contain top-level await
  in its module graph - if it does, ERR_REQUIRE_ASYNC_MODULE will be thrown when the module
  is require()-ed."
- `"default"` — "the generic fallback that always matches. Can be a CommonJS or ES module
  file. This condition should always come last."
> "Within the "exports" object, key order is significant. During condition matching,
earlier entries have higher priority and take precedence over later entries. The general
rule is that conditions should be from most specific to least specific in object order."
> "Using the "import" and "require" conditions can lead to some hazards, which are further
explained in the dual CommonJS/ES module packages section." (that section is now a stub —
see below)
> "When using environment branches, always include a "default" condition where possible.
Providing a "default" condition ensures that any unknown JS environments are able to use
this universal implementation... For this reason, using "node" and "default" condition
branches is usually preferable to using "node" and "browser" condition branches."

### Community conditions
> "Condition strings other than the "import", "require", "node", "module-sync",
"node-addons" and "default" conditions implemented in Node.js core are ignored by default."
> ""types" - can be used by typing systems to resolve the typing file for the given export.
This condition should always be included first."
(the community list also documents "browser", "development", "production" as
community-defined, consistent with what Vite itself sets by default for the client)

### Resolving user conditions (Node's own --conditions flag)
> "When running Node.js, custom user conditions can be added with the --conditions flag:
node --conditions=development index.js which would then resolve the "development"
condition in package imports and exports, while resolving the existing "node",
"node-addons", "default", "import", and "require" conditions as appropriate."
> "Any number of custom conditions can be set with repeat flags."

### Subpath imports (`#internal`)
> "In addition to the "exports" field, there is a package "imports" field to create private
mappings that only apply to import specifiers from within the package itself."
> "Entries in the "imports" field must always start with # to ensure they are disambiguated
from external package specifiers."
> "Unlike the "exports" field, the "imports" field permits mapping to external packages."
> "The resolution rules for the imports field are otherwise analogous to the exports field."
Example quoted verbatim (package.json):
```json
{
  "imports": {
    "#dep": {
      "node": "dep-node-native",
      "default": "./dep-polyfill.js"
    }
  },
  "dependencies": {
    "dep-node-native": "^1.0.0"
  }
}
```
> "where import '#dep' does not get the resolution of the external package
dep-node-native (including its exports in turn), and instead gets the local file
./dep-polyfill.js relative to the package in other environments."

### Subpath patterns (both exports and imports)
> "For packages with a small number of exports or imports, we recommend explicitly listing
each exports subpath entry. But for packages that have large numbers of subpaths, this
might cause package.json bloat and maintenance issues."
> "* maps expose nested subpaths as it is a string replacement syntax only."
> "This is a direct static matching and replacement without any special handling for file
extensions."
> "The property of exports being statically enumerable is maintained with exports patterns
since the individual exports for a package can be determined by treating the right hand
side target pattern as a ** glob against the list of files within the package."
Null-target exclusion example (exports and imports both support this):
```json
{
  "exports": {
    "./features/*.js": "./src/features/*.js",
    "./features/private-internal/*": null
  }
}
```

### Dual CommonJS/ES module packages — STUB in current docs, flag as uncertain
Both the v22 docs (fetched against `docs/latest-v22.x`, the pin-relevant version) and the
very latest v26.8.1 docs reduce this section to one line:
> "Dual CommonJS/ES module packages# See the package examples repository for details."
There is no first-party prose explanation of the dual-package hazard (two separately
instantiated copies of the same package — one loaded via `require`, one via `import` —
holding independent module state, so `instanceof` checks and singletons fail across the
`require`/`import` boundary) left in the current Node docs; only the pointer to the
examples repo remains. **Write the mechanism in our own words and say plainly that Node's
own docs no longer spell it out in prose** — do not attribute an invented quote to Node for
this. The mechanism itself (two module registries, two instantiations) is well-established
CS/Node folklore and can be explained without a quote, but do not dress it as verbatim Node
documentation.

### Determining module system (type field) — for `.cjs`/`.mjs` override quotes if needed
> "If a package.json file does not have a "type" field, .js files are treated as CommonJS."
> "A package.json "type" value of "module" tells Node.js to interpret .js files within
that package as using ES module syntax."
> "Files ending with .mjs are always loaded as ES modules regardless of the nearest parent
package.json."
> "Files ending with .cjs are always loaded as CommonJS regardless of the nearest parent
package.json."

---

## GitHub / community verbatim error text (secondary but real, cited by source)
- "SyntaxError: The requested module '<name>' does not provide an export named '<export>'"
  — this is a V8/Node ESM loader `SyntaxError`, not a Vite-authored message. It fires when
  a static named import cannot be matched against the target module's statically-detected
  exports (for an ESM target) or against the CJS named-export detection Node performs via
  `cjs-module-lexer` (for a CJS target loaded through Node's ESM loader, i.e. NOT through
  Vite's own pre-bundler — see interop section). Distinguish this from Vite's own
  `Failed to resolve import "X" from "Y". Does the file exist?` (a `plugin:vite:import-analysis`
  error): the "Failed to resolve" error means the specifier itself could not be found; "does
  not provide an export named" means the specifier resolved to a real file, but that file
  does not have the named export requested — two different failure points in the same
  pipeline. Source for the exact wording: observed verbatim in the redux-toolkit issue
  tracker (https://github.com/reduxjs/redux-toolkit/issues/3864) and multiple other
  first-party project issues; this is standard V8 ESM loader text, not something either
  project authored.

---

## The legacy `browser` field, object form (community spec, not Node's exports)
Primary source: https://github.com/defunctzombie/package-browser-field-spec (the spec every
bundler, including Vite, implements for this field — Node core does not define it).
> "When using an object. The left hand side (key) is the name of a module or file you wish
to replace and the right side is the replacement."
```json
"browser": {
    "module-a": "./shims/module-a.js",
    "./server/only.js": "./shims/client-only.js"
}
```
> "You can simply prevent a module or file from being loaded into a bundle by specifying a
value of `false` for any of the keys."
```json
"browser": {
    "module-a": false,
    "./server/only.js": "./shims/server-only.js"
}
```
Confirmed Vite implements this directly (read from Vite's own source,
`packages/vite/src/node/plugins/resolve.ts`, `resolvePackageEntry`, main branch, read
2026-09-08 — cited as source code, not a docs page):
```typescript
const { browser: browserField } = data
if (options.mainFields.includes('browser') && isObject(browserField)) {
  entry = mapWithBrowserField(entry, browserField) || entry
}
```
```typescript
// special id for paths marked with browser: false
// https://github.com/defunctzombie/package-browser-field-spec#ignore-a-module
export const browserExternalId = '__vite-browser-external'
```
This is the real mechanism behind "a package's own browser field silently stubs out a Node
built-in on the client" — it only fires when `browser` is in `resolve.mainFields` (the
client default) AND is present as an *object* in the dependency's `package.json`. The SSR
default `mainFields` list drops `browser` entirely (see ../10-ssr-support/01e), which is why
the same package's Node build is used on the server without this stubbing kicking in.

## Vite plugin interface — confirms Rolldown, not Rollup (guide/api-plugin.md, fetched directly)
> "Vite plugins extends Rolldown's plugin interface with a few extra Vite-specific options.
As a result, you can write a Vite plugin once and have it work for both dev and build."
Consistent with the already-validated corpus claim in
docs/vite/pages/17-the-2026-toolchain-landscape/02b-loaders-become-plugins.md — do not
contradict it. `resolveId` is the plugin hook; Vite's own resolve logic (aliasing,
exports/conditions/mainFields resolution, the browser-field stubbing above) is implemented
as exactly this kind of plugin.

## Cross-links available at write time (checked on disk 2026-09-08)
- ../10-ssr-support/01e-ssr-target-and-resolve-conditions.md — EXISTS. Covers
  ssr.resolve.conditions / externalConditions / mainFields / ssr.target in full depth.
  Cross-link, never re-teach.
- ../11-optimization-and-performance/01a-dependency-pre-bundling.md — EXISTS. Covers
  CJS->ESM conversion, smart import analysis, Rolldown-as-optimizer, optimizeDeps.exclude.
  Cross-link for pre-bundling/interop mechanism and for optimizeDeps.exclude usage.
- ./01 through ./01f in 12-path-resolution-and-aliases — NOT YET WRITTEN (Agent A's lane,
  concurrent). Never link; use bold + *(not written yet)* for: resolve.alias (object/array),
  tsconfig paths mirroring, resolve.extensions, resolve.dedupe, preserveSymlinks/monorepo
  symlinks.
