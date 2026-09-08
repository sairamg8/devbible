---
title: "import.meta.env.VITE_ORDERS_API is not read at runtime, it is statically replaced during vite build, so one bundle is welded to the service URLs of the environment that built it and cannot be promoted dev to staging to prod"
sidebar_label: "03 · Service URLs are baked in"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the Vite documentation — [Env Variables and Modes](https://vite.dev/guide/env-and-mode.md), [Shared Options](https://vite.dev/config/shared-options.md), [Configuring Vite](https://vite.dev/config/), [Migration from v7](https://vite.dev/guide/migration.md). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

# ⚡ Service URLs Are Baked In at Build Time

**`import.meta.env.VITE_ORDERS_API` is not a runtime lookup — it is text that `vite build`
deletes and replaces with a literal string, permanently, before the file ever reaches a
browser.** That single fact collides head-on with the assumption every microservices
deployment pipeline makes: build one artefact, promote it unchanged through dev, staging and
production. A Vite bundle that reads a service URL from `import.meta.env` cannot be that
artefact — it is a different artefact per environment, indistinguishable by inspection,
because the difference lives inside already-minified JavaScript. This chunk is the mechanism
and the primitives that produce it; the fix — runtime configuration — is
[03b](03b-runtime-configuration-and-the-fix.md).

## The mechanism: substitution, not a read

The docs are exact about what `import.meta.env` is:

> *"Vite exposes certain constants under the special `import.meta.env` object. These constants
> are defined as global variables during dev and statically replaced at build time to make
> tree-shaking effective."* — [Env Variables and Modes](https://vite.dev/guide/env-and-mode.md)

Two different implementations behind one API. In `vite dev`, `import.meta.env` is a real
object served by the dev server — read `VITE_ORDERS_API` twice and you get the same object
both times, because it *is* an object. In `vite build`, every occurrence of
`import.meta.env.VITE_ORDERS_API` in the source is found textually and replaced with the
literal string the build had in scope at that moment — `"https://orders.staging.internal"` if
the build ran with `.env.staging` loaded, `"https://orders.prod.internal"` if it ran with
`.env.production` loaded. The two builds produce two different files. Nothing at runtime
distinguishes them; there is no runtime left to distinguish anything with, the branch is gone.

This is *why* it works this way, not an accident: static replacement lets a bundler prove a
branch guarded by an env constant is dead code and drop it, which is the tree-shaking the
quote names. The cost of that optimisation is exactly the promotion problem — the value can no
longer change without the optimisation re-running, i.e. without a rebuild.

## The security line — read it before anyone reaches for `VITE_ORDERS_API_KEY`

A per-service URL is public information; a per-service API key is not, and the same
substitution mechanism that bakes in the URL bakes in the key just as literally if it is ever
given the `VITE_` prefix. The documentation's warning is unconditional:

> *"`VITE_*` variables should not contain sensitive information such as API keys. The values
> of these variables are bundled into your source code at build time. For production
> deployments, consider a backend server or serverless/edge functions to properly secure
> secrets."* — [Env Variables and Modes](https://vite.dev/guide/env-and-mode.md)

"Bundled into your source code" is not obfuscated, not encrypted, not gated by any runtime
check — it is a string literal sitting in a `.js` file any browser downloads and any DevTools
session can read verbatim. In a microservices frontend, the trap is specifically the *plural*:
a team wiring up five service URLs under `VITE_` naturally reaches for the same prefix when
service four turns out to need an API key for a staging bypass, or service five needs a
short-lived token for a preview environment. `VITE_ORDERS_API` is fine to bake in. Its sibling
`VITE_ORDERS_API_KEY` is a leaked secret the moment it is defined, regardless of who is
supposed to see it.

## `envPrefix`: the gate, and what happens if you try to remove it

`envPrefix` is what decides which `.env` keys cross into `import.meta.env` at all — default
`VITE_`, type `string | string[]`:

> *"Env variables starting with `envPrefix` will be exposed to your client source code via
> `import.meta.env`."* — [Shared Options](https://vite.dev/config/shared-options.md)

A services-heavy `.env` file accumulates a lot of `VITE_`-prefixed keys, and the temptation to
widen `envPrefix` to `''` so every key is exposed without retyping the prefix is real. Vite
refuses:

> *"`envPrefix` should not be set as `''`, which will expose all your env variables and cause
> unexpected leaking of sensitive information. Vite will throw an error when detecting `''`."*
> — [Shared Options](https://vite.dev/config/shared-options.md)

If one specific unprefixed variable genuinely needs to reach the client, the documented
escape hatch is `define`, applied to that one key, not a blanket prefix:

```ts
// vite.config.ts
export default defineConfig({
  define: {
    'import.meta.env.ENV_VARIABLE': JSON.stringify(process.env.ENV_VARIABLE),
  },
})
```

`envDir` is the companion knob — *type* `string | false`, *default* `root` — controlling
**where** `.env` files are read from:

> *"The directory from which `.env` files are loaded. Can be an absolute path, or a path
> relative to the project root. `false` will disable the `.env` file loading."* —
> [Shared Options](https://vite.dev/config/shared-options.md)

In a single-app project `root` and the repo root are the same directory and `envDir` is
invisible. In a monorepo of several Vite apps — one per service consumer, or one shell plus
several remotes — `root` is the *app's* directory, and a `.env.production` sitting at the
repo root is invisible to every app unless `envDir` is pointed at it explicitly. The full
monorepo layout, including per-app `envDir`, is
[04 · One repo, many Vite apps](04-one-repo-many-vite-apps.md); the general `.env` file set
and precedence rules are
[07 · The environment system](../07-env-variables-and-modes/01-environment-system.md).

## `loadEnv` and why `vite.config.ts` cannot just read `process.env`

A common next step is trying to select a service URL *inside* `vite.config.ts` — say, to
compute a dev-server proxy target from the same value the build will bake in. That value is
not there yet when the config runs:

> *"Environment variables available while the config itself is being evaluated are only those
> that already exist in the current process environment (`process.env`). Vite deliberately
> defers loading any `.env*` files until after the user config has been resolved because the
> set of files to load depends on config options like `root` and `envDir`, and also on the
> final mode."* — [Configuring Vite](https://vite.dev/config/)

> *"variables defined in `.env`, `.env.local`, `.env.[mode]`, or `.env.[mode].local` are not
> automatically injected into `process.env` while your `vite.config.*` is running."* —
> [Configuring Vite](https://vite.dev/config/)

The documented fix is to load them explicitly:

```ts
// vite.config.ts
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // third argument '' loads every key regardless of the VITE_ prefix — the
  // config file is trusted code, unlike the client bundle, so it may read
  // values that must never reach import.meta.env in the browser.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    server: {
      proxy: {
        '/api/orders': env.ORDERS_API_INTERNAL_URL,
      },
    },
  }
})
```

> *"Set the third parameter to `''` to load all env regardless of the `VITE_` prefix."* —
> [Configuring Vite](https://vite.dev/config/)

## `NODE_ENV` selects nothing here — `mode` does

The value that decides which `.env.[mode]` file supplies `VITE_ORDERS_API` is **mode**, set by
`--mode` or defaulted by the command. `NODE_ENV` is a separate variable most teams assume is
the same lever:

> *"It's important to note that `NODE_ENV` (`process.env.NODE_ENV`) and modes are two
> different concepts."* — [Env Variables and Modes](https://vite.dev/guide/env-and-mode.md)

| Command | `NODE_ENV` | Mode |
|---|---|---|
| `vite build` | `"production"` | `"production"` |
| `vite build --mode development` | `"production"` | `"development"` |
| `NODE_ENV=development vite build` | `"development"` | `"production"` |
| `NODE_ENV=development vite build --mode development` | `"development"` | `"development"` |

A CI pipeline that sets `NODE_ENV=staging` hoping to select `.env.staging` does nothing to
mode at all — mode is still `production` from plain `vite build`, `.env.production` loads, and
the baked URL is the production one. The lever is `--mode staging`, full stop.

`NODE_ENV` instead drives `import.meta.env.PROD` / `import.meta.env.DEV`:

| `NODE_ENV` | `import.meta.env.PROD` | `import.meta.env.DEV` |
|---|---|---|
| `production` | true | false |
| `development` | false | true |
| **`other`** | **false** | **true** |

## `define` and the v8 change that breaks a "shared config object" assumption

`define` performs the same kind of build-time substitution as `import.meta.env`, for
arbitrary global constants:

> *"Define global constant replacements. Entries will be defined as globals during dev and
> statically replaced during build."* — [Shared Options](https://vite.dev/config/shared-options.md)

A team building a small runtime-config layer sometimes reaches for `define` to inject one
config object under two names — say a legacy global and a namespaced one — expecting both
names to point at the *same* object, so mutating one updates the other. Vite 8 states this
explicitly does not happen:

> *"`define` does not share reference for objects: When you pass an object as a value to
> `define`, each variable will have a separate copy of the object."* —
> [Migration from v7](https://vite.dev/guide/migration.md)

That rules `define` out for anything meant to be a single mutable object at runtime — which is
exactly the shape a service-URL registry needs once it stops being build-time. `define` is
correctly used for constants (a feature flag, a build number); it is the wrong tool the moment
the value needs to be one shared, live object. What to use instead is
[03b · Runtime configuration and the fix](03b-runtime-configuration-and-the-fix.md).

## Gotchas

**★ Symptom: the exact same Docker image, promoted unmodified from staging to prod, keeps
calling the staging orders API.** Cause: the image was built once with `VITE_ORDERS_API`
baked in from `.env.staging`, and Docker image promotion does not re-run `vite build`. Fix:
either rebuild per environment (and accept you are not doing "build once, deploy anywhere"),
or move the value to runtime configuration — [03b](03b-runtime-configuration-and-the-fix.md) —
so one image is genuinely portable.

**★ Symptom: a bug only appears in production, never in staging, despite staging supposedly
testing "the same build".** Cause: baked env values mean staging and prod are never bit-for-
bit the same artefact — different `import.meta.env` substitutions produce different bundles,
different hashes, potentially different dead-code elimination if a branch is guarded by an
env constant. Staging never observed the production artefact; it observed a sibling. Fix:
runtime configuration makes "the same build" literally true, closing this gap entirely.

**★ Symptom: `VITE_ORDERS_API_KEY` shows up in a security scan of the deployed JavaScript
bundle.** Cause: a per-service API key was given the `VITE_` prefix out of habit, alongside
the legitimately public service URLs sitting in the same `.env` file. Fix: quote the
documentation's line to whoever added it — *"the values of these variables are bundled into
your source code at build time"* — remove the prefix, and route the key through a backend or
edge function that the browser never sees.

**Symptom: `vite.config.ts` throws or silently ignores `envPrefix: ''`.** Cause: Vite
deliberately refuses `''` — the documented behaviour is *"Vite will throw an error when
detecting `''`"*. Fix: keep a real prefix; expose the one specific unprefixed key you need
through `define` instead of widening the prefix for everyone.

**Symptom: `vite.config.ts` reads `process.env.VITE_ORDERS_API` to compute a dev-proxy target
and gets `undefined`, despite `.env.production` clearly defining it.** Cause: `.env*` values
are not injected into `process.env` while the config file evaluates — the config is deferred
that load on purpose because `root`, `envDir` and `mode` might change what should be loaded.
Fix: call `loadEnv(mode, process.cwd(), '')` inside the config function and read from its
return value, not from `process.env`.

**Symptom: a CI pipeline sets `NODE_ENV=staging` to try to select `.env.staging`, and the
build ships the production API URL anyway.** Cause: `NODE_ENV` and mode are independent —
plain `vite build` sets mode to `"production"` regardless of `NODE_ENV`, and it is mode that
selects `.env.[mode]`. Fix: pass `--mode staging` explicitly; do not rely on `NODE_ENV` to
select an env file.

## Interview questions

**★ Why can't you change `import.meta.env.VITE_ORDERS_API` for a build that has already
shipped, without rebuilding?**
Because it was never a value read at runtime — during `vite build` every occurrence in the
source is found textually and replaced with a literal string before minification. Once the
build exists, that string is baked into a `.js` file exactly like any other piece of source
code; there is no lookup left to intercept, because the lookup does not exist anymore.

**★ Why is `import.meta.env.VITE_ORDERS_API_KEY` a worse idea than `VITE_ORDERS_API`, given
they use the identical mechanism?**
Because the mechanism bundles both into the source code verbatim, and the URL is meant to be
public while the key is not. The documentation states plainly that `VITE_*` values are
bundled into the source at build time and must not hold sensitive information — a secret
needs a backend or edge function in front of it, not a build-time constant, regardless of how
convenient the `VITE_` prefix is.

**★ Why does Vite refuse `envPrefix: ''` instead of just allowing it?**
Because an empty prefix matches every environment variable, including ones never intended for
the client — database passwords, internal service credentials, anything sitting in the same
`.env` file for backend tooling. The docs describe this as "unexpected leaking of sensitive
information" and Vite throws rather than let a misconfiguration silently expose all of it.

**★ Why does `vite.config.ts` need `loadEnv` instead of just reading `process.env.VITE_X`?**
Because Vite defers loading `.env*` files until after the user config resolves — the set of
files to load depends on `root`, `envDir` and the final `mode`, all of which are themselves
config. `process.env` at config-evaluation time only has whatever already existed in the
process before Vite started; `.env` file contents are not there yet. `loadEnv` performs that
load explicitly and returns the result instead.

**How is `NODE_ENV` different from mode, and which one selects `.env.staging`?**
Mode does. `NODE_ENV` and mode are documented as two different concepts: plain `vite build`
always sets `NODE_ENV` to `"production"` and mode to `"production"`; passing `--mode staging`
changes mode without touching `NODE_ENV`. A pipeline that sets `NODE_ENV=staging` hoping to
select `.env.staging` has changed the wrong variable.

**★ What breaks about "testing in staging" once service URLs are build-time constants?**
Staging no longer tests the production artefact — it tests a sibling artefact built from the
same source with different substitutions. Any bug introduced by the build step itself (a
tree-shaking difference from a dead branch, a different chunk hash affecting caching
behaviour) is invisible to staging by construction, because staging never ran the bytes that
will actually ship. Runtime configuration removes this gap by making "the same build" literal.

---

{/* FOOTER */}
