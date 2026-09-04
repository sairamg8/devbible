---
title: "Appendix C · part 3 — the CLI surface after 16: eight commands, the two that are new, and the flags that exist purely to make a failing build legible"
sidebar_label: "09 · Appendix C — the CLI surface"
sidebar_position: 32
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the [`next` CLI reference](https://nextjs.org/docs/app/api-reference/cli/next) (`lastUpdated: 2026-08-25`), [Codemods](https://nextjs.org/docs/app/guides/upgrading/codemods) and [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16).
> Target: **Next.js 16.3.4** · Turbopack default · Node.js **20.9+**. Documentation-verified; **no sandbox run, no timings**.

**Most developers know four `next` commands. There are eight, two of them added in 16.1, and the two nobody knows are the ones that answer the questions people currently answer by guessing: `next upgrade` moves you between versions, and `next experimental-analyze` tells you what is in your bundles now that `next build` has stopped reporting sizes. Underneath sits a set of flags that exist for one purpose — making a failure readable — and they are worth learning before you need them, because the moment you need them you are already stuck. This page is the surface, the syntactic traps, and the things the reference says that contradict habit.**

## The eight commands

| Command | Verbatim description | Since |
|---|---|---|
| `dev` | *"Starts Next.js in development mode with Hot Module Reloading, error reporting, and more."* | — |
| `build` | *"Creates an optimized production build of your application. Displaying information about each route."* | — |
| `start` | *"Starts Next.js in production mode. The application should be compiled with `next build` first."* | — |
| `info` | *"Prints relevant details about the current system which can be used to report Next.js bugs."* | — |
| `telemetry` | *"Allows you to enable or disable Next.js' completely anonymous telemetry collection."* | — |
| `typegen` | *"Generates TypeScript definitions for routes, pages, layouts, and route handlers without running a full build."* | **15.5** |
| `upgrade` | *"Upgrades your Next.js application to the latest version."* | **16.1** |
| `experimental-analyze` | *"Analyzes bundle output using Turbopack. Does not produce build artifacts."* | **16.1** |

> **Good to know**: *"Running `next` without a command is an alias for `next dev`."*

🔴 **And the npm trap, stated in the reference:** *"With `npm run`, use `--` before CLI flags so npm forwards them to `next`. This is not required for `pnpm`, `yarn`, or `bun`."*

```bash
npm run build -- --debug-prerender   # npm needs the --
pnpm build --debug-prerender          # pnpm does not
```

Silently dropping a flag is the failure here: without `--`, npm consumes it and the build runs without the option you thought you passed.

## `next upgrade` — the command that replaced a codemod invocation

```bash
npx next upgrade                      # to the channel you are already on
npx next upgrade --revision canary
npx next upgrade --revision 15.0.0
npx next upgrade --verbose
```

The `--revision` behaviour is the part worth reading twice: *"Specify a Next.js version or tag to upgrade to (e.g., `latest`, `canary`, `15.0.0`). Defaults to the release channel you have currently installed."*

**Defaulting to your current channel** means a bare `next upgrade` on a canary install keeps you on canary. That is usually what you want and occasionally a surprise — it is also, notably, the behaviour that lets a team on a 15 canary for PPR stay there, which is exactly what the [16 upgrade guide advises them to do](02-appendix-b-react-upgrade-blueprint-tracking-react-canary-nex.md).

⚠️ **This does not replace `@next/codemod`.** The upgrade *guide* still directs you at `npx @next/codemod@canary upgrade latest` for the code transforms, and at the separate codemods for async Request APIs and the ESLint migration. Treat `next upgrade` as the dependency move and the codemods as the source move.

## `next experimental-analyze` — the answer to a metric that was removed

Next.js 16 removed `size` and `First Load JS` from build output as *"inaccurate in server-driven architectures"*. This command is the replacement, and it is Turbopack-native rather than a webpack plugin:

```bash
npx next experimental-analyze
```

By default it starts a local server on port 4000 and lets you:

> * *"Filter bundles by route and switch between client and server views"*
> * *"View the full import chain showing why a module is included"*
> * *"Trace imports across server-to-client component boundaries and dynamic imports"*

That middle capability — *why* a module is included — is the one that actually resolves bundle arguments, because "this package is 400 KB" is never the useful sentence; "this package is here because a Client Component imports a barrel file" is.

For CI, or for a before/after comparison, write it to disk instead:

```bash
npx next experimental-analyze --output
cp -r .next/diagnostics/analyze ./analyze-before-refactor
```

🔴 **It does not produce build artifacts.** You cannot analyze and deploy in one step; it is a diagnostic run.

## `next typegen` — and the CI shape it enables

> *"Previously, route types were only generated during `next dev` or `next build`, which meant running `tsc --noEmit` directly wouldn't validate your route types."*

```bash
next typegen && tsc --noEmit
```

That one line is the point of the command: type-check route usage in CI **without a build**. Output goes to `<distDir>/types` — `.next/dev/types` in development, `.next/types` in production.

Two details people trip over:

- It also generates `next-env.d.ts`, and *"We recommend adding `next-env.d.ts` to your `.gitignore` file."* `next dev` and `next build` generate it too, *"but it is often undesirable to run these just to type-check, for example in CI/CD environments."*
- 🔴 *"`next typegen` loads your Next.js config… using the production build phase. Ensure any required environment variables and dependencies are available so the config can load correctly."* A type-check job with no environment therefore fails in the config, not in your types — a confusing error for what looks like a pure `tsc` step.

## `next build` — the flags for when it fails

| Flag | What it does |
|---|---|
| `--debug-prerender` | *"Debug prerender errors in development."* |
| `--debug-build-paths=<patterns>` | *"Build only specific routes for debugging."* |
| `-d`, `--debug` | *"additional build output like rewrites, redirects, and headers will be shown"* |
| `--no-mangling` | *"Disables mangling… should only be used for debugging purposes."* |
| `--profile` | production React profiling |
| `--turbopack` / `--webpack` | force the bundler; Turbopack is the default |
| `--experimental-app-only` | *"Builds only App Router routes."* |
| `--experimental-cpu-prof` | V8 CPU profile into `.next-profiles/` |

### `--debug-prerender` is four options in a trench coat

The reference names them, which matters because it tells you exactly why the build behaves differently:

> * *"`experimental.serverMinification = false`"* and *"`experimental.turbopackMinify = false`"*
> * *"`experimental.serverSourceMaps = true`"*
> * *"`experimental.prerenderEarlyExit = false`"* — *"Continues building even after the first prerender error, so you can see all issues at once"*

🔴 **And it carries a warning the docs put in bold:** *"`--debug-prerender` is for debugging in development only. Do not deploy builds generated with `--debug-prerender` to production, as it may impact performance."* Unminified server code with source maps is not a production artifact.

### `--debug-build-paths` — the flag that makes a large app tractable

It takes comma-separated paths, supports globs, and negates with `!`:

```bash
next build --debug-build-paths="app/page.tsx"
next build --debug-build-paths="app/(marketing)/about/page.tsx"
next build --debug-build-paths="app/**/page.tsx,!app/admin/**"
```

*"In projects that keep routes under `src/`, paths resolve with or without the `src/` prefix, so both `app/page.tsx` and `src/app/page.tsx` match the same route."*

Paired with `--debug-prerender`, this is the actual workflow for a Cache Components migration on a large codebase: enumerate every failure once, then iterate on one route at a time.

## `next dev` — HTTPS, ports, and the output directory

> **Good to know**: *"Development builds output to `.next/dev` instead of `.next`. This allows you to run `next dev` and `next build` concurrently without conflicts."*

```bash
next dev --experimental-https
next dev --experimental-https --experimental-https-key ./certificates/localhost-key.pem --experimental-https-cert ./certificates/localhost.pem
```

*"`next dev --experimental-https` is only intended for development and creates a locally trusted certificate with `mkcert`. In production, use properly issued certificates from trusted authorities."* This is the documented answer for webhooks and auth flows that refuse plain `http://localhost`.

🔴 **A port trap worth memorising:** *"`PORT` cannot be set in `.env` as booting up the HTTP server happens before any other code is initialized."*

```bash
next dev -p 4000     # works
PORT=4000 next dev   # works
# PORT=4000 in .env  # does NOT work
```

## `next start` — the one flag that matters behind a load balancer

> *"When deploying Next.js behind a downstream proxy (e.g. a load-balancer like AWS ELB/ALB), it's important to configure Next's underlying HTTP server with keep-alive timeouts that are *larger* than the downstream proxy's timeouts. Otherwise, once a keep-alive timeout is reached for a given TCP connection, Node.js will immediately terminate that connection without notifying the downstream proxy. This results in a proxy error whenever it attempts to reuse a connection that Node.js has already terminated."*

```bash
next start --keepAliveTimeout 70000
```

That failure — intermittent 502s under load, unreproducible locally, worse at low traffic when connections idle longer — is one of the highest-value single flags in the CLI. [Chapter 16](../16-deployment-scaling-and-observability/01-explanation.md) covers the deployment side.

## The codemods, and where they are not the CLI

Separate binary, separate versioning, and it is `@canary` in every documented invocation:

```bash
npx @next/codemod@canary upgrade latest              # the mechanical 16 upgrade
npx @next/codemod@canary next-async-request-api .    # not run by the above
npx @next/codemod@canary next-lint-to-eslint-cli .   # not run by the above
npx @next/codemod@canary agents-md                   # legacy, for 16.1 and earlier
```

> *"Codemods are transformations that run on your codebase programmatically. This allows a large number of changes to be programmatically applied without having to manually go through every file."*

## Passing Node options, and profiling

```bash
NODE_OPTIONS='--inspect' next
NODE_OPTIONS='--throw-deprecation' next
next build --experimental-cpu-prof
```

Profiles land in `.next-profiles/` and open in Chrome DevTools. The reference names the files each command produces, and the one you usually want from a dev profile is `dev-server-*` — *"Child server process (request handling and rendering) - this is typically what you want to analyze"* — not `dev-main-*`, which is orchestration.

## Gotchas

**★ Symptom: `npm run build -- --debug-prerender` works but `npm run build --debug-prerender` silently ignores the flag.** Cause: npm consumes flags after the script name unless you separate them with `--`. Fix: use `--` with npm; pnpm, yarn and bun do not need it. The failure is silent, which is what makes it expensive — the build succeeds and simply lacks the option.

**★ Symptom: `PORT=4000` in `.env` does not change the port.** Cause: the HTTP server boots before any application code, so `.env` has not been read yet. Fix: pass `-p 4000`, or set `PORT` in the actual environment.

**★ Symptom: a CI type-check job fails inside `next.config` rather than in your types.** Cause: `next typegen` loads the config using the production build phase, so missing environment variables break the type-check step. Fix: give the type-check job the same environment the build job has — the error message will point at config loading, not at TypeScript, which is why this is confusing the first time.

**★ Symptom: `next-env.d.ts` shows up in every diff.** Cause: it is regenerated by `typegen`, `dev` and `build`. Fix: gitignore it, which is what the docs recommend, and run `next typegen` in CI before `tsc` so the file exists when it is needed.

**★ Symptom: a build produced with `--debug-prerender` was deployed and the app is slower.** Cause: the flag disables server minification and enables server source maps. The docs warn about exactly this. Fix: never ship one — use it to diagnose, then rebuild without it. Treat it as a lint rule on your deploy pipeline, not a judgement call.

**★ Symptom: you fix one prerender error, rebuild, hit the next, twelve times.** Cause: a normal build early-exits on the first prerender failure. Fix: `--debug-prerender` sets `experimental.prerenderEarlyExit = false`, so one build enumerates everything. Combine it with `--debug-build-paths` to then iterate on one route without rebuilding the app.

**★ Symptom: `--debug-build-paths` matches nothing in a `src/`-based project.** Cause: usually a wrong assumption rather than a real mismatch — paths resolve with or without the `src/` prefix, so both spellings work. Fix: check the glob instead. Route groups must appear in the path, parentheses included: `app/(marketing)/about/page.tsx`.

**★ Symptom: you cannot find a bundle size anywhere after upgrading.** Cause: `size` and `First Load JS` were removed from `next build` in 16.0. Fix: `next experimental-analyze`, which is Turbopack-native and shows the import chain — *why* a module is in the bundle — rather than a single number. Note it produces no build artifacts, so it is a separate run from your deploy build.

**★ Symptom: `next upgrade` did not apply any code changes.** Cause: it upgrades the dependency, not the source. Fix: run the codemods separately — `npx @next/codemod@canary upgrade latest` for the mechanical transforms, plus the async Request API and ESLint codemods, which that one does not include.

**★ Symptom: `next upgrade` moved you to another canary rather than to stable.** Cause: `--revision` *"Defaults to the release channel you have currently installed."* Fix: name the target explicitly — `next upgrade --revision latest` — whenever you intend to change channels rather than advance within one.

**★ Symptom: a CPU profile is full of orchestration and shows nothing about rendering.** Cause: `next dev --experimental-cpu-prof` writes two profiles and `dev-main-*` is the parent process. Fix: open `dev-server-*`, which the docs identify as the child process handling requests and rendering — *"this is typically what you want to analyze."*

**★ Symptom: intermittent 502s from a load balancer in front of `next start`, none reproducible locally.** Cause: Node's keep-alive timeout is shorter than the proxy's, so Node closes connections the proxy still believes are reusable. Fix: `next start --keepAliveTimeout 70000`, set higher than the downstream proxy's timeout. Locally there is no proxy, which is precisely why it never reproduces.

**★ Symptom: `next build --experimental-app-only` is proposed to speed up CI on a hybrid app.** Cause: it does what it says — builds only App Router routes. Fix: fine for a debugging loop, wrong for a deploy artifact on an app that still serves Pages Router routes, because those routes will not be in the output at all.

## Interview questions

**★ Name the two `next` commands added in 16.1 and the problems they solve.**
`next upgrade`, which moves the dependency to a named revision and defaults to the release channel you are already on; and `next experimental-analyze`, a Turbopack-native bundle analyzer that exists because 16.0 removed `size` and `First Load JS` from build output. The second is the more interesting addition, because it does not restore the removed number — it replaces it with something more useful, the import chain explaining why a module is in a bundle at all.

**★ How do you type-check route usage in CI without running a build?**
`next typegen && tsc --noEmit`. Before `typegen` existed, route types were only generated during `next dev` or `next build`, so a bare `tsc --noEmit` validated everything except the route types. The trap is that `typegen` loads your `next.config` under the production build phase, so a type-check job with no environment variables fails while loading the config — an error that looks nothing like a type error and sends people looking in the wrong place.

**★ What does `--debug-prerender` actually turn on, and why must you not deploy its output?**
Four experimental options: it disables server minification for both bundlers, enables server source maps, and disables prerender early-exit so the build continues past the first failure and reports everything. The first two are why you must not deploy the result — the docs warn explicitly that it may impact performance. It is a diagnostic build: unminified server code with source maps attached is a debugging artifact, not a production one.

**★ You have 200 routes and a Cache Components migration producing prerender errors. What is the workflow?**
One build with `--debug-prerender` to enumerate every failure at once instead of discovering them one build at a time, which gives you a list you can plan against. Then iterate route by route with `--debug-build-paths` scoped to the file you are working on, so each check costs one route rather than 200. Globs and `!` exclusions make it possible to work a whole section — `app/**/page.tsx,!app/admin/**` — and route groups must include their parentheses in the path.

**★ Why is `npm run dev -- -p 4000` different from `npm run dev -p 4000`?**
Because npm consumes arguments after the script name unless `--` tells it to forward them. Without it, the flag never reaches `next` and the server starts on 3000, with no error to indicate anything was dropped. pnpm, yarn and bun forward flags without the separator, which is why this bites teams that switch package managers or copy commands between projects.

**★ Where does `PORT` work and where does it not?**
It works as a real environment variable and as the `-p`/`--port` flag. It does not work in `.env`, and the reason is ordering: the HTTP server boots before any application code runs, so nothing has parsed `.env` yet. This is a good example of a class of config that cannot be file-driven no matter how much you want it to be.

**★ Your app sits behind an ALB and throws intermittent 502s that never reproduce locally. Where do you look?**
At the keep-alive timeouts. If Node's is shorter than the proxy's, Node closes an idle TCP connection without telling the proxy, and the next time the proxy reuses that connection it errors. The fix is `next start --keepAliveTimeout` set above the downstream proxy's value. It never reproduces locally because there is no proxy locally — nothing is holding a connection open expecting to reuse it.

**★ `next build` no longer prints bundle sizes. What do you use, and what is better about it?**
`next experimental-analyze`. It filters by route, separates client and server views, shows the full import chain for any module, and traces imports across the server-to-client boundary and through dynamic imports. That is a better artifact than the removed number because a size alone never told you what to do about it; an import chain does. The trade is that it is a separate run producing no build artifacts, so it belongs in a diagnostic job rather than in your deploy pipeline.

**★ Someone reports a Next.js bug. What do you ask them to paste?**
`next info`, or `next info --verbose`. It prints platform, architecture and OS version, the Node, npm, Yarn and pnpm versions, the installed `next`, `react`, `react-dom` and `typescript` versions with the latest available `next` noted alongside, and the relevant `next.config` values such as `output`. That last line matters more than it looks: `output: 'standalone'` versus `'export'` versus unset changes which failure modes are even possible.

---

← [Appendix C part 2 · MCP and the error loop](03b-appendix-c-runtime-sight-mcp-and-the-error-loop.md) · [Chapter 19 overview](01-explanation.md) · Next → [Appendix D · The production readiness checklist](04-appendix-d-production-readiness-checklist-security.md)
