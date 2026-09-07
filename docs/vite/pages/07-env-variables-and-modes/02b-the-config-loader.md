---
title: "How Vite Loads `vite.config.ts`: the Bundle Loader, `--configLoader native`, and Why Breakpoints Miss"
sidebar_label: "The Config Loader"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-07 against the Vite documentation — [Configuring Vite](https://vite.dev/config/). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ How Vite Loads `vite.config.ts`

Your config is TypeScript. Node cannot execute TypeScript without help. Something has to bridge
that, and *which* something it is explains a small family of confusing behaviours — breakpoints that
miss, an import that resolves differently than in your app, and a default the docs say is going to
change.

---

## 1. Under-The-Hood Mechanics

> *"By default, Vite uses Rolldown to bundle the config into a temporary file and load it. If you're using an environment that supports TypeScript (e.g. Node 22.18+), or if you're only writing plain JavaScript, you can specify `--configLoader native` to use the environment's native runtime to load the config file. `configLoader: 'native'` is planned to become the default in a future major version."*

```
bundle (the default today)            native (the future default)
──────────────────────────            ───────────────────────────
Rolldown bundles vite.config.ts       the runtime executes the file directly
  → node_modules/.vite-temp/…           → no temp file, no source-map indirection
  → an inline source map is emitted     → needs Node 22.18+ for TypeScript
  → works on any supported Node         → imports resolved by the RUNTIME
  → imports resolved by the BUNDLER
```

Note the last row of each column: the two loaders resolve your config's imports through different
machinery. That is the non-obvious one.

### Why breakpoints miss

> *"The native loader executes the original config file directly, so breakpoints in the config file and in plugin hooks such as `transform` map to the original source."*

> *"When using `--configLoader bundle` (the current default, though native is planned to become the default in a future major version), Vite generates an inline source map and writes the bundled config to `node_modules/.vite-temp` before loading it."*

Under the bundle loader the code actually executing is a generated file inside `node_modules`, which
most debugger configurations skip by default. The source map exists, but the debugger has to be told
that a location under `node_modules` is worth mapping — which is exactly the rule that stops you
stepping into third-party code.

### The second-order consequence: import resolution

Under the bundle loader your config's imports are **bundled** by Rolldown; under native they are
resolved by Node. A package that is sensitive to that difference — conditional `exports`, a dual
CommonJS/ESM package, a self-referencing import — can behave differently in the config than in your
application, where it is always the app's own resolution that applies.

This is rare and extremely confusing when it happens, and it has a one-command diagnostic:
switch loaders and see whether the symptom moves.

### Why the default is changing

The bundle loader exists because TypeScript configs predate Node being able to run TypeScript. As
runtimes gained native type-stripping — the docs name Node 22.18+ — the bridge became optional, and
a loader that executes your actual file is strictly better for debugging, for resolution fidelity
and for not writing into `node_modules`. Hence *"planned to become the default in a future major
version."*

⚠️ **The migration is not free.** Native execution means your config may use only syntax the runtime
understands. A config relying on a TypeScript feature that type-stripping cannot handle — anything
requiring type-directed emit — works under bundle and fails under native.

---

## 2. Real-World Engineering Scenario

**A day lost to a plugin that "did nothing", in a config nobody could step through.**

A team added a custom plugin to `vite.config.ts` to rewrite an import during build. It did nothing —
no error, no transformed output. The natural next step was a breakpoint in the plugin's `transform`
hook.

The breakpoint never bound. VS Code showed it hollow. So the team fell back on `console.log`, which
worked, and spent the day narrowing the problem by print statements through a hook that runs once per
module in a project with two thousand modules.

The reason the breakpoint missed had nothing to do with the plugin: the default loader bundles the
config to `node_modules/.vite-temp` and executes *that*, and the debugger was configured — as almost
every debugger is — to skip `node_modules`. The source map was present and being ignored by policy.

Two lines would have avoided the day. Either run with the native loader, which executes the real
file:

```bash
vite --configLoader native
```

or tell the debugger that this one path under `node_modules` is yours. The wider point is a
diagnostic habit: **when a debugger silently declines to bind, ask what is actually executing
before you ask what the code does.** A hollow breakpoint is information, not a tooling annoyance.

---

## 3. Production-Grade Code Example

```bash
# Debugging the config or a plugin hook: execute the real file.
vite --configLoader native

# The default bundles first. This is where your breakpoints would otherwise land.
ls node_modules/.vite-temp/
```

```typescript
// vite.config.ts — pinning the loader in config rather than remembering a flag.
import { defineConfig } from 'vite';

export default defineConfig({
  // 'native' requires a runtime that can execute this file's syntax directly
  // (Node 22.18+ for TypeScript). It is documented as the future default.
  configLoader: 'native',
});
```

```json
// .vscode/settings.json — only needed while on the bundle loader.
// Debuggers skip node_modules by design; this carves out the one path that is yours.
{
  "debug.javascript.terminalOptions": {
    "skipFiles": ["<node_internals>/**"],
    "resolveSourceMapLocations": [
      "${workspaceFolder}/**",
      "!**/node_modules/**",
      "${workspaceFolder}/node_modules/.vite-temp/**"
    ]
  }
}
```

```bash
# The one-command diagnostic for a config-only import error.
# If the symptom disappears, the difference is RESOLUTION, not the package.
vite build                            # fails
vite build --configLoader native      # succeeds → bundler vs runtime resolution
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Breakpoints landing in a file you did not write

The default loader bundles the config to `node_modules/.vite-temp` before executing it. The debugger
skips `node_modules`, so the breakpoint silently does not bind. Use `--configLoader native`, or
carve out the temp directory in your debugger config.

### ⚠️ Pitfall 2 — A dependency behaving differently in the config than in the app

Bundled resolution and runtime resolution are not the same. Conditional exports, dual packages and
self-referencing imports are the usual suspects. Switching loaders localises it in one command.

### ⚠️ Pitfall 3 — Assuming `native` is a free upgrade

Native execution constrains your config to syntax the runtime can handle by type-stripping alone.
Anything needing type-directed emit works under bundle and fails under native. Try it before you pin
it, and try it well before the default changes.

### ⚠️ Pitfall 4 — Committing `node_modules/.vite-temp` artefacts to a Docker layer

The bundle loader writes into `node_modules` at build time, which means a `node_modules` layer
copied between stages can carry a stale bundled config. It is not a correctness problem in practice,
but it is a source of "why is this image bigger" and of confusing cache behaviour.

### ⚠️ Pitfall 5 — Treating a hollow breakpoint as a tooling annoyance

It is a signal that the file you are looking at is not the file that runs. That is worth five
seconds of thought in any project, and in a Vite config it has one specific, documented cause.

---

## Gotchas

**★ Symptom: breakpoints in `vite.config.ts` do not bind, or bind to unfamiliar code.** Cause: the default loader bundles the config into `node_modules/.vite-temp` first, and debuggers skip `node_modules` by policy. Fix: `vite --configLoader native`, or add the temp directory to `resolveSourceMapLocations`.

```bash
vite --configLoader native
```

**★ Symptom: breakpoints in a plugin's `transform` hook never fire, though the hook demonstrably runs.** Cause: same one — plugin hooks defined in the config are part of the bundled config, so they execute from the temp file too. Fix: same one. The docs call this out explicitly for `transform`.

**★ Symptom: a package works in application code and throws when imported by the config.** Cause: the bundle loader bundles the config's imports, so resolution differs from the runtime's. Fix: try `--configLoader native` as a diagnostic. If native fixes it, the difference is resolution, not the package.

**★ Symptom: `configLoader: 'native'` fails on a config that compiles fine.** Cause: native execution relies on the runtime's type-stripping, which handles only syntax that can be erased. A construct requiring type-directed emit has no erasure. Fix: rewrite that construct, or stay on the bundle loader — but do the experiment now, since the default is documented as changing.

**★ Symptom: `--configLoader native` fails on an older Node.** Cause: TypeScript configs need a runtime that can execute them — the docs name Node 22.18+. Fix: upgrade the runtime, or keep the bundle loader; there is no third option and no polyfill for this.

**★ Symptom: a stale config seems to be in effect after an edit.** Cause: the bundle loader writes a temp artefact; a stale one being picked up is worth ruling out early, especially in containers where `node_modules` is a copied layer. Fix: remove `node_modules/.vite-temp` and re-run, or switch to the native loader, which has no temp file to go stale.

**★ Symptom: stack traces from config-time errors point at line numbers that do not match the file.** Cause: the inline source map maps the bundle back to source, but any tool in the chain that ignores source maps reports bundle positions. Fix: reproduce under `--configLoader native`, where the positions are genuine because the original file is what executed.

**★ Symptom: a team disagrees about whether to add `configLoader: 'native'` now.** Cause: it is a real trade — better debugging and resolution fidelity today, against a runtime-version floor and a syntax constraint. Fix: the docs settle the direction — *"planned to become the default in a future major version"* — so the question is only timing. Trying it in CI on a branch costs one flag and tells you whether the migration is already free.

---

## Interview questions

**★ Why would you ever set `--configLoader native`?**
For debugging, and increasingly by default. The bundle loader compiles the config to
`node_modules/.vite-temp` and runs that, so breakpoints and stack traces point at generated code
that most debuggers skip; native *"executes the original config file directly, so breakpoints in the
config file and in plugin hooks such as `transform` map to the original source."* The cost is that
your runtime must understand the file's syntax without a compile step — Node 22.18+ for TypeScript.
The docs note it is *"planned to become the default in a future major version"*, so this is a
transition worth being ahead of rather than a niche flag.

**★ You get an inexplicable error importing a package from `vite.config.ts` that works fine in `src/`. Where do you look?**
The config loader. Under the default, *"Vite uses Rolldown to bundle the config into a temporary
file"*, so the config's imports go through a bundler's resolution rather than the runtime's —
conditional exports, dual CommonJS/ESM packages and self-referencing imports can all resolve
differently. Switching to `--configLoader native` is a one-command diagnostic: if it fixes the
error, the problem is resolution rather than the package, and you can decide whether to pin the
loader or fix the import. The general habit is more valuable than the specific fix: when the same
code behaves differently in two contexts, compare the *loaders* before comparing the code.

**★ Why does a TypeScript Vite config need a loader at all, when the rest of the project has a build step?**
Because the config is what *configures* the build — it has to execute before any of your build
machinery exists. That bootstrap has to be self-sufficient, so Vite historically bundled it with a
tool it already ships. As runtimes gained native type-stripping the bootstrap stopped needing a
bundler, which is precisely why the default is changing. It is a nice illustration of a general
pattern: bootstrap layers accumulate machinery to compensate for platform gaps, and shed it when the
platform catches up.

**★ What could break when the default flips to `native`?**
Two things. A project on a runtime older than the documented floor — Node 22.18+ for TypeScript
configs — loses the ability to load a `.ts` config at all. And a config using TypeScript syntax that
cannot be erased, requiring type-directed emit, has nothing for type-stripping to do. Both are
discoverable today with one flag on a branch, which is the actual answer to "how do you prepare for
a documented future default": run it now and find out, rather than reading the changelog when it
lands.

**★ A breakpoint shows hollow and never binds. What does that tell you before you look at any code?**
That the file the debugger is mapping is not the file being executed — which is a statement about
the *loader*, not the logic. In a Vite config it has one documented cause: the bundle loader wrote
the executing copy into `node_modules/.vite-temp`, and the debugger skips `node_modules` by policy.
Recognising the shape of the signal is what saves the time; the team in this page's scenario spent a
day narrowing a plugin bug by print statements when the actual finding was "this is not the code
that runs."

---

← [Conditional Config](02a-conditional-config-and-the-loader.md) · [Vite overview](../../README.md) · Next → [`define` & HTML Replacement](02c-define-and-html-replacement.md)
