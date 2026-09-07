---
title: "Four documented ways to make a plugin conditional, three of them structural and one of them a guard — and the whole skill is knowing which question each one answers"
sidebar_label: "Four Ways to Make a Plugin Conditional"
sidebar_position: 36
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § Conditional Application](https://vite.dev/guide/api-plugin), [§ Plugins Config](https://vite.dev/guide/api-plugin), [§ Rolldown Plugin Compatibility](https://vite.dev/guide/api-plugin), [§ Plugin Ordering](https://vite.dev/guide/api-plugin). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Four Ways to Make a Plugin Conditional

**Vite documents four ways to keep a plugin out of a pipeline, and they are not
interchangeable — each keys off a different fact, evaluated by a different party, at a different
time.** Three of them are structural, meaning the plugin is simply not there. The fourth is a
branch inside a hook, and it is the only one that leaves a live plugin pretending to work. Picking
by habit rather than by question is how a feature quietly stops existing in production.

---

## 1. Under-The-Hood Mechanics

### The four, side by side

| # | Mechanism | Keys off | Evaluated by | Structural? |
|---|---|---|---|---|
| 1 | `apply: 'serve' \| 'build'` | the command Vite is running | **Vite** | ✅ |
| 2 | `apply(config, { command })` | command **plus** anything in the config | **Vite** | ✅ |
| 3 | a falsy entry in `plugins` | anything available when the config module runs | **your config code** | ✅ |
| 4 | `build.rolldownOptions.plugins` | being build-only, by placement | **Vite** | ✅ |
| ⛔ | `if (server) { … }` inside a hook | runtime state | **your hook** | ❌ a guard |

Row 5 is on the table because it is what people write, not because it belongs — it is the subject
of [chunk 1k](01k-the-guard-is-not-the-fix.md) and it is a different thing wearing the same
clothes.

### 3 — the falsy entry

> *"Falsy plugins will be ignored, which can be used to easily activate or deactivate plugins."*

```js
// Evaluated by YOU, when the config module runs.
plugins: [process.env.ANALYZE && analyzer()]

// Evaluated by VITE, per invocation, with the command it is actually running.
plugins: [analyzer()]   // where analyzer() sets apply: 'build'
```

Both are structural — neither leaves a dead branch inside a hook. The difference is *who decides
and when*. The falsy entry can key off an environment variable, a workspace path, a feature flag or
a CLI argument, none of which Vite has an opinion about. `apply` can only key off the command and
the config, but it stays correct however the config is invoked.

🔴 **The rule: if the condition *is* serve-vs-build, it belongs in `apply`.** Expressing it as
`process.env.NODE_ENV === 'production' && plugin()` recreates the same decision from a weaker
signal, and the two disagree the first time someone runs a production-mode dev server.

### 4 — placement instead of a property

> *"If a Rolldown / Rollup plugin only makes sense for the build phase, then it can be specified
> under `build.rolldownOptions.plugins` instead. It will work the same as a Vite plugin with
> `enforce: 'post'` and `apply: 'build'`."*

This is the only mechanism where the *location* carries the meaning: nothing on the plugin object
says "build-only", the array it sits in does. Behaviourally the docs equate it exactly with
`enforce: 'post'` plus `apply: 'build'`, so the choice is communicative, not functional. Compatibility
criteria for such plugins are [chunk 1t](01t-rolldown-compatibility-and-paths.md).

### `apply` and `enforce` are orthogonal

They are two independent Vite-only properties on the same object, and the documented augmentation
pattern sets both at once — `{ ...example(), enforce: 'post', apply: 'build' }` — which is exactly
why they get confused for one mechanism:

```
apply    → WHETHER the plugin participates in this invocation
enforce  → WHERE it sits in the resolved order when it does
```

`enforce: 'post'` never excluded anything from dev, and `apply: 'build'` says nothing about
ordering. See [chunk 1p](01p-plugin-ordering-and-enforce.md).

### What none of them cover: preview

⚠️ The config env exposes `isPreview?: boolean` alongside `command`, so preview is signalled by a
separate flag rather than by a third `command` value — but the Plugin API page does not state which
`command` value `vite preview` reports. If a plugin must behave differently under preview, key off
`isPreview` in `config` or `configResolved` rather than guessing at `apply`.

---

## 2. Real-World Engineering Scenario

A monorepo has a bundle analyzer wired in as `plugins: [process.env.ANALYZE && analyzer()]`. It
works. Two problems arrive in the same sprint:

- CI's build job does not set `ANALYZE`, so the size report that the release checklist depends on
  has never been generated in CI — only on the laptop of whoever added the plugin.
- A developer runs `vite --mode production` to reproduce a bug, `ANALYZE` happens to be exported in
  their shell from an earlier session, and the analyzer runs during **dev**, where its
  `generateBundle` never fires and it silently contributes nothing.

Both are the same mistake: a serve-vs-build decision expressed through an environment variable. The
condition "this only makes sense when a bundle exists" is exactly what `apply: 'build'` states, and
Vite evaluates it from the command rather than from a shell.

The corrected arrangement uses the mechanisms for what they are:

```js
plugins: [
  analyzer(),                       // apply: 'build' lives inside analyzer()
  process.env.PROFILE && profiler(), // genuinely an operator switch, not a phase
]
```

Now CI generates the report because it runs `vite build`, and no shell variable can make the
analyzer run in dev.

---

## 3. Production-Grade Code Example

```ts
// vite.config.ts — all four mechanisms in one file, each answering its own question.
import { defineConfig } from 'vite'
import legacyRollupPlugin from 'rollup-plugin-legacy-thing'
import { devOverlay } from './plugins/dev-overlay'
import { assetBudget } from './plugins/asset-budget'
import { profiler } from './plugins/profiler'

export default defineConfig({
  plugins: [
    // 1. string apply — dev-only by nature (inside devOverlay: apply: 'serve')
    devOverlay(),

    // 2. function apply — build, but not SSR builds (inside assetBudget)
    assetBudget(250),

    // 3. falsy entry — an operator switch, nothing to do with serve vs build
    process.env.PROFILE === '1' && profiler(),
  ],

  build: {
    rolldownOptions: {
      // 4. placement — a Rollup plugin that only makes sense in a build
      plugins: [legacyRollupPlugin()],
    },
  },
})
```

```ts
// plugins/dev-overlay.ts — the condition belongs to the PLUGIN, not to the config.
import type { Plugin, ViteDevServer } from 'vite'

export function devOverlay(): Plugin {
  let server: ViteDevServer

  return {
    name: 'dev-overlay',
    apply: 'serve', // every consumer inherits this; nobody has to remember it

    configureServer(s) {
      server = s
      s.middlewares.use('/__overlay', (_req, res) => {
        res.end(JSON.stringify({ modules: server.moduleGraph.idToModuleMap.size }))
      })
    },
  }
}
```

Putting `apply` inside the plugin rather than wrapping the call site in a condition is the whole
point: the constraint travels with the plugin, so it cannot be lost when someone copies the config
into a second app.

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — A falsy entry that is `undefined` on CI

The falsy rule ignores the entry silently — that is the feature. It also means a typo'd variable
name deactivates the plugin with no message. Assert the switch instead of trusting it:
`const profile = process.env.PROFILE === '1'` beside the plugins array, where a reader sees it.

### ⚠️ Pitfall 2 — Moving a plugin to `build.rolldownOptions.plugins` to "fix" a dev error

That is a valid *placement* for a build-only plugin, but if the plugin was erroring in dev because
its hooks do not make sense unbundled, the placement hides a compatibility problem rather than
resolving it — [chunk 1t](01t-rolldown-compatibility-and-paths.md).

### ⚠️ Pitfall 3 — Combining a guard with `apply`

`apply: 'serve'` plus `if (!server) return` inside the same plugin is not belt and braces; it is a
signal that nobody was sure which pipeline the plugin runs in. Delete the guard — under
`apply: 'serve'` it is unreachable, and leaving it in teaches the next reader that the plugin might
run in a build.

---

## Gotchas

**★ Symptom: a plugin is conditionally excluded, but only on some developers' machines.** Cause: it
was excluded with an environment-variable falsy entry (`process.env.X && plugin()`) rather than by
command, so the condition depends on each shell. Fix: if the condition is serve-vs-build, express it
as `apply` so Vite decides from the command it is actually running.

**★ Symptom: a Rollup plugin misbehaves in dev and `enforce` changes nothing.** Cause: `enforce` is
a band, not a phase — it never excluded the plugin from serve. Fix: `apply: 'build'`, or move it to
`build.rolldownOptions.plugins`, which works *"the same as a Vite plugin with `enforce: 'post'` and
`apply: 'build'`"*.

**★ Symptom: a unit test proves the guarded dev branch works, and production still breaks.** Cause:
Vitest runs through Vite's dev transform, so the suite only ever exercised the serve path. Fix: the
control has to be a build-time assertion in CI — run `vite build` and assert the plugin's side
effect exists, which is also the only test that would notice `apply` set to the wrong value.

**★ Symptom: a report or artefact is produced locally but never in CI.** Cause: the plugin is gated
by an environment variable that CI does not set, and a falsy entry is ignored silently by design.
Fix: gate it on the command instead (`apply: 'build'`), or set the variable in the CI job and assert
the artefact exists as a build step — never both halves left implicit.

**★ Symptom: the same plugin is configured twice, once in `plugins` and once in
`build.rolldownOptions.plugins`.** Cause: someone added the documented build-only placement without
removing the original entry. Fix: keep one; the docs describe the placement as equivalent to
`enforce: 'post'` plus `apply: 'build'`, so there is no reason to have both.

**★ Symptom: copying a working `vite.config.ts` into a second app loses a plugin's dev-only
scoping.** Cause: the constraint lived at the call site as a config-level condition instead of on
the plugin. Fix: move it into the plugin — `apply: 'serve'` on the object the factory returns —
so it travels with every consumer.

---

## Interview questions

**★ Vite offers several ways to leave a plugin out. What is the difference?**
`apply` is evaluated by Vite against the command it is running; the falsy-entry rule — *"Falsy
plugins will be ignored"* — is evaluated by your own config code when the config module runs; and
`build.rolldownOptions.plugins` encodes the same exclusion in *where* the plugin is written. All
three are structural, so none leaves a dead branch inside a hook, but they answer different
questions. Anything keyed to serve-vs-build belongs in `apply`, because it stays correct however the
config is invoked; anything keyed to an environment variable, a flag or a workspace layout belongs
in a falsy entry, because Vite has no opinion about those.

**★ How do `apply` and `enforce` relate?**
They are orthogonal Vite-only properties on the same plugin object and are frequently used
together. `apply` decides **whether** the plugin participates in a given invocation; `enforce`
decides **where** in the resolved seven-slot order it sits when it does. Neither substitutes for the
other: `enforce: 'post'` never excludes a plugin from dev, and `apply: 'build'` says nothing about
ordering. The documented augmentation pattern sets both at once —
`{ ...example(), enforce: 'post', apply: 'build' }` — which is a large part of why they get
confused for one mechanism.

**★ A plugin needs different behaviour in dev and build. Is `apply` the right tool?**
Usually not — `apply` is for plugins that should not exist in one of the two pipelines, not for
plugins that behave differently in each. If both paths are real, keep one plugin and branch on
`config.command` inside it, deriving the difference from something available in both pipelines and
testing the build path in CI. Reach for `apply` when the honest answer is "this has no meaning in a
build" (a dev overlay, a request logger, a mock server) or "this has no meaning in dev" (a manifest
post-processor, an asset budget). The failure mode of picking wrong is not a crash; it is a feature
that quietly stops existing in production.

**★ Why is an environment-variable condition a poor substitute for `apply`?**
Because it re-derives a fact Vite already knows from a signal Vite does not control. `NODE_ENV`,
`CI` and custom flags are set by shells, CI jobs and `.env` files, so the same config produces
different plugin lists on different machines — and the falsy rule ignores a missing variable
silently, so nothing announces the difference. `apply` is evaluated by Vite against the command it
is actually running, which means a plugin scoped `apply: 'build'` runs in every build and no dev
server, everywhere, forever. Keep env-var gating for genuine operator switches like a profiler.

**★ When is `build.rolldownOptions.plugins` the better spelling of `apply: 'build'`?**
When the plugin is a Rolldown or Rollup plugin that has no meaning in dev at all, and you want that
to be structural rather than a property someone can delete in a merge. The docs state the two are
behaviourally the same — it *"will work the same as a Vite plugin with `enforce: 'post'` and
`apply: 'build'`"* — so the decision is about what the next reader infers. The main array is better
when someone benefits from seeing every plugin in one list; the build options are better when
"this is not part of dev" is the most important thing to communicate.

---

← [Conditional Application (`apply`)](01q-conditional-application.md) · [Vite overview](../../README.md) · Next → [Hook Filters](01r-hook-filters.md)
