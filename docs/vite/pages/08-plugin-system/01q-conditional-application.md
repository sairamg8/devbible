---
title: "`apply` excludes a plugin structurally — a serve-only plugin is never invoked in a build, which is strictly stronger than any runtime `if` you can write inside it"
sidebar_label: "Conditional Application (`apply`)"
sidebar_position: 35
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § Conditional Application](https://vite.dev/guide/api-plugin), [§ `config`](https://vite.dev/guide/api-plugin), [§ `configResolved`](https://vite.dev/guide/api-plugin), [§ Rolldown Plugin Compatibility](https://vite.dev/guide/api-plugin). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Conditional Application (`apply`)

**`apply` is the difference between "this plugin might not do anything in a build" and "this plugin
is not in the build".** The first is a branch: it exists, it is checked at runtime, and it is
silently taken either way. The second is structural — there is no absence to guard, no branch to
get wrong, and a non-null assertion on the dev server becomes genuinely *true* rather than merely
quiet. Every plugin that carries `if (server)` should first be asked whether it wanted
`apply: 'serve'`.

---

## 1. Under-The-Hood Mechanics

### The default is both

> *"By default plugins are invoked for both serve and build. In cases where a plugin needs to be
> conditionally applied only during serve or build, use the `apply` property to only invoke them
> during `'build'` or `'serve'`:"*

> ```js
> function myPlugin() {
>   return {
>     name: 'build-only',
>     apply: 'build', // or 'serve'
>   }
> }
> ```

Two values, and the key sits at plugin level beside `name` and `enforce` — not inside a hook.

### The function form, verbatim

> *"A function can also be used for more precise control:"*
>
> ```js
> apply(config, { command }) {
>   // apply only on build but not for SSR
>   return command === 'build' && !config.build.ssr
> }
> ```

⚠️ The documentation gives this form as an example only — there is no published `Type` line for
`apply`. So the parameter shape is settled by the example (`config`, then an env object exposing
`command`) and nothing more; in particular the docs do not state whether `config.build` is
guaranteed to be defined at that point. `config.build?.ssr` is the defensive spelling, and the
divergence from the documented example is worth a comment if you use it.

### `command` is `'serve' | 'build'`, and there is no `'dev'`

> *"Note that the `command` value is `serve` in dev (in the cli `vite`, `vite dev`, and `vite serve`
> are aliases)."*

Three CLI spellings, one value. `apply: 'dev'` is not a documented value and matches nothing:

```
vite            ┐
vite dev        ├─→  command === 'serve'
vite serve      ┘

vite build      ──→  command === 'build'
```

⚠️ The `config` hook's documented env type is `{ mode: 'build' | 'serve', command: string,
isSsrBuild?: boolean, isPreview?: boolean }` — in which the `mode` and `command` annotations appear
transposed relative to the prose and every example on the page, which consistently compare
`command` against `'serve'` and `'build'`. The prose is unambiguous; treat `command` as
`'serve' | 'build'` and do not build anything on that type line. ⚠️ The page also does not state which
`command` value `vite preview` reports; the env carries a separate `isPreview` flag, so preview is
distinguished by a flag rather than by a third `command` value.

### Structural exclusion beats a runtime guard

This is the whole argument for the property, and it is the same argument [chunk
1k](01k-the-guard-is-not-the-fix.md) makes at length:

```
if (server) { … }     "this MIGHT not be here"   → a branch, evaluated at runtime,
                                                   silently taken either way, and
                                                   green in CI whichever way it went

apply: 'serve'        "this plugin does not       → structural. The plugin is not
                       participate in builds"       invoked in a build at all
```

Three consequences follow, and only the first is obvious:

1. **There is no build-path branch to get wrong**, because there is no build path.
2. **A non-null assertion becomes true.** `server!` inside a plugin that only ever runs under
   `apply: 'serve'` is a statement about the plugin's contract, not a way to silence the compiler.
3. **The intent is in the plugin list, where reviewers read it.** A guard buried in a hook is
   invisible in a config diff; `apply: 'serve'` on the plugin object is not.

---

## 2. Real-World Engineering Scenario

A telemetry plugin records every module it transforms and writes a report. It uses
`server.moduleGraph`, so the author added `if (!server) return` at the top of `transform` to make
the build compile. CI is green. Six months later the platform team asks why production builds have
no coverage data: the plugin has never emitted anything from a build, and nobody noticed because
the dashboard was full — of numbers from developers' local dev servers.

The guard did three things, all bad:

- It **converted a loud crash into a quiet degradation.** A missing `server` would have thrown.
- It **made the gap invisible in review.** The config lists the plugin; nothing says it is inert.
- It **made the failure untestable in unit tests**, because Vitest runs through Vite's dev
  transform — the test suite exercised the branch that was never broken.

Two of the three disappear immediately with `apply: 'serve'`. The plugin now honestly declares it
is a dev tool, the config diff says so, and `server` is non-optional inside it. What `apply` does
**not** do is give you build coverage — if the feature was supposed to work in builds, `apply` is
the wrong answer too, and you need a build implementation. That is the choice [chunk
1k](01k-the-guard-is-not-the-fix.md) forces you to make explicitly.

---

## 3. Production-Grade Code Example

```ts
// plugins/dev-telemetry.ts — a genuinely dev-only plugin. No guard, because there is no build path.
import type { Plugin, ViteDevServer } from 'vite'

export function devTelemetry(): Plugin {
  let server: ViteDevServer

  return {
    name: 'dev-telemetry',
    apply: 'serve', // STRUCTURAL: never invoked during `vite build`

    configureServer(s) {
      server = s // no `?`, no `!` — apply: 'serve' makes this assignment certain
    },

    transform(code, id) {
      const mod = server.moduleGraph.getModuleById(id)
      if (mod) recordTransform(id, code.length, mod.importers.size)
      return null
    },
  }
}
```

```ts
// plugins/asset-budget.ts — build-only, and not for SSR builds.
import type { Plugin, UserConfig } from 'vite'

export function assetBudget(maxKb: number): Plugin {
  return {
    name: 'asset-budget',

    // The documented function form: apply only on build, but not for SSR.
    apply(config: UserConfig, { command }: { command: string }) {
      return command === 'build' && !config.build?.ssr
    },

    generateBundle(_options, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        const size = chunk.type === 'chunk' ? chunk.code.length : chunk.source.length
        if (size > maxKb * 1024) {
          this.error(`${fileName} is ${size} bytes, over the ${maxKb} kB budget`)
        }
      }
    },
  }
}
```

The SSR exclusion is the reason the function form exists: an SSR build produces a server bundle
where a browser asset budget is meaningless, and `apply: 'build'` alone cannot express "build, but
not that build".

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — `apply: 'dev'`

Not a documented value. The documented values are `'build'` and `'serve'`, and `'serve'` is what
`vite`, `vite dev` and `vite serve` all produce. ⚠️ The docs do not state what Vite does with an
unrecognised string, so do not reason about it — write `'serve'`.

### ⚠️ Pitfall 2 — `apply: 'build'` on a plugin with `configureServer`

The hook can never fire. It is not an error, it is dead code, and it usually means the author meant
`apply: 'serve'` and inverted it.

### ⚠️ Pitfall 3 — `apply: 'serve'` on a plugin whose `transform` also matters in a build

This is the mirror of the guard bug with a nicer syntax. Scoping to serve is only correct when the
behaviour is genuinely dev-only; if the transform shapes shipped code, you have just removed it
from production.

### ⚠️ Pitfall 4 — Reading the function form's condition backwards

`return command === 'build' && !config.build.ssr` returns **true to apply**. It is a predicate for
inclusion, not exclusion, and the `!` makes it easy to read as the opposite at a glance.

### ⚠️ Pitfall 5 — Assuming `apply` re-runs

⚠️ The docs describe it as controlling whether a plugin is *invoked* for serve or build; they do
not document it as re-evaluated during a session. Treat the outcome as fixed for the run, and never
put changing state in the function.

---

## Gotchas

**★ Symptom: a plugin's `configureServer` never runs and no error appears.** Cause: the plugin
carries `apply: 'build'`, so it is not invoked during serve at all. Fix: invert it — `apply:
'serve'` — or drop `apply` entirely if the plugin genuinely belongs in both.

**★ Symptom: a feature works in dev and is silently missing in production.** Cause: a runtime guard
like `if (!server) return` neutralised the plugin's build path instead of a structural decision
being made. Fix: decide explicitly — `apply: 'serve'` if it is dev-only, or a real build
implementation if it is not. [Chunk 1k](01k-the-guard-is-not-the-fix.md) has the full decision.

**★ Symptom: TypeScript demands `server?` or `server!` inside a dev-only plugin.** Cause: the type
system cannot see that the plugin only runs under serve, because nothing told it. Fix: state it
structurally — `apply: 'serve'` with `let server: ViteDevServer` — so the assertion is a documented
contract rather than a silencer.

**★ Symptom: an asset-budget or bundle-analysis plugin fails during an SSR build.** Cause: `apply:
'build'` includes SSR builds, where browser-oriented output assumptions do not hold. Fix: the
documented function form — `apply(config, { command }) { return command === 'build' &&
!config.build.ssr }`.

**★ Symptom: `apply: 'dev'` appears to do nothing.** Cause: it is not a documented value; the dev
command's value is `'serve'`, with `vite`, `vite dev` and `vite serve` all aliases for it. Fix:
`apply: 'serve'`.

**★ Symptom: the `apply` function throws reading `config.build.ssr`.** Cause: the documented
example dereferences `config.build` directly and the docs do not state that it is always defined.
Fix: `return command === 'build' && !config.build?.ssr`, with a comment noting the deviation from
the documented example.

---

## Interview questions

**★ Why is `apply: 'serve'` stronger than `if (server) { … }` inside the hook?**
Because it changes
the plugin's participation rather than its behaviour. With a guard, the plugin is invoked in the
build, the branch is evaluated, and the "not available" path is taken silently — CI is green
whichever way it went, and the failure surfaces as a missing feature nobody attributes to that
plugin. With `apply: 'serve'` the plugin is not invoked in a build at all: there is no absence to
guard, no branch to get wrong, and the exclusion is visible in the plugin list where a reviewer
reads it. It also makes any non-null assertion on the dev server genuinely true, because the
contract now says the plugin only ever runs where the server exists.

**★ What values can `command` take, and why do people write `'dev'`?**
It is `'serve'` or
`'build'`. People write `'dev'` because the CLI accepts `vite dev`, and the docs address exactly
that confusion: *"the `command` value is `serve` in dev (in the cli `vite`, `vite dev`, and `vite
serve` are aliases)"*. Three spellings collapse to one value, and there is no third. Since `'dev'`
is not a documented value, a plugin written with `apply: 'dev'` is relying on unspecified behaviour
rather than on a documented one — which is a different kind of bug from a typo, because nothing
rejects it.

**★ When do you need the function form of `apply` rather than the string?**
When the condition is
finer than serve-vs-build. The documented case is SSR: `apply(config, { command }) { return command
=== 'build' && !config.build.ssr }` — *"apply only on build but not for SSR"* — because an SSR
build produces a server bundle where browser-oriented plugins (asset budgets, legacy transpilation,
image optimisation) are meaningless or harmful. `apply: 'build'` alone cannot express "build, but
not that build". Note that the function returns
**true to apply**, so it is an inclusion predicate, and the docs give no formal type for it beyond
that example.

---

← [Augmenting Plugins You Do Not Own](01pb-augmenting-plugins-you-do-not-own.md) · [Vite overview](../../README.md) · Next → [Four Ways to Make a Plugin Conditional](01qa-four-ways-to-make-a-plugin-conditional.md)
