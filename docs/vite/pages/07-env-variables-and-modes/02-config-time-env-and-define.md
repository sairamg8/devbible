---
title: "Why `vite.config.ts` Cannot Read Its Own `.env`, and What `loadEnv` Is Actually For"
sidebar_label: "Config-Time Env & `loadEnv`"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Configuring Vite](https://vite.dev/config/), [Env Variables and Modes](https://vite.dev/guide/env-and-mode). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Why `vite.config.ts` Cannot Read Its Own `.env`

Every Vite project eventually writes `import.meta.env.VITE_API_URL` inside `vite.config.ts`, gets
`undefined`, and assumes it is a bug. It is not — it is a **circular dependency the documentation
resolves explicitly**, and understanding the ordering explains three other things at the same time.

---

## 1. Under-The-Hood Mechanics

### The circularity

> *"Environment variables available while the config itself is being evaluated are only those that already exist in the current process environment (`process.env`). Vite deliberately defers loading any `.env*` files until after the user config has been resolved because the set of files to load depends on config options like `root` and `envDir`, and also on the final mode."* — [Configuring Vite](https://vite.dev/config/)

Read that reason carefully, because it is the whole page:

```
Which .env files do we load?
        │
        ├─ depends on `root`      ─┐
        ├─ depends on `envDir`    ─┤─ all of which live IN THE CONFIG
        └─ depends on the mode    ─┘
                                    │
                                    ▼
                    …so the config must be resolved FIRST.
```

Vite cannot know which files to read until it has read the config, so the config cannot see the
files. This is not an oversight to be worked around; it is the only ordering that is coherent.

> *"variables defined in `.env`, `.env.local`, `.env.[mode]`, or `.env.[mode].local` are not automatically injected into `process.env` while your `vite.config.*` is running."*

And the reassuring half, which people miss and then over-engineer around:

> *"They are automatically loaded later and exposed to application code via `import.meta.env` (with the default `VITE_` prefix filter) exactly as documented in Env Variables and Modes. So if you only need to pass values from `.env*` files to the app, you don't need to call anything in the config."*

🔴 **If your `.env` values only need to reach application code, do nothing.** The config detour is
for a narrower case.

### `loadEnv` — for when a value must influence the config itself

> *"If, however, values from `.env*` files must influence the config itself (for example to set `server.port`, conditionally enable plugins, or compute `define` replacements), you can load them manually using the exported `loadEnv` helper."*

```js
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the
  // `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    define: {
      __APP_ENV__: JSON.stringify(env.APP_ENV),
    },
    server: {
      port: env.APP_PORT ? Number(env.APP_PORT) : 5173,
    },
  }
})
```

Three details in that documented example are load-bearing:

1. **`mode` comes from the config function's argument**, not from `process.env`. Vite knows the mode
   before it reads env files — it comes from the CLI.
2. **`process.cwd()`, not `root`.** The helper takes an explicit directory because at this point
   `root` has not been resolved yet. In a monorepo this is exactly where the two diverge, and the
   docs' own example uses `cwd`.
3. **The third parameter `''`** — *"Set the third parameter to `''` to load all env regardless of
   the `VITE_` prefix."* This is the one place unprefixed variables are readable from a `.env` file,
   and it is safe here **because config-time reads do not expose anything** — exposure happens only
   if you then pass the value to `define`.

### `NODE_ENV` is the exception

`NODE_ENV` on the **command line** is readable in the config, and that is stated as its main
advantage:

> *"The main benefit with `NODE_ENV=...` in the command is that it allows Vite to detect the value early. It also allows you to read `process.env.NODE_ENV` in your Vite config as Vite can only load the env files once the config is evaluated."*

The same variable in a `.env` file is not readable there — same ordering, no exception.

---

## 2. Real-World Engineering Scenario

**A proxy target that was `undefined` for everyone except the person who added it.**

A team added a dev-server proxy so the frontend could call the API without CORS:

```ts
server: { proxy: { '/api': { target: import.meta.env.VITE_API_URL } } }
```

It worked for the author, because they had `VITE_API_URL` exported in their shell from an earlier
experiment — and *"environment variables that already exist when Vite is executed"* **are** visible
to the config, since they are in `process.env`. Everyone else got `target: undefined`, which Vite's
proxy reported as an opaque connection error rather than a config error.

The team's first fix made it worse: they added `VITE_API_URL` to their shell profiles. That worked,
and it moved a project-level configuration into eight developers' dotfiles, where it promptly
drifted — two people kept a staging URL after the project moved to a local API.

The correct fix is `loadEnv`, and the reason to prefer it is not just correctness: it keeps the value
in a file that is in the repository, reviewed, and identical for everyone.

```ts
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return { server: { proxy: { '/api': { target: env.VITE_API_URL } } } };
});
```

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts — the full shape, with each documented constraint applied.
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode, isSsrBuild, isPreview }) => {
  // '' loads EVERY variable, prefixed or not. Safe here: reading at config time
  // exposes nothing — only passing a value to `define` or a client-visible option does.
  const env = loadEnv(mode, process.cwd(), '');

  // Fail fast, in CI, rather than producing a proxy target of `undefined`.
  if (command === 'serve' && !env.VITE_API_URL) {
    throw new Error(`VITE_API_URL is required for dev. Add it to .env.${mode} or .env.local`);
  }

  return {
    // ⚠️ Explicit === true / === false. A tool that does not pass these flags
    //    sends `undefined`, and `if (!isSsrBuild)` would silently take this branch.
    ssr: isSsrBuild === true ? { noExternal: ['some-esm-only-pkg'] } : undefined,
    plugins: [isPreview === true && previewBannerPlugin()].filter(Boolean),

    server: {
      port: env.APP_PORT ? Number(env.APP_PORT) : 5173,
      proxy: { '/api': { target: env.VITE_API_URL, changeOrigin: true } },
    },
  };
});
```

```typescript
// ❌ The four shapes that do NOT work in vite.config.ts, and why.

// 1. import.meta.env is application-code API. The config is not application code.
//    proxy: { '/api': { target: import.meta.env.VITE_API_URL } }   // undefined

// 2. process.env does not contain .env values at config time — only what the
//    shell already exported. Works on the machine that exported it; nowhere else.
//    port: Number(process.env.VITE_PORT)

// 3. Reading the file by hand re-implements mode resolution, envDir and expansion,
//    and gets all three subtly wrong. loadEnv exists for this.
//    const env = parse(readFileSync('.env'))

// 4. NODE_ENV from a .env file. Same ordering — the file has not been read yet.
//    Only NODE_ENV on the COMMAND LINE is visible here.
//    if (process.env.NODE_ENV === 'staging') { }
```

```bash
# Debugging what the config actually saw. `native` executes the original file,
# so breakpoints and stack frames map to your source rather than to
# node_modules/.vite-temp.
vite --configLoader native
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — `import.meta.env` in the config

It is the application-code API and the config is not application code. It does not throw; it is
`undefined`, which flows into an option and fails somewhere unrelated.

### ⚠️ Pitfall 2 — `process.env.VITE_*` in the config

This works **only** if something already exported the variable — which is exactly why it works for
the person who wrote it and nobody else. The failure is machine-dependent, which is the worst
distribution of failures a config bug can have.

### ⚠️ Pitfall 3 — `loadEnv(mode, root, ...)` with the wrong directory

The docs' example passes `process.cwd()` because `root` is not resolved yet. Passing a `root` you
have written in the same object works by accident when they coincide, and diverges in a monorepo —
the same divergence as `envDir` in [chunk 1](01-environment-system.md), one stage earlier.

### ⚠️ Pitfall 4 — Loading everything with `''` and then exposing it

`loadEnv(mode, cwd, '')` reads unprefixed variables including secrets. That is safe while the value
stays in the config. It stops being safe the moment it reaches `define`, a client-visible option, or
an HTML replacement. The prefix filter does not protect you here — you have deliberately stepped
around it.

---

## Gotchas

**★ Symptom: `import.meta.env.VITE_X` is `undefined` inside `vite.config.ts`.** Cause: `import.meta.env` is the application-code API; the config runs before env files are loaded. Fix: use `loadEnv` inside a config function.

```ts
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return { server: { port: Number(env.APP_PORT ?? 5173) } };
});
```

**★ Symptom: a config value works for one developer and is `undefined` for everyone else.** Cause: `process.env.VITE_*` in the config reads only what the shell already exported, and that person had exported it. Fix: `loadEnv`, so the value lives in a reviewed file rather than in eight different dotfiles.

**★ Symptom: a dev proxy fails with a connection error rather than a config error.** Cause: `target: undefined` — the proxy reports the downstream failure, not the missing option. Fix: validate required config-time values and throw with a message naming the file to add them to.

```ts
if (command === 'serve' && !env.VITE_API_URL) throw new Error(`add VITE_API_URL to .env.${mode}`);
```

**★ Symptom: `process.env.NODE_ENV` is `undefined` in the config although `.env` sets it.** Cause: the same ordering — env files are read after the config resolves. Fix: set `NODE_ENV` on the command line, where *"it allows Vite to detect the value early"*, which the docs name as its main benefit.

**★ Symptom: `loadEnv` returns nothing in a monorepo package.** Cause: the directory argument. The docs' example uses `process.cwd()`; passing a `root` from the same config object, or an unresolved relative path, points at the wrong place. Fix: pass an explicit absolute path when `cwd` is not the package.

**★ Symptom: `loadEnv(mode, dir)` without the third argument misses unprefixed variables.** Cause: it applies the `VITE_` prefix filter by default. Fix: pass `''` — *"Set the third parameter to `''` to load all env regardless of the `VITE_` prefix"* — and remember that stepping around the filter means you now own the exposure decision.

**★ Symptom: hand-parsing `.env` in the config "works" and then breaks on a mode change.** Cause: a hand-rolled reader re-implements mode resolution, `envDir`, precedence and `dotenv-expand`, and will get at least one of them wrong. Fix: `loadEnv` implements all four. There is no case where hand-parsing is the right answer.

---

## Interview questions

**★ Why can't `vite.config.ts` read its own `.env` file?**
Because it would be circular, and the docs say so directly: the set of files to load *"depends on
config options like `root` and `envDir`, and also on the final mode"* — all of which live in the
config. Vite cannot know which files to read until the config is resolved, so the config cannot see
the files. The important follow-up is that most people who hit this do not need the config to see
them at all: *"if you only need to pass values from `.env*` files to the app, you don't need to call
anything in the config."* The config detour is for the narrow case where a value must shape the
config itself — a port, a conditional plugin, a `define`.

**★ What does `loadEnv`'s third parameter do, and when would you pass `''`?**
It is the prefix filter. Passing `''` loads every variable regardless of the `VITE_` prefix, which
is the documented way to read unprefixed values in the config. It is safe there precisely because
config-time reading exposes nothing — the prefix filter governs what reaches `import.meta.env` in
application code, and the config is not application code. It stops being safe the moment you pass
one of those values to `define`, to a client-visible option, or to an HTML replacement, because at
that point you have deliberately stepped around the gate and now own the decision yourself.

**★ Why does the docs' `loadEnv` example use `process.cwd()` rather than `root`?**
Because `root` has not been resolved at that point — that is the same circularity, one stage
earlier. `cwd` is the only directory that definitely exists and is definitely known. In a
single-package repo they coincide and it never matters; in a monorepo they diverge, and passing a
half-resolved `root` produces an empty env object with no error. If `cwd` is not the package you
mean, pass an explicit absolute path rather than trusting either.

**★ Someone's config works on their machine and nowhere else. What is your first guess?**
That the config reads `process.env.SOMETHING` and their shell exports it. It is the one class of
config bug with a machine-dependent distribution, because *"environment variables that already exist
when Vite is executed"* are visible to the config while `.env` files are not — so the author's
earlier `export` makes the code look correct. The fix is `loadEnv`, and the reason to prefer it goes
beyond correctness: it puts the value in a reviewed file in the repository instead of in everyone's
dotfiles, where it drifts silently and nobody can diff it.

---

← [Sharing `.env` Across Tools](01i-sharing-env-across-tools.md) · [Vite overview](../../README.md) · Next → [Conditional Config & the Config Loader](02a-conditional-config-and-the-loader.md)
