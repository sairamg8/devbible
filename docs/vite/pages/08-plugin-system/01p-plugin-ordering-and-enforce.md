---
title: "`enforce` picks one of three user bands inside a seven-slot resolved order — it is not an index, and the plugins array you wrote is not the pipeline Vite runs"
sidebar_label: "Plugin Ordering & `enforce`"
sidebar_position: 32
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § Plugin Ordering](https://vite.dev/guide/api-plugin), [§ Plugins Config](https://vite.dev/guide/api-plugin), [§ `config`](https://vite.dev/guide/api-plugin). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Plugin Ordering & `enforce`

**`enforce` does not move a plugin up or down the array. It assigns the plugin to one of three
*user bands* in a fixed seven-slot pipeline whose other four slots belong to Vite — and the array
you wrote is not that pipeline.** Presets flatten, so one visible entry can contribute plugins to
all three user bands at once; and even once you know the band, *hook* ordering is a separate
mechanism again ([chunk 1pa](01pa-enforce-vs-hook-order.md)). Reading execution order off
`vite.config.ts` is wrong for three independent reasons simultaneously.

---

## 1. Under-The-Hood Mechanics

### The resolved order, verbatim

> *"A Vite plugin can additionally specify an `enforce` property (similar to webpack loaders) to
> adjust its application order. The value of `enforce` can be either `"pre"` or `"post"`. The
> resolved plugins will be in the following order:"*
>
> * *Alias*
> * *User plugins with `enforce: 'pre'`*
> * *Vite core plugins*
> * *User plugins without enforce value*
> * *Vite build plugins*
> * *User plugins with `enforce: 'post'`*
> * *Vite post build plugins (minify, manifest, reporting)*

Seven slots, three of which are yours:

```
1  Alias                                          ← Vite
2  User plugins with enforce: 'pre'               ← YOURS
3  Vite core plugins                              ← Vite
4  User plugins without enforce value             ← YOURS  (the default)
5  Vite build plugins                             ← Vite
6  User plugins with enforce: 'post'              ← YOURS
7  Vite post build plugins (minify, manifest, …)  ← Vite
```

Two consequences fall straight out of that list, and both surprise people:

- **`enforce: 'pre'` is not first.** Slot 1 is *Alias*. A plugin that wants the id *before*
  `resolve.alias` rewrote it has no `enforce` value that gets it there.
- **`enforce: 'post'` is sixth of seven, not last.** Minification, manifest generation and build
  reporting are documented as running *after* your `'post'` band. "Post" means *after the other
  user plugins*, not *after Vite is finished*.

⚠️ The documentation names the four Vite bands but does **not** enumerate which built-in plugins
sit in "Vite core plugins" versus "Vite build plugins", and it does not state which hook each
slot-7 plugin uses. Treat the list as an ordering of *plugin objects* — not as a promise about what
a specific hook observes.

### A preset turns one array entry into several plugins

The array you can see is not the array Vite resolves:

> *"`plugins` also accepts presets including several plugins as a single element. This is useful
> for complex features (like framework integration) that are implemented using several plugins.
> The array will be flattened internally."*

One entry, several plugins, and **each flattened plugin carries its own `enforce`** — so a single
array position can contribute a plugin to band 2, another to band 4 and another to band 6. That is
why a framework integration genuinely appears to run both before and after your plugin. It does.
Naming conventions and the falsy-entry rule are in [chunk 1a](01a-plugin-conventions.md).

```
plugins: [framework(), myPlugin()]     ← what you wrote: 2 entries

  flattened and banded:
    band 2 (pre)   frameworkRefresh
    band 4 (none)  myPlugin
    band 4 (none)  frameworkCore
    band 6 (post)  frameworkDevtools
```

### The plugin list is frozen before `config` runs

You cannot repair ordering from inside a hook, because by the time the first Vite-specific hook
fires the resolved list already exists:

> *"User plugins are resolved before running this hook so injecting other plugins inside the
> `config` hook will have no effect."*

Ordering is a **configuration-time** decision. There is no runtime escape hatch.

---

## 2. Real-World Engineering Scenario

A team ships an internal `vite-plugin-i18n-macro` that rewrites `t('key')` calls into inlined
strings. It works in isolation. Added to the app repo, roughly one string in five stops being
inlined — non-deterministically, and differently on each machine.

The config is `plugins: [react(), i18nMacro(), legacy()]`, and the assumption was "React first,
then me". Neither half of that is true:

- `@vitejs/plugin-react` is a **preset**, flattened into several plugins, and at least one member
  carries `enforce: 'pre'`. Part of it runs in band 2 — before Vite core plugins and before
  `i18nMacro` in band 4 — while other members run later.
- The macro also reads a manifest that a *second* plugin writes in `configResolved`, whose
  documented Kind is `parallel`. Whether that manifest exists when the macro reads it is not
  ordered by anything at all.

The fix needs two changes driven by two different mechanisms, and conflating them is what cost the
week:

1. Move the macro into **band 2** with `enforce: 'pre'` so it sees source text before the
   framework transform rewrites it — *plugin* ordering, which `enforce` genuinely controls.
2. Stop coordinating through `configResolved`. No `enforce` value repairs a `parallel` hook —
   see [chunk 1pa](01pa-enforce-vs-hook-order.md) and [chunk 1f](01f-hook-kinds-and-ordering-guarantees.md).

Change 1 alone makes the failure rarer, which is the worst available outcome: it looks fixed.

---

## 3. Production-Grade Code Example

```ts
// vite.config.ts — every plugin's band stated explicitly, including the defaults.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import example from 'rolldown-plugin-example'
import { i18nMacro } from './plugins/i18n-macro'
import { licenseHeader } from './plugins/license-header'

export default defineConfig({
  plugins: [
    // A PRESET. Flattens to several plugins, each with its own enforce.
    // You do not control their bands; do not reason about "where react() is".
    react(),

    // band 2 — must see raw source before the framework transform touches it.
    i18nMacro(),

    // band 4 (default) — ordinary transform, no cross-plugin dependency.
    licenseHeader(),

    // Augmenting a third-party plugin with Vite-only keys — see chunk 1pa.
    { ...example(), enforce: 'post', apply: 'build' },
  ],
})
```

```ts
// plugins/i18n-macro.ts — the band is a property of the PLUGIN, not of the call site.
import type { Plugin } from 'vite'

export function i18nMacro(): Plugin {
  return {
    name: 'i18n-macro',
    enforce: 'pre', // band 2: before Vite core plugins and every default-band plugin
    transform: {
      filter: { id: /\.[jt]sx?$/ },
      handler(code, id) {
        if (!code.includes('t(')) return null
        return { code: inlineMessages(code, id), map: null }
      },
    },
  }
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Reordering the array to fix ordering

Moving an entry changes nothing across bands. A `'pre'` plugin written at the bottom of the array
still runs before every default-band plugin at the top of it. If the two plugins are in different
bands, the array is not the lever.

### ⚠️ Pitfall 2 — Assuming Vite's own bands are stable furniture

The docs name "Vite core plugins" and "Vite build plugins" as bands but never list their members,
so a plugin whose correctness depends on landing between two *specific* built-ins is depending on
something undocumented. Depend on the band boundary, never on a particular built-in.

### ⚠️ Pitfall 3 — Depending on order *within* a band

⚠️ The documentation lists bands, not positions inside a band; it does not state how two plugins
sharing an `enforce` value are ordered relative to each other. Design so you do not need to know,
or move one of them to a different band so the dependency becomes a documented boundary.

---

## Gotchas

**★ Symptom: a transform sees code another plugin has already rewritten, and moving it up the array
changes nothing.** Cause: the other plugin is in an earlier *band*, and array position only ever
mattered within a band. Fix: `enforce: 'pre'`, which is a plugin property, not a position —
`return { name: 'my-plugin', enforce: 'pre', transform: { /* … */ } }`.

**★ Symptom: a third-party plugin appears to run both before *and* after yours.** Cause: it is a
preset — *"several plugins as a single element"*, and *"the array will be flattened internally"* —
whose members carry different `enforce` values. Fix: stop reasoning about the entry; inspect the
resolved plugin list with `vite-plugin-inspect` and target the specific member.

**★ Symptom: an `enforce: 'post'` plugin cannot see minified output or the manifest.** Cause: the
documented order puts *"Vite post build plugins (minify, manifest, reporting)"* in slot 7, after
your `'post'` band. Fix: `enforce` cannot reach slot 7 — move the work to a hook that runs after
those plugins have done theirs, and check that hook's documented Kind rather than assuming.

**★ Symptom: an id arrives at a `'pre'` plugin already aliased.** Cause: *Alias* is slot 1 and
precedes every user band. Fix: no `enforce` value runs before alias resolution — either resolve the
original specifier yourself in `resolveId`, or key the plugin off the aliased id you actually
receive.

**★ Symptom: a plugin added inside the `config` hook never runs.** Cause: *"User plugins are
resolved before running this hook so injecting other plugins inside the `config` hook will have no
effect."* Fix: return it from the config factory instead — `defineConfig(({ command }) => ({
plugins: [base(), command === 'build' && extra()] }))`, relying on the documented rule that falsy
plugins are ignored.

**★ Symptom: two of your own plugins depend on each other, and the dependency breaks after a Vite
upgrade.** Cause: they shared a band, and inside-band order is not documented. Fix: give the
producer `enforce: 'pre'` and leave the consumer in the default band, so the ordering rests on a
band boundary the documentation actually states.

**★ Symptom: a plugin works in one app and silently no-ops in another with the same config.**
Cause: the other app's preset contributes a member in an earlier band that consumes or rewrites the
input your plugin keys off. Fix: do not diff the two configs — diff the two *resolved* plugin
lists, because the configs can be identical while the flattened lists are not.

---

## Interview questions

**★ What exactly does `enforce` change, and what does it not?**
It assigns the plugin to one of
three user bands in a seven-slot resolved order: `'pre'` is slot 2, no value is slot 4, `'post'` is
slot 6. The other four slots — alias, Vite core plugins, Vite build plugins, and the post-build
plugins that do minify, manifest and reporting — belong to Vite, and no `enforce` value reaches
them. It does not change the plugin's position within its own band in any documented way, it does
not sequence hooks, and it does not manufacture an ordering guarantee where the hook's Kind says
there is none.

**★ Someone says "Vite plugins run in the order of the array." Why is that wrong three times
over?** First, `enforce` bands split the array into three groups interleaved with four Vite groups,
so a plugin at the bottom of the file can run before one at the top. Second, presets flatten —
*"the array will be flattened internally"* — so one visible entry can contribute plugins to several
different bands. Third, what you are usually asking about is a *hook*, and hooks are subject to
their own `order` attribute and, above that, to whether the hook's Kind is `sequential` or
`parallel`. The array is a configuration input, not a schedule.

**★ Why is `enforce: 'post'` not the last thing to run?**
Because the documented order has a
seventh slot after it: *"Vite post build plugins (minify, manifest, reporting)"*. `'post'` means
after the other **user** plugins, not after Vite. That matters for anything that wants to inspect
final output — a size budget, a subresource-integrity pass, a manifest post-processor — because
minification and manifest generation have not necessarily happened when your `'post'` plugin runs,
and there is no `enforce` value that gets you into slot 7.

**★ Two of your own plugins must run in a fixed relative order. How do you express that?**
Put them
in different bands rather than relying on their positions in the array: give the producer `enforce:
'pre'` and leave the consumer with no `enforce`, so the ordering is the documented band boundary.
Ordering *within* a band is not something the documentation states, so a dependency resting on it
is resting on nothing citable. Then check the hook you are actually coordinating through — if its
Kind is `parallel`, the band boundary buys you nothing and the design has to change instead.

**★ A plugin must see a module's source before any framework transform touches it. Is `enforce:
'pre'` enough?** It is necessary but not sufficient, and the gap is worth naming. `'pre'` puts you
in band 2, ahead of Vite core plugins and every default-band plugin, but it does not put you ahead
of slot 1 (alias), and it does not put you ahead of another `'pre'` plugin that a framework preset
contributed — inside-band order is undocumented. In practice you write the plugin so it is
idempotent and detects already-transformed input rather than assuming it is first, because "first"
is not a position `enforce` can express.

---

← [Typing Custom Events](01oe-typing-custom-events.md) · [Vite overview](../../README.md) · Next → [`enforce` vs Hook `order`](01pa-enforce-vs-hook-order.md)
