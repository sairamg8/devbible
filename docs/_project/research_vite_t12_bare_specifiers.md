---
name: research-vite-t12-bare-specifiers
description: Verbatim Vite 8.2.2 + Node primary-source quotes for BARE-SPECIFIER resolution — exports/imports fields, resolve.conditions, mainFields and the legacy browser field, ssr.external/noExternal, the removed format-sniffing heuristic, and the exact Failed-to-resolve-import error strings. Banked by agent B of batch 3, 2026-09-08. Do NOT re-derive.
metadata:
  type: project
---

# Research bank — vite topic 12, chunks 01g+ (bare specifier resolution)
Fetched 2026-09-08. Do not re-derive; write every chunk from this bank.
Target: Vite 8.2.2 · Node.js ^20.19.0 || >=22.12.0 (docs fetched against Node v22.x and
current v26.8.1 for comparison — v22 quoted as the pin-relevant version).

## Sources fetched (raw .md/.html, saved alongside this file)
- shared-options.md  <- https://vite.dev/config/shared-options.md
- ssr-options.md     <- https://vite.dev/config/ssr-options.md
- troubleshooting.md <- https://vite.dev/guide/troubleshooting.md
- migration.md       <- https://vite.dev/guide/migration.md
- dep-pre-bundling.md<- https://vite.dev/guide/dep-pre-bundling.md
- build-options.md   <- https://vite.dev/config/build-options.md
- cli.md             <- https://vite.dev/guide/cli.md
- packages-v22.txt (stripped from https://nodejs.org/docs/latest-v22.x/api/packages.html)
- packages.txt (stripped from https://nodejs.org/api/packages.html, Node v26.8.1 — used
  only to confirm the Dual CJS/ESM section has been trimmed upstream, see note below)
- GitHub source read via WebFetch (not a docs page, cited as source code):
  https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/resolve.ts

---

## Vite: resolve.conditions
Type: `string[]`. Default: `['module', 'browser', 'development|production']` (`defaultClientConditions`).
> "Additional allowed conditions when resolving [Conditional Exports](https://nodejs.org/api/packages.html#packages_conditional_exports) from a package."
> "Here, `import` and `require` are "conditions". Conditions can be nested and should be specified from most specific to least specific."
> "`development|production` is a special value that is replaced with `production` or `development` depending on the value of `process.env.NODE_ENV`. It is replaced with `production` when `process.env.NODE_ENV === 'production'` and `development` otherwise."
> "Note that `import`, `require`, `default` conditions are always applied if the requirements are met."
> "In addition, the `style` condition is applied when resolving style imports, e.g. `@import 'my-library'`. For some CSS pre-processors, their corresponding conditions are also applied, i.e. `sass` for Sass and `less` for Less."

## Vite: resolve.mainFields
Type: `string[]`. Default: `['browser', 'module', 'jsnext:main', 'jsnext']` (`defaultClientMainFields`).
> "List of fields in `package.json` to try when resolving a package's entry point. Note this takes lower precedence than conditional exports resolved from the `exports` field: if an entry point is successfully resolved from `exports`, the main field will be ignored."

## Vite 8 migration: removed format-sniffing heuristic (mainFields/browser vs module)
> "When both `browser` and `module` fields are present in `package.json`, Vite used to resolve the field based on the content of the file and it used to pick the ESM file for browsers. This was introduced because some packages were using the `module` field to point to ESM files for Node.js and some other packages were using the `browser` field to point to UMD files for browsers. Given that the modern `exports` field solved this problem and is now adopted by many packages, Vite no longer uses this heuristic and always respects the order of the [`resolve.mainFields`](/config/shared-options#resolve-mainfields) option. If you were relying on this behavior, you can use the [`resolve.alias`](/config/shared-options#resolve-alias) option to map the field to the desired file or apply a patch with your package manager (e.g. `patch-package`, `pnpm patch`)."
Heading: "### Removed Module Resolution Using Format Sniffing"

## Vite: resolve.alias — customResolver removed
> "`resolve.alias[].customResolver`: Use a custom plugin with `resolveId` hook and `enforce: 'pre'` instead" — under "The following options are deprecated and will be removed in the future"

## Vite: NO resolve.builtins option
Confirmed by absence: `shared-options.md` lists every `resolve.*` option (`alias`, `dedupe`,
`conditions`, `mainFields`, `extensions`, `preserveSymlinks`, `tsconfigPaths`) and there is
no `resolve.builtins`. Vite has never needed one — Node built-ins are not polyfilled; see
the "Module externalized for browser compatibility" mechanism below.

## Vite: "Module externalized for browser compatibility" (troubleshooting.md, section "Others")
> "When you use a Node.js module in the browser, Vite will output the following warning."
> Module "fs" has been externalized for browser compatibility. Cannot access "fs.readFile" in client code.
> "This is because Vite does not automatically polyfill Node.js modules."
> "We recommend avoiding Node.js modules for browser code to reduce the bundle size, although you can add polyfills manually. If the module is imported from a third-party library (that's meant to be used in the browser), it's advised to report the issue to the respective library."

## Vite: dep pre-bundling (already banked fully in 11-optimization-and-performance/01a; cross-link, do not re-quote at length). Key line for interop:
> "When converting CommonJS dependencies, Vite performs smart import analysis so that named imports to CommonJS modules will work as expected even if the exports are dynamically assigned (e.g. React)"

## Vite 8 migration: engine change
> "Vite 8 uses [Rolldown](https://rolldown.rs/) and [Oxc](https://oxc.rs/) based tools instead of [esbuild](https://esbuild.github.io/) and [Rollup](https://rollupjs.org/)."
> "Rolldown is now used for dependency optimization instead of esbuild."

## Vite 8 migration: require() of externalized modules preserved
> "`require` calls for externalized modules are now preserved as `require` calls and not converted to `import` statements. This is to preserve the semantics of `require` calls. If you want to convert them to `import` statements, you can use [Rolldown's built-in `esmExternalRequirePlugin`](https://rolldown.rs/builtin-plugins/esm-external-require), which is re-exported from `vite`."

## Vite 8 migration: default-import ambiguity from CJS (new v8 conditions)
Full new-behavior list (conditions under which `default` import === CJS module.exports):
- "The closest `package.json` for the importer has a `type` field set to `module`." (one of several — see file for the importer being .mjs/.mts too)
- "The `module.exports.__esModule` value of the importee CJS module is not set to `true`."
> "This change may break some existing code importing CJS modules. You can use the deprecated `legacy.inconsistentCjsInterop: true` option to temporarily restore the previous behavior."
Rolldown doc pointer: https://rolldown.rs/in-depth/bundling-cjs#ambiguous-default-import-from-cjs-modules
Troubleshooting.md's own phrasing:
> "The default import returns the `module.exports` object for CJS modules, while you may expect it to return the `module.exports.default` value."
Errors this produces, quoted from troubleshooting.md:
> Element type is invalid: expected a string (for built-in components) or a class/function (for composite components) but got: object.
> foo is not a function

## Vite: ESM-only package loaded via require (config loading failure)
> "Failed to resolve "foo". This package is ESM only but it was tried to load by `require`."
> Error [ERR_REQUIRE_ESM]: require() of ES Module /path/to/dependency.js from /path/to/vite.config.js not supported.
> Instead change the require of index.js in /path/to/vite.config.js to a dynamic import() which is available in all CommonJS modules.
Context: "In Node.js <=22, ESM files cannot be loaded by `require` by default." Fix: add
`"type": "module"` to package.json, or rename config to `.mjs`/`.mts`.

## Vite: build.rolldownOptions / build.rollupOptions alias
> "Directly customize the underlying Rolldown bundle. This is the same as options that can be exported from a Rolldown config file and will be merged with Vite's internal Rolldown options."
> "This option is an alias of `build.rolldownOptions` option. Use `build.rolldownOptions` option instead." (for `build.rollupOptions`, marked Deprecated)
Rename table (migration.md, dependency optimizer, esbuild->rolldown options):
- `esbuildOptions.preserveSymlinks` -> `!rolldownOptions.resolve.symlinks`
- `esbuildOptions.resolveExtensions` -> `rolldownOptions.resolve.extensions`
- `esbuildOptions.mainFields` -> `rolldownOptions.resolve.mainFields`
- `esbuildOptions.conditions` -> `rolldownOptions.resolve.conditionNames`
- `esbuildOptions.plugins` -> `rolldownOptions.plugins` (partial support)
> "Rolldown is now used for dependency optimization instead of esbuild. Vite still supports `optimizeDeps.esbuildOptions` for backward compatibility by converting it to `optimizeDeps.rolldownOptions` automatically. `optimizeDeps.esbuildOptions` is now deprecated and will be removed in the future and we encourage you to migrate to `optimizeDeps.rolldownOptions`."

## Vite: SSR externalisation (config, not guide) — for the externalisation chunk
ssr.external: "Externalize the given dependencies and their transitive dependencies for SSR.
By default, all dependencies are externalized except for linked dependencies (for HMR). If
you prefer to externalize the linked dependency, you can pass its name to this option."
"If `true`, all dependencies including linked dependencies are externalized."
"Note that the explicitly listed dependencies (using `string[]` type) will always take
priority if they're also listed in `ssr.noExternal` (using any type)."
ssr.noExternal: "Prevent listed dependencies from being externalized for SSR, which they
will get bundled in build. By default, only linked dependencies are not externalized (for
HMR). If you prefer to externalize the linked dependency, you can pass its name to the
`ssr.external` option."
"If `true`, no dependencies are externalized. However, dependencies explicitly listed in
`ssr.external` (using `string[]` type) can take priority and still be externalized. If
`ssr.target: 'node'` is set, Node.js built-ins will also be externalized by default."
"Note that if both `ssr.noExternal: true` and `ssr.external: true` are configured,
`ssr.noExternal` takes priority and no dependencies are externalized."
(01e in 10-ssr-support already covers ssr.resolve.conditions/externalConditions/mainFields
in depth — cross-link, do not re-teach.)

## Vite: resolve.alias SSR note
> "If you have configured aliases for [SSR externalized dependencies](/guide/ssr.md#ssr-externals), you may want to alias the actual `node_modules` packages. Both [Yarn](https://classic.yarnpkg.com/en/docs/cli/add/#toc-yarn-add-alias) and [pnpm](https://pnpm.io/aliases/) support aliasing via the `npm:` prefix." (warning box "Using with SSR")

## Vite: resolve.dedupe SSR+ESM warning (owned by Agent A's 01d/01e but the SSR
build-output caveat is genuinely new information for the externalisation chunk):
> "For SSR builds, deduplication does not work for ESM build outputs configured from
`build.rolldownOptions.output`. A workaround is to use CJS build outputs until ESM has
better plugin support for module loading." (warning box "SSR + ESM")

## Vite CLI: --debug / -d flag
> "-d, --debug [feat]  [string | boolean] show debug logs"
Troubleshooting.md's only concrete worked example of a namespace:
> "You can run `vite --debug hmr` to log the circular dependency path if a file change triggered it."
Vite source (not a docs page — cited as source code, read via GitHub, file
`packages/vite/src/node/plugins/resolve.ts` on the `main` branch, read 2026-09-08):
`createDebugger('vite:resolve-details', { onlyWhenFocused: true })` — the resolve plugin's
own debug channel is named `vite:resolve-details`, not `vite:resolve`. It logs two shapes:
`[package entry] {input} -> {resolved_path}` and `[processResult] {original_id} -> {resolved_id}`.
UNCERTAIN: whether `vite --debug resolve` (without `-details`) does anything — the debug
package matches namespaces literally unless a wildcard is used, so the CLI flag most likely
needs to be `vite --debug resolve-details` or `DEBUG=vite:resolve-details vite`. The Vite
docs do not enumerate debug namespaces anywhere I could find; this is sourced from reading
the plugin's own `createDebugger` call, not from vite.dev. State this as sourced-from-source,
not from documentation, and flag the `--debug resolve` shorthand as unconfirmed.

## Vite: GitHub issue — real observed error text for a bad bare import (primary source: the
project's own issue tracker, not fabricated). Cite as a GitHub issue, not vite.dev docs:
`[plugin:vite:import-analysis] Failed to resolve import "@..." from "src/...". Does the file exist?`
— https://github.com/vitejs/vite/issues/17501 (issue title, quoted verbatim from the title).

---


---

Continues in [[research-vite-t12-node-resolution]] — Node's own `packages.html` quotes, the
legacy `browser` field object form, the real error strings, and the Rolldown plugin-interface
confirmation.
