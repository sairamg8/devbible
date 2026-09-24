---
name: research-nextjs-ch13-testing-dx
description: One-pass research bank for Next.js chapter 13 (Testing and Developer Experience) — every load-bearing sentence with its URL and lastUpdated date, gathered 2026-09-04. Covers the four Next.js testing guides, TypeScript/typedRoutes/typegen, the next CLI, Cache Components + Activity, Turborepo (caching, tasks, env modes, remote cache, CI), Zod 4.5, Vitest 5, Playwright 1.62.
metadata:
  type: project
  project: devbible
  language: nextjs
  chapter: 13
---

# nextjs ch13 research bank — gathered 2026-09-04

**How the docs were read.** `nextjs.org/docs/<path>.md` returns markdown with frontmatter.
`version:` in that frontmatter is the docs build (16.3.4 everywhere) — **cite `lastUpdated:`**,
the page's real review date. Paths were resolved through `https://nextjs.org/docs/sitemap.md`
first; a guessed path returns a readable "Page Not Found" body.
`turborepo.com/docs/<path>.md` also serves markdown (index at `turborepo.com/llms.txt`; there is
NO `/docs/sitemap.md`). `vitest.dev/<path>.md` serves markdown. `zod.dev` and `playwright.dev`
do **not** — those were read as HTML with tags stripped.

## Version spine (npm `latest`, fetched 2026-09-04)

| package | version |
|---|---|
| next | 16.3.4 docs build; 16.3 GA 2026-08-03; 16.3 Active LTS / 15.5 Maintenance LTS |
| react | 19.2.8 |
| typescript | **7.0.2** |
| vitest | **5.0.0** |
| jest | **30.5.1** |
| @playwright/test | **1.62.1** |
| @testing-library/react | **16.3.3** |
| zod | **4.5.4** |
| turbo | **2.10.12** |

🔴 `next` and `typescript` are NOT installed in the devbible checkout — no T1 probe possible.
`react` is installed at 19.2.8, Node is v24.20.0.

## Next.js testing guides

### Testing overview — /docs/app/guides/testing.md · lastUpdated 2026-02-03
- Four tools documented: Cypress, Playwright, Vitest, Jest.
- Five test types named: Unit, Component, Integration, E2E, Snapshot.
- **The load-bearing sentence** (verbatim, 27 words — trim before quoting):
  > "Since `async` Server Components are new to the React ecosystem, some tools do not fully support them. In the meantime, we recommend using **End-to-End Testing** over **Unit Testing** for `async` components."

### Vitest — /docs/app/guides/testing/vitest.md · lastUpdated 2026-08-25
- Good-to-know: "Vitest currently does not support them [async Server Components]. While you can
  still run **unit tests** for synchronous Server and Client Components, we recommend using
  **E2E tests** for `async` components."
- Deps (TypeScript): `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths`.
  JavaScript drops `vite-tsconfig-paths`.
- Config file is `vitest.config.mts` (or `.js`), `plugins: [tsconfigPaths(), react()]`, `test.environment: 'jsdom'`.
- `"test": "vitest"` — **watches by default**; CI needs `vitest run`.
- Example asserts `screen.getByRole('heading', { level: 1, name: 'Home' })`.
- Quickstart: `--example with-vitest`.
- Note: the guide's dep list predates Vitest 5 semantics (see Vitest 5 section below).

### Jest — /docs/app/guides/testing/jest.md · lastUpdated 2026-08-25
- Same async-Server-Component caveat.
- Deps: `jest jest-environment-jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom ts-node @types/jest`.
- `next/jest.js` transformer, `nextJest({ dir: './' })`, `createJestConfig(config)` exported
  "to ensure that next/jest can load the Next.js config which is async".
- What `next/jest` configures for you (verbatim list):
  * "Setting up `transform` using the Next.js Compiler."
  * "Auto mocking stylesheets (`.css`, `.module.css`, and their scss variants), image imports and `next/font`."
  * "Loading `.env` (and all variants) into `process.env`."
  * "Ignoring `node_modules` from test resolving and transforms."
  * "Ignoring `.next` from test resolving."
  * "Loading `next.config.js` for flags that enable SWC transforms."
- Path aliases are NOT handled: you must mirror `tsconfig` `paths` into `moduleNameMapper`.
- `@testing-library/jest-dom` v6 removed `extend-expect`; pre-6 imports `@testing-library/jest-dom/extend-expect`.
- Env-var good-to-know: "To test environment variables directly, load them manually in a separate
  setup script or in your `jest.config.ts` file."

### Playwright — /docs/app/guides/testing/playwright.md · lastUpdated 2026-08-25
- "We recommend running your tests against your production code to more closely resemble how your
  application will behave." → `npm run build` + `npm run start`, then `npx playwright test`.
- `webServer` named as the alternative that starts the dev server and waits.
- `baseURL` in `playwright.config.ts` lets you write `page.goto('/')`.
- CI: headless by default; `npx playwright install-deps`.

### Cypress — /docs/app/guides/testing/cypress.md · lastUpdated 2026-02-11 (fetched, not mined)

## Environment variables in tests — /docs/app/guides/environment-variables.md · lastUpdated 2026-08-25

§ Test Environment Variables:
- A third environment `test` exists alongside development and production; `.env.test` serves it.
- "Next.js will not load environment variables from `.env.development` or `.env.production` in the
  testing environment."
- 🔴 "`.env.local` won't be loaded, as you expect tests to produce the same results for everyone."
- "Test default values will be loaded if `NODE_ENV` is set to `test`, though you usually don't need
  to do this manually as testing tools will address it for you."
- `.env.test` **should** be committed; `.env.test.local` should not.
- To load env the way Next.js does inside a unit test runner:
  ```js
  import { loadEnvConfig } from '@next/env'
  export default async () => { loadEnvConfig(process.cwd()) }
  ```

## Server Actions — /docs/app/guides/server-actions.md · lastUpdated 2026-06-17

- "A Server Action runs as a POST request against the page that invokes it." `'use server'` makes
  the compiler swap the implementation in client bundles for an action ID + dispatcher.
- 🔴 "Render-time gating (only rendering a form on an authenticated page) is not a security
  boundary, because requests can be sent without going through the UI." → the authorization branch
  of every action is a unit-testable requirement.
- 🔴 "Schema validation (zod or similar) only checks the *shape* of the input. A well-formed `Item`
  object can still refer to a row the caller does not own." → shape test and ownership test are
  two different tests.
- Framework protections: Origin-vs-Host CSRF check (`serverActions.allowedOrigins`), 1MB body
  limit (`serverActions.bodySizeLimit`), encrypted action IDs + dead-code elimination, closure
  variable encryption (`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` for multi-instance).
- Cache updates after a mutation: `updateTag` (immediate, read-your-own-writes, Server Actions
  only), `revalidateTag` (stale-while-revalidate, does NOT wait), `revalidatePath`, `refresh`.
  "Unlike `redirect`, none of these throw."
- Safe/unsafe action pair worth adapting: take an ID plus the change, derive identity from the
  session, look up by ownership.

## TypeScript — /docs/app/api-reference/config/typescript.md · lastUpdated 2026-08-25

- TypeScript 7 "does not currently provide the JavaScript compiler API"; install `typescript@^7`.
- "Next.js uses the project-local `tsc` CLI by default, so no additional configuration is
  required." `experimental.useTypeScriptCli: false` asks for the JS compiler API instead.
  *(Owned by page 12 in this chapter — do not restate.)*
- CLI checking "prints the native `tsc` diagnostics. It does not apply Next.js-specific code frames
  or rewrite errors for routes, pages, layouts, or route handlers."
- "The CLI checks the complete project selected by your `tsconfig` file. This includes test files
  and `.next/dev/types` when they are included by that configuration."
- `--debug-build-paths` "does not narrow the files that are type checked and produces a warning
  when used with this option."
- Route-aware global helpers, no import needed, generated by `next dev`/`next build`/`next typegen`:
  `PageProps`, `LayoutProps`, `RouteContext`.
- `next-env.d.ts` is generated, an implementation detail, "Add it to `.gitignore`", must be in
  `tsconfig` `include`.
- **Statically typed links**: `typedRoutes: true`. Types `href` on `next/link` in both routers; in
  App Router also types `next/navigation` `push`, `replace`, `prefetch`. Does NOT type
  `next/router` (Pages Router). "Literal `href` strings are validated, while non-literal `href`s
  may require a cast with `as Route`."
- Generated into `.next/types`; if not scaffolded by `create-next-app`, add `.next/types/**/*.ts`
  to `include`.
- Wrapper component pattern: `function Card<T extends string>({ href }: { href: Route<T> | URL })`.
- Typed nav data: `export const navItems: NavItem<Route>[] = [...]`.
- Proxy redirects need `as Route` because the destination is not a file-system route.
- `experimental.typedEnv` generates env-var IntelliSense into `.next/types`; "Types are generated
  based on the environment variables loaded at development runtime, which excludes variables from
  `.env.production*` files by default."
- Async Server Components need TS >= 5.1.3 and `@types/react` >= 18.2.8, else
  `'Promise<Element>' is not a valid JSX element`.
- Incremental type checking supported since v10.2.1 when enabled in `tsconfig`.
- `typescript.tsconfigPath` selects a different config for `next dev`, `next build`, `next typegen`.
  Documented monorepo use: relax checks that shared dependencies fail, e.g.
  `tsconfig.build.json` with `"useUnknownInCatchVariables": false`. "In development, only
  `tsconfig.json` is watched for changes."
- `typescript.ignoreBuildErrors: true` skips the type-checking step entirely (including the CLI
  checker). Docs recommend `tsc --noEmit` in CI if you do.
- Custom declarations go in a new `.d.ts` added to `include`, never in `next-env.d.ts`.
- Version table: `v15.0.0` `next.config.ts`; `v13.2.0` statically typed links beta; `v12.0.0` SWC
  default; `v10.2.1` incremental type checking.

## typedRoutes — /docs/app/api-reference/config/next-config-js/typedRoutes.md · lastUpdated 2025-08-19
- "This option has been marked as stable, so you should use `typedRoutes` instead of
  `experimental.typedRoutes`." Requires TypeScript.

## next CLI — /docs/app/api-reference/cli/next.md · lastUpdated 2026-08-25

- Commands include `typegen`, `upgrade`, `experimental-analyze`.
- `next build` route table symbols are documented in the Building guide, not here.
- `--turbopack` is "enabled by default"; `--webpack` opts out (both `dev` and `build`).
- `next typegen`: "generates TypeScript definitions for your application's routes without
  performing a full build."
  ```bash
  next typegen && tsc --noEmit
  next typegen && npm run type-check
  next typegen ./apps/web        # monorepo: per-app
  ```
  Output to `<distDir>/types` — `.next/dev/types` in dev, `.next/types` in production. Also
  generates `next-env.d.ts`. "It is often undesirable to run these [dev/build] just to type-check,
  for example in CI/CD environments."
  Good-to-know: `next typegen` loads your Next.js config using the production build phase, so
  required env vars must be present.
- `next experimental-analyze`: analyzes bundle output with Turbopack, "Does not produce build
  artifacts." Serves a browser UI on port 4000 by default; `--output` writes to
  `.next/diagnostics/analyze` for archiving/diffing. Shows the full import chain and traces
  server-to-client boundaries.
- `next upgrade [directory] --revision <rev> --verbose`.
- 🔴 Version history table:
  | `v16.1.0` | Add the `next upgrade` command |
  | `v16.1.0` | Add the `next experimental-analyze` command |
  | **`v16.0.0` | The JS bundle size metrics have been removed from `next build`** |
  | `v15.5.0` | Add the `next typegen` command |
  | `v15.4.0` | Add `--debug-prerender` |

## Building — /docs/app/guides/building.md · lastUpdated (fetched 2026-09-04)

- Six build phases: Setup → Route discovery → Compilation → Static analysis → Prerendering →
  Output. "Type checking runs in parallel" with compilation.
- Route table symbols: `○` Static · `◐` Partial Prerender · `●` SSG · `ƒ` Dynamic.
- "Cache Components adds `◐` Partial Prerender and makes Partial Prerendering the default
  rendering model." A route shows `ƒ` "only when it has nothing to prerender".
- 🔴 "The symbol reflects what the route does at prerender time, not which validation configs
  (such as `instant`) it exports."
- Prerender-blocking error text (real, from the docs, safe to quote inline as a phrase):
  `blocking-prerender-dynamic` / `blocking-prerender-runtime`; three documented fixes —
  `[stream]` wrap in `<Suspense>`, `[cache]` `"use cache"`, `[block]` `export const instant = false`.
- `--debug-prerender` for better stack traces.

## cacheComponents — /docs/app/api-reference/config/next-config-js/cacheComponents.md · lastUpdated 2026-06-22

- `cacheComponents: true`. "Next.js prerenders a static HTML shell that is served immediately while
  dynamic content streams in when ready."
- "`cacheComponents` implements **Partial Prerendering (PPR)** as the default behavior in the App
  Router. This means the `experimental.ppr` configuration flag and the `experimental_ppr` route
  segment configuration are no longer necessary and have been removed."
- Requires the Node.js runtime; `runtime = 'edge'` routes must migrate.
- 🔴 **Navigation with Activity**: with `cacheComponents`, Next.js uses React `<Activity>` to
  preserve state across client navigation — the previous route is set to `"hidden"` rather than
  unmounted. Effects are cleaned up when hidden and recreated when visible. Heuristics keep a few
  recent routes hidden and drop older ones.
- Version history: 16.0.0 introduced, unifying `ppr`, `useCache`, `dynamicIO`.

## Preserving UI state / Activity — /docs/app/guides/preserving-ui-state.md · lastUpdated 2026-07-01

🔴 The single most important E2E fact in this chapter. § Testing:
- "Hidden Activity content has `display: none` but remains in the document. This applies both to
  routes preserved by Cache Components and to content you hide with `<Activity>` directly."
- Three named consequences: "DOM queries can find hidden elements." / "Interactions with hidden
  elements fail or timeout." / "Assertions may match hidden content."
- "In Playwright, `getByRole` queries automatically filter by visibility." Same for `getByLabel`,
  `getByPlaceholder`.
- Fallback: `page.locator('.product-card').filter({ visible: true })`.
- "`getByRole` … queries the accessibility tree, which excludes hidden elements."
- Cypress equivalent: `.should('be.visible')` or `{ visible: true }`.

## transpilePackages — /docs/app/api-reference/config/next-config-js/transpilePackages.md · lastUpdated 2026-05-27

- 🔴 "Turbopack transpiles workspace packages (npm, pnpm, or Yarn workspaces) in your monorepo
  automatically under both routers. Webpack does the same for the App Router." → the classic
  monorepo `transpilePackages` advice is mostly obsolete in 16.
- You still need it when: a `node_modules` dependency ships raw TS/JSX; webpack + Pages Router with
  source outside the app dir; Pages Router wanting a `node_modules` dep bundled into the route.
- "A package cannot appear in both `transpilePackages` and `serverExternalPackages`; Next.js throws
  at build start if it does."
- `optimizePackageImports` entries and `default-transpiled-packages.json` are added automatically.
- Values are package names only — "Paths and glob patterns are not supported."
- Replaces `next-transpile-modules`. Added `v13.0.0`.

## output / file tracing — /docs/app/api-reference/config/next-config-js/output.md · lastUpdated 2025-10-08

- `output: 'standalone'` → `.next/standalone` + a minimal `server.js`; `public` and `.next/static`
  are NOT copied (CDN assumption) and must be copied manually if `server.js` serves them.
- 🔴 "While tracing in monorepo setups, the project directory is used for tracing by default. For
  `next build packages/web-app`, `packages/web-app` would be the tracing root and any files outside
  of that folder will not be included." → set `outputFileTracingRoot: path.join(__dirname, '../../')`.
- "In a monorepo, `project root` refers to the Next.js project root (the folder containing
  next.config.js, e.g., packages/web-app), not necessarily the monorepo root."

## Turborepo (turborepo.com/docs)

### Configuring tasks — /docs/crafting-your-repository/configuring-tasks.md
- "Turborepo will search your packages for **scripts in their `package.json` that have the same
  name as the task**."
- `"build": {}` alone is marked **"Incorrect!"** in the docs — no ordering, no cached outputs.
- `dependsOn: ["^build"]` — `^` = the task in *direct dependencies* runs first.
- `dependsOn: ["build"]` (no caret) = same package. `dependsOn: ["utils#build"]` = specific package.
  `"web#lint": { "dependsOn": ["utils#build"] }` scopes both sides.
- 🔴 outputs: "**Without this key defined, Turborepo will not cache any files. Hitting cache on
  subsequent runs will not restore any file outputs.**"
  Next.js recommended value: `[".next/**", "!.next/cache/**", "!.next/dev/**"]`.
  tsc/Vite: `["dist/**"]`. Globs are package-relative.
- `inputs` defaults to all Git-tracked files in the package. Setting `inputs` "opts out of all of
  Turborepo's default `inputs` behavior, including following along with changes tracked by source
  control. This means that your `.gitignore` file will no longer be respected."
  Restore with the `$TURBO_DEFAULT$` microsyntax: `["$TURBO_DEFAULT$", "!README.md"]`.
- Deferred hashing: structured `inputs` with `mode: "jit"` or `mode: "dependencyOutputs"` for files
  produced by another task in the same run.
- Root tasks: `"//#lint:root": {}`, run as `turbo run lint:root` or `turbo run //#lint:root`.
- Package Configurations = a `turbo.json` inside a package.

### Caching — /docs/crafting-your-repository/caching.md
- "Turborepo assumes that your tasks are **deterministic**."
- Local cache lives in `.turbo/cache`.
- Two hashes: a **global hash** and a **task hash**; either changing misses cache.
- Global hash inputs: resolved task definitions from root + package `turbo.json`; lockfile changes
  affecting the workspace root; **source files of internal packages the workspace root depends on**;
  `globalDependencies` file contents; values of `globalEnv` variables; behaviour-changing flags
  (`--cache-dir`, `--framework-inference`, `--env-mode`); arbitrary passthrough args
  (`turbo build -- --arg=value` misses cache for **all** tasks).
- 🔴 Root workspace dependency closure: "if the root package depends on `@repo/tooling`, changing a
  source file in `@repo/tooling` causes every cacheable task to miss cache."
  `turbo query affected --packages` reports this as `RootInternalDepChanged`.
- Package hash inputs: package `turbo.json`, lockfile changes affecting the package, the package's
  `package.json`, and file changes (default: all source-controlled files in the package dir).
- Logs are always captured and replayed — "Turborepo treats logs as artifacts, so be aware of what
  you are printing to the console."
- Git worktree cache sharing is automatic and is **disabled** if you set an explicit `cacheDir`.
  Warning: "Cache artifacts are restored without rewriting their contents" — an output containing
  an absolute worktree path can be restored into the wrong checkout.
- Debugging: `--dry` and `--summarize` (diff two run summaries to see which input differed).
- `"cache": false` per task, `--force` disables cache *reading* not writing.
- Caching can be slower than executing: very fast tasks, enormous artifacts, tools with their own cache.

### Remote caching — /docs/core-concepts/remote-caching.md
- Default is local-only: "the same task (`turbo run build`) must be **re-executed on each machine**".
- `turbo login` then `turbo link`. Vercel Remote Cache is the zero-config default and is free on all
  plans "even if you do not host your applications on Vercel". Self-hosting documented via the
  Remote Cache API (OpenAPI spec at /docs/openapi.md).

### Constructing CI — /docs/crafting-your-repository/constructing-ci.md
- CI needs `TURBO_TOKEN` (bearer token) and `TURBO_TEAM` (account/team slug).
- 🔴 "Filtering using source control changes is only possible when history is available on the
  machine. If you are using shallow clones, history will not be available."
- `turbo run build --affected`; in GitHub Actions it reads `GITHUB_BASE_REF`, falling back to
  `GITHUB_EVENT_PATH` on push events.
- `turbo query affected --packages web` → JSON; `jq '.data.affectedPackages.length'`.
  `turbo query affected --tasks test --packages docs` respects `inputs`.
  `--exit-code`: 1 when results found, 0 when nothing affected, 2 on errors.
  Reasons include `FileChanged`, `DependencyChanged`, `RootInternalDepChanged`.
  "A clone with sufficient history is necessary for comparisons — if the checkout is too shallow,
  all packages will be considered changed." Suggested: `--filter=blob:none --depth=0`.
- 🔴 "**pin your global installation of `turbo` in CI to the major version in `package.json`**".
- Use `turbo run <task>` not `turbo <task>` in CI to avoid future subcommand collisions.
- Troubleshooting: "If your task is **passing when you miss cache but failing when you hit cache**,
  you likely haven't configured the `outputs` key for your task correctly."
- "If you haven't defined the `env` or `globalEnv` keys for your task, Turborepo will not be able to
  use them when creating hashes. This means your task can hit cache despite being in a different
  environment."

### Environment variables — /docs/crafting-your-repository/using-environment-variables.md
- `globalEnv` changes the hash of all tasks; `env` is per-task.
- 🔴 **Framework inference** adds prefix wildcards automatically. Next.js → `NEXT_PUBLIC_*`.
  (Vite `VITE_*`, CRA `REACT_APP_*`, Astro/SvelteKit `PUBLIC_*`, etc.) "Framework inference is
  per-package." Opt out with `--framework-inference=false` or `"env": ["!NEXT_PUBLIC_*"]`.
- **Strict Mode is the default**: only variables listed in `env`/`globalEnv` reach the task runtime.
  Caveat: "it doesn't guarantee task failure. If your application is able to gracefully handle a
  missing environment variable, you could still successfully complete tasks and get unintended
  cache hits."
- Strict Mode also filters CI-vendor variables until you account for them.
- `passThroughEnv` / `globalPassThroughEnv`: available at runtime, **not** hashed.
- Loose Mode (`--env-mode=loose`) is the migration path and is exactly how you ship a preview build
  to production from cache.
- 🔴 "**Turborepo does not load .env files into your task's runtime**" — that is the framework's job.
  Add them to hashing yourself: `globalDependencies: [".env"]` or
  `inputs: ["$TURBO_DEFAULT$", ".env*"]`.
- Best practice: `.env` in application packages, not the repo root.
- `eslint-config-turbo` finds env vars used in code but missing from `turbo.json`.
- "Turborepo hashes the environment variables for your task at the beginning of the task" — mutating
  them during the task is invisible to the hash.

### Internal packages — /docs/core-concepts/internal-packages.md
- Three strategies: **Just-in-Time**, **Compiled**, **Publishable**.
- JIT package: `exports` points at `./src/button.tsx` directly, no `build` script.
  Tradeoffs: only works when the consumer transpiles; **no TypeScript `compilerOptions.paths`**
  (use Node.js subpath imports instead); 🔴 "**Turborepo cannot cache a build for a Just-in-Time
  Package**" because it has no build step; "Errors in internal dependencies will be reported" —
  type-checking a dependent fails on errors inside the dependency's source.
- Compiled package: `"build": "tsc"`, `exports` with `types` → src and `default` → `dist`; outputs
  become cacheable once listed in `outputs`.
- "The majority of Compiled Packages should use `tsc`" — a bundler only for specific needs.

### Jest guide — /docs/guides/tools/jest.md
- Install the runner into each package that has tests, add a `test` script per package,
  `"tasks": { "test": {} }` at the root.
- 🔴 Watch mode never exits → "we recommend specifying **two separate Turborepo tasks**":
  `"test": {}` and `"test:watch": { "cache": false, "persistent": true }`.
- VS Code Jest extension breaks on Turborepo's log prefix → `turbo run test --log-prefix=none --`.

### Vitest guide — /docs/guides/tools/vitest.md
- Two models with different tradeoffs: per-package tasks (cacheable, but you must merge coverage
  yourself) vs Vitest's Projects feature.
- Per-package task shape uses a `transit` task:
  `{"test": {"dependsOn": ["transit"]}, "transit": {"dependsOn": ["^transit"]}}`.
- 🔴 Projects mode: "there aren't package boundaries … This means you can't rely on Turborepo's
  caching, since Turborepo leans on those package boundaries." You need Root Tasks
  (`"//#test": { "outputs": ["coverage/**"] }`), and "**the file inputs for a Root Task include all
  packages by default, so any change in any package will result in a cache miss.**"
- Project-level configs in the `projects` array "cannot extend the root config's `test` object
  directly" — share via an imported config package.
- `vitest run --project=web` filters projects.
- Hybrid: a `@repo/vitest-config` package for local Projects + per-package tasks in CI.

### Playwright guide — /docs/guides/tools/playwright.md
- "We recommend creating a Playwright package for each test suite that you'd like to run."
- 🔴 `PLAYWRIGHT_*` belongs in `passThroughEnv`/`globalPassThroughEnv`, not `env`: "we don't want to
  miss cache in situations where these Playwright-internal variables change" —
  `PLAYWRIGHT_BROWSERS_PATH` is the named example.
- Two caching requirements: suite changes must miss cache (free), and **changes in the code under
  test must miss cache** (not free) — express it by making the e2e package depend on the app
  (`"web": "workspace:*"`) and the task `dependsOn: ["^build"]`.
- Then run with `--only` to skip rebuilding:
  `turbo run e2e --filter=@repo/playwright-myapp --only`.
- Shared helpers package should use `peerDependencies` on playwright.

### Next.js framework guide — /docs/guides/frameworks/nextjs.md
- `create-next-app` into `apps/my-app`; add internal packages with `"@repo/ui": "workspace:*"`.
- Package Configurations for per-app task overrides.
- Microfrontends: child apps must set `basePath`.

## Vitest 5.0 — vitest.dev/guide/migration.md

🔴 Prerequisites: **Vite >= 6.4.0 and Node.js >= 22.12.0**. Older versions "not supported".
Changes that silently alter existing suites:
- `clearMocks` now defaults to **true** — `vi.clearAllMocks()` before every test. Mocks recording
  calls in a setup file, at module top level or in `beforeAll` are the ones that break.
- `testNamePattern` / `-t` matches the `' > '`-joined full name, not space-joined (Jest-style).
- 🔴 `vi.mock`, `vi.unmock`, `vi.hoisted` inside a function/block/`describe` now **throw** instead of
  warning. `vi.doMock` / `vi.doUnmock` are not hoisted and may be called anywhere.
- 🔴 Unawaited async assertions (`resolves`, `rejects`, `toMatchFileSnapshot`) now **fail** the test;
  v4 auto-awaited them with a warning.
- `expect.poll` now rejects on timeout and passes an `AbortSignal` to the callback.
- Automocked modules in browser mode now return `undefined` rather than the real implementation;
  `{ spy: true }` restores call-through.
- Class mocks keep prototype methods; locators are strict by default; `toHaveTextContent` is now
  strict equality; `toThrow("")` matches any message.
- Config files are no longer looked up from parent directories — `vitest --config ../vitest.config.ts`
  plus `--dir`.
- Artifacts consolidated under a single `.vitest/` directory: `json` and `junit` reporters now
  **write files instead of printing to stdout** (`.vitest/json/output.json`,
  `.vitest/junit/output.xml`); opt back in with `reporters: [['json', { stdout: true }]]`.
- Inline projects inherit the root config by default; inline projects share the Vite server.
- Removed: `test.sequential` / `describe.sequential`; entrypoints `vitest/coverage`,
  `vitest/reporters`, `vitest/environments`, `vitest/snapshot`, `vitest/runners`, `vitest/suite`,
  `vitest/mocker`. `@vitest/runner` and `@vitest/ws-client` deprecated; `vitest` no longer depends
  on `@vitest/expect`.
- Worker and concurrency ids are 1-based.

## Playwright 1.62 — playwright.dev (HTML)

### webServer — /docs/test-webserver
- `command`, `url`, `reuseExistingServer: !process.env.CI`, `stdout`, `stderr`, `cwd`, `env`,
  `gracefulShutdown`, `ignoreHTTPSErrors`, `name`, `timeout` (default **60000**).
- `port` is **deprecated** — use `url`.
- `reuseExistingServer: false` "will throw if an existing process is listening on the port or url".
- `env` "Defaults to inheriting `process.env` with `PLAYWRIGHT_TEST=1` added."
- `url` is considered ready on 2xx, 3xx, 400, 401, 402 or 403.

### Auth — /docs/auth
- Store state under `playwright/.auth`, gitignored. "The browser state file may contain sensitive
  cookies and headers that could be used to impersonate you or your test account."
- Setup project: `{ name: 'setup', testMatch: /.*\.setup\.ts/ }`, other projects declare
  `dependencies: ['setup']` and `use: { storageState: authFile }`.
- `await page.context().storageState({ path: authFile })`.
- "Wait until the page receives the cookies … Sometimes login flow sets cookies in the process of
  several redirects. Wait for the final URL to ensure that the cookies are actually set."
- Shared-account state is **not** appropriate when tests mutate server-side state, or when auth is
  browser-specific.

### Best practices — /docs/best-practices
- "avoid relying on implementation details such as … the CSS class of some element."
- Locators "come with auto waiting and retry-ability … ensuring the element is visible and enabled
  before it performs the click."
- 🔴 Web-first assertions retry; `expect(await locator.isVisible()).toBe(true)` "won't wait a single
  second, it will just check the locator is there and return immediately."
- Chaining/filtering: `page.getByRole('listitem').filter({ hasText: 'Product 2' })`.
- Third-party: `page.route('**/api/...', route => route.fulfill({ status: 200, body: testData }))`.
- Test isolation: own local storage, session storage, cookies per test.

## Zod 4.5.4 — zod.dev

### Basics — zod.dev/basics
- `.parse` returns "a strongly-typed **deep clone** of the input"; throws `ZodError` with
  `error.issues` (each has `code`, `path`, `message`, and for type errors `expected`).
- `.safeParse` returns a **discriminated union** `{ success: true, data } | { success: false, error }`.
- `.parseAsync` / `.safeParseAsync` required for async refinements or transforms.
- 🔴 `.validate()` (and top-level `z.validate(schema, data)`, the `zod/mini` form) returns a boolean,
  "never builds an error, and acts as a type guard on the schema's input type. On invalid input it
  is up to 16x faster than `.safeParse().success`."
- `z.infer<typeof Schema>`; when `.transform()` diverges input from output, `z.input<>` and
  `z.output<>` (`z.output` === `z.infer`).

### Error formatting — zod.dev/error-formatting
- `z.strictObject` produces an `unrecognized_keys` issue with `message: 'Unrecognized key: "extraKey"'`
  and `path: []`.
- `z.treeifyError(err)` → `{ errors, properties, items }`, mirrors the schema; needs optional chaining.
- `z.prettifyError(err)` → human-readable multi-line string.
- `z.flattenError(err)` → `{ formErrors: string[], fieldErrors: Record<string, string[]> }`;
  "the majority of schemas are flat — just one level deep."
- `z.formatError()` is **deprecated**; use `z.treeifyError()`.

## What the docs do NOT settle (state as uncertain or leave out)

1. **Testing Server Actions directly.** No Next.js guide covers importing a `'use server'` module
   into Jest/Vitest and calling the exported function. The mechanism (an action is an exported async
   function; the directive only changes how *client* bundles reference it) is documented in the
   Server Actions guide, but the testing recipe is not. Present it as reasoning from the documented
   mechanism, not as a documented recipe.
2. **Mocking `next/navigation`** in RTL component tests — no official guidance exists.
3. **Whether Playwright's `instant()` helper is affected by Activity-hidden DOM** — not stated
   anywhere. Do not claim either way.
4. **Coverage thresholds / recommended numbers** — nothing official; do not invent a target.
5. **Whether `next/jest` supports Jest 30 specifically** — the guide pins no Jest version.
6. **Vitest 5 compatibility of the Next.js Vitest guide's dependency list** — the Next.js guide has
   `lastUpdated: 2026-08-25` and does not mention Vitest 5's Node 22.12 / Vite 6.4 floor. Say the
   floor exists (sourced to Vitest) without claiming the Next.js guide is wrong.

## Chapter cross-links already written (do NOT re-teach)

- `10-the-instant-playwright-helper.md` — `instant()` from `@next/playwright`, two test shapes,
  assertion discipline.
- `10b-instant-tests-in-ci-and-regression-causes.md` — `exposeTestingApiInProductionBuild`,
  no prefetch in `next dev`, the localhost cookie collision, regression causes.
- `12-typescript-7-and-build-type-checking.md` — TS 7, `experimental.useTypeScriptCli` as an
  opt-OUT, `tsc` CLI as the default checker, `ignoreBuildErrors`, `tsconfigPath`.
- `13-linting-after-next-lint.md` — `next lint` removal, `next build` no longer lints, the
  `next-lint-to-eslint-cli` codemod, ESLint vs Biome, flat config, `AGENTS.md`.

---

# Fork B addendum — gathered 2026-09-04 (pages 03/04/05 of ch13)

🔴 **`turborepo.com` now 301-redirects to `turborepo.dev`.** The Turborepo section above cites
`turborepo.com` paths; they still resolve, but cite `turborepo.dev` in new pages.

## TypeScript compiler options — typescriptlang.org

### `strict` — /tsconfig/strict.html
> "The `strict` flag enables a wide range of type checking behavior that results in stronger
> guarantees of program correctness. Turning this on is equivalent to enabling all of the
> *strict mode family* options, which are outlined below. You can then turn off individual
> strict mode family checks as needed."

> "Future versions of TypeScript may introduce additional stricter checking under this flag, so
> upgrades of TypeScript might result in new type errors in your program. When appropriate and
> possible, a corresponding flag will be added to disable that behavior."

The nine strict-family flags, each documented as `Default: true if strict; false otherwise`
(handbook /docs/handbook/compiler-options.html):
`noImplicitAny`, `noImplicitThis`, `alwaysStrict`, `strictBindCallApply`,
`strictBuiltinIteratorReturn`, `strictFunctionTypes`, `strictNullChecks`,
`strictPropertyInitialization`, `useUnknownInCatchVariables`.
🔴 `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`,
`noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature` are
**not** in the family — `strict: true` leaves them off.

### `noUncheckedIndexedAccess` — /tsconfig/noUncheckedIndexedAccess.html
> "TypeScript has a way to describe objects which have unknown keys but known values on an
> object, via index signatures."
> "Turning on `noUncheckedIndexedAccess` will add `undefined` to any un-declared field in the type."
Doc example uses `interface EnvironmentVars { NAME: string; OS: string; [propName: string]: string }`
→ `env.NODE_ENV` is `string` without the flag, `string | undefined` with it.
The page states no default and no "released in" version.

### `exactOptionalPropertyTypes` — /tsconfig/exactOptionalPropertyTypes.html
> "With `exactOptionalPropertyTypes` enabled, TypeScript applies stricter rules around how it
> handles properties on `type` or `interfaces` which have a `?` prefix."
> "`colorThemeOverride: undefined` is not the same as `colorThemeOverride` not being defined."
> "`\"colorThemeOverride\" in settings` would have different behavior with `undefined` as the key
> compared to not being defined."
Error text shown in the docs:
`Type 'undefined' is not assignable to type '"dark" | "light"' with 'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the type of the target.`

### `verbatimModuleSyntax` — /tsconfig/verbatimModuleSyntax.html
> "By default, TypeScript does something called *import elision*."
> "Any imports or exports without a `type` modifier are left around. Anything that uses the
> `type` modifier is dropped entirely."
> "With this new option, what you see is what you get."
Doc example:
```ts
// Erased away entirely.
import type { A } from "a";
// Rewritten to 'import { b } from "bcd";'
import { b, type c, type d } from "bcd";
// Rewritten to 'import {} from "xyz";'
import { type xyz } from "xyz";
```
Emitting CommonJS under the flag requires TS's pre-ES2015 module syntax or "you'll get an error".

## Next.js `page.js` — /docs/app/api-reference/file-conventions/page.md · lastUpdated 2026-06-09

- `params: Promise<{ slug: string }>`;
  `searchParams: Promise<{ [key: string]: string | string[] | undefined }>` — verbatim from the doc's
  own example.
- `/shop?a=1&a=2` → `Promise<{ a: ['1', '2'] }>` — a repeated key becomes an array.
- > "`searchParams` is a plain JavaScript object, not a `URLSearchParams` instance."
- > "`searchParams` is a **Request-time API** whose values cannot be known ahead of time. Using it
  > will opt the page into **dynamic rendering** at request time."
- PageProps helper: `export default async function Page(props: PageProps<'/blog/[slug]'>)`.
  > "Using a literal route (e.g. `'/blog/[slug]'`) enables autocomplete and strict keys for `params`."
  > "Static routes resolve `params` to `{}`."
  > "Types are generated during `next dev`, `next build`, or with `next typegen`."
  > "After type generation, the `PageProps` helper is globally available. It doesn't need to be imported."
- Version history: `v15.0.0-RC` — params and searchParams became promises.

## Next.js TypeScript config — /docs/app/api-reference/config/typescript.md · lastUpdated 2026-08-25
(supplements the entry above with exact code)

- `import type { Route } from 'next'` is the import for the `Route` type.
- > "Works in both the Pages and App Router for the `href` prop in `next/link`. In the App Router,
  > it also types `next/navigation` methods like `push`, `replace`, and `prefetch`. It does not type
  > `next/router` methods in Pages Router."
- > "Literal `href` strings are validated, while non-literal `href`s may require a cast with `as Route`."
- > "Next.js will generate a link definition in `.next/types` that contains information about all
  > existing routes in your application"
- tsconfig `include` must contain `".next/types/**/*.ts"` if not scaffolded by `create-next-app`.
- Wrapper generic: `function Card<T extends string>({ href }: { href: Route<T> | URL })`.
- `NavItem<Route>[]` data-structure pattern.
- Proxy redirect destinations need `as Route`.
- `typedEnv`: > "Types are generated based on the environment variables loaded at development
  runtime, which excludes variables from `.env.production*` files by default. To include
  production-specific variables, run `next dev` with `NODE_ENV=production`."
- Route-aware global helpers `PageProps`, `LayoutProps`, `RouteContext` — "available without imports".
- `tsconfigPath` monorepo rationale, verbatim:
  > "You might need to relax checks in scenarios like monorepos, where the build also validates
  > shared dependencies that don't match your project's standards"
- > "In development, only `tsconfig.json` is watched for changes."
- `next-env.d.ts`: "Add it to `.gitignore`", regenerated by dev/build/typegen, never edit.
- Custom declarations go in a new `.d.ts` added to `include`.

## Zod 4.5.4 — zod.dev/api

- > "The coerced variant of these schemas attempts to convert the input value to the appropriate type."
  `z.coerce.string()` → `String(input)`, `.number()` → `Number(input)`, `.boolean()` → `Boolean(input)`,
  `.bigint()` → `BigInt(input)`.
- 🔴 `z.coerce.boolean()` is `Boolean(input)` — `"false"` is truthy. Use `z.stringbool()`, which
  accepts `"true"/"1"/"yes"/"on"/"y"/"enabled"` and `"false"/"0"/"no"/"off"/"n"/"disabled"`,
  case-insensitive by default.
- `z.strictObject()` "throws an error when unknown keys are found"; `z.looseObject()` "allows
  unknown keys to pass through"; the default object schema **strips** unknown keys.
- > "Use `z.enum` to validate inputs against a fixed set of allowable *string* values."

## Turborepo 2.10.12 — turborepo.dev

### /docs/reference/run.md
- `--filter` — > "Specify targets to execute from your repository's graph. Multiple filters can be
  combined to select distinct sets of targets."
- `--only` — > "Restricts execution to include specified tasks only."
- `--force` — > "Ignore existing cached artifacts and re-execute all tasks."
- `--dry` — > "Instead of executing tasks, display details about the packages and tasks that would be run."
- `--affected` — > "Filter to only packages that are affected by changes on the current branch."
- `--parallel` — > "Run commands in parallel across packages, ignoring the task dependency graph."
- `--concurrency` — integer >= 1 or a percentage like `50%`.
- `--log-prefix` — controls the `<package>:<task>:` prefix.
- Filter microsyntax: name (`--filter=ui`), directory (`--filter=./apps/*`), git specifier
  (`--filter=[HEAD^1]`), `!` negation, `...` for dependents/dependencies, `^` to omit the target.
  Documented examples: `--filter=...[origin/my-feature]`, `--filter=@acme/ui...[HEAD^1]`,
  `--filter=./apps/* --filter=!./apps/admin`, `--filter=@acme/*{./packages/*}[HEAD^1]`.

### /docs/reference/configuration.md
- `globalDependencies` — > "A list of globs that you want to include in all task hashes. If any file
  matching these globs changes, all tasks will miss cache."
- `globalEnv` — > "A list of environment variables that you want to impact the hash of all tasks.
  Any change to these environment variables will cause all tasks to miss cache."
- `cacheDir` default `".turbo/cache"`; `envMode` default `"strict"`.
- `cache` (default `true`) — > "Defines if task outputs should be cached. Setting `cache` to false is
  useful for long-running development tasks."
- `persistent` (default `false`) — > "Label a task as `persistent` to prevent other tasks from
  depending on long-running processes."
- `interactive` default `false` but `true` for persistent tasks; `interruptible` lets `turbo watch`
  restart a persistent task; `outputLogs` ∈ `full | hash-only | new-only | errors-only | none`;
  `with` — > "A list of tasks that will be ran alongside this task".
- `remoteCache`: `enabled` (true), `signature` (false), `preflight` (false), `timeout` 30s,
  `uploadTimeout` 60s, plus `apiUrl`/`loginUrl`/`teamId`/`teamSlug`.

## Vitest 5 coverage — vitest.dev/guide/coverage.md and /config/coverage
- Default provider is `v8`; enable with `--coverage` or `coverage.enabled: true`.
- 🔴 By default only files **touched by tests** appear; set `coverage.include` (e.g.
  `['src/**/*.{ts,tsx}']`) to count untested source files. `coverage.exclude` filters within it.
- `coverage.reporter` defaults to `['text', 'html', 'clover', 'json']`.
- `thresholds.lines/functions/branches/statements` are global thresholds;
  `thresholds.perFile` — "each file is checked against the top-level thresholds instead of the
  project-wide aggregate"; `thresholds.autoUpdate` rewrites the config when coverage improves;
  `thresholds.100` is a shortcut for all four at 100. Glob keys set thresholds for matching files.

## Still NOT settled (Fork B)
7. **A recommended coverage percentage.** Vitest documents the mechanism; no source states a number.
   State thresholds as a ratchet, never quote a target as authoritative.
8. **Whether `noUncheckedIndexedAccess` interacts specially with Next's generated route types.**
   Not documented. Do not claim.
9. **Turborepo's own release version history for `pipeline` → `tasks`.** The current configuration
   reference documents `tasks` only; the rename is not restated on that page. Say "`tasks` is the
   current key" and do not date the rename.

## 🔴 T1 probe — zod installed in the devbible checkout, 2026-09-04

`node -p "require('./node_modules/zod/package.json').version"` → **4.4.3** (matches `src/data/pins.js`;
npm `latest` at research time was 4.5.4).

`Object.keys` style probe of the namespace and of `z.string()`:

| symbol | 4.4.3 |
|---|---|
| `z.stringbool`, `z.coerce`, `z.treeifyError`, `z.prettifyError`, `z.flattenError`, `z.strictObject`, `z.looseObject`, `z.enum`, `z.iso` | present |
| **`z.validate`** | **undefined** |
| `schema.parse`, `.safeParse`, `.parseAsync`, `.check`, `.refine`, `.transform`, `.brand` | present |
| **`schema.validate`** | **undefined** |

🔴 So `.validate()` / `z.validate()` (the boolean type-guard fast path documented on zod.dev) is a
**Zod 4.5 addition and does not exist in 4.4.3**. Pages pinning 4.4.3 must not use it. This was
probed, not assumed.

## Environment variables (full read) — /docs/app/guides/environment-variables.md · lastUpdated 2026-08-25

Beyond the § Test Environment Variables already banked above:

- Inlining, verbatim: > "In order to make the value of an environment variable accessible in the
  browser, Next.js can \"inline\" a value, at build time, into the js bundle that is delivered to the
  client, replacing all references to `process.env.[variable]` with a hard-coded value."
- 🔴 > "Note that dynamic lookups will *not* be inlined, such as:" — the doc's own two examples are
  `process.env[varName]` **and** `const env = process.env; env.NEXT_PUBLIC_ANALYTICS_ID`.
  🔴 This is fatal to any env-schema module that does `Schema.parse(process.env)` in client-reachable
  code: passing the whole object is a dynamic lookup and inlines nothing.
- > "After being built, your app will no longer respond to changes to these environment variables."
  Docker-image-promotion caveat; "you'll have to set up your own API to provide them to the client".
- Runtime server reads: `await connection()` from `next/server` opts into dynamic rendering so
  `process.env.MY_VALUE` is evaluated at request time. > "This allows you to use a singular Docker
  image that can be promoted through multiple environments with different values."
- Load order, stopping at the first hit: `process.env` → `.env.$(NODE_ENV).local` →
  `.env.local` (**"Not checked when `NODE_ENV` is `test`"**) → `.env.$(NODE_ENV)` → `.env`.
- Allowed `NODE_ENV` values: `production`, `development`, `test`. Unassigned → `development` for
  `next dev`, `production` for everything else.
- `.env*` files stay at the project root even with a `/src` directory; `$VAR` expansion is supported,
  escape a literal `$` as `\$`; multiline values supported.
- `@next/env` `loadEnvConfig(process.cwd())` for ORM configs and test-runner setup files.
- `register` (instrumentation) named as the way to run code on server startup.

## Fork B output — pages written 2026-09-04 from this bank (do not re-derive)

| pos | file | covers |
|---:|---|---|
| 3 | `03-type-safety-as-testing-strict-ts-config-typed-routes-zod-con.md` | the nine strict-family flags; `noUncheckedIndexedAccess`; `exactOptionalPropertyTypes`; migration order + `tsconfigPath` |
| 102 | `03b-module-syntax-and-where-types-stop.md` | import elision, `verbatimModuleSyntax`, re-export rule, `satisfies` vs `as`, the five erasure doors |
| 103 | `03c-typed-routes-and-generated-types.md` | `typedRoutes`, `.next/types`, `Route<T>`, `PageProps`/`LayoutProps`/`RouteContext`, `next typegen` in CI, `typedEnv` |
| 104 | `03d-zod-contract-tests-at-the-boundaries.md` | parse/safeParse/parseAsync, `searchParams`, `FormData`, route handler bodies, `flattenError`/`treeifyError` |
| 105 | `03e-env-schemas-and-contract-tests.md` | the `NEXT_PUBLIC_` inlining trap, server/client env split, `.env.test`, third-party contract tests |
| 4 | `04-monorepos-with-turborepo-...-ci-p.md` | `tasks`, `dependsOn`, `outputs`, `inputs`/`$TURBO_DEFAULT$`, persistent tasks, root tasks, Next 16 tooling deltas |
| 106 | `04b-shared-packages-and-transpilation.md` | JIT/Compiled/Publishable, `transpilePackages`, `outputFileTracingRoot`, cross-package type-checking |
| 107 | `04c-hashing-caching-and-cache-poisoning.md` | global vs task hash, strict env mode, framework inference, `.env` invisibility, logs as artefacts, remote cache |
| 108 | `04d-turborepo-in-ci-and-affected-filtering.md` | `TURBO_TOKEN`/`TEAM`, `--affected` + shallow clone, `turbo query affected`, `--filter` microsyntax, Jest/Vitest/Playwright wiring |
| 5 | `05-project-milestone-sprintdesk-test-suite.md` | the five-layer boundary table, the tenancy invariant test, fixture strategy, coverage as a ratchet |
| 109 | `05b-the-playwright-flows-auth-and-board-crud.md` | two storage states, auth flow, board CRUD, proving the optimistic frame, phase gate |

**Pin requests raised to the coordinator:** `turbo` (npm:turbo, latest, **2.10.12**, tracks `['nextjs']`,
names `['turborepo','turbo']`) has **no pin**; `zod`'s pin entry does **not** list the `nextjs` track
although 18+ nextjs pages name it.
