---
title: "Mode and `NODE_ENV` Are Two Independent Axes, and Conflating Them Ships Development Code"
sidebar_label: "Modes & `NODE_ENV`"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Env Variables and Modes](https://vite.dev/guide/env-and-mode), [Migration from v7](https://vite.dev/guide/migration). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Mode and `NODE_ENV` Are Two Independent Axes

> *"It's important to note that `NODE_ENV` (`process.env.NODE_ENV`) and modes are two different concepts."* — [Env Variables and Modes](https://vite.dev/guide/env-and-mode)

That sentence is in the documentation because the mistake is universal. Both look like "which
environment am I in", both accept a free-form string, and setting them to the same value feels
tidy — which is exactly how a staging build turns into a development build.

---

## 1. Under-The-Hood Mechanics

**Mode** selects which `.env.[mode]` file loads and what `import.meta.env.MODE` reports.
**`NODE_ENV`** selects what `import.meta.env.PROD` and `.DEV` report. Nothing connects them.

The defaults are sane on their own: *"By default, the dev server (`dev` command) runs in development
mode and the `build` command runs in production mode."* Trouble starts only when you set `NODE_ENV`
yourself.

All four combinations are reachable, and the docs prove it with a table worth memorising:

| Command | `NODE_ENV` | Mode |
|---|---|---|
| `vite build` | `"production"` | `"production"` |
| `vite build --mode development` | `"production"` | `"development"` |
| `NODE_ENV=development vite build` | `"development"` | `"production"` |
| `NODE_ENV=development vite build --mode development` | `"development"` | `"development"` |

And the second table is where the money is:

| `NODE_ENV` | `import.meta.env.PROD` | `import.meta.env.DEV` |
|---|---|---|
| `production` | `true` | `false` |
| `development` | `false` | `true` |
| **anything else** | **`false`** | **`true`** |

🔴 **That last row is the trap.** `NODE_ENV=staging` is not an error and not a warning — it is
simply *not production*, so `PROD` is `false`, `DEV` is `true`, and every `if (import.meta.env.DEV)`
block you believed was stripped is now shipped. There is no third state; the axis is binary and
everything that is not `production` falls to the development side.

### `MODE` is free-form; `NODE_ENV` is not

```
--mode  →  MODE: "production" | "staging" | "qa" | "canary" | anything you like
           and it selects .env.<that string>

NODE_ENV → PROD/DEV: a BINARY. "production" ⇒ optimised; everything else ⇒ development.
```

This asymmetry is the whole design. Mode exists precisely because `NODE_ENV` cannot express
"staging" — so Vite added an axis that can, rather than overloading one that could not.

### Why `NODE_ENV` on the command line differs from `NODE_ENV` in a file

> *"`NODE_ENV=...` can be set in the command, and also in your `.env` file. If `NODE_ENV` is specified in a `.env.[mode]` file, the mode can be used to control its value. However, both `NODE_ENV` and modes remain as two different concepts."*

> *"The main benefit with `NODE_ENV=...` in the command is that it allows Vite to detect the value early. It also allows you to read `process.env.NODE_ENV` in your Vite config as Vite can only load the env files once the config is evaluated."*

That second sentence is the ordering problem in one line: **the config file is evaluated before any
`.env` file is read**, so a `NODE_ENV` set in a file exists by the time your application code is
transformed, and does not exist while your config is deciding which plugins to enable. On the
command line it exists for both. Full treatment on [chunk 2](02-config-time-env-and-define.md).

### The one legitimate use of `NODE_ENV` in a file

`vite build` is a production build by default. The documented way to get an intentionally
**development** build — unminified, dev branches intact, useful for profiling something
production-shaped — is `NODE_ENV=development` inside a mode's env file:

```bash
# .env.testing
NODE_ENV=development
```

Note that this is the *same mechanism* as the incident below. The technique and the bug are
identical; the only difference is whether you meant it.

### What Vite 8 changed here

I grepped the v7→v8 [migration guide](https://vite.dev/guide/migration) for `env`, `mode`,
`NODE_ENV` and `loadEnv`. **No change to modes, `NODE_ENV` handling or the built-in constants is
listed.** Everything above is the model Vite 5–7 had.

---

## 2. Real-World Engineering Scenario

**A staging build that was quietly a development build for eleven weeks.**

A team wanted a real staging environment: its own API host, analytics off, feature flags defaulted
open. They did the obvious thing — `.env.staging`, and `vite build --mode staging` in CI. It worked.
The right API URL appeared, the right flags applied.

What nobody checked was that their Dockerfile also set `ENV NODE_ENV=staging`, because that felt
consistent with everything else in the file. `NODE_ENV=staging` is not `production`, so
`import.meta.env.PROD` was `false` and `DEV` was `true` for eleven weeks of staging builds. Every
development-only branch — verbose logging, an in-page debug panel, a mock-latency injector — survived
tree-shaking and shipped.

Three things made it durable:

- **No test could see it.** Staging passed its own suite, because the suite ran against staging.
  Production was untouched. The behaviour was self-consistent.
- **The symptom was performance, not failure.** The bundle was substantially larger and the app was
  slower under load. Nobody files a bug for "staging feels sluggish".
- **The config looked right.** `--mode staging` *was* correct. The `NODE_ENV` line was a redundant
  addition that silently inverted a different setting.

It surfaced when a load test against staging failed to reproduce a production performance
regression — the two environments were no longer comparable, which is the one thing staging is for.

The fix was one line: keep `--mode staging`, delete the `ENV NODE_ENV=staging`. **Mode is "which
configuration", `NODE_ENV` is "which build".**

---

## 3. Production-Grade Code Example

```json
// package.json — mode selects the env file. NODE_ENV is deliberately absent:
// `vite build` already sets NODE_ENV=production for every one of these.
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:staging": "vite build --mode staging",
    "preview:staging": "vite preview --mode staging",
    "build:profile": "vite build --mode profile"
  }
}
```

```bash
# .env.profile — the ONE documented reason to set NODE_ENV in a file:
# a deliberate development build, for profiling a production-shaped bundle
# with dev branches intact.
NODE_ENV=development
VITE_API_URL=https://api-staging.acme.com
```

```dockerfile
# Dockerfile — the fix from the scenario above, written down so it stays fixed.
FROM node:24-alpine AS build
WORKDIR /app
COPY . .

# ⛔ NEVER: ENV NODE_ENV=staging
#    "staging" is not "production", so import.meta.env.PROD becomes false and every
#    dev-only branch ships. NODE_ENV has exactly two useful values.
# ✅ Mode carries the environment identity; NODE_ENV carries the build kind.
RUN yarn build --mode staging
```

```typescript
// src/config/build-kind.ts — name the two axes separately, so no call site
// ever has to remember which one it wanted.
export const buildKind = {
  /** Which .env.[mode] was loaded. Free-form: 'production' | 'staging' | 'qa' | ... */
  environment: import.meta.env.MODE,

  /** Whether this is an optimised build. Driven by NODE_ENV, not by --mode. */
  isOptimised: import.meta.env.PROD,
} as const;

// ✅ "Is this the staging deployment?"  → environment
if (buildKind.environment === 'staging') enableStagingBanner();

// ✅ "Should I strip debug tooling?"    → isOptimised
if (!buildKind.isOptimised) mountDebugPanel();

// ❌ The mistake this file exists to prevent: using one to answer the other's question.
// if (buildKind.environment === 'production') stripDebugTooling();
```

```yaml
# .github/workflows/deploy.yml — an assertion, because review did not catch it for eleven weeks.
- name: Refuse a build whose NODE_ENV is neither production nor unset
  run: |
    if [ -n "$NODE_ENV" ] && [ "$NODE_ENV" != "production" ]; then
      echo "::error::NODE_ENV=$NODE_ENV yields import.meta.env.DEV=true. Use --mode instead."
      exit 1
    fi
- run: yarn build --mode staging
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Giving `NODE_ENV` a third value

```bash
# ❌ WRONG. Feels tidy, is wrong. Anything that is not "production" yields
#    PROD: false, DEV: true — a development build wearing a staging label.
NODE_ENV=staging vite build --mode staging

# ✅ CORRECT. Mode carries the identity; NODE_ENV keeps its two values.
vite build --mode staging
```

### ⚠️ Pitfall 2 — Expecting `--mode` to change what gets minified

`--mode` selects an env file. It does not change minification, tree-shaking, sourcemap defaults or
`NODE_ENV`. `vite build --mode staging` produces a fully optimised production build that happens to
have read `.env.staging`.

---

## Gotchas

**★ Symptom: `import.meta.env.DEV` is `true` in a build you consider production.** Cause: `NODE_ENV` is set to something that is neither `production` nor `development`, and the docs' table says anything else yields `PROD: false`, `DEV: true`. Fix: `NODE_ENV` gets exactly two values; use `--mode` for everything else.

```bash
# ❌ NODE_ENV=staging vite build --mode staging   → DEV=true, dev branches ship
# ✅
vite build --mode staging     # NODE_ENV is already "production" for vite build
```

**★ Symptom: the staging bundle is much larger than production's and nobody changed any code.** Cause: same as above — dev-only branches are no longer statically false, so nothing tree-shakes them. Fix: check `NODE_ENV` in the Dockerfile and the CI job, not in the application, and add a bundle-size assertion so the next occurrence fails a build instead of surviving eleven weeks.

**★ Symptom: staging stops reproducing production performance regressions.** Cause: the two builds are no longer comparable — one has dev branches and unoptimised paths. Fix: the same `NODE_ENV` fix, plus the recognition that this is the actual cost. A staging environment that is not production-shaped is not doing its job.

**★ Symptom: `vite build --mode development` still produces a minified bundle.** Cause: mode does not imply `NODE_ENV`. The docs' first table has exactly this row: mode `"development"`, `NODE_ENV` still `"production"`. Fix: set `NODE_ENV=development` in that mode's env file, which is the documented approach.

```bash
# .env.development
NODE_ENV=development
```

**★ Symptom: `process.env.NODE_ENV` is `undefined` inside `vite.config.ts` even though it is set in `.env`.** Cause: *"Vite can only load the env files once the config is evaluated"* — the config runs first. Fix: set it on the command line, where *"it allows Vite to detect the value early"*, or use `loadEnv` inside the config. Details on [chunk 2](02-config-time-env-and-define.md).

**★ Symptom: a custom mode's env file is never read.** Cause: the mode string must match the file suffix exactly — `--mode qa` reads `.env.qa`, not `.env.QA`. There is no fuzzy matching and no error for a mode with no file; Vite loads `.env` and `.env.local` and carries on. Fix: `ls .env.*` and compare against the `--mode` argument character by character.

**★ Symptom: `MODE` and `PROD` disagree and someone "fixes" it by aligning them.** Cause: they are *supposed* to be able to disagree — that is the entire design. Fix: do not align them. Name them separately in a config module so the two questions stay distinct, and let review catch a call site that asks one to answer the other's question.

---

## Interview questions

**★ What is the difference between `MODE` and `NODE_ENV`?**
They answer different questions and vary independently. **Mode** — set by `--mode`, reported as
`import.meta.env.MODE` — selects *which `.env.[mode]` file loads*. **`NODE_ENV`** decides what
`import.meta.env.PROD` and `.DEV` report. The docs' own table shows all four combinations are
reachable: `NODE_ENV=development vite build` gives `NODE_ENV: "development"` with mode
`"production"`. The rule is that mode is "which configuration" and `NODE_ENV` is "which build". The
failure mode is giving `NODE_ENV` a third value like `staging` — the docs are explicit that anything
other than `production` yields `PROD: false, DEV: true`, so a staging build ships every development
branch and nothing warns you.

**★ Why does mode exist at all, when `NODE_ENV` already names an environment?**
Because `NODE_ENV` is effectively a binary and always has been: `production` means optimised,
everything else means development. It cannot express "staging" without lying about one of the two
things it controls. Rather than overload it — which is what the ecosystem did for years, with
predictable results — Vite added a second, free-form axis whose only job is selecting configuration.
The design lesson generalises: when one variable is being asked two questions, adding a variable
beats adding a convention.

**★ How do you produce a deliberately unoptimised build for profiling?**
Not with `--mode`, which only selects an env file. The documented route is `NODE_ENV=development`
inside that mode's env file, built with `--mode <that mode>` — the docs show exactly this, with
`.env.testing` containing `NODE_ENV=development`. It works because `NODE_ENV` drives `PROD`/`DEV`,
and a build where `DEV` is `true` keeps every development branch as live code. Worth saying out
loud: this is the *same mechanism* as the staging incident. The technique and the bug are identical,
and the only difference is intent — which is a good argument for the CI assertion that fails on an
unexpected `NODE_ENV` rather than trusting everyone to remember.

**★ Why does `NODE_ENV` on the command line behave differently from `NODE_ENV` in a `.env` file?**
Ordering. *"it allows Vite to detect the value early. It also allows you to read
`process.env.NODE_ENV` in your Vite config as Vite can only load the env files once the config is
evaluated."* The config is evaluated **before** any `.env` file is read, because the set of files to
read depends on config options like `root` and `envDir` — and on the final mode. So a `NODE_ENV` in
a file exists by the time your application code is transformed, but not while your config decides
which plugins to enable. On the command line it exists for both.

---

← [`BASE_URL` & `SSR`](01d-base-url-and-ssr.md) · [Vite overview](../../README.md) · Next → [Modes in CI, `preview` & Containers](01f-modes-in-ci-and-containers.md)
