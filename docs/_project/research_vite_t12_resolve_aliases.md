---
name: research-vite-t12-resolve-aliases
description: Verbatim Vite 8.2.2 primary-source quotes for path resolution and ALIASING — resolve.alias forms, resolve.tsconfigPaths, extensions, dedupe, preserveSymlinks, server.fs.allow, the npm-link cache-invalidation paragraph. Banked by agent A of batch 3, 2026-09-08. Do NOT re-derive.
metadata:
  type: project
---

# Research bank — vite topic 12, chunks 01..01f (Agent A)
Fetched 2026-09-08 from vite.dev/*.md twins + rolldown.rs + vite-tsconfig-paths README.

## config/shared-options.md — resolve.alias
> "Defines aliases used to replace values in `import` or `require` statements. This
> works similar to `@rollup/plugin-alias`. The order of the entries is important, in
> that the first defined rules are applied first."
> "When aliasing to file system paths, always use absolute paths. Relative alias
> values will be used as-is and will not be resolved into file system paths."
Array format example (RegExp find + replacement pattern):
> "When `find` is a regular expression, the `replacement` can use replacement
> patterns, such as `$1`."
```js
{ find: /^(.*)\.js$/, replacement: '$1.alias' }
```
Object form: `Record<string, string>`. Array form: `Array<{ find: string | RegExp, replacement: string }>`.
customResolver in the array form: NOT mentioned in shared-options text fetched (see migration.md — deprecated).

## config/shared-options.md — resolve.dedupe
Type: `string[]`.
> "If you have duplicated copies of the same dependency in your app (likely due to
> hoisting or linked packages in monorepos), use this option to force Vite to always
> resolve listed dependencies to the same copy (from project root)."
SSR note:
> "For SSR builds, deduplication does not work for ESM build outputs configured from
> `build.rolldownOptions.output`."

## config/shared-options.md — resolve.conditions (Agent B territory, noted for handoff only)
Type: `string[]`, default `['module', 'browser', 'development|production']` (defaultClientConditions)
> "Additional allowed conditions when resolving Conditional Exports from a package."
> "Note that `import`, `require`, `default` conditions are always applied if the
> requirements are met."
`development|production` is special-cased and replaced based on NODE_ENV.

## config/shared-options.md — resolve.mainFields (Agent B territory)
Type: `string[]`, default `['browser', 'module', 'jsnext:main', 'jsnext']` (defaultClientMainFields)
> "List of fields in `package.json` to try when resolving a package's entry point.
> Note this takes lower precedence than conditional exports resolved from the
> `exports` field: if an entry point is successfully resolved from `exports`, the
> main field will be ignored."

## config/shared-options.md — resolve.extensions
Type: `string[]`, default `['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']`
> "List of file extensions to try for imports that omit extensions. Note it is
> **NOT** recommended to omit extensions for custom import types (e.g. `.vue`) since
> it can interfere with IDE and type support."

## config/shared-options.md — resolve.preserveSymlinks
Type: `boolean`, default `false`.
> "Enabling this setting causes vite to determine file identity by the original file
> path (i.e. the path without following symlinks) instead of the real file path
> (i.e. the path after following symlinks)."
Related docs linked from that section: esbuild#preserve-symlinks, webpack#resolve.symlinks
(cross-tool references only, not further quoted text found).

## config/shared-options.md — resolve.tsconfigPaths  (NEW — confirm this is real, corroborated
## twice independently plus by rolldown.rs; not marked Experimental in fetched text)
Type: `boolean`, default `false`.
> "Enables the tsconfig paths resolution feature. `paths` option in `tsconfig.json`
> will be used to resolve imports."
> "`paths` only applies to a file matched by a `tsconfig.json` through its `files` or
> `include`. Non-JS extension files should be explicitly listed in them, since a bare
> `"src"` or `"**/*"` `include` only matches TS/JS extensions, aligning with
> TypeScript's behavior."
> "Note that `resolve.tsconfigPaths` does not apply inside `.less` files."
(Search-engine snippet, independent of the two WebFetch calls, paraphrased the same
option existing: "TypeScript's paths setting informs TypeScript but does not
configure Vite, so you need to add resolve.alias, enable resolve.tsconfigPaths, or
use another resolver integration.")

## rolldown.rs/options/tsconfig — corroborates the above at the resolver level
> Rolldown's resolver uses `compilerOptions.paths` ("Path mapping for module
> resolution") and `compilerOptions.baseUrl` ("Base directory for path resolution").
Default `tsconfig: true` — auto-discovery, "search upward from the module's
directory, starting at the nearest tsconfig.json."
> "Rolldown respects `references` and `include`/`exclude` patterns in tsconfig,
> while esbuild does not."

## guide/migration.md ("Migration from v7" — this IS the v7→v8 guide)
Title: "# Migration from v7"
Opening: "If you are migrating from `rolldown-vite`, the technical preview release
for Rolldown integrated Vite for v6 & v7, only the sections with [marker] in the
title are applicable."
"Removed Module Resolution Using Format Sniffing":
> "When both `browser` and `module` fields are present in `package.json`, Vite used
> to resolve the field based on the content of the file and it used to pick the ESM
> file for browsers. This was introduced because some packages were using the
> `module` field to point to ESM files for Node.js and some other packages were
> using the `browser` field to point to UMD files for browsers. Given that the
> modern `exports` field solved this problem and is now adopted by many packages,
> Vite no longer uses this heuristic and always respects the order of the
> `resolve.mainFields` option."
"Other Related Deprecations" (full list):
> "The following options are deprecated and will be removed in the future:
> * `build.rollupOptions`: renamed to `build.rolldownOptions`
> * `worker.rollupOptions`: renamed to `worker.rolldownOptions`
> * `build.commonjsOptions`: it is now no-op
> * `build.dynamicImportVarsOptions.warnOnError`: it is now no-op
> * `resolve.alias[].customResolver`: Use a custom plugin with `resolveId` hook and
>   `enforce: 'pre'` instead"
Rolldown optimizer-option renames (esbuildOptions.* -> rolldownOptions.*):
- `esbuildOptions.resolveExtensions` -> `rolldownOptions.resolve.extensions`
- `esbuildOptions.mainFields` -> `rolldownOptions.resolve.mainFields`
- `esbuildOptions.conditions` -> `rolldownOptions.resolve.conditionNames`
- `esbuildOptions.preserveSymlinks` -> `!rolldownOptions.resolve.symlinks` (note the
  negation — Rolldown's own flag is `symlinks` (follow), Vite's is `preserveSymlinks`)

## guide/troubleshooting.md
"Outdated Pre-bundled Dependencies When Linking to a Local Package":
> "The hash key used to invalidate optimized dependencies depends on the package
> lock contents, the patches applied to dependencies, and the options in the Vite
> config file that affects the bundling of node modules. This means that Vite will
> detect when a dependency is overridden using a feature as npm overrides, and
> re-bundle your dependencies on the next server start. Vite won't invalidate the
> dependencies when you use a feature like npm link. In case you link or unlink a
> dependency, you'll need to force re-optimization on the next server start by using
> `vite --force`. We recommend using overrides instead, which are supported now by
> every package manager (see also pnpm overrides and yarn resolutions)."
"This package is ESM only" section covers CJS/ESM interop errors (not directly ours;
adjacent to dep pre-bundling topic, already covered in 11-optimization/01a).
No dedicated "duplicate package instance" or "symlink" section found beyond the
npm-link cache-key note above.

## guide/features.md
CSS section:
> "Vite is pre-configured to support CSS `@import` inlining via `postcss-import`.
> Vite aliases are also respected for CSS `@import`."
> "Vite improves `@import` resolving for Sass and Less so that Vite aliases are also
> respected." / "@import aliases and URL rebasing are also supported for Sass and
> Less files."
> "Rebasing `url()` references that start with a variable or an interpolation is not
> supported due to its API constraints." (Sass/Less)
> "`@import` alias and url rebasing are not supported for Stylus due to its API
> constraints."
> "In addition, all CSS `url()` references, even if the imported files are in
> different directories, are always automatically rebased to ensure correctness."
Glob Import Caveats:
> "The glob patterns are treated like import specifiers: they must be either
> relative (start with `./`) or absolute (start with `/`, resolved relative to
> project root) or an alias path (see `resolve.alias` option)."
HTML section:
> "HTML files stand front-and-center of a Vite project, serving as the entry points
> for your application."
> "Assets referenced by HTML elements such as `<script type="module" src>` and
> `<link href>` are processed and bundled as part of the app."
(No explicit statement found for `<img src>` specifically going through
resolve.alias — treat as unconfirmed / left uncertain on the page.)

## guide/assets.md
> Public dir: "Assets in this directory will be served at root path `/` during dev,
> and copied to the root of the dist directory as-is."
> "you should always reference `public` assets using root absolute path - for
> example, `public/icon.png` should be referenced in source code as `/icon.png`."
No explicit resolve.alias-in-HTML-attribute statement found on this page either.

## config/server-options.md — server.fs.allow / server.fs.strict
server.fs.strict: boolean, default `true` (enabled by default since Vite 2.7).
> "Restrict serving files outside of workspace root."
server.fs.allow: `string[]`.
> "Restrict files that could be served via `/@fs/`. When `server.fs.strict` is set to
> `true`, accessing files outside this directory list that aren't imported from an
> allowed file will result in a 403."
> "Both directories and files can be provided."
Auto workspace-root detection checks for `workspaces` field in package.json,
`lerna.json`, `pnpm-workspace.yaml`, or similar.
Example:
```js
export default defineConfig({
  server: { fs: { allow: ['..'] } },
})
```
`searchForWorkspaceRoot` example:
```js
import { defineConfig, searchForWorkspaceRoot } from 'vite'
export default defineConfig({
  server: {
    fs: {
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        '/path/to/custom/allow_directory',
        '/path/to/custom/allow_file.demo',
      ],
    },
  },
})
```
> "When `server.fs.allow` is specified, the auto workspace root detection will be
> disabled."

## config/dep-optimization-options.md
No occurrence of "dedupe" found on this page (checked directly).
optimizeDeps.force:
> "Set to `true` to force dependency pre-bundling, ignoring previously cached
> optimized dependencies."

## Cross-reference already landed in THIS repo (11-optimization-and-performance/01b)
Pre-bundle cache key (quoted there from guide/dep-pre-bundling):
> "Vite caches the pre-bundled dependencies in `node_modules/.vite`. It determines
> whether it needs to re-run the pre-bundling step based on a few sources:"
> * "Package manager lockfile content, e.g. `package-lock.json`, `yarn.lock`,
>   `pnpm-lock.yaml`, `bun.lock`, `aube-lock.yaml` or `nub.lock`."
> * "Patches folder modification time."
> * "Relevant fields in your `vite.config.js`, if present."
> * "`NODE_ENV` value."
Use this to explain: resolve.dedupe is exactly a "relevant field" in vite.config —
changing it is a config edit, which the cache-key description covers, but the docs
do not enumerate resolve.dedupe by name, so say that precisely.

## vite-tsconfig-paths (github.com/aleclarson/vite-tsconfig-paths, README)
> "Give `vite` the ability to resolve imports using TypeScript's path mapping."
```ts
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
export default defineConfig({ plugins: [tsconfigPaths()] })
```
> "If the `baseUrl` is defined, it gets prepended to all bare imports, and its
> resolution will take precedence over node_modules."
> "Config parsing no longer loads the TypeScript compiler, so projects can use
> TypeScript 7 without a peer dependency conflict." (v7 of the plugin)

## Things NOT confirmed / left uncertain
- Whether `<img src="...">` written directly in an HTML file is passed through
  `resolve.alias` — features.md and assets.md do not say so explicitly; only
  `<script type="module" src>` and `<link href>` are named as "processed and
  bundled." Page will state this as unconfirmed rather than assert either way.
- `resolve.alias[].customResolver` — migration.md lists it as deprecated with a
  replacement (`resolveId` hook + `enforce: 'pre'`); it does not state whether it is
  already removed in 8.2.2 or merely deprecated-but-functional. Page states it as
  deprecated, not confirmed-removed.
- Exactly which vite.config.js fields count as "relevant" to the pre-bundle cache
  hash is not enumerated by the docs; resolve.dedupe is treated as a reasonable
  inference, not a quoted fact.
