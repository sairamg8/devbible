---
title: "The Vite Environment System: `import.meta.env` Is a Compile-Time Substitution, Not a Runtime Object"
sidebar_label: "Env System & `.env` Files"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Env Variables and Modes](https://vite.dev/guide/env-and-mode), [Shared Options](https://vite.dev/config/shared-options). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ The Vite Environment System: `import.meta.env` Is a Compile-Time Substitution, Not a Runtime Object

This is chunk 1 of eighteen on Vite's environment system. It covers the **mechanism** and the **`.env`
file set** — how values get into a bundle, which files are read, from where, and what wins. What static
replacement *costs* you is [chunk 1a](01a-build-time-vs-runtime-config.md); the `VITE_` prefix and
the built-in constants are [chunk 1b](01b-the-vite-prefix-and-secrets.md);
modes and `NODE_ENV` are [chunk 1c](01e-modes-and-node-env.md); `dotenv-expand` is
[chunk 1d](01g-dotenv-expansion.md).

---

## 1. Under-The-Hood Mechanics

`import.meta.env` is **not an object read at runtime.** The docs are precise about the mechanism,
and the mechanism is what explains every gotcha across all four chunks:

> *"Vite exposes certain constants under the special `import.meta.env` object. These constants are defined as global variables during dev and statically replaced at build time to make tree-shaking effective."* — [Env Variables and Modes](https://vite.dev/guide/env-and-mode)

Two different implementations, one API:

```
DEVELOPMENT                              PRODUCTION BUILD
─────────────                            ────────────────
import.meta.env is a real object         import.meta.env.VITE_API_URL is TEXTUALLY
defined as a global on the dev server    REPLACED with the literal "https://api.example.com"
                                         before minification, so a branch guarded by
                                         import.meta.env.DEV becomes `if (false)` and
                                         is tree-shaken away entirely
```

That is why `if (import.meta.env.DEV)` deletes its whole body from the production bundle, and it is
also why nothing you do at runtime can change a value — there is no variable left to change. Three
consequences follow immediately, and they account for most of the confusion in this area:

1. **Dynamic access does not work the way you expect.** A textual replacement needs a statically
   analysable property name. `import.meta.env[someKey]` has none.
2. **You cannot reconfigure a built artefact.** The values are literals inside minified JavaScript.
   One-build-many-environments requires a runtime fetch or a server-injected script tag, not
   `import.meta.env`.
3. **Values are frozen at build time**, which is exactly why a `.env` edit does nothing to a running
   dev server until you restart it.

### The `.env` file set

> *"Vite uses dotenv to load additional environment variables from the following files in your environment directory"*

```
.env                # loaded in all cases
.env.local          # loaded in all cases, ignored by git
.env.[mode]         # only loaded in specified mode
.env.[mode].local   # only loaded in specified mode, ignored by git
```

The directory is `envDir` — **`root` by default, not the current working directory.**

> *"The directory from which `.env` files are loaded. Can be an absolute path, or a path relative to the project root. `false` will disable the `.env` file loading."* — [`envDir`](https://vite.dev/config/shared-options#envdir), type `string | false`, default `root`

In a monorepo `root` and `cwd` are usually not the same place, which is why a `.env` at the
repository root is silently invisible to a package that runs `vite` from its own folder. There is no
warning — the variables are simply `undefined`.

### Precedence — three documented rules, and one the docs deliberately do not state

> *"An env file for a specific mode (e.g. `.env.production`) will take higher priority than a generic one (e.g. `.env`)."*

> *"Vite will always load `.env` and `.env.local` in addition to the mode-specific `.env.[mode]` file. Variables declared in mode-specific files will take precedence over those in generic files, but variables defined only in `.env` or `.env.local` will still be available in the environment."*

> *"In addition, environment variables that already exist when Vite is executed have the highest priority and will not be overwritten by `.env` files. For example, when running `VITE_SOME_KEY=123 vite build`."*

So the documented order is:

```
process env (shell, CI, Docker ENV)   ← HIGHEST, never overwritten by any file
        ▲
   .env.[mode] / .env.[mode].local          (mode-specific beats generic)
        ▲
   .env / .env.local                        (always loaded, lowest)
```

⚠️ **The documentation does not rank `.env.local` against `.env.[mode]`.** It states
mode-specific-beats-generic, and it states that `.env.local` is always loaded; it never says which
wins when both define the same key. **Do not build a deployment on that ordering.** If a personal
override must beat a mode file, put it in `.env.[mode].local` — unambiguously mode-specific — or
export it in the shell, where the highest-priority rule settles it.

### Reload semantics

> *"`.env` files are loaded at the start of Vite. Restart the server after making changes."*

HMR operates on the module graph. Env loading happens once, during server startup, before that graph
exists. This is not a limitation anyone plans to remove: the whole point of the substitution model is
that the value is fixed at the moment the module is transformed.

---

## 2. Real-World Engineering Scenario

**The CI variable that beat the file, for six weeks, on one branch only.**

A deploy pipeline exported `VITE_API_URL` pointing at an internal hostname, because an early smoke
test needed it. Months later the same repository grew a proper `.env.production` with the public API
URL. Local builds were correct. Preview deploys were correct. The production pipeline shipped the
internal hostname — resolvable inside the VPC, a DNS failure from a customer's browser.

Nobody suspected the `.env` file, because the `.env` file was right and everybody could see it was
right. The rule that explains it is one sentence in the docs: *"environment variables that already
exist when Vite is executed have the highest priority and will not be overwritten by `.env` files."*
The pipeline's `export` outranked the file, silently, by design.

The real defect was not precedence, it was **the same key living in two places**. Precedence rules
are what you fall back on when you have already lost. The fix was to delete the CI export and let
the file own the key — plus a one-line CI assertion that fails the build if any `VITE_*` variable is
present in the environment before `vite build` runs.

---

## 3. Production-Grade Code Example

```bash
# .env — shared defaults, committed.
VITE_APP_NAME=Acme Dashboard
VITE_SENTRY_ENABLED=false

# .env.production — committed, mode-specific, beats .env
VITE_API_URL=https://api.acme.com
VITE_SENTRY_ENABLED=true

# .env.staging — committed
VITE_API_URL=https://api-staging.acme.com

# .env.local — GITIGNORED. Personal machine overrides only.
VITE_API_URL=http://localhost:4000

# .env.production.local — GITIGNORED, and unambiguously mode-specific.
# Use THIS shape when a personal override must beat a mode file; the docs do
# not rank .env.local against .env.[mode], so never rely on that comparison.
VITE_API_URL=http://localhost:4000
```

```gitignore
# .gitignore — the docs are explicit:
# ".env.*.local files are local-only and can contain sensitive variables.
#  You should add *.local to your .gitignore"
*.local
```

```yaml
# .github/workflows/deploy.yml — the assertion the scenario above was missing.
# A VITE_* key in the process environment silently outranks every .env file,
# so fail loudly rather than shipping the wrong host.
- name: Refuse to build with VITE_* leaking in from the environment
  run: |
    if env | grep -q '^VITE_'; then
      echo "::error::VITE_* variables in the environment outrank .env files. Remove them."
      env | grep '^VITE_' | cut -d= -f1
      exit 1
    fi
- run: yarn build --mode production
```

```typescript
// vite.config.ts — envDir, for a workspace package that must read a shared .env.
import { defineConfig } from 'vite';

export default defineConfig({
  // Defaults to `root` — which is THIS package, not the repository.
  // A .env two levels up is not read at all without this line.
  envDir: '../../config/env',

  // envDir: false would disable .env loading entirely — useful when every value
  // is injected by the platform and you want an implicit file to be impossible.
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — A shell variable silently outranking your file

```bash
# CI exports this for a smoke test:
export VITE_API_URL=https://api.internal.acme.com

# ...and then, three steps later:
vite build --mode production      # .env.production says https://api.acme.com

# ❌ The build ships the INTERNAL url. The file did not win, and nothing warned.
# ✅ Unset it, or stop keeping the same key in both places.
env -u VITE_API_URL vite build --mode production
```

### ⚠️ Pitfall 2 — Editing `.env` with the dev server running

HMR reloads modules; it does not re-read `.env`. The value in the browser is the one that was on
disk when you ran `vite`. If a value needs to change without a restart, it is not build-time config
at all — it is runtime config, and it belongs behind a fetch.

### ⚠️ Pitfall 3 — `envDir` in a monorepo

`envDir` defaults to `root`. Running `vite` from `apps/web/` in a workspace makes `root` equal to
`apps/web/`, so a `.env` at the repository root is not read — no warning, no error, just `undefined`
where you expected a URL. Set `envDir` explicitly the day a project gains its second package.

---

## Gotchas

**★ Symptom: `.env.production` is ignored on CI but works locally.** Cause: CI exports the same key into the process environment, and *"environment variables that already exist when Vite is executed have the highest priority."* Fix: pick one source of truth per key — either the file or the CI secret, never both — and assert it in the pipeline.

```bash
env -u VITE_API_URL vite build     # or delete the export from the CI job
```

**★ Symptom: editing `.env` changes nothing in the running dev server.** Cause: *"`.env` files are loaded at the start of Vite."* HMR does not re-read them. Fix: restart. If this bites weekly, that value wants to be runtime config fetched from an endpoint, not build-time config.

**★ Symptom: `.env` at the repo root is invisible to a workspace package.** Cause: `envDir` defaults to `root`, and `root` is the package, not the repository. Fix: set `envDir` explicitly, or `envDir: false` if you want to guarantee nothing is loaded implicitly.

```js
export default defineConfig({ envDir: '../../config/env' });
```

**★ Symptom: `.env.local` got committed and a reviewer found a personal token in the diff.** Cause: `*.local` was never gitignored — `create vite` scaffolds that entry, a hand-rolled project does not. Fix: add `*.local` to `.gitignore`, then purge the history; `git rm --cached` alone leaves the value in every prior commit, and the token must be rotated regardless.

**★ Symptom: two developers disagree about whether `.env.local` beats `.env.production`.** Cause: the documentation genuinely does not say. It ranks mode-specific above generic and states that `.env.local` is always loaded, and stops there. Fix: do not depend on it. Put personal mode overrides in `.env.[mode].local`, which is unambiguously mode-specific.

**★ Symptom: `envDir: false` and now nothing is defined.** Cause: `false` *"will disable the `.env` file loading"* completely — not "fall back to the default directory". Fix: it is doing what it says. Use it only when the platform injects every variable into the process environment, where the highest-priority rule then applies.

**★ Symptom: an `.env` file added while the container was building has no effect.** Cause: a `.dockerignore` excluding `.env*` — a very common and mostly correct default — means the file is not in the build context at all. Fix: decide deliberately. Either the container gets values via `ENV`/build args (process env, highest priority), or the file is copied in; silently having neither is the failure.

---

## Interview questions

**★ Is `import.meta.env` an object you can read at runtime?**
In dev, effectively yes — it is *"defined as global variables during dev."* In a production build,
no: the values are *"statically replaced at build time."* `import.meta.env.VITE_API_URL` is not a
property lookup in the shipped bundle, it is the literal string. This is not pedantry; it has three
consequences people hit. Dynamic access like `import.meta.env[key]` cannot be replaced. You cannot
change a value after the build without rebuilding. And `if (import.meta.env.DEV)` becomes
`if (false)` and is removed entirely — which the docs say is the *reason* for the design, *"to make
tree-shaking effective."*

**★ What actually wins when the same key is in `.env`, `.env.production` and the shell?**
The shell, unconditionally: *"environment variables that already exist when Vite is executed have
the highest priority and will not be overwritten by `.env` files."* Then mode-specific beats generic.
The honest part of this answer is where it stops — the docs never rank `.env.local` against
`.env.[mode]`, so a candidate who confidently recites a four-level total ordering is reciting a blog
post, not the documentation. The engineering point is that a key living in two places at once *is*
the bug; precedence is what you fall back on once you have already lost.

**★ Why does `envDir` default to `root` rather than `process.cwd()`?**
Because `root` is the project Vite is building, and `cwd` is wherever the shell happened to be. In a
single-package repo they coincide and nobody notices. In a workspace they diverge immediately, and
resolving relative to `cwd` would mean the same command produced different builds depending on which
directory you launched it from — exactly the non-reproducibility a build tool exists to eliminate.
The cost is the monorepo surprise: a shared `.env` at the repository root is simply not read, with
no warning.

**★ A `.env` change does not show up despite HMR reloading the page. Why?**
*"`.env` files are loaded at the start of Vite."* HMR operates on the module graph; env loading
happens once during server startup, before that graph exists. The interesting follow-up is what that
tells you about the value: anything you want to change without a restart is not build-time config,
and treating a restart as an annoyance rather than a signal is how a value ends up in the wrong
layer for the rest of the project's life.

---

← [Asset Handling](../06-asset-handling/01-static-asset-imports.md) · [Vite overview](../../README.md) · Next → [What Static Replacement Costs You](01a-build-time-vs-runtime-config.md)
