---
name: research-vite-v8-quotes
description: Verbatim primary-source quotes for the devbible vite track at Vite 8.2.2 — env/modes, loadEnv, define, envPrefix/envDir, HTML replacement, TS augmentation, plus the v8 Rolldown/Oxc migration lines. Fetched 2026-09-07. Write vite pages FROM this bank, do not re-fetch per chunk.
metadata:
  type: project
---

# Vite 8 research bank — fetched 2026-09-07

🔴 **vite.dev serves an LLM-optimised Markdown twin at `<path>.md`** — e.g.
`https://vite.dev/guide/env-and-mode.md`, `https://vite.dev/guide/migration.md`,
`https://vite.dev/config/shared-options.md`. Fetch **those**, not the HTML. The HTML page
literally says so at the top. `https://vite.dev/config/` has no `.md` twin (use the HTML).

## Version facts — `registry.npmjs.org`, 2026-09-07

| Package | latest | published |
|---|---|---|
| `vite` | **8.2.2** | 2026-08-20 (beta `8.3.0-beta.1`) |
| `rolldown` | 1.2.7 | 2026-09-02 |
| `rollup` | 4.63.1 | 2026-08-28 |
| `esbuild` | 0.28.2 | 2026-08-08 |
| `webpack` | 5.110.3 | 2026-09-01 |
| `@rspack/core` | 2.2.2 | 2026-09-01 |
| `@babel/core` | 8.0.1 | 2026-06-17 |
| `vitest` | 5.0.0 | 2026-09-03 |

🔴 **`vite@8.2.2` `dependencies` are `postcss`, `rolldown ~1.2.4`, `picomatch`,
`tinyglobby`, `lightningcss`.** Rollup is **not** a dependency; `esbuild ^0.27||^0.28` is
only an *optional peer*. That is the hard evidence that v8 unified on Rolldown — the
package manifest, not a blog post. `engines.node` is `^20.19.0 || >=22.12.0`.

## Env and modes — <https://vite.dev/guide/env-and-mode.md>

> *"Vite exposes certain constants under the special `import.meta.env` object. These constants are defined as global variables during dev and statically replaced at build time to make tree-shaking effective."*

Built-ins: `MODE` (string), `BASE_URL` (string, from `base`), `PROD` (boolean),
`DEV` (boolean, *"always the opposite of import.meta.env.PROD"*), `SSR` (boolean).

> *"Vite exposes env variables under the `import.meta.env` object as strings automatically."*

> *"Variables prefixed with `VITE_` will be exposed in client-side source code after Vite bundling. To prevent accidentally leaking env variables to the client, avoid using this prefix."*

🔴 The security callout — **the page's most load-bearing quote**:
> *"`VITE_*` variables should not contain sensitive information such as API keys. The values of these variables are bundled into your source code at build time. For production deployments, consider a backend server or serverless/edge functions to properly secure secrets."*

> *"As shown above, `VITE_SOME_KEY` is a number but returns a string when parsed. The same would also happen for boolean env variables. Make sure to convert to the desired type when using it in your code."*

### `.env` files

> *"Vite uses dotenv to load additional environment variables from the following files in your environment directory"* — `.env` (all cases) · `.env.local` (all cases, ignored by git) · `.env.[mode]` (only that mode) · `.env.[mode].local` (only that mode, ignored by git).

Priority, verbatim:
> *"An env file for a specific mode (e.g. `.env.production`) will take higher priority than a generic one (e.g. `.env`)."*
> *"Vite will always load `.env` and `.env.local` in addition to the mode-specific `.env.[mode]` file. Variables declared in mode-specific files will take precedence over those in generic files, but variables defined only in `.env` or `.env.local` will still be available in the environment."*
> *"In addition, environment variables that already exist when Vite is executed have the highest priority and will not be overwritten by `.env` files. For example, when running `VITE_SOME_KEY=123 vite build`."*

⚠️ **The docs never rank `.env.local` against `.env.[mode]`.** Do not assert a 4-way total
order — the corpus page that did was wrong to. State: process env > mode-specific >
generic, and say the local-vs-mode ranking is not documented.

> *"`.env` files are loaded at the start of Vite. Restart the server after making changes."*

> *"When using Bun, be aware that Bun automatically loads `.env` files before your script runs. This built-in behavior loads environment variables directly into `process.env` and can interfere with Vite's feature, as it respects existing `process.env` values."*

`dotenv-expand`:
> *"Vite uses dotenv-expand to expand variables written in env files out of the box."*
> *"Note that if you want to use `$` inside your environment value, you have to escape it with `\`."*
`NEW_KEY1=test$foo # test` · `NEW_KEY2=test\$foo # test$foo` · `NEW_KEY3=test$KEY # test123`
> *"Vite supports expanding variables in reverse order."* … *"it is recommended to avoid relying on this behavior. Vite may start emitting warnings for this behavior in the future."*

> *"`.env.*.local` files are local-only and can contain sensitive variables. You should add `*.local` to your `.gitignore`."*

### HTML constant replacement
> *"Any properties in `import.meta.env` can be used in HTML files with a special `%CONST_NAME%` syntax"*
> *"If the env doesn't exist in `import.meta.env`, e.g. `%NON_EXISTENT%`, it will be ignored and not replaced, unlike `import.meta.env.NON_EXISTENT` in JS where it's replaced as `undefined`."*

### TypeScript
> *"By default, Vite provides type definitions for `import.meta.env` in `vite/client.d.ts`."*
`ViteTypeOptions` with `strictImportMetaEnv: unknown` — *"you can make the type of ImportMetaEnv strict to disallow unknown keys."*
> *"If the `ImportMetaEnv` augmentation does not work, make sure you do not have any import statements in `vite-env.d.ts`."*

### NODE_ENV vs mode — the two tables, verbatim
> *"It's important to note that `NODE_ENV` (`process.env.NODE_ENV`) and modes are two different concepts."*

| Command | NODE_ENV | Mode |
|---|---|---|
| `vite build` | `"production"` | `"production"` |
| `vite build --mode development` | `"production"` | `"development"` |
| `NODE_ENV=development vite build` | `"development"` | `"production"` |
| `NODE_ENV=development vite build --mode development` | `"development"` | `"development"` |

| NODE_ENV | `import.meta.env.PROD` | `import.meta.env.DEV` |
|---|---|---|
| `production` | true | false |
| `development` | false | true |
| **`other`** | **false** | **true** |

> *"The main benefit with `NODE_ENV=...` in the command is that it allows Vite to detect the value early. It also allows you to read `process.env.NODE_ENV` in your Vite config as Vite can only load the env files once the config is evaluated."*

## `envPrefix` / `envDir` — <https://vite.dev/config/shared-options.md>

`envDir` — *Type:* `string | false`, *Default:* `root`.
> *"The directory from which `.env` files are loaded. Can be an absolute path, or a path relative to the project root. `false` will disable the `.env` file loading."*

`envPrefix` — *Type:* `string | string[]`, *Default:* `VITE_`.
> *"Env variables starting with `envPrefix` will be exposed to your client source code via `import.meta.env`."*

🔴 SECURITY NOTES callout, verbatim:
> *"`envPrefix` should not be set as `''`, which will expose all your env variables and cause unexpected leaking of sensitive information. Vite will throw an error when detecting `''`."*
> *"If you would like to expose an unprefixed variable, you can use define to expose it"* —
> ```js
> define: { 'import.meta.env.ENV_VARIABLE': JSON.stringify(process.env.ENV_VARIABLE) }
> ```

## `define` — same page

> *"Define global constant replacements. Entries will be defined as globals during dev and statically replaced during build."*
> *"Vite uses Oxc's define feature to perform replacements, so value expressions must be a string that contains a JSON-serializable value (null, boolean, number, string, array, or object) or a single identifier. For non-string values, Vite will automatically convert it to a string with `JSON.stringify`."*

## Config-time env — <https://vite.dev/config/>

> *"Environment variables available while the config itself is being evaluated are only those that already exist in the current process environment (`process.env`). Vite deliberately defers loading any `.env*` files until after the user config has been resolved because the set of files to load depends on config options like `root` and `envDir`, and also on the final mode."*
> *"variables defined in `.env`, `.env.local`, `.env.[mode]`, or `.env.[mode].local` are not automatically injected into `process.env` while your `vite.config.*` is running."*
> *"If, however, values from `.env*` files must influence the config itself (for example to set `server.port`, conditionally enable plugins, or compute `define` replacements), you can load them manually using the exported `loadEnv` helper."*
> *"Set the third parameter to `''` to load all env regardless of the `VITE_` prefix."* — `loadEnv(mode, process.cwd(), '')`

Conditional config signature: `defineConfig(({ command, mode, isSsrBuild, isPreview }) => …)`.
> *"Some tools that load the Vite config may not support these flags and will pass `undefined` instead. Hence, it's recommended to use explicit comparison against `true` and `false`."*

Config loader:
> *"By default, Vite uses Rolldown to bundle the config into a temporary file and load it."* … *"`configLoader: 'native'` is planned to become the default in a future major version."* Native needs *"Node.js 22.18+ for TypeScript files"*; bundle mode writes to `node_modules/.vite-temp`.

## v8 migration lines that touch this area — <https://vite.dev/guide/migration.md>

> *"Vite 8 uses Rolldown and Oxc based tools instead of esbuild and Rollup."*
- `esbuild.define` → `oxc.define`
- `esbuildOptions.define` → `rolldownOptions.transform.define`
- 🔴 > *"`define` does not share reference for objects: When you pass an object as a value to `define`, each variable will have a separate copy of the object."*
- > *"`import.meta.url` is no longer polyfilled in UMD / IIFE output formats. It will be replaced with `undefined` by default."*
- `build.rollupOptions` → `build.rolldownOptions` (old name kept as an alias)
- `output.manualChunks` object form **removed**, function form **deprecated**; replacement is Rolldown's `codeSplitting`.

## 🔴 Batch-3 banks — separate files, same rule: do NOT re-derive

Batch 3 (topics 12, 13, 14) bought four more banks rather than extending this one:

- [[research-vite-t12-resolve-aliases]] — aliasing. 🔴 **`resolve.tsconfigPaths` is a real
  first-party Vite 8 option** (`boolean`, default `false`) that reads `tsconfig.json`'s `paths`
  directly; it **does not apply inside `.less` files**.
- [[research-vite-t12-bare-specifiers]] + [[research-vite-t12-node-resolution]] — bare specifiers.
  🔴 **There is no `resolve.builtins` option.** Confirmed defaults: `resolve.extensions`
  `['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']` · `resolve.mainFields`
  `['browser', 'module', 'jsnext:main', 'jsnext']` · `resolve.conditions`
  `['module', 'browser', 'development|production']` · `resolve.preserveSymlinks` `false`.
- [[research-vitest-5-quotes-config]] + [[research-vitest-5-quotes-runtime]] — Vitest 5.0.0.

Two more facts bought in batch 3 and not in any bank file:

- 🔴 **`worker.format` defaults to `'iife'`, not `'es'`.** `worker.rollupOptions` is now
  `worker.rolldownOptions` (old name a deprecated alias); `worker.plugins` is a **factory**
  because worker builds run as parallel Rolldown worker builds.
- 🔴 **`vite --debug resolve` is not a documented namespace.** The real channel, read out of
  Vite's own resolve plugin source, is **`vite:resolve-details`**.

Related: [[cursor-a2-toolchain]] · [[devbible-locks]] · [[devbible-validation-ledger]] ·
[[cursor-vite]]
